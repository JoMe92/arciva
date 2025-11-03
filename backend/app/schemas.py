from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import UUID

class AssetStatus(str, Enum):
    UPLOADING = "UPLOADING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    DUPLICATE = "DUPLICATE"
    MISSING_SOURCE = "MISSING_SOURCE"
    ERROR = "ERROR"

# Projects
class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1)
    client: Optional[str] = None
    note: Optional[str] = None

class ProjectPreviewImage(BaseModel):
    asset_id: UUID
    thumb_url: Optional[str] = None
    order: int = 0
    width: Optional[int] = None
    height: Optional[int] = None

class ProjectOut(BaseModel):
    id: UUID
    title: str
    client: Optional[str]
    note: Optional[str]
    created_at: datetime
    updated_at: datetime
    asset_count: int = 0
    preview_images: List[ProjectPreviewImage] = Field(default_factory=list)

class ProjectDelete(BaseModel):
    confirm_title: str = Field(..., min_length=1)
    delete_assets: bool = False

# Uploads/Assets
class UploadInitIn(BaseModel):
    filename: str
    size_bytes: int
    mime: str

class UploadInitOut(BaseModel):
    asset_id: UUID
    upload_token: str
    max_bytes: int

class UploadCompleteIn(BaseModel):
    asset_id: UUID

class AssetListItem(BaseModel):
    id: UUID
    status: AssetStatus
    taken_at: Optional[datetime] = None
    thumb_url: Optional[str] = None
    original_filename: Optional[str] = None
    size_bytes: Optional[int] = None
    last_error: Optional[str] = None
    metadata_warnings: List[str] = Field(default_factory=list)
    queued_at: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    width: Optional[int] = None
    height: Optional[int] = None
    is_preview: bool = False
    preview_order: Optional[int] = None

class AssetDerivativeOut(BaseModel):
    variant: str
    width: int
    height: int
    url: str

class AssetDetail(BaseModel):
    id: UUID
    status: AssetStatus
    original_filename: str
    mime: str
    size_bytes: int
    width: Optional[int]
    height: Optional[int]
    taken_at: Optional[datetime]
    storage_key: Optional[str]
    sha256: Optional[str]
    reference_count: int
    queued_at: Optional[datetime]
    processing_started_at: Optional[datetime]
    completed_at: Optional[datetime]
    last_error: Optional[str]
    metadata_warnings: List[str] = Field(default_factory=list)
    thumb_url: Optional[str]
    derivatives: List[AssetDerivativeOut] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None

# Project-asset linking
class ProjectAssetsLinkIn(BaseModel):
    asset_ids: List[UUID]

class ProjectAssetsLinkOut(BaseModel):
    linked: int
    duplicates: int
    items: List[AssetListItem]

class ProjectAssetPreviewUpdate(BaseModel):
    is_preview: bool
    make_primary: bool = False
