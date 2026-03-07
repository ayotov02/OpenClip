# Hashtag Analysis — Implementation Guide

## Overview
- **What:** Build a cross-platform hashtag tracking and recommendation system. Track hashtag performance (volume, engagement rate, competition score) across TikTok, Instagram, YouTube, and X. Provide an LLM-powered recommendation engine that suggests optimal hashtags based on content and historical performance data.
- **Why:** Hashtags are the primary discovery mechanism on TikTok and Instagram, and increasingly important on YouTube (Shorts) and X. Using the right hashtags can 10x reach. Most creators guess at hashtags — this system provides data-driven recommendations based on actual performance metrics.
- **Dependencies:** Phase 4 Feature 4 (Scraping Engine — data source), Phase 4 Feature 6 (Trending Detection — surge data), Phase 1 Feature 6 (LLM Integration), PostgreSQL.

## Architecture

### System Design
```
Scraping Engine                  Hashtag Processing Pipeline
  │  (posts with hashtags)          │
  ▼                                 │
┌──────────────────┐     ┌──────────┴───────────────┐
│ scraped_posts    │────>│ Celery: process_hashtags  │
│ (with hashtags)  │     │                           │
└──────────────────┘     │ 1. Extract hashtags       │
                         │ 2. Aggregate metrics      │
                         │ 3. Compute scores         │
                         │ 4. Update time-series     │
                         └──────────┬───────────────┘
                                    │
                                    ▼
                         ┌──────────────────────────┐
                         │ PostgreSQL                │
                         │ hashtag_metrics           │
                         │ hashtag_daily_snapshots   │
                         │ hashtag_recommendations   │
                         └──────────┬───────────────┘
                                    │
                              ┌─────┴──────┐
                              ▼            ▼
                         Dashboard    LLM Recommender
                         (Search,     (Qwen3: generate
                          Filter,      optimal sets)
                          Compare)
```

### Hashtag Scoring Model
```
Volume Score (0-100):
  Based on total posts using the hashtag in last 7 days.
  100 = top 1% of all tracked hashtags

Engagement Score (0-100):
  Average engagement rate of posts using this hashtag.
  100 = top 1% engagement

Competition Score (0-100):
  How many large accounts (>100K followers) use this hashtag.
  100 = extremely competitive (dominated by large accounts)
  0 = low competition (opportunity)

Opportunity Score = Engagement Score * (100 - Competition Score) / 100
  High engagement + low competition = best opportunity

Trending Score (0-100):
  Rate of change in volume over last 24h vs 7-day average.
  100 = volume exploding
```

## Step-by-Step Implementation

### Step 1: Database Models

Create `backend/app/models/hashtag.py`:
```python
from datetime import datetime

from sqlalchemy import String, Float, Integer, DateTime, Text, JSON, BigInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class HashtagMetric(BaseModel):
    """Aggregated metrics for a hashtag on a specific platform."""
    __tablename__ = "hashtag_metrics"
    __table_args__ = (
        UniqueConstraint("platform", "hashtag", name="uq_platform_hashtag"),
    )

    platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    hashtag: Mapped[str] = mapped_column(String(255), nullable=False, index=True)  # lowercase, no #
    display_tag: Mapped[str] = mapped_column(String(255), nullable=False)  # original casing with #

    # Volume metrics
    total_posts_7d: Mapped[int] = mapped_column(Integer, default=0)
    total_posts_30d: Mapped[int] = mapped_column(Integer, default=0)
    total_posts_all_time: Mapped[int] = mapped_column(BigInteger, default=0)

    # Engagement metrics
    avg_views_per_post: Mapped[int] = mapped_column(BigInteger, default=0)
    avg_likes_per_post: Mapped[int] = mapped_column(Integer, default=0)
    avg_comments_per_post: Mapped[int] = mapped_column(Integer, default=0)
    avg_engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)

    # Competition metrics
    large_account_percentage: Mapped[float] = mapped_column(Float, default=0.0)  # % of posts by >100K accounts
    avg_follower_count: Mapped[int] = mapped_column(BigInteger, default=0)  # Avg followers of posters

    # Computed scores (0-100)
    volume_score: Mapped[float] = mapped_column(Float, default=0.0)
    engagement_score: Mapped[float] = mapped_column(Float, default=0.0)
    competition_score: Mapped[float] = mapped_column(Float, default=0.0)
    opportunity_score: Mapped[float] = mapped_column(Float, default=0.0)
    trending_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Related tags
    related_hashtags: Mapped[list | None] = mapped_column(JSON, nullable=True)  # co-occurring tags
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Auto-detected category

    # Timestamps
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class HashtagDailySnapshot(BaseModel):
    """Daily time-series snapshot for trend tracking."""
    __tablename__ = "hashtag_daily_snapshots"

    hashtag_metric_id: Mapped[str] = mapped_column(
        String, nullable=False, index=True  # FK to hashtag_metrics
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    hashtag: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    post_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_views: Mapped[int] = mapped_column(BigInteger, default=0)
    avg_engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)
    total_views: Mapped[int] = mapped_column(BigInteger, default=0)
```

### Step 2: Hashtag Processing Service

Create `backend/app/services/hashtag_analysis.py`:
```python
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select, and_, func
from sqlalchemy.orm import Session

from app.models.scraped_data import ScrapedPost, ScrapedProfile
from app.models.hashtag import HashtagMetric, HashtagDailySnapshot

logger = structlog.get_logger()


class HashtagAnalysisService:
    def __init__(self, db: Session):
        self.db = db

    def process_hashtags_for_platform(self, platform: str):
        """Aggregate hashtag metrics from scraped posts."""
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        # Get all recent posts with hashtags
        posts_7d = self.db.execute(
            select(ScrapedPost).where(
                and_(
                    ScrapedPost.platform == platform,
                    ScrapedPost.scraped_at >= seven_days_ago,
                    ScrapedPost.hashtags.isnot(None),
                )
            )
        ).scalars().all()

        posts_30d = self.db.execute(
            select(ScrapedPost).where(
                and_(
                    ScrapedPost.platform == platform,
                    ScrapedPost.scraped_at >= thirty_days_ago,
                    ScrapedPost.hashtags.isnot(None),
                )
            )
        ).scalars().all()

        if not posts_7d:
            return

        # Aggregate metrics per hashtag
        hashtag_data_7d = defaultdict(lambda: {
            "posts": [], "total_views": 0, "total_likes": 0,
            "total_comments": 0, "total_shares": 0, "co_tags": Counter(),
        })
        hashtag_data_30d = defaultdict(lambda: {"count": 0})

        for post in posts_7d:
            tags = self._normalize_hashtags(post.hashtags or [])
            for tag in tags:
                data = hashtag_data_7d[tag]
                data["posts"].append(post)
                data["total_views"] += post.view_count or 0
                data["total_likes"] += post.like_count or 0
                data["total_comments"] += post.comment_count or 0
                data["total_shares"] += post.share_count or 0
                # Track co-occurring hashtags
                for other_tag in tags:
                    if other_tag != tag:
                        data["co_tags"][other_tag] += 1

        for post in posts_30d:
            for tag in self._normalize_hashtags(post.hashtags or []):
                hashtag_data_30d[tag]["count"] += 1

        # Compute all-hashtag percentiles for scoring
        all_volumes = sorted([len(d["posts"]) for d in hashtag_data_7d.values()])
        all_engagements = []

        for tag, data in hashtag_data_7d.items():
            post_count = len(data["posts"])
            if post_count == 0:
                continue

            total_views = max(data["total_views"], 1)
            engagement = data["total_likes"] + data["total_comments"] + data["total_shares"]
            er = engagement / total_views * 100
            all_engagements.append(er)

        all_engagements.sort()

        # Update or create HashtagMetric for each hashtag
        for tag, data in hashtag_data_7d.items():
            post_count = len(data["posts"])
            if post_count < 2:
                continue  # Skip extremely rare hashtags

            total_views = max(data["total_views"], 1)
            total_engagement = data["total_likes"] + data["total_comments"] + data["total_shares"]
            avg_er = total_engagement / total_views * 100

            # Compute scores
            volume_score = self._percentile_score(post_count, all_volumes)
            engagement_score = self._percentile_score(avg_er, all_engagements)

            # Competition score: approximate from average engagement vs volume ratio
            # High volume + low avg engagement suggests competition from large accounts
            competition_score = min(100, volume_score * 0.7 + (100 - engagement_score) * 0.3)

            # Opportunity score
            opportunity_score = engagement_score * (100 - competition_score) / 100

            # Trending score: compare 7d to 30d rate
            rate_30d = hashtag_data_30d.get(tag, {}).get("count", 0) / 30
            rate_7d = post_count / 7
            trending_score = min(100, (rate_7d / max(rate_30d, 0.01) - 1) * 50) if rate_30d > 0 else 50

            # Related hashtags
            related = [t for t, _ in data["co_tags"].most_common(10)]

            # Upsert HashtagMetric
            existing = self.db.execute(
                select(HashtagMetric).where(
                    and_(
                        HashtagMetric.platform == platform,
                        HashtagMetric.hashtag == tag,
                    )
                )
            ).scalar_one_or_none()

            if existing:
                existing.total_posts_7d = post_count
                existing.total_posts_30d = hashtag_data_30d.get(tag, {}).get("count", 0)
                existing.avg_views_per_post = data["total_views"] // post_count
                existing.avg_likes_per_post = data["total_likes"] // post_count
                existing.avg_comments_per_post = data["total_comments"] // post_count
                existing.avg_engagement_rate = round(avg_er, 2)
                existing.volume_score = round(volume_score, 1)
                existing.engagement_score = round(engagement_score, 1)
                existing.competition_score = round(competition_score, 1)
                existing.opportunity_score = round(opportunity_score, 1)
                existing.trending_score = round(max(0, trending_score), 1)
                existing.related_hashtags = related
                existing.last_computed_at = now
            else:
                metric = HashtagMetric(
                    platform=platform,
                    hashtag=tag,
                    display_tag=f"#{tag}",
                    total_posts_7d=post_count,
                    total_posts_30d=hashtag_data_30d.get(tag, {}).get("count", 0),
                    avg_views_per_post=data["total_views"] // post_count,
                    avg_likes_per_post=data["total_likes"] // post_count,
                    avg_comments_per_post=data["total_comments"] // post_count,
                    avg_engagement_rate=round(avg_er, 2),
                    volume_score=round(volume_score, 1),
                    engagement_score=round(engagement_score, 1),
                    competition_score=round(competition_score, 1),
                    opportunity_score=round(opportunity_score, 1),
                    trending_score=round(max(0, trending_score), 1),
                    related_hashtags=related,
                    last_computed_at=now,
                )
                self.db.add(metric)

            # Daily snapshot
            snapshot = HashtagDailySnapshot(
                hashtag_metric_id=str(existing.id) if existing else "pending",
                platform=platform,
                hashtag=tag,
                date=now.replace(hour=0, minute=0, second=0, microsecond=0),
                post_count=post_count,
                avg_views=data["total_views"] // post_count,
                avg_engagement_rate=round(avg_er, 2),
                total_views=data["total_views"],
            )
            self.db.add(snapshot)

        self.db.commit()
        logger.info("hashtag_processing_complete", platform=platform, hashtags=len(hashtag_data_7d))

    def _normalize_hashtags(self, tags: list) -> list[str]:
        """Normalize hashtags: lowercase, remove #, strip whitespace."""
        normalized = []
        for tag in tags:
            if isinstance(tag, str):
                clean = tag.lower().strip().lstrip("#")
                clean = re.sub(r'[^\w]', '', clean)
                if clean and len(clean) >= 2:
                    normalized.append(clean)
        return normalized

    def _percentile_score(self, value: float, sorted_values: list) -> float:
        """Calculate percentile score (0-100) for a value within a distribution."""
        if not sorted_values:
            return 50.0
        count_below = sum(1 for v in sorted_values if v < value)
        return count_below / len(sorted_values) * 100
```

### Step 3: Hashtag Recommendation Engine

Create `backend/app/services/hashtag_recommender.py`:
```python
import json
import structlog
import httpx
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.hashtag import HashtagMetric

logger = structlog.get_logger()

RECOMMENDATION_PROMPT = """You are a social media hashtag strategist. Generate the optimal hashtag set for a video post.

Platform: {platform}
Content Summary: {content_summary}
Niche: {niche}

Here are top-performing hashtags in this niche based on data:

High Opportunity (high engagement, low competition):
{opportunity_hashtags}

Trending Now:
{trending_hashtags}

High Volume (for broad reach):
{volume_hashtags}

Rules for {platform}:
{platform_rules}

Generate an optimal hashtag set. Use a MIX of:
- 2-3 high-volume hashtags (for reach)
- 3-5 medium hashtags (niche-relevant)
- 2-3 low-competition hashtags (for ranking)
- 1-2 trending hashtags (for discovery)

Respond in JSON:
{{
  "hashtags": ["#tag1", "#tag2", ...],
  "strategy_explanation": "Brief explanation of why these hashtags were chosen"
}}"""

PLATFORM_RULES = {
    "tiktok": "Use 5-8 hashtags. Always include #fyp or #foryou. Mix trending + niche.",
    "instagram": "Use 20-30 hashtags. Mix popular (1M+), medium (100K-1M), and niche (<100K). Place in caption or first comment.",
    "youtube": "Use 5-15 tags in the video tags field. Focus on searchable keywords, not hashtag style. Include 2-3 hashtags in title or description.",
    "x": "Use 1-2 hashtags maximum. More than 2 reduces engagement on X. Pick the most relevant ones.",
    "linkedin": "Use 3-5 hashtags. Keep them professional and industry-relevant.",
}


class HashtagRecommender:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def recommend(
        self,
        platform: str,
        content_summary: str,
        niche: str = "general",
    ) -> dict:
        """Generate hashtag recommendations using data + LLM."""

        # Fetch top hashtags from database
        opportunity_tags = await self._get_top_hashtags(platform, "opportunity_score", limit=15)
        trending_tags = await self._get_top_hashtags(platform, "trending_score", limit=10)
        volume_tags = await self._get_top_hashtags(platform, "volume_score", limit=10)

        prompt = RECOMMENDATION_PROMPT.format(
            platform=platform,
            content_summary=content_summary,
            niche=niche,
            opportunity_hashtags=self._format_hashtags(opportunity_tags),
            trending_hashtags=self._format_hashtags(trending_tags),
            volume_hashtags=self._format_hashtags(volume_tags),
            platform_rules=PLATFORM_RULES.get(platform, "Use appropriate number of hashtags."),
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.OLLAMA_URL}/api/generate",
                    json={
                        "model": "qwen3:14b",
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.6},
                    },
                )
                response.raise_for_status()
                raw_text = response.json().get("response", "")

                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0]
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0]

                result = json.loads(raw_text.strip())
                return {
                    "hashtags": result.get("hashtags", []),
                    "strategy": result.get("strategy_explanation", ""),
                    "data_sources": {
                        "opportunity": [t["display_tag"] for t in opportunity_tags[:5]],
                        "trending": [t["display_tag"] for t in trending_tags[:5]],
                        "volume": [t["display_tag"] for t in volume_tags[:5]],
                    },
                }

        except Exception as e:
            logger.error("hashtag_recommendation_failed", error=str(e))
            # Fallback: return data-driven recommendations without LLM
            return {
                "hashtags": [t["display_tag"] for t in opportunity_tags[:10]],
                "strategy": "Data-driven selection based on opportunity score (high engagement, low competition).",
                "data_sources": {
                    "opportunity": [t["display_tag"] for t in opportunity_tags[:5]],
                    "trending": [t["display_tag"] for t in trending_tags[:5]],
                    "volume": [t["display_tag"] for t in volume_tags[:5]],
                },
            }

    async def _get_top_hashtags(self, platform: str, sort_field: str, limit: int = 10) -> list[dict]:
        sort_column = getattr(HashtagMetric, sort_field, HashtagMetric.opportunity_score)
        result = await self.db.execute(
            select(HashtagMetric)
            .where(HashtagMetric.platform == platform)
            .order_by(desc(sort_column))
            .limit(limit)
        )
        metrics = result.scalars().all()
        return [
            {
                "hashtag": m.hashtag,
                "display_tag": m.display_tag,
                "volume_score": m.volume_score,
                "engagement_score": m.engagement_score,
                "competition_score": m.competition_score,
                "opportunity_score": m.opportunity_score,
                "trending_score": m.trending_score,
                "avg_engagement_rate": m.avg_engagement_rate,
                "total_posts_7d": m.total_posts_7d,
            }
            for m in metrics
        ]

    def _format_hashtags(self, tags: list[dict]) -> str:
        return "\n".join(
            f"  {t['display_tag']} — Volume: {t['volume_score']}/100, ER: {t['engagement_score']}/100, Competition: {t['competition_score']}/100, Posts/7d: {t['total_posts_7d']}"
            for t in tags
        )
```

### Step 4: Celery Task for Hashtag Processing

Create `backend/app/tasks/hashtags.py`:
```python
import structlog

from app.core.database import get_sync_session
from app.services.hashtag_analysis import HashtagAnalysisService
from app.worker import celery_app

logger = structlog.get_logger()

PLATFORMS = ["tiktok", "instagram", "youtube", "x"]


@celery_app.task(name="app.tasks.hashtags.process_all_hashtags")
def process_all_hashtags():
    """Process hashtag metrics for all platforms. Runs after scraping."""
    for platform in PLATFORMS:
        process_platform_hashtags.delay(platform)


@celery_app.task(name="app.tasks.hashtags.process_platform_hashtags")
def process_platform_hashtags(platform: str):
    """Process hashtag metrics for a single platform."""
    with get_sync_session() as db:
        service = HashtagAnalysisService(db)
        service.process_hashtags_for_platform(platform)
```

Add to Celery Beat:
```python
celery_app.conf.beat_schedule.update({
    "process-hashtags": {
        "task": "app.tasks.hashtags.process_all_hashtags",
        "schedule": crontab(hour="*/6", minute=30),  # 30 min after scraping
    },
})
```

### Step 5: API Endpoints

Create `backend/app/api/v1/hashtags.py`:
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.hashtag import HashtagMetric, HashtagDailySnapshot
from app.models.user import User
from app.services.hashtag_recommender import HashtagRecommender

router = APIRouter(prefix="/hashtags", tags=["hashtags"])


@router.get("/search")
async def search_hashtags(
    q: str = Query(..., min_length=1, description="Search query"),
    platform: str | None = Query(None),
    sort_by: str = Query("opportunity_score", description="Sort field"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search hashtags by name with metrics."""
    conditions = [HashtagMetric.hashtag.ilike(f"%{q.lower().lstrip('#')}%")]
    if platform:
        conditions.append(HashtagMetric.platform == platform)

    sort_column = getattr(HashtagMetric, sort_by, HashtagMetric.opportunity_score)

    result = await db.execute(
        select(HashtagMetric)
        .where(and_(*conditions))
        .order_by(desc(sort_column))
        .limit(limit)
    )
    metrics = result.scalars().all()

    return [_serialize_hashtag(m) for m in metrics]


@router.get("/top")
async def get_top_hashtags(
    platform: str = Query(...),
    sort_by: str = Query("opportunity_score"),
    category: str | None = Query(None),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get top hashtags by score for a platform."""
    conditions = [HashtagMetric.platform == platform]
    if category:
        conditions.append(HashtagMetric.category == category)

    sort_column = getattr(HashtagMetric, sort_by, HashtagMetric.opportunity_score)

    result = await db.execute(
        select(HashtagMetric)
        .where(and_(*conditions))
        .order_by(desc(sort_column))
        .limit(limit)
    )
    metrics = result.scalars().all()

    return [_serialize_hashtag(m) for m in metrics]


@router.get("/trending")
async def get_trending_hashtags(
    platform: str = Query(...),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get currently trending hashtags (highest trending score)."""
    result = await db.execute(
        select(HashtagMetric)
        .where(
            and_(
                HashtagMetric.platform == platform,
                HashtagMetric.trending_score > 50,  # Above average trending
            )
        )
        .order_by(desc(HashtagMetric.trending_score))
        .limit(limit)
    )
    metrics = result.scalars().all()

    return [_serialize_hashtag(m) for m in metrics]


@router.get("/{hashtag}/history")
async def get_hashtag_history(
    hashtag: str,
    platform: str = Query(...),
    days: int = Query(30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get daily time-series data for a specific hashtag."""
    from datetime import datetime, timedelta, timezone
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(HashtagDailySnapshot)
        .where(
            and_(
                HashtagDailySnapshot.platform == platform,
                HashtagDailySnapshot.hashtag == hashtag.lower().lstrip("#"),
                HashtagDailySnapshot.date >= since,
            )
        )
        .order_by(HashtagDailySnapshot.date)
    )
    snapshots = result.scalars().all()

    return [
        {
            "date": s.date.isoformat(),
            "post_count": s.post_count,
            "avg_views": s.avg_views,
            "avg_engagement_rate": s.avg_engagement_rate,
            "total_views": s.total_views,
        }
        for s in snapshots
    ]


@router.get("/{hashtag}/related")
async def get_related_hashtags(
    hashtag: str,
    platform: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get hashtags that frequently co-occur with the given hashtag."""
    result = await db.execute(
        select(HashtagMetric).where(
            and_(
                HashtagMetric.platform == platform,
                HashtagMetric.hashtag == hashtag.lower().lstrip("#"),
            )
        )
    )
    metric = result.scalar_one_or_none()

    if not metric or not metric.related_hashtags:
        return []

    # Fetch metrics for related hashtags
    related_result = await db.execute(
        select(HashtagMetric).where(
            and_(
                HashtagMetric.platform == platform,
                HashtagMetric.hashtag.in_(metric.related_hashtags),
            )
        )
    )
    related = related_result.scalars().all()

    return [_serialize_hashtag(m) for m in related]


@router.post("/recommend")
async def recommend_hashtags(
    platform: str,
    content_summary: str,
    niche: str = "general",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get AI-powered hashtag recommendations for content."""
    recommender = HashtagRecommender(db)
    return await recommender.recommend(
        platform=platform,
        content_summary=content_summary,
        niche=niche,
    )


def _serialize_hashtag(m: HashtagMetric) -> dict:
    return {
        "id": str(m.id),
        "platform": m.platform,
        "hashtag": m.hashtag,
        "display_tag": m.display_tag,
        "total_posts_7d": m.total_posts_7d,
        "total_posts_30d": m.total_posts_30d,
        "avg_views_per_post": m.avg_views_per_post,
        "avg_engagement_rate": m.avg_engagement_rate,
        "volume_score": m.volume_score,
        "engagement_score": m.engagement_score,
        "competition_score": m.competition_score,
        "opportunity_score": m.opportunity_score,
        "trending_score": m.trending_score,
        "related_hashtags": m.related_hashtags,
        "category": m.category,
    }
```

### Step 6: Frontend Hashtag Dashboard

Create `frontend/src/components/hashtags/hashtag-dashboard.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HashtagSearch } from "./hashtag-search";
import { HashtagTopList } from "./hashtag-top-list";
import { HashtagRecommender } from "./hashtag-recommender";

export function HashtagDashboard() {
  const [platform, setPlatform] = useState("tiktok");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Hashtag Analysis</h1>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="border rounded-md px-3 py-1.5"
        >
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="youtube">YouTube</option>
          <option value="x">X (Twitter)</option>
        </select>
      </div>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="top">Top Hashtags</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="recommend">AI Recommend</TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <HashtagSearch platform={platform} />
        </TabsContent>
        <TabsContent value="top">
          <HashtagTopList platform={platform} />
        </TabsContent>
        <TabsContent value="trending">
          <HashtagTopList platform={platform} sortBy="trending_score" />
        </TabsContent>
        <TabsContent value="recommend">
          <HashtagRecommender platform={platform} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

Create `frontend/src/components/hashtags/hashtag-search.tsx`:
```tsx
"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";

interface HashtagResult {
  display_tag: string;
  platform: string;
  total_posts_7d: number;
  avg_engagement_rate: number;
  volume_score: number;
  engagement_score: number;
  competition_score: number;
  opportunity_score: number;
  trending_score: number;
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? "bg-green-100 text-green-800" :
    score >= 40 ? "bg-yellow-100 text-yellow-800" :
    "bg-red-100 text-red-800";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}: {Math.round(score)}
    </span>
  );
}

export function HashtagSearch({ platform }: { platform: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HashtagResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { accessToken } = useAuth();
  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (q: string) => {
    if (!q || !accessToken) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/hashtags/search?q=${encodeURIComponent(q)}&platform=${platform}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (response.ok) setResults(await response.json());
    } finally {
      setLoading(false);
    }
  }, [platform, accessToken]);

  // Trigger search on debounced query change
  useState(() => {
    if (debouncedQuery) search(debouncedQuery);
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search hashtags (e.g., fitness, cooking, tech)..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value) search(e.target.value);
        }}
        className="text-lg"
      />

      {loading && <p className="text-muted-foreground">Searching...</p>}

      <div className="space-y-2">
        {results.map((tag) => (
          <Card key={tag.display_tag}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <span className="font-medium text-lg">{tag.display_tag}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  {tag.total_posts_7d} posts/7d | {tag.avg_engagement_rate}% ER
                </span>
              </div>
              <div className="flex gap-1">
                <ScoreBadge label="Volume" score={tag.volume_score} />
                <ScoreBadge label="Engagement" score={tag.engagement_score} />
                <ScoreBadge label="Competition" score={tag.competition_score} />
                <ScoreBadge label="Opportunity" score={tag.opportunity_score} />
                {tag.trending_score > 50 && (
                  <Badge variant="destructive" className="text-xs">Trending</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

Create `frontend/src/components/hashtags/hashtag-recommender.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface Recommendation {
  hashtags: string[];
  strategy: string;
  data_sources: {
    opportunity: string[];
    trending: string[];
    volume: string[];
  };
}

export function HashtagRecommender({ platform }: { platform: string }) {
  const [contentSummary, setContentSummary] = useState("");
  const [niche, setNiche] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const { accessToken } = useAuth();

  const handleRecommend = async () => {
    if (!contentSummary || !accessToken) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/hashtags/recommend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            platform,
            content_summary: contentSummary,
            niche: niche || "general",
          }),
        },
      );
      if (response.ok) {
        setRecommendation(await response.json());
      } else {
        toast.error("Failed to generate recommendations");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyHashtags = () => {
    if (recommendation) {
      navigator.clipboard.writeText(recommendation.hashtags.join(" "));
      toast.success("Hashtags copied to clipboard!");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI Hashtag Recommender</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Describe your content</label>
            <Textarea
              value={contentSummary}
              onChange={(e) => setContentSummary(e.target.value)}
              placeholder="A tutorial showing 5 quick healthy breakfast recipes for busy mornings..."
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Your niche (optional)</label>
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="fitness, cooking, tech, gaming..."
            />
          </div>
          <Button onClick={handleRecommend} disabled={loading || !contentSummary}>
            {loading ? "Generating..." : "Generate Hashtags"}
          </Button>
        </CardContent>
      </Card>

      {recommendation && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recommended Hashtags</CardTitle>
            <Button variant="outline" size="sm" onClick={copyHashtags}>
              Copy All
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {recommendation.hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm px-3 py-1">
                  {tag}
                </Badge>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">{recommendation.strategy}</p>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium mb-1">High Opportunity</p>
                {recommendation.data_sources.opportunity.map((t) => (
                  <Badge key={t} variant="outline" className="mr-1 mb-1">{t}</Badge>
                ))}
              </div>
              <div>
                <p className="font-medium mb-1">Trending Now</p>
                {recommendation.data_sources.trending.map((t) => (
                  <Badge key={t} variant="outline" className="mr-1 mb-1">{t}</Badge>
                ))}
              </div>
              <div>
                <p className="font-medium mb-1">High Volume</p>
                {recommendation.data_sources.volume.map((t) => (
                  <Badge key={t} variant="outline" className="mr-1 mb-1">{t}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

## Best Practices
- **Normalize early:** Always normalize hashtags to lowercase with no `#` prefix for storage and comparison. Keep `display_tag` with original casing for UI.
- **Percentile-based scoring:** Score relative to the entire dataset, not absolute values. A hashtag with 100 posts may be high-volume on a small niche but low-volume overall.
- **Deduplication:** When processing, use `UPSERT` (ON CONFLICT UPDATE) for hashtag metrics to avoid duplicates.
- **LLM fallback:** If Qwen3 is unavailable, fall back to pure data-driven recommendations sorted by opportunity score.
- **Platform-specific limits:** Enforce platform-specific hashtag count limits (TikTok: 5-8, Instagram: 20-30, X: 1-2).

## Testing
- Seed scraped_posts with known hashtags and verify metrics computation.
- Verify scoring: a hashtag with high engagement and low competition should have high opportunity score.
- Test search with partial matches, special characters.
- Test recommendation endpoint with various content descriptions.
- Verify daily snapshots create one record per hashtag per day.

## Verification Checklist
- [ ] `hashtag_metrics` and `hashtag_daily_snapshots` tables created
- [ ] Hashtag processing extracts and normalizes tags from scraped posts
- [ ] Volume, engagement, competition, opportunity, and trending scores computed correctly
- [ ] Related hashtags (co-occurrence) calculated and stored
- [ ] Search endpoint supports partial matching and platform filtering
- [ ] Top hashtags endpoint sorts by any score field
- [ ] Trending hashtags filtered by trending_score > 50
- [ ] Hashtag history returns daily time-series data
- [ ] Related hashtags endpoint returns co-occurring tags with metrics
- [ ] LLM recommender generates platform-appropriate hashtag sets
- [ ] Copy-to-clipboard works in the UI
- [ ] Score badges display with correct color coding (green/yellow/red)
- [ ] Celery task processes hashtags every 6 hours
