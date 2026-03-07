# Video Upscaling — Implementation Guide

## Overview
- **What:** Deploy Real-ESRGAN (BSD-3 license) with GFPGAN face enhancement on GCP Compute Engine with L4 GPU. Process videos frame-by-frame for 2x and 4x upscaling, reassemble with FFmpeg, and queue as a long-running Celery task.
- **Why:** Many source videos (especially older content, screen recordings, and mobile captures) are low resolution. AI upscaling brings 480p/720p content to 1080p/4K quality, making clips look professional. Competitors charge premium pricing for this feature — OpenClip provides it free.
- **Dependencies:** Phase 1 Feature 3 (Celery Job Queue), Phase 1 Feature 4 (Video Processing / FFmpeg), GCP Compute Engine with GPU

## Architecture

### System Design
```
Input Video (480p/720p)
  |
  v
[1] FFmpeg: Extract all frames as PNGs
  -> frames/frame_0001.png, frame_0002.png, ...
  |
  v
[2] Real-ESRGAN: Upscale each frame (2x or 4x)
  -> If face detected: apply GFPGAN face enhancement
  -> upscaled/frame_0001.png, upscaled/frame_0002.png, ...
  |
  v
[3] FFmpeg: Reassemble frames into video
  -> Preserve original frame rate
  -> Copy original audio track
  |
  v
[4] FFmpeg: Encode final output (H.264/H.265)
  -> Apply CRF encoding for quality/size balance
  |
  v
Output Video (1080p/4K)
```

### Data Flow
```
+-------------------+
| Client Request    |
| POST /upscale     |
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
                             | GPU: NVIDIA L4    |
                             +-------------------+
                                      |
                    +-----------------+-----------------+
                    |                                   |
                    v                                   v
           +----------------+                  +----------------+
           | Real-ESRGAN    |                  | GFPGAN         |
           | Frame upscale  |                  | Face enhance   |
           +----------------+                  +----------------+
                    |                                   |
                    +-----------------+-----------------+
                                      |
                                      v
                             +-------------------+
                             | FFmpeg Reassemble |
                             | + Audio Copy      |
                             +-------------------+
                                      |
                                      v
                             +-------------------+
                             | GCS Upload        |
                             | (processed bucket)|
                             +-------------------+
```

### API Endpoints
```
POST   /api/v1/upscale                  -> Start upscaling job
GET    /api/v1/upscale/{job_id}         -> Get job status and progress
GET    /api/v1/upscale/{job_id}/preview -> Get preview frame (first upscaled frame)
DELETE /api/v1/upscale/{job_id}         -> Cancel upscaling job
```

## GCP Deployment
- **Service:** GCP Compute Engine (persistent VM for GPU workloads)
- **Machine type:** g2-standard-8 (8 vCPU, 32GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM)
- **Disk:** 200GB SSD (frame extraction requires significant temp space)
- **Auto-scaling:** Managed Instance Group (MIG) with 0-3 instances, scale based on Celery queue depth
- **Docker image:** `us-central1-docker.pkg.dev/openclip-prod/openclip-images/upscaler`
- **Cost estimate:** ~$0.50-1.00 per hour per instance; scale to zero when idle via MIG

## Step-by-Step Implementation

### Step 1: Database Migration

Create `backend/alembic/versions/xxxx_add_upscaling_jobs.py`:
```python
"""Add upscaling_jobs table

Revision ID: c3d4e5f6g7h8
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "c3d4e5f6g7h8"
down_revision = "<previous_migration>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "upscaling_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_video_id", UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scale_factor", sa.Integer, nullable=False),  # 2 or 4
        sa.Column("face_enhance", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("source_resolution", sa.String(20), nullable=True),
        sa.Column("target_resolution", sa.String(20), nullable=True),
        sa.Column("total_frames", sa.Integer, nullable=True),
        sa.Column("processed_frames", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_video_url", sa.String(2048), nullable=True),
        sa.Column("preview_frame_url", sa.String(2048), nullable=True),
        sa.Column("output_file_size_bytes", sa.BigInteger, nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("processing_time_sec", sa.Float, nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_upscaling_jobs_user_id", "upscaling_jobs", ["user_id"])
    op.create_index("ix_upscaling_jobs_status", "upscaling_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("upscaling_jobs")
```

### Step 2: SQLAlchemy Model

Create `backend/app/models/upscaling.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class UpscalingJob(Base):
    __tablename__ = "upscaling_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )
    scale_factor: Mapped[int] = mapped_column(Integer, nullable=False)  # 2 or 4
    face_enhance: Mapped[bool] = mapped_column(Boolean, default=False)
    source_resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)
    target_resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)
    total_frames: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_frames: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    output_video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    preview_frame_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    output_file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_time_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### Step 3: Upscaler Microservice

Create `services/upscaler/app.py`:
```python
import io
import os
import tempfile
from pathlib import Path

import cv2
import numpy as np
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from gfpgan import GFPGANer
from pydantic import BaseModel
from realesrgan import RealESRGANer

app = FastAPI(title="OpenClip Video Upscaling Service")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
upscaler_2x = None
upscaler_4x = None
face_enhancer = None


@app.on_event("startup")
async def load_models():
    global upscaler_2x, upscaler_4x, face_enhancer

    # Real-ESRGAN 2x model
    model_2x = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2)
    upscaler_2x = RealESRGANer(
        scale=2,
        model_path="weights/RealESRGAN_x2plus.pth",
        model=model_2x,
        tile=512,
        tile_pad=10,
        pre_pad=0,
        half=True if DEVICE == "cuda" else False,
        device=DEVICE,
    )

    # Real-ESRGAN 4x model
    model_4x = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    upscaler_4x = RealESRGANer(
        scale=4,
        model_path="weights/RealESRGAN_x4plus.pth",
        model=model_4x,
        tile=512,
        tile_pad=10,
        pre_pad=0,
        half=True if DEVICE == "cuda" else False,
        device=DEVICE,
    )

    # GFPGAN face enhancer
    face_enhancer = GFPGANer(
        model_path="weights/GFPGANv1.4.pth",
        upscale=2,
        arch="clean",
        channel_multiplier=2,
        bg_upsampler=upscaler_2x,
    )


class UpscaleFrameRequest(BaseModel):
    scale: int = 2  # 2 or 4
    face_enhance: bool = False


@app.post("/upscale-frame")
async def upscale_frame(
    frame: UploadFile = File(...),
    scale: int = Form(2),
    face_enhance: bool = Form(False),
):
    """Upscale a single frame image."""
    contents = await frame.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    upscaler = upscaler_4x if scale == 4 else upscaler_2x

    if face_enhance and face_enhancer:
        _, _, output = face_enhancer.enhance(
            img, has_aligned=False, only_center_face=False, paste_back=True
        )
    else:
        output, _ = upscaler.enhance(img, outscale=scale)

    # Encode result as PNG
    _, buffer = cv2.imencode(".png", output)
    return StreamingResponse(
        io.BytesIO(buffer.tobytes()),
        media_type="image/png",
        headers={"X-Output-Width": str(output.shape[1]), "X-Output-Height": str(output.shape[0])},
    )


@app.post("/upscale-batch")
async def upscale_batch(
    scale: int = Form(2),
    face_enhance: bool = Form(False),
    input_dir: str = Form(...),
    output_dir: str = Form(...),
):
    """Upscale all frames in a directory. Used for video processing.

    This endpoint is for internal use by the Celery worker running on the same machine.
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    frames = sorted(input_path.glob("*.png"))
    total = len(frames)

    if total == 0:
        raise HTTPException(status_code=400, detail="No frames found in input directory")

    upscaler = upscaler_4x if scale == 4 else upscaler_2x
    processed = 0

    for frame_file in frames:
        img = cv2.imread(str(frame_file))
        if img is None:
            continue

        if face_enhance and face_enhancer:
            _, _, output = face_enhancer.enhance(
                img, has_aligned=False, only_center_face=False, paste_back=True
            )
        else:
            output, _ = upscaler.enhance(img, outscale=scale)

        cv2.imwrite(str(output_path / frame_file.name), output)
        processed += 1

    return {
        "total_frames": total,
        "processed_frames": processed,
        "output_dir": str(output_path),
        "output_resolution": f"{output.shape[1]}x{output.shape[0]}" if processed > 0 else None,
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "models_loaded": {
            "realesrgan_2x": upscaler_2x is not None,
            "realesrgan_4x": upscaler_4x is not None,
            "gfpgan": face_enhancer is not None,
        },
    }
```

Create `services/upscaler/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
realesrgan>=0.3.0
gfpgan>=1.3.8
basicsr>=1.4.2
torch>=2.4.0
opencv-python-headless>=4.10.0
numpy>=1.26.0
pydantic>=2.10.0
python-multipart>=0.0.17
```

Create `services/upscaler/Dockerfile`:
```dockerfile
FROM nvidia/cuda:12.4-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.12 python3.12-venv python3-pip ffmpeg libgl1-mesa-glx libglib2.0-0 wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download model weights at build time
RUN mkdir -p weights && \
    wget -q https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth -O weights/RealESRGAN_x2plus.pth && \
    wget -q https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -O weights/RealESRGAN_x4plus.pth && \
    wget -q https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth -O weights/GFPGANv1.4.pth

COPY . .

EXPOSE 8011
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8011"]
```

### Step 4: Celery Task

Create `backend/app/tasks/upscaling_tasks.py`:
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
from app.models.upscaling import UpscalingJob

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    name="upscaling.process",
    max_retries=1,
    queue="gpu",
    time_limit=3600,
    soft_time_limit=3300,
)
def process_upscaling_task(
    self,
    job_id: str,
    video_url: str,
    scale_factor: int,
    face_enhance: bool,
):
    """Process video upscaling: extract frames, upscale, reassemble."""
    start_time = time.time()

    with get_sync_session() as db:
        job = db.execute(
            select(UpscalingJob).where(UpscalingJob.id == uuid.UUID(job_id))
        ).scalar_one()

        try:
            job.status = "processing"
            db.commit()

            # Create working directory
            work_dir = Path(f"/tmp/upscale_{job_id}")
            work_dir.mkdir(parents=True, exist_ok=True)
            frames_dir = work_dir / "frames"
            frames_dir.mkdir()
            upscaled_dir = work_dir / "upscaled"
            upscaled_dir.mkdir()

            # Step 1: Download source video
            video_path = str(work_dir / "source.mp4")
            _download_file(video_url, video_path)

            # Step 2: Probe video metadata
            probe = _probe_video(video_path)
            fps = eval(probe["streams"][0]["r_frame_rate"])  # e.g., "30/1" -> 30.0
            width = int(probe["streams"][0]["width"])
            height = int(probe["streams"][0]["height"])
            job.source_resolution = f"{width}x{height}"
            job.target_resolution = f"{width * scale_factor}x{height * scale_factor}"
            db.commit()

            # Step 3: Extract frames
            logger.info("extracting_frames", job_id=job_id)
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", video_path,
                    "-qscale:v", "2",
                    str(frames_dir / "frame_%06d.png"),
                ],
                capture_output=True, check=True, timeout=600,
            )

            total_frames = len(list(frames_dir.glob("*.png")))
            job.total_frames = total_frames
            db.commit()
            logger.info("frames_extracted", job_id=job_id, total=total_frames)

            # Step 4: Upscale frames via Real-ESRGAN service
            # If running on the same machine, call the local service
            resp = httpx.post(
                f"{settings.UPSCALER_URL}/upscale-batch",
                data={
                    "scale": scale_factor,
                    "face_enhance": str(face_enhance).lower(),
                    "input_dir": str(frames_dir),
                    "output_dir": str(upscaled_dir),
                },
                timeout=3600,
            )
            resp.raise_for_status()
            result = resp.json()

            job.processed_frames = result["processed_frames"]
            job.progress_pct = 80
            db.commit()

            # Step 5: Upload preview frame
            first_upscaled = sorted(upscaled_dir.glob("*.png"))[0]
            preview_url = upload_to_gcs_sync(
                bucket_name=settings.GCS_BUCKET_PROCESSED,
                blob_path=f"upscaled/{job.user_id}/{job_id}/preview.png",
                data=first_upscaled.read_bytes(),
                content_type="image/png",
            )
            job.preview_frame_url = preview_url
            db.commit()

            # Step 6: Reassemble video from upscaled frames
            logger.info("reassembling_video", job_id=job_id)
            output_path = str(work_dir / "upscaled.mp4")

            # First pass: create video from frames (no audio)
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-framerate", str(fps),
                    "-i", str(upscaled_dir / "frame_%06d.png"),
                    "-c:v", "libx264",
                    "-crf", "18",
                    "-preset", "slow",
                    "-pix_fmt", "yuv420p",
                    str(work_dir / "video_only.mp4"),
                ],
                capture_output=True, check=True, timeout=600,
            )

            # Second pass: mux with original audio
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", str(work_dir / "video_only.mp4"),
                    "-i", video_path,
                    "-c:v", "copy",
                    "-map", "0:v:0",
                    "-map", "1:a:0?",
                    "-shortest",
                    output_path,
                ],
                capture_output=True, check=True, timeout=300,
            )

            job.progress_pct = 95
            db.commit()

            # Step 7: Upload final video
            output_data = Path(output_path).read_bytes()
            output_url = upload_to_gcs_sync(
                bucket_name=settings.GCS_BUCKET_PROCESSED,
                blob_path=f"upscaled/{job.user_id}/{job_id}/upscaled_{scale_factor}x.mp4",
                data=output_data,
                content_type="video/mp4",
            )

            # Update job
            processing_time = time.time() - start_time
            job.output_video_url = output_url
            job.output_file_size_bytes = len(output_data)
            job.processing_time_sec = round(processing_time, 2)
            job.status = "completed"
            job.progress_pct = 100
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

            logger.info(
                "upscaling_completed",
                job_id=job_id,
                frames=total_frames,
                time_sec=processing_time,
                output_size_mb=round(len(output_data) / (1024 * 1024), 1),
            )

            # Cleanup temp files
            import shutil
            shutil.rmtree(work_dir, ignore_errors=True)

        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)[:2000]
            job.processing_time_sec = round(time.time() - start_time, 2)
            db.commit()
            logger.error("upscaling_failed", job_id=job_id, error=str(exc))
            raise self.retry(exc=exc)


def _download_file(url: str, output_path: str) -> str:
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
    return output_path


def _probe_video(video_path: str) -> dict:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", video_path],
        capture_output=True, text=True, timeout=30,
    )
    return json.loads(result.stdout)
```

### Step 5: API Routes

Create `backend/app/api/v1/upscaling.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.upscaling import UpscalingJob
from app.models.user import User

router = APIRouter(prefix="/upscale", tags=["Video Upscaling"])


class UpscaleRequest(BaseModel):
    source_video_id: uuid.UUID
    scale_factor: int = Field(2, ge=2, le=4, description="Upscale factor: 2 or 4")
    face_enhance: bool = Field(False, description="Enable GFPGAN face enhancement")


class UpscaleJobResponse(BaseModel):
    id: uuid.UUID
    source_resolution: str | None
    target_resolution: str | None
    scale_factor: int
    face_enhance: bool
    total_frames: int | None
    processed_frames: int
    status: str
    progress_pct: int
    output_video_url: str | None
    preview_frame_url: str | None
    output_file_size_bytes: int | None
    processing_time_sec: float | None
    error_message: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("", response_model=UpscaleJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_upscaling(
    req: UpscaleRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start a video upscaling job."""
    if req.scale_factor not in (2, 4):
        raise HTTPException(status_code=400, detail="Scale factor must be 2 or 4")

    from app.models.video import Video
    video = (await db.execute(
        select(Video).where(Video.id == req.source_video_id, Video.user_id == user.id)
    )).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    job = UpscalingJob(
        user_id=user.id,
        source_video_id=req.source_video_id,
        scale_factor=req.scale_factor,
        face_enhance=req.face_enhance,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    from app.tasks.upscaling_tasks import process_upscaling_task
    task = process_upscaling_task.delay(
        job_id=str(job.id),
        video_url=video.source_url,
        scale_factor=req.scale_factor,
        face_enhance=req.face_enhance,
    )
    job.celery_task_id = task.id
    await db.commit()

    return job


@router.get("/{job_id}", response_model=UpscaleJobResponse)
async def get_upscaling_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get upscaling job status."""
    result = await db.execute(
        select(UpscalingJob).where(UpscalingJob.id == job_id, UpscalingJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Upscaling job not found")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_upscaling(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel an upscaling job."""
    result = await db.execute(
        select(UpscalingJob).where(UpscalingJob.id == job_id, UpscalingJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Upscaling job not found")
    if job.status in ("completed", "failed"):
        raise HTTPException(status_code=400, detail="Cannot cancel a completed or failed job")

    # Revoke Celery task
    if job.celery_task_id:
        from app.core.celery_app import celery_app
        celery_app.control.revoke(job.celery_task_id, terminate=True)

    job.status = "cancelled"
    await db.commit()
```

Register in `backend/app/api/v1/router.py`:
```python
from app.api.v1.upscaling import router as upscaling_router

api_v1_router.include_router(upscaling_router)
```

### Step 6: Deploy to GCP Compute Engine

```bash
# Build Docker image
gcloud builds submit services/upscaler/ \
  --tag us-central1-docker.pkg.dev/openclip-prod/openclip-images/upscaler

# Create instance template with GPU
gcloud compute instance-templates create upscaler-template \
  --machine-type g2-standard-8 \
  --accelerator type=nvidia-l4,count=1 \
  --boot-disk-size 200GB \
  --boot-disk-type pd-ssd \
  --image-family cos-stable \
  --image-project cos-cloud \
  --metadata startup-script='#!/bin/bash
    cos-extensions install gpu
    docker pull us-central1-docker.pkg.dev/openclip-prod/openclip-images/upscaler:latest
    docker run -d --gpus all -p 8011:8011 \
      us-central1-docker.pkg.dev/openclip-prod/openclip-images/upscaler:latest'

# Create managed instance group (auto-scaling)
gcloud compute instance-groups managed create upscaler-mig \
  --template upscaler-template \
  --size 0 \
  --zone us-central1-a

gcloud compute instance-groups managed set-autoscaling upscaler-mig \
  --zone us-central1-a \
  --min-num-replicas 0 \
  --max-num-replicas 3 \
  --target-cpu-utilization 0.7 \
  --cool-down-period 300
```

### Step 7: Configuration

Add to `backend/app/core/config.py`:
```python
class Settings(BaseSettings):
    # ... existing settings ...
    UPSCALER_URL: str = "http://localhost:8011"
```

## Best Practices
- **Tile-based processing:** Real-ESRGAN's `tile=512` parameter processes large images in overlapping tiles to avoid GPU OOM. Adjust based on VRAM availability.
- **Half precision:** Always use `half=True` on GPU for 2x memory savings and faster inference with negligible quality loss.
- **CRF encoding:** Use CRF 18 for high quality output. CRF 23 is a good balance of quality/size for web delivery.
- **Frame extraction format:** Use PNG for lossless frame extraction. JPEG introduces artifacts that compound with upscaling.
- **Disk space management:** A 10-minute 1080p video at 30fps extracts to ~18,000 frames. At 4x upscale to 4K, each frame is ~12MB. Budget 200GB+ per concurrent job.
- **Parallel frame processing:** For very long videos, process frames in batches of 100 and update progress incrementally.
- **GFPGAN selectively:** Only enable face enhancement when the video contains close-up face shots. It adds ~30% processing time and can produce artifacts on non-face regions.

## Testing
- Upscale a 720p 10-second clip to 1080p (2x) and verify quality
- Upscale a 480p clip to 1920p (4x) and verify no artifacts
- Test face enhancement on a talking-head video
- Test with various source formats (H.264, H.265, VP9)
- Verify audio is preserved correctly in the output
- Verify progress tracking updates during processing
- Test cancellation mid-processing
- Benchmark: measure frames per second on L4 GPU

## Verification Checklist
- [ ] Upscaler service starts and loads all 3 models (ESRGAN 2x, 4x, GFPGAN)
- [ ] `/health` endpoint reports GPU status and loaded models
- [ ] Single frame upscale works via `/upscale-frame`
- [ ] Batch frame upscale works via `/upscale-batch`
- [ ] Celery task extracts frames, upscales, and reassembles
- [ ] Output video has correct resolution (2x or 4x original)
- [ ] Audio track is preserved in output video
- [ ] Preview frame is generated and accessible
- [ ] Progress updates are accurate during processing
- [ ] Job cancellation revokes Celery task
- [ ] GCS upload works for large output files
- [ ] Temp files are cleaned up after processing
- [ ] Face enhancement produces clean results on face videos
- [ ] No OOM errors on L4 GPU for 4K output
