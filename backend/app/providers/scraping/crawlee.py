import logging
from urllib.parse import quote_plus

import httpx

from app.providers.base import ScrapingProvider

logger = logging.getLogger(__name__)

# Crawlee/Playwright scraper served as a local microservice
CRAWLEE_SERVICE_URL = "http://localhost:8008"

PLATFORM_PROFILE_URLS = {
    "youtube": "https://www.youtube.com/@{handle}",
    "tiktok": "https://www.tiktok.com/@{handle}",
    "instagram": "https://www.instagram.com/{handle}/",
    "twitter": "https://twitter.com/{handle}",
}


class CrawleeScraping(ScrapingProvider):
    """Web scraping using local Crawlee/Playwright service."""

    async def scrape_profile(self, platform: str, handle: str) -> dict:
        url_template = PLATFORM_PROFILE_URLS.get(platform)
        if not url_template:
            raise ValueError(f"Unsupported platform: {platform}")

        target_url = url_template.format(handle=handle)
        payload = {
            "url": target_url,
            "extract": "profile",
            "platform": platform,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{CRAWLEE_SERVICE_URL}/scrape", json=payload
            )
            resp.raise_for_status()
            return resp.json()

    async def scrape_posts(
        self, platform: str, handle: str, limit: int = 20
    ) -> list[dict]:
        url_template = PLATFORM_PROFILE_URLS.get(platform)
        if not url_template:
            raise ValueError(f"Unsupported platform: {platform}")

        target_url = url_template.format(handle=handle)
        payload = {
            "url": target_url,
            "extract": "posts",
            "platform": platform,
            "limit": limit,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{CRAWLEE_SERVICE_URL}/scrape", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        if isinstance(data, list):
            return data[:limit]
        return data.get("posts", [])[:limit]

    async def search_web(self, query: str, limit: int = 10) -> list[dict]:
        search_url = f"https://www.google.com/search?q={quote_plus(query)}"
        payload = {
            "url": search_url,
            "extract": "search_results",
            "limit": limit,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{CRAWLEE_SERVICE_URL}/scrape", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", data) if isinstance(data, dict) else data
        if not isinstance(results, list):
            return []
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", r.get("link", "")),
                "snippet": r.get("snippet", r.get("description", "")),
            }
            for r in results[:limit]
        ]
