import uuid
from datetime import datetime

from pydantic import BaseModel


class BrandContextCreate(BaseModel):
    brand_name: str
    niche: str
    custom_niche: str | None = None
    voice_traits: list[str] = []
    target_audience: str = ""
    goals: list[str] = []
    platforms: list[str] = []
    posting_frequency: str = ""
    uniqueness: str = ""
    competitors: list[dict] = []
    intelligence_config: dict = {}


class BrandContextUpdate(BaseModel):
    brand_name: str | None = None
    niche: str | None = None
    custom_niche: str | None = None
    voice_traits: list[str] | None = None
    target_audience: str | None = None
    goals: list[str] | None = None
    platforms: list[str] | None = None
    posting_frequency: str | None = None
    uniqueness: str | None = None
    competitors: list[dict] | None = None
    intelligence_config: dict | None = None
    is_active: bool | None = None


class BrandContextResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    brand_name: str
    niche: str
    custom_niche: str | None
    voice_traits: list[str]
    target_audience: str
    goals: list[str]
    platforms: list[str]
    posting_frequency: str
    uniqueness: str
    competitors: list[dict]
    intelligence_config: dict
    ai_summary: str | None
    tone_keywords: list[str]
    content_pillars: list[dict]
    posting_schedule: dict
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
