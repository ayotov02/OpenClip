import json
import logging
import uuid

from app.tasks.celery_app import celery
from app.tasks.utils import load_brand_context, run_async

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.scrape_tasks.scrape_profile", bind=True)
def scrape_profile(self, competitor_id: str, platform: str, handle: str) -> dict:
    """Scrape competitor profile using scraping provider."""

    async def _run():
        from app.providers import get_scraping_provider

        scraper = get_scraping_provider()
        profile = await scraper.scrape_profile(platform, handle)

        # Persist to database
        from sqlalchemy import update

        from app.core.database import async_session
        from app.models.competitor import Competitor

        async with async_session() as db:
            await db.execute(
                update(Competitor)
                .where(Competitor.id == uuid.UUID(competitor_id))
                .values(profile_data=profile)
            )
            await db.commit()

        return {"competitor_id": competitor_id, "profile": profile}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("scrape_profile failed for competitor %s", competitor_id)
        raise self.retry(exc=exc, countdown=60, max_retries=2) from exc


@celery.task(name="app.tasks.scrape_tasks.scrape_posts", bind=True)
def scrape_posts(self, competitor_id: str, platform: str, handle: str, limit: int = 20) -> dict:
    """Scrape competitor posts using scraping provider."""

    async def _run():
        from app.providers import get_scraping_provider

        scraper = get_scraping_provider()
        posts = await scraper.scrape_posts(platform, handle, limit=limit)
        return {"competitor_id": competitor_id, "posts": posts}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("scrape_posts failed for competitor %s", competitor_id)
        raise self.retry(exc=exc, countdown=60, max_retries=2) from exc


@celery.task(name="app.tasks.scrape_tasks.analyze_trends", bind=True)
def analyze_trends(self, user_id: str, query: str) -> dict:
    """Analyze trending topics using scraping + LLM providers."""

    async def _run():
        from app.providers import get_llm_provider, get_scraping_provider

        scraper = get_scraping_provider()
        search_results = await scraper.search_web(query, limit=15)

        snippets = "\n".join(
            f"- {r.get('title', '')}: {r.get('snippet', '')}"
            for r in search_results
        )

        llm = get_llm_provider()
        messages = [
            {
                "role": "system",
                "content": "You are a trend analyst. Analyze search results and identify trending topics.",
            },
            {
                "role": "user",
                "content": (
                    f"Analyze these search results for trending topics related to: {query}\n\n"
                    f"{snippets}\n\n"
                    'Return JSON: {"trends": [{"topic": str, "description": str, '
                    '"relevance_score": float, "sentiment": str}]}'
                ),
            },
        ]
        result = await llm.chat(
            messages, temperature=0.3, response_format={"type": "json_object"}
        )
        trends = json.loads(result).get("trends", [])
        return {"trends": trends}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("analyze_trends failed for user %s", user_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc
