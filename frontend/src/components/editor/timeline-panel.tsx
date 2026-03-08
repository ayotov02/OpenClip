"use client";

import { Grip, Scissors, Volume2, Type, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EditorTrack } from "@/lib/editor-types";

const TRACK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Layers,
  audio: Volume2,
  caption: Type,
  overlay: Grip,
};

const TRACK_COLORS: Record<string, string> = {
  video: "bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-400",
  audio: "bg-emerald-500/20 border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  caption: "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-400",
  overlay: "bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-400",
};

interface TimelinePanelProps {
  tracks: EditorTrack[];
  currentTime: number;
  duration: number;
  selectedItemId: string | null;
  onItemSelect: (id: string | null) => void;
  onSeek: (time: number) => void;
}

export function TimelinePanel({
  tracks, currentTime, duration, selectedItemId,
  onItemSelect, onSeek,
}: TimelinePanelProps) {
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Timeline header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Timeline</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            <Scissors className="mr-1 h-3 w-3" />
            Split
          </Badge>
        </div>
      </div>

      {/* Time ruler */}
      <div
        className="relative h-6 border-b border-border bg-muted/30 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          onSeek(Math.round(percent * duration));
        }}
      >
        <div className="flex h-full items-end px-24">
          {Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => (
            <div
              key={i}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `calc(96px + ${(i * 5 / duration) * 100}% * (1 - 96px / 100%))` }}
            >
              <span className="text-[8px] text-muted-foreground">{i * 5}s</span>
              <div className="h-2 w-px bg-border" />
            </div>
          ))}
        </div>
        {/* Playhead on ruler */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `calc(96px + ${playheadPercent}% * (1 - 96px / 100%))` }}
        />
      </div>

      {/* Tracks */}
      <div className="relative">
        {tracks.map((track) => {
          const Icon = TRACK_ICONS[track.type] || Layers;
          return (
            <div key={track.id} className="flex border-b border-border last:border-0">
              {/* Track label */}
              <div className="flex w-24 shrink-0 items-center gap-2 border-r border-border px-3 py-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">{track.label}</span>
              </div>

              {/* Track items */}
              <div className="relative flex-1 h-10 overflow-hidden">
                {track.items.map((item) => {
                  const leftPercent = (item.startTime / duration) * 100;
                  const widthPercent = ((item.endTime - item.startTime) / duration) * 100;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "absolute top-1 bottom-1 rounded border cursor-pointer transition-all text-[9px] flex items-center px-1.5 truncate",
                        TRACK_COLORS[track.type],
                        selectedItemId === item.id && "ring-2 ring-primary ring-offset-1",
                      )}
                      style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                      onClick={() => onItemSelect(selectedItemId === item.id ? null : item.id)}
                    >
                      {item.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Playhead line across tracks */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
          style={{ left: `calc(96px + ${playheadPercent}% * (1 - 96px / 100%))` }}
        />
      </div>
    </div>
  );
}
