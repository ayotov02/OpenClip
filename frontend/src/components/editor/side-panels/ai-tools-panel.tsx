"use client";

import { Sparkles, Type, Crop, Scissors, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const AI_TOOLS = [
  {
    id: "auto-caption",
    icon: Type,
    label: "Auto-Caption",
    description: "Generate word-level captions from audio",
    endpoint: "/api/v1/clips/{id}/captions",
  },
  {
    id: "auto-reframe",
    icon: Crop,
    label: "Auto-Reframe",
    description: "Smart crop with face tracking for any aspect ratio",
    endpoint: "/api/v1/clips/{id}/reframe",
  },
  {
    id: "filler-removal",
    icon: Scissors,
    label: "Filler Removal",
    description: "Detect and remove ums, uhs, and silence gaps",
    endpoint: "/api/v1/clips/{id}/remove-fillers",
  },
  {
    id: "ai-suggestions",
    icon: Wand2,
    label: "Edit Suggestions",
    description: "AI-powered hook improvements and pacing tips",
    endpoint: "/api/v1/clips/{id}/suggestions",
  },
];

export function AIToolsPanel() {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Sparkles className="h-4 w-4" />
        AI Tools
      </h3>

      <div className="space-y-2">
        {AI_TOOLS.map((tool) => (
          <Card key={tool.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <tool.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-foreground">{tool.label}</p>
                  <p className="text-[10px] text-muted-foreground">{tool.description}</p>
                </div>
              </div>
              <Button size="sm" className="mt-2 w-full gap-1 text-xs h-7">
                <Sparkles className="h-3 w-3" /> Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border p-3 text-center">
        <p className="text-[10px] text-muted-foreground">
          AI tools use your active Brand Context for consistent results
        </p>
        <Badge variant="outline" className="mt-1.5 text-[9px]">
          BrandContext Active
        </Badge>
      </div>
    </div>
  );
}
