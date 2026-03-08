"use client";

import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlowCard({ children, className }: GlowCardProps) {
  return (
    <div className={cn("relative rounded-2xl p-[1px] group", className)}>
      <div className="absolute inset-0 rounded-2xl glow-card opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      <div className="absolute inset-0 rounded-2xl glow-card opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
      <div className="relative rounded-2xl bg-[#111113] h-full">
        {children}
      </div>
    </div>
  );
}
