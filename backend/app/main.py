from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .deps import get_settings
from .routers import projects, uploads, assets

def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Nivio API", version="0.1.0")

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

    @app.get("/health")
    async def health():
        return {"ok": True}

    return app

app = create_app()
