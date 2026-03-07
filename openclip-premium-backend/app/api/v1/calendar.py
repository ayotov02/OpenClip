import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.calendar import CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate
from app.services import calendar_service as svc

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=list[CalendarEventResponse])
async def list_events(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.get_events(db, user.id)


@router.post("/events", response_model=CalendarEventResponse, status_code=201)
async def create_event(
    data: CalendarEventCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await svc.create_event(db, user.id, data)


@router.put("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: uuid.UUID,
    data: CalendarEventUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await svc.update_event(db, event_id, data)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await svc.delete_event(db, event_id):
        raise HTTPException(status_code=404, detail="Event not found")
