import logging

from app.tasks.celery_app import celery
from app.tasks.utils import load_brand_context, run_async

logger = logging.getLogger(__name__)


@celery.task(name="app.tasks.ai_tasks.score_clips", bind=True)
def score_clips(self, project_id: str, transcript: str, brand_context_id: str) -> dict:
    """Score transcript segments using LLM provider with brand context."""

    async def _run():
        from app.providers import get_llm_provider

        brand_ctx = await load_brand_context(brand_context_id)
        llm = get_llm_provider()
        scores = await llm.score_clips(transcript, brand_ctx)
        return {"project_id": project_id, "scores": scores}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("score_clips failed for project %s", project_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.ai_tasks.generate_script", bind=True)
def generate_script(
    self, project_id: str, topic: str, template: str, brand_context_id: str
) -> dict:
    """Generate faceless video script using LLM provider."""

    async def _run():
        from app.providers import get_llm_provider

        brand_ctx = await load_brand_context(brand_context_id)
        llm = get_llm_provider()
        script = await llm.generate_script(topic, template, brand_ctx)
        return {"project_id": project_id, "script": script}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("generate_script failed for project %s", project_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.ai_tasks.generate_broll_queries", bind=True)
def generate_broll_queries(self, narration: str, brand_context_id: str) -> dict:
    """Generate B-roll search queries using LLM provider."""

    async def _run():
        from app.providers import get_llm_provider

        brand_ctx = await load_brand_context(brand_context_id)
        llm = get_llm_provider()
        queries = await llm.generate_broll_queries(narration, brand_ctx)
        return {"queries": queries}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("generate_broll_queries failed")
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.ai_tasks.generate_publish_copy", bind=True)
def generate_publish_copy(
    self, clip_title: str, transcript: str, platform: str, brand_context_id: str
) -> dict:
    """Generate publishing copy (title, description, hashtags) using LLM provider."""

    async def _run():
        from app.providers import get_llm_provider

        brand_ctx = await load_brand_context(brand_context_id)
        llm = get_llm_provider()
        return await llm.generate_publish_copy(clip_title, transcript, platform, brand_ctx)

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("generate_publish_copy failed")
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.ai_tasks.generate_tts", bind=True)
def generate_tts(self, text: str, voice: str, speed: float = 1.0) -> dict:
    """Generate TTS audio using TTS provider."""

    async def _run():
        from app.providers import get_tts_provider

        tts = get_tts_provider()
        audio_bytes = await tts.synthesize(text, voice, speed)

        from app.core.storage import storage_client
        from app.core.config import settings
        import uuid

        object_name = f"tts/{uuid.uuid4()}.wav"
        from io import BytesIO

        storage_client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            BytesIO(audio_bytes),
            length=len(audio_bytes),
            content_type="audio/wav",
        )
        return {"audio_path": object_name}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("generate_tts failed")
        raise self.retry(exc=exc, countdown=15, max_retries=2) from exc


@celery.task(name="app.tasks.ai_tasks.upscale_media", bind=True)
def upscale_media(
    self, file_path: str, media_type: str = "image", scale: int = 2
) -> dict:
    """Upscale image or video using upscaling provider."""

    async def _run():
        from app.providers import get_upscaling_provider

        upscaler = get_upscaling_provider()
        if media_type == "video":
            output = await upscaler.upscale_video(file_path)
        else:
            output = await upscaler.upscale_image(file_path, scale)
        return {"output_path": output}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("upscale_media failed for %s", file_path)
        raise self.retry(exc=exc, countdown=30, max_retries=1) from exc
