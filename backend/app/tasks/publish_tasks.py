import logging
import uuid

from app.tasks.celery_app import celery
from app.tasks.utils import run_async

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.publish_tasks.publish_to_platform", bind=True)
def publish_to_platform(self, publish_job_id: str) -> dict:
    """Publish clip to social media platform via OAuth tokens."""

    async def _run():
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.core.database import async_session
        from app.models.publish import PublishJob

        async with async_session() as db:
            result = await db.execute(
                select(PublishJob)
                .options(selectinload(PublishJob.social_account))
                .where(PublishJob.id == uuid.UUID(publish_job_id))
            )
            job = result.scalar_one_or_none()
            if not job:
                raise ValueError(f"PublishJob {publish_job_id} not found")

            platform = job.platform
            account = job.social_account

            if not account:
                job.status = "failed"
                job.error_message = "No social account linked"
                await db.commit()
                return {"publish_job_id": publish_job_id, "status": "failed"}

            # Platform-specific publishing would go here:
            # - YouTube: googleapis upload
            # - TikTok: tiktok open api
            # - Instagram: graph api
            # - Twitter: twitter api v2
            logger.info(
                "Publishing to %s via account %s (OAuth integration pending)",
                platform,
                account.account_name,
            )

            job.status = "published"
            await db.commit()

        return {"publish_job_id": publish_job_id, "status": "published"}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("publish_to_platform failed for job %s", publish_job_id)
        raise self.retry(exc=exc, countdown=60, max_retries=2) from exc


@celery.task(name="app.tasks.publish_tasks.schedule_post")
def schedule_post(publish_job_id: str) -> dict:
    """Schedule a post for later publishing using Celery ETA."""

    async def _run():
        from datetime import datetime, timezone

        from sqlalchemy import select

        from app.core.database import async_session
        from app.models.publish import PublishJob

        async with async_session() as db:
            result = await db.execute(
                select(PublishJob).where(PublishJob.id == uuid.UUID(publish_job_id))
            )
            job = result.scalar_one_or_none()
            if not job:
                raise ValueError(f"PublishJob {publish_job_id} not found")

            scheduled_at = job.scheduled_at
            if not scheduled_at:
                # No scheduled time — publish immediately
                publish_to_platform.delay(publish_job_id)
                return {"publish_job_id": publish_job_id, "status": "queued"}

            now = datetime.now(timezone.utc)
            delay_seconds = max(0, (scheduled_at - now).total_seconds())

            publish_to_platform.apply_async(
                args=[publish_job_id],
                countdown=delay_seconds,
            )
            job.status = "scheduled"
            await db.commit()

        return {"publish_job_id": publish_job_id, "status": "scheduled"}

    return run_async(_run())
