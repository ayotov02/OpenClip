import json
import logging

from app.providers.base import MusicGenProvider
from app.providers.kieai_base import KIEAI_BASE_URL, KieAIBase

logger = logging.getLogger(__name__)


class KieAIMusicGen(KieAIBase, MusicGenProvider):
    """Music generation via Suno on Kie.ai."""

    async def generate(
        self, prompt: str, duration: int = 30, mood: str | None = None
    ) -> str:
        import httpx

        url = f"{KIEAI_BASE_URL}/generate"
        payload: dict = {
            "prompt": prompt,
            "customMode": bool(mood),
            "instrumental": False,
            "model": "V4_5",
        }
        if mood:
            payload["style"] = mood
            payload["title"] = prompt[:80]

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 200:
                raise RuntimeError(f"Suno error: {data.get('msg')}")
            task_id = data["data"]["taskId"]

        result = await self._poll_task(task_id)
        raw = result.get("resultJson", "{}")
        if isinstance(raw, str):
            raw = json.loads(raw)

        # Suno returns an array of tracks
        tracks = raw.get("data", raw.get("resultObject", []))
        if isinstance(tracks, list) and tracks:
            return tracks[0].get("audio_url", "")
        if isinstance(tracks, dict):
            return tracks.get("audio_url", "")

        urls = self._extract_result_urls(result)
        if urls:
            return urls[0]
        raise RuntimeError("No audio URL in music generation result")
