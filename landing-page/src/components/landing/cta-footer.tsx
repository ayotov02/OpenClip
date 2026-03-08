"use client";

import { ArrowRight, Github } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { SplitText } from "@/components/effects/split-text";
import { ScrollReveal } from "@/components/effects/scroll-reveal";
import { LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Compare", href: "#compare" },
    { label: "Tech Stack", href: "#tech-stack" },
  ],
  Resources: [
    { label: "Documentation", href: LINKS.docs },
    { label: "API Reference", href: LINKS.docs },
    { label: "Changelog", href: LINKS.github },
    { label: "Roadmap", href: LINKS.github },
  ],
  Community: [
    { label: "GitHub", href: LINKS.github },
    { label: "Discord", href: "#" },
    { label: "Twitter", href: "#" },
    { label: "Contributing", href: LINKS.github },
  ],
  Legal: [
    { label: "MIT License", href: LINKS.github },
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
  ],
};

export function CTAFooter() {
  return (
    <>
      {/* CTA Block */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <GradientMesh />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <SplitText
            text="Ready to Create?"
            as="h2"
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent font-[var(--font-inter-tight)]"
          />
          <ScrollReveal delay={0.3}>
            <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto">
              Join the open-source video revolution. No credit card. No catch.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.5}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 text-base animate-pulse-glow rounded-xl flex items-center gap-2"
                )}
              >
                <Github className="h-5 w-5" />
                Get Started on GitHub
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={LINKS.docs}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 px-8 py-6 text-base rounded-xl"
                )}
              >
                Read the Docs
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-16">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {Object.entries(FOOTER_LINKS).map(([category, links]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold text-white mb-4">
                    {category}
                  </h4>
                  <ul className="space-y-2.5">
                    {links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
                          {...(link.href.startsWith("http")
                            ? {
                                target: "_blank",
                                rel: "noopener noreferrer",
                              }
                            : {})}
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-[var(--font-inter-tight)]">
                  Open<span className="text-indigo-500">Clip</span>
                </span>
                <span className="w-1 h-1 rounded-full bg-indigo-500" />
              </div>
              <p className="text-xs text-zinc-600">
                Built with love. Open source forever.
              </p>
              <a
                href={LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                Star on GitHub
              </a>
            </div>
          </div>
        </ScrollReveal>
      </footer>
    </>
  );
}
