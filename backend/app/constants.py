from __future__ import annotations

# Normalized extension sets used for JPEG/RAW detection and metadata writes.
# All entries should be lowercase and include the leading dot.
JPEG_EXTENSIONS: set[str] = {'.jpg', '.jpeg'}
RAW_EXTENSIONS: set[str] = {
    '.raf',
    '.cr2',
    '.cr3',
    '.nef',
    '.arw',
    '.rw2',
    '.orf',
    '.dng',
    '.raw',
}

# DNG files support embedded XMP writes, so we treat them as RAW files that do
# not require sidecar generation.
EMBEDDED_RAW_EXTENSIONS: set[str] = {'.dng'}
