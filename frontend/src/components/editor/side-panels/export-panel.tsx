"use client";

import { Download, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PLATFORM_PRESETS = [
  { id: "youtube-shorts", label: "YouTube Shorts", ratio: "9:16", quality: "1080p" },
  { id: "youtube", label: "YouTube", ratio: "16:9", quality: "1080p" },
  { id: "tiktok", label: "TikTok", ratio: "9:16", quality: "1080p" },
  { id: "instagram-reel", label: "Instagram Reel", ratio: "9:16", quality: "1080p" },
  { id: "instagram-post", label: "Instagram Post", ratio: "1:1", quality: "1080p" },
  { id: "twitter", label: "X / Twitter", ratio: "16:9", quality: "720p" },
];

const QUALITY_OPTIONS = [
  { value: "draft", label: "Draft", description: "Fast preview, lower quality" },
  { value: "hd", label: "HD 1080p", description: "Standard quality export" },
  { value: "4k", label: "4K UHD", description: "Maximum quality, slower render" },
];

export function ExportPanel() {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Download className="h-4 w-4" />
        Export
      </h3>

      {/* Platform Presets */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Platform Preset</span>
        <div className="grid grid-cols-2 gap-1.5">
          {PLATFORM_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="rounded-lg border border-border/50 p-2 cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-all"
            >
              <p className="text-xs font-medium text-foreground">{preset.label}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge variant="outline" className="text-[8px]">{preset.ratio}</Badge>
                <Badge variant="outline" className="text-[8px]">{preset.quality}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Quality</span>
        <div className="space-y-1.5">
          {QUALITY_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className="flex items-center justify-between rounded-lg border border-border/50 p-2 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-foreground">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground">{opt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-border/50 p-2">
          <span className="text-xs text-foreground">Include Subtitles</span>
          <Badge variant="outline" className="text-[9px]">SRT</Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/50 p-2">
          <span className="text-xs text-foreground">Format</span>
          <Badge variant="outline" className="text-[9px]">MP4</Badge>
        </div>
      </div>

      <Button className="w-full gap-1.5">
        <Download className="h-4 w-4" />
        Export Video
      </Button>
    </div>
  );
}
