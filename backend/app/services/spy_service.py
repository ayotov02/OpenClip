import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scraped_post import ScrapedPost


async def create_scraped_post(
    db: AsyncSession, user_id: uuid.UUID, data: dict
) -> ScrapedPost:
    post = ScrapedPost(user_id=user_id, **data)
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def bulk_create_scraped_posts(
    db: AsyncSession, user_id: uuid.UUID, posts: list[dict]
) -> list[ScrapedPost]:
    objects = [ScrapedPost(user_id=user_id, **p) for p in posts]
    db.add_all(objects)
    await db.commit()
    for obj in objects:
        await db.refresh(obj)
    return objects


async def get_spy_feed(
    db: AsyncSession,
    user_id: uuid.UUID,
    platform: str | None = None,
    min_hook_score: float | None = None,
    sort_by: str = "scraped_at",
    limit: int = 50,
    offset: int = 0,
) -> list[ScrapedPost]:
    query = select(ScrapedPost).where(ScrapedPost.user_id == user_id)

    if platform:
        query = query.where(ScrapedPost.platform == platform)
    if min_hook_score is not None:
        query = query.where(ScrapedPost.hook_score >= min_hook_score)

    sort_column = getattr(ScrapedPost, sort_by, ScrapedPost.scraped_at)
    query = query.order_by(sort_column.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_spy_feed_count(
    db: AsyncSession,
    user_id: uuid.UUID,
    platform: str | None = None,
) -> int:
    query = select(func.count(ScrapedPost.id)).where(ScrapedPost.user_id == user_id)
    if platform:
        query = query.where(ScrapedPost.platform == platform)
    result = await db.execute(query)
    return result.scalar_one()


async def get_scraped_post(
    db: AsyncSession, post_id: uuid.UUID
) -> ScrapedPost | None:
    result = await db.execute(
        select(ScrapedPost).where(ScrapedPost.id == post_id)
    )
    return result.scalar_one_or_none()


async def update_post_analysis(
    db: AsyncSession, post_id: uuid.UUID, analysis: dict
) -> ScrapedPost | None:
    result = await db.execute(
        select(ScrapedPost).where(ScrapedPost.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        return None
    for key, value in analysis.items():
        if hasattr(post, key):
            setattr(post, key, value)
    await db.commit()
    await db.refresh(post)
    return post


async def get_posts_by_competitor(
    db: AsyncSession,
    competitor_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[ScrapedPost]:
    result = await db.execute(
        select(ScrapedPost)
        .where(ScrapedPost.competitor_id == competitor_id)
        .order_by(ScrapedPost.posted_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())
