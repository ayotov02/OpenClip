# Multi-Camera Editing — Implementation Guide

## Overview
- **What:** Build a multi-camera editing system that synchronizes up to 4 camera angles using audio fingerprinting, automatically switches between cameras based on active speaker detection (pyannote diarization), and allows manual override for camera selection per segment. Final assembly via FFmpeg.
- **Why:** Multi-camera content (podcasts, interviews, panel discussions, live events) is one of the fastest-growing video formats. Manual multi-cam editing in Premiere Pro or DaVinci Resolve is extremely time-consuming. Automated switching based on active speaker saves hours of editing per episode.
- **Dependencies:** Phase 1 Feature 5 (WhisperX + pyannote diarization), Phase 1 Feature 4 (Video Processing / FFmpeg), Phase 1 Feature 3 (Celery Job Queue)

## Architecture

### System Design
```
User uploads 2-4 camera angles (video files)
  |
  v
[1] Audio Fingerprint Sync
  -> Extract audio from each camera
  -> Cross-correlate audio waveforms to find time offsets
  -> Align all cameras to a common timeline
  |
  v
[2] Speaker Diarization
  -> Run pyannote.audio on the primary (best audio) camera
  -> Identify who is speaking at each moment
  -> Segment timeline: [{speaker, start, end}, ...]
  |
  v
[3] Speaker-to-Camera Mapping
  -> User maps speakers to preferred cameras
  -> Or auto-detect: face detection per camera, match faces to speakers
  |
  v
[4] Auto-Switch Generation
  -> For each diarization segment, select the camera showing the active speaker
  -> Apply minimum cut duration (avoid rapid switching)
  -> Generate edit decision list (EDL)
  |
  v
[5] Manual Override (Optional)
  -> User reviews auto-generated edit in timeline UI
  -> Drag to change camera assignments per segment
  |
  v
[6] Final Assembly (FFmpeg)
  -> Concatenate selected segments from each camera
  -> Use primary audio track throughout
  -> Output single multi-cam edited video
```

### Data Flow
```
+---------------------+
| Camera 1 (wide)     |----+
+---------------------+    |
                           |     +------------------+
+---------------------+    +---->| Audio Sync       |
| Camera 2 (speaker A)|----+--->| Cross-correlation|
+---------------------+    |    | Find offsets     |
                           |    +--------+---------+
+---------------------+    |             |
| Camera 3 (speaker B)|----+             v
+---------------------+    |    +------------------+
                           |    | Aligned Timeline |
+---------------------+    |    +--------+---------+
| Camera 4 (closeup)  |----+             |
+---------------------+                  v
                              +------------------+
                              | Pyannote Diarize |
                              | (active speaker) |
                              +--------+---------+
                                       |
                                       v
                              +-------------------+
                              | EDL Generator     |
                              | speaker->camera   |
                              | min cut duration  |
                              +--------+----------+
                                       |
                              +--------v----------+
                              | User Override UI  |
                              | (optional edits)  |
                              +--------+----------+
                                       |
                                       v
                              +-------------------+
                              | FFmpeg Assembly   |
                              | concat segments   |
                              | primary audio     |
                              +-------------------+
                                       |
                                       v
                              +-------------------+
                              | Output Video      |
                              | (GCS)             |
                              +-------------------+
```

### API Endpoints
```
POST   /api/v1/multicam/projects                       -> Create multicam project
POST   /api/v1/multicam/projects/{id}/cameras           -> Add camera angle
DELETE /api/v1/multicam/projects/{id}/cameras/{cam_id}  -> Remove camera angle
POST   /api/v1/multicam/projects/{id}/sync              -> Sync cameras (audio fingerprint)
POST   /api/v1/multicam/projects/{id}/auto-edit         -> Generate auto-edit (diarization)
GET    /api/v1/multicam/projects/{id}/edl               -> Get edit decision list
PUT    /api/v1/multicam/projects/{id}/edl               -> Update EDL (manual overrides)
POST   /api/v1/multicam/projects/{id}/render            -> Render final video
GET    /api/v1/multicam/projects/{id}                   -> Get project status
```

## GCP Deployment
- **Audio sync and FFmpeg assembly:** Standard Celery worker (CPU-bound)
- **Diarization (pyannote):** Cloud Run GPU (shared with WhisperX service)
- **Storage:** GCS for all camera uploads and output
- **No additional GPU infra needed** — reuses existing WhisperX/pyannote service

## Step-by-Step Implementation

### Step 1: Database Migration

Create `backend/alembic/versions/xxxx_add_multicam_tables.py`:
```python
"""Add multicam tables

Revision ID: e5f6g7h8i9j0
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "e5f6g7h8i9j0"
down_revision = "<previous_migration>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "multicam_projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("primary_camera_id", UUID(as_uuid=True), nullable=True),
        sa.Column("sync_offsets", JSONB, nullable=True),  # {camera_id: offset_seconds}
        sa.Column("diarization_result", JSONB, nullable=True),
        sa.Column("speaker_camera_map", JSONB, nullable=True),  # {speaker_id: camera_id}
        sa.Column("output_video_url", sa.String(2048), nullable=True),
        sa.Column("total_duration_sec", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_multicam_projects_user_id", "multicam_projects", ["user_id"])

    op.create_table(
        "multicam_cameras",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("multicam_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),  # e.g., "Wide Shot", "Speaker A"
        sa.Column("video_url", sa.String(2048), nullable=False),
        sa.Column("audio_url", sa.String(2048), nullable=True),
        sa.Column("duration_sec", sa.Float, nullable=True),
        sa.Column("resolution", sa.String(20), nullable=True),
        sa.Column("fps", sa.Float, nullable=True),
        sa.Column("sync_offset_sec", sa.Float, nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_multicam_cameras_project_id", "multicam_cameras", ["project_id"])

    op.create_table(
        "multicam_edl_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("multicam_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("camera_id", UUID(as_uuid=True), sa.ForeignKey("multicam_cameras.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_sec", sa.Float, nullable=False),
        sa.Column("end_sec", sa.Float, nullable=False),
        sa.Column("speaker_id", sa.String(50), nullable=True),
        sa.Column("is_manual_override", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer, nullable=False),
        sa.Column("transition", sa.String(20), nullable=False, server_default="cut"),  # cut, dissolve
    )
    op.create_index("ix_multicam_edl_project_id", "multicam_edl_entries", ["project_id"])


def downgrade() -> None:
    op.drop_table("multicam_edl_entries")
    op.drop_table("multicam_cameras")
    op.drop_table("multicam_projects")
```

### Step 2: SQLAlchemy Models

Create `backend/app/models/multicam.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base


class MulticamProject(Base):
    __tablename__ = "multicam_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    primary_camera_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    sync_offsets: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    diarization_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    speaker_camera_map: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    total_duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cameras: Mapped[list["MulticamCamera"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    edl_entries: Mapped[list["MulticamEDLEntry"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class MulticamCamera(Base):
    __tablename__ = "multicam_cameras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("multicam_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    video_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    sync_offset_sec: Mapped[float] = mapped_column(Float, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["MulticamProject"] = relationship(back_populates="cameras")


class MulticamEDLEntry(Base):
    __tablename__ = "multicam_edl_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("multicam_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    camera_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("multicam_cameras.id", ondelete="CASCADE"), nullable=False
    )
    start_sec: Mapped[float] = mapped_column(Float, nullable=False)
    end_sec: Mapped[float] = mapped_column(Float, nullable=False)
    speaker_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_manual_override: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    transition: Mapped[str] = mapped_column(String(20), default="cut")

    project: Mapped["MulticamProject"] = relationship(back_populates="edl_entries")
```

### Step 3: Audio Sync Service

Create `backend/app/services/multicam/audio_sync.py`:
```python
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import structlog

logger = structlog.get_logger()


class AudioSyncService:
    """Synchronize multiple camera angles using audio cross-correlation."""

    def extract_audio(self, video_path: str) -> str:
        """Extract audio from video as mono 16kHz WAV for fingerprinting."""
        output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", video_path,
                "-vn", "-acodec", "pcm_s16le",
                "-ar", "16000", "-ac", "1",
                output_path,
            ],
            capture_output=True, check=True, timeout=120,
        )
        return output_path

    def compute_offset(self, reference_audio: str, target_audio: str) -> float:
        """Compute time offset of target relative to reference using cross-correlation.

        Returns:
            Offset in seconds. Positive = target starts after reference.
        """
        import scipy.io.wavfile as wav
        from scipy.signal import correlate, fftconvolve

        # Read audio files
        ref_rate, ref_data = wav.read(reference_audio)
        tgt_rate, tgt_data = wav.read(target_audio)

        assert ref_rate == tgt_rate == 16000, "Both audio files must be 16kHz"

        # Normalize
        ref_data = ref_data.astype(np.float32) / 32768.0
        tgt_data = tgt_data.astype(np.float32) / 32768.0

        # Use first 60 seconds for correlation (faster, sufficient for sync)
        max_samples = 60 * 16000
        ref_chunk = ref_data[:max_samples]
        tgt_chunk = tgt_data[:max_samples]

        # Cross-correlate using FFT (much faster than direct correlation)
        correlation = fftconvolve(ref_chunk, tgt_chunk[::-1], mode="full")

        # Find peak
        peak_idx = np.argmax(np.abs(correlation))
        offset_samples = peak_idx - len(tgt_chunk) + 1
        offset_sec = offset_samples / 16000.0

        logger.info(
            "audio_sync_computed",
            offset_sec=round(offset_sec, 4),
            correlation_peak=round(float(np.max(np.abs(correlation))), 4),
        )

        return round(offset_sec, 4)

    def sync_cameras(
        self,
        camera_videos: list[dict],
        primary_camera_idx: int = 0,
    ) -> dict[str, float]:
        """Compute sync offsets for all cameras relative to the primary camera.

        Args:
            camera_videos: List of {id, video_path} dicts
            primary_camera_idx: Index of the reference camera (offset = 0)

        Returns:
            Dict of {camera_id: offset_seconds}
        """
        # Extract audio from all cameras
        audio_paths = {}
        for cam in camera_videos:
            audio_paths[cam["id"]] = self.extract_audio(cam["video_path"])

        primary_id = camera_videos[primary_camera_idx]["id"]
        reference_audio = audio_paths[primary_id]

        offsets = {primary_id: 0.0}

        for cam in camera_videos:
            if cam["id"] == primary_id:
                continue
            offset = self.compute_offset(reference_audio, audio_paths[cam["id"]])
            offsets[cam["id"]] = offset

        # Cleanup temp audio files
        for path in audio_paths.values():
            Path(path).unlink(missing_ok=True)

        return offsets
```

### Step 4: Auto-Edit Generator

Create `backend/app/services/multicam/auto_editor.py`:
```python
import uuid

import structlog

logger = structlog.get_logger()

# Minimum duration for a camera cut (avoid jarring rapid switches)
MIN_CUT_DURATION_SEC = 2.0


class AutoEditor:
    """Generate automatic camera switching based on speaker diarization."""

    def generate_edl(
        self,
        diarization_segments: list[dict],
        speaker_camera_map: dict[str, str],
        default_camera_id: str,
        min_cut_duration: float = MIN_CUT_DURATION_SEC,
    ) -> list[dict]:
        """Generate Edit Decision List from diarization and speaker-camera mapping.

        Args:
            diarization_segments: [{speaker, start, end}, ...] from pyannote
            speaker_camera_map: {speaker_id: camera_id} mapping
            default_camera_id: Camera to use when no speaker is active (wide shot)
            min_cut_duration: Minimum seconds per camera cut

        Returns:
            List of EDL entries: [{camera_id, start_sec, end_sec, speaker_id, sort_order}, ...]
        """
        if not diarization_segments:
            return []

        # Sort segments by start time
        segments = sorted(diarization_segments, key=lambda s: s["start"])

        # Generate raw cuts
        raw_cuts = []
        for seg in segments:
            speaker = seg.get("speaker", "UNKNOWN")
            camera_id = speaker_camera_map.get(speaker, default_camera_id)
            raw_cuts.append({
                "camera_id": camera_id,
                "start_sec": seg["start"],
                "end_sec": seg["end"],
                "speaker_id": speaker,
            })

        # Fill gaps with default camera
        filled_cuts = self._fill_gaps(raw_cuts, default_camera_id, segments[-1]["end"])

        # Merge consecutive same-camera segments
        merged = self._merge_consecutive(filled_cuts)

        # Enforce minimum cut duration
        enforced = self._enforce_min_duration(merged, min_cut_duration)

        # Add sort order
        for i, cut in enumerate(enforced):
            cut["sort_order"] = i

        return enforced

    def _fill_gaps(self, cuts: list[dict], default_camera_id: str, total_duration: float) -> list[dict]:
        """Fill gaps between speaker segments with default camera."""
        filled = []
        current_time = 0.0

        for cut in cuts:
            if cut["start_sec"] > current_time + 0.1:
                # Gap detected, fill with default camera
                filled.append({
                    "camera_id": default_camera_id,
                    "start_sec": current_time,
                    "end_sec": cut["start_sec"],
                    "speaker_id": None,
                })
            filled.append(cut)
            current_time = cut["end_sec"]

        # Fill trailing gap
        if current_time < total_duration - 0.1:
            filled.append({
                "camera_id": default_camera_id,
                "start_sec": current_time,
                "end_sec": total_duration,
                "speaker_id": None,
            })

        return filled

    def _merge_consecutive(self, cuts: list[dict]) -> list[dict]:
        """Merge consecutive entries with the same camera."""
        if not cuts:
            return []

        merged = [cuts[0].copy()]
        for cut in cuts[1:]:
            if cut["camera_id"] == merged[-1]["camera_id"]:
                merged[-1]["end_sec"] = cut["end_sec"]
            else:
                merged.append(cut.copy())

        return merged

    def _enforce_min_duration(self, cuts: list[dict], min_duration: float) -> list[dict]:
        """Merge short cuts into adjacent cuts to avoid rapid switching."""
        if not cuts:
            return []

        result = [cuts[0].copy()]
        for cut in cuts[1:]:
            duration = cut["end_sec"] - cut["start_sec"]
            if duration < min_duration:
                # Merge with previous cut
                result[-1]["end_sec"] = cut["end_sec"]
            else:
                result.append(cut.copy())

        return result
```

### Step 5: FFmpeg Assembly Service

Create `backend/app/services/multicam/assembler.py`:
```python
import subprocess
import tempfile
from pathlib import Path

import structlog

logger = structlog.get_logger()


class MulticamAssembler:
    """Assemble final multi-camera video from EDL using FFmpeg."""

    def render(
        self,
        edl: list[dict],
        camera_files: dict[str, str],
        camera_offsets: dict[str, float],
        primary_audio_path: str,
        output_path: str | None = None,
        resolution: str = "1920x1080",
        fps: float = 30.0,
    ) -> str:
        """Render final multi-cam video.

        Args:
            edl: Edit decision list [{camera_id, start_sec, end_sec}, ...]
            camera_files: {camera_id: video_file_path}
            camera_offsets: {camera_id: sync_offset_seconds}
            primary_audio_path: Audio track to use (from primary camera)
            output_path: Output file path
            resolution: Target resolution
            fps: Target frame rate

        Returns:
            Path to rendered video
        """
        if output_path is None:
            output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name

        # Generate individual segments
        segment_files = []
        for i, entry in enumerate(edl):
            cam_id = entry["camera_id"]
            cam_file = camera_files[cam_id]
            offset = camera_offsets.get(cam_id, 0.0)

            # Calculate actual timestamps in the camera file
            # (adjusted for sync offset)
            cam_start = entry["start_sec"] + offset
            cam_end = entry["end_sec"] + offset
            duration = cam_end - cam_start

            segment_path = tempfile.NamedTemporaryFile(delete=False, suffix=f"_seg{i:04d}.mp4").name

            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-ss", str(max(0, cam_start)),
                    "-i", cam_file,
                    "-t", str(duration),
                    "-vf", f"scale={resolution}:force_original_aspect_ratio=decrease,pad={resolution}:(ow-iw)/2:(oh-ih)/2",
                    "-r", str(fps),
                    "-an",  # No audio (we add primary audio later)
                    "-c:v", "libx264",
                    "-crf", "18",
                    "-preset", "fast",
                    segment_path,
                ],
                capture_output=True, check=True, timeout=120,
            )
            segment_files.append(segment_path)

        # Create concat file
        concat_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt", mode="w")
        for seg_file in segment_files:
            concat_file.write(f"file '{seg_file}'\n")
        concat_file.close()

        # Concatenate segments
        video_only = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file.name,
                "-c", "copy",
                video_only,
            ],
            capture_output=True, check=True, timeout=300,
        )

        # Mux with primary audio
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_only,
                "-i", primary_audio_path,
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-shortest",
                output_path,
            ],
            capture_output=True, check=True, timeout=300,
        )

        # Cleanup temp files
        for seg_file in segment_files:
            Path(seg_file).unlink(missing_ok=True)
        Path(concat_file.name).unlink(missing_ok=True)
        Path(video_only).unlink(missing_ok=True)

        logger.info("multicam_render_complete", segments=len(edl), output=output_path)
        return output_path
```

### Step 6: Celery Tasks

Create `backend/app/tasks/multicam_tasks.py`:
```python
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import get_sync_session
from app.core.storage import download_from_gcs_sync, upload_to_gcs_sync
from app.models.multicam import MulticamProject, MulticamCamera, MulticamEDLEntry
from app.services.multicam.audio_sync import AudioSyncService
from app.services.multicam.auto_editor import AutoEditor
from app.services.multicam.assembler import MulticamAssembler

logger = structlog.get_logger()


@celery_app.task(bind=True, name="multicam.sync", queue="default", time_limit=300)
def sync_cameras_task(self, project_id: str):
    """Sync camera audio and compute offsets."""
    with get_sync_session() as db:
        project = db.execute(
            select(MulticamProject)
            .options(joinedload(MulticamProject.cameras))
            .where(MulticamProject.id == uuid.UUID(project_id))
        ).unique().scalar_one()

        try:
            project.status = "syncing"
            db.commit()

            sync_service = AudioSyncService()

            # Download all camera videos
            camera_videos = []
            for cam in project.cameras:
                local_path = f"/tmp/multicam_{project_id}_{cam.id}.mp4"
                download_from_gcs_sync(cam.video_url, local_path)
                camera_videos.append({"id": str(cam.id), "video_path": local_path})

            # Compute sync offsets
            offsets = sync_service.sync_cameras(camera_videos, primary_camera_idx=0)

            # Update project and cameras
            project.sync_offsets = offsets
            for cam in project.cameras:
                cam.sync_offset_sec = offsets.get(str(cam.id), 0.0)

            project.status = "synced"
            db.commit()

            logger.info("multicam_sync_complete", project_id=project_id, offsets=offsets)

        except Exception as exc:
            project.status = "sync_failed"
            db.commit()
            logger.error("multicam_sync_failed", project_id=project_id, error=str(exc))
            raise


@celery_app.task(bind=True, name="multicam.auto_edit", queue="gpu", time_limit=600)
def auto_edit_task(self, project_id: str):
    """Run diarization and generate auto-edit EDL."""
    with get_sync_session() as db:
        project = db.execute(
            select(MulticamProject)
            .options(joinedload(MulticamProject.cameras))
            .where(MulticamProject.id == uuid.UUID(project_id))
        ).unique().scalar_one()

        try:
            project.status = "analyzing"
            db.commit()

            # Get primary camera audio for diarization
            primary_cam = next(
                (c for c in project.cameras if str(c.id) == str(project.primary_camera_id)),
                project.cameras[0],
            )

            # Transcribe and diarize via WhisperX
            resp = httpx.post(
                f"{settings.WHISPER_URL}/transcribe",
                json={
                    "audio_url": primary_cam.video_url,
                    "diarize": True,
                },
                timeout=600,
            )
            resp.raise_for_status()
            transcript = resp.json()

            project.diarization_result = transcript.get("speakers", [])
            db.commit()

            # Generate auto-edit EDL
            editor = AutoEditor()
            default_camera_id = str(project.cameras[0].id)

            edl = editor.generate_edl(
                diarization_segments=_flatten_speaker_segments(transcript),
                speaker_camera_map=project.speaker_camera_map or {},
                default_camera_id=default_camera_id,
            )

            # Store EDL entries
            for entry_data in edl:
                entry = MulticamEDLEntry(
                    project_id=project.id,
                    camera_id=uuid.UUID(entry_data["camera_id"]),
                    start_sec=entry_data["start_sec"],
                    end_sec=entry_data["end_sec"],
                    speaker_id=entry_data.get("speaker_id"),
                    sort_order=entry_data["sort_order"],
                )
                db.add(entry)

            project.status = "edl_ready"
            db.commit()

        except Exception as exc:
            project.status = "analysis_failed"
            db.commit()
            raise


@celery_app.task(bind=True, name="multicam.render", queue="default", time_limit=1800)
def render_multicam_task(self, project_id: str):
    """Render final multi-camera video from EDL."""
    with get_sync_session() as db:
        project = db.execute(
            select(MulticamProject)
            .options(
                joinedload(MulticamProject.cameras),
                joinedload(MulticamProject.edl_entries),
            )
            .where(MulticamProject.id == uuid.UUID(project_id))
        ).unique().scalar_one()

        try:
            project.status = "rendering"
            db.commit()

            # Download all camera files
            camera_files = {}
            for cam in project.cameras:
                local_path = f"/tmp/multicam_{project_id}_{cam.id}.mp4"
                download_from_gcs_sync(cam.video_url, local_path)
                camera_files[str(cam.id)] = local_path

            # Extract primary audio
            primary_cam = project.cameras[0]
            audio_path = f"/tmp/multicam_{project_id}_audio.wav"
            import subprocess
            subprocess.run(
                ["ffmpeg", "-y", "-i", camera_files[str(primary_cam.id)], "-vn", "-acodec", "pcm_s16le", audio_path],
                capture_output=True, check=True, timeout=120,
            )

            # Build EDL
            edl = [
                {
                    "camera_id": str(e.camera_id),
                    "start_sec": e.start_sec,
                    "end_sec": e.end_sec,
                }
                for e in sorted(project.edl_entries, key=lambda e: e.sort_order)
            ]

            # Render
            assembler = MulticamAssembler()
            output_path = assembler.render(
                edl=edl,
                camera_files=camera_files,
                camera_offsets=project.sync_offsets or {},
                primary_audio_path=audio_path,
            )

            # Upload
            output_url = upload_to_gcs_sync(
                bucket_name=settings.GCS_BUCKET_PROCESSED,
                blob_path=f"multicam/{project.user_id}/{project_id}/final.mp4",
                data=Path(output_path).read_bytes(),
                content_type="video/mp4",
            )

            project.output_video_url = output_url
            project.status = "completed"
            db.commit()

        except Exception as exc:
            project.status = "render_failed"
            db.commit()
            raise


def _flatten_speaker_segments(transcript: dict) -> list[dict]:
    """Extract speaker segments from WhisperX transcript."""
    segments = []
    for seg in transcript.get("segments", []):
        if seg.get("speaker"):
            segments.append({
                "speaker": seg["speaker"],
                "start": seg["start"],
                "end": seg["end"],
            })
    return segments
```

### Step 7: API Routes

Create `backend/app/api/v1/multicam.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.deps import get_current_user, get_db
from app.models.multicam import MulticamProject, MulticamCamera, MulticamEDLEntry
from app.models.user import User

router = APIRouter(prefix="/multicam", tags=["Multi-Camera Editing"])


class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class AddCameraRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    video_url: str


class SpeakerCameraMapRequest(BaseModel):
    speaker_camera_map: dict[str, str]  # {speaker_id: camera_id}


class EDLEntryUpdate(BaseModel):
    camera_id: uuid.UUID
    start_sec: float
    end_sec: float


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    cameras: list[dict]
    edl_entry_count: int
    output_video_url: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("/projects", status_code=status.HTTP_201_CREATED)
async def create_project(
    req: CreateProjectRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new multi-camera project."""
    project = MulticamProject(
        user_id=user.id,
        name=req.name,
        description=req.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {"id": project.id, "name": project.name, "status": project.status}


@router.post("/projects/{project_id}/cameras")
async def add_camera(
    project_id: uuid.UUID,
    req: AddCameraRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a camera angle to the project (max 4)."""
    project = await _get_project(db, project_id, user.id)

    # Check camera limit
    cam_count = len(project.cameras) if project.cameras else 0
    if cam_count >= 4:
        raise HTTPException(status_code=400, detail="Maximum 4 cameras per project")

    camera = MulticamCamera(
        project_id=project.id,
        label=req.label,
        video_url=req.video_url,
        sort_order=cam_count,
    )
    db.add(camera)

    # Set first camera as primary by default
    if cam_count == 0:
        project.primary_camera_id = camera.id

    await db.commit()
    await db.refresh(camera)
    return {"id": camera.id, "label": camera.label}


@router.post("/projects/{project_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_cameras(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Synchronize camera angles using audio fingerprinting."""
    project = await _get_project(db, project_id, user.id)
    if len(project.cameras) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 cameras to sync")

    from app.tasks.multicam_tasks import sync_cameras_task
    sync_cameras_task.delay(str(project.id))
    return {"status": "syncing"}


@router.post("/projects/{project_id}/auto-edit", status_code=status.HTTP_202_ACCEPTED)
async def auto_edit(
    project_id: uuid.UUID,
    req: SpeakerCameraMapRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate automatic camera switching based on active speaker."""
    project = await _get_project(db, project_id, user.id)
    if project.status not in ("synced", "edl_ready"):
        raise HTTPException(status_code=400, detail="Cameras must be synced first")

    if req and req.speaker_camera_map:
        project.speaker_camera_map = req.speaker_camera_map
        await db.commit()

    from app.tasks.multicam_tasks import auto_edit_task
    auto_edit_task.delay(str(project.id))
    return {"status": "analyzing"}


@router.get("/projects/{project_id}/edl")
async def get_edl(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the edit decision list."""
    project = await _get_project(db, project_id, user.id)
    entries = sorted(project.edl_entries, key=lambda e: e.sort_order)
    return {
        "entries": [
            {
                "id": str(e.id),
                "camera_id": str(e.camera_id),
                "start_sec": e.start_sec,
                "end_sec": e.end_sec,
                "speaker_id": e.speaker_id,
                "is_manual_override": e.is_manual_override,
                "transition": e.transition,
            }
            for e in entries
        ]
    }


@router.put("/projects/{project_id}/edl")
async def update_edl(
    project_id: uuid.UUID,
    entries: list[EDLEntryUpdate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update EDL with manual overrides."""
    project = await _get_project(db, project_id, user.id)

    # Clear existing entries
    for entry in project.edl_entries:
        await db.delete(entry)

    # Create new entries
    for i, entry_data in enumerate(entries):
        entry = MulticamEDLEntry(
            project_id=project.id,
            camera_id=entry_data.camera_id,
            start_sec=entry_data.start_sec,
            end_sec=entry_data.end_sec,
            is_manual_override=True,
            sort_order=i,
        )
        db.add(entry)

    await db.commit()
    return {"status": "updated", "entry_count": len(entries)}


@router.post("/projects/{project_id}/render", status_code=status.HTTP_202_ACCEPTED)
async def render_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Render the final multi-camera video."""
    project = await _get_project(db, project_id, user.id)
    if not project.edl_entries:
        raise HTTPException(status_code=400, detail="No EDL entries. Run auto-edit first.")

    from app.tasks.multicam_tasks import render_multicam_task
    render_multicam_task.delay(str(project.id))
    return {"status": "rendering"}


@router.get("/projects/{project_id}")
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get project details and status."""
    project = await _get_project(db, project_id, user.id)
    return {
        "id": str(project.id),
        "name": project.name,
        "status": project.status,
        "cameras": [
            {"id": str(c.id), "label": c.label, "sync_offset_sec": c.sync_offset_sec}
            for c in project.cameras
        ],
        "edl_entry_count": len(project.edl_entries),
        "output_video_url": project.output_video_url,
        "diarization_result": project.diarization_result,
        "speaker_camera_map": project.speaker_camera_map,
    }


async def _get_project(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> MulticamProject:
    result = await db.execute(
        select(MulticamProject)
        .options(joinedload(MulticamProject.cameras), joinedload(MulticamProject.edl_entries))
        .where(MulticamProject.id == project_id, MulticamProject.user_id == user_id)
    )
    project = result.unique().scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
```

Register in `backend/app/api/v1/router.py`:
```python
from app.api.v1.multicam import router as multicam_router

api_v1_router.include_router(multicam_router)
```

## Best Practices
- **Audio cross-correlation window:** Use only the first 60 seconds of audio for cross-correlation. This is sufficient for accurate sync and dramatically faster than full-length correlation.
- **Minimum cut duration:** Enforce a 2-second minimum per camera cut. Cuts shorter than 2 seconds feel jarring and unprofessional. Allow users to override this in manual mode.
- **Primary audio:** Always use audio from a single primary camera (or a dedicated audio recorder) for the final output. Mixing audio from multiple cameras causes phase issues.
- **Resolution normalization:** Scale all cameras to a common resolution before assembly. Different cameras may have different native resolutions.
- **Sync accuracy:** Audio cross-correlation achieves frame-level accuracy (~33ms at 30fps). This is sufficient for multi-cam editing. If higher precision is needed, allow manual fine-tuning of offsets.
- **Transition types:** Support "cut" (instant switch) and "dissolve" (cross-fade) transitions. Cuts are standard for interviews; dissolves work well for creative content.

## Testing
- Sync 2 cameras recorded simultaneously and verify offset accuracy within 1 frame
- Test auto-edit with a 2-person interview (verify each speaker gets their camera)
- Test manual EDL override
- Verify rendered output has no audio drift
- Test with cameras at different resolutions (1080p + 4K)
- Test with cameras at different frame rates (24fps + 30fps)
- Test gap filling with default camera
- Test minimum cut duration enforcement
- Verify 4-camera limit is enforced

## Verification Checklist
- [ ] Multicam project CRUD operations work
- [ ] Camera upload and registration works (up to 4)
- [ ] Audio sync computes accurate offsets (within 1 frame)
- [ ] Diarization identifies distinct speakers
- [ ] Auto-edit generates reasonable EDL
- [ ] Manual EDL override persists correctly
- [ ] Minimum cut duration is enforced
- [ ] Rendered video has correct camera switching
- [ ] Audio is continuous without gaps or overlaps
- [ ] Resolution normalization handles mixed cameras
- [ ] Project status updates at each pipeline stage
- [ ] Output video uploaded to GCS
- [ ] Cleanup of temp files after rendering
