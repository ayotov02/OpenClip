"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  target?: string;
  rel?: string;
}

export function InteractiveHoverButton({
  children,
  className,
  href,
  target,
  rel,
}: InteractiveHoverButtonProps) {
  const Tag = href ? "a" : "button";

  return (
    <Tag
      className={cn(
        "group relative w-auto cursor-pointer overflow-hidden rounded-full border border-black/10 bg-white p-3 px-8 text-center font-semibold text-base",
        className
      )}
      {...(href ? { href, target, rel } : {})}
    >
      <div className="flex items-center gap-2">
        <div className="bg-black h-2 w-2 rounded-full transition-all duration-300 group-hover:scale-[100.8]" />
        <span className="inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
          {children}
        </span>
      </div>
      <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-white opacity-0 transition-all duration-300 group-hover:-translate-x-5 group-hover:opacity-100">
        <span>{children}</span>
        <ArrowRight className="h-4 w-4" />
      </div>
    </Tag>
  );
}
