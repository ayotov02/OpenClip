# Video Processing Pipeline — Implementation Guide

## Overview
- **What:** Build the FFmpeg-based video processing pipeline: upload handling, audio extraction, video cutting, encoding, format conversion, and storage management (GCS/MinIO).
- **Why:** FFmpeg is the foundation of all video operations — every feature (clipping, reframing, captioning) depends on reliable video I/O.
- **Dependencies:** Feature 1 (Project Setup), Feature 2 (FastAPI Backend), Feature 3 (Job Queue)

## Architecture

### Processing Pipeline
```
Upload → Validate → Store (GCS/MinIO) → Extract Metadata
  → Extract Audio (for STT) → Process (cut/encode/reframe)
  → Store Output → Update Job Status → Notify Client
```

### Data Flow
```
1. Client uploads video via multipart POST or provides URL
2. API stores raw file in GCS: gs://uploads/{user_id}/{project_id}/source.mp4
3. API creates Project + Job records
4. Celery task picks up job
5. Worker downloads source from GCS to local temp
6. FFmpeg processes video (extract audio, cut clips, encode)
7. Worker uploads outputs to GCS: gs://processed/{user_id}/{project_id}/
8. Worker updates job status in PostgreSQL
```

### Supported Operations
- Audio extraction (MP4 → WAV/PCM for Whisper)
- Video cutting (timestamp-based clip extraction)
- Format conversion (any → MP4 H.264)
- Resolution scaling (up to 4K)
- Aspect ratio conversion (16:9 → 9:16, 1:1, 4:5)
- Thumbnail extraction (frame at timestamp)

## GCP Deployment
- **Service:** Compute Engine worker (g2-standard-8 with L4 GPU for hardware-accelerated encoding)
- **Storage:** Cloud Storage (GCS) for input/output
- **Temp storage:** Local SSD on worker VM
- **Cost estimate:** Included in worker cost ($150-300/month)

## Step-by-Step Implementation

### Step 1: Create FFmpeg Wrapper
Create `backend/app/services/ffmpeg.py`:
```python
import json
import subprocess
from pathlib import Path

import structlog

logger = structlog.get_logger()


class FFmpegError(Exception):
    pass


class FFmpeg:
    """Wrapper around FFmpeg CLI for video processing operations."""

    @staticmethod
    def probe(input_path: str) -> dict:
        """Get video metadata using ffprobe."""
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format", "-show_streams",
            input_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise FFmpegError(f"ffprobe failed: {result.stderr}")
        return json.loads(result.stdout)

    @staticmethod
    def extract_audio(input_path: str, output_path: str, sample_rate: int = 16000) -> str:
        """Extract audio as mono WAV for Whisper processing."""
        cmd = [
            "ffmpeg", "-i", input_path,
            "-vn",                        # No video
            "-acodec", "pcm_s16le",       # PCM 16-bit
            "-ar", str(sample_rate),       # Sample rate
            "-ac", "1",                    # Mono
            "-y", output_path,
        ]
        _run_ffmpeg(cmd)
        return output_path

    @staticmethod
    def cut_clip(
        input_path: str,
        output_path: str,
        start_time: float,
        end_time: float,
        codec: str = "libx264",
    ) -> str:
        """Cut a clip from video at specified timestamps."""
        duration = end_time - start_time
        cmd = [
            "ffmpeg",
            "-ss", str(start_time),
            "-i", input_path,
            "-t", str(duration),
            "-c:v", codec,
            "-c:a", "aac",
            "-preset", "fast",
            "-crf", "23",
            "-movflags", "+faststart",
            "-y", output_path,
        ]
        _run_ffmpeg(cmd)
        return output_path

    @staticmethod
    def extract_thumbnail(input_path: str, output_path: str, timestamp: float = 1.0) -> str:
        """Extract a single frame as JPEG thumbnail."""
        cmd = [
            "ffmpeg",
            "-ss", str(timestamp),
            "-i", input_path,
            "-vframes", "1",
            "-q:v", "2",
            "-y", output_path,
        ]
        _run_ffmpeg(cmd)
        return output_path

    @staticmethod
    def resize(
        input_path: str,
        output_path: str,
        width: int,
        height: int,
    ) -> str:
        """Resize video to specified dimensions."""
        cmd = [
            "ffmpeg", "-i", input_path,
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                   f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "fast",
            "-y", output_path,
        ]
        _run_ffmpeg(cmd)
        return output_path


def _run_ffmpeg(cmd: list[str], timeout: int = 3600) -> subprocess.CompletedProcess:
    logger.info("ffmpeg.run", cmd=" ".join(cmd[:6]))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise FFmpegError(f"FFmpeg failed: {result.stderr[-500:]}")
    return result
```

### Step 2: Create Storage Service
Create `backend/app/services/storage.py`:
```python
import os
from pathlib import Path

from google.cloud import storage as gcs

from app.core.config import settings


class StorageService:
    """Abstraction over local filesystem and GCS."""

    def __init__(self):
        if settings.STORAGE_BACKEND == "gcs":
            self.client = gcs.Client()
        self.backend = settings.STORAGE_BACKEND

    def upload(self, local_path: str, remote_path: str, bucket: str = "") -> str:
        if self.backend == "gcs":
            bucket_name = bucket or settings.GCS_BUCKET_UPLOADS
            blob = self.client.bucket(bucket_name).blob(remote_path)
            blob.upload_from_filename(local_path)
            return f"gs://{bucket_name}/{remote_path}"
        else:
            dest = Path(settings.LOCAL_STORAGE_PATH) / remote_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            os.rename(local_path, str(dest))
            return str(dest)

    def download(self, remote_path: str, local_path: str, bucket: str = "") -> str:
        if self.backend == "gcs":
            bucket_name = bucket or settings.GCS_BUCKET_UPLOADS
            blob = self.client.bucket(bucket_name).blob(remote_path)
            blob.download_to_filename(local_path)
        else:
            src = Path(settings.LOCAL_STORAGE_PATH) / remote_path
            os.link(str(src), local_path)
        return local_path

    def get_signed_url(self, remote_path: str, bucket: str = "", expiration: int = 3600) -> str:
        if self.backend == "gcs":
            bucket_name = bucket or settings.GCS_BUCKET_PROCESSED
            blob = self.client.bucket(bucket_name).blob(remote_path)
            from datetime import timedelta
            return blob.generate_signed_url(expiration=timedelta(seconds=expiration))
        else:
            return f"/files/{remote_path}"
```

### Step 3: Create Upload API Endpoint
Create `backend/app/api/v1/projects.py`:
```python
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.storage import StorageService

router = APIRouter()
storage = StorageService()

MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024  # 10 GB
ALLOWED_TYPES = {"video/mp4", "video/quicktime", "video/x-matroska", "video/webm"}


@router.post("/")
async def create_project(
    file: UploadFile = File(None),
    source_url: str = Form(None),
    title: str = Form("Untitled"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file and not source_url:
        raise HTTPException(status_code=400, detail="Provide a file or URL")

    project_id = uuid.uuid4()

    if file:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        # Stream upload to storage
        remote_path = f"{user.id}/{project_id}/source{_ext(file.filename)}"
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=_ext(file.filename)) as tmp:
            while chunk := await file.read(8 * 1024 * 1024):  # 8MB chunks
                tmp.write(chunk)
            tmp_path = tmp.name

        file_url = storage.upload(tmp_path, remote_path)
    else:
        file_url = source_url

    # Create project record and dispatch job
    # ... (uses ProjectService + JobService)

    return {"project_id": str(project_id), "status": "pending"}


def _ext(filename: str | None) -> str:
    if filename and "." in filename:
        return "." + filename.rsplit(".", 1)[1].lower()
    return ".mp4"
```

### Step 4: Create Video Processing Celery Task
Create `backend/app/tasks/video.py`:
```python
import tempfile
from pathlib import Path

import structlog

from app.services.ffmpeg import FFmpeg
from app.services.storage import StorageService
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()
storage = StorageService()


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.video.extract_audio")
def extract_audio(self, job_id: str, source_path: str, project_id: str):
    """Extract audio from video for transcription."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        local_video = str(Path(tmp_dir) / "source.mp4")
        local_audio = str(Path(tmp_dir) / "audio.wav")

        self.update_progress(0.1, "Downloading video...")
        storage.download(source_path, local_video)

        self.update_progress(0.3, "Extracting audio...")
        FFmpeg.extract_audio(local_video, local_audio)

        self.update_progress(0.8, "Uploading audio...")
        remote_path = f"{project_id}/audio.wav"
        audio_url = storage.upload(local_audio, remote_path, bucket="processed")

        self.update_progress(1.0, "Complete")
        return {"audio_url": audio_url}


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.video.cut_clips")
def cut_clips(self, job_id: str, source_path: str, clips: list[dict], project_id: str):
    """Cut multiple clips from source video."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        local_video = str(Path(tmp_dir) / "source.mp4")
        storage.download(source_path, local_video)

        results = []
        for i, clip in enumerate(clips):
            progress = (i + 1) / len(clips)
            self.update_progress(progress * 0.9, f"Cutting clip {i + 1}/{len(clips)}...")

            output = str(Path(tmp_dir) / f"clip_{i}.mp4")
            FFmpeg.cut_clip(local_video, output, clip["start"], clip["end"])

            remote = f"{project_id}/clip_{i}.mp4"
            url = storage.upload(output, remote, bucket="processed")
            results.append({"clip_index": i, "url": url})

        return {"clips": results}
```

## Best Practices
- **Stream uploads:** Never load entire video into memory. Use chunked reads (8MB).
- **Temp directory cleanup:** Always use `tempfile.TemporaryDirectory()` as context manager.
- **FFmpeg `-movflags +faststart`:** Enables progressive download / streaming of output MP4s.
- **Validate file types:** Check MIME type AND magic bytes (not just extension).
- **Signed URLs:** Use GCS signed URLs (1-hour expiry) for serving processed files to clients.
- **Timeout on ffprobe:** Always set a timeout to prevent hanging on corrupt files.

## Testing
- Upload a test MP4 file via the API
- Verify it appears in GCS/local storage
- Run extract_audio task, verify WAV output
- Run cut_clips task with known timestamps, verify clips

## Verification Checklist
- [ ] Video upload endpoint accepts MP4, MOV, MKV, WebM
- [ ] Files stored correctly in GCS or local filesystem
- [ ] `ffprobe` returns video metadata (duration, resolution, codec)
- [ ] Audio extraction produces valid 16kHz mono WAV
- [ ] Clip cutting produces valid MP4 at correct timestamps
- [ ] Thumbnail extraction produces valid JPEG
- [ ] Resize produces correct dimensions
- [ ] Storage service works with both GCS and local backends
- [ ] Large files (1GB+) upload without memory issues
- [ ] Temp files are cleaned up after processing
