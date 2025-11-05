from __future__ import annotations

import hashlib
import json
import os
import shlex
import shutil
import subprocess
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence, Tuple

from PIL import Image, ImageOps

from .deps import get_settings


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb", buffering=1024 * 1024) as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _parse_exif_datetime(value: Optional[Any]) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, list):
        if not value:
            return None
        value = value[0]
    value = str(value).strip()
    if not value or value in {"0000:00:00 00:00:00", "0000:00:00 00:00:00Z"}:
        return None
    # exiftool commonly returns YYYY:MM:DD HH:MM:SS[.fff][TZ]
    if len(value) >= 10 and value[4] == ":" and value[7] == ":":
        value = value.replace(":", "-", 2)
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _command_from_raw(raw: str) -> Optional[list[str]]:
    parts = shlex.split(raw)
    if not parts:
        return None
    exe = parts[0]
    exe_path = Path(exe)
    if exe_path.is_file():
        return parts
    resolved = shutil.which(exe)
    if resolved:
        parts[0] = resolved
        return parts
    if exe_path.is_absolute():
        return None
    candidate = Path.cwd() / exe
    if candidate.is_file():
        parts[0] = str(candidate)
        return parts
    return None


def _iter_exiftool_candidates() -> Iterable[str]:
    env_override = os.environ.get("EXIFTOOL_PATH")
    if env_override:
        yield env_override
    settings = get_settings()
    if settings.exiftool_path:
        yield settings.exiftool_path
    repo_root = Path(__file__).resolve().parents[2]
    pixi_envs = repo_root / ".pixi" / "envs"
    if pixi_envs.exists():
        for candidate in pixi_envs.glob("*/bin/exiftool"):
            yield str(candidate)
    yield "exiftool"


_EXIFTOOL_CMD: Optional[list[str]] = None


def _get_exiftool_cmd() -> list[str]:
    global _EXIFTOOL_CMD
    if _EXIFTOOL_CMD is not None:
        return list(_EXIFTOOL_CMD)

    for raw in _iter_exiftool_candidates():
        cmd = _command_from_raw(raw)
        if cmd:
            _EXIFTOOL_CMD = cmd
            break
    else:
        _EXIFTOOL_CMD = ["exiftool"]
    return list(_EXIFTOOL_CMD)


def read_exif(path: Path) -> tuple[Optional[datetime], Tuple[Optional[int], Optional[int]], Optional[dict[str, Any]], list[str]]:
    """Read EXIF metadata for the asset.

    Returns (taken_at, (width, height), metadata_json, warnings).
    Metadata is populated from exiftool when available. Width/height
    are orientation-aware courtesy of Pillow.
    """
    width: Optional[int] = None
    height: Optional[int] = None
    taken_at: Optional[datetime] = None
    metadata: Optional[dict[str, Any]] = None
    warnings: list[str] = []

    try:
        with Image.open(path) as im:
            # orientation-aware size
            im = ImageOps.exif_transpose(im)
            width, height = im.size
            if taken_at is None:
                try:
                    exif = im.getexif()
                    dt = exif.get(36867) or exif.get(306)  # DateTimeOriginal or DateTime
                    taken_at = _parse_exif_datetime(dt)
                except Exception:  # pragma: no cover - best effort
                    warnings.append("EXIF_PIL_PARSE_FAILED")
    except Exception:  # pragma: no cover - best effort
        warnings.append("EXIF_PIL_LOAD_FAILED")

    cmd: Sequence[str] = _get_exiftool_cmd() + ["-json", "-G", "-n", str(path)]
    try:
        proc = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        parsed = json.loads(proc.stdout or "[]")
        if isinstance(parsed, list) and parsed:
            entry = parsed[0]
            if isinstance(entry, dict):
                # Remove the absolute path to avoid leaking server filesystem details
                entry.pop("SourceFile", None)
                metadata = entry
                if taken_at is None:
                    taken_at = (
                        _parse_exif_datetime(entry.get("EXIF:DateTimeOriginal"))
                        or _parse_exif_datetime(entry.get("EXIF:CreateDate"))
                        or _parse_exif_datetime(entry.get("MakerNotes:DateTimeOriginal"))
                        or _parse_exif_datetime(entry.get("QuickTime:CreateDate"))
                        or _parse_exif_datetime(entry.get("XMP:CreateDate"))
                        or _parse_exif_datetime(entry.get("IPTC:DateCreated"))
                    )
        else:
            warnings.append("EXIF_NO_DATA")
    except FileNotFoundError:
        warnings.append("EXIFTOOL_NOT_INSTALLED")
    except subprocess.CalledProcessError:  # pragma: no cover - best effort
        warnings.append("EXIFTOOL_ERROR")
    except json.JSONDecodeError:  # pragma: no cover - best effort
        warnings.append("EXIFTOOL_JSON_ERROR")

    return taken_at, (width, height), metadata, warnings


def make_thumb(path: Optional[Path], size: int, *, image_bytes: Optional[bytes] = None) -> tuple[bytes, tuple[int, int]]:
    """
    Generate a JPEG thumbnail from a file path or in-memory image bytes.

    Parameters
    ----------
    path : Optional[Path]
        Path to the source image.  When ``image_bytes`` is provided this can be
        ``None``.
    size : int
        Maximum dimension (either width or height) for the thumbnail.
    image_bytes : Optional[bytes], optional
        Encoded image payload used when a path is unavailable.

    Returns
    -------
    tuple[bytes, tuple[int, int]]
        JPEG bytes and the resulting image size after resizing.

    Raises
    ------
    ValueError
        Raised when neither ``path`` nor ``image_bytes`` is provided.
    """

    if image_bytes is None and path is None:
        raise ValueError("Either 'path' or 'image_bytes' must be provided")

    buffer: Optional[BytesIO] = BytesIO(image_bytes) if image_bytes is not None else None
    source = buffer if buffer is not None else path

    try:
        with Image.open(source) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")  # normalize orientation & color
            im.thumbnail((size, size))

            with BytesIO() as buf:
                im.save(buf, format="JPEG", quality=85, optimize=True)
                data = buf.getvalue()
            return data, im.size
    finally:
        if buffer is not None:
            buffer.close()
