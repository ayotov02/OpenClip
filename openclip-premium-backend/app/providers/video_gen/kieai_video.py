import logging

from app.core.config import settings
from app.providers.base import VideoGenProvider
from app.providers.kieai_base import KIEAI_BASE_URL, KieAIBase

logger = logging.getLogger(__name__)


class KieAIVideoGen(KieAIBase, VideoGenProvider):
    """Video generation via Runway / Veo3 / Kling on Kie.ai."""

    async def text_to_video(
        self, prompt: str, duration: int = 5, model: str | None = None
    ) -> str:
        model_id = model or settings.KIEAI_DEFAULT_VIDEO_MODEL

        # Runway uses a different endpoint pattern
        if "runway" in model_id:
            return await self._runway_generate(prompt, duration)

        # Market models use createTask
        payload = {
            "model": model_id,
            "input": {
                "prompt": prompt,
                "duration": duration,
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No video URL in generation result")
        return urls[0]

    async def image_to_video(
        self, image_url: str, prompt: str, model: str | None = None
    ) -> str:
        model_id = model or settings.KIEAI_DEFAULT_VIDEO_MODEL

        if "runway" in model_id:
            return await self._runway_generate(prompt, image_url=image_url)

        payload = {
            "model": model_id,
            "input": {
                "prompt": prompt,
                "image_url": image_url,
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No video URL in i2v result")
        return urls[0]

    async def _runway_generate(
        self,
        prompt: str,
        duration: int = 5,
        image_url: str | None = None,
    ) -> str:
        """Generate video via Runway-specific endpoint."""
        import httpx

        url = f"{KIEAI_BASE_URL}/runway/generate"
        payload: dict = {
            "prompt": prompt,
            "duration": duration,
            "quality": "720p",
            "waterMark": "",
        }
        if image_url:
            payload["imageUrl"] = image_url
        else:
            payload["aspectRatio"] = "16:9"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 200:
                raise RuntimeError(f"Runway error: {data.get('msg')}")
            task_id = data["data"]["taskId"]

        result = await self._poll_task(task_id)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No video URL in Runway result")
        return urls[0]
