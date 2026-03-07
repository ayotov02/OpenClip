# OpenClip — Complete Backend Integration Plan
## Local (Open-Source) + Premium (API-Powered) — Dual Architecture

**Version:** 1.0
**Date:** March 7, 2026
**Status:** Planning
**Commit Strategy:** Small atomic commits per phase — one commit per feature unit

---

## 0. Brand Identity — The Core Context Layer

Brand Identity is not a feature — it is the **foundation memory** that every service in both backends reads from before doing anything. The onboarding wizard collects Brand DNA (name, niche, voice traits, target audience, goals, platforms, posting frequency, uniqueness, competitors, intelligence preferences) and persists it as a `BrandContext` object in PostgreSQL. Every AI call — clip scoring, script generation, caption styling, B-roll selection, title/description/hashtag generation, thumbnail prompts, publishing copy, trend analysis — receives the BrandContext as a system-level context injection. This means a Tech & AI channel with an "Educational, Professional, Data-driven" voice will get fundamentally different clip scores, script structures, and publishing copy than a Motivational channel with an "Energetic, Inspirational" voice. The BrandContext flows through the system as follows:

```
Onboarding Wizard (frontend)
  → POST /api/v1/brand-context (backend)
    → brand_contexts table (PostgreSQL)
      → Injected into every service call as context:
        ├── LLM prompts (clip scoring, scripts, titles, descriptions)
        ├── TTS voice selection defaults
        ├── Caption style defaults
        ├── B-roll mood/tone filtering
        ├── Thumbnail style prompts
        ├── Publishing copy generation
        ├── Competitor analysis framing
        └── Trend relevance scoring
```

### BrandContext Data Model

```python
class BrandContext(Base):
    __tablename__ = "brand_contexts"

    id: UUID
    user_id: FK(User)
    brand_name: str
    niche: str
    custom_niche: str | None
    voice_traits: list[str]          # max 3, e.g. ["Educational", "Professional", "Casual"]
    target_audience: str
    goals: list[str]                 # e.g. ["grow", "authority", "educate"]
    platforms: list[str]             # e.g. ["youtube", "tiktok", "instagram"]
    posting_frequency: str
    uniqueness: str
    competitors: list[dict]          # [{handle, platform}]
    intelligence_config: dict        # {scraping: bool, scrape_freq, trends, hashtags, performance}
    ai_summary: str | None           # LLM-generated brand summary
    tone_keywords: list[str]         # LLM-detected tone keywords
    content_pillars: list[dict]      # [{pillar, match_pct}]
    posting_schedule: dict           # {platform: suggested_times}
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

### BrandContext Injection Pattern

Every service that calls an LLM or makes creative decisions will call `get_brand_context(user_id)` and inject it into prompts:

```python
# Used by BOTH local and premium backends
def build_brand_system_prompt(ctx: BrandContext) -> str:
    return f"""You are creating content for "{ctx.brand_name}", a {ctx.niche} channel.
Voice: {', '.join(ctx.voice_traits)}.
Audience: {ctx.target_audience}.
Goals: {', '.join(ctx.goals)}.
Differentiator: {ctx.uniqueness}.
Platforms: {', '.join(ctx.platforms)} ({ctx.posting_frequency}).
Always match this brand's tone, vocabulary, and content style."""
```

---

## 1. Architecture — Shared Core, Swappable Providers

Both backends share the same API contract, database schema, Celery task signatures, and frontend. The only difference is the **provider layer** — which AI service handles each capability.

```
┌──────────────────────────────────────────────────┐
│              Frontend (Next.js 15)                │
│         100% shared — no code changes             │
│  NEXT_PUBLIC_API_URL=http://localhost:8000        │
│  (points to whichever backend is running)         │
└──────────────────────┬───────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
    ┌───────▼───────┐   ┌────────▼────────┐
    │  LOCAL BACKEND │   │ PREMIUM BACKEND  │
    │   (backend/)   │   │ (openclip-       │
    │                │   │  premium-backend/)│
    ├────────────────┤   ├─────────────────┤
    │ app/           │   │ app/             │
    │  api/v1/       │   │  api/v1/         │  ← IDENTICAL route signatures
    │  core/         │   │  core/           │
    │  models/       │   │  models/         │  ← IDENTICAL DB schema
    │  services/     │   │  services/       │  ← Business logic (shared)
    │  providers/    │   │  providers/      │  ← DIFFERENT (local vs API)
    │  tasks/        │   │  tasks/          │  ← IDENTICAL task signatures
    │  brand/        │   │  brand/          │  ← IDENTICAL brand context
    └────────────────┘   └─────────────────┘
```

### Provider Mapping: Local vs Premium

| Capability | Local Provider | Premium Provider |
|-----------|---------------|-----------------|
| **Auth** | Self-managed JWT + API keys | **Clerk** (managed auth, OAuth, teams) |
| **LLM** | Ollama (Qwen3-32B/14B) | **OpenRouter** (Claude 4.5, GPT-5, Gemini 3, auto-fallback) |
| **STT** | faster-whisper large-v3 + WhisperX | **ElevenLabs STT** via Kie.ai |
| **TTS** | Kokoro (fast) + Chatterbox (quality) | **ElevenLabs TTS** via Kie.ai (multi-voice, multilingual) |
| **Voice Cloning** | Chatterbox (local) | **ElevenLabs** via Kie.ai |
| **Image Gen** | FLUX.1 [schnell] (local GPU) | **Kie.ai** (GPT Image, Flux-2, Seedream, Imagen4, Ideogram) |
| **Video Gen** | Wan 2.1 T2V-1.3B (local GPU) | **Kie.ai** (Runway, Veo3.1, Kling 3.0, Sora2, Hailuo, Seedance) |
| **Music Gen** | MusicGen Medium (local GPU) | **Suno** via Kie.ai (lyrics, covers, mashups, vocals) |
| **Upscaling** | Real-ESRGAN (local GPU) | **Topaz** via Kie.ai (image + video upscale) |
| **Face Detection** | YOLO11 + MediaPipe (local) | YOLO11 + MediaPipe (local — no premium alternative needed) |
| **Speaker Diarization** | pyannote.audio (local) | pyannote.audio (local) or ElevenLabs STT diarization |
| **Segmentation** | SAM 2 (local GPU) | SAM 2 (local — no premium alternative needed) |
| **Frame Interp** | RIFE (local GPU) | Topaz via Kie.ai (video enhancement) |
| **Scraping** | Crawlee + Playwright (self-hosted) | **Bright Data** (SERP API, Browser API, Web Unlocker) |
| **B-Roll Stock** | Pexels API (free) | Pexels API (free) — same for both |
| **Video Processing** | FFmpeg (local) | FFmpeg (local) — same for both |
| **Video Assembly** | Remotion (local) | Remotion (local) — same for both |
| **Storage** | MinIO (self-hosted S3) | MinIO or S3/GCS |
| **Database** | PostgreSQL | PostgreSQL |
| **Queue** | Redis + Celery | Redis + Celery |

---

## 2. Shared Database Schema

Both backends use the **exact same** PostgreSQL schema. This enables data portability — a user could migrate from premium to local (or vice versa) by simply pointing at the same database.

### Tables (complete list)

```
brand_contexts          — Brand identity context layer (THE core table)
users                   — User accounts
projects                — Video clipping projects
clips                   — Generated clips from projects
faceless_projects       — Faceless video projects
faceless_scenes         — Individual scenes within faceless projects
brand_kits              — Visual brand kits (logos, colors, fonts, intros)
calendar_events         — Content calendar entries
publish_jobs            — Publishing queue entries
social_accounts         — Connected social media OAuth tokens
competitors             — Tracked competitor profiles
competitor_metrics      — Time-series engagement data
trending_topics         — Detected trends
hashtags                — Tracked hashtags with metrics
batch_jobs              — Bulk processing jobs
batch_items             — Individual items within batch jobs
creative_assets         — Generated images, videos, audio files
api_keys                — User-generated API keys
webhook_configs         — Webhook URL + event subscriptions
jobs                    — Async job tracking (all types)
```

### Key Relationships

```
User 1──* BrandContext (active one used as context layer)
User 1──* Project 1──* Clip
User 1──* FacelessProject 1──* FacelessScene
User 1──* BrandKit
User 1──* CalendarEvent
User 1──* PublishJob
User 1──* SocialAccount
User 1──* Competitor 1──* CompetitorMetric
User 1──* BatchJob 1──* BatchItem
User 1──* CreativeAsset
User 1──* ApiKey
User 1──* WebhookConfig
```

---

## 3. Local Backend — Implementation Plan

### Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app factory
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py           # Mounts all route groups
│   │       ├── auth.py             # JWT + API key auth
│   │       ├── brand_context.py    # Brand identity CRUD
│   │       ├── projects.py         # Clipping projects
│   │       ├── clips.py            # Clip operations
│   │       ├── faceless.py         # Faceless video projects
│   │       ├── brands.py           # Brand kit CRUD
│   │       ├── calendar.py         # Content calendar
│   │       ├── publish.py          # Publishing queue
│   │       ├── analytics.py        # Performance analytics
│   │       ├── competitors.py      # Competitor management
│   │       ├── trends.py           # Trending topics
│   │       ├── hashtags.py         # Hashtag tracking
│   │       ├── batch.py            # Batch processing
│   │       ├── assets.py           # Creative assets
│   │       ├── settings.py         # API keys, webhooks, social accounts
│   │       ├── chat.py             # AI chat (4 modes)
│   │       ├── jobs.py             # Job status + WebSocket
│   │       └── health.py           # Health checks
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py               # Environment config
│   │   ├── security.py             # JWT, API key validation
│   │   ├── database.py             # SQLAlchemy engine + session
│   │   ├── redis.py                # Redis connection
│   │   ├── storage.py              # MinIO/S3 client
│   │   ├── websocket.py            # WebSocket manager
│   │   ├── rate_limit.py           # Rate limiting
│   │   └── dependencies.py         # FastAPI dependency injection
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── brand_context.py        # Brand identity context
│   │   ├── project.py
│   │   ├── clip.py
│   │   ├── faceless.py
│   │   ├── brand_kit.py
│   │   ├── calendar.py
│   │   ├── publish.py
│   │   ├── social_account.py
│   │   ├── competitor.py
│   │   ├── trend.py
│   │   ├── hashtag.py
│   │   ├── batch.py
│   │   ├── asset.py
│   │   ├── api_key.py
│   │   ├── webhook.py
│   │   └── job.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── (Pydantic schemas mirroring models — request/response)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── brand_context_service.py  # Brand context CRUD + injection
│   │   ├── project_service.py        # Project lifecycle
│   │   ├── clip_service.py           # Clip scoring + generation
│   │   ├── faceless_service.py       # Faceless pipeline orchestration
│   │   ├── brand_kit_service.py      # Brand kit management
│   │   ├── caption_service.py        # Caption generation + styles
│   │   ├── reframe_service.py        # AI reframing orchestration
│   │   ├── broll_service.py          # B-roll search + scoring
│   │   ├── calendar_service.py       # Calendar CRUD
│   │   ├── publish_service.py        # Publishing orchestration
│   │   ├── analytics_service.py      # Metrics aggregation
│   │   ├── competitor_service.py     # Competitor tracking
│   │   ├── trend_service.py          # Trend detection
│   │   ├── hashtag_service.py        # Hashtag analysis
│   │   ├── batch_service.py          # Batch job management
│   │   ├── asset_service.py          # Creative asset management
│   │   └── webhook_service.py        # Webhook dispatch
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                   # Abstract provider interfaces
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # LLMProvider ABC
│   │   │   └── ollama.py            # Ollama (Qwen3) — LOCAL
│   │   ├── stt/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # STTProvider ABC
│   │   │   └── whisperx.py          # WhisperX — LOCAL
│   │   ├── tts/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # TTSProvider ABC
│   │   │   ├── kokoro.py            # Kokoro — LOCAL
│   │   │   └── chatterbox.py        # Chatterbox — LOCAL
│   │   ├── image_gen/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # ImageGenProvider ABC
│   │   │   └── flux.py              # FLUX.1 schnell — LOCAL
│   │   ├── video_gen/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # VideoGenProvider ABC
│   │   │   └── wan.py               # Wan 2.1 — LOCAL
│   │   ├── music_gen/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # MusicGenProvider ABC
│   │   │   └── musicgen.py          # MusicGen Medium — LOCAL
│   │   ├── cv/
│   │   │   ├── __init__.py
│   │   │   ├── yolo.py              # YOLO11 face detection
│   │   │   ├── mediapipe_tracker.py  # MediaPipe 468-point tracking
│   │   │   ├── pyannote.py          # Speaker diarization
│   │   │   └── sam2.py              # SAM 2 segmentation
│   │   ├── scraping/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # ScrapingProvider ABC
│   │   │   └── crawlee.py           # Crawlee + Playwright — LOCAL
│   │   ├── upscaling/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # UpscalingProvider ABC
│   │   │   └── realesrgan.py        # Real-ESRGAN — LOCAL
│   │   └── video_processing/
│   │       ├── __init__.py
│   │       ├── ffmpeg.py            # FFmpeg operations
│   │       └── remotion.py          # Remotion rendering
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── celery_app.py            # Celery configuration
│   │   ├── video_tasks.py           # Video processing tasks
│   │   ├── ai_tasks.py              # AI inference tasks
│   │   ├── faceless_tasks.py        # Faceless pipeline tasks
│   │   ├── publish_tasks.py         # Publishing tasks
│   │   ├── scrape_tasks.py          # Scraping tasks
│   │   └── batch_tasks.py           # Batch processing tasks
│   └── brand/
│       ├── __init__.py
│       ├── context.py               # BrandContext loader + cache
│       └── prompt_builder.py        # Brand-aware prompt templates
├── alembic/                          # DB migrations
├── tests/
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

### Local Backend Phases (with commit boundaries)

#### Phase L1: Foundation Scaffold (commits 1-9)

```
Commit 1:  "feat(backend): init FastAPI project with config and dependencies"
           - app/main.py, app/core/config.py, requirements.txt, pyproject.toml

Commit 2:  "feat(backend): add database models and Alembic migrations"
           - app/models/*, app/core/database.py, alembic/

Commit 3:  "feat(backend): add brand_context model and schema"
           - app/models/brand_context.py, app/schemas/brand_context.py
           - Migration for brand_contexts table

Commit 4:  "feat(backend): add JWT auth, API key auth, and security"
           - app/core/security.py, app/api/v1/auth.py

Commit 5:  "feat(backend): add brand context API with CRUD endpoints"
           - app/api/v1/brand_context.py, app/services/brand_context_service.py
           - app/brand/context.py, app/brand/prompt_builder.py

Commit 6:  "feat(backend): add Redis, MinIO, and WebSocket core"
           - app/core/redis.py, app/core/storage.py, app/core/websocket.py

Commit 7:  "feat(backend): add Celery job queue with task routing"
           - app/tasks/celery_app.py, app/core/dependencies.py

Commit 8:  "feat(backend): add provider base classes (ABC interfaces)"
           - app/providers/base.py, app/providers/llm/base.py,
           - app/providers/stt/base.py, app/providers/tts/base.py, etc.

Commit 9:  "feat(backend): add health check and API router mounting"
           - app/api/v1/router.py, app/api/v1/health.py
```

#### Phase L2: AI Provider Integration (commits 10-17)

```
Commit 10: "feat(backend): add Ollama LLM provider (Qwen3)"
           - app/providers/llm/ollama.py
           - Brand context injection into all LLM prompts

Commit 11: "feat(backend): add WhisperX STT provider"
           - app/providers/stt/whisperx.py

Commit 12: "feat(backend): add Kokoro and Chatterbox TTS providers"
           - app/providers/tts/kokoro.py, app/providers/tts/chatterbox.py

Commit 13: "feat(backend): add YOLO, MediaPipe, pyannote CV providers"
           - app/providers/cv/yolo.py, mediapipe_tracker.py, pyannote.py

Commit 14: "feat(backend): add FLUX.1 image generation provider"
           - app/providers/image_gen/flux.py

Commit 15: "feat(backend): add Wan 2.1 video generation provider"
           - app/providers/video_gen/wan.py

Commit 16: "feat(backend): add MusicGen music generation provider"
           - app/providers/music_gen/musicgen.py

Commit 17: "feat(backend): add FFmpeg and Remotion video processing"
           - app/providers/video_processing/ffmpeg.py, remotion.py
```

#### Phase L3: Core Feature Services (commits 18-27)

```
Commit 18: "feat(backend): add project API with upload and URL input"
           - app/api/v1/projects.py, app/services/project_service.py

Commit 19: "feat(backend): add clip scoring and generation pipeline"
           - app/api/v1/clips.py, app/services/clip_service.py
           - app/tasks/video_tasks.py (transcribe → score → cut → export)

Commit 20: "feat(backend): add caption system with 7+ style presets"
           - app/services/caption_service.py

Commit 21: "feat(backend): add AI reframing with face tracking"
           - app/services/reframe_service.py

Commit 22: "feat(backend): add faceless video API and pipeline"
           - app/api/v1/faceless.py, app/services/faceless_service.py
           - app/tasks/faceless_tasks.py

Commit 23: "feat(backend): add B-roll search, scoring, and matching"
           - app/services/broll_service.py

Commit 24: "feat(backend): add brand kit CRUD API"
           - app/api/v1/brands.py, app/services/brand_kit_service.py

Commit 25: "feat(backend): add creative assets API"
           - app/api/v1/assets.py, app/services/asset_service.py

Commit 26: "feat(backend): add AI chat endpoints (4 modes)"
           - app/api/v1/chat.py (create, generate, compose, research)
           - All modes inject BrandContext

Commit 27: "feat(backend): add filler word and silence removal"
           - Integrated into clip_service via WhisperX classification
```

#### Phase L4: Distribution (commits 28-35)

```
Commit 28: "feat(backend): add social account OAuth integration"
           - app/api/v1/settings.py (social accounts section)

Commit 29: "feat(backend): add content calendar API"
           - app/api/v1/calendar.py, app/services/calendar_service.py

Commit 30: "feat(backend): add publishing queue and auto-posting"
           - app/api/v1/publish.py, app/services/publish_service.py
           - app/tasks/publish_tasks.py

Commit 31: "feat(backend): add Crawlee scraping engine"
           - app/providers/scraping/crawlee.py
           - app/tasks/scrape_tasks.py

Commit 32: "feat(backend): add competitor analytics API"
           - app/api/v1/competitors.py, app/services/competitor_service.py

Commit 33: "feat(backend): add trend detection and hashtag analysis"
           - app/api/v1/trends.py, app/api/v1/hashtags.py
           - app/services/trend_service.py, app/services/hashtag_service.py

Commit 34: "feat(backend): add performance analytics API"
           - app/api/v1/analytics.py, app/services/analytics_service.py

Commit 35: "feat(backend): add webhook system and batch processing"
           - app/api/v1/batch.py, app/services/batch_service.py
           - app/services/webhook_service.py, app/tasks/batch_tasks.py
```

#### Phase L5: Advanced + Docker (commits 36-40)

```
Commit 36: "feat(backend): add voice cloning via Chatterbox"
           - Extended TTS provider with clone endpoint

Commit 37: "feat(backend): add Real-ESRGAN upscaling and RIFE interpolation"
           - app/providers/upscaling/realesrgan.py

Commit 38: "feat(backend): add SAM 2 segmentation provider"
           - app/providers/cv/sam2.py

Commit 39: "feat(backend): add job status API with WebSocket progress"
           - app/api/v1/jobs.py with WebSocket upgrade

Commit 40: "feat(backend): add Docker Compose with all services"
           - Dockerfile, docker-compose.yml, docker-compose.dev.yml
           - Health checks, GPU passthrough, volume mounts
```

---

## 4. Premium Backend — Implementation Plan

### Directory Structure

```
openclip-premium-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app factory
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py           # IDENTICAL route signatures to local
│   │       ├── auth.py             # Clerk auth middleware
│   │       ├── brand_context.py    # IDENTICAL — brand identity CRUD
│   │       ├── projects.py         # IDENTICAL API contract
│   │       ├── clips.py
│   │       ├── faceless.py
│   │       ├── brands.py
│   │       ├── calendar.py
│   │       ├── publish.py
│   │       ├── analytics.py
│   │       ├── competitors.py
│   │       ├── trends.py
│   │       ├── hashtags.py
│   │       ├── batch.py
│   │       ├── assets.py
│   │       ├── settings.py
│   │       ├── chat.py
│   │       ├── jobs.py
│   │       └── health.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py               # Premium-specific env vars
│   │   ├── clerk.py                # Clerk JWT verification middleware
│   │   ├── database.py             # IDENTICAL
│   │   ├── redis.py                # IDENTICAL
│   │   ├── storage.py              # IDENTICAL
│   │   ├── websocket.py            # IDENTICAL
│   │   ├── rate_limit.py           # IDENTICAL
│   │   └── dependencies.py
│   ├── models/                     # IDENTICAL to local — same DB schema
│   │   └── (exact same files)
│   ├── schemas/                    # IDENTICAL to local
│   │   └── (exact same files)
│   ├── services/                   # IDENTICAL business logic
│   │   └── (exact same files)
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                 # IDENTICAL interfaces
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── openrouter.py       # OpenRouter — PREMIUM
│   │   ├── stt/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── elevenlabs_stt.py   # ElevenLabs STT via Kie.ai — PREMIUM
│   │   ├── tts/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── elevenlabs_tts.py   # ElevenLabs TTS via Kie.ai — PREMIUM
│   │   ├── image_gen/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── kieai_image.py      # GPT Image/Flux-2/Seedream/Imagen4 — PREMIUM
│   │   ├── video_gen/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── kieai_video.py      # Runway/Veo3.1/Kling/Sora2 — PREMIUM
│   │   ├── music_gen/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── kieai_suno.py       # Suno via Kie.ai — PREMIUM
│   │   ├── cv/
│   │   │   ├── __init__.py
│   │   │   ├── yolo.py             # IDENTICAL — stays local
│   │   │   ├── mediapipe_tracker.py # IDENTICAL — stays local
│   │   │   ├── pyannote.py         # IDENTICAL — stays local
│   │   │   └── sam2.py             # IDENTICAL — stays local
│   │   ├── scraping/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── brightdata.py       # Bright Data — PREMIUM
│   │   ├── upscaling/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # IDENTICAL
│   │   │   └── kieai_topaz.py      # Topaz via Kie.ai — PREMIUM
│   │   └── video_processing/
│   │       ├── __init__.py
│   │       ├── ffmpeg.py           # IDENTICAL — stays local
│   │       └── remotion.py         # IDENTICAL — stays local
│   ├── tasks/                      # IDENTICAL task signatures
│   │   └── (exact same files)
│   └── brand/                      # IDENTICAL brand context
│       └── (exact same files)
├── alembic/                        # IDENTICAL migrations
├── tests/
├── requirements.txt                # Different deps (openrouter SDK, clerk, etc.)
├── Dockerfile                      # Simpler — no GPU needed
└── docker-compose.yml              # Simpler — fewer services
```

### Premium Backend Phases (with commit boundaries)

#### Phase P1: Foundation + Clerk Auth (commits 1-7)

```
Commit 1:  "feat(premium): init FastAPI project with premium config"
           - app/main.py, app/core/config.py
           - Environment: OPENROUTER_API_KEY, KIEAI_API_KEY,
             BRIGHTDATA_API_KEY, CLERK_SECRET_KEY, etc.

Commit 2:  "feat(premium): add Clerk auth middleware and user sync"
           - app/core/clerk.py — JWT verification, user creation on first login
           - app/api/v1/auth.py — Clerk webhook for user lifecycle

Commit 3:  "feat(premium): add database models (shared schema)"
           - IDENTICAL models to local, including brand_contexts

Commit 4:  "feat(premium): add brand context API (shared)"
           - IDENTICAL to local — BrandContext CRUD

Commit 5:  "feat(premium): add provider base classes (shared ABCs)"
           - IDENTICAL interfaces

Commit 6:  "feat(premium): add Redis, storage, WebSocket, Celery core"
           - IDENTICAL infrastructure code

Commit 7:  "feat(premium): add API router mounting and health checks"
           - IDENTICAL route structure
```

#### Phase P2: Premium Provider Integration (commits 8-15)

```
Commit 8:  "feat(premium): add OpenRouter LLM provider"
           - app/providers/llm/openrouter.py
           - Model fallback chain: Claude Sonnet 4.5 → GPT-5 → Gemini 3 Pro
           - Structured outputs, tool calling, streaming
           - Brand context injection into all prompts

Commit 9:  "feat(premium): add ElevenLabs STT provider via Kie.ai"
           - app/providers/stt/elevenlabs_stt.py
           - Kie.ai task-create → poll/callback → download pattern

Commit 10: "feat(premium): add ElevenLabs TTS provider via Kie.ai"
           - app/providers/tts/elevenlabs_tts.py
           - Multi-voice, multilingual, voice cloning
           - Turbo 2.5 for speed, Multilingual V2 for quality

Commit 11: "feat(premium): add Kie.ai image generation provider"
           - app/providers/image_gen/kieai_image.py
           - GPT Image 1.5, Flux-2 Pro, Seedream 4.5, Imagen4, Ideogram
           - User selects model or auto-selects based on use case

Commit 12: "feat(premium): add Kie.ai video generation provider"
           - app/providers/video_gen/kieai_video.py
           - Runway Gen-3, Veo3.1, Kling 3.0, Sora2, Hailuo 2.3, Seedance 1.5
           - Text-to-video, image-to-video, video-to-video
           - Async callback handling with webhook verification

Commit 13: "feat(premium): add Suno music generation via Kie.ai"
           - app/providers/music_gen/kieai_suno.py
           - Generate music, extend, cover, mashup, lyrics
           - Vocal/instrumental separation, MIDI export

Commit 14: "feat(premium): add Topaz upscaling via Kie.ai"
           - app/providers/upscaling/kieai_topaz.py
           - Image upscale, video upscale

Commit 15: "feat(premium): add Bright Data scraping provider"
           - app/providers/scraping/brightdata.py
           - SERP API for search-based research
           - Browser API for social media scraping (CAPTCHA solving)
           - Web Unlocker for anti-bot bypass
           - Web Archive for historical trend analysis
```

#### Phase P3: Feature Services (commits 16-23)

```
Commit 16: "feat(premium): add project and clip APIs"
           - IDENTICAL route handlers, different provider calls

Commit 17: "feat(premium): add faceless video pipeline"
           - Same orchestration, premium providers for TTS/image/video/music

Commit 18: "feat(premium): add AI chat endpoints (4 modes)"
           - OpenRouter-powered chat with brand context
           - Create: Claude for script/video planning
           - Generate: Triggers Kie.ai image gen
           - Compose: Triggers ElevenLabs TTS
           - Research: OpenRouter + Bright Data deep research

Commit 19: "feat(premium): add caption system and reframing"
           - Captions via ElevenLabs STT (premium accuracy)
           - Reframing stays local (YOLO + MediaPipe)

Commit 20: "feat(premium): add brand kit, B-roll, and creative assets"
           - Brand kit CRUD (shared)
           - B-roll: same Pexels integration
           - Assets: Kie.ai generated images/videos/audio tracked

Commit 21: "feat(premium): add publishing, calendar, and social auth"
           - IDENTICAL to local

Commit 22: "feat(premium): add competitor scraping via Bright Data"
           - Bright Data Browser API for YouTube/TikTok/IG/X/LinkedIn
           - LLM grounding for fact-checking scraped data
           - Deep research for market analysis

Commit 23: "feat(premium): add analytics, trends, hashtags, batch"
           - Trend detection via OpenRouter + Bright Data SERP
           - Hashtag analysis via Bright Data search
           - Batch processing orchestrating premium providers
```

#### Phase P4: Infrastructure (commits 24-27)

```
Commit 24: "feat(premium): add Kie.ai webhook handler for async callbacks"
           - /api/v1/webhooks/kieai endpoint
           - Webhook signature verification
           - Task status updates on callback receipt

Commit 25: "feat(premium): add credit tracking and usage metering"
           - Track OpenRouter token usage, Kie.ai credits, Bright Data usage
           - Display in settings/instance page

Commit 26: "feat(premium): add Docker Compose (no GPU required)"
           - Simplified stack: API, worker, postgres, redis, minio, caddy
           - No ollama, no whisper, no tts GPU services

Commit 27: "feat(premium): add environment template and deployment docs"
           - .env.example with all premium API keys
           - docker-compose.yml, Dockerfile
```

---

## 5. Provider Interface Contracts (ABCs)

Every AI capability is defined as an abstract base class. Both backends implement the same interface.

```python
# app/providers/llm/base.py
from abc import ABC, abstractmethod
from app.brand.context import BrandContext

class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict], brand_ctx: BrandContext | None = None,
                   temperature: float = 0.7, max_tokens: int = 4096,
                   response_format: dict | None = None) -> str: ...

    @abstractmethod
    async def chat_stream(self, messages: list[dict], brand_ctx: BrandContext | None = None,
                          temperature: float = 0.7) -> AsyncIterator[str]: ...

    @abstractmethod
    async def score_clips(self, transcript: str, brand_ctx: BrandContext) -> list[dict]: ...

    @abstractmethod
    async def generate_script(self, topic: str, template: str,
                              brand_ctx: BrandContext) -> dict: ...

    @abstractmethod
    async def generate_broll_queries(self, narration: str,
                                     brand_ctx: BrandContext) -> list[str]: ...

    @abstractmethod
    async def generate_publish_copy(self, clip_title: str, transcript: str,
                                    platform: str, brand_ctx: BrandContext) -> dict: ...


# app/providers/stt/base.py
class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str, language: str = "en",
                         diarize: bool = True) -> dict: ...

    @abstractmethod
    async def align(self, audio_path: str, transcript: str) -> list[dict]: ...


# app/providers/tts/base.py
class TTSProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, voice: str,
                         speed: float = 1.0) -> bytes: ...

    @abstractmethod
    async def list_voices(self) -> list[dict]: ...

    @abstractmethod
    async def clone_voice(self, text: str, reference_audio: str) -> bytes: ...


# app/providers/image_gen/base.py
class ImageGenProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, width: int = 1280,
                       height: int = 720, model: str | None = None) -> str: ...

    @abstractmethod
    async def generate_thumbnail(self, prompt: str, style: str = "youtube",
                                 text_overlay: str | None = None) -> str: ...


# app/providers/video_gen/base.py
class VideoGenProvider(ABC):
    @abstractmethod
    async def text_to_video(self, prompt: str, duration: int = 5,
                            model: str | None = None) -> str: ...

    @abstractmethod
    async def image_to_video(self, image_url: str, prompt: str,
                             model: str | None = None) -> str: ...


# app/providers/music_gen/base.py
class MusicGenProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, duration: int = 30,
                       mood: str | None = None) -> str: ...


# app/providers/scraping/base.py
class ScrapingProvider(ABC):
    @abstractmethod
    async def scrape_profile(self, platform: str, handle: str) -> dict: ...

    @abstractmethod
    async def scrape_posts(self, platform: str, handle: str,
                           limit: int = 20) -> list[dict]: ...

    @abstractmethod
    async def search_web(self, query: str, limit: int = 10) -> list[dict]: ...


# app/providers/upscaling/base.py
class UpscalingProvider(ABC):
    @abstractmethod
    async def upscale_image(self, image_path: str, scale: int = 2) -> str: ...

    @abstractmethod
    async def upscale_video(self, video_path: str, target_resolution: str = "4k") -> str: ...
```

---

## 6. Environment Configuration

### Local Backend (.env)

```bash
# Core
APP_MODE=local
DATABASE_URL=postgresql+asyncpg://openclip:password@localhost:5432/openclip
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=openclip
MINIO_SECRET_KEY=openclip-secret
JWT_SECRET=your-secret-key

# AI Services (local endpoints)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:32b
WHISPER_SERVICE_URL=http://localhost:8001
TTS_SERVICE_URL=http://localhost:8002
CV_SERVICE_URL=http://localhost:8003
FLUX_SERVICE_URL=http://localhost:8004
MUSICGEN_SERVICE_URL=http://localhost:8005

# External (free)
PEXELS_API_KEY=your-pexels-key
```

### Premium Backend (.env)

```bash
# Core
APP_MODE=premium
DATABASE_URL=postgresql+asyncpg://openclip:password@localhost:5432/openclip
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=openclip
MINIO_SECRET_KEY=openclip-secret

# Auth (Clerk)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# LLM (OpenRouter)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_DEFAULT_MODEL=anthropic/claude-sonnet-4.5
OPENROUTER_FALLBACK_MODELS=openai/gpt-5,google/gemini-3-pro

# Media Generation (Kie.ai)
KIEAI_API_KEY=your-kieai-key
KIEAI_WEBHOOK_URL=https://your-domain.com/api/v1/webhooks/kieai
KIEAI_DEFAULT_IMAGE_MODEL=gpt-image/1-5-text-to-image
KIEAI_DEFAULT_VIDEO_MODEL=runway-api/generate-ai-video
KIEAI_DEFAULT_TTS_MODEL=elevenlabs/text-to-speech-turbo-2-5
KIEAI_DEFAULT_MUSIC_MODEL=suno-api/generate-music

# Scraping (Bright Data)
BRIGHTDATA_API_KEY=your-brightdata-key
BRIGHTDATA_SERP_ZONE=serp_zone
BRIGHTDATA_BROWSER_ZONE=browser_zone
BRIGHTDATA_UNLOCKER_ZONE=unlocker_zone

# External (free)
PEXELS_API_KEY=your-pexels-key
```

---

## 7. Kie.ai Async Task Pattern

Kie.ai uses an async callback pattern for all media generation. Both text-to-video, image generation, music generation, and upscaling follow this flow:

```
1. POST task to Kie.ai → receive taskId
2. Either:
   a. Poll GET /task/{taskId} until status = "completed"
   b. Receive webhook callback at KIEAI_WEBHOOK_URL
3. Download result from returned URL
4. Upload to MinIO
5. Update job status in PostgreSQL
```

```python
# app/providers/video_gen/kieai_video.py (simplified)
class KieaiVideoProvider(VideoGenProvider):
    async def text_to_video(self, prompt: str, duration: int = 5,
                            model: str | None = None) -> str:
        model = model or self.config.default_video_model
        response = await self.client.post(f"/market/{model}", json={
            "prompt": prompt,
            "duration": duration,
            "callbackUrl": self.config.webhook_url,
        })
        task_id = response.json()["taskId"]

        # Store task_id → job_id mapping in Redis for callback resolution
        await self.redis.set(f"kieai:task:{task_id}", job_id, ex=3600)

        # Poll or wait for callback
        result = await self._wait_for_completion(task_id)
        return result["output_url"]
```

---

## 8. OpenRouter LLM Integration

```python
# app/providers/llm/openrouter.py (simplified)
class OpenRouterProvider(LLMProvider):
    async def chat(self, messages: list[dict], brand_ctx: BrandContext | None = None,
                   temperature: float = 0.7, max_tokens: int = 4096,
                   response_format: dict | None = None) -> str:

        # Inject brand context as system message
        if brand_ctx:
            brand_system = build_brand_system_prompt(brand_ctx)
            messages = [{"role": "system", "content": brand_system}] + messages

        response = await self.client.post("/chat/completions", json={
            "model": self.config.default_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": response_format,
            # OpenRouter-specific: fallback chain
            "route": "fallback",
            "models": [
                self.config.default_model,
                *self.config.fallback_models,
            ],
        })
        return response.json()["choices"][0]["message"]["content"]

    async def score_clips(self, transcript: str, brand_ctx: BrandContext) -> list[dict]:
        system = build_brand_system_prompt(brand_ctx)
        prompt = f"""Analyze this transcript and identify the top 10 most engaging
        segments for {brand_ctx.brand_name}'s audience.

        Score each on: hook_strength, emotional_peak, info_density, self_contained (0-100).
        Consider the brand's voice: {', '.join(brand_ctx.voice_traits)}.

        Return JSON array: [{{start_time, end_time, score, title, reason}}]

        Transcript:
        {transcript}"""

        return await self.chat(
            [{"role": "user", "content": prompt}],
            brand_ctx=brand_ctx,
            response_format={"type": "json_object"},
        )
```

---

## 9. Bright Data Scraping Integration

```python
# app/providers/scraping/brightdata.py (simplified)
class BrightDataProvider(ScrapingProvider):
    async def scrape_profile(self, platform: str, handle: str) -> dict:
        """Use Browser API for anti-bot-protected social platforms."""
        url = self._build_profile_url(platform, handle)
        response = await self.client.post("/browser", json={
            "zone": self.config.browser_zone,
            "url": url,
            "format": "json",
            "wait_for": ".profile-header",  # platform-specific selector
        })
        return self._parse_profile(platform, response.json())

    async def search_web(self, query: str, limit: int = 10) -> list[dict]:
        """Use SERP API for web search — used by Research AI mode."""
        response = await self.client.post("/serp", json={
            "zone": self.config.serp_zone,
            "query": query,
            "num": limit,
        })
        return response.json()["results"]
```

---

## 10. Clerk Auth Integration

```python
# app/core/clerk.py
from clerk_backend_api import Clerk

clerk = Clerk(api_key=settings.CLERK_SECRET_KEY)

async def verify_clerk_token(request: Request) -> dict:
    """Middleware: verify Clerk JWT and return user data."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    session = clerk.sessions.verify_token(token)
    user = clerk.users.get(session.user_id)

    # Auto-create local user on first login
    db_user = await get_or_create_user(
        clerk_id=user.id,
        email=user.email_addresses[0].email_address,
        name=f"{user.first_name} {user.last_name}",
    )
    return db_user
```

---

## 11. Docker Compose Comparison

### Local (GPU required)

```yaml
services:
  api:          # FastAPI
  worker:       # Celery (GPU)
  ollama:       # Qwen3 LLM (GPU)
  whisper:      # WhisperX STT (GPU)
  tts:          # Kokoro/Chatterbox (GPU)
  cv:           # YOLO + MediaPipe (GPU)
  postgres:     # PostgreSQL
  redis:        # Redis
  minio:        # Object storage
  caddy:        # Reverse proxy
# Total: 10 services, requires GPU
```

### Premium (no GPU)

```yaml
services:
  api:          # FastAPI
  worker:       # Celery (I/O-bound, no GPU)
  postgres:     # PostgreSQL
  redis:        # Redis
  minio:        # Object storage
  caddy:        # Reverse proxy
# Total: 6 services, runs on a $5/month VPS
```

---

## 12. Frontend Integration Points

The frontend already expects these data contracts. Both backends must return identical response shapes.

| Frontend Page | API Endpoints Required |
|--------------|----------------------|
| `/onboarding` | `POST /brand-context`, `PUT /brand-context/{id}` |
| `/dashboard` | `GET /projects?limit=4`, `GET /jobs?status=running`, `GET /analytics/summary` |
| `/dashboard/projects` | `GET /projects`, `POST /projects` |
| `/dashboard/projects/[id]` | `GET /projects/{id}`, `GET /projects/{id}/clips` |
| `/dashboard/faceless` | `GET /faceless`, `POST /faceless` |
| `/dashboard/faceless/[id]` | `GET /faceless/{id}`, `PUT /faceless/{id}` |
| `/dashboard/brands` | `GET /brands`, `POST /brands`, `DELETE /brands/{id}` |
| `/dashboard/calendar` | `GET /calendar/events`, `POST /calendar/events` |
| `/dashboard/publish` | `GET /publish`, `POST /publish` |
| `/dashboard/analytics` | `GET /analytics/performance`, `GET /analytics/competitors`, `GET /analytics/trends`, `GET /analytics/hashtags` |
| `/dashboard/settings` | `GET /settings/api-keys`, `GET /settings/social-accounts`, `GET /settings/webhooks`, `GET /settings/instance` |
| `/dashboard/batch` | `GET /batch`, `POST /batch` |
| `/dashboard/assets` | `GET /assets` |
| `/dashboard/create` | `POST /chat` (mode: create) |
| `/dashboard/generate` | `POST /chat` (mode: generate) |
| `/dashboard/compose` | `POST /chat` (mode: compose) |
| `/dashboard/research` | `POST /chat` (mode: research) |

---

## 13. Implementation Order — What Gets Built First

### Recommended Sequence

```
Phase 1 — BOTH: Foundation scaffold (FastAPI, models, brand context, auth)
  ↓
Phase 2 — LOCAL: AI provider integration (Ollama, WhisperX, Kokoro, YOLO, FLUX, MusicGen, Wan)
Phase 2 — PREMIUM: API provider integration (OpenRouter, Kie.ai, Bright Data, Clerk)
  ↓ (these run in PARALLEL — different repos, same interfaces)
Phase 3 — BOTH: Core feature services (projects, clips, faceless, brands, captions, reframing, B-roll)
  ↓
Phase 4 — BOTH: Distribution (publishing, calendar, scraping, analytics, trends, hashtags)
  ↓
Phase 5 — BOTH: Polish (batch, voice cloning, upscaling, WebSocket, Docker)
```

### Shared Code Strategy

These files are **copied** between repos (not a monorepo — keeps deployment simple):

- `app/models/*` — all database models
- `app/schemas/*` — all Pydantic schemas
- `app/services/*` — all business logic
- `app/providers/base.py` — all ABC interfaces
- `app/providers/cv/*` — CV stays local in both
- `app/providers/video_processing/*` — FFmpeg/Remotion stays local in both
- `app/brand/*` — brand context system
- `app/tasks/*` — Celery task signatures
- `alembic/*` — database migrations

These files are **different** per repo:

- `app/core/config.py` — different env vars
- `app/core/security.py` (local) vs `app/core/clerk.py` (premium) — different auth
- `app/providers/llm/` — ollama.py vs openrouter.py
- `app/providers/stt/` — whisperx.py vs elevenlabs_stt.py
- `app/providers/tts/` — kokoro.py/chatterbox.py vs elevenlabs_tts.py
- `app/providers/image_gen/` — flux.py vs kieai_image.py
- `app/providers/video_gen/` — wan.py vs kieai_video.py
- `app/providers/music_gen/` — musicgen.py vs kieai_suno.py
- `app/providers/scraping/` — crawlee.py vs brightdata.py
- `app/providers/upscaling/` — realesrgan.py vs kieai_topaz.py
- `Dockerfile` — GPU vs no-GPU
- `docker-compose.yml` — 10 services vs 6 services
- `requirements.txt` — different dependencies

---

## 14. Commit Discipline

Every commit follows this pattern:

```
feat(<scope>): <imperative description>

<scope> = backend | premium | shared | models | providers | api | tasks | brand
```

Rules:
1. One logical unit per commit — never mix two features
2. Every commit must pass linting (ruff) and type checking (mypy)
3. Database migrations get their own commit
4. Provider implementations get their own commit (one per provider)
5. API route groups get their own commit
6. Tests follow immediately after the feature they test
7. Never commit secrets or `.env` files

---

## 15. Summary

This integration plan establishes two parallel backends — **local** (fully open-source, GPU-required, zero API costs) and **premium** (API-powered, no GPU, premium model quality) — that share 100% of the frontend, database schema, business logic, and task signatures. The **BrandContext** is the foundational memory layer that every AI operation reads from, ensuring all generated content is tonally consistent, audience-appropriate, and aligned with the creator's goals. The provider abstraction (ABC interfaces) makes swapping between local and premium a configuration change, not a code change. Small atomic commits per feature ensure clean git history and reviewable diffs at every step.
