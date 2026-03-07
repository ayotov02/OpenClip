import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job


async def create_job(
    db: AsyncSession,
    user_id: uuid.UUID,
    job_type: str,
    celery_task_id: str | None = None,
    metadata: dict | None = None,
) -> Job:
    job = Job(
        user_id=user_id,
        job_type=job_type,
        celery_task_id=celery_task_id,
        metadata_=metadata or {},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def get_jobs(
    db: AsyncSession, user_id: uuid.UUID, status: str | None = None
) -> list[Job]:
    query = select(Job).where(Job.user_id == user_id)
    if status:
        query = query.where(Job.status == status)
    query = query.order_by(Job.created_at.desc()).limit(50)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_job(db: AsyncSession, job_id: uuid.UUID) -> Job | None:
    result = await db.execute(select(Job).where(Job.id == job_id))
    return result.scalar_one_or_none()


async def update_job_progress(
    db: AsyncSession,
    job_id: uuid.UUID,
    progress: float,
    status: str | None = None,
    result: dict | None = None,
    error_message: str | None = None,
) -> Job | None:
    job = await get_job(db, job_id)
    if not job:
        return None
    job.progress = progress
    if status:
        job.status = status
    if result:
        job.result = result
    if error_message:
        job.error_message = error_message
    await db.commit()
    await db.refresh(job)
    return job
