"use client";

import { cn } from "@/lib/utils";

function getScoreVariant(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 60) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
}

export function ScoreBadge({
  score,
  label,
  size = "md",
}: {
  score: number | null | undefined;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  if (score == null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={cn(
          "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-xs",
        )}>
          --
        </div>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    );
  }

  const rounded = Math.round(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "flex items-center justify-center rounded-full font-bold",
        getScoreVariant(rounded),
        size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-xs",
      )}>
        {rounded}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function ScoreBar({
  score,
  label,
}: {
  score: number | null | undefined;
  label: string;
}) {
  const rounded = score != null ? Math.round(score) : 0;
  const color = score != null
    ? score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-orange-500"
    : "bg-muted";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score != null ? rounded : "--"}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${rounded}%` }}
        />
      </div>
    </div>
  );
}
