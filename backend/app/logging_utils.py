from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

_configured = False


def setup_logging(log_dir: str, level: int = logging.INFO, module_log_level: Optional[int] = None) -> None:
    """
    Configure root logger with a rotating file handler that writes to the
    provided directory. Subsequent calls are no-ops to avoid duplicating
    handlers when the application reloads.
    """
    global _configured
    if _configured:
        return

    path = Path(log_dir)
    path.mkdir(parents=True, exist_ok=True)
    log_file = path / "backend.log"

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = RotatingFileHandler(log_file, maxBytes=5_000_000, backupCount=5)
    handler.setFormatter(formatter)
    handler.setLevel(level)

    root_logger = logging.getLogger()
    root_logger.setLevel(min(level, root_logger.level or level))

    # Avoid attaching duplicate handlers if uvicorn reloads the process.
    if not any(
        isinstance(h, RotatingFileHandler) and getattr(h, "baseFilename", None) == str(log_file)
        for h in root_logger.handlers
    ):
        root_logger.addHandler(handler)

    # Optionally raise level for our application namespace without touching
    # other loggers such as SQLAlchemy which can be noisy.
    if module_log_level is not None:
        logging.getLogger("nivio").setLevel(module_log_level)

    # Capture uvicorn access logs as well so HTTP status codes appear in the file.
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        logging.getLogger(name).addHandler(handler)

    _configured = True

