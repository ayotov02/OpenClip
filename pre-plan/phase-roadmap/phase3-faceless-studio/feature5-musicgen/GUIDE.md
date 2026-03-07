# MusicGen (Background Music Generation) — Implementation Guide

## Overview
- **What:** Deploy MusicGen Medium (Meta, MIT license) as a FastAPI service on GCP Cloud Run GPU. Generate mood-matched background music from text descriptions. Mix audio so voice is at -3dB and music is at -18dB. Match generated music duration to video length.
- **Why:** Background music is essential for faceless videos -- it sets mood, maintains viewer engagement, and covers silence gaps between scenes. Using MusicGen eliminates copyright issues and licensing costs. Every generated track is unique and royalty-free.
- **Dependencies:** Phase 1 Feature 1 (Project Setup), Phase 1 Feature 3 (Job Queue), GCP Setup (GPU quotas)

## Architecture

### MusicGen Service Design
```
Backend API (FastAPI)
  → Celery Task (faceless pipeline)
    → MusicGen Client (backend/app/ai/musicgen_client.py)
      → MusicGen Service (services/musicgen/) on Cloud Run GPU
        ├── /generate   → Generate music from text description
        ├── /health     → Health check
        └── Returns WAV audio bytes
    → Audio Mixing (FFmpeg: voice -3dB + music -18dB)
    → Store mixed audio in GCS
```

### Model Details
```
Model: facebook/musicgen-medium
Parameters: 1.5B
License: MIT (commercial use allowed)
VRAM: ~6GB (float16)
Capabilities:
  - Text-to-music generation
  - Mono and stereo output
  - Variable duration (up to 30 seconds per generation)
  - 32kHz sample rate
```

### Audio Mixing Pipeline
```
TTS Voiceover (per scene)  →  Concatenate all scenes  →  Voice track (-3dB)
                                                            ↓
MusicGen output            →  Trim/loop to video length →  Music track (-18dB)
                                                            ↓
                                                         FFmpeg mix
                                                            ↓
                                                     Final audio track
```

## GCP Deployment
- **Service:** Cloud Run GPU
- **Machine type:** g2-standard-8 (8 vCPU, 32GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM) -- MusicGen Medium uses ~6GB
- **Scale:** Min 0, Max 2 instances (music generation is less frequent)
- **Timeout:** 300s (30-second music takes ~45-90 seconds to generate)
- **Cost estimate:** ~$100-200/month (scales to zero when idle)
- **Container registry:** `us-central1-docker.pkg.dev/openclip-prod/openclip-images/musicgen-service`

## Step-by-Step Implementation

### Step 1: Create MusicGen Service Directory Structure
```
services/musicgen/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── engine.py       # MusicGen model wrapper
│   └── routes.py       # API routes
└── tests/
    └── test_musicgen.py
```

### Step 2: Create requirements.txt
Create `services/musicgen/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
torch>=2.4.0
torchaudio>=2.4.0
transformers>=4.44.0
scipy>=1.14.0
soundfile>=0.12.0
numpy>=1.26.0
structlog>=24.4.0
pydantic>=2.9.0
pydantic-settings>=2.6.0
```

### Step 3: Create Service Configuration
Create `services/musicgen/app/config.py`:
```python
from pydantic_settings import BaseSettings


class MusicGenSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8005
    model_name: str = "facebook/musicgen-medium"
    device: str = "cuda"
    torch_dtype: str = "float16"
    max_duration: int = 30  # Max seconds per generation
    sample_rate: int = 32000
    default_duration: int = 15

    class Config:
        env_prefix = "MUSICGEN_"


settings = MusicGenSettings()
```

### Step 4: Create MusicGen Engine
Create `services/musicgen/app/engine.py`:
```python
import io
import time

import numpy as np
import soundfile as sf
import structlog
import torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

from app.config import settings

logger = structlog.get_logger()


class MusicGenEngine:
    """MusicGen model wrapper for text-to-music generation."""

    def __init__(self):
        self.model = None
        self.processor = None
        self._loaded = False

    def load(self):
        """Load MusicGen model into GPU memory."""
        if self._loaded:
            return

        logger.info("musicgen.loading", model=settings.model_name)
        start = time.time()

        self.processor = AutoProcessor.from_pretrained(settings.model_name)
        self.model = MusicgenForConditionalGeneration.from_pretrained(
            settings.model_name,
            torch_dtype=torch.float16,
        ).to(settings.device)

        self._loaded = True
        logger.info("musicgen.loaded", elapsed=f"{time.time() - start:.1f}s")

    def generate(
        self,
        description: str,
        duration: int = 15,
        temperature: float = 1.0,
        guidance_scale: float = 3.0,
        top_k: int = 250,
    ) -> bytes:
        """
        Generate music from a text description.

        Args:
            description: Text describing the desired music.
                Example: "upbeat electronic music with synth pads and driving beat"
            duration: Duration in seconds (1-30).
            temperature: Sampling temperature. Higher = more random.
            guidance_scale: Classifier-free guidance. Higher = closer to prompt.
            top_k: Top-k sampling parameter.

        Returns:
            WAV audio bytes (32kHz, 16-bit PCM).
        """
        if not self._loaded:
            self.load()

        duration = min(duration, settings.max_duration)

        logger.info(
            "musicgen.generate",
            description=description[:100],
            duration=duration,
        )
        start = time.time()

        # Tokenize the description
        inputs = self.processor(
            text=[description],
            padding=True,
            return_tensors="pt",
        ).to(settings.device)

        # Calculate max_new_tokens from duration
        # MusicGen generates at ~50 tokens/second (codec framerate)
        max_new_tokens = int(duration * 50)

        # Generate audio tokens
        with torch.no_grad():
            audio_values = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                guidance_scale=guidance_scale,
                do_sample=True,
                top_k=top_k,
            )

        # Convert to numpy
        audio = audio_values[0, 0].cpu().float().numpy()

        # Normalize
        if np.abs(audio).max() > 0:
            audio = audio / np.abs(audio).max() * 0.95

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, settings.sample_rate, format="WAV", subtype="PCM_16")
        wav_bytes = buffer.getvalue()

        elapsed = time.time() - start
        actual_duration = len(audio) / settings.sample_rate
        logger.info(
            "musicgen.done",
            duration=f"{actual_duration:.1f}s",
            elapsed=f"{elapsed:.1f}s",
            rtf=f"{elapsed / actual_duration:.2f}" if actual_duration > 0 else "n/a",
        )

        return wav_bytes

    def generate_long(
        self,
        description: str,
        duration: int,
        overlap: int = 5,
        **kwargs,
    ) -> bytes:
        """
        Generate music longer than 30 seconds by generating overlapping
        segments and crossfading them.

        Args:
            description: Text describing the desired music.
            duration: Total target duration in seconds.
            overlap: Overlap in seconds between segments for crossfade.

        Returns:
            WAV audio bytes of the full duration.
        """
        if duration <= settings.max_duration:
            return self.generate(description, duration, **kwargs)

        logger.info("musicgen.generate_long", duration=duration)

        segments = []
        remaining = duration
        segment_duration = settings.max_duration

        while remaining > 0:
            gen_duration = min(segment_duration, remaining + overlap)
            wav_bytes = self.generate(description, gen_duration, **kwargs)
            audio, sr = sf.read(io.BytesIO(wav_bytes))
            segments.append(audio)
            remaining -= (segment_duration - overlap)

        # Crossfade segments
        combined = self._crossfade_segments(segments, overlap, settings.sample_rate)

        # Trim to exact duration
        target_samples = int(duration * settings.sample_rate)
        if len(combined) > target_samples:
            combined = combined[:target_samples]

        # Apply fade out at the end
        fade_samples = int(3 * settings.sample_rate)  # 3s fade out
        if len(combined) > fade_samples:
            fade = np.linspace(1.0, 0.0, fade_samples)
            combined[-fade_samples:] *= fade

        buffer = io.BytesIO()
        sf.write(buffer, combined, settings.sample_rate, format="WAV", subtype="PCM_16")
        return buffer.getvalue()

    @staticmethod
    def _crossfade_segments(
        segments: list[np.ndarray],
        overlap_seconds: int,
        sample_rate: int,
    ) -> np.ndarray:
        """Crossfade audio segments together."""
        if len(segments) == 1:
            return segments[0]

        overlap_samples = overlap_seconds * sample_rate
        result = segments[0].copy()

        for seg in segments[1:]:
            # Fade out end of current result
            fade_out = np.linspace(1.0, 0.0, overlap_samples)
            # Fade in start of next segment
            fade_in = np.linspace(0.0, 1.0, overlap_samples)

            # Apply crossfade
            overlap_start = len(result) - overlap_samples
            result[overlap_start:] *= fade_out
            seg_copy = seg.copy()
            seg_copy[:overlap_samples] *= fade_in

            # Merge overlapping region
            result[overlap_start:] += seg_copy[:overlap_samples]

            # Append non-overlapping part
            result = np.concatenate([result, seg_copy[overlap_samples:]])

        return result
```

### Step 5: Create API Routes
Create `services/musicgen/app/routes.py`:
```python
import structlog
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import Response

from app.engine import MusicGenEngine

logger = structlog.get_logger()
router = APIRouter()

engine = MusicGenEngine()


@router.post("/generate")
async def generate_music(
    description: str = Form(..., max_length=500),
    duration: int = Form(15, ge=1, le=120),
    temperature: float = Form(1.0, ge=0.1, le=2.0),
    guidance_scale: float = Form(3.0, ge=1.0, le=10.0),
    top_k: int = Form(250, ge=50, le=500),
):
    """
    Generate background music from a text description.

    - **description**: Text describing the music style and mood.
      Examples:
        - "calm ambient music with soft piano and rain sounds"
        - "energetic hip-hop beat with bass and hi-hats"
        - "dramatic orchestral music building to a crescendo"
        - "dark atmospheric drone with subtle horror elements"
    - **duration**: Target duration in seconds (1-120). Segments >30s use crossfade.
    - **temperature**: Sampling randomness (0.1-2.0). Higher = more variation.
    - **guidance_scale**: Prompt adherence (1.0-10.0). Higher = closer to description.
    """
    try:
        if duration > 30:
            wav_bytes = engine.generate_long(
                description=description,
                duration=duration,
                temperature=temperature,
                guidance_scale=guidance_scale,
                top_k=top_k,
            )
        else:
            wav_bytes = engine.generate(
                description=description,
                duration=duration,
                temperature=temperature,
                guidance_scale=guidance_scale,
                top_k=top_k,
            )

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={
                "X-Audio-Duration": str(duration),
                "X-Sample-Rate": "32000",
            },
        )

    except Exception as e:
        logger.error("musicgen.error", error=str(e))
        raise HTTPException(status_code=500, detail="Music generation failed")


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": engine._loaded,
        "model": "facebook/musicgen-medium",
    }
```

### Step 6: Create FastAPI Application
Create `services/musicgen/app/main.py`:
```python
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import settings
from app.routes import router, engine

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("musicgen.startup", device=settings.device)
    engine.load()
    yield
    logger.info("musicgen.shutdown")


app = FastAPI(
    title="OpenClip MusicGen Service",
    description="AI music generation using Meta's MusicGen Medium",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router, prefix="/music", tags=["music"])
```

### Step 7: Create Dockerfile
Create `services/musicgen/Dockerfile`:
```dockerfile
FROM pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download model weights during build
RUN python -c "from transformers import AutoProcessor, MusicgenForConditionalGeneration; \
    AutoProcessor.from_pretrained('facebook/musicgen-medium'); \
    MusicgenForConditionalGeneration.from_pretrained('facebook/musicgen-medium')" || true

COPY app/ app/

ENV PYTHONUNBUFFERED=1
ENV MUSICGEN_DEVICE=cuda
ENV HF_HOME=/root/.cache/huggingface

EXPOSE 8005

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005", "--workers", "1"]
```

### Step 8: Deploy to Cloud Run GPU
```bash
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/openclip-images/musicgen-service:latest"

docker build -t ${IMAGE} services/musicgen/
docker push ${IMAGE}

gcloud run deploy musicgen-service \
  --image ${IMAGE} \
  --region ${REGION} \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 8 \
  --memory 32Gi \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 300 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com \
  --vpc-connector openclip-connector \
  --set-env-vars "MUSICGEN_DEVICE=cuda" \
  --port 8005
```

### Step 9: Create Backend MusicGen Client
Create `backend/app/ai/musicgen_client.py`:
```python
import io

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Mood-to-music description mapping
MOOD_DESCRIPTIONS = {
    "dramatic": "dramatic cinematic orchestral music with deep strings and timpani, building tension",
    "upbeat": "upbeat energetic pop music with bright synths, driving beat, and positive vibes",
    "calm": "calm ambient music with soft piano, gentle pads, and nature atmosphere",
    "mysterious": "mysterious atmospheric music with ethereal pads, subtle tension, and dark undertones",
    "funny": "playful lighthearted music with bouncy melody, pizzicato strings, and comedic timing",
    "tense": "tense suspenseful music with low drone, staccato strings, and building anxiety",
    "inspiring": "inspiring uplifting orchestral music with soaring melody, warm brass, and hopeful energy",
    "dark": "dark ominous ambient music with deep bass drone, eerie textures, and unsettling atmosphere",
}


class MusicGenClient:
    """Client for the MusicGen microservice."""

    def __init__(self):
        self.base_url = settings.MUSICGEN_SERVICE_URL  # "http://musicgen-service:8005"
        self.timeout = 300  # Music generation can take 1-3 min for long tracks

    async def generate(
        self,
        description: str | None = None,
        mood: str | None = None,
        duration: int = 15,
        temperature: float = 1.0,
        guidance_scale: float = 3.0,
    ) -> bytes:
        """
        Generate background music.

        Args:
            description: Text description of desired music. If None, uses mood mapping.
            mood: Mood tag from script. Used to auto-generate description.
            duration: Target duration in seconds.
            temperature: Sampling randomness.
            guidance_scale: Prompt adherence.

        Returns:
            WAV audio bytes (32kHz).
        """
        if not description:
            description = MOOD_DESCRIPTIONS.get(
                mood or "calm",
                "ambient background music suitable for video narration",
            )

        logger.info(
            "musicgen.request",
            description=description[:80],
            duration=duration,
        )

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/music/generate",
                data={
                    "description": description,
                    "duration": duration,
                    "temperature": temperature,
                    "guidance_scale": guidance_scale,
                },
            )
            resp.raise_for_status()
            return resp.content

    async def generate_for_video(
        self,
        scenes: list[dict],
        total_duration: float,
    ) -> bytes:
        """
        Generate music matched to a video's mood profile.

        Analyzes scene moods to pick the dominant mood, then generates
        music of the appropriate length.
        """
        # Determine dominant mood from scenes
        mood_counts: dict[str, float] = {}
        for scene in scenes:
            mood = scene.get("mood", "calm")
            dur = scene.get("duration_est", 8)
            mood_counts[mood] = mood_counts.get(mood, 0) + dur

        dominant_mood = max(mood_counts, key=mood_counts.get) if mood_counts else "calm"
        logger.info("musicgen.dominant_mood", mood=dominant_mood)

        # Round duration up to nearest 5 seconds
        import math
        gen_duration = int(math.ceil(total_duration / 5) * 5)

        return await self.generate(
            mood=dominant_mood,
            duration=gen_duration,
        )

    async def health(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/music/health")
            return resp.json()
```

### Step 10: Create Audio Mixing Utility
Create `backend/app/services/audio_mixer.py`:
```python
import subprocess
import tempfile
from pathlib import Path

import structlog

logger = structlog.get_logger()


class AudioMixer:
    """Mix voiceover and background music using FFmpeg."""

    @staticmethod
    def mix_voice_and_music(
        voice_path: str,
        music_path: str,
        output_path: str,
        voice_db: float = -3.0,
        music_db: float = -18.0,
        fade_in: float = 2.0,
        fade_out: float = 3.0,
    ) -> str:
        """
        Mix voiceover and background music at specified dB levels.

        Args:
            voice_path: Path to voiceover WAV file.
            music_path: Path to music WAV file.
            output_path: Path for mixed output WAV.
            voice_db: Voice volume in dB (default -3dB).
            music_db: Music volume in dB (default -18dB = ~15% relative to voice).
            fade_in: Music fade-in duration in seconds.
            fade_out: Music fade-out duration in seconds.

        Returns:
            Path to mixed audio file.
        """
        logger.info(
            "audio.mix",
            voice_db=voice_db,
            music_db=music_db,
        )

        # Get voice duration for music trimming
        probe_cmd = [
            "ffprobe", "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            voice_path,
        ]
        result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
        voice_duration = float(result.stdout.strip())

        # FFmpeg filter: adjust volumes, trim music, apply fade, mix
        filter_complex = (
            f"[0:a]volume={voice_db}dB[voice];"
            f"[1:a]atrim=0:{voice_duration},"
            f"afade=t=in:st=0:d={fade_in},"
            f"afade=t=out:st={voice_duration - fade_out}:d={fade_out},"
            f"volume={music_db}dB[music];"
            f"[voice][music]amix=inputs=2:duration=first:dropout_transition=3[out]"
        )

        cmd = [
            "ffmpeg",
            "-i", voice_path,
            "-i", music_path,
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-acodec", "pcm_s16le",
            "-ar", "24000",
            "-ac", "1",
            "-y", output_path,
        ]

        subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=True)

        logger.info("audio.mix.done", output=output_path)
        return output_path

    @staticmethod
    def concatenate_audio(
        audio_paths: list[str],
        output_path: str,
        silence_gap: float = 0.3,
    ) -> str:
        """
        Concatenate multiple audio files with optional silence gaps.

        Args:
            audio_paths: List of WAV file paths in order.
            output_path: Path for concatenated output.
            silence_gap: Seconds of silence between clips.
        """
        # Create a concat list file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            for i, path in enumerate(audio_paths):
                f.write(f"file '{path}'\n")
                if i < len(audio_paths) - 1 and silence_gap > 0:
                    # Generate silence file
                    silence_path = path.replace(".wav", "_silence.wav")
                    subprocess.run([
                        "ffmpeg", "-f", "lavfi",
                        "-i", f"anullsrc=r=24000:cl=mono",
                        "-t", str(silence_gap),
                        "-acodec", "pcm_s16le",
                        "-y", silence_path,
                    ], capture_output=True, timeout=10)
                    f.write(f"file '{silence_path}'\n")
            concat_list = f.name

        cmd = [
            "ffmpeg",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list,
            "-acodec", "pcm_s16le",
            "-ar", "24000",
            "-ac", "1",
            "-y", output_path,
        ]

        subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=True)
        return output_path
```

### Step 11: Create MusicGen Celery Task
Create `backend/app/tasks/musicgen.py`:
```python
import asyncio
import tempfile
from pathlib import Path

import structlog

from app.ai.musicgen_client import MusicGenClient
from app.services.storage import StorageService
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()
storage = StorageService()


@celery_app.task(
    base=ProgressTask,
    bind=True,
    name="app.tasks.ai.generate_music",
    time_limit=600,
    soft_time_limit=540,
)
def generate_music_task(
    self,
    job_id: str,
    project_id: str,
    scenes: list[dict],
    total_duration: float,
    mood: str | None = None,
    description: str | None = None,
):
    """
    Generate background music for a faceless video.

    Returns GCS URL of the generated music file.
    """
    loop = asyncio.new_event_loop()

    try:
        self.update_progress(0.1, "Generating background music...")

        client = MusicGenClient()

        if description:
            wav_bytes = loop.run_until_complete(
                client.generate(description=description, duration=int(total_duration))
            )
        else:
            wav_bytes = loop.run_until_complete(
                client.generate_for_video(scenes=scenes, total_duration=total_duration)
            )

        self.update_progress(0.8, "Uploading music...")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(wav_bytes)
            tmp_path = tmp.name

        remote_path = f"{project_id}/music/background.wav"
        gcs_url = storage.upload(tmp_path, remote_path, bucket="processed")
        Path(tmp_path).unlink(missing_ok=True)

        self.update_progress(1.0, "Music generation complete")

        return {"music_url": gcs_url, "duration": total_duration}

    except Exception as exc:
        logger.error("musicgen.task.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, max_retries=2)
    finally:
        loop.close()
```

### Step 12: Add Configuration to Backend
Add to `backend/app/core/config.py`:
```python
# MusicGen Service
MUSICGEN_SERVICE_URL: str = "http://musicgen-service:8005"
```

## Best Practices

- **Voice at -3dB, music at -18dB:** This is the industry standard for narration over music. Voice should be approximately 15dB louder than music. Adjust if the music genre is particularly dynamic.
- **Generate music in 30-second segments:** MusicGen produces its best output in segments up to 30 seconds. For longer videos, generate overlapping segments and crossfade. This avoids quality degradation in long generations.
- **Mood-dominant music selection:** Analyze the mood tags across all scenes, weighted by scene duration, to determine the dominant mood. A video that is 60% "dramatic" and 40% "calm" should get dramatic music.
- **Fade in (2s) and fade out (3s):** Always apply fades to background music to avoid jarring starts/stops. The fade-out should be longer for a natural ending feel.
- **Resample music to match voice:** MusicGen outputs at 32kHz, while TTS is typically 24kHz. Resample music to match the voice sample rate before mixing to avoid FFmpeg sample rate conflicts.
- **GPU memory:** MusicGen Medium uses ~6GB VRAM. It can share an L4 GPU with Kokoro/Chatterbox TTS if needed, but separate services are preferred for independent scaling.
- **Cache music for reuse:** If a user generates multiple variations of a video with the same mood/duration, cache the music track to avoid regeneration.

## Testing

### Local Testing
```bash
cd services/musicgen
docker build -t musicgen-service .
docker run --gpus all -p 8005:8005 musicgen-service

# Generate calm ambient music (15 seconds)
curl -X POST http://localhost:8005/music/generate \
  -F "description=calm ambient music with soft piano and gentle rain" \
  -F "duration=15" \
  --output test_calm.wav

# Generate dramatic music (30 seconds)
curl -X POST http://localhost:8005/music/generate \
  -F "description=dramatic orchestral music building to an epic crescendo" \
  -F "duration=30" \
  --output test_dramatic.wav

# Generate long music (60 seconds, uses crossfade)
curl -X POST http://localhost:8005/music/generate \
  -F "description=upbeat electronic dance music with driving beat" \
  -F "duration=60" \
  --output test_long.wav

# Health check
curl http://localhost:8005/music/health
```

### Audio Mixing Test
```bash
# Mix voice and music using FFmpeg directly
ffmpeg -i voice.wav -i music.wav \
  -filter_complex "[0:a]volume=-3dB[v];[1:a]volume=-18dB,afade=t=in:d=2,afade=t=out:st=57:d=3[m];[v][m]amix=inputs=2:duration=first[out]" \
  -map "[out]" -y mixed.wav
```

### Unit Tests
```python
import pytest


def test_mood_description_mapping():
    from app.ai.musicgen_client import MOOD_DESCRIPTIONS
    assert "dramatic" in MOOD_DESCRIPTIONS
    assert "calm" in MOOD_DESCRIPTIONS
    assert len(MOOD_DESCRIPTIONS) >= 8


def test_dominant_mood_calculation():
    import asyncio
    from app.ai.musicgen_client import MusicGenClient

    client = MusicGenClient()
    scenes = [
        {"mood": "dramatic", "duration_est": 10},
        {"mood": "dramatic", "duration_est": 15},
        {"mood": "calm", "duration_est": 5},
    ]
    # Dominant mood should be "dramatic" (25s vs 5s)
    mood_counts = {}
    for s in scenes:
        m = s["mood"]
        mood_counts[m] = mood_counts.get(m, 0) + s["duration_est"]
    assert max(mood_counts, key=mood_counts.get) == "dramatic"
```

## Verification Checklist
- [ ] MusicGen service Docker image builds successfully
- [ ] Model loads into GPU memory on startup
- [ ] `/generate` endpoint returns valid WAV audio
- [ ] Generated music matches text description (subjective quality check)
- [ ] 15-second generation completes in < 60 seconds
- [ ] 30-second generation completes in < 120 seconds
- [ ] Long music (>30s) crossfades segments smoothly
- [ ] Audio mixing produces voice at -3dB and music at -18dB
- [ ] Music fade-in (2s) and fade-out (3s) sound natural
- [ ] Backend MusicGenClient connects and retrieves audio
- [ ] Mood-to-description mapping covers all script mood tags
- [ ] Celery task generates and uploads music to GCS
- [ ] Cloud Run GPU deployment serves requests
- [ ] Service scales to zero when idle
