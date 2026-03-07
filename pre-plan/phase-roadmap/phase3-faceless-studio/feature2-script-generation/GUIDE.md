# Script Generation (LLM Structured Output) — Implementation Guide

## Overview
- **What:** Use the LLM (Qwen3-32B via Ollama) to generate structured JSON scripts for faceless videos. Each script contains scene-by-scene breakdowns with narration text, visual descriptions, search keywords for B-roll, mood tags, and timing estimates. Support multiple script styles: documentary, listicle, story, motivational, educational, and scary.
- **Why:** The script is the blueprint for the entire faceless video pipeline. Every downstream component (TTS, B-roll matching, music generation, Remotion assembly) consumes the structured script JSON. Quality scripts with precise structure eliminate manual editing and enable full automation.
- **Dependencies:** Phase 1 Feature 6 (LLM Integration — Ollama + Qwen3-32B), Phase 1 Feature 3 (Job Queue)

## Architecture

### Script Generation Pipeline
```
User Input (topic, style, duration, audience)
  → Style-specific prompt template selected
  → LLM generates structured JSON script
  → Validation (Pydantic model)
  → Script stored in PostgreSQL
  → Script dispatched to downstream tasks:
      ├── TTS (narration text per scene)
      ├── B-Roll Matching (keywords + visual descriptions)
      ├── MusicGen (mood tags)
      └── Remotion Assembly (full scene structure)
```

### Script JSON Schema
```json
{
  "title": "Why Deep Sea Fish Look So Terrifying",
  "hook": "90% of the ocean is pitch black. And the creatures that live there... evolved to be nightmares.",
  "style": "documentary",
  "target_duration": 60,
  "scenes": [
    {
      "scene_number": 1,
      "narration": "At depths below 200 meters, sunlight cannot penetrate...",
      "duration_est": 8,
      "visual_description": "Dark ocean water fading from blue to black, with depth markers",
      "search_keywords": ["deep ocean", "ocean depths", "underwater dark"],
      "mood": "mysterious",
      "transition": "fade"
    }
  ],
  "outro": "Subscribe for more terrifying science facts.",
  "metadata": {
    "total_duration_est": 62,
    "scene_count": 8,
    "word_count": 450,
    "reading_speed_wpm": 150
  }
}
```

## GCP Deployment
- No additional GCP service required. Uses the existing LLM service (Cloud Run GPU with Ollama/Qwen3-32B) deployed in Phase 1 Feature 6.
- Script generation runs as a Celery task on the CPU worker queue (only the LLM call hits the GPU service).

## Step-by-Step Implementation

### Step 1: Create Script Pydantic Models
Create `backend/app/schemas/script.py`:
```python
from enum import Enum

from pydantic import BaseModel, Field


class ScriptStyle(str, Enum):
    DOCUMENTARY = "documentary"
    LISTICLE = "listicle"
    STORY = "story"
    MOTIVATIONAL = "motivational"
    EDUCATIONAL = "educational"
    SCARY = "scary"
    REDDIT = "reddit"


class SceneMood(str, Enum):
    DRAMATIC = "dramatic"
    UPBEAT = "upbeat"
    CALM = "calm"
    MYSTERIOUS = "mysterious"
    FUNNY = "funny"
    TENSE = "tense"
    INSPIRING = "inspiring"
    DARK = "dark"


class SceneTransition(str, Enum):
    CUT = "cut"
    FADE = "fade"
    DISSOLVE = "dissolve"
    WIPE = "wipe"
    ZOOM = "zoom"


class ScriptScene(BaseModel):
    scene_number: int = Field(..., ge=1)
    narration: str = Field(..., min_length=1, max_length=2000)
    duration_est: float = Field(..., ge=1, le=120, description="Estimated duration in seconds")
    visual_description: str = Field(..., min_length=1, max_length=500)
    search_keywords: list[str] = Field(..., min_length=1, max_length=5)
    mood: SceneMood = SceneMood.CALM
    transition: SceneTransition = SceneTransition.CUT


class ScriptMetadata(BaseModel):
    total_duration_est: float
    scene_count: int
    word_count: int
    reading_speed_wpm: int = 150


class GeneratedScript(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    hook: str = Field(..., min_length=1, max_length=500)
    style: ScriptStyle
    target_duration: int
    scenes: list[ScriptScene] = Field(..., min_length=1, max_length=30)
    outro: str = Field(..., max_length=500)
    metadata: ScriptMetadata


class ScriptRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=500)
    style: ScriptStyle = ScriptStyle.DOCUMENTARY
    duration: int = Field(60, ge=15, le=600, description="Target duration in seconds")
    audience: str = Field("general", max_length=200)
    tone: str = Field("engaging", max_length=100)
    additional_instructions: str = Field("", max_length=1000)
```

### Step 2: Create Prompt Templates
Create `backend/app/ai/prompts/script_prompts.py`:
```python
"""
Prompt templates for faceless video script generation.
Each style has a tailored system prompt and user prompt template.
"""

SCRIPT_SYSTEM_BASE = """You are an expert faceless video scriptwriter for YouTube Shorts and TikTok.
You write scripts that are engaging, well-paced, and optimized for viewer retention.

RULES:
1. Start with a powerful hook in the first 3 seconds — a question, shocking stat, or bold claim.
2. Each scene should be 5-15 seconds of narration.
3. Visual descriptions must be specific enough for stock footage search (not abstract).
4. Search keywords must be concrete nouns/actions suitable for Pexels/Pixabay.
5. Total narration word count should match the target duration at ~150 words per minute.
6. End with a clear call-to-action (subscribe, comment, share).
7. Use short sentences. One idea per sentence. Easy to follow when listening.
8. Mood tags drive background music selection — choose deliberately.

Output ONLY valid JSON matching the exact schema provided. No markdown, no commentary."""


SCRIPT_STYLE_PROMPTS = {
    "documentary": """STYLE: Documentary / Educational Explainer
TONE: Authoritative but accessible. Think Kurzgesagt or Vox.
STRUCTURE:
- Hook: Surprising fact or question
- Body: Logical progression of ideas, each scene builds on the previous
- Climax: The "aha" moment or most surprising revelation
- Outro: Thought-provoking conclusion + CTA

PACING: Measured, deliberate. Allow visuals to breathe. 130-150 WPM.""",

    "listicle": """STYLE: Top N Listicle / Countdown
TONE: Energetic, fast-paced. Think "5 Things You Didn't Know About..."
STRUCTURE:
- Hook: "Number X will blow your mind" or "You won't believe number 1"
- Body: Each scene = one list item, numbered. Build intensity toward #1.
- Climax: The #1 item should be genuinely surprising
- Outro: "Which one surprised you most? Comment below" + CTA

PACING: Quick cuts, high energy. 150-170 WPM. Keep each item punchy.""",

    "story": """STYLE: Narrative / Storytelling
TONE: Immersive, conversational. Think campfire storytelling or true crime narration.
STRUCTURE:
- Hook: Drop the listener into the middle of the action or mystery
- Body: Chronological or suspense-building narrative arc
- Climax: The twist, revelation, or emotional peak
- Resolution: Wrap up the story
- Outro: Reflection or moral + CTA

PACING: Varied — slow for tension, fast for action. 140-160 WPM.""",

    "motivational": """STYLE: Motivational / Inspirational
TONE: Empowering, passionate, direct. Think Gary Vee meets Stoicism.
STRUCTURE:
- Hook: Challenge a limiting belief or ask a provocative question
- Body: Build the argument with examples, metaphors, or historical references
- Climax: The empowering realization or call to action
- Outro: Direct challenge to the viewer + CTA

PACING: Punchy, rhythmic. Short sentences for impact. 140-150 WPM.""",

    "educational": """STYLE: Educational / How-To / Tutorial
TONE: Clear, patient, step-by-step. Think a great teacher explaining a concept.
STRUCTURE:
- Hook: "Ever wondered why..." or "Here's how X actually works"
- Body: Break the concept into digestible steps or layers
- Each scene explains one step/concept with a clear visual analogy
- Outro: Summary + "Now you know" + CTA

PACING: Steady, clear. Pause between concepts. 130-140 WPM.""",

    "scary": """STYLE: Horror / Creepy / Unsettling
TONE: Ominous, building dread. Think Mr. Nightmare or Nexpo.
STRUCTURE:
- Hook: Unsettling statement or question that creates immediate tension
- Body: Gradually escalate the creepiness. Each scene adds a layer of dread.
- Climax: The most disturbing revelation or moment
- Outro: Leave the viewer unsettled. End with a question, not a resolution.

PACING: Slow, deliberate. Use silence and pauses. 120-140 WPM.""",

    "reddit": """STYLE: Reddit Story / AITA / Confession
TONE: Conversational, first-person, confessional. Like reading a Reddit post aloud.
STRUCTURE:
- Hook: The most dramatic moment or the core dilemma
- Context: Set up the situation (relationships, setting)
- Body: Tell the story chronologically with emotional beats
- Climax: The confrontation, decision, or revelation
- Outro: "So Reddit, am I wrong?" or "What would you have done?" + CTA

PACING: Conversational, varied. Speed up during drama, slow for emotion. 140-160 WPM.""",
}


def build_script_user_prompt(
    topic: str,
    style: str,
    duration: int,
    audience: str,
    tone: str,
    additional_instructions: str = "",
) -> str:
    """Build the user prompt for script generation."""
    # Calculate target word count from duration
    wpm = 150  # Average narration speed
    target_words = int(duration * wpm / 60)

    extra = ""
    if additional_instructions:
        extra = f"\n\nADDITIONAL INSTRUCTIONS:\n{additional_instructions}"

    return f"""Write a {duration}-second faceless video script about:
"{topic}"

TARGET AUDIENCE: {audience}
TONE: {tone}
TARGET WORD COUNT: ~{target_words} words of narration total

{SCRIPT_STYLE_PROMPTS.get(style, SCRIPT_STYLE_PROMPTS["documentary"])}
{extra}

Output this exact JSON structure:
{{
  "title": "<catchy, clickbait-worthy title under 80 chars>",
  "hook": "<the first 1-2 sentences that grab attention>",
  "style": "{style}",
  "target_duration": {duration},
  "scenes": [
    {{
      "scene_number": 1,
      "narration": "<what the narrator says in this scene>",
      "duration_est": <estimated seconds for this scene, 5-15>,
      "visual_description": "<specific description of what should appear on screen>",
      "search_keywords": ["<pexels search term 1>", "<term 2>", "<term 3>"],
      "mood": "<dramatic|upbeat|calm|mysterious|funny|tense|inspiring|dark>",
      "transition": "<cut|fade|dissolve|wipe|zoom>"
    }}
  ],
  "outro": "<call to action, 1-2 sentences>",
  "metadata": {{
    "total_duration_est": <sum of all scene durations>,
    "scene_count": <number of scenes>,
    "word_count": <total words in all narration>,
    "reading_speed_wpm": 150
  }}
}}"""


# Prompt for refining/rewriting a specific scene
SCENE_REWRITE_SYSTEM = """You are an expert video scriptwriter. Rewrite the given scene to improve it based on the feedback provided. Output ONLY valid JSON for a single scene object. No markdown, no commentary."""

SCENE_REWRITE_USER = """Rewrite this scene from a {style} faceless video script:

CURRENT SCENE:
{scene_json}

CONTEXT (surrounding scenes):
Previous scene narration: "{prev_narration}"
Next scene narration: "{next_narration}"

FEEDBACK:
{feedback}

Output the rewritten scene as JSON:
{{
  "scene_number": {scene_number},
  "narration": "<rewritten narration>",
  "duration_est": <seconds>,
  "visual_description": "<updated visual description>",
  "search_keywords": ["<term1>", "<term2>", "<term3>"],
  "mood": "<mood>",
  "transition": "<transition>"
}}"""


# Prompt for generating a script from existing content (URL, article, Reddit post)
CONTENT_TO_SCRIPT_SYSTEM = """You are an expert faceless video scriptwriter. Convert the provided content into a structured video script. Preserve the key information and narrative, but rewrite for spoken narration (short sentences, conversational tone, strong hook). Output ONLY valid JSON."""

CONTENT_TO_SCRIPT_USER = """Convert this content into a {duration}-second {style} faceless video script:

SOURCE CONTENT:
---
{content}
---

TARGET AUDIENCE: {audience}
TONE: {tone}

{STYLE_INSTRUCTIONS}

Output the same JSON structure as a standard script generation (title, hook, scenes, outro, metadata)."""
```

### Step 3: Create Script Service
Create `backend/app/services/script_service.py`:
```python
import json

import structlog
from pydantic import ValidationError

from app.ai.llm_client import LLMClient
from app.ai.prompts.script_prompts import (
    SCRIPT_SYSTEM_BASE,
    SCRIPT_STYLE_PROMPTS,
    build_script_user_prompt,
    SCENE_REWRITE_SYSTEM,
    SCENE_REWRITE_USER,
    CONTENT_TO_SCRIPT_SYSTEM,
    CONTENT_TO_SCRIPT_USER,
)
from app.schemas.script import GeneratedScript, ScriptRequest, ScriptScene

logger = structlog.get_logger()


class ScriptService:
    """Service for generating and managing faceless video scripts."""

    def __init__(self):
        self.llm = LLMClient()

    async def generate_script(self, request: ScriptRequest) -> GeneratedScript:
        """
        Generate a structured faceless video script from a topic.

        Retries up to 2 times if the LLM output fails validation.
        """
        user_prompt = build_script_user_prompt(
            topic=request.topic,
            style=request.style.value,
            duration=request.duration,
            audience=request.audience,
            tone=request.tone,
            additional_instructions=request.additional_instructions,
        )

        for attempt in range(3):
            try:
                logger.info(
                    "script.generate",
                    topic=request.topic[:80],
                    style=request.style,
                    duration=request.duration,
                    attempt=attempt,
                )

                raw = await self.llm.generate_json(
                    prompt=user_prompt,
                    system=SCRIPT_SYSTEM_BASE,
                )

                # Validate and parse through Pydantic
                script = GeneratedScript(**raw)

                # Post-process: recalculate metadata
                script = self._recalculate_metadata(script)

                logger.info(
                    "script.generated",
                    title=script.title,
                    scenes=len(script.scenes),
                    words=script.metadata.word_count,
                    duration_est=script.metadata.total_duration_est,
                )

                return script

            except (ValidationError, json.JSONDecodeError, KeyError) as e:
                logger.warning(
                    "script.validation_failed",
                    attempt=attempt,
                    error=str(e)[:200],
                )
                if attempt == 2:
                    raise ValueError(
                        f"Failed to generate valid script after 3 attempts: {e}"
                    )
                # Add correction hint to the prompt for retry
                user_prompt += (
                    f"\n\nPREVIOUS ATTEMPT FAILED VALIDATION: {str(e)[:200]}"
                    "\nPlease fix the JSON structure and try again."
                )

    async def generate_from_content(
        self,
        content: str,
        style: str = "documentary",
        duration: int = 60,
        audience: str = "general",
        tone: str = "engaging",
    ) -> GeneratedScript:
        """
        Generate a script from existing content (article, Reddit post, etc.).
        """
        style_instructions = SCRIPT_STYLE_PROMPTS.get(style, SCRIPT_STYLE_PROMPTS["documentary"])

        user_prompt = CONTENT_TO_SCRIPT_USER.format(
            content=content[:8000],  # Truncate to fit context window
            style=style,
            duration=duration,
            audience=audience,
            tone=tone,
            STYLE_INSTRUCTIONS=style_instructions,
        )

        raw = await self.llm.generate_json(
            prompt=user_prompt,
            system=CONTENT_TO_SCRIPT_SYSTEM,
        )

        script = GeneratedScript(**raw)
        return self._recalculate_metadata(script)

    async def rewrite_scene(
        self,
        script: GeneratedScript,
        scene_number: int,
        feedback: str,
    ) -> ScriptScene:
        """
        Rewrite a specific scene based on user feedback.
        """
        scene_idx = scene_number - 1
        if scene_idx < 0 or scene_idx >= len(script.scenes):
            raise ValueError(f"Scene {scene_number} does not exist")

        scene = script.scenes[scene_idx]
        prev_narration = script.scenes[scene_idx - 1].narration if scene_idx > 0 else "(start of video)"
        next_narration = script.scenes[scene_idx + 1].narration if scene_idx < len(script.scenes) - 1 else "(end of video)"

        user_prompt = SCENE_REWRITE_USER.format(
            style=script.style.value,
            scene_json=scene.model_dump_json(indent=2),
            prev_narration=prev_narration[:200],
            next_narration=next_narration[:200],
            feedback=feedback,
            scene_number=scene_number,
        )

        raw = await self.llm.generate_json(
            prompt=user_prompt,
            system=SCENE_REWRITE_SYSTEM,
        )

        return ScriptScene(**raw)

    def _recalculate_metadata(self, script: GeneratedScript) -> GeneratedScript:
        """Recalculate metadata from actual scene data."""
        total_words = sum(
            len(scene.narration.split()) for scene in script.scenes
        )
        total_duration = sum(scene.duration_est for scene in script.scenes)
        wpm = int(total_words / (total_duration / 60)) if total_duration > 0 else 150

        script.metadata.word_count = total_words
        script.metadata.scene_count = len(script.scenes)
        script.metadata.total_duration_est = total_duration
        script.metadata.reading_speed_wpm = wpm

        return script
```

### Step 4: Create Script Database Model
Create `backend/app/models/script.py`:
```python
from sqlalchemy import String, Integer, Float, JSON, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.schemas.script import ScriptStyle


class Script(BaseModel):
    __tablename__ = "scripts"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    project_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True
    )

    # Script content
    title: Mapped[str] = mapped_column(String(200))
    topic: Mapped[str] = mapped_column(Text)
    style: Mapped[ScriptStyle] = mapped_column(Enum(ScriptStyle))
    target_duration: Mapped[int] = mapped_column(Integer)
    script_data: Mapped[dict] = mapped_column(JSON)  # Full GeneratedScript JSON

    # Metadata
    scene_count: Mapped[int] = mapped_column(Integer, default=0)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    estimated_duration: Mapped[float] = mapped_column(Float, default=0.0)

    # Source (if generated from content)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_content: Mapped[str | None] = mapped_column(Text, nullable=True)
```

### Step 5: Create Script API Endpoints
Create `backend/app/api/v1/scripts.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.script import Script
from app.models.user import User
from app.schemas.script import GeneratedScript, ScriptRequest, ScriptStyle
from app.services.script_service import ScriptService

router = APIRouter()


@router.post("/generate", response_model=GeneratedScript)
async def generate_script(
    request: ScriptRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a faceless video script from a topic."""
    service = ScriptService()
    script = await service.generate_script(request)

    # Persist to database
    db_script = Script(
        user_id=user.id,
        title=script.title,
        topic=request.topic,
        style=request.style,
        target_duration=request.duration,
        script_data=script.model_dump(),
        scene_count=script.metadata.scene_count,
        word_count=script.metadata.word_count,
        estimated_duration=script.metadata.total_duration_est,
    )
    db.add(db_script)
    await db.commit()
    await db.refresh(db_script)

    return script


@router.post("/from-content", response_model=GeneratedScript)
async def generate_from_content(
    content: str,
    style: ScriptStyle = ScriptStyle.DOCUMENTARY,
    duration: int = 60,
    audience: str = "general",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a script from existing text content (article, Reddit post, etc.)."""
    service = ScriptService()
    script = await service.generate_from_content(
        content=content,
        style=style.value,
        duration=duration,
        audience=audience,
    )

    db_script = Script(
        user_id=user.id,
        title=script.title,
        topic=f"[from content] {script.title}",
        style=style,
        target_duration=duration,
        script_data=script.model_dump(),
        scene_count=script.metadata.scene_count,
        word_count=script.metadata.word_count,
        estimated_duration=script.metadata.total_duration_est,
        source_content=content[:10000],
    )
    db.add(db_script)
    await db.commit()

    return script


@router.get("/{script_id}")
async def get_script(
    script_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a saved script by ID."""
    result = await db.execute(
        select(Script).where(Script.id == script_id, Script.user_id == user.id)
    )
    script = result.scalar_one_or_none()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    return script.script_data


@router.get("/")
async def list_scripts(
    style: ScriptStyle | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List user's saved scripts."""
    query = select(Script).where(Script.user_id == user.id)
    if style:
        query = query.where(Script.style == style)
    query = query.order_by(Script.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    scripts = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "title": s.title,
            "style": s.style,
            "topic": s.topic,
            "scene_count": s.scene_count,
            "word_count": s.word_count,
            "estimated_duration": s.estimated_duration,
            "created_at": s.created_at.isoformat(),
        }
        for s in scripts
    ]


@router.put("/{script_id}/scenes/{scene_number}")
async def rewrite_scene(
    script_id: uuid.UUID,
    scene_number: int,
    feedback: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rewrite a specific scene with feedback."""
    result = await db.execute(
        select(Script).where(Script.id == script_id, Script.user_id == user.id)
    )
    db_script = result.scalar_one_or_none()
    if not db_script:
        raise HTTPException(status_code=404, detail="Script not found")

    script = GeneratedScript(**db_script.script_data)

    service = ScriptService()
    new_scene = await service.rewrite_scene(script, scene_number, feedback)

    # Update the script data
    script.scenes[scene_number - 1] = new_scene
    db_script.script_data = script.model_dump()
    await db.commit()

    return new_scene.model_dump()


@router.get("/styles/list")
async def list_styles():
    """List available script styles with descriptions."""
    return {
        "styles": [
            {
                "id": "documentary",
                "name": "Documentary",
                "description": "Authoritative explainer in the style of Kurzgesagt or Vox.",
                "best_for": "Science, history, technology, how-things-work",
            },
            {
                "id": "listicle",
                "name": "Top N Listicle",
                "description": "Countdown format with building intensity.",
                "best_for": "Rankings, comparisons, fun facts, trivia",
            },
            {
                "id": "story",
                "name": "Story / Narrative",
                "description": "Immersive storytelling with narrative arc.",
                "best_for": "True crime, historical events, personal stories",
            },
            {
                "id": "motivational",
                "name": "Motivational",
                "description": "Empowering and inspiring monologue.",
                "best_for": "Self-improvement, business, mindset, fitness",
            },
            {
                "id": "educational",
                "name": "Educational",
                "description": "Step-by-step explanation of a concept.",
                "best_for": "Tutorials, how-to, explainers, definitions",
            },
            {
                "id": "scary",
                "name": "Scary / Horror",
                "description": "Ominous narration with building dread.",
                "best_for": "Creepypasta, unsolved mysteries, paranormal, true crime",
            },
            {
                "id": "reddit",
                "name": "Reddit Story",
                "description": "First-person confessional Reddit post narration.",
                "best_for": "AITA, TIFU, relationship advice, confessions",
            },
        ]
    }
```

### Step 6: Create Script Generation Celery Task
Create `backend/app/tasks/script.py`:
```python
import asyncio

import structlog

from app.schemas.script import ScriptRequest
from app.services.script_service import ScriptService
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.ai.generate_script")
def generate_script_task(
    self,
    job_id: str,
    topic: str,
    style: str = "documentary",
    duration: int = 60,
    audience: str = "general",
    tone: str = "engaging",
    additional_instructions: str = "",
):
    """Generate a faceless video script as a Celery task."""
    loop = asyncio.new_event_loop()

    try:
        self.update_progress(0.1, "Preparing script generation...")

        request = ScriptRequest(
            topic=topic,
            style=style,
            duration=duration,
            audience=audience,
            tone=tone,
            additional_instructions=additional_instructions,
        )

        self.update_progress(0.3, f"Generating {style} script with LLM...")

        service = ScriptService()
        script = loop.run_until_complete(service.generate_script(request))

        self.update_progress(1.0, "Script generation complete")

        return script.model_dump()

    except Exception as exc:
        logger.error("script.task.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, max_retries=2)
    finally:
        loop.close()


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.ai.generate_script_from_content")
def generate_script_from_content_task(
    self,
    job_id: str,
    content: str,
    style: str = "documentary",
    duration: int = 60,
    audience: str = "general",
    tone: str = "engaging",
):
    """Generate a script from existing content as a Celery task."""
    loop = asyncio.new_event_loop()

    try:
        self.update_progress(0.1, "Analyzing source content...")
        self.update_progress(0.3, f"Converting to {style} script...")

        service = ScriptService()
        script = loop.run_until_complete(
            service.generate_from_content(
                content=content,
                style=style,
                duration=duration,
                audience=audience,
                tone=tone,
            )
        )

        self.update_progress(1.0, "Script generation complete")
        return script.model_dump()

    except Exception as exc:
        logger.error("script_from_content.task.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, max_retries=2)
    finally:
        loop.close()
```

### Step 7: Register Routes
Add to `backend/app/api/v1/__init__.py` (or wherever routes are registered):
```python
from app.api.v1.scripts import router as scripts_router

api_router.include_router(scripts_router, prefix="/scripts", tags=["scripts"])
```

### Step 8: Create Database Migration
```bash
cd backend
alembic revision --autogenerate -m "add scripts table"
alembic upgrade head
```

## Best Practices

- **Temperature 0.7 for scripts, 0.3 for structured data:** Creative content benefits from higher temperature, but keep it moderate to maintain coherent structure. Use lower temperature for scene rewrites where consistency matters.
- **Validate with Pydantic, retry on failure:** LLMs occasionally produce malformed JSON. The 3-attempt retry loop with error feedback typically succeeds on the second attempt.
- **Limit context window usage:** Truncate source content to 8000 characters. Qwen3-32B has a 32K context window, but shorter prompts produce faster, more focused results.
- **Word count = duration proxy:** At 150 WPM narration speed, a 60-second video needs ~150 words. Include this target in the prompt so the LLM calibrates scene lengths.
- **Search keywords must be concrete:** Instruct the LLM to output literal Pexels search terms (e.g., "city skyline night" not "urban atmosphere"). Abstract keywords produce poor B-roll matches.
- **Scene number consistency:** Always validate that scene numbers are sequential starting from 1. The LLM occasionally skips or duplicates numbers.
- **Qwen3 `/no_think` mode:** When generating structured JSON output, prepend `/no_think` to the user message to prevent Qwen3 from including chain-of-thought reasoning tokens inside the JSON output.

## Testing

### Manual Testing
```bash
# Generate a documentary script
curl -X POST http://localhost:8000/api/v1/scripts/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Why deep sea creatures look so terrifying",
    "style": "documentary",
    "duration": 60,
    "audience": "general science enthusiasts"
  }'

# Generate a listicle
curl -X POST http://localhost:8000/api/v1/scripts/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Top 5 most dangerous animals that look cute",
    "style": "listicle",
    "duration": 90
  }'

# List available styles
curl http://localhost:8000/api/v1/scripts/styles/list

# Rewrite a scene
curl -X PUT http://localhost:8000/api/v1/scripts/{script_id}/scenes/3 \
  -H "Authorization: Bearer TOKEN" \
  -d "feedback=Make it more dramatic and add a cliffhanger"
```

### Unit Tests
Create `backend/tests/test_script_service.py`:
```python
import pytest
from app.schemas.script import ScriptRequest, GeneratedScript, ScriptStyle


def test_script_request_validation():
    req = ScriptRequest(topic="Test topic", style=ScriptStyle.DOCUMENTARY, duration=60)
    assert req.topic == "Test topic"
    assert req.duration == 60


def test_script_request_duration_bounds():
    with pytest.raises(Exception):
        ScriptRequest(topic="Test", duration=5)  # Too short
    with pytest.raises(Exception):
        ScriptRequest(topic="Test", duration=1000)  # Too long


def test_generated_script_validation():
    data = {
        "title": "Test Script",
        "hook": "Did you know...",
        "style": "documentary",
        "target_duration": 60,
        "scenes": [
            {
                "scene_number": 1,
                "narration": "Test narration for scene one.",
                "duration_est": 8,
                "visual_description": "A wide shot of the ocean",
                "search_keywords": ["ocean", "waves", "sea"],
                "mood": "calm",
                "transition": "fade",
            }
        ],
        "outro": "Subscribe for more.",
        "metadata": {
            "total_duration_est": 8,
            "scene_count": 1,
            "word_count": 6,
            "reading_speed_wpm": 150,
        },
    }
    script = GeneratedScript(**data)
    assert script.title == "Test Script"
    assert len(script.scenes) == 1


def test_prompt_builder():
    from app.ai.prompts.script_prompts import build_script_user_prompt

    prompt = build_script_user_prompt(
        topic="Black holes",
        style="documentary",
        duration=60,
        audience="general",
        tone="engaging",
    )
    assert "Black holes" in prompt
    assert "documentary" in prompt.lower() or "Documentary" in prompt
    assert "150" in prompt  # target word count reference
```

## Verification Checklist
- [ ] Script generation returns valid JSON matching the Pydantic schema
- [ ] All 7 styles produce distinct script structures
- [ ] Scene narration word count approximates target duration at 150 WPM
- [ ] Search keywords are concrete Pexels-searchable terms
- [ ] Scene numbers are sequential starting from 1
- [ ] Hooks are attention-grabbing (first 3 seconds)
- [ ] Outros contain a call-to-action
- [ ] Scene rewrite produces a valid scene that fits contextually
- [ ] Content-to-script conversion preserves key information
- [ ] Scripts persist to PostgreSQL
- [ ] Script list and detail API endpoints work
- [ ] Retry logic handles malformed LLM output
- [ ] Celery task dispatches and completes successfully
- [ ] Response time < 30s for a 60-second script
