from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_MODE: str = "local"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    DOMAIN: str = "openclip.local"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Credentials (used by docker-compose for service config)
    POSTGRES_PASSWORD: str = "password"
    REDIS_PASSWORD: str = "openclip"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://openclip:password@localhost:5432/openclip"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO / S3
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "openclip"
    MINIO_SECRET_KEY: str = "openclip-secret"
    MINIO_BUCKET: str = "openclip"
    MINIO_SECURE: bool = False

    # Auth (local — self-managed JWT)
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 60 * 24  # 24 hours

    # AI Services (local endpoints)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:32b"
    WHISPER_SERVICE_URL: str = "http://localhost:8001"
    TTS_SERVICE_URL: str = "http://localhost:8002"
    CV_SERVICE_URL: str = "http://localhost:8003"
    FLUX_SERVICE_URL: str = "http://localhost:8004"
    MUSICGEN_SERVICE_URL: str = "http://localhost:8005"

    # External (free)
    PEXELS_API_KEY: str = ""


settings = Settings()
