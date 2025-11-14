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


class ImgType(str, Enum):
    JPEG = "JPEG"
    RAW = "RAW"


class ColorLabel(str, Enum):
    NONE = "None"
    RED = "Red"
    GREEN = "Green"
    BLUE = "Blue"
    YELLOW = "Yellow"
    PURPLE = "Purple"


class MetadataInheritanceMode(str, Enum):
    ALWAYS = "always"
    ASK = "ask"
    NEVER = "never"

# Projects
class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1)
    client: Optional[str] = None
    note: Optional[str] = None
    stack_pairs_enabled: bool = False

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
    stack_pairs_enabled: bool = False

class ProjectDelete(BaseModel):
    confirm_title: str = Field(..., min_length=1)
    delete_assets: bool = False


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    client: Optional[str] = None
    note: Optional[str] = None
    stack_pairs_enabled: Optional[bool] = None

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
    link_id: UUID
    status: AssetStatus
    taken_at: Optional[datetime] = None
    thumb_url: Optional[str] = None
    preview_url: Optional[str] = None
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
    basename: Optional[str] = None
    pair_id: Optional[UUID] = None
    pair_role: Optional[ImgType] = None
    paired_asset_id: Optional[UUID] = None
    paired_asset_type: Optional[ImgType] = None
    stack_primary_asset_id: Optional[UUID] = None
    rating: int = 0
    color_label: ColorLabel = ColorLabel.NONE
    picked: bool = False
    rejected: bool = False
    metadata_state_id: Optional[UUID] = None
    metadata_source_project_id: Optional[UUID] = None

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
    storage_uri: Optional[str]
    sha256: Optional[str]
    reference_count: int
    queued_at: Optional[datetime]
    processing_started_at: Optional[datetime]
    completed_at: Optional[datetime]
    last_error: Optional[str]
    metadata_warnings: List[str] = Field(default_factory=list)
    thumb_url: Optional[str]
    preview_url: Optional[str]
    derivatives: List[AssetDerivativeOut] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
    rating: int = 0
    color_label: ColorLabel = ColorLabel.NONE
    picked: bool = False
    rejected: bool = False
    metadata_state: Optional["MetadataStateOut"] = None
    format: Optional[str] = None
    pixel_format: Optional[str] = None
    pixel_hash: Optional[str] = None


class MetadataStateOut(BaseModel):
    id: UUID
    link_id: UUID
    project_id: UUID
    rating: int
    color_label: ColorLabel
    picked: bool
    rejected: bool
    edits: Optional[Dict[str, Any]] = None
    source_project_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

# Project-asset linking
class ProjectAssetsLinkIn(BaseModel):
    asset_ids: List[UUID]
    inheritance: Dict[UUID, Optional[UUID]] = Field(default_factory=dict)

class ProjectAssetsLinkOut(BaseModel):
    linked: int
    duplicates: int
    items: List[AssetListItem]

class ProjectAssetPreviewUpdate(BaseModel):
    is_preview: bool
    make_primary: bool = False


class AssetInteractionUpdate(BaseModel):
    asset_ids: List[UUID] = Field(default_factory=list, min_length=1)
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    color_label: Optional[ColorLabel] = None
    picked: Optional[bool] = None
    rejected: Optional[bool] = None


class AssetInteractionUpdateOut(BaseModel):
    items: List[AssetListItem]


AssetDetail.model_rebuild()


class ImageHubSettings(BaseModel):
    metadata_inheritance: MetadataInheritanceMode = MetadataInheritanceMode.ASK


class HubAssetProjectRef(BaseModel):
    project_id: UUID
    title: str
    linked_at: datetime
    metadata_state: Optional[MetadataStateOut] = None


class HubAsset(BaseModel):
    asset_id: UUID
    format: Optional[str]
    mime: str
    width: Optional[int]
    height: Optional[int]
    original_filename: Optional[str] = None
    taken_at: Optional[datetime]
    created_at: datetime
    thumb_url: Optional[str] = None
    preview_url: Optional[str] = None
    projects: List[HubAssetProjectRef] = Field(default_factory=list)
    pair_asset_id: Optional[UUID] = None


class HubProjectSummary(BaseModel):
    project_id: UUID
    title: str
    asset_count: int
    last_linked_at: Optional[datetime] = None


class HubDateSummary(BaseModel):
    date: str
    asset_count: int


class ImageHubAssetsResponse(BaseModel):
    assets: List[HubAsset]
    projects: List[HubProjectSummary]
    dates: List[HubDateSummary]
