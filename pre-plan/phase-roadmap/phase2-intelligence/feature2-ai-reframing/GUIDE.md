# AI Reframing — Implementation Guide

## Overview
- **What:** Automatically track and center the active speaker when converting landscape (16:9) video to portrait (9:16), square (1:1), or other aspect ratios.
- **Why:** 9:16 is the dominant format for TikTok, Reels, and Shorts. Manual cropping is tedious — AI reframing tracks speakers and produces smooth camera motion.
- **Dependencies:** Phase 2 Feature 1 (Face Detection), Phase 1 Feature 4 (Video Processing)

## Architecture

### Reframing Pipeline
```
Source Video (16:9) → Face Detection (YOLO per frame at 5 FPS)
  → Speaker Diarization (pyannote — who's talking when)
  → Crop Region Calculation (center on active speaker)
  → Smoothing Algorithm (Kalman filter — avoid jerky motion)
  → Interpolation (fill frames between keyframes)
  → FFmpeg crop filter (apply per-frame crop coordinates)
  → Output Video (9:16 / 1:1 / 4:5)
```

### Reframing Modes
- **Auto:** AI tracks the active speaker, smooth pan between speakers
- **Manual:** User defines crop keyframes, system interpolates between
- **Multi-speaker:** Split screen layout (side-by-side or top-bottom)
- **Static:** Fixed center crop (no tracking)

## Step-by-Step Implementation

### Step 1: Create Reframing Service
Create `backend/app/services/reframe_service.py`:
```python
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import structlog

from app.ai.vision_client import VisionClient
from app.services.ffmpeg import FFmpeg
from app.services.storage import StorageService

logger = structlog.get_logger()


class ReframeService:
    ASPECT_RATIOS = {
        "9:16": (9, 16),
        "1:1": (1, 1),
        "4:5": (4, 5),
        "16:9": (16, 9),
    }

    def __init__(self):
        self.vision = VisionClient()
        self.storage = StorageService()

    async def reframe(
        self,
        video_path: str,
        target_ratio: str = "9:16",
        mode: str = "auto",
        tracking_fps: int = 5,
    ) -> dict:
        # Get source dimensions
        probe = FFmpeg.probe(video_path)
        video_stream = next(s for s in probe["streams"] if s["codec_type"] == "video")
        src_w = int(video_stream["width"])
        src_h = int(video_stream["height"])
        fps = eval(video_stream["r_frame_rate"])
        duration = float(probe["format"]["duration"])

        # Calculate target crop dimensions
        ratio_w, ratio_h = self.ASPECT_RATIOS[target_ratio]
        crop_h = src_h
        crop_w = int(crop_h * ratio_w / ratio_h)
        if crop_w > src_w:
            crop_w = src_w
            crop_h = int(crop_w * ratio_h / ratio_w)

        if mode == "static":
            # Simple center crop
            x = (src_w - crop_w) // 2
            y = (src_h - crop_h) // 2
            return self._apply_static_crop(video_path, crop_w, crop_h, x, y)

        # Track faces in video
        tracking = await self.vision.track_video(video_path, fps=tracking_fps)
        frames = tracking["frames"]

        # Calculate crop center for each tracked frame
        crop_points = []
        for frame in frames:
            if frame["faces"]:
                # Find largest face (likely active speaker)
                largest = max(frame["faces"], key=lambda f: (f["bbox"][2] - f["bbox"][0]) * (f["bbox"][3] - f["bbox"][1]))
                face_cx = (largest["bbox"][0] + largest["bbox"][2]) / 2
                face_cy = (largest["bbox"][1] + largest["bbox"][3]) / 2
            else:
                face_cx = src_w / 2
                face_cy = src_h / 2

            # Clamp crop region within bounds
            crop_x = int(max(0, min(face_cx - crop_w / 2, src_w - crop_w)))
            crop_y = int(max(0, min(face_cy - crop_h / 2, src_h - crop_h)))
            crop_points.append({
                "t": frame["timestamp"],
                "x": crop_x,
                "y": crop_y,
            })

        # Smooth crop trajectory (Kalman-like exponential smoothing)
        smoothed = self._smooth_trajectory(crop_points, alpha=0.15)

        # Interpolate to full FPS
        full_trajectory = self._interpolate_trajectory(smoothed, fps, duration)

        # Apply crop via FFmpeg filter
        return self._apply_dynamic_crop(video_path, crop_w, crop_h, full_trajectory, fps)

    def _smooth_trajectory(self, points: list[dict], alpha: float = 0.15) -> list[dict]:
        """Exponential moving average smoothing to prevent jerky camera motion."""
        if not points:
            return points
        smoothed = [points[0].copy()]
        for i in range(1, len(points)):
            smoothed.append({
                "t": points[i]["t"],
                "x": int(alpha * points[i]["x"] + (1 - alpha) * smoothed[-1]["x"]),
                "y": int(alpha * points[i]["y"] + (1 - alpha) * smoothed[-1]["y"]),
            })
        return smoothed

    def _interpolate_trajectory(self, keyframes: list[dict], fps: float, duration: float) -> list[dict]:
        """Interpolate between keyframes to get per-frame crop coordinates."""
        if not keyframes:
            return []
        trajectory = []
        total_frames = int(fps * duration)
        kf_idx = 0
        for frame_num in range(total_frames):
            t = frame_num / fps
            # Find surrounding keyframes
            while kf_idx < len(keyframes) - 1 and keyframes[kf_idx + 1]["t"] <= t:
                kf_idx += 1
            if kf_idx >= len(keyframes) - 1:
                trajectory.append({"x": keyframes[-1]["x"], "y": keyframes[-1]["y"]})
            else:
                # Linear interpolation
                kf0 = keyframes[kf_idx]
                kf1 = keyframes[kf_idx + 1]
                frac = (t - kf0["t"]) / (kf1["t"] - kf0["t"]) if kf1["t"] != kf0["t"] else 0
                trajectory.append({
                    "x": int(kf0["x"] + frac * (kf1["x"] - kf0["x"])),
                    "y": int(kf0["y"] + frac * (kf1["y"] - kf0["y"])),
                })
        return trajectory

    def _apply_dynamic_crop(self, input_path, crop_w, crop_h, trajectory, fps):
        """Apply per-frame crop using FFmpeg cropdetect + sendcmd."""
        with tempfile.TemporaryDirectory() as tmp:
            # Write crop commands file for FFmpeg sendcmd
            cmd_file = Path(tmp) / "crop_cmds.txt"
            with open(cmd_file, "w") as f:
                for i, point in enumerate(trajectory):
                    t = i / fps
                    f.write(f"{t:.4f} crop x {point['x']};\n")
                    f.write(f"{t:.4f} crop y {point['y']};\n")

            output_path = Path(tmp) / "reframed.mp4"
            cmd = [
                "ffmpeg", "-i", input_path,
                "-vf", f"sendcmd=f={cmd_file},crop={crop_w}:{crop_h}",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac",
                "-movflags", "+faststart",
                "-y", str(output_path),
            ]
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=3600)
            return str(output_path)

    def _apply_static_crop(self, input_path, crop_w, crop_h, x, y):
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            cmd = [
                "ffmpeg", "-i", input_path,
                "-vf", f"crop={crop_w}:{crop_h}:{x}:{y}",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-movflags", "+faststart",
                "-y", tmp.name,
            ]
            subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=3600)
            return tmp.name
```

### Step 2: Create Celery Task
Create `backend/app/tasks/reframe.py`:
```python
from app.services.reframe_service import ReframeService
from app.services.storage import StorageService
from app.tasks.base import ProgressTask
from app.worker import celery_app

storage = StorageService()

@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.video.reframe", queue="video")
def reframe_video(self, job_id, source_path, project_id, target_ratio="9:16", mode="auto"):
    import asyncio, tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        self.update_progress(0.1, "Downloading video...")
        local_path = str(Path(tmp) / "source.mp4")
        storage.download(source_path, local_path)

        self.update_progress(0.2, f"Reframing to {target_ratio}...")
        service = ReframeService()
        output = asyncio.run(service.reframe(local_path, target_ratio, mode))

        self.update_progress(0.9, "Uploading result...")
        remote = f"{project_id}/reframed_{target_ratio.replace(':', 'x')}.mp4"
        url = storage.upload(output, remote, bucket="processed")

        self.update_progress(1.0, "Complete")
        return {"output_url": url, "aspect_ratio": target_ratio}
```

## Best Practices
- **Smoothing alpha=0.15:** Lower = smoother but more lag. Higher = responsive but potentially jerky. 0.15 is a good balance.
- **Track at 5 FPS:** Good tradeoff between accuracy and speed. Interpolate for full FPS.
- **Clamp crop bounds:** Always ensure crop region stays within source frame.
- **Active speaker priority:** When multiple faces detected, track the largest face (closest to camera) or use pyannote diarization to identify active speaker.

## Testing
- Reframe a 16:9 talking-head video to 9:16 → speaker stays centered
- Test with moving speaker → camera follows smoothly
- Test multi-person video → largest face tracked
- Test static mode → simple center crop

## Verification Checklist
- [ ] 16:9 → 9:16 conversion produces correct dimensions
- [ ] Speaker stays centered throughout clip
- [ ] Camera motion is smooth (no jerky jumps)
- [ ] Multi-person detection works
- [ ] Static crop mode produces centered output
- [ ] Audio stays in sync after reframing
- [ ] Handles videos with no faces (falls back to center)
