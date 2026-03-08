"use client";

import { Type, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/helpers";
import type { CaptionSegment } from "@/lib/editor-types";

interface CaptionsPanelProps {
  captions: CaptionSegment[];
  currentTime: number;
  onCaptionUpdate: (id: string, text: string) => void;
  onSeek: (time: number) => void;
}

export function CaptionsPanel({ captions, currentTime, onCaptionUpdate, onSeek }: CaptionsPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Type className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Captions</h3>
        <Badge variant="outline" className="ml-auto text-[10px]">{captions.length}</Badge>
      </div>

      <div className="space-y-2">
        {captions.map((caption) => {
          const isActive = currentTime >= caption.startTime && currentTime < caption.endTime;
          return (
            <div
              key={caption.id}
              className={`rounded-lg border p-2 space-y-1.5 transition-colors cursor-pointer ${
                isActive ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
              }`}
              onClick={() => onSeek(caption.startTime)}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDuration(caption.startTime)} - {formatDuration(caption.endTime)}
                </span>
                {caption.speaker && (
                  <Badge variant="outline" className="text-[9px]">{caption.speaker}</Badge>
                )}
              </div>
              <Input
                value={caption.text}
                onChange={(e) => onCaptionUpdate(caption.id, e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
