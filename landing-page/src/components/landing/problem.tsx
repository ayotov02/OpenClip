"use client";

import { SplitText } from "@/components/effects/split-text";
import { StaggerContainer, StaggerItem } from "@/components/effects/scroll-reveal";
import { PAIN_POINTS } from "@/lib/constants";

export function Problem() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SplitText
            text="Creators Are Getting Ripped Off"
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-[var(--font-inter-tight)]"
          />
          <p className="mt-4 text-lg text-zinc-500 max-w-2xl mx-auto">
            The current landscape of AI video tools is broken. Here&apos;s why.
          </p>
        </div>

        <StaggerContainer
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          stagger={0.1}
        >
          {PAIN_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <StaggerItem key={point.title}>
                <div className="group relative rounded-2xl p-6 glass hover:border-red-500/30 transition-colors duration-300">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-base">
                        {point.title}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
