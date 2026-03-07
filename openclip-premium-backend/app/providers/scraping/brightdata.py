import logging
from urllib.parse import quote_plus

import httpx

from app.core.config import settings
from app.providers.base import ScrapingProvider

logger = logging.getLogger(__name__)

BRIGHTDATA_API_URL = "https://api.brightdata.com/request"

PLATFORM_SEARCH_URLS = {
    "youtube": "https://www.youtube.com/results?search_query=",
    "tiktok": "https://www.tiktok.com/search?q=",
    "instagram": "https://www.instagram.com/explore/tags/",
    "twitter": "https://twitter.com/search?q=",
}

PLATFORM_PROFILE_URLS = {
    "youtube": "https://www.youtube.com/@{handle}",
    "tiktok": "https://www.tiktok.com/@{handle}",
    "instagram": "https://www.instagram.com/{handle}/",
    "twitter": "https://twitter.com/{handle}",
}


class BrightDataScraping(ScrapingProvider):
    """Web scraping via Bright Data SERP API + Web Unlocker."""

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.BRIGHTDATA_API_KEY}",
            "Content-Type": "application/json",
        }

    async def scrape_profile(self, platform: str, handle: str) -> dict:
        url_template = PLATFORM_PROFILE_URLS.get(platform)
        if not url_template:
            raise ValueError(f"Unsupported platform: {platform}")

        target_url = url_template.format(handle=handle)
        payload = {
            "zone": settings.BRIGHTDATA_UNLOCKER_ZONE,
            "url": target_url,
            "format": "json",
        }

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                BRIGHTDATA_API_URL, json=payload, headers=self._headers()
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
            "zone": settings.BRIGHTDATA_BROWSER_ZONE,
            "url": target_url,
            "format": "json",
        }

        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                BRIGHTDATA_API_URL, json=payload, headers=self._headers()
            )
            resp.raise_for_status()
            data = resp.json()

        # Normalize to list of post dicts
        if isinstance(data, list):
            return data[:limit]
        if isinstance(data, dict):
            posts = data.get("posts", data.get("results", []))
            return posts[:limit]
        return []

    async def search_web(self, query: str, limit: int = 10) -> list[dict]:
        search_url = f"https://www.google.com/search?q={quote_plus(query)}"
        payload = {
            "zone": settings.BRIGHTDATA_SERP_ZONE,
            "url": search_url,
            "format": "json",
            "data_format": "parsed_light",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                BRIGHTDATA_API_URL, json=payload, headers=self._headers()
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("organic", [])
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", r.get("link", "")),
                "snippet": r.get("description", r.get("snippet", "")),
            }
            for r in results[:limit]
        ]
