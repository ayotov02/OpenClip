"use client";

import ScrollReveal from "@/components/ScrollReveal";
import { ABOUT_TEXT } from "@/lib/constants";

export function About() {
  return (
    <section id="about" className="py-32 md:py-40 px-6">
      <div className="mx-auto max-w-[1000px]">
        <ScrollReveal
          baseOpacity={0.1}
          enableBlur={true}
          baseRotation={2}
          blurStrength={6}
          containerClassName=""
          textClassName="!text-[clamp(1.8rem,4.5vw,3.2rem)] !font-bold !leading-[1.35] tracking-tight text-black"
        >
          {ABOUT_TEXT}
        </ScrollReveal>
      </div>
    </section>
  );
}
