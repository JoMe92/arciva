from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from uuid import UUID
import logging
import shutil

from .deps import get_settings

logger = logging.getLogger("arciva.storage")


@dataclass
class PosixStorage:
    root: Path
    uploads: Path
    originals: Path
    derivatives: Path
    exports: Path
    _extra_derivative_roots: list[Path] = field(default_factory=list)

    @classmethod
    def from_env(cls) -> "PosixStorage":
        s = get_settings()
        root = Path(s.fs_root)
        uploads = Path(s.fs_uploads_dir)
        originals = Path(s.fs_originals_dir)
        derivatives = Path(s.fs_derivatives_dir)
        exports = Path(s.fs_exports_dir)
        extra_roots: list[Path] = []
        locations = getattr(s, "photo_store_locations", None)
        if isinstance(locations, list) and len(locations) > 1:
            for entry in locations[1:]:
                path_value = entry.get("path") if isinstance(entry, dict) else None
                if not isinstance(path_value, str):
                    continue
                extra_roots.append(Path(path_value) / "derivatives")
        return cls(
            root,
            uploads,
            originals,
            derivatives,
            exports,
            _extra_derivative_roots=extra_roots,
        )

    def storage_key_for(self, path: Path) -> str:
        """
        Return a POSIX-style relative key for a path under the media root.
        """
        root_resolved = self.root.resolve()
        try:
            relative = (
                path.expanduser().resolve(strict=False).relative_to(root_resolved)
            )
        except ValueError as exc:
            raise ValueError(
                f"Path {path} is outside of the media root {self.root}"
            ) from exc
        return PurePosixPath(*relative.parts).as_posix()

    def path_from_key(self, storage_key: str | None) -> Path | None:
        if not storage_key:
            return None
        raw = str(storage_key).strip()
        if not raw:
            return None
        if raw.startswith("file://"):
            raw = raw[7:]
        candidate = Path(raw)
        # Support legacy absolute paths for backwards compatibility.
        if candidate.is_absolute():
            try:
                candidate.relative_to(self.root.resolve())
            except ValueError:
                logger.warning(
                    "path_from_key: legacy path outside media root %s",
                    candidate,
                )
            return candidate
        posix_path = PurePosixPath(raw)
        if any(part == ".." for part in posix_path.parts):
            raise ValueError(f"Invalid storage key: {storage_key!r}")
        parts = [part for part in posix_path.parts if part not in {"", ".", "/"}]
        if not parts:
            raise ValueError(f"Invalid storage key: {storage_key!r}")
        resolved = self.root
        for part in parts:
            resolved = resolved / part
        resolved = resolved.resolve(strict=False)
        try:
            resolved.relative_to(self.root.resolve())
        except ValueError as exc:
            raise ValueError(
                f"Resolved storage key escapes media root: {storage_key!r}"
            ) from exc
        return resolved

    def temp_path_for(self, asset_id: str) -> Path:
        return self.uploads / f"{asset_id}.upload"

    def remove_temp(self, asset_id: str | UUID) -> None:
        aid = str(asset_id)
        self.temp_path_for(aid).unlink(missing_ok=True)

    def original_path_for(self, sha256_hex: str, ext: str) -> Path:
        if not ext.startswith("."):
            ext = f".{ext}"
        dest = self.originals / f"{sha256_hex}{ext}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        return dest

    def move_to_originals(self, temp_path: Path, sha256_hex: str, ext: str) -> Path:
        dest = self.original_path_for(sha256_hex, ext)
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

    def find_derivative(self, sha256_hex: str, variant: str, fmt: str) -> Path | None:
        for root in [self.derivatives, *self._extra_derivative_roots]:
            candidate = root / sha256_hex / f"{variant}.{fmt}"
            if candidate.exists():
                return candidate
        return None

    def remove_original(self, storage_key: str | None) -> None:
        if not storage_key:
            return
        try:
            path = self.path_from_key(storage_key)
        except ValueError as exc:
            logger.warning(
                "remove_original: invalid storage key %s (%s)",
                storage_key,
                exc,
            )
            return
        if path is None:
            return
        if path.is_file():
            path.unlink(missing_ok=True)
        elif path.exists():
            try:
                path.unlink(missing_ok=True)
            except IsADirectoryError:
                shutil.rmtree(path, ignore_errors=True)

    def remove_derivatives(self, sha256_hex: str | None) -> None:
        if not sha256_hex:
            return
        for root in [self.derivatives, *self._extra_derivative_roots]:
            shutil.rmtree(root / sha256_hex, ignore_errors=True)
