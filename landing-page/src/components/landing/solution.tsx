"use client";

import { ImageIcon } from "lucide-react";
import { GlowCard } from "@/components/effects/glow-card";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/effects/scroll-reveal";
import { SplitText } from "@/components/effects/split-text";
import { BENTO_ITEMS } from "@/lib/constants";
import Tilt from "react-parallax-tilt";

export function Solution() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SplitText
            text="Meet OpenClip"
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent font-[var(--font-inter-tight)]"
          />
          <ScrollReveal delay={0.3}>
            <p className="mt-4 text-lg text-zinc-500 max-w-2xl mx-auto">
              Everything you need to create, analyze, and publish viral
              content — completely free.
            </p>
          </ScrollReveal>
        </div>

        <StaggerContainer
          className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]"
          stagger={0.08}
        >
          {BENTO_ITEMS.map((item) => {
            const Icon = item.icon;
            const isLarge = item.colSpan === 2 && item.rowSpan === 2;
            const isMedium = item.colSpan === 2 && item.rowSpan === 1;

            const content = (
              <div className="p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {item.hasImage && (
                  <div className="mt-4 aspect-video rounded-xl bg-gradient-to-br from-indigo-500/5 to-cyan-400/5 border border-white/5 flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 mx-auto text-white/15" />
                      <p className="mt-2 text-xs text-white/30">
                        {item.imageLabel}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );

            return (
              <StaggerItem
                key={item.title}
                className={`
                  ${item.colSpan === 2 ? "md:col-span-2" : "md:col-span-1"}
                  ${item.rowSpan === 2 ? "md:row-span-2" : "md:row-span-1"}
                `}
              >
                {isLarge ? (
                  <Tilt
                    tiltMaxAngleX={8}
                    tiltMaxAngleY={8}
                    glareEnable
                    glareMaxOpacity={0.1}
                    glarePosition="all"
                    className="h-full"
                  >
                    <GlowCard className="h-full">{content}</GlowCard>
                  </Tilt>
                ) : isMedium ? (
                  <GlowCard className="h-full">{content}</GlowCard>
                ) : (
                  <div className="rounded-2xl glass h-full hover:border-white/15 transition-colors duration-300">
                    {content}
                  </div>
                )}
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
