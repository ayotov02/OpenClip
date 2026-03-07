import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.brand_context import (
    BrandContextCreate,
    BrandContextResponse,
    BrandContextUpdate,
)
from app.services import brand_context_service as svc

router = APIRouter(prefix="/brand-context", tags=["brand-context"])


@router.post("", response_model=BrandContextResponse, status_code=201)
async def create(
    data: BrandContextCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.create_brand_context(db, user.id, data)


@router.get("", response_model=list[BrandContextResponse])
async def list_contexts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_brand_contexts(db, user.id)


@router.get("/{context_id}", response_model=BrandContextResponse)
async def get_context(
    context_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ctx = await svc.get_brand_context(db, context_id)
    if not ctx or ctx.user_id != user.id:
        raise HTTPException(status_code=404, detail="Brand context not found")
    return ctx


@router.put("/{context_id}", response_model=BrandContextResponse)
async def update(
    context_id: uuid.UUID,
    data: BrandContextUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await svc.get_brand_context(db, context_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Brand context not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    ctx = await svc.update_brand_context(db, context_id, data)
    return ctx


@router.delete("/{context_id}", status_code=204)
async def delete(
    context_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await svc.get_brand_context(db, context_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Brand context not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await svc.delete_brand_context(db, context_id)
