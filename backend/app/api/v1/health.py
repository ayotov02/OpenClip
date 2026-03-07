from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "mode": settings.APP_MODE,
    }
