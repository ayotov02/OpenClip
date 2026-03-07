import logging
import uuid

import httpx

from app.core.config import settings
from app.tasks.celery_app import celery
from app.tasks.utils import load_brand_context, run_async, update_job_status

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.faceless_tasks.orchestrate_pipeline", bind=True)
def orchestrate_pipeline(self, project_id: str) -> dict:
    """End-to-end faceless video generation pipeline.

    Steps:
    1. Load project + brand context from DB
    2. Generate script via LLM
    3. Generate TTS for each scene
    4. Generate B-roll queries + fetch B-roll
    5. Generate background music
    6. Assemble via Remotion (Phase 2)
    7. Export final video
    """

    async def _run():
        from sqlalchemy import select

        from app.core.database import async_session
        from app.models.faceless import FacelessProject
        from app.providers import get_llm_provider, get_music_gen_provider, get_tts_provider

        async with async_session() as db:
            result = await db.execute(
                select(FacelessProject).where(
                    FacelessProject.id == uuid.UUID(project_id)
                )
            )
            project = result.scalar_one_or_none()
            if not project:
                raise ValueError(f"FacelessProject {project_id} not found")

            # Load user's active brand context
            from app.brand.context import get_active_brand_context

            brand_ctx = await get_active_brand_context(db, project.user_id)

        # Step 1: Generate script
        llm = get_llm_provider()
        script = await llm.generate_script(
            project.topic or "default topic",
            project.template or "educational",
            brand_ctx,
        )
        scenes = script.get("scenes", [])

        # Step 2: Generate TTS for each scene
        tts = get_tts_provider()
        tts_results = []
        for scene in scenes:
            narration = scene.get("narration", "")
            if narration:
                audio_bytes = await tts.synthesize(narration, "default")
                tts_results.append({"narration": narration, "audio_size": len(audio_bytes)})

        # Step 3: Generate B-roll queries
        broll_queries = []
        for scene in scenes:
            visual = scene.get("visual_description", "")
            if visual:
                queries = await llm.generate_broll_queries(visual, brand_ctx)
                broll_queries.extend(queries)

        # Step 4: Fetch B-roll from Pexels
        broll_results = []
        if settings.PEXELS_API_KEY:
            for query in broll_queries[:10]:
                try:
                    async with httpx.AsyncClient(timeout=15) as client:
                        resp = await client.get(
                            "https://api.pexels.com/videos/search",
                            params={"query": query, "per_page": 3},
                            headers={"Authorization": settings.PEXELS_API_KEY},
                        )
                        if resp.status_code == 200:
                            broll_results.extend(resp.json().get("videos", []))
                except httpx.HTTPError:
                    continue

        # Step 5: Generate background music
        music_gen = get_music_gen_provider()
        music_url = await music_gen.generate(
            f"Background music for a {project.template or 'educational'} video",
            duration=script.get("total_duration_seconds", 60),
            mood=project.music_mood,
        )

        return {
            "project_id": project_id,
            "status": "assembly_pending",
            "script": script,
            "tts_count": len(tts_results),
            "broll_count": len(broll_results),
            "music_url": music_url,
        }

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("orchestrate_pipeline failed for project %s", project_id)
        raise self.retry(exc=exc, countdown=60, max_retries=1) from exc


@celery.task(name="app.tasks.faceless_tasks.generate_music", bind=True)
def generate_music(self, mood: str, duration: int = 30) -> dict:
    """Generate background music using MusicGen provider."""

    async def _run():
        from app.providers import get_music_gen_provider

        music_gen = get_music_gen_provider()
        url = await music_gen.generate(
            f"{mood} background music", duration=duration, mood=mood
        )
        return {"audio_path": url}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("generate_music failed")
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.faceless_tasks.fetch_broll", bind=True)
def fetch_broll(self, queries: list[str], per_query: int = 3) -> dict:
    """Fetch B-roll footage from Pexels API."""

    async def _run():
        if not settings.PEXELS_API_KEY:
            logger.warning("PEXELS_API_KEY not set, skipping B-roll fetch")
            return {"results": []}

        results = []
        async with httpx.AsyncClient(timeout=15) as client:
            for query in queries:
                try:
                    resp = await client.get(
                        "https://api.pexels.com/videos/search",
                        params={"query": query, "per_page": per_query},
                        headers={"Authorization": settings.PEXELS_API_KEY},
                    )
                    if resp.status_code == 200:
                        for video in resp.json().get("videos", []):
                            files = video.get("video_files", [])
                            hd = next(
                                (f for f in files if f.get("quality") == "hd"), None
                            )
                            if hd:
                                results.append({
                                    "query": query,
                                    "url": hd["link"],
                                    "width": hd.get("width"),
                                    "height": hd.get("height"),
                                    "duration": video.get("duration"),
                                })
                except httpx.HTTPError:
                    continue
        return {"results": results}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("fetch_broll failed")
        raise self.retry(exc=exc, countdown=15, max_retries=2) from exc
