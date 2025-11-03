# backend/app/deps.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache
from typing import List, Optional
from pathlib import Path
import os, json

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_env: str = "dev"
    secret_key: str = "changeme"

    allowed_origins: List[str] = ["http://localhost:5173"]

    database_url: str
    redis_url: str = "redis://127.0.0.1:6379/0"

    fs_root: str = str(Path.home() / "photo-store")
    fs_uploads_dir: str = str(Path.home() / "photo-store" / "uploads")
    fs_originals_dir: str = str(Path.home() / "photo-store" / "originals")
    fs_derivatives_dir: str = str(Path.home() / "photo-store" / "derivatives")

    thumb_sizes: List[int] = [256]
    max_upload_mb: int = 200
    worker_concurrency: int = 2
    logs_dir: str = "logs"
    exiftool_path: str = "exiftool"

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

@lru_cache
def get_settings() -> Settings:
    s = Settings()
    fs_paths = [s.fs_root, s.fs_uploads_dir, s.fs_originals_dir, s.fs_derivatives_dir]
    for p in fs_paths:
        os.makedirs(p, exist_ok=True)
    logs_path = Path(s.logs_dir).expanduser()
    if not logs_path.is_absolute():
        logs_path = Path.cwd() / logs_path
    logs_path.mkdir(parents=True, exist_ok=True)
    s.logs_dir = str(logs_path)
    return s
