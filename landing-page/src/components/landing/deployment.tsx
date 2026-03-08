"use client";

import { Server, Cloud, Check } from "lucide-react";
import { SplitText } from "@/components/effects/split-text";
import { ScrollReveal } from "@/components/effects/scroll-reveal";
import Tilt from "react-parallax-tilt";

const DEPLOYMENT_OPTIONS = [
  {
    title: "Self-Hosted (Free)",
    icon: Server,
    command: "docker compose up -d",
    description: "Full control, your hardware, zero cost.",
    points: [
      "GPU required (RTX 3060+)",
      "Unlimited processing — no quotas",
      "Complete data sovereignty",
      "All 48+ features included",
    ],
    accent: "indigo",
  },
  {
    title: "Premium Cloud",
    icon: Cloud,
    command: null,
    description: "API-powered, no GPU needed.",
    points: [
      "$5/mo VPS is all you need",
      "OpenRouter + Kie.ai APIs",
      "Zero maintenance or updates",
      "Same features, cloud-powered",
    ],
    accent: "cyan",
  },
];

export function Deployment() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SplitText
            text="Deploy Your Way"
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-[var(--font-inter-tight)]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DEPLOYMENT_OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const isIndigo = option.accent === "indigo";

            return (
              <ScrollReveal
                key={option.title}
                direction={index === 0 ? "left" : "right"}
                delay={index * 0.15}
              >
                <Tilt
                  tiltMaxAngleX={6}
                  tiltMaxAngleY={6}
                  glareEnable
                  glareMaxOpacity={0.08}
                  glarePosition="all"
                >
                  <div className="glass rounded-2xl p-8 h-full hover:border-white/15 transition-colors duration-300">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${
                        isIndigo ? "bg-indigo-500/10" : "bg-cyan-500/10"
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${
                          isIndigo ? "text-indigo-400" : "text-cyan-400"
                        }`}
                      />
                    </div>

                    <h3 className="text-xl font-bold text-white font-[var(--font-inter-tight)]">
                      {option.title}
                    </h3>

                    {option.command && (
                      <div className="mt-4 rounded-lg bg-black/40 px-4 py-3 font-mono text-sm text-indigo-300">
                        $ {option.command}
                      </div>
                    )}

                    <p className="mt-4 text-sm text-zinc-400">
                      {option.description}
                    </p>

                    <ul className="mt-6 space-y-3">
                      {option.points.map((point) => (
                        <li key={point} className="flex items-center gap-3">
                          <Check
                            className={`h-4 w-4 flex-shrink-0 ${
                              isIndigo ? "text-indigo-400" : "text-cyan-400"
                            }`}
                          />
                          <span className="text-sm text-zinc-300">
                            {point}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Tilt>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
