from PIL import Image, ImageOps
from datetime import datetime, timezone
from typing import Tuple, Optional
import hashlib
from pathlib import Path

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb", buffering=1024*1024) as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def read_exif(path: Path) -> tuple[Optional[datetime], tuple[int,int]]:
    # Basic EXIF via Pillow; robust enough for JPEG/PNG. RAW requires extra tooling.
    with Image.open(path) as im:
        # orientation-aware size
        im = ImageOps.exif_transpose(im)
        w, h = im.size
        taken = None
        try:
            exif = im.getexif()
            dt = exif.get(36867) or exif.get(306)  # DateTimeOriginal or DateTime
            if dt:
                # many formats: "YYYY:MM:DD HH:MM:SS"
                dt = dt.replace(":", "-", 2)
                taken = datetime.fromisoformat(dt).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        return taken, (w, h)

def make_thumb(path: Path, size: int) -> tuple[bytes, tuple[int,int]]:
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")  # normalize orientation & color
        im.thumbnail((size, size))
        from io import BytesIO
        buf = BytesIO()
        im.save(buf, format="JPEG", quality=85, optimize=True)
        data = buf.getvalue()
        return data, im.size
