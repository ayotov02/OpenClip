import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import CreativeAsset


async def get_assets(
    db: AsyncSession, user_id: uuid.UUID, asset_type: str | None = None
) -> list[CreativeAsset]:
    query = select(CreativeAsset).where(CreativeAsset.user_id == user_id)
    if asset_type:
        query = query.where(CreativeAsset.asset_type == asset_type)
    query = query.order_by(CreativeAsset.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_asset(db: AsyncSession, asset_id: uuid.UUID) -> CreativeAsset | None:
    result = await db.execute(
        select(CreativeAsset).where(CreativeAsset.id == asset_id)
    )
    return result.scalar_one_or_none()


async def delete_asset(db: AsyncSession, asset_id: uuid.UUID) -> bool:
    asset = await get_asset(db, asset_id)
    if not asset:
        return False
    await db.delete(asset)
    await db.commit()
    return True
