import {
  Scissors,
  Video,
  Captions,
  Search,
  Calendar,
  Code,
  Layers,
  Palette,
} from "lucide-react";

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Local vs Premium", href: "#backends" },
  { label: "Stack", href: "#stack" },
  { label: "Premium", href: "/premium" },
] as const;

export const FEATURES = [
  {
    title: "AI Video Clipping",
    description:
      "Upload any long-form video. AI finds the most viral-worthy moments, clips them out, and exports with perfectly timed captions — ready to post.",
    placeholder: "AI Clipping Interface",
  },
  {
    title: "Faceless Video Studio",
    description:
      "Turn a text prompt into a complete video with AI voiceover, auto-selected B-roll, background music, and animated captions. No camera needed.",
    placeholder: "Faceless Studio",
  },
  {
    title: "Smart Captions",
    description:
      "99%+ accuracy transcription with 7 caption styles and support for 25+ languages. Word-level timing that actually syncs.",
    placeholder: "Caption Styles",
  },
  {
    title: "Competitor Intelligence",
    description:
      "Scrape any creator or brand on any platform. AI scores their content, identifies what works, and generates scripts based on winning patterns.",
    placeholder: "Competitor Dashboard",
  },
  {
    title: "Publish Everywhere",
    description:
      "YouTube, TikTok, Instagram, X, and LinkedIn — schedule and publish from one place. No more copying files between apps.",
    placeholder: "Publishing Hub",
  },
] as const;

export const CAPABILITIES = [
  { icon: Scissors, label: "Clip" },
  { icon: Video, label: "Faceless" },
  { icon: Captions, label: "Captions" },
  { icon: Search, label: "Spy" },
  { icon: Calendar, label: "Publish" },
  { icon: Code, label: "API" },
  { icon: Layers, label: "Batch" },
  { icon: Palette, label: "Brand" },
] as const;

export const TECH_ROW_1 = [
  "Next.js",
  "React",
  "FastAPI",
  "PostgreSQL",
  "Redis",
  "Celery",
  "FFmpeg",
  "Docker",
] as const;

export const TECH_ROW_2 = [
  "WhisperX",
  "Ollama",
  "Kokoro TTS",
  "FLUX.1",
  "MusicGen",
  "Wan 2.1",
  "Remotion",
  "Real-ESRGAN",
] as const;

export const STEPS = [
  {
    number: "01",
    title: "Clone",
    description: "git clone + docker compose up — running in under 5 minutes.",
  },
  {
    number: "02",
    title: "Configure",
    description:
      "Set your brand voice, pick AI models, connect your platforms.",
  },
  {
    number: "03",
    title: "Create",
    description:
      "Upload videos, generate content, publish everywhere. That's it.",
  },
] as const;

export const ABOUT_TEXT =
  "OpenClip replaces the entire AI video stack — clipping, faceless generation, captions, competitor scraping, publishing — in one self-hosted platform with two backends. Run it locally on your GPU with Ollama, WhisperX, FLUX.1, and Wan 2.1, or swap in premium API providers like OpenRouter, Kie.ai, and Bright Data with a single config change. Same codebase, same interface, same 70+ API endpoints, 20+ database models, and full Celery task pipeline. Your brand voice injects into every AI call. Your data never leaves your servers. No watermarks, no subscriptions, no vendor lock-in. Docker Compose up and you own the entire thing.";

export const GITHUB_URL = "https://github.com/ayotov02/OpenClip";
