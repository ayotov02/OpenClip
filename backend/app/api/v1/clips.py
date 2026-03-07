import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.clip import ClipGenerateRequest, ClipResponse, ClipUpdate
from app.services import clip_service as svc

router = APIRouter(tags=["clips"])


@router.get("/projects/{project_id}/clips", response_model=list[ClipResponse])
async def list_clips(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_clips_for_project(db, project_id)


@router.post("/projects/{project_id}/clips", status_code=202)
async def generate_clips(
    project_id: uuid.UUID,
    data: ClipGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: dispatch Celery task for clip generation pipeline
    return {"message": "Clip generation started", "project_id": str(project_id)}


@router.get("/clips/{clip_id}", response_model=ClipResponse)
async def get_clip(
    clip_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clip = await svc.get_clip(db, clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip


@router.put("/clips/{clip_id}", response_model=ClipResponse)
async def update_clip(
    clip_id: uuid.UUID,
    data: ClipUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clip = await svc.update_clip(db, clip_id, data)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip


@router.delete("/clips/{clip_id}", status_code=204)
async def delete_clip(
    clip_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.delete_clip(db, clip_id):
        raise HTTPException(status_code=404, detail="Clip not found")
