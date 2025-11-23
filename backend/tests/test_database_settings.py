from pathlib import Path

from backend.app.schemas import DatabasePathStatus
from backend.app.services.database_settings import validate_database_path


def test_rejects_relative_paths():
    status, message = validate_database_path("relative/path")
    assert status == DatabasePathStatus.INVALID
    assert "absolute" in (message or "").lower()


def test_accepts_absolute_directory(tmp_path):
    candidate = tmp_path / "catalog" / "arciva.db"
    status, message = validate_database_path(candidate, ensure_writable=True)
    assert status == DatabasePathStatus.READY
    assert message is None


def test_reports_missing_directory(tmp_path):
    target = Path(tmp_path) / "missing" / "library.db"
    status, message = validate_database_path(target, ensure_writable=False)
    assert status == DatabasePathStatus.NOT_ACCESSIBLE
    assert message == "Directory does not exist."
