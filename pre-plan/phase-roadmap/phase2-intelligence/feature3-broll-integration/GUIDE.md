# B-Roll Integration — Implementation Guide

## Overview
- **What:** Integrate the Pexels API for stock footage, use the LLM to generate search queries from scripts/narration, score and rank results by relevance, and insert B-roll into the video timeline.
- **Why:** B-roll transforms talking-head videos into professional content. Automated B-roll selection saves hours of manual searching.
- **Dependencies:** Phase 1 Feature 6 (LLM Integration), Phase 1 Feature 4 (Video Processing)

## Architecture

### B-Roll Pipeline
```
Script/Narration → LLM (extract keywords, generate Pexels queries)
  → Pexels API (search videos by query, orientation, size)
  → Scoring (relevance, quality, duration match, color consistency)
  → Selection (top N per scene)
  → Timeline insertion (crossfade transitions)
  → Ken Burns effect on slow/static footage
```

## GCP Deployment
- No additional GCP service — uses existing LLM service + Pexels API (external, free)
- Runs as part of Celery worker tasks

## Step-by-Step Implementation

### Step 1: Create Pexels Client
Create `backend/app/services/pexels.py`:
```python
import httpx
import structlog
from app.core.config import settings

logger = structlog.get_logger()

PEXELS_BASE = "https://api.pexels.com"


class PexelsClient:
    def __init__(self):
        self.api_key = settings.PEXELS_API_KEY
        self.headers = {"Authorization": self.api_key}

    async def search_videos(
        self,
        query: str,
        orientation: str = "landscape",
        size: str = "medium",
        per_page: int = 10,
    ) -> list[dict]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{PEXELS_BASE}/videos/search",
                params={"query": query, "orientation": orientation, "size": size, "per_page": per_page},
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                {
                    "id": v["id"],
                    "url": v["url"],
                    "duration": v["duration"],
                    "width": v["width"],
                    "height": v["height"],
                    "download_url": self._best_file(v["video_files"], size),
                    "thumbnail": v["image"],
                }
                for v in data.get("videos", [])
            ]

    def _best_file(self, files, size):
        preferred_heights = {"small": 480, "medium": 720, "large": 1080}
        target = preferred_heights.get(size, 720)
        sorted_files = sorted(files, key=lambda f: abs((f.get("height") or 0) - target))
        return sorted_files[0]["link"] if sorted_files else None
```

### Step 2: Create B-Roll Service
Create `backend/app/services/broll_service.py`:
```python
from app.ai.llm_client import LLMClient
from app.ai.prompts import BROLL_QUERY_SYSTEM, BROLL_QUERY_USER
from app.services.pexels import PexelsClient


class BRollService:
    def __init__(self):
        self.llm = LLMClient()
        self.pexels = PexelsClient()

    async def find_broll(self, narration: str, mood: str = "neutral", orientation: str = "landscape") -> list[dict]:
        # Generate search queries via LLM
        queries_result = await self.llm.generate_json(
            prompt=BROLL_QUERY_USER.format(narration=narration, mood=mood),
            system=BROLL_QUERY_SYSTEM,
        )
        queries = queries_result.get("queries", [])

        # Search Pexels for each query
        all_results = []
        for q in queries[:5]:
            videos = await self.pexels.search_videos(
                query=q["query"],
                orientation=q.get("orientation", orientation),
                per_page=5,
            )
            for v in videos:
                v["relevance"] = q.get("relevance", 0.5)
                v["query"] = q["query"]
            all_results.extend(videos)

        # Deduplicate and score
        seen = set()
        unique = []
        for v in all_results:
            if v["id"] not in seen:
                seen.add(v["id"])
                v["score"] = self._score(v)
                unique.append(v)

        return sorted(unique, key=lambda x: x["score"], reverse=True)

    def _score(self, video: dict) -> float:
        score = video.get("relevance", 0.5) * 0.6
        if 5 <= video.get("duration", 0) <= 30:
            score += 0.2
        if video.get("height", 0) >= 720:
            score += 0.2
        return round(score, 3)
```

### Step 3: Create B-Roll Celery Task and API Endpoint
Create task in `backend/app/tasks/broll.py` and endpoint in `backend/app/api/v1/broll.py`:
```python
# API endpoint
@router.post("/")
async def generate_broll(narration: str, mood: str = "neutral", user=Depends(get_current_user)):
    service = BRollService()
    results = await service.find_broll(narration, mood)
    return {"broll": results[:10]}
```

## Best Practices
- **Cache Pexels results in Redis (1 hour TTL):** Avoid burning through the 200 req/hr rate limit.
- **LLM generates 3-5 queries per scene:** More queries = better variety, but costs more in API calls.
- **Ken Burns effect:** Apply subtle zoom/pan on static or slow footage to add visual energy.
- **Pexels API is free:** No attribution required (CC0 license). Rate limit: 200 req/hr, 20K/mo.

## Testing
- Generate B-roll queries for sample narration
- Verify Pexels returns relevant results
- Verify scoring ranks better results higher
- Test with different moods (dramatic, calm, funny)

## Verification Checklist
- [ ] LLM generates relevant Pexels search queries
- [ ] Pexels API returns video results
- [ ] Scoring ranks results by relevance + quality
- [ ] Deduplication removes duplicate videos
- [ ] Ken Burns effect applies to static footage
- [ ] Redis caching reduces API calls
- [ ] Handles Pexels API rate limiting gracefully
