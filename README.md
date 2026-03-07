<div align="center">

# OpenClip

### The Open-Source AI Video Creation Platform

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/)
[![GCP](https://img.shields.io/badge/GCP-Deployable-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)

**OpusClip, but free, open-source, and yours — powered entirely by open-source AI models.**

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [Roadmap](#-roadmap) · [Contributing](#-contributing)

---

</div>

## About

OpenClip is the world's first fully open-source, self-hosted AI video creation platform. It was built from the ground up to replace the $15–99/month SaaS subscriptions that creators, agencies, and developers are forced to pay for basic video tooling. Every AI model runs locally or on your own infrastructure — there are no paid API calls, no usage credits, no watermarks, and no dark patterns. Your data never leaves your machine unless you want it to.

The platform addresses a massive gap in the creator economy. With the market projected to reach $214 billion by 2026 and 38% of new creators choosing to go faceless, there is enormous demand for affordable, reliable video automation. The current market leader, OpusClip, holds a 2.4 out of 5 rating on Trustpilot, with creators consistently complaining about context-less clipping, inaccurate captions, stuck processing jobs, and predatory billing. No self-hosted alternative exists. OpenClip fills that void.

The core philosophy is simple: if an open-source model can do it, OpenClip uses it. Speech-to-text runs on faster-whisper large-v3 with WhisperX alignment for word-level timestamps and speaker diarization across 25+ languages. Text generation and content analysis use Qwen3-32B served through Ollama with an OpenAI-compatible API. Text-to-speech runs on Kokoro for speed and Chatterbox for quality and voice cloning. Computer vision combines YOLO11 for object detection, MediaPipe for facial landmark tracking, SAM 2 for segmentation, and pyannote.audio for speaker identification. Image generation uses FLUX.1 schnell, music generation uses Meta's MusicGen, and video generation uses Wan 2.1. Every model is containerized and served via custom FastAPI microservices or Ollama, making the entire stack reproducible with a single `docker compose up`.

OpenClip is not just a clipping tool. It is a complete video lifecycle platform. You can upload a long-form video and get AI-ranked short-form clips with animated captions and brand overlays. You can type a topic and get a fully produced faceless video with AI narration, matched B-roll, generated background music, and a thumbnail. You can schedule and auto-publish to YouTube, TikTok, Instagram, Facebook, LinkedIn, and X. You can scrape competitor channels, track trending content, analyze hashtag performance, and feed those insights directly into your next video. And you can do all of this through the web UI or programmatically through a full REST API with webhook support.

The frontend is built with Next.js 15, React 19, TypeScript, and shadcn/ui, delivering a modern, accessible interface with a dashboard, timeline editor, faceless studio, content calendar, analytics dashboards, and brand management. Video assembly uses Remotion, which treats React components as video templates, combined with FFmpeg for encoding and processing. The backend runs on FastAPI with Celery and Redis handling asynchronous job processing, PostgreSQL for persistent storage, and MinIO or GCS for object storage. Everything deploys via Docker Compose for local use or Terraform for GCP production infrastructure with Cloud Run GPU scale-to-zero.

<br>

## ✦ Features

<details>
<summary><b>AI Video Clipping</b></summary>

Upload a long-form video or paste a URL from YouTube, Vimeo, or any supported platform. The system extracts audio, transcribes it with WhisperX for word-level timestamps and speaker diarization, then sends the transcript to Qwen3 to identify the most engaging segments. Each candidate clip is scored on hook strength, emotional peaks, information density, and self-containedness. YOLO and MediaPipe detect and track speakers across frames. FFmpeg cuts the clips, applies AI reframing to center the active speaker in any aspect ratio, burns animated captions, overlays branding from your brand kit, and exports finished clips in MP4 at up to 4K resolution. Supported output formats include 9:16, 1:1, 16:9, and 4:5 with configurable durations of 15, 30, 60, 90 seconds, or custom lengths. Source videos up to 4 hours and 10 GB are supported by default, with configurable limits.

</details>

<details>
<summary><b>Caption System</b></summary>

Generates captions with 99%+ accuracy using faster-whisper large-v3 with WhisperX forced alignment. Captions render as animated word-by-word overlays with seven built-in style presets: Karaoke highlights each word as it is spoken, Pop makes words appear with a pop-in animation, Fade smoothly transitions each word, Highlight sweeps a background color across words, Minimal renders clean white text on a dark band, Bold uses the Hormozi-style large centered text with colored keywords, and Custom lets users define their own fonts, colors, sizes, positions, and animation curves. All generated captions are fully editable inline — click any word in the editor to fix errors, rephrase, or delete segments before final export. Captions render through Remotion for maximum visual fidelity or FFmpeg ASS filters for speed.

</details>

<details>
<summary><b>Faceless Video Studio</b></summary>

An end-to-end pipeline for creating complete videos without a camera. Enter a text prompt, paste a URL, or link a Reddit post. Qwen3 generates a structured script broken into scenes, each with narration text, estimated duration, search keywords for B-roll, mood tags, and visual descriptions. Kokoro or Chatterbox synthesizes the voiceover narration. faster-whisper extracts word timestamps from the generated audio. The Pexels API supplies stock footage matched to each scene's keywords, scored by relevance, quality, and color compatibility. MusicGen generates mood-matched background music. Remotion assembles everything — B-roll, voiceover, animated captions, background music, transitions — into a finished video. FLUX.1 schnell generates a thumbnail. The output is an export-ready MP4 with matching thumbnail. Six template types ship built-in: Reddit Story, Documentary Style, Top 10 Listicle, Motivational, Scary Story, and Educational Explainer.

</details>

<details>
<summary><b>AI Reframing</b></summary>

Automatically converts videos between aspect ratios while keeping the active speaker centered and in frame. YOLO11 detects faces per frame, MediaPipe tracks 468 facial landmarks for precise positioning, and pyannote.audio identifies which speaker is currently talking via diarization. A smoothing algorithm prevents jerky camera movements by interpolating crop coordinates across frames. FFmpeg applies per-frame crop filters for the final output. Four modes are available: Auto tracks the active speaker automatically, Manual lets users define crop regions per segment, Multi-speaker creates a split-screen layout when multiple speakers are present, and Static applies a fixed center crop. Supports conversion between 16:9, 9:16, 1:1, and 4:5.

</details>

<details>
<summary><b>Brand Kit System</b></summary>

Stores complete brand configurations that auto-apply to every generated clip. Each brand kit includes light and dark logo variants with configurable position and opacity, a color palette with primary, secondary, accent, and caption highlight colors, custom fonts uploaded as OTF or TTF files for heading, body, and caption text, intro and outro videos up to 60 seconds that automatically prepend and append to clips, a caption style preset, a thumbnail template, and audio branding with jingles or stingers. Unlimited brand kits per workspace allow agencies to manage multiple client brands from a single installation.

</details>

<details>
<summary><b>AI B-Roll Integration</b></summary>

Automatically inserts contextually relevant stock footage into videos. Qwen3 analyzes the script or narration and extracts keywords, then generates optimized search queries for the Pexels API filtered by orientation, resolution, and duration. A scoring algorithm ranks candidate clips by relevance to the narration, visual quality, color palette compatibility with the brand kit, and duration fit for the scene. Selected clips insert into the timeline with crossfade transitions. Static or slow footage automatically receives a Ken Burns pan-and-zoom effect for visual interest.

</details>

<details>
<summary><b>Text-to-Speech</b></summary>

Two TTS engines serve different needs. Kokoro delivers fast synthesis with low latency, ideal for batch processing and previews. Chatterbox provides higher quality narration with natural prosody and supports voice cloning from a reference audio sample. Both engines run as local FastAPI services with multiple voice options, speed controls, and engine selection. Voice cloning lets creators build a personal voice profile from a short audio clip and reuse it across all faceless videos for channel consistency.

</details>

<details>
<summary><b>Filler Word and Silence Removal</b></summary>

WhisperX classifies every audio segment as speech, filler word (um, uh, like, you know), or silence. The system generates a precise cut list of filler and silence timestamps, then FFmpeg removes those segments and crossfades the audio joins for seamless playback. A before-and-after waveform visualization in the editor highlights exactly what was removed, with the option to undo individual cuts.

</details>

<details>
<summary><b>Video Editor</b></summary>

A browser-based timeline editor for post-generation adjustments. Features include a multi-track timeline with playhead scrubber, trim handles on each clip for adjusting in and out points, drag-to-reorder for clip sequencing, layer controls for captions, music, and overlays, and a live video preview player powered by FFmpeg.wasm. The editor supports aspect ratio preview switching, caption style changes, brand kit swapping, and B-roll replacement without re-running the full pipeline.

</details>

<details>
<summary><b>Social Media Publishing</b></summary>

OAuth-based integration with YouTube, YouTube Shorts, TikTok, Instagram Reels, Facebook, LinkedIn, and X. Qwen3 generates platform-specific titles, descriptions, and hashtags optimized for each network's algorithm and character limits. A content calendar provides a drag-and-drop monthly and weekly scheduling grid with platform color coding. Queue-based auto-posting publishes clips at their scheduled times with platform-specific optimizations. Multi-account support lets users manage multiple channels per platform. Post-publication performance analytics track views, likes, shares, comments, and follower growth per clip and channel over time.

</details>

<details>
<summary><b>Competitor Intelligence</b></summary>

A built-in scraping engine powered by Crawlee and Playwright monitors competitor channels across YouTube, TikTok, Instagram, X, and Reddit. The system collects profiles, posts, engagement metrics, hashtags, and posting schedules, storing everything in PostgreSQL with time-series tracking. Celery beat handles recurring scrape schedules. Qwen3 provides content analysis and BERTopic detects emerging trends. The analytics dashboard visualizes follower growth, engagement rates, posting frequency, and top-performing content with side-by-side competitor comparisons. Trending content detection identifies viral topics, formats, and patterns. Hashtag analysis tracks tag performance and recommends optimal hashtags for your niche.

</details>

<details>
<summary><b>REST API</b></summary>

Full programmatic access to every platform feature. Versioned endpoints with API key or JWT authentication, auto-generated OpenAPI documentation, configurable rate limits with no artificial caps by default, and WebSocket connections for real-time job progress updates. Key endpoints cover project creation, clip generation, faceless video creation, captioning, reframing, B-roll generation, TTS, transcription, brand kit management, social publishing, and competitor scraping. Webhook support sends POST notifications to configured URLs on job completion. Compatible with n8n and Zapier for external automation workflows.

</details>

<details>
<summary><b>Music Generation</b></summary>

Meta's MusicGen model generates background music from text prompts. Configure mood, duration, tempo, and style to produce royalty-free tracks that match the tone of each video. Generated audio previews with waveform visualization in the editor before committing to the final render.

</details>

<details>
<summary><b>AI Thumbnail Generation</b></summary>

FLUX.1 schnell generates thumbnails from text prompts with YouTube-optimized styles. Users enter a description, select a style template, and the model produces multiple options to choose from. Text overlay support adds titles directly onto generated images. Thumbnails auto-generate as part of the faceless video pipeline and are available on-demand for clipping projects.

</details>

<details>
<summary><b>Batch Processing</b></summary>

Upload a CSV or spreadsheet to generate multiple videos in a single operation. A column mapping UI links spreadsheet fields to video parameters like topic, template, voice, music mood, and brand kit. The job queue processes items concurrently with individual progress tracking per row. Bulk download packages all completed outputs when the batch finishes.

</details>

<details>
<summary><b>Advanced Video Processing</b></summary>

Video upscaling via Real-ESRGAN enhances resolution for sharper output on high-resolution displays. Frame interpolation via RIFE generates intermediate frames for smooth slow-motion effects and frame rate conversion. Wan 2.1 T2V-1.3B generates short video clips from text prompts for use as visual elements. SAM 2 provides precise object segmentation for advanced compositing. Multi-camera editing syncs and switches between multiple camera angles within a single timeline.

</details>

<details>
<summary><b>Team Collaboration</b></summary>

Multi-user workspaces with role-based permissions for agencies and production teams. Invite members, assign roles with granular per-project access controls, and share brand kits, templates, and projects across the workspace. Designed for agencies managing 10+ client channels from a single OpenClip installation.

</details>

<details>
<summary><b>Plugin System and Marketplace</b></summary>

An extension architecture allows third-party plugins to add custom functionality, templates, caption styles, and integrations. A community template marketplace lets users browse, install, and publish their own faceless video templates, caption presets, and brand configurations. Install plugins from a URL or browse the marketplace directly from settings.

</details>

<br>

## ◈ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 15)                    │
│   Dashboard · Editor · Faceless Studio · Analytics        │
└────────────────────────┬───────────────────────────────┘
                         │ REST API / WebSocket
┌────────────────────────┴───────────────────────────────┐
│                 API Gateway (FastAPI)                      │
│         Auth · Jobs · Assets · Webhooks                   │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────┴───────────────────────────────┐
│                  Processing Layer                         │
│            Redis + Celery Job Queue                       │
│   Video Pipeline · AI Services · Media · Scraping         │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────┴───────────────────────────────┐
│                   AI Model Layer                          │
│  Whisper · Kokoro · Qwen3 · YOLO · FLUX · MusicGen       │
│  Chatterbox · SAM 2 · MediaPipe · Wan 2.1 · RIFE         │
│         Served via Ollama + Custom FastAPI                 │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────┴───────────────────────────────┐
│                   Storage Layer                           │
│       PostgreSQL · Redis · MinIO/GCS · SQLite(dev)        │
└────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, shadcn/ui, Tailwind CSS |
| Video Assembly | Remotion 4.x, FFmpeg 7.x |
| API | FastAPI, Python 3.12 |
| Job Queue | Redis 7, Celery 5.4+ |
| Database | PostgreSQL 16 |
| Object Storage | MinIO (self-hosted) or GCS (cloud) |
| LLM | Qwen3-32B via Ollama |
| STT | faster-whisper large-v3, WhisperX |
| TTS | Kokoro, Chatterbox |
| Computer Vision | YOLO11, MediaPipe, SAM 2, pyannote.audio |
| Image Generation | FLUX.1 schnell |
| Music Generation | MusicGen Medium |
| Video Generation | Wan 2.1 T2V-1.3B |
| Upscaling | Real-ESRGAN |
| Interpolation | RIFE |
| Scraping | Crawlee, Playwright |
| Deployment | Docker, docker-compose, Caddy |
| Cloud | GCP Cloud Run, Cloud SQL, Memorystore, GCS |

<br>

## ⚡ Quick Start

### Prerequisites

- Docker and Docker Compose
- NVIDIA GPU with 16GB+ VRAM (24GB recommended)
- 32GB+ RAM
- 50GB+ free disk space

### Self-Hosted (Docker)

```bash
git clone https://github.com/ayotov02/OpenClip.git
cd OpenClip
cp .env.example .env
docker compose up -d
```

Open `http://localhost:3000` in your browser.

### GCP Deployment

```bash
cd infra/terraform
terraform init
terraform apply
```

See `pre-plan/DEVOPS_STRATEGY.md` for full GCP deployment instructions.

<br>

## ◇ Roadmap

| Phase | Name | Timeline | Status |
|-------|------|----------|--------|
| 0 | GCP Infrastructure Setup | Pre-requisite | Planned |
| 1 | Foundation — Core clipping pipeline + basic UI | Weeks 1–6 | Planned |
| 2 | Intelligence — Reframing, B-roll, brand kits, API | Weeks 7–12 | Planned |
| 3 | Faceless Studio — End-to-end faceless video creation | Weeks 13–18 | Planned |
| 4 | Distribution — Social publishing + competitor intelligence | Weeks 19–24 | Planned |
| 5 | Polish and Scale — Voice cloning, dubbing, upscaling, plugins | Weeks 25–30 | Planned |

<br>

## ❖ Project Structure

```
OpenClip/
├── markdowns/                # Feature specs and UI/UX mapping
│   ├── features.md           # Complete feature list
│   └── ui-ux-mapping.md      # Page routes and component mapping
├── pre-plan/                 # Research, strategy, and implementation guides
│   ├── MASTER_RESEARCH.md    # Comprehensive market research
│   ├── PRD_STRATEGY.md       # Product requirements document
│   ├── FINAL_PRD.md          # Final approved PRD with GCP specs
│   ├── DEVOPS_STRATEGY.md    # Infrastructure and deployment strategy
│   ├── FRONTEND_DASHBOARD_PROMPT.md
│   ├── competitor_research.md
│   ├── competitords-design/
│   ├── research/             # Reddit community research
│   ├── scripts/              # Utility scripts
│   └── phase-roadmap/        # Step-by-step implementation guides
│       ├── gcp-setup/
│       ├── phase1-foundation/    (9 features)
│       ├── phase2-intelligence/  (8 features)
│       ├── phase3-faceless-studio/ (9 features)
│       ├── phase4-distribution/  (10 features)
│       └── phase5-polish-scale/  (10 features)
├── README.md
└── LICENSE
```

<br>

## ◆ Contributing

Contributions are welcome. OpenClip is a community-driven project and every contribution matters — whether it is code, documentation, bug reports, feature requests, or template designs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

<br>

## ◈ License

This project is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html). You are free to use, modify, and distribute this software, provided that any modified versions made available over a network also share their source code under the same license.

<br>

<div align="center">

**Built for creators who refuse to pay for what should be free.**

</div>
