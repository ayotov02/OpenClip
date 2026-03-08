import json
import logging
import uuid
from datetime import datetime, timezone

from app.tasks.celery_app import celery
from app.tasks.utils import run_async

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.spy_tasks.scrape_competitor_posts", bind=True)
def scrape_competitor_posts(self, competitor_id: str, user_id: str) -> dict:
    """Scrape latest posts from a competitor and store as ScrapedPost records."""

    async def _run():
        from app.core.database import async_session
        from app.models.competitor import Competitor
        from app.providers import get_scraping_provider
        from app.services.spy_service import bulk_create_scraped_posts

        async with async_session() as db:
            from sqlalchemy import select

            result = await db.execute(
                select(Competitor).where(Competitor.id == uuid.UUID(competitor_id))
            )
            comp = result.scalar_one_or_none()
            if not comp:
                raise ValueError(f"Competitor {competitor_id} not found")

            scraper = get_scraping_provider()
            raw_posts = await scraper.scrape_posts(comp.platform, comp.handle, limit=20)

            post_dicts = []
            for raw in raw_posts:
                followers = raw.get("followers", raw.get("author_followers", 0)) or 0
                likes = raw.get("likes", raw.get("like_count", 0)) or 0
                views = raw.get("views", raw.get("view_count", 0)) or 0
                comments = raw.get("comments", raw.get("comment_count", 0)) or 0
                shares = raw.get("shares", raw.get("share_count", 0)) or 0
                er = (likes + comments + shares) / max(followers, 1)

                post_dicts.append({
                    "competitor_id": comp.id,
                    "platform": comp.platform,
                    "post_url": raw.get("url", raw.get("post_url", "")),
                    "post_type": raw.get("type", raw.get("post_type", "video")),
                    "caption": raw.get("caption", raw.get("text", "")),
                    "hashtags": raw.get("hashtags", []),
                    "mentions": raw.get("mentions", []),
                    "media_url": raw.get("media_url", raw.get("video_url", "")),
                    "thumbnail_url": raw.get("thumbnail_url", raw.get("thumbnail", "")),
                    "likes": likes,
                    "views": views,
                    "comments_count": comments,
                    "shares": shares,
                    "saves": raw.get("saves", 0) or 0,
                    "engagement_rate": round(er, 4),
                    "author_handle": comp.handle,
                    "followers_at_scrape": followers,
                    "posted_at": raw.get("posted_at", raw.get("date")),
                })

            posts = await bulk_create_scraped_posts(db, uuid.UUID(user_id), post_dicts)

            # Update competitor's last_scraped timestamp
            from sqlalchemy import update

            await db.execute(
                update(Competitor)
                .where(Competitor.id == comp.id)
                .values(last_scraped=datetime.now(timezone.utc))
            )
            await db.commit()

            return {"competitor_id": competitor_id, "posts_scraped": len(posts)}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("scrape_competitor_posts failed for %s", competitor_id)
        raise self.retry(exc=exc, countdown=60, max_retries=2) from exc


@celery.task(name="app.tasks.spy_tasks.analyze_post", bind=True)
def analyze_post(self, post_id: str, brand_context_id: str | None = None) -> dict:
    """Run AI analysis on a scraped post: hook/body/CTA scoring, transcript, sentiment."""

    async def _run():
        from app.core.database import async_session
        from app.providers import get_llm_provider
        from app.services.spy_service import get_scraped_post, update_post_analysis

        async with async_session() as db:
            post = await get_scraped_post(db, uuid.UUID(post_id))
            if not post:
                raise ValueError(f"ScrapedPost {post_id} not found")

            brand_ctx = None
            if brand_context_id:
                from app.tasks.utils import load_brand_context
                brand_ctx = await load_brand_context(brand_context_id)

            llm = get_llm_provider()

            from app.brand.prompt_builder import build_post_analysis_prompt
            system_prompt, user_prompt = build_post_analysis_prompt(
                brand_ctx=brand_ctx,
                caption=post.caption or "",
                platform=post.platform,
                post_type=post.post_type,
                engagement_rate=post.engagement_rate,
                likes=post.likes,
                views=post.views,
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            result = await llm.chat(
                messages, temperature=0.3, response_format={"type": "json_object"}
            )
            analysis = json.loads(result)

            update_data = {
                "hook_score": analysis.get("hook_score"),
                "body_score": analysis.get("body_score"),
                "cta_score": analysis.get("cta_score"),
                "extracted_hook": analysis.get("extracted_hook"),
                "extracted_cta": analysis.get("extracted_cta"),
                "content_category": analysis.get("content_category"),
                "sentiment": analysis.get("sentiment"),
                "sentiment_confidence": analysis.get("sentiment_confidence"),
                "niche_relevance": analysis.get("niche_relevance"),
                "ai_analysis": analysis,
                "analyzed_at": datetime.now(timezone.utc),
            }

            await update_post_analysis(db, uuid.UUID(post_id), update_data)
            return {"post_id": post_id, "analysis": analysis}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("analyze_post failed for %s", post_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.spy_tasks.generate_similar_script", bind=True)
def generate_similar_script(self, post_id: str, brand_context_id: str) -> dict:
    """Generate a brand-voice script inspired by a scraped post."""

    async def _run():
        from app.core.database import async_session
        from app.providers import get_llm_provider
        from app.services.spy_service import get_scraped_post
        from app.tasks.utils import load_brand_context

        async with async_session() as db:
            post = await get_scraped_post(db, uuid.UUID(post_id))
            if not post:
                raise ValueError(f"ScrapedPost {post_id} not found")

        brand_ctx = await load_brand_context(brand_context_id)
        llm = get_llm_provider()

        from app.brand.prompt_builder import build_similar_script_prompt
        system_prompt, user_prompt = build_similar_script_prompt(
            brand_ctx=brand_ctx,
            original_caption=post.caption or "",
            platform=post.platform,
            extracted_hook=post.extracted_hook or "",
            extracted_cta=post.extracted_cta or "",
            content_category=post.content_category or "",
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        result = await llm.chat(
            messages, temperature=0.7, response_format={"type": "json_object"}
        )
        script = json.loads(result)
        return {"post_id": post_id, "script": script}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("generate_similar_script failed for %s", post_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc
