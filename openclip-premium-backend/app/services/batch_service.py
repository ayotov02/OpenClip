import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.batch import BatchItem, BatchJob
from app.schemas.common import BatchJobCreate


async def create_batch_job(
    db: AsyncSession, user_id: uuid.UUID, data: BatchJobCreate
) -> BatchJob:
    job = BatchJob(user_id=user_id, job_type=data.job_type, settings=data.settings)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def get_batch_jobs(db: AsyncSession, user_id: uuid.UUID) -> list[BatchJob]:
    result = await db.execute(
        select(BatchJob)
        .where(BatchJob.user_id == user_id)
        .order_by(BatchJob.created_at.desc())
    )
    return list(result.scalars().all())


async def get_batch_job(db: AsyncSession, job_id: uuid.UUID) -> BatchJob | None:
    result = await db.execute(select(BatchJob).where(BatchJob.id == job_id))
    return result.scalar_one_or_none()


async def get_batch_items(
    db: AsyncSession, job_id: uuid.UUID
) -> list[BatchItem]:
    result = await db.execute(
        select(BatchItem).where(BatchItem.batch_job_id == job_id)
    )
    return list(result.scalars().all())
