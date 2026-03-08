import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.discovery import (
    CreateFromDiscoveryRequest,
    DiscoverRequest,
    DiscoveryResultResponse,
    PaginatedDiscoveryResults,
)
from app.services import discovery_service as svc
from app.services import job_service

router = APIRouter(prefix="/discover", tags=["discover"])


@router.post("", status_code=202)
async def start_discovery(
    body: DiscoverRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.tasks.discovery_tasks import discover_niche

    task = discover_niche.delay(str(user.id), body.query, body.platforms)
    job = await job_service.create_job(
        db, user_id=user.id, job_type="niche_discovery",
        celery_task_id=task.id, metadata={"query": body.query},
    )
    return {"message": "Discovery started", "query": body.query, "job_id": str(job.id)}


@router.get("/results", response_model=PaginatedDiscoveryResults)
async def get_results(
    query: str | None = Query(None),
    platform: str | None = Query(None),
    post_type: str | None = Query(None),
    min_engagement: int | None = Query(None),
    sort_by: str = Query("searched_at"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await svc.get_discovery_results(
        db, user.id, query_str=query, platform=platform, post_type=post_type,
        min_engagement=min_engagement, sort_by=sort_by, limit=limit, offset=offset,
    )
    total = await svc.get_discovery_results_count(db, user.id, query_str=query)
    return PaginatedDiscoveryResults(items=items, total=total, limit=limit, offset=offset)


@router.get("/results/{result_id}", response_model=DiscoveryResultResponse)
async def get_result(
    result_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result_obj = await svc.get_discovery_result(db, result_id)
    if not result_obj or result_obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Result not found")
    return result_obj


@router.post("/results/{result_id}/analyze", status_code=202)
async def analyze_result(
    result_id: uuid.UUID,
    brand_context_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result_obj = await svc.get_discovery_result(db, result_id)
    if not result_obj or result_obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Result not found")

    from app.tasks.discovery_tasks import analyze_discovery

    task = analyze_discovery.delay(
        str(result_id),
        str(brand_context_id) if brand_context_id else None,
    )
    job = await job_service.create_job(
        db, user_id=user.id, job_type="discovery_analysis",
        celery_task_id=task.id, metadata={"result_id": str(result_id)},
    )
    return {"message": "Analysis started", "result_id": str(result_id), "job_id": str(job.id)}


@router.post("/results/{result_id}/create", status_code=201)
async def create_from_discovery(
    result_id: uuid.UUID,
    body: CreateFromDiscoveryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result_obj = await svc.get_discovery_result(db, result_id)
    if not result_obj or result_obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Result not found")

    from app.schemas.project import ProjectCreate
    from app.services import project_service

    project_data = ProjectCreate(
        title=body.title or result_obj.title or f"From: {result_obj.query}",
        source_type="url",
        source_url=result_obj.post_url,
    )
    project = await project_service.create_project(db, user.id, project_data)
    return {"message": "Project created", "project_id": str(project.id)}


@router.get("/trending")
async def get_trending(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recent_queries = await svc.get_recent_queries(db, user.id, limit=20)
    return {"recent_queries": recent_queries}
