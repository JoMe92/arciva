from __future__ import annotations

from pathlib import Path
import os
import shutil
import tempfile
from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from ..schemas import DatabasePathSettings, DatabasePathStatus
from ..deps import get_settings

_DEFAULT_FILENAME = "arciva.db"
_MIN_FREE_BYTES = 512 * 1024 * 1024  # 512 MB safety buffer
_PROTECTED_UNIX_PREFIXES = [
    Path("/bin"),
    Path("/etc"),
    Path("/usr"),
    Path("/System"),
    Path("/dev"),
]
_PROTECTED_WINDOWS_PREFIXES = [
    Path("C:/Windows"),
    Path("C:/Program Files"),
    Path("C:/Program Files (x86)"),
]


def _default_database_path() -> Path:
    home = Path.home() / "Arciva"
    home.mkdir(parents=True, exist_ok=True)
    return (home / _DEFAULT_FILENAME).resolve()


def _normalize_path(path_value: str | None) -> Path | None:
    if not path_value:
        return None
    candidate = Path(path_value).expanduser()
    try:
        return candidate.resolve(strict=False)
    except FileNotFoundError:
        # When the path (or parent) does not exist yet we still want an
        # absolute Path
        if candidate.is_absolute():
            return candidate
        return None


def _is_protected(path: Path) -> bool:
    prefixes = list(_PROTECTED_UNIX_PREFIXES)
    prefixes.extend(_PROTECTED_WINDOWS_PREFIXES)
    try:
        system_root = Path(os.environ.get("SystemRoot", "C:/Windows"))
        prefixes.append(system_root)
    except Exception:
        pass
    for prefix in prefixes:
        try:
            if path == prefix:
                return True
            path.relative_to(prefix)
            return True
        except ValueError:
            continue
    return False


def _target_directory(target: Path) -> Path:
    # Accept either a file path or directory path; when a directory is
    # provided, we treat it as the container for the database file.
    if target.suffix:
        return target.parent
    return target


def _check_disk_space(directory: Path) -> Tuple[bool, str | None]:
    try:
        stats = shutil.disk_usage(directory)
    except FileNotFoundError:
        return False, "Path not accessible."
    if stats.free < _MIN_FREE_BYTES:
        return (
            False,
            "Not enough free space on the selected volume " "(need at least 512 MB).",
        )
    return True, None


def validate_database_path(
    path_value: str | Path, *, ensure_writable: bool = False
) -> Tuple[DatabasePathStatus, str | None]:
    if isinstance(path_value, Path):
        path = path_value.expanduser().resolve(strict=False)
    else:
        candidate = Path(path_value).expanduser()
        if not candidate.is_absolute():
            return DatabasePathStatus.INVALID, "Provide an absolute path."
        path = candidate.resolve(strict=False)
    if not path.is_absolute():
        return DatabasePathStatus.INVALID, "Provide an absolute path."
    directory = _target_directory(path)
    if directory == Path("/"):
        return (
            DatabasePathStatus.INVALID,
            "System folders cannot host the database. " "Choose a custom directory.",
        )
    if _is_protected(directory):
        return (
            DatabasePathStatus.INVALID,
            "System folders cannot host the database. " "Choose a custom directory.",
        )
    if ensure_writable:
        try:
            directory.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            return (
                DatabasePathStatus.NOT_ACCESSIBLE,
                f"Cannot create directory: {exc}",
            )
    if not directory.exists():
        return DatabasePathStatus.NOT_ACCESSIBLE, "Directory does not exist."
    if not os.access(directory, os.R_OK | os.W_OK):
        return DatabasePathStatus.NOT_WRITABLE, "Directory is not writable."
    ok, message = _check_disk_space(directory)
    if not ok:
        return DatabasePathStatus.NOT_WRITABLE, message
    try:
        test_fd, test_path = tempfile.mkstemp(prefix="arciva-db-check", dir=directory)
        os.close(test_fd)
        os.unlink(test_path)
    except OSError as exc:
        return (
            DatabasePathStatus.NOT_WRITABLE,
            f"Unable to write to directory: {exc}",
        )
    return DatabasePathStatus.READY, None


async def load_database_settings(db: AsyncSession) -> DatabasePathSettings:
    settings = get_settings()
    current = _normalize_path(settings.app_db_path) or _default_database_path()
    status, message = validate_database_path(current, ensure_writable=False)
    return DatabasePathSettings(
        path=str(current),
        status=status,
        message=message,
        requires_restart=False,
    )


async def update_database_path(
    db: AsyncSession,
    candidate: str,
    *,
    copy_existing: bool = True,
    allow_create: bool = True,
) -> DatabasePathSettings:
    message = (
        "APP_DB_PATH is managed via environment variables. "
        "Update APP_DB_PATH and restart the service to change the database "
        "location."
    )
    return DatabasePathSettings(
        path=candidate,
        status=DatabasePathStatus.INVALID,
        message=message,
        requires_restart=False,
    )
