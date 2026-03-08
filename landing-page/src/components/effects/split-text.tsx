"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface SplitTextProps {
  text: string;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export function SplitText({
  text,
  className,
  stagger = 0.04,
  delay = 0,
  as: Tag = "h2",
}: SplitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chars = containerRef.current.querySelectorAll(".split-char");

    gsap.set(chars, { opacity: 0, y: 40 });

    gsap.to(chars, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      stagger,
      delay,
      ease: "power4.out",
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 85%",
        once: true,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [text, stagger, delay]);

  const words = text.split(" ");

  return (
    <div ref={containerRef} className="overflow-hidden">
      <Tag className={cn(className)}>
        {words.map((word, wi) => (
          <span key={wi} className="inline-block whitespace-nowrap">
            {word.split("").map((char, ci) => (
              <span
                key={`${wi}-${ci}`}
                className="split-char inline-block"
                style={{ opacity: 0 }}
              >
                {char}
              </span>
            ))}
            {wi < words.length - 1 && (
              <span className="inline-block">&nbsp;</span>
            )}
          </span>
        ))}
      </Tag>
    </div>
  );
}
