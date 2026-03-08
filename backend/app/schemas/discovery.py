import uuid
from datetime import datetime

from pydantic import BaseModel


class DiscoveryResultResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    query: str
    platform: str
    post_url: str
    post_type: str
    title: str | None
    description: str | None
    caption: str | None
    media_url: str | None
    thumbnail_url: str | None
    author_handle: str | None
    author_followers: int
    likes: int
    views: int
    comments_count: int
    shares: int
    engagement_rate: float
    posted_at: datetime | None
    searched_at: datetime
    hook_score: float | None
    body_score: float | None
    cta_score: float | None
    extracted_hook: str | None
    extracted_cta: str | None
    transcript: str | None
    content_category: str | None
    sentiment: str | None
    niche_relevance: float | None
    ai_analysis: dict | None
    analyzed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DiscoverRequest(BaseModel):
    query: str
    platforms: list[str] | None = None


class DiscoveryQuery(BaseModel):
    query: str | None = None
    platform: str | None = None
    post_type: str | None = None
    min_engagement: int | None = None
    sort_by: str = "searched_at"
    limit: int = 50
    offset: int = 0


class CreateFromDiscoveryRequest(BaseModel):
    title: str | None = None


class PaginatedDiscoveryResults(BaseModel):
    items: list[DiscoveryResultResponse]
    total: int
    limit: int
    offset: int
