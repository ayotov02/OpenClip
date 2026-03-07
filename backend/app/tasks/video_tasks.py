import logging
import subprocess
import uuid
from pathlib import Path

from app.tasks.celery_app import celery
from app.tasks.utils import run_async, update_job_status

logger = logging.getLogger(__name__)

WORKDIR = Path("/tmp/openclip")


@celery.task(name="app.tasks.video_tasks.orchestrate_clip_pipeline", bind=True)
def orchestrate_clip_pipeline(self, project_id: str, job_id: str | None = None) -> dict:
    """End-to-end clip generation pipeline.

    Steps:
    1. Load project from DB to get source_file and user context
    2. Extract audio from video (FFmpeg)
    3. Transcribe audio (STT provider)
    4. Score transcript segments (LLM provider with brand context)
    5. Cut clips from scored segments (FFmpeg)
    6. Save clip records to DB + upload to MinIO
    """

    async def _run():
        from sqlalchemy import select

        from app.brand.context import get_active_brand_context
        from app.core.database import async_session
        from app.models.clip import Clip
        from app.models.project import Project
        from app.providers import get_llm_provider, get_stt_provider

        # Step 0: Load project
        async with async_session() as db:
            result = await db.execute(
                select(Project).where(Project.id == uuid.UUID(project_id))
            )
            project = result.scalar_one_or_none()
            if not project:
                raise ValueError(f"Project {project_id} not found")

            source_file = project.source_file
            if not source_file:
                raise ValueError(f"Project {project_id} has no source file")

            brand_ctx = await get_active_brand_context(db, project.user_id)

        if job_id:
            await update_job_status(job_id, "processing", 0.1)

        # Step 1: Extract audio
        out_dir = WORKDIR / project_id
        out_dir.mkdir(parents=True, exist_ok=True)
        audio_path = str(out_dir / "audio.wav")

        subprocess.run(
            [
                "ffmpeg", "-y", "-i", source_file,
                "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                audio_path,
            ],
            check=True,
            capture_output=True,
        )

        if job_id:
            await update_job_status(job_id, "processing", 0.25)

        # Step 2: Transcribe
        stt = get_stt_provider()
        transcript_result = await stt.transcribe(audio_path, language="en")
        transcript_text = transcript_result.get("text", "")
        segments = transcript_result.get("segments", [])

        # Save transcript to project
        async with async_session() as db:
            result = await db.execute(
                select(Project).where(Project.id == uuid.UUID(project_id))
            )
            project = result.scalar_one_or_none()
            if project:
                project.transcript = transcript_text
                project.transcript_segments = segments
                project.status = "transcribed"
                await db.commit()

        if job_id:
            await update_job_status(job_id, "processing", 0.5)

        # Step 3: Score clips with LLM
        llm = get_llm_provider()
        scored_clips = await llm.score_clips(transcript_text, brand_ctx)

        if job_id:
            await update_job_status(job_id, "processing", 0.7)

        # Step 4: Cut clips
        clips_dir = out_dir / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)
        clip_results = []

        for i, scored in enumerate(scored_clips):
            start = scored.get("start_time", scored.get("start", 0))
            end = scored.get("end_time", scored.get("end", 0))
            duration = end - start
            if duration <= 0:
                continue

            clip_path = str(clips_dir / f"clip_{i:03d}.mp4")
            try:
                subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", source_file,
                        "-ss", str(start), "-t", str(duration),
                        "-c:v", "libx264", "-c:a", "aac",
                        "-preset", "fast", clip_path,
                    ],
                    check=True,
                    capture_output=True,
                )
                clip_results.append({
                    "path": clip_path,
                    "start": start,
                    "end": end,
                    "duration": duration,
                    "title": scored.get("title", f"Clip {i + 1}"),
                    "score": scored.get("score", 0),
                    "reason": scored.get("reason", ""),
                })
            except subprocess.CalledProcessError:
                logger.warning("Failed to cut clip %d for project %s", i, project_id)
                continue

        if job_id:
            await update_job_status(job_id, "processing", 0.9)

        # Step 5: Save clip records to DB
        async with async_session() as db:
            for clip_data in clip_results:
                clip = Clip(
                    project_id=uuid.UUID(project_id),
                    title=clip_data["title"],
                    start_time=clip_data["start"],
                    end_time=clip_data["end"],
                    duration=clip_data["duration"],
                    virality_score=clip_data["score"],
                    score_breakdown={"reason": clip_data["reason"]},
                    output_file=clip_data["path"],
                    status="ready",
                )
                db.add(clip)

            # Update project
            result = await db.execute(
                select(Project).where(Project.id == uuid.UUID(project_id))
            )
            project = result.scalar_one_or_none()
            if project:
                project.clip_count = len(clip_results)
                project.status = "completed"

            await db.commit()

        if job_id:
            await update_job_status(
                job_id, "completed", 1.0,
                result={"clip_count": len(clip_results)},
            )

        return {
            "project_id": project_id,
            "status": "completed",
            "clip_count": len(clip_results),
        }

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("orchestrate_clip_pipeline failed for project %s", project_id)
        if job_id:
            run_async(update_job_status(job_id, "failed", error=str(exc)))
        raise self.retry(exc=exc, countdown=60, max_retries=1) from exc


@celery.task(name="app.tasks.video_tasks.extract_audio", bind=True)
def extract_audio(self, project_id: str, source_file: str) -> dict:
    """Extract audio from video using FFmpeg."""
    try:
        out_dir = WORKDIR / project_id
        out_dir.mkdir(parents=True, exist_ok=True)
        audio_path = str(out_dir / "audio.wav")

        subprocess.run(
            [
                "ffmpeg", "-y", "-i", source_file,
                "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                audio_path,
            ],
            check=True,
            capture_output=True,
        )
        return {"project_id": project_id, "audio_path": audio_path}
    except subprocess.CalledProcessError as exc:
        logger.exception("extract_audio failed for project %s", project_id)
        raise self.retry(exc=exc, countdown=10, max_retries=2) from exc


@celery.task(name="app.tasks.video_tasks.transcribe", bind=True)
def transcribe(self, project_id: str, audio_path: str, language: str = "en") -> dict:
    """Transcribe audio using STT provider."""

    async def _run():
        from app.providers import get_stt_provider

        stt = get_stt_provider()
        result = await stt.transcribe(audio_path, language=language)
        return {
            "project_id": project_id,
            "transcript": result.get("text", ""),
            "segments": result.get("segments", []),
        }

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("transcribe failed for project %s", project_id)
        raise self.retry(exc=exc, countdown=30, max_retries=2) from exc


@celery.task(name="app.tasks.video_tasks.detect_speakers")
def detect_speakers(project_id: str, source_file: str) -> dict:
    """Detect faces and speakers using YOLO + MediaPipe.

    Requires CV service (not yet implemented as a provider).
    """
    logger.warning("detect_speakers: CV provider not yet implemented")
    return {"project_id": project_id, "speakers": []}


@celery.task(name="app.tasks.video_tasks.cut_clips", bind=True)
def cut_clips(self, project_id: str, source_file: str, segments: list[dict]) -> dict:
    """Cut clips from source video using FFmpeg."""
    try:
        out_dir = WORKDIR / project_id / "clips"
        out_dir.mkdir(parents=True, exist_ok=True)
        clips = []

        for i, seg in enumerate(segments):
            start = seg.get("start_time", seg.get("start", 0))
            end = seg.get("end_time", seg.get("end", 0))
            duration = end - start
            if duration <= 0:
                continue

            clip_path = str(out_dir / f"clip_{i:03d}.mp4")
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", source_file,
                    "-ss", str(start), "-t", str(duration),
                    "-c:v", "libx264", "-c:a", "aac",
                    "-preset", "fast", clip_path,
                ],
                check=True,
                capture_output=True,
            )
            clips.append({
                "index": i,
                "path": clip_path,
                "start": start,
                "end": end,
                "title": seg.get("title", f"Clip {i + 1}"),
            })

        return {"project_id": project_id, "clips": clips}
    except subprocess.CalledProcessError as exc:
        logger.exception("cut_clips failed for project %s", project_id)
        raise self.retry(exc=exc, countdown=15, max_retries=1) from exc


@celery.task(name="app.tasks.video_tasks.apply_captions")
def apply_captions(clip_id: str, srt_content: str, style: dict) -> dict:
    """Render captions onto video using Remotion.

    Requires Remotion rendering service (Phase 2).
    """
    logger.warning("apply_captions: Remotion renderer not yet integrated")
    return {"clip_id": clip_id, "output_path": ""}


@celery.task(name="app.tasks.video_tasks.apply_branding")
def apply_branding(clip_id: str, brand_kit_id: str) -> dict:
    """Apply brand kit (intro, outro, watermark) to clip.

    Requires Remotion rendering service (Phase 2).
    """
    logger.warning("apply_branding: Remotion renderer not yet integrated")
    return {"clip_id": clip_id, "output_path": ""}


@celery.task(name="app.tasks.video_tasks.export_clip", bind=True)
def export_clip(self, clip_id: str, formats: list[str]) -> dict:
    """Export clip in multiple formats/resolutions."""
    # Formats like ["1080p", "720p", "shorts"]
    logger.info("export_clip: format conversion for clip %s", clip_id)
    return {"clip_id": clip_id, "outputs": {}}


@celery.task(name="app.tasks.video_tasks.generate_thumbnail", bind=True)
def generate_thumbnail(self, clip_id: str, prompt: str) -> dict:
    """Generate thumbnail using image gen provider."""

    async def _run():
        from app.providers import get_image_gen_provider

        image_gen = get_image_gen_provider()
        url = await image_gen.generate_thumbnail(prompt)
        return {"clip_id": clip_id, "thumbnail_path": url}

    try:
        return run_async(_run())
    except Exception as exc:
        logger.exception("generate_thumbnail failed for clip %s", clip_id)
        raise self.retry(exc=exc, countdown=15, max_retries=2) from exc
