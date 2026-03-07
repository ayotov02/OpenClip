# Voice Cloning — Implementation Guide

## Overview
- **What:** Deploy Chatterbox TTS (MIT license) as a GPU microservice on GCP Cloud Run for voice cloning. Users upload a 5-second reference audio sample to create a voice profile, then synthesize speech in the cloned voice for faceless video narration.
- **Why:** Voice cloning differentiates OpenClip from competitors. Creators can maintain a consistent brand voice across all videos without recording narration themselves. Chatterbox requires only 5 seconds of reference audio and runs fully open-source with no API fees.
- **Dependencies:** Phase 1 Feature 3 (Job Queue), Phase 1 Feature 4 (Video Processing), Phase 3 TTS service (Kokoro baseline TTS), GCS bucket for voice profiles

## Architecture

### System Design
```
User uploads 5s audio sample
  -> Backend validates (duration, format, quality)
  -> Stores reference audio in GCS (voice-profiles bucket)
  -> Creates VoiceProfile record in PostgreSQL

Synthesis request (text + voice_profile_id)
  -> Backend dispatches Celery task
  -> Worker calls Chatterbox service with reference audio + text
  -> Chatterbox generates cloned speech
  -> Output audio stored in GCS
  -> Task status updated, URL returned
```

### Data Flow
```
                                        +-----------------------+
POST /voices/enroll                     |   GCS: voice-profiles |
  (audio file upload)         +-------->|   /{user_id}/{id}.wav |
         |                    |         +-----------------------+
         v                    |
+------------------+     save ref      +---------------------------+
|  FastAPI Backend |-----audio-------->|  PostgreSQL: voice_profiles|
+------------------+                   +---------------------------+
         |
POST /voices/{id}/synthesize
  (text + voice_profile_id)
         |
         v
+------------------+     Celery task    +-------------------------+
|   Redis Queue    |------------------>|  Chatterbox Service      |
+------------------+                   |  (Cloud Run GPU - L4)    |
                                       |  - Load reference audio  |
                                       |  - Generate cloned speech|
                                       +-------------------------+
                                                 |
                                                 v
                                       +-------------------------+
                                       |  GCS: synthesized-audio |
                                       |  /{user_id}/{task}.wav  |
                                       +-------------------------+
```

### API Endpoints
```
POST   /api/v1/voices/enroll              -> Upload reference audio, create voice profile
GET    /api/v1/voices                      -> List user's voice profiles
GET    /api/v1/voices/{voice_id}           -> Get voice profile details
DELETE /api/v1/voices/{voice_id}           -> Delete voice profile
POST   /api/v1/voices/{voice_id}/synthesize -> Synthesize text with cloned voice
GET    /api/v1/voices/{voice_id}/samples   -> List synthesized samples

# Chatterbox microservice (internal)
POST   /clone       -> reference audio + text -> synthesized WAV
GET    /health      -> Service health + GPU status
```

## GCP Deployment
- **Service:** Cloud Run (GPU) for Chatterbox inference
- **Machine type:** g2-standard-4 (4 vCPU, 16GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM)
- **Scale:** Min 0, Max 3 instances (scale-to-zero when idle)
- **Docker image:** `us-central1-docker.pkg.dev/openclip-prod/openclip-images/chatterbox`
- **GCS Buckets:**
  - `openclip-prod-voice-profiles` (reference audio samples)
  - `openclip-prod-synthesized` (generated speech output)
- **Cost estimate:** ~$100-250/month (scale-to-zero, ~2-5s per synthesis)

## Step-by-Step Implementation

### Step 1: Database Migration — Voice Profiles Table

Create `backend/alembic/versions/xxxx_add_voice_profiles.py`:
```python
"""Add voice_profiles table

Revision ID: a1b2c3d4e5f6
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "a1b2c3d4e5f6"
down_revision = "<previous_migration>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "voice_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("reference_audio_url", sa.String(2048), nullable=False),
        sa.Column("reference_duration_sec", sa.Float, nullable=False),
        sa.Column("sample_rate", sa.Integer, nullable=False, server_default="22050"),
        sa.Column("language", sa.String(10), nullable=True, server_default="en"),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_voice_profiles_user_id", "voice_profiles", ["user_id"])

    op.create_table(
        "voice_synthesis_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("voice_profile_id", UUID(as_uuid=True), sa.ForeignKey("voice_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("input_text", sa.Text, nullable=False),
        sa.Column("output_audio_url", sa.String(2048), nullable=True),
        sa.Column("duration_sec", sa.Float, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_voice_synthesis_jobs_user_id", "voice_synthesis_jobs", ["user_id"])
    op.create_index("ix_voice_synthesis_jobs_voice_profile_id", "voice_synthesis_jobs", ["voice_profile_id"])


def downgrade() -> None:
    op.drop_table("voice_synthesis_jobs")
    op.drop_table("voice_profiles")
```

### Step 2: SQLAlchemy Models

Create `backend/app/models/voice_profile.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base


class VoiceProfile(Base):
    __tablename__ = "voice_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_audio_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    reference_duration_sec: Mapped[float] = mapped_column(Float, nullable=False)
    sample_rate: Mapped[int] = mapped_column(Integer, default=22050)
    language: Mapped[str | None] = mapped_column(String(10), default="en")
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    synthesis_jobs: Mapped[list["VoiceSynthesisJob"]] = relationship(
        back_populates="voice_profile", cascade="all, delete-orphan"
    )


class VoiceSynthesisJob(Base):
    __tablename__ = "voice_synthesis_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    voice_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("voice_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    input_text: Mapped[str] = mapped_column(Text, nullable=False)
    output_audio_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, processing, completed, failed
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    voice_profile: Mapped["VoiceProfile"] = relationship(back_populates="synthesis_jobs")
```

### Step 3: Pydantic Schemas

Create `backend/app/schemas/voice.py`:
```python
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class VoiceProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    language: str = "en"


class VoiceProfileResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    reference_audio_url: str
    reference_duration_sec: float
    sample_rate: int
    language: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VoiceProfileList(BaseModel):
    voices: list[VoiceProfileResponse]
    total: int


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    exaggeration: float = Field(default=0.5, ge=0.0, le=1.0)
    cfg_weight: float = Field(default=0.5, ge=0.0, le=1.0)


class SynthesisJobResponse(BaseModel):
    id: uuid.UUID
    voice_profile_id: uuid.UUID
    input_text: str
    output_audio_url: str | None
    duration_sec: float | None
    status: str
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}
```

### Step 4: Chatterbox Microservice

Create `services/chatterbox/app.py`:
```python
import io
import os
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from chatterbox.tts import ChatterboxTTS
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="OpenClip Chatterbox Voice Cloning Service")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
model: ChatterboxTTS | None = None


@app.on_event("startup")
async def load_model():
    global model
    model = ChatterboxTTS.from_pretrained(device=DEVICE)


class CloneRequest(BaseModel):
    text: str
    reference_audio_url: str
    exaggeration: float = 0.5
    cfg_weight: float = 0.5


@app.post("/clone")
async def clone_voice(req: CloneRequest):
    """Synthesize speech cloned from reference audio."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    ref_path = await _download_audio(req.reference_audio_url)

    try:
        # Generate cloned speech
        wav_tensor = model.generate(
            text=req.text,
            audio_prompt_path=ref_path,
            exaggeration=req.exaggeration,
            cfg_weight=req.cfg_weight,
        )

        # Convert to WAV bytes
        wav_np = wav_tensor.squeeze().cpu().numpy()
        buffer = io.BytesIO()
        sf.write(buffer, wav_np, model.sr, format="WAV")
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(model.sr),
                "X-Duration-Sec": str(round(len(wav_np) / model.sr, 3)),
            },
        )
    finally:
        Path(ref_path).unlink(missing_ok=True)


@app.post("/clone-upload")
async def clone_voice_upload(
    text: str = Form(...),
    reference_audio: UploadFile = File(...),
    exaggeration: float = Form(0.5),
    cfg_weight: float = Form(0.5),
):
    """Synthesize speech using directly uploaded reference audio."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Save uploaded file to temp
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    content = await reference_audio.read()
    tmp.write(content)
    tmp.close()

    try:
        wav_tensor = model.generate(
            text=text,
            audio_prompt_path=tmp.name,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )

        wav_np = wav_tensor.squeeze().cpu().numpy()
        buffer = io.BytesIO()
        sf.write(buffer, wav_np, model.sr, format="WAV")
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(model.sr),
                "X-Duration-Sec": str(round(len(wav_np) / model.sr, 3)),
            },
        )
    finally:
        Path(tmp.name).unlink(missing_ok=True)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "chatterbox-tts",
        "device": DEVICE,
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }


async def _download_audio(url: str) -> str:
    """Download audio from GCS or HTTP URL to temp file."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    if url.startswith("gs://"):
        from google.cloud import storage
        client = storage.Client()
        parts = url.replace("gs://", "").split("/", 1)
        blob = client.bucket(parts[0]).blob(parts[1])
        blob.download_to_filename(tmp.name)
    else:
        import httpx
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            tmp.write(resp.content)
    tmp.close()
    return tmp.name
```

Create `services/chatterbox/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
chatterbox-tts>=0.1.0
torch>=2.4.0
torchaudio>=2.4.0
soundfile>=0.12.0
numpy>=1.26.0
pydantic>=2.10.0
google-cloud-storage>=2.18.0
httpx>=0.28.0
python-multipart>=0.0.17
```

Create `services/chatterbox/Dockerfile`:
```dockerfile
FROM nvidia/cuda:12.4-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.12 python3.12-venv python3-pip ffmpeg libsndfile1 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download model weights at build time to avoid cold-start download
RUN python3 -c "from chatterbox.tts import ChatterboxTTS; ChatterboxTTS.from_pretrained(device='cpu')"

EXPOSE 8010
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]
```

### Step 5: Backend Service Layer

Create `backend/app/services/voice_service.py`:
```python
import uuid
from datetime import datetime, timezone

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import upload_to_gcs, generate_signed_url
from app.models.voice_profile import VoiceProfile, VoiceSynthesisJob

logger = structlog.get_logger()

MAX_REFERENCE_DURATION_SEC = 30.0
MIN_REFERENCE_DURATION_SEC = 3.0
ALLOWED_AUDIO_TYPES = {"audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/flac", "audio/x-wav"}


class VoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def enroll_voice(
        self,
        user_id: uuid.UUID,
        name: str,
        audio_data: bytes,
        content_type: str,
        description: str | None = None,
        language: str = "en",
    ) -> VoiceProfile:
        """Create a voice profile from a reference audio sample."""
        if content_type not in ALLOWED_AUDIO_TYPES:
            raise ValueError(f"Unsupported audio format: {content_type}. Use WAV, MP3, OGG, or FLAC.")

        # Validate audio duration using ffprobe
        duration_sec, sample_rate = await self._probe_audio(audio_data)
        if duration_sec < MIN_REFERENCE_DURATION_SEC:
            raise ValueError(f"Audio too short ({duration_sec:.1f}s). Minimum {MIN_REFERENCE_DURATION_SEC}s required.")
        if duration_sec > MAX_REFERENCE_DURATION_SEC:
            raise ValueError(f"Audio too long ({duration_sec:.1f}s). Maximum {MAX_REFERENCE_DURATION_SEC}s allowed.")

        # Upload reference audio to GCS
        profile_id = uuid.uuid4()
        gcs_path = f"voice-profiles/{user_id}/{profile_id}.wav"
        audio_url = await upload_to_gcs(
            bucket_name=settings.GCS_BUCKET_VOICE_PROFILES,
            blob_path=gcs_path,
            data=audio_data,
            content_type="audio/wav",
        )

        # Create database record
        profile = VoiceProfile(
            id=profile_id,
            user_id=user_id,
            name=name,
            description=description,
            reference_audio_url=audio_url,
            reference_duration_sec=duration_sec,
            sample_rate=sample_rate,
            language=language,
        )
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)

        logger.info("voice_profile_created", profile_id=str(profile_id), user_id=str(user_id), duration=duration_sec)
        return profile

    async def list_voices(self, user_id: uuid.UUID) -> list[VoiceProfile]:
        """List all voice profiles for a user."""
        result = await self.db.execute(
            select(VoiceProfile)
            .where(VoiceProfile.user_id == user_id, VoiceProfile.is_active.is_(True))
            .order_by(VoiceProfile.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_voice(self, voice_id: uuid.UUID, user_id: uuid.UUID) -> VoiceProfile | None:
        """Get a specific voice profile."""
        result = await self.db.execute(
            select(VoiceProfile).where(
                VoiceProfile.id == voice_id,
                VoiceProfile.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete_voice(self, voice_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Soft-delete a voice profile."""
        profile = await self.get_voice(voice_id, user_id)
        if not profile:
            return False
        profile.is_active = False
        await self.db.commit()
        return True

    async def create_synthesis_job(
        self,
        voice_id: uuid.UUID,
        user_id: uuid.UUID,
        text: str,
        exaggeration: float = 0.5,
        cfg_weight: float = 0.5,
    ) -> VoiceSynthesisJob:
        """Create a synthesis job (dispatched to Celery)."""
        profile = await self.get_voice(voice_id, user_id)
        if not profile:
            raise ValueError("Voice profile not found")
        if not profile.is_active:
            raise ValueError("Voice profile is inactive")

        job = VoiceSynthesisJob(
            voice_profile_id=voice_id,
            user_id=user_id,
            input_text=text,
            status="pending",
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)

        # Dispatch Celery task
        from app.tasks.voice_tasks import synthesize_voice_task
        task = synthesize_voice_task.delay(
            job_id=str(job.id),
            voice_profile_id=str(voice_id),
            text=text,
            reference_audio_url=profile.reference_audio_url,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )

        job.celery_task_id = task.id
        await self.db.commit()

        return job

    async def _probe_audio(self, audio_data: bytes) -> tuple[float, int]:
        """Use ffprobe to get audio duration and sample rate."""
        import subprocess
        import tempfile
        from pathlib import Path

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp.write(audio_data)
        tmp.close()

        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "quiet", "-print_format", "json",
                    "-show_format", "-show_streams", tmp.name,
                ],
                capture_output=True, text=True, timeout=10,
            )
            import json
            info = json.loads(result.stdout)
            duration = float(info["format"]["duration"])
            sample_rate = int(info["streams"][0]["sample_rate"])
            return duration, sample_rate
        finally:
            Path(tmp.name).unlink(missing_ok=True)
```

### Step 6: Celery Task

Create `backend/app/tasks/voice_tasks.py`:
```python
import io
import uuid
from datetime import datetime, timezone

import httpx
import structlog
from celery import shared_task
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_sync_session
from app.core.storage import upload_to_gcs_sync
from app.models.voice_profile import VoiceSynthesisJob

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    name="voice.synthesize",
    max_retries=2,
    default_retry_delay=30,
    queue="gpu",
    time_limit=300,
    soft_time_limit=240,
)
def synthesize_voice_task(
    self,
    job_id: str,
    voice_profile_id: str,
    text: str,
    reference_audio_url: str,
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
):
    """Celery task to synthesize speech with cloned voice via Chatterbox service."""
    with get_sync_session() as db:
        job = db.execute(
            select(VoiceSynthesisJob).where(VoiceSynthesisJob.id == uuid.UUID(job_id))
        ).scalar_one()

        job.status = "processing"
        db.commit()

        try:
            # Call Chatterbox microservice
            response = httpx.post(
                f"{settings.CHATTERBOX_URL}/clone",
                json={
                    "text": text,
                    "reference_audio_url": reference_audio_url,
                    "exaggeration": exaggeration,
                    "cfg_weight": cfg_weight,
                },
                timeout=240,
            )
            response.raise_for_status()

            # Read duration from response header
            duration_sec = float(response.headers.get("X-Duration-Sec", 0))

            # Upload synthesized audio to GCS
            output_path = f"synthesized/{job.user_id}/{job_id}.wav"
            output_url = upload_to_gcs_sync(
                bucket_name=settings.GCS_BUCKET_SYNTHESIZED,
                blob_path=output_path,
                data=response.content,
                content_type="audio/wav",
            )

            # Update job record
            job.output_audio_url = output_url
            job.duration_sec = duration_sec
            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

            logger.info("voice_synthesis_completed", job_id=job_id, duration=duration_sec)

        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)[:2000]
            db.commit()
            logger.error("voice_synthesis_failed", job_id=job_id, error=str(exc))
            raise self.retry(exc=exc)
```

### Step 7: API Routes

Create `backend/app/api/v1/voices.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.voice import (
    VoiceProfileCreate,
    VoiceProfileList,
    VoiceProfileResponse,
    SynthesizeRequest,
    SynthesisJobResponse,
)
from app.services.voice_service import VoiceService

router = APIRouter(prefix="/voices", tags=["Voice Cloning"])

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/enroll", response_model=VoiceProfileResponse, status_code=status.HTTP_201_CREATED)
async def enroll_voice(
    name: str = Form(...),
    description: str | None = Form(None),
    language: str = Form("en"),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a 5-30 second audio sample to create a voice profile."""
    # Validate file size
    audio_data = await audio.read()
    if len(audio_data) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB.",
        )

    service = VoiceService(db)
    try:
        profile = await service.enroll_voice(
            user_id=user.id,
            name=name,
            audio_data=audio_data,
            content_type=audio.content_type or "audio/wav",
            description=description,
            language=language,
        )
        return profile
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=VoiceProfileList)
async def list_voices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all voice profiles for the current user."""
    service = VoiceService(db)
    voices = await service.list_voices(user.id)
    return VoiceProfileList(voices=voices, total=len(voices))


@router.get("/{voice_id}", response_model=VoiceProfileResponse)
async def get_voice(
    voice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific voice profile."""
    service = VoiceService(db)
    profile = await service.get_voice(voice_id, user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice profile not found")
    return profile


@router.delete("/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice(
    voice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a voice profile."""
    service = VoiceService(db)
    deleted = await service.delete_voice(voice_id, user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice profile not found")


@router.post("/{voice_id}/synthesize", response_model=SynthesisJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def synthesize_voice(
    voice_id: uuid.UUID,
    req: SynthesizeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Synthesize text using a cloned voice. Returns job ID for polling."""
    service = VoiceService(db)
    try:
        job = await service.create_synthesis_job(
            voice_id=voice_id,
            user_id=user.id,
            text=req.text,
            exaggeration=req.exaggeration,
            cfg_weight=req.cfg_weight,
        )
        return job
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
```

Register the router in `backend/app/api/v1/router.py`:
```python
from app.api.v1.voices import router as voices_router

# Add to the v1 router
api_v1_router.include_router(voices_router)
```

### Step 8: Frontend — Voice Enrollment Component

Create `frontend/src/components/voice/VoiceEnrollment.tsx`:
```tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

interface VoiceProfile {
  id: string;
  name: string;
  description: string | null;
  reference_duration_sec: number;
  language: string;
  created_at: string;
}

export function VoiceEnrollment({ onEnrolled }: { onEnrolled: (profile: VoiceProfile) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const recordedFile = new File([blob], "voice-sample.webm", { type: "audio/webm" });
        setFile(recordedFile);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.current.start();
      setRecording(true);

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorder.current?.state === "recording") {
          mediaRecorder.current.stop();
          setRecording(false);
        }
      }, 10000);
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("language", "en");
    formData.append("audio", file);

    try {
      const profile = await apiClient.post<VoiceProfile>("/api/v1/voices/enroll", formData);
      onEnrolled(profile);
      setName("");
      setDescription("");
      setFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to enroll voice";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Voice Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="voice-name">Voice Name</Label>
          <Input
            id="voice-name"
            placeholder="My Narration Voice"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice-desc">Description (optional)</Label>
          <Textarea
            id="voice-desc"
            placeholder="Warm, professional tone for tech videos"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Voice Sample (5-30 seconds)</Label>
          <div className="flex gap-2">
            <Button
              variant={recording ? "destructive" : "outline"}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? "Stop Recording" : "Record Sample"}
            </Button>
            <span className="text-sm text-muted-foreground self-center">or</span>
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={!file || !name.trim() || loading}>
          {loading ? "Enrolling..." : "Create Voice Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Step 9: Deploy Chatterbox to Cloud Run GPU

```bash
# Build and push Docker image
gcloud builds submit services/chatterbox/ \
  --tag us-central1-docker.pkg.dev/openclip-prod/openclip-images/chatterbox

# Deploy to Cloud Run with L4 GPU
gcloud run deploy chatterbox-service \
  --image us-central1-docker.pkg.dev/openclip-prod/openclip-images/chatterbox \
  --region us-central1 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 4 \
  --memory 16Gi \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@openclip-prod.iam.gserviceaccount.com \
  --vpc-connector openclip-connector \
  --set-env-vars "DEVICE=cuda"
```

### Step 10: Configuration

Add to `backend/app/core/config.py`:
```python
class Settings(BaseSettings):
    # ... existing settings ...
    CHATTERBOX_URL: str = "http://localhost:8010"
    GCS_BUCKET_VOICE_PROFILES: str = "openclip-prod-voice-profiles"
    GCS_BUCKET_SYNTHESIZED: str = "openclip-prod-synthesized"
```

Add to `.env.example`:
```bash
# Voice Cloning
CHATTERBOX_URL=http://chatterbox-service:8010
GCS_BUCKET_VOICE_PROFILES=openclip-prod-voice-profiles
GCS_BUCKET_SYNTHESIZED=openclip-prod-synthesized
```

## Best Practices
- **Reference audio quality matters:** Validate uploaded audio for noise levels. Reject samples with excessive background noise using simple RMS energy thresholds.
- **Cache reference embeddings:** Chatterbox extracts a speaker embedding from reference audio on each call. Consider caching these embeddings in GCS alongside the raw audio to speed up repeated synthesis.
- **Rate limit synthesis:** Voice synthesis is GPU-intensive. Limit to 10 synthesis requests per user per hour on free tier.
- **Audio normalization:** Normalize reference audio to -20 dBFS before storing to ensure consistent quality across different recording setups.
- **Scale-to-zero trade-off:** Cold start for Chatterbox with model loading is ~45-60 seconds. For production, consider `min-instances=1` to keep one instance warm during business hours.
- **Text chunking:** For long texts (over 500 characters), split into sentence-level chunks, synthesize each, and concatenate. This improves quality and avoids memory issues.

## Testing
- Upload a 5-second WAV sample and verify voice profile creation
- Synthesize a short sentence and compare to reference voice
- Test with different audio formats (WAV, MP3, OGG)
- Test rejection of audio shorter than 3 seconds
- Test rejection of audio longer than 30 seconds
- Verify GPU utilization on Chatterbox service during synthesis
- Test Celery task retry on transient Chatterbox service failures
- Verify synthesized audio is stored correctly in GCS
- Load test: 5 concurrent synthesis requests

## Verification Checklist
- [ ] Chatterbox service starts and loads model on GPU
- [ ] `/health` endpoint returns GPU info and model status
- [ ] Voice enrollment accepts 5-30 second audio samples
- [ ] Voice enrollment rejects too-short and too-long samples
- [ ] Voice profiles are stored in PostgreSQL with correct metadata
- [ ] Reference audio is uploaded to GCS voice-profiles bucket
- [ ] Synthesis endpoint returns 202 with job ID
- [ ] Celery task calls Chatterbox service and receives audio
- [ ] Synthesized audio is uploaded to GCS synthesized bucket
- [ ] Job status transitions: pending -> processing -> completed/failed
- [ ] Frontend voice enrollment UI records and uploads audio
- [ ] Cloud Run deployment works with L4 GPU and scale-to-zero
- [ ] API rejects requests for inactive/deleted voice profiles
- [ ] Error handling covers Chatterbox service downtime gracefully
