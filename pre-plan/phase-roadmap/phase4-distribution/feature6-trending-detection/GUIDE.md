# Trending Detection — Implementation Guide

## Overview
- **What:** Build an automated trending detection system that identifies emerging topics, viral content patterns, and niche-specific trends across social platforms. Uses rate-of-change analysis for engagement metrics, keyword frequency analysis, and BERTopic for automated topic clustering. Includes an alert system that notifies users when a relevant trend is detected.
- **Why:** Creators who ride trends early get disproportionate reach. The window for capitalizing on a trend is 24-72 hours. Automated detection removes the need to manually monitor platforms and gives users a competitive edge by surfacing trends before they peak.
- **Dependencies:** Phase 4 Feature 4 (Scraping Engine — data source), Phase 4 Feature 5 (Competitor Analytics — BERTopic integration), Phase 1 Feature 3 (Celery + Redis), Phase 1 Feature 6 (LLM via Ollama).

## Architecture

### System Design
```
Scraping Engine (every 6h)
  │
  ▼
┌─────────────────────────┐     ┌──────────────────────────┐
│ PostgreSQL               │     │ Trend Detection Pipeline │
│ scraped_posts            │────>│ (Celery task, AI queue)  │
│ scraped_metric_snapshots │     │                          │
│ hashtag_metrics          │     │ 1. Rate-of-change calc   │
└─────────────────────────┘     │ 2. Keyword freq analysis │
                                │ 3. BERTopic clustering   │
                                │ 4. LLM trend summary     │
                                └──────────┬───────────────┘
                                           │
                                           ▼
                                ┌──────────────────────────┐
                                │ detected_trends table     │
                                │ + trend_alerts table      │
                                └──────────┬───────────────┘
                                           │
                              ┌────────────┼────────────────┐
                              ▼            ▼                ▼
                         Dashboard    Email/Push       Webhook
                         (Frontend)   Notification     (n8n)
```

### Trend Detection Algorithms
```
1. RATE OF CHANGE (Engagement Velocity)
   ─────────────────────────────────────
   For each post/hashtag, compute:
     velocity = (metric_now - metric_6h_ago) / metric_6h_ago
     acceleration = velocity_now - velocity_6h_ago
   If velocity > threshold AND acceleration > 0 → trending

2. KEYWORD FREQUENCY (TF-IDF Anomaly)
   ─────────────────────────────────────
   a. Extract keywords from recent posts (last 24h)
   b. Compute TF-IDF against corpus of last 30 days
   c. Keywords with TF-IDF score > 2 std deviations above mean → trending keywords

3. BERTOPIC CLUSTERING (Topic Emergence)
   ─────────────────────────────────────
   a. Run BERTopic on recent posts (last 48h)
   b. Compare topic distribution to baseline (last 30 days)
   c. New topics not in baseline → emerging trends
   d. Existing topics with >50% document increase → surging trends

4. LLM SYNTHESIS (Qwen3)
   ─────────────────────────────────────
   Feed trending signals to Qwen3 for:
   - Human-readable trend summary
   - Relevance score to user's niche
   - Suggested content angles
```

## Step-by-Step Implementation

### Step 1: Database Models

Create `backend/app/models/trend.py`:
```python
import enum
from datetime import datetime

from sqlalchemy import String, Float, Integer, Enum, ForeignKey, Text, DateTime, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class TrendSource(str, enum.Enum):
    ENGAGEMENT_VELOCITY = "engagement_velocity"
    KEYWORD_FREQUENCY = "keyword_frequency"
    TOPIC_EMERGENCE = "topic_emergence"
    HASHTAG_SURGE = "hashtag_surge"


class TrendStatus(str, enum.Enum):
    EMERGING = "emerging"       # Just detected, early stage
    SURGING = "surging"         # Rapid growth
    PEAKING = "peaking"         # Near or at peak
    DECLINING = "declining"     # Past peak, losing momentum
    EXPIRED = "expired"         # No longer trending


class DetectedTrend(BaseModel):
    __tablename__ = "detected_trends"

    platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source: Mapped[TrendSource] = mapped_column(Enum(TrendSource), nullable=False)
    status: Mapped[TrendStatus] = mapped_column(
        Enum(TrendStatus), default=TrendStatus.EMERGING, index=True
    )

    # Trend content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    hashtags: Mapped[list] = mapped_column(JSON, default=list)
    sample_posts: Mapped[list] = mapped_column(JSON, default=list)  # [{"url": ..., "title": ...}]

    # Metrics
    velocity_score: Mapped[float] = mapped_column(Float, default=0.0)
    volume: Mapped[int] = mapped_column(Integer, default=0)  # Number of posts/mentions
    avg_engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)

    # Niche relevance (from LLM analysis)
    niche_tags: Mapped[list] = mapped_column(JSON, default=list)  # ["tech", "gaming", ...]
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-1
    suggested_angles: Mapped[list] = mapped_column(JSON, default=list)  # Content ideas

    # Time tracking
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    peaked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TrendAlert(BaseModel):
    __tablename__ = "trend_alerts"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    trend_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("detected_trends.id"), nullable=False
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    notified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notification_channel: Mapped[str] = mapped_column(String(50), default="in_app")  # in_app, email, webhook


class TrendSubscription(BaseModel):
    """User's niche/keyword subscriptions for trend alerts."""
    __tablename__ = "trend_subscriptions"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    platforms: Mapped[list] = mapped_column(JSON, default=list)  # ["youtube", "tiktok", ...]
    niche_keywords: Mapped[list] = mapped_column(JSON, default=list)  # ["gaming", "fitness", ...]
    min_relevance_score: Mapped[float] = mapped_column(Float, default=0.5)
    notification_channels: Mapped[list] = mapped_column(JSON, default=["in_app"])
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

### Step 2: Trend Detection Service

Create `backend/app/services/trend_detection.py`:
```python
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from math import log

import structlog
from sqlalchemy import select, func, and_, text
from sqlalchemy.orm import Session

from app.models.scraped_data import ScrapedPost
from app.models.trend import DetectedTrend, TrendSource, TrendStatus

logger = structlog.get_logger()


class TrendDetectionService:
    """Detects trends from scraped data using multiple algorithms."""

    def __init__(self, db: Session):
        self.db = db

    def detect_engagement_velocity(self, platform: str) -> list[dict]:
        """
        Algorithm 1: Rate-of-change in engagement metrics.
        Identifies posts/topics with accelerating engagement.
        """
        now = datetime.now(timezone.utc)
        recent_window = now - timedelta(hours=6)
        baseline_window = now - timedelta(hours=48)

        # Get recent posts
        recent_posts = self.db.execute(
            select(ScrapedPost).where(
                and_(
                    ScrapedPost.platform == platform,
                    ScrapedPost.scraped_at >= recent_window,
                )
            )
        ).scalars().all()

        # Get baseline posts
        baseline_posts = self.db.execute(
            select(ScrapedPost).where(
                and_(
                    ScrapedPost.platform == platform,
                    ScrapedPost.scraped_at >= baseline_window,
                    ScrapedPost.scraped_at < recent_window,
                )
            )
        ).scalars().all()

        if not recent_posts or not baseline_posts:
            return []

        # Calculate average engagement rate for recent vs baseline
        def calc_avg_engagement(posts):
            total_eng = sum((p.like_count or 0) + (p.comment_count or 0) + (p.share_count or 0) for p in posts)
            total_views = sum(p.view_count or 0 for p in posts)
            return total_eng / max(total_views, 1) * 100

        recent_er = calc_avg_engagement(recent_posts)
        baseline_er = calc_avg_engagement(baseline_posts)

        velocity = (recent_er - baseline_er) / max(baseline_er, 0.01)

        # Find posts with highest velocity
        high_velocity_posts = []
        for post in recent_posts:
            views = post.view_count or 0
            engagement = (post.like_count or 0) + (post.comment_count or 0) + (post.share_count or 0)
            if views > 0:
                er = engagement / views * 100
                if er > baseline_er * 1.5:  # 50% above baseline
                    high_velocity_posts.append({
                        "post_url": post.post_url,
                        "title": post.title,
                        "engagement_rate": round(er, 2),
                        "views": views,
                        "velocity": round((er - baseline_er) / max(baseline_er, 0.01), 2),
                    })

        high_velocity_posts.sort(key=lambda x: x["velocity"], reverse=True)
        return high_velocity_posts[:20]

    def detect_keyword_trends(self, platform: str) -> list[dict]:
        """
        Algorithm 2: TF-IDF anomaly detection on post titles/descriptions.
        """
        now = datetime.now(timezone.utc)
        recent_window = now - timedelta(hours=24)
        baseline_window = now - timedelta(days=30)

        # Recent documents
        recent_posts = self.db.execute(
            select(ScrapedPost).where(
                and_(
                    ScrapedPost.platform == platform,
                    ScrapedPost.scraped_at >= recent_window,
                )
            )
        ).scalars().all()

        # Baseline documents
        baseline_posts = self.db.execute(
            select(ScrapedPost).where(
                and_(
                    ScrapedPost.platform == platform,
                    ScrapedPost.scraped_at >= baseline_window,
                    ScrapedPost.scraped_at < recent_window,
                )
            )
        ).scalars().all()

        if len(recent_posts) < 5 or len(baseline_posts) < 20:
            return []

        # Extract and normalize keywords
        def extract_keywords(text: str) -> list[str]:
            if not text:
                return []
            # Simple keyword extraction: lowercase, remove special chars, split
            words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
            # Filter common stop words
            stop_words = {
                "the", "and", "for", "are", "but", "not", "you", "all", "can",
                "had", "her", "was", "one", "our", "out", "has", "have", "been",
                "would", "make", "like", "time", "just", "know", "take", "come",
                "could", "than", "look", "only", "into", "year", "some", "them",
                "see", "other", "this", "that", "with", "from", "your", "they",
                "will", "each", "about", "how", "when", "what", "which", "their",
                "said", "she", "many", "then", "its", "over", "also", "back",
                "after", "use", "two", "way", "more", "these", "want", "give",
                "most", "very", "video", "watch", "new", "first", "get",
            }
            return [w for w in words if w not in stop_words]

        # Calculate term frequency in recent posts
        recent_tf = Counter()
        for post in recent_posts:
            keywords = extract_keywords(f"{post.title or ''} {post.description or ''}")
            recent_tf.update(set(keywords))  # Use set to count document frequency

        # Calculate baseline term frequency
        baseline_tf = Counter()
        for post in baseline_posts:
            keywords = extract_keywords(f"{post.title or ''} {post.description or ''}")
            baseline_tf.update(set(keywords))

        # Calculate anomaly score: recent_frequency / baseline_frequency
        trending_keywords = []
        for word, recent_count in recent_tf.most_common(200):
            baseline_count = baseline_tf.get(word, 0)
            # Normalize by document count
            recent_freq = recent_count / len(recent_posts)
            baseline_freq = baseline_count / max(len(baseline_posts), 1)

            if baseline_freq > 0:
                anomaly_score = recent_freq / baseline_freq
            else:
                anomaly_score = recent_freq * 10  # New keyword bonus

            if anomaly_score > 2.0 and recent_count >= 3:  # 2x above baseline, at least 3 mentions
                trending_keywords.append({
                    "keyword": word,
                    "recent_mentions": recent_count,
                    "baseline_avg_mentions": round(baseline_freq * len(recent_posts), 1),
                    "anomaly_score": round(anomaly_score, 2),
                })

        trending_keywords.sort(key=lambda x: x["anomaly_score"], reverse=True)
        return trending_keywords[:30]

    def detect_hashtag_surges(self, platform: str) -> list[dict]:
        """
        Algorithm 3: Detect hashtags with sudden engagement spikes.
        """
        now = datetime.now(timezone.utc)
        recent_window = now - timedelta(hours=24)

        # Get recent posts with hashtags
        recent_posts = self.db.execute(
            select(ScrapedPost).where(
                and_(
                    ScrapedPost.platform == platform,
                    ScrapedPost.scraped_at >= recent_window,
                    ScrapedPost.hashtags.isnot(None),
                )
            )
        ).scalars().all()

        # Count hashtag usage and engagement
        hashtag_stats = defaultdict(lambda: {"count": 0, "total_views": 0, "total_engagement": 0, "posts": []})

        for post in recent_posts:
            if not post.hashtags:
                continue
            for tag in post.hashtags:
                tag = tag.lower().strip()
                stats = hashtag_stats[tag]
                stats["count"] += 1
                stats["total_views"] += post.view_count or 0
                stats["total_engagement"] += (post.like_count or 0) + (post.comment_count or 0)
                if len(stats["posts"]) < 3:
                    stats["posts"].append({"url": post.post_url, "title": post.title})

        # Filter and rank
        surging = []
        for tag, stats in hashtag_stats.items():
            if stats["count"] >= 3:  # At least 3 posts using this hashtag
                avg_views = stats["total_views"] / stats["count"]
                er = stats["total_engagement"] / max(stats["total_views"], 1) * 100
                surging.append({
                    "hashtag": tag,
                    "post_count": stats["count"],
                    "total_views": stats["total_views"],
                    "avg_engagement_rate": round(er, 2),
                    "sample_posts": stats["posts"],
                })

        surging.sort(key=lambda x: x["total_views"], reverse=True)
        return surging[:20]
```

### Step 3: BERTopic Trend Detection

Create `backend/app/services/topic_trend_detection.py`:
```python
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.models.scraped_data import ScrapedPost

logger = structlog.get_logger()


def detect_emerging_topics(db: Session, platform: str) -> list[dict]:
    """
    Run BERTopic on recent posts and compare to baseline to find emerging topics.
    """
    try:
        from bertopic import BERTopic
        from sentence_transformers import SentenceTransformer
    except ImportError:
        logger.error("bertopic_not_installed")
        return []

    now = datetime.now(timezone.utc)
    recent_window = now - timedelta(hours=48)
    baseline_window = now - timedelta(days=30)

    # Get recent documents
    recent_posts = db.execute(
        select(ScrapedPost).where(
            and_(
                ScrapedPost.platform == platform,
                ScrapedPost.scraped_at >= recent_window,
            )
        )
    ).scalars().all()

    # Get baseline documents
    baseline_posts = db.execute(
        select(ScrapedPost).where(
            and_(
                ScrapedPost.platform == platform,
                ScrapedPost.scraped_at >= baseline_window,
                ScrapedPost.scraped_at < recent_window,
            )
        )
    ).scalars().all()

    if len(recent_posts) < 10 or len(baseline_posts) < 20:
        return []

    # Prepare documents
    recent_docs = [
        f"{p.title or ''} {p.description or ''}".strip()
        for p in recent_posts
        if (p.title or p.description)
    ]
    baseline_docs = [
        f"{p.title or ''} {p.description or ''}".strip()
        for p in baseline_posts
        if (p.title or p.description)
    ]

    if len(recent_docs) < 10:
        return []

    # Run BERTopic on recent posts
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    recent_model = BERTopic(
        embedding_model=embedding_model,
        min_topic_size=3,
        nr_topics="auto",
        verbose=False,
    )
    recent_topics, _ = recent_model.fit_transform(recent_docs)

    # Run BERTopic on baseline
    baseline_model = BERTopic(
        embedding_model=embedding_model,
        min_topic_size=5,
        nr_topics="auto",
        verbose=False,
    )
    baseline_topics, _ = baseline_model.fit_transform(baseline_docs)

    # Get topic labels
    recent_topic_info = recent_model.get_topic_info()
    baseline_topic_words = set()
    for topic_id in set(baseline_topics):
        if topic_id != -1:
            words = baseline_model.get_topic(topic_id)
            baseline_topic_words.update(w for w, _ in words[:5])

    # Find emerging topics (in recent but not in baseline)
    emerging = []
    for _, row in recent_topic_info.iterrows():
        topic_id = row["Topic"]
        if topic_id == -1:
            continue

        topic_words = recent_model.get_topic(topic_id)
        top_words = [w for w, _ in topic_words[:10]]

        # Check if this topic is novel (words not in baseline)
        novel_words = [w for w in top_words[:5] if w not in baseline_topic_words]
        novelty_score = len(novel_words) / max(len(top_words[:5]), 1)

        # Calculate topic engagement from source posts
        topic_indices = [i for i, t in enumerate(recent_topics) if t == topic_id]
        topic_posts = [recent_posts[i] for i in topic_indices if i < len(recent_posts)]
        total_views = sum(p.view_count or 0 for p in topic_posts)
        total_engagement = sum(
            (p.like_count or 0) + (p.comment_count or 0)
            for p in topic_posts
        )
        avg_er = total_engagement / max(total_views, 1) * 100

        emerging.append({
            "topic_label": row.get("Name", f"Topic {topic_id}"),
            "top_words": top_words,
            "document_count": row["Count"],
            "novelty_score": round(novelty_score, 2),
            "avg_engagement_rate": round(avg_er, 2),
            "total_views": total_views,
            "sample_posts": [
                {"url": p.post_url, "title": p.title}
                for p in topic_posts[:3]
            ],
        })

    # Sort by novelty * engagement
    emerging.sort(key=lambda x: x["novelty_score"] * x["avg_engagement_rate"], reverse=True)
    return emerging[:15]
```

### Step 4: LLM Trend Synthesis

Create `backend/app/services/trend_synthesis.py`:
```python
import json
import structlog
import httpx

from app.core.config import settings

logger = structlog.get_logger()

TREND_SYNTHESIS_PROMPT = """You are a social media trend analyst. Analyze the following trending signals and provide a summary.

Platform: {platform}
User's Niche: {niche}

TRENDING SIGNALS:

High-velocity posts (engagement surging):
{velocity_data}

Trending keywords (frequency anomalies):
{keyword_data}

Emerging topics (new content clusters):
{topic_data}

Surging hashtags:
{hashtag_data}

Based on these signals, provide:
1. A concise trend title (under 80 characters)
2. A 2-3 sentence description of what's trending and why
3. A relevance score (0.0 to 1.0) for the user's niche: "{niche}"
4. 3 suggested content angles the user could create
5. Relevant niche tags

Respond in JSON:
{{
  "title": "...",
  "description": "...",
  "relevance_score": 0.0,
  "suggested_angles": ["...", "...", "..."],
  "niche_tags": ["...", "..."]
}}"""


async def synthesize_trend(
    platform: str,
    niche: str,
    velocity_data: list[dict],
    keyword_data: list[dict],
    topic_data: list[dict],
    hashtag_data: list[dict],
) -> dict:
    """Use Qwen3 to synthesize trend signals into actionable intelligence."""
    prompt = TREND_SYNTHESIS_PROMPT.format(
        platform=platform,
        niche=niche,
        velocity_data=json.dumps(velocity_data[:5], indent=2),
        keyword_data=json.dumps(keyword_data[:10], indent=2),
        topic_data=json.dumps(topic_data[:5], indent=2),
        hashtag_data=json.dumps(hashtag_data[:10], indent=2),
    )

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": "qwen3:14b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.5},
                },
            )
            response.raise_for_status()
            raw_text = response.json().get("response", "")

            # Extract JSON
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0]
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0]

            return json.loads(raw_text.strip())

    except Exception as e:
        logger.error("trend_synthesis_failed", error=str(e))
        return {
            "title": f"Trending on {platform}",
            "description": "Multiple trending signals detected.",
            "relevance_score": 0.5,
            "suggested_angles": [],
            "niche_tags": [],
        }
```

### Step 5: Celery Tasks for Trend Detection

Create `backend/app/tasks/trends.py`:
```python
import asyncio
from datetime import datetime, timezone

import structlog
from sqlalchemy import select

from app.core.database import get_sync_session
from app.models.trend import (
    DetectedTrend, TrendSource, TrendStatus,
    TrendAlert, TrendSubscription,
)
from app.services.trend_detection import TrendDetectionService
from app.services.topic_trend_detection import detect_emerging_topics
from app.services.trend_synthesis import synthesize_trend
from app.worker import celery_app

logger = structlog.get_logger()

PLATFORMS = ["youtube", "tiktok", "instagram", "x"]


@celery_app.task(name="app.tasks.trends.run_trend_detection")
def run_trend_detection():
    """Main trend detection pipeline. Runs after every scrape cycle."""
    for platform in PLATFORMS:
        detect_platform_trends.delay(platform)


@celery_app.task(name="app.tasks.trends.detect_platform_trends", queue="ai")
def detect_platform_trends(platform: str):
    """Run all trend detection algorithms for a single platform."""
    with get_sync_session() as db:
        service = TrendDetectionService(db)
        now = datetime.now(timezone.utc)

        # Algorithm 1: Engagement velocity
        velocity_results = service.detect_engagement_velocity(platform)

        # Algorithm 2: Keyword frequency anomalies
        keyword_results = service.detect_keyword_trends(platform)

        # Algorithm 3: Hashtag surges
        hashtag_results = service.detect_hashtag_surges(platform)

        # Algorithm 4: BERTopic emerging topics
        topic_results = detect_emerging_topics(db, platform)

        # Only proceed if we have signals
        if not any([velocity_results, keyword_results, hashtag_results, topic_results]):
            logger.info("no_trends_detected", platform=platform)
            return

        # Synthesize with LLM for each niche that has subscribers
        subscriptions = db.execute(
            select(TrendSubscription).where(
                TrendSubscription.is_active.is_(True),
            )
        ).scalars().all()

        # Get unique niches
        niches = set()
        for sub in subscriptions:
            if platform in (sub.platforms or []):
                niches.update(sub.niche_keywords or ["general"])

        for niche in niches:
            try:
                synthesis = asyncio.run(synthesize_trend(
                    platform=platform,
                    niche=niche,
                    velocity_data=velocity_results,
                    keyword_data=keyword_results,
                    topic_data=topic_results,
                    hashtag_data=hashtag_results,
                ))

                # Store detected trend
                trend = DetectedTrend(
                    platform=platform,
                    source=TrendSource.ENGAGEMENT_VELOCITY,
                    status=TrendStatus.EMERGING,
                    title=synthesis.get("title", f"Trending on {platform}"),
                    description=synthesis.get("description", ""),
                    keywords=[k["keyword"] for k in keyword_results[:10]],
                    hashtags=[h["hashtag"] for h in hashtag_results[:10]],
                    sample_posts=[
                        p for results in [velocity_results[:3], hashtag_results[:2]]
                        for p in (results if isinstance(results, list) else [])
                        if isinstance(p, dict) and "post_url" in p
                    ][:5],
                    velocity_score=velocity_results[0]["velocity"] if velocity_results else 0,
                    volume=len(velocity_results) + len(hashtag_results),
                    avg_engagement_rate=sum(
                        v.get("engagement_rate", 0) for v in velocity_results[:10]
                    ) / max(len(velocity_results[:10]), 1),
                    niche_tags=synthesis.get("niche_tags", []),
                    relevance_score=synthesis.get("relevance_score", 0.5),
                    suggested_angles=synthesis.get("suggested_angles", []),
                    first_detected_at=now,
                    last_updated_at=now,
                )
                db.add(trend)
                db.flush()

                # Create alerts for matching subscribers
                for sub in subscriptions:
                    if platform not in (sub.platforms or []):
                        continue
                    # Check niche match
                    niche_match = any(
                        kw.lower() in [t.lower() for t in (synthesis.get("niche_tags", []) + [niche])]
                        for kw in (sub.niche_keywords or [])
                    )
                    if niche_match and trend.relevance_score >= sub.min_relevance_score:
                        alert = TrendAlert(
                            user_id=sub.user_id,
                            trend_id=trend.id,
                            notified_at=now,
                            notification_channel="in_app",
                        )
                        db.add(alert)

                db.commit()
                logger.info(
                    "trend_detected",
                    platform=platform,
                    niche=niche,
                    title=trend.title,
                    relevance=trend.relevance_score,
                )

            except Exception as e:
                logger.error("trend_detection_failed", platform=platform, niche=niche, error=str(e))
                db.rollback()


@celery_app.task(name="app.tasks.trends.update_trend_statuses")
def update_trend_statuses():
    """Periodically update trend statuses (emerging -> surging -> peaking -> declining -> expired)."""
    with get_sync_session() as db:
        service = TrendDetectionService(db)
        now = datetime.now(timezone.utc)

        active_trends = db.execute(
            select(DetectedTrend).where(
                DetectedTrend.status.in_([
                    TrendStatus.EMERGING,
                    TrendStatus.SURGING,
                    TrendStatus.PEAKING,
                ])
            )
        ).scalars().all()

        for trend in active_trends:
            age_hours = (now - trend.first_detected_at).total_seconds() / 3600

            # Simple lifecycle model
            if age_hours > 72:
                trend.status = TrendStatus.EXPIRED
            elif age_hours > 48:
                trend.status = TrendStatus.DECLINING
            elif age_hours > 24 and trend.velocity_score < 1.0:
                trend.status = TrendStatus.PEAKING
                trend.peaked_at = now
            elif trend.velocity_score > 2.0:
                trend.status = TrendStatus.SURGING

            trend.last_updated_at = now

        db.commit()
```

Add to Celery Beat:
```python
celery_app.conf.beat_schedule.update({
    "run-trend-detection": {
        "task": "app.tasks.trends.run_trend_detection",
        "schedule": crontab(hour="*/6"),  # After each scrape cycle
    },
    "update-trend-statuses": {
        "task": "app.tasks.trends.update_trend_statuses",
        "schedule": crontab(hour="*/3"),  # Every 3 hours
    },
})
```

### Step 6: API Endpoints

Create `backend/app/api/v1/trends.py`:
```python
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.trend import DetectedTrend, TrendAlert, TrendSubscription, TrendStatus
from app.models.user import User

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("/")
async def list_trends(
    platform: str | None = Query(None),
    status: str | None = Query(None),
    niche: str | None = Query(None),
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List detected trends."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    conditions = [DetectedTrend.first_detected_at >= since]

    if platform:
        conditions.append(DetectedTrend.platform == platform)
    if status:
        conditions.append(DetectedTrend.status == status)

    result = await db.execute(
        select(DetectedTrend)
        .where(and_(*conditions))
        .order_by(desc(DetectedTrend.velocity_score))
        .limit(50)
    )
    trends = result.scalars().all()

    # Filter by niche relevance if specified
    if niche:
        trends = [
            t for t in trends
            if niche.lower() in [tag.lower() for tag in (t.niche_tags or [])]
            or t.relevance_score >= 0.5
        ]

    return [
        {
            "id": str(t.id),
            "platform": t.platform,
            "status": t.status.value,
            "title": t.title,
            "description": t.description,
            "keywords": t.keywords,
            "hashtags": t.hashtags,
            "velocity_score": t.velocity_score,
            "volume": t.volume,
            "avg_engagement_rate": t.avg_engagement_rate,
            "relevance_score": t.relevance_score,
            "niche_tags": t.niche_tags,
            "suggested_angles": t.suggested_angles,
            "sample_posts": t.sample_posts,
            "first_detected_at": t.first_detected_at.isoformat(),
            "status_label": _get_status_label(t.status),
        }
        for t in trends
    ]


@router.get("/alerts")
async def list_alerts(
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List trend alerts for the current user."""
    conditions = [TrendAlert.user_id == user.id]
    if unread_only:
        conditions.append(TrendAlert.is_read.is_(False))

    result = await db.execute(
        select(TrendAlert, DetectedTrend)
        .join(DetectedTrend, TrendAlert.trend_id == DetectedTrend.id)
        .where(and_(*conditions))
        .order_by(desc(TrendAlert.notified_at))
        .limit(50)
    )
    rows = result.all()

    return [
        {
            "alert_id": str(alert.id),
            "is_read": alert.is_read,
            "notified_at": alert.notified_at.isoformat(),
            "trend": {
                "id": str(trend.id),
                "platform": trend.platform,
                "title": trend.title,
                "description": trend.description,
                "status": trend.status.value,
                "relevance_score": trend.relevance_score,
                "suggested_angles": trend.suggested_angles,
            },
        }
        for alert, trend in rows
    ]


@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TrendAlert).where(
            TrendAlert.id == alert_id,
            TrendAlert.user_id == user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404)
    alert.is_read = True
    await db.commit()
    return {"status": "read"}


# --- Subscriptions ---

@router.post("/subscriptions")
async def create_subscription(
    platforms: list[str],
    niche_keywords: list[str],
    min_relevance_score: float = 0.5,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sub = TrendSubscription(
        user_id=user.id,
        platforms=platforms,
        niche_keywords=niche_keywords,
        min_relevance_score=min_relevance_score,
    )
    db.add(sub)
    await db.commit()
    return {"id": str(sub.id), "status": "active"}


@router.get("/subscriptions")
async def list_subscriptions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TrendSubscription).where(TrendSubscription.user_id == user.id)
    )
    subs = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "platforms": s.platforms,
            "niche_keywords": s.niche_keywords,
            "min_relevance_score": s.min_relevance_score,
            "is_active": s.is_active,
        }
        for s in subs
    ]


def _get_status_label(status: TrendStatus) -> str:
    labels = {
        TrendStatus.EMERGING: "Emerging - Get in early",
        TrendStatus.SURGING: "Surging - Act now",
        TrendStatus.PEAKING: "Peaking - Still time",
        TrendStatus.DECLINING: "Declining - Late but possible",
        TrendStatus.EXPIRED: "Expired",
    }
    return labels.get(status, "Unknown")
```

### Step 7: Frontend Trend Feed Component

Create `frontend/src/components/trends/trend-feed.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

interface Trend {
  id: string;
  platform: string;
  status: string;
  title: string;
  description: string;
  keywords: string[];
  hashtags: string[];
  velocity_score: number;
  volume: number;
  relevance_score: number;
  suggested_angles: string[];
  status_label: string;
  first_detected_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  emerging: "bg-green-100 text-green-800 border-green-200",
  surging: "bg-orange-100 text-orange-800 border-orange-200",
  peaking: "bg-red-100 text-red-800 border-red-200",
  declining: "bg-gray-100 text-gray-600 border-gray-200",
  expired: "bg-gray-50 text-gray-400 border-gray-100",
};

export function TrendFeed() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trends/?days=7`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then(setTrends)
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) return <div>Loading trends...</div>;

  return (
    <div className="space-y-4">
      {trends.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No trends detected yet. Trends are analyzed after scraping data from tracked profiles.
          </CardContent>
        </Card>
      )}

      {trends.map((trend) => (
        <Card key={trend.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{trend.title}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{trend.platform}</Badge>
                <Badge className={STATUS_COLORS[trend.status] || ""}>
                  {trend.status_label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{trend.description}</p>

            {/* Metrics row */}
            <div className="flex gap-4 text-sm">
              <span>Velocity: <strong>{trend.velocity_score}x</strong></span>
              <span>Volume: <strong>{trend.volume}</strong></span>
              <span>Relevance: <strong>{Math.round(trend.relevance_score * 100)}%</strong></span>
            </div>

            {/* Keywords */}
            {trend.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {trend.keywords.slice(0, 8).map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            )}

            {/* Hashtags */}
            {trend.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {trend.hashtags.slice(0, 8).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}

            {/* Suggested content angles */}
            {trend.suggested_angles.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Content ideas:</p>
                <ul className="text-sm space-y-1">
                  {trend.suggested_angles.map((angle, i) => (
                    <li key={i} className="text-muted-foreground">- {angle}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## Best Practices
- **Trend lifecycle:** Trends should progress through statuses automatically. Do not keep stale trends as "emerging" forever. The 72-hour expiry matches the typical trend lifecycle.
- **Relevance filtering:** Always filter trends by the user's niche. Irrelevant trends are noise. Use LLM to assess relevance rather than simple keyword matching.
- **False positive reduction:** Require multiple signals (velocity + keyword + volume) before declaring a trend. Single signals have high false positive rates.
- **Caching:** Cache trend API responses in Redis for 10 minutes. Trends do not change minute-to-minute.
- **Alert fatigue:** Limit alerts to 3-5 per day per user. Prioritize by relevance score.

## Testing
- Seed scraped_posts with mock data simulating a viral post and verify velocity detection triggers.
- Insert posts with a new keyword and verify keyword frequency analysis flags it.
- Run BERTopic on test data and verify emerging topics are detected.
- Verify LLM synthesis returns valid JSON with expected fields.
- Verify alerts are created for subscribed users matching the niche.

## Verification Checklist
- [ ] `detected_trends`, `trend_alerts`, `trend_subscriptions` tables created
- [ ] Engagement velocity algorithm detects posts with surging metrics
- [ ] Keyword frequency analysis identifies anomalous keywords
- [ ] Hashtag surge detection finds trending hashtags
- [ ] BERTopic identifies emerging topics not in baseline
- [ ] LLM synthesis generates human-readable trend summaries
- [ ] Trend lifecycle (emerging -> surging -> peaking -> declining -> expired) updates automatically
- [ ] Trend subscriptions filter by platform and niche
- [ ] Alerts created for matching subscribers
- [ ] Alert read/unread status works
- [ ] Frontend trend feed renders with correct status badges
- [ ] Suggested content angles are actionable and niche-relevant
- [ ] Celery Beat triggers trend detection after each scrape cycle
