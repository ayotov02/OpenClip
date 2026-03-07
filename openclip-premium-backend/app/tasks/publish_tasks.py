from app.tasks.celery_app import celery


@celery.task(name="app.tasks.publish_tasks.publish_to_platform")
def publish_to_platform(publish_job_id: str) -> dict:
    """Publish clip to social media platform."""
    # TODO: implement platform-specific publishing
    return {"publish_job_id": publish_job_id, "status": "published"}


@celery.task(name="app.tasks.publish_tasks.schedule_post")
def schedule_post(publish_job_id: str) -> dict:
    """Schedule a post for later publishing."""
    # TODO: implement scheduling with countdown
    return {"publish_job_id": publish_job_id, "status": "scheduled"}
