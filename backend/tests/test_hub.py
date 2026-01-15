import pytest
import uuid
import json
from datetime import datetime
from backend.app import models


@pytest.mark.asyncio
async def test_list_hub_assets_basic(client, TestSessionLocal):
    # Setup: Create User, Project, Asset, Link
    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        project = models.Project(
            id=uuid.uuid4(),
            user_id=user_id,
            title="Hub Test Project",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(project)
        asset = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="test_hub.jpg",
            mime="image/jpeg",
            size_bytes=1000,
            status=models.AssetStatus.READY,
            created_at=datetime.utcnow(),
            width=800,
            height=600
        )
        session.add(asset)

        link = models.ProjectAsset(
            id=uuid.uuid4(),
            user_id=user_id,
            project_id=project.id,
            asset_id=asset.id,
            added_at=datetime.utcnow()
        )
        session.add(link)
        await session.commit()
    # Test - Filter by project to ensure isolation
    response = await client.get(
        f"/v1/image-hub/assets?project_id={project.id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["assets"]) >= 1
    # Check if our asset is in the list
    asset_ids = [a["asset_id"] for a in data["assets"]]
    assert str(asset.id) in asset_ids


@pytest.mark.asyncio
async def test_list_hub_assets_filtering(client, TestSessionLocal):
    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        project1 = models.Project(id=uuid.uuid4(), user_id=user_id, title="P1")
        project2 = models.Project(id=uuid.uuid4(), user_id=user_id, title="P2")
        session.add_all([project1, project2])

        asset1 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="a1.jpg",
            status=models.AssetStatus.READY,
            mime="image/jpeg",
            size_bytes=100
        )
        asset2 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="a2.jpg",
            status=models.AssetStatus.READY,
            mime="image/jpeg",
            size_bytes=100
        )
        session.add_all([asset1, asset2])

        link1 = models.ProjectAsset(
            project_id=project1.id, asset_id=asset1.id, user_id=user_id
        )
        link2 = models.ProjectAsset(
            project_id=project2.id, asset_id=asset2.id, user_id=user_id
        )
        session.add_all([link1, link2])
        await session.flush()

        # Add metadata for filtering
        meta1 = models.MetadataState(
            link_id=link1.id, rating=5, color_label="Red"
        )
        session.add(meta1)

        await session.commit()
        p1_id = str(project1.id)

    # Filter by Project
    r = await client.get(f"/v1/image-hub/assets?project_id={p1_id}")
    assert r.status_code == 200
    data = r.json()
    # Should have at least our asset
    asset_ids = [a["asset_id"] for a in data["assets"]]
    assert str(asset1.id) in asset_ids

    # Filter by Rating
    filter_bad = json.dumps({"ratings": [5]})
    r = await client.get(f"/v1/image-hub/assets?filters={filter_bad}")
    data = r.json()
    assert len(data["assets"]) == 1
    assert data["assets"][0]["rating"] == 5

    # Both should match if logic was >= 1? No, asset2 has no rating (0)
    filter_none = json.dumps({"ratings": [1]})
    r = await client.get(f"/v1/image-hub/assets?filters={filter_none}")
    data = r.json()
    # Only asset1 (rating 5) >= 1. Asset2 is 0.
    assert len(data["assets"]) == 1

    # Filter by Label
    filter_label = json.dumps({"labels": ["Red"]})
    r = await client.get(f"/v1/image-hub/assets?filters={filter_label}")
    data = r.json()
    assert len(data["assets"]) == 1
    assert data["assets"][0]["label"] == "Red"


@pytest.mark.asyncio
async def test_list_hub_date_buckets(client, TestSessionLocal):
    # Setup test data with different dates
    async with TestSessionLocal() as session:
        user_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
        proj = models.Project(
            id=uuid.uuid4(), user_id=user_id, title="Date Proj"
        )
        session.add(proj)

        # Year 2023
        d1 = datetime(2023, 5, 10)
        a1 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="2023.jpg",
            status=models.AssetStatus.READY,
            taken_at=d1,
            created_at=d1,
            mime="image/jpeg",
            size_bytes=100
        )
        l1 = models.ProjectAsset(
            project_id=proj.id, asset_id=a1.id, user_id=user_id
        )

        # Year 2024
        d2 = datetime(2024, 1, 15)
        a2 = models.Asset(
            id=uuid.uuid4(),
            user_id=user_id,
            original_filename="2024.jpg",
            status=models.AssetStatus.READY,
            taken_at=d2,
            created_at=d2,
            mime="image/jpeg",
            size_bytes=100
        )
        l2 = models.ProjectAsset(
            project_id=proj.id, asset_id=a2.id, user_id=user_id
        )

        session.add_all([proj, a1, a2, l1, l2])
        await session.commit()

    # Query Buckets (Year level)
    r = await client.get("/v1/image-hub/assets?mode=date&limit=0")
    assert r.status_code == 200
    data = r.json()
    buckets = data["buckets"]
    years = [b["year"] for b in buckets]
    assert 2023 in years
    assert 2024 in years

    # Drill down to 2024 (Month level)
    r = await client.get(
        "/v1/image-hub/assets?mode=date&year=2024&limit=0"
    )
    data = r.json()
    buckets = data["buckets"]
    months = [b["month"] for b in buckets]
    assert 1 in months  # January
