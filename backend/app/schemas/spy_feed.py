import uuid
from datetime import datetime

from pydantic import BaseModel


class ScrapedPostResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    competitor_id: uuid.UUID | None
    platform: str
    post_url: str
    post_type: str
    caption: str | None
    hashtags: list | None
    mentions: list | None
    media_url: str | None
    thumbnail_url: str | None
    likes: int
    views: int
    comments_count: int
    shares: int
    saves: int
    engagement_rate: float
    author_handle: str | None
    followers_at_scrape: int
    posted_at: datetime | None
    scraped_at: datetime
    hook_score: float | None
    body_score: float | None
    cta_score: float | None
    extracted_hook: str | None
    extracted_cta: str | None
    transcript: str | None
    content_category: str | None
    sentiment: str | None
    sentiment_confidence: float | None
    niche_relevance: float | None
    ai_analysis: dict | None
    analyzed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SpyFeedQuery(BaseModel):
    platform: str | None = None
    min_hook_score: float | None = None
    sort_by: str = "scraped_at"
    limit: int = 50
    offset: int = 0


class AnalyzePostRequest(BaseModel):
    brand_context_id: uuid.UUID | None = None


class GenerateScriptRequest(BaseModel):
    brand_context_id: uuid.UUID


class PaginatedSpyFeed(BaseModel):
    items: list[ScrapedPostResponse]
    total: int
    limit: int
    offset: int
