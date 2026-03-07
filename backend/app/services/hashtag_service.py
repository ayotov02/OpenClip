import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hashtag import Hashtag
from app.schemas.common import HashtagCreate


async def add_hashtag(
    db: AsyncSession, user_id: uuid.UUID, data: HashtagCreate
) -> Hashtag:
    tag = Hashtag(user_id=user_id, tag=data.tag, platform=data.platform)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


async def get_hashtags(db: AsyncSession, user_id: uuid.UUID) -> list[Hashtag]:
    result = await db.execute(
        select(Hashtag)
        .where(Hashtag.user_id == user_id)
        .order_by(Hashtag.trend_score.desc())
    )
    return list(result.scalars().all())


async def delete_hashtag(db: AsyncSession, hashtag_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Hashtag).where(Hashtag.id == hashtag_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        return False
    await db.delete(tag)
    await db.commit()
    return True
