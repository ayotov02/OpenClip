import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class ScrapedPost(Base):
    __tablename__ = "scraped_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    competitor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitors.id", ondelete="SET NULL"), index=True
    )

    # Post metadata
    platform: Mapped[str] = mapped_column(String(20), index=True)
    post_url: Mapped[str] = mapped_column(String(2048))
    post_type: Mapped[str] = mapped_column(String(20), default="video")  # video, image, carousel, text
    caption: Mapped[str | None] = mapped_column(Text)
    hashtags: Mapped[list | None] = mapped_column(JSONB)
    mentions: Mapped[list | None] = mapped_column(JSONB)
    media_url: Mapped[str | None] = mapped_column(String(2048))
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048))

    # Engagement metrics
    likes: Mapped[int] = mapped_column(Integer, default=0)
    views: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    saves: Mapped[int] = mapped_column(Integer, default=0)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)

    # Account info at scrape time
    author_handle: Mapped[str | None] = mapped_column(String(255))
    followers_at_scrape: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # AI analysis fields
    hook_score: Mapped[float | None] = mapped_column(Float)
    body_score: Mapped[float | None] = mapped_column(Float)
    cta_score: Mapped[float | None] = mapped_column(Float)
    extracted_hook: Mapped[str | None] = mapped_column(Text)
    extracted_cta: Mapped[str | None] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text)
    content_category: Mapped[str | None] = mapped_column(String(50))
    sentiment: Mapped[str | None] = mapped_column(String(20))
    sentiment_confidence: Mapped[float | None] = mapped_column(Float)
    niche_relevance: Mapped[float | None] = mapped_column(Float)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="scraped_posts")
    competitor = relationship("Competitor", back_populates="scraped_posts")
