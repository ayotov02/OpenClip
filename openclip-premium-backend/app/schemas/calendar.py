import uuid
from datetime import datetime

from pydantic import BaseModel


class CalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    clip_id: uuid.UUID | None = None
    platforms: list[str] = []
    scheduled_at: datetime
    metadata: dict = {}


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    clip_id: uuid.UUID | None = None
    platforms: list[str] | None = None
    scheduled_at: datetime | None = None
    status: str | None = None
    metadata: dict | None = None


class CalendarEventResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    clip_id: uuid.UUID | None
    platforms: list
    scheduled_at: datetime
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
