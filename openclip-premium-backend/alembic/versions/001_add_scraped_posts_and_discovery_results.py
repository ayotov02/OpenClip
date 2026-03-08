"""add scraped_posts and discovery_results tables

Revision ID: 001
Revises:
Create Date: 2026-03-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scraped_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("competitor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("competitors.id", ondelete="SET NULL"), index=True, nullable=True),
        sa.Column("platform", sa.String(20), index=True, nullable=False),
        sa.Column("post_url", sa.String(2048), nullable=False),
        sa.Column("post_type", sa.String(20), server_default="video", nullable=False),
        sa.Column("caption", sa.Text, nullable=True),
        sa.Column("hashtags", postgresql.JSONB, nullable=True),
        sa.Column("mentions", postgresql.JSONB, nullable=True),
        sa.Column("media_url", sa.String(2048), nullable=True),
        sa.Column("thumbnail_url", sa.String(2048), nullable=True),
        sa.Column("likes", sa.Integer, server_default="0", nullable=False),
        sa.Column("views", sa.Integer, server_default="0", nullable=False),
        sa.Column("comments_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("shares", sa.Integer, server_default="0", nullable=False),
        sa.Column("saves", sa.Integer, server_default="0", nullable=False),
        sa.Column("engagement_rate", sa.Float, server_default="0.0", nullable=False),
        sa.Column("author_handle", sa.String(255), nullable=True),
        sa.Column("followers_at_scrape", sa.Integer, server_default="0", nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scraped_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("hook_score", sa.Float, nullable=True),
        sa.Column("body_score", sa.Float, nullable=True),
        sa.Column("cta_score", sa.Float, nullable=True),
        sa.Column("extracted_hook", sa.Text, nullable=True),
        sa.Column("extracted_cta", sa.Text, nullable=True),
        sa.Column("transcript", sa.Text, nullable=True),
        sa.Column("content_category", sa.String(50), nullable=True),
        sa.Column("sentiment", sa.String(20), nullable=True),
        sa.Column("sentiment_confidence", sa.Float, nullable=True),
        sa.Column("niche_relevance", sa.Float, nullable=True),
        sa.Column("ai_analysis", postgresql.JSONB, nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "discovery_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("query", sa.String(500), index=True, nullable=False),
        sa.Column("platform", sa.String(20), index=True, nullable=False),
        sa.Column("post_url", sa.String(2048), nullable=False),
        sa.Column("post_type", sa.String(20), server_default="video", nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("caption", sa.Text, nullable=True),
        sa.Column("media_url", sa.String(2048), nullable=True),
        sa.Column("thumbnail_url", sa.String(2048), nullable=True),
        sa.Column("author_handle", sa.String(255), nullable=True),
        sa.Column("author_followers", sa.Integer, server_default="0", nullable=False),
        sa.Column("likes", sa.Integer, server_default="0", nullable=False),
        sa.Column("views", sa.Integer, server_default="0", nullable=False),
        sa.Column("comments_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("shares", sa.Integer, server_default="0", nullable=False),
        sa.Column("engagement_rate", sa.Float, server_default="0.0", nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("searched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("hook_score", sa.Float, nullable=True),
        sa.Column("body_score", sa.Float, nullable=True),
        sa.Column("cta_score", sa.Float, nullable=True),
        sa.Column("extracted_hook", sa.Text, nullable=True),
        sa.Column("extracted_cta", sa.Text, nullable=True),
        sa.Column("transcript", sa.Text, nullable=True),
        sa.Column("content_category", sa.String(50), nullable=True),
        sa.Column("sentiment", sa.String(20), nullable=True),
        sa.Column("niche_relevance", sa.Float, nullable=True),
        sa.Column("ai_analysis", postgresql.JSONB, nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("discovery_results")
    op.drop_table("scraped_posts")
