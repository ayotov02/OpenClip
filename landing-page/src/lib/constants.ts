import {
  Star,
  CreditCard,
  Stamp,
  Lock,
  EyeOff,
  Loader,
  Scissors,
  Video,
  Captions,
  Search,
  Calendar,
  Code,
  Upload,
  Sparkles,
  Send,
  type LucideIcon,
} from "lucide-react";

export const LINKS = {
  github: "https://github.com/your-org/openclip",
  docs: "https://github.com/your-org/openclip/docs",
} as const;

export interface PainPoint {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const PAIN_POINTS: PainPoint[] = [
  { icon: Star, title: "OpusClip: 2.4/5 on Trustpilot", description: "The market leader is deeply flawed with thousands of frustrated users." },
  { icon: CreditCard, title: "$15–199/mo for basic features", description: "Monthly subscriptions that drain creators' budgets for simple tools." },
  { icon: Stamp, title: "Watermarks on every free export", description: "Free tiers ruined by ugly branding you can't remove." },
  { icon: Lock, title: "Your content locked in their cloud", description: "No data portability — your videos are hostage to their platform." },
  { icon: EyeOff, title: "Black-box AI with zero transparency", description: "Proprietary models you can't inspect, audit, or customize." },
  { icon: Loader, title: "Videos stuck processing for days", description: "Overloaded shared infrastructure means endless waiting." },
];

export interface BentoItem {
  title: string;
  description: string;
  colSpan: number;
  rowSpan: number;
  icon: LucideIcon;
  hasImage: boolean;
  imageLabel?: string;
}

export const BENTO_ITEMS: BentoItem[] = [
  { title: "AI Video Clipping", description: "Upload long-form content and let AI find the most viral moments. Each clip gets a virality score.", colSpan: 2, rowSpan: 2, icon: Scissors, hasImage: true, imageLabel: "Dashboard showing clip cards with virality scores" },
  { title: "Faceless Studio", description: "Create videos from text — no camera needed. AI generates scripts, voiceover, and B-roll.", colSpan: 1, rowSpan: 1, icon: Video, hasImage: false },
  { title: "99%+ Captions", description: "WhisperX-powered transcription with 7 animation styles and 25+ languages.", colSpan: 1, rowSpan: 1, icon: Captions, hasImage: false },
  { title: "Competitor Intelligence", description: "Scrape and analyze competitor content across all platforms. AI scores hooks, CTAs, and engagement patterns.", colSpan: 2, rowSpan: 1, icon: Search, hasImage: true, imageLabel: "Spy feed with competitor analysis" },
  { title: "Brand Kit", description: "Define your brand voice, colors, and style — injected into every AI generation.", colSpan: 1, rowSpan: 1, icon: Sparkles, hasImage: false },
  { title: "Batch Processing", description: "Process hundreds of videos simultaneously. Queue, prioritize, and automate.", colSpan: 1, rowSpan: 1, icon: Loader, hasImage: false },
];

export interface Feature {
  title: string;
  description: string;
  points: string[];
  badge: string;
  imageLabel: string;
  imageDimensions: string;
  icon: LucideIcon;
  isCodeBlock?: boolean;
  codeSnippet?: string;
}

export const FEATURES: Feature[] = [
  {
    title: "AI Video Clipping",
    description: "Upload any long-form video and our AI analyzes every segment for viral potential. Get scored clips ready for social media in minutes.",
    points: ["Upload any video — up to 4 hours long", "AI scores each segment for virality", "Export clips with captions and music"],
    badge: "Free",
    imageLabel: "Dashboard screenshot showing clip cards with virality scores",
    imageDimensions: "1280x720",
    icon: Scissors,
  },
  {
    title: "Faceless Video Studio",
    description: "Transform text prompts into complete videos. AI handles script writing, voiceover generation, B-roll matching, and final assembly.",
    points: ["Text-to-video pipeline", "AI voiceover with Kokoro TTS", "Automatic B-roll matching from prompts"],
    badge: "Free",
    imageLabel: "Faceless editor showing script + scene breakdown",
    imageDimensions: "1280x720",
    icon: Video,
  },
  {
    title: "Smart Captions",
    description: "Industry-leading caption accuracy powered by WhisperX. Choose from 7 animation styles and support for 25+ languages.",
    points: ["99%+ accuracy with WhisperX", "7 caption animation styles", "25+ language support"],
    badge: "Open Source",
    imageLabel: "Video preview with animated captions overlay",
    imageDimensions: "1280x720",
    icon: Captions,
  },
  {
    title: "Competitor Intelligence",
    description: "Scrape competitor content across every platform. AI analyzes hooks, CTAs, and engagement patterns — then generates similar scripts for your brand.",
    points: ["Scrape YouTube, TikTok, Instagram, X, LinkedIn", "AI hook & CTA scoring", "Generate similar scripts with your brand voice"],
    badge: "Free",
    imageLabel: "Spy feed showing competitor post cards with scores",
    imageDimensions: "1280x720",
    icon: Search,
  },
  {
    title: "Multi-Platform Publishing",
    description: "Schedule and publish to every major platform from one calendar view. AI optimizes titles, descriptions, and hashtags per platform.",
    points: ["YouTube, TikTok, Instagram, X, LinkedIn", "AI-optimized titles & hashtags", "Visual calendar with drag-and-drop scheduling"],
    badge: "Free",
    imageLabel: "Calendar view with scheduled posts",
    imageDimensions: "1280x720",
    icon: Calendar,
  },
  {
    title: "Full REST API",
    description: "Programmatic access to every feature via a well-documented REST API. Build your own integrations and workflows.",
    points: ["OpenAPI documentation", "Webhook support for async tasks", "Programmatic access to all 48+ features"],
    badge: "Open Source",
    imageLabel: "API documentation page",
    imageDimensions: "1280x720",
    icon: Code,
    isCodeBlock: true,
    codeSnippet: `curl -X POST https://your-server/api/v1/clip \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "video_url": "https://youtube.com/watch?v=...",
    "min_duration": 30,
    "max_duration": 90,
    "add_captions": true
  }'`,
  },
];

export const STEPS = [
  { icon: Upload, title: "Upload", description: "Drop your long-form video or enter a text prompt." },
  { icon: Sparkles, title: "AI Processes", description: "Our AI clips, captions, scores, and assembles your content." },
  { icon: Send, title: "Publish", description: "Export and schedule to every platform in one click." },
];

export interface ComparisonRow {
  feature: string;
  openclip: string | boolean;
  opusclip: string | boolean;
  klap: string | boolean;
  vidyo: string | boolean;
  kapwing: string | boolean;
}

export const COMPARISON_DATA: ComparisonRow[] = [
  { feature: "Cost", openclip: "Free forever", opusclip: "$29/mo", klap: "$29/mo", vidyo: "$29/mo", kapwing: "$24/mo" },
  { feature: "Watermarks", openclip: true, opusclip: false, klap: false, vidyo: false, kapwing: false },
  { feature: "Self-hosted", openclip: true, opusclip: false, klap: false, vidyo: false, kapwing: false },
  { feature: "Open-source", openclip: true, opusclip: false, klap: false, vidyo: false, kapwing: false },
  { feature: "REST API", openclip: true, opusclip: false, klap: false, vidyo: false, kapwing: true },
  { feature: "Faceless Videos", openclip: true, opusclip: false, klap: false, vidyo: false, kapwing: false },
  { feature: "Voice Clone", openclip: true, opusclip: false, klap: false, vidyo: false, kapwing: false },
  { feature: "Batch Processing", openclip: true, opusclip: true, klap: false, vidyo: false, kapwing: false },
  { feature: "Competitor Intel", openclip: true, opusclip: false, klap: false, vidyo: false, kapwing: false },
  { feature: "Caption Accuracy", openclip: "99%+", opusclip: "~90%", klap: "~85%", vidyo: "~85%", kapwing: "~92%" },
];

export const TECH_ROW_1 = [
  "Next.js", "React 19", "FastAPI", "PostgreSQL", "Redis", "Celery", "FFmpeg", "Docker",
];

export const TECH_ROW_2 = [
  "WhisperX", "Ollama (Qwen3)", "Kokoro TTS", "FLUX.1", "MusicGen", "Wan 2.1", "Real-ESRGAN", "Remotion",
];

export interface StatItem {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  color?: string;
}

export const STATS: StatItem[] = [
  { value: 214, prefix: "$", suffix: "B", label: "Creator Economy (2026)", color: "text-indigo-400" },
  { value: 48, suffix: "+", label: "Features Built", color: "text-cyan-400" },
  { value: 38, suffix: "%", label: "Faceless Creator Growth", color: "text-emerald-400" },
  { value: 2.4, suffix: "/5", label: "OpusClip's Trustpilot", color: "text-red-400" },
];

export const FAQ_ITEMS = [
  {
    question: "Is OpenClip really free?",
    answer: "Yes, 100% free and open-source under the MIT license. The self-hosted version has zero cost — you only pay for your own hardware or VPS. There are no hidden fees, no premium tiers, and no feature gating.",
  },
  {
    question: "What hardware do I need to self-host?",
    answer: "For the local (GPU) version, you'll need an NVIDIA GPU with at least 8GB VRAM (RTX 3060 or better). For the premium (API) version, any $5/month VPS works — no GPU required. Both run via Docker Compose.",
  },
  {
    question: "How does OpenClip compare to OpusClip?",
    answer: "OpenClip offers all of OpusClip's core features plus competitor intelligence, faceless video creation, voice cloning, and a full REST API. OpusClip costs $29/month with watermarks on the free tier. OpenClip is free forever with no watermarks.",
  },
  {
    question: "Can I use OpenClip commercially?",
    answer: "Absolutely. OpenClip is MIT-licensed, which means you can use it for any purpose — personal, commercial, or enterprise. You can even build and sell products on top of it.",
  },
  {
    question: "What AI models does OpenClip use?",
    answer: "The local version uses Ollama with Qwen3 for language, WhisperX for transcription, Kokoro for TTS, FLUX.1 for image generation, Wan 2.1 for video, MusicGen for music, and YOLO11 for scene detection. The premium version uses OpenRouter and Kie.ai APIs.",
  },
  {
    question: "Do I need a GPU?",
    answer: "Only for the self-hosted local version. The premium (API-powered) version runs on any machine — even a $5/month VPS. It routes AI tasks through OpenRouter and Kie.ai APIs instead of running models locally.",
  },
  {
    question: "How accurate are the captions?",
    answer: "OpenClip uses WhisperX, which achieves 99%+ accuracy for English and excellent results across 25+ languages. This significantly outperforms OpusClip's ~90% and most competitors' ~85% accuracy rates.",
  },
  {
    question: "Can I contribute to the project?",
    answer: "Yes! OpenClip is fully open-source. We welcome contributions of all kinds — code, documentation, translations, bug reports, and feature suggestions. Check our GitHub repository for contribution guidelines.",
  },
];

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Compare", href: "#compare" },
  { label: "Tech Stack", href: "#tech-stack" },
  { label: "FAQ", href: "#faq" },
];
