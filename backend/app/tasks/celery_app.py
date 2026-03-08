import asyncio

from celery import Celery
from celery.signals import worker_process_init

from app.core.config import settings

celery = Celery(
    "openclip",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_routes={
        "app.tasks.video_tasks.*": {"queue": "video"},
        "app.tasks.ai_tasks.*": {"queue": "ai"},
        "app.tasks.faceless_tasks.*": {"queue": "video"},
        "app.tasks.publish_tasks.*": {"queue": "publish"},
        "app.tasks.scrape_tasks.*": {"queue": "scrape"},
        "app.tasks.spy_tasks.*": {"queue": "scrape"},
        "app.tasks.discovery_tasks.*": {"queue": "scrape"},
        "app.tasks.batch_tasks.*": {"queue": "default"},
    },
    task_default_queue="default",
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=1800,
    task_soft_time_limit=1500,
)


@worker_process_init.connect
def dispose_db_pool_after_fork(**kwargs):
    """Dispose inherited SQLAlchemy connection pool after Celery prefork.

    When Celery forks worker processes, the child inherits the parent's
    DB connection pool. These connections are invalid in the child and
    will cause errors. Disposing forces fresh connections per worker.
    """
    from app.core.database import engine

    asyncio.run(engine.dispose())
