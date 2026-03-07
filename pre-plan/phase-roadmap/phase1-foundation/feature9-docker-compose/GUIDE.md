# Docker Compose Orchestration — Implementation Guide

## Overview
- **What:** Create Docker Compose configurations that orchestrate all OpenClip services for both local development and production deployment.
- **Why:** One-command deployment (`docker compose up`) is the primary install path. Users should go from `git clone` to working app in under 5 minutes.
- **Dependencies:** All other Phase 1 features (this ties them together)

## Architecture

### Service Map
```
docker-compose.yml (production)
├── frontend       (Next.js, port 3000)
├── api            (FastAPI, port 8000)
├── worker         (Celery worker, GPU)
├── worker-cpu     (Celery worker, CPU tasks)
├── ollama         (LLM service, port 11434, GPU)
├── whisper        (WhisperX service, port 8001, GPU)
├── tts            (TTS service, port 8002, GPU)
├── postgres       (PostgreSQL 16, port 5432)
├── redis          (Redis 7, port 6379)
├── minio          (S3-compatible storage, port 9000)
└── caddy          (Reverse proxy, ports 80/443)

docker-compose.dev.yml (development overrides)
├── Hot-reload for backend (uvicorn --reload)
├── Hot-reload for frontend (next dev)
├── Debug ports exposed
├── Volume mounts for live code changes
└── Smaller AI models (cpu profile)
```

### Profiles
```
cpu      → No GPU required, smaller models
gpu      → Single GPU, recommended models
full     → All services including scraping, monitoring
minimal  → Just infra (postgres, redis, minio) — bring your own services
```

### Network Architecture
```
openclip-network (bridge)
  ├── frontend → api (http://api:8000)
  ├── api → postgres, redis, minio, ollama, whisper, tts
  ├── worker → postgres, redis, minio, ollama, whisper, tts
  └── caddy → frontend, api (reverse proxy)

Only exposed ports: 80 (HTTP), 443 (HTTPS), 9001 (MinIO console)
```

## Step-by-Step Implementation

### Step 1: Create Production Docker Compose
Create `docker/docker-compose.yml`:
```yaml
name: openclip

services:
  # --- Core Services ---
  frontend:
    image: ghcr.io/openclip/frontend:latest
    build:
      context: ../frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:8000/api/v1
    depends_on:
      api:
        condition: service_healthy
    networks:
      - openclip
    profiles: ["gpu", "cpu", "full"]

  api:
    image: ghcr.io/openclip/api:latest
    build:
      context: ../backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file: ../.env
    environment:
      - DATABASE_URL=postgresql+asyncpg://openclip:${DB_PASSWORD}@postgres:5432/openclip
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_BACKEND=local
      - LOCAL_STORAGE_PATH=/app/data
      - OLLAMA_URL=http://ollama:11434
      - WHISPER_URL=http://whisper:8001
      - TTS_URL=http://tts:8002
    volumes:
      - app_data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - openclip
    profiles: ["gpu", "cpu", "full", "minimal"]

  worker:
    image: ghcr.io/openclip/api:latest
    command: celery -A app.worker worker -l info -Q ai,video -c 1
    env_file: ../.env
    environment:
      - DATABASE_URL=postgresql+asyncpg://openclip:${DB_PASSWORD}@postgres:5432/openclip
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_BACKEND=local
      - LOCAL_STORAGE_PATH=/app/data
      - OLLAMA_URL=http://ollama:11434
      - WHISPER_URL=http://whisper:8001
      - TTS_URL=http://tts:8002
    volumes:
      - app_data:/app/data
    depends_on:
      - api
      - redis
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    networks:
      - openclip
    profiles: ["gpu", "full"]

  worker-cpu:
    image: ghcr.io/openclip/api:latest
    command: celery -A app.worker worker -l info -Q default,publish,scrape -c 4
    env_file: ../.env
    environment:
      - DATABASE_URL=postgresql+asyncpg://openclip:${DB_PASSWORD}@postgres:5432/openclip
      - REDIS_URL=redis://redis:6379/0
      - STORAGE_BACKEND=local
      - LOCAL_STORAGE_PATH=/app/data
    volumes:
      - app_data:/app/data
    depends_on:
      - api
      - redis
    networks:
      - openclip
    profiles: ["gpu", "cpu", "full"]

  # --- AI Model Services ---
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - openclip
    profiles: ["gpu", "full"]

  whisper:
    image: ghcr.io/openclip/whisper:latest
    build:
      context: ../services/whisper
      dockerfile: Dockerfile
    ports:
      - "8001:8001"
    environment:
      - WHISPER_MODEL=large-v3
      - COMPUTE_TYPE=float16
      - DEVICE=cuda
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    networks:
      - openclip
    profiles: ["gpu", "full"]

  tts:
    image: ghcr.io/openclip/tts:latest
    build:
      context: ../services/tts
      dockerfile: Dockerfile
    ports:
      - "8002:8002"
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    networks:
      - openclip
    profiles: ["gpu", "full"]

  # --- Infrastructure ---
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: openclip
      POSTGRES_USER: openclip
      POSTGRES_PASSWORD: ${DB_PASSWORD:-openclip_dev}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openclip"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - openclip
    profiles: ["gpu", "cpu", "full", "minimal"]

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - openclip
    profiles: ["gpu", "cpu", "full", "minimal"]

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_USER:-openclip}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD:-openclip_dev}
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - openclip
    profiles: ["gpu", "cpu", "full", "minimal"]

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ../Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - frontend
      - api
    networks:
      - openclip
    profiles: ["full"]

networks:
  openclip:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  minio_data:
  ollama_data:
  app_data:
  caddy_data:
```

### Step 2: Create Development Override
Create `docker/docker-compose.dev.yml`:
```yaml
name: openclip

services:
  api:
    build:
      context: ../backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ../backend:/app
    environment:
      - DEBUG=true
      - LOG_LEVEL=DEBUG

  frontend:
    build:
      context: ../frontend
    command: npm run dev
    volumes:
      - ../frontend/src:/app/src
    environment:
      - NODE_ENV=development

  worker:
    command: celery -A app.worker worker -l debug -Q default,video,ai -c 1
    volumes:
      - ../backend:/app
```

### Step 3: Create Setup Script
Create `scripts/setup.sh`:
```bash
#!/bin/bash
set -e

echo "=== OpenClip Setup ==="

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install: https://docker.com"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "Docker Compose V2 is required."; exit 1; }

# Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate random passwords
  DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
  JWT_SECRET=$(openssl rand -base64 48)
  sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
  sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
  rm -f .env.bak
  echo "Generated .env with random secrets"
fi

# Detect GPU
if command -v nvidia-smi >/dev/null 2>&1; then
  PROFILE="gpu"
  echo "NVIDIA GPU detected. Using GPU profile."
else
  PROFILE="cpu"
  echo "No GPU detected. Using CPU profile."
fi

# Start services
echo "Starting OpenClip with $PROFILE profile..."
docker compose -f docker/docker-compose.yml --profile $PROFILE up -d

# Wait for health
echo "Waiting for services to be healthy..."
sleep 10

# Run migrations
docker compose -f docker/docker-compose.yml exec api alembic upgrade head

# Pull Ollama model (GPU only)
if [ "$PROFILE" = "gpu" ]; then
  echo "Pulling AI models (this may take a while)..."
  docker compose -f docker/docker-compose.yml exec ollama ollama pull qwen3:32b
fi

echo ""
echo "=== OpenClip is ready! ==="
echo "Dashboard: http://localhost:3000"
echo "API Docs:  http://localhost:8000/docs"
echo "MinIO:     http://localhost:9001"
```

### Step 4: Create Caddyfile
Create `Caddyfile`:
```
{
    admin off
}

:80 {
    handle /api/* {
        reverse_proxy api:8000
    }

    handle /docs {
        reverse_proxy api:8000
    }

    handle /redoc {
        reverse_proxy api:8000
    }

    handle {
        reverse_proxy frontend:3000
    }
}
```

## Best Practices
- **Health checks:** Every service should have a health check. Use `depends_on: condition: service_healthy` for ordered startup.
- **Named volumes:** Use named volumes for data persistence across restarts.
- **Profiles:** Use Docker Compose profiles to support different hardware configurations.
- **`.env` file:** Never commit `.env`. Use `.env.example` as a template.
- **GPU reservations:** Use `deploy.resources.reservations.devices` for GPU access.
- **Internal network:** Only expose ports that users need (80, 443, 9001 for MinIO console).
- **Setup script:** Automate first-run (secret generation, migrations, model pulling).

## Testing
- `docker compose --profile gpu up -d` — All services start
- `docker compose --profile cpu up -d` — CPU-only services start
- `docker compose --profile minimal up -d` — Only infra starts
- `curl http://localhost:8000/health` — API responds
- `curl http://localhost:3000` — Frontend loads
- `curl http://localhost:11434/api/tags` — Ollama responds

## Verification Checklist
- [ ] `docker compose --profile gpu up -d` starts all services
- [ ] `docker compose --profile cpu up -d` starts without GPU
- [ ] `docker compose --profile minimal up -d` starts infra only
- [ ] All health checks pass
- [ ] Frontend accessible at localhost:3000
- [ ] API accessible at localhost:8000
- [ ] API docs at localhost:8000/docs
- [ ] MinIO console at localhost:9001
- [ ] PostgreSQL accepts connections
- [ ] Redis accepts connections
- [ ] Ollama loads model (GPU profile)
- [ ] Setup script works on fresh machine
- [ ] `docker compose down -v` cleans up everything
