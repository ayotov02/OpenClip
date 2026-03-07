# AI Clip Generation — Implementation Guide

## Overview
- **What:** Build the core AI clipping algorithm that combines WhisperX transcription, LLM analysis, and FFmpeg cutting to automatically generate short-form clips from long-form video.
- **Why:** This is the primary value proposition of OpenClip — "upload a video, get AI-generated clips." This feature ties together STT, LLM, and video processing into a single pipeline.
- **Dependencies:** Feature 3 (Job Queue), Feature 4 (Video Processing), Feature 5 (WhisperX), Feature 6 (LLM Integration)

## Architecture

### Full Clipping Pipeline
```
1. Upload/URL Input
   ↓
2. FFmpeg: Extract audio (WAV 16kHz mono)
   ↓
3. WhisperX: Transcribe → word timestamps + speaker diarization
   ↓
4. Qwen3: Analyze transcript → identify top clips → score virality
   ↓
5. Post-process clip boundaries:
   - Snap to sentence boundaries (using word timestamps)
   - Ensure minimum/maximum duration
   - Avoid cutting mid-word
   - Add padding (0.5s before, 1s after)
   ↓
6. FFmpeg: Cut clips at optimized timestamps
   ↓
7. FFmpeg: Generate thumbnails for each clip
   ↓
8. Store in GCS → Update database → Notify client
```

### Clip Scoring Model
```
Total Score = hook_strength * 2 + emotional_peak * 1.5
            + information_density * 1.5 + self_contained * 2
            + virality_potential * 1.5

Weights emphasize:
- Self-containedness (most important — clip must make sense alone)
- Hook strength (critical for short-form — first 3 seconds matter)
```

## GCP Deployment
- No additional deployment — this feature orchestrates existing services (WhisperX on Cloud Run, Qwen3 on Cloud Run, FFmpeg on worker)
- Runs as a Celery task on the GPU worker (Compute Engine)

## Step-by-Step Implementation

### Step 1: Create Clip Generation Celery Task
Create `backend/app/tasks/clip_generation.py`:
```python
import tempfile
from pathlib import Path

import structlog

from app.ai.llm_client import LLMClient
from app.ai.whisper_client import WhisperClient
from app.ai.prompts import CLIP_ANALYSIS_SYSTEM, CLIP_ANALYSIS_USER
from app.services.ffmpeg import FFmpeg
from app.services.storage import StorageService
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()
storage = StorageService()
whisper = WhisperClient()
llm = LLMClient()


@celery_app.task(
    base=ProgressTask,
    bind=True,
    name="app.tasks.ai.generate_clips",
    queue="ai",
)
def generate_clips(
    self,
    job_id: str,
    project_id: str,
    source_path: str,
    settings: dict,
):
    """Full clip generation pipeline."""
    num_clips = settings.get("num_clips", 10)
    min_duration = settings.get("min_duration", 15)
    max_duration = settings.get("max_duration", 60)
    language = settings.get("language")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)

        # Step 1: Download source video
        self.update_progress(0.05, "Downloading video...")
        local_video = str(tmp / "source.mp4")
        storage.download(source_path, local_video)

        # Step 2: Get video metadata
        metadata = FFmpeg.probe(local_video)
        duration = float(metadata["format"]["duration"])
        logger.info("clip.metadata", duration=duration, job_id=job_id)

        # Step 3: Extract audio
        self.update_progress(0.10, "Extracting audio...")
        local_audio = str(tmp / "audio.wav")
        FFmpeg.extract_audio(local_video, local_audio)

        # Step 4: Upload audio for WhisperX
        audio_remote = f"{project_id}/audio.wav"
        audio_url = storage.upload(local_audio, audio_remote, bucket="temp")

        # Step 5: Transcribe with WhisperX
        self.update_progress(0.20, "Transcribing audio...")
        import asyncio
        transcript_result = asyncio.run(
            whisper.transcribe(audio_url, language=language, diarize=True)
        )
        segments = transcript_result["segments"]
        words = transcript_result["words"]

        # Step 6: Format transcript for LLM
        self.update_progress(0.40, "Analyzing with AI...")
        formatted_transcript = _format_transcript(segments)

        # Step 7: LLM analysis — identify best clips
        analysis = asyncio.run(
            llm.generate_json(
                prompt=CLIP_ANALYSIS_USER.format(
                    transcript=formatted_transcript,
                    num_clips=num_clips,
                    min_duration=min_duration,
                    max_duration=max_duration,
                ),
                system=CLIP_ANALYSIS_SYSTEM,
            )
        )
        raw_clips = analysis.get("clips", [])

        # Step 8: Optimize clip boundaries
        self.update_progress(0.55, "Optimizing clip boundaries...")
        optimized_clips = _optimize_boundaries(raw_clips, words, min_duration, max_duration)

        # Step 9: Cut clips with FFmpeg
        results = []
        for i, clip in enumerate(optimized_clips):
            progress = 0.60 + (i / len(optimized_clips)) * 0.30
            self.update_progress(progress, f"Cutting clip {i + 1}/{len(optimized_clips)}...")

            clip_path = str(tmp / f"clip_{i}.mp4")
            FFmpeg.cut_clip(local_video, clip_path, clip["start_time"], clip["end_time"])

            # Generate thumbnail
            thumb_path = str(tmp / f"thumb_{i}.jpg")
            mid_time = (clip["start_time"] + clip["end_time"]) / 2
            FFmpeg.extract_thumbnail(local_video, thumb_path, timestamp=mid_time)

            # Upload
            clip_remote = f"{project_id}/clips/clip_{i}.mp4"
            thumb_remote = f"{project_id}/clips/thumb_{i}.jpg"
            clip_url = storage.upload(clip_path, clip_remote, bucket="processed")
            thumb_url = storage.upload(thumb_path, thumb_remote, bucket="processed")

            results.append({
                "index": i,
                "start_time": clip["start_time"],
                "end_time": clip["end_time"],
                "duration": clip["end_time"] - clip["start_time"],
                "title": clip.get("title", f"Clip {i + 1}"),
                "score": clip.get("total_score", 0),
                "reason": clip.get("reason", ""),
                "clip_url": clip_url,
                "thumbnail_url": thumb_url,
                "transcript": _get_clip_transcript(words, clip["start_time"], clip["end_time"]),
            })

        self.update_progress(1.0, "Complete")

        return {
            "clips": sorted(results, key=lambda x: x["score"], reverse=True),
            "transcript": formatted_transcript,
            "metadata": {
                "source_duration": duration,
                "clips_generated": len(results),
                "language": transcript_result["language"],
            },
        }


def _format_transcript(segments: list[dict]) -> str:
    """Format segments into readable transcript with timestamps."""
    lines = []
    for seg in segments:
        speaker = seg.get("speaker", "")
        prefix = f"[{speaker}] " if speaker else ""
        start = _format_time(seg["start"])
        lines.append(f"[{start}] {prefix}{seg['text'].strip()}")
    return "\n".join(lines)


def _format_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def _optimize_boundaries(
    clips: list[dict],
    words: list[dict],
    min_duration: int,
    max_duration: int,
) -> list[dict]:
    """Snap clip boundaries to word boundaries and enforce duration constraints."""
    optimized = []
    for clip in clips:
        start = clip["start_time"]
        end = clip["end_time"]

        # Find nearest word boundary for start (snap to word start)
        start_word = _find_nearest_word(words, start, direction="after")
        if start_word:
            start = max(start_word["start"] - 0.3, 0)  # 300ms padding before

        # Find nearest word boundary for end (snap to word end)
        end_word = _find_nearest_word(words, end, direction="before")
        if end_word:
            end = end_word["end"] + 0.5  # 500ms padding after

        # Enforce duration constraints
        duration = end - start
        if duration < min_duration:
            end = start + min_duration
        elif duration > max_duration:
            end = start + max_duration

        clip["start_time"] = round(start, 3)
        clip["end_time"] = round(end, 3)
        optimized.append(clip)

    return optimized


def _find_nearest_word(words: list[dict], timestamp: float, direction: str = "after") -> dict | None:
    if direction == "after":
        candidates = [w for w in words if w["start"] >= timestamp]
        return candidates[0] if candidates else None
    else:
        candidates = [w for w in words if w["end"] <= timestamp]
        return candidates[-1] if candidates else None


def _get_clip_transcript(words: list[dict], start: float, end: float) -> str:
    clip_words = [w["word"] for w in words if w["start"] >= start and w["end"] <= end]
    return " ".join(clip_words)
```

### Step 2: Create Projects API to Trigger Clip Generation
Update `backend/app/api/v1/projects.py` to add clip generation endpoint:
```python
@router.post("/{project_id}/clips")
async def generate_project_clips(
    project_id: uuid.UUID,
    num_clips: int = 10,
    min_duration: int = 15,
    max_duration: int = 60,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify project exists and belongs to user
    # Create job record
    # Dispatch Celery task
    job_service = JobService(db)
    job = await job_service.create_job(
        user_id=user.id,
        job_type=JobType.CLIP,
        input_data={"project_id": str(project_id)},
    )
    await job_service.dispatch(
        job,
        "app.tasks.ai.generate_clips",
        project_id=str(project_id),
        source_path=project.source_file,
        settings={
            "num_clips": num_clips,
            "min_duration": min_duration,
            "max_duration": max_duration,
        },
    )
    return {"job_id": str(job.id), "status": "processing"}
```

## Best Practices
- **Boundary optimization is critical:** Raw LLM timestamps are approximate. Always snap to word boundaries from WhisperX.
- **Padding:** Add 0.3s before and 0.5s after clips to avoid abrupt starts/ends.
- **Weighted scoring:** Self-containedness and hook strength matter most for short-form clips.
- **Parallel clip cutting:** If cutting 10+ clips, consider parallelizing FFmpeg operations.
- **Transcript context:** Send the full transcript to the LLM (not truncated) for best context awareness.

## Testing
- Upload a 10-minute podcast video
- Verify transcription is accurate
- Verify LLM identifies meaningful segments
- Verify clip boundaries don't cut mid-word
- Verify output clips play correctly
- Verify scoring ranks better clips higher

## Verification Checklist
- [ ] Full pipeline runs end-to-end (upload → clips)
- [ ] Transcription is accurate (spot-check 5 clips)
- [ ] LLM identifies contextually meaningful segments
- [ ] Clip boundaries snap to word boundaries
- [ ] No clip cuts mid-sentence
- [ ] Duration constraints are respected
- [ ] Clips are stored in GCS with correct paths
- [ ] Thumbnails generated for each clip
- [ ] Clips sorted by virality score
- [ ] Job progress updates work in real-time
- [ ] Handles videos of various lengths (5min, 30min, 2hr)
