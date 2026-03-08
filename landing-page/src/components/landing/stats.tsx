"use client";

import { useRef, useState, useEffect } from "react";
import CountUp from "react-countup";
import { useInView } from "framer-motion";
import { ScrollReveal } from "@/components/effects/scroll-reveal";
import { STATS } from "@/lib/constants";

function StatCounter({ stat }: { stat: (typeof STATS)[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (isInView) setStarted(true);
  }, [isInView]);

  return (
    <div ref={ref} className="text-center">
      <p
        className={`text-4xl sm:text-5xl font-bold font-[var(--font-inter-tight)] ${
          stat.color || "text-white"
        }`}
      >
        {started ? (
          <CountUp
            start={0}
            end={stat.value}
            duration={2.5}
            prefix={stat.prefix || ""}
            suffix={stat.suffix || ""}
            decimals={stat.value % 1 !== 0 ? 1 : 0}
          />
        ) : (
          <span>
            {stat.prefix || ""}0{stat.suffix || ""}
          </span>
        )}
      </p>
      <p className="mt-2 text-sm text-zinc-500">{stat.label}</p>
    </div>
  );
}

export function Stats() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat) => (
              <StatCounter key={stat.label} stat={stat} />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
