# Remotion Video Assembly — Implementation Guide

## Overview
- **What:** Use Remotion (TypeScript/React) to compose faceless videos from structured scripts. Build a template system where each template is a React component. Assemble B-roll footage, TTS voiceover, animated captions, background music, and transitions into a final rendered video. Integrate with the Python backend via a Celery task that invokes Remotion rendering.
- **Why:** Remotion enables programmatic video creation using React components, making templates composable, testable, and version-controlled. Unlike pure FFmpeg pipelines, Remotion handles complex animations, text overlays, transitions, and timing with frame-level precision.
- **Dependencies:** Phase 1 Feature 1 (Project Setup), Phase 1 Feature 3 (Job Queue), Phase 3 Feature 1 (TTS), Phase 3 Feature 2 (Script Generation)

## Architecture

### Remotion Service Design
```
Python Backend (Celery task)
  → Prepares render payload (JSON):
      - Script scenes with narration text
      - TTS audio file URLs (GCS signed URLs)
      - B-roll video URLs
      - Music audio URL
      - Template ID + style config
      - Caption style settings
  → Calls Remotion render service via HTTP
      → Remotion Node.js service (services/remotion/)
        → Loads template component
        → Fetches assets (audio, video, images)
        → Renders frames → encodes to MP4
        → Uploads final video to GCS
  → Returns video URL to backend
```

### Remotion Project Structure
```
services/remotion/
├── Dockerfile
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── src/
│   ├── index.ts                    # Remotion entry point
│   ├── Root.tsx                    # Root composition
│   ├── server.ts                   # Express API for render triggering
│   ├── render.ts                   # Render logic
│   ├── types.ts                    # Shared TypeScript types
│   ├── compositions/
│   │   ├── FacelessVideo.tsx       # Main faceless video composition
│   │   └── index.ts
│   ├── templates/
│   │   ├── BaseTemplate.tsx        # Shared template logic
│   │   ├── DocumentaryTemplate.tsx
│   │   ├── ListicleTemplate.tsx
│   │   ├── RedditStoryTemplate.tsx
│   │   ├── MotivationalTemplate.tsx
│   │   ├── ScaryStoryTemplate.tsx
│   │   ├── EducationalTemplate.tsx
│   │   └── index.ts               # Template registry
│   ├── components/
│   │   ├── Scene.tsx               # Single scene renderer
│   │   ├── Captions.tsx            # Animated captions overlay
│   │   ├── BackgroundVideo.tsx     # B-roll video player
│   │   ├── KenBurns.tsx            # Ken Burns effect wrapper
│   │   ├── MusicTrack.tsx          # Background music with ducking
│   │   ├── Transitions.tsx         # Scene transition effects
│   │   ├── ProgressBar.tsx         # Video progress indicator
│   │   └── Watermark.tsx           # Optional branding
│   └── utils/
│       ├── audio.ts                # Audio duration helpers
│       ├── timing.ts               # Frame/time calculations
│       └── colors.ts               # Color palettes per template
└── public/
    └── fonts/                      # Bundled caption fonts
```

### Data Flow
```
1. Backend prepares RenderPayload JSON
2. POST to Remotion service /render endpoint
3. Remotion service:
   a. Downloads assets (audio, video) to local temp
   b. Calculates total duration from audio files
   c. Selects template component
   d. Calls renderMedia() with composition + props
   e. FFmpeg encodes frames to MP4 (H.264 + AAC)
   f. Uploads to GCS
   g. Returns video URL
4. Backend updates job status with video URL
```

## GCP Deployment
- **Service:** Cloud Run (CPU-only, no GPU needed for rendering)
- **Machine type:** 8 vCPU, 16GB RAM (Remotion rendering is CPU+memory intensive)
- **Concurrency:** 1 (each render uses all available CPU)
- **Scale:** Min 0, Max 5 instances
- **Timeout:** 900s (15 min — long videos can take 5-10 min to render)
- **Storage:** Temp local SSD for intermediate frames
- **Cost estimate:** ~$50-100/month (renders on demand, scales to 0)

## Step-by-Step Implementation

### Step 1: Initialize Remotion Project
```bash
mkdir -p services/remotion
cd services/remotion

# Initialize package.json
npm init -y

# Install Remotion and dependencies
npm install remotion @remotion/cli @remotion/renderer @remotion/media-utils
npm install express cors zod
npm install @google-cloud/storage
npm install -D typescript @types/node @types/express ts-node
```

### Step 2: Create TypeScript Types
Create `services/remotion/src/types.ts`:
```typescript
export interface ScriptScene {
  scene_number: number;
  narration: string;
  duration_est: number;
  visual_description: string;
  search_keywords: string[];
  mood: string;
  transition: "cut" | "fade" | "dissolve" | "wipe" | "zoom";
}

export interface CaptionWord {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}

export interface CaptionStyle {
  preset: string;           // "karaoke", "bounce", "typewriter", "highlight"
  font_family: string;
  font_size: number;
  color: string;
  stroke_color: string;
  stroke_width: number;
  position: "bottom" | "center" | "top";
  max_words_per_line: number;
}

export interface RenderPayload {
  project_id: string;
  template: string;         // "documentary", "listicle", "reddit_story", etc.
  script: {
    title: string;
    hook: string;
    scenes: ScriptScene[];
    outro: string;
  };
  assets: {
    voiceover_urls: string[];     // One WAV URL per scene (GCS signed)
    broll_urls: string[];         // One video URL per scene
    music_url: string | null;     // Background music WAV URL
    thumbnail_url: string | null;
  };
  config: {
    width: number;                // 1080 for 9:16, 1920 for 16:9
    height: number;               // 1920 for 9:16, 1080 for 16:9
    fps: number;                  // 30
    caption_style: CaptionStyle;
    music_volume: number;         // 0.0-1.0 (relative to voice)
    color_palette: string;        // Template color theme
  };
  output: {
    bucket: string;
    path: string;                 // GCS output path
    format: "mp4";
    codec: "h264";
  };
}

export interface RenderResult {
  status: "success" | "error";
  video_url: string;
  duration: number;
  file_size: number;
  render_time: number;
}

export interface TemplateProps {
  script: RenderPayload["script"];
  assets: RenderPayload["assets"];
  config: RenderPayload["config"];
  sceneDurations: number[];  // Actual durations from audio files (in frames)
}
```

### Step 3: Create Scene Component
Create `services/remotion/src/components/Scene.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { BackgroundVideo } from "./BackgroundVideo";
import { KenBurns } from "./KenBurns";
import { Captions } from "./Captions";
import type { ScriptScene, CaptionStyle, CaptionWord } from "../types";

interface SceneProps {
  scene: ScriptScene;
  voiceoverUrl: string;
  brollUrl: string;
  durationInFrames: number;
  captionStyle: CaptionStyle;
  captionWords?: CaptionWord[];
  transition: string;
}

export const Scene: React.FC<SceneProps> = ({
  scene,
  voiceoverUrl,
  brollUrl,
  durationInFrames,
  captionStyle,
  captionWords,
  transition,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade transition
  const fadeInDuration = transition === "fade" ? fps * 0.5 : 0; // 0.5s fade
  const fadeOutDuration = transition === "fade" ? fps * 0.5 : 0;

  const opacity = interpolate(
    frame,
    [0, fadeInDuration, durationInFrames - fadeOutDuration, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity: transition === "fade" ? opacity : 1 }}>
      {/* Background B-roll with Ken Burns */}
      <KenBurns durationInFrames={durationInFrames}>
        <BackgroundVideo src={brollUrl} durationInFrames={durationInFrames} />
      </KenBurns>

      {/* Darkening overlay for text readability */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Voiceover audio */}
      {voiceoverUrl && <Audio src={voiceoverUrl} volume={1.0} />}

      {/* Animated captions */}
      {captionWords && captionWords.length > 0 && (
        <Captions
          words={captionWords}
          style={captionStyle}
          durationInFrames={durationInFrames}
        />
      )}
    </AbsoluteFill>
  );
};
```

### Step 4: Create Captions Component
Create `services/remotion/src/components/Captions.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import type { CaptionWord, CaptionStyle } from "../types";

interface CaptionsProps {
  words: CaptionWord[];
  style: CaptionStyle;
  durationInFrames: number;
}

export const Captions: React.FC<CaptionsProps> = ({
  words,
  style,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentTime = frame / fps;

  // Group words into lines
  const lines = groupWordsIntoLines(words, style.max_words_per_line);

  // Find current line
  const currentLine = lines.find(
    (line) => currentTime >= line.start && currentTime <= line.end
  );

  if (!currentLine) return null;

  const positionStyle = getPositionStyle(style.position, width, height);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", ...positionStyle }}>
      <div
        style={{
          textAlign: "center",
          padding: "20px 40px",
          maxWidth: width * 0.9,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" }}>
          {currentLine.words.map((word, i) => {
            const isActive = currentTime >= word.start && currentTime <= word.end;
            const wordProgress = interpolate(
              currentTime,
              [word.start, word.end],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <CaptionWord
                key={`${word.word}-${i}`}
                word={word.word}
                isActive={isActive}
                progress={wordProgress}
                style={style}
                preset={style.preset}
                frame={frame}
                fps={fps}
                index={i}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

interface CaptionWordProps {
  word: string;
  isActive: boolean;
  progress: number;
  style: CaptionStyle;
  preset: string;
  frame: number;
  fps: number;
  index: number;
}

const CaptionWord: React.FC<CaptionWordProps> = ({
  word,
  isActive,
  progress,
  style,
  preset,
  frame,
  fps,
  index,
}) => {
  let animatedStyle: React.CSSProperties = {
    fontFamily: style.font_family,
    fontSize: style.font_size,
    color: isActive ? style.color : "rgba(255,255,255,0.6)",
    WebkitTextStroke: `${style.stroke_width}px ${style.stroke_color}`,
    fontWeight: "bold",
    transition: "color 0.1s",
  };

  if (preset === "karaoke" && isActive) {
    animatedStyle.color = "#FFD700";
    animatedStyle.transform = "scale(1.15)";
  }

  if (preset === "bounce" && isActive) {
    const bounceValue = spring({
      frame: frame - index * 2,
      fps,
      config: { damping: 8, stiffness: 200 },
    });
    animatedStyle.transform = `translateY(${interpolate(bounceValue, [0, 1], [-20, 0])}px) scale(${interpolate(bounceValue, [0, 1], [0.8, 1.1])})`;
    animatedStyle.color = "#FFFFFF";
  }

  if (preset === "highlight" && isActive) {
    animatedStyle.backgroundColor = "rgba(255, 215, 0, 0.9)";
    animatedStyle.color = "#000000";
    animatedStyle.padding = "2px 8px";
    animatedStyle.borderRadius = "4px";
    animatedStyle.WebkitTextStroke = "0px transparent";
  }

  return <span style={animatedStyle}>{word}</span>;
};

// Utility functions

interface WordLine {
  words: CaptionWord[];
  start: number;
  end: number;
}

function groupWordsIntoLines(
  words: CaptionWord[],
  maxWordsPerLine: number
): WordLine[] {
  const lines: WordLine[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerLine) {
    const lineWords = words.slice(i, i + maxWordsPerLine);
    lines.push({
      words: lineWords,
      start: lineWords[0].start,
      end: lineWords[lineWords.length - 1].end,
    });
  }
  return lines;
}

function getPositionStyle(
  position: string,
  width: number,
  height: number
): React.CSSProperties {
  switch (position) {
    case "top":
      return { alignItems: "flex-start", paddingTop: height * 0.1 };
    case "center":
      return { alignItems: "center", justifyContent: "center" };
    case "bottom":
    default:
      return { alignItems: "flex-end", paddingBottom: height * 0.12 };
  }
}
```

### Step 5: Create Ken Burns Effect Component
Create `services/remotion/src/components/KenBurns.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

interface KenBurnsProps {
  children: React.ReactNode;
  durationInFrames: number;
  startScale?: number;
  endScale?: number;
  direction?: "in" | "out";
}

export const KenBurns: React.FC<KenBurnsProps> = ({
  children,
  durationInFrames,
  startScale = 1.0,
  endScale = 1.15,
  direction = "in",
}) => {
  const frame = useCurrentFrame();

  const scale = interpolate(
    frame,
    [0, durationInFrames],
    direction === "in" ? [startScale, endScale] : [endScale, startScale],
    { extrapolateRight: "clamp" }
  );

  // Subtle pan: move from center-left to center-right
  const translateX = interpolate(
    frame,
    [0, durationInFrames],
    [-2, 2],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale}) translateX(${translateX}%)`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
```

### Step 6: Create Background Video Component
Create `services/remotion/src/components/BackgroundVideo.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, OffthreadVideo, Img } from "remotion";

interface BackgroundVideoProps {
  src: string;
  durationInFrames: number;
  muted?: boolean;
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  src,
  durationInFrames,
  muted = true,
}) => {
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(src);

  return (
    <AbsoluteFill>
      {isImage ? (
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <OffthreadVideo
          src={src}
          muted={muted}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
```

### Step 7: Create Music Track Component
Create `services/remotion/src/components/MusicTrack.tsx`:
```tsx
import React from "react";
import { Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface MusicTrackProps {
  src: string;
  volume: number;  // Base volume (e.g., 0.15 for -18dB relative)
  fadeInDuration?: number;  // seconds
  fadeOutDuration?: number; // seconds
}

export const MusicTrack: React.FC<MusicTrackProps> = ({
  src,
  volume,
  fadeInDuration = 2,
  fadeOutDuration = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeInFrames = fadeInDuration * fps;
  const fadeOutFrames = fadeOutDuration * fps;

  const currentVolume = interpolate(
    frame,
    [0, fadeInFrames, durationInFrames - fadeOutFrames, durationInFrames],
    [0, volume, volume, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return <Audio src={src} volume={currentVolume} loop />;
};
```

### Step 8: Create Main FacelessVideo Composition
Create `services/remotion/src/compositions/FacelessVideo.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene } from "../components/Scene";
import { MusicTrack } from "../components/MusicTrack";
import type { TemplateProps } from "../types";

export const FacelessVideo: React.FC<TemplateProps> = ({
  script,
  assets,
  config,
  sceneDurations,
}) => {
  // Calculate cumulative frame offsets for each scene
  let cumulativeFrames = 0;
  const sceneOffsets = sceneDurations.map((dur) => {
    const offset = cumulativeFrames;
    cumulativeFrames += dur;
    return offset;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background music (spans entire video) */}
      {assets.music_url && (
        <MusicTrack src={assets.music_url} volume={config.music_volume} />
      )}

      {/* Render each scene as a Sequence */}
      {script.scenes.map((scene, i) => (
        <Sequence
          key={scene.scene_number}
          from={sceneOffsets[i]}
          durationInFrames={sceneDurations[i]}
          name={`Scene ${scene.scene_number}`}
        >
          <Scene
            scene={scene}
            voiceoverUrl={assets.voiceover_urls[i] || ""}
            brollUrl={assets.broll_urls[i] || ""}
            durationInFrames={sceneDurations[i]}
            captionStyle={config.caption_style}
            transition={scene.transition}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

### Step 9: Create Render Logic
Create `services/remotion/src/render.ts`:
```typescript
import path from "path";
import os from "os";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, getCompositions } from "@remotion/renderer";
import { Storage } from "@google-cloud/storage";
import type { RenderPayload, RenderResult } from "./types";

const storage = new Storage();

export async function renderVideo(
  payload: RenderPayload
): Promise<RenderResult> {
  const startTime = Date.now();
  const outputDir = path.join(os.tmpdir(), `render-${payload.project_id}`);
  const outputPath = path.join(outputDir, "output.mp4");

  fs.mkdirSync(outputDir, { recursive: true });

  try {
    // Bundle the Remotion project
    console.log("[render] Bundling Remotion project...");
    const bundleLocation = await bundle({
      entryPoint: path.resolve(__dirname, "./index.ts"),
      webpackOverride: (config) => config,
    });

    // Calculate scene durations from audio files
    const sceneDurations = await calculateSceneDurations(
      payload.assets.voiceover_urls,
      payload.config.fps
    );

    const totalDurationInFrames = sceneDurations.reduce((a, b) => a + b, 0);

    // Prepare input props
    const inputProps = {
      script: payload.script,
      assets: payload.assets,
      config: payload.config,
      sceneDurations,
    };

    // Get compositions to find the right one
    const compositions = await getCompositions(bundleLocation, {
      inputProps,
    });

    const composition = compositions.find(
      (c) => c.id === payload.template || c.id === "FacelessVideo"
    );

    if (!composition) {
      throw new Error(
        `Composition not found: ${payload.template}. Available: ${compositions.map((c) => c.id).join(", ")}`
      );
    }

    // Render the video
    console.log(
      `[render] Rendering ${totalDurationInFrames} frames at ${payload.config.fps}fps...`
    );

    await renderMedia({
      composition: {
        ...composition,
        width: payload.config.width,
        height: payload.config.height,
        fps: payload.config.fps,
        durationInFrames: totalDurationInFrames,
      },
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
      concurrency: Math.min(os.cpus().length, 4),
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 10 === 0) {
          console.log(`[render] Progress: ${Math.round(progress * 100)}%`);
        }
      },
    });

    // Upload to GCS
    console.log("[render] Uploading to GCS...");
    const bucket = storage.bucket(payload.output.bucket);
    await bucket.upload(outputPath, {
      destination: payload.output.path,
      metadata: {
        contentType: "video/mp4",
        metadata: {
          project_id: payload.project_id,
          template: payload.template,
          duration: String(totalDurationInFrames / payload.config.fps),
        },
      },
    });

    const fileStats = fs.statSync(outputPath);
    const renderTime = (Date.now() - startTime) / 1000;

    const videoUrl = `gs://${payload.output.bucket}/${payload.output.path}`;

    console.log(
      `[render] Complete: ${renderTime.toFixed(1)}s, ${(fileStats.size / 1024 / 1024).toFixed(1)}MB`
    );

    return {
      status: "success",
      video_url: videoUrl,
      duration: totalDurationInFrames / payload.config.fps,
      file_size: fileStats.size,
      render_time: renderTime,
    };
  } finally {
    // Cleanup temp files
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

async function calculateSceneDurations(
  voiceoverUrls: string[],
  fps: number
): Promise<number[]> {
  const durations: number[] = [];

  for (const url of voiceoverUrls) {
    if (!url) {
      // Default 5 seconds if no voiceover
      durations.push(5 * fps);
      continue;
    }

    try {
      // Fetch audio to determine duration
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      // WAV header: bytes 40-43 = data size, sample rate at bytes 24-27
      const view = new DataView(buffer);
      const sampleRate = view.getUint32(24, true);
      const dataSize = view.getUint32(40, true);
      const channels = view.getUint16(22, true);
      const bitsPerSample = view.getUint16(34, true);
      const durationSec =
        dataSize / (sampleRate * channels * (bitsPerSample / 8));

      // Add 0.5s padding after each scene
      durations.push(Math.ceil((durationSec + 0.5) * fps));
    } catch (err) {
      console.warn(`[render] Could not parse audio duration for ${url}:`, err);
      durations.push(5 * fps);
    }
  }

  return durations;
}
```

### Step 10: Create Express API Server
Create `services/remotion/src/server.ts`:
```typescript
import express from "express";
import cors from "cors";
import { z } from "zod";
import { renderVideo } from "./render";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8004;

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "remotion-renderer" });
});

// Render endpoint
app.post("/render", async (req, res) => {
  const startTime = Date.now();
  console.log(`[server] Render request for project: ${req.body.project_id}`);

  try {
    const payload = req.body;

    // Basic validation
    if (!payload.project_id || !payload.script?.scenes?.length) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: project_id, script.scenes",
      });
    }

    const result = await renderVideo(payload);

    console.log(
      `[server] Render complete: ${((Date.now() - startTime) / 1000).toFixed(1)}s`
    );
    res.json(result);
  } catch (err: any) {
    console.error("[server] Render failed:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message,
      render_time: (Date.now() - startTime) / 1000,
    });
  }
});

// List available templates
app.get("/templates", (_req, res) => {
  res.json({
    templates: [
      { id: "documentary", name: "Documentary", description: "Clean, authoritative style" },
      { id: "listicle", name: "Top 10 Listicle", description: "Countdown format" },
      { id: "reddit_story", name: "Reddit Story", description: "Reddit post narration" },
      { id: "motivational", name: "Motivational", description: "Inspiring, bold text" },
      { id: "scary_story", name: "Scary Story", description: "Dark, ominous mood" },
      { id: "educational", name: "Educational", description: "Clear, step-by-step" },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`[server] Remotion render service running on port ${PORT}`);
});
```

### Step 11: Create Remotion Entry Point and Root
Create `services/remotion/src/index.ts`:
```typescript
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
```

Create `services/remotion/src/Root.tsx`:
```tsx
import React from "react";
import { Composition } from "remotion";
import { FacelessVideo } from "./compositions/FacelessVideo";
import type { TemplateProps } from "./types";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="FacelessVideo"
        component={FacelessVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          script: {
            title: "Preview",
            hook: "Preview hook",
            scenes: [],
            outro: "Preview outro",
          },
          assets: {
            voiceover_urls: [],
            broll_urls: [],
            music_url: null,
            thumbnail_url: null,
          },
          config: {
            width: 1080,
            height: 1920,
            fps: 30,
            caption_style: {
              preset: "karaoke",
              font_family: "Inter, sans-serif",
              font_size: 64,
              color: "#FFFFFF",
              stroke_color: "#000000",
              stroke_width: 2,
              position: "bottom",
              max_words_per_line: 4,
            },
            music_volume: 0.15,
            color_palette: "default",
          },
          sceneDurations: [],
        } satisfies TemplateProps}
      />
    </>
  );
};
```

### Step 12: Create Dockerfile
Create `services/remotion/Dockerfile`:
```dockerfile
FROM node:20-slim

# Install Chrome dependencies for Remotion
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-symbola \
    fonts-noto-color-emoji \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install deps
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source
COPY tsconfig.json remotion.config.ts ./
COPY src/ src/
COPY public/ public/

# Build TypeScript
RUN npx tsc --noEmit || true

EXPOSE 8004

CMD ["npx", "ts-node", "src/server.ts"]
```

### Step 13: Create Backend Remotion Client
Create `backend/app/services/remotion_client.py`:
```python
import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class RemotionClient:
    """Client for the Remotion render service."""

    def __init__(self):
        self.base_url = settings.REMOTION_SERVICE_URL  # "http://remotion-service:8004"
        self.timeout = 900  # 15 minutes for long renders

    async def render(self, payload: dict) -> dict:
        """
        Trigger a video render.

        Args:
            payload: RenderPayload dict with script, assets, config, output.

        Returns:
            RenderResult dict with video_url, duration, file_size, render_time.
        """
        logger.info(
            "remotion.render.start",
            project_id=payload.get("project_id"),
            template=payload.get("template"),
            scenes=len(payload.get("script", {}).get("scenes", [])),
        )

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/render",
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()

        logger.info(
            "remotion.render.complete",
            project_id=payload.get("project_id"),
            video_url=result.get("video_url"),
            render_time=result.get("render_time"),
        )

        return result

    async def list_templates(self) -> list[dict]:
        """Get available render templates."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/templates")
            resp.raise_for_status()
            return resp.json()["templates"]

    async def health(self) -> dict:
        """Check Remotion service health."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/health")
            return resp.json()
```

### Step 14: Create Faceless Video Assembly Celery Task
Create `backend/app/tasks/faceless.py`:
```python
import asyncio

import structlog

from app.services.remotion_client import RemotionClient
from app.services.storage import StorageService
from app.tasks.base import ProgressTask
from app.worker import celery_app

logger = structlog.get_logger()
storage = StorageService()


@celery_app.task(
    base=ProgressTask,
    bind=True,
    name="app.tasks.ai.assemble_faceless_video",
    time_limit=1200,
    soft_time_limit=1100,
)
def assemble_faceless_video(
    self,
    job_id: str,
    project_id: str,
    script: dict,
    voiceover_urls: list[str],
    broll_urls: list[str],
    music_url: str | None,
    template: str = "documentary",
    width: int = 1080,
    height: int = 1920,
    caption_style: dict | None = None,
):
    """
    Assemble a faceless video using Remotion.

    This is the final step in the faceless pipeline:
    script + TTS audio + B-roll + music → rendered MP4.
    """
    loop = asyncio.new_event_loop()

    try:
        self.update_progress(0.05, "Preparing render payload...")

        # Generate signed URLs for all assets
        signed_voiceover = [
            storage.get_signed_url(url) if url else None
            for url in voiceover_urls
        ]
        signed_broll = [
            storage.get_signed_url(url) if url else None
            for url in broll_urls
        ]
        signed_music = storage.get_signed_url(music_url) if music_url else None

        # Build render payload
        payload = {
            "project_id": project_id,
            "template": template,
            "script": script,
            "assets": {
                "voiceover_urls": signed_voiceover,
                "broll_urls": signed_broll,
                "music_url": signed_music,
                "thumbnail_url": None,
            },
            "config": {
                "width": width,
                "height": height,
                "fps": 30,
                "caption_style": caption_style or {
                    "preset": "karaoke",
                    "font_family": "Inter, sans-serif",
                    "font_size": 64,
                    "color": "#FFFFFF",
                    "stroke_color": "#000000",
                    "stroke_width": 2,
                    "position": "bottom",
                    "max_words_per_line": 4,
                },
                "music_volume": 0.15,
                "color_palette": "default",
            },
            "output": {
                "bucket": "openclip-prod-processed",
                "path": f"{project_id}/final/video.mp4",
                "format": "mp4",
                "codec": "h264",
            },
        }

        self.update_progress(0.1, "Sending to Remotion renderer...")

        client = RemotionClient()
        result = loop.run_until_complete(client.render(payload))

        if result["status"] != "success":
            raise RuntimeError(f"Render failed: {result.get('message', 'unknown')}")

        self.update_progress(1.0, "Video assembly complete")

        return {
            "video_url": result["video_url"],
            "duration": result["duration"],
            "file_size": result["file_size"],
            "render_time": result["render_time"],
        }

    except Exception as exc:
        logger.error("faceless.assemble.failed", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, max_retries=1)
    finally:
        loop.close()
```

### Step 15: Deploy Remotion Service to Cloud Run
```bash
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/openclip-images/remotion-service:latest"

docker build -t ${IMAGE} services/remotion/
docker push ${IMAGE}

gcloud run deploy remotion-service \
  --image ${IMAGE} \
  --region ${REGION} \
  --cpu 8 \
  --memory 16Gi \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 900 \
  --concurrency 1 \
  --no-allow-unauthenticated \
  --service-account openclip-worker@${PROJECT_ID}.iam.gserviceaccount.com \
  --vpc-connector openclip-connector \
  --port 8004
```

## Best Practices

- **One render per container:** Set Cloud Run concurrency to 1. Remotion rendering uses all available CPU and significant memory. Multiple concurrent renders will OOM or produce slow results.
- **Bundle caching:** Remotion bundles the React project on each render. For production, pre-bundle during Docker build and reuse the bundle path to save 10-20 seconds per render.
- **OffthreadVideo over Video:** Use `<OffthreadVideo>` instead of `<Video>` for B-roll. It renders frames in a separate thread and is far more reliable for remote URLs.
- **Audio-driven timing:** Always calculate scene durations from actual TTS audio file durations, not from the script's `duration_est`. TTS output length varies based on text content and speaking speed.
- **Signed URL expiration:** GCS signed URLs expire. Set a generous expiration (4 hours) since renders can be queued. Regenerate if the render is retried after expiration.
- **Memory management:** Remotion loads all assets into memory. For long videos (>5 min), consider rendering in segments and concatenating with FFmpeg.
- **Font bundling:** Include all caption fonts in the Docker image under `public/fonts/`. Do not rely on Google Fonts or CDNs during rendering.

## Testing

### Local Development
```bash
cd services/remotion

# Preview in Remotion Studio (browser)
npx remotion studio

# Test render locally
npx ts-node src/server.ts &

curl -X POST http://localhost:8004/render \
  -H "Content-Type: application/json" \
  -d @test-payload.json

# Check templates
curl http://localhost:8004/templates
```

### Integration Test
```python
import pytest
from app.services.remotion_client import RemotionClient


@pytest.mark.asyncio
async def test_remotion_health():
    client = RemotionClient()
    result = await client.health()
    assert result["status"] == "healthy"


@pytest.mark.asyncio
async def test_list_templates():
    client = RemotionClient()
    templates = await client.list_templates()
    assert len(templates) >= 6
    ids = [t["id"] for t in templates]
    assert "documentary" in ids
```

## Verification Checklist
- [ ] Remotion project builds and starts without errors
- [ ] Remotion Studio preview renders correctly in browser
- [ ] `/render` endpoint accepts a payload and returns an MP4
- [ ] Scenes are assembled in correct order with proper timing
- [ ] TTS voiceover plays in sync with each scene
- [ ] B-roll video displays behind captions
- [ ] Ken Burns effect applies to background footage
- [ ] Captions animate correctly (karaoke, bounce, highlight presets)
- [ ] Background music plays at correct volume with fade in/out
- [ ] Scene transitions (fade, cut, dissolve) work
- [ ] Output video is valid H.264 MP4
- [ ] Video uploaded to GCS after render
- [ ] Backend Celery task triggers render and gets result
- [ ] Render time < 5 min for a 60-second video
- [ ] Cloud Run deployment handles requests at concurrency=1
