"use client";

import { ImageIcon } from "lucide-react";
import { FadeIn } from "@/components/effects/fade-in";
import { BorderBeam } from "@/components/ui/border-beam";
import { FEATURES } from "@/lib/constants";

export function Features() {
  return (
    <section id="features" className="py-32 md:py-40 px-6">
      <div className="mx-auto max-w-6xl space-y-24 md:space-y-32">
        {FEATURES.map((feature, index) => {
          const isReversed = index % 2 === 1;
          return (
            <div
              key={feature.title}
              className={`flex flex-col gap-8 md:gap-16 items-center ${
                isReversed ? "md:flex-row-reverse" : "md:flex-row"
              }`}
            >
              {/* Text */}
              <FadeIn
                direction={isReversed ? "right" : "left"}
                className="md:w-[40%] space-y-4"
              >
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-[#666666] text-base md:text-lg leading-relaxed">
                  {feature.description}
                </p>
              </FadeIn>

              {/* Placeholder image with BorderBeam */}
              <FadeIn
                direction={isReversed ? "left" : "right"}
                delay={0.15}
                className="md:w-[55%]"
              >
                <div className="relative aspect-video rounded-2xl bg-neutral-50 border border-black/5 flex items-center justify-center overflow-hidden">
                  <div className="text-center">
                    <ImageIcon className="h-10 w-10 mx-auto text-black/10" />
                    <p className="mt-2 text-sm text-black/20">
                      Screenshot: {feature.placeholder}
                    </p>
                  </div>
                  <BorderBeam
                    size={250}
                    duration={12}
                    borderWidth={1.5}
                    colorFrom="#00000010"
                    colorTo="#00000040"
                    delay={index * 2}
                  />
                </div>
              </FadeIn>
            </div>
          );
        })}
      </div>
    </section>
  );
}
