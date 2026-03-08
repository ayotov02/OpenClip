import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class DiscoveryResult(Base):
    __tablename__ = "discovery_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # Search context
    query: Mapped[str] = mapped_column(String(500), index=True)

    # Post metadata
    platform: Mapped[str] = mapped_column(String(20), index=True)
    post_url: Mapped[str] = mapped_column(String(2048))
    post_type: Mapped[str] = mapped_column(String(20), default="video")
    title: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    caption: Mapped[str | None] = mapped_column(Text)
    media_url: Mapped[str | None] = mapped_column(String(2048))
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048))

    # Author info
    author_handle: Mapped[str | None] = mapped_column(String(255))
    author_followers: Mapped[int] = mapped_column(Integer, default=0)

    # Engagement metrics
    likes: Mapped[int] = mapped_column(Integer, default=0)
    views: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)

    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    searched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # AI analysis (same schema as ScrapedPost)
    hook_score: Mapped[float | None] = mapped_column(Float)
    body_score: Mapped[float | None] = mapped_column(Float)
    cta_score: Mapped[float | None] = mapped_column(Float)
    extracted_hook: Mapped[str | None] = mapped_column(Text)
    extracted_cta: Mapped[str | None] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text)
    content_category: Mapped[str | None] = mapped_column(String(50))
    sentiment: Mapped[str | None] = mapped_column(String(20))
    niche_relevance: Mapped[float | None] = mapped_column(Float)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="discovery_results")
