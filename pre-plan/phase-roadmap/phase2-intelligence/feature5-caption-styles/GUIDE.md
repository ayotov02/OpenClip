# Caption Styles — Implementation Guide

## Overview
- **What:** Implement 7+ animated caption presets rendered via Remotion (TypeScript) or FFmpeg ASS subtitles, with word-by-word highlighting synced to WhisperX timestamps.
- **Why:** Caption accuracy and style is THE deciding factor for users choosing between tools. Submagic wins with 99% accuracy. We need 99%+ accuracy with 7+ beautiful styles.
- **Dependencies:** Phase 1 Feature 5 (WhisperX — word timestamps), Phase 1 Feature 4 (Video Processing)

## Architecture

### Caption Rendering Pipeline
```
WhisperX word timestamps → Style selection → Render engine
  ├── FFmpeg ASS subtitles (fast, server-side)
  └── Remotion React components (beautiful, more flexible)
→ Overlay on video → Output
```

### 7 Caption Presets
1. **Karaoke** — Word-by-word color highlight as spoken (most popular)
2. **Pop** — Words pop in with scale animation as spoken
3. **Fade** — Smooth opacity fade per word
4. **Highlight** — Background color sweep behind active word
5. **Minimal** — Clean white on semi-transparent dark bar
6. **Bold** — Hormozi-style: big, centered, key words in color
7. **Custom** — User-defined font, size, color, animation, position

## Step-by-Step Implementation

### Step 1: Create Caption Data Structure
```python
# backend/app/schemas/captions.py
from pydantic import BaseModel

class CaptionWord(BaseModel):
    word: str
    start: float
    end: float
    speaker: str | None = None

class CaptionSegment(BaseModel):
    words: list[CaptionWord]
    text: str
    start: float
    end: float

class CaptionStyle(BaseModel):
    preset: str = "karaoke"  # karaoke, pop, fade, highlight, minimal, bold, custom
    font_family: str = "Inter"
    font_size: int = 48
    font_color: str = "#FFFFFF"
    highlight_color: str = "#FFD700"
    background_color: str = "rgba(0,0,0,0.7)"
    position: str = "bottom-center"  # bottom-center, center, top
    max_words_per_line: int = 3
    animation_speed: float = 1.0
    emoji_enabled: bool = False
```

### Step 2: Create ASS Subtitle Generator (FFmpeg Path)
Create `backend/app/services/caption_renderer.py`:
```python
class ASSCaptionRenderer:
    """Generate ASS subtitles with word-by-word highlighting for FFmpeg."""

    STYLE_TEMPLATES = {
        "karaoke": {
            "font": "Inter Bold",
            "size": 48,
            "primary": "&H00FFFFFF",    # White
            "highlight": "&H0000D7FF",  # Gold (BGR format in ASS)
            "outline": 3,
            "shadow": 2,
        },
        "minimal": {
            "font": "Inter",
            "size": 36,
            "primary": "&H00FFFFFF",
            "highlight": "&H00FFFFFF",
            "outline": 0,
            "shadow": 0,
            "box": True,
        },
        "bold": {
            "font": "Inter Black",
            "size": 64,
            "primary": "&H00FFFFFF",
            "highlight": "&H0000FF00",
            "outline": 4,
            "shadow": 3,
        },
    }

    def generate_ass(self, segments: list[dict], style: str = "karaoke") -> str:
        template = self.STYLE_TEMPLATES.get(style, self.STYLE_TEMPLATES["karaoke"])
        header = self._ass_header(template)
        events = []

        for segment in segments:
            words = segment.get("words", [])
            # Group words into lines (max 3 per line)
            lines = self._group_words(words, max_per_line=3)
            for line in lines:
                start = self._format_time(line[0]["start"])
                end = self._format_time(line[-1]["end"])
                text = self._format_karaoke_line(line, style)
                events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

        return header + "\n".join(events)

    def _format_karaoke_line(self, words, style):
        if style == "karaoke":
            parts = []
            for w in words:
                dur = int((w["end"] - w["start"]) * 100)  # centiseconds
                parts.append(f"{{\\kf{dur}}}{w['word']}")
            return " ".join(parts)
        return " ".join(w["word"] for w in words)

    def _group_words(self, words, max_per_line=3):
        return [words[i:i+max_per_line] for i in range(0, len(words), max_per_line)]

    def _ass_header(self, template):
        return f"""[Script Info]
Title: OpenClip Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,{template['font']},{template['size']},{template['primary']},{template['highlight']},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,{template['outline']},{template['shadow']},2,40,40,80,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""

    def _format_time(self, seconds):
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        cs = int((seconds % 1) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
```

### Step 3: Apply Captions with FFmpeg
```python
def apply_captions(video_path: str, ass_path: str, output_path: str):
    cmd = [
        "ffmpeg", "-i", video_path,
        "-vf", f"ass={ass_path}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "copy",
        "-y", output_path,
    ]
    subprocess.run(cmd, check=True, timeout=3600)
```

### Step 4: Remotion Path (Optional, Higher Quality)
For more complex animations (pop, fade effects), create Remotion components:
```typescript
// templates/captions/KaraokeCaption.tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const KaraokeCaption: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  return (
    <div style={{ position: "absolute", bottom: 80, width: "100%", textAlign: "center" }}>
      {words.map((word, i) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;
        return (
          <span key={i} style={{
            fontSize: 48,
            fontWeight: 800,
            color: isActive ? "#FFD700" : "#FFFFFF",
            textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
            transition: "color 0.1s",
          }}>
            {word.word}{" "}
          </span>
        );
      })}
    </div>
  );
};
```

## Best Practices
- **ASS for speed, Remotion for quality:** ASS subtitles render in FFmpeg (fast, no Node.js needed). Remotion gives pixel-perfect animations.
- **3 words per line max:** Short-form video captions should be large and readable. 3 words per line is the standard.
- **Bottom-center position:** Default for all presets. Leave room for platform UI (TikTok comments bar, etc.).
- **Word-level timing from WhisperX:** Never use segment-level timing — word-by-word sync is the standard in 2026.

## Testing
- Generate ASS file from sample word timestamps
- Apply to test video → verify word-by-word highlight timing
- Test all 7 presets visually
- Test with different video resolutions (1080p, 720p)

## Verification Checklist
- [ ] All 7 caption presets render correctly
- [ ] Word-by-word highlighting syncs to audio within 50ms
- [ ] Captions readable on both light and dark backgrounds
- [ ] Max 3 words per line
- [ ] Position correct (bottom-center by default)
- [ ] Custom style allows font/color/size override
- [ ] ASS file generates valid subtitle format
- [ ] FFmpeg applies captions without re-encoding audio
