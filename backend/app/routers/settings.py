from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path

from .. import schemas
from ..db import get_db
from ..deps import get_settings
from ..security import get_current_user
from ..services.app_settings import get_app_setting, set_app_setting
from ..services.database_settings import (
    load_database_settings,
    update_database_path,
)
from ..services.data_reset import wipe_application_data
from ..services.schema_guard import ensure_enum_values
from ..services.photo_store_settings import (
    apply_state_to_settings,
    make_location_payload,
    normalize_photo_store_path,
    persist_photo_store_state,
    prepare_state,
    update_state,
    validate_candidate_path,
)

router = APIRouter(
    prefix="/v1/settings",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)

_IMAGE_HUB_SETTINGS_KEY = "image_hub"


def _coerce_mode(value: str | None) -> schemas.MetadataInheritanceMode:
    if not value:
        return schemas.MetadataInheritanceMode.ASK
    try:
        return schemas.MetadataInheritanceMode(value)
    except ValueError:
        return schemas.MetadataInheritanceMode.ASK


@router.get("/image-hub", response_model=schemas.ImageHubSettings)
async def get_image_hub_settings(
    db: AsyncSession = Depends(get_db),
) -> schemas.ImageHubSettings:
    record = await get_app_setting(
        db,
        _IMAGE_HUB_SETTINGS_KEY,
        {"metadata_inheritance": schemas.MetadataInheritanceMode.ASK.value},
    )
    mode = _coerce_mode(
        record.get("metadata_inheritance") if isinstance(record, dict) else None
    )
    return schemas.ImageHubSettings(metadata_inheritance=mode)


@router.put("/image-hub", response_model=schemas.ImageHubSettings)
async def update_image_hub_settings(
    body: schemas.ImageHubSettings,
    db: AsyncSession = Depends(get_db),
) -> schemas.ImageHubSettings:
    await set_app_setting(
        db,
        _IMAGE_HUB_SETTINGS_KEY,
        {"metadata_inheritance": body.metadata_inheritance.value},
    )
    await db.commit()
    return body


@router.get("/database-path", response_model=schemas.DatabasePathSettings)
async def get_database_path_settings(
    db: AsyncSession = Depends(get_db),
) -> schemas.DatabasePathSettings:
    return await load_database_settings(db)


@router.put("/database-path", response_model=schemas.DatabasePathSettings)
async def set_database_path(
    body: schemas.DatabasePathUpdate,
    db: AsyncSession = Depends(get_db),
) -> schemas.DatabasePathSettings:
    result = await update_database_path(db, body.path)
    if result.status == schemas.DatabasePathStatus.READY:
        await db.commit()
    else:
        await db.rollback()
    return result


def _build_photo_store_response(state, *, enabled: bool) -> schemas.PhotoStoreSettings:
    entries = make_location_payload(state)
    warning_active = any(item["status"] != "available" for item in entries)
    locations = [schemas.PhotoStoreLocation(**item) for item in entries]
    return schemas.PhotoStoreSettings(
        enabled=enabled,
        developer_only=True,
        warning_active=warning_active,
        last_option=state.last_option,
        locations=locations,
    )


@router.get("/photo-store", response_model=schemas.PhotoStoreSettings)
async def get_photo_store_settings_api() -> schemas.PhotoStoreSettings:
    settings = get_settings()
    enabled = bool(getattr(settings, "experimental_photo_store_enabled", False))
    if not enabled:
        return schemas.PhotoStoreSettings(
            enabled=False,
            developer_only=True,
            warning_active=False,
            locations=[],
        )
    state = prepare_state(Path(settings.fs_root))
    return _build_photo_store_response(state, enabled=enabled)


@router.post("/photo-store/validate", response_model=schemas.PhotoStoreValidationResult)
async def validate_photo_store_path(
    body: schemas.PhotoStoreValidationRequest,
) -> schemas.PhotoStoreValidationResult:
    settings = get_settings()
    enabled = bool(getattr(settings, "experimental_photo_store_enabled", False))
    if not enabled:
        raise HTTPException(404, "Experimental photo store settings are disabled.")
    valid, message = validate_candidate_path(body.path)
    normalized = normalize_photo_store_path(body.path)
    if valid and normalized:
        state = prepare_state(Path(settings.fs_root))
        desired_mode = body.mode or "fresh"
        existing_paths = {Path(loc.path) for loc in state.locations}
        if desired_mode == "add" and normalized in existing_paths:
            valid = False
            message = "Selected path is already configured."
        if desired_mode == "load":
            db_file = normalized / "arciva.db"
            if not db_file.exists():
                valid = False
                message = (
                    "arciva.db not found in the selected folder. "
                    "Choose an existing PhotoStore directory."
                )
    return schemas.PhotoStoreValidationResult(
        path=body.path, valid=valid, message=message
    )


@router.post("/photo-store/apply", response_model=schemas.PhotoStoreSettings)
async def apply_photo_store_change(
    body: schemas.PhotoStoreApplyRequest, db: AsyncSession = Depends(get_db)
) -> schemas.PhotoStoreSettings:
    settings = get_settings()
    enabled = bool(getattr(settings, "experimental_photo_store_enabled", False))
    if not enabled:
        raise HTTPException(404, "Experimental photo store settings are disabled.")
    if not body.acknowledge:
        raise HTTPException(400, "Acknowledgement required before applying changes.")
    valid, message = validate_candidate_path(body.path)
    normalized = normalize_photo_store_path(body.path)
    if not valid or not normalized:
        raise HTTPException(400, message or "Provide a valid directory path.")
    state = prepare_state(Path(settings.fs_root))
    load_existing = body.mode == "load"
    if load_existing:
        db_file = normalized / "arciva.db"
        if not db_file.exists():
            raise HTTPException(400, "arciva.db not found in the selected folder.")
    next_state = update_state(state, normalized, body.mode)
    apply_state_to_settings(settings, next_state)
    db_candidate = normalized / "arciva.db"
    db_result = await update_database_path(
        db,
        str(db_candidate),
        copy_existing=False,
        allow_create=not load_existing,
    )
    if db_result.status is not schemas.DatabasePathStatus.READY:
        await db.rollback()
        raise HTTPException(
            400,
            db_result.message
            or "Unable to initialize database at the selected location.",
        )
    if not load_existing:
        await ensure_enum_values(db)
        await wipe_application_data(db)
    await db.commit()
    persist_photo_store_state(next_state)
    return _build_photo_store_response(next_state, enabled=enabled)
