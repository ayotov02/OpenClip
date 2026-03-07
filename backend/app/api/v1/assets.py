import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import CreativeAssetResponse
from app.services import asset_service as svc

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[CreativeAssetResponse])
async def list_assets(
    asset_type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_assets(db, user.id, asset_type)


@router.get("/{asset_id}", response_model=CreativeAssetResponse)
async def get_asset(
    asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await svc.get_asset(db, asset_id)
    if not asset or asset.user_id != user.id:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(
    asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.delete_asset(db, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")
