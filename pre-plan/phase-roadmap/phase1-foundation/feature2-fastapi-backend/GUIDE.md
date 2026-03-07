# FastAPI Backend — Implementation Guide

## Overview
- **What:** Build the core FastAPI application with authentication, middleware, database connection, Pydantic schemas, and project structure following best practices.
- **Why:** The backend is the central orchestrator — it receives API requests, dispatches jobs, manages data, and coordinates all AI services.
- **Dependencies:** Feature 1 (Project Setup)

## Architecture

### Request Flow
```
Client → FastAPI Router → Dependency Injection (auth, db session)
  → Service Layer (business logic) → Repository/ORM (database)
  → Response Schema (Pydantic) → JSON Response
```

### Key Components
- **Routers:** API endpoint definitions (thin layer, delegates to services)
- **Services:** Business logic (testable without HTTP context)
- **Models:** SQLAlchemy ORM models
- **Schemas:** Pydantic request/response validation
- **Core:** Config, security, shared dependencies
- **Middleware:** CORS, request logging, error handling

### Database Models
```
User → has many → Projects → has many → Clips
User → has many → BrandKits
User → has many → FacelessProjects
Clip → has many → PublishJobs
```

## GCP Deployment
- **Service:** Cloud Run
- **Machine:** 2 vCPU / 4 GB RAM (auto-scaling 1-10 instances)
- **GPU:** None (API is CPU-only)
- **Docker image:** `us-central1-docker.pkg.dev/openclip-prod/openclip-images/api`
- **Environment variables:** Loaded from Secret Manager
- **Cost estimate:** $30-60/month

## Step-by-Step Implementation

### Step 1: Create FastAPI Entry Point
Create `backend/app/main.py`:
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.api.v1.router import api_router
from app.core.config import settings

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", environment=settings.ENVIRONMENT)
    yield
    logger.info("shutdown")


app = FastAPI(
    title="OpenClip API",
    description="Open-source AI video creation platform",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
```

### Step 2: Create Configuration
Create `backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://openclip:password@localhost:5432/openclip"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours
    API_KEY_SALT: str = "change-me"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Storage
    STORAGE_BACKEND: str = "local"  # "local" or "gcs"
    LOCAL_STORAGE_PATH: str = "./data"
    GCS_BUCKET_UPLOADS: str = ""
    GCS_BUCKET_PROCESSED: str = ""

    # AI Services
    OLLAMA_URL: str = "http://localhost:11434"
    WHISPER_URL: str = "http://localhost:8001"
    TTS_URL: str = "http://localhost:8002"

    # Pexels
    PEXELS_API_KEY: str = ""

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
```

### Step 3: Create Database Connection
Create `backend/app/core/database.py`:
```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

### Step 4: Create Base ORM Model
Create `backend/app/models/base.py`:
```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BaseModel(Base, TimestampMixin):
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
```

### Step 5: Create User Model + Auth
Create `backend/app/models/user.py`:
```python
from sqlalchemy import String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    api_key_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(default=True)

    projects = relationship("Project", back_populates="user")
    brand_kits = relationship("BrandKit", back_populates="user")
```

### Step 6: Create Security Utilities
Create `backend/app/core/security.py`:
```python
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def generate_api_key() -> tuple[str, str]:
    """Returns (raw_key, hashed_key)."""
    raw_key = f"oc_{secrets.token_urlsafe(32)}"
    hashed_key = hashlib.sha256(
        (raw_key + settings.API_KEY_SALT).encode()
    ).hexdigest()
    return raw_key, hashed_key
```

### Step 7: Create Auth Dependencies
Create `backend/app/core/deps.py`:
```python
import hashlib

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    api_key: str | None = Security(api_key_header),
) -> User:
    if token:
        try:
            payload = jwt.decode(
                token.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
            )
            user_id = payload.get("sub")
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
    elif api_key:
        hashed = hashlib.sha256(
            (api_key + settings.API_KEY_SALT).encode()
        ).hexdigest()
        result = await db.execute(select(User).where(User.api_key_hash == hashed))
        user = result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return user
```

### Step 8: Create API Router
Create `backend/app/api/v1/router.py`:
```python
from fastapi import APIRouter

from app.api.v1 import auth, projects, jobs

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
```

### Step 9: Set Up Alembic Migrations
```bash
cd backend
alembic init alembic

# Edit alembic/env.py to use async engine and import Base
# Edit alembic.ini to use DATABASE_URL from settings

# Create initial migration
alembic revision --autogenerate -m "initial_models"
alembic upgrade head
```

### Step 10: Create Dockerfile
Create `backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Best Practices
- **Service layer pattern:** Keep routers thin, put business logic in services. This makes testing easy.
- **Async everywhere:** Use `async def` for all endpoints and `AsyncSession` for database.
- **Pydantic v2 schemas:** Separate request and response schemas. Never expose ORM models directly.
- **Structured logging:** Use `structlog` with JSON output for production observability.
- **Health check endpoint:** Cloud Run and load balancers need `/health` to verify readiness.

## Testing
- `pytest backend/tests/ -v` — All tests pass
- `curl http://localhost:8000/health` — Returns `{"status": "ok"}`
- `curl http://localhost:8000/docs` — Swagger UI loads
- Register a user, get JWT, make authenticated request

## Verification Checklist
- [ ] FastAPI app starts without errors
- [ ] `/health` endpoint returns 200
- [ ] `/docs` shows Swagger UI with all endpoints
- [ ] User registration + login works
- [ ] JWT authentication works
- [ ] API key authentication works
- [ ] Database migrations run successfully
- [ ] CORS allows frontend origin
- [ ] Structured logging outputs JSON
- [ ] Docker image builds and runs
