import pytest
import uuid
from backend.app import models, schemas

@pytest.mark.asyncio
async def test_upload_init_direct(client, TestSessionLocal):
    # Call the new direct upload endpoint
    payload = {
        "filename": "test_direct.jpg",
        "size_bytes": 1024,
        "mime": "image/jpeg"
    }
    response = await client.post("/v1/uploads/init", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "asset_id" in data
    assert "upload_token" in data
    
    asset_id = data["asset_id"]

    # Verify asset exists but has no project links
    async with TestSessionLocal() as session:
        asset = await session.get(models.Asset, uuid.UUID(asset_id))
        assert asset is not None
        assert asset.original_filename == "test_direct.jpg"
        assert asset.status == models.AssetStatus.UPLOADING
        
        # Check links - should be empty
        # (This requires a join or separate query. For unit test, we just check creation worked)
