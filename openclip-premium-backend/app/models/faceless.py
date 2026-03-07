import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class FacelessProject(Base):
    __tablename__ = "faceless_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    topic: Mapped[str] = mapped_column(Text, default="")
    template: Mapped[str] = mapped_column(String(50), default="educational")
    tts_voice: Mapped[str] = mapped_column(String(100), default="")
    music_mood: Mapped[str | None] = mapped_column(String(50))
    script: Mapped[dict | None] = mapped_column(JSONB)
    output_file: Mapped[str | None] = mapped_column(Text)
    thumbnail: Mapped[str | None] = mapped_column(Text)
    duration: Mapped[float | None] = mapped_column(Float)
    aspect_ratio: Mapped[str] = mapped_column(String(10), default="9:16")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user = relationship("User", back_populates="faceless_projects")
    scenes = relationship("FacelessScene", back_populates="project", cascade="all, delete-orphan")


class FacelessScene(Base):
    __tablename__ = "faceless_scenes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faceless_projects.id", ondelete="CASCADE"), index=True
    )
    order: Mapped[int] = mapped_column(Integer)
    narration: Mapped[str] = mapped_column(Text, default="")
    duration_est: Mapped[float] = mapped_column(Float, default=5.0)
    search_keywords: Mapped[list] = mapped_column(JSONB, default=list)
    mood: Mapped[str] = mapped_column(String(50), default="neutral")
    visual_description: Mapped[str] = mapped_column(Text, default="")
    broll_results: Mapped[list | None] = mapped_column(JSONB)
    audio_file: Mapped[str | None] = mapped_column(Text)
    video_file: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project = relationship("FacelessProject", back_populates="scenes")
