from __future__ import annotations

from io import BytesIO

from PIL import Image

from backend.app.imaging import make_thumb


def _sample_image_bytes(width: int = 200, height: int = 100) -> bytes:
    image = Image.new("RGB", (width, height), color="orange")
    with BytesIO() as buffer:
        image.save(buffer, format="JPEG")
        return buffer.getvalue()


def test_make_thumb_from_bytes_returns_jpeg() -> None:
    payload = _sample_image_bytes()
    thumb_bytes, dims = make_thumb(None, 64, image_bytes=payload)

    assert thumb_bytes.startswith(b"\xff\xd8")
    assert max(dims) <= 64


def test_make_thumb_requires_source() -> None:
    try:
        make_thumb(None, 64)
    except ValueError as exc:
        assert "Either 'path' or 'image_bytes' must be provided" in str(exc)
    else:  # pragma: no cover - defensive
        raise AssertionError("Expected ValueError when no source provided")
