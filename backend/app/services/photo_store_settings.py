from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Sequence
import json
import logging
import os
import shutil
import uuid
import copy

logger = logging.getLogger("arciva.photo_store")

PHOTO_SUBDIRS: tuple[str, ...] = ("uploads", "originals", "derivatives", "exports")
CONFIG_DIR = Path.home() / "Arciva"
CONFIG_FILE = CONFIG_DIR / "photo_store_state.json"

PhotoStoreMode = Literal["move", "fresh", "add", "load"]
PhotoStoreLocationRole = Literal["primary", "secondary"]
PhotoStoreStatus = Literal["available", "missing", "not_writable"]


@dataclass
class StoredLocation:
    id: str
    path: str
    role: PhotoStoreLocationRole
    created_at: str


@dataclass
class PhotoStoreState:
    locations: list[StoredLocation]
    last_option: PhotoStoreMode | None = None
    updated_at: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_config_dir() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def _normalize_path(candidate: str) -> Path | None:
    if not candidate:
        return None
    path = Path(candidate).expanduser()
    try:
        path = path.resolve(strict=False)
    except FileNotFoundError:
        if not path.is_absolute():
            return None
    if not path.is_absolute():
        return None
    return path


def normalize_photo_store_path(candidate: str) -> Path | None:
    return _normalize_path(candidate)


def _read_state_file(default_root: Path) -> PhotoStoreState:
    _ensure_config_dir()
    if CONFIG_FILE.exists():
        try:
            data = json.loads(CONFIG_FILE.read_text())
            raw_locations = data.get("locations")
            if isinstance(raw_locations, list) and raw_locations:
                locations: list[StoredLocation] = []
                for entry in raw_locations:
                    path_value = entry.get("path") if isinstance(entry, dict) else None
                    normalized = _normalize_path(path_value) if isinstance(path_value, str) else None
                    if not normalized:
                        continue
                    role = entry.get("role")
                    if role not in ("primary", "secondary"):
                        role = "secondary"
                    loc_id = entry.get("id") if isinstance(entry.get("id"), str) else str(uuid.uuid4())
                    created_at = entry.get("created_at") if isinstance(entry.get("created_at"), str) else _now_iso()
                    locations.append(StoredLocation(id=loc_id, path=str(normalized), role=role, created_at=created_at))
                last_option = data.get("last_option") if data.get("last_option") in {"move", "fresh", "add", "load"} else None
                updated_at = data.get("updated_at") if isinstance(data.get("updated_at"), str) else None
                if locations:
                    return PhotoStoreState(locations=locations, last_option=last_option, updated_at=updated_at)
        except json.JSONDecodeError:
            logger.warning("photo_store_settings: invalid JSON in %s", CONFIG_FILE)
    created_at = _now_iso()
    default_location = StoredLocation(id=str(uuid.uuid4()), path=str(default_root), role="primary", created_at=created_at)
    state = PhotoStoreState(locations=[default_location], last_option=None, updated_at=created_at)
    _write_state_file(state)
    return state


def _write_state_file(state: PhotoStoreState) -> None:
    _ensure_config_dir()
    payload = {
        "locations": [asdict(loc) for loc in state.locations],
        "last_option": state.last_option,
        "updated_at": state.updated_at or _now_iso(),
    }
    CONFIG_FILE.write_text(json.dumps(payload, indent=2))


def load_photo_store_state(default_root: Path) -> PhotoStoreState:
    return _read_state_file(default_root)


def persist_photo_store_state(state: PhotoStoreState) -> None:
    _write_state_file(state)


def describe_location(path: Path) -> tuple[PhotoStoreStatus, str | None]:
    if not path.exists():
        return "missing", "Path not available (drive disconnected?)"
    if not path.is_dir():
        return "not_writable", "Configured path is not a directory."
    if not os.access(path, os.R_OK | os.W_OK):
        return "not_writable", "Missing read/write permissions."
    temp_file = path / ".arciva-storage-check"
    try:
        temp_file.write_text("ok", encoding="utf-8")
        temp_file.unlink(missing_ok=True)
    except OSError as exc:
        return "not_writable", f"Unable to write to directory: {exc}"
    return "available", None


def ensure_photo_store_dirs(base: Path) -> None:
    base.mkdir(parents=True, exist_ok=True)
    for name in PHOTO_SUBDIRS:
        (base / name).mkdir(parents=True, exist_ok=True)


def _copy_directory(source: Path, destination: Path) -> None:
    if not source.exists():
        ensure_photo_store_dirs(destination)
        return
    for name in PHOTO_SUBDIRS:
        src_dir = source / name
        dest_dir = destination / name
        if src_dir.exists():
            shutil.copytree(src_dir, dest_dir, dirs_exist_ok=True)
        else:
            dest_dir.mkdir(parents=True, exist_ok=True)


def _protected_prefixes() -> Sequence[Path]:
    prefixes = [
        Path("/bin"),
        Path("/etc"),
        Path("/usr"),
        Path("/System"),
        Path("/dev"),
    ]
    system_root = os.environ.get("SystemRoot")
    if system_root:
        prefixes.append(Path(system_root))
    return prefixes


def _is_protected(path: Path) -> bool:
    if path == Path("/"):
        return True
    for prefix in _protected_prefixes():
        try:
            if path == prefix:
                return True
            path.relative_to(prefix)
            return True
        except ValueError:
            continue
    return False


def validate_candidate_path(candidate: str) -> tuple[bool, str | None]:
    normalized = _normalize_path(candidate)
    if not normalized:
        return False, "Provide an absolute path."
    if _is_protected(normalized):
        return False, "System directories cannot be used for the PhotoStore."
    try:
        normalized.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        return False, f"Unable to create directory: {exc}"
    status, message = describe_location(normalized)
    if status != "available":
        return False, message or "Directory is not writable."
    return True, None


def update_state(state: PhotoStoreState, new_path: Path, mode: PhotoStoreMode) -> PhotoStoreState:
    normalized = new_path
    next_state = copy.deepcopy(state)
    if mode == "move":
        logger.info("photo_store_settings: copying data to %s", normalized)
        current_primary = Path(state.locations[0].path)
        _copy_directory(current_primary, normalized)
        new_location = StoredLocation(id=str(uuid.uuid4()), path=str(normalized), role="primary", created_at=_now_iso())
        next_state.locations = [new_location]
    elif mode in ("fresh", "load"):
        logger.info("photo_store_settings: preparing %s path at %s", mode, normalized)
        ensure_photo_store_dirs(normalized)
        new_location = StoredLocation(id=str(uuid.uuid4()), path=str(normalized), role="primary", created_at=_now_iso())
        next_state.locations = [new_location]
    else:
        logger.info("photo_store_settings: adding secondary path %s", normalized)
        ensure_photo_store_dirs(normalized)
        new_location = StoredLocation(id=str(uuid.uuid4()), path=str(normalized), role="primary", created_at=_now_iso())
        updated = [new_location]
        for existing in state.locations:
            updated.append(StoredLocation(id=existing.id, path=existing.path, role="secondary", created_at=existing.created_at))
        next_state.locations = updated
    next_state.last_option = mode
    next_state.updated_at = _now_iso()
    return next_state


def prepare_state(default_root: Path) -> PhotoStoreState:
    state = load_photo_store_state(default_root)
    if not state.locations:
        ensure_photo_store_dirs(default_root)
        default_location = StoredLocation(id=str(uuid.uuid4()), path=str(default_root), role="primary", created_at=_now_iso())
        state.locations = [default_location]
        _write_state_file(state)
    return state


def apply_state_to_settings(settings, state: PhotoStoreState) -> None:
    if not state.locations:
        return
    primary_path = Path(state.locations[0].path)
    ensure_photo_store_dirs(primary_path)
    settings.fs_root = str(primary_path)
    settings.fs_uploads_dir = str(primary_path / "uploads")
    settings.fs_originals_dir = str(primary_path / "originals")
    settings.fs_derivatives_dir = str(primary_path / "derivatives")
    settings.fs_exports_dir = str(primary_path / "exports")
    setattr(settings, "photo_store_locations", [asdict(loc) for loc in state.locations])
    setattr(settings, "photo_store_state", asdict(state))


def make_location_payload(state: PhotoStoreState) -> list[dict[str, str | None]]:
    entries: list[dict[str, str | None]] = []
    for loc in state.locations:
        path = Path(loc.path)
        status, message = describe_location(path)
        entries.append({
            "id": loc.id,
            "path": loc.path,
            "role": loc.role,
            "status": status,
            "message": message,
        })
    return entries
