import logging

import httpx

from app.core.config import settings
from app.providers.base import VideoGenProvider

logger = logging.getLogger(__name__)

# Wan 2.1 is accessed via a local ComfyUI or dedicated service
# that wraps the Wan model. The service exposes REST endpoints.
WAN_SERVICE_URL = getattr(settings, "WAN_SERVICE_URL", "http://localhost:8006")


class WanVideoGen(VideoGenProvider):
    """Video generation using local Wan 2.1 model service."""

    async def text_to_video(
        self, prompt: str, duration: int = 5, model: str | None = None
    ) -> str:
        payload = {
            "prompt": prompt,
            "num_frames": duration * 24,  # 24fps
            "width": 1280,
            "height": 720,
        }
        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                f"{WAN_SERVICE_URL}/text2video", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("video_url", data.get("url", ""))

    async def image_to_video(
        self, image_url: str, prompt: str, model: str | None = None
    ) -> str:
        payload = {
            "image_url": image_url,
            "prompt": prompt,
            "num_frames": 120,  # ~5 seconds at 24fps
        }
        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                f"{WAN_SERVICE_URL}/img2video", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("video_url", data.get("url", ""))
