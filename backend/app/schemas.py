from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
from typing import Optional, List, Dict, Any, Literal, Union
from datetime import datetime
from enum import Enum
from uuid import UUID


class UserOut(BaseModel):
    id: UUID
    email: EmailStr


class AuthSignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


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


class DatabasePathStatus(str, Enum):
    READY = "ready"
    INVALID = "invalid"
    NOT_ACCESSIBLE = "not_accessible"
    NOT_WRITABLE = "not_writable"


class DatabasePathUpdate(BaseModel):
    path: str = Field(..., min_length=1)


class DatabasePathSettings(BaseModel):
    path: str
    status: DatabasePathStatus
    message: Optional[str] = None
    requires_restart: bool = False


class PhotoStorePathStatus(str, Enum):
    AVAILABLE = "available"
    MISSING = "missing"
    NOT_WRITABLE = "not_writable"


class PhotoStoreLocation(BaseModel):
    id: str
    path: str
    role: Literal["primary", "secondary"]
    status: PhotoStorePathStatus
    message: Optional[str] = None


class PhotoStoreSettings(BaseModel):
    enabled: bool
    developer_only: bool
    warning_active: bool
    last_option: Optional[str] = None
    locations: List[PhotoStoreLocation] = Field(default_factory=list)


class PhotoStoreValidationRequest(BaseModel):
    path: str = Field(..., min_length=1)
    mode: Literal["fresh", "load", "move", "add"] | None = "fresh"


class PhotoStoreValidationResult(BaseModel):
    path: str
    valid: bool
    message: Optional[str] = None


class PhotoStoreApplyRequest(BaseModel):
    path: str = Field(..., min_length=1)
    mode: Literal["fresh", "load"]
    acknowledge: bool = False


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
    metadata_state: Optional[MetadataStateOut] = None


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


class AssetProjectUsage(BaseModel):
    project_id: UUID
    name: str
    cover_thumb: Optional[str] = None
    last_modified: Optional[datetime] = None





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


class ExportOutputFormat(str, Enum):
    JPEG = "JPEG"
    TIFF = "TIFF"
    PNG = "PNG"


class ExportRawStrategy(str, Enum):
    RAW = "raw"
    DEVELOPED = "developed"


class ExportSizeMode(str, Enum):
    ORIGINAL = "original"
    RESIZE = "resize"


class ExportContactSheetFormat(str, Enum):
    JPEG = "JPEG"
    TIFF = "TIFF"
    PDF = "PDF"


class ExportJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ExportJobSettings(BaseModel):
    output_format: ExportOutputFormat = ExportOutputFormat.JPEG
    raw_handling: ExportRawStrategy = ExportRawStrategy.DEVELOPED
    size_mode: ExportSizeMode = ExportSizeMode.ORIGINAL
    long_edge: Optional[int] = Field(default=None, ge=32, le=50_000)
    jpeg_quality: Optional[int] = Field(default=90, ge=10, le=100)
    contact_sheet_enabled: bool = False
    contact_sheet_format: ExportContactSheetFormat = ExportContactSheetFormat.PDF

    @model_validator(mode="after")
    def validate_resize(self):
        if self.size_mode == ExportSizeMode.RESIZE and not self.long_edge:
            raise ValueError("long_edge required when size_mode=resize")
        return self

    @field_validator("jpeg_quality")
    @classmethod
    def clamp_jpeg_quality(cls, value, info):
        if value is None:
            return 90
        return value


class ExportJobCreate(BaseModel):
    project_id: UUID
    photo_ids: List[UUID] = Field(default_factory=list, min_length=1)
    settings: ExportJobSettings


class ExportJobOut(BaseModel):
    id: UUID
    project_id: UUID
    status: ExportJobStatus
    progress: int
    total_photos: int
    exported_files: int
    download_url: Optional[str] = None
    artifact_filename: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    settings: ExportJobSettings


class BulkImageExportOut(BaseModel):
    id: UUID
    status: ExportJobStatus
    progress: int
    processed_files: int
    total_files: int
    download_url: Optional[str] = None
    artifact_filename: Optional[str] = None
    artifact_size: Optional[int] = None
    date_basis: str
    folder_template: str
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]


class BulkImageExportEstimate(BaseModel):
    total_files: int
    total_bytes: int
    date_basis: str
    folder_template: str


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


# Quick-Fix Adjustments
class CropSettings(BaseModel):
    aspect_ratio: Optional[Union[float, str]] = 0.0  # 0.0 = Original/Free? Or use specific values like "1:1".
    rotation: float = 0.0


class ExposureSettings(BaseModel):
    exposure: float = 0.0
    contrast: float = 1.0
    highlights: float = 0.0
    shadows: float = 0.0


class ColorSettings(BaseModel):
    temperature: float = 0.0
    tint: float = 0.0


class GrainSettings(BaseModel):
    amount: float = 0.0
    size: Literal["fine", "medium", "coarse"] = "medium"


class GeometrySettings(BaseModel):
    vertical: float = 0.0
    horizontal: float = 0.0


class QuickFixAdjustments(BaseModel):
    crop: Optional[CropSettings] = None
    exposure: Optional[ExposureSettings] = None
    color: Optional[ColorSettings] = None
    grain: Optional[GrainSettings] = None
    geometry: Optional[GeometrySettings] = None


class QuickFixBatchApply(BaseModel):
    asset_ids: List[UUID] = Field(..., min_length=1)
    auto_exposure: bool = False
    auto_white_balance: bool = False
    auto_crop: bool = False
