#!/usr/bin/env python3
"""
Normalize media paths in the SQLite database to be relative to APP_MEDIA_ROOT.
"""

from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path, PurePosixPath


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert absolute media paths to relative keys."
    )
    parser.add_argument(
        "--db",
        dest="db_path",
        default=os.environ.get("APP_DB_PATH"),
        help="Path to the SQLite database file (defaults to APP_DB_PATH).",
    )
    parser.add_argument(
        "--media-root",
        dest="media_root",
        default=os.environ.get("APP_MEDIA_ROOT"),
        help="Media root directory (defaults to APP_MEDIA_ROOT).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned updates without modifying the database.",
    )
    parser.add_argument(
        "--prefix",
        dest="legacy_prefix",
        default=None,
        help=(
            "Optional legacy absolute prefix to strip when present "
            "(defaults to media root)."
        ),
    )
    return parser.parse_args()


def _require_path(value: str | None, description: str) -> Path:
    if not value:
        raise SystemExit(f"{description} is required.")
    path = Path(value).expanduser().resolve()
    if description == "Database path" and not path.exists():
        raise SystemExit(f"Database not found at {path}.")
    return path


def _relative_key(
    root: Path, absolute: str, legacy_prefix: Path | None
) -> str | None:
    raw = absolute.strip()
    if not raw:
        return None
    if raw.startswith("file://"):
        raw = raw[7:]
    candidate = Path(raw)
    try:
        rel = candidate.resolve().relative_to(root)
        return PurePosixPath(*rel.parts).as_posix()
    except Exception:
        pass
    for prefix in (legacy_prefix, root):
        if not prefix:
            continue
        prefix_str = str(prefix)
        if raw.startswith(prefix_str):
            suffix = raw[len(prefix_str) :].lstrip("/\\")
            if not suffix:
                return None
            return PurePosixPath(suffix.replace("\\", "/")).as_posix()
    return None


def _update_table(
    conn: sqlite3.Connection,
    table: str,
    column: str,
    root: Path,
    legacy: Path | None,
    dry_run: bool,
) -> int:
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT rowid, {column} FROM {table} WHERE {column} IS NOT NULL"
    )
    rows = cursor.fetchall()
    updated = 0
    for rowid, value in rows:
        if not isinstance(value, str):
            continue
        key = _relative_key(root, value, legacy)
        if not key or key == value:
            continue
        if dry_run:
            print(f"[dry-run] {table} row {rowid}: {value!r} -> {key!r}")
        else:
            cursor.execute(
                f"UPDATE {table} SET {column} = ? WHERE rowid = ?",
                (key, rowid),
            )
        updated += 1
    return updated


def main() -> None:
    args = _parse_args()
    db_path = _require_path(args.db_path, "Database path")
    media_root = _require_path(args.media_root, "Media root")
    legacy_prefix = (
        Path(args.legacy_prefix).expanduser().resolve()
        if args.legacy_prefix
        else None
    )

    conn = sqlite3.connect(db_path)
    try:
        total = 0
        total += _update_table(
            conn,
            "assets",
            "storage_uri",
            media_root,
            legacy_prefix,
            args.dry_run,
        )
        total += _update_table(
            conn,
            "derivatives",
            "storage_key",
            media_root,
            legacy_prefix,
            args.dry_run,
        )
        total += _update_table(
            conn,
            "bulk_image_exports",
            "artifact_path",
            media_root,
            legacy_prefix,
            args.dry_run,
        )
        total += _update_table(
            conn,
            "export_jobs",
            "artifact_path",
            media_root,
            legacy_prefix,
            args.dry_run,
        )
        if args.dry_run:
            print(f"[dry-run] {total} rows would be updated.")
        else:
            conn.commit()
            print(f"Updated {total} rows.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
