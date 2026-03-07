import uuid
from datetime import datetime

from pydantic import BaseModel


class ClipCreate(BaseModel):
    start_time: float
    end_time: float
    title: str = ""
    aspect_ratio: str = "9:16"
    brand_kit_id: uuid.UUID | None = None


class ClipUpdate(BaseModel):
    title: str | None = None
    transcript: str | None = None
    caption_srt: str | None = None
    aspect_ratio: str | None = None
    brand_kit_id: uuid.UUID | None = None


class ClipResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    start_time: float
    end_time: float
    duration: float
    virality_score: int
    score_breakdown: dict | None
    transcript: str | None
    output_file: str | None
    thumbnail: str | None
    aspect_ratio: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ClipGenerateRequest(BaseModel):
    max_clips: int = 10
    min_duration: float = 15.0
    max_duration: float = 90.0
    aspect_ratio: str = "9:16"
    brand_kit_id: uuid.UUID | None = None
