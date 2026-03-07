# Performance Analytics — Implementation Guide

## Overview
- **What:** Track post performance after publishing (views, likes, comments, shares) by polling platform APIs, calculate ROI metrics, identify best posting times, and display in a dashboard.
- **Why:** Creators need to know what content performs best. Performance data closes the feedback loop: create → publish → measure → improve.
- **Dependencies:** Phase 4 Features 1-3 (Social OAuth, Calendar, Auto-posting)

## Architecture

### Data Collection Pipeline
```
Published Post → Celery Beat (poll every 6 hours for 7 days, then daily for 30 days)
  → Platform APIs (YouTube Analytics, TikTok API, IG Graph API)
  → Store metrics in PostgreSQL (time-series snapshots)
  → Calculate derived metrics (engagement rate, growth velocity)
  → Dashboard visualization (Recharts)
```

### Data Model
```sql
PostMetrics
  - id: UUID (PK)
  - publish_job_id: FK(PublishJob)
  - platform: enum(youtube, tiktok, instagram, facebook, linkedin, x)
  - snapshot_at: timestamp
  - views: int
  - likes: int
  - comments: int
  - shares: int
  - saves: int?
  - watch_time_seconds: int? (YouTube)
  - click_through_rate: float? (YouTube)
  - engagement_rate: float (computed: (likes+comments+shares) / views)
  - raw_data: JSON (full API response)
```

## Step-by-Step Implementation

### Step 1: Create PostMetrics Model
```python
from sqlalchemy import String, Integer, Float, JSON, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel

class PostMetrics(BaseModel):
    __tablename__ = "post_metrics"
    publish_job_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("publish_jobs.id"))
    platform: Mapped[str] = mapped_column(String(50))
    snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    saves: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)
    raw_data: Mapped[dict] = mapped_column(JSON, default=dict)
```

### Step 2: Create Metrics Collection Service
```python
class MetricsCollectorService:
    async def collect_youtube(self, video_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={"part": "statistics", "id": video_id},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            stats = resp.json()["items"][0]["statistics"]
            return {
                "views": int(stats.get("viewCount", 0)),
                "likes": int(stats.get("likeCount", 0)),
                "comments": int(stats.get("commentCount", 0)),
            }

    async def collect_tiktok(self, video_id: str, access_token: str) -> dict:
        # TikTok Content Posting API video status endpoint
        ...

    async def collect_instagram(self, media_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://graph.instagram.com/{media_id}/insights",
                params={"metric": "impressions,reach,likes,comments,shares,saved", "access_token": access_token},
            )
            return self._parse_ig_insights(resp.json())
```

### Step 3: Create Celery Beat Schedule
```python
# In celery config
beat_schedule = {
    "collect-metrics-hourly": {
        "task": "app.tasks.analytics.collect_all_metrics",
        "schedule": 21600,  # Every 6 hours
    },
}
```

### Step 4: Create Dashboard API + Frontend
```python
@router.get("/analytics/posts")
async def get_post_analytics(days: int = 30, platform: str = None, user=Depends(get_current_user)):
    # Query PostMetrics, aggregate by post, return sorted by engagement
    ...

@router.get("/analytics/best-times")
async def get_best_posting_times(platform: str, user=Depends(get_current_user)):
    # Analyze posting time vs engagement_rate, return optimal hours
    ...
```

Frontend: Use Recharts for line charts (views over time), bar charts (engagement by platform), and heatmaps (best posting times).

## Best Practices
- **Polling schedule:** 6-hourly for first 7 days (metrics change rapidly), then daily for 30 days (stabilized).
- **Rate limits:** YouTube Analytics: 10,000 units/day. Instagram: 200 calls/hour. Batch requests where possible.
- **Engagement rate formula:** `(likes + comments + shares) / views * 100`. Standard industry metric.
- **Store raw API responses:** Platform APIs change. Storing raw data allows re-processing later.

## Testing
- Publish a test video → verify metrics collected after 6 hours
- Verify engagement rate calculation
- Dashboard displays correct charts

## Verification Checklist
- [ ] Metrics collected from YouTube, TikTok, Instagram APIs
- [ ] Time-series snapshots stored in PostgreSQL
- [ ] Engagement rate calculated correctly
- [ ] Best posting time analysis works
- [ ] Dashboard displays metrics with charts
- [ ] Polling schedule respects platform rate limits
- [ ] Handles expired OAuth tokens (refresh flow)
