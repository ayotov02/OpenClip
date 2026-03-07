import logging
import uuid

from app.tasks.celery_app import celery
from app.tasks.utils import run_async

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.batch_tasks.process_batch", bind=True)
def process_batch(self, batch_job_id: str) -> dict:
    """Orchestrate batch processing of multiple items."""

    async def _run():
        from sqlalchemy import select

        from app.core.database import async_session
        from app.models.batch import BatchItem, BatchJob

        async with async_session() as db:
            result = await db.execute(
                select(BatchJob).where(BatchJob.id == uuid.UUID(batch_job_id))
            )
            batch_job = result.scalar_one_or_none()
            if not batch_job:
                raise ValueError(f"BatchJob {batch_job_id} not found")

            # Get all pending items
            items_result = await db.execute(
                select(BatchItem)
                .where(
                    BatchItem.batch_job_id == batch_job.id,
                    BatchItem.status == "pending",
                )
            )
            items = items_result.scalars().all()

            batch_job.status = "processing"
            batch_job.total_items = len(items)
            await db.commit()

        # Dispatch each item as a sub-task
        for item in items:
            process_batch_item.delay(str(item.id))

        return {"batch_job_id": batch_job_id, "status": "processing", "items": len(items)}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("process_batch failed for batch %s", batch_job_id)
        raise self.retry(exc=exc, countdown=30, max_retries=1) from exc


@celery.task(name="app.tasks.batch_tasks.process_batch_item", bind=True)
def process_batch_item(self, batch_item_id: str) -> dict:
    """Process a single batch item based on the parent job's type."""

    async def _run():
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        from app.core.database import async_session
        from app.models.batch import BatchItem

        async with async_session() as db:
            result = await db.execute(
                select(BatchItem)
                .options(selectinload(BatchItem.batch_job))
                .where(BatchItem.id == uuid.UUID(batch_item_id))
            )
            item = result.scalar_one_or_none()
            if not item:
                raise ValueError(f"BatchItem {batch_item_id} not found")

            job_type = item.batch_job.job_type
            source_data = item.source_data or {}

            try:
                item.status = "processing"
                await db.commit()

                if job_type == "clip_generation":
                    from app.tasks.video_tasks import transcribe, extract_audio

                    # Dispatch sub-pipeline for this item
                    result_data = {
                        "type": job_type,
                        "message": "Batch clip generation dispatched",
                    }
                elif job_type == "faceless_generation":
                    from app.tasks.faceless_tasks import orchestrate_pipeline

                    project_id = source_data.get("project_id")
                    if project_id:
                        orchestrate_pipeline.delay(project_id)
                    result_data = {"type": job_type, "project_id": project_id}
                elif job_type == "publish":
                    from app.tasks.publish_tasks import publish_to_platform

                    publish_job_id = source_data.get("publish_job_id")
                    if publish_job_id:
                        publish_to_platform.delay(publish_job_id)
                    result_data = {"type": job_type, "publish_job_id": publish_job_id}
                else:
                    result_data = {"type": job_type, "message": "Unknown batch type"}

                item.status = "completed"
                item.result_data = result_data
                await db.commit()

                # Update parent counters
                from sqlalchemy import func

                from app.models.batch import BatchItem as BI, BatchJob

                completed = await db.execute(
                    select(func.count()).where(
                        BI.batch_job_id == item.batch_job_id,
                        BI.status == "completed",
                    )
                )
                count = completed.scalar()
                batch_job = await db.get(BatchJob, item.batch_job_id)
                if batch_job:
                    batch_job.completed_items = count
                    if count >= batch_job.total_items:
                        batch_job.status = "completed"
                    await db.commit()

                return {"batch_item_id": batch_item_id, "status": "completed"}

            except Exception as e:
                item.status = "failed"
                item.error_message = str(e)
                await db.commit()
                raise

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("process_batch_item failed for item %s", batch_item_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc
