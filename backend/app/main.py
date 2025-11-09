import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .deps import get_settings
from .routers import projects, uploads, assets
from .logging_utils import setup_logging

api_logger = logging.getLogger("arciva.api")

def create_app() -> FastAPI:
    s = get_settings()
    setup_logging(s.logs_dir)
    app = FastAPI(title="Arciva API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(projects.router)
    app.include_router(uploads.router)
    app.include_router(assets.router)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            api_logger.exception("Unhandled error during %s %s (%.2f ms)", request.method, request.url.path, duration_ms)
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        api_logger.info(
            "%s %s -> %s (%.2f ms)",
            request.method,
            request.url.path,
            getattr(response, "status_code", "unknown"),
            duration_ms,
        )
        return response

    @app.get("/health")
    async def health():
        return {"ok": True}

    return app

app = create_app()
