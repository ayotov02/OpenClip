# REST API v1 — Implementation Guide

## Overview
- **What:** Formalize and document the full REST API (v1) with OpenAPI/Swagger docs, authentication (JWT + API keys), rate limiting, and versioning.
- **Why:** A public API is a key differentiator — developers can build on OpenClip. API access is Enterprise-only on OpusClip.
- **Dependencies:** Phase 1 Feature 2 (FastAPI Backend), all Phase 1 + 2 features (API wraps all functionality)

## Architecture

### API Design
```
/api/v1/
├── /auth
│   ├── POST /register          # Create account
│   ├── POST /login             # Get JWT token
│   └── POST /api-keys          # Generate API key
│
├── /projects
│   ├── POST /                  # Create project (upload or URL)
│   ├── GET /                   # List projects
│   ├── GET /{id}               # Get project detail
│   ├── POST /{id}/clips        # Generate clips
│   └── DELETE /{id}            # Delete project
│
├── /clips
│   ├── GET /{id}               # Get clip detail
│   ├── PUT /{id}               # Update clip (trim, title)
│   └── DELETE /{id}            # Delete clip
│
├── /faceless
│   ├── POST /                  # Create faceless video
│   └── GET /{id}               # Get faceless project
│
├── /captions
│   ├── POST /generate          # Generate captions for video
│   └── PUT /{id}               # Edit caption text
│
├── /reframe
│   └── POST /                  # Reframe video to aspect ratio
│
├── /broll
│   └── POST /search            # Search B-roll for narration
│
├── /tts
│   ├── POST /synthesize        # Text-to-speech
│   └── GET /voices             # List available voices
│
├── /transcribe
│   └── POST /                  # Transcribe audio/video
│
├── /brands
│   ├── GET /                   # List brand kits
│   ├── POST /                  # Create brand kit
│   ├── PUT /{id}               # Update brand kit
│   └── DELETE /{id}            # Delete brand kit
│
├── /jobs
│   ├── GET /{id}               # Get job status + progress
│   └── GET /                   # List recent jobs
│
├── /publish
│   └── POST /                  # Publish to social platform
│
├── /webhooks
│   ├── GET /                   # List webhooks
│   ├── POST /                  # Create webhook
│   └── DELETE /{id}            # Delete webhook
│
└── /health                     # Service health check
```

### Authentication
```
Option 1: JWT Bearer Token
  Authorization: Bearer <jwt_token>

Option 2: API Key
  X-API-Key: oc_<random_string>
```

### Rate Limiting
```
Default: 100 requests/minute per API key
Configurable via environment variable: RATE_LIMIT_PER_MINUTE=100
Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

## Step-by-Step Implementation

### Step 1: Add Rate Limiting Middleware
```python
# backend/app/middleware/rate_limit.py
from fastapi import Request, HTTPException
import redis.asyncio as redis
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL)

async def rate_limit_middleware(request: Request, call_next):
    # Extract API key or user ID
    key = request.headers.get("X-API-Key") or "anonymous"
    redis_key = f"rate_limit:{key}"

    current = await redis_client.incr(redis_key)
    if current == 1:
        await redis_client.expire(redis_key, 60)

    limit = settings.RATE_LIMIT_PER_MINUTE
    if current > limit:
        raise HTTPException(429, "Rate limit exceeded")

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, limit - current))
    return response
```

### Step 2: Add OpenAPI Documentation Enhancements
```python
# In main.py, enhance FastAPI app:
app = FastAPI(
    title="OpenClip API",
    description="""
    ## Open-source AI video creation platform API.

    ### Authentication
    Use either JWT bearer token or API key:
    - **JWT:** `Authorization: Bearer <token>`
    - **API Key:** `X-API-Key: oc_<key>`

    ### Rate Limits
    - Default: 100 requests/minute
    - Configurable per instance
    """,
    version="1.0.0",
    license_info={"name": "AGPL-3.0", "url": "https://www.gnu.org/licenses/agpl-3.0.html"},
)
```

### Step 3: Add Response Schemas
```python
# Standardized response format
class APIResponse(BaseModel):
    success: bool = True
    data: Any = None
    error: str | None = None

class PaginatedResponse(APIResponse):
    total: int
    page: int
    per_page: int
```

### Step 4: Add Error Handling
```python
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error("unhandled_error", error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"},
    )
```

## Best Practices
- **URL-based versioning:** `/api/v1/`, `/api/v2/` — simple, explicit, cacheable.
- **Consistent response format:** Always return `{success, data, error}`.
- **Pagination:** Use `?page=1&per_page=20` for list endpoints.
- **Idempotency keys:** For POST endpoints, accept `Idempotency-Key` header to prevent duplicate operations.
- **Rate limit by API key, not IP:** Multiple users behind NAT shouldn't share a rate limit.
- **Swagger UI at /docs:** FastAPI auto-generates this. Enhance with examples and descriptions.

## Testing
- Register user → get JWT → make authenticated request
- Generate API key → make request with X-API-Key header
- Exceed rate limit → verify 429 response
- Test all endpoints return consistent response format
- Verify OpenAPI spec at /docs is complete

## Verification Checklist
- [ ] All endpoints documented in OpenAPI spec
- [ ] JWT authentication works
- [ ] API key authentication works
- [ ] Rate limiting returns correct headers
- [ ] 429 returned when rate limit exceeded
- [ ] Consistent error response format
- [ ] Pagination works on list endpoints
- [ ] `/docs` shows complete Swagger UI
- [ ] `/redoc` shows alternative docs
- [ ] Health check returns service status
