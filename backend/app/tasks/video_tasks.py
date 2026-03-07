from app.tasks.celery_app import celery


@celery.task(name="app.tasks.video_tasks.extract_audio")
def extract_audio(project_id: str, source_file: str) -> dict:
    """Extract audio from video using FFmpeg."""
    # TODO: implement FFmpeg audio extraction
    return {"project_id": project_id, "audio_path": ""}


@celery.task(name="app.tasks.video_tasks.transcribe")
def transcribe(project_id: str, audio_path: str, language: str = "en") -> dict:
    """Transcribe audio using STT provider."""
    # TODO: call STT provider
    return {"project_id": project_id, "transcript": "", "segments": []}


@celery.task(name="app.tasks.video_tasks.detect_speakers")
def detect_speakers(project_id: str, source_file: str) -> dict:
    """Detect faces and speakers using YOLO + MediaPipe."""
    # TODO: call CV provider
    return {"project_id": project_id, "speakers": []}


@celery.task(name="app.tasks.video_tasks.cut_clips")
def cut_clips(project_id: str, source_file: str, segments: list[dict]) -> dict:
    """Cut clips from source video using FFmpeg."""
    # TODO: implement FFmpeg clip cutting
    return {"project_id": project_id, "clips": []}


@celery.task(name="app.tasks.video_tasks.apply_captions")
def apply_captions(clip_id: str, srt_content: str, style: dict) -> dict:
    """Render captions onto video using Remotion."""
    # TODO: call Remotion renderer
    return {"clip_id": clip_id, "output_path": ""}


@celery.task(name="app.tasks.video_tasks.apply_branding")
def apply_branding(clip_id: str, brand_kit_id: str) -> dict:
    """Apply brand kit (intro, outro, watermark) to clip."""
    # TODO: implement branding pipeline
    return {"clip_id": clip_id, "output_path": ""}


@celery.task(name="app.tasks.video_tasks.export_clip")
def export_clip(clip_id: str, formats: list[str]) -> dict:
    """Export clip in multiple formats/resolutions."""
    # TODO: implement FFmpeg multi-format export
    return {"clip_id": clip_id, "outputs": {}}


@celery.task(name="app.tasks.video_tasks.generate_thumbnail")
def generate_thumbnail(clip_id: str, prompt: str) -> dict:
    """Generate thumbnail using image gen provider."""
    # TODO: call ImageGen provider
    return {"clip_id": clip_id, "thumbnail_path": ""}
