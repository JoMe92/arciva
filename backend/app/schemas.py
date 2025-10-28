from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID

class AssetStatus(str, Enum):
    UPLOADING = "UPLOADING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    ERROR = "ERROR"

# Projects
class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1)
    client: Optional[str] = None
    note: Optional[str] = None

class ProjectOut(BaseModel):
    id: UUID
    title: str
    client: Optional[str]
    note: Optional[str]
    created_at: datetime
    updated_at: datetime
    asset_count: int = 0

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
