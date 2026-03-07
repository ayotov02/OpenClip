import uuid
from datetime import datetime

from pydantic import BaseModel


class PublishJobCreate(BaseModel):
    clip_id: uuid.UUID | None = None
    platform: str
    social_account_id: uuid.UUID | None = None
    title: str = ""
    description: str | None = None
    hashtags: list[str] = []
    scheduled_at: datetime | None = None
    metadata: dict = {}


class PublishJobUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None
    scheduled_at: datetime | None = None
    status: str | None = None


class PublishJobResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    clip_id: uuid.UUID | None
    platform: str
    title: str
    description: str | None
    hashtags: list
    scheduled_at: datetime | None
    published_at: datetime | None
    platform_post_id: str | None
    status: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
