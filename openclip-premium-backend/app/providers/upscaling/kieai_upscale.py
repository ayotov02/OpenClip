import logging

from app.providers.base import UpscalingProvider
from app.providers.kieai_base import KieAIBase

logger = logging.getLogger(__name__)


class KieAIUpscaling(KieAIBase, UpscalingProvider):
    """Image/video upscaling via Topaz on Kie.ai."""

    async def upscale_image(self, image_path: str, scale: int = 2) -> str:
        payload = {
            "model": "topaz/image-upscale",
            "input": {
                "image_url": image_path,
                "upscale_factor": str(scale),
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No URL in image upscale result")
        return urls[0]

    async def upscale_video(
        self, video_path: str, target_resolution: str = "4k"
    ) -> str:
        scale = "4" if "4k" in target_resolution.lower() else "2"
        payload = {
            "model": "topaz/video-upscale",
            "input": {
                "video_url": video_path,
                "upscale_factor": scale,
            },
        }
        result = await self._create_and_poll(payload)
        urls = self._extract_result_urls(result)
        if not urls:
            raise RuntimeError("No URL in video upscale result")
        return urls[0]
