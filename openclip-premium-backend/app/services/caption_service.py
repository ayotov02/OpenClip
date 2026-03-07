"""Caption generation, styling, and export service."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clip import Clip

# 7 built-in caption style presets
CAPTION_STYLES: dict[str, dict[str, Any]] = {
    "karaoke": {
        "name": "Karaoke",
        "font_family": "Montserrat",
        "font_size": 48,
        "font_weight": "bold",
        "primary_color": "#FFFFFF",
        "highlight_color": "#FFD700",
        "outline_color": "#000000",
        "outline_width": 3,
        "position": "bottom",
        "animation": "word_highlight",
        "background": None,
    },
    "pop": {
        "name": "Pop",
        "font_family": "Impact",
        "font_size": 56,
        "font_weight": "bold",
        "primary_color": "#FFFFFF",
        "highlight_color": "#FF4444",
        "outline_color": "#000000",
        "outline_width": 4,
        "position": "center",
        "animation": "scale_bounce",
        "background": None,
    },
    "fade": {
        "name": "Fade",
        "font_family": "Inter",
        "font_size": 40,
        "font_weight": "medium",
        "primary_color": "#FFFFFF",
        "highlight_color": None,
        "outline_color": "#00000080",
        "outline_width": 2,
        "position": "bottom",
        "animation": "fade_in_out",
        "background": None,
    },
    "highlight": {
        "name": "Highlight",
        "font_family": "Roboto",
        "font_size": 44,
        "font_weight": "bold",
        "primary_color": "#000000",
        "highlight_color": "#00FF88",
        "outline_color": None,
        "outline_width": 0,
        "position": "bottom",
        "animation": "background_highlight",
        "background": "#FFFFFF",
    },
    "minimal": {
        "name": "Minimal",
        "font_family": "Inter",
        "font_size": 36,
        "font_weight": "normal",
        "primary_color": "#FFFFFF",
        "highlight_color": None,
        "outline_color": "#00000060",
        "outline_width": 1,
        "position": "bottom",
        "animation": "none",
        "background": None,
    },
    "bold": {
        "name": "Bold",
        "font_family": "Anton",
        "font_size": 64,
        "font_weight": "bold",
        "primary_color": "#FFFFFF",
        "highlight_color": "#FF6B35",
        "outline_color": "#000000",
        "outline_width": 5,
        "position": "center",
        "animation": "word_pop",
        "background": None,
    },
    "subtitle": {
        "name": "Subtitle",
        "font_family": "Noto Sans",
        "font_size": 32,
        "font_weight": "normal",
        "primary_color": "#FFFFFF",
        "highlight_color": None,
        "outline_color": None,
        "outline_width": 0,
        "position": "bottom",
        "animation": "none",
        "background": "#000000CC",
    },
}


def get_style_presets() -> dict[str, dict[str, Any]]:
    """Return all available caption style presets."""
    return CAPTION_STYLES


def get_style(style_name: str) -> dict[str, Any]:
    """Get a single caption style by name, defaulting to 'karaoke'."""
    return CAPTION_STYLES.get(style_name, CAPTION_STYLES["karaoke"])


def segments_to_srt(segments: list[dict]) -> str:
    """Convert word-level segments to SRT format."""
    lines = []
    for i, seg in enumerate(segments, 1):
        start = _format_srt_time(seg.get("start", 0))
        end = _format_srt_time(seg.get("end", 0))
        text = seg.get("text", seg.get("word", ""))
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def segments_to_vtt(segments: list[dict]) -> str:
    """Convert word-level segments to WebVTT format."""
    lines = ["WEBVTT\n"]
    for i, seg in enumerate(segments, 1):
        start = _format_vtt_time(seg.get("start", 0))
        end = _format_vtt_time(seg.get("end", 0))
        text = seg.get("text", seg.get("word", ""))
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def group_words_into_phrases(
    word_segments: list[dict], max_words: int = 6, max_duration: float = 3.0
) -> list[dict]:
    """Group word-level segments into phrase-level caption segments.

    Groups consecutive words into phrases based on word count and duration limits.
    """
    if not word_segments:
        return []

    phrases = []
    current_words = []
    current_start = None

    for word in word_segments:
        if current_start is None:
            current_start = word.get("start", 0)

        current_words.append(word.get("word", word.get("text", "")))
        current_end = word.get("end", 0)
        current_duration = current_end - current_start

        if len(current_words) >= max_words or current_duration >= max_duration:
            phrases.append({
                "start": current_start,
                "end": current_end,
                "text": " ".join(current_words),
                "words": list(current_words),
            })
            current_words = []
            current_start = None

    if current_words:
        phrases.append({
            "start": current_start,
            "end": word_segments[-1].get("end", 0),
            "text": " ".join(current_words),
            "words": list(current_words),
        })

    return phrases


async def save_captions(
    db: AsyncSession,
    clip_id: uuid.UUID,
    segments: list[dict],
    style: str = "karaoke",
) -> Clip | None:
    """Save caption segments and SRT to a clip record."""
    result = await db.execute(select(Clip).where(Clip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        return None

    srt_content = segments_to_srt(segments)
    clip.caption_srt = srt_content
    clip.metadata_ = {
        **clip.metadata_,
        "caption_segments": segments,
        "caption_style": style,
    }
    await db.commit()
    await db.refresh(clip)
    return clip


async def update_caption_segment(
    db: AsyncSession,
    clip_id: uuid.UUID,
    segment_index: int,
    new_text: str,
) -> Clip | None:
    """Update a single caption segment text (inline editing)."""
    result = await db.execute(select(Clip).where(Clip.id == clip_id))
    clip = result.scalar_one_or_none()
    if not clip:
        return None

    segments = clip.metadata_.get("caption_segments", [])
    if 0 <= segment_index < len(segments):
        segments[segment_index]["text"] = new_text
        clip.metadata_ = {**clip.metadata_, "caption_segments": segments}
        clip.caption_srt = segments_to_srt(segments)
        await db.commit()
        await db.refresh(clip)

    return clip


def _format_srt_time(seconds: float) -> str:
    """Format seconds as SRT timestamp (HH:MM:SS,mmm)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _format_vtt_time(seconds: float) -> str:
    """Format seconds as WebVTT timestamp (HH:MM:SS.mmm)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"
