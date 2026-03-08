"use client";

import {
  ImageIcon,
  Type,
  Palette,
  Sparkles,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { TimelinePanel } from "@/components/editor/timeline-panel";
import { AssetsPanel } from "@/components/editor/side-panels/assets-panel";
import { CaptionsPanel } from "@/components/editor/side-panels/captions-panel";
import { BrandKitPanel } from "@/components/editor/side-panels/brand-kit-panel";
import { AIToolsPanel } from "@/components/editor/side-panels/ai-tools-panel";
import { ExportPanel } from "@/components/editor/side-panels/export-panel";
import { useEditorState } from "@/hooks/use-editor-state";
import type { EditorPanel } from "@/lib/editor-types";

const SIDE_PANELS: { id: EditorPanel; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: "assets", icon: ImageIcon, label: "Assets" },
  { id: "captions", icon: Type, label: "Captions" },
  { id: "brand-kit", icon: Palette, label: "Brand Kit" },
  { id: "ai-tools", icon: Sparkles, label: "AI Tools" },
  { id: "export", icon: Download, label: "Export" },
];

interface VideoEditorProps {
  projectId: string;
}

export function VideoEditor({ projectId }: VideoEditorProps) {
  const {
    state,
    setCurrentTime,
    togglePlay,
    setAspectRatio,
    setActivePanel,
    setSelectedItem,
    updateCaption,
  } = useEditorState(projectId);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Top: Preview + Side Panel */}
      <div className="flex flex-1 min-h-0">
        {/* Preview Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          <PreviewPanel
            currentTime={state.currentTime}
            duration={state.duration}
            isPlaying={state.isPlaying}
            aspectRatio={state.aspectRatio}
            captions={state.captions}
            onTogglePlay={togglePlay}
            onAspectRatioChange={setAspectRatio}
            onSeek={setCurrentTime}
          />
        </div>

        {/* Side Panel Selector + Panel */}
        <div className="flex border-l border-border">
          {/* Icon bar */}
          <div className="flex w-12 flex-col items-center gap-1 border-r border-border bg-muted/30 py-2">
            {SIDE_PANELS.map((panel) => (
              <Button
                key={panel.id}
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9",
                  state.activePanel === panel.id && "bg-primary/10 text-primary",
                )}
                onClick={() => setActivePanel(panel.id)}
                title={panel.label}
              >
                <panel.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {/* Active panel content */}
          <ScrollArea className="w-72">
            <div className="p-3">
              {state.activePanel === "assets" && <AssetsPanel />}
              {state.activePanel === "captions" && (
                <CaptionsPanel
                  captions={state.captions}
                  currentTime={state.currentTime}
                  onCaptionUpdate={updateCaption}
                  onSeek={setCurrentTime}
                />
              )}
              {state.activePanel === "brand-kit" && <BrandKitPanel />}
              {state.activePanel === "ai-tools" && <AIToolsPanel />}
              {state.activePanel === "export" && <ExportPanel />}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Bottom: Timeline */}
      <div className="shrink-0 border-t border-border p-3">
        <TimelinePanel
          tracks={state.tracks}
          currentTime={state.currentTime}
          duration={state.duration}
          selectedItemId={state.selectedItemId}
          onItemSelect={setSelectedItem}
          onSeek={setCurrentTime}
        />
      </div>
    </div>
  );
}
