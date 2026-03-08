"use client";

import { FadeIn } from "@/components/effects/fade-in";

const ARCH_POINTS = [
  {
    title: "Provider ABC Pattern",
    description:
      "Every AI capability (LLM, STT, TTS, ImageGen, VideoGen, Music, Scraping, Upscaling) has an abstract base class. Local and premium backends implement the same interface — swap one for the other with zero code changes.",
  },
  {
    title: "BrandContext Injection",
    description:
      "Your brand voice, tone, audience, and style are injected into every AI call. Whether it's OpenRouter or Ollama handling the request, your brand identity stays consistent across scripts, captions, and analysis.",
  },
  {
    title: "Automatic Fallback Chains",
    description:
      "OpenRouter routes to Claude 4.5 first. If it's slow or unavailable, it falls back to GPT-5, then Gemini 3 automatically. On the local side, Qwen3 handles everything via Ollama.",
  },
  {
    title: "100% Shared Frontend",
    description:
      "One Next.js frontend for both backends. Switch between local and premium by changing one environment variable. The UI, features, and workflow are identical.",
  },
  {
    title: "Celery + Redis Task Queue",
    description:
      "All heavy AI operations run as async Celery tasks — video generation, transcription, scraping, publishing. Progress tracking, automatic retries, and parallel processing built in.",
  },
  {
    title: "Both Run via Docker",
    description:
      "Both backends are self-hosted via Docker Compose. Same infrastructure: FastAPI + PostgreSQL + Redis + MinIO. The only difference is which AI providers are configured.",
  },
];

export function PremiumArchitecture() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Same architecture. Different engines.
          </h2>
          <p className="text-[#666666] text-lg mb-16 max-w-2xl">
            Local and premium share the same codebase, models, schemas, services, and task queue.
            The only thing that changes is which provider handles each AI call.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ARCH_POINTS.map((point, i) => (
            <FadeIn key={point.title} delay={i * 0.08}>
              <div className="space-y-3">
                <h3 className="text-lg font-bold tracking-tight">
                  {point.title}
                </h3>
                <p className="text-sm text-[#666666] leading-relaxed">
                  {point.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
