import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clip import Clip
from app.models.job import Job
from app.models.project import Project
from app.models.publish import PublishJob


async def get_summary(db: AsyncSession, user_id: uuid.UUID) -> dict:
    projects = await db.execute(
        select(func.count()).select_from(Project).where(Project.user_id == user_id)
    )
    clips = await db.execute(
        select(func.count())
        .select_from(Clip)
        .join(Project)
        .where(Project.user_id == user_id)
    )
    published = await db.execute(
        select(func.count())
        .select_from(PublishJob)
        .where(PublishJob.user_id == user_id, PublishJob.status == "published")
    )
    running_jobs = await db.execute(
        select(func.count())
        .select_from(Job)
        .where(Job.user_id == user_id, Job.status == "processing")
    )
    return {
        "total_projects": projects.scalar() or 0,
        "total_clips": clips.scalar() or 0,
        "total_published": published.scalar() or 0,
        "running_jobs": running_jobs.scalar() or 0,
    }


async def get_performance(db: AsyncSession, user_id: uuid.UUID) -> dict:
    avg_score = await db.execute(
        select(func.avg(Clip.virality_score))
        .join(Project)
        .where(Project.user_id == user_id)
    )
    top_clips = await db.execute(
        select(Clip)
        .join(Project)
        .where(Project.user_id == user_id)
        .order_by(Clip.virality_score.desc())
        .limit(5)
    )
    return {
        "avg_virality_score": round(avg_score.scalar() or 0, 1),
        "top_clips": [
            {"id": str(c.id), "title": c.title, "score": c.virality_score}
            for c in top_clips.scalars().all()
        ],
    }
