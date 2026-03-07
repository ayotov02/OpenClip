import logging

from app.core.config import settings
from app.providers.base import ImageGenProvider
from app.providers.kieai_base import KieAIBase

logger = logging.getLogger(__name__)

ASPECT_RATIOS = {
    "landscape": "3:2",
    "portrait": "2:3",
    "square": "1:1",
    "youtube": "3:2",
}


class KieAIImageGen(KieAIBase, ImageGenProvider):
    """Image generation via GPT Image / Flux-2 on Kie.ai."""

    def _select_aspect_ratio(self, width: int, height: int) -> str:
        ratio = width / height
        if ratio > 1.3:
            return "3:2"
        if ratio < 0.77:
            return "2:3"
        return "1:1"

    async def generate(
        self,
        prompt: str,
        width: int = 1280,
        height: int = 720,
        model: str | None = None,
    ) -> str:
        model_id = model or settings.KIEAI_DEFAULT_IMAGE_MODEL
        aspect_ratio = self._select_aspect_ratio(width, height)

        payload = {
            "model": model_id,
            "input": {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "quality": "high",
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No image URL in generation result")
        return urls[0]

    async def generate_thumbnail(
        self,
        prompt: str,
        style: str = "youtube",
        text_overlay: str | None = None,
    ) -> str:
        aspect = ASPECT_RATIOS.get(style, "3:2")
        full_prompt = prompt
        if text_overlay:
            full_prompt = (
                f"{prompt}. Include bold text overlay that says: '{text_overlay}'"
            )

        payload = {
            "model": settings.KIEAI_DEFAULT_IMAGE_MODEL,
            "input": {
                "prompt": full_prompt,
                "aspect_ratio": aspect,
                "quality": "high",
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No image URL in thumbnail result")
        return urls[0]
