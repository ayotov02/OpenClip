# Project Setup — Implementation Guide

## Overview
- **What:** Initialize the OpenClip monorepo with backend (Python/FastAPI), frontend (Next.js), AI services, Docker configuration, CI/CD pipeline, and development tooling.
- **Why:** A well-structured monorepo ensures consistency, simplifies Docker builds, and enables CI/CD from day one. This is the foundation everything else builds on.
- **Dependencies:** GCP Setup (for Artifact Registry and Cloud Build configuration)

## Architecture

### Monorepo Structure
```
openclip/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI entry point
│   │   ├── api/               # API route modules
│   │   │   ├── __init__.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       └── router.py
│   │   ├── core/              # Config, security, dependencies
│   │   │   ├── __init__.py
│   │   │   ├── config.py      # Pydantic settings
│   │   │   ├── security.py    # Auth utilities
│   │   │   └── deps.py        # FastAPI dependencies
│   │   ├── models/            # SQLAlchemy ORM models
│   │   │   └── __init__.py
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   │   └── __init__.py
│   │   ├── services/          # Business logic layer
│   │   │   └── __init__.py
│   │   ├── tasks/             # Celery task definitions
│   │   │   └── __init__.py
│   │   └── ai/                # AI model client wrappers
│   │       └── __init__.py
│   ├── alembic/               # Database migrations
│   │   ├── alembic.ini
│   │   └── versions/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_api/
│   │   └── test_services/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── pyproject.toml         # Ruff, mypy, pytest config
│   └── Dockerfile
│
├── frontend/                   # Next.js 15 frontend
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── (dashboard)/
│   │   ├── components/        # React components
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions
│   │   │   ├── api.ts         # API client
│   │   │   └── utils.ts
│   │   └── types/             # TypeScript type definitions
│   ├── public/
│   ├── tests/
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
│
├── services/                   # AI microservices
│   ├── whisper/
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── tts/
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── vision/
│       ├── app.py
│       ├── requirements.txt
│       └── Dockerfile
│
├── infra/                      # Infrastructure as Code
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── scripts/
│   ├── setup.sh               # First-time setup
│   ├── setup-models.sh        # Download AI models
│   └── generate-secrets.sh    # Generate .env secrets
│
├── docker/
│   ├── docker-compose.yml          # Production
│   ├── docker-compose.dev.yml      # Development
│   └── docker-compose.override.yml # Local overrides
│
├── .github/
│   └── workflows/
│       ├── ci.yml             # Lint + test on PR
│       └── deploy.yml         # Build + deploy on merge
│
├── .env.example
├── .gitignore
├── .pre-commit-config.yaml
├── LICENSE                     # AGPL-3.0
└── README.md
```

## Step-by-Step Implementation

### Step 1: Initialize Git Repository
```bash
mkdir openclip && cd openclip
git init
```

Create `.gitignore`:
```
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
dist/

# Node
node_modules/
.next/
out/

# Environment
.env
.env.local
*.env

# Docker
docker-compose.override.yml

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# AI Models (large files)
models/
*.bin
*.pt
*.onnx
*.safetensors
```

### Step 2: Set Up Backend (Python)
```bash
mkdir -p backend/app/{api/v1,core,models,schemas,services,tasks,ai}
mkdir -p backend/{alembic/versions,tests/{test_api,test_services}}
touch backend/app/__init__.py
touch backend/app/api/__init__.py
touch backend/app/api/v1/__init__.py
touch backend/app/core/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/services/__init__.py
touch backend/app/tasks/__init__.py
touch backend/app/ai/__init__.py
```

Create `backend/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.10.0
pydantic-settings>=2.6.0
sqlalchemy>=2.0.36
asyncpg>=0.30.0
alembic>=1.14.0
celery[redis]>=5.4.0
redis>=5.2.0
httpx>=0.28.0
python-multipart>=0.0.17
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
structlog>=24.4.0
google-cloud-storage>=2.18.0
google-cloud-secret-manager>=2.21.0
```

Create `backend/requirements-dev.txt`:
```
pytest>=8.3.0
pytest-asyncio>=0.24.0
pytest-cov>=6.0.0
httpx>=0.28.0
ruff>=0.8.0
mypy>=1.13.0
pre-commit>=4.0.0
factory-boy>=3.3.0
```

Create `backend/pyproject.toml`:
```toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.12"
strict = true

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

### Step 3: Set Up Frontend (Next.js)
```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd frontend
npx shadcn@latest init
```

### Step 4: Set Up Pre-commit Hooks
Create `.pre-commit-config.yaml` in root:
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-added-large-files
        args: [--maxkb=5000]
```

### Step 5: Create .env.example
```bash
# Database
DATABASE_URL=postgresql+asyncpg://openclip:password@localhost:5432/openclip

# Redis
REDIS_URL=redis://localhost:6379/0

# Storage
STORAGE_BACKEND=local  # or "gcs"
GCS_BUCKET_UPLOADS=openclip-prod-uploads
GCS_BUCKET_PROCESSED=openclip-prod-processed

# Auth
JWT_SECRET=change-me-in-production
API_KEY_SALT=change-me-in-production

# AI Services
OLLAMA_URL=http://localhost:11434
WHISPER_URL=http://localhost:8001
TTS_URL=http://localhost:8002

# Pexels
PEXELS_API_KEY=your-pexels-api-key

# Environment
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
```

### Step 6: Create GitHub Actions CI
Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install ruff mypy
      - run: ruff check backend/
      - run: ruff format --check backend/

  lint-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npx tsc --noEmit

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: openclip_test
          POSTGRES_USER: openclip
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt
      - run: cd backend && pytest tests/ -v --cov=app --cov-report=xml
        env:
          DATABASE_URL: postgresql+asyncpg://openclip:test@localhost:5432/openclip_test
          REDIS_URL: redis://localhost:6379/0
          JWT_SECRET: test-secret
          ENVIRONMENT: test

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npm test -- --passWithNoTests
```

## Best Practices
- **Monorepo:** Keep backend, frontend, and services in one repo for atomic commits and simplified CI.
- **Ruff over Black/isort/flake8:** Ruff is 10-100x faster and replaces multiple tools.
- **Pydantic Settings:** Use `pydantic-settings` for type-safe environment variable loading.
- **Async from day one:** Use `asyncpg` driver and `async def` endpoints for all I/O.
- **Pre-commit hooks:** Catch issues before they hit CI.

## Testing
- `ruff check backend/` — All Python lint checks pass
- `cd frontend && npm run lint` — All TypeScript lint checks pass
- `cd frontend && npx tsc --noEmit` — TypeScript compiles without errors
- `pytest backend/tests/ -v` — All tests pass

## Verification Checklist
- [ ] Git repository initialized with `.gitignore`
- [ ] Backend directory structure with all `__init__.py` files
- [ ] `requirements.txt` and `requirements-dev.txt` created
- [ ] `pyproject.toml` with ruff/mypy/pytest config
- [ ] Frontend initialized with Next.js 15 + shadcn/ui
- [ ] `.env.example` with all required environment variables
- [ ] `.pre-commit-config.yaml` configured
- [ ] GitHub Actions CI pipeline runs lint + test
- [ ] `ruff check` passes on backend
- [ ] `npm run lint` passes on frontend
