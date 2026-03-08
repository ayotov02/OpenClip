"use client";

import { FadeIn } from "@/components/effects/fade-in";
import { BorderBeam } from "@/components/ui/border-beam";
import StarBorder from "@/components/effects/star-border";
import { GITHUB_URL } from "@/lib/constants";
import { Check } from "lucide-react";

const LOCAL_FEATURES = [
  "Self-hosted via Docker Compose",
  "All AI runs on your GPU",
  "$0/month — your hardware costs only",
  "Air-gapped / fully offline capable",
  "Full data ownership",
  "Open-source AI models (Ollama, WhisperX, etc.)",
  "Community support",
];

const PREMIUM_FEATURES = [
  "Self-hosted via Docker Compose",
  "AI routed through API providers",
  "No GPU required — any machine works",
  "Pay-per-use APIs (only pay what you generate)",
  "Managed auth via Clerk",
  "Automatic model fallbacks (Claude → GPT → Gemini)",
  "Same open-source codebase",
];

export function PremiumPricing() {
  return (
    <section className="py-24 md:py-32 px-6 bg-neutral-50/50">
      <div className="mx-auto max-w-4xl">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4">
            Both are free. Both are open-source. Both are self-hosted.
          </h2>
          <p className="text-[#666666] text-lg text-center mb-16 max-w-2xl mx-auto">
            The only difference is whether AI runs on your GPU or through API providers.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Local */}
          <FadeIn direction="left">
            <div className="relative rounded-2xl border border-black/5 bg-white p-8 overflow-hidden h-full">
              <div className="mb-6">
                <h3 className="text-xl font-bold tracking-tight">Local</h3>
                <p className="text-3xl font-bold mt-2">
                  $0<span className="text-base font-normal text-[#999999]">/month</span>
                </p>
                <p className="text-sm text-[#999999] mt-1">GPU required for AI inference</p>
              </div>

              <div className="space-y-3">
                {LOCAL_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5 text-sm text-[#666666]">
                    <Check className="w-4 h-4 text-black/30 shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>

              <BorderBeam
                size={180}
                duration={12}
                borderWidth={1}
                colorFrom="#00000006"
                colorTo="#00000025"
              />
            </div>
          </FadeIn>

          {/* Premium */}
          <FadeIn direction="right" delay={0.1}>
            <div className="relative rounded-2xl border border-black/10 bg-white p-8 overflow-hidden h-full">
              <div className="mb-6">
                <h3 className="text-xl font-bold tracking-tight">Premium</h3>
                <p className="text-3xl font-bold mt-2">
                  $0<span className="text-base font-normal text-[#999999]"> + API usage</span>
                </p>
                <p className="text-sm text-[#999999] mt-1">No GPU — AI via API providers</p>
              </div>

              <div className="space-y-3">
                {PREMIUM_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5 text-sm text-[#666666]">
                    <Check className="w-4 h-4 text-black/30 shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>

              <BorderBeam
                size={180}
                duration={12}
                borderWidth={1.5}
                colorFrom="#00000008"
                colorTo="#00000035"
                delay={3}
              />
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.3}>
          <div className="flex justify-center mt-12">
            <StarBorder
              color="white"
              speed="5s"
              thickness={1}
              className="cursor-pointer"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started — It&apos;s Free
            </StarBorder>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
