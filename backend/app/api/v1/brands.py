import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.brand_kit import BrandKitCreate, BrandKitResponse, BrandKitUpdate
from app.services import brand_kit_service as svc

router = APIRouter(prefix="/brands", tags=["brands"])


@router.post("", response_model=BrandKitResponse, status_code=201)
async def create(
    data: BrandKitCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.create_brand_kit(db, user.id, data)


@router.get("", response_model=list[BrandKitResponse])
async def list_kits(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_brand_kits(db, user.id)


@router.get("/{kit_id}", response_model=BrandKitResponse)
async def get_kit(
    kit_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kit = await svc.get_brand_kit(db, kit_id)
    if not kit or kit.user_id != user.id:
        raise HTTPException(status_code=404, detail="Brand kit not found")
    return kit


@router.put("/{kit_id}", response_model=BrandKitResponse)
async def update_kit(
    kit_id: uuid.UUID,
    data: BrandKitUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await svc.get_brand_kit(db, kit_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Brand kit not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    kit = await svc.update_brand_kit(db, kit_id, data)
    return kit


@router.delete("/{kit_id}", status_code=204)
async def delete_kit(
    kit_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await svc.get_brand_kit(db, kit_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Brand kit not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await svc.delete_brand_kit(db, kit_id)
