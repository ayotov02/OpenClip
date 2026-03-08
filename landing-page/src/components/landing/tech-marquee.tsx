"use client";

import Marquee from "react-fast-marquee";
import { SplitText } from "@/components/effects/split-text";
import { ScrollReveal } from "@/components/effects/scroll-reveal";
import { TECH_ROW_1, TECH_ROW_2 } from "@/lib/constants";

function TechPill({ name }: { name: string }) {
  return (
    <div className="mx-3 px-5 py-2.5 rounded-full glass text-sm font-mono text-zinc-300 whitespace-nowrap hover:border-indigo-500/30 hover:text-white transition-colors duration-200">
      {name}
    </div>
  );
}

export function TechMarquee() {
  return (
    <section id="tech-stack" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SplitText
            text="Powered By Open Source"
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-[var(--font-inter-tight)]"
          />
        </div>
      </div>

      <ScrollReveal>
        <div className="space-y-4">
          <Marquee speed={40} pauseOnHover gradient={false}>
            {TECH_ROW_1.map((tech) => (
              <TechPill key={tech} name={tech} />
            ))}
          </Marquee>

          <Marquee speed={30} pauseOnHover gradient={false} direction="right">
            {TECH_ROW_2.map((tech) => (
              <TechPill key={tech} name={tech} />
            ))}
          </Marquee>
        </div>
      </ScrollReveal>
    </section>
  );
}
