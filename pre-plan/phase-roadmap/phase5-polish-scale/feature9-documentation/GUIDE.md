# Documentation — Implementation Guide

## Overview
- **What:** Create comprehensive documentation covering API reference (auto-generated from OpenAPI), user guides (getting started, tutorials), contributor docs (architecture, coding standards, PR process), and self-hosting guide. Deploy as a static site with search.
- **Why:** Documentation is the difference between a project people try once and a project people adopt. Good docs reduce support burden and accelerate community contributions.
- **Dependencies:** Phase 2 Feature 8 (REST API), All prior features (documented as they're built)

## Architecture

### Documentation Stack
```
MkDocs Material (Python-based, Markdown → static HTML)
├── Automatic API reference from OpenAPI spec
├── Full-text search (built-in lunr.js)
├── Dark/light mode
├── Versioned docs (mike)
└── Deployed as static files (GCS bucket or GitHub Pages)
```

### Directory Structure
```
docs/
├── mkdocs.yml                    # MkDocs configuration
├── docs/
│   ├── index.md                  # Landing page
│   ├── getting-started/
│   │   ├── quickstart.md         # 5-minute setup guide
│   │   ├── docker-setup.md       # Docker Compose setup
│   │   ├── gcp-deployment.md     # GCP Cloud deployment
│   │   └── configuration.md     # Environment variables reference
│   ├── guides/
│   │   ├── clipping.md           # How to create clips from videos
│   │   ├── faceless-videos.md    # How to create faceless content
│   │   ├── batch-processing.md   # How to use batch processing
│   │   ├── captions.md           # Caption styles and customization
│   │   ├── brand-kits.md         # Setting up brand kits
│   │   ├── publishing.md         # Social media publishing
│   │   ├── automation.md         # n8n / Zapier workflows
│   │   └── analytics.md          # Understanding analytics dashboard
│   ├── api/
│   │   ├── overview.md           # API authentication, rate limits
│   │   ├── reference.md          # Auto-generated from OpenAPI
│   │   ├── webhooks.md           # Webhook event reference
│   │   └── examples.md           # cURL / Python / JS examples
│   ├── self-hosting/
│   │   ├── requirements.md       # Hardware requirements (CPU/GPU)
│   │   ├── docker-compose.md     # Full Docker Compose reference
│   │   ├── gpu-setup.md          # NVIDIA driver + container toolkit
│   │   ├── storage.md            # MinIO / GCS configuration
│   │   ├── reverse-proxy.md      # Caddy / Nginx setup
│   │   └── upgrading.md          # Version upgrade procedures
│   ├── contributing/
│   │   ├── architecture.md       # System architecture overview
│   │   ├── development.md        # Local dev environment setup
│   │   ├── coding-standards.md   # Code style, linting, typing
│   │   ├── testing.md            # Test patterns and running tests
│   │   ├── pull-requests.md      # PR process and review guidelines
│   │   └── plugins.md            # How to build plugins
│   └── changelog.md              # Version history
├── overrides/
│   └── main.html                 # Custom theme overrides
└── scripts/
    └── generate-api-ref.py       # Script to generate API docs from OpenAPI
```

## Step-by-Step Implementation

### Step 1: Set Up MkDocs Material

```bash
pip install mkdocs-material mkdocs-awesome-pages-plugin mkdocs-redirects mike
```

```yaml
# docs/mkdocs.yml
site_name: OpenClip Documentation
site_url: https://docs.openclip.dev
site_description: Open-source AI video creation platform
repo_url: https://github.com/openclip/openclip
repo_name: openclip/openclip

theme:
  name: material
  palette:
    - media: "(prefers-color-scheme: light)"
      scheme: default
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
  features:
    - navigation.instant
    - navigation.tracking
    - navigation.sections
    - navigation.expand
    - navigation.top
    - search.suggest
    - search.highlight
    - content.code.copy
    - content.tabs.link
  icon:
    repo: fontawesome/brands/github

nav:
  - Home: index.md
  - Getting Started:
    - Quickstart: getting-started/quickstart.md
    - Docker Setup: getting-started/docker-setup.md
    - GCP Deployment: getting-started/gcp-deployment.md
    - Configuration: getting-started/configuration.md
  - User Guides:
    - Creating Clips: guides/clipping.md
    - Faceless Videos: guides/faceless-videos.md
    - Batch Processing: guides/batch-processing.md
    - Captions: guides/captions.md
    - Brand Kits: guides/brand-kits.md
    - Publishing: guides/publishing.md
    - Automation: guides/automation.md
    - Analytics: guides/analytics.md
  - API Reference:
    - Overview: api/overview.md
    - Endpoints: api/reference.md
    - Webhooks: api/webhooks.md
    - Examples: api/examples.md
  - Self-Hosting:
    - Requirements: self-hosting/requirements.md
    - Docker Compose: self-hosting/docker-compose.md
    - GPU Setup: self-hosting/gpu-setup.md
    - Storage: self-hosting/storage.md
    - Reverse Proxy: self-hosting/reverse-proxy.md
    - Upgrading: self-hosting/upgrading.md
  - Contributing:
    - Architecture: contributing/architecture.md
    - Development: contributing/development.md
    - Coding Standards: contributing/coding-standards.md
    - Testing: contributing/testing.md
    - Pull Requests: contributing/pull-requests.md
    - Building Plugins: contributing/plugins.md
  - Changelog: changelog.md

markdown_extensions:
  - admonition
  - pymdownx.details
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.highlight:
      anchor_liners: true
      line_spans: __span
      pygments_lang_class: true
  - pymdownx.inlinehilite
  - pymdownx.snippets
  - attr_list
  - md_in_html
  - tables
  - toc:
      permalink: true

plugins:
  - search
  - awesome-pages
```

### Step 2: Create Quickstart Guide

```markdown
<!-- docs/docs/getting-started/quickstart.md -->
# Quickstart

Get OpenClip running in 5 minutes with Docker.

## Prerequisites

- Docker & Docker Compose v2
- NVIDIA GPU with 16GB+ VRAM (for AI features) OR CPU-only mode
- 16GB RAM minimum

## Quick Start

```bash
# Clone the repository
git clone https://github.com/openclip/openclip.git
cd openclip

# Run setup script (generates secrets, pulls images)
./scripts/setup.sh

# Start all services (GPU mode)
docker compose --profile gpu up -d

# Or CPU-only mode (no GPU required, slower AI processing)
docker compose --profile cpu up -d
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

## First Steps

1. **Create an account** at the login page
2. **Upload a video** or paste a YouTube URL
3. **Generate clips** — AI analyzes and extracts the best moments
4. **Customize captions** — Choose a style and edit text
5. **Export or publish** — Download or post directly to social media

## What's Running

| Service     | URL                          | Purpose              |
|-------------|------------------------------|----------------------|
| Frontend    | http://localhost:3000        | Web dashboard        |
| API         | http://localhost:8000        | REST API             |
| API Docs    | http://localhost:8000/docs   | Swagger UI           |
| MinIO       | http://localhost:9001        | Object storage UI    |
```

### Step 3: Create API Reference Generator

```python
# docs/scripts/generate-api-ref.py
"""Generate API reference markdown from OpenAPI spec."""
import json
import httpx

def fetch_openapi_spec(api_url: str = "http://localhost:8000") -> dict:
    resp = httpx.get(f"{api_url}/openapi.json")
    return resp.json()

def generate_markdown(spec: dict) -> str:
    lines = ["# API Reference\n"]
    lines.append(f"> **Base URL:** `{spec.get('servers', [{}])[0].get('url', '/api/v1')}`\n")
    lines.append(f"> **Version:** {spec['info']['version']}\n\n")

    # Group by tags
    tag_groups: dict[str, list] = {}
    for path, methods in spec["paths"].items():
        for method, details in methods.items():
            if method in ("get", "post", "put", "patch", "delete"):
                tag = (details.get("tags") or ["Other"])[0]
                tag_groups.setdefault(tag, []).append((method.upper(), path, details))

    for tag, endpoints in sorted(tag_groups.items()):
        lines.append(f"## {tag}\n")
        for method, path, details in endpoints:
            summary = details.get("summary", "")
            lines.append(f"### `{method} {path}`\n")
            if summary:
                lines.append(f"{summary}\n")
            if details.get("description"):
                lines.append(f"\n{details['description']}\n")
            # Parameters
            params = details.get("parameters", [])
            if params:
                lines.append("\n**Parameters:**\n")
                lines.append("| Name | In | Type | Required | Description |")
                lines.append("|------|-----|------|----------|-------------|")
                for p in params:
                    schema = p.get("schema", {})
                    lines.append(
                        f"| `{p['name']}` | {p['in']} | {schema.get('type', 'string')} "
                        f"| {p.get('required', False)} | {p.get('description', '')} |"
                    )
            lines.append("")
    return "\n".join(lines)

if __name__ == "__main__":
    spec = fetch_openapi_spec()
    md = generate_markdown(spec)
    with open("docs/docs/api/reference.md", "w") as f:
        f.write(md)
    print("API reference generated.")
```

### Step 4: Create Architecture Documentation

```markdown
<!-- docs/docs/contributing/architecture.md -->
# Architecture Overview

## System Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│   FastAPI     │────▶│  PostgreSQL  │
│  (Next.js)   │     │   Backend     │     │  (Database)  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │    Redis     │
                    │  (Queue +    │
                    │   Cache)     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Celery   │ │  Celery   │ │  Celery   │
        │ Worker    │ │ Worker    │ │ Worker    │
        │ (default) │ │  (video)  │ │   (ai)    │
        └──────────┘ └──────────┘ └────┬─────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │  Ollama   │ │ WhisperX  │ │   TTS    │
                    │  (LLM)   │ │  (STT)    │ │(Kokoro)  │
                    └──────────┘ └──────────┘ └──────────┘
```

## Key Design Decisions

1. **Celery queue routing** — AI tasks, video tasks, and default tasks run on separate queues with independent concurrency limits
2. **Microservice AI** — Each AI model runs as an independent FastAPI service with its own Docker container
3. **Async everywhere** — FastAPI + async SQLAlchemy + httpx for non-blocking I/O
4. **Remotion for composition** — TypeScript-based video composition allows React component templates
5. **Storage abstraction** — S3-compatible API supports both MinIO (self-hosted) and GCS (cloud)
```

### Step 5: Create Self-Hosting Requirements Guide

```markdown
<!-- docs/docs/self-hosting/requirements.md -->
# Hardware Requirements

## Minimum (CPU-only mode)
- **CPU:** 8 cores
- **RAM:** 16 GB
- **Storage:** 100 GB SSD
- **Note:** AI processing will be slow. Suitable for testing only.

## Recommended (GPU mode)
- **CPU:** 8+ cores
- **RAM:** 32 GB
- **GPU:** NVIDIA GPU with 16GB+ VRAM (RTX 4080, A4000, L4)
- **Storage:** 500 GB NVMe SSD
- **Network:** 100 Mbps+ for video upload/download

## Production
- **CPU:** 16+ cores
- **RAM:** 64 GB
- **GPU:** NVIDIA GPU with 24GB VRAM (RTX 4090, A5000, L4)
- **Storage:** 1 TB NVMe SSD + object storage (MinIO/GCS)
- **Network:** 1 Gbps

## GPU Compatibility
| GPU              | VRAM  | Supported Models              |
|------------------|-------|-------------------------------|
| RTX 3060         | 12GB  | Whisper, Kokoro, YOLO         |
| RTX 3080/3090    | 10-24GB | All except Qwen3-32B        |
| RTX 4080         | 16GB  | All with Qwen3-14B            |
| RTX 4090         | 24GB  | All including Qwen3-32B       |
| A4000/A5000      | 16-24GB | All models                  |
| L4 (Cloud)       | 24GB  | All models (recommended)      |
```

### Step 6: Add Documentation Build to CI

```yaml
# .github/workflows/docs.yml
name: Deploy Documentation
on:
  push:
    branches: [main]
    paths: ["docs/**"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install mkdocs-material mkdocs-awesome-pages-plugin mike
      - run: cd docs && mkdocs build --strict
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/site
```

### Step 7: Add In-Code Documentation Standards

```python
# Docstring standard for all public API endpoints
@router.post("/projects", response_model=ProjectResponse, tags=["projects"])
async def create_project(
    request: CreateProjectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new clipping project.

    Upload a video file or provide a URL to create a new project.
    The video will be processed asynchronously — use the returned
    job_id to track progress.

    **Required scope:** `projects:write`
    """
    ...
```

## Best Practices
- **Docs as code:** Documentation lives in the same repo as code, reviewed in the same PRs.
- **Auto-generate API reference:** Never manually write API docs — generate from OpenAPI spec.
- **Screenshots with alt text:** All screenshots must have descriptive alt text for accessibility.
- **Test code examples:** All code snippets in guides should be tested (copy-paste must work).
- **Version with mike:** Use `mike` to maintain docs for multiple versions (v1.0, v1.1, etc.).
- **Quickstart under 5 minutes:** The getting started guide must get a user to a working state in under 5 minutes with Docker.

## Testing
- Build docs locally: `cd docs && mkdocs serve` → verify no warnings
- Check all internal links resolve
- Verify API reference generates correctly from running API
- Test quickstart guide on a fresh machine
- Verify search returns relevant results

## Verification Checklist
- [ ] MkDocs builds without warnings (`mkdocs build --strict`)
- [ ] All pages render correctly with navigation
- [ ] Search works across all documentation
- [ ] API reference auto-generates from OpenAPI spec
- [ ] Code examples in guides are tested and work
- [ ] Dark/light mode toggle works
- [ ] GitHub Actions deploys docs on push to main
- [ ] All internal links are valid (no 404s)
- [ ] Self-hosting guide covers all deployment scenarios
- [ ] Contributing guide enables new developers to set up locally
