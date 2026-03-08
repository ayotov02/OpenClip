import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.spy_feed import (
    AnalyzePostRequest,
    GenerateScriptRequest,
    PaginatedSpyFeed,
    ScrapedPostResponse,
)
from app.services import spy_service as svc
from app.services import competitor_service, job_service

router = APIRouter(prefix="/spy-feed", tags=["spy-feed"])


@router.get("", response_model=PaginatedSpyFeed)
async def get_feed(
    platform: str | None = Query(None),
    min_hook_score: float | None = Query(None),
    sort_by: str = Query("scraped_at"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await svc.get_spy_feed(
        db, user.id, platform=platform, min_hook_score=min_hook_score,
        sort_by=sort_by, limit=limit, offset=offset,
    )
    total = await svc.get_spy_feed_count(db, user.id, platform=platform)
    return PaginatedSpyFeed(items=items, total=total, limit=limit, offset=offset)


@router.get("/{post_id}", response_model=ScrapedPostResponse)
async def get_post(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await svc.get_scraped_post(db, post_id)
    if not post or post.user_id != user.id:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/{post_id}/analyze", status_code=202)
async def analyze_post(
    post_id: uuid.UUID,
    body: AnalyzePostRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await svc.get_scraped_post(db, post_id)
    if not post or post.user_id != user.id:
        raise HTTPException(status_code=404, detail="Post not found")

    from app.tasks.spy_tasks import analyze_post as analyze_task

    task = analyze_task.delay(
        str(post_id),
        str(body.brand_context_id) if body.brand_context_id else None,
    )
    job = await job_service.create_job(
        db, user_id=user.id, job_type="post_analysis",
        celery_task_id=task.id, metadata={"post_id": str(post_id)},
    )
    return {"message": "Analysis started", "post_id": str(post_id), "job_id": str(job.id)}


@router.post("/{post_id}/script", status_code=202)
async def generate_script(
    post_id: uuid.UUID,
    body: GenerateScriptRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await svc.get_scraped_post(db, post_id)
    if not post or post.user_id != user.id:
        raise HTTPException(status_code=404, detail="Post not found")

    from app.tasks.spy_tasks import generate_similar_script

    task = generate_similar_script.delay(str(post_id), str(body.brand_context_id))
    job = await job_service.create_job(
        db, user_id=user.id, job_type="script_generation",
        celery_task_id=task.id, metadata={"post_id": str(post_id)},
    )
    return {"message": "Script generation started", "post_id": str(post_id), "job_id": str(job.id)}


@router.post("/competitors/{comp_id}/scrape-posts", status_code=202)
async def scrape_competitor_posts(
    comp_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    competitor = await competitor_service.get_competitor(db, comp_id)
    if not competitor or competitor.user_id != user.id:
        raise HTTPException(status_code=404, detail="Competitor not found")

    from app.tasks.spy_tasks import scrape_competitor_posts as scrape_task

    task = scrape_task.delay(str(comp_id), str(user.id))
    job = await job_service.create_job(
        db, user_id=user.id, job_type="competitor_posts_scrape",
        celery_task_id=task.id, metadata={"competitor_id": str(comp_id)},
    )
    return {"message": "Scrape started", "competitor_id": str(comp_id), "job_id": str(job.id)}
