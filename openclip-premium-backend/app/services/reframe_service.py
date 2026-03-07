"""AI reframing service: face detection, tracking, and crop decisions."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Reframing modes
REFRAME_MODES = {
    "auto": "Follow active speaker automatically using face tracking",
    "manual": "User-defined crop region applied to all frames",
    "split_screen": "Multiple speakers shown side-by-side",
    "static": "Fixed center crop with no tracking",
}

# Aspect ratio presets
ASPECT_RATIOS = {
    "9:16": {"width": 1080, "height": 1920},  # Shorts, Reels, TikTok
    "16:9": {"width": 1920, "height": 1080},  # YouTube landscape
    "1:1": {"width": 1080, "height": 1080},   # Instagram feed
    "4:5": {"width": 1080, "height": 1350},   # Instagram portrait
}


def calculate_crop_region(
    frame_width: int,
    frame_height: int,
    target_aspect: str,
    face_box: dict[str, float] | None = None,
    mode: str = "auto",
    smoothing_factor: float = 0.15,
    prev_crop: dict[str, int] | None = None,
) -> dict[str, int]:
    """Calculate the crop region for a single frame.

    Args:
        frame_width: Source frame width
        frame_height: Source frame height
        target_aspect: Target aspect ratio (e.g., "9:16")
        face_box: Detected face bounding box {x, y, w, h} in normalized coords
        mode: Reframing mode (auto, manual, split_screen, static)
        smoothing_factor: EMA smoothing to prevent jerky crops (0-1, lower = smoother)
        prev_crop: Previous frame's crop region for smoothing

    Returns:
        {"x": int, "y": int, "w": int, "h": int} — pixel coordinates for crop
    """
    target = ASPECT_RATIOS.get(target_aspect, ASPECT_RATIOS["9:16"])
    target_ratio = target["width"] / target["height"]

    # Calculate crop dimensions that maintain target aspect ratio
    if frame_width / frame_height > target_ratio:
        # Source is wider — crop width
        crop_h = frame_height
        crop_w = int(frame_height * target_ratio)
    else:
        # Source is taller — crop height
        crop_w = frame_width
        crop_h = int(frame_width / target_ratio)

    if mode == "static" or face_box is None:
        # Center crop
        crop_x = (frame_width - crop_w) // 2
        crop_y = (frame_height - crop_h) // 2
    elif mode == "auto" and face_box:
        # Center crop on face with smoothing
        face_center_x = int((face_box["x"] + face_box["w"] / 2) * frame_width)
        face_center_y = int((face_box["y"] + face_box["h"] / 2) * frame_height)

        crop_x = max(0, min(face_center_x - crop_w // 2, frame_width - crop_w))
        crop_y = max(0, min(face_center_y - crop_h // 2, frame_height - crop_h))

        # Apply EMA smoothing against previous frame
        if prev_crop:
            crop_x = int(prev_crop["x"] + smoothing_factor * (crop_x - prev_crop["x"]))
            crop_y = int(prev_crop["y"] + smoothing_factor * (crop_y - prev_crop["y"]))
    else:
        crop_x = (frame_width - crop_w) // 2
        crop_y = (frame_height - crop_h) // 2

    return {"x": crop_x, "y": crop_y, "w": crop_w, "h": crop_h}


def generate_crop_sequence(
    frame_count: int,
    frame_width: int,
    frame_height: int,
    target_aspect: str,
    face_detections: list[dict[str, Any] | None],
    mode: str = "auto",
) -> list[dict[str, int]]:
    """Generate crop coordinates for every frame in a video.

    Args:
        frame_count: Total number of frames
        frame_width/height: Source video dimensions
        target_aspect: Target aspect ratio
        face_detections: List of face bounding boxes per frame (None = no face detected)
        mode: Reframing mode

    Returns:
        List of crop regions, one per frame
    """
    crops = []
    prev_crop = None

    for i in range(frame_count):
        face_box = face_detections[i] if i < len(face_detections) else None
        crop = calculate_crop_region(
            frame_width, frame_height, target_aspect,
            face_box=face_box, mode=mode, prev_crop=prev_crop,
        )
        crops.append(crop)
        prev_crop = crop

    return crops


def build_ffmpeg_crop_filter(crop: dict[str, int]) -> str:
    """Build FFmpeg crop filter string from a crop region."""
    return f"crop={crop['w']}:{crop['h']}:{crop['x']}:{crop['y']}"
