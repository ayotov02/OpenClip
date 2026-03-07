import logging

import httpx

from app.core.config import settings
from app.providers.base import STTProvider

logger = logging.getLogger(__name__)


class WhisperXSTT(STTProvider):
    """Speech-to-text using local WhisperX service."""

    @property
    def _base_url(self) -> str:
        return settings.WHISPER_SERVICE_URL

    async def transcribe(
        self, audio_path: str, language: str = "en", diarize: bool = True
    ) -> dict:
        payload = {
            "audio_path": audio_path,
            "language": language,
            "diarize": diarize,
            "word_timestamps": True,
        }
        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                f"{self._base_url}/transcribe", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return {
            "text": data.get("text", ""),
            "segments": data.get("segments", []),
            "language": data.get("language", language),
            "word_segments": data.get("word_segments", []),
        }

    async def align(self, audio_path: str, transcript: str) -> list[dict]:
        payload = {
            "audio_path": audio_path,
            "transcript": transcript,
        }
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self._base_url}/align", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("word_segments", data.get("segments", []))
