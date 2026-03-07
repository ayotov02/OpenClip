import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faceless import FacelessProject, FacelessScene
from app.schemas.faceless import FacelessProjectCreate, FacelessProjectUpdate


async def create_faceless_project(
    db: AsyncSession, user_id: uuid.UUID, data: FacelessProjectCreate
) -> FacelessProject:
    project = FacelessProject(user_id=user_id, **data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_faceless_projects(
    db: AsyncSession, user_id: uuid.UUID
) -> list[FacelessProject]:
    result = await db.execute(
        select(FacelessProject)
        .where(FacelessProject.user_id == user_id)
        .order_by(FacelessProject.created_at.desc())
    )
    return list(result.scalars().all())


async def get_faceless_project(
    db: AsyncSession, project_id: uuid.UUID
) -> FacelessProject | None:
    result = await db.execute(
        select(FacelessProject).where(FacelessProject.id == project_id)
    )
    return result.scalar_one_or_none()


async def update_faceless_project(
    db: AsyncSession, project_id: uuid.UUID, data: FacelessProjectUpdate
) -> FacelessProject | None:
    project = await get_faceless_project(db, project_id)
    if not project:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_faceless_project(
    db: AsyncSession, project_id: uuid.UUID
) -> bool:
    project = await get_faceless_project(db, project_id)
    if not project:
        return False
    await db.delete(project)
    await db.commit()
    return True


async def add_scene(
    db: AsyncSession,
    project_id: uuid.UUID,
    order: int,
    narration: str,
    duration_est: float = 5.0,
    search_keywords: list | None = None,
    mood: str = "neutral",
    visual_description: str = "",
) -> FacelessScene:
    scene = FacelessScene(
        project_id=project_id,
        order=order,
        narration=narration,
        duration_est=duration_est,
        search_keywords=search_keywords or [],
        mood=mood,
        visual_description=visual_description,
    )
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene
