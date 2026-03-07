import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

KIEAI_BASE_URL = "https://api.kie.ai/api/v1"
KIEAI_TASK_POLL_INTERVAL = 3  # seconds
KIEAI_TASK_MAX_POLLS = 200  # ~10 minutes max


class KieAIBase:
    """Shared base for all Kie.ai-powered providers."""

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.KIEAI_API_KEY}",
            "Content-Type": "application/json",
        }

    async def _create_task(self, payload: dict) -> str:
        """Submit a task to Kie.ai and return the taskId."""
        url = payload.pop("_url", f"{KIEAI_BASE_URL}/jobs/createTask")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 200:
                raise RuntimeError(f"Kie.ai error: {data.get('msg', 'unknown')}")
            return data["data"]["taskId"]

    async def _poll_task(self, task_id: str) -> dict:
        """Poll a Kie.ai task until completion or failure."""
        url = f"{KIEAI_BASE_URL}/jobs/recordInfo"
        async with httpx.AsyncClient(timeout=30) as client:
            for _ in range(KIEAI_TASK_MAX_POLLS):
                resp = await client.get(
                    url, params={"taskId": task_id}, headers=self._headers()
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get("code") != 200:
                    raise RuntimeError(f"Kie.ai poll error: {data.get('msg')}")

                state = data["data"].get("state", "")
                if state == "success":
                    return data["data"]
                if state == "fail":
                    raise RuntimeError(
                        f"Kie.ai task failed: {data['data'].get('failMsg', 'unknown')}"
                    )

                await asyncio.sleep(KIEAI_TASK_POLL_INTERVAL)

        raise TimeoutError(f"Kie.ai task {task_id} timed out after polling")

    async def _create_and_poll(self, payload: dict) -> dict:
        """Create a task and poll until complete. Returns result data."""
        task_id = await self._create_task(payload)
        logger.info("Kie.ai task created: %s", task_id)
        return await self._poll_task(task_id)

    def _extract_result_urls(self, result_data: dict) -> list[str]:
        """Extract result URLs from Kie.ai result data."""
        import json

        raw = result_data.get("resultJson", "{}")
        if isinstance(raw, str):
            raw = json.loads(raw)
        urls = raw.get("resultUrls", [])
        if not urls and "resultObject" in raw:
            obj = raw["resultObject"]
            if isinstance(obj, dict):
                for key in ("url", "video_url", "audio_url", "image_url"):
                    if key in obj:
                        urls.append(obj[key])
        return urls
