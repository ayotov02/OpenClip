import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_context import BrandContext


async def get_active_brand_context(
    db: AsyncSession, user_id: uuid.UUID
) -> BrandContext | None:
    result = await db.execute(
        select(BrandContext)
        .where(BrandContext.user_id == user_id, BrandContext.is_active.is_(True))
        .order_by(BrandContext.updated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_brand_context_by_id(
    db: AsyncSession, context_id: uuid.UUID
) -> BrandContext | None:
    result = await db.execute(
        select(BrandContext).where(BrandContext.id == context_id)
    )
    return result.scalar_one_or_none()
