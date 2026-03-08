"use client";

import { FadeIn } from "@/components/effects/fade-in";
import { BorderBeam } from "@/components/ui/border-beam";
import { STEPS } from "@/lib/constants";

export function GettingStarted() {
  return (
    <section id="faq" className="py-32 md:py-40 px-6">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16">
            Get started in three steps.
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {STEPS.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.12}>
              <div className="relative rounded-2xl border border-black/5 bg-neutral-50/50 p-8 space-y-3 overflow-hidden">
                <span className="text-4xl md:text-5xl font-bold text-black/10">
                  {step.number}
                </span>
                <h3 className="text-xl font-bold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-[#666666] leading-relaxed">
                  {step.description}
                </p>
                <BorderBeam
                  size={180}
                  duration={10}
                  borderWidth={1}
                  colorFrom="#00000008"
                  colorTo="#00000030"
                  delay={i * 3}
                />
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
