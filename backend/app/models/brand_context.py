import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class BrandContext(Base):
    __tablename__ = "brand_contexts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    brand_name: Mapped[str] = mapped_column(String(255))
    niche: Mapped[str] = mapped_column(String(100))
    custom_niche: Mapped[str | None] = mapped_column(String(255))
    voice_traits: Mapped[list] = mapped_column(JSONB, default=list)
    target_audience: Mapped[str] = mapped_column(Text, default="")
    goals: Mapped[list] = mapped_column(JSONB, default=list)
    platforms: Mapped[list] = mapped_column(JSONB, default=list)
    posting_frequency: Mapped[str] = mapped_column(String(50), default="")
    uniqueness: Mapped[str] = mapped_column(Text, default="")
    competitors: Mapped[list] = mapped_column(JSONB, default=list)
    intelligence_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    tone_keywords: Mapped[list] = mapped_column(JSONB, default=list)
    content_pillars: Mapped[list] = mapped_column(JSONB, default=list)
    posting_schedule: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="brand_contexts")
