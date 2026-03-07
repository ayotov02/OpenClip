# WhisperX Speech-to-Text — Implementation Guide

## Overview
- **What:** Deploy faster-whisper large-v3 + WhisperX as a microservice on GCP Cloud Run with GPU for transcription, word-level timestamps, and speaker diarization.
- **Why:** Accurate transcription with word timestamps is the foundation for captions, clip selection, and filler word removal. WhisperX adds alignment and diarization on top of faster-whisper.
- **Dependencies:** Feature 1 (Project Setup), Feature 3 (Job Queue), Feature 4 (Video Processing — audio extraction)

## Architecture

### Service Design
```
Audio (WAV/MP3) → WhisperX Service (Cloud Run GPU)
  → faster-whisper large-v3 (transcription)
  → WhisperX alignment (word-level timestamps)
  → pyannote.audio 3.1 (speaker diarization)
  → Response: { segments, words, speakers }
```

### API Endpoints
```
POST /transcribe     → Full transcription with timestamps
POST /align          → Align existing transcript to audio
POST /diarize        → Speaker diarization only
GET  /health         → Service health check
GET  /models         → List loaded models
```

## GCP Deployment
- **Service:** Cloud Run (GPU)
- **Machine type:** g2-standard-4 (4 vCPU, 16GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM)
- **Scale:** Min 0, Max 3 instances (scale-to-zero for cost savings)
- **Docker image:** `us-central1-docker.pkg.dev/openclip-prod/openclip-images/whisper`
- **Environment variables:**
  - `WHISPER_MODEL=large-v3`
  - `COMPUTE_TYPE=float16`
  - `DEVICE=cuda`
  - `HF_TOKEN=<for pyannote gated models>`
- **Cost estimate:** $150-300/month (scale-to-zero reduces when idle)

## Step-by-Step Implementation

### Step 1: Create WhisperX Service
Create `services/whisper/app.py`:
```python
import tempfile
from pathlib import Path

import torch
import whisperx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="OpenClip WhisperX Service")

# Global model instances (loaded once at startup)
model = None
align_model = None
diarize_pipeline = None
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"


@app.on_event("startup")
async def load_models():
    global model, diarize_pipeline
    model = whisperx.load_model(
        "large-v3", device=DEVICE, compute_type=COMPUTE_TYPE
    )
    diarize_pipeline = whisperx.DiarizationPipeline(
        use_auth_token="HF_TOKEN", device=DEVICE
    )


class TranscribeRequest(BaseModel):
    audio_url: str
    language: str | None = None
    diarize: bool = True
    min_speakers: int | None = None
    max_speakers: int | None = None


class TranscribeResponse(BaseModel):
    language: str
    segments: list[dict]
    words: list[dict]
    speakers: list[dict] | None = None


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(req: TranscribeRequest):
    # Download audio to temp file
    audio_path = await _download_audio(req.audio_url)

    try:
        # Step 1: Transcribe with faster-whisper
        audio = whisperx.load_audio(audio_path)
        result = model.transcribe(audio, batch_size=16, language=req.language)
        detected_language = result["language"]

        # Step 2: Align for word-level timestamps
        align_model, align_metadata = whisperx.load_align_model(
            language_code=detected_language, device=DEVICE
        )
        result = whisperx.align(
            result["segments"], align_model, align_metadata, audio, DEVICE
        )

        # Step 3: Speaker diarization (optional)
        speakers = None
        if req.diarize and diarize_pipeline:
            diarize_segments = diarize_pipeline(
                audio_path,
                min_speakers=req.min_speakers,
                max_speakers=req.max_speakers,
            )
            result = whisperx.assign_word_speakers(diarize_segments, result)
            speakers = _extract_speakers(result)

        # Extract words with timestamps
        words = []
        for seg in result["segments"]:
            for word in seg.get("words", []):
                words.append({
                    "word": word["word"],
                    "start": round(word["start"], 3),
                    "end": round(word["end"], 3),
                    "score": round(word.get("score", 0), 3),
                    "speaker": word.get("speaker"),
                })

        return TranscribeResponse(
            language=detected_language,
            segments=result["segments"],
            words=words,
            speakers=speakers,
        )
    finally:
        Path(audio_path).unlink(missing_ok=True)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "large-v3",
        "device": DEVICE,
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }


async def _download_audio(url: str) -> str:
    """Download audio from GCS URL or HTTP URL to temp file."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    if url.startswith("gs://"):
        from google.cloud import storage
        client = storage.Client()
        parts = url.replace("gs://", "").split("/", 1)
        blob = client.bucket(parts[0]).blob(parts[1])
        blob.download_to_filename(tmp.name)
    else:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(url)
            tmp.write(resp.content)
    tmp.close()
    return tmp.name


def _extract_speakers(result: dict) -> list[dict]:
    speakers = {}
    for seg in result["segments"]:
        spk = seg.get("speaker", "UNKNOWN")
        if spk not in speakers:
            speakers[spk] = {"id": spk, "segments": []}
        speakers[spk]["segments"].append({
            "start": seg["start"],
            "end": seg["end"],
        })
    return list(speakers.values())
```

### Step 2: Create Dockerfile
Create `services/whisper/Dockerfile`:
```dockerfile
FROM nvidia/cuda:12.4-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.12 python3.12-venv python3-pip ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download model on build (optional — speeds up cold start)
# RUN python3 -c "import whisperx; whisperx.load_model('large-v3', device='cpu')"

EXPOSE 8001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
```

Create `services/whisper/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
whisperx @ git+https://github.com/m-bain/whisperx.git
faster-whisper>=1.0.0
torch>=2.4.0
pydantic>=2.10.0
google-cloud-storage>=2.18.0
httpx>=0.28.0
```

### Step 3: Deploy to Cloud Run GPU
```bash
# Build and push image
gcloud builds submit services/whisper/ \
  --tag us-central1-docker.pkg.dev/openclip-prod/openclip-images/whisper

# Deploy to Cloud Run with GPU
gcloud run deploy whisper-service \
  --image us-central1-docker.pkg.dev/openclip-prod/openclip-images/whisper \
  --region us-central1 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 4 \
  --memory 16Gi \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 600 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@openclip-prod.iam.gserviceaccount.com \
  --vpc-connector openclip-connector \
  --set-env-vars "WHISPER_MODEL=large-v3,COMPUTE_TYPE=float16,DEVICE=cuda"
```

### Step 4: Create Backend Client
Create `backend/app/ai/whisper_client.py`:
```python
import httpx

from app.core.config import settings


class WhisperClient:
    def __init__(self):
        self.base_url = settings.WHISPER_URL

    async def transcribe(
        self,
        audio_url: str,
        language: str | None = None,
        diarize: bool = True,
    ) -> dict:
        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                f"{self.base_url}/transcribe",
                json={
                    "audio_url": audio_url,
                    "language": language,
                    "diarize": diarize,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def health(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/health")
            return resp.json()
```

## Best Practices
- **`batch_size=16`:** Optimal for L4 GPU throughput. Reduce to 8 if OOM.
- **`float16` compute type:** 2x faster than float32, negligible quality loss on GPU.
- **Cache models in GCS:** Pre-download model weights to GCS bucket, copy during Docker build to minimize cold start.
- **Scale-to-zero:** Cloud Run GPU services should have `min-instances=0` for cost savings. Accept ~30s cold start.
- **Word alignment:** Always run WhisperX alignment after transcription — raw Whisper timestamps are less precise.
- **pyannote.audio requires HuggingFace token:** Accept the model license at huggingface.co first.

## Testing
- Send a test WAV file to `/transcribe` endpoint
- Verify word-level timestamps are returned
- Verify speaker labels (if multi-speaker audio)
- Test with different languages
- Test with long audio (30+ minutes)
- Verify GPU utilization during inference

## Verification Checklist
- [ ] Whisper service starts and loads model
- [ ] `/health` returns GPU info
- [ ] Transcription returns accurate text for English audio
- [ ] Word-level timestamps are present and accurate (within 50ms)
- [ ] Speaker diarization identifies different speakers
- [ ] Service handles 10+ minute audio files
- [ ] Cloud Run deployment works with L4 GPU
- [ ] Scale-to-zero works (no cost when idle)
- [ ] Backend client can call the service
- [ ] Error handling for corrupt/empty audio files
