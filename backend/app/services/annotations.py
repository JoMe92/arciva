from __future__ import annotations

import asyncio
import logging
import textwrap
from pathlib import Path
from typing import Sequence
from uuid import UUID

from .. import models
from ..constants import EMBEDDED_RAW_EXTENSIONS, RAW_EXTENSIONS
from ..imaging import _get_exiftool_cmd
from ..storage import PosixStorage

logger = logging.getLogger("arciva.annotations")


def _resolve_asset_path(asset: models.Asset, storage: PosixStorage) -> Path | None:
    if asset.storage_key:
        path = Path(asset.storage_key)
        if path.exists():
            return path
    if asset.sha256:
        ext = Path(asset.original_filename or "").suffix or ".bin"
        candidate = storage.originals / f"{asset.sha256}{ext.lower()}"
        if candidate.exists():
            return candidate
    return None


def _pick_label_value(asset: models.Asset) -> str | None:
    if asset.rejected:
        return "-1"
    if asset.picked:
        return "1"
    return None


def _color_value(asset: models.Asset) -> str | None:
    label = asset.color_label.value if isinstance(asset.color_label, models.ColorLabel) else str(asset.color_label)
    return None if not label or label == "None" else label


def _should_use_sidecar(path: Path) -> bool:
    ext = path.suffix.lower()
    if ext in EMBEDDED_RAW_EXTENSIONS:
        return False
    return ext in RAW_EXTENSIONS


def _sidecar_path(path: Path) -> Path:
    return path.with_suffix(f"{path.suffix}.xmp")


def _render_sidecar_xml(asset: models.Asset) -> str:
    rating_value = max(0, min(int(asset.rating or 0), 5))
    pick_value = _pick_label_value(asset)
    color_value = _color_value(asset)

    entries: list[str] = []
    if rating_value:
        entries.append(f"<xmp:Rating>{rating_value}</xmp:Rating>")
    elif rating_value == 0:
        entries.append("<xmp:Rating>0</xmp:Rating>")
    if color_value:
        entries.append(f"<xmp:Label>{color_value}</xmp:Label>")
    if pick_value is not None:
        entries.append(f"<lr:Pick>{pick_value}</lr:Pick>")

    payload = "\n    ".join(entries)
    if not payload:
        payload = "<lr:Pick>0</lr:Pick>"

    return textwrap.dedent(
        f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <x:xmpmeta xmlns:x="adobe:ns:meta/">
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
            <rdf:Description rdf:about=""
                xmlns:xmp="http://ns.adobe.com/xap/1.0/"
                xmlns:lr="http://ns.adobe.com/lightroom/1.0/">
                {payload}
            </rdf:Description>
          </rdf:RDF>
        </x:xmpmeta>
        """
    ).strip()


def _write_with_exiftool(path: Path, asset: models.Asset, *, sidecar: Path | None) -> bool:
    cmd = _get_exiftool_cmd() + ["-overwrite_original"]
    if sidecar is not None:
        cmd += ["-o", str(sidecar)]

    rating_value = max(0, min(int(asset.rating or 0), 5))
    cmd.append(f"-XMP:Rating={rating_value}")

    color_value = _color_value(asset)
    if color_value:
        cmd.append(f"-XMP:Label={color_value}")
    else:
        cmd.append("-XMP:Label=")

    pick_value = _pick_label_value(asset)
    if pick_value is not None:
        cmd.append(f"-XMP:PickLabel={pick_value}")
    else:
        cmd.append("-XMP:PickLabel=")

    cmd.append(str(path))
    try:
        from subprocess import run, CalledProcessError

        run(cmd, check=True, capture_output=True)
        return True
    except FileNotFoundError:
        logger.warning("annotations: exiftool missing for asset=%s path=%s", asset.id, path)
        return False
    except CalledProcessError as exc:  # pragma: no cover - best effort logging
        logger.warning("annotations: exiftool failed asset=%s path=%s error=%s", asset.id, path, exc)
        return False


def _write_sidecar(path: Path, asset: models.Asset, *, explicit_path: Path | None = None) -> None:
    target = explicit_path or _sidecar_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    xml = _render_sidecar_xml(asset)
    target.write_text(xml, encoding="utf-8")


def _write_annotations_sync(path: Path, asset: models.Asset) -> None:
    prefer_sidecar = _should_use_sidecar(path)
    sidecar_target = _sidecar_path(path) if prefer_sidecar else None

    if not prefer_sidecar:
        wrote = _write_with_exiftool(path, asset, sidecar=None)
        if wrote:
            return
        logger.info("annotations: falling back to sidecar for asset=%s", asset.id)
        _write_sidecar(path, asset, explicit_path=sidecar_target)
        return

    # sidecar preferred
    if _write_with_exiftool(path, asset, sidecar=sidecar_target):
        return
    _write_sidecar(path, asset, explicit_path=sidecar_target)


async def write_annotations_for_assets(assets: Sequence[models.Asset]) -> None:
    if not assets:
        return
    storage = PosixStorage.from_env()
    processed: set[UUID] = set()
    tasks: list[asyncio.Task[None]] = []
    for asset in assets:
        if asset.id in processed:
            continue
        processed.add(asset.id)
        path = _resolve_asset_path(asset, storage)
        if not path:
            logger.warning("annotations: missing source path for asset=%s", asset.id)
            continue
        tasks.append(asyncio.to_thread(_write_annotations_sync, path, asset))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
