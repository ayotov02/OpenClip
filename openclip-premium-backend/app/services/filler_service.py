"""Filler word and silence detection and removal service."""

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

# Common filler words across languages
FILLER_WORDS = {
    "en": {"um", "uh", "uh huh", "like", "you know", "so", "actually", "basically",
           "literally", "right", "i mean", "well", "okay so", "yeah"},
}

# Silence detection thresholds
SILENCE_MIN_DURATION = 0.5  # seconds
SILENCE_THRESHOLD_DB = -40  # dB


def detect_fillers(
    word_segments: list[dict],
    language: str = "en",
    confidence_threshold: float = 0.5,
) -> list[dict]:
    """Identify filler words and long silences in word-level segments.

    Args:
        word_segments: List of {"word": str, "start": float, "end": float, "confidence": float}
        language: Language code for filler word list
        confidence_threshold: Words below this confidence are likely filler

    Returns:
        List of {"type": "filler"|"silence", "start": float, "end": float, "word": str}
    """
    fillers_set = FILLER_WORDS.get(language, FILLER_WORDS["en"])
    detections = []

    for i, seg in enumerate(word_segments):
        word = seg.get("word", seg.get("text", "")).strip().lower()
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        confidence = seg.get("confidence", seg.get("score", 1.0))

        # Check filler words
        if word in fillers_set and confidence < 0.8:
            detections.append({
                "type": "filler",
                "start": start,
                "end": end,
                "word": word,
                "confidence": confidence,
            })

        # Check for silence gaps between words
        if i > 0:
            prev_end = word_segments[i - 1].get("end", 0)
            gap = start - prev_end
            if gap >= SILENCE_MIN_DURATION:
                detections.append({
                    "type": "silence",
                    "start": prev_end,
                    "end": start,
                    "word": "[silence]",
                    "confidence": 0.0,
                })

    return detections


def generate_cut_list(
    detections: list[dict],
    total_duration: float,
) -> list[dict]:
    """Generate a list of segments to KEEP (inverse of filler/silence segments).

    Returns:
        List of {"start": float, "end": float} — segments to keep
    """
    if not detections:
        return [{"start": 0, "end": total_duration}]

    # Sort by start time
    sorted_cuts = sorted(detections, key=lambda x: x["start"])

    keep_segments = []
    current_pos = 0.0

    for cut in sorted_cuts:
        if cut["start"] > current_pos:
            keep_segments.append({"start": current_pos, "end": cut["start"]})
        current_pos = max(current_pos, cut["end"])

    if current_pos < total_duration:
        keep_segments.append({"start": current_pos, "end": total_duration})

    return keep_segments


def remove_fillers_ffmpeg(
    input_path: str,
    output_path: str,
    keep_segments: list[dict],
    crossfade_ms: int = 50,
) -> str:
    """Remove filler/silence segments using FFmpeg with audio crossfade.

    Creates a concat file of kept segments and merges them.
    """
    if not keep_segments:
        return input_path

    tmp_dir = Path(output_path).parent / "filler_removal"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # Cut each kept segment
    segment_files = []
    for i, seg in enumerate(keep_segments):
        seg_path = str(tmp_dir / f"seg_{i:04d}.mp4")
        duration = seg["end"] - seg["start"]
        if duration <= 0:
            continue

        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-ss", str(seg["start"]),
                "-t", str(duration),
                "-c:v", "libx264", "-c:a", "aac",
                "-preset", "fast",
                seg_path,
            ],
            check=True,
            capture_output=True,
        )
        segment_files.append(seg_path)

    if not segment_files:
        return input_path

    # Create concat list
    concat_file = str(tmp_dir / "concat.txt")
    with open(concat_file, "w") as f:
        for seg_path in segment_files:
            f.write(f"file '{seg_path}'\n")

    # Concat segments
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-c:v", "libx264", "-c:a", "aac",
            "-preset", "fast",
            output_path,
        ],
        check=True,
        capture_output=True,
    )

    return output_path
