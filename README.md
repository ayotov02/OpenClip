# OpenClip

Open-source AI video platform. Clip long-form videos into viral shorts, generate faceless content, add captions, spy on competitors, and publish everywhere. Free forever, no watermarks, self-hosted.

Two backends, one frontend. **Local** runs all AI on your GPU. **Premium** routes through API providers (OpenRouter, Kie.ai, Bright Data). Same codebase, same interface — swap with one config change.

## Architecture

```
frontend/                → Next.js 15 (shared UI, connects to either backend)
backend/                 → FastAPI + local AI models (GPU required)
openclip-premium-backend/→ FastAPI + API providers (no GPU)
landing-page-v2/         → Marketing site (Next.js 16)
```

Both backends run: **FastAPI + PostgreSQL + Redis + MinIO + Celery**

### Docker Domain Setup

```
https://openclip.local        → Caddy → frontend:3000 (Next.js)
https://openclip.local/api/*  → Caddy → api:8000     (FastAPI)
```

Single domain, path-based routing — no CORS issues. Caddy terminates TLS with locally-trusted certs via mkcert.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for frontend dev outside Docker)
- [mkcert](https://github.com/FiloSottile/mkcert) (for local HTTPS)
- NVIDIA GPU + drivers (local backend only)

---

### Option A: Local Backend (GPU)

```bash
# 1. Run setup (adds /etc/hosts, generates TLS certs, copies .env)
cd backend
./setup.sh

# 2. Edit .env if needed (defaults work for local dev)
# 3. Start all services
docker compose up -d

# 4. Pull the LLM model
docker compose exec ollama ollama pull qwen3:32b

# 5. Open https://openclip.local
```

---

### Option B: Premium Backend (No GPU)

```bash
# 1. Run setup
cd openclip-premium-backend
./setup.sh

# 2. Edit .env — add your Clerk, OpenRouter, Kie.ai keys
# 3. Start all services
docker compose up -d

# 4. Open https://openclip.local
```

**Required API keys:**
| Provider | Purpose | Sign up |
|----------|---------|---------|
| Clerk | Auth | https://dashboard.clerk.com |
| OpenRouter | LLM (Claude 4.5 → GPT-5 → Gemini 3) | https://openrouter.ai |
| Kie.ai | Video, image, voice, music | https://kie.ai |
| Bright Data | Scraping (optional) | https://brightdata.com |

---

### Frontend (standalone dev)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

Points to `http://localhost:8000` by default via Next.js rewrites. In Docker, Caddy handles routing so the frontend connects to the API on the same origin.

---

### Landing Page

```bash
cd landing-page-v2
npm install
npm run dev
# → http://localhost:3001
```

## Docker Services

All infrastructure services (PostgreSQL, Redis, MinIO, Ollama) are internal to the Docker network — no ports exposed to the host. Only Caddy exposes ports 80 and 443.

| Service | Internal URL | Notes |
|---------|-------------|-------|
| API | `api:8000` | FastAPI, healthchecked |
| Worker | — | Celery, GPU access (local only) |
| Caddy | `0.0.0.0:80/443` | Reverse proxy + TLS |
| PostgreSQL | `postgres:5432` | Internal only |
| Redis | `redis:6379` | Password-protected, internal only |
| MinIO | `minio:9000` | Internal only |
| Ollama | `ollama:11434` | Local backend only, internal |

Migrations run automatically on container start via `entrypoint.sh`.

## Environment Variables

All env vars are documented in each backend's `.env.example` with inline comments. Key ones:

| Variable | Local | Premium |
|----------|-------|---------|
| `APP_MODE` | `local` | `premium` |
| `DATABASE_URL` | PostgreSQL connection string | Same |
| `REDIS_URL` | Redis connection string | Same |
| `DOMAIN` | `openclip.local` | Same |
| `POSTGRES_PASSWORD` | `password` | Same |
| `REDIS_PASSWORD` | `openclip` | Same |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | — |
| `OPENROUTER_API_KEY` | — | Required |
| `KIEAI_API_KEY` | — | Required |
| `CLERK_SECRET_KEY` | — | Required |

`.env` defaults use `localhost` for direct host development. Docker Compose overrides hostnames to Docker service names via the `environment:` block.

## Tech Stack

**Backend:** FastAPI, SQLAlchemy, Celery, PostgreSQL, Redis, MinIO, Gunicorn
**Frontend:** Next.js 15, React 19, TypeScript, shadcn/ui, Remotion, Tailwind CSS
**Local AI:** Ollama (Qwen3), WhisperX, Kokoro TTS, FLUX.1, Wan 2.1, MusicGen, Real-ESRGAN
**Premium AI:** OpenRouter, Kie.ai (Runway/Veo/Kling/Sora/ElevenLabs/Suno/Topaz), Bright Data
**Infra:** Caddy (reverse proxy + TLS), Docker Compose, mkcert

## License

MIT
