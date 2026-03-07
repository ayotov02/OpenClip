from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_MODE: str = "premium"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

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

    # Auth (Clerk)
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""

    # LLM (OpenRouter)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_DEFAULT_MODEL: str = "anthropic/claude-sonnet-4-5-20250929"
    OPENROUTER_FALLBACK_MODELS: list[str] = ["openai/gpt-5", "google/gemini-3-pro"]

    # Media Generation (Kie.ai)
    KIEAI_API_KEY: str = ""
    KIEAI_WEBHOOK_URL: str = ""
    KIEAI_DEFAULT_IMAGE_MODEL: str = "gpt-image/1-5-text-to-image"
    KIEAI_DEFAULT_VIDEO_MODEL: str = "runway-api/generate-ai-video"
    KIEAI_DEFAULT_TTS_MODEL: str = "elevenlabs/text-to-speech-turbo-2-5"
    KIEAI_DEFAULT_MUSIC_MODEL: str = "suno-api/generate-music"

    # Scraping (Bright Data)
    BRIGHTDATA_API_KEY: str = ""
    BRIGHTDATA_SERP_ZONE: str = "serp_zone"
    BRIGHTDATA_BROWSER_ZONE: str = "browser_zone"
    BRIGHTDATA_UNLOCKER_ZONE: str = "unlocker_zone"

    # External (free)
    PEXELS_API_KEY: str = ""


settings = Settings()
