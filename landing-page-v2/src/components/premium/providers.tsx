"use client";

import { FadeIn } from "@/components/effects/fade-in";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  Brain,
  Video,
  Mic,
  Globe,
  Shield,
  Music,
  ImageUp,
  Search,
} from "lucide-react";

const PROVIDERS = [
  {
    icon: Brain,
    title: "OpenRouter",
    subtitle: "LLM Provider",
    description:
      "Routes to the best available LLM automatically. Claude 4.5 Sonnet as primary, with GPT-5 and Gemini 3 as fallbacks. Handles script generation, content analysis, brand voice, and competitor intelligence.",
    models: ["Claude 4.5 Sonnet", "GPT-5", "Gemini 3", "Auto-fallback"],
    replaces: "Ollama (Qwen3)",
  },
  {
    icon: Video,
    title: "Kie.ai",
    subtitle: "Video & Image Generation",
    description:
      "Single API gateway to access Runway Gen-4, Veo 3.1, Kling, and Sora 2 for video. GPT Image and FLUX-2 for image generation. Generate B-roll, faceless videos, thumbnails without managing multiple subscriptions.",
    models: ["Runway Gen-4", "Veo 3.1", "Kling", "Sora 2", "GPT Image", "FLUX-2"],
    replaces: "FLUX.1 + Wan 2.1",
  },
  {
    icon: Mic,
    title: "ElevenLabs (via Kie.ai)",
    subtitle: "Voice & Text-to-Speech",
    description:
      "Natural AI voiceovers with voice cloning support. 30+ languages, emotion control, and ultra-realistic speech for faceless videos and narration.",
    models: ["ElevenLabs v3", "Voice Cloning", "30+ Languages"],
    replaces: "Kokoro / Chatterbox TTS",
  },
  {
    icon: Globe,
    title: "Bright Data",
    subtitle: "Web Scraping & Intelligence",
    description:
      "SERP API for search analysis, Browser API for full page rendering, Web Unlocker for anti-bot bypass. Scrape YouTube, TikTok, Instagram, X at scale for competitor intelligence.",
    models: ["SERP API", "Browser API", "Web Unlocker"],
    replaces: "Crawlee",
  },
  {
    icon: Shield,
    title: "Clerk",
    subtitle: "Managed Authentication",
    description:
      "Drop-in managed auth with social login, multi-factor authentication, and session management. No auth code to write or maintain.",
    models: ["OAuth 2.0", "Social Login", "MFA", "Sessions"],
    replaces: "JWT + manual auth",
  },
  {
    icon: Music,
    title: "Suno (via Kie.ai)",
    subtitle: "Music Generation",
    description:
      "AI-generated background music and soundtracks that match the mood of your video. Custom genres, royalty-free.",
    models: ["Suno v4", "Custom Genres", "Royalty-Free"],
    replaces: "MusicGen",
  },
  {
    icon: ImageUp,
    title: "Topaz (via Kie.ai)",
    subtitle: "AI Upscaling",
    description:
      "Enhance video and image resolution with AI. Upscale footage to 4K, sharpen details, reduce noise — without a local GPU.",
    models: ["4K Upscale", "Noise Reduction", "Enhancement"],
    replaces: "Real-ESRGAN",
  },
  {
    icon: Search,
    title: "Full Pipeline",
    subtitle: "Scrape → Analyze → Generate",
    description:
      "All providers work together: Bright Data scrapes competitor content, OpenRouter analyzes and scores it, then generates scripts. Kie.ai produces video. ElevenLabs adds voice. Fully automated.",
    models: ["Auto-Scrape", "AI Scoring", "Script Gen", "Video Export"],
    replaces: "All local models combined",
  },
];

export function PremiumProviders() {
  return (
    <section className="py-24 md:py-32 px-6 bg-neutral-50/50">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Premium providers.
          </h2>
          <p className="text-[#666666] text-lg mb-16 max-w-2xl">
            Every local model has a premium API equivalent. Same provider interface,
            swappable with one config change. The frontend never knows the difference.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROVIDERS.map((provider, i) => {
            const Icon = provider.icon;
            return (
              <FadeIn key={provider.title + provider.subtitle} delay={i * 0.06}>
                <div className="relative rounded-2xl border border-black/5 bg-white p-7 space-y-4 overflow-hidden h-full">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-black/50" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold tracking-tight leading-snug">
                        {provider.title}
                      </h3>
                      <p className="text-xs text-[#999999]">{provider.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[#666666] leading-relaxed">
                    {provider.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.models.map((model) => (
                      <span
                        key={model}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-100 text-[11px] font-mono text-black/60"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                  <div className="text-[11px] text-[#bbbbbb]">
                    Replaces: <span className="font-mono">{provider.replaces}</span>
                  </div>
                  <BorderBeam
                    size={180}
                    duration={16}
                    borderWidth={1}
                    colorFrom="#00000005"
                    colorTo="#00000020"
                    delay={i * 1.5}
                  />
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
