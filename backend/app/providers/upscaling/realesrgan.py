import logging

import httpx

from app.core.config import settings
from app.providers.base import UpscalingProvider

logger = logging.getLogger(__name__)

# Real-ESRGAN served via a local REST wrapper
UPSCALE_SERVICE_URL = getattr(settings, "UPSCALE_SERVICE_URL", "http://localhost:8007")


class RealESRGANUpscaling(UpscalingProvider):
    """Image/video upscaling using local Real-ESRGAN."""

    async def upscale_image(self, image_path: str, scale: int = 2) -> str:
        payload = {
            "image_path": image_path,
            "scale": scale,
            "model": "realesrgan-x4plus",
        }
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{UPSCALE_SERVICE_URL}/upscale/image", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("output_path", data.get("url", ""))

    async def upscale_video(
        self, video_path: str, target_resolution: str = "4k"
    ) -> str:
        payload = {
            "video_path": video_path,
            "target_resolution": target_resolution,
            "model": "realesrgan-x4plus",
        }
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f"{UPSCALE_SERVICE_URL}/upscale/video", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data.get("output_path", data.get("url", ""))
