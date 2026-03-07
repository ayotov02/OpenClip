import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import HashtagCreate, HashtagResponse
from app.services import hashtag_service as svc

router = APIRouter(prefix="/hashtags", tags=["hashtags"])


@router.get("", response_model=list[HashtagResponse])
async def list_hashtags(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_hashtags(db, user.id)


@router.post("", response_model=HashtagResponse, status_code=201)
async def add_hashtag(
    data: HashtagCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.add_hashtag(db, user.id, data)


@router.delete("/{hashtag_id}", status_code=204)
async def delete_hashtag(
    hashtag_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.delete_hashtag(db, hashtag_id):
        raise HTTPException(status_code=404, detail="Hashtag not found")
