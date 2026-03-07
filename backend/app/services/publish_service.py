import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.publish import PublishJob
from app.schemas.publish import PublishJobCreate, PublishJobUpdate


async def create_publish_job(
    db: AsyncSession, user_id: uuid.UUID, data: PublishJobCreate
) -> PublishJob:
    job = PublishJob(
        user_id=user_id,
        clip_id=data.clip_id,
        platform=data.platform,
        social_account_id=data.social_account_id,
        title=data.title,
        description=data.description,
        hashtags=data.hashtags,
        scheduled_at=data.scheduled_at,
        metadata_=data.metadata,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def get_publish_jobs(
    db: AsyncSession, user_id: uuid.UUID
) -> list[PublishJob]:
    result = await db.execute(
        select(PublishJob)
        .where(PublishJob.user_id == user_id)
        .order_by(PublishJob.created_at.desc())
    )
    return list(result.scalars().all())


async def get_publish_job(
    db: AsyncSession, job_id: uuid.UUID
) -> PublishJob | None:
    result = await db.execute(
        select(PublishJob).where(PublishJob.id == job_id)
    )
    return result.scalar_one_or_none()


async def update_publish_job(
    db: AsyncSession, job_id: uuid.UUID, data: PublishJobUpdate
) -> PublishJob | None:
    result = await db.execute(
        select(PublishJob).where(PublishJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(job, key, value)
    await db.commit()
    await db.refresh(job)
    return job


async def delete_publish_job(db: AsyncSession, job_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(PublishJob).where(PublishJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        return False
    await db.delete(job)
    await db.commit()
    return True
