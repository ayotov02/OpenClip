"use client";

import { FadeIn } from "@/components/effects/fade-in";
import { BorderBeam } from "@/components/ui/border-beam";
import { CAPABILITIES } from "@/lib/constants";

export function Capabilities() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="mx-auto max-w-4xl">
        <FadeIn>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {CAPABILITIES.map(({ icon: Icon, label }, i) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="relative w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden group hover:bg-neutral-200 transition-colors duration-300">
                  <Icon className="h-5 w-5 text-black/40 group-hover:text-black/70 transition-colors duration-300" />
                  <BorderBeam
                    size={60}
                    duration={8}
                    borderWidth={1}
                    colorFrom="#00000008"
                    colorTo="#00000025"
                    delay={i * 0.5}
                  />
                </div>
                <span className="text-xs text-[#999999]">{label}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
