import logging

import httpx

from app.core.config import settings
from app.providers.base import TTSProvider

logger = logging.getLogger(__name__)


class KokoroTTS(TTSProvider):
    """Text-to-speech using local Kokoro/Chatterbox TTS service."""

    @property
    def _base_url(self) -> str:
        return settings.TTS_SERVICE_URL

    async def synthesize(
        self, text: str, voice: str, speed: float = 1.0
    ) -> bytes:
        payload = {
            "text": text,
            "voice": voice,
            "speed": speed,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self._base_url}/synthesize", json=payload
            )
            resp.raise_for_status()
            return resp.content

    async def list_voices(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self._base_url}/voices")
            resp.raise_for_status()
            return resp.json()

    async def clone_voice(self, text: str, reference_audio: str) -> bytes:
        payload = {
            "text": text,
            "reference_audio": reference_audio,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self._base_url}/clone", json=payload
            )
            resp.raise_for_status()
            return resp.content
