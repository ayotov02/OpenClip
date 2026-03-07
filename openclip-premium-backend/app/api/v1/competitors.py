import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.competitor import CompetitorCreate, CompetitorMetricResponse, CompetitorResponse
from app.services import competitor_service as svc
from app.services import job_service

router = APIRouter(prefix="/competitors", tags=["competitors"])


@router.post("", response_model=CompetitorResponse, status_code=201)
async def add(
    data: CompetitorCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.add_competitor(db, user.id, data)


@router.get("", response_model=list[CompetitorResponse])
async def list_competitors(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_competitors(db, user.id)


@router.delete("/{comp_id}", status_code=204)
async def delete(
    comp_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.delete_competitor(db, comp_id):
        raise HTTPException(status_code=404, detail="Competitor not found")


@router.get("/{comp_id}/metrics", response_model=list[CompetitorMetricResponse])
async def metrics(
    comp_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_metrics(db, comp_id)


@router.post("/{comp_id}/scrape", status_code=202)
async def scrape(
    comp_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    competitor = await svc.get_competitor(db, comp_id)
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    if competitor.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.tasks.scrape_tasks import scrape_profile

    task = scrape_profile.delay(str(comp_id))

    job = await job_service.create_job(
        db,
        user_id=user.id,
        job_type="competitor_scrape",
        celery_task_id=task.id,
        metadata={"competitor_id": str(comp_id)},
    )

    return {
        "message": "Scrape started",
        "competitor_id": str(comp_id),
        "job_id": str(job.id),
    }
