# Faceless Video Templates — Implementation Guide

## Overview
- **What:** Build 6 Remotion templates for faceless video creation: Reddit Story, Documentary, Top 10 Listicle, Motivational, Scary Story, and Educational. Each template is a React component that accepts standardized props (script, assets, config) and renders a distinct visual style. Create a template registry API for selection and customization.
- **Why:** Templates transform raw scripts into polished videos with consistent visual identity. Each niche on YouTube/TikTok has visual conventions that viewers expect (e.g., dark theme for scary stories, bold numbers for listicles). Templates encode these conventions as reusable React components.
- **Dependencies:** Phase 3 Feature 3 (Remotion Assembly — base composition system), Phase 3 Feature 2 (Script Generation)

## Architecture

### Template System Design
```
Template Registry (server-side)
  → Template ID selected by user or auto-matched to script style
  → Remotion loads the template React component
  → Component receives standardized TemplateProps:
      ├── script (title, scenes, hook, outro)
      ├── assets (voiceover URLs, B-roll URLs, music URL)
      ├── config (dimensions, fps, caption style, colors)
      └── sceneDurations (frames per scene from audio)
  → Template applies its unique visual treatment:
      ├── Color palette
      ├── Typography
      ├── Scene transitions
      ├── Caption animation style
      ├── Overlay elements (progress bar, scene counter, etc.)
      └── Intro/outro animations
```

### Template Overview
```
┌──────────────────┬──────────────┬─────────────────┬──────────────────┐
│ Template         │ Primary Mood │ Color Palette   │ Key Visual       │
├──────────────────┼──────────────┼─────────────────┼──────────────────┤
│ Reddit Story     │ Dramatic     │ Dark + Orange   │ Reddit UI mockup │
│ Documentary      │ Authoritative│ Dark Blue + Gold│ Cinematic bars   │
│ Top 10 Listicle  │ Energetic    │ Vibrant multi   │ Bold numbers     │
│ Motivational     │ Inspiring    │ Gold + Warm     │ Quote cards      │
│ Scary Story      │ Dark         │ Black + Red     │ Glitch effects   │
│ Educational      │ Clear        │ White + Blue    │ Diagram overlays │
└──────────────────┴──────────────┴─────────────────┴──────────────────┘
```

## GCP Deployment
- No additional GCP service. Templates are React components bundled into the existing Remotion service (Phase 3 Feature 3).
- Template metadata served via the Remotion Express API (`GET /templates`).

## Step-by-Step Implementation

### Step 1: Create Shared Template Utilities
Create `services/remotion/src/utils/colors.ts`:
```typescript
export interface ColorPalette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  overlay: string;
  gradient: string[];
}

export const PALETTES: Record<string, ColorPalette> = {
  reddit_story: {
    background: "#1a1a1b",
    primary: "#ff4500",
    secondary: "#d93a00",
    accent: "#ff8b60",
    text: "#d7dadc",
    textSecondary: "#818384",
    overlay: "rgba(0, 0, 0, 0.75)",
    gradient: ["#1a1a1b", "#0e0e0f"],
  },
  documentary: {
    background: "#0a0f1e",
    primary: "#c9a14a",
    secondary: "#1e3a5f",
    accent: "#ffffff",
    text: "#ffffff",
    textSecondary: "#b0b8c4",
    overlay: "rgba(10, 15, 30, 0.65)",
    gradient: ["#0a0f1e", "#1a2540"],
  },
  listicle: {
    background: "#0f0f0f",
    primary: "#ff2d55",
    secondary: "#5856d6",
    accent: "#ffcc00",
    text: "#ffffff",
    textSecondary: "#aaaaaa",
    overlay: "rgba(0, 0, 0, 0.5)",
    gradient: ["#ff2d55", "#5856d6"],
  },
  motivational: {
    background: "#1a1206",
    primary: "#d4a543",
    secondary: "#f5deb3",
    accent: "#ffffff",
    text: "#ffffff",
    textSecondary: "#d4a543",
    overlay: "rgba(26, 18, 6, 0.7)",
    gradient: ["#1a1206", "#3d2e0f"],
  },
  scary_story: {
    background: "#0a0000",
    primary: "#8b0000",
    secondary: "#2d0000",
    accent: "#ff0000",
    text: "#cccccc",
    textSecondary: "#666666",
    overlay: "rgba(10, 0, 0, 0.8)",
    gradient: ["#0a0000", "#1a0000"],
  },
  educational: {
    background: "#f8f9fa",
    primary: "#1a73e8",
    secondary: "#e8f0fe",
    accent: "#34a853",
    text: "#202124",
    textSecondary: "#5f6368",
    overlay: "rgba(255, 255, 255, 0.85)",
    gradient: ["#ffffff", "#f1f3f4"],
  },
};
```

Create `services/remotion/src/utils/timing.ts`:
```typescript
export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

export function secondsToFrames(seconds: number, fps: number): number {
  return Math.ceil(seconds * fps);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

### Step 2: Create Base Template Component
Create `services/remotion/src/templates/BaseTemplate.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
} from "remotion";
import { Scene } from "../components/Scene";
import { MusicTrack } from "../components/MusicTrack";
import type { TemplateProps, ScriptScene, CaptionStyle } from "../types";
import type { ColorPalette } from "../utils/colors";

export interface BaseTemplateConfig {
  palette: ColorPalette;
  captionStyle: Partial<CaptionStyle>;
  introFrames: number;
  outroFrames: number;
  transitionOverlap: number;  // frames of overlap between scenes
}

interface BaseTemplateProps extends TemplateProps {
  templateConfig: BaseTemplateConfig;
  IntroComponent?: React.FC<{ title: string; hook: string; palette: ColorPalette }>;
  OutroComponent?: React.FC<{ text: string; palette: ColorPalette }>;
  SceneOverlay?: React.FC<{ scene: ScriptScene; index: number; palette: ColorPalette }>;
}

export const BaseTemplate: React.FC<BaseTemplateProps> = ({
  script,
  assets,
  config,
  sceneDurations,
  templateConfig,
  IntroComponent,
  OutroComponent,
  SceneOverlay,
}) => {
  const { fps } = useVideoConfig();
  const { palette, introFrames, outroFrames } = templateConfig;

  // Merge template caption style with config
  const mergedCaptionStyle: CaptionStyle = {
    ...config.caption_style,
    ...templateConfig.captionStyle,
  };

  // Calculate scene offsets including intro
  let currentFrame = introFrames;
  const offsets = sceneDurations.map((dur) => {
    const offset = currentFrame;
    currentFrame += dur;
    return offset;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      {/* Background music */}
      {assets.music_url && (
        <MusicTrack src={assets.music_url} volume={config.music_volume} />
      )}

      {/* Intro sequence */}
      {IntroComponent && introFrames > 0 && (
        <Sequence from={0} durationInFrames={introFrames} name="Intro">
          <IntroComponent
            title={script.title}
            hook={script.hook}
            palette={palette}
          />
        </Sequence>
      )}

      {/* Scenes */}
      {script.scenes.map((scene, i) => (
        <Sequence
          key={scene.scene_number}
          from={offsets[i]}
          durationInFrames={sceneDurations[i]}
          name={`Scene ${scene.scene_number}`}
        >
          <Scene
            scene={scene}
            voiceoverUrl={assets.voiceover_urls[i] || ""}
            brollUrl={assets.broll_urls[i] || ""}
            durationInFrames={sceneDurations[i]}
            captionStyle={mergedCaptionStyle}
            transition={scene.transition}
          />
          {/* Template-specific overlay */}
          {SceneOverlay && (
            <SceneOverlay scene={scene} index={i} palette={palette} />
          )}
        </Sequence>
      ))}

      {/* Outro sequence */}
      {OutroComponent && outroFrames > 0 && (
        <Sequence
          from={currentFrame}
          durationInFrames={outroFrames}
          name="Outro"
        >
          <OutroComponent text={script.outro} palette={palette} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
```

### Step 3: Create Reddit Story Template
Create `services/remotion/src/templates/RedditStoryTemplate.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BaseTemplate, BaseTemplateConfig } from "./BaseTemplate";
import { PALETTES } from "../utils/colors";
import type { TemplateProps, ScriptScene } from "../types";
import type { ColorPalette } from "../utils/colors";

const config: BaseTemplateConfig = {
  palette: PALETTES.reddit_story,
  captionStyle: {
    preset: "highlight",
    font_family: "'Noto Sans', sans-serif",
    font_size: 56,
    color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 2,
    position: "bottom",
    max_words_per_line: 5,
  },
  introFrames: 90,  // 3 seconds
  outroFrames: 90,  // 3 seconds
  transitionOverlap: 0,
};

// Reddit-style upvote/post header overlay
const RedditHeader: React.FC<{
  scene: ScriptScene;
  index: number;
  palette: ColorPalette;
}> = ({ scene, index, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(slideIn, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      {/* Reddit-style post header at top */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 40,
          right: 40,
          opacity,
          transform: `translateY(${interpolate(slideIn, [0, 1], [-20, 0])}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            backgroundColor: "rgba(26, 26, 27, 0.9)",
            padding: "12px 20px",
            borderRadius: 8,
            border: `1px solid ${palette.primary}33`,
          }}
        >
          {/* Reddit avatar circle */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: palette.primary,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ color: palette.text, fontSize: 16, fontWeight: "bold" }}>
              r/stories
            </div>
            <div style={{ color: palette.textSecondary, fontSize: 13 }}>
              u/anonymous - Posted by OP
            </div>
          </div>
          {/* Upvote count */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: palette.primary, fontSize: 20, fontWeight: "bold" }}>
              {Math.floor(Math.random() * 15000 + 5000).toLocaleString()}
            </div>
            <div style={{ color: palette.textSecondary, fontSize: 11 }}>upvotes</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Reddit intro with title card
const RedditIntro: React.FC<{
  title: string;
  hook: string;
  palette: ColorPalette;
}> = ({ title, hook, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${palette.background}, ${palette.secondary})`,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${interpolate(scale, [0, 1], [0.9, 1])})`,
          textAlign: "center",
        }}
      >
        {/* Reddit logo placeholder */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: palette.primary,
            margin: "0 auto 30px",
          }}
        />
        <h1
          style={{
            color: palette.text,
            fontSize: 48,
            fontWeight: "bold",
            lineHeight: 1.2,
            marginBottom: 20,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: palette.textSecondary,
            fontSize: 24,
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          {hook}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// Outro with CTA
const RedditOutro: React.FC<{ text: string; palette: ColorPalette }> = ({
  text,
  palette,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: palette.background,
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <p style={{ color: palette.text, fontSize: 36, textAlign: "center", padding: 60 }}>
        {text}
      </p>
    </AbsoluteFill>
  );
};

export const RedditStoryTemplate: React.FC<TemplateProps> = (props) => {
  return (
    <BaseTemplate
      {...props}
      templateConfig={config}
      IntroComponent={RedditIntro}
      OutroComponent={RedditOutro}
      SceneOverlay={RedditHeader}
    />
  );
};
```

### Step 4: Create Documentary Template
Create `services/remotion/src/templates/DocumentaryTemplate.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { BaseTemplate, BaseTemplateConfig } from "./BaseTemplate";
import { PALETTES } from "../utils/colors";
import type { TemplateProps, ScriptScene } from "../types";
import type { ColorPalette } from "../utils/colors";

const config: BaseTemplateConfig = {
  palette: PALETTES.documentary,
  captionStyle: {
    preset: "karaoke",
    font_family: "'Inter', sans-serif",
    font_size: 60,
    color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 3,
    position: "bottom",
    max_words_per_line: 4,
  },
  introFrames: 120, // 4 seconds
  outroFrames: 90,  // 3 seconds
  transitionOverlap: 15,
};

// Cinematic letterbox bars
const DocumentaryOverlay: React.FC<{
  scene: ScriptScene;
  index: number;
  palette: ColorPalette;
}> = ({ scene, index, palette }) => {
  const { width, height } = useVideoConfig();
  const barHeight = Math.floor(height * 0.06);

  return (
    <AbsoluteFill>
      {/* Top letterbox bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: barHeight,
          backgroundColor: "#000000",
        }}
      />
      {/* Bottom letterbox bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: barHeight,
          backgroundColor: "#000000",
        }}
      />
      {/* Subtle gold accent line */}
      <div
        style={{
          position: "absolute",
          bottom: barHeight,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: palette.primary,
          opacity: 0.6,
        }}
      />
    </AbsoluteFill>
  );
};

const DocumentaryIntro: React.FC<{
  title: string;
  hook: string;
  palette: ColorPalette;
}> = ({ title, hook, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleSlide = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 20 } });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${palette.background} 0%, #000 100%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      {/* Gold line decoration */}
      <div
        style={{
          width: interpolate(titleSlide, [0, 1], [0, 200]),
          height: 3,
          backgroundColor: palette.primary,
          marginBottom: 40,
        }}
      />
      <h1
        style={{
          color: palette.text,
          fontSize: 52,
          fontWeight: 700,
          textAlign: "center",
          opacity: fadeIn,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {title}
      </h1>
      <div
        style={{
          width: interpolate(titleSlide, [0, 1], [0, 200]),
          height: 3,
          backgroundColor: palette.primary,
          marginTop: 40,
        }}
      />
    </AbsoluteFill>
  );
};

const DocumentaryOutro: React.FC<{ text: string; palette: ColorPalette }> = ({
  text,
  palette,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30, 60, 90], [0, 1, 1, 0]);

  return (
    <AbsoluteFill
      style={{
        background: palette.background,
        justifyContent: "center",
        alignItems: "center",
        opacity,
        padding: 80,
      }}
    >
      <p style={{ color: palette.primary, fontSize: 32, textAlign: "center", fontStyle: "italic" }}>
        {text}
      </p>
    </AbsoluteFill>
  );
};

export const DocumentaryTemplate: React.FC<TemplateProps> = (props) => {
  return (
    <BaseTemplate
      {...props}
      templateConfig={config}
      IntroComponent={DocumentaryIntro}
      OutroComponent={DocumentaryOutro}
      SceneOverlay={DocumentaryOverlay}
    />
  );
};
```

### Step 5: Create Listicle Template
Create `services/remotion/src/templates/ListicleTemplate.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BaseTemplate, BaseTemplateConfig } from "./BaseTemplate";
import { PALETTES } from "../utils/colors";
import type { TemplateProps, ScriptScene } from "../types";
import type { ColorPalette } from "../utils/colors";

const config: BaseTemplateConfig = {
  palette: PALETTES.listicle,
  captionStyle: {
    preset: "bounce",
    font_family: "'Inter', sans-serif",
    font_size: 58,
    color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 3,
    position: "bottom",
    max_words_per_line: 4,
  },
  introFrames: 60,  // 2 seconds
  outroFrames: 90,
  transitionOverlap: 0,
};

// Bold number overlay for each list item
const ListicleOverlay: React.FC<{
  scene: ScriptScene;
  index: number;
  palette: ColorPalette;
}> = ({ scene, index, palette }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200 },
  });

  // The item number (scenes are numbered by list position)
  const number = scene.scene_number;

  return (
    <AbsoluteFill>
      {/* Large number in top-left */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 40,
          transform: `scale(${interpolate(scale, [0, 1], [0.5, 1])})`,
          transformOrigin: "top left",
        }}
      >
        <span
          style={{
            fontSize: 140,
            fontWeight: 900,
            color: palette.accent,
            WebkitTextStroke: `4px ${palette.primary}`,
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1,
          }}
        >
          #{number}
        </span>
      </div>

      {/* Progress dots at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: height * 0.22,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 <= number ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                i + 1 <= number ? palette.primary : "rgba(255,255,255,0.3)",
              transition: "all 0.3s",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ListicleIntro: React.FC<{
  title: string;
  hook: string;
  palette: ColorPalette;
}> = ({ title, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 6, stiffness: 150 } });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${palette.gradient[0]}, ${palette.gradient[1]})`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1
        style={{
          color: "#FFFFFF",
          fontSize: 56,
          fontWeight: 900,
          textAlign: "center",
          transform: `scale(${interpolate(pop, [0, 1], [0.3, 1])})`,
          padding: 60,
        }}
      >
        {title}
      </h1>
    </AbsoluteFill>
  );
};

const ListicleOutro: React.FC<{ text: string; palette: ColorPalette }> = ({
  text,
  palette,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${palette.gradient[0]}, ${palette.gradient[1]})`,
        justifyContent: "center",
        alignItems: "center",
        opacity,
        padding: 60,
      }}
    >
      <p style={{ color: "#FFFFFF", fontSize: 36, textAlign: "center", fontWeight: "bold" }}>
        {text}
      </p>
    </AbsoluteFill>
  );
};

export const ListicleTemplate: React.FC<TemplateProps> = (props) => {
  return (
    <BaseTemplate
      {...props}
      templateConfig={config}
      IntroComponent={ListicleIntro}
      OutroComponent={ListicleOutro}
      SceneOverlay={ListicleOverlay}
    />
  );
};
```

### Step 6: Create Motivational Template
Create `services/remotion/src/templates/MotivationalTemplate.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BaseTemplate, BaseTemplateConfig } from "./BaseTemplate";
import { PALETTES } from "../utils/colors";
import type { TemplateProps, ScriptScene } from "../types";
import type { ColorPalette } from "../utils/colors";

const config: BaseTemplateConfig = {
  palette: PALETTES.motivational,
  captionStyle: {
    preset: "karaoke",
    font_family: "'Georgia', serif",
    font_size: 64,
    color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 3,
    position: "center",
    max_words_per_line: 3,
  },
  introFrames: 90,
  outroFrames: 120,
  transitionOverlap: 15,
};

const MotivationalOverlay: React.FC<{
  scene: ScriptScene;
  index: number;
  palette: ColorPalette;
}> = ({ palette }) => {
  return (
    <AbsoluteFill>
      {/* Golden vignette effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 50%, ${palette.background}dd 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const MotivationalIntro: React.FC<{
  title: string;
  hook: string;
  palette: ColorPalette;
}> = ({ title, hook, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const hookFade = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${palette.background}, #000)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            color: palette.primary,
            fontSize: 48,
            fontFamily: "'Georgia', serif",
            fontStyle: "italic",
            opacity: fadeIn,
            marginBottom: 30,
          }}
        >
          "{hook}"
        </h1>
        <div
          style={{
            width: 60,
            height: 3,
            backgroundColor: palette.primary,
            margin: "0 auto",
            opacity: hookFade,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const MotivationalOutro: React.FC<{ text: string; palette: ColorPalette }> = ({
  text,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 15 } });

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <p
        style={{
          color: palette.primary,
          fontSize: 40,
          fontFamily: "'Georgia', serif",
          textAlign: "center",
          fontWeight: "bold",
          transform: `scale(${interpolate(scale, [0, 1], [0.8, 1])})`,
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
};

export const MotivationalTemplate: React.FC<TemplateProps> = (props) => {
  return (
    <BaseTemplate
      {...props}
      templateConfig={config}
      IntroComponent={MotivationalIntro}
      OutroComponent={MotivationalOutro}
      SceneOverlay={MotivationalOverlay}
    />
  );
};
```

### Step 7: Create Scary Story Template
Create `services/remotion/src/templates/ScaryStoryTemplate.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  random,
} from "remotion";
import { BaseTemplate, BaseTemplateConfig } from "./BaseTemplate";
import { PALETTES } from "../utils/colors";
import type { TemplateProps, ScriptScene } from "../types";
import type { ColorPalette } from "../utils/colors";

const config: BaseTemplateConfig = {
  palette: PALETTES.scary_story,
  captionStyle: {
    preset: "typewriter",
    font_family: "'Courier New', monospace",
    font_size: 52,
    color: "#CCCCCC",
    stroke_color: "#000000",
    stroke_width: 2,
    position: "bottom",
    max_words_per_line: 4,
  },
  introFrames: 120,
  outroFrames: 120,
  transitionOverlap: 0,
};

// Glitch and vignette overlay
const ScaryOverlay: React.FC<{
  scene: ScriptScene;
  index: number;
  palette: ColorPalette;
}> = ({ scene, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Random glitch effect every ~3 seconds
  const shouldGlitch = random(`glitch-${scene.scene_number}-${Math.floor(frame / (fps * 3))}`) > 0.7;
  const glitchOffset = shouldGlitch ? random(`offset-${frame}`) * 10 - 5 : 0;
  const glitchOpacity = shouldGlitch ? 0.15 : 0;

  return (
    <AbsoluteFill>
      {/* Dark vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 30%, ${palette.background} 100%)`,
          opacity: 0.8,
        }}
      />

      {/* Film grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.06,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Red glitch line */}
      {shouldGlitch && (
        <div
          style={{
            position: "absolute",
            top: `${30 + random(`y-${frame}`) * 40}%`,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: palette.accent,
            opacity: glitchOpacity,
            transform: `translateX(${glitchOffset}px)`,
          }}
        />
      )}

      {/* Subtle red pulsing border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `2px solid ${palette.accent}`,
          opacity: interpolate(
            Math.sin(frame / fps * Math.PI),
            [-1, 1],
            [0, 0.15]
          ),
        }}
      />
    </AbsoluteFill>
  );
};

const ScaryIntro: React.FC<{
  title: string;
  hook: string;
  palette: ColorPalette;
}> = ({ title, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flicker = random(`flicker-${Math.floor(frame / 3)}`) > 0.1 ? 1 : 0.3;
  const fadeIn = interpolate(frame, [30, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{ background: "#000", justifyContent: "center", alignItems: "center" }}
    >
      <h1
        style={{
          color: palette.text,
          fontSize: 48,
          fontFamily: "'Courier New', monospace",
          textAlign: "center",
          padding: 60,
          opacity: fadeIn * flicker,
          textShadow: `0 0 20px ${palette.accent}44`,
        }}
      >
        {title}
      </h1>
    </AbsoluteFill>
  );
};

const ScaryOutro: React.FC<{ text: string; palette: ColorPalette }> = ({
  text,
  palette,
}) => {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [60, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center" }}>
      <p
        style={{
          color: palette.accent,
          fontSize: 32,
          fontFamily: "'Courier New', monospace",
          textAlign: "center",
          padding: 60,
          opacity: fadeIn * fadeOut,
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
};

export const ScaryStoryTemplate: React.FC<TemplateProps> = (props) => {
  return (
    <BaseTemplate
      {...props}
      templateConfig={config}
      IntroComponent={ScaryIntro}
      OutroComponent={ScaryOutro}
      SceneOverlay={ScaryOverlay}
    />
  );
};
```

### Step 8: Create Educational Template
Create `services/remotion/src/templates/EducationalTemplate.tsx`:
```tsx
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BaseTemplate, BaseTemplateConfig } from "./BaseTemplate";
import { PALETTES } from "../utils/colors";
import type { TemplateProps, ScriptScene } from "../types";
import type { ColorPalette } from "../utils/colors";

const config: BaseTemplateConfig = {
  palette: PALETTES.educational,
  captionStyle: {
    preset: "highlight",
    font_family: "'Inter', sans-serif",
    font_size: 54,
    color: "#202124",
    stroke_color: "#FFFFFF",
    stroke_width: 0,
    position: "bottom",
    max_words_per_line: 5,
  },
  introFrames: 90,
  outroFrames: 90,
  transitionOverlap: 0,
};

// Step indicator and topic label
const EducationalOverlay: React.FC<{
  scene: ScriptScene;
  index: number;
  palette: ColorPalette;
}> = ({ scene, index, palette }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const slideIn = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });

  return (
    <AbsoluteFill>
      {/* Topic label at top */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `translateY(${interpolate(slideIn, [0, 1], [-40, 0])}px)`,
          opacity: interpolate(slideIn, [0, 1], [0, 1]),
        }}
      >
        <div
          style={{
            backgroundColor: palette.primary,
            color: "#FFFFFF",
            padding: "8px 24px",
            borderRadius: 20,
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          Step {scene.scene_number}
        </div>
      </div>

      {/* Light overlay for text contrast (educational uses light theme) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "35%",
          background: `linear-gradient(transparent, ${palette.overlay})`,
        }}
      />
    </AbsoluteFill>
  );
};

const EducationalIntro: React.FC<{
  title: string;
  hook: string;
  palette: ColorPalette;
}> = ({ title, hook, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill
      style={{
        background: palette.background,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 12,
            backgroundColor: palette.primary,
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#FFF", fontSize: 28, fontWeight: "bold" }}>?</span>
        </div>
        <h1
          style={{
            color: palette.text,
            fontSize: 44,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {title}
        </h1>
        <p style={{ color: palette.textSecondary, fontSize: 22 }}>{hook}</p>
      </div>
    </AbsoluteFill>
  );
};

const EducationalOutro: React.FC<{ text: string; palette: ColorPalette }> = ({
  text,
  palette,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: palette.background,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: palette.secondary,
          padding: "40px 60px",
          borderRadius: 16,
          borderLeft: `4px solid ${palette.primary}`,
        }}
      >
        <p style={{ color: palette.text, fontSize: 28, textAlign: "center" }}>{text}</p>
      </div>
    </AbsoluteFill>
  );
};

export const EducationalTemplate: React.FC<TemplateProps> = (props) => {
  return (
    <BaseTemplate
      {...props}
      templateConfig={config}
      IntroComponent={EducationalIntro}
      OutroComponent={EducationalOutro}
      SceneOverlay={EducationalOverlay}
    />
  );
};
```

### Step 9: Create Template Registry
Create `services/remotion/src/templates/index.ts`:
```typescript
import React from "react";
import { RedditStoryTemplate } from "./RedditStoryTemplate";
import { DocumentaryTemplate } from "./DocumentaryTemplate";
import { ListicleTemplate } from "./ListicleTemplate";
import { MotivationalTemplate } from "./MotivationalTemplate";
import { ScaryStoryTemplate } from "./ScaryStoryTemplate";
import { EducationalTemplate } from "./EducationalTemplate";
import type { TemplateProps } from "../types";

export interface TemplateRegistryEntry {
  id: string;
  name: string;
  description: string;
  component: React.FC<TemplateProps>;
  defaultAspectRatio: "9:16" | "16:9" | "1:1";
  supportedMoods: string[];
  previewColor: string;
}

export const TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry> = {
  reddit_story: {
    id: "reddit_story",
    name: "Reddit Story",
    description: "Dark theme with Reddit UI elements, upvote counters, and confession-style narration",
    component: RedditStoryTemplate,
    defaultAspectRatio: "9:16",
    supportedMoods: ["dramatic", "funny", "tense"],
    previewColor: "#ff4500",
  },
  documentary: {
    id: "documentary",
    name: "Documentary",
    description: "Cinematic letterbox bars, gold accents, authoritative style like Kurzgesagt",
    component: DocumentaryTemplate,
    defaultAspectRatio: "9:16",
    supportedMoods: ["dramatic", "calm", "mysterious", "inspiring"],
    previewColor: "#c9a14a",
  },
  listicle: {
    id: "listicle",
    name: "Top 10 Listicle",
    description: "Bold numbered overlays, progress dots, vibrant gradients",
    component: ListicleTemplate,
    defaultAspectRatio: "9:16",
    supportedMoods: ["upbeat", "dramatic", "funny"],
    previewColor: "#ff2d55",
  },
  motivational: {
    id: "motivational",
    name: "Motivational",
    description: "Golden warm tones, centered captions, serif typography, quote card style",
    component: MotivationalTemplate,
    defaultAspectRatio: "9:16",
    supportedMoods: ["inspiring", "dramatic", "calm"],
    previewColor: "#d4a543",
  },
  scary_story: {
    id: "scary_story",
    name: "Scary Story",
    description: "Dark theme with glitch effects, red accents, film grain, flickering text",
    component: ScaryStoryTemplate,
    defaultAspectRatio: "9:16",
    supportedMoods: ["dark", "tense", "mysterious"],
    previewColor: "#8b0000",
  },
  educational: {
    id: "educational",
    name: "Educational",
    description: "Clean light theme, step indicators, blue accents, clear typography",
    component: EducationalTemplate,
    defaultAspectRatio: "9:16",
    supportedMoods: ["calm", "upbeat", "inspiring"],
    previewColor: "#1a73e8",
  },
};

export function getTemplate(id: string): TemplateRegistryEntry | undefined {
  return TEMPLATE_REGISTRY[id];
}

export function getTemplateComponent(id: string): React.FC<TemplateProps> {
  const entry = TEMPLATE_REGISTRY[id];
  if (!entry) {
    // Default to documentary if template not found
    return TEMPLATE_REGISTRY.documentary.component;
  }
  return entry.component;
}

/**
 * Auto-select a template based on script style.
 */
export function autoSelectTemplate(scriptStyle: string): string {
  const styleToTemplate: Record<string, string> = {
    documentary: "documentary",
    listicle: "listicle",
    story: "reddit_story",
    motivational: "motivational",
    educational: "educational",
    scary: "scary_story",
    reddit: "reddit_story",
  };
  return styleToTemplate[scriptStyle] || "documentary";
}
```

### Step 10: Update Remotion Root to Register All Templates
Update `services/remotion/src/Root.tsx`:
```tsx
import React from "react";
import { Composition } from "remotion";
import { FacelessVideo } from "./compositions/FacelessVideo";
import { TEMPLATE_REGISTRY } from "./templates";
import type { TemplateProps } from "./types";

const defaultProps: TemplateProps = {
  script: { title: "Preview", hook: "", scenes: [], outro: "" },
  assets: { voiceover_urls: [], broll_urls: [], music_url: null, thumbnail_url: null },
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
};

export const Root: React.FC = () => {
  return (
    <>
      {/* Default composition */}
      <Composition
        id="FacelessVideo"
        component={FacelessVideo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />

      {/* Register each template as a separate composition */}
      {Object.entries(TEMPLATE_REGISTRY).map(([id, entry]) => (
        <Composition
          key={id}
          id={id}
          component={entry.component}
          durationInFrames={900}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={defaultProps}
        />
      ))}
    </>
  );
};
```

### Step 11: Create Backend Template API
Add to `backend/app/api/v1/templates.py`:
```python
from fastapi import APIRouter

from app.services.remotion_client import RemotionClient

router = APIRouter()


@router.get("/")
async def list_templates():
    """List all available faceless video templates."""
    return {
        "templates": [
            {
                "id": "reddit_story",
                "name": "Reddit Story",
                "description": "Dark theme with Reddit UI elements and confession-style narration",
                "styles": ["reddit", "story"],
                "moods": ["dramatic", "funny", "tense"],
                "preview_color": "#ff4500",
            },
            {
                "id": "documentary",
                "name": "Documentary",
                "description": "Cinematic letterbox bars with gold accents",
                "styles": ["documentary"],
                "moods": ["dramatic", "calm", "mysterious", "inspiring"],
                "preview_color": "#c9a14a",
            },
            {
                "id": "listicle",
                "name": "Top 10 Listicle",
                "description": "Bold numbered overlays with vibrant gradients",
                "styles": ["listicle"],
                "moods": ["upbeat", "dramatic", "funny"],
                "preview_color": "#ff2d55",
            },
            {
                "id": "motivational",
                "name": "Motivational",
                "description": "Golden warm tones with quote card typography",
                "styles": ["motivational"],
                "moods": ["inspiring", "dramatic", "calm"],
                "preview_color": "#d4a543",
            },
            {
                "id": "scary_story",
                "name": "Scary Story",
                "description": "Dark theme with glitch effects and red accents",
                "styles": ["scary"],
                "moods": ["dark", "tense", "mysterious"],
                "preview_color": "#8b0000",
            },
            {
                "id": "educational",
                "name": "Educational",
                "description": "Clean light theme with step indicators",
                "styles": ["educational"],
                "moods": ["calm", "upbeat", "inspiring"],
                "preview_color": "#1a73e8",
            },
        ]
    }


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get details for a specific template."""
    templates = (await list_templates())["templates"]
    template = next((t for t in templates if t["id"] == template_id), None)
    if not template:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Template not found")
    return template


STYLE_TO_TEMPLATE = {
    "documentary": "documentary",
    "listicle": "listicle",
    "story": "reddit_story",
    "motivational": "motivational",
    "educational": "educational",
    "scary": "scary_story",
    "reddit": "reddit_story",
}


@router.get("/auto-select/{style}")
async def auto_select_template(style: str):
    """Auto-select the best template for a script style."""
    template_id = STYLE_TO_TEMPLATE.get(style, "documentary")
    return {"style": style, "recommended_template": template_id}
```

## Best Practices

- **One template = one visual identity:** Each template should have a distinctive look that viewers associate with the content niche. Avoid templates that are too similar.
- **Props-driven customization:** Templates should not hardcode colors or fonts. Accept them via `config.color_palette` so users can customize without modifying the template code.
- **Intro/outro consistency:** Every template should have a 2-4 second intro and a 2-3 second outro. Intros establish the visual style; outros provide CTA space.
- **Mobile-first design:** Faceless videos are primarily consumed on phones. Design for 9:16 (1080x1920). Text must be readable at phone resolution.
- **Scene overlays are optional:** Not every template needs per-scene overlays (like the listicle numbers). Use them only when they add information (numbering, progress, labels).
- **Test with Remotion Studio:** Use `npx remotion studio` to preview each template with sample data before deploying. Iterate on timing and animations in the browser.
- **Keep animations subtle:** Overly flashy animations distract from content. The best templates enhance the narration, not compete with it.

## Testing

```bash
cd services/remotion

# Preview all templates in browser
npx remotion studio

# Render a specific template
npx remotion render reddit_story --props='{"script":{"title":"Test","hook":"Test hook","scenes":[{"scene_number":1,"narration":"Test narration","duration_est":8,"visual_description":"test","search_keywords":["test"],"mood":"dramatic","transition":"fade"}],"outro":"Subscribe"},"assets":{"voiceover_urls":[],"broll_urls":[],"music_url":null,"thumbnail_url":null},"config":{"width":1080,"height":1920,"fps":30,"caption_style":{"preset":"highlight","font_family":"Inter","font_size":56,"color":"#FFFFFF","stroke_color":"#000000","stroke_width":2,"position":"bottom","max_words_per_line":5},"music_volume":0.15,"color_palette":"default"},"sceneDurations":[240]}' out/test_reddit.mp4
```

## Verification Checklist
- [ ] All 6 templates render without errors in Remotion Studio
- [ ] Reddit Story: shows Reddit header, dark theme, orange accents
- [ ] Documentary: shows letterbox bars, gold accents, uppercase title
- [ ] Listicle: shows bold numbers per scene, progress dots
- [ ] Motivational: shows centered quote-style text, golden tones
- [ ] Scary Story: shows glitch effects, red accents, flickering
- [ ] Educational: shows step indicators, light theme, blue accents
- [ ] Template registry resolves all 6 templates by ID
- [ ] Auto-select maps script styles to correct templates
- [ ] Each template has a distinct intro and outro
- [ ] Captions render with template-specific style
- [ ] Scene transitions work for each template
- [ ] Templates accept standardized TemplateProps
- [ ] Backend template API lists all templates
- [ ] Mobile-first: text is readable at 1080x1920
