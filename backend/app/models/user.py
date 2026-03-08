import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    clerk_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    brand_contexts = relationship("BrandContext", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    faceless_projects = relationship(
        "FacelessProject", back_populates="user", cascade="all, delete-orphan"
    )
    brand_kits = relationship("BrandKit", back_populates="user", cascade="all, delete-orphan")
    calendar_events = relationship(
        "CalendarEvent", back_populates="user", cascade="all, delete-orphan"
    )
    social_accounts = relationship(
        "SocialAccount", back_populates="user", cascade="all, delete-orphan"
    )
    competitors = relationship("Competitor", back_populates="user", cascade="all, delete-orphan")
    batch_jobs = relationship("BatchJob", back_populates="user", cascade="all, delete-orphan")
    creative_assets = relationship(
        "CreativeAsset", back_populates="user", cascade="all, delete-orphan"
    )
    api_keys = relationship("UserApiKey", back_populates="user", cascade="all, delete-orphan")
    webhook_configs = relationship(
        "WebhookConfig", back_populates="user", cascade="all, delete-orphan"
    )
    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
    scraped_posts = relationship("ScrapedPost", back_populates="user", cascade="all, delete-orphan")
    discovery_results = relationship(
        "DiscoveryResult", back_populates="user", cascade="all, delete-orphan"
    )
