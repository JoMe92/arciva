# backend/app/models.py
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    String, Text, Enum as SAEnum, ForeignKey, BigInteger, Integer,
    DateTime, PrimaryKeyConstraint, Boolean, text, JSON, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .db import Base


class AssetStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    DUPLICATE = "DUPLICATE"
    MISSING_SOURCE = "MISSING_SOURCE"
    ERROR = "ERROR"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    client: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stack_pairs_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ColorLabel(str, enum.Enum):
    NONE = "None"
    RED = "Red"
    GREEN = "Green"
    BLUE = "Blue"
    YELLOW = "Yellow"
    PURPLE = "Purple"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    format: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="UNKNOWN",
        server_default=text("'UNKNOWN'"),
    )
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    mime: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    taken_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    storage_uri: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # POSIX path or URI
    status: Mapped[AssetStatus] = mapped_column(SAEnum(AssetStatus), nullable=False, default=AssetStatus.UPLOADING)
    queued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_warnings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    pixel_format: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    pixel_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=False)
    reference_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectAssetPair(Base):
    __tablename__ = "project_asset_pairs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    basename: Mapped[str] = mapped_column(Text, nullable=False)
    jpeg_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    raw_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("project_id", "basename", name="uq_project_asset_pairs_project_basename"),
        UniqueConstraint("project_id", "jpeg_asset_id", name="uq_project_asset_pairs_project_jpeg"),
        UniqueConstraint("project_id", "raw_asset_id", name="uq_project_asset_pairs_project_raw"),
    )


class ProjectAsset(Base):
    __tablename__ = "project_assets"

    id: Mapped[uuid.UUID] = mapped_column("link_id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_preview: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    preview_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    pair_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("project_asset_pairs.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("project_id", "asset_id", name="uq_project_assets_project_asset"),
    )


class Derivative(Base):
    __tablename__ = "derivatives"

    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    variant: Mapped[str] = mapped_column(String(64))    # e.g., "thumb_256"
    format: Mapped[str] = mapped_column(String(16))     # e.g., "jpg"
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("asset_id", "variant"),
    )


class MetadataState(Base):
    __tablename__ = "asset_metadata_states"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    link_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("project_assets.link_id", ondelete="CASCADE"), unique=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    color_label: Mapped[ColorLabel] = mapped_column(SAEnum(ColorLabel), nullable=False, default=ColorLabel.NONE)
    picked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    rejected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    edits: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    source_project_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
