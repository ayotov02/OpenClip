from app.tasks.celery_app import celery


@celery.task(name="app.tasks.batch_tasks.process_batch")
def process_batch(batch_job_id: str) -> dict:
    """Orchestrate batch processing of multiple items."""
    # TODO: iterate items and dispatch sub-tasks
    return {"batch_job_id": batch_job_id, "status": "completed"}


@celery.task(name="app.tasks.batch_tasks.process_batch_item")
def process_batch_item(batch_item_id: str) -> dict:
    """Process a single batch item."""
    # TODO: process based on batch job type
    return {"batch_item_id": batch_item_id, "status": "completed"}
