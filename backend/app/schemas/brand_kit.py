import uuid
from datetime import datetime

from pydantic import BaseModel


class BrandKitCreate(BaseModel):
    name: str
    logo_url: str | None = None
    colors: dict = {}
    fonts: dict = {}
    intro_url: str | None = None
    outro_url: str | None = None
    watermark_url: str | None = None
    caption_style: dict = {}
    config: dict = {}


class BrandKitUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    colors: dict | None = None
    fonts: dict | None = None
    intro_url: str | None = None
    outro_url: str | None = None
    watermark_url: str | None = None
    caption_style: dict | None = None
    config: dict | None = None


class BrandKitResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    logo_url: str | None
    colors: dict
    fonts: dict
    intro_url: str | None
    outro_url: str | None
    watermark_url: str | None
    caption_style: dict
    config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
