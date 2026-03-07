import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import BatchItemResponse, BatchJobCreate, BatchJobResponse
from app.services import batch_service as svc

router = APIRouter(prefix="/batch", tags=["batch"])


@router.post("", response_model=BatchJobResponse, status_code=201)
async def create_batch(
    data: BatchJobCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.create_batch_job(db, user.id, data)


@router.get("", response_model=list[BatchJobResponse])
async def list_batches(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_batch_jobs(db, user.id)


@router.get("/{job_id}", response_model=BatchJobResponse)
async def get_batch(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await svc.get_batch_job(db, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Batch job not found")
    return job


@router.get("/{job_id}/items", response_model=list[BatchItemResponse])
async def get_items(
    job_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_batch_items(db, job_id)
