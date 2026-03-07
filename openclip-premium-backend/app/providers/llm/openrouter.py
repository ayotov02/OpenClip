import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.core.config import settings
from app.providers.base import LLMProvider

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterLLM(LLMProvider):
    """LLM provider using OpenRouter's unified API with model fallback."""

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://openclip.ai",
            "X-Title": "OpenClip",
        }

    def _build_messages(
        self, messages: list[dict], brand_ctx: object | None
    ) -> list[dict]:
        if brand_ctx and hasattr(brand_ctx, "to_system_prompt"):
            system_msg = {"role": "system", "content": brand_ctx.to_system_prompt()}
            return [system_msg, *messages]
        return messages

    def _model_with_fallbacks(self, model: str | None = None) -> list[str]:
        primary = model or settings.OPENROUTER_DEFAULT_MODEL
        return [primary, *settings.OPENROUTER_FALLBACK_MODELS]

    async def chat(
        self,
        messages: list[dict],
        brand_ctx: object | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> str:
        built_messages = self._build_messages(messages, brand_ctx)
        models = self._model_with_fallbacks()

        payload: dict = {
            "messages": built_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "models": models,
            "route": "fallback",
        }
        if response_format:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                OPENROUTER_API_URL, json=payload, headers=self._headers()
            )
            resp.raise_for_status()
            data = resp.json()

        return data["choices"][0]["message"]["content"]

    async def chat_stream(
        self,
        messages: list[dict],
        brand_ctx: object | None = None,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        built_messages = self._build_messages(messages, brand_ctx)
        models = self._model_with_fallbacks()

        payload = {
            "messages": built_messages,
            "temperature": temperature,
            "stream": True,
            "models": models,
            "route": "fallback",
        }

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", OPENROUTER_API_URL, json=payload, headers=self._headers()
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    chunk = line.removeprefix("data: ").strip()
                    if chunk == "[DONE]":
                        break
                    try:
                        parsed = json.loads(chunk)
                        delta = parsed["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def score_clips(self, transcript: str, brand_ctx: object) -> list[dict]:
        from app.brand.prompt_builder import build_clip_scoring_prompt

        system_prompt, user_prompt = build_clip_scoring_prompt(transcript, brand_ctx)
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
            clip_title, transcript, platform, brand_ctx
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
