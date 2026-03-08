"use client";

import dynamic from "next/dynamic";
import StarBorder from "@/components/effects/star-border";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { FadeIn } from "@/components/effects/fade-in";
import { GITHUB_URL } from "@/lib/constants";

const Antigravity = dynamic(
  () => import("@/components/effects/antigravity"),
  { ssr: false }
);

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6">
      {/* Antigravity particle background */}
      <div className="absolute inset-0 pointer-events-auto">
        <Antigravity
          count={250}
          magnetRadius={6}
          ringRadius={7}
          waveSpeed={0.4}
          waveAmplitude={1}
          particleSize={1.5}
          lerpSpeed={0.05}
          color="#000000"
          autoAnimate
          particleVariance={1}
          rotationSpeed={0}
          depthFactor={1}
          pulseSpeed={3}
          particleShape="capsule"
          fieldStrength={10}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center pointer-events-none">
        <FadeIn>
          <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-bold tracking-tight leading-[1.1]">
            The open-source
            <br />
            video platform.
          </h1>
        </FadeIn>

        <FadeIn delay={0.15}>
          <p className="mt-6 text-lg md:text-xl text-[#666666] max-w-xl mx-auto">
            Free forever. No watermarks, Self-hosted.
          </p>
        </FadeIn>

        <FadeIn delay={0.25}>
          <div className="mt-3">
            <FlipFadeText
              words={["ZERO AI COSTS", "YOUR DATA", "OPEN SOURCE", "NO WATERMARKS", "SELF HOSTED"]}
              interval={2800}
              letterDuration={0.5}
              staggerDelay={0.06}
              exitStaggerDelay={0.03}
            />
          </div>
        </FadeIn>

        <FadeIn delay={0.4}>
          <div className="mt-10 flex items-center justify-center gap-4 pointer-events-auto">
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
            <InteractiveHoverButton href="#about">
              Learn more
            </InteractiveHoverButton>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
