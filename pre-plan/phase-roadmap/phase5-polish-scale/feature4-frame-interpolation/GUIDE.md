# Frame Interpolation — Implementation Guide

## Overview
- **What:** Deploy RIFE (Real-Time Intermediate Flow Estimation, Apache 2.0 license) on GCP Compute Engine with L4 GPU to create smooth slow-motion effects from normal-speed video. Support 2x and 4x frame interpolation via intermediate frame synthesis.
- **Why:** Slow-motion is one of the most requested effects for faceless videos (dramatic reveals, product showcases, cinematic B-roll). Normally, slow-motion requires high-FPS source footage (120fps+). RIFE generates convincing intermediate frames from standard 24/30fps video, enabling slow-mo from any source material.
- **Dependencies:** Phase 1 Feature 3 (Celery Job Queue), Phase 1 Feature 4 (Video Processing / FFmpeg), GCP Compute Engine with GPU

## Architecture

### System Design
```
Input Video (30fps normal speed)
  |
  v
[1] FFmpeg: Extract metadata (fps, resolution, duration)
  |
  v
[2] FFmpeg: Extract frames as PNGs
  -> frames/frame_0001.png, frame_0002.png, ...
  |
  v
[3] RIFE: Generate intermediate frames between each pair
  -> 2x: insert 1 frame between each pair (30fps -> 60fps)
  -> 4x: insert 3 frames between each pair (30fps -> 120fps)
  -> interp/frame_0001.png, frame_0001_1.png, frame_0002.png, ...
  |
  v
[4] FFmpeg: Reassemble at original fps (creating slow-motion)
  -> 2x interp at 30fps = 2x slow motion
  -> 4x interp at 30fps = 4x slow motion
  |
  v
[5] Optional: Trim/segment specific portions for slow-mo
  -> Apply interpolation only to selected time ranges
  |
  v
Output Video (smooth slow-motion)
```

### Data Flow
```
+-------------------+
| Client Request    |
| POST /interpolate |
+--------+----------+
         |
         v
+-------------------+        +-----------------+
| FastAPI Backend   |------->| Redis Queue     |
| Create job record |        | (gpu queue)     |
+-------------------+        +--------+--------+
                                      |
                                      v
                             +-------------------+
                             | Celery Worker     |
                             | (Compute Engine)  |
                             +-------------------+
                                      |
                                      v
                             +-------------------+
                             | RIFE Service      |
                             | Interpolate pairs |
                             | GPU: NVIDIA L4    |
                             +-------------------+
                                      |
                                      v
                             +-------------------+
                             | FFmpeg Reassemble |
                             | at original fps   |
                             | = slow motion     |
                             +-------------------+
                                      |
                                      v
                             +-------------------+
                             | GCS Upload        |
                             +-------------------+
```

### API Endpoints
```
POST   /api/v1/interpolate                -> Start interpolation job
GET    /api/v1/interpolate/{job_id}       -> Get job status and progress
GET    /api/v1/interpolate/{job_id}/preview -> Get preview (side-by-side original vs slow-mo GIF)
DELETE /api/v1/interpolate/{job_id}       -> Cancel job
```

## GCP Deployment
- **Service:** GCP Compute Engine (can share instance with upscaler if on same MIG)
- **Machine type:** g2-standard-4 (4 vCPU, 16GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM) — RIFE is lightweight, uses ~2-4GB VRAM
- **Disk:** 100GB SSD
- **Docker image:** `us-central1-docker.pkg.dev/openclip-prod/openclip-images/rife`
- **Cost estimate:** ~$0.35/hour per instance; RIFE is fast (~100+ fps on L4), so per-job cost is low

## Step-by-Step Implementation

### Step 1: Database Migration

Create `backend/alembic/versions/xxxx_add_interpolation_jobs.py`:
```python
"""Add interpolation_jobs table

Revision ID: d4e5f6g7h8i9
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "d4e5f6g7h8i9"
down_revision = "<previous_migration>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interpolation_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_video_id", UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("multiplier", sa.Integer, nullable=False),  # 2 or 4
        sa.Column("start_time_sec", sa.Float, nullable=True),  # null = whole video
        sa.Column("end_time_sec", sa.Float, nullable=True),
        sa.Column("source_fps", sa.Float, nullable=True),
        sa.Column("output_fps", sa.Float, nullable=True),
        sa.Column("total_frames", sa.Integer, nullable=True),
        sa.Column("output_frames", sa.Integer, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_video_url", sa.String(2048), nullable=True),
        sa.Column("preview_url", sa.String(2048), nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("processing_time_sec", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_interpolation_jobs_user_id", "interpolation_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_table("interpolation_jobs")
```

### Step 2: SQLAlchemy Model

Create `backend/app/models/interpolation.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class InterpolationJob(Base):
    __tablename__ = "interpolation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )
    multiplier: Mapped[int] = mapped_column(Integer, nullable=False)  # 2 or 4
    start_time_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_time_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    output_fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_frames: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_frames: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    output_video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_time_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### Step 3: RIFE Microservice

Create `services/rife/app.py`:
```python
import os
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="OpenClip RIFE Frame Interpolation Service")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
model = None


@app.on_event("startup")
async def load_model():
    global model
    # Load RIFE model (using practical-rife package or from source)
    from inference import Model
    model = Model()
    model.load_model("weights/", -1 if DEVICE == "cuda" else "cpu")
    model.eval()


class InterpolateRequest(BaseModel):
    input_dir: str
    output_dir: str
    multiplier: int = 2  # 2 or 4


class InterpolatePairRequest(BaseModel):
    frame1_path: str
    frame2_path: str
    output_path: str
    num_intermediate: int = 1  # 1 for 2x, 3 for 4x


@app.post("/interpolate-dir")
async def interpolate_directory(req: InterpolateRequest):
    """Interpolate all consecutive frame pairs in a directory."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    input_path = Path(req.input_dir)
    output_path = Path(req.output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    frames = sorted(input_path.glob("*.png"))
    total_pairs = len(frames) - 1

    if total_pairs < 1:
        raise HTTPException(status_code=400, detail="Need at least 2 frames")

    output_idx = 0
    processed_pairs = 0

    for i in range(len(frames) - 1):
        frame1 = cv2.imread(str(frames[i]))
        frame2 = cv2.imread(str(frames[i + 1]))

        # Write the first frame of the pair
        cv2.imwrite(str(output_path / f"frame_{output_idx:06d}.png"), frame1)
        output_idx += 1

        # Generate intermediate frames
        if req.multiplier == 2:
            mid = _interpolate_pair(frame1, frame2)
            cv2.imwrite(str(output_path / f"frame_{output_idx:06d}.png"), mid)
            output_idx += 1
        elif req.multiplier == 4:
            # For 4x, recursively interpolate
            mid = _interpolate_pair(frame1, frame2)
            q1 = _interpolate_pair(frame1, mid)
            q3 = _interpolate_pair(mid, frame2)
            for interp_frame in [q1, mid, q3]:
                cv2.imwrite(str(output_path / f"frame_{output_idx:06d}.png"), interp_frame)
                output_idx += 1

        processed_pairs += 1

    # Write the last frame
    cv2.imwrite(str(output_path / f"frame_{output_idx:06d}.png"), cv2.imread(str(frames[-1])))
    output_idx += 1

    return {
        "input_frames": len(frames),
        "output_frames": output_idx,
        "multiplier": req.multiplier,
        "processed_pairs": processed_pairs,
    }


def _interpolate_pair(frame1: np.ndarray, frame2: np.ndarray) -> np.ndarray:
    """Generate an intermediate frame between two frames using RIFE."""
    h, w, _ = frame1.shape

    # Pad to multiple of 32 (RIFE requirement)
    pad_h = (32 - h % 32) % 32
    pad_w = (32 - w % 32) % 32

    img1 = torch.from_numpy(frame1.transpose(2, 0, 1)).float().unsqueeze(0) / 255.0
    img2 = torch.from_numpy(frame2.transpose(2, 0, 1)).float().unsqueeze(0) / 255.0

    if pad_h or pad_w:
        img1 = torch.nn.functional.pad(img1, (0, pad_w, 0, pad_h))
        img2 = torch.nn.functional.pad(img2, (0, pad_w, 0, pad_h))

    img1 = img1.to(DEVICE)
    img2 = img2.to(DEVICE)

    with torch.no_grad():
        mid = model.inference(img1, img2)

    mid = mid[:, :, :h, :w]
    result = (mid.squeeze(0).cpu().numpy().transpose(1, 2, 0) * 255).astype(np.uint8)
    return result


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "RIFE",
        "device": DEVICE,
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }
```

Create `services/rife/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
torch>=2.4.0
torchvision>=0.19.0
opencv-python-headless>=4.10.0
numpy>=1.26.0
pydantic>=2.10.0
```

Create `services/rife/Dockerfile`:
```dockerfile
FROM nvidia/cuda:12.4-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.12 python3.12-venv python3-pip ffmpeg libgl1-mesa-glx libglib2.0-0 git wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone RIFE model code
RUN git clone https://github.com/hzwer/Practical-RIFE.git /app/rife_src && \
    cp -r /app/rife_src/model /app/ && \
    cp /app/rife_src/inference.py /app/

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download RIFE model weights
RUN mkdir -p weights && \
    wget -q https://github.com/hzwer/Practical-RIFE/releases/download/v4.18/flownet-v4.18.pkl -O weights/flownet.pkl

COPY . .

EXPOSE 8012
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8012"]
```

### Step 4: Celery Task

Create `backend/app/tasks/interpolation_tasks.py`:
```python
import json
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
import structlog
from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_sync_session
from app.core.storage import download_from_gcs_sync, upload_to_gcs_sync
from app.models.interpolation import InterpolationJob

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    name="interpolation.process",
    max_retries=1,
    queue="gpu",
    time_limit=1800,
    soft_time_limit=1500,
)
def process_interpolation_task(
    self,
    job_id: str,
    video_url: str,
    multiplier: int,
    start_time_sec: float | None = None,
    end_time_sec: float | None = None,
):
    """Process frame interpolation to create slow-motion video."""
    start_time = time.time()

    with get_sync_session() as db:
        job = db.execute(
            select(InterpolationJob).where(InterpolationJob.id == uuid.UUID(job_id))
        ).scalar_one()

        try:
            job.status = "processing"
            db.commit()

            work_dir = Path(f"/tmp/interp_{job_id}")
            work_dir.mkdir(parents=True, exist_ok=True)
            frames_dir = work_dir / "frames"
            frames_dir.mkdir()
            interp_dir = work_dir / "interpolated"
            interp_dir.mkdir()

            # Step 1: Download video
            video_path = str(work_dir / "source.mp4")
            _download_file(video_url, video_path)

            # Step 2: Optionally trim to segment
            if start_time_sec is not None and end_time_sec is not None:
                trimmed_path = str(work_dir / "trimmed.mp4")
                subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-ss", str(start_time_sec),
                        "-to", str(end_time_sec),
                        "-i", video_path,
                        "-c", "copy",
                        trimmed_path,
                    ],
                    capture_output=True, check=True, timeout=60,
                )
                video_path = trimmed_path

            # Step 3: Probe video
            probe = _probe_video(video_path)
            video_stream = next(s for s in probe["streams"] if s["codec_type"] == "video")
            fps = eval(video_stream["r_frame_rate"])
            job.source_fps = fps
            job.output_fps = fps  # Keep same fps, video plays longer = slow motion
            db.commit()

            job.progress_pct = 10
            db.commit()

            # Step 4: Extract frames
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", video_path,
                    "-qscale:v", "2",
                    str(frames_dir / "frame_%06d.png"),
                ],
                capture_output=True, check=True, timeout=300,
            )

            total_frames = len(list(frames_dir.glob("*.png")))
            job.total_frames = total_frames
            job.progress_pct = 20
            db.commit()

            # Step 5: Run RIFE interpolation
            logger.info("starting_interpolation", job_id=job_id, frames=total_frames, multiplier=multiplier)

            resp = httpx.post(
                f"{settings.RIFE_URL}/interpolate-dir",
                json={
                    "input_dir": str(frames_dir),
                    "output_dir": str(interp_dir),
                    "multiplier": multiplier,
                },
                timeout=1800,
            )
            resp.raise_for_status()
            result = resp.json()

            job.output_frames = result["output_frames"]
            job.progress_pct = 75
            db.commit()

            # Step 6: Reassemble video at original fps (creating slow-mo effect)
            output_path = str(work_dir / "slowmo.mp4")
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-framerate", str(fps),
                    "-i", str(interp_dir / "frame_%06d.png"),
                    "-c:v", "libx264",
                    "-crf", "18",
                    "-preset", "medium",
                    "-pix_fmt", "yuv420p",
                    output_path,
                ],
                capture_output=True, check=True, timeout=600,
            )

            job.progress_pct = 90
            db.commit()

            # Step 7: Upload result
            output_data = Path(output_path).read_bytes()
            output_url = upload_to_gcs_sync(
                bucket_name=settings.GCS_BUCKET_PROCESSED,
                blob_path=f"interpolated/{job.user_id}/{job_id}/slowmo_{multiplier}x.mp4",
                data=output_data,
                content_type="video/mp4",
            )

            # Generate preview GIF (first 3 seconds)
            preview_path = str(work_dir / "preview.gif")
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-t", "3",
                    "-i", output_path,
                    "-vf", "fps=15,scale=480:-1:flags=lanczos",
                    "-gifflags", "+transdiff",
                    preview_path,
                ],
                capture_output=True, timeout=30,
            )
            if Path(preview_path).exists():
                preview_url = upload_to_gcs_sync(
                    bucket_name=settings.GCS_BUCKET_PROCESSED,
                    blob_path=f"interpolated/{job.user_id}/{job_id}/preview.gif",
                    data=Path(preview_path).read_bytes(),
                    content_type="image/gif",
                )
                job.preview_url = preview_url

            # Finalize
            processing_time = time.time() - start_time
            job.output_video_url = output_url
            job.processing_time_sec = round(processing_time, 2)
            job.status = "completed"
            job.progress_pct = 100
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

            logger.info(
                "interpolation_completed",
                job_id=job_id,
                input_frames=total_frames,
                output_frames=result["output_frames"],
                time_sec=processing_time,
            )

            # Cleanup
            import shutil
            shutil.rmtree(work_dir, ignore_errors=True)

        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)[:2000]
            job.processing_time_sec = round(time.time() - start_time, 2)
            db.commit()
            logger.error("interpolation_failed", job_id=job_id, error=str(exc))
            raise self.retry(exc=exc)


def _download_file(url: str, output_path: str):
    if url.startswith("gs://"):
        from google.cloud import storage
        client = storage.Client()
        parts = url.replace("gs://", "").split("/", 1)
        blob = client.bucket(parts[0]).blob(parts[1])
        blob.download_to_filename(output_path)
    else:
        resp = httpx.get(url, timeout=300)
        resp.raise_for_status()
        Path(output_path).write_bytes(resp.content)


def _probe_video(video_path: str) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", video_path],
        capture_output=True, text=True, timeout=30,
    )
    return json.loads(result.stdout)
```

### Step 5: API Routes

Create `backend/app/api/v1/interpolation.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.interpolation import InterpolationJob
from app.models.user import User

router = APIRouter(prefix="/interpolate", tags=["Frame Interpolation"])


class InterpolateRequest(BaseModel):
    source_video_id: uuid.UUID
    multiplier: int = Field(2, ge=2, le=4, description="Interpolation multiplier: 2 (2x slow-mo) or 4 (4x slow-mo)")
    start_time_sec: float | None = Field(None, ge=0, description="Start time for partial slow-mo (seconds)")
    end_time_sec: float | None = Field(None, ge=0, description="End time for partial slow-mo (seconds)")


class InterpolationJobResponse(BaseModel):
    id: uuid.UUID
    multiplier: int
    source_fps: float | None
    output_fps: float | None
    total_frames: int | None
    output_frames: int | None
    status: str
    progress_pct: int
    output_video_url: str | None
    preview_url: str | None
    processing_time_sec: float | None
    error_message: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("", response_model=InterpolationJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_interpolation(
    req: InterpolateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start a frame interpolation (slow-motion) job."""
    if req.multiplier not in (2, 4):
        raise HTTPException(status_code=400, detail="Multiplier must be 2 or 4")

    if req.start_time_sec is not None and req.end_time_sec is not None:
        if req.end_time_sec <= req.start_time_sec:
            raise HTTPException(status_code=400, detail="end_time must be greater than start_time")

    from app.models.video import Video
    video = (await db.execute(
        select(Video).where(Video.id == req.source_video_id, Video.user_id == user.id)
    )).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    job = InterpolationJob(
        user_id=user.id,
        source_video_id=req.source_video_id,
        multiplier=req.multiplier,
        start_time_sec=req.start_time_sec,
        end_time_sec=req.end_time_sec,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.tasks.interpolation_tasks import process_interpolation_task
    task = process_interpolation_task.delay(
        job_id=str(job.id),
        video_url=video.source_url,
        multiplier=req.multiplier,
        start_time_sec=req.start_time_sec,
        end_time_sec=req.end_time_sec,
    )
    job.celery_task_id = task.id
    await db.commit()

    return job


@router.get("/{job_id}", response_model=InterpolationJobResponse)
async def get_interpolation_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get interpolation job status."""
    result = await db.execute(
        select(InterpolationJob).where(InterpolationJob.id == job_id, InterpolationJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Interpolation job not found")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_interpolation(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel an interpolation job."""
    result = await db.execute(
        select(InterpolationJob).where(InterpolationJob.id == job_id, InterpolationJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status in ("completed", "failed"):
        raise HTTPException(status_code=400, detail="Cannot cancel completed or failed job")

    if job.celery_task_id:
        from app.core.celery_app import celery_app
        celery_app.control.revoke(job.celery_task_id, terminate=True)

    job.status = "cancelled"
    await db.commit()
```

Register in `backend/app/api/v1/router.py`:
```python
from app.api.v1.interpolation import router as interpolation_router

api_v1_router.include_router(interpolation_router)
```

### Step 6: Deploy RIFE Service

```bash
# Build and push
gcloud builds submit services/rife/ \
  --tag us-central1-docker.pkg.dev/openclip-prod/openclip-images/rife

# Deploy on Compute Engine (can co-locate with upscaler)
# Or deploy as Cloud Run GPU service
gcloud run deploy rife-service \
  --image us-central1-docker.pkg.dev/openclip-prod/openclip-images/rife \
  --region us-central1 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 4 \
  --memory 16Gi \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 600 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@openclip-prod.iam.gserviceaccount.com
```

### Step 7: Configuration

Add to `backend/app/core/config.py`:
```python
class Settings(BaseSettings):
    # ... existing settings ...
    RIFE_URL: str = "http://localhost:8012"
```

## Best Practices
- **Padding to multiples of 32:** RIFE requires input dimensions to be multiples of 32. Always pad before inference and crop after.
- **Recursive interpolation for 4x:** Generate the middle frame first, then recursively fill between original-middle and middle-original. This produces smoother results than single-pass 4x.
- **Scene cut detection:** Before interpolation, detect scene cuts (abrupt transitions). Do not interpolate across scene boundaries as it produces artifacts. Use FFmpeg's `select='gt(scene,0.3)'` filter to detect cuts.
- **Memory management:** Process frames sequentially rather than loading all into GPU memory. RIFE uses ~2-3GB VRAM per frame pair.
- **Audio handling:** When creating slow-motion, the audio must either be slowed proportionally (pitch-shifted) or removed. For most faceless video use cases, removing audio and adding music later is preferred.
- **Partial slow-mo:** The most cinematic effect is applying slow-motion to specific moments rather than the entire video. Support start/end time parameters for selective interpolation.

## Testing
- Interpolate a 5-second 30fps clip at 2x and verify smooth playback
- Interpolate at 4x and verify 4x longer duration
- Test with scene cuts (verify no cross-scene artifacts)
- Test partial slow-mo (start_time/end_time)
- Verify output frame count: `input_frames * multiplier - (multiplier - 1)`
- Test with various resolutions (720p, 1080p, 4K)
- Benchmark RIFE throughput on L4 GPU (target: 100+ fps for 1080p)
- Test cancellation mid-processing

## Verification Checklist
- [ ] RIFE service starts and loads model on GPU
- [ ] `/health` endpoint returns model and GPU info
- [ ] 2x interpolation produces correct number of output frames
- [ ] 4x interpolation produces correct number of output frames
- [ ] Output video plays smoothly without stuttering
- [ ] Interpolated frames look natural (no ghosting or artifacts)
- [ ] Partial slow-mo (time range) works correctly
- [ ] Preview GIF is generated and viewable
- [ ] Celery task handles progress updates
- [ ] Job cancellation works
- [ ] Output uploaded to GCS correctly
- [ ] Temp files cleaned up after processing
- [ ] No artifacts at scene boundaries
