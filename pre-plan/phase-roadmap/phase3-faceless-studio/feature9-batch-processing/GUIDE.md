# Batch Processing — Implementation Guide

## Overview
- **What:** Allow users to create multiple faceless videos at once from a CSV/spreadsheet input, with queue management, per-video progress tracking, and rate-limited GPU usage.
- **Why:** Faceless creators run 3-10 channels and need to produce dozens of videos per week. Batch processing turns hours of manual work into a single upload.
- **Dependencies:** Phase 3 Features 1-8 (all faceless pipeline components)

## Architecture

### Batch Pipeline
```
CSV Upload → Parse & Validate → Create Batch Record (PostgreSQL)
  → For each row: Create FacelessProject + Celery Task
  → Queue with priority (FIFO within batch)
  → Process sequentially (GPU-bound, 1 at a time)
  → Update per-video + overall batch progress
  → Notify on batch completion (webhook or WebSocket)
```

### CSV Format
```csv
topic,style,template,voice,duration,music_mood,audience
"5 Facts About Space",documentary,documentary,af_heart,60,mysterious,general
"Reddit AITA Story",reddit,reddit_story,bf_emma,90,dramatic,young_adults
"Top 10 AI Tools 2026",listicle,listicle,am_adam,120,upbeat,tech
```

### Data Model
```sql
Batch
  - id: UUID (PK)
  - user_id: FK(User)
  - name: string
  - total_items: int
  - completed_items: int
  - failed_items: int
  - status: enum(pending, processing, completed, partial_failure)
  - csv_file: string (GCS path)
  - created_at: timestamp

BatchItem
  - id: UUID (PK)
  - batch_id: FK(Batch)
  - row_index: int
  - faceless_project_id: FK(FacelessProject)?
  - job_id: FK(Job)?
  - input_data: JSON (parsed CSV row)
  - status: enum(pending, queued, processing, completed, failed)
  - error_message: text?
  - created_at: timestamp
```

## Step-by-Step Implementation

### Step 1: Create Batch Models
Create `backend/app/models/batch.py`:
```python
import enum
from sqlalchemy import String, Integer, JSON, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PARTIAL_FAILURE = "partial_failure"
    FAILED = "failed"

class BatchItemStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Batch(BaseModel):
    __tablename__ = "batches"
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    completed_items: Mapped[int] = mapped_column(Integer, default=0)
    failed_items: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[BatchStatus] = mapped_column(Enum(BatchStatus), default=BatchStatus.PENDING)
    items = relationship("BatchItem", back_populates="batch")

class BatchItem(BaseModel):
    __tablename__ = "batch_items"
    batch_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("batches.id"))
    row_index: Mapped[int] = mapped_column(Integer)
    input_data: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[BatchItemStatus] = mapped_column(Enum(BatchItemStatus), default=BatchItemStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    batch = relationship("Batch", back_populates="items")
```

### Step 2: Create Batch Service
Create `backend/app/services/batch_service.py`:
```python
import csv
import io
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.batch import Batch, BatchItem, BatchStatus, BatchItemStatus
from app.services.job_service import JobService
from app.models.job import JobType

REQUIRED_COLUMNS = {"topic"}
VALID_COLUMNS = {"topic", "style", "template", "voice", "duration", "music_mood", "audience", "url", "reddit_post_id"}

class BatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_from_csv(self, user_id: uuid.UUID, csv_content: str, name: str = "Untitled Batch") -> Batch:
        reader = csv.DictReader(io.StringIO(csv_content))
        if not REQUIRED_COLUMNS.issubset(set(reader.fieldnames or [])):
            raise ValueError(f"CSV must include columns: {REQUIRED_COLUMNS}")

        batch = Batch(user_id=user_id, name=name, status=BatchStatus.PENDING)
        self.db.add(batch)

        items = []
        for i, row in enumerate(reader):
            item = BatchItem(
                batch_id=batch.id,
                row_index=i,
                input_data={k: v for k, v in row.items() if k in VALID_COLUMNS and v},
                status=BatchItemStatus.PENDING,
            )
            items.append(item)

        batch.total_items = len(items)
        self.db.add_all(items)
        await self.db.commit()
        return batch

    async def dispatch_batch(self, batch: Batch) -> None:
        """Dispatch all items as a chain of Celery tasks."""
        from app.worker import celery_app
        batch.status = BatchStatus.PROCESSING
        for item in batch.items:
            celery_app.send_task(
                "app.tasks.batch.process_batch_item",
                kwargs={"batch_id": str(batch.id), "item_id": str(item.id)},
                queue="ai",
            )
            item.status = BatchItemStatus.QUEUED
        await self.db.commit()
```

### Step 3: Create Batch Celery Task
Create `backend/app/tasks/batch.py`:
```python
import structlog
from app.worker import celery_app
from app.tasks.base import ProgressTask

logger = structlog.get_logger()

@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.batch.process_batch_item", queue="ai")
def process_batch_item(self, batch_id: str, item_id: str):
    """Process a single batch item (one faceless video)."""
    from app.core.database import async_session
    import asyncio

    async def _process():
        async with async_session() as db:
            from sqlalchemy import select
            from app.models.batch import BatchItem, Batch, BatchItemStatus, BatchStatus

            item = (await db.execute(select(BatchItem).where(BatchItem.id == item_id))).scalar_one()
            batch = (await db.execute(select(Batch).where(Batch.id == batch_id))).scalar_one()

            item.status = BatchItemStatus.PROCESSING
            await db.commit()

            try:
                data = item.input_data
                # Run the faceless pipeline for this item
                from app.services.faceless_service import FacelessService
                service = FacelessService()
                result = await service.create_video(
                    topic=data.get("topic", ""),
                    style=data.get("style", "documentary"),
                    template=data.get("template", "documentary"),
                    voice=data.get("voice", "af_heart"),
                    duration=int(data.get("duration", 60)),
                    music_mood=data.get("music_mood", "calm"),
                )

                item.status = BatchItemStatus.COMPLETED
                batch.completed_items += 1
            except Exception as e:
                logger.error("batch_item.failed", item_id=item_id, error=str(e))
                item.status = BatchItemStatus.FAILED
                item.error_message = str(e)[:500]
                batch.failed_items += 1

            # Check if batch is complete
            if batch.completed_items + batch.failed_items >= batch.total_items:
                batch.status = BatchStatus.COMPLETED if batch.failed_items == 0 else BatchStatus.PARTIAL_FAILURE
            await db.commit()

    asyncio.run(_process())
```

### Step 4: Create Batch API Endpoints
Create `backend/app/api/v1/batch.py`:
```python
from fastapi import APIRouter, Depends, File, UploadFile
from app.core.deps import get_current_user
from app.core.database import get_db
from app.services.batch_service import BatchService

router = APIRouter()

@router.post("/")
async def create_batch(
    file: UploadFile = File(...),
    name: str = "Untitled Batch",
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    csv_content = (await file.read()).decode("utf-8")
    service = BatchService(db)
    batch = await service.create_from_csv(user.id, csv_content, name)
    await service.dispatch_batch(batch)
    return {"batch_id": str(batch.id), "total_items": batch.total_items, "status": "processing"}

@router.get("/{batch_id}")
async def get_batch_status(batch_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    from sqlalchemy import select
    from app.models.batch import Batch
    batch = (await db.execute(select(Batch).where(Batch.id == batch_id))).scalar_one_or_none()
    if not batch:
        from fastapi import HTTPException
        raise HTTPException(404)
    return {
        "id": str(batch.id),
        "name": batch.name,
        "status": batch.status,
        "total": batch.total_items,
        "completed": batch.completed_items,
        "failed": batch.failed_items,
        "progress": (batch.completed_items + batch.failed_items) / max(batch.total_items, 1),
    }
```

## Best Practices
- **Sequential GPU processing:** Batch items run one at a time on the AI queue (concurrency=1). This prevents GPU OOM.
- **Max batch size:** Limit to 50 items per batch. Larger batches should be split.
- **CSV validation upfront:** Validate all rows before dispatching any tasks. Reject the batch if any row has invalid data.
- **Partial failure handling:** Mark batch as `partial_failure` if some items fail. Users can retry failed items individually.

## Testing
- Upload CSV with 3 rows → verify 3 batch items created
- Verify items process sequentially
- Verify batch status updates (progress percentage)
- Test with invalid CSV → verify rejection
- Test with one failing row → verify partial_failure status

## Verification Checklist
- [ ] CSV upload and parsing works
- [ ] Required columns validated
- [ ] Batch items created in PostgreSQL
- [ ] Celery tasks dispatched for each item
- [ ] Items process one at a time (GPU-safe)
- [ ] Per-item status tracking (pending → processing → completed/failed)
- [ ] Overall batch progress tracked
- [ ] Partial failure status when some items fail
- [ ] Batch status API returns correct progress
- [ ] Max batch size enforced
