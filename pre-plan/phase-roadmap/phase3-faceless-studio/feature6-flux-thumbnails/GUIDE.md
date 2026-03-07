# FLUX.1 Thumbnail Generation — Implementation Guide

## Overview
- **What:** Deploy FLUX.1 [schnell] (Black Forest Labs, Apache 2.0) on GCP Compute Engine for generating YouTube-optimized thumbnails from text prompts. Apply text overlays via PIL/Pillow after generation. Output at 1280x720 (YouTube standard).
- **Why:** Thumbnails are the single largest driver of click-through rate on YouTube. AI-generated thumbnails tailored to the video script eliminate the need for graphic design skills or stock photo subscriptions. FLUX.1 schnell is fast (1-4 steps), high-quality, and fully open-source.
- **Dependencies:** Phase 1 Feature 1 (Project Setup), Phase 1 Feature 3 (Job Queue), GCP Setup (GPU quotas)

## Architecture

### Thumbnail Generation Pipeline
```
Script title + hook + visual theme
  → Prompt Engineering (optimize for YouTube thumbnails)
  → FLUX.1 [schnell] generates base image (1280x720)
  → PIL/Pillow post-processing:
      ├── Text overlay (title text, bold, high contrast)
      ├── Color grading (saturation boost, contrast)
      ├── Border/frame (optional template styling)
      └── Face enhancement (if applicable)
  → Upload to GCS
  → Return thumbnail URL
```

### Model Details
```
Model: black-forest-labs/FLUX.1-schnell
License: Apache 2.0 (commercial use)
Parameters: ~12B
VRAM: ~12GB (float16), ~8GB (quantized)
Speed: 1-4 inference steps (fastest FLUX variant)
Resolution: Native 1024x1024, scales well to 1280x720
Architecture: Rectified Flow Transformer
```

### Why FLUX.1 schnell
```
┌─────────────────┬────────┬───────────┬──────────┬─────────┐
│ Model           │ Steps  │ Speed     │ Quality  │ License │
├─────────────────┼────────┼───────────┼──────────┼─────────┤
│ FLUX.1 schnell  │ 1-4    │ ~1-3s     │ Good     │ Apache  │
│ FLUX.1 dev      │ 20-50  │ ~15-30s   │ Excellent│ Non-com │
│ SDXL            │ 20-40  │ ~10-20s   │ Good     │ OpenRAIL│
│ SD 1.5          │ 20-50  │ ~5-10s    │ Fair     │ OpenRAIL│
└─────────────────┴────────┴───────────┴──────────┴─────────┘
FLUX.1 schnell: best speed/quality ratio + permissive license
```

## GCP Deployment
- **Service:** Compute Engine (persistent VM, not Cloud Run -- FLUX model is large and benefits from always-warm GPU)
- **Machine type:** g2-standard-8 (8 vCPU, 32GB RAM)
- **GPU:** 1x NVIDIA L4 (24GB VRAM)
- **Disk:** 100GB SSD (model weights + temp files)
- **Scale:** Single instance (thumbnail generation is fast, queue handles bursts)
- **Cost estimate:** ~$250-350/month (always-on) or use Spot VM for ~$100/month
- **Alternative:** Can share GPU with MusicGen since both use ~6-12GB VRAM (not simultaneously)

## Step-by-Step Implementation

### Step 1: Create Thumbnail Service Directory Structure
```
services/thumbnail/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── engine.py           # FLUX.1 model wrapper
│   ├── text_overlay.py     # PIL text overlay logic
│   ├── prompt_builder.py   # YouTube thumbnail prompt engineering
│   └── routes.py
└── tests/
    └── test_thumbnail.py
```

### Step 2: Create requirements.txt
Create `services/thumbnail/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
torch>=2.4.0
diffusers>=0.30.0
transformers>=4.44.0
accelerate>=0.34.0
sentencepiece>=0.2.0
Pillow>=10.4.0
numpy>=1.26.0
structlog>=24.4.0
pydantic>=2.9.0
pydantic-settings>=2.6.0
python-multipart>=0.0.12
```

### Step 3: Create Service Configuration
Create `services/thumbnail/app/config.py`:
```python
from pydantic_settings import BaseSettings


class ThumbnailSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8006
    model_name: str = "black-forest-labs/FLUX.1-schnell"
    device: str = "cuda"
    torch_dtype: str = "bfloat16"
    num_inference_steps: int = 4  # schnell works in 1-4 steps
    guidance_scale: float = 0.0  # schnell does not use guidance
    output_width: int = 1280
    output_height: int = 720

    # Text overlay defaults
    default_font: str = "/app/fonts/Inter-Bold.ttf"
    fallback_font: str = "/app/fonts/DejaVuSans-Bold.ttf"

    class Config:
        env_prefix = "THUMBNAIL_"


settings = ThumbnailSettings()
```

### Step 4: Create FLUX.1 Engine
Create `services/thumbnail/app/engine.py`:
```python
import io
import time

import structlog
import torch
from diffusers import FluxPipeline
from PIL import Image

from app.config import settings

logger = structlog.get_logger()


class FluxEngine:
    """FLUX.1 schnell image generation engine."""

    def __init__(self):
        self.pipeline = None
        self._loaded = False

    def load(self):
        """Load FLUX.1 schnell model into GPU memory."""
        if self._loaded:
            return

        logger.info("flux.loading", model=settings.model_name)
        start = time.time()

        self.pipeline = FluxPipeline.from_pretrained(
            settings.model_name,
            torch_dtype=torch.bfloat16,
        ).to(settings.device)

        # Enable memory optimizations
        self.pipeline.enable_model_cpu_offload()

        self._loaded = True
        logger.info("flux.loaded", elapsed=f"{time.time() - start:.1f}s")

    def generate(
        self,
        prompt: str,
        width: int = 1280,
        height: int = 720,
        num_inference_steps: int = 4,
        seed: int | None = None,
    ) -> Image.Image:
        """
        Generate an image from a text prompt.

        Args:
            prompt: Text description of the desired image.
            width: Output width in pixels (must be divisible by 8).
            height: Output height in pixels (must be divisible by 8).
            num_inference_steps: Number of denoising steps (1-4 for schnell).
            seed: Random seed for reproducibility. None for random.

        Returns:
            PIL Image object.
        """
        if not self._loaded:
            self.load()

        # Ensure dimensions are divisible by 8
        width = (width // 8) * 8
        height = (height // 8) * 8

        logger.info(
            "flux.generate",
            prompt=prompt[:100],
            size=f"{width}x{height}",
            steps=num_inference_steps,
        )
        start = time.time()

        generator = None
        if seed is not None:
            generator = torch.Generator(device=settings.device).manual_seed(seed)

        result = self.pipeline(
            prompt=prompt,
            width=width,
            height=height,
            num_inference_steps=num_inference_steps,
            guidance_scale=settings.guidance_scale,
            generator=generator,
        )

        image = result.images[0]

        elapsed = time.time() - start
        logger.info("flux.done", elapsed=f"{elapsed:.1f}s", size=f"{image.width}x{image.height}")

        return image

    def generate_bytes(
        self,
        prompt: str,
        width: int = 1280,
        height: int = 720,
        num_inference_steps: int = 4,
        seed: int | None = None,
        format: str = "PNG",
        quality: int = 95,
    ) -> bytes:
        """Generate image and return as bytes."""
        image = self.generate(prompt, width, height, num_inference_steps, seed)

        buffer = io.BytesIO()
        if format.upper() == "JPEG":
            image = image.convert("RGB")
            image.save(buffer, format="JPEG", quality=quality, optimize=True)
        else:
            image.save(buffer, format="PNG", optimize=True)

        return buffer.getvalue()
```

### Step 5: Create Prompt Builder
Create `services/thumbnail/app/prompt_builder.py`:
```python
"""
YouTube thumbnail prompt engineering for FLUX.1.
Optimized prompts that generate click-worthy thumbnails.
"""


def build_thumbnail_prompt(
    title: str,
    style: str = "documentary",
    mood: str = "dramatic",
    subject: str = "",
    color_scheme: str = "",
) -> str:
    """
    Build an optimized FLUX.1 prompt for YouTube thumbnail generation.

    Args:
        title: Video title or core topic.
        style: Script style (documentary, listicle, scary, etc.).
        mood: Scene mood for color/atmosphere.
        subject: Primary visual subject (optional).
        color_scheme: Desired color palette (optional).

    Returns:
        Optimized FLUX.1 prompt string.
    """
    base_prompt = _get_style_base(style)
    mood_modifiers = _get_mood_modifiers(mood)
    color_hint = f", color palette: {color_scheme}" if color_scheme else ""

    subject_text = subject if subject else _extract_subject(title)

    prompt = (
        f"{base_prompt} "
        f"depicting {subject_text}, "
        f"{mood_modifiers}, "
        f"YouTube thumbnail style, "
        f"extremely high quality, sharp focus, "
        f"vibrant saturated colors, high contrast, "
        f"dramatic lighting, professional photography, "
        f"4K detail, no text, no watermarks, no borders"
        f"{color_hint}"
    )

    return prompt


def _get_style_base(style: str) -> str:
    """Get base prompt fragment for each style."""
    style_bases = {
        "documentary": "Cinematic wide-angle photograph",
        "listicle": "Bold eye-catching digital illustration",
        "story": "Dramatic cinematic still frame",
        "motivational": "Powerful inspiring photograph with golden light",
        "educational": "Clean professional infographic-style illustration",
        "scary": "Dark atmospheric horror-themed photograph",
        "reddit": "Dramatic social media style photograph",
    }
    return style_bases.get(style, "High quality professional photograph")


def _get_mood_modifiers(mood: str) -> str:
    """Get visual modifiers based on mood."""
    mood_modifiers = {
        "dramatic": "dramatic cinematic lighting, deep shadows, epic atmosphere",
        "upbeat": "bright warm lighting, vibrant colors, energetic feel",
        "calm": "soft diffused lighting, pastel tones, serene atmosphere",
        "mysterious": "foggy atmospheric lighting, blue-green tones, enigmatic",
        "funny": "bright playful lighting, bold colors, exaggerated expressions",
        "tense": "harsh directional lighting, red-orange tones, claustrophobic",
        "inspiring": "golden hour lighting, warm uplighting, vast open spaces",
        "dark": "low-key lighting, deep blacks, ominous red accents",
    }
    return mood_modifiers.get(mood, "professional studio lighting")


def _extract_subject(title: str) -> str:
    """Extract the visual subject from a title for the prompt."""
    # Remove common non-visual words
    stop_words = {
        "why", "how", "what", "when", "where", "the", "a", "an", "is", "are",
        "was", "were", "do", "does", "did", "top", "best", "worst", "most",
        "you", "your", "we", "they", "this", "that", "these", "those",
    }
    words = [w for w in title.lower().split() if w not in stop_words and len(w) > 2]
    return " ".join(words[:6]) if words else title


# Pre-built prompt templates for common faceless video types
THUMBNAIL_TEMPLATES = {
    "nature_documentary": (
        "Stunning aerial photograph of {subject}, "
        "national geographic style, ultra wide angle, "
        "dramatic cloud formations, golden hour, 8K detail"
    ),
    "tech_explainer": (
        "Futuristic tech concept art of {subject}, "
        "holographic display, neon blue accents, "
        "dark background, sci-fi atmosphere, ultra detailed"
    ),
    "horror_story": (
        "Dark atmospheric photograph of {subject}, "
        "horror movie still, fog, desaturated with red accents, "
        "wide eyes, terror, cinematic grain, disturbing"
    ),
    "motivational": (
        "Powerful silhouette photograph of {subject}, "
        "golden sunrise background, rays of light, "
        "mountain peak, triumphant pose, inspiring"
    ),
    "listicle": (
        "Bold colorful collage illustration of {subject}, "
        "pop art style, bright primary colors, "
        "bold outlines, eye-catching, magazine cover quality"
    ),
}
```

### Step 6: Create Text Overlay Module
Create `services/thumbnail/app/text_overlay.py`:
```python
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import structlog

from app.config import settings

logger = structlog.get_logger()


class TextOverlay:
    """Apply text overlays and post-processing to thumbnails."""

    def __init__(self):
        self.font_path = settings.default_font
        self.fallback_font_path = settings.fallback_font

    def apply_text(
        self,
        image: Image.Image,
        text: str,
        position: str = "bottom-center",
        font_size: int = 72,
        text_color: str = "#FFFFFF",
        stroke_color: str = "#000000",
        stroke_width: int = 4,
        background_color: str | None = None,
        max_width_ratio: float = 0.85,
    ) -> Image.Image:
        """
        Apply text overlay to a thumbnail image.

        Args:
            image: Base PIL Image.
            text: Text to overlay.
            position: "top-center", "center", "bottom-center", "bottom-left".
            font_size: Font size in pixels.
            text_color: Text color hex.
            stroke_color: Text stroke color hex.
            stroke_width: Stroke width in pixels.
            background_color: Optional background box color (e.g., "#FF0000CC").
            max_width_ratio: Maximum text width as ratio of image width.

        Returns:
            Image with text overlay.
        """
        img = image.copy()
        draw = ImageDraw.Draw(img)
        font = self._load_font(font_size)

        # Word wrap text
        max_width = int(img.width * max_width_ratio)
        lines = self._word_wrap(draw, text, font, max_width)
        wrapped_text = "\n".join(lines)

        # Calculate text bounding box
        bbox = draw.multiline_textbbox((0, 0), wrapped_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Calculate position
        x, y = self._calculate_position(
            img.width, img.height, text_width, text_height, position
        )

        # Draw background box if specified
        if background_color:
            padding = 20
            draw.rectangle(
                [x - padding, y - padding, x + text_width + padding, y + text_height + padding],
                fill=background_color,
            )

        # Draw text with stroke
        draw.multiline_text(
            (x, y),
            wrapped_text,
            font=font,
            fill=text_color,
            stroke_fill=stroke_color,
            stroke_width=stroke_width,
            align="center",
        )

        return img

    def enhance_thumbnail(
        self,
        image: Image.Image,
        saturation: float = 1.3,
        contrast: float = 1.2,
        sharpness: float = 1.1,
    ) -> Image.Image:
        """
        Apply color grading to make thumbnails pop.

        YouTube thumbnails need to be visually striking at small sizes.
        """
        img = image.copy()

        # Boost saturation
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(saturation)

        # Boost contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(contrast)

        # Sharpen
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(sharpness)

        return img

    def add_gradient_overlay(
        self,
        image: Image.Image,
        direction: str = "bottom",
        opacity: float = 0.6,
    ) -> Image.Image:
        """Add a gradient overlay for text readability."""
        img = image.copy()
        gradient = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(gradient)

        width, height = img.size

        if direction == "bottom":
            for y in range(height):
                alpha = int(255 * opacity * (y / height) ** 2)
                draw.line([(0, y), (width, y)], fill=(0, 0, 0, alpha))
        elif direction == "top":
            for y in range(height):
                alpha = int(255 * opacity * ((height - y) / height) ** 2)
                draw.line([(0, y), (width, y)], fill=(0, 0, 0, alpha))

        img = img.convert("RGBA")
        img = Image.alpha_composite(img, gradient)
        return img.convert("RGB")

    def _load_font(self, size: int) -> ImageFont.FreeTypeFont:
        """Load font with fallback."""
        try:
            return ImageFont.truetype(self.font_path, size)
        except (OSError, IOError):
            try:
                return ImageFont.truetype(self.fallback_font_path, size)
            except (OSError, IOError):
                logger.warning("font.fallback_to_default")
                return ImageFont.load_default()

    @staticmethod
    def _word_wrap(
        draw: ImageDraw.ImageDraw,
        text: str,
        font: ImageFont.FreeTypeFont,
        max_width: int,
    ) -> list[str]:
        """Wrap text to fit within max_width."""
        words = text.split()
        lines = []
        current_line = ""

        for word in words:
            test_line = f"{current_line} {word}".strip()
            bbox = draw.textbbox((0, 0), test_line, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word

        if current_line:
            lines.append(current_line)

        return lines

    @staticmethod
    def _calculate_position(
        img_width: int,
        img_height: int,
        text_width: int,
        text_height: int,
        position: str,
    ) -> tuple[int, int]:
        """Calculate text position based on alignment."""
        padding = 40

        if position == "top-center":
            x = (img_width - text_width) // 2
            y = padding
        elif position == "center":
            x = (img_width - text_width) // 2
            y = (img_height - text_height) // 2
        elif position == "bottom-left":
            x = padding
            y = img_height - text_height - padding
        elif position == "bottom-center":
            x = (img_width - text_width) // 2
            y = img_height - text_height - padding
        else:
            x = (img_width - text_width) // 2
            y = img_height - text_height - padding

        return x, y
```

### Step 7: Create API Routes
Create `services/thumbnail/app/routes.py`:
```python
import io

import structlog
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import Response
from PIL import Image

from app.engine import FluxEngine
from app.prompt_builder import build_thumbnail_prompt
from app.text_overlay import TextOverlay

logger = structlog.get_logger()

router = APIRouter()

engine = FluxEngine()
overlay = TextOverlay()


@router.post("/generate")
async def generate_thumbnail(
    title: str = Form(..., max_length=200),
    style: str = Form("documentary"),
    mood: str = Form("dramatic"),
    subject: str = Form(""),
    overlay_text: str = Form(""),
    text_position: str = Form("bottom-center"),
    font_size: int = Form(72, ge=24, le=144),
    seed: int | None = Form(None),
    num_steps: int = Form(4, ge=1, le=4),
    enhance: bool = Form(True),
):
    """
    Generate a YouTube thumbnail.

    - **title**: Video title (used for prompt generation).
    - **style**: Video style for visual theming.
    - **mood**: Mood for color/lighting direction.
    - **subject**: Primary visual subject (optional, auto-extracted from title).
    - **overlay_text**: Text to overlay on the image (optional).
    - **text_position**: "top-center", "center", "bottom-center", "bottom-left".
    - **seed**: Random seed for reproducibility.
    - **enhance**: Apply color grading (saturation, contrast boost).
    """
    try:
        # Build optimized prompt
        prompt = build_thumbnail_prompt(
            title=title,
            style=style,
            mood=mood,
            subject=subject,
        )

        # Generate base image
        image = engine.generate(
            prompt=prompt,
            width=1280,
            height=720,
            num_inference_steps=num_steps,
            seed=seed,
        )

        # Post-processing
        if enhance:
            image = overlay.enhance_thumbnail(image)

        if overlay_text:
            image = overlay.add_gradient_overlay(image, direction="bottom")
            image = overlay.apply_text(
                image=image,
                text=overlay_text.upper(),
                position=text_position,
                font_size=font_size,
                text_color="#FFFFFF",
                stroke_color="#000000",
                stroke_width=4,
            )

        # Return as JPEG
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="JPEG", quality=95, optimize=True)

        return Response(
            content=buffer.getvalue(),
            media_type="image/jpeg",
            headers={"X-Prompt": prompt[:200]},
        )

    except Exception as e:
        logger.error("thumbnail.error", error=str(e))
        raise HTTPException(status_code=500, detail="Thumbnail generation failed")


@router.post("/generate-variants")
async def generate_variants(
    title: str = Form(...),
    style: str = Form("documentary"),
    mood: str = Form("dramatic"),
    count: int = Form(3, ge=1, le=6),
):
    """Generate multiple thumbnail variants for A/B testing."""
    try:
        prompt = build_thumbnail_prompt(title=title, style=style, mood=mood)
        images = []

        for i in range(count):
            image = engine.generate(
                prompt=prompt,
                width=1280,
                height=720,
                num_inference_steps=4,
                seed=42 + i,  # Deterministic but varied seeds
            )
            image = overlay.enhance_thumbnail(image)

            buffer = io.BytesIO()
            image.convert("RGB").save(buffer, format="JPEG", quality=90)
            images.append(buffer.getvalue())

        # Return first image, store variants in a zip or return metadata
        # For simplicity, return first variant
        return Response(
            content=images[0],
            media_type="image/jpeg",
            headers={"X-Variants-Generated": str(count)},
        )

    except Exception as e:
        logger.error("thumbnail.variants.error", error=str(e))
        raise HTTPException(status_code=500, detail="Variant generation failed")


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": engine._loaded,
        "model": "FLUX.1-schnell",
    }
```

### Step 8: Create FastAPI Application
Create `services/thumbnail/app/main.py`:
```python
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import settings
from app.routes import router, engine

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("thumbnail.startup", device=settings.device)
    engine.load()
    yield
    logger.info("thumbnail.shutdown")


app = FastAPI(
    title="OpenClip Thumbnail Service",
    description="AI thumbnail generation using FLUX.1 schnell",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router, prefix="/thumbnail", tags=["thumbnail"])
```

### Step 9: Create Dockerfile
Create `services/thumbnail/Dockerfile`:
```dockerfile
FROM pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    fonts-dejavu-core \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download fonts
RUN mkdir -p /app/fonts && \
    wget -q -O /app/fonts/Inter-Bold.ttf "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.otf" || \
    cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf /app/fonts/Inter-Bold.ttf && \
    cp /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf /app/fonts/DejaVuSans-Bold.ttf

COPY app/ app/

ENV PYTHONUNBUFFERED=1
ENV THUMBNAIL_DEVICE=cuda
ENV HF_HOME=/root/.cache/huggingface

EXPOSE 8006

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8006", "--workers", "1"]
```

### Step 10: Deploy to GCP Compute Engine
```bash
PROJECT_ID=$(gcloud config get-value project)
ZONE="us-central1-a"

# Create GPU VM
gcloud compute instances create thumbnail-service \
  --project=${PROJECT_ID} \
  --zone=${ZONE} \
  --machine-type=g2-standard-8 \
  --accelerator=count=1,type=nvidia-l4 \
  --maintenance-policy=TERMINATE \
  --image-family=common-gpu \
  --image-project=deeplearning-platform-release \
  --boot-disk-size=100GB \
  --boot-disk-type=pd-ssd \
  --network=openclip-vpc \
  --subnet=openclip-gpu \
  --service-account=openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com \
  --tags=allow-ssh \
  --metadata=startup-script='#!/bin/bash
    # Install Docker and NVIDIA Container Toolkit
    sudo apt-get update
    sudo apt-get install -y docker.io nvidia-container-toolkit
    sudo systemctl restart docker

    # Pull and run thumbnail service
    gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
    docker pull us-central1-docker.pkg.dev/'${PROJECT_ID}'/openclip-images/thumbnail-service:latest
    docker run -d --gpus all -p 8006:8006 --restart=always \
      --name thumbnail-service \
      us-central1-docker.pkg.dev/'${PROJECT_ID}'/openclip-images/thumbnail-service:latest
  '
```

### Step 11: Create Backend Thumbnail Client
Create `backend/app/ai/thumbnail_client.py`:
```python
import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class ThumbnailClient:
    """Client for the FLUX.1 thumbnail generation service."""

    def __init__(self):
        self.base_url = settings.THUMBNAIL_SERVICE_URL  # "http://thumbnail-service:8006"
        self.timeout = 120

    async def generate(
        self,
        title: str,
        style: str = "documentary",
        mood: str = "dramatic",
        subject: str = "",
        overlay_text: str = "",
        seed: int | None = None,
    ) -> bytes:
        """
        Generate a YouTube thumbnail.

        Returns:
            JPEG image bytes (1280x720).
        """
        logger.info("thumbnail.request", title=title[:80], style=style)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/thumbnail/generate",
                data={
                    "title": title,
                    "style": style,
                    "mood": mood,
                    "subject": subject,
                    "overlay_text": overlay_text,
                    "seed": seed or "",
                    "enhance": "true",
                },
            )
            resp.raise_for_status()
            return resp.content

    async def generate_variants(
        self,
        title: str,
        style: str = "documentary",
        mood: str = "dramatic",
        count: int = 3,
    ) -> bytes:
        """Generate multiple thumbnail variants."""
        async with httpx.AsyncClient(timeout=self.timeout * count) as client:
            resp = await client.post(
                f"{self.base_url}/thumbnail/generate-variants",
                data={
                    "title": title,
                    "style": style,
                    "mood": mood,
                    "count": count,
                },
            )
            resp.raise_for_status()
            return resp.content

    async def health(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/thumbnail/health")
            return resp.json()
```

### Step 12: Create Thumbnail Celery Task
Create `backend/app/tasks/thumbnail.py`:
```python
import asyncio
import tempfile
from pathlib import Path

import structlog

from app.ai.thumbnail_client import ThumbnailClient
from app.services.storage import StorageService
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()
storage = StorageService()


@celery_app.task(base=ProgressTask, bind=True, name="app.tasks.ai.generate_thumbnail")
def generate_thumbnail_task(
    self,
    job_id: str,
    project_id: str,
    title: str,
    style: str = "documentary",
    mood: str = "dramatic",
    overlay_text: str = "",
):
    """Generate a thumbnail for a faceless video."""
    loop = asyncio.new_event_loop()

    try:
        self.update_progress(0.1, "Generating thumbnail...")

        client = ThumbnailClient()
        jpeg_bytes = loop.run_until_complete(
            client.generate(
                title=title,
                style=style,
                mood=mood,
                overlay_text=overlay_text,
            )
        )

        self.update_progress(0.8, "Uploading thumbnail...")

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(jpeg_bytes)
            tmp_path = tmp.name

        remote_path = f"{project_id}/thumbnail.jpg"
        gcs_url = storage.upload(tmp_path, remote_path, bucket="processed")
        Path(tmp_path).unlink(missing_ok=True)

        self.update_progress(1.0, "Thumbnail generation complete")

        return {"thumbnail_url": gcs_url}

    except Exception as exc:
        logger.error("thumbnail.task.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, max_retries=2)
    finally:
        loop.close()
```

## Best Practices

- **Prompt engineering for thumbnails:** Always include "YouTube thumbnail style, high contrast, vibrant colors, no text, no watermarks" in the prompt. FLUX tends to add text to images unless explicitly told not to.
- **Text overlay via PIL, not FLUX:** Never ask FLUX to generate text in the image. AI-generated text is unreliable. Always overlay text programmatically with PIL for perfect rendering.
- **Color grading is essential:** Boost saturation by 1.3x and contrast by 1.2x. YouTube thumbnails appear at small sizes in search results -- they need to pop visually.
- **1280x720 is YouTube standard:** YouTube recommends 1280x720 (16:9) for thumbnails. Generate at this exact resolution to avoid scaling artifacts.
- **Gradient overlay for text readability:** Add a bottom-to-top dark gradient before placing text. This ensures white text is readable regardless of the background image.
- **A/B test variants:** Generate 3-6 variants with different seeds and let the user pick. Small seed changes produce meaningfully different compositions.
- **Font bundling:** Include fonts in the Docker image. Do not download fonts at runtime -- network latency and availability issues will cause failures.

## Testing

### Local Testing
```bash
cd services/thumbnail
docker build -t thumbnail-service .
docker run --gpus all -p 8006:8006 thumbnail-service

# Generate thumbnail
curl -X POST http://localhost:8006/thumbnail/generate \
  -F "title=Why Deep Sea Creatures Look So Terrifying" \
  -F "style=documentary" \
  -F "mood=mysterious" \
  -F "overlay_text=DEEP SEA HORROR" \
  --output test_thumbnail.jpg

# Generate without text overlay
curl -X POST http://localhost:8006/thumbnail/generate \
  -F "title=Top 10 Most Dangerous Animals" \
  -F "style=listicle" \
  -F "mood=dramatic" \
  --output test_notxt.jpg

# Health check
curl http://localhost:8006/thumbnail/health
```

## Verification Checklist
- [ ] FLUX.1 schnell model loads into GPU memory
- [ ] `/generate` endpoint returns valid JPEG image
- [ ] Output image is exactly 1280x720 pixels
- [ ] Generated images match the described subject/mood (subjective)
- [ ] Text overlay renders cleanly with stroke/outline
- [ ] Word wrapping works for long text
- [ ] Color enhancement (saturation, contrast) is applied
- [ ] Gradient overlay improves text readability
- [ ] Seed parameter produces reproducible images
- [ ] Variant generation produces visually different images
- [ ] Backend ThumbnailClient connects and retrieves images
- [ ] Celery task generates and uploads to GCS
- [ ] Generation time < 10 seconds per thumbnail
- [ ] No AI-generated text artifacts in the base image
