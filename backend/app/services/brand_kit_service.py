import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_kit import BrandKit
from app.schemas.brand_kit import BrandKitCreate, BrandKitUpdate


async def create_brand_kit(
    db: AsyncSession, user_id: uuid.UUID, data: BrandKitCreate
) -> BrandKit:
    kit = BrandKit(user_id=user_id, **data.model_dump())
    db.add(kit)
    await db.commit()
    await db.refresh(kit)
    return kit


async def get_brand_kits(
    db: AsyncSession, user_id: uuid.UUID
) -> list[BrandKit]:
    result = await db.execute(
        select(BrandKit)
        .where(BrandKit.user_id == user_id)
        .order_by(BrandKit.created_at.desc())
    )
    return list(result.scalars().all())


async def get_brand_kit(
    db: AsyncSession, kit_id: uuid.UUID
) -> BrandKit | None:
    result = await db.execute(select(BrandKit).where(BrandKit.id == kit_id))
    return result.scalar_one_or_none()


async def update_brand_kit(
    db: AsyncSession, kit_id: uuid.UUID, data: BrandKitUpdate
) -> BrandKit | None:
    kit = await get_brand_kit(db, kit_id)
    if not kit:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(kit, key, value)
    await db.commit()
    await db.refresh(kit)
    return kit


async def delete_brand_kit(db: AsyncSession, kit_id: uuid.UUID) -> bool:
    kit = await get_brand_kit(db, kit_id)
    if not kit:
        return False
    await db.delete(kit)
    await db.commit()
    return True
