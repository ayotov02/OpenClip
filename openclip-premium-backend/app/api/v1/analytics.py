from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services import analytics_service as svc

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_summary(db, user.id)


@router.get("/performance")
async def performance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_performance(db, user.id)


@router.get("/competitors")
async def competitors(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services import competitor_service
    comps = await competitor_service.get_competitors(db, user.id)
    return [{"id": str(c.id), "handle": c.handle, "platform": c.platform} for c in comps]


@router.get("/trends")
async def trends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services import trend_service
    return await trend_service.get_trends(db, user.id)


@router.get("/hashtags")
async def hashtags(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services import hashtag_service
    return await hashtag_service.get_hashtags(db, user.id)
