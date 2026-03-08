import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.discovery import DiscoveryResult


async def create_discovery_result(
    db: AsyncSession, user_id: uuid.UUID, data: dict
) -> DiscoveryResult:
    result_obj = DiscoveryResult(user_id=user_id, **data)
    db.add(result_obj)
    await db.commit()
    await db.refresh(result_obj)
    return result_obj


async def bulk_create_discovery_results(
    db: AsyncSession, user_id: uuid.UUID, results: list[dict]
) -> list[DiscoveryResult]:
    objects = [DiscoveryResult(user_id=user_id, **r) for r in results]
    db.add_all(objects)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def get_discovery_results(
    db: AsyncSession,
    user_id: uuid.UUID,
    query_str: str | None = None,
    platform: str | None = None,
    post_type: str | None = None,
    min_engagement: int | None = None,
    sort_by: str = "searched_at",
    limit: int = 50,
    offset: int = 0,
) -> list[DiscoveryResult]:
    query = select(DiscoveryResult).where(DiscoveryResult.user_id == user_id)

    if query_str:
        query = query.where(DiscoveryResult.query == query_str)
    if platform:
        query = query.where(DiscoveryResult.platform == platform)
    if post_type:
        query = query.where(DiscoveryResult.post_type == post_type)
    if min_engagement is not None:
        query = query.where(DiscoveryResult.views >= min_engagement)

    sort_column = getattr(DiscoveryResult, sort_by, DiscoveryResult.searched_at)
    query = query.order_by(sort_column.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_discovery_results_count(
    db: AsyncSession,
    user_id: uuid.UUID,
    query_str: str | None = None,
) -> int:
    query = select(func.count(DiscoveryResult.id)).where(
        DiscoveryResult.user_id == user_id
    )
    if query_str:
        query = query.where(DiscoveryResult.query == query_str)
    result = await db.execute(query)
    return result.scalar_one()


async def get_discovery_result(
    db: AsyncSession, result_id: uuid.UUID
) -> DiscoveryResult | None:
    result = await db.execute(
        select(DiscoveryResult).where(DiscoveryResult.id == result_id)
    )
    return result.scalar_one_or_none()


async def update_discovery_analysis(
    db: AsyncSession, result_id: uuid.UUID, analysis: dict
) -> DiscoveryResult | None:
    result = await db.execute(
        select(DiscoveryResult).where(DiscoveryResult.id == result_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        return None
    for key, value in analysis.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_recent_queries(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 20
) -> list[str]:
    result = await db.execute(
        select(DiscoveryResult.query)
        .where(DiscoveryResult.user_id == user_id)
        .group_by(DiscoveryResult.query)
        .order_by(func.max(DiscoveryResult.searched_at).desc())
        .limit(limit)
    )
    return list(result.scalars().all())
