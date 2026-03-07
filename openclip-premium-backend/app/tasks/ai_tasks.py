from app.tasks.celery_app import celery


@celery.task(name="app.tasks.ai_tasks.score_clips")
def score_clips(project_id: str, transcript: str, brand_context_id: str) -> dict:
    """Score transcript segments using LLM provider with brand context."""
    # TODO: call LLM provider with brand context injection
    return {"project_id": project_id, "scores": []}


@celery.task(name="app.tasks.ai_tasks.generate_script")
def generate_script(
    project_id: str, topic: str, template: str, brand_context_id: str
) -> dict:
    """Generate faceless video script using LLM provider."""
    # TODO: call LLM provider
    return {"project_id": project_id, "script": {}}


@celery.task(name="app.tasks.ai_tasks.generate_broll_queries")
def generate_broll_queries(narration: str, brand_context_id: str) -> dict:
    """Generate B-roll search queries using LLM provider."""
    # TODO: call LLM provider
    return {"queries": []}


@celery.task(name="app.tasks.ai_tasks.generate_publish_copy")
def generate_publish_copy(
    clip_title: str, transcript: str, platform: str, brand_context_id: str
) -> dict:
    """Generate publishing copy (title, description, hashtags) using LLM provider."""
    # TODO: call LLM provider
    return {"title": "", "description": "", "hashtags": []}


@celery.task(name="app.tasks.ai_tasks.generate_tts")
def generate_tts(text: str, voice: str, speed: float = 1.0) -> dict:
    """Generate TTS audio using TTS provider."""
    # TODO: call TTS provider
    return {"audio_path": ""}


@celery.task(name="app.tasks.ai_tasks.upscale_media")
def upscale_media(
    file_path: str, media_type: str = "image", scale: int = 2
) -> dict:
    """Upscale image or video using upscaling provider."""
    # TODO: call Upscaling provider
    return {"output_path": ""}
