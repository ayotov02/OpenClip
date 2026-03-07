import json
import logging

from app.providers.base import STTProvider
from app.providers.kieai_base import KieAIBase

logger = logging.getLogger(__name__)


class KieAISTT(KieAIBase, STTProvider):
    """Speech-to-text via ElevenLabs on Kie.ai."""

    async def transcribe(
        self, audio_path: str, language: str = "en", diarize: bool = True
    ) -> dict:
        payload = {
            "model": "elevenlabs/speech-to-text",
            "input": {
                "audio_url": audio_path,
                "language_code": language,
                "diarize": diarize,
                "tag_audio_events": True,
            },
        }
        result = await self._create_and_poll(payload)
        raw = result.get("resultJson", "{}")
        if isinstance(raw, str):
            raw = json.loads(raw)

        result_obj = raw.get("resultObject", raw)
        return {
            "text": result_obj.get("text", ""),
            "segments": result_obj.get("words", []),
            "language": language,
        }

    async def align(self, audio_path: str, transcript: str) -> list[dict]:
        # ElevenLabs STT doesn't have a separate align endpoint.
        # Re-transcribe with timestamps and return word-level alignment.
        result = await self.transcribe(audio_path, diarize=False)
        return result.get("segments", [])
