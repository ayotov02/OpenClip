# Face Detection (YOLO11 + MediaPipe) — Implementation Guide

## Overview
- **What:** Deploy YOLO11 for face/object detection and MediaPipe for 468-landmark face tracking as a CV microservice on GCP Cloud Run GPU.
- **Why:** Face detection is required for AI reframing (centering speakers in 9:16), multi-speaker layouts, and thumbnail selection.
- **Dependencies:** Phase 1 Feature 1 (Project Setup), Phase 1 Feature 3 (Job Queue)

## Architecture

### CV Service Design
```
Video Frame(s) → CV Service (Cloud Run GPU)
  ├── YOLO11: Face/object detection (bounding boxes + confidence)
  ├── MediaPipe: 468-point face landmark tracking
  └── Response: { faces: [{bbox, landmarks, confidence}] }
```

### API Endpoints
```
POST /detect/faces       → Detect faces in single image
POST /detect/objects     → General object detection
POST /track/video        → Track faces across video frames (batch)
GET  /health             → Service status
```

## GCP Deployment
- **Service:** Cloud Run (GPU)
- **Machine:** g2-standard-4 (4 vCPU, 16GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM)
- **Scale:** Min 0, Max 3
- **Cost estimate:** $100-200/month

## Step-by-Step Implementation

### Step 1: Create Vision Service
Create `services/vision/app.py`:
```python
import io
import tempfile
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ultralytics import YOLO

app = FastAPI(title="OpenClip Vision Service")

yolo_model = None
mp_face_mesh = None


@app.on_event("startup")
async def load_models():
    global yolo_model, mp_face_mesh
    yolo_model = YOLO("yolo11x.pt")
    mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=10,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    )


class DetectRequest(BaseModel):
    image_url: str | None = None
    image_base64: str | None = None


class TrackRequest(BaseModel):
    video_url: str
    fps: int = 5
    max_frames: int = 500


@app.post("/detect/faces")
async def detect_faces(req: DetectRequest):
    image = await _load_image(req)
    # YOLO detection
    results = yolo_model(image, classes=[0], verbose=False)  # class 0 = person
    faces = []
    for r in results:
        for box in r.boxes:
            bbox = box.xyxy[0].tolist()
            confidence = float(box.conf[0])
            # MediaPipe landmarks on face crop
            x1, y1, x2, y2 = [int(v) for v in bbox]
            face_crop = image[y1:y2, x1:x2]
            landmarks = _get_landmarks(face_crop, x1, y1)
            faces.append({
                "bbox": bbox,
                "confidence": confidence,
                "landmarks": landmarks,
            })
    return {"faces": faces, "count": len(faces)}


@app.post("/track/video")
async def track_video(req: TrackRequest):
    video_path = await _download_video(req.video_url)
    cap = cv2.VideoCapture(video_path)
    orig_fps = cap.get(cv2.CAP_PROP_FPS)
    frame_skip = max(1, int(orig_fps / req.fps))

    frames = []
    frame_idx = 0
    while cap.isOpened() and len(frames) < req.max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_skip == 0:
            timestamp = frame_idx / orig_fps
            results = yolo_model(frame, classes=[0], verbose=False)
            faces = []
            for r in results:
                for box in r.boxes:
                    faces.append({
                        "bbox": box.xyxy[0].tolist(),
                        "confidence": float(box.conf[0]),
                    })
            frames.append({"timestamp": round(timestamp, 3), "faces": faces})
        frame_idx += 1

    cap.release()
    Path(video_path).unlink(missing_ok=True)
    return {"frames": frames, "total_frames": len(frames)}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "yolo_loaded": yolo_model is not None,
        "mediapipe_loaded": mp_face_mesh is not None,
        "gpu": torch.cuda.is_available(),
    }


def _get_landmarks(face_crop, offset_x, offset_y):
    if face_crop.size == 0:
        return []
    rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    result = mp_face_mesh.process(rgb)
    if not result.multi_face_landmarks:
        return []
    landmarks = []
    h, w = face_crop.shape[:2]
    for lm in result.multi_face_landmarks[0].landmark:
        landmarks.append({
            "x": round(lm.x * w + offset_x, 1),
            "y": round(lm.y * h + offset_y, 1),
            "z": round(lm.z, 4),
        })
    return landmarks


async def _load_image(req):
    if req.image_base64:
        import base64
        data = base64.b64decode(req.image_base64)
        arr = np.frombuffer(data, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    elif req.image_url:
        path = await _download_file(req.image_url)
        return cv2.imread(path)
    raise HTTPException(400, "Provide image_url or image_base64")


async def _download_file(url):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".tmp")
    if url.startswith("gs://"):
        from google.cloud import storage
        client = storage.Client()
        parts = url.replace("gs://", "").split("/", 1)
        client.bucket(parts[0]).blob(parts[1]).download_to_filename(tmp.name)
    else:
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get(url)
            tmp.write(r.content)
    tmp.close()
    return tmp.name

_download_video = _download_file
```

### Step 2: Create Dockerfile
Create `services/vision/Dockerfile`:
```dockerfile
FROM nvidia/cuda:12.4-runtime-ubuntu22.04
RUN apt-get update && apt-get install -y \
    python3.12 python3-pip ffmpeg libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8003
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8003"]
```

Create `services/vision/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
ultralytics>=8.3.0
mediapipe>=0.10.18
opencv-python-headless>=4.10.0
torch>=2.4.0
numpy>=1.26.0
pydantic>=2.10.0
google-cloud-storage>=2.18.0
httpx>=0.28.0
```

### Step 3: Deploy to Cloud Run GPU
```bash
gcloud builds submit services/vision/ \
  --tag us-central1-docker.pkg.dev/openclip-prod/openclip-images/vision

gcloud run deploy vision-service \
  --image us-central1-docker.pkg.dev/openclip-prod/openclip-images/vision \
  --region us-central1 \
  --gpu 1 --gpu-type nvidia-l4 \
  --cpu 4 --memory 16Gi \
  --min-instances 0 --max-instances 3 \
  --timeout 300 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@openclip-prod.iam.gserviceaccount.com \
  --vpc-connector openclip-connector
```

### Step 4: Create Backend Client
Create `backend/app/ai/vision_client.py`:
```python
import httpx
from app.core.config import settings

class VisionClient:
    def __init__(self):
        self.base_url = settings.VISION_URL or "http://localhost:8003"

    async def detect_faces(self, image_url: str) -> dict:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(f"{self.base_url}/detect/faces", json={"image_url": image_url})
            resp.raise_for_status()
            return resp.json()

    async def track_video(self, video_url: str, fps: int = 5) -> dict:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(f"{self.base_url}/track/video", json={"video_url": video_url, "fps": fps})
            resp.raise_for_status()
            return resp.json()
```

## Best Practices
- **YOLO11x for accuracy:** Use the x (extra large) variant for best face detection. Fall back to YOLO11n for speed.
- **Frame sampling:** Don't process every frame. Sample at 5 FPS for tracking — interpolate between keyframes.
- **MediaPipe CPU:** MediaPipe runs efficiently on CPU. Only YOLO needs GPU.
- **Batch processing:** For video tracking, process frames in batches to maximize GPU utilization.

## Testing
- Send test image with known faces → verify bounding boxes
- Send video → verify face tracking across frames
- Test with multi-person video
- Test with no faces (should return empty)

## Verification Checklist
- [ ] YOLO11 detects faces with >90% confidence
- [ ] MediaPipe returns 468 landmarks per face
- [ ] Video tracking returns face positions at correct timestamps
- [ ] Multi-face detection works (up to 10 faces)
- [ ] Cloud Run deployment works with L4 GPU
- [ ] Response time <1s for single image, <60s for 1-minute video
- [ ] Backend client connects and gets results
