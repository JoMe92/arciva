#!/usr/bin/env python3
"""
Standalone rawpy probe script.

Usage
-----
Run with the path to a RAW image:

    python tools/raw_tests/rawpy_probe.py /path/to/photo.CR2

It prints basic LibRaw metadata and stores a rendered JPEG preview next to the
original file (``<name>.preview.jpg``). Useful for validating that ``rawpy`` can
decode a file before running it through the ingest worker.
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path
from typing import Optional

import rawpy
from PIL import Image


def _render_preview(raw: rawpy.RawPy) -> tuple[Optional[bytes], Optional[int], Optional[int]]:
    """Render a JPEG preview from rawpy, returning the encoded bytes and dimensions."""
    try:
        rgb = raw.postprocess(
            output_bps=8,
            use_camera_wb=True,
            no_auto_bright=True,
        )
    except Exception as exc:  # pragma: no cover - rawpy specific failure
        print(f"[probe] failed to postprocess RAW: {exc!r}")
        return None, None, None

    height = rgb.shape[0] if getattr(rgb, "shape", None) else None
    width = rgb.shape[1] if getattr(rgb, "shape", None) else None

    try:
        image = Image.fromarray(rgb)
    except Exception as exc:  # pragma: no cover - pillow failure
        print(f"[probe] Pillow failed to convert array: {exc!r}")
        return None, width, height

    try:
        with BytesIO() as buf:
            image.save(buf, format="JPEG", quality=90)
            return buf.getvalue(), width, height
    except Exception as exc:  # pragma: no cover
        print(f"[probe] Pillow failed to encode JPEG: {exc!r}")
        return None, width, height
    finally:
        image.close()


def probe(raw_path: Path) -> None:
    """Open ``raw_path`` and display metadata plus write a preview image if possible."""
    if not raw_path.is_file():
        raise FileNotFoundError(f"RAW not found: {raw_path}")

    print(f"[probe] opening {raw_path}")

    with rawpy.imread(str(raw_path)) as raw:
        sizes = raw.sizes
        print("--- sizes -----------------------------------------------------")
        print(f"  oriented:     {sizes.width} x {sizes.height} (flip={sizes.flip})")
        print(f"  raw mosaic:   {sizes.raw_width} x {sizes.raw_height}")
        print(f"  iwidth/iheight: {sizes.iwidth} x {sizes.iheight}")
        print("---------------------------------------------------------------")
        print(f"  color desc:   {raw.color_desc}")
        pattern = getattr(raw, "raw_pattern", None)
        if pattern is not None:
            print(f"  raw pattern:  {pattern.tolist()}")
        print("---------------------------------------------------------------")

        try:
            thumb = raw.extract_thumb()
            width = getattr(thumb, "width", None)
            height = getattr(thumb, "height", None)
            if width and height:
                print(f"[probe] embedded thumbnail: {thumb.format.name} {width}x{height}")
            else:
                print(f"[probe] embedded thumbnail: {thumb.format.name} (dimensions unavailable)")
        except rawpy.LibRawNoThumbnailError:
            print("[probe] embedded thumbnail: none")
        except rawpy.LibRawUnsupportedThumbnailError:
            print("[probe] embedded thumbnail: unsupported format")

        preview_bytes, width, height = _render_preview(raw)

    if preview_bytes:
        preview_path = raw_path.with_suffix(raw_path.suffix + ".preview.jpg")
        preview_path.write_bytes(preview_bytes)
        print(f"[probe] wrote preview JPEG ({width}x{height}) -> {preview_path}")
    else:
        print("[probe] skipping preview write (no data)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect RAW files with rawpy.")
    parser.add_argument(
        "raw_path",
        type=Path,
        help="Path to the RAW image (e.g. .CR2, .NEF, .ARW).",
    )
    args = parser.parse_args()
    probe(args.raw_path.resolve())


if __name__ == "__main__":
    main()
