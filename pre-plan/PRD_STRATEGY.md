# Product Requirements Document (PRD)
## OpenClip: Open-Source AI Video Creation Platform

**Version:** 1.0
**Date:** March 2, 2026
**Status:** Draft

---

## 1. Product Vision

**Mission:** Democratize video creation by building the world's first fully open-source, self-hosted AI video platform that replaces $15-99/month SaaS subscriptions with zero-cost, locally-hosted open-source models.

**One-liner:** "OpusClip, but free, open-source, and self-hosted -- powered entirely by local AI models."

**Key Differentiators:**
1. Zero paid API dependencies (all AI runs locally via open-source models)
2. Self-hosted via Docker (data never leaves your machine)
3. No watermarks, no credit systems, no dark patterns
4. Full REST API for developers
5. Faceless video creation built-in
6. Competitor scraping/intelligence built-in

---

## 2. Target Users

### Primary Personas

| Persona | Description | Pain Point | Our Solution |
|---------|-------------|------------|-------------|
| **Solo Creator** | YouTube/TikTok creator, 1K-100K subscribers | Paying $30+/mo for video tools, frustrated by AI quality | Free, reliable clipping + captions + scheduling |
| **Faceless Creator** | Runs 3-10 faceless channels, no camera | Fragmented tools, manual pipeline, expensive TTS | End-to-end faceless video pipeline |
| **Developer** | Builds video tools or integrations | No open API, locked into vendor ecosystems | Full REST API + self-hosted |
| **Agency** | Manages 10+ client channels | Per-seat pricing adds up, needs brand kits | Multi-brand support, bulk processing |
| **Privacy-Conscious** | Doesn't want content on third-party servers | Every competitor is cloud-only | Self-hosted, data sovereign |

### Market Size
- Creator economy: $214B (2026), $1.35T by 2035
- 38% of new creators go faceless
- 73% of marketers use AI video tools

---

## 3. Architecture Overview

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React/Next.js)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Dashboard │ │  Editor  │ │ Faceless │ │ Analytics│   │
│  │           │ │ Timeline │ │  Studio  │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ REST API / WebSocket
┌────────────────────────┴────────────────────────────────┐
│                   API Gateway (FastAPI)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Auth    │ │  Jobs    │ │  Assets  │ │ Webhooks │   │
│  │  Module  │ │  Queue   │ │  Manager │ │  Manager │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                   Processing Layer                        │
│                                                           │
│  ┌─────────────────────────────────────────────┐         │
│  │           Job Queue (Redis + Celery)          │         │
│  └──────────────────────┬──────────────────────┘         │
│                         │                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Video   │ │   AI     │ │  Media   │ │ Scraping │   │
│  │ Pipeline │ │ Services │ │ Services │ │  Engine  │   │
│  │ (FFmpeg) │ │ (Models) │ │ (Pexels) │ │(Crawlee) │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    AI Model Layer                          │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Whisper  │ │  Kokoro  │ │  Qwen3   │ │   YOLO   │   │
│  │ (STT)   │ │  (TTS)   │ │  (LLM)   │ │  (CV)    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  FLUX    │ │ MusicGen │ │  SAM 2   │ │ MediaPipe│   │
│  │  (Img)   │ │ (Music)  │ │  (Seg)   │ │(Tracking)│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                           │
│  Served via: Ollama (LLMs) + Custom FastAPI (others)     │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    Storage Layer                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │PostgreSQL│ │  Redis   │ │  MinIO   │ │  SQLite  │   │
│  │(Metadata)│ │ (Cache/  │ │(Object   │ │(Dev/Lite)│   │
│  │          │ │  Queue)  │ │ Storage) │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 15 + React 19 + TypeScript | Best ecosystem, SSR, excellent DX |
| **UI Components** | shadcn/ui + Tailwind CSS | Composable, accessible, customizable |
| **Video Editor UI** | Custom React canvas + FFmpeg.wasm preview | Browser-native editing |
| **API** | FastAPI (Python) | Async, auto-docs (OpenAPI), best for ML integration |
| **Job Queue** | Redis + Celery | Battle-tested, async task processing |
| **Database** | PostgreSQL (prod) / SQLite (dev) | Relational, robust, free |
| **Object Storage** | MinIO (self-hosted S3) | S3-compatible, self-hosted |
| **Cache** | Redis | Fast KV store, pub/sub for real-time |
| **Video Assembly** | Remotion (TypeScript) + FFmpeg | React components = video, flexible templates |
| **Containerization** | Docker + docker-compose | One-command deployment |
| **Reverse Proxy** | Caddy | Auto-HTTPS, simple config |

### 3.3 AI Model Serving

| Model Category | Serving Method | Why |
|---------------|---------------|-----|
| LLMs (Qwen3) | Ollama | Easy install, quantized models, OpenAI-compatible API |
| STT (Whisper) | Custom FastAPI service | Needs audio preprocessing pipeline |
| TTS (Kokoro/Chatterbox) | Custom FastAPI service | Needs audio output pipeline |
| CV (YOLO/MediaPipe) | Custom FastAPI service | Needs video frame processing |
| Image Gen (FLUX) | ComfyUI or custom service | ComfyUI has excellent node-based flexibility |
| Video Gen (Wan 2.1) | ComfyUI or custom service | Handles VRAM management |
| Music (MusicGen) | Custom FastAPI service | Simple inference wrapper |

---

## 4. Feature Specifications

### 4.1 Core: AI Video Clipping

**Description:** Upload a long-form video (or paste URL) and get AI-generated short-form clips.

**Pipeline:**
```
Input Video → FFmpeg extract audio → WhisperX (transcription + word timestamps + diarization)
  → Qwen3 (analyze transcript for engaging segments, score virality)
  → YOLO + MediaPipe (detect speakers, track faces)
  → FFmpeg (cut clips at timestamps)
  → Apply reframing (center speaker in 9:16)
  → Apply captions (animated word-by-word)
  → Apply brand template (logo, intro, outro)
  → Export (MP4, multiple resolutions)
```

**Key Specs:**
- Input: Video file (MP4, MOV, MKV, WebM) or URL (YouTube, Vimeo, etc.)
- Max duration: Configurable (default 4 hours)
- Max file size: Configurable (default 10 GB)
- Output formats: 9:16, 1:1, 16:9, 4:5
- Output resolution: Up to 4K
- Clip duration: 15s, 30s, 60s, 90s, custom
- Language: 25+ (Whisper large-v3 support)

**AI Clipping Algorithm:**
1. Transcribe with WhisperX (word-level timestamps + speaker diarization)
2. Send transcript to Qwen3 with prompt:
   - Identify top N most engaging segments
   - Score each on: hook strength, emotional peaks, information density, self-containedness
   - Output: [{start_time, end_time, score, reason, suggested_title}]
3. For each clip candidate:
   - Run YOLO face detection on frames
   - Track primary speaker with MediaPipe
   - Determine optimal crop region per frame
4. Generate clips with FFmpeg
5. Apply captions, branding, transitions

### 4.2 Caption System

**Description:** 99%+ accurate captions with animated word-by-word highlighting.

**Pipeline:**
```
Audio → faster-whisper large-v3 (word timestamps)
  → Alignment correction (WhisperX)
  → Style application (font, color, animation, position)
  → Render via FFmpeg ASS filter or Remotion
```

**Caption Styles:**
- Karaoke (word-by-word highlight -- most popular)
- Pop (words pop in as spoken)
- Fade (smooth fade per word)
- Highlight (background color sweep)
- Minimal (clean white on dark)
- Bold (Hormozi-style -- big, centered, colored keywords)
- Custom (user-defined fonts, colors, animations)

**Editable:** Full inline text editing of generated captions (fix errors, rephrase).

### 4.3 Faceless Video Studio

**Description:** End-to-end faceless video creation from text prompt, URL, or Reddit post.

**Pipeline:**
```
Input (topic/URL/Reddit post)
  → Qwen3 (generate structured script with scenes)
  → Kokoro/Chatterbox (TTS narration)
  → faster-whisper (word timestamps from generated audio)
  → Pexels API (B-roll per scene keyword)
  → MusicGen (mood-matched background music)
  → Remotion (assemble: B-roll + voiceover + captions + music)
  → FLUX (generate thumbnail)
  → Export MP4
```

**Script Structure (JSON):**
```json
{
  "title": "5 Shocking Facts About...",
  "hook": "Did you know that...",
  "scenes": [
    {
      "narration": "The first fact will blow your mind...",
      "duration_est": 8.5,
      "search_keywords": ["explosion", "mind blown", "surprise"],
      "mood": "dramatic",
      "visual_description": "Cinematic shot of something unexpected"
    }
  ],
  "outro": "Subscribe for more..."
}
```

**Faceless Templates:**
- Reddit Story (screenshots + TTS + gameplay background)
- Documentary Style (B-roll + narration + lower thirds)
- Top 10 Listicle (countdown + stock footage)
- Motivational (cinematic footage + quotes + epic music)
- Scary Story (dark footage + eerie music + dramatic TTS)
- Educational Explainer (diagrams + animations + narration)

### 4.4 Brand Kit System

**Description:** Saved brand templates auto-applied to every generated clip.

**Brand Kit Fields:**
- Logos (light/dark variants, configurable position + opacity)
- Color palette (primary, secondary, accent, caption highlight)
- Fonts (heading, body, caption -- OTF/TTF upload)
- Intro video (up to 60s, auto-prepended)
- Outro video (up to 60s, auto-appended)
- Caption style preset
- Thumbnail template
- Audio branding (jingle/stinger)

**Multi-brand:** Unlimited brand kits per workspace.

### 4.5 AI Reframing

**Description:** Automatically track and center speakers when converting 16:9 to 9:16.

**Pipeline:**
```
Video frames → YOLO (detect faces) → MediaPipe (468 landmark tracking)
  → pyannote.audio (speaker diarization -- who's talking)
  → Smoothing algorithm (avoid jerky camera movement)
  → FFmpeg crop filter (per-frame crop coordinates)
```

**Modes:**
- Auto (AI tracks active speaker)
- Manual (user defines crop region per segment)
- Multi-speaker (split-screen layout)
- Static (fixed center crop)

### 4.6 AI B-Roll

**Description:** Automatically insert contextually relevant stock footage.

**Pipeline:**
```
Script/narration → Qwen3 (extract keywords + generate Pexels queries per scene)
  → Pexels API (search video, orientation, size filters)
  → Scoring algorithm (relevance, quality, color match, duration)
  → Timeline insertion (crossfade transitions)
  → Ken Burns effect on static/slow footage
```

### 4.7 Competitor Intelligence (Scraping)

**Description:** Built-in web scraping for competitor social media analysis.

**Architecture:**
- Scraping engine: Crawlee (Python) + Playwright
- Targets: YouTube, TikTok, Instagram, X, Reddit
- Data: Profiles, posts, engagement metrics, hashtags, posting schedules
- Analysis: Qwen3 for content analysis + BERTopic for trend detection
- Storage: PostgreSQL time-series for metrics tracking
- Scheduling: Celery beat for recurring scrapes

### 4.8 REST API

**Description:** Full programmatic access to all platform features.

**Base URL:** `http://localhost:8000/api/v1`

**Authentication:** API key (generated from dashboard)

**Key Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /projects | Create new clipping project |
| GET | /projects/{id} | Get project status + clips |
| POST | /projects/{id}/clips | Generate clips from project |
| POST | /faceless | Create faceless video |
| POST | /captions | Generate captions for video |
| POST | /reframe | Reframe video to new aspect ratio |
| POST | /broll | Generate B-roll for script |
| POST | /tts | Text-to-speech generation |
| POST | /transcribe | Transcribe audio/video |
| GET | /brands | List brand kits |
| POST | /brands | Create brand kit |
| POST | /publish | Publish to social platforms |
| POST | /scrape | Start competitor scrape job |
| GET | /jobs/{id} | Check job status |

**Webhook Support:** Configure URL to receive job completion notifications.

**Rate Limits:** Configurable (no artificial limits by default).

### 4.9 Social Publishing

**Description:** Auto-post clips to multiple platforms simultaneously.

**Supported Platforms:**
- YouTube / YouTube Shorts
- TikTok
- Instagram Reels
- Facebook
- LinkedIn
- X (Twitter)

**Features:**
- AI-generated platform-specific titles, descriptions, hashtags (via Qwen3)
- Content calendar with drag-and-drop
- Queue-based scheduling
- Multi-account support
- Post analytics (via platform APIs)

### 4.10 Filler Word & Silence Removal

**Description:** Auto-detect and remove "um," "uh," filler words, and awkward silences.

**Pipeline:**
```
Audio → WhisperX (word timestamps + classification)
  → Classify: speech | filler | silence
  → Generate cut list (filler/silence timestamps)
  → FFmpeg (remove segments, crossfade audio)
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Weeks 1-6)

**Goal:** Core clipping pipeline + basic UI

- [ ] Project setup (monorepo, Docker, CI/CD)
- [ ] FastAPI backend scaffold with authentication
- [ ] Redis + Celery job queue
- [ ] Video upload + FFmpeg processing pipeline
- [ ] WhisperX integration (transcription + word timestamps)
- [ ] Qwen3 integration via Ollama (clip selection)
- [ ] Basic clip generation (cut + captions)
- [ ] React frontend (upload + results dashboard)
- [ ] Docker Compose for one-command deployment

**Deliverable:** Upload a video, get AI-generated clips with captions.

### Phase 2: Intelligence (Weeks 7-12)

**Goal:** Reframing + B-roll + brand kits

- [ ] YOLO + MediaPipe face detection + tracking
- [ ] AI Reframing (9:16, 1:1, 16:9, 4:5)
- [ ] Pexels API integration for B-roll
- [ ] LLM-powered B-roll query generation
- [ ] Brand kit CRUD (logos, colors, fonts, intros)
- [ ] Caption style system (6+ presets)
- [ ] Video editor UI (timeline, trim, reorder)
- [ ] Filler word / silence removal
- [ ] REST API (v1)

**Deliverable:** Full clipping pipeline with reframing, B-roll, brand kits, and API.

### Phase 3: Faceless Studio (Weeks 13-18)

**Goal:** End-to-end faceless video creation

- [ ] Kokoro/Chatterbox TTS integration
- [ ] Script generation (LLM structured output)
- [ ] Faceless video assembly pipeline (Remotion)
- [ ] B-roll matching + scoring algorithm
- [ ] MusicGen integration (mood-matched background music)
- [ ] FLUX thumbnail generation
- [ ] Faceless template system (6+ templates)
- [ ] URL/Reddit post input sources
- [ ] Batch processing (CSV/spreadsheet input)

**Deliverable:** Type a topic, get a complete faceless video with thumbnail.

### Phase 4: Distribution (Weeks 19-24)

**Goal:** Social publishing + competitor intelligence

- [ ] Social media OAuth integration (YouTube, TikTok, IG, etc.)
- [ ] Content calendar UI
- [ ] Auto-posting with platform-specific optimization
- [ ] Competitor scraping engine (Crawlee + Playwright)
- [ ] Competitor analytics dashboard
- [ ] Trending content detection
- [ ] Hashtag analysis
- [ ] Performance analytics
- [ ] Webhook system
- [ ] n8n / Zapier integration examples

**Deliverable:** End-to-end: create video -> brand it -> schedule -> publish -> track.

### Phase 5: Polish & Scale (Weeks 25-30)

**Goal:** Production hardening + advanced features

- [ ] Voice cloning (Chatterbox)
- [ ] AI dubbing + translation
- [ ] Video upscaling (Real-ESRGAN)
- [ ] Frame interpolation / slow-motion (RIFE)
- [ ] Multi-cam editing
- [ ] Team/workspace collaboration
- [ ] Mobile-responsive UI
- [ ] Plugin/extension system
- [ ] Comprehensive documentation
- [ ] Community templates marketplace

---

## 6. Data Models

### Core Entities

```
User
  - id: UUID
  - email: string
  - api_key: string (hashed)
  - settings: JSON
  - created_at: timestamp

Project
  - id: UUID
  - user_id: FK(User)
  - title: string
  - source_type: enum(upload, url, text)
  - source_url: string?
  - source_file: string? (MinIO path)
  - status: enum(pending, processing, completed, failed)
  - settings: JSON (clip_duration, aspect_ratio, language, etc.)
  - created_at: timestamp

Clip
  - id: UUID
  - project_id: FK(Project)
  - start_time: float
  - end_time: float
  - duration: float
  - virality_score: float
  - title: string
  - transcript: text
  - output_file: string (MinIO path)
  - thumbnail: string (MinIO path)
  - caption_srt: text
  - brand_kit_id: FK(BrandKit)?
  - status: enum(pending, rendering, completed, failed)

BrandKit
  - id: UUID
  - user_id: FK(User)
  - name: string
  - config: JSON (logos, colors, fonts, intro, outro, caption_style)

FacelessProject
  - id: UUID
  - user_id: FK(User)
  - title: string
  - script: JSON (scenes array)
  - template: string
  - tts_voice: string
  - music_mood: string
  - output_file: string
  - thumbnail: string
  - status: enum(pending, processing, completed, failed)

PublishJob
  - id: UUID
  - clip_id: FK(Clip)
  - platform: enum(youtube, tiktok, instagram, facebook, linkedin, x)
  - scheduled_at: timestamp
  - published_at: timestamp?
  - platform_post_id: string?
  - status: enum(scheduled, publishing, published, failed)
  - metadata: JSON (title, description, hashtags, etc.)

ScrapeJob
  - id: UUID
  - user_id: FK(User)
  - target_platform: string
  - target_accounts: JSON
  - schedule: string (cron)
  - last_run: timestamp
  - results: JSON
```

---

## 7. Non-Functional Requirements

### Performance
- Video processing: <2x real-time on recommended hardware (RTX 4090)
- API response: <200ms for non-processing endpoints
- Caption generation: <30s for 10-minute video
- Clip generation: <5 minutes for 1-hour source video

### Scalability
- Support 10+ concurrent processing jobs (with GPU queuing)
- Handle 100GB+ video files
- Process 4-hour+ videos without issues

### Reliability
- No stuck processing jobs (timeout + retry + cleanup)
- Graceful degradation when GPU is busy
- Job progress tracking with real-time updates (WebSocket)
- Failed jobs don't consume any "credits" (there are no credits)

### Security
- API key authentication
- Rate limiting (configurable)
- Input validation (file type, size limits)
- No execution of user-uploaded code
- Sandboxed FFmpeg execution
- CORS configuration

### Accessibility
- WCAG 2.1 AA compliance for web UI
- Keyboard navigation support
- Screen reader compatible

---

## 8. Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| GitHub stars | 5,000+ |
| Docker pulls | 10,000+ |
| Monthly active self-hosted instances | 1,000+ |
| API requests/day (across all instances) | 50,000+ |
| Community contributors | 50+ |
| Reddit/HN front page posts | 3+ |
| r/selfhosted recommendation threads | Regular mentions |

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| GPU requirement excludes many users | Medium | CPU fallback modes, tiered model selection, cloud GPU option |
| Model quality < commercial APIs | Medium | Continuous model upgrades, fine-tuning on video data |
| Platform API changes break publishing | High | Abstract platform layer, community-maintained adapters |
| Anti-bot detection blocks scraping | Medium | Stealth plugins, proxy support, rate limiting |
| Scope creep delays MVP | High | Strict phase gating, ship Phase 1 in 6 weeks |
| Open-source sustainability | Medium | GitHub Sponsors, managed cloud offering, enterprise support |
