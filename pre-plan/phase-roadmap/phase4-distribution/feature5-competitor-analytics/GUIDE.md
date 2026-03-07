# Competitor Analytics — Implementation Guide

## Overview
- **What:** Build a competitor analytics dashboard that displays tracked competitor profiles, engagement graphs, content performance comparisons, and topic analysis using BERTopic. Users can add competitor profiles across platforms and visualize their performance over time.
- **Why:** Creators need to understand what their competitors are doing to find content gaps and opportunities. Knowing a competitor's posting frequency, engagement rates, and trending topics informs content strategy. This transforms raw scraping data (Feature 4) into actionable intelligence.
- **Dependencies:** Phase 4 Feature 4 (Scraping Engine — provides raw data), Phase 1 Feature 2 (FastAPI Backend), Phase 1 Feature 8 (React Frontend), PostgreSQL for time-series data.

## Architecture

### System Design
```
Scraping Engine (Feature 4)
  │  Scraped profiles, posts, metrics
  ▼
┌─────────────────────────┐
│ PostgreSQL               │
│ scraped_profiles         │
│ scraped_posts            │
│ scraped_metric_snapshots │
│ competitor_topics        │
└───────────┬─────────────┘
            │
  ┌─────────┴──────────┐
  ▼                    ▼
Backend API         BERTopic Service
(FastAPI)           (Topic Detection)
  │                    │
  │  Aggregated        │  Topics, clusters
  │  metrics           │
  ▼                    ▼
Frontend Dashboard (Next.js)
  ├── Competitor Profile Cards
  ├── Engagement Rate Chart (Recharts)
  ├── Posting Frequency Calendar Heat Map
  ├── Content Type Distribution (Pie)
  ├── Follower Growth Line Chart
  └── Topic Clusters (BERTopic)
```

### Key Metrics Computed
```
Engagement Rate = (likes + comments + shares) / views * 100
Posting Frequency = posts / time_period
Follower Growth Rate = (current_followers - previous_followers) / previous_followers * 100
Average Views Per Post = total_views / post_count
Content Type Performance = engagement_rate grouped by content_type (reel, long-form, short, image)
Best Posting Time = engagement grouped by hour_of_day and day_of_week
```

## Step-by-Step Implementation

### Step 1: Database Models for Analytics

Create `backend/app/models/competitor.py`:
```python
from datetime import datetime

from sqlalchemy import String, ForeignKey, Text, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class CompetitorGroup(BaseModel):
    """A named group of competitors for comparison."""
    __tablename__ = "competitor_groups"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    niche: Mapped[str | None] = mapped_column(String(100), nullable=True)

    profiles = relationship("CompetitorGroupMember", back_populates="group", cascade="all, delete-orphan")


class CompetitorGroupMember(BaseModel):
    """Links a scraped profile to a competitor group."""
    __tablename__ = "competitor_group_members"

    group_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitor_groups.id"), nullable=False
    )
    scraped_profile_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scraped_profiles.id"), nullable=False
    )

    group = relationship("CompetitorGroup", back_populates="profiles")
    scraped_profile = relationship("ScrapedProfile")


class CompetitorTopic(BaseModel):
    """Topics detected by BERTopic from competitor content."""
    __tablename__ = "competitor_topics"

    scraped_profile_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scraped_profiles.id"), nullable=False, index=True
    )
    topic_id: Mapped[int] = mapped_column(nullable=False)
    topic_label: Mapped[str] = mapped_column(String(500), nullable=False)
    top_words: Mapped[list] = mapped_column(JSON, nullable=False)  # ["word1", "word2", ...]
    document_count: Mapped[int] = mapped_column(nullable=False)
    avg_engagement_rate: Mapped[float | None] = mapped_column(nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

### Step 2: Analytics Service

Create `backend/app/services/competitor_analytics.py`:
```python
import uuid
from datetime import datetime, timedelta, timezone
from collections import defaultdict

import structlog
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scraped_data import ScrapedProfile, ScrapedPost, ScrapedMetricSnapshot
from app.models.competitor import CompetitorGroup, CompetitorGroupMember, CompetitorTopic

logger = structlog.get_logger()


class CompetitorAnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_profile_overview(self, scraped_profile_id: uuid.UUID) -> dict:
        """Get the latest profile data with computed metrics."""
        profile = await self.db.execute(
            select(ScrapedProfile).where(ScrapedProfile.id == scraped_profile_id)
        )
        profile = profile.scalar_one_or_none()
        if not profile:
            return {}

        # Get recent posts for engagement calculation
        posts_result = await self.db.execute(
            select(ScrapedPost)
            .where(ScrapedPost.scraped_profile_id == scraped_profile_id)
            .order_by(desc(ScrapedPost.scraped_at))
            .limit(30)
        )
        posts = posts_result.scalars().all()

        # Calculate engagement rate
        total_engagement = sum(
            (p.like_count or 0) + (p.comment_count or 0) + (p.share_count or 0)
            for p in posts
        )
        total_views = sum(p.view_count or 0 for p in posts)
        engagement_rate = (total_engagement / total_views * 100) if total_views > 0 else 0

        # Average views
        avg_views = total_views / len(posts) if posts else 0

        # Posting frequency (posts per week in last 30 days)
        recent_posts = [p for p in posts if p.published_at and p.published_at > datetime.now(timezone.utc) - timedelta(days=30)]
        posting_frequency = len(recent_posts) / 4.3 if recent_posts else 0  # ~4.3 weeks in 30 days

        return {
            "profile": {
                "id": str(profile.id),
                "platform": profile.platform,
                "username": profile.username,
                "display_name": profile.display_name,
                "avatar_url": profile.avatar_url,
                "bio": profile.bio,
                "follower_count": profile.follower_count,
                "following_count": profile.following_count,
                "post_count": profile.post_count,
                "last_scraped_at": profile.last_scraped_at.isoformat() if profile.last_scraped_at else None,
            },
            "metrics": {
                "engagement_rate": round(engagement_rate, 2),
                "avg_views_per_post": round(avg_views),
                "posting_frequency_per_week": round(posting_frequency, 1),
                "total_posts_analyzed": len(posts),
            },
        }

    async def get_follower_growth(
        self, scraped_profile_id: uuid.UUID, days: int = 30
    ) -> list[dict]:
        """Get follower count over time for a profile."""
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.db.execute(
            select(ScrapedMetricSnapshot)
            .where(
                and_(
                    ScrapedMetricSnapshot.scraped_profile_id == scraped_profile_id,
                    ScrapedMetricSnapshot.scraped_at >= since,
                )
            )
            .order_by(ScrapedMetricSnapshot.scraped_at)
        )
        snapshots = result.scalars().all()

        return [
            {
                "date": s.scraped_at.isoformat(),
                "follower_count": s.follower_count,
                "post_count": s.post_count,
            }
            for s in snapshots
        ]

    async def get_engagement_over_time(
        self, scraped_profile_id: uuid.UUID, days: int = 30
    ) -> list[dict]:
        """Get engagement metrics per post over time."""
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.db.execute(
            select(ScrapedPost)
            .where(
                and_(
                    ScrapedPost.scraped_profile_id == scraped_profile_id,
                    ScrapedPost.scraped_at >= since,
                )
            )
            .order_by(ScrapedPost.scraped_at)
        )
        posts = result.scalars().all()

        return [
            {
                "date": p.scraped_at.isoformat(),
                "title": p.title[:80] if p.title else None,
                "views": p.view_count,
                "likes": p.like_count,
                "comments": p.comment_count,
                "shares": p.share_count,
                "engagement_rate": round(
                    ((p.like_count or 0) + (p.comment_count or 0) + (p.share_count or 0))
                    / max(p.view_count or 1, 1)
                    * 100,
                    2,
                ),
            }
            for p in posts
        ]

    async def get_best_posting_times(self, scraped_profile_id: uuid.UUID) -> dict:
        """Analyze which posting times get the best engagement."""
        result = await self.db.execute(
            select(ScrapedPost)
            .where(
                and_(
                    ScrapedPost.scraped_profile_id == scraped_profile_id,
                    ScrapedPost.published_at.isnot(None),
                )
            )
        )
        posts = result.scalars().all()

        # Group by hour of day and day of week
        hour_engagement = defaultdict(list)
        day_engagement = defaultdict(list)

        for post in posts:
            if not post.published_at or not post.view_count:
                continue
            engagement = ((post.like_count or 0) + (post.comment_count or 0)) / max(post.view_count, 1) * 100
            hour_engagement[post.published_at.hour].append(engagement)
            day_engagement[post.published_at.strftime("%A")].append(engagement)

        return {
            "by_hour": {
                str(hour): round(sum(rates) / len(rates), 2)
                for hour, rates in sorted(hour_engagement.items())
            },
            "by_day": {
                day: round(sum(rates) / len(rates), 2)
                for day, rates in day_engagement.items()
            },
        }

    async def compare_competitors(self, group_id: uuid.UUID) -> list[dict]:
        """Compare all competitors in a group side-by-side."""
        members = await self.db.execute(
            select(CompetitorGroupMember)
            .where(CompetitorGroupMember.group_id == group_id)
        )
        members = members.scalars().all()

        comparisons = []
        for member in members:
            overview = await self.get_profile_overview(member.scraped_profile_id)
            if overview:
                comparisons.append(overview)

        # Sort by engagement rate
        comparisons.sort(key=lambda x: x["metrics"]["engagement_rate"], reverse=True)
        return comparisons

    async def get_top_performing_content(
        self, scraped_profile_id: uuid.UUID, limit: int = 10
    ) -> list[dict]:
        """Get the top performing posts by engagement."""
        result = await self.db.execute(
            select(ScrapedPost)
            .where(ScrapedPost.scraped_profile_id == scraped_profile_id)
            .order_by(desc(ScrapedPost.view_count))
            .limit(limit)
        )
        posts = result.scalars().all()

        return [
            {
                "title": p.title,
                "url": p.post_url,
                "thumbnail_url": p.thumbnail_url,
                "views": p.view_count,
                "likes": p.like_count,
                "comments": p.comment_count,
                "engagement_rate": round(
                    ((p.like_count or 0) + (p.comment_count or 0))
                    / max(p.view_count or 1, 1)
                    * 100,
                    2,
                ),
                "published_at": p.published_at.isoformat() if p.published_at else None,
            }
            for p in posts
        ]
```

### Step 3: BERTopic Integration Service

Create `backend/app/services/topic_analysis.py`:
```python
"""
BERTopic-based topic detection for competitor content analysis.
Runs as a Celery task since it's CPU/GPU intensive.
"""
import structlog
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_sync_session
from app.models.scraped_data import ScrapedPost
from app.models.competitor import CompetitorTopic
from app.worker import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.scrape.analyze_topics", queue="ai")
def analyze_competitor_topics(scraped_profile_id: str):
    """
    Run BERTopic on all posts from a competitor to detect content themes.
    This task runs on the AI queue (GPU worker).
    """
    try:
        from bertopic import BERTopic
        from sentence_transformers import SentenceTransformer
    except ImportError:
        logger.error("bertopic_not_installed", hint="pip install bertopic sentence-transformers")
        return

    with get_sync_session() as db:
        # Fetch all posts for this profile
        result = db.execute(
            select(ScrapedPost)
            .where(ScrapedPost.scraped_profile_id == scraped_profile_id)
            .order_by(ScrapedPost.scraped_at.desc())
            .limit(500)
        )
        posts = result.scalars().all()

        if len(posts) < 10:
            logger.warning("insufficient_posts_for_topic_analysis", count=len(posts))
            return

        # Prepare documents
        documents = []
        engagement_rates = []
        for post in posts:
            text = " ".join(filter(None, [post.title, post.description]))
            if text.strip():
                documents.append(text)
                views = max(post.view_count or 1, 1)
                er = ((post.like_count or 0) + (post.comment_count or 0)) / views * 100
                engagement_rates.append(er)

        if len(documents) < 10:
            return

        # Run BERTopic
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        topic_model = BERTopic(
            embedding_model=embedding_model,
            min_topic_size=3,
            nr_topics="auto",
            verbose=False,
        )

        topics, probs = topic_model.fit_transform(documents)

        # Get topic info
        topic_info = topic_model.get_topic_info()

        # Clear old topics
        db.execute(
            CompetitorTopic.__table__.delete().where(
                CompetitorTopic.scraped_profile_id == scraped_profile_id
            )
        )

        now = datetime.now(timezone.utc)

        # Store new topics
        for _, row in topic_info.iterrows():
            topic_id = row["Topic"]
            if topic_id == -1:
                continue  # Skip outlier topic

            # Get top words for this topic
            topic_words = topic_model.get_topic(topic_id)
            top_words = [word for word, _ in topic_words[:10]]

            # Calculate average engagement for posts in this topic
            topic_indices = [i for i, t in enumerate(topics) if t == topic_id]
            topic_engagement = [engagement_rates[i] for i in topic_indices if i < len(engagement_rates)]
            avg_er = sum(topic_engagement) / len(topic_engagement) if topic_engagement else 0

            competitor_topic = CompetitorTopic(
                scraped_profile_id=scraped_profile_id,
                topic_id=topic_id,
                topic_label=row.get("Name", f"Topic {topic_id}"),
                top_words=top_words,
                document_count=row["Count"],
                avg_engagement_rate=round(avg_er, 2),
                detected_at=now,
            )
            db.add(competitor_topic)

        db.commit()
        logger.info(
            "topic_analysis_complete",
            profile_id=scraped_profile_id,
            topics_found=len(topic_info) - 1,  # Exclude outlier topic
        )
```

### Step 4: API Endpoints

Create `backend/app/api/v1/competitors.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.competitor import CompetitorGroup, CompetitorGroupMember, CompetitorTopic
from app.models.scraped_data import ScrapedProfile
from app.models.user import User
from app.services.competitor_analytics import CompetitorAnalyticsService

router = APIRouter(prefix="/competitors", tags=["competitors"])


# --- Competitor Groups ---

@router.post("/groups", status_code=201)
async def create_group(
    name: str,
    description: str | None = None,
    niche: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    group = CompetitorGroup(user_id=user.id, name=name, description=description, niche=niche)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return {"id": str(group.id), "name": group.name}


@router.get("/groups")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CompetitorGroup).where(CompetitorGroup.user_id == user.id)
    )
    groups = result.scalars().all()
    return [{"id": str(g.id), "name": g.name, "description": g.description, "niche": g.niche} for g in groups]


# --- Track Competitor Profiles ---

@router.post("/track")
async def track_competitor(
    group_id: uuid.UUID,
    platform: str,
    profile_url: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a competitor profile to track."""
    # Verify group ownership
    group = await db.execute(
        select(CompetitorGroup).where(
            CompetitorGroup.id == group_id,
            CompetitorGroup.user_id == user.id,
        )
    )
    if not group.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")

    # Create scraped profile
    from datetime import datetime, timezone
    profile = ScrapedProfile(
        user_id=user.id,
        platform=platform,
        profile_url=profile_url,
        last_scraped_at=datetime.now(timezone.utc),
    )
    db.add(profile)
    await db.flush()

    # Link to group
    member = CompetitorGroupMember(group_id=group_id, scraped_profile_id=profile.id)
    db.add(member)
    await db.commit()

    # Dispatch initial scrape
    from app.tasks.scrape import scrape_profile
    scrape_profile.delay(str(profile.id))

    return {"id": str(profile.id), "status": "scraping"}


@router.delete("/track/{profile_id}")
async def untrack_competitor(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ScrapedProfile).where(
            ScrapedProfile.id == profile_id,
            ScrapedProfile.user_id == user.id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404)
    await db.delete(profile)
    await db.commit()
    return {"status": "removed"}


# --- Analytics Endpoints ---

@router.get("/profiles/{profile_id}/overview")
async def get_profile_overview(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = CompetitorAnalyticsService(db)
    return await service.get_profile_overview(profile_id)


@router.get("/profiles/{profile_id}/follower-growth")
async def get_follower_growth(
    profile_id: uuid.UUID,
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = CompetitorAnalyticsService(db)
    return await service.get_follower_growth(profile_id, days=days)


@router.get("/profiles/{profile_id}/engagement")
async def get_engagement(
    profile_id: uuid.UUID,
    days: int = Query(30, ge=7, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = CompetitorAnalyticsService(db)
    return await service.get_engagement_over_time(profile_id, days=days)


@router.get("/profiles/{profile_id}/best-times")
async def get_best_posting_times(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = CompetitorAnalyticsService(db)
    return await service.get_best_posting_times(profile_id)


@router.get("/profiles/{profile_id}/top-content")
async def get_top_content(
    profile_id: uuid.UUID,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = CompetitorAnalyticsService(db)
    return await service.get_top_performing_content(profile_id, limit=limit)


@router.get("/profiles/{profile_id}/topics")
async def get_topics(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CompetitorTopic)
        .where(CompetitorTopic.scraped_profile_id == profile_id)
        .order_by(CompetitorTopic.document_count.desc())
    )
    topics = result.scalars().all()
    return [
        {
            "topic_id": t.topic_id,
            "label": t.topic_label,
            "top_words": t.top_words,
            "document_count": t.document_count,
            "avg_engagement_rate": t.avg_engagement_rate,
        }
        for t in topics
    ]


@router.get("/groups/{group_id}/compare")
async def compare_competitors(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = CompetitorAnalyticsService(db)
    return await service.compare_competitors(group_id)
```

### Step 5: Frontend Dashboard Components

Install Recharts:
```bash
cd frontend
npm install recharts
```

Create `frontend/src/components/competitors/competitor-dashboard.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { FollowerGrowthChart } from "./follower-growth-chart";
import { EngagementChart } from "./engagement-chart";
import { TopContentTable } from "./top-content-table";
import { TopicClusters } from "./topic-clusters";
import { CompetitorComparison } from "./competitor-comparison";

interface CompetitorDashboardProps {
  profileId: string;
}

interface ProfileOverview {
  profile: {
    id: string;
    platform: string;
    username: string;
    display_name: string;
    avatar_url: string;
    follower_count: number;
    following_count: number;
    post_count: number;
    last_scraped_at: string;
  };
  metrics: {
    engagement_rate: number;
    avg_views_per_post: number;
    posting_frequency_per_week: number;
    total_posts_analyzed: number;
  };
}

export function CompetitorDashboard({ profileId }: CompetitorDashboardProps) {
  const [overview, setOverview] = useState<ProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/competitors/profiles/${profileId}/overview`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then(setOverview)
      .finally(() => setLoading(false));
  }, [profileId, accessToken]);

  if (loading || !overview) return <div>Loading...</div>;

  const { profile, metrics } = overview;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          {profile.avatar_url && (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full" />
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold">{profile.display_name}</h2>
            <p className="text-muted-foreground">@{profile.username} on {profile.platform}</p>
          </div>
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold">{(profile.follower_count || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.engagement_rate}%</p>
              <p className="text-xs text-muted-foreground">Engagement Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.avg_views_per_post.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Avg Views/Post</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.posting_frequency_per_week}</p>
              <p className="text-xs text-muted-foreground">Posts/Week</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Analysis */}
      <Tabs defaultValue="engagement">
        <TabsList>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="growth">Follower Growth</TabsTrigger>
          <TabsTrigger value="content">Top Content</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement">
          <EngagementChart profileId={profileId} />
        </TabsContent>

        <TabsContent value="growth">
          <FollowerGrowthChart profileId={profileId} />
        </TabsContent>

        <TabsContent value="content">
          <TopContentTable profileId={profileId} />
        </TabsContent>

        <TabsContent value="topics">
          <TopicClusters profileId={profileId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

Create `frontend/src/components/competitors/engagement-chart.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";

interface EngagementDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  engagement_rate: number;
}

export function EngagementChart({ profileId }: { profileId: string }) {
  const [data, setData] = useState<EngagementDataPoint[]>([]);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/competitors/profiles/${profileId}/engagement?days=30`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
      .then((r) => r.json())
      .then(setData);
  }, [profileId, accessToken]);

  const chartData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement Over Time (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="views" stroke="#3b82f6" name="Views" />
            <Line yAxisId="left" type="monotone" dataKey="likes" stroke="#ef4444" name="Likes" />
            <Line yAxisId="left" type="monotone" dataKey="comments" stroke="#22c55e" name="Comments" />
            <Line yAxisId="right" type="monotone" dataKey="engagement_rate" stroke="#f59e0b" name="ER %" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

Create `frontend/src/components/competitors/follower-growth-chart.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";

export function FollowerGrowthChart({ profileId }: { profileId: string }) {
  const [data, setData] = useState<any[]>([]);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/competitors/profiles/${profileId}/follower-growth?days=90`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
      .then((r) => r.json())
      .then(setData);
  }, [profileId, accessToken]);

  const chartData = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    followers: d.follower_count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Follower Growth (Last 90 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: number) => value.toLocaleString()} />
            <Area type="monotone" dataKey="followers" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

Create `frontend/src/components/competitors/top-content-table.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";

interface TopContent {
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  engagement_rate: number;
  published_at: string | null;
}

export function TopContentTable({ profileId }: { profileId: string }) {
  const [content, setContent] = useState<TopContent[]>([]);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/competitors/profiles/${profileId}/top-content?limit=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
      .then((r) => r.json())
      .then(setContent);
  }, [profileId, accessToken]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performing Content</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Title</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">ER %</TableHead>
              <TableHead>Published</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {content.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {item.thumbnail_url && (
                      <img src={item.thumbnail_url} alt="" className="w-12 h-8 rounded object-cover" />
                    )}
                    <a href={item.url || "#"} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[250px]">
                      {item.title || "Untitled"}
                    </a>
                  </div>
                </TableCell>
                <TableCell className="text-right">{(item.views || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right">{(item.likes || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right">{(item.comments || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium">{item.engagement_rate}%</TableCell>
                <TableCell>
                  {item.published_at
                    ? new Date(item.published_at).toLocaleDateString()
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

Create `frontend/src/components/competitors/topic-clusters.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "@/hooks/use-auth";

interface Topic {
  topic_id: number;
  label: string;
  top_words: string[];
  document_count: number;
  avg_engagement_rate: number;
}

export function TopicClusters({ profileId }: { profileId: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/competitors/profiles/${profileId}/topics`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
      .then((r) => r.json())
      .then(setTopics);
  }, [profileId, accessToken]);

  if (topics.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No topics detected yet. Topics are analyzed after scraping enough content (10+ posts).
        </CardContent>
      </Card>
    );
  }

  const chartData = topics.slice(0, 15).map((t) => ({
    name: t.label.substring(0, 30),
    posts: t.document_count,
    engagement: t.avg_engagement_rate,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Content Topics by Volume and Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={200} />
              <Tooltip />
              <Bar dataKey="posts" fill="#3b82f6" name="Posts" />
              <Bar dataKey="engagement" fill="#22c55e" name="Avg ER %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topic Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topics.map((topic) => (
            <div key={topic.topic_id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{topic.label}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{topic.document_count} posts</Badge>
                  <Badge variant="outline">{topic.avg_engagement_rate}% ER</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {topic.top_words.map((word) => (
                  <Badge key={word} variant="outline" className="text-xs">
                    {word}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

Create `frontend/src/components/competitors/competitor-comparison.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useAuth } from "@/hooks/use-auth";

export function CompetitorComparison({ groupId }: { groupId: string }) {
  const [data, setData] = useState<any[]>([]);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/competitors/groups/${groupId}/compare`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
      .then((r) => r.json())
      .then(setData);
  }, [groupId, accessToken]);

  const chartData = data.map((d) => ({
    name: d.profile.display_name || d.profile.username,
    followers: d.profile.follower_count || 0,
    engagement_rate: d.metrics.engagement_rate,
    avg_views: d.metrics.avg_views_per_post,
    posts_per_week: d.metrics.posting_frequency_per_week,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Engagement Rate Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="engagement_rate" fill="#3b82f6" name="Engagement Rate %" />
              <Bar dataKey="posts_per_week" fill="#22c55e" name="Posts/Week" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Best Practices
- **Time-series granularity:** Store metric snapshots every 6 hours (matching scrape frequency). This gives enough data for daily/weekly/monthly trends without excessive storage.
- **Engagement rate formula:** Standardize across platforms: `(likes + comments + shares) / views * 100`. Some platforms do not expose all metrics — handle missing data gracefully.
- **BERTopic scheduling:** Run topic analysis after each scrape batch, not in real time. It is CPU-intensive and should run on the AI queue.
- **Data retention:** Keep scraped posts for 90 days, metric snapshots for 365 days. Older data can be aggregated into daily summaries.
- **Rate limiting the dashboard:** Cache analytics responses in Redis for 5 minutes to avoid expensive database queries on every page load.

## Testing
- Add a competitor profile via the API and trigger a scrape.
- Verify metrics are computed correctly (engagement rate, posting frequency).
- Run BERTopic analysis and verify topics appear in the dashboard.
- Compare multiple competitors in a group and verify the comparison chart.

## Verification Checklist
- [ ] `competitor_groups`, `competitor_group_members`, `competitor_topics` tables created
- [ ] Track competitor endpoint creates profile and triggers initial scrape
- [ ] Profile overview returns correct engagement rate, avg views, posting frequency
- [ ] Follower growth chart shows time-series data from metric snapshots
- [ ] Engagement chart shows per-post metrics over time
- [ ] Top content table is sortable by views, likes, engagement rate
- [ ] BERTopic detects meaningful topics from competitor content
- [ ] Topic clusters display with top words and engagement rates
- [ ] Competitor comparison chart renders side-by-side metrics
- [ ] Best posting times analysis returns data by hour and day of week
- [ ] Dashboard handles missing data gracefully (null views, missing posts)
- [ ] Recharts renders correctly on all screen sizes
