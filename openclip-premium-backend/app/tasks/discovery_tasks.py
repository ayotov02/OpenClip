import json
import logging
import uuid
from datetime import datetime, timezone

from app.tasks.celery_app import celery
from app.tasks.utils import run_async

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.discovery_tasks.discover_niche", bind=True)
def discover_niche(
    self,
    user_id: str,
    query: str,
    platforms: list[str] | None = None,
) -> dict:
    """Search all platforms for content matching a niche query and store results."""

    async def _run():
        from app.core.database import async_session
        from app.providers import get_scraping_provider
        from app.services.discovery_service import bulk_create_discovery_results

        scraper = get_scraping_provider()
        target_platforms = platforms or ["youtube", "tiktok", "instagram", "reddit", "twitter"]

        all_results = []
        for platform in target_platforms:
            search_query = f"{query} site:{_platform_domain(platform)}"
            try:
                raw_results = await scraper.search_web(search_query, limit=10)
                for raw in raw_results:
                    url = raw.get("url", "")
                    if not url:
                        continue
                    all_results.append({
                        "query": query,
                        "platform": platform,
                        "post_url": url,
                        "post_type": _infer_post_type(url, platform),
                        "title": raw.get("title", ""),
                        "description": raw.get("snippet", ""),
                        "caption": raw.get("snippet", ""),
                        "author_handle": _extract_handle(url, platform),
                    })
            except Exception:
                logger.warning("Discovery search failed for %s on %s", query, platform)
                continue

        async with async_session() as db:
            results = await bulk_create_discovery_results(
                db, uuid.UUID(user_id), all_results
            )
            return {"query": query, "results_count": len(results)}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("discover_niche failed for user %s", user_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.discovery_tasks.analyze_discovery", bind=True)
def analyze_discovery(self, result_id: str, brand_context_id: str | None = None) -> dict:
    """Run AI analysis on a discovery result (same as spy feed analysis)."""

    async def _run():
        from app.core.database import async_session
        from app.providers import get_llm_provider
        from app.services.discovery_service import (
            get_discovery_result,
            update_discovery_analysis,
        )

        async with async_session() as db:
            result_obj = await get_discovery_result(db, uuid.UUID(result_id))
            if not result_obj:
                raise ValueError(f"DiscoveryResult {result_id} not found")

            brand_ctx = None
            if brand_context_id:
                from app.tasks.utils import load_brand_context
                brand_ctx = await load_brand_context(brand_context_id)

            llm = get_llm_provider()

            from app.brand.prompt_builder import build_post_analysis_prompt
            system_prompt, user_prompt = build_post_analysis_prompt(
                brand_ctx=brand_ctx,
                caption=result_obj.caption or result_obj.description or "",
                platform=result_obj.platform,
                post_type=result_obj.post_type,
                engagement_rate=result_obj.engagement_rate,
                likes=result_obj.likes,
                views=result_obj.views,
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            raw = await llm.chat(
                messages, temperature=0.3, response_format={"type": "json_object"}
            )
            analysis = json.loads(raw)

            update_data = {
                "hook_score": analysis.get("hook_score"),
                "body_score": analysis.get("body_score"),
                "cta_score": analysis.get("cta_score"),
                "extracted_hook": analysis.get("extracted_hook"),
                "extracted_cta": analysis.get("extracted_cta"),
                "content_category": analysis.get("content_category"),
                "sentiment": analysis.get("sentiment"),
                "niche_relevance": analysis.get("niche_relevance"),
                "ai_analysis": analysis,
                "analyzed_at": datetime.now(timezone.utc),
            }

            await update_discovery_analysis(db, uuid.UUID(result_id), update_data)
            return {"result_id": result_id, "analysis": analysis}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("analyze_discovery failed for %s", result_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


def _platform_domain(platform: str) -> str:
    return {
        "youtube": "youtube.com",
        "tiktok": "tiktok.com",
        "instagram": "instagram.com",
        "reddit": "reddit.com",
        "twitter": "x.com",
    }.get(platform, f"{platform}.com")


def _infer_post_type(url: str, platform: str) -> str:
    if platform in ("youtube", "tiktok"):
        return "video"
    if platform == "reddit":
        return "text"
    if "/reel" in url or "/p/" in url:
        return "video" if "/reel" in url else "image"
    return "video"


def _extract_handle(url: str, platform: str) -> str:
    try:
        if platform == "youtube" and "/@" in url:
            return url.split("/@")[1].split("/")[0]
        if platform == "tiktok" and "/@" in url:
            return url.split("/@")[1].split("/")[0]
        if platform == "instagram" and "instagram.com/" in url:
            parts = url.split("instagram.com/")[1].split("/")
            if parts[0] not in ("p", "reel", "explore"):
                return parts[0]
        if platform == "reddit" and "/r/" in url:
            return url.split("/r/")[1].split("/")[0]
        if platform == "twitter" and "x.com/" in url:
            return url.split("x.com/")[1].split("/")[0]
    except (IndexError, AttributeError):
        pass
    return ""
