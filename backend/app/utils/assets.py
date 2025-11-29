from __future__ import annotations

from pathlib import Path
from typing import Optional

from ..constants import JPEG_EXTENSIONS, RAW_EXTENSIONS

_EXTENSION_OVERRIDES = {
    ".png": "PNG",
    ".tif": "TIFF",
    ".tiff": "TIFF",
    ".heic": "HEIC",
    ".heif": "HEIC",
    ".gif": "GIF",
}

_MIME_OVERRIDES = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/tiff": "TIFF",
    "image/heic": "HEIC",
    "image/heif": "HEIC",
}


def detect_asset_format(filename: Optional[str], mime: Optional[str] = None) -> str:
    """
    Derive a normalized display/processing format for an asset using filename
    + MIME hints.
    """

    ext = Path(filename or "").suffix.lower()
    if ext in RAW_EXTENSIONS:
        return "RAW"
    if ext in JPEG_EXTENSIONS:
        return "JPEG"
    if ext in _EXTENSION_OVERRIDES:
        return _EXTENSION_OVERRIDES[ext]
    if mime:
        mime_key = mime.lower()
        if mime_key in _MIME_OVERRIDES:
            return _MIME_OVERRIDES[mime_key]
    if ext:
        return ext.lstrip(".").upper()
    return "UNKNOWN"
