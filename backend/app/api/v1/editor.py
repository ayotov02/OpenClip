import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.editor import (
    ExportRequest,
    ExportResponse,
    SaveTimelineRequest,
    SaveTimelineResponse,
)
from app.services import job_service, project_service

router = APIRouter(prefix="/editor", tags=["editor"])


@router.post("/projects/{project_id}/timeline", response_model=SaveTimelineResponse)
async def save_timeline(
    project_id: uuid.UUID,
    body: SaveTimelineRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    # Store timeline state in project settings
    project.settings = {
        **(project.settings or {}),
        "timeline": body.timeline.model_dump(),
    }
    await db.commit()

    return SaveTimelineResponse(project_id=project_id, message="Timeline saved")


@router.get("/projects/{project_id}/timeline")
async def get_timeline(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    timeline = (project.settings or {}).get("timeline")
    return {"project_id": str(project_id), "timeline": timeline}


@router.post("/projects/{project_id}/export", response_model=ExportResponse, status_code=202)
async def export_video(
    project_id: uuid.UUID,
    body: ExportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    from app.tasks.video_tasks import render_export

    task = render_export.delay(
        str(project_id),
        body.format,
        body.quality,
        body.aspect_ratio,
        body.include_subtitles,
    )

    job = await job_service.create_job(
        db,
        user_id=user.id,
        job_type="video_export",
        celery_task_id=task.id,
        metadata={
            "project_id": str(project_id),
            "format": body.format,
            "quality": body.quality,
        },
    )

    return ExportResponse(
        project_id=project_id,
        job_id=job.id,
        message="Export started",
    )
