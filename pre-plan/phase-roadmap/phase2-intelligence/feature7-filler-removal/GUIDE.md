# Filler Word & Silence Removal — Implementation Guide

## Overview
- **What:** Detect and remove filler words ("um," "uh," "like," "you know") and awkward silences from video, with smooth audio crossfades.
- **Why:** Filler removal is a top-requested feature. Gling and Descript win users specifically for this. Clean audio = professional content.
- **Dependencies:** Phase 1 Feature 5 (WhisperX — word timestamps), Phase 1 Feature 4 (Video Processing)

## Architecture

### Detection Pipeline
```
Audio → WhisperX (word-level timestamps + confidence)
  → Classify each word: speech | filler | silence
  → Generate cut list [{type, start, end}]
  → User review (optional — show detected fillers for approval)
  → FFmpeg (remove segments, crossfade audio at 50ms)
```

### Filler Word Dictionary
```python
FILLER_WORDS = {
    "en": ["um", "uh", "uh-huh", "uhh", "umm", "hmm", "hm",
           "like", "you know", "basically", "literally", "actually",
           "so", "right", "i mean", "sort of", "kind of"],
}
```

### Silence Detection
```python
# Silence = segment where:
# - No speech for > 0.8 seconds
# - Audio RMS below threshold (-40 dB)
# Keep silences < 0.3s (natural pauses)
```

## Step-by-Step Implementation

### Step 1: Create Filler Detection Service
Create `backend/app/services/filler_service.py`:
```python
import numpy as np
import structlog

logger = structlog.get_logger()

FILLER_WORDS = {
    "en": {"um", "uh", "uhh", "umm", "hmm", "hm", "uh-huh",
           "like", "you know", "basically", "literally", "actually",
           "i mean", "sort of", "kind of"},
}

MIN_SILENCE_DURATION = 0.8   # Detect silences longer than this
MAX_KEPT_SILENCE = 0.3       # Keep natural pauses up to this length
CROSSFADE_MS = 50            # Audio crossfade duration


class FillerService:
    def detect_fillers(self, words: list[dict], language: str = "en") -> list[dict]:
        """Detect filler words and long silences from WhisperX word timestamps."""
        fillers = FILLER_WORDS.get(language, FILLER_WORDS["en"])
        cuts = []

        for i, word in enumerate(words):
            # Check filler words
            if word["word"].strip().lower() in fillers:
                cuts.append({
                    "type": "filler",
                    "word": word["word"],
                    "start": word["start"],
                    "end": word["end"],
                })

            # Check for silence between words
            if i < len(words) - 1:
                gap = words[i + 1]["start"] - word["end"]
                if gap > MIN_SILENCE_DURATION:
                    # Keep a small natural pause
                    cut_start = word["end"] + MAX_KEPT_SILENCE
                    cut_end = words[i + 1]["start"]
                    if cut_end > cut_start:
                        cuts.append({
                            "type": "silence",
                            "start": cut_start,
                            "end": cut_end,
                            "duration": cut_end - cut_start,
                        })

        # Merge overlapping/adjacent cuts
        return self._merge_cuts(cuts)

    def generate_ffmpeg_filter(self, cuts: list[dict], total_duration: float) -> str:
        """Generate FFmpeg select/aselect filter to remove segments."""
        if not cuts:
            return ""

        # Build keep segments (inverse of cuts)
        keeps = []
        prev_end = 0.0
        for cut in sorted(cuts, key=lambda c: c["start"]):
            if cut["start"] > prev_end:
                keeps.append((prev_end, cut["start"]))
            prev_end = cut["end"]
        if prev_end < total_duration:
            keeps.append((prev_end, total_duration))

        # Build FFmpeg trim filter chain
        parts = []
        for i, (start, end) in enumerate(keeps):
            parts.append(
                f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{i}]; "
                f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS[a{i}]"
            )

        # Concat all parts
        v_inputs = "".join(f"[v{i}]" for i in range(len(keeps)))
        a_inputs = "".join(f"[a{i}]" for i in range(len(keeps)))
        concat = f"{v_inputs}{a_inputs}concat=n={len(keeps)}:v=1:a=1[outv][outa]"

        return "; ".join(parts) + "; " + concat

    def _merge_cuts(self, cuts: list[dict]) -> list[dict]:
        if not cuts:
            return []
        sorted_cuts = sorted(cuts, key=lambda c: c["start"])
        merged = [sorted_cuts[0]]
        for cut in sorted_cuts[1:]:
            if cut["start"] <= merged[-1]["end"] + 0.1:  # 100ms merge threshold
                merged[-1]["end"] = max(merged[-1]["end"], cut["end"])
                merged[-1]["type"] = "merged"
            else:
                merged.append(cut)
        return merged
```

### Step 2: Create Celery Task
```python
@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.video.remove_fillers")
def remove_fillers(self, job_id, source_path, project_id, words):
    service = FillerService()
    cuts = service.detect_fillers(words)

    if not cuts:
        return {"status": "no_fillers_detected", "cuts": []}

    # Download video, apply FFmpeg filter, upload result
    with tempfile.TemporaryDirectory() as tmp:
        local = str(Path(tmp) / "source.mp4")
        storage.download(source_path, local)

        probe = FFmpeg.probe(local)
        duration = float(probe["format"]["duration"])
        filter_complex = service.generate_ffmpeg_filter(cuts, duration)

        output = str(Path(tmp) / "clean.mp4")
        cmd = [
            "ffmpeg", "-i", local,
            "-filter_complex", filter_complex,
            "-map", "[outv]", "-map", "[outa]",
            "-c:v", "libx264", "-preset", "fast",
            "-c:a", "aac",
            "-y", output,
        ]
        subprocess.run(cmd, check=True, timeout=3600)

        remote = f"{project_id}/clean.mp4"
        url = storage.upload(output, remote, bucket="processed")
        return {"output_url": url, "cuts": cuts, "removed_seconds": sum(c["end"]-c["start"] for c in cuts)}
```

## Best Practices
- **User review before removal:** Show detected fillers with timestamps. Let users approve/reject each cut.
- **50ms crossfade:** Audio crossfade at cut points prevents clicking artifacts.
- **Keep natural pauses (0.3s):** Removing ALL silence sounds unnatural. Keep short pauses.
- **Confidence threshold:** Only remove filler words detected with >0.8 confidence from WhisperX.

## Testing
- Process video with known filler words → verify detection
- Verify removed audio sounds natural (no clicks)
- Verify video stays in sync after removal
- Test with clean audio (no fillers) → no changes made

## Verification Checklist
- [ ] Detects common filler words (um, uh, like, you know)
- [ ] Detects long silences (>0.8s)
- [ ] Keeps natural pauses (<0.3s)
- [ ] FFmpeg filter removes segments cleanly
- [ ] Audio crossfade prevents clicking
- [ ] Video and audio stay in sync
- [ ] Reports total seconds removed
- [ ] Handles videos with no fillers gracefully
