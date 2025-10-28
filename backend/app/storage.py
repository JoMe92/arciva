from dataclasses import dataclass
from .deps import get_settings
from pathlib import Path
import hashlib
import os
import shutil

@dataclass
class PosixStorage:
    uploads: Path
    originals: Path
    derivatives: Path

    @classmethod
    def from_env(cls) -> "PosixStorage":
        s = get_settings()
        return cls(Path(s.fs_uploads_dir), Path(s.fs_originals_dir), Path(s.fs_derivatives_dir))

    def temp_path_for(self, asset_id: str) -> Path:
        return self.uploads / f"{asset_id}.upload"

    def move_to_originals(self, temp_path: Path, sha256_hex: str, ext: str) -> Path:
        dest = self.originals / f"{sha256_hex}{ext}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        # If already exists (dedupe), remove temp and return existing
        if dest.exists():
            temp_path.unlink(missing_ok=True)
            return dest
        shutil.move(str(temp_path), str(dest))
        return dest

    def derivative_path(self, sha256_hex: str, variant: str, fmt: str) -> Path:
        p = self.derivatives / sha256_hex / f"{variant}.{fmt}"
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
