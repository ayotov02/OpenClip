# TTS Integration (Kokoro + Chatterbox) — Implementation Guide

## Overview
- **What:** Deploy two open-source TTS models as a unified FastAPI service: Kokoro (82M params, Apache 2.0) for fast/lightweight synthesis and Chatterbox (350-550M, MIT) for high-quality synthesis with voice cloning. Expose `/synthesize` and `/clone` endpoints. Create a backend client at `backend/app/ai/tts_client.py`.
- **Why:** Faceless videos require natural-sounding narration. Kokoro handles bulk generation quickly (real-time factor <0.1x on GPU) while Chatterbox provides premium quality and voice cloning for custom creator voices. Both are fully open-source with permissive licenses.
- **Dependencies:** Phase 1 Feature 1 (Project Setup), Phase 1 Feature 3 (Job Queue), GCP Setup (GPU quotas)

## Architecture

### TTS Service Design
```
Backend API (FastAPI)
  → Celery Task (faceless pipeline)
    → TTS Client (backend/app/ai/tts_client.py)
      → TTS Service (services/tts/) on Cloud Run GPU
        ├── /synthesize  → Kokoro (fast) or Chatterbox (quality)
        ├── /clone       → Chatterbox voice cloning
        └── /voices      → List available voices
      → Returns WAV audio bytes
    → Store audio in GCS
```

### Model Comparison
```
┌─────────────┬──────────────┬──────────────────┬──────────┬────────────┐
│ Model       │ Params       │ License          │ Speed    │ Use Case   │
├─────────────┼──────────────┼──────────────────┼──────────┼────────────┤
│ Kokoro      │ 82M          │ Apache 2.0       │ ~0.05x   │ Bulk, fast │
│ Chatterbox  │ 350-550M     │ MIT              │ ~0.3x    │ Quality,   │
│             │              │                  │          │ cloning    │
└─────────────┴──────────────┴──────────────────┴──────────┴────────────┘
Real-time factor: time to generate / audio duration (lower = faster)
```

### Data Flow
```
1. Script scene → narration text + voice config
2. TTS Client sends POST to /synthesize or /clone
3. TTS Service loads model (cached in GPU memory)
4. Model generates audio waveform
5. Service returns WAV bytes (24kHz, 16-bit PCM)
6. Client saves to GCS: gs://processed/{project_id}/tts/scene_{n}.wav
7. Audio files passed to Remotion assembly pipeline
```

## GCP Deployment
- **Service:** Cloud Run GPU (with always-allocated GPU for model warmth)
- **Machine type:** g2-standard-8 (8 vCPU, 32GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM) -- both models fit comfortably
- **Memory usage:** Kokoro ~500MB VRAM, Chatterbox ~2-4GB VRAM
- **Scale:** Min 1, Max 3 instances (min 1 to avoid cold starts)
- **Cost estimate:** ~$250-400/month (1 always-on L4 instance)
- **Container registry:** `us-central1-docker.pkg.dev/openclip-prod/openclip-images/tts-service`

## Step-by-Step Implementation

### Step 1: Create TTS Service Directory Structure
```
services/tts/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Service configuration
│   ├── models/
│   │   ├── __init__.py
│   │   ├── kokoro_engine.py  # Kokoro model wrapper
│   │   └── chatterbox_engine.py  # Chatterbox model wrapper
│   └── routes/
│       ├── __init__.py
│       └── tts.py            # API routes
└── tests/
    └── test_tts.py
```

### Step 2: Create requirements.txt
Create `services/tts/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
torch>=2.4.0
torchaudio>=2.4.0
kokoro>=0.8.0
chatterbox-tts>=0.1.0
numpy>=1.26.0
scipy>=1.14.0
soundfile>=0.12.0
structlog>=24.4.0
pydantic>=2.9.0
pydantic-settings>=2.6.0
python-multipart>=0.0.12
httpx>=0.27.0
```

### Step 3: Create Service Configuration
Create `services/tts/app/config.py`:
```python
from pydantic_settings import BaseSettings


class TTSSettings(BaseSettings):
    """TTS service configuration."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8003
    workers: int = 1  # Single worker for GPU

    # Model paths (downloaded on first run, cached)
    kokoro_model: str = "hexgrad/Kokoro-82M"
    chatterbox_model: str = "resemble-ai/chatterbox"

    # Default voice settings
    default_engine: str = "kokoro"  # "kokoro" or "chatterbox"
    default_voice: str = "af_heart"  # Kokoro default voice
    sample_rate: int = 24000
    max_text_length: int = 5000  # Characters

    # GPU
    device: str = "cuda"
    torch_dtype: str = "float16"

    # Voice clone storage
    voice_clone_dir: str = "/data/voice_clones"

    class Config:
        env_prefix = "TTS_"


settings = TTSSettings()
```

### Step 4: Create Kokoro Engine
Create `services/tts/app/models/kokoro_engine.py`:
```python
import io
import time

import numpy as np
import soundfile as sf
import structlog
import torch
from kokoro import KPipeline

from app.config import settings

logger = structlog.get_logger()


class KokoroEngine:
    """Kokoro TTS engine - fast, lightweight synthesis."""

    def __init__(self):
        self.pipeline = None
        self.device = settings.device
        self._loaded = False

    def load(self):
        """Load Kokoro model into GPU memory."""
        if self._loaded:
            return
        logger.info("kokoro.loading", model=settings.kokoro_model)
        start = time.time()

        self.pipeline = KPipeline(
            lang_code="a",  # "a" for American English
        )

        self._loaded = True
        logger.info("kokoro.loaded", elapsed=f"{time.time() - start:.1f}s")

    def synthesize(
        self,
        text: str,
        voice: str = "af_heart",
        speed: float = 1.0,
    ) -> bytes:
        """
        Synthesize text to speech.

        Args:
            text: Input text to synthesize.
            voice: Kokoro voice ID (e.g., "af_heart", "am_adam", "bf_emma").
            speed: Speech speed multiplier (0.5-2.0).

        Returns:
            WAV audio bytes (24kHz, 16-bit PCM).
        """
        if not self._loaded:
            self.load()

        logger.info("kokoro.synthesize", text_len=len(text), voice=voice)
        start = time.time()

        # Generate audio using Kokoro pipeline
        # Kokoro generates in chunks for long text
        audio_segments = []
        generator = self.pipeline(text, voice=voice, speed=speed)
        for _, _, audio_chunk in generator:
            audio_segments.append(audio_chunk)

        if not audio_segments:
            raise ValueError("Kokoro produced no audio output")

        # Concatenate all segments
        audio = np.concatenate(audio_segments)

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, settings.sample_rate, format="WAV", subtype="PCM_16")
        wav_bytes = buffer.getvalue()

        elapsed = time.time() - start
        duration = len(audio) / settings.sample_rate
        rtf = elapsed / duration if duration > 0 else 0
        logger.info(
            "kokoro.done",
            duration=f"{duration:.1f}s",
            elapsed=f"{elapsed:.2f}s",
            rtf=f"{rtf:.3f}",
        )

        return wav_bytes

    def list_voices(self) -> list[dict]:
        """Return available Kokoro voices."""
        return [
            {"id": "af_heart", "name": "Heart", "gender": "female", "accent": "american"},
            {"id": "af_bella", "name": "Bella", "gender": "female", "accent": "american"},
            {"id": "af_nicole", "name": "Nicole", "gender": "female", "accent": "american"},
            {"id": "af_sarah", "name": "Sarah", "gender": "female", "accent": "american"},
            {"id": "af_sky", "name": "Sky", "gender": "female", "accent": "american"},
            {"id": "am_adam", "name": "Adam", "gender": "male", "accent": "american"},
            {"id": "am_michael", "name": "Michael", "gender": "male", "accent": "american"},
            {"id": "bf_emma", "name": "Emma", "gender": "female", "accent": "british"},
            {"id": "bf_isabella", "name": "Isabella", "gender": "female", "accent": "british"},
            {"id": "bm_george", "name": "George", "gender": "male", "accent": "british"},
            {"id": "bm_lewis", "name": "Lewis", "gender": "male", "accent": "british"},
        ]
```

### Step 5: Create Chatterbox Engine
Create `services/tts/app/models/chatterbox_engine.py`:
```python
import io
import os
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import structlog
import torch
import torchaudio
from chatterbox.tts import ChatterboxTTS

from app.config import settings

logger = structlog.get_logger()


class ChatterboxEngine:
    """Chatterbox TTS engine - high quality with voice cloning."""

    def __init__(self):
        self.model = None
        self.device = settings.device
        self._loaded = False

    def load(self):
        """Load Chatterbox model into GPU memory."""
        if self._loaded:
            return
        logger.info("chatterbox.loading")
        start = time.time()

        self.model = ChatterboxTTS.from_pretrained(device=self.device)

        self._loaded = True
        logger.info("chatterbox.loaded", elapsed=f"{time.time() - start:.1f}s")

    def synthesize(
        self,
        text: str,
        audio_prompt_path: str | None = None,
        exaggeration: float = 0.5,
        cfg_weight: float = 0.5,
    ) -> bytes:
        """
        Synthesize text to speech with optional voice cloning.

        Args:
            text: Input text to synthesize.
            audio_prompt_path: Path to reference audio for voice cloning (6-30s WAV).
            exaggeration: Emotion exaggeration (0.0-1.0). Higher = more expressive.
            cfg_weight: Classifier-free guidance weight. Higher = closer to prompt voice.

        Returns:
            WAV audio bytes (24kHz, 16-bit PCM).
        """
        if not self._loaded:
            self.load()

        logger.info(
            "chatterbox.synthesize",
            text_len=len(text),
            has_prompt=audio_prompt_path is not None,
        )
        start = time.time()

        wav_tensor = self.model.generate(
            text,
            audio_prompt_path=audio_prompt_path,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
        )

        # Convert tensor to numpy
        if isinstance(wav_tensor, torch.Tensor):
            audio = wav_tensor.squeeze().cpu().numpy()
        else:
            audio = np.array(wav_tensor)

        # Normalize to prevent clipping
        if np.abs(audio).max() > 1.0:
            audio = audio / np.abs(audio).max()

        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, settings.sample_rate, format="WAV", subtype="PCM_16")
        wav_bytes = buffer.getvalue()

        elapsed = time.time() - start
        duration = len(audio) / settings.sample_rate
        logger.info(
            "chatterbox.done",
            duration=f"{duration:.1f}s",
            elapsed=f"{elapsed:.2f}s",
            rtf=f"{elapsed / duration:.3f}" if duration > 0 else "n/a",
        )

        return wav_bytes

    def clone_voice(
        self,
        reference_audio_path: str,
        voice_name: str,
    ) -> dict:
        """
        Save a voice clone reference for reuse.

        Args:
            reference_audio_path: Path to reference audio file (6-30 seconds).
            voice_name: Unique name for this voice clone.

        Returns:
            Voice clone metadata.
        """
        clone_dir = Path(settings.voice_clone_dir)
        clone_dir.mkdir(parents=True, exist_ok=True)

        # Validate reference audio
        info = sf.info(reference_audio_path)
        if info.duration < 6:
            raise ValueError("Reference audio must be at least 6 seconds long")
        if info.duration > 30:
            raise ValueError("Reference audio must be 30 seconds or less")

        # Copy reference audio to clone directory
        dest_path = clone_dir / f"{voice_name}.wav"

        # Resample to 24kHz if needed
        waveform, sr = torchaudio.load(reference_audio_path)
        if sr != settings.sample_rate:
            resampler = torchaudio.transforms.Resample(sr, settings.sample_rate)
            waveform = resampler(waveform)
        torchaudio.save(str(dest_path), waveform, settings.sample_rate)

        return {
            "voice_name": voice_name,
            "reference_path": str(dest_path),
            "duration": info.duration,
            "sample_rate": settings.sample_rate,
        }

    def list_cloned_voices(self) -> list[dict]:
        """List all saved voice clones."""
        clone_dir = Path(settings.voice_clone_dir)
        if not clone_dir.exists():
            return []

        voices = []
        for wav_file in clone_dir.glob("*.wav"):
            info = sf.info(str(wav_file))
            voices.append({
                "voice_name": wav_file.stem,
                "reference_path": str(wav_file),
                "duration": info.duration,
            })
        return voices
```

### Step 6: Create API Routes
Create `services/tts/app/routes/tts.py`:
```python
import os
import tempfile
from typing import Optional

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.models.chatterbox_engine import ChatterboxEngine
from app.models.kokoro_engine import KokoroEngine

logger = structlog.get_logger()

router = APIRouter()

# Singletons - loaded once, cached in GPU memory
kokoro = KokoroEngine()
chatterbox = ChatterboxEngine()


@router.post("/synthesize")
async def synthesize(
    text: str = Form(..., max_length=5000),
    engine: str = Form("kokoro"),
    voice: str = Form("af_heart"),
    speed: float = Form(1.0, ge=0.5, le=2.0),
    exaggeration: float = Form(0.5, ge=0.0, le=1.0),
    cfg_weight: float = Form(0.5, ge=0.0, le=1.0),
):
    """
    Synthesize text to speech.

    - **text**: Text to synthesize (max 5000 chars).
    - **engine**: "kokoro" (fast) or "chatterbox" (quality).
    - **voice**: Voice ID. For kokoro: "af_heart", "am_adam", etc.
      For chatterbox with cloned voice, use the clone name.
    - **speed**: Speed multiplier (kokoro only). 0.5-2.0.
    - **exaggeration**: Emotion level (chatterbox only). 0.0-1.0.
    - **cfg_weight**: Voice similarity weight (chatterbox only). 0.0-1.0.
    """
    try:
        if engine == "kokoro":
            wav_bytes = kokoro.synthesize(text=text, voice=voice, speed=speed)
        elif engine == "chatterbox":
            # Check if voice is a clone name
            audio_prompt = None
            clone_path = f"/data/voice_clones/{voice}.wav"
            if os.path.exists(clone_path):
                audio_prompt = clone_path

            wav_bytes = chatterbox.synthesize(
                text=text,
                audio_prompt_path=audio_prompt,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown engine: {engine}")

        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={"X-Audio-Duration": str(len(wav_bytes) / (24000 * 2))},
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("tts.synthesize.error", error=str(e))
        raise HTTPException(status_code=500, detail="TTS synthesis failed")


@router.post("/clone")
async def clone_voice(
    voice_name: str = Form(..., min_length=1, max_length=50),
    reference_audio: UploadFile = File(...),
):
    """
    Create a voice clone from reference audio.

    - **voice_name**: Unique name for the voice clone.
    - **reference_audio**: WAV file, 6-30 seconds, clear speech.
    """
    if not reference_audio.content_type or "audio" not in reference_audio.content_type:
        raise HTTPException(status_code=400, detail="File must be an audio file")

    try:
        # Save uploaded file to temp
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            content = await reference_audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        result = chatterbox.clone_voice(
            reference_audio_path=tmp_path,
            voice_name=voice_name,
        )

        return {
            "status": "success",
            "voice": result,
            "message": f"Voice '{voice_name}' cloned. Use engine='chatterbox' and voice='{voice_name}' to synthesize.",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("tts.clone.error", error=str(e))
        raise HTTPException(status_code=500, detail="Voice cloning failed")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/voices")
async def list_voices():
    """List all available voices (built-in + cloned)."""
    builtin = kokoro.list_voices()
    cloned = chatterbox.list_cloned_voices()

    return {
        "builtin": builtin,
        "cloned": cloned,
        "engines": {
            "kokoro": {
                "description": "Fast, lightweight TTS (82M params)",
                "voices": [v["id"] for v in builtin],
                "supports_cloning": False,
            },
            "chatterbox": {
                "description": "High-quality TTS with voice cloning (350-550M params)",
                "voices": [v["voice_name"] for v in cloned],
                "supports_cloning": True,
            },
        },
    }


@router.get("/health")
async def health():
    """Health check for TTS service."""
    return {
        "status": "healthy",
        "kokoro_loaded": kokoro._loaded,
        "chatterbox_loaded": chatterbox._loaded,
    }
```

### Step 7: Create FastAPI Application
Create `services/tts/app/main.py`:
```python
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import settings
from app.routes.tts import router as tts_router, kokoro, chatterbox

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load models on startup."""
    logger.info("tts.startup", device=settings.device)

    # Load Kokoro eagerly (small, fast to load)
    kokoro.load()

    # Load Chatterbox lazily on first request (larger model)
    # Uncomment to load eagerly:
    # chatterbox.load()

    yield

    logger.info("tts.shutdown")


app = FastAPI(
    title="OpenClip TTS Service",
    description="Text-to-Speech service: Kokoro (fast) + Chatterbox (quality + cloning)",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(tts_router, prefix="/tts", tags=["tts"])
```

### Step 8: Create Dockerfile
Create `services/tts/Dockerfile`:
```dockerfile
FROM pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/

# Create directories for model cache and voice clones
RUN mkdir -p /data/voice_clones /root/.cache

# Pre-download model weights during build
RUN python -c "from kokoro import KPipeline; KPipeline(lang_code='a')" || true

ENV PYTHONUNBUFFERED=1
ENV TTS_DEVICE=cuda
ENV HF_HOME=/root/.cache/huggingface

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "1"]
```

### Step 9: Deploy to Cloud Run GPU
```bash
# Set variables
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/openclip-images/tts-service:latest"

# Build and push Docker image
docker build -t ${IMAGE} services/tts/
docker push ${IMAGE}

# Deploy to Cloud Run with GPU
gcloud run deploy tts-service \
  --image ${IMAGE} \
  --region ${REGION} \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 8 \
  --memory 32Gi \
  --min-instances 1 \
  --max-instances 3 \
  --timeout 300 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com \
  --vpc-connector openclip-connector \
  --set-env-vars "TTS_DEVICE=cuda,TTS_DEFAULT_ENGINE=kokoro" \
  --port 8003
```

### Step 10: Create Backend TTS Client
Create `backend/app/ai/tts_client.py`:
```python
import io
import os
import tempfile

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class TTSClient:
    """Client for the TTS microservice (Kokoro + Chatterbox)."""

    def __init__(self):
        self.base_url = settings.TTS_SERVICE_URL  # e.g., "http://tts-service:8003"
        self.timeout = 120  # TTS can take up to 60s for long texts

    async def synthesize(
        self,
        text: str,
        engine: str = "kokoro",
        voice: str = "af_heart",
        speed: float = 1.0,
        exaggeration: float = 0.5,
        cfg_weight: float = 0.5,
    ) -> bytes:
        """
        Synthesize text to speech.

        Returns:
            WAV audio bytes.
        """
        if len(text) > 5000:
            return await self._synthesize_long(text, engine, voice, speed, exaggeration, cfg_weight)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/tts/synthesize",
                data={
                    "text": text,
                    "engine": engine,
                    "voice": voice,
                    "speed": speed,
                    "exaggeration": exaggeration,
                    "cfg_weight": cfg_weight,
                },
            )
            resp.raise_for_status()
            return resp.content

    async def _synthesize_long(
        self,
        text: str,
        engine: str,
        voice: str,
        speed: float,
        exaggeration: float,
        cfg_weight: float,
    ) -> bytes:
        """Split long text into chunks and synthesize each."""
        import numpy as np
        import soundfile as sf

        chunks = self._split_text(text, max_chars=4000)
        all_audio = []

        for i, chunk in enumerate(chunks):
            logger.info("tts.chunk", index=i, total=len(chunks), chars=len(chunk))
            wav_bytes = await self.synthesize(
                text=chunk,
                engine=engine,
                voice=voice,
                speed=speed,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight,
            )
            audio_data, sr = sf.read(io.BytesIO(wav_bytes))
            all_audio.append(audio_data)

        # Concatenate with small silence gaps between chunks
        silence = np.zeros(int(0.3 * 24000))  # 300ms silence
        combined = []
        for i, audio in enumerate(all_audio):
            combined.append(audio)
            if i < len(all_audio) - 1:
                combined.append(silence)

        full_audio = np.concatenate(combined)
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, 24000, format="WAV", subtype="PCM_16")
        return buffer.getvalue()

    @staticmethod
    def _split_text(text: str, max_chars: int = 4000) -> list[str]:
        """Split text at sentence boundaries."""
        sentences = []
        current = ""
        for sentence in text.replace("\n", " ").split(". "):
            candidate = f"{current}. {sentence}".strip(". ") + "."
            if len(candidate) > max_chars and current:
                sentences.append(current.strip())
                current = sentence
            else:
                current = candidate
        if current.strip():
            sentences.append(current.strip())
        return sentences

    async def clone_voice(
        self,
        voice_name: str,
        reference_audio_path: str,
    ) -> dict:
        """
        Create a voice clone from reference audio.

        Args:
            voice_name: Unique name for the cloned voice.
            reference_audio_path: Local path to WAV file (6-30 seconds).

        Returns:
            Voice clone metadata.
        """
        async with httpx.AsyncClient(timeout=60) as client:
            with open(reference_audio_path, "rb") as f:
                resp = await client.post(
                    f"{self.base_url}/tts/clone",
                    data={"voice_name": voice_name},
                    files={"reference_audio": ("reference.wav", f, "audio/wav")},
                )
            resp.raise_for_status()
            return resp.json()

    async def list_voices(self) -> dict:
        """List all available voices."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/tts/voices")
            resp.raise_for_status()
            return resp.json()

    async def health(self) -> dict:
        """Check TTS service health."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/tts/health")
            return resp.json()
```

### Step 11: Add Configuration to Backend
Add to `backend/app/core/config.py`:
```python
# TTS Service
TTS_SERVICE_URL: str = "http://tts-service:8003"
TTS_DEFAULT_ENGINE: str = "kokoro"
TTS_DEFAULT_VOICE: str = "af_heart"
```

### Step 12: Create TTS Celery Task
Create `backend/app/tasks/tts.py`:
```python
import tempfile
from pathlib import Path

import structlog

from app.ai.tts_client import TTSClient
from app.services.storage import StorageService
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()
storage = StorageService()


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.ai.synthesize_narration")
def synthesize_narration(
    self,
    job_id: str,
    project_id: str,
    scenes: list[dict],
    engine: str = "kokoro",
    voice: str = "af_heart",
    speed: float = 1.0,
):
    """
    Synthesize narration for all scenes in a faceless video script.

    Args:
        scenes: List of dicts with "narration" key.
        engine: TTS engine ("kokoro" or "chatterbox").
        voice: Voice ID or clone name.
        speed: Speed multiplier.

    Returns:
        List of audio file URLs in GCS.
    """
    import asyncio
    loop = asyncio.new_event_loop()

    try:
        tts = TTSClient()
        audio_urls = []

        for i, scene in enumerate(scenes):
            progress = (i / len(scenes)) * 0.9
            self.update_progress(progress, f"Synthesizing scene {i + 1}/{len(scenes)}...")

            narration = scene.get("narration", "")
            if not narration:
                audio_urls.append(None)
                continue

            # Synthesize audio
            wav_bytes = loop.run_until_complete(
                tts.synthesize(
                    text=narration,
                    engine=engine,
                    voice=voice,
                    speed=speed,
                )
            )

            # Save to temp file and upload to GCS
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(wav_bytes)
                tmp_path = tmp.name

            remote_path = f"{project_id}/tts/scene_{i:03d}.wav"
            url = storage.upload(tmp_path, remote_path, bucket="processed")
            audio_urls.append(url)

            # Cleanup temp file
            Path(tmp_path).unlink(missing_ok=True)

        self.update_progress(1.0, "Narration synthesis complete")
        return {"audio_urls": audio_urls, "engine": engine, "voice": voice}

    except Exception as exc:
        logger.error("tts.task.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, max_retries=2)
    finally:
        loop.close()
```

## Best Practices

- **Eager load Kokoro, lazy load Chatterbox:** Kokoro is small and loads in ~2s. Chatterbox takes ~10s and uses more VRAM. Load Chatterbox on first request to avoid wasting memory if only Kokoro is needed.
- **Chunk long text:** Both models perform best on segments under 500 words. Split at sentence boundaries, synthesize individually, then concatenate with short silence gaps.
- **Normalize audio output:** Chatterbox can produce audio with peaks >1.0. Always normalize before encoding to prevent clipping.
- **Voice clone reference quality:** For Chatterbox voice cloning, the reference audio should be 6-30 seconds of clear speech, minimal background noise, single speaker, recorded at 24kHz or higher.
- **GPU memory management:** Both models together use ~4-5GB VRAM. The L4 has 24GB, leaving plenty of headroom. Never load both models simultaneously in separate processes.
- **Cache model weights:** Use the Docker build step or a persistent volume to cache Hugging Face model weights. Cold download on the L4 takes ~30-60 seconds.
- **Sample rate consistency:** Both engines output 24kHz audio. Ensure downstream consumers (Remotion, FFmpeg) expect 24kHz.

## Testing

### Local Testing
```bash
# Start TTS service locally with GPU
cd services/tts
docker build -t tts-service .
docker run --gpus all -p 8003:8003 tts-service

# Test Kokoro synthesis
curl -X POST http://localhost:8003/tts/synthesize \
  -F "text=Welcome to OpenClip. This is a test of the text to speech system." \
  -F "engine=kokoro" \
  -F "voice=af_heart" \
  --output test_kokoro.wav

# Test Chatterbox synthesis
curl -X POST http://localhost:8003/tts/synthesize \
  -F "text=Welcome to OpenClip. This is a test of the text to speech system." \
  -F "engine=chatterbox" \
  --output test_chatterbox.wav

# Test voice cloning
curl -X POST http://localhost:8003/tts/clone \
  -F "voice_name=my_voice" \
  -F "reference_audio=@reference.wav"

# Test cloned voice synthesis
curl -X POST http://localhost:8003/tts/synthesize \
  -F "text=Hello from my cloned voice." \
  -F "engine=chatterbox" \
  -F "voice=my_voice" \
  --output test_cloned.wav

# List voices
curl http://localhost:8003/tts/voices

# Health check
curl http://localhost:8003/tts/health
```

### Unit Tests
Create `services/tts/tests/test_tts.py`:
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/tts/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


def test_list_voices():
    resp = client.get("/tts/voices")
    assert resp.status_code == 200
    data = resp.json()
    assert "builtin" in data
    assert "engines" in data
    assert len(data["builtin"]) > 0


def test_synthesize_kokoro():
    resp = client.post(
        "/tts/synthesize",
        data={"text": "Hello world.", "engine": "kokoro", "voice": "af_heart"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/wav"
    assert len(resp.content) > 1000  # WAV header + audio data


def test_synthesize_empty_text():
    resp = client.post(
        "/tts/synthesize",
        data={"text": "", "engine": "kokoro"},
    )
    assert resp.status_code == 422  # Validation error


def test_synthesize_unknown_engine():
    resp = client.post(
        "/tts/synthesize",
        data={"text": "Hello", "engine": "unknown"},
    )
    assert resp.status_code == 400
```

## Verification Checklist
- [ ] TTS service Docker image builds successfully
- [ ] Kokoro model loads and generates audio
- [ ] Chatterbox model loads and generates audio
- [ ] `/synthesize` endpoint returns valid WAV audio for Kokoro
- [ ] `/synthesize` endpoint returns valid WAV audio for Chatterbox
- [ ] `/clone` endpoint creates a voice clone from reference audio
- [ ] Cloned voice produces audio that resembles the reference
- [ ] `/voices` endpoint lists all built-in and cloned voices
- [ ] `/health` endpoint returns service status
- [ ] Long text (>5000 chars) is chunked and synthesized correctly
- [ ] Backend `TTSClient` connects and gets audio bytes
- [ ] Celery task synthesizes all scenes and uploads to GCS
- [ ] Cloud Run GPU deployment serves requests
- [ ] Audio output is 24kHz, 16-bit PCM WAV
- [ ] Cold start time < 30s (Kokoro) on Cloud Run
