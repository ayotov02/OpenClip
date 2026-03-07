# Webhook System — Implementation Guide

## Overview
- **What:** Allow users to register webhook URLs that receive POST notifications on events (job.completed, video.published, batch.completed, etc.) with HMAC signature verification and retry logic.
- **Why:** Webhooks enable automation — users can trigger downstream workflows when videos finish processing or get published.
- **Dependencies:** Phase 1 Feature 2 (FastAPI Backend), Phase 1 Feature 3 (Job Queue)

## Architecture

### Webhook Flow
```
Event occurs (e.g., job completed) → Webhook dispatcher
  → For each registered webhook matching event type:
    → Build payload (JSON) → Sign with HMAC-SHA256
    → POST to user's URL → Record delivery status
    → On failure: retry with exponential backoff (1s, 5s, 30s, 5min)
    → After 4 failures: mark webhook as failing, notify user
```

### Data Model
```sql
Webhook
  - id: UUID (PK)
  - user_id: FK(User)
  - url: string (HTTPS required)
  - secret: string (auto-generated, for HMAC signing)
  - events: string[] (e.g., ["job.completed", "video.published"])
  - is_active: boolean
  - failure_count: int
  - created_at: timestamp

WebhookDelivery
  - id: UUID (PK)
  - webhook_id: FK(Webhook)
  - event_type: string
  - payload: JSON
  - status_code: int?
  - response_body: text? (first 500 chars)
  - attempts: int
  - delivered_at: timestamp?
  - next_retry_at: timestamp?
  - status: enum(pending, delivered, failed)
```

### Event Types
```
job.completed       → When any job finishes (clip, faceless, reframe, etc.)
job.failed          → When a job fails after all retries
video.published     → When a video is published to a social platform
batch.completed     → When a batch processing run finishes
clip.generated      → When a single clip is generated
```

## Step-by-Step Implementation

### Step 1: Create Webhook Models
```python
from sqlalchemy import String, Integer, Boolean, JSON, ARRAY, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel

class Webhook(BaseModel):
    __tablename__ = "webhooks"
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    url: Mapped[str] = mapped_column(String(2048))
    secret: Mapped[str] = mapped_column(String(64))  # HMAC signing secret
    events: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)

class WebhookDelivery(BaseModel):
    __tablename__ = "webhook_deliveries"
    webhook_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("webhooks.id"))
    event_type: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSON)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
```

### Step 2: Create Webhook Dispatcher
```python
import hashlib
import hmac
import json
import secrets

import httpx
import structlog

logger = structlog.get_logger()

class WebhookDispatcher:
    RETRY_DELAYS = [1, 5, 30, 300]  # seconds

    def sign_payload(self, payload: dict, secret: str) -> str:
        body = json.dumps(payload, sort_keys=True)
        return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()

    async def deliver(self, webhook, event_type: str, data: dict) -> bool:
        payload = {
            "event": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
            "webhook_id": str(webhook.id),
        }
        signature = self.sign_payload(payload, webhook.secret)
        headers = {
            "Content-Type": "application/json",
            "X-OpenClip-Signature": f"sha256={signature}",
            "X-OpenClip-Event": event_type,
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook.url, json=payload, headers=headers)
                return 200 <= resp.status_code < 300
        except Exception as e:
            logger.warning("webhook.delivery_failed", url=webhook.url, error=str(e))
            return False

    @staticmethod
    def generate_secret() -> str:
        return secrets.token_hex(32)
```

### Step 3: Create Webhook Celery Task with Retries
```python
@celery_app.task(bind=True, name="app.tasks.publish.deliver_webhook", queue="publish", max_retries=4)
def deliver_webhook(self, webhook_id: str, event_type: str, data: dict):
    import asyncio
    dispatcher = WebhookDispatcher()
    # Fetch webhook from DB, deliver, record result, retry on failure
    ...
```

### Step 4: Create CRUD API
```python
@router.post("/webhooks")
async def create_webhook(url: str, events: list[str], user=Depends(get_current_user)):
    if not url.startswith("https://"):
        raise HTTPException(400, "Webhook URL must use HTTPS")
    secret = WebhookDispatcher.generate_secret()
    # Create webhook record, return id + secret (shown once)
    ...

@router.get("/webhooks")
async def list_webhooks(user=Depends(get_current_user)):
    ...

@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, user=Depends(get_current_user)):
    ...

@router.get("/webhooks/{webhook_id}/deliveries")
async def get_deliveries(webhook_id: str, user=Depends(get_current_user)):
    # Return recent delivery attempts with status codes
    ...
```

## Best Practices
- **HTTPS only:** Never send webhook payloads to HTTP URLs.
- **HMAC-SHA256 signing:** Users verify the `X-OpenClip-Signature` header to confirm payload authenticity.
- **10s timeout:** Don't wait forever for user's server to respond.
- **Exponential backoff:** 1s → 5s → 30s → 5min. After 4 failures, disable the webhook.
- **Show secret once:** The webhook secret is shown only at creation time (like an API key).

## Testing
- Register a webhook → trigger an event → verify POST received
- Verify HMAC signature matches payload
- Test retry logic with a temporarily failing endpoint
- Test webhook disabling after repeated failures

## Verification Checklist
- [ ] Webhook CRUD (create, list, delete)
- [ ] HTTPS-only enforcement
- [ ] HMAC-SHA256 signature in headers
- [ ] Events delivered as POST with correct payload
- [ ] Retry logic with exponential backoff
- [ ] Webhook disabled after 4 consecutive failures
- [ ] Delivery log shows attempts + status codes
- [ ] Secret shown only at creation time
