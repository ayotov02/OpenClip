"use client";

import { Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { SplitText } from "@/components/effects/split-text";
import { ScrollReveal } from "@/components/effects/scroll-reveal";
import { COMPARISON_DATA, LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const COMPETITORS = ["openclip", "opusclip", "klap", "vidyo", "kapwing"] as const;
const COMPETITOR_LABELS: Record<string, string> = {
  openclip: "OpenClip",
  opusclip: "OpusClip",
  klap: "Klap",
  vidyo: "Vidyo",
  kapwing: "Kapwing",
};

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-5 w-5 text-emerald-400 mx-auto" />
    ) : (
      <X className="h-5 w-5 text-red-400/60 mx-auto" />
    );
  }
  return <span className="text-sm">{value}</span>;
}

export function Comparison() {
  return (
    <section id="compare" className="relative py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <SplitText
            text="See How We Compare"
            as="h2"
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight font-[var(--font-inter-tight)]"
          />
        </div>

        <ScrollReveal>
          <div className="overflow-x-auto rounded-2xl glass">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-4 text-sm font-medium text-zinc-500">
                    Feature
                  </th>
                  {COMPETITORS.map((comp) => (
                    <th
                      key={comp}
                      className={`p-4 text-sm font-medium text-center ${
                        comp === "openclip"
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {COMPETITOR_LABELS[comp]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_DATA.map((row, index) => (
                  <motion.tr
                    key={row.feature}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="p-4 text-sm text-zinc-300">
                      {row.feature}
                    </td>
                    {COMPETITORS.map((comp) => (
                      <td
                        key={comp}
                        className={`p-4 text-center ${
                          comp === "openclip" ? "bg-indigo-500/5" : ""
                        }`}
                      >
                        <CellValue
                          value={row[comp as keyof typeof row] as string | boolean}
                        />
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollReveal>

        <ScrollReveal className="text-center mt-12">
          <a
            href={LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 text-base rounded-xl"
            )}
          >
            Switch to OpenClip — It&apos;s Free
          </a>
        </ScrollReveal>
      </div>
    </section>
  );
}
