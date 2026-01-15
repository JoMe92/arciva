import pytest
from uuid import UUID, uuid4
from datetime import datetime
from unittest.mock import MagicMock, patch
from PIL import Image
from backend.app import schemas, models
from backend.app.services.adjustments import apply_crop_rotate
from backend.app.services.assets import serialize_asset_item

def test_apply_crop_rotate_float_ratio():
    # Square 100x100
    img = Image.new("RGB", (100, 100), color="red")
    # Request 4:3 (1.333)
    settings = schemas.CropSettings(aspect_ratio=4/3)
    result = apply_crop_rotate(img, settings)
    
    # 4:3 on square should crop height
    # new_height = 100 / (4/3) = 75
    assert result.width == 100
    assert result.height == 75

def test_apply_crop_rotate_string_ratio():
    # Square 100x100
    img = Image.new("RGB", (100, 100), color="red")
    # Request "16:9"
    settings = schemas.CropSettings(aspect_ratio="16:9")
    result = apply_crop_rotate(img, settings)
    
    # 16:9 on square should crop height
    # new_height = 100 / (16/9) = 56.25 -> 56
    assert result.width == 100
    assert result.height == 56

def test_apply_crop_rotate_invalid_string_ratio():
    img = Image.new("RGB", (100, 100), color="red")
    # Request "invalid"
    settings = schemas.CropSettings(aspect_ratio="invalid")
    result = apply_crop_rotate(img, settings)
    
    # Should fall back to no crop (100x100)
    assert result.width == 100
    assert result.height == 100

def test_apply_crop_rotate_zero_ratio():
    img = Image.new("RGB", (100, 100), color="red")
    # Request 0.0 (Original/Free)
    settings = schemas.CropSettings(aspect_ratio=0.0)
    result = apply_crop_rotate(img, settings)
    
    assert result.width == 100
    assert result.height == 100

def test_quick_fix_adjustments_schema_validation():
    # Test float
    adj = schemas.QuickFixAdjustments(crop=schemas.CropSettings(aspect_ratio=1.5))
    assert adj.crop.aspect_ratio == 1.5
    
    # Test string
    adj = schemas.QuickFixAdjustments(crop=schemas.CropSettings(aspect_ratio="16:9"))
    assert adj.crop.aspect_ratio == "16:9"
    
    # Test None/Default
    adj = schemas.QuickFixAdjustments(crop=schemas.CropSettings())
    assert adj.crop.aspect_ratio == 0.0

@patch("backend.app.services.assets.thumb_url")
@patch("backend.app.services.assets.preview_url")
def test_serialize_asset_item_includes_metadata_state(mock_preview, mock_thumb):
    mock_thumb.return_value = "thumb.jpg"
    mock_preview.return_value = "preview.jpg"
    
    asset_id = uuid4()
    project_id = uuid4()
    link_id = uuid4()
    
    asset = models.Asset(
        id=asset_id,
        status=models.AssetStatus.READY,
        original_filename="test.jpg",
        size_bytes=1024,
        metadata_warnings=None,
    )
    
    project_asset = models.ProjectAsset(
        id=link_id,
        project_id=project_id,
        asset_id=asset_id,
        is_preview=True,
    )
    
    edits = {"quick_fix": {"exposure": {"exposure": 0.5}}}
    now = datetime.now()
    metadata = models.MetadataState(
        id=uuid4(),
        link_id=link_id,
        rating=3,
        color_label=models.ColorLabel.RED,
        picked=True,
        rejected=False,
        edits=edits,
        created_at=now,
        updated_at=now,
    )
    
    mock_storage = MagicMock()
    
    result = serialize_asset_item(
        asset=asset,
        project_asset=project_asset,
        pair=None,
        storage=mock_storage,
        metadata=metadata
    )
    
    assert result.id == asset_id
    assert result.metadata_state is not None
    assert result.metadata_state.id == metadata.id
    assert result.metadata_state.edits == edits
    assert result.metadata_state.rating == 3
    assert result.metadata_state.color_label == schemas.ColorLabel.RED
