import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


async def create_project(
    db: AsyncSession, user_id: uuid.UUID, data: ProjectCreate
) -> Project:
    project = Project(user_id=user_id, **data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_projects(
    db: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 20
) -> tuple[list[Project], int]:
    count_result = await db.execute(
        select(func.count()).select_from(Project).where(Project.user_id == user_id)
    )
    total = count_result.scalar() or 0
    result = await db.execute(
        select(Project)
        .where(Project.user_id == user_id)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_project(
    db: AsyncSession, project_id: uuid.UUID
) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def update_project(
    db: AsyncSession, project_id: uuid.UUID, data: ProjectUpdate
) -> Project | None:
    project = await get_project(db, project_id)
    if not project:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project_id: uuid.UUID) -> bool:
    project = await get_project(db, project_id)
    if not project:
        return False
    await db.delete(project)
    await db.commit()
    return True
