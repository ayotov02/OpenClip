import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clip import Clip
from app.schemas.clip import ClipUpdate


async def get_clips_for_project(
    db: AsyncSession, project_id: uuid.UUID
) -> list[Clip]:
    result = await db.execute(
        select(Clip)
        .where(Clip.project_id == project_id)
        .order_by(Clip.virality_score.desc())
    )
    return list(result.scalars().all())


async def get_clip(db: AsyncSession, clip_id: uuid.UUID) -> Clip | None:
    result = await db.execute(select(Clip).where(Clip.id == clip_id))
    return result.scalar_one_or_none()


async def create_clip(
    db: AsyncSession,
    project_id: uuid.UUID,
    start_time: float,
    end_time: float,
    title: str = "",
    virality_score: int = 0,
    score_breakdown: dict | None = None,
    transcript: str | None = None,
    aspect_ratio: str = "9:16",
) -> Clip:
    clip = Clip(
        project_id=project_id,
        start_time=start_time,
        end_time=end_time,
        duration=end_time - start_time,
        title=title,
        virality_score=virality_score,
        score_breakdown=score_breakdown,
        transcript=transcript,
        aspect_ratio=aspect_ratio,
    )
    db.add(clip)
    await db.commit()
    await db.refresh(clip)
    return clip


async def update_clip(
    db: AsyncSession, clip_id: uuid.UUID, data: ClipUpdate
) -> Clip | None:
    clip = await get_clip(db, clip_id)
    if not clip:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(clip, key, value)
    await db.commit()
    await db.refresh(clip)
    return clip


async def delete_clip(db: AsyncSession, clip_id: uuid.UUID) -> bool:
    clip = await get_clip(db, clip_id)
    if not clip:
        return False
    await db.delete(clip)
    await db.commit()
    return True
