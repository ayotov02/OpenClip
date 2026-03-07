import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarEvent
from app.schemas.calendar import CalendarEventCreate, CalendarEventUpdate


async def create_event(
    db: AsyncSession, user_id: uuid.UUID, data: CalendarEventCreate
) -> CalendarEvent:
    event = CalendarEvent(
        user_id=user_id,
        title=data.title,
        description=data.description,
        clip_id=data.clip_id,
        platforms=data.platforms,
        scheduled_at=data.scheduled_at,
        metadata_=data.metadata,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_events(db: AsyncSession, user_id: uuid.UUID) -> list[CalendarEvent]:
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user_id)
        .order_by(CalendarEvent.scheduled_at)
    )
    return list(result.scalars().all())


async def update_event(
    db: AsyncSession, event_id: uuid.UUID, data: CalendarEventUpdate
) -> CalendarEvent | None:
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "metadata" in update_data:
        update_data["metadata_"] = update_data.pop("metadata")
    for key, value in update_data.items():
        setattr(event, key, value)
    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, event_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        return False
    await db.delete(event)
    await db.commit()
    return True
