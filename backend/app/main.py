import logging
import os
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse
from .deps import get_settings
from .routers import (
    projects,
    uploads,
    assets,
    settings,
    hub,
    export_jobs,
    bulk_image_exports,
    auth,
)
from .logging_utils import setup_logging
from .schema_utils import ensure_base_schema

try:  # Optional OpenTelemetry integration
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    _OTEL_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    trace = None  # type: ignore[assignment]
    OTLPSpanExporter = None  # type: ignore[assignment]
    FastAPIInstrumentor = None  # type: ignore[assignment]
    LoggingInstrumentor = None  # type: ignore[assignment]
    SQLAlchemyInstrumentor = None  # type: ignore[assignment]
    Resource = None  # type: ignore[assignment]
    TracerProvider = None  # type: ignore[assignment]
    BatchSpanProcessor = None  # type: ignore[assignment]
    _OTEL_AVAILABLE = False

api_logger = logging.getLogger("arciva.api")
startup_logger = logging.getLogger("arciva.startup")


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):  # type: ignore[override]
        response = await super().get_response(path, scope)
        if response.status_code != 404 or scope.get("method") not in {
            "GET",
            "HEAD",
        }:
            return response

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        accept_header = headers.get("accept", "")
        wants_html = "text/html" in accept_header or not accept_header
        if not wants_html:
            return response
        return await super().get_response("index.html", scope)


def create_app() -> FastAPI:
    s = get_settings()
    setup_logging(s.logs_dir)
    startup_logger.info("Starting Arciva backend (env=%s)", s.app_env)
    startup_logger.info("Using database: %s", s.database_url or s.app_db_path)
    startup_logger.info("Using media root: %s", s.fs_root)
    startup_logger.info(
        "CORS allow_origins: %s", ", ".join(s.allowed_origins) or "<none>"
    )

    tracer_provider = None
    if _OTEL_AVAILABLE:
        resource = Resource.create(attributes={"service.name": "arciva-backend"})
        tracer_provider = TracerProvider(resource=resource)
        otlp_exporter = OTLPSpanExporter()  # Defaults to localhost:4317 or env var
        span_processor = BatchSpanProcessor(otlp_exporter)
        tracer_provider.add_span_processor(span_processor)
        trace.set_tracer_provider(tracer_provider)

        LoggingInstrumentor().instrument(set_logging_format=True)
        SQLAlchemyInstrumentor().instrument()
    else:  # pragma: no cover - exercised implicitly during tests
        startup_logger.info(
            "OpenTelemetry not installed; skipping tracing instrumentation"
        )

    app = FastAPI(title="Arciva API", version="0.1.0")
    if _OTEL_AVAILABLE and tracer_provider:
        FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(projects.router)
    app.include_router(uploads.router)
    app.include_router(assets.router)
    app.include_router(settings.router)
    app.include_router(hub.router)
    app.include_router(export_jobs.router)
    app.include_router(bulk_image_exports.router)

    @app.on_event("startup")
    async def _bootstrap_schema():
        db_label = s.database_url or s.app_db_path
        startup_logger.info("Ensuring base schema on %s", db_label)
        await ensure_base_schema()
        startup_logger.info("Base schema ready on %s", db_label)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            api_logger.exception(
                "Unhandled error during %s %s (%.2f ms) db=%s media_root=%s",
                request.method,
                request.url.path,
                duration_ms,
                s.app_db_path,
                s.fs_root,
            )
            return JSONResponse(
                {"detail": "Internal server error. See logs."}, status_code=500
            )
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

    frontend_dist = Path(os.environ.get("FRONTEND_DIST_DIR", "/app/frontend_dist"))
    if frontend_dist.exists():
        startup_logger.info("Serving frontend from %s", frontend_dist)
        app.mount(
            "/",
            SPAStaticFiles(directory=frontend_dist, html=True),
            name="frontend",
        )
    else:
        startup_logger.info(
            "FRONTEND_DIST_DIR not found (%s); skipping static frontend mount",
            frontend_dist,
        )

    return app


app = create_app()
