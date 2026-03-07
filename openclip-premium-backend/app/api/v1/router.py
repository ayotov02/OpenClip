from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.assets import router as assets_router
from app.api.v1.auth import router as auth_router
from app.api.v1.batch import router as batch_router
from app.api.v1.brand_context import router as brand_context_router
from app.api.v1.brands import router as brands_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.chat import router as chat_router
from app.api.v1.clips import router as clips_router
from app.api.v1.competitors import router as competitors_router
from app.api.v1.faceless import router as faceless_router
from app.api.v1.hashtags import router as hashtags_router
from app.api.v1.health import router as health_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.projects import router as projects_router
from app.api.v1.publish import router as publish_router
from app.api.v1.settings import router as settings_router
from app.api.v1.trends import router as trends_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router)
api_router.include_router(brand_context_router)
api_router.include_router(projects_router)
api_router.include_router(clips_router)
api_router.include_router(faceless_router)
api_router.include_router(brands_router)
api_router.include_router(calendar_router)
api_router.include_router(publish_router)
api_router.include_router(analytics_router)
api_router.include_router(competitors_router)
api_router.include_router(trends_router)
api_router.include_router(hashtags_router)
api_router.include_router(batch_router)
api_router.include_router(assets_router)
api_router.include_router(chat_router)
api_router.include_router(settings_router)
api_router.include_router(jobs_router)
