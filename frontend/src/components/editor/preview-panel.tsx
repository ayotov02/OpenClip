"use client";

import { Play, Pause, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/helpers";
import type { AspectRatio, CaptionSegment } from "@/lib/editor-types";

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
];

function getAspectClass(ratio: AspectRatio) {
  switch (ratio) {
    case "9:16": return "aspect-[9/16] max-h-[400px]";
    case "16:9": return "aspect-video";
    case "1:1": return "aspect-square max-h-[400px]";
    case "4:5": return "aspect-[4/5] max-h-[400px]";
  }
}

interface PreviewPanelProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  aspectRatio: AspectRatio;
  captions: CaptionSegment[];
  onTogglePlay: () => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onSeek: (time: number) => void;
}

export function PreviewPanel({
  currentTime, duration, isPlaying, aspectRatio, captions,
  onTogglePlay, onAspectRatioChange, onSeek,
}: PreviewPanelProps) {
  const activeCaption = captions.find(
    (c) => currentTime >= c.startTime && currentTime < c.endTime
  );

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Aspect Ratio Selector */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
        <div className="flex items-center gap-1">
          {ASPECT_RATIOS.map((ar) => (
            <Button
              key={ar.value}
              variant={aspectRatio === ar.value ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => onAspectRatioChange(ar.value)}
            >
              {ar.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Video Preview */}
      <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden">
        <div className={`relative ${getAspectClass(aspectRatio)} w-full bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center`}>
          {/* Play button */}
          <button
            onClick={onTogglePlay}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-0.5" />
            )}
          </button>

          {/* Caption overlay */}
          {activeCaption && (
            <div className="absolute bottom-8 left-4 right-4 text-center">
              <span className="inline-block rounded bg-black/70 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                {activeCaption.text}
              </span>
            </div>
          )}

          {/* Time display */}
          <div className="absolute bottom-2 right-2">
            <Badge variant="outline" className="bg-black/50 backdrop-blur-sm text-[10px] text-white border-white/20">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <div
        className="relative h-2 w-full cursor-pointer rounded-full bg-muted"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = x / rect.width;
          onSeek(Math.round(percent * duration));
        }}
      >
        <div
          className="absolute h-full rounded-full bg-primary transition-all"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background shadow"
          style={{ left: `${progressPercent}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>
    </div>
  );
}
