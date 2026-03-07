import uuid
from datetime import datetime

from pydantic import BaseModel


class FacelessProjectCreate(BaseModel):
    title: str
    topic: str
    template: str = "educational"
    tts_voice: str = ""
    music_mood: str | None = None
    aspect_ratio: str = "9:16"
    settings: dict = {}


class FacelessProjectUpdate(BaseModel):
    title: str | None = None
    topic: str | None = None
    template: str | None = None
    tts_voice: str | None = None
    music_mood: str | None = None
    script: dict | None = None
    settings: dict | None = None


class FacelessSceneResponse(BaseModel):
    id: uuid.UUID
    order: int
    narration: str
    duration_est: float
    search_keywords: list
    mood: str
    visual_description: str
    broll_results: list | None
    audio_file: str | None
    video_file: str | None

    model_config = {"from_attributes": True}


class FacelessProjectResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    topic: str
    template: str
    tts_voice: str
    music_mood: str | None
    script: dict | None
    output_file: str | None
    thumbnail: str | None
    duration: float | None
    aspect_ratio: str
    status: str
    settings: dict
    scenes: list[FacelessSceneResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
