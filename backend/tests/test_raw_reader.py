from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from backend.app.adapters.raw_py import RawPyAdapterError, RawPyReadResult, RawPyThumbnail
from backend.app.services.raw_reader import RawReaderService


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
    assert not result.warnings


def test_raw_reader_service_handles_adapter_error(tmp_path: Path) -> None:
    service = RawReaderService(adapter=_FailingAdapter())
    path = tmp_path / "error.cr2"
    path.write_bytes(b"\x00")

    result = service.read(path)

    assert result.preview_bytes is None
    assert "RAW_ADAPTER_ERROR" in result.warnings
    assert result.metadata["rawpy_error"] == "boom"


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
