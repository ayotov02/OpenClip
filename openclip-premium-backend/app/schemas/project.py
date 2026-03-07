import uuid
from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    title: str
    source_type: str = "upload"  # upload, url, text
    source_url: str | None = None
    language: str = "en"
    settings: dict = {}


class ProjectUpdate(BaseModel):
    title: str | None = None
    settings: dict | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    source_type: str
    source_url: str | None
    source_file: str | None
    duration: float | None
    language: str
    status: str
    clip_count: int
    settings: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
