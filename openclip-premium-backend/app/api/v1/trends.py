import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import TrendingTopicResponse
from app.services import trend_service as svc

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("", response_model=list[TrendingTopicResponse])
async def list_trends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_trends(db, user.id)


@router.get("/{trend_id}", response_model=TrendingTopicResponse)
async def get_trend(
    trend_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    trend = await svc.get_trend(db, trend_id)
    if not trend:
        raise HTTPException(status_code=404, detail="Trend not found")
    return trend
