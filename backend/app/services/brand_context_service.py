import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_context import BrandContext
from app.schemas.brand_context import BrandContextCreate, BrandContextUpdate


async def create_brand_context(
    db: AsyncSession, user_id: uuid.UUID, data: BrandContextCreate
) -> BrandContext:
    # Deactivate existing active contexts
    await db.execute(
        update(BrandContext)
        .where(BrandContext.user_id == user_id, BrandContext.is_active.is_(True))
        .values(is_active=False)
    )
    ctx = BrandContext(user_id=user_id, **data.model_dump())
    db.add(ctx)
    await db.commit()
    await db.refresh(ctx)
    return ctx


async def get_brand_contexts(
    db: AsyncSession, user_id: uuid.UUID
) -> list[BrandContext]:
    result = await db.execute(
        select(BrandContext)
        .where(BrandContext.user_id == user_id)
        .order_by(BrandContext.updated_at.desc())
    )
    return list(result.scalars().all())


async def update_brand_context(
    db: AsyncSession, context_id: uuid.UUID, data: BrandContextUpdate
) -> BrandContext | None:
    result = await db.execute(
        select(BrandContext).where(BrandContext.id == context_id)
    )
    ctx = result.scalar_one_or_none()
    if not ctx:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ctx, key, value)
    await db.commit()
    await db.refresh(ctx)
    return ctx


async def delete_brand_context(
    db: AsyncSession, context_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(BrandContext).where(BrandContext.id == context_id)
    )
    ctx = result.scalar_one_or_none()
    if not ctx:
        return False
    await db.delete(ctx)
    await db.commit()
    return True
