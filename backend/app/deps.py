# backend/app/deps.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Any, List, Optional
from pathlib import Path
import logging
import os
import json
import socket

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_env: str = "dev"
    secret_key: str = "changeme"

    # Default to both localhost and loopback since browsers treat them as different origins.
    allowed_origins: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    app_db_path: str
    app_media_root: str
    database_url: str = ""
    redis_url: str = "redis://127.0.0.1:6379/0"

    fs_root: str = ""
    fs_uploads_dir: str = ""
    fs_originals_dir: str = ""
    fs_derivatives_dir: str = ""
    fs_exports_dir: str = ""
    photo_store_locations: List[dict[str, Any]] = Field(default_factory=list)
    photo_store_state: dict[str, Any] | None = None
    experimental_photo_store_enabled: bool = False

    thumb_sizes: List[int] = [256]
    max_upload_mb: int = 200
    worker_concurrency: int = 2
    logs_dir: str = "logs"
    exiftool_path: str = "exiftool"
    export_retention_hours: int = 24
    allow_lan_frontend_origins: bool = True
    dev_frontend_port: int = 5173

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("[") and s.endswith("]"):
                return json.loads(s)
            return [p.strip() for p in s.split(",") if p.strip()]
        return v

    @field_validator("thumb_sizes", mode="before")
    @classmethod
    def parse_thumb_sizes(cls, v):
        # Accept [256], "256", "128,256"
        if isinstance(v, list):
            return [int(x) for x in v]
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("[") and s.endswith("]"):
                return [int(x) for x in json.loads(s)]
            return [int(x.strip()) for x in s.split(",") if x.strip()]
        if isinstance(v, int):
            return [v]
        return v

_config_logger = logging.getLogger("arciva.config")

def _fail_config(message: str) -> None:
    _config_logger.error(message)
    raise RuntimeError(message)

def _normalize_path(raw: str, *, name: str) -> Path:
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        _fail_config(f"{name} must be an absolute path (got {raw!r}).")
    try:
        return candidate.resolve(strict=False)
    except FileNotFoundError:
        return candidate

def _check_directory_access(path: Path, *, description: str) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:  # pragma: no cover - depends on host FS
        _fail_config(f"Unable to create {description} at {path}: {exc}")
    test_file = path / ".arciva-path-check"
    try:
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
    except OSError as exc:  # pragma: no cover - depends on host FS
        _fail_config(f"{description} is not writable ({path}): {exc}")

def _validate_db_path(raw: str) -> Path:
    if not raw:
        _fail_config("APP_DB_PATH is required.")
    path = _normalize_path(raw, name="APP_DB_PATH")
    if path.suffix.lower() != ".db":
        _fail_config(f"APP_DB_PATH must point to a .db file (got {path.name}).")
    _check_directory_access(path.parent, description="database directory")
    try:
        with open(path, "ab"):
            os.utime(path, None)
    except OSError as exc:  # pragma: no cover - depends on host FS
        _fail_config(f"Cannot access database file {path}: {exc}")
    return path

def _validate_media_root(raw: str) -> Path:
    if not raw:
        _fail_config("APP_MEDIA_ROOT is required.")
    path = _normalize_path(raw, name="APP_MEDIA_ROOT")
    _check_directory_access(path, description="media root")
    return path

def _detect_local_ipv4_addresses() -> List[str]:
    """Return non-loopback IPv4 addresses assigned to this host."""
    ips: set[str] = set()
    try:
        host_name = socket.gethostname()
        for info in socket.getaddrinfo(host_name, None, family=socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ips.add(sock.getsockname()[0])
    except OSError:
        pass
    return [ip for ip in ips if not ip.startswith("127.")]

def _subdir(root: Path, name: str) -> Path:
    sub = root / name
    _check_directory_access(sub, description=f"media subdirectory '{name}'")
    return sub

@lru_cache
def get_settings() -> Settings:
    s = Settings()
    db_path = _validate_db_path(s.app_db_path)
    media_root = _validate_media_root(s.app_media_root)
    _config_logger.info("Validated APP_DB_PATH -> %s", db_path)
    _config_logger.info("Validated APP_MEDIA_ROOT -> %s", media_root)
    db_dir = db_path.parent.resolve()
    media_resolved = media_root.resolve()
    try:
        db_dir.relative_to(media_resolved)
    except ValueError:
        pass
    else:
        _fail_config("APP_DB_PATH must not be located inside APP_MEDIA_ROOT; choose a separate directory.")
    uploads = _subdir(media_root, "uploads")
    originals = _subdir(media_root, "originals")
    derivatives = _subdir(media_root, "derivatives")
    exports = _subdir(media_root, "exports")
    s.app_db_path = str(db_path)
    s.database_url = f"sqlite+aiosqlite:///{db_path}"
    s.fs_root = str(media_root)
    s.fs_uploads_dir = str(uploads)
    s.fs_originals_dir = str(originals)
    s.fs_derivatives_dir = str(derivatives)
    s.fs_exports_dir = str(exports)
    setattr(s, "experimental_photo_store_enabled", False)
    setattr(s, "photo_store_locations", [])
    setattr(s, "photo_store_state", None)
    logs_path = Path(s.logs_dir).expanduser()
    if not logs_path.is_absolute():
        logs_path = Path.cwd() / logs_path
    logs_path.mkdir(parents=True, exist_ok=True)
    s.logs_dir = str(logs_path)
    if s.app_env.lower() == "dev" and s.allow_lan_frontend_origins:
        lan_ips = _detect_local_ipv4_addresses()
        extra_origins = [
            f"http://{ip}:{s.dev_frontend_port}" for ip in lan_ips if ip
        ]
        for origin in extra_origins:
            if origin not in s.allowed_origins:
                s.allowed_origins.append(origin)
        if extra_origins:
            _config_logger.info(
                "Added LAN origins: %s",
                ", ".join(extra_origins),
            )
    _config_logger.info("Allowed origins: %s", ", ".join(s.allowed_origins) or "<none>")
    return s
