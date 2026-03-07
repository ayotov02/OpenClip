import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.core.storage import ensure_bucket
    from app.core.websocket import ws_manager

    logger.info("Starting OpenClip %s (mode=%s)", settings.APP_VERSION, settings.APP_MODE)
    ensure_bucket()
    await ws_manager.start_listener()
    yield
    await ws_manager.stop_listener()
    from app.core.database import engine

    await engine.dispose()
    logger.info("OpenClip shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenClip",
        description="AI-powered video creation platform",
        version=settings.APP_VERSION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
