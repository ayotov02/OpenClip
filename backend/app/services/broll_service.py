"""B-roll search, scoring, and matching service."""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def search_broll(
    query: str, per_page: int = 5, orientation: str | None = None
) -> list[dict[str, Any]]:
    """Search Pexels API for B-roll footage matching a query."""
    if not settings.PEXELS_API_KEY:
        logger.warning("PEXELS_API_KEY not set, skipping B-roll search")
        return []

    params: dict[str, Any] = {"query": query, "per_page": per_page}
    if orientation:
        params["orientation"] = orientation

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://api.pexels.com/videos/search",
            params=params,
            headers={"Authorization": settings.PEXELS_API_KEY},
        )
        if resp.status_code != 200:
            logger.warning("Pexels API returned %d for query: %s", resp.status_code, query)
            return []

        videos = resp.json().get("videos", [])
        return [_parse_pexels_video(v, query) for v in videos]


def _parse_pexels_video(video: dict, query: str) -> dict[str, Any]:
    """Extract relevant fields from a Pexels video result."""
    files = video.get("video_files", [])
    hd = next((f for f in files if f.get("quality") == "hd"), None)
    sd = next((f for f in files if f.get("quality") == "sd"), None)
    best = hd or sd or (files[0] if files else {})

    return {
        "pexels_id": video.get("id"),
        "query": query,
        "url": best.get("link", ""),
        "width": best.get("width", 0),
        "height": best.get("height", 0),
        "duration": video.get("duration", 0),
        "thumbnail": video.get("image", ""),
    }


def score_candidates(
    candidates: list[dict],
    target_duration: float,
    mood: str | None = None,
) -> list[dict]:
    """Score and rank B-roll candidates for a scene.

    Scoring criteria:
    - duration_fit: How well the clip duration matches the target (0-40 pts)
    - resolution: HD gets higher score (0-30 pts)
    - aspect_ratio: Vertical (9:16) preferred for shorts (0-20 pts)
    - relevance: Based on query match (baseline 10 pts)
    """
    scored = []
    for candidate in candidates:
        score = 10  # baseline relevance from search match

        # Duration fit (0-40): closer to target = higher
        clip_dur = candidate.get("duration", 0)
        if target_duration > 0 and clip_dur > 0:
            ratio = min(clip_dur, target_duration) / max(clip_dur, target_duration)
            score += int(ratio * 40)

        # Resolution (0-30): HD = 30, SD = 15
        width = candidate.get("width", 0)
        if width >= 1920:
            score += 30
        elif width >= 1280:
            score += 20
        elif width >= 720:
            score += 15

        # Aspect ratio (0-20): vertical preferred for shorts
        height = candidate.get("height", 0)
        if height > 0 and width > 0:
            ratio = height / width
            if ratio > 1.5:  # vertical
                score += 20
            elif ratio > 0.9:  # square-ish
                score += 10

        candidate["score"] = min(score, 100)
        scored.append(candidate)

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored


async def find_best_broll(
    queries: list[str],
    target_duration: float = 5.0,
    max_results: int = 3,
) -> list[dict]:
    """Search, score, and return the best B-roll clips for given queries."""
    all_candidates = []
    for query in queries:
        try:
            results = await search_broll(query, per_page=5)
            all_candidates.extend(results)
        except httpx.HTTPError:
            continue

    scored = score_candidates(all_candidates, target_duration)
    return scored[:max_results]
