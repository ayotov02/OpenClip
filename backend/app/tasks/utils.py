"""Utilities for running async provider code inside synchronous Celery tasks."""

import asyncio
import logging
import uuid
from typing import TypeVar

T = TypeVar("T")

logger = logging.getLogger(__name__)


def run_async(coro):
    """Run an async coroutine from a synchronous Celery task.

    Celery prefork workers have no running event loop, so asyncio.run()
    is always correct here. The previous ThreadPoolExecutor fallback was
    unnecessary and could mask errors.
    """
    return asyncio.run(coro)


async def load_brand_context(brand_context_id: str):
    """Load a BrandContext from the database by ID."""
    from app.brand.context import get_brand_context_by_id
    from app.core.database import async_session

    async with async_session() as db:
        ctx = await get_brand_context_by_id(db, uuid.UUID(brand_context_id))
        if ctx is None:
            raise ValueError(f"BrandContext {brand_context_id} not found")
        return ctx


async def update_job_status(
    job_id: str, status: str, progress: float = 0.0, result: dict | None = None, error: str | None = None
):
    """Update a Job record in the database."""
    from sqlalchemy import update

    from app.core.database import async_session
    from app.models.job import Job

    async with async_session() as db:
        values: dict = {"status": status, "progress": progress}
        if result is not None:
            values["result"] = result
        if error is not None:
            values["error_message"] = error
        await db.execute(
            update(Job).where(Job.id == uuid.UUID(job_id)).values(**values)
        )
        await db.commit()
