import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trend import TrendingTopic


async def get_trends(db: AsyncSession, user_id: uuid.UUID) -> list[TrendingTopic]:
    result = await db.execute(
        select(TrendingTopic)
        .where(TrendingTopic.user_id == user_id)
        .order_by(TrendingTopic.relevance_score.desc())
        .limit(50)
    )
    return list(result.scalars().all())


async def get_trend(db: AsyncSession, trend_id: uuid.UUID) -> TrendingTopic | None:
    result = await db.execute(
        select(TrendingTopic).where(TrendingTopic.id == trend_id)
    )
    return result.scalar_one_or_none()
