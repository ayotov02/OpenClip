# Product Requirements Document (PRD) — Final
## OpenClip: Open-Source AI Video Creation Platform

**Version:** 2.0 (Final)
**Date:** March 2, 2026
**Status:** Approved
**Deployment:** GCP Cloud + Self-Hosted Docker

---

## 1. Product Vision

**Mission:** Democratize video creation by building the world's first fully open-source AI video platform that replaces $15-99/month SaaS subscriptions with zero-cost, open-source models deployed on GCP infrastructure.

**One-liner:** "OpusClip, but free, open-source, and yours — powered entirely by open-source AI models on GCP."

**Key Differentiators:**
1. Zero paid API dependencies (all AI runs via open-source models on GCP GPUs)
2. Self-hosted via Docker or deploy to your own GCP project
3. No watermarks, no credit systems, no dark patterns
4. Full REST API for developers
5. Faceless video creation built-in (end-to-end pipeline)
6. Competitor scraping & intelligence built-in

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
- OpusClip Trustpilot: 2.4/5 — deeply flawed market leader

---

## 3. Architecture Overview

### 3.1 System Architecture (GCP Deployment)

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Dashboard │ │  Editor  │ │ Faceless │ │ Analytics│   │
│  │           │ │ Timeline │ │  Studio  │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ REST API / WebSocket
                         │ (Cloud Run)
┌────────────────────────┴────────────────────────────────┐
│               API Gateway (FastAPI on Cloud Run)           │
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
│  │     Job Queue (Redis via Memorystore +       │         │
│  │              Celery Workers on GCE)           │         │
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
│          AI Model Layer (GCP GPU Instances)                │
│                                                           │
│  ┌──────────────────────────────────────────┐            │
│  │     Cloud Run (GPU) / Compute Engine      │            │
│  ├──────────┐ ┌──────────┐ ┌──────────┐    │            │
│  │ Whisper  │ │  Kokoro  │ │  Qwen3   │    │            │
│  │ (STT)   │ │  (TTS)   │ │  (LLM)   │    │            │
│  ├──────────┤ ├──────────┤ ├──────────┤    │            │
│  │   YOLO   │ │  FLUX    │ │ MusicGen │    │            │
│  │  (CV)    │ │  (Img)   │ │ (Music)  │    │            │
│  ├──────────┤ ├──────────┤ ├──────────┤    │            │
│  │  SAM 2   │ │MediaPipe │ │ Wan 2.1  │    │            │
│  │  (Seg)   │ │(Tracking)│ │ (Video)  │    │            │
│  └──────────┘ └──────────┘ └──────────┘    │            │
│  └──────────────────────────────────────────┘            │
│                                                           │
│  Served via: Ollama (LLMs) + Custom FastAPI (others)     │
│  on Cloud Run w/ GPU or Compute Engine w/ L4/T4 GPUs     │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    Storage Layer (GCP)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │Cloud SQL │ │Memorystore│ │  Cloud   │                │
│  │(Postgres)│ │ (Redis)   │ │ Storage  │                │
│  │          │ │           │ │ (GCS)    │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│                                                           │
│  Self-hosted alternative: PostgreSQL + Redis + MinIO     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology | GCP Service | Why |
|-------|-----------|-------------|-----|
| **Frontend** | Next.js 15 + React 19 + TypeScript | Cloud Run | Best ecosystem, SSR, excellent DX |
| **UI Components** | shadcn/ui + Tailwind CSS | — | Composable, accessible, customizable |
| **Video Editor UI** | Custom React canvas + FFmpeg.wasm preview | — | Browser-native editing |
| **API** | FastAPI (Python) | Cloud Run | Async, auto-docs (OpenAPI), best for ML |
| **Job Queue** | Redis + Celery | Memorystore + GCE | Battle-tested async task processing |
| **Database** | PostgreSQL 16 | Cloud SQL | Relational, robust, managed |
| **Object Storage** | GCS (or MinIO self-hosted) | Cloud Storage | S3-compatible, scalable |
| **Cache** | Redis | Memorystore | Fast KV store, pub/sub for real-time |
| **Video Assembly** | Remotion (TypeScript) + FFmpeg | GCE Workers | React components = video templates |
| **Containerization** | Docker + docker-compose | Artifact Registry | One-command deployment |
| **Reverse Proxy** | Caddy (self-hosted) / Cloud Load Balancer | Cloud LB | Auto-HTTPS, simple config |

### 3.3 AI Model → GCP Service Mapping

| Model | Category | GCP Service | Machine Type | GPU | Est. Monthly Cost |
|-------|----------|-------------|-------------|-----|-------------------|
| **faster-whisper large-v3** | STT | Cloud Run (GPU) | g2-standard-4 | 1x L4 (24GB) | $150-300 (on-demand) |
| **WhisperX** | STT + Diarization | Cloud Run (GPU) | g2-standard-4 | 1x L4 (24GB) | Shared with above |
| **Qwen3-32B (Q4)** | LLM | Cloud Run (GPU) | g2-standard-12 | 1x L4 (24GB) | $200-400 |
| **Kokoro** | TTS (Fast) | Cloud Run (GPU) | g2-standard-4 | 1x L4 (24GB) | $100-200 |
| **Chatterbox** | TTS (Quality) | Cloud Run (GPU) | g2-standard-8 | 1x L4 (24GB) | $150-300 |
| **YOLO11** | Object Detection | Cloud Run (GPU) | g2-standard-4 | 1x L4 (24GB) | $100-200 |
| **MediaPipe** | Face Tracking | Cloud Run (CPU) | — | None | $20-50 |
| **SAM 2** | Segmentation | Compute Engine | g2-standard-8 | 1x L4 (24GB) | $150-300 |
| **pyannote.audio** | Diarization | Cloud Run (GPU) | g2-standard-4 | 1x L4 (24GB) | Shared with Whisper |
| **FLUX.1 [schnell]** | Image Gen | Vertex AI / GCE | a2-highgpu-1g | 1x A100 (40GB) | $200-400 |
| **Wan 2.1 T2V-1.3B** | Video Gen | Compute Engine | g2-standard-8 | 1x L4 (24GB) | $150-300 |
| **MusicGen Medium** | Music Gen | Cloud Run (GPU) | g2-standard-8 | 1x L4 (24GB) | $100-200 |
| **Real-ESRGAN** | Upscaling | Compute Engine | g2-standard-4 | 1x L4 (24GB) | $100-200 |
| **RIFE** | Frame Interp. | Compute Engine | g2-standard-4 | 1x L4 (24GB) | $100-200 |

**Total Estimated GCP Cost:** $400-800/month (using preemptible/spot VMs and scale-to-zero on Cloud Run)

**Cost Optimization Strategies:**
- Use Cloud Run GPU with scale-to-zero (pay only when processing)
- Use Spot VMs for batch processing workers (60-91% discount)
- Share GPU instances across compatible models (e.g., Whisper + pyannote)
- Use Committed Use Discounts (CUD) for steady-state workloads
- Cache model inference results in Redis (avoid re-computation)

### 3.4 GCP Infrastructure Architecture

```
GCP Project: openclip-prod
├── Networking
│   ├── VPC: openclip-vpc (custom, 10.0.0.0/16)
│   ├── Subnet: openclip-services (10.0.1.0/24, us-central1)
│   ├── Subnet: openclip-gpu (10.0.2.0/24, us-central1)
│   ├── Cloud NAT (for egress from private instances)
│   ├── Cloud Armor (WAF + DDoS protection)
│   └── Cloud Load Balancer (HTTPS, global)
│
├── Compute
│   ├── Cloud Run: api-service (FastAPI, 2 vCPU / 4GB)
│   ├── Cloud Run: frontend-service (Next.js SSR, 1 vCPU / 2GB)
│   ├── Cloud Run (GPU): whisper-service (L4 GPU, scale-to-zero)
│   ├── Cloud Run (GPU): tts-service (L4 GPU, scale-to-zero)
│   ├── Cloud Run (GPU): llm-service (L4 GPU, Ollama + Qwen3)
│   ├── Cloud Run (GPU): cv-service (L4 GPU, YOLO + MediaPipe)
│   ├── Compute Engine: worker-gpu-1 (g2-standard-8, L4, Celery worker)
│   ├── Compute Engine: worker-gpu-2 (Spot VM, burst capacity)
│   └── Compute Engine: scraper-vm (e2-standard-4, Crawlee + Playwright)
│
├── Data
│   ├── Cloud SQL: openclip-db (PostgreSQL 16, db-custom-2-8192)
│   ├── Memorystore: openclip-redis (Redis 7, 2GB Basic)
│   ├── Cloud Storage: openclip-uploads (Standard, us-central1)
│   ├── Cloud Storage: openclip-processed (Standard, us-central1)
│   ├── Cloud Storage: openclip-models (Standard, model weights cache)
│   └── Cloud Storage: openclip-temp (lifecycle: delete after 24hr)
│
├── CI/CD
│   ├── Cloud Build: build pipeline (GitHub trigger)
│   ├── Artifact Registry: openclip-images (Docker images)
│   └── Secret Manager: all secrets and API keys
│
├── Monitoring
│   ├── Cloud Monitoring: dashboards + alerts
│   ├── Cloud Logging: structured logs from all services
│   └── Error Reporting: automatic error tracking
│
└── Security
    ├── IAM: service accounts per service (least privilege)
    ├── VPC Service Controls (optional, enterprise)
    └── Secret Manager: DB passwords, API keys, JWT secrets
```

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
   - Output: `[{start_time, end_time, score, reason, suggested_title}]`
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
- Karaoke (word-by-word highlight — most popular)
- Pop (words pop in as spoken)
- Fade (smooth fade per word)
- Highlight (background color sweep)
- Minimal (clean white on dark)
- Bold (Hormozi-style — big, centered, colored keywords)
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
- Fonts (heading, body, caption — OTF/TTF upload)
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
  → pyannote.audio (speaker diarization — who's talking)
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
- Scraping engine: Crawlee (Python) + Playwright on GCP Compute Engine
- Targets: YouTube, TikTok, Instagram, X, Reddit
- Data: Profiles, posts, engagement metrics, hashtags, posting schedules
- Analysis: Qwen3 for content analysis + BERTopic for trend detection
- Storage: Cloud SQL PostgreSQL for time-series metrics tracking
- Scheduling: Celery beat for recurring scrapes

### 4.8 REST API

**Description:** Full programmatic access to all platform features.

**Base URL:** `https://api.openclip.dev/v1` (GCP) or `http://localhost:8000/api/v1` (self-hosted)

**Authentication:** API key (generated from dashboard) or JWT token

**Key Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/projects` | Create new clipping project |
| GET | `/projects/{id}` | Get project status + clips |
| POST | `/projects/{id}/clips` | Generate clips from project |
| POST | `/faceless` | Create faceless video |
| POST | `/captions` | Generate captions for video |
| POST | `/reframe` | Reframe video to new aspect ratio |
| POST | `/broll` | Generate B-roll for script |
| POST | `/tts` | Text-to-speech generation |
| POST | `/transcribe` | Transcribe audio/video |
| GET | `/brands` | List brand kits |
| POST | `/brands` | Create brand kit |
| POST | `/publish` | Publish to social platforms |
| POST | `/scrape` | Start competitor scrape job |
| GET | `/jobs/{id}` | Check job status |
| WS | `/ws/jobs/{id}` | Real-time job progress updates |

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

## 5. GCP API Endpoint Specifications

### 5.1 AI Model Service Endpoints (Internal)

Each AI model runs as an internal Cloud Run service with a standardized API:

#### WhisperX STT Service
```
POST /transcribe
  Body: { "audio_url": "gs://...", "language": "en", "diarize": true }
  Response: { "segments": [...], "words": [...], "speakers": [...] }

POST /align
  Body: { "audio_url": "gs://...", "transcript": "..." }
  Response: { "words": [{"word": "hello", "start": 0.0, "end": 0.5}] }

GET /health
  Response: { "status": "ok", "model": "large-v3", "gpu": "L4" }
```

#### Qwen3 LLM Service (via Ollama)
```
POST /v1/chat/completions  (OpenAI-compatible)
  Body: { "model": "qwen3:32b", "messages": [...], "temperature": 0.7 }
  Response: { "choices": [{"message": {"content": "..."}}] }

POST /generate
  Body: { "model": "qwen3:32b", "prompt": "...", "format": "json" }
  Response: { "response": "..." }

GET /api/tags
  Response: { "models": [...] }
```

#### TTS Service (Kokoro / Chatterbox)
```
POST /synthesize
  Body: { "text": "...", "voice": "af_heart", "engine": "kokoro", "speed": 1.0 }
  Response: audio/wav binary

POST /clone
  Body: { "text": "...", "reference_audio_url": "gs://...", "engine": "chatterbox" }
  Response: audio/wav binary

GET /voices
  Response: { "kokoro": [...], "chatterbox": [...] }
```

#### Computer Vision Service (YOLO + MediaPipe)
```
POST /detect/faces
  Body: { "image_url": "gs://..." or base64 }
  Response: { "faces": [{"bbox": [...], "confidence": 0.99, "landmarks": [...]}] }

POST /detect/objects
  Body: { "image_url": "gs://...", "classes": ["person", "car"] }
  Response: { "objects": [{"class": "person", "bbox": [...], "confidence": 0.95}] }

POST /track/video
  Body: { "video_url": "gs://...", "fps": 5 }
  Response: { "frames": [{"timestamp": 0.0, "faces": [...]}] }
```

#### Image Generation Service (FLUX.1)
```
POST /generate
  Body: { "prompt": "...", "width": 1280, "height": 720, "steps": 4 }
  Response: { "image_url": "gs://..." }

POST /thumbnail
  Body: { "prompt": "...", "style": "youtube", "text_overlay": "..." }
  Response: { "image_url": "gs://..." }
```

#### Music Generation Service (MusicGen)
```
POST /generate
  Body: { "prompt": "upbeat corporate background", "duration": 30, "format": "wav" }
  Response: { "audio_url": "gs://..." }

POST /generate/mood
  Body: { "mood": "dramatic", "duration": 60, "tempo": "slow" }
  Response: { "audio_url": "gs://..." }
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Weeks 1-6)

**Goal:** Core clipping pipeline + basic UI

- [ ] Project setup (monorepo, Docker, CI/CD, GCP project)
- [ ] FastAPI backend scaffold with authentication
- [ ] Redis + Celery job queue (Memorystore on GCP)
- [ ] Video upload + FFmpeg processing pipeline
- [ ] WhisperX integration on Cloud Run GPU
- [ ] Qwen3 integration via Ollama on Cloud Run GPU
- [ ] Basic clip generation (cut + captions)
- [ ] React frontend (upload + results dashboard)
- [ ] Docker Compose for local development + GCP deployment configs

**Deliverable:** Upload a video, get AI-generated clips with captions.

### Phase 2: Intelligence (Weeks 7-12)

**Goal:** Reframing + B-roll + brand kits

- [ ] YOLO + MediaPipe face detection + tracking on Cloud Run GPU
- [ ] AI Reframing (9:16, 1:1, 16:9, 4:5)
- [ ] Pexels API integration for B-roll
- [ ] LLM-powered B-roll query generation
- [ ] Brand kit CRUD (logos, colors, fonts, intros)
- [ ] Caption style system (7+ presets)
- [ ] Video editor UI (timeline, trim, reorder)
- [ ] Filler word / silence removal
- [ ] REST API (v1)

**Deliverable:** Full clipping pipeline with reframing, B-roll, brand kits, and API.

### Phase 3: Faceless Studio (Weeks 13-18)

**Goal:** End-to-end faceless video creation

- [ ] Kokoro/Chatterbox TTS on Cloud Run GPU
- [ ] Script generation (LLM structured output)
- [ ] Faceless video assembly pipeline (Remotion)
- [ ] B-roll matching + scoring algorithm
- [ ] MusicGen on Cloud Run GPU
- [ ] FLUX thumbnail generation on GCE/Vertex AI
- [ ] Faceless template system (6+ templates)
- [ ] URL/Reddit post input sources
- [ ] Batch processing (CSV/spreadsheet input)

**Deliverable:** Type a topic, get a complete faceless video with thumbnail.

### Phase 4: Distribution (Weeks 19-24)

**Goal:** Social publishing + competitor intelligence

- [ ] Social media OAuth integration (YouTube, TikTok, IG, etc.)
- [ ] Content calendar UI
- [ ] Auto-posting with platform-specific optimization
- [ ] Competitor scraping engine (Crawlee + Playwright on GCE)
- [ ] Competitor analytics dashboard
- [ ] Trending content detection
- [ ] Hashtag analysis
- [ ] Performance analytics
- [ ] Webhook system
- [ ] n8n / Zapier integration examples

**Deliverable:** End-to-end: create video → brand it → schedule → publish → track.

### Phase 5: Polish & Scale (Weeks 25-30)

**Goal:** Production hardening + advanced features

- [ ] Voice cloning (Chatterbox on GCP)
- [ ] AI dubbing + translation
- [ ] Video upscaling (Real-ESRGAN on GCE)
- [ ] Frame interpolation / slow-motion (RIFE on GCE)
- [ ] Multi-cam editing
- [ ] Team/workspace collaboration
- [ ] Mobile-responsive UI + PWA
- [ ] Plugin/extension system
- [ ] Comprehensive documentation
- [ ] Community templates marketplace

---

## 7. Data Models

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
  - source_file: string? (GCS path)
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
  - output_file: string (GCS path)
  - thumbnail: string (GCS path)
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
  - output_file: string (GCS path)
  - thumbnail: string (GCS path)
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

## 8. Non-Functional Requirements

### Performance
- Video processing: <2x real-time on L4 GPU
- API response: <200ms for non-processing endpoints
- Caption generation: <30s for 10-minute video
- Clip generation: <5 minutes for 1-hour source video
- Cloud Run cold start: <10s for CPU services, <30s for GPU services

### Scalability
- Cloud Run auto-scales to handle concurrent users
- Support 10+ concurrent processing jobs via Celery workers
- Handle 100GB+ video files via GCS resumable uploads
- Process 4-hour+ videos without timeout

### Reliability
- No stuck processing jobs (timeout + retry + cleanup)
- Graceful degradation when GPU quota is exhausted (queue backpressure)
- Job progress tracking with real-time updates (WebSocket)
- Cloud Run GPU scale-to-zero (cost optimization)
- 99.9% uptime target (GCP SLA)

### Security
- API key authentication (bcrypt-hashed)
- JWT tokens for session auth
- Rate limiting (configurable)
- Input validation (file type, size limits)
- No execution of user-uploaded code
- Sandboxed FFmpeg execution
- CORS configuration
- Cloud Armor WAF + DDoS protection
- IAM least-privilege service accounts
- Secret Manager for all credentials

### Accessibility
- WCAG 2.1 AA compliance for web UI
- Keyboard navigation support
- Screen reader compatible

---

## 9. GCP Cost Estimation

### Development / Low Usage (~$200-400/month)

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| Cloud Run (API + Frontend) | 2 services, minimal | $30-60 |
| Cloud Run GPU (AI models) | Scale-to-zero, on-demand | $50-150 |
| Cloud SQL (PostgreSQL) | db-f1-micro, 10GB | $10-15 |
| Memorystore (Redis) | Basic, 1GB | $35 |
| Cloud Storage | 100GB | $2-5 |
| Cloud Build | 120 min/day free | $0 |
| Networking / LB | Basic | $20-30 |
| **Total** | | **$150-300** |

### Production / Medium Usage (~$500-1000/month)

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| Cloud Run (API + Frontend) | 2-4 instances, auto-scale | $60-120 |
| Cloud Run GPU (AI models) | 3-4 GPU services, L4 | $200-400 |
| Compute Engine (Workers) | 1x g2-standard-8 (Spot) | $80-150 |
| Cloud SQL (PostgreSQL) | db-custom-2-8192, 50GB | $50-80 |
| Memorystore (Redis) | Standard, 2GB | $70 |
| Cloud Storage | 1TB | $20-25 |
| Cloud Build + Artifact Registry | Standard usage | $10-20 |
| Networking / LB / Armor | Standard | $40-60 |
| **Total** | | **$530-925** |

### High Usage / Scale (~$1500-3000/month)

| Service | Config | Monthly Cost |
|---------|--------|-------------|
| Cloud Run (API + Frontend) | 4-8 instances, high-mem | $120-250 |
| Cloud Run GPU (AI models) | 5+ GPU services, always-on | $500-1000 |
| Compute Engine (Workers) | 2-3x g2-standard-8 | $300-600 |
| Cloud SQL (PostgreSQL) | db-custom-4-16384, HA, 200GB | $150-250 |
| Memorystore (Redis) | Standard HA, 5GB | $175 |
| Cloud Storage | 5TB+ | $100+ |
| Cloud Build + Monitoring | Full suite | $50-100 |
| Networking / LB / Armor | Production | $80-150 |
| **Total** | | **$1475-2525** |

### Self-Hosted Alternative (Cost = Hardware + Electricity)

| Hardware | One-Time Cost | Monthly (Electricity) |
|----------|-------------|----------------------|
| RTX 4090 24GB + 64GB RAM | $2,500-3,500 | $30-50 |
| 2x RTX 4090 + 128GB RAM | $5,000-7,000 | $50-80 |
| Cloud GPU rental (RunPod) | — | $200-400 |

---

## 10. Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| GitHub stars | 5,000+ |
| Docker pulls | 10,000+ |
| Monthly active self-hosted instances | 1,000+ |
| API requests/day (across all instances) | 50,000+ |
| Community contributors | 50+ |
| Reddit/HN front page posts | 3+ |
| r/selfhosted recommendation threads | Regular mentions |
| GCP deployment tutorials shared | 10+ |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| GCP costs higher than estimated | Medium | Scale-to-zero, Spot VMs, usage monitoring, budget alerts |
| GPU quota limits on GCP | High | Request quota increases early, multi-region fallback |
| Model quality < commercial APIs | Medium | Continuous model upgrades, fine-tuning on video data |
| Platform API changes break publishing | High | Abstract platform layer, community-maintained adapters |
| Anti-bot detection blocks scraping | Medium | Stealth plugins, proxy support, rate limiting |
| Scope creep delays MVP | High | Strict phase gating, ship Phase 1 in 6 weeks |
| Open-source sustainability | Medium | GitHub Sponsors, managed cloud offering, enterprise support |
| Cold start latency on GPU services | Medium | Minimum instances = 1, model preloading, warm-up requests |

---

## 12. Deployment Modes

### Mode 1: GCP Cloud (Recommended for Production)
- Managed infrastructure, auto-scaling
- GPU services on Cloud Run with scale-to-zero
- Cloud SQL + Memorystore + GCS for data
- Cloud Build CI/CD from GitHub

### Mode 2: Self-Hosted Docker (Recommended for Development)
```bash
git clone https://github.com/openclip/openclip.git
cd openclip
cp .env.example .env
docker compose up -d
```

### Mode 3: Hybrid (API on GCP, Models Self-Hosted)
- Run API + frontend on Cloud Run
- Run GPU-heavy models on local hardware
- Connect via Tailscale or WireGuard VPN

### Mode 4: Cloud GPU Rental (Budget Production)
- Deploy full stack on RunPod / Vast.ai / Lambda Labs
- Single-machine docker-compose
- ~$200-400/month for RTX 4090 equivalent

---

## Appendix A: Repository Structure

```
openclip/
  ├── backend/              # FastAPI Python backend
  │   ├── app/
  │   │   ├── api/          # API routes
  │   │   ├── core/         # Config, security, deps
  │   │   ├── models/       # SQLAlchemy models
  │   │   ├── services/     # Business logic
  │   │   ├── tasks/        # Celery tasks
  │   │   └── ai/           # AI model wrappers
  │   ├── tests/
  │   └── alembic/          # DB migrations
  ├── frontend/             # Next.js React frontend
  │   ├── src/
  │   │   ├── app/          # Next.js app router
  │   │   ├── components/   # React components
  │   │   ├── hooks/        # Custom hooks
  │   │   └── lib/          # Utilities
  │   └── tests/
  ├── services/             # AI microservices
  │   ├── whisper/
  │   ├── tts/
  │   ├── vision/
  │   ├── llm/
  │   ├── image-gen/
  │   └── music-gen/
  ├── docker/               # Dockerfiles
  ├── infra/                # GCP Terraform/Pulumi configs
  │   ├── terraform/
  │   └── cloud-run/
  ├── scripts/              # Setup, migration, utility scripts
  ├── docs/                 # Documentation
  ├── templates/            # Faceless video templates (Remotion)
  ├── phase-roadmap/        # Implementation guides per feature
  ├── docker-compose.yml
  ├── docker-compose.dev.yml
  ├── .github/
  │   └── workflows/
  ├── CONTRIBUTING.md
  └── LICENSE               # AGPL-3.0
```

---

## Appendix B: AI Model Versions (Pinned)

```yaml
models:
  whisper:
    name: "Systran/faster-whisper-large-v3"
    version: "1.0.3"
    serving: Cloud Run GPU (L4)
  whisperx:
    name: "m-bain/whisperX"
    version: "3.1.x"
    serving: Shared with whisper service
  qwen3:
    name: "qwen3:32b"
    version: "latest"
    serving: Cloud Run GPU (L4) via Ollama
    quantization: Q4_K_M
  kokoro:
    name: "hexgrad/Kokoro-82M"
    version: "1.0.0"
    serving: Cloud Run GPU (L4)
  chatterbox:
    name: "resemble-ai/chatterbox"
    version: "0.1.x"
    serving: Cloud Run GPU (L4)
  yolo:
    name: "ultralytics/yolo11x"
    version: "11.0"
    serving: Cloud Run GPU (L4)
  mediapipe:
    name: "google/mediapipe"
    version: "0.10.x"
    serving: Cloud Run CPU
  sam2:
    name: "facebookresearch/sam2"
    version: "2.1"
    serving: Compute Engine (L4)
  pyannote:
    name: "pyannote/speaker-diarization-3.1"
    version: "3.1"
    serving: Cloud Run GPU (shared with Whisper)
  flux:
    name: "black-forest-labs/FLUX.1-schnell"
    version: "1.0"
    serving: Compute Engine (A100 or L4)
  wan:
    name: "Wan-Video/Wan2.1-T2V-1.3B"
    version: "2.1"
    serving: Compute Engine (L4)
  musicgen:
    name: "facebook/musicgen-medium"
    version: "1.0"
    serving: Cloud Run GPU (L4)
  real_esrgan:
    name: "xinntao/Real-ESRGAN"
    version: "0.3.x"
    serving: Compute Engine (L4)
  rife:
    name: "hzwer/ECCV2022-RIFE"
    version: "4.x"
    serving: Compute Engine (L4)
```
