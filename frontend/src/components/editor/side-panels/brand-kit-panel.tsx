"use client";

import { Palette, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function BrandKitPanel() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Brand Kit</h3>

      {/* Colors */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Palette className="h-3.5 w-3.5" /> Colors
        </span>
        <div className="flex gap-2">
          {[
            { label: "Primary", color: "#6366f1" },
            { label: "Secondary", color: "#8b5cf6" },
            { label: "Accent", color: "#f59e0b" },
            { label: "Caption", color: "#10b981" },
          ].map((c) => (
            <div key={c.label} className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-8 rounded-full border-2 border-border cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: c.color }}
              />
              <span className="text-[9px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Type className="h-3.5 w-3.5" /> Fonts
        </span>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-lg border border-border/50 p-2">
            <span className="text-xs text-foreground font-bold">Outfit</span>
            <Badge variant="outline" className="text-[9px]">Heading</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 p-2">
            <span className="text-xs text-foreground">Inter</span>
            <Badge variant="outline" className="text-[9px]">Body</Badge>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Overlays</span>
        <div className="space-y-1.5">
          <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
            Add Logo Watermark
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
            Add Intro Template
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
            Add Outro Template
          </Button>
        </div>
      </div>
    </div>
  );
}
