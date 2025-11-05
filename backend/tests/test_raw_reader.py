from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pytest

from backend.app.adapters.raw_py import RawPyAdapterError, RawPyReadResult, RawPyThumbnail
from backend.app.services.raw_reader import RawReaderProcessingError, RawReaderService


@dataclass
class _StubAdapter:
    result: RawPyReadResult

    def read(self, path: Path) -> RawPyReadResult:
        return self.result


class _FailingAdapter:
    def read(self, path: Path) -> RawPyReadResult:
        raise RawPyAdapterError("boom")


def _bitmap_thumbnail() -> RawPyThumbnail:
    # Simple 2x2 RGB bitmap (red, green, blue, white)
    pixels = bytes(
        [
            255,
            0,
            0,
            0,
            255,
            0,
            0,
            0,
            255,
            255,
            255,
            255,
        ]
    )
    return RawPyThumbnail(format="bitmap", data=pixels, width=2, height=2)


def test_raw_reader_service_converts_bitmap_thumbnail(tmp_path: Path) -> None:
    preview = _bitmap_thumbnail()
    adapter = _StubAdapter(
        RawPyReadResult(
            width=4000,
            height=3000,
            raw_width=4100,
            raw_height=3070,
            flip=1,
            color_description="rgbg",
            raw_type=14,
            thumbnail=preview,
            preview_jpeg=None,
            preview_width=None,
            preview_height=None,
        )
    )
    service = RawReaderService(adapter=adapter)
    path = tmp_path / "sample.DNG"
    path.write_bytes(b"\x00")

    result = service.read(path)

    assert result.preview_bytes is not None
    assert result.preview_bytes.startswith(b"\xff\xd8")  # JPEG SOI marker
    assert result.preview_width == 2
    assert result.preview_height == 2
    assert result.metadata["rawpy"]["width"] == 4000
    assert result.metadata["rawpy"]["preview_source"] == "thumbnail"
    assert not result.warnings


def test_raw_reader_service_handles_adapter_error(tmp_path: Path) -> None:
    service = RawReaderService(adapter=_FailingAdapter())
    path = tmp_path / "error.cr2"
    path.write_bytes(b"\x00")

    result = service.read(path)

    assert result.preview_bytes is None
    assert "RAW_ADAPTER_ERROR" in result.warnings
    assert result.metadata["rawpy_error"] == "boom"


def test_raw_reader_uses_rendered_preview_when_thumbnail_missing(tmp_path: Path) -> None:
    adapter = _StubAdapter(
        RawPyReadResult(
            width=None,
            height=None,
            raw_width=6000,
            raw_height=4000,
            flip=None,
            color_description=None,
            raw_type=99,
            thumbnail=None,
            preview_jpeg=b"\xff\xd8\xff\xdb\x00C\x00",
            preview_width=2000,
            preview_height=1500,
        )
    )
    service = RawReaderService(adapter=adapter)
    path = tmp_path / "preview.arw"
    path.write_bytes(b"\x00")

    result = service.read(path)

    assert result.preview_bytes == b"\xff\xd8\xff\xdb\x00C\x00"
    assert result.preview_width == 2000
    assert result.preview_height == 1500
    assert result.metadata["rawpy"]["preview_source"] == "rendered"
    assert "RAW_NO_THUMBNAIL" not in result.warnings


class _FailingThumbnailService(RawReaderService):
    @staticmethod
    def _normalise_thumbnail(thumbnail: RawPyThumbnail) -> tuple[bytes, Optional[int], Optional[int]]:  # type: ignore[override]
        raise RawReaderProcessingError("fail")


def test_raw_reader_falls_back_to_rendered_preview_on_conversion_error(tmp_path: Path) -> None:
    preview = _bitmap_thumbnail()
    adapter = _StubAdapter(
        RawPyReadResult(
            width=None,
            height=None,
            raw_width=123,
            raw_height=456,
            flip=None,
            color_description=None,
            raw_type=1,
            thumbnail=preview,
            preview_jpeg=b"\xff\xd8\xff\xdb",
            preview_width=640,
            preview_height=480,
        )
    )
    service = _FailingThumbnailService(adapter=adapter)
    path = tmp_path / "fallback.nef"
    path.write_bytes(b"\x00")

    result = service.read(path)

    assert result.preview_bytes == b"\xff\xd8\xff\xdb"
    assert result.metadata["rawpy"]["preview_source"] == "rendered"
    assert "RAW_THUMBNAIL_CONVERSION_FAILED" in result.warnings


@pytest.mark.parametrize(
    "filename,expected",
    [
        ("photo.CR2", True),
        ("image.nef", True),
        ("clip.mov", False),
    ],
)
def test_raw_reader_supports_extensions(filename: str, expected: bool) -> None:
    service = RawReaderService()
    assert service.supports(Path(filename)) is expected
