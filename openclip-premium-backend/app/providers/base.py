from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMProvider(ABC):
    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        brand_ctx: object | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> str: ...

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[dict],
        brand_ctx: object | None = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]: ...

    @abstractmethod
    async def score_clips(self, transcript: str, brand_ctx: object) -> list[dict]: ...

    @abstractmethod
    async def generate_script(
        self, topic: str, template: str, brand_ctx: object
    ) -> dict: ...

    @abstractmethod
    async def generate_broll_queries(
        self, narration: str, brand_ctx: object
    ) -> list[str]: ...

    @abstractmethod
    async def generate_publish_copy(
        self, clip_title: str, transcript: str, platform: str, brand_ctx: object
    ) -> dict: ...


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(
        self, audio_path: str, language: str = "en", diarize: bool = True
    ) -> dict: ...

    @abstractmethod
    async def align(self, audio_path: str, transcript: str) -> list[dict]: ...


class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(
        self, text: str, voice: str, speed: float = 1.0
    ) -> bytes: ...

    @abstractmethod
    async def list_voices(self) -> list[dict]: ...

    @abstractmethod
    async def clone_voice(self, text: str, reference_audio: str) -> bytes: ...


class ImageGenProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        width: int = 1280,
        height: int = 720,
        model: str | None = None,
    ) -> str: ...

    @abstractmethod
    async def generate_thumbnail(
        self, prompt: str, style: str = "youtube", text_overlay: str | None = None
    ) -> str: ...


class VideoGenProvider(ABC):
    @abstractmethod
    async def text_to_video(
        self, prompt: str, duration: int = 5, model: str | None = None
    ) -> str: ...

    @abstractmethod
    async def image_to_video(
        self, image_url: str, prompt: str, model: str | None = None
    ) -> str: ...


class MusicGenProvider(ABC):
    @abstractmethod
    async def generate(
        self, prompt: str, duration: int = 30, mood: str | None = None
    ) -> str: ...


class ScrapingProvider(ABC):
    @abstractmethod
    async def scrape_profile(self, platform: str, handle: str) -> dict: ...

    @abstractmethod
    async def scrape_posts(
        self, platform: str, handle: str, limit: int = 20
    ) -> list[dict]: ...

    @abstractmethod
    async def search_web(self, query: str, limit: int = 10) -> list[dict]: ...


class UpscalingProvider(ABC):
    @abstractmethod
    async def upscale_image(self, image_path: str, scale: int = 2) -> str: ...

    @abstractmethod
    async def upscale_video(
        self, video_path: str, target_resolution: str = "4k"
    ) -> str: ...
