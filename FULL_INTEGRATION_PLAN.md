# OpenClip — Full Feature Integration Plan
## All 48 Features Mapped to Implementation, Gaps, and Remaining Work

**Version:** 2.0
**Date:** March 7, 2026
**Scope:** Both backends (local + premium), frontend, infrastructure
**Status:** Post-implementation audit — roadmap for completion

---

## Current State Summary

Both backends are structurally complete with 70+ API endpoints, 20 database models, 17 services, 20 Celery tasks, and 8 providers each (all with real implementations, no stubs). The foundation is solid. What remains is **wiring gaps** (endpoints that don't dispatch tasks), **missing service layers** (caption, reframe, B-roll services), **infrastructure hardening** (WebSocket scaling, rate limiting, OAuth flows), and **advanced features** (voice cloning, dubbing, multi-cam, plugins, marketplace).

---

## Feature Status Matrix

### Legend
- **DONE** — Fully implemented in both backends, wired end-to-end
- **PARTIAL** — Core code exists but has gaps (missing dispatch, stub logic, TODO)
- **SCAFFOLD** — Model + endpoint exist, business logic not wired
- **MISSING** — Not yet implemented

| # | Feature | Status | Local | Premium | Notes |
|---|---------|--------|-------|---------|-------|
| 1 | Platform Core | DONE | Y | Y | FastAPI, DB, Redis, MinIO, Celery |
| 2 | AI Video Clipping | PARTIAL | Y | Y | Upload + transcribe work; clip dispatch TODO in clips.py |
| 3 | AI Clip Scoring | DONE | Y | Y | LLM score_clips() wired in ai_tasks.py |
| 4 | Caption System | SCAFFOLD | N | N | No caption_service.py; apply_captions task deferred to Remotion Phase 2 |
| 5 | Inline Caption Editing | MISSING | N | N | Frontend-only; needs caption data model + API |
| 6 | Faceless Video Studio | DONE | Y | Y | Full pipeline: script → TTS → B-roll → music |
| 7 | Faceless Templates | PARTIAL | Y | Y | Template field exists on model; no template-specific rendering logic |
| 8 | Script Generation | DONE | Y | Y | LLM generate_script() returns structured JSON |
| 9 | TTS Integration | DONE | Y | Y | Kokoro (local) / ElevenLabs (premium) |
| 10 | AI Reframing | SCAFFOLD | N | N | No reframe_service.py; CV providers exist but not wired |
| 11 | Face Detection & Tracking | PARTIAL | Y | Y | YOLO provider exists; detect_speakers task logs warning only |
| 12 | AI B-Roll Integration | DONE | Y | Y | Pexels fetch in faceless pipeline |
| 13 | B-Roll Matching & Scoring | SCAFFOLD | N | N | No broll_service.py with scoring algorithm |
| 14 | Brand Kit System | DONE | Y | Y | Full CRUD, model, schema, service, endpoint |
| 15 | Filler Word & Silence Removal | MISSING | N | N | WhisperX can classify; no cut-list logic implemented |
| 16 | Video Editor UI | MISSING | N | N | Frontend-only; needs Remotion/FFmpeg.wasm integration |
| 17 | REST API | DONE | Y | Y | 70+ endpoints, OpenAPI auto-generated |
| 18 | Webhook System | DONE | Y | Y | WebhookConfig model, CRUD, webhook_service dispatch |
| 19 | Social Media Publishing | SCAFFOLD | Y | Y | PublishJob model + endpoints exist; OAuth flow not implemented |
| 20 | Content Calendar | DONE | Y | Y | CalendarEvent CRUD + drag-drop frontend |
| 21 | Auto-Posting | PARTIAL | Y | Y | publish_to_platform task exists; no platform API clients |
| 22 | Competitor Scraping | PARTIAL | Y | Y | Scraping providers done; scrape dispatch TODO in competitors.py |
| 23 | Competitor Analytics Dashboard | SCAFFOLD | Y | Y | Endpoints return DB data; no LLM-powered analysis |
| 24 | Trending Content Detection | SCAFFOLD | Y | Y | Trend model + endpoint exist; no detection algorithm |
| 25 | Hashtag Analysis | SCAFFOLD | Y | Y | Hashtag model + CRUD; no cross-platform tracking |
| 26 | Performance Analytics | SCAFFOLD | Y | Y | analytics_service returns mock summary; no platform API pulls |
| 27 | MusicGen Integration | DONE | Y | Y | MusicGen (local) / Suno (premium) fully wired |
| 28 | FLUX Thumbnail Generation | DONE | Y | Y | ImageGen provider + generate_thumbnail task |
| 29 | URL & Reddit Input Sources | PARTIAL | Y | Y | Faceless accepts URL; no URL content extraction logic |
| 30 | Batch Processing | DONE | Y | Y | BatchJob + BatchItem, process_batch dispatches sub-tasks |
| 31 | Voice Cloning | PARTIAL | Y | Y | clone_voice() in TTS provider ABC; Chatterbox/ElevenLabs implement it |
| 32 | AI Dubbing & Translation | MISSING | N | N | No translation pipeline |
| 33 | Video Upscaling | DONE | Y | Y | Real-ESRGAN (local) / Topaz (premium) |
| 34 | Frame Interpolation | MISSING | N | N | No RIFE provider |
| 35 | Multi-Camera Editing | MISSING | N | N | No multi-cam model or sync logic |
| 36 | Team & Workspace Collaboration | MISSING | N | N | No workspace model; Clerk supports orgs (premium) |
| 37 | Mobile Responsive UI & PWA | PARTIAL | — | — | Frontend uses responsive shadcn; no PWA manifest |
| 38 | Plugin & Extension System | MISSING | N | N | No plugin architecture |
| 39 | Community Template Marketplace | MISSING | N | N | No marketplace model or API |
| 40 | Docker Deployment | PARTIAL | Y | Y | Dockerfiles exist; docker-compose.yml not finalized |
| 41 | GCP Cloud Deployment | MISSING | N | N | No Cloud Run config, no Terraform/Pulumi |
| 42 | Job Queue System | DONE | Y | Y | Celery + Redis, 5 queues, retry logic, task routing |
| 43 | Video Processing Pipeline | PARTIAL | Y | Y | FFmpeg extract/cut done; caption burn + branding deferred |
| 44 | LLM Integration | DONE | Y | Y | Ollama (local) / OpenRouter (premium), brand context injection |
| 45 | Speech-to-Text | DONE | Y | Y | WhisperX (local) / ElevenLabs (premium) |
| 46 | Automation Integrations | PARTIAL | Y | Y | Webhook system done; no n8n/Zapier-specific patterns |
| 47 | Video Generation | DONE | Y | Y | Wan 2.1 (local) / Kie.ai (premium) |
| 48 | Object Segmentation | MISSING | N | N | No SAM 2 provider |

**Score: 22 DONE, 12 PARTIAL, 8 SCAFFOLD, 6 MISSING = ~70% functional**

---

## Phase 1: Critical Fixes (Pre-Feature Work)

These are runtime bugs and wiring gaps that must be fixed before any new features. All apply to BOTH backends identically.

### Commit F1: Fix async bridge and DB pool in Celery workers

**Problem:** `run_async()` in `tasks/utils.py` uses a ThreadPoolExecutor fallback that is unnecessary in Celery prefork workers. SQLAlchemy connection pools are inherited by forked workers, causing connection exhaustion.

**Files:** `backend/app/tasks/utils.py`, `openclip-premium-backend/app/tasks/utils.py`, `backend/app/tasks/celery_app.py`, `openclip-premium-backend/app/tasks/celery_app.py`

**Changes:**
1. Simplify `run_async()` to plain `asyncio.run(coro)` — Celery prefork workers have no running event loop
2. Add `worker_process_init` signal handler in `celery_app.py` to call `engine.dispose()` after fork
3. This prevents inherited connections from parent process being shared across workers

```python
# tasks/utils.py — simplified
def run_async(coro):
    return asyncio.run(coro)

# celery_app.py — add signal handler
from celery.signals import worker_process_init

@worker_process_init.connect
def init_worker(**kwargs):
    from app.core.database import engine
    asyncio.run(engine.dispose())
```

### Commit F2: Fix clip generation dispatch

**Problem:** `POST /projects/{id}/clips` in `clips.py` creates clip records but never dispatches the Celery pipeline (extract_audio → transcribe → score_clips → cut_clips).

**Files:** `backend/app/api/v1/clips.py`, `openclip-premium-backend/app/api/v1/clips.py`

**Changes:**
1. Import and call `extract_audio.delay(project_id)` which chains into transcribe → score → cut
2. Create a Job record to track progress
3. Return job_id in response for WebSocket progress tracking

### Commit F3: Fix competitor scrape dispatch

**Problem:** `POST /competitors/{id}/scrape` in `competitors.py` doesn't dispatch the scraping task.

**Files:** `backend/app/api/v1/competitors.py`, `openclip-premium-backend/app/api/v1/competitors.py`

**Changes:**
1. Import and call `scrape_tasks.scrape_profile.delay(competitor_id)`
2. Create a Job record for tracking

### Commit F4: Fix brand_context GET endpoint

**Problem:** `GET /brand-context` calls the update service instead of the read/list service.

**Files:** `backend/app/api/v1/brand_context.py`, `openclip-premium-backend/app/api/v1/brand_context.py`

**Changes:**
1. Fix the GET handler to call `brand_context_service.get_list(db, user.id)`

### Commit F5: Add authorization checks

**Problem:** PUT/DELETE endpoints for brand context, brand kits, projects, and other user-owned resources don't verify `resource.user_id == current_user.id`.

**Files:** All API route files with PUT/DELETE endpoints

**Changes:**
1. Add `if resource.user_id != user.id: raise HTTPException(403)` before mutations

### Commit F6: WebSocket scaling with Redis pub/sub

**Problem:** `websocket.py` uses in-memory `ConnectionManager` — only works for single-instance deployments.

**Files:** `backend/app/core/websocket.py`, `openclip-premium-backend/app/core/websocket.py`

**Changes:**
1. Replace in-memory dict with Redis pub/sub channels
2. Each WebSocket connection subscribes to `ws:user:{user_id}` channel
3. Task progress updates publish to the channel via Redis
4. All API instances receive and forward to connected clients

---

## Phase 2: Core Feature Completion (Features 2-15)

These complete the partially-implemented core features.

### Commit C1: Wire clip generation pipeline end-to-end

**Features covered:** #2 AI Video Clipping, #3 AI Clip Scoring

**Current state:** Models, endpoints, LLM scoring, FFmpeg cutting all exist independently. Not chained.

**Files to create/modify:**
- `app/services/clip_service.py` — Add `dispatch_clip_pipeline(project_id)` method
- `app/api/v1/clips.py` — Call dispatch on POST
- `app/tasks/video_tasks.py` — Chain: extract_audio → transcribe → score_clips → cut_clips

**Implementation:**
```
User uploads video → POST /projects (saves file to MinIO)
  → POST /projects/{id}/clips (dispatches pipeline)
    → extract_audio.delay(project_id)
      → transcribe.delay(project_id, audio_path)
        → score_clips.delay(project_id, transcript)
          → cut_clips.delay(project_id, scored_segments)
            → Each clip saved to MinIO + Clip model created
            → WebSocket: progress updates at each step
```

### Commit C2: Caption system with style presets

**Features covered:** #4 Caption System, #5 Inline Caption Editing

**Current state:** WhisperX produces word-level timestamps. No rendering or style system.

**Files to create:**
- `app/services/caption_service.py` — Caption generation, style application, SRT/VTT export
- `app/schemas/caption.py` — CaptionStyle, CaptionSegment schemas
- `app/api/v1/captions.py` — GET/PUT endpoints for caption editing

**Implementation:**
1. After transcription, auto-generate captions from word-level timestamps
2. Store as JSONB on Clip model: `captions: [{word, start, end, speaker}]`
3. 7 style presets: karaoke, pop, fade, highlight, minimal, bold, custom
4. Each style = JSON config: font, size, color, animation, position, outline
5. Frontend renders preview; final burn happens in Remotion export
6. Inline editing: PUT endpoint updates individual caption segments

### Commit C3: AI reframing with face tracking

**Features covered:** #10 AI Reframing, #11 Face Detection & Tracking

**Current state:** YOLO and MediaPipe providers exist in local backend. detect_speakers task is a warning stub.

**Files to create:**
- `app/services/reframe_service.py` — Orchestrates face detection → tracking → crop decisions
- `app/tasks/video_tasks.py` — Implement `detect_speakers` task fully

**Implementation:**
1. YOLO11 detects faces per frame (bounding boxes)
2. MediaPipe tracks 468-point landmarks for smooth tracking
3. pyannote identifies active speaker for intelligent focus
4. Smoothing algorithm prevents jerky crops (exponential moving average)
5. Four modes: auto (follow speaker), manual (user-set crop), split-screen (multi-speaker), static
6. Output: per-frame crop coordinates stored as JSONB on Clip
7. Applied during Remotion export or FFmpeg crop pass

### Commit C4: B-roll matching and scoring service

**Features covered:** #12 AI B-Roll Integration, #13 B-Roll Matching & Scoring

**Current state:** Pexels fetch exists in faceless_tasks.py. No scoring algorithm.

**Files to create:**
- `app/services/broll_service.py` — Search, score, rank, select B-roll

**Implementation:**
1. LLM generates search queries from narration text
2. Pexels API returns candidate clips
3. Scoring algorithm ranks by: relevance to narration (LLM-scored), visual quality (resolution, aspect ratio), color palette compatibility, duration fit to scene
4. Ken Burns effect parameters auto-generated for each selected clip
5. Crossfade transition metadata stored for Remotion assembly

### Commit C5: Filler word and silence removal

**Features covered:** #15 Filler Word & Silence Removal

**Current state:** WhisperX can produce word-level timestamps with confidence scores. No filler detection.

**Files to modify:**
- `app/services/clip_service.py` — Add filler/silence detection
- `app/tasks/video_tasks.py` — Add `remove_fillers` task

**Implementation:**
1. WhisperX word timestamps + confidence scores identify low-confidence segments
2. LLM classifies segments as speech, filler ("um", "uh", "like", "you know"), or silence
3. Generate cut list of timestamps to remove
4. FFmpeg removes segments with 50ms audio crossfade at join points
5. Before/after waveform data returned to frontend for visualization
6. Toggle: user can enable/disable per clip

### Commit C6: Faceless template rendering logic

**Features covered:** #7 Faceless Templates

**Current state:** `FacelessProject.template` field exists. No template-specific rendering.

**Files to create:**
- `app/services/template_service.py` — Template definitions and rendering configs

**Implementation:**
Six templates with distinct visual configs:
1. **Reddit Story** — Dark background, Reddit-style card overlay, text scroll animation
2. **Documentary** — Ken Burns on B-roll, lower-third titles, ambient music
3. **Top 10 Listicle** — Numbered segments, transition effects, countdown
4. **Motivational** — Bold text overlays on nature/urban footage, cinematic music
5. **Scary Story** — Dark visuals, horror ambience, suspense pacing
6. **Educational** — Clean layout, diagram placeholders, professional tone

Each template = JSON config: `{layout, transitions, text_style, music_mood, pacing, scene_duration_defaults}`
Applied during Remotion assembly phase.

### Commit C7: URL and Reddit content extraction

**Features covered:** #29 URL & Reddit Input Sources

**Current state:** Faceless accepts URL field. No extraction logic.

**Files to create:**
- `app/services/content_extractor.py` — URL content extraction

**Implementation:**
1. YouTube URL → extract transcript via YouTube API or yt-dlp
2. Reddit URL → extract post title, body, top comments via Reddit JSON API (append `.json`)
3. Generic URL → extract article text via readability algorithm (newspaper3k or trafilatura)
4. Extracted content passed to LLM script generation as source material
5. Source attribution stored on FacelessProject model

---

## Phase 3: Distribution Features (Features 19-26)

### Commit D1: Social media OAuth integration

**Features covered:** #19 Social Media Publishing (OAuth part)

**Current state:** SocialAccount model exists. No OAuth flow.

**Files to create/modify:**
- `app/services/social_auth_service.py` — OAuth 2.0 flow per platform
- `app/api/v1/settings.py` — Add OAuth callback endpoints

**Implementation per platform:**
1. **YouTube** — Google OAuth 2.0, YouTube Data API v3 for upload + metadata
2. **TikTok** — TikTok Login Kit, Content Publishing API
3. **Instagram** — Meta Business API (requires Facebook Page + IG Professional)
4. **Facebook** — Meta Graph API, Page publish permissions
5. **LinkedIn** — LinkedIn OAuth 2.0, UGC Post API
6. **X (Twitter)** — OAuth 2.0 PKCE, Media Upload + Tweet creation

Each platform:
- OAuth redirect → callback → store access + refresh tokens (encrypted in SocialAccount)
- Token refresh logic with expiry tracking
- Platform-specific video upload constraints (duration, size, format)

### Commit D2: Publishing pipeline with platform clients

**Features covered:** #19 Social Media Publishing (upload part), #21 Auto-Posting

**Current state:** publish_to_platform task exists. No platform API clients.

**Files to create:**
- `app/services/platform_clients/youtube.py`
- `app/services/platform_clients/tiktok.py`
- `app/services/platform_clients/instagram.py`
- `app/services/platform_clients/facebook.py`
- `app/services/platform_clients/linkedin.py`
- `app/services/platform_clients/twitter.py`

**Implementation:**
1. Load PublishJob → get SocialAccount → decrypt tokens
2. LLM generates platform-specific title, description, hashtags (using BrandContext)
3. Upload video via platform API
4. Store platform post ID + URL on PublishJob
5. Auto-posting: Celery ETA scheduling with retry on failure

### Commit D3: Competitor scraping dispatch and analysis

**Features covered:** #22 Competitor Scraping, #23 Competitor Analytics Dashboard

**Current state:** Scraping providers (Crawlee local / Bright Data premium) fully implemented. Endpoints exist. No dispatch wiring. No LLM analysis.

**Files to modify:**
- `app/api/v1/competitors.py` — Wire scrape dispatch
- `app/services/competitor_service.py` — Add analysis methods

**Implementation:**
1. `POST /competitors/{id}/scrape` → dispatches `scrape_profile.delay(competitor_id)`
2. Scraping provider returns: follower_count, following_count, post_count, bio, recent_posts
3. Store as CompetitorMetric time-series entry
4. Celery Beat schedule: recurring scrapes at user-configured frequency
5. LLM analysis: compare scraped data across competitors, identify patterns
6. Dashboard aggregation: follower growth, engagement rates, posting frequency, top content

### Commit D4: Trend detection algorithm

**Features covered:** #24 Trending Content Detection

**Current state:** Trend model exists. No detection logic.

**Files to modify:**
- `app/services/trend_service.py` — Add detection algorithm
- `app/tasks/scrape_tasks.py` — Add `detect_trends` task

**Implementation:**
1. Aggregate scraped competitor posts by topic/hashtag
2. Calculate velocity: engagement growth rate over 24h/7d/30d windows
3. LLM clusters similar topics using BrandContext for relevance scoring
4. Results stored as Trend records with: topic, velocity_score, platforms, related_posts
5. Frontend: feed of trending topics with platform badges and "create video from trend" CTA
6. Celery Beat: run detection daily or on-demand

### Commit D5: Hashtag tracking and recommendations

**Features covered:** #25 Hashtag Analysis

**Current state:** Hashtag model + CRUD endpoints exist. No cross-platform tracking.

**Files to modify:**
- `app/services/hashtag_service.py` — Add tracking and recommendation logic

**Implementation:**
1. Track hashtags from: scraped competitor posts, user's published content, trend detection
2. Metrics per hashtag: volume (post count), growth (% change), competition (saturation score)
3. LLM recommends hashtags based on BrandContext niche + audience
4. Recommendations returned with: `{hashtag, relevance_score, volume, growth, competition}`
5. User can "track" hashtags for ongoing monitoring

### Commit D6: Performance analytics from platform APIs

**Features covered:** #26 Performance Analytics

**Current state:** analytics_service returns static summary. No platform API data.

**Files to modify:**
- `app/services/analytics_service.py` — Pull metrics from platform APIs
- `app/tasks/publish_tasks.py` — Add `fetch_post_metrics` recurring task

**Implementation:**
1. After publishing, periodically pull metrics from each platform's API
2. YouTube: views, likes, comments, watch time, subscribers gained
3. TikTok: views, likes, shares, comments, profile views
4. Instagram: impressions, reach, likes, saves, shares
5. Store as time-series on PublishJob: `metrics_history: [{timestamp, views, likes, ...}]`
6. Aggregation: per-clip performance, per-channel growth, best-performing content
7. Celery Beat: fetch metrics every 6 hours for 30 days after publish

---

## Phase 4: Advanced Features (Features 31-39, 48)

### Commit A1: Voice cloning UI flow

**Features covered:** #31 Voice Cloning

**Current state:** `clone_voice()` exists in TTS provider ABC. Chatterbox and ElevenLabs implement it.

**Files to modify:**
- `app/api/v1/faceless.py` — Add voice cloning endpoint
- `app/models/faceless.py` — Add `custom_voice_id` field

**Implementation:**
1. User uploads reference audio (15-30 seconds)
2. Store reference audio in MinIO
3. Call `tts.clone_voice(text, reference_audio_path)` to generate speech in cloned voice
4. Save cloned voice profile for reuse (name, reference_audio_path, provider metadata)
5. Cloned voices appear in voice picker alongside built-in options

### Commit A2: AI dubbing and translation pipeline

**Features covered:** #32 AI Dubbing & Translation

**Current state:** Not implemented.

**Files to create:**
- `app/services/dubbing_service.py` — Translation + re-synthesis pipeline
- `app/tasks/ai_tasks.py` — Add `dub_video` task

**Implementation:**
1. Extract transcript from source video (STT provider)
2. Translate transcript via LLM (brand context adjusts tone for target language)
3. Re-synthesize voiceover in target language (TTS provider with multilingual support)
4. Align new audio to original video timing (stretch/compress to match scene durations)
5. Mix translated audio with original background music/effects
6. Supported languages: start with top 10 (EN, ES, FR, DE, PT, JA, KO, ZH, AR, HI)
7. Store as new Clip variant with `language` field

### Commit A3: Frame interpolation with RIFE

**Features covered:** #34 Frame Interpolation

**Current state:** Not implemented. UpscalingProvider ABC exists but no frame interpolation method.

**Files to create:**
- `app/providers/cv/rife.py` (local) — RIFE frame interpolation
- Premium: use Topaz via Kie.ai (video enhancement includes frame interpolation)

**Implementation:**
1. Add `interpolate_frames()` to base provider or create FrameInterpolationProvider ABC
2. RIFE generates intermediate frames for 2x/4x frame rate increase
3. Use case: smooth slow-motion (select clip segment → apply 0.5x speed → interpolate to maintain smoothness)
4. Output: new video file with interpolated frames, stored in MinIO

### Commit A4: SAM 2 object segmentation

**Features covered:** #48 Object Segmentation

**Current state:** Not implemented. Listed in provider plan but no code.

**Files to create:**
- `app/providers/cv/sam2.py` — SAM 2 segmentation provider

**Implementation:**
1. User clicks/draws on video frame to select object
2. SAM 2 generates precise segmentation mask
3. Track mask across frames for video segmentation
4. Use cases: background replacement, object removal, compositing
5. Store masks as binary data in MinIO, metadata on Clip model

### Commit A5: Team and workspace collaboration

**Features covered:** #36 Team & Workspace Collaboration

**Current state:** Not implemented. Premium backend has Clerk which supports Organizations.

**Files to create:**
- `app/models/workspace.py` — Workspace, WorkspaceMember models
- `app/services/workspace_service.py` — Workspace CRUD + member management
- `app/api/v1/workspaces.py` — Workspace endpoints

**Implementation:**
1. Workspace model: `{id, name, owner_id, plan, settings}`
2. WorkspaceMember: `{workspace_id, user_id, role: owner|admin|editor|viewer}`
3. All user-owned resources get `workspace_id` FK (nullable for personal)
4. Permission checks: owner/admin can manage members, editors can create/edit content, viewers read-only
5. Premium: integrate with Clerk Organizations for managed team auth
6. Local: self-managed roles with JWT claims

### Commit A6: Multi-camera editing

**Features covered:** #35 Multi-Camera Editing

**Current state:** Not implemented.

**Files to create:**
- `app/models/multicam.py` — MultiCamSession, CameraAngle models
- `app/services/multicam_service.py` — Sync and switch logic

**Implementation:**
1. User uploads multiple video files (different angles of same event)
2. Audio fingerprinting or timecode sync aligns all angles
3. User sets switch points on timeline (or AI auto-switches based on active speaker)
4. Export: single video with cuts between angles at switch points
5. FFmpeg concat with frame-accurate cuts
6. **Priority: LOW** — This is a Phase 5 nice-to-have

### Commit A7: Plugin and extension system

**Features covered:** #38 Plugin & Extension System

**Current state:** Not implemented.

**Files to create:**
- `app/plugins/` — Plugin loader, registry, hooks
- `app/api/v1/plugins.py` — Plugin management endpoints

**Implementation:**
1. Plugin manifest: `{name, version, hooks, settings, routes}`
2. Hook points: pre_process, post_process, pre_publish, post_publish, custom_provider
3. Plugin loader discovers plugins from `plugins/` directory
4. Each plugin can register FastAPI routes under `/api/v1/plugins/{name}/`
5. Enable/disable via settings API
6. **Priority: LOW** — Phase 5 extensibility feature

### Commit A8: Community template marketplace

**Features covered:** #39 Community Template Marketplace

**Current state:** Not implemented.

**Files to create:**
- `app/models/marketplace.py` — MarketplaceTemplate, TemplateReview
- `app/api/v1/marketplace.py` — Browse, install, publish templates

**Implementation:**
1. Users can publish their faceless templates (config JSON + preview thumbnail)
2. Browse marketplace: search, filter by category, sort by popularity/rating
3. Install: copies template config to user's local templates
4. Reviews: 1-5 stars + text review
5. Moderation: admin approval before public listing
6. **Priority: LOW** — Phase 5 community feature

---

## Phase 5: Infrastructure & Production Hardening

### Commit I1: Rate limiting

**Current state:** `rate_limit.py` exists but not applied to any endpoint.

**Files to modify:**
- `app/core/rate_limit.py` — Implement Redis-backed sliding window
- `app/api/v1/router.py` — Apply as middleware or per-route dependency

**Implementation:**
1. Redis-backed sliding window rate limiter
2. Default: 100 requests/minute per user
3. Stricter for AI endpoints: 20 requests/minute (chat, score, generate)
4. API key users: configurable per-key limits
5. Return `429 Too Many Requests` with `Retry-After` header

### Commit I2: Alembic migrations

**Current state:** alembic.ini and env.py exist. No migration files generated.

**Files to create:**
- `alembic/versions/001_initial.py` — Full schema migration

**Implementation:**
1. Generate initial migration from all 20 models
2. Include indexes: user_id FKs, created_at timestamps, status fields
3. JSONB GIN indexes on: brand_context fields, clip captions, project metadata
4. Test migration up and down

### Commit I3: Docker Compose finalization

**Features covered:** #40 Docker Deployment

**Current state:** Dockerfiles exist. docker-compose.yml incomplete.

**Files to create/modify:**
- `backend/docker-compose.yml` — Full local stack (10 services)
- `backend/docker-compose.dev.yml` — Development overrides
- `openclip-premium-backend/docker-compose.yml` — Premium stack (6 services)

**Local stack services:**
```yaml
api, worker, ollama, whisper, tts, cv-service, postgres, redis, minio, caddy
```

**Premium stack services:**
```yaml
api, worker, postgres, redis, minio, caddy
```

### Commit I4: GCP Cloud Deployment

**Features covered:** #41 GCP Cloud Deployment

**Files to create:**
- `infrastructure/terraform/` — GCP Terraform modules
- Cloud Run services, Cloud SQL, Memorystore, Cloud Storage
- GPU node pool for local backend AI services
- Scale-to-zero configuration for cost optimization

### Commit I5: Comprehensive test suite

**Files to create:**
- `tests/unit/` — Provider mocks, service logic tests
- `tests/integration/` — API endpoint tests with test DB
- `tests/conftest.py` — Fixtures, test DB setup, mock providers

**Minimum coverage targets:**
1. All provider methods mocked and tested
2. All API endpoints tested with auth
3. All Celery tasks tested with mock providers
4. Brand context injection verified in all AI paths
5. Authorization checks verified (user isolation)

### Commit I6: Kie.ai webhook handler (premium only)

**Current state:** Kie.ai providers poll for task completion. No webhook receiver.

**Files to create:**
- `openclip-premium-backend/app/api/v1/webhooks.py` — Kie.ai callback handler

**Implementation:**
1. `POST /api/v1/webhooks/kieai` receives task completion callbacks
2. Verify webhook signature
3. Look up task_id → job_id mapping from Redis
4. Update Job status and download result file
5. Store result in MinIO + update relevant model

---

## Phase 6: Frontend Completion

### Frontend Feature Gaps

| Page | Current State | Missing |
|------|--------------|---------|
| `/projects/new` | Upload form exists | URL paste + processing progress |
| `/projects/:id` | Basic view | Clip cards with scores, download, publish buttons |
| `/projects/:id/editor` | Not built | Timeline editor (Remotion Player + FFmpeg.wasm) |
| `/faceless/:id/editor` | Not built | Scene editor with B-roll swap, voice picker, music panel |
| `/captions` | Not built | Standalone caption generator page |
| `/analytics/competitors` | Chart placeholders | Real data from competitor scraping |
| `/analytics/trends` | Placeholder | Trending feed with create-from-trend CTA |
| `/analytics/hashtags` | Placeholder | Hashtag table with recommendations |
| `/settings/accounts` | Form exists | OAuth connect buttons per platform |
| `/templates` | Not built | Marketplace browser |
| `/docs` | Not built | Embedded OpenAPI viewer |

### Frontend Priority Commits

```
FE1: Project detail page with scored clip cards + download
FE2: Video player component with caption overlay toggle
FE3: Faceless scene editor with B-roll and voice panels
FE4: Caption style picker with live preview
FE5: OAuth connect flow for social accounts
FE6: Real-time job progress via WebSocket
FE7: Timeline editor MVP (Remotion Player)
FE8: Analytics pages with real chart data
FE9: PWA manifest + service worker for offline support
```

---

## Commit Sequence (Recommended Order)

### Sprint 1: Fix & Stabilize (Commits F1-F6)
```
F1: Fix async bridge + DB pool in Celery workers
F2: Fix clip generation dispatch
F3: Fix competitor scrape dispatch
F4: Fix brand_context GET endpoint
F5: Add authorization checks on all mutations
F6: WebSocket scaling with Redis pub/sub
```

### Sprint 2: Core Pipeline Completion (Commits C1-C7)
```
C1: Wire clip generation pipeline end-to-end
C2: Caption system with 7 style presets
C3: AI reframing with face tracking
C4: B-roll matching and scoring service
C5: Filler word and silence removal
C6: Faceless template rendering configs
C7: URL and Reddit content extraction
```

### Sprint 3: Distribution (Commits D1-D6)
```
D1: Social media OAuth integration
D2: Publishing pipeline with platform clients
D3: Competitor scraping dispatch + LLM analysis
D4: Trend detection algorithm
D5: Hashtag tracking and recommendations
D6: Performance analytics from platform APIs
```

### Sprint 4: Advanced Features (Commits A1-A8)
```
A1: Voice cloning UI flow
A2: AI dubbing and translation pipeline
A3: Frame interpolation with RIFE
A4: SAM 2 object segmentation
A5: Team and workspace collaboration
A6: Multi-camera editing
A7: Plugin and extension system
A8: Community template marketplace
```

### Sprint 5: Infrastructure (Commits I1-I6)
```
I1: Rate limiting
I2: Alembic migrations
I3: Docker Compose finalization
I4: GCP Cloud Deployment
I5: Comprehensive test suite
I6: Kie.ai webhook handler
```

### Sprint 6: Frontend (Commits FE1-FE9)
```
FE1-FE9: Frontend feature completion (see above)
```

---

## Feature-to-File Mapping (Complete Reference)

| Feature | API Route | Service | Task | Provider | Model |
|---------|-----------|---------|------|----------|-------|
| Video Clipping | clips.py | clip_service.py | video_tasks.py | stt, llm | Clip |
| Clip Scoring | clips.py | clip_service.py | ai_tasks.py | llm | Clip |
| Captions | captions.py (NEW) | caption_service.py (NEW) | video_tasks.py | stt | Clip |
| Faceless Studio | faceless.py | faceless_service.py | faceless_tasks.py | llm, tts, music | FacelessProject |
| Templates | faceless.py | template_service.py (NEW) | — | — | FacelessProject |
| TTS | faceless.py | faceless_service.py | faceless_tasks.py | tts | FacelessScene |
| Reframing | clips.py | reframe_service.py (NEW) | video_tasks.py | cv (yolo, mediapipe) | Clip |
| B-Roll | faceless.py | broll_service.py (NEW) | faceless_tasks.py | llm | FacelessScene |
| Brand Kit | brands.py | brand_kit_service.py | — | — | BrandKit |
| Filler Removal | clips.py | clip_service.py | video_tasks.py | stt | Clip |
| Publishing | publish.py | publish_service.py | publish_tasks.py | — | PublishJob |
| Calendar | calendar.py | calendar_service.py | — | — | CalendarEvent |
| Competitors | competitors.py | competitor_service.py | scrape_tasks.py | scraping | Competitor |
| Trends | trends.py | trend_service.py | scrape_tasks.py | scraping, llm | Trend |
| Hashtags | hashtags.py | hashtag_service.py | — | — | Hashtag |
| Analytics | analytics.py | analytics_service.py | publish_tasks.py | — | PublishJob |
| Chat (4 modes) | chat.py | — | — | llm | — |
| Batch | batch.py | batch_service.py | batch_tasks.py | — | BatchJob |
| Webhooks | settings.py | webhook_service.py | — | — | WebhookConfig |
| Upscaling | assets.py | — | ai_tasks.py | upscaling | CreativeAsset |
| Thumbnails | faceless.py | — | ai_tasks.py | image_gen | CreativeAsset |
| Music Gen | faceless.py | — | faceless_tasks.py | music_gen | FacelessScene |
| Video Gen | assets.py | — | — | video_gen | CreativeAsset |
| Voice Cloning | faceless.py | — | — | tts | — |
| Dubbing | — (NEW) | dubbing_service.py (NEW) | ai_tasks.py | stt, llm, tts | Clip |
| Segmentation | — (NEW) | — | — | cv (sam2) | — |
| Teams | workspaces.py (NEW) | workspace_service.py (NEW) | — | — | Workspace (NEW) |
| Multi-cam | — (NEW) | multicam_service.py (NEW) | — | — | MultiCamSession (NEW) |

---

## Estimated Effort Distribution

| Phase | Commits | Complexity | Dependencies |
|-------|---------|-----------|--------------|
| Critical Fixes | 6 | Low-Medium | None — do first |
| Core Features | 7 | High | Fixes complete |
| Distribution | 6 | High | Core features complete |
| Advanced | 8 | Medium-High | Distribution complete |
| Infrastructure | 6 | Medium | Can parallel with Advanced |
| Frontend | 9 | Medium | Backend features complete |

**Total: 42 commits to 100% feature completion across both backends + frontend.**

---

## Best Practices Applied

1. **Celery Canvas Pipelines** — Use `chain()` and `chord()` for multi-step workflows instead of manual `.delay()` chaining
2. **State Machine for Jobs** — Job status transitions: `pending → processing → completed/failed` with guards against invalid transitions
3. **Redis Pub/Sub for WebSocket** — All job progress publishes to Redis channels, any API instance can deliver to clients
4. **Presigned URLs for Upload** — Frontend gets presigned MinIO URLs for direct upload, bypassing API server for large files
5. **Connection Pool Disposal** — `worker_process_init` signal disposes inherited SQLAlchemy pools after Celery fork
6. **Brand Context Caching** — Cache active BrandContext in Redis (5-minute TTL) to avoid DB hits on every AI call
7. **Structured JSON Outputs** — All LLM calls that expect JSON use `response_format: {type: "json_object"}` for reliable parsing
8. **Idempotent Tasks** — All Celery tasks are idempotent and safe to retry (check before create, upsert patterns)
9. **Webhook Signature Verification** — Both incoming (Kie.ai) and outgoing (user) webhooks verified with HMAC signatures
10. **Per-User Resource Isolation** — Every query filtered by `user_id` (or `workspace_id` when teams are implemented)
