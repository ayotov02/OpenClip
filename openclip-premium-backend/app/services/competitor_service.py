import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.competitor import Competitor, CompetitorMetric
from app.schemas.competitor import CompetitorCreate


async def add_competitor(
    db: AsyncSession, user_id: uuid.UUID, data: CompetitorCreate
) -> Competitor:
    comp = Competitor(user_id=user_id, **data.model_dump())
    db.add(comp)
    await db.commit()
    await db.refresh(comp)
    return comp


async def get_competitors(
    db: AsyncSession, user_id: uuid.UUID
) -> list[Competitor]:
    result = await db.execute(
        select(Competitor)
        .where(Competitor.user_id == user_id)
        .order_by(Competitor.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_competitor(db: AsyncSession, comp_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Competitor).where(Competitor.id == comp_id)
    )
    comp = result.scalar_one_or_none()
    if not comp:
        return False
    await db.delete(comp)
    await db.commit()
    return True


async def get_metrics(
    db: AsyncSession, comp_id: uuid.UUID
) -> list[CompetitorMetric]:
    result = await db.execute(
        select(CompetitorMetric)
        .where(CompetitorMetric.competitor_id == comp_id)
        .order_by(CompetitorMetric.timestamp.desc())
        .limit(100)
    )
    return list(result.scalars().all())
