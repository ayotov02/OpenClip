import uuid
from datetime import datetime

from pydantic import BaseModel


# --- Hashtag ---
class HashtagCreate(BaseModel):
    tag: str
    platform: str


class HashtagResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    tag: str
    platform: str
    trend_score: float
    volume: int
    engagement: float
    first_seen: datetime
    last_updated: datetime

    model_config = {"from_attributes": True}


# --- Trending Topic ---
class TrendingTopicResponse(BaseModel):
    id: uuid.UUID
    topic: str
    description: str | None
    relevance_score: float
    platforms: list
    mention_count: int
    sentiment: dict | None
    first_seen: datetime
    last_seen: datetime

    model_config = {"from_attributes": True}


# --- Batch ---
class BatchJobCreate(BaseModel):
    job_type: str
    settings: dict = {}


class BatchJobResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    job_type: str
    total_items: int
    completed_items: int
    failed_items: int
    status: str
    settings: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BatchItemResponse(BaseModel):
    id: uuid.UUID
    batch_job_id: uuid.UUID
    source_data: dict
    result_data: dict | None
    status: str
    error_message: str | None

    model_config = {"from_attributes": True}


# --- Creative Asset ---
class CreativeAssetResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    asset_type: str
    title: str
    file_url: str
    file_size: int | None
    mime_type: str | None
    prompt: str | None
    provider: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Job ---
class JobResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    job_type: str
    status: str
    progress: float
    result: dict | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Settings ---
class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    last_used: datetime | None
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(ApiKeyResponse):
    key: str  # Only returned on creation


class WebhookConfigCreate(BaseModel):
    url: str
    events: list[str] = []


class WebhookConfigUpdate(BaseModel):
    url: str | None = None
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookConfigResponse(BaseModel):
    id: uuid.UUID
    url: str
    events: list
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SocialAccountCreate(BaseModel):
    platform: str
    account_name: str
    oauth_token: str
    oauth_refresh_token: str | None = None


class SocialAccountResponse(BaseModel):
    id: uuid.UUID
    platform: str
    account_name: str
    account_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Chat ---
class ChatMessage(BaseModel):
    role: str  # user, assistant
    content: str


class ChatRequest(BaseModel):
    mode: str  # create, generate, compose, research
    messages: list[ChatMessage]
    brand_context_id: uuid.UUID | None = None


class ChatResponse(BaseModel):
    response: str
    metadata: dict = {}
