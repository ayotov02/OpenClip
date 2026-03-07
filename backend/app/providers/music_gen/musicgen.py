import logging

import httpx

from app.core.config import settings
from app.providers.base import MusicGenProvider

logger = logging.getLogger(__name__)


class LocalMusicGen(MusicGenProvider):
    """Music generation using local MusicGen service."""

    @property
    def _base_url(self) -> str:
        return settings.MUSICGEN_SERVICE_URL

    async def generate(
        self, prompt: str, duration: int = 30, mood: str | None = None
    ) -> str:
        full_prompt = prompt
        if mood:
            full_prompt = f"{mood} style: {prompt}"

        payload = {
            "prompt": full_prompt,
            "duration": duration,
            "model_size": "medium",
        }
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self._base_url}/generate", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("audio_url", data.get("url", ""))
