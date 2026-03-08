"use client";

import ScrollReveal from "@/components/ScrollReveal";
import { TECH_ROW_1, TECH_ROW_2 } from "@/lib/constants";

function TechPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-5 py-2.5 rounded-full bg-white border border-black/5 text-sm font-mono text-black whitespace-nowrap shrink-0">
      {name}
    </span>
  );
}

function MarqueeRow({
  items,
  direction = "left",
  duration = 25,
}: {
  items: readonly string[];
  direction?: "left" | "right";
  duration?: number;
}) {
  // Duplicate items 4x for seamless loop
  const allItems = [...items, ...items, ...items, ...items];

  return (
    <div className="overflow-hidden w-full">
      <div
        className="flex gap-3 w-fit"
        style={{
          animation: `marquee-${direction} ${duration}s linear infinite`,
        }}
      >
        {allItems.map((tech, i) => (
          <TechPill key={`${tech}-${i}`} name={tech} />
        ))}
      </div>
    </div>
  );
}

export function TechMarquee() {
  return (
    <section id="stack" className="py-32 md:py-40">
      <div className="mx-auto max-w-[900px] mb-16 px-6">
        <ScrollReveal
          baseOpacity={0.1}
          enableBlur={true}
          baseRotation={1}
          blurStrength={4}
          textClassName="!text-[clamp(1.6rem,4vw,3rem)] !font-bold !leading-[1.3] tracking-tight text-black"
        >
          Built on open source.
        </ScrollReveal>
      </div>

      <div className="space-y-4">
        <MarqueeRow items={TECH_ROW_1} direction="left" duration={30} />
        <MarqueeRow items={TECH_ROW_2} direction="right" duration={35} />
      </div>
    </section>
  );
}
