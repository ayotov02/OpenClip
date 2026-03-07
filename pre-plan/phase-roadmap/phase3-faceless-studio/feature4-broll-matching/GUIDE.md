# B-Roll Matching (Visual Relevance Scoring) — Implementation Guide

## Overview
- **What:** Build a scoring algorithm that matches B-roll footage to script scenes based on visual relevance, duration match, resolution quality, and color consistency. Apply Ken Burns effects (pan/zoom) on static or slow footage. Implement a fallback strategy when no good match is found (gradient backgrounds, abstract visuals, or AI-generated images).
- **Why:** The quality of B-roll selection directly determines whether a faceless video looks professional or amateurish. Automated scoring eliminates manual searching and ensures every scene has visually appropriate footage. This feature builds on Phase 2 Feature 3 (B-Roll Integration) by adding intelligent matching specifically for the faceless video pipeline.
- **Dependencies:** Phase 2 Feature 3 (B-Roll Integration — Pexels client), Phase 3 Feature 2 (Script Generation), Phase 1 Feature 6 (LLM Integration)

## Architecture

### B-Roll Matching Pipeline
```
Script Scene (keywords, mood, visual_description, duration_est)
  → Query Generation (LLM generates 3-5 Pexels search queries per scene)
  → Pexels API Search (fetch candidate videos for each query)
  → Multi-Factor Scoring:
      ├── Visual Relevance (0.40 weight) — keyword match + LLM assessment
      ├── Duration Match (0.25 weight) — video length vs. scene duration
      ├── Resolution Quality (0.15 weight) — >= 720p preferred
      ├── Color/Mood Consistency (0.10 weight) — mood-appropriate visuals
      └── Aspect Ratio Match (0.10 weight) — matches target format
  → Rank & Select Top Match per Scene
  → Ken Burns Effect Decision (static footage gets pan/zoom)
  → Fallback if score < threshold (gradient, abstract, FLUX.1 generation)
  → Download & Cache Selected B-Roll
```

### Scoring Matrix
```
┌────────────────────┬────────┬─────────────────────────────────────────┐
│ Factor             │ Weight │ Scoring Logic                           │
├────────────────────┼────────┼─────────────────────────────────────────┤
│ Visual Relevance   │ 0.40   │ Query-match relevance from LLM (0-1)   │
│ Duration Match     │ 0.25   │ 1.0 if video >= scene duration,        │
│                    │        │ linear decay if shorter                 │
│ Resolution         │ 0.15   │ 1.0 if >= 1080p, 0.7 if 720p,         │
│                    │        │ 0.3 if < 720p                          │
│ Color/Mood         │ 0.10   │ Mood tag alignment (dark footage for   │
│                    │        │ "scary", bright for "upbeat")           │
│ Aspect Ratio       │ 0.10   │ 1.0 if matches target, 0.5 if needs   │
│                    │        │ cropping, 0.2 if extreme mismatch      │
└────────────────────┴────────┴─────────────────────────────────────────┘
```

### Data Flow
```
1. For each script scene:
   a. LLM generates 3-5 Pexels search queries from keywords + visual_description
   b. Search Pexels for each query (5 results each = ~15-25 candidates)
   c. Score each candidate on 5 factors
   d. Select top-scoring video (or fallback if all scores < 0.4)
   e. Download selected video, trim to scene duration, apply Ken Burns if needed
   f. Upload processed B-roll to GCS
2. Return list of B-roll URLs (one per scene)
```

## GCP Deployment
- No additional GCP service required. Runs as part of the Celery worker pipeline.
- Uses existing LLM service for query generation and relevance scoring.
- Uses existing Pexels API client from Phase 2 Feature 3.
- Downloaded B-roll stored in GCS: `gs://processed/{project_id}/broll/scene_{n}.mp4`

## Step-by-Step Implementation

### Step 1: Create B-Roll Scoring Models
Create `backend/app/schemas/broll.py`:
```python
from pydantic import BaseModel, Field


class BRollCandidate(BaseModel):
    id: int
    url: str
    download_url: str
    thumbnail: str
    duration: float
    width: int
    height: int
    query: str
    relevance: float = 0.0

    # Computed scores
    visual_relevance_score: float = 0.0
    duration_score: float = 0.0
    resolution_score: float = 0.0
    mood_score: float = 0.0
    aspect_ratio_score: float = 0.0
    total_score: float = 0.0
    needs_ken_burns: bool = False


class BRollMatch(BaseModel):
    scene_number: int
    candidate: BRollCandidate | None
    fallback_used: bool = False
    fallback_type: str | None = None  # "gradient", "abstract", "generated"
    local_path: str | None = None
    gcs_url: str | None = None


class BRollMatchRequest(BaseModel):
    project_id: str
    scenes: list[dict]
    target_width: int = 1080
    target_height: int = 1920
    target_fps: int = 30
    min_score_threshold: float = Field(0.4, ge=0.0, le=1.0)
    mood_override: str | None = None
```

### Step 2: Create B-Roll Scoring Engine
Create `backend/app/services/broll_scorer.py`:
```python
import structlog

from app.schemas.broll import BRollCandidate

logger = structlog.get_logger()

# Weights for each scoring factor
WEIGHTS = {
    "visual_relevance": 0.40,
    "duration": 0.25,
    "resolution": 0.15,
    "mood": 0.10,
    "aspect_ratio": 0.10,
}

# Mood-to-visual associations for color/mood scoring
MOOD_VISUAL_HINTS = {
    "dramatic": ["dark", "contrast", "storm", "epic", "cinematic"],
    "upbeat": ["bright", "colorful", "sunny", "happy", "celebration"],
    "calm": ["nature", "water", "slow", "peaceful", "serene"],
    "mysterious": ["fog", "shadow", "dark", "night", "abstract"],
    "funny": ["bright", "colorful", "cartoon", "comedy", "playful"],
    "tense": ["dark", "close-up", "fast", "danger", "warning"],
    "inspiring": ["sunrise", "mountain", "sky", "achievement", "light"],
    "dark": ["night", "shadow", "black", "horror", "abandoned"],
}


class BRollScorer:
    """Scores B-roll candidates on multiple factors."""

    def score_candidate(
        self,
        candidate: BRollCandidate,
        scene_duration: float,
        scene_mood: str,
        target_width: int,
        target_height: int,
    ) -> BRollCandidate:
        """
        Score a single B-roll candidate on all factors.

        Args:
            candidate: The B-roll video candidate.
            scene_duration: Required duration in seconds.
            scene_mood: Mood tag from the script scene.
            target_width: Target video width.
            target_height: Target video height.

        Returns:
            Updated candidate with all score fields populated.
        """
        # 1. Visual relevance (from LLM-assigned relevance during search)
        candidate.visual_relevance_score = candidate.relevance

        # 2. Duration match
        candidate.duration_score = self._score_duration(
            candidate.duration, scene_duration
        )

        # 3. Resolution quality
        candidate.resolution_score = self._score_resolution(
            candidate.width, candidate.height
        )

        # 4. Mood/color consistency
        candidate.mood_score = self._score_mood(
            candidate.query, scene_mood
        )

        # 5. Aspect ratio match
        candidate.aspect_ratio_score = self._score_aspect_ratio(
            candidate.width, candidate.height, target_width, target_height
        )

        # Compute weighted total
        candidate.total_score = round(
            candidate.visual_relevance_score * WEIGHTS["visual_relevance"]
            + candidate.duration_score * WEIGHTS["duration"]
            + candidate.resolution_score * WEIGHTS["resolution"]
            + candidate.mood_score * WEIGHTS["mood"]
            + candidate.aspect_ratio_score * WEIGHTS["aspect_ratio"],
            4,
        )

        # Determine if Ken Burns effect is needed
        # Apply Ken Burns if video is shorter than scene or very static
        candidate.needs_ken_burns = (
            candidate.duration < scene_duration * 0.8
            or candidate.duration < 5
        )

        return candidate

    def score_all(
        self,
        candidates: list[BRollCandidate],
        scene_duration: float,
        scene_mood: str,
        target_width: int,
        target_height: int,
    ) -> list[BRollCandidate]:
        """Score all candidates and sort by total score descending."""
        scored = [
            self.score_candidate(c, scene_duration, scene_mood, target_width, target_height)
            for c in candidates
        ]
        scored.sort(key=lambda c: c.total_score, reverse=True)
        return scored

    @staticmethod
    def _score_duration(video_duration: float, scene_duration: float) -> float:
        """Score based on how well video duration matches scene duration."""
        if video_duration >= scene_duration:
            return 1.0
        ratio = video_duration / scene_duration if scene_duration > 0 else 0
        # Linear decay: 80% of duration = 0.8 score, 50% = 0.5, etc.
        return max(0.0, ratio)

    @staticmethod
    def _score_resolution(width: int, height: int) -> float:
        """Score based on video resolution."""
        max_dim = max(width, height)
        if max_dim >= 1920:
            return 1.0
        if max_dim >= 1080:
            return 0.9
        if max_dim >= 720:
            return 0.7
        if max_dim >= 480:
            return 0.4
        return 0.2

    @staticmethod
    def _score_mood(query: str, mood: str) -> float:
        """Score based on query alignment with mood-associated visuals."""
        hints = MOOD_VISUAL_HINTS.get(mood, [])
        if not hints:
            return 0.5  # Neutral if mood unknown

        query_lower = query.lower()
        matches = sum(1 for hint in hints if hint in query_lower)

        if matches >= 2:
            return 1.0
        if matches == 1:
            return 0.7
        return 0.4  # No explicit mood match but not necessarily wrong

    @staticmethod
    def _score_aspect_ratio(
        video_w: int, video_h: int, target_w: int, target_h: int
    ) -> float:
        """Score based on aspect ratio compatibility."""
        video_ratio = video_w / video_h if video_h > 0 else 1
        target_ratio = target_w / target_h if target_h > 0 else 1

        diff = abs(video_ratio - target_ratio)

        if diff < 0.1:
            return 1.0  # Nearly identical
        if diff < 0.5:
            return 0.7  # Minor cropping needed
        if diff < 1.0:
            return 0.4  # Significant cropping
        return 0.2  # Extreme mismatch (e.g., ultra-wide to portrait)
```

### Step 3: Create B-Roll Matching Service
Create `backend/app/services/broll_matcher.py`:
```python
import tempfile
from pathlib import Path

import structlog

from app.ai.llm_client import LLMClient
from app.schemas.broll import BRollCandidate, BRollMatch, BRollMatchRequest
from app.services.broll_scorer import BRollScorer
from app.services.ffmpeg import FFmpeg
from app.services.pexels import PexelsClient
from app.services.storage import StorageService

logger = structlog.get_logger()

BROLL_QUERY_SYSTEM = """You are a B-roll director for faceless videos. Generate Pexels stock footage search queries.
Rules:
- Queries must be concrete, visual terms (not abstract concepts)
- Include orientation guidance based on the target format
- Rank by expected visual relevance
Output ONLY valid JSON."""

BROLL_QUERY_USER = """Generate Pexels search queries for this scene:

NARRATION: "{narration}"
VISUAL DESCRIPTION: "{visual_description}"
KEYWORDS: {keywords}
MOOD: {mood}

Target format: {orientation} ({width}x{height})

Output 3-5 search queries:
{{
  "queries": [
    {{"query": "<pexels search term>", "orientation": "{orientation}", "relevance": <0.0-1.0>}}
  ]
}}"""


class BRollMatcher:
    """Matches B-roll footage to script scenes using multi-factor scoring."""

    def __init__(self):
        self.llm = LLMClient()
        self.pexels = PexelsClient()
        self.scorer = BRollScorer()
        self.storage = StorageService()

    async def match_scenes(self, request: BRollMatchRequest) -> list[BRollMatch]:
        """
        Find and score B-roll for all scenes in a script.

        Returns:
            List of BRollMatch objects, one per scene.
        """
        orientation = "portrait" if request.target_height > request.target_width else "landscape"
        matches = []

        for scene in request.scenes:
            scene_num = scene.get("scene_number", 0)
            logger.info("broll.matching", scene=scene_num)

            match = await self._match_single_scene(
                scene=scene,
                orientation=orientation,
                target_width=request.target_width,
                target_height=request.target_height,
                min_score=request.min_score_threshold,
                project_id=request.project_id,
            )
            matches.append(match)

        return matches

    async def _match_single_scene(
        self,
        scene: dict,
        orientation: str,
        target_width: int,
        target_height: int,
        min_score: float,
        project_id: str,
    ) -> BRollMatch:
        """Find the best B-roll match for a single scene."""
        scene_num = scene.get("scene_number", 0)
        duration = scene.get("duration_est", 8)
        mood = scene.get("mood", "calm")

        # Step 1: Generate search queries via LLM
        queries = await self._generate_queries(scene, orientation, target_width, target_height)

        # Step 2: Search Pexels
        candidates = await self._search_candidates(queries, orientation)

        if not candidates:
            logger.warning("broll.no_candidates", scene=scene_num)
            return BRollMatch(
                scene_number=scene_num,
                candidate=None,
                fallback_used=True,
                fallback_type="gradient",
            )

        # Step 3: Score all candidates
        scored = self.scorer.score_all(
            candidates=candidates,
            scene_duration=duration,
            scene_mood=mood,
            target_width=target_width,
            target_height=target_height,
        )

        best = scored[0]

        # Step 4: Check minimum threshold
        if best.total_score < min_score:
            logger.warning(
                "broll.below_threshold",
                scene=scene_num,
                best_score=best.total_score,
                threshold=min_score,
            )
            return BRollMatch(
                scene_number=scene_num,
                candidate=best,
                fallback_used=True,
                fallback_type="abstract",
            )

        # Step 5: Download, process, and upload
        gcs_url = await self._process_broll(
            candidate=best,
            scene_duration=duration,
            target_width=target_width,
            target_height=target_height,
            project_id=project_id,
            scene_num=scene_num,
        )

        return BRollMatch(
            scene_number=scene_num,
            candidate=best,
            gcs_url=gcs_url,
        )

    async def _generate_queries(
        self, scene: dict, orientation: str, target_width: int, target_height: int
    ) -> list[dict]:
        """Generate Pexels search queries from scene data via LLM."""
        user_prompt = BROLL_QUERY_USER.format(
            narration=scene.get("narration", "")[:300],
            visual_description=scene.get("visual_description", ""),
            keywords=scene.get("search_keywords", []),
            mood=scene.get("mood", "neutral"),
            orientation=orientation,
            width=target_width,
            height=target_height,
        )

        result = await self.llm.generate_json(
            prompt=user_prompt,
            system=BROLL_QUERY_SYSTEM,
        )
        return result.get("queries", [])[:5]

    async def _search_candidates(
        self, queries: list[dict], orientation: str
    ) -> list[BRollCandidate]:
        """Search Pexels for B-roll candidates."""
        all_candidates = []
        seen_ids = set()

        for q in queries:
            videos = await self.pexels.search_videos(
                query=q.get("query", ""),
                orientation=q.get("orientation", orientation),
                per_page=5,
            )
            for v in videos:
                if v["id"] not in seen_ids:
                    seen_ids.add(v["id"])
                    all_candidates.append(
                        BRollCandidate(
                            id=v["id"],
                            url=v["url"],
                            download_url=v["download_url"],
                            thumbnail=v["thumbnail"],
                            duration=v["duration"],
                            width=v["width"],
                            height=v["height"],
                            query=q.get("query", ""),
                            relevance=q.get("relevance", 0.5),
                        )
                    )

        return all_candidates

    async def _process_broll(
        self,
        candidate: BRollCandidate,
        scene_duration: float,
        target_width: int,
        target_height: int,
        project_id: str,
        scene_num: int,
    ) -> str:
        """Download, trim, resize B-roll and upload to GCS."""
        import httpx

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Download video
            raw_path = str(Path(tmp_dir) / "raw.mp4")
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(candidate.download_url)
                resp.raise_for_status()
                with open(raw_path, "wb") as f:
                    f.write(resp.content)

            # Trim to scene duration (with a small buffer)
            trimmed_path = str(Path(tmp_dir) / "trimmed.mp4")
            trim_duration = min(candidate.duration, scene_duration + 1.0)
            FFmpeg.cut_clip(raw_path, trimmed_path, 0, trim_duration)

            # Resize to target dimensions
            output_path = str(Path(tmp_dir) / "output.mp4")
            FFmpeg.resize(trimmed_path, output_path, target_width, target_height)

            # Upload to GCS
            remote_path = f"{project_id}/broll/scene_{scene_num:03d}.mp4"
            gcs_url = self.storage.upload(
                output_path, remote_path, bucket="processed"
            )

        return gcs_url
```

### Step 4: Create Ken Burns FFmpeg Filter
Add to `backend/app/services/ffmpeg.py`:
```python
@staticmethod
def apply_ken_burns(
    input_path: str,
    output_path: str,
    duration: float,
    width: int,
    height: int,
    direction: str = "zoom_in",
) -> str:
    """
    Apply Ken Burns (slow pan/zoom) effect to a video or image.

    Args:
        direction: "zoom_in", "zoom_out", "pan_left", "pan_right"
    """
    fps = 30
    total_frames = int(duration * fps)

    if direction == "zoom_in":
        # Zoom from 100% to 115% centered
        filter_str = (
            f"scale=8000:-1,"
            f"zoompan=z='min(zoom+0.0005,1.15)':"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={total_frames}:s={width}x{height}:fps={fps}"
        )
    elif direction == "zoom_out":
        filter_str = (
            f"scale=8000:-1,"
            f"zoompan=z='if(lte(zoom,1.0),1.15,max(1.001,zoom-0.0005))':"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={total_frames}:s={width}x{height}:fps={fps}"
        )
    elif direction == "pan_left":
        filter_str = (
            f"scale=8000:-1,"
            f"zoompan=z='1.15':"
            f"x='iw/2-(iw/zoom/2)-({total_frames}-on)*2':"
            f"y='ih/2-(ih/zoom/2)':"
            f"d={total_frames}:s={width}x{height}:fps={fps}"
        )
    elif direction == "pan_right":
        filter_str = (
            f"scale=8000:-1,"
            f"zoompan=z='1.15':"
            f"x='iw/2-(iw/zoom/2)+({total_frames}-on)*2':"
            f"y='ih/2-(ih/zoom/2)':"
            f"d={total_frames}:s={width}x{height}:fps={fps}"
        )
    else:
        filter_str = (
            f"scale=8000:-1,"
            f"zoompan=z='min(zoom+0.0005,1.15)':"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={total_frames}:s={width}x{height}:fps={fps}"
        )

    cmd = [
        "ffmpeg", "-i", input_path,
        "-vf", filter_str,
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-y", output_path,
    ]
    _run_ffmpeg(cmd)
    return output_path
```

### Step 5: Create Fallback Generator
Create `backend/app/services/broll_fallback.py`:
```python
import tempfile
from pathlib import Path

import structlog

from app.services.ffmpeg import FFmpeg
from app.services.storage import StorageService

logger = structlog.get_logger()


class BRollFallback:
    """Generate fallback visuals when no suitable B-roll is found."""

    def __init__(self):
        self.storage = StorageService()

    def generate_gradient_video(
        self,
        duration: float,
        width: int,
        height: int,
        mood: str,
        project_id: str,
        scene_num: int,
    ) -> str:
        """
        Generate a gradient background video using FFmpeg.
        Color scheme based on mood.
        """
        colors = self._mood_to_colors(mood)

        with tempfile.TemporaryDirectory() as tmp_dir:
            output_path = str(Path(tmp_dir) / "gradient.mp4")

            # Create animated gradient using FFmpeg's lavfi
            cmd = [
                "ffmpeg",
                "-f", "lavfi",
                "-i", (
                    f"color=c={colors['primary']}:s={width}x{height}:d={duration},"
                    f"drawbox=x=0:y=0:w={width}:h={height}:color={colors['secondary']}@0.3:t=fill"
                ),
                "-vf", f"fade=in:0:30,fade=out:{int((duration - 1) * 30)}:30",
                "-c:v", "libx264",
                "-preset", "fast",
                "-pix_fmt", "yuv420p",
                "-t", str(duration),
                "-y", output_path,
            ]

            import subprocess
            subprocess.run(cmd, capture_output=True, timeout=60)

            remote_path = f"{project_id}/broll/scene_{scene_num:03d}_fallback.mp4"
            return self.storage.upload(output_path, remote_path, bucket="processed")

    @staticmethod
    def _mood_to_colors(mood: str) -> dict:
        """Map mood to gradient color scheme."""
        color_map = {
            "dramatic": {"primary": "0x1a0a2e", "secondary": "0x6b1d5e"},
            "upbeat": {"primary": "0xff6b35", "secondary": "0xffd700"},
            "calm": {"primary": "0x0a4d68", "secondary": "0x088395"},
            "mysterious": {"primary": "0x0d1117", "secondary": "0x1a1a2e"},
            "funny": {"primary": "0xff4081", "secondary": "0x7c4dff"},
            "tense": {"primary": "0x1a0000", "secondary": "0x8b0000"},
            "inspiring": {"primary": "0x0d47a1", "secondary": "0x42a5f5"},
            "dark": {"primary": "0x0a0a0a", "secondary": "0x1a1a1a"},
        }
        return color_map.get(mood, {"primary": "0x1a1a2e", "secondary": "0x2d2d44"})
```

### Step 6: Create B-Roll Matching Celery Task
Create `backend/app/tasks/broll_match.py`:
```python
import asyncio

import structlog

from app.schemas.broll import BRollMatchRequest
from app.services.broll_fallback import BRollFallback
from app.services.broll_matcher import BRollMatcher
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.ai.match_broll")
def match_broll_task(
    self,
    job_id: str,
    project_id: str,
    scenes: list[dict],
    target_width: int = 1080,
    target_height: int = 1920,
    min_score_threshold: float = 0.4,
):
    """
    Match B-roll footage to all script scenes.

    Returns list of B-roll GCS URLs (one per scene).
    """
    loop = asyncio.new_event_loop()

    try:
        self.update_progress(0.05, "Initializing B-roll matching...")

        request = BRollMatchRequest(
            project_id=project_id,
            scenes=scenes,
            target_width=target_width,
            target_height=target_height,
            min_score_threshold=min_score_threshold,
        )

        matcher = BRollMatcher()
        fallback = BRollFallback()
        broll_urls = []

        total = len(scenes)
        for i, scene in enumerate(scenes):
            progress = 0.05 + (i / total) * 0.9
            self.update_progress(progress, f"Matching B-roll for scene {i + 1}/{total}...")

            matches = loop.run_until_complete(
                matcher.match_scenes(
                    BRollMatchRequest(
                        project_id=project_id,
                        scenes=[scene],
                        target_width=target_width,
                        target_height=target_height,
                        min_score_threshold=min_score_threshold,
                    )
                )
            )

            match = matches[0] if matches else None

            if match and match.gcs_url:
                broll_urls.append(match.gcs_url)
            elif match and match.fallback_used:
                logger.info("broll.using_fallback", scene=i, type=match.fallback_type)
                url = fallback.generate_gradient_video(
                    duration=scene.get("duration_est", 8),
                    width=target_width,
                    height=target_height,
                    mood=scene.get("mood", "calm"),
                    project_id=project_id,
                    scene_num=scene.get("scene_number", i),
                )
                broll_urls.append(url)
            else:
                broll_urls.append(None)

        self.update_progress(1.0, "B-roll matching complete")

        return {
            "broll_urls": broll_urls,
            "total_scenes": total,
            "fallbacks_used": sum(1 for u in broll_urls if u and "fallback" in u),
        }

    except Exception as exc:
        logger.error("broll_match.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, max_retries=2)
    finally:
        loop.close()
```

### Step 7: Create B-Roll Matching API Endpoint
Add to `backend/app/api/v1/broll.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.broll import BRollMatchRequest
from app.services.broll_matcher import BRollMatcher

router = APIRouter()


@router.post("/match")
async def match_broll_to_scenes(
    request: BRollMatchRequest,
    user: User = Depends(get_current_user),
):
    """Match B-roll footage to script scenes with scoring."""
    matcher = BRollMatcher()
    matches = await matcher.match_scenes(request)

    return {
        "matches": [
            {
                "scene_number": m.scene_number,
                "score": m.candidate.total_score if m.candidate else 0,
                "thumbnail": m.candidate.thumbnail if m.candidate else None,
                "gcs_url": m.gcs_url,
                "fallback_used": m.fallback_used,
                "fallback_type": m.fallback_type,
                "scoring_breakdown": {
                    "visual_relevance": m.candidate.visual_relevance_score,
                    "duration": m.candidate.duration_score,
                    "resolution": m.candidate.resolution_score,
                    "mood": m.candidate.mood_score,
                    "aspect_ratio": m.candidate.aspect_ratio_score,
                } if m.candidate else None,
            }
            for m in matches
        ]
    }
```

## Best Practices

- **Cache Pexels results in Redis:** B-roll matching for a 10-scene script makes 30-50 Pexels API calls. Cache results by query string with a 1-hour TTL to stay within the 200 req/hr rate limit.
- **Parallel query execution:** Search multiple queries simultaneously using `asyncio.gather()` to reduce latency. Process 3-5 queries in parallel per scene.
- **Ken Burns as default for short clips:** If a B-roll video is shorter than the scene duration, loop it with a Ken Burns effect to avoid jarring repetition.
- **Diverse queries:** Instruct the LLM to generate varied queries (wide shot, close-up, abstract, action) to maximize the chances of finding a good match.
- **Pre-download validation:** Before downloading a B-roll video, verify the download URL is still valid (HEAD request). Pexels URLs can expire.
- **Score logging:** Log the full scoring breakdown for each scene's top 3 candidates. This data is invaluable for tuning weights later.
- **Fallback chain:** gradient > abstract stock > FLUX.1 generated image with Ken Burns. Each fallback level is more expensive but higher quality.

## Testing

```bash
# Test B-roll matching for a single scene
curl -X POST http://localhost:8000/api/v1/broll/match \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test-123",
    "scenes": [
      {
        "scene_number": 1,
        "narration": "The deep ocean is home to creatures that defy imagination.",
        "duration_est": 8,
        "visual_description": "Dark ocean water with bioluminescent creatures",
        "search_keywords": ["deep ocean", "bioluminescence", "deep sea creatures"],
        "mood": "mysterious"
      }
    ],
    "target_width": 1080,
    "target_height": 1920
  }'
```

### Unit Tests
```python
import pytest
from app.schemas.broll import BRollCandidate
from app.services.broll_scorer import BRollScorer


def test_duration_score_exact():
    scorer = BRollScorer()
    assert scorer._score_duration(10, 10) == 1.0


def test_duration_score_longer():
    scorer = BRollScorer()
    assert scorer._score_duration(15, 10) == 1.0


def test_duration_score_shorter():
    scorer = BRollScorer()
    assert scorer._score_duration(5, 10) == 0.5


def test_resolution_score():
    scorer = BRollScorer()
    assert scorer._score_resolution(1920, 1080) == 1.0
    assert scorer._score_resolution(1280, 720) == 0.7
    assert scorer._score_resolution(640, 480) == 0.4


def test_full_scoring():
    scorer = BRollScorer()
    candidate = BRollCandidate(
        id=1, url="", download_url="", thumbnail="",
        duration=10, width=1920, height=1080,
        query="deep ocean dark water", relevance=0.8,
    )
    scored = scorer.score_candidate(candidate, 8, "mysterious", 1080, 1920)
    assert scored.total_score > 0.5
    assert scored.visual_relevance_score == 0.8
```

## Verification Checklist
- [ ] LLM generates relevant Pexels search queries from scene data
- [ ] Pexels API returns video candidates
- [ ] Scoring weights produce sensible rankings (relevant + correct size = top)
- [ ] Duration scoring: longer videos score higher when matching scene duration
- [ ] Resolution scoring: 1080p+ scores highest
- [ ] Mood scoring: "dark" queries match "scary" mood scenes
- [ ] Aspect ratio scoring: portrait B-roll matches 9:16 targets
- [ ] Ken Burns effect applies to short/static footage
- [ ] Fallback gradient video generates when no good match found
- [ ] Downloaded B-roll is trimmed and resized correctly
- [ ] Processed B-roll uploads to GCS
- [ ] Deduplication prevents the same video in multiple scenes
- [ ] Redis caching reduces Pexels API calls
- [ ] Celery task completes within 2 minutes for a 10-scene script
