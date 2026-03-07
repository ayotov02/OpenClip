import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.core.config import settings
from app.providers.base import LLMProvider

logger = logging.getLogger(__name__)


class OllamaLLM(LLMProvider):
    """LLM provider using local Ollama server."""

    @property
    def _base_url(self) -> str:
        return settings.OLLAMA_BASE_URL

    def _build_messages(
        self, messages: list[dict], brand_ctx: object | None
    ) -> list[dict]:
        if brand_ctx and hasattr(brand_ctx, "to_system_prompt"):
            system_msg = {"role": "system", "content": brand_ctx.to_system_prompt()}
            return [system_msg, *messages]
        return messages

    async def chat(
        self,
        messages: list[dict],
        brand_ctx: object | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> str:
        built_messages = self._build_messages(messages, brand_ctx)
        payload: dict = {
            "model": settings.OLLAMA_MODEL,
            "messages": built_messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if response_format and response_format.get("type") == "json_object":
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self._base_url}/api/chat", json=payload
            )
            resp.raise_for_status()
            data = resp.json()

        return data["message"]["content"]

    async def chat_stream(
        self,
        messages: list[dict],
        brand_ctx: object | None = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        built_messages = self._build_messages(messages, brand_ctx)
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": built_messages,
            "stream": True,
            "options": {"temperature": temperature},
        }

        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream(
                "POST", f"{self._base_url}/api/chat", json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            yield content
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue

    async def score_clips(self, transcript: str, brand_ctx: object) -> list[dict]:
        from app.brand.prompt_builder import build_clip_scoring_prompt

        system_prompt, user_prompt = build_clip_scoring_prompt(brand_ctx, transcript)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        result = await self.chat(
            messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        return json.loads(result).get("clips", [])

    async def generate_script(
        self, topic: str, template: str, brand_ctx: object
    ) -> dict:
        from app.brand.prompt_builder import build_brand_system_prompt

        system_prompt = build_brand_system_prompt(brand_ctx)
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Generate a faceless video script about: {topic}\n"
                    f"Template style: {template}\n"
                    "Return JSON with keys: title, hook, scenes (list of "
                    "{{narration, visual_description, duration_seconds}}), "
                    "cta, total_duration_seconds"
                ),
            },
        ]
        result = await self.chat(
            messages,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        return json.loads(result)

    async def generate_broll_queries(
        self, narration: str, brand_ctx: object
    ) -> list[str]:
        from app.brand.prompt_builder import build_brand_system_prompt

        system_prompt = build_brand_system_prompt(brand_ctx)
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Generate 5 stock video search queries for this narration:\n"
                    f'"{narration}"\n'
                    "Return JSON with key: queries (list of strings)"
                ),
            },
        ]
        result = await self.chat(
            messages,
            temperature=0.5,
            response_format={"type": "json_object"},
        )
        return json.loads(result).get("queries", [])

    async def generate_publish_copy(
        self, clip_title: str, transcript: str, platform: str, brand_ctx: object
    ) -> dict:
        from app.brand.prompt_builder import build_publish_copy_prompt

        system_prompt, user_prompt = build_publish_copy_prompt(
            brand_ctx, clip_title, transcript, platform
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        result = await self.chat(
            messages,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        return json.loads(result)
