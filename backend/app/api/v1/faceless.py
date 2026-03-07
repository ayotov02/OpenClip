import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.faceless import (
    FacelessProjectCreate,
    FacelessProjectResponse,
    FacelessProjectUpdate,
)
from app.services import faceless_service as svc

router = APIRouter(prefix="/faceless", tags=["faceless"])


@router.post("", response_model=FacelessProjectResponse, status_code=201)
async def create(
    data: FacelessProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.create_faceless_project(db, user.id, data)


@router.get("", response_model=list[FacelessProjectResponse])
async def list_projects(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_faceless_projects(db, user.id)


@router.get("/{project_id}", response_model=FacelessProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await svc.get_faceless_project(db, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Faceless project not found")
    return project


@router.put("/{project_id}", response_model=FacelessProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    data: FacelessProjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await svc.get_faceless_project(db, project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Faceless project not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    project = await svc.update_faceless_project(db, project_id, data)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await svc.get_faceless_project(db, project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Faceless project not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await svc.delete_faceless_project(db, project_id)


@router.post("/{project_id}/generate", status_code=202)
async def generate(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await svc.get_faceless_project(db, project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Faceless project not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.services import job_service
    from app.tasks.faceless_tasks import orchestrate_pipeline

    task = orchestrate_pipeline.delay(str(project_id))

    job = await job_service.create_job(
        db,
        user_id=user.id,
        job_type="faceless_generation",
        celery_task_id=task.id,
        metadata={"project_id": str(project_id)},
    )

    return {
        "message": "Faceless generation started",
        "project_id": str(project_id),
        "job_id": str(job.id),
    }
