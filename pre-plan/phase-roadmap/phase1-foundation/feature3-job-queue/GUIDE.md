# Job Queue (Redis + Celery) — Implementation Guide

## Overview
- **What:** Set up Redis as a message broker and Celery as the distributed task queue for all async processing (video, AI inference, publishing, scraping).
- **Why:** Video processing and AI inference are long-running operations (minutes to hours). A job queue enables async processing, progress tracking, retries, and concurrent job management.
- **Dependencies:** Feature 1 (Project Setup), Feature 2 (FastAPI Backend)

## Architecture

### Queue Design
```
API Request → Create Job Record (PostgreSQL) → Dispatch Celery Task
  → Redis Broker → Worker picks up task
  → Worker processes (FFmpeg, AI inference, etc.)
  → Worker updates job status via Redis pub/sub
  → Client polls or receives WebSocket update
```

### Queue Routing
```
Queues:
  default  → General tasks (metadata extraction, thumbnails)   | Concurrency: 4
  video    → Video processing (FFmpeg cutting, encoding)        | Concurrency: 2
  ai       → AI inference (Whisper, LLM, YOLO, TTS)           | Concurrency: 1 (GPU-bound)
  publish  → Social media publishing                            | Concurrency: 4
  scrape   → Web scraping jobs                                  | Concurrency: 2

Priority: ai > video > default > publish > scrape
```

### Job State Machine
```
PENDING → STARTED → PROGRESS(%) → SUCCESS
                               ↘ FAILURE → RETRY (max 3) → DEAD
```

## GCP Deployment
- **Redis:** Memorystore for Redis (2GB Standard tier)
- **Workers:** Compute Engine g2-standard-8 with L4 GPU (for AI queue)
- **Workers (CPU):** Cloud Run Jobs or e2-standard-4 (for default/publish/scrape)
- **Cost estimate:** $70 (Redis) + $150-300 (GPU worker) = $220-370/month

## Step-by-Step Implementation

### Step 1: Install Celery Dependencies
Already in `requirements.txt`:
```
celery[redis]>=5.4.0
redis>=5.2.0
```

### Step 2: Create Celery App Configuration
Create `backend/app/worker.py`:
```python
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "openclip",
    broker=settings.REDIS_URL,
    backend=f"{settings.REDIS_URL}/1",
)

celery_app.conf.update(
    # Task routing
    task_routes={
        "app.tasks.video.*": {"queue": "video"},
        "app.tasks.ai.*": {"queue": "ai"},
        "app.tasks.publish.*": {"queue": "publish"},
        "app.tasks.scrape.*": {"queue": "scrape"},
    },
    # Reliability
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=3600,         # 1 hour hard limit
    task_soft_time_limit=3000,    # 50 min soft limit
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Results
    result_expires=86400,         # 24 hours
    # Retry
    task_default_retry_delay=60,
    task_max_retries=3,
)

celery_app.autodiscover_tasks(["app.tasks"])
```

### Step 3: Create Job Database Model
Create `backend/app/models/job.py`:
```python
import enum

from sqlalchemy import String, Float, JSON, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    STARTED = "started"
    PROGRESS = "progress"
    SUCCESS = "success"
    FAILURE = "failure"
    RETRY = "retry"


class JobType(str, enum.Enum):
    CLIP = "clip"
    TRANSCRIBE = "transcribe"
    REFRAME = "reframe"
    TTS = "tts"
    FACELESS = "faceless"
    PUBLISH = "publish"
    SCRAPE = "scrape"


class Job(BaseModel):
    __tablename__ = "jobs"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    type: Mapped[JobType] = mapped_column(Enum(JobType))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_data: Mapped[dict] = mapped_column(JSON, default=dict)
    result_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
```

### Step 4: Create Task Base Class with Progress Reporting
Create `backend/app/tasks/base.py`:
```python
from celery import Task

from app.worker import celery_app


class ProgressTask(Task):
    """Base task that reports progress via Celery metadata."""

    def update_progress(self, progress: float, message: str = ""):
        self.update_state(
            state="PROGRESS",
            meta={"progress": progress, "message": message},
        )
```

### Step 5: Create Example Video Task
Create `backend/app/tasks/video.py`:
```python
import structlog

from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.video.process_clip")
def process_clip(self, job_id: str, project_id: str, clip_settings: dict):
    """Process a video clip: transcribe → analyze → cut → caption → export."""
    logger.info("clip.start", job_id=job_id, project_id=project_id)

    try:
        # Step 1: Extract audio
        self.update_progress(0.1, "Extracting audio...")
        # ffmpeg_extract_audio(...)

        # Step 2: Transcribe
        self.update_progress(0.3, "Transcribing with WhisperX...")
        # whisper_transcribe(...)

        # Step 3: Analyze with LLM
        self.update_progress(0.5, "Analyzing transcript with AI...")
        # llm_analyze(...)

        # Step 4: Cut clips
        self.update_progress(0.7, "Cutting clips...")
        # ffmpeg_cut_clips(...)

        # Step 5: Apply captions
        self.update_progress(0.9, "Applying captions...")
        # apply_captions(...)

        self.update_progress(1.0, "Complete")
        return {"status": "success", "clips": []}

    except Exception as exc:
        logger.error("clip.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc)
```

### Step 6: Create Job Service
Create `backend/app/services/job_service.py`:
```python
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job, JobStatus, JobType
from app.worker import celery_app


class JobService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_job(
        self, user_id: uuid.UUID, job_type: JobType, input_data: dict
    ) -> Job:
        job = Job(
            user_id=user_id,
            type=job_type,
            status=JobStatus.PENDING,
            input_data=input_data,
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def dispatch(self, job: Job, task_name: str, **kwargs) -> str:
        result = celery_app.send_task(task_name, kwargs={"job_id": str(job.id), **kwargs})
        job.celery_task_id = result.id
        job.status = JobStatus.STARTED
        await self.db.commit()
        return result.id

    async def get_job(self, job_id: uuid.UUID) -> Job | None:
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        return result.scalar_one_or_none()

    def get_progress(self, celery_task_id: str) -> dict:
        result = celery_app.AsyncResult(celery_task_id)
        if result.state == "PROGRESS":
            return result.info
        return {"progress": 1.0 if result.successful() else 0.0, "state": result.state}
```

### Step 7: Create Jobs API Endpoint
Create `backend/app/api/v1/jobs.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.job_service import JobService

router = APIRouter()


@router.get("/{job_id}")
async def get_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service = JobService(db)
    job = await service.get_job(job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404)

    progress = {}
    if job.celery_task_id:
        progress = service.get_progress(job.celery_task_id)

    return {
        "id": str(job.id),
        "type": job.type,
        "status": job.status,
        "progress": progress,
        "result": job.result_data,
        "error": job.error_message,
        "created_at": job.created_at.isoformat(),
    }
```

### Step 8: Worker Launch Commands
```bash
# Start worker for all queues (development)
celery -A app.worker worker -l info -Q default,video,ai,publish,scrape

# Start GPU worker (production — one per GPU)
celery -A app.worker worker -l info -Q ai -c 1 --hostname=gpu-worker@%h

# Start CPU worker (production)
celery -A app.worker worker -l info -Q default,video,publish,scrape -c 4

# Start Celery Beat (scheduled tasks)
celery -A app.worker beat -l info
```

## Best Practices
- **`task_acks_late=True`:** Don't acknowledge task until complete — prevents task loss on worker crash.
- **Separate GPU queue:** AI tasks should have concurrency=1 per GPU to avoid OOM.
- **Soft time limit:** Use soft limit for graceful cleanup before hard kill.
- **Progress tracking:** Use `update_state` for real-time progress (consumed via polling or WebSocket).
- **Idempotent tasks:** Design tasks to be safely retried (use job_id as idempotency key).

## Testing
- Start Redis: `docker run -d -p 6379:6379 redis:7-alpine`
- Start worker: `celery -A app.worker worker -l info`
- Send test task: `celery_app.send_task("app.tasks.video.process_clip", kwargs={...})`
- Monitor: `celery -A app.worker flower` (Flower monitoring UI)

## Verification Checklist
- [ ] Redis connection works
- [ ] Celery worker starts and connects to Redis
- [ ] Tasks dispatch from FastAPI to worker
- [ ] Task routing sends tasks to correct queues
- [ ] Progress updates are visible via job status endpoint
- [ ] Failed tasks retry up to 3 times
- [ ] Job records persist in PostgreSQL
- [ ] Worker handles graceful shutdown (SIGTERM)
