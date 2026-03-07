import uuid
from datetime import datetime

from pydantic import BaseModel


class CompetitorCreate(BaseModel):
    platform: str
    handle: str
    display_name: str | None = None


class CompetitorResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    handle: str
    display_name: str | None
    profile_data: dict | None
    last_scraped: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompetitorMetricResponse(BaseModel):
    id: uuid.UUID
    competitor_id: uuid.UUID
    timestamp: datetime
    followers: int
    engagement_rate: float
    avg_views: int
    posts_count: int
    trending_hashtags: list | None

    model_config = {"from_attributes": True}
