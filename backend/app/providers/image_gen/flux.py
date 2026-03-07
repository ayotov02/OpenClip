import logging

import httpx

from app.core.config import settings
from app.providers.base import ImageGenProvider

logger = logging.getLogger(__name__)


class FluxImageGen(ImageGenProvider):
    """Image generation using local FLUX.1 service."""

    @property
    def _base_url(self) -> str:
        return settings.FLUX_SERVICE_URL

    async def generate(
        self,
        prompt: str,
        width: int = 1280,
        height: int = 720,
        model: str | None = None,
    ) -> str:
        payload = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
        }
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self._base_url}/generate", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("image_url", data.get("url", ""))

    async def generate_thumbnail(
        self,
        prompt: str,
        style: str = "youtube",
        text_overlay: str | None = None,
    ) -> str:
        # YouTube thumbnails are typically 1280x720
        sizes = {
            "youtube": (1280, 720),
            "instagram": (1080, 1080),
            "tiktok": (1080, 1920),
        }
        w, h = sizes.get(style, (1280, 720))

        full_prompt = prompt
        if text_overlay:
            full_prompt = (
                f"{prompt}. Include bold text overlay that says: '{text_overlay}'"
            )

        return await self.generate(full_prompt, width=w, height=h)
