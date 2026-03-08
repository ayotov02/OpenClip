"use client";

import Link from "next/link";
import { Server, Cloud, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/effects/fade-in";
import { BorderBeam } from "@/components/ui/border-beam";
import ScrollReveal from "@/components/ScrollReveal";

const LOCAL_PROVIDERS = [
  { name: "Ollama", role: "LLM (Qwen3)" },
  { name: "WhisperX", role: "Speech-to-Text" },
  { name: "Kokoro / Chatterbox", role: "Text-to-Speech" },
  { name: "FLUX.1", role: "Image Generation" },
  { name: "Wan 2.1", role: "Video Generation" },
  { name: "MusicGen", role: "Music" },
  { name: "Real-ESRGAN", role: "Upscaling" },
  { name: "Crawlee", role: "Web Scraping" },
];

const PREMIUM_PROVIDERS = [
  { name: "OpenRouter", role: "LLM — Claude 4.5, GPT-5, Gemini 3" },
  { name: "Kie.ai", role: "Video — Runway, Veo 3.1, Kling, Sora 2" },
  { name: "Kie.ai", role: "Image — GPT Image, FLUX-2" },
  { name: "ElevenLabs", role: "Voice & TTS" },
  { name: "Suno", role: "Music Generation" },
  { name: "Bright Data", role: "Scraping — SERP, Browser, Unlocker" },
  { name: "Topaz", role: "AI Upscaling" },
  { name: "Clerk", role: "Managed Auth" },
];

export function TwoBackends() {
  return (
    <section id="backends" className="py-32 md:py-40 px-6">
      <div className="mx-auto max-w-[900px] mb-20">
        <ScrollReveal
          baseOpacity={0.1}
          enableBlur={true}
          baseRotation={1}
          blurStrength={4}
          textClassName="!text-[clamp(1.6rem,4vw,3rem)] !font-bold !leading-[1.3] tracking-tight text-black"
        >
          One platform. Two ways to run it.
        </ScrollReveal>
      </div>

      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Local Backend */}
        <FadeIn direction="left">
          <div className="relative rounded-2xl border border-black/5 bg-white p-8 md:p-10 space-y-6 overflow-hidden h-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                <Server className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Local Backend</h3>
                <p className="text-sm text-[#999999]">Open-source models, GPU-powered</p>
              </div>
            </div>

            <p className="text-[#666666] leading-relaxed">
              Every AI model runs on your machine. Zero API calls, zero external dependencies, zero data
              leaving your network. Requires a GPU for inference.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#999999] uppercase tracking-wider">Providers</p>
              <div className="space-y-1.5">
                {LOCAL_PROVIDERS.map((p) => (
                  <div key={p.name + p.role} className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-medium text-black/80 shrink-0">{p.name}</span>
                    <span className="text-black/20">—</span>
                    <span className="text-[#999999]">{p.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-2 text-sm text-[#666666]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
                Docker Compose — self-hosted, up in 5 minutes
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
                $0/month — your hardware, your data, your rules
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
                Air-gapped capable — works fully offline
              </div>
            </div>

            <BorderBeam
              size={200}
              duration={14}
              borderWidth={1.5}
              colorFrom="#00000008"
              colorTo="#00000030"
            />
          </div>
        </FadeIn>

        {/* Premium Backend */}
        <FadeIn direction="right" delay={0.1}>
          <div className="relative rounded-2xl border border-black/5 bg-neutral-50 p-8 md:p-10 space-y-6 overflow-hidden h-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Premium Backend</h3>
                <p className="text-sm text-[#999999]">API providers, no GPU needed</p>
              </div>
            </div>

            <p className="text-[#666666] leading-relaxed">
              Same self-hosted Docker setup, but AI is routed through premium API providers instead of
              local models. No GPU, no VRAM limits, no model downloads. Best-in-class results.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#999999] uppercase tracking-wider">Providers</p>
              <div className="space-y-1.5">
                {PREMIUM_PROVIDERS.map((p, i) => (
                  <div key={p.name + p.role + i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-medium text-black/80 shrink-0">{p.name}</span>
                    <span className="text-black/20">—</span>
                    <span className="text-[#999999]">{p.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-2 text-sm text-[#666666]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
                Docker Compose — same self-hosted setup, no GPU
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
                Pay-per-use APIs — only pay for what you generate
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
                Automatic fallback chains across providers
              </div>
            </div>

            <Link
              href="/premium"
              className="inline-flex items-center gap-2 text-sm font-medium text-black hover:underline pt-2"
            >
              Learn more about Premium providers
              <ArrowRight className="w-4 h-4" />
            </Link>

            <BorderBeam
              size={200}
              duration={14}
              borderWidth={1.5}
              colorFrom="#00000008"
              colorTo="#00000030"
              delay={4}
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
