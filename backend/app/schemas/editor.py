import uuid

from pydantic import BaseModel


class TimelineState(BaseModel):
    tracks: list[dict]
    captions: list[dict]
    duration: float
    aspect_ratio: str = "9:16"


class SaveTimelineRequest(BaseModel):
    timeline: TimelineState


class SaveTimelineResponse(BaseModel):
    project_id: uuid.UUID
    message: str


class ExportRequest(BaseModel):
    format: str = "mp4"
    quality: str = "hd"
    platform: str | None = None
    include_subtitles: bool = True
    aspect_ratio: str = "9:16"


class ExportResponse(BaseModel):
    project_id: uuid.UUID
    job_id: uuid.UUID
    message: str
