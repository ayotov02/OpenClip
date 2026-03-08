"use client";

import { Check, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/effects/scroll-reveal";
import { FEATURES } from "@/lib/constants";

export function Features() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          const isEven = index % 2 === 0;

          return (
            <div
              key={feature.title}
              className={`flex flex-col gap-12 items-center ${
                isEven ? "lg:flex-row" : "lg:flex-row-reverse"
              }`}
            >
              {/* Image */}
              <ScrollReveal
                direction={isEven ? "left" : "right"}
                className="w-full lg:w-1/2"
              >
                {feature.isCodeBlock ? (
                  <div className="rounded-2xl glass p-6 overflow-hidden">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                      <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    </div>
                    <pre className="text-sm text-zinc-300 overflow-x-auto font-[var(--font-jetbrains)]">
                      <code>{feature.codeSnippet}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="aspect-video rounded-2xl bg-gradient-to-br from-indigo-500/10 to-cyan-400/10 border border-white/10 flex items-center justify-center glass">
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 mx-auto text-white/20" />
                      <p className="mt-3 text-sm text-white/40">
                        Replace with: {feature.imageLabel}
                      </p>
                      <p className="text-xs text-white/20 mt-1">
                        {feature.imageDimensions}
                      </p>
                    </div>
                  </div>
                )}
              </ScrollReveal>

              {/* Text */}
              <ScrollReveal
                direction={isEven ? "right" : "left"}
                delay={0.15}
                className="w-full lg:w-1/2"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-indigo-400" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    >
                      {feature.badge}
                    </Badge>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-bold text-white font-[var(--font-inter-tight)]">
                    {feature.title}
                  </h3>

                  <p className="mt-4 text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center">
                          <Check className="h-3 w-3 text-indigo-400" />
                        </div>
                        <span className="text-sm text-zinc-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}
