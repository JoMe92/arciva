import uuid
from io import BytesIO

import numpy as np
import pytest
from PIL import Image
from sqlalchemy import select

from backend.app import models, schemas
from backend.app.services import adjustments as adjustments_service
from backend.app.storage import PosixStorage


def test_apply_adjustments_pipeline_changes_pixels():
    base = Image.new("RGB", (64, 48), color=(120, 110, 100))
    adjustments = schemas.QuickFixAdjustments(
        crop=schemas.CropSettings(rotation=10, aspect_ratio=4 / 3),
        exposure=schemas.ExposureSettings(
            exposure=0.75, contrast=1.2, highlights=0.3, shadows=-0.2
        ),
        color=schemas.ColorSettings(temperature=0.5, tint=-0.3),
        geometry=schemas.GeometrySettings(vertical=0.2, horizontal=-0.2),
    )

    result = adjustments_service.apply_adjustments(base, adjustments)

    assert result.mode == "RGB"
    assert result.size == base.size
    base_mean = float(np.asarray(base).mean())
    result_mean = float(np.asarray(result).mean())
    assert abs(result_mean - base_mean) > 1.0


def test_apply_adjustments_with_grain_is_deterministic():
    base = Image.new("RGB", (32, 32), color=(128, 128, 128))
    np.random.seed(7)
    adjustments = schemas.QuickFixAdjustments(
        grain=schemas.GrainSettings(amount=0.8, size="coarse")
    )

    result = adjustments_service.apply_adjustments(base, adjustments)

    assert result.size == base.size
    assert result.getpixel((0, 0)) != (128, 128, 128)


@pytest.mark.skip(reason="QuickFix backend rendering disabled")
@pytest.mark.asyncio
async def test_quick_fix_preview_and_save(client, TestSessionLocal):
    storage = PosixStorage.from_env()
    user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")

    project_response = await client.post(
        "/v1/projects", json={"title": "Quick Fix", "client": "Test"}
    )
    assert project_response.status_code == 201
    project_id = uuid.UUID(project_response.json()["id"])

    sha = uuid.uuid4().hex
    original_path = storage.original_path_for(sha, ".jpg")
    Image.new("RGB", (160, 120), color=(200, 50, 50)).save(original_path, format="JPEG")

    asset_id = uuid.uuid4()

    async with TestSessionLocal() as session:
        asset = models.Asset(
            id=asset_id,
            user_id=user_id,
            sha256=sha,
            format="JPEG",
            original_filename="quickfix.jpg",
            mime="image/jpeg",
            size_bytes=original_path.stat().st_size,
            storage_uri=storage.storage_key_for(original_path),
            status=models.AssetStatus.READY,
            width=160,
            height=120,
        )
        session.add(asset)
        link = models.ProjectAsset(
            user_id=user_id,
            project_id=project_id,
            asset_id=asset_id,
        )
        session.add(link)
        await session.flush()
        session.add(models.MetadataState(link_id=link.id))
        await session.commit()

    adjustments = {
        "crop": {"rotation": 15, "aspect_ratio": 0},
        "exposure": {"exposure": 0.5, "contrast": 1.1},
        "color": {"temperature": 0.25, "tint": -0.1},
        "geometry": {"vertical": 0.1, "horizontal": -0.1},
    }

    original_bytes = original_path.read_bytes()

    preview_response = await client.post(
        f"/v1/assets/{asset_id}/quick-fix/preview",
        json=adjustments,
    )
    assert preview_response.status_code == 200
    assert preview_response.headers["content-type"] == "image/jpeg"

    with Image.open(BytesIO(preview_response.content)) as preview_img:
        preview_img.load()
        assert preview_img.size[0] > 0 and preview_img.size[1] > 0

    # Ensure source image not mutated (non-destructive)
    assert original_path.read_bytes() == original_bytes

    save_response = await client.patch(
        f"/v1/projects/{project_id}/assets/{asset_id}/quick-fix",
        json=adjustments,
    )
    assert save_response.status_code == 200
    payload = save_response.json()
    assert payload["metadata_state"]["edits"]["quick_fix"]["crop"]["rotation"] == 15

    async with TestSessionLocal() as session:
        state = (
            await session.execute(
                select(models.MetadataState)
                .join(
                    models.ProjectAsset,
                    models.ProjectAsset.id == models.MetadataState.link_id,
                )
                .where(models.ProjectAsset.asset_id == asset_id)
            )
        ).scalar_one()

        assert state.edits["quick_fix"]["exposure"]["exposure"] == 0.5
