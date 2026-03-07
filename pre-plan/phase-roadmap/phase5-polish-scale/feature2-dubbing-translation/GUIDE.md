# Dubbing & Translation — Implementation Guide

## Overview
- **What:** Build a multi-language dubbing pipeline that takes original video audio, transcribes it, translates the transcript via Qwen3 LLM, and synthesizes the translation using TTS with timing alignment. Support 25+ languages via Whisper's language coverage.
- **Why:** Multi-language support massively expands creator reach. The global creator economy demands localization, and existing dubbing tools charge per minute. OpenClip provides this for free, fully self-hosted. Competitors like HeyGen charge $48/month for basic dubbing.
- **Dependencies:** Phase 1 Feature 5 (WhisperX STT), Phase 5 Feature 1 (Voice Cloning / Chatterbox), Phase 1 Feature 6 (LLM Integration / Ollama), Phase 1 Feature 3 (Celery Job Queue)

## Architecture

### System Design
```
Original Video
  |
  v
[1] Extract Audio (FFmpeg)
  |
  v
[2] Transcribe + Diarize (WhisperX)
  -> segments: [{text, start, end, speaker}]
  |
  v
[3] Translate Segments (Qwen3 via Ollama)
  -> translated_segments: [{original, translated, start, end, speaker}]
  |
  v
[4] Time-Align Translation
  -> Adjust sentence boundaries to fit original timing
  -> Split/merge sentences if needed for timing parity
  |
  v
[5] Synthesize TTS per Segment (Kokoro or Chatterbox)
  -> Generate audio for each translated segment
  -> Speed-adjust to match original segment duration
  |
  v
[6] Mix Audio Track
  -> Replace original speech with dubbed audio
  -> Preserve background music / SFX (vocal separation)
  -> Final FFmpeg mux with original video
  |
  v
Dubbed Video Output
```

### Data Flow
```
+------------------+
| Original Video   |
+--------+---------+
         |
    FFmpeg extract audio
         |
         v
+------------------+     +-------------------+
| WhisperX Service |---->| Transcript Segments|
| (Cloud Run GPU)  |     | with timestamps    |
+------------------+     +-------------------+
                                  |
                                  v
                         +-------------------+
                         | Qwen3 LLM         |
                         | (Ollama)           |
                         | Translate segment  |
                         | by segment         |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         | Timing Aligner    |
                         | Speed/pace adjust |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         | TTS Service       |
                         | (Kokoro/Chatterbox)|
                         | Per-segment synth |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         | Audio Mixer       |
                         | Vocal separation  |
                         | + dubbed overlay  |
                         | (FFmpeg)          |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         | Final Muxed Video |
                         | (GCS output)      |
                         +-------------------+
```

### API Endpoints
```
POST   /api/v1/dub                      -> Start dubbing job
GET    /api/v1/dub/{job_id}             -> Get dubbing job status
GET    /api/v1/dub/{job_id}/preview     -> Preview translated transcript before synthesis
POST   /api/v1/dub/{job_id}/approve     -> Approve translated transcript, proceed to synthesis
GET    /api/v1/dub/languages            -> List supported languages
DELETE /api/v1/dub/{job_id}             -> Cancel dubbing job
```

## GCP Deployment
- **WhisperX:** Cloud Run GPU (already deployed in Phase 1)
- **Qwen3 LLM:** GCP Compute Engine (already deployed in Phase 1 via Ollama)
- **TTS (Kokoro/Chatterbox):** Cloud Run GPU (already deployed)
- **Dubbing orchestrator:** Runs as Celery task on existing worker nodes
- **Vocal separation (Demucs):** GCP Compute Engine with L4 GPU, or bundled with worker
- **Cost estimate:** Per-video cost is sum of transcription + translation + TTS; no additional fixed infra needed

## Step-by-Step Implementation

### Step 1: Database Migration

Create `backend/alembic/versions/xxxx_add_dubbing_jobs.py`:
```python
"""Add dubbing_jobs table

Revision ID: b2c3d4e5f6g7
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "b2c3d4e5f6g7"
down_revision = "<previous_migration>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dubbing_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_video_id", UUID(as_uuid=True), sa.ForeignKey("videos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_language", sa.String(10), nullable=False),
        sa.Column("target_language", sa.String(10), nullable=False),
        sa.Column("voice_profile_id", UUID(as_uuid=True), sa.ForeignKey("voice_profiles.id"), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("current_step", sa.String(50), nullable=True),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("original_transcript", JSONB, nullable=True),
        sa.Column("translated_transcript", JSONB, nullable=True),
        sa.Column("timing_map", JSONB, nullable=True),
        sa.Column("output_video_url", sa.String(2048), nullable=True),
        sa.Column("output_audio_url", sa.String(2048), nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_dubbing_jobs_user_id", "dubbing_jobs", ["user_id"])
    op.create_index("ix_dubbing_jobs_status", "dubbing_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("dubbing_jobs")
```

### Step 2: SQLAlchemy Model

Create `backend/app/models/dubbing.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class DubbingJob(Base):
    __tablename__ = "dubbing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )
    source_language: Mapped[str] = mapped_column(String(10), nullable=False)
    target_language: Mapped[str] = mapped_column(String(10), nullable=False)
    voice_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("voice_profiles.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(30), default="pending")
    current_step: Mapped[str | None] = mapped_column(String(50), nullable=True)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    original_transcript: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    translated_transcript: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    timing_map: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    output_audio_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### Step 3: Supported Languages Configuration

Create `backend/app/services/dubbing/languages.py`:
```python
SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "whisper_code": "en", "tts_supported": True},
    "es": {"name": "Spanish", "whisper_code": "es", "tts_supported": True},
    "fr": {"name": "French", "whisper_code": "fr", "tts_supported": True},
    "de": {"name": "German", "whisper_code": "de", "tts_supported": True},
    "it": {"name": "Italian", "whisper_code": "it", "tts_supported": True},
    "pt": {"name": "Portuguese", "whisper_code": "pt", "tts_supported": True},
    "nl": {"name": "Dutch", "whisper_code": "nl", "tts_supported": True},
    "pl": {"name": "Polish", "whisper_code": "pl", "tts_supported": True},
    "ru": {"name": "Russian", "whisper_code": "ru", "tts_supported": True},
    "uk": {"name": "Ukrainian", "whisper_code": "uk", "tts_supported": True},
    "ja": {"name": "Japanese", "whisper_code": "ja", "tts_supported": True},
    "ko": {"name": "Korean", "whisper_code": "ko", "tts_supported": True},
    "zh": {"name": "Chinese (Mandarin)", "whisper_code": "zh", "tts_supported": True},
    "ar": {"name": "Arabic", "whisper_code": "ar", "tts_supported": True},
    "hi": {"name": "Hindi", "whisper_code": "hi", "tts_supported": True},
    "tr": {"name": "Turkish", "whisper_code": "tr", "tts_supported": True},
    "vi": {"name": "Vietnamese", "whisper_code": "vi", "tts_supported": True},
    "th": {"name": "Thai", "whisper_code": "th", "tts_supported": True},
    "sv": {"name": "Swedish", "whisper_code": "sv", "tts_supported": True},
    "da": {"name": "Danish", "whisper_code": "da", "tts_supported": True},
    "fi": {"name": "Finnish", "whisper_code": "fi", "tts_supported": True},
    "cs": {"name": "Czech", "whisper_code": "cs", "tts_supported": True},
    "ro": {"name": "Romanian", "whisper_code": "ro", "tts_supported": True},
    "hu": {"name": "Hungarian", "whisper_code": "hu", "tts_supported": True},
    "el": {"name": "Greek", "whisper_code": "el", "tts_supported": True},
    "id": {"name": "Indonesian", "whisper_code": "id", "tts_supported": True},
    "ms": {"name": "Malay", "whisper_code": "ms", "tts_supported": True},
}


def get_language(code: str) -> dict | None:
    return SUPPORTED_LANGUAGES.get(code)


def list_languages() -> list[dict]:
    return [{"code": k, **v} for k, v in SUPPORTED_LANGUAGES.items()]
```

### Step 4: Translation Service

Create `backend/app/services/dubbing/translator.py`:
```python
import json

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class TranslationService:
    """Translate transcript segments using Qwen3 LLM via Ollama."""

    def __init__(self):
        self.ollama_url = settings.OLLAMA_URL
        self.model = settings.LLM_MODEL  # e.g., "qwen3:32b"

    async def translate_segments(
        self,
        segments: list[dict],
        source_lang: str,
        target_lang: str,
    ) -> list[dict]:
        """Translate transcript segments while preserving timing metadata.

        Args:
            segments: List of {text, start, end, speaker} dicts
            source_lang: Source language code (e.g., "en")
            target_lang: Target language code (e.g., "es")

        Returns:
            List of {original_text, translated_text, start, end, speaker} dicts
        """
        translated = []

        # Batch segments for efficiency (5 at a time)
        batch_size = 5
        for i in range(0, len(segments), batch_size):
            batch = segments[i:i + batch_size]
            batch_texts = [seg["text"] for seg in batch]

            translations = await self._translate_batch(batch_texts, source_lang, target_lang)

            for seg, trans_text in zip(batch, translations):
                translated.append({
                    "original_text": seg["text"],
                    "translated_text": trans_text,
                    "start": seg["start"],
                    "end": seg["end"],
                    "speaker": seg.get("speaker"),
                })

        return translated

    async def _translate_batch(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
    ) -> list[str]:
        """Translate a batch of texts using LLM."""
        numbered_texts = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

        prompt = f"""You are a professional video dubbing translator. Translate the following {source_lang} text segments to {target_lang}.

RULES:
- Maintain the same tone, emotion, and register as the original
- Keep translations concise - dubbing requires similar duration to the original speech
- If the original is casual, translate casually. If formal, translate formally.
- Preserve any proper nouns, brand names, or technical terms
- Return ONLY a JSON array of translated strings, one per input segment
- Do NOT add explanations or notes

Input segments:
{numbered_texts}

Return a JSON array with exactly {len(texts)} translated strings:"""

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 2048,
                    },
                },
            )
            resp.raise_for_status()
            result = resp.json()["response"].strip()

            # Parse JSON array from response
            try:
                # Handle potential markdown code fences
                if result.startswith("```"):
                    result = result.split("```")[1]
                    if result.startswith("json"):
                        result = result[4:]
                translations = json.loads(result)
                if len(translations) != len(texts):
                    logger.warning(
                        "translation_count_mismatch",
                        expected=len(texts),
                        got=len(translations),
                    )
                    # Pad or truncate
                    while len(translations) < len(texts):
                        translations.append(texts[len(translations)])
                    translations = translations[:len(texts)]
                return translations
            except json.JSONDecodeError:
                logger.error("translation_json_parse_error", response=result[:500])
                # Fallback: return originals
                return texts
```

### Step 5: Timing Alignment Service

Create `backend/app/services/dubbing/aligner.py`:
```python
import subprocess
import tempfile
from pathlib import Path

import structlog

logger = structlog.get_logger()


class TimingAligner:
    """Align translated TTS audio to match original segment timing."""

    def align_segments(
        self,
        translated_segments: list[dict],
        tts_audio_paths: list[str],
    ) -> list[dict]:
        """Adjust TTS audio speed to fit within original segment time boundaries.

        Args:
            translated_segments: Segments with start/end times
            tts_audio_paths: Corresponding TTS audio file paths

        Returns:
            Updated segments with adjusted audio paths and speed factors
        """
        aligned = []

        for seg, audio_path in zip(translated_segments, tts_audio_paths):
            original_duration = seg["end"] - seg["start"]
            tts_duration = self._get_audio_duration(audio_path)

            if tts_duration <= 0:
                logger.warning("zero_duration_tts", segment=seg["translated_text"][:50])
                aligned.append({**seg, "aligned_audio_path": audio_path, "speed_factor": 1.0})
                continue

            speed_factor = tts_duration / original_duration

            # Clamp speed factor to reasonable range (0.75x - 1.5x)
            # Outside this range, audio quality degrades significantly
            clamped_speed = max(0.75, min(1.5, speed_factor))

            if abs(speed_factor - 1.0) < 0.05:
                # Close enough, no adjustment needed
                aligned.append({**seg, "aligned_audio_path": audio_path, "speed_factor": 1.0})
            else:
                # Time-stretch the audio using FFmpeg rubberband filter
                adjusted_path = self._adjust_speed(audio_path, clamped_speed)
                aligned.append({**seg, "aligned_audio_path": adjusted_path, "speed_factor": clamped_speed})

        return aligned

    def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration using ffprobe."""
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_format", audio_path,
            ],
            capture_output=True, text=True, timeout=10,
        )
        import json
        info = json.loads(result.stdout)
        return float(info["format"]["duration"])

    def _adjust_speed(self, audio_path: str, speed_factor: float) -> str:
        """Time-stretch audio using FFmpeg atempo filter (preserves pitch)."""
        output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name

        # atempo filter accepts values between 0.5 and 100.0
        # For factors outside 0.5-2.0, chain multiple atempo filters
        atempo_filters = []
        remaining = speed_factor

        while remaining > 2.0:
            atempo_filters.append("atempo=2.0")
            remaining /= 2.0
        while remaining < 0.5:
            atempo_filters.append("atempo=0.5")
            remaining /= 0.5
        atempo_filters.append(f"atempo={remaining:.4f}")

        filter_chain = ",".join(atempo_filters)

        subprocess.run(
            [
                "ffmpeg", "-y", "-i", audio_path,
                "-filter:a", filter_chain,
                "-acodec", "pcm_s16le", output_path,
            ],
            capture_output=True, timeout=30,
            check=True,
        )

        return output_path
```

### Step 6: Vocal Separation Service

Create `backend/app/services/dubbing/vocal_separator.py`:
```python
import subprocess
import tempfile
from pathlib import Path

import structlog

logger = structlog.get_logger()


class VocalSeparator:
    """Separate vocals from background audio using Demucs (Meta, MIT license).

    This allows replacing spoken vocals while preserving background music and SFX.
    """

    def __init__(self, model: str = "htdemucs"):
        self.model = model

    def separate(self, audio_path: str, output_dir: str | None = None) -> dict[str, str]:
        """Separate audio into vocals and non-vocal stems.

        Args:
            audio_path: Path to input audio file
            output_dir: Directory for output files (default: temp dir)

        Returns:
            Dict with 'vocals' and 'background' file paths
        """
        if output_dir is None:
            output_dir = tempfile.mkdtemp(prefix="demucs_")

        # Run Demucs separation
        subprocess.run(
            [
                "python3", "-m", "demucs",
                "--two-stems", "vocals",
                "-n", self.model,
                "-o", output_dir,
                audio_path,
            ],
            capture_output=True, timeout=600,
            check=True,
        )

        # Demucs outputs to: output_dir/{model}/{filename_without_ext}/vocals.wav and no_vocals.wav
        stem_name = Path(audio_path).stem
        stems_dir = Path(output_dir) / self.model / stem_name

        return {
            "vocals": str(stems_dir / "vocals.wav"),
            "background": str(stems_dir / "no_vocals.wav"),
        }
```

### Step 7: Audio Mixer

Create `backend/app/services/dubbing/mixer.py`:
```python
import subprocess
import tempfile

import structlog

logger = structlog.get_logger()


class AudioMixer:
    """Mix dubbed audio segments with background audio and mux with video."""

    def mix_dubbed_audio(
        self,
        aligned_segments: list[dict],
        background_audio_path: str,
        total_duration: float,
        sample_rate: int = 44100,
    ) -> str:
        """Create a complete dubbed audio track.

        Args:
            aligned_segments: Segments with aligned_audio_path, start, end
            background_audio_path: Background music/SFX track (vocals removed)
            total_duration: Total duration of original video in seconds
            sample_rate: Output sample rate

        Returns:
            Path to final mixed audio file
        """
        output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name

        # Build FFmpeg complex filter to place each dubbed segment at its timestamp
        inputs = ["-i", background_audio_path]
        filter_parts = []
        input_idx = 1  # 0 is background

        for seg in aligned_segments:
            if seg.get("aligned_audio_path"):
                inputs.extend(["-i", seg["aligned_audio_path"]])
                # Delay segment to its start time and pad to total duration
                delay_ms = int(seg["start"] * 1000)
                filter_parts.append(
                    f"[{input_idx}]adelay={delay_ms}|{delay_ms},apad=whole_dur={total_duration}[dub{input_idx}]"
                )
                input_idx += 1

        if not filter_parts:
            # No dubbed segments, just return background
            return background_audio_path

        # Mix all dubbed segments together
        dub_inputs = "".join(f"[dub{i}]" for i in range(1, input_idx))
        filter_parts.append(f"{dub_inputs}amix=inputs={input_idx - 1}:normalize=0[dubbed]")

        # Mix dubbed audio with background (background at lower volume during speech)
        filter_parts.append("[0]volume=0.3[bg]")
        filter_parts.append("[bg][dubbed]amix=inputs=2:duration=longest[final]")

        filter_complex = ";".join(filter_parts)

        cmd = [
            "ffmpeg", "-y",
            *inputs,
            "-filter_complex", filter_complex,
            "-map", "[final]",
            "-acodec", "pcm_s16le",
            "-ar", str(sample_rate),
            output_path,
        ]

        subprocess.run(cmd, capture_output=True, timeout=300, check=True)
        return output_path

    def mux_video_audio(
        self,
        video_path: str,
        audio_path: str,
        output_path: str | None = None,
    ) -> str:
        """Replace video's audio track with dubbed audio.

        Args:
            video_path: Original video file
            audio_path: Dubbed audio track
            output_path: Output video path (default: temp file)

        Returns:
            Path to final video with dubbed audio
        """
        if output_path is None:
            output_path = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", video_path,
                "-i", audio_path,
                "-c:v", "copy",
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-shortest",
                output_path,
            ],
            capture_output=True, timeout=300,
            check=True,
        )

        return output_path
```

### Step 8: Celery Dubbing Task (Orchestrator)

Create `backend/app/tasks/dubbing_tasks.py`:
```python
import tempfile
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
from app.models.dubbing import DubbingJob
from app.services.dubbing.aligner import TimingAligner
from app.services.dubbing.mixer import AudioMixer
from app.services.dubbing.vocal_separator import VocalSeparator

logger = structlog.get_logger()


@celery_app.task(
    bind=True,
    name="dubbing.process",
    max_retries=1,
    queue="gpu",
    time_limit=1800,
    soft_time_limit=1500,
)
def process_dubbing_task(
    self,
    job_id: str,
    video_url: str,
    source_language: str,
    target_language: str,
    voice_profile_id: str | None = None,
):
    """Full dubbing pipeline orchestrator."""
    with get_sync_session() as db:
        job = db.execute(
            select(DubbingJob).where(DubbingJob.id == uuid.UUID(job_id))
        ).scalar_one()

        try:
            _update_job(db, job, status="processing", step="extracting_audio", progress=5)

            # Step 1: Download video and extract audio
            work_dir = tempfile.mkdtemp(prefix="dubbing_")
            video_path = _download_file(video_url, f"{work_dir}/source.mp4")
            audio_path = _extract_audio(video_path, f"{work_dir}/audio.wav")

            _update_job(db, job, step="transcribing", progress=15)

            # Step 2: Transcribe with WhisperX
            transcript = _transcribe(audio_path, source_language)
            job.original_transcript = transcript
            db.commit()

            _update_job(db, job, step="translating", progress=30)

            # Step 3: Translate segments with LLM
            translated = _translate_segments(transcript["segments"], source_language, target_language)
            job.translated_transcript = {"segments": translated}
            db.commit()

            _update_job(db, job, step="separating_vocals", progress=45)

            # Step 4: Separate vocals from background
            separator = VocalSeparator()
            stems = separator.separate(audio_path, f"{work_dir}/stems")

            _update_job(db, job, step="synthesizing_speech", progress=55)

            # Step 5: Synthesize TTS for each segment
            tts_paths = []
            for i, seg in enumerate(translated):
                tts_audio_path = _synthesize_segment(
                    text=seg["translated_text"],
                    target_lang=target_language,
                    voice_profile_id=voice_profile_id,
                    output_path=f"{work_dir}/tts_{i:04d}.wav",
                )
                tts_paths.append(tts_audio_path)
                progress = 55 + int((i / len(translated)) * 20)
                _update_job(db, job, progress=progress)

            _update_job(db, job, step="aligning_timing", progress=75)

            # Step 6: Align timing
            aligner = TimingAligner()
            aligned = aligner.align_segments(translated, tts_paths)

            _update_job(db, job, step="mixing_audio", progress=85)

            # Step 7: Mix audio
            mixer = AudioMixer()
            total_duration = transcript["segments"][-1]["end"] if transcript["segments"] else 0
            mixed_audio = mixer.mix_dubbed_audio(aligned, stems["background"], total_duration)

            _update_job(db, job, step="muxing_video", progress=90)

            # Step 8: Mux with original video
            output_video = mixer.mux_video_audio(video_path, mixed_audio, f"{work_dir}/dubbed.mp4")

            _update_job(db, job, step="uploading", progress=95)

            # Step 9: Upload results to GCS
            output_video_url = upload_to_gcs_sync(
                bucket_name=settings.GCS_BUCKET_PROCESSED,
                blob_path=f"dubbed/{job.user_id}/{job_id}/dubbed_{target_language}.mp4",
                data=Path(output_video).read_bytes(),
                content_type="video/mp4",
            )
            output_audio_url = upload_to_gcs_sync(
                bucket_name=settings.GCS_BUCKET_PROCESSED,
                blob_path=f"dubbed/{job.user_id}/{job_id}/dubbed_{target_language}.wav",
                data=Path(mixed_audio).read_bytes(),
                content_type="audio/wav",
            )

            job.output_video_url = output_video_url
            job.output_audio_url = output_audio_url
            job.timing_map = {"segments": [{"start": s["start"], "end": s["end"], "speed_factor": s["speed_factor"]} for s in aligned]}
            _update_job(db, job, status="completed", step="done", progress=100)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()

            logger.info("dubbing_completed", job_id=job_id, target_lang=target_language)

        except Exception as exc:
            _update_job(db, job, status="failed", step="error")
            job.error_message = str(exc)[:2000]
            db.commit()
            logger.error("dubbing_failed", job_id=job_id, error=str(exc))
            raise self.retry(exc=exc)


def _update_job(db, job, status=None, step=None, progress=None):
    if status:
        job.status = status
    if step:
        job.current_step = step
    if progress is not None:
        job.progress_pct = progress
    db.commit()


def _download_file(url: str, output_path: str) -> str:
    from google.cloud import storage
    if url.startswith("gs://"):
        client = storage.Client()
        parts = url.replace("gs://", "").split("/", 1)
        blob = client.bucket(parts[0]).blob(parts[1])
        blob.download_to_filename(output_path)
    else:
        resp = httpx.get(url, timeout=120)
        resp.raise_for_status()
        Path(output_path).write_bytes(resp.content)
    return output_path


def _extract_audio(video_path: str, output_path: str) -> str:
    import subprocess
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "44100", output_path],
        capture_output=True, check=True, timeout=120,
    )
    return output_path


def _transcribe(audio_path: str, language: str) -> dict:
    """Call WhisperX service for transcription."""
    from app.core.storage import upload_to_gcs_sync
    # Upload audio temporarily for WhisperX to access
    audio_url = upload_to_gcs_sync(
        bucket_name=settings.GCS_BUCKET_PROCESSED,
        blob_path=f"temp/dubbing/{Path(audio_path).name}",
        data=Path(audio_path).read_bytes(),
        content_type="audio/wav",
    )
    resp = httpx.post(
        f"{settings.WHISPER_URL}/transcribe",
        json={"audio_url": audio_url, "language": language, "diarize": True},
        timeout=600,
    )
    resp.raise_for_status()
    return resp.json()


def _translate_segments(segments: list[dict], source_lang: str, target_lang: str) -> list[dict]:
    """Call LLM for translation (synchronous wrapper)."""
    import asyncio
    from app.services.dubbing.translator import TranslationService
    translator = TranslationService()
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(translator.translate_segments(segments, source_lang, target_lang))
    finally:
        loop.close()


def _synthesize_segment(text: str, target_lang: str, voice_profile_id: str | None, output_path: str) -> str:
    """Synthesize a single segment via TTS service."""
    if voice_profile_id:
        # Use Chatterbox for voice cloning
        from sqlalchemy import select
        from app.core.database import get_sync_session
        from app.models.voice_profile import VoiceProfile
        with get_sync_session() as db:
            profile = db.execute(
                select(VoiceProfile).where(VoiceProfile.id == uuid.UUID(voice_profile_id))
            ).scalar_one()
            resp = httpx.post(
                f"{settings.CHATTERBOX_URL}/clone",
                json={"text": text, "reference_audio_url": profile.reference_audio_url},
                timeout=120,
            )
    else:
        # Use Kokoro for standard TTS
        resp = httpx.post(
            f"{settings.TTS_URL}/synthesize",
            json={"text": text, "language": target_lang},
            timeout=120,
        )

    resp.raise_for_status()
    Path(output_path).write_bytes(resp.content)
    return output_path
```

### Step 9: API Routes

Create `backend/app/api/v1/dubbing.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.dubbing import DubbingJob
from app.models.user import User
from app.services.dubbing.languages import list_languages, get_language

router = APIRouter(prefix="/dub", tags=["Dubbing & Translation"])


class DubRequest(BaseModel):
    source_video_id: uuid.UUID
    source_language: str = Field(..., min_length=2, max_length=10)
    target_language: str = Field(..., min_length=2, max_length=10)
    voice_profile_id: uuid.UUID | None = None


class DubJobResponse(BaseModel):
    id: uuid.UUID
    source_language: str
    target_language: str
    status: str
    current_step: str | None
    progress_pct: int
    output_video_url: str | None
    output_audio_url: str | None
    error_message: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("", response_model=DubJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_dubbing(
    req: DubRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start a dubbing job for a video."""
    if not get_language(req.source_language):
        raise HTTPException(status_code=400, detail=f"Unsupported source language: {req.source_language}")
    if not get_language(req.target_language):
        raise HTTPException(status_code=400, detail=f"Unsupported target language: {req.target_language}")
    if req.source_language == req.target_language:
        raise HTTPException(status_code=400, detail="Source and target languages must be different")

    # Look up video to get its URL
    from app.models.video import Video
    video = (await db.execute(select(Video).where(Video.id == req.source_video_id, Video.user_id == user.id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    job = DubbingJob(
        user_id=user.id,
        source_video_id=req.source_video_id,
        source_language=req.source_language,
        target_language=req.target_language,
        voice_profile_id=req.voice_profile_id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Dispatch Celery task
    from app.tasks.dubbing_tasks import process_dubbing_task
    task = process_dubbing_task.delay(
        job_id=str(job.id),
        video_url=video.source_url,
        source_language=req.source_language,
        target_language=req.target_language,
        voice_profile_id=str(req.voice_profile_id) if req.voice_profile_id else None,
    )
    job.celery_task_id = task.id
    await db.commit()

    return job


@router.get("/{job_id}", response_model=DubJobResponse)
async def get_dubbing_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get dubbing job status and results."""
    result = await db.execute(
        select(DubbingJob).where(DubbingJob.id == job_id, DubbingJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Dubbing job not found")
    return job


@router.get("/{job_id}/preview")
async def preview_translation(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Preview the translated transcript before final synthesis."""
    result = await db.execute(
        select(DubbingJob).where(DubbingJob.id == job_id, DubbingJob.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Dubbing job not found")

    return {
        "original_transcript": job.original_transcript,
        "translated_transcript": job.translated_transcript,
        "source_language": job.source_language,
        "target_language": job.target_language,
    }


@router.get("/languages", response_model=list[dict])
async def get_supported_languages():
    """List all supported dubbing languages."""
    return list_languages()
```

Register in `backend/app/api/v1/router.py`:
```python
from app.api.v1.dubbing import router as dubbing_router

api_v1_router.include_router(dubbing_router)
```

## Best Practices
- **Segment-level translation:** Translate segment by segment rather than the entire transcript at once. This preserves timing context and allows per-segment quality control.
- **Timing tolerance:** Allow +/- 10% deviation from original timing. Forcing exact timing causes unnatural speech speed.
- **Vocal separation quality:** Demucs htdemucs model provides the best separation quality. The lighter `htdemucs_ft` model is faster but slightly lower quality.
- **LLM temperature for translation:** Use low temperature (0.3) for translation to ensure consistency. Higher temperatures introduce unwanted creative liberties.
- **Batch translation:** Batch 5 segments per LLM call to reduce round-trip overhead while keeping context window manageable.
- **Fallback TTS:** If Chatterbox is unavailable for voice-cloned dubbing, fall back to Kokoro with the closest matching default voice.
- **Progress tracking:** Update job progress percentage at each pipeline step so the frontend can show a meaningful progress bar.

## Testing
- Dub a 30-second English video to Spanish and verify audio quality
- Test translation accuracy for 5 different language pairs
- Verify timing alignment: dubbed segments should not overlap
- Test vocal separation: background music should be preserved
- Test with multi-speaker video (diarization should assign correct voice per speaker)
- Test edge cases: very short segments (<1 second), very long segments (>30 seconds)
- Verify Celery task retry on transient failures
- Load test: 3 concurrent dubbing jobs

## Verification Checklist
- [ ] Dubbing job table created with migration
- [ ] WhisperX transcription returns accurate segments with timestamps
- [ ] Qwen3 translation produces natural translations for top 5 languages
- [ ] Timing alignment adjusts TTS speed within 0.75x-1.5x range
- [ ] Vocal separation cleanly isolates speech from background
- [ ] TTS synthesis generates audio for each translated segment
- [ ] Audio mixer correctly places segments at original timestamps
- [ ] Final video has dubbed audio with preserved background
- [ ] Job status and progress update correctly throughout pipeline
- [ ] Frontend can poll job status and display progress
- [ ] Language list endpoint returns all 25+ supported languages
- [ ] Voice profile integration works for cloned-voice dubbing
- [ ] Error handling gracefully handles LLM/TTS/Whisper failures
- [ ] Temporary files are cleaned up after job completion
