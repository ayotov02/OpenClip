# LLM Integration (Qwen3 via Ollama) — Implementation Guide

## Overview
- **What:** Deploy Qwen3-32B via Ollama on GCP Cloud Run GPU and create a backend client for all LLM operations (clip analysis, script generation, content scoring, keyword extraction).
- **Why:** The LLM powers the intelligence layer — clip selection, virality scoring, script writing, B-roll queries, platform-specific optimization, and content analysis.
- **Dependencies:** Feature 1 (Project Setup), Feature 2 (FastAPI Backend)

## Architecture

### LLM Use Cases
```
1. Clip Analysis:     Transcript → Identify engaging segments → Score virality
2. Script Generation: Topic → Structured scene-by-scene script (JSON)
3. B-Roll Queries:    Script → Pexels search queries per scene
4. Content Scoring:   Text → Hook strength, engagement prediction
5. Platform Optimization: Content → Platform-specific titles/descriptions/hashtags
6. Keyword Extraction: Text → Keywords for search, tagging, SEO
```

### Ollama Architecture on GCP
```
Cloud Run GPU (L4) → Ollama Server → Qwen3-32B (Q4_K_M quantization)
                   → OpenAI-compatible API (/v1/chat/completions)
                   → Custom endpoints (/api/generate)
```

## GCP Deployment
- **Service:** Cloud Run (GPU)
- **Machine type:** g2-standard-12 (12 vCPU, 48GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM) — sufficient for Qwen3-32B Q4
- **Model:** `qwen3:32b` (~20GB VRAM with Q4_K_M)
- **Scale:** Min 0, Max 2 instances
- **Cost estimate:** $200-400/month

## Step-by-Step Implementation

### Step 1: Create Ollama Docker Image with Model
Create `services/llm/Dockerfile`:
```dockerfile
FROM ollama/ollama:latest

# Pre-pull model during build (optional, for faster cold start)
# This requires GPU during build, so we do it at first run instead

EXPOSE 11434
ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]
```

Create `services/llm/startup.sh`:
```bash
#!/bin/bash
# Start Ollama server in background
ollama serve &
sleep 5

# Pull model if not cached
ollama pull qwen3:32b

# Keep container running
wait
```

### Step 2: Deploy Ollama to Cloud Run GPU
```bash
# Deploy Ollama to Cloud Run
gcloud run deploy llm-service \
  --image ollama/ollama:latest \
  --region us-central1 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 8 \
  --memory 32Gi \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 300 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@openclip-prod.iam.gserviceaccount.com \
  --vpc-connector openclip-connector \
  --command "/bin/sh" \
  --args "-c,ollama serve & sleep 5 && ollama pull qwen3:32b && wait"
```

### Step 3: Create LLM Client
Create `backend/app/ai/llm_client.py`:
```python
import json

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class LLMClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_URL

    async def chat(
        self,
        messages: list[dict],
        model: str = "qwen3:32b",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        json_mode: bool = False,
    ) -> str:
        """Send chat completion request (OpenAI-compatible)."""
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def generate_json(self, prompt: str, system: str = "") -> dict:
        """Generate structured JSON output from LLM."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        text = await self.chat(messages, json_mode=True, temperature=0.3)
        return json.loads(text)

    async def health(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/api/tags")
            return resp.json()
```

### Step 4: Create Clip Analysis Prompts
Create `backend/app/ai/prompts.py`:
```python
CLIP_ANALYSIS_SYSTEM = """You are an expert video content analyst. Your task is to identify the most engaging segments from a video transcript that would make great short-form clips (15-90 seconds).

Score each segment on these criteria:
- hook_strength (0-10): How compelling is the opening?
- emotional_peak (0-10): Does it hit an emotional high point?
- information_density (0-10): How much value does it pack?
- self_contained (0-10): Can it stand alone without context?
- virality_potential (0-10): Would this go viral on social media?

Output valid JSON only."""

CLIP_ANALYSIS_USER = """Analyze this transcript and identify the top {num_clips} most engaging segments for short-form clips ({min_duration}-{max_duration} seconds each).

TRANSCRIPT:
{transcript}

Output format:
{{
  "clips": [
    {{
      "start_time": <float>,
      "end_time": <float>,
      "title": "<suggested clip title>",
      "reason": "<why this segment is engaging>",
      "scores": {{
        "hook_strength": <0-10>,
        "emotional_peak": <0-10>,
        "information_density": <0-10>,
        "self_contained": <0-10>,
        "virality_potential": <0-10>
      }},
      "total_score": <sum of scores>
    }}
  ]
}}"""

SCRIPT_GENERATION_SYSTEM = """You are a professional video scriptwriter specializing in faceless content for YouTube and TikTok. Write engaging, well-paced scripts with strong hooks.

Output valid JSON only."""

SCRIPT_GENERATION_USER = """Write a {duration}-second faceless video script about: {topic}

Style: {style}
Target audience: {audience}

Output format:
{{
  "title": "<catchy title>",
  "hook": "<attention-grabbing opening line>",
  "scenes": [
    {{
      "narration": "<what the narrator says>",
      "duration_est": <seconds>,
      "search_keywords": ["<pexels search term 1>", "<term 2>", "<term 3>"],
      "mood": "<dramatic|upbeat|calm|mysterious|funny>",
      "visual_description": "<what should be on screen>"
    }}
  ],
  "outro": "<call to action>"
}}"""

BROLL_QUERY_SYSTEM = """You are a B-roll director. Given a script or narration text, generate search queries for the Pexels stock footage API that would produce visually relevant, high-quality background footage.

Output valid JSON only."""

BROLL_QUERY_USER = """Generate Pexels search queries for this narration:
"{narration}"

Context/mood: {mood}

Output 3-5 search queries ranked by relevance:
{{
  "queries": [
    {{
      "query": "<pexels search term>",
      "orientation": "landscape|portrait",
      "relevance": <0.0-1.0>
    }}
  ]
}}"""
```

### Step 5: Create Analysis Service
Create `backend/app/services/analysis_service.py`:
```python
from app.ai.llm_client import LLMClient
from app.ai.prompts import (
    CLIP_ANALYSIS_SYSTEM,
    CLIP_ANALYSIS_USER,
    SCRIPT_GENERATION_SYSTEM,
    SCRIPT_GENERATION_USER,
)


class AnalysisService:
    def __init__(self):
        self.llm = LLMClient()

    async def analyze_clips(
        self,
        transcript: str,
        num_clips: int = 10,
        min_duration: int = 15,
        max_duration: int = 60,
    ) -> dict:
        prompt = CLIP_ANALYSIS_USER.format(
            transcript=transcript,
            num_clips=num_clips,
            min_duration=min_duration,
            max_duration=max_duration,
        )
        return await self.llm.generate_json(
            prompt=prompt,
            system=CLIP_ANALYSIS_SYSTEM,
        )

    async def generate_script(
        self,
        topic: str,
        duration: int = 60,
        style: str = "documentary",
        audience: str = "general",
    ) -> dict:
        prompt = SCRIPT_GENERATION_USER.format(
            topic=topic,
            duration=duration,
            style=style,
            audience=audience,
        )
        return await self.llm.generate_json(
            prompt=prompt,
            system=SCRIPT_GENERATION_SYSTEM,
        )
```

## Best Practices
- **JSON mode:** Always use `format: "json"` for structured output — Qwen3 is trained for this.
- **Temperature 0.3 for analysis:** Low temperature for consistent, factual analysis. Higher (0.7-0.9) for creative scripts.
- **Prompt engineering:** Be extremely specific about output format. Include example JSON structure.
- **Timeout 120s:** LLM inference on 32B model with long context can take 30-60s.
- **Model caching:** Ollama caches the model in memory after first load. Keep `min-instances=1` in production to avoid cold starts.
- **Qwen3 thinking mode:** Qwen3 supports `/think` and `/no_think` tags. Use `/no_think` for structured output to avoid reasoning tokens in JSON.

## Testing
- Deploy Ollama locally: `ollama serve && ollama pull qwen3:32b`
- Test clip analysis with sample transcript
- Test script generation with different topics
- Verify JSON output is valid and parseable
- Test error handling for timeout/OOM

## Verification Checklist
- [ ] Ollama service starts and loads Qwen3-32B
- [ ] `/api/tags` lists the model
- [ ] Chat completion returns valid text
- [ ] JSON mode returns valid parseable JSON
- [ ] Clip analysis identifies meaningful segments
- [ ] Script generation produces structured scene output
- [ ] Response time < 60s for typical requests
- [ ] Cloud Run GPU deployment works
- [ ] Backend client connects and gets responses
- [ ] Error handling for model overload
