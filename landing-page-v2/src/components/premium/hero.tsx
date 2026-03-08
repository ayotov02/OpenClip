"use client";

import Link from "next/link";
import { ArrowLeft, Cloud } from "lucide-react";
import { FadeIn } from "@/components/effects/fade-in";
import StarBorder from "@/components/effects/star-border";
import { GITHUB_URL } from "@/lib/constants";

export function PremiumHero() {
  return (
    <section className="pt-32 pb-24 md:pt-40 md:pb-32 px-6">
      <div className="mx-auto max-w-4xl">
        <FadeIn>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#999999] hover:text-black transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-[#999999] uppercase tracking-wider">
              Premium Backend
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold tracking-tight leading-[1.1] mb-6">
            Best-in-class AI providers.
            <br />
            No GPU required.
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-lg md:text-xl text-[#666666] max-w-2xl leading-relaxed mb-10">
            The premium backend is the same self-hosted Docker setup — but instead of running AI models
            locally on a GPU, it routes through premium API providers. OpenRouter for LLMs, Kie.ai
            for video and image generation, Bright Data for scraping, ElevenLabs for voice.
            Same features, same codebase, same interface — different engines under the hood.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <StarBorder
            color="white"
            speed="5s"
            thickness={1}
            className="cursor-pointer"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Started
          </StarBorder>
        </FadeIn>
      </div>
    </section>
  );
}
