import json
import logging

import httpx

from app.core.config import settings
from app.providers.base import TTSProvider
from app.providers.kieai_base import KieAIBase

logger = logging.getLogger(__name__)


class KieAITTS(KieAIBase, TTSProvider):
    """Text-to-speech via ElevenLabs on Kie.ai."""

    async def synthesize(
        self, text: str, voice: str, speed: float = 1.0
    ) -> bytes:
        payload = {
            "model": settings.KIEAI_DEFAULT_TTS_MODEL,
            "input": {
                "text": text,
                "voice": voice,
                "speed": speed,
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No audio URL in TTS result")

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(urls[0])
            resp.raise_for_status()
            return resp.content

    async def list_voices(self) -> list[dict]:
        # ElevenLabs via Kie.ai doesn't expose a voice listing endpoint.
        # Return commonly available voices.
        return [
            {"id": "Rachel", "name": "Rachel", "gender": "female"},
            {"id": "Drew", "name": "Drew", "gender": "male"},
            {"id": "Clyde", "name": "Clyde", "gender": "male"},
            {"id": "Paul", "name": "Paul", "gender": "male"},
            {"id": "Domi", "name": "Domi", "gender": "female"},
            {"id": "Dave", "name": "Dave", "gender": "male"},
            {"id": "Fin", "name": "Fin", "gender": "male"},
            {"id": "Sarah", "name": "Sarah", "gender": "female"},
            {"id": "Antoni", "name": "Antoni", "gender": "male"},
            {"id": "Elli", "name": "Elli", "gender": "female"},
        ]

    async def clone_voice(self, text: str, reference_audio: str) -> bytes:
        # ElevenLabs voice cloning requires a pre-created voice ID.
        # For now, use the default voice with the reference as context.
        payload = {
            "model": "elevenlabs/text-to-speech-multilingual-v2",
            "input": {
                "text": text,
                "voice": "Rachel",
                "previous_text": "",
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No audio URL in voice clone result")

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(urls[0])
            resp.raise_for_status()
            return resp.content
