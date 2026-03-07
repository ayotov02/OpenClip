# Content Calendar — Implementation Guide

## Overview
- **What:** Build a visual content calendar with monthly and weekly views for scheduling posts across connected social platforms. Includes drag-and-drop rescheduling, time zone handling, and visual status indicators.
- **Why:** Creators need to plan their publishing schedule in advance. A visual calendar is the standard UX for content management — it shows what is going out, when, and on which platform at a glance. This is the scheduling layer that feeds into the auto-posting engine (Feature 3).
- **Dependencies:** Phase 4 Feature 1 (Social OAuth — connected accounts), Phase 1 Feature 2 (FastAPI Backend), Phase 1 Feature 8 (React Frontend).

## Architecture

### System Design
```
Frontend (Next.js)                      Backend (FastAPI)                   Database
  │                                        │                                  │
  │  Calendar Component                    │                                  │
  │  ┌─────────────────────────┐           │                                  │
  │  │ Month / Week toggle     │           │                                  │
  │  │ ┌───┬───┬───┬───┬───┐  │           │                                  │
  │  │ │Mon│Tue│Wed│Thu│Fri│  │           │                                  │
  │  │ │ ● │   │●● │   │ ● │  │  GET /scheduled-posts?range=...             │
  │  │ │   │   │   │   │   │  │──────────>│ ─────────────────────────────────>│
  │  │ └───┴───┴───┴───┴───┘  │           │ Return posts for date range      │
  │  │                         │  <────────│ <─────────────────────────────────│
  │  │  Drag post to new slot  │           │                                  │
  │  │  ────────────────────>  │  PATCH /scheduled-posts/:id                 │
  │  │                         │──────────>│ UPDATE scheduled_at              │
  │  │                         │  <────────│ ─────────────────────────────────>│
  │  └─────────────────────────┘           │                                  │
```

### Data Flow
```
User creates scheduled post:
  1. Select video/clip from library
  2. Choose platform(s) and connected account(s)
  3. Set scheduled date/time (in user's local timezone)
  4. Optionally customize title, description, hashtags per platform
  5. POST /api/v1/scheduled-posts → stored with UTC timestamp
  6. Calendar displays post in user's local timezone
  7. Celery Beat checks every minute for posts due → dispatches publishing task
```

## Step-by-Step Implementation

### Step 1: Database Model

Create `backend/app/models/scheduled_post.py`:
```python
import enum
from datetime import datetime

from sqlalchemy import String, Enum, ForeignKey, Text, DateTime, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScheduledPost(BaseModel):
    __tablename__ = "scheduled_posts"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    social_account_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("social_accounts.id"), nullable=False
    )
    # Reference to the video/clip
    video_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id"), nullable=True
    )
    clip_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clips.id"), nullable=True
    )

    # Platform and content
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["#viral", "#shorts"]
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Platform-specific metadata (visibility, category, etc.)
    platform_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Scheduling
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Status tracking
    status: Mapped[PostStatus] = mapped_column(
        Enum(PostStatus), default=PostStatus.SCHEDULED, index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    platform_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform_post_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # User's timezone at time of scheduling (for display purposes)
    user_timezone: Mapped[str] = mapped_column(String(100), default="UTC")

    # Relationships
    social_account = relationship("SocialAccount", lazy="selectin")
```

Run migration:
```bash
cd backend
alembic revision --autogenerate -m "add scheduled_posts table"
alembic upgrade head
```

### Step 2: Pydantic Schemas

Create `backend/app/schemas/scheduled_post.py`:
```python
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ScheduledPostCreate(BaseModel):
    social_account_id: uuid.UUID
    video_id: uuid.UUID | None = None
    clip_id: uuid.UUID | None = None
    platform: str
    title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None
    thumbnail_url: str | None = None
    platform_metadata: dict | None = None
    scheduled_at: datetime
    user_timezone: str = "UTC"

    @field_validator("scheduled_at")
    @classmethod
    def must_be_future(cls, v: datetime) -> datetime:
        from datetime import timezone
        if v.tzinfo is None:
            raise ValueError("scheduled_at must be timezone-aware (include UTC offset)")
        if v < datetime.now(timezone.utc):
            raise ValueError("scheduled_at must be in the future")
        return v

    @field_validator("platform")
    @classmethod
    def valid_platform(cls, v: str) -> str:
        valid = {"youtube", "tiktok", "instagram", "facebook", "linkedin", "x"}
        if v not in valid:
            raise ValueError(f"platform must be one of: {', '.join(valid)}")
        return v


class ScheduledPostUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    hashtags: list[str] | None = None
    scheduled_at: datetime | None = None
    platform_metadata: dict | None = None
    status: str | None = None


class ScheduledPostResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    social_account_id: uuid.UUID
    video_id: uuid.UUID | None
    clip_id: uuid.UUID | None
    platform: str
    title: str | None
    description: str | None
    hashtags: list[str] | None
    scheduled_at: datetime
    published_at: datetime | None
    status: str
    error_message: str | None
    platform_post_url: str | None
    user_timezone: str
    created_at: datetime
    updated_at: datetime

    # Joined data
    account_display_name: str | None = None
    account_avatar_url: str | None = None

    class Config:
        from_attributes = True


class CalendarQuery(BaseModel):
    start: datetime = Field(..., description="Start of date range (inclusive)")
    end: datetime = Field(..., description="End of date range (exclusive)")
    platform: str | None = Field(None, description="Filter by platform")
    status: str | None = Field(None, description="Filter by status")
```

### Step 3: Backend API Routes

Create `backend/app/api/v1/scheduled_posts.py`:
```python
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.scheduled_post import ScheduledPost, PostStatus
from app.models.user import User
from app.schemas.scheduled_post import (
    ScheduledPostCreate,
    ScheduledPostUpdate,
    ScheduledPostResponse,
)

router = APIRouter(prefix="/scheduled-posts", tags=["scheduled-posts"])


@router.get("/")
async def list_scheduled_posts(
    start: datetime = Query(..., description="Range start (ISO 8601)"),
    end: datetime = Query(..., description="Range end (ISO 8601)"),
    platform: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ScheduledPostResponse]:
    """List scheduled posts within a date range for the calendar view."""
    conditions = [
        ScheduledPost.user_id == user.id,
        ScheduledPost.scheduled_at >= start,
        ScheduledPost.scheduled_at < end,
    ]
    if platform:
        conditions.append(ScheduledPost.platform == platform)
    if status:
        conditions.append(ScheduledPost.status == status)

    result = await db.execute(
        select(ScheduledPost)
        .where(and_(*conditions))
        .order_by(ScheduledPost.scheduled_at)
    )
    posts = result.scalars().all()

    return [
        ScheduledPostResponse(
            **{c.name: getattr(p, c.name) for c in ScheduledPost.__table__.columns},
            account_display_name=p.social_account.platform_display_name if p.social_account else None,
            account_avatar_url=p.social_account.platform_avatar_url if p.social_account else None,
        )
        for p in posts
    ]


@router.post("/", status_code=201)
async def create_scheduled_post(
    payload: ScheduledPostCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledPostResponse:
    """Create a new scheduled post."""
    post = ScheduledPost(
        user_id=user.id,
        social_account_id=payload.social_account_id,
        video_id=payload.video_id,
        clip_id=payload.clip_id,
        platform=payload.platform,
        title=payload.title,
        description=payload.description,
        hashtags=payload.hashtags,
        thumbnail_url=payload.thumbnail_url,
        platform_metadata=payload.platform_metadata,
        scheduled_at=payload.scheduled_at,
        user_timezone=payload.user_timezone,
        status=PostStatus.SCHEDULED,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return ScheduledPostResponse(
        **{c.name: getattr(post, c.name) for c in ScheduledPost.__table__.columns},
    )


@router.patch("/{post_id}")
async def update_scheduled_post(
    post_id: uuid.UUID,
    payload: ScheduledPostUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledPostResponse:
    """Update a scheduled post (reschedule, edit content, cancel)."""
    result = await db.execute(
        select(ScheduledPost).where(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == user.id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    if post.status in (PostStatus.PUBLISHED, PostStatus.PUBLISHING):
        raise HTTPException(status_code=400, detail="Cannot modify a published or publishing post")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(post, key, value)

    await db.commit()
    await db.refresh(post)
    return ScheduledPostResponse(
        **{c.name: getattr(post, c.name) for c in ScheduledPost.__table__.columns},
    )


@router.delete("/{post_id}", status_code=204)
async def delete_scheduled_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a scheduled post."""
    result = await db.execute(
        select(ScheduledPost).where(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == user.id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Scheduled post not found")

    if post.status == PostStatus.PUBLISHING:
        raise HTTPException(status_code=400, detail="Cannot delete a post that is currently publishing")

    await db.delete(post)
    await db.commit()


@router.post("/{post_id}/duplicate", status_code=201)
async def duplicate_scheduled_post(
    post_id: uuid.UUID,
    target_platform: str = Query(...),
    target_account_id: uuid.UUID = Query(...),
    target_scheduled_at: datetime = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledPostResponse:
    """Duplicate a scheduled post to another platform/time (cross-post)."""
    result = await db.execute(
        select(ScheduledPost).where(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == user.id,
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404)

    duplicate = ScheduledPost(
        user_id=user.id,
        social_account_id=target_account_id,
        video_id=original.video_id,
        clip_id=original.clip_id,
        platform=target_platform,
        title=original.title,
        description=original.description,
        hashtags=original.hashtags,
        thumbnail_url=original.thumbnail_url,
        scheduled_at=target_scheduled_at,
        user_timezone=original.user_timezone,
        status=PostStatus.SCHEDULED,
    )
    db.add(duplicate)
    await db.commit()
    await db.refresh(duplicate)
    return ScheduledPostResponse(
        **{c.name: getattr(duplicate, c.name) for c in ScheduledPost.__table__.columns},
    )
```

### Step 4: Install Frontend Dependencies

```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns
```

### Step 5: Calendar API Hook

Create `frontend/src/hooks/use-scheduled-posts.ts`:
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

export interface ScheduledPost {
  id: string;
  platform: string;
  title: string | null;
  description: string | null;
  hashtags: string[] | null;
  scheduled_at: string;
  published_at: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  error_message: string | null;
  platform_post_url: string | null;
  account_display_name: string | null;
  account_avatar_url: string | null;
  user_timezone: string;
}

export function useScheduledPosts(start: Date, end: Date, platform?: string) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { accessToken } = useAuth();

  const fetchPosts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });
      if (platform) params.set("platform", platform);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/scheduled-posts/?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (response.ok) {
        setPosts(await response.json());
      }
    } catch (error) {
      console.error("Failed to fetch scheduled posts", error);
    } finally {
      setLoading(false);
    }
  }, [accessToken, start.toISOString(), end.toISOString(), platform]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const reschedule = async (postId: string, newDate: Date) => {
    if (!accessToken) return;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/scheduled-posts/${postId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scheduled_at: newDate.toISOString() }),
      },
    );
    if (response.ok) {
      await fetchPosts();
    }
    return response.ok;
  };

  const deletePost = async (postId: string) => {
    if (!accessToken) return;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/scheduled-posts/${postId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (response.ok) {
      await fetchPosts();
    }
    return response.ok;
  };

  return { posts, loading, refetch: fetchPosts, reschedule, deletePost };
}
```

### Step 6: Calendar Component — Monthly View

Create `frontend/src/components/calendar/content-calendar.tsx`:
```tsx
"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay,
} from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, closestCorners } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { useScheduledPosts, ScheduledPost } from "@/hooks/use-scheduled-posts";
import { CalendarDayCell } from "./calendar-day-cell";
import { CalendarPostCard } from "./calendar-post-card";
import { SchedulePostDialog } from "./schedule-post-dialog";

type ViewMode = "month" | "week";

export function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draggedPost, setDraggedPost] = useState<ScheduledPost | null>(null);

  // Compute date range for current view
  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return {
        rangeStart: calStart,
        rangeEnd: calEnd,
        days: eachDayOfInterval({ start: calStart, end: calEnd }),
      };
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        rangeStart: weekStart,
        rangeEnd: weekEnd,
        days: eachDayOfInterval({ start: weekStart, end: weekEnd }),
      };
    }
  }, [currentDate, viewMode]);

  const { posts, loading, refetch, reschedule } = useScheduledPosts(rangeStart, rangeEnd);

  // Group posts by day
  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const post of posts) {
      const dayKey = format(new Date(post.scheduled_at), "yyyy-MM-dd");
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(post);
    }
    return map;
  }, [posts]);

  // Navigation
  const goNext = () => {
    setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  };
  const goPrev = () => {
    setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  // Drag and drop handler
  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedPost(null);
    const { active, over } = event;
    if (!over) return;

    const postId = active.id as string;
    const targetDateStr = over.id as string;
    const targetDate = new Date(targetDateStr);

    // Keep the same time, just change the date
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const originalDate = new Date(post.scheduled_at);
    const newScheduledAt = new Date(targetDate);
    newScheduledAt.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

    await reschedule(postId, newScheduledAt);
  };

  const handleDragStart = (event: any) => {
    const post = posts.find((p) => p.id === event.active.id);
    if (post) setDraggedPost(post);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            &larr;
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goNext}>
            &rarr;
          </Button>
          <h2 className="text-xl font-semibold ml-4">
            {format(currentDate, viewMode === "month" ? "MMMM yyyy" : "'Week of' MMM d, yyyy")}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid grid-cols-7 flex-1 ${viewMode === "week" ? "grid-rows-1" : ""}`}>
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(dayKey) || [];
            return (
              <CalendarDayCell
                key={dayKey}
                date={day}
                posts={dayPosts}
                isCurrentMonth={viewMode === "month" ? isSameMonth(day, currentDate) : true}
                isToday={isToday(day)}
                onClick={() => handleDayClick(day)}
              />
            );
          })}
        </div>

        <DragOverlay>
          {draggedPost ? <CalendarPostCard post={draggedPost} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Schedule post dialog */}
      {selectedDate && (
        <SchedulePostDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultDate={selectedDate}
          onCreated={refetch}
        />
      )}
    </div>
  );
}
```

### Step 7: Calendar Day Cell Component

Create `frontend/src/components/calendar/calendar-day-cell.tsx`:
```tsx
"use client";

import { format } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ScheduledPost } from "@/hooks/use-scheduled-posts";
import { CalendarPostCard } from "./calendar-post-card";

interface CalendarDayCellProps {
  date: Date;
  posts: ScheduledPost[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onClick: () => void;
}

export function CalendarDayCell({ date, posts, isCurrentMonth, isToday, onClick }: CalendarDayCellProps) {
  const dayKey = format(date, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({ id: dayKey });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "border-r border-b p-1 min-h-[120px] cursor-pointer transition-colors",
        !isCurrentMonth && "bg-muted/30 text-muted-foreground",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset",
        isToday && "bg-blue-50 dark:bg-blue-950/20",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
            isToday && "bg-primary text-primary-foreground",
          )}
        >
          {format(date, "d")}
        </span>
        {posts.length > 0 && (
          <span className="text-xs text-muted-foreground">{posts.length} post{posts.length > 1 ? "s" : ""}</span>
        )}
      </div>

      <div className="space-y-1 max-h-[80px] overflow-y-auto">
        {posts.slice(0, 3).map((post) => (
          <CalendarPostCard key={post.id} post={post} />
        ))}
        {posts.length > 3 && (
          <p className="text-xs text-muted-foreground text-center">+{posts.length - 3} more</p>
        )}
      </div>
    </div>
  );
}
```

### Step 8: Calendar Post Card (Draggable)

Create `frontend/src/components/calendar/calendar-post-card.tsx`:
```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { ScheduledPost } from "@/hooks/use-scheduled-posts";
import { format } from "date-fns";

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200",
  tiktok: "bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200",
  instagram: "bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-200",
  facebook: "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200",
  linkedin: "bg-sky-100 border-sky-300 text-sky-800 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-200",
  x: "bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200",
};

const STATUS_INDICATORS: Record<string, { dot: string; label: string }> = {
  draft: { dot: "bg-gray-400", label: "Draft" },
  scheduled: { dot: "bg-yellow-400", label: "Scheduled" },
  publishing: { dot: "bg-blue-400 animate-pulse", label: "Publishing..." },
  published: { dot: "bg-green-400", label: "Published" },
  failed: { dot: "bg-red-500", label: "Failed" },
  cancelled: { dot: "bg-gray-300", label: "Cancelled" },
};

interface CalendarPostCardProps {
  post: ScheduledPost;
  isDragging?: boolean;
}

export function CalendarPostCard({ post, isDragging }: CalendarPostCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: post.id,
    disabled: post.status === "published" || post.status === "publishing",
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const platformColor = PLATFORM_COLORS[post.platform] || PLATFORM_COLORS.youtube;
  const statusInfo = STATUS_INDICATORS[post.status] || STATUS_INDICATORS.scheduled;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "px-2 py-1 rounded border text-xs cursor-grab truncate",
        platformColor,
        isDragging && "opacity-70 shadow-lg z-50",
        post.status === "published" && "opacity-60",
        post.status === "failed" && "ring-1 ring-red-500",
      )}
      title={`${post.title || "Untitled"} - ${statusInfo.label} - ${format(new Date(post.scheduled_at), "h:mm a")}`}
    >
      <div className="flex items-center gap-1">
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusInfo.dot)} />
        <span className="truncate">{post.title || "Untitled"}</span>
        <span className="text-[10px] ml-auto flex-shrink-0">
          {format(new Date(post.scheduled_at), "h:mm a")}
        </span>
      </div>
    </div>
  );
}
```

### Step 9: Schedule Post Dialog

Create `frontend/src/components/calendar/schedule-post-dialog.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { format } from "date-fns";

interface SchedulePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: Date;
  onCreated: () => void;
}

interface ConnectedAccount {
  id: string;
  platform: string;
  platform_display_name: string | null;
}

export function SchedulePostDialog({ open, onOpenChange, defaultDate, onCreated }: SchedulePostDialogProps) {
  const { accessToken } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !accessToken) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/oauth/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => setAccounts(data.filter((a: any) => a.is_active)));
  }, [open, accessToken]);

  const handleSubmit = async () => {
    if (!selectedAccountId || !accessToken) return;

    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) return;

    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const scheduledAt = new Date(defaultDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/scheduled-posts/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            social_account_id: selectedAccountId,
            platform: account.platform,
            title: title || null,
            description: description || null,
            hashtags: hashtags ? hashtags.split(",").map((h) => h.trim()) : null,
            scheduled_at: scheduledAt.toISOString(),
            user_timezone: userTimezone,
          }),
        },
      );

      if (response.ok) {
        toast.success("Post scheduled!");
        onOpenChange(false);
        onCreated();
        // Reset form
        setTitle("");
        setDescription("");
        setHashtags("");
        setSelectedAccountId("");
      } else {
        const err = await response.json();
        toast.error(err.detail || "Failed to schedule post");
      }
    } catch (error) {
      toast.error("Failed to schedule post");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Post — {format(defaultDate, "EEEE, MMMM d, yyyy")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Platform Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.platform_display_name} ({account.platform})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Time</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>

          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Post description..."
              rows={3}
            />
          </div>

          <div>
            <Label>Hashtags (comma-separated)</Label>
            <Input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#viral, #shorts, #fyp"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !selectedAccountId}>
              {submitting ? "Scheduling..." : "Schedule Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 10: Time Zone Handling Utility

Create `frontend/src/lib/timezone.ts`:
```typescript
/**
 * Get the user's IANA timezone string (e.g., "America/New_York").
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert a UTC ISO string to a local Date in the user's timezone.
 * The Date object itself is always UTC internally, but this ensures
 * correct display when formatting.
 */
export function utcToLocal(utcIsoString: string): Date {
  return new Date(utcIsoString);
}

/**
 * Format a UTC ISO string in the user's local timezone.
 */
export function formatInLocalTimezone(
  utcIsoString: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = new Date(utcIsoString);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getUserTimezone(),
    ...options,
  }).format(date);
}

/**
 * Create a UTC Date from local date and time inputs.
 * Used when user picks a date and time in their local timezone.
 */
export function localToUtc(localDate: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(":").map(Number);
  const local = new Date(localDate);
  local.setHours(hours, minutes, 0, 0);
  return local; // JavaScript Date.toISOString() automatically converts to UTC
}
```

## Best Practices
- **Always store in UTC:** All `scheduled_at` values are stored as UTC in PostgreSQL (`TIMESTAMP WITH TIME ZONE`). The user's timezone is stored separately for display purposes.
- **Optimistic UI updates:** On drag-and-drop, update the UI immediately and revert if the API call fails.
- **Date range queries:** Always query by range (`start <= scheduled_at < end`) with indexes on `scheduled_at` and `status` columns.
- **Prevent double-publishing:** The `publishing` status acts as a lock. Celery tasks check status before publishing.
- **Cross-posting:** Use the `duplicate` endpoint to schedule the same content to multiple platforms with platform-specific customization.

## Testing
- **Backend unit tests:** Test CRUD endpoints, date range filtering, timezone handling, validation (future dates only).
- **Frontend unit tests:** Test calendar rendering, day grouping, drag-and-drop state management.
- **Integration test:** Schedule a post via the UI, verify it appears in the correct day cell, drag it to a new day, verify the API was called.

```python
# backend/tests/test_scheduled_posts.py
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_scheduled_post(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/scheduled-posts/",
        json={
            "social_account_id": "valid-account-uuid",
            "platform": "youtube",
            "title": "Test Video",
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "user_timezone": "America/New_York",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "scheduled"
    assert data["platform"] == "youtube"


@pytest.mark.asyncio
async def test_reject_past_date(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/scheduled-posts/",
        json={
            "social_account_id": "valid-account-uuid",
            "platform": "youtube",
            "scheduled_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
        },
        headers=auth_headers,
    )
    assert response.status_code == 422  # Validation error
```

## Verification Checklist
- [ ] `scheduled_posts` table created with proper indexes on `scheduled_at` and `status`
- [ ] CRUD API endpoints work (create, list, update, delete, duplicate)
- [ ] Date range queries return correct posts for the calendar view
- [ ] Scheduled times are stored in UTC and displayed in the user's local timezone
- [ ] Monthly calendar view renders correctly with posts grouped by day
- [ ] Weekly calendar view renders correctly
- [ ] Drag-and-drop rescheduling works (post moves to new day, API called)
- [ ] Visual status indicators show correct colors for each status
- [ ] Published/publishing posts cannot be dragged
- [ ] Schedule post dialog creates posts with correct timezone handling
- [ ] Platform color coding distinguishes posts by platform
- [ ] Calendar navigation (previous/next month/week, today) works correctly
- [ ] Posts show truncated title and time in cell, full details on hover
- [ ] Overflow handling when many posts are on one day ("+N more" indicator)
