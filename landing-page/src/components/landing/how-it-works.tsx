"use client";

import { SplitText } from "@/components/effects/split-text";
import { StaggerContainer, StaggerItem } from "@/components/effects/scroll-reveal";
import { STEPS } from "@/lib/constants";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 sm:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SplitText
            text="Three Steps to Viral Content"
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-[var(--font-inter-tight)]"
          />
        </div>

        <StaggerContainer
          className="relative grid grid-cols-1 md:grid-cols-3 gap-8"
          stagger={0.3}
        >
          {/* Connecting lines (desktop only) */}
          <svg
            className="absolute top-12 left-0 w-full h-1 hidden md:block pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <line
              x1="20%"
              y1="50%"
              x2="48%"
              y2="50%"
              stroke="rgba(99,102,241,0.3)"
              strokeWidth="2"
              strokeDasharray="6,6"
              className="animate-dash"
            />
            <line
              x1="52%"
              y1="50%"
              x2="80%"
              y2="50%"
              stroke="rgba(99,102,241,0.3)"
              strokeWidth="2"
              strokeDasharray="6,6"
              className="animate-dash"
            />
          </svg>

          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <StaggerItem key={step.title} className="relative z-10">
                <div className="text-center glass rounded-2xl p-8 hover:border-indigo-500/20 transition-colors duration-300">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-6">
                    <Icon className="h-7 w-7 text-indigo-400" />
                  </div>
                  <div className="text-sm font-mono text-indigo-400 mb-2">
                    0{index + 1}
                  </div>
                  <h3 className="text-xl font-bold text-white font-[var(--font-inter-tight)]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
