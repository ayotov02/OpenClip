import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.publish import PublishJobCreate, PublishJobResponse, PublishJobUpdate
from app.services import publish_service as svc

router = APIRouter(prefix="/publish", tags=["publish"])


@router.post("", response_model=PublishJobResponse, status_code=201)
async def create_job(
    data: PublishJobCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.create_publish_job(db, user.id, data)


@router.get("", response_model=list[PublishJobResponse])
async def list_jobs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_publish_jobs(db, user.id)


@router.put("/{job_id}", response_model=PublishJobResponse)
async def update_job(
    job_id: uuid.UUID,
    data: PublishJobUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await svc.update_publish_job(db, job_id, data)
    if not job:
        raise HTTPException(status_code=404, detail="Publish job not found")
    return job


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.delete_publish_job(db, job_id):
        raise HTTPException(status_code=404, detail="Publish job not found")
