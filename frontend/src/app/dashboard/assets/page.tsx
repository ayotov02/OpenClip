"use client";

import { useState } from "react";
import {
  ImageIcon,
  Video,
  Mic,
  Download,
  Trash2,
  Filter,
  Grid3x3,
  List,
  Search,
  FolderOpen,
  Clock,
  FileType2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type AssetType = "image" | "video" | "audio";
type ViewMode = "grid" | "list";

interface CreativeAsset {
  id: string;
  name: string;
  type: AssetType;
  projectName: string;
  prompt: string;
  model: string;
  resolution?: string;
  duration?: string;
  fileSize: string;
  createdAt: string;
}

const MOCK_ASSETS: CreativeAsset[] = [
  {
    id: "a1",
    name: "AI Tools Thumbnail v2",
    type: "image",
    projectName: "AI Tools Video Script",
    prompt: "Professional YouTube thumbnail, bold text overlay, AI robots, high contrast, cinematic",
    model: "FLUX.1 schnell",
    resolution: "1280x720",
    fileSize: "2.4 MB",
    createdAt: "2026-03-07T10:30:00Z",
  },
  {
    id: "a2",
    name: "Channel Banner Dark",
    type: "image",
    projectName: "Channel Thumbnails",
    prompt: "YouTube channel banner, dark theme, tech aesthetic, gradient background, 2560x1440",
    model: "FLUX.1 schnell",
    resolution: "2560x1440",
    fileSize: "4.1 MB",
    createdAt: "2026-03-06T15:20:00Z",
  },
  {
    id: "a3",
    name: "Intro Hook Narration",
    type: "audio",
    projectName: "AI Tools Video Script",
    prompt: "Narrate: Artificial intelligence is no longer a buzzword — it's reshaping every industry.",
    model: "Kokoro — af_heart",
    duration: "0:08",
    fileSize: "320 KB",
    createdAt: "2026-03-07T09:15:00Z",
  },
  {
    id: "a4",
    name: "Product Demo Clip",
    type: "video",
    projectName: "AI Tools Video Script",
    prompt: "AI robot working at a desk, futuristic office, smooth camera movement, 4 seconds",
    model: "Wan 2.1 T2V-1.3B",
    resolution: "832x480",
    duration: "0:04",
    fileSize: "18.7 MB",
    createdAt: "2026-03-06T11:45:00Z",
  },
  {
    id: "a5",
    name: "Social Post Graphic",
    type: "image",
    projectName: "Channel Thumbnails",
    prompt: "Instagram post, minimalist design, quote card, brand colors purple and gold",
    model: "FLUX.1 schnell",
    resolution: "1080x1080",
    fileSize: "1.8 MB",
    createdAt: "2026-03-05T16:00:00Z",
  },
  {
    id: "a6",
    name: "Deep Voice Narration Full",
    type: "audio",
    projectName: "Narration Test Voices",
    prompt: "Narrate full script in deep male voice with dramatic pauses",
    model: "Chatterbox — deep",
    duration: "1:32",
    fileSize: "4.6 MB",
    createdAt: "2026-03-05T14:30:00Z",
  },
  {
    id: "a7",
    name: "Competitor Analysis Cover",
    type: "image",
    projectName: "Competitor Analysis Q1",
    prompt: "Data visualization style image, charts and graphs, dark theme, professional",
    model: "FLUX.1 schnell",
    resolution: "1920x1080",
    fileSize: "3.2 MB",
    createdAt: "2026-03-04T09:00:00Z",
  },
  {
    id: "a8",
    name: "Ocean Depths B-Roll",
    type: "video",
    projectName: "AI Tools Video Script",
    prompt: "Deep ocean scene, bioluminescent creatures, dark blue water, ambient lighting",
    model: "Wan 2.1 T2V-1.3B",
    resolution: "832x480",
    duration: "0:04",
    fileSize: "21.3 MB",
    createdAt: "2026-03-04T13:20:00Z",
  },
  {
    id: "a9",
    name: "Voice Clone Test — Anthony",
    type: "audio",
    projectName: "Narration Test Voices",
    prompt: "Clone voice from reference sample and narrate test paragraph",
    model: "Chatterbox — clone",
    duration: "0:15",
    fileSize: "580 KB",
    createdAt: "2026-03-03T17:00:00Z",
  },
];

const TYPE_CONFIG: Record<AssetType, { icon: typeof ImageIcon; label: string; color: string; bg: string }> = {
  image: { icon: ImageIcon, label: "Image", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  video: { icon: Video, label: "Video", color: "text-primary", bg: "bg-primary/10" },
  audio: { icon: Mic, label: "Audio", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AssetsPage() {
  const [filterType, setFilterType] = useState<AssetType | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = MOCK_ASSETS.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase()) && !a.projectName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, CreativeAsset[]>>((acc, asset) => {
    if (!acc[asset.projectName]) acc[asset.projectName] = [];
    acc[asset.projectName].push(asset);
    return acc;
  }, {});

  const counts = {
    all: MOCK_ASSETS.length,
    image: MOCK_ASSETS.filter((a) => a.type === "image").length,
    video: MOCK_ASSETS.filter((a) => a.type === "video").length,
    audio: MOCK_ASSETS.filter((a) => a.type === "audio").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Creative Assets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All AI-generated images, videos, and audio organized by project.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {(["all", "image", "video", "audio"] as const).map((type) => {
            const isActive = filterType === type;
            return (
              <Button
                key={type}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn("h-8 gap-1.5 rounded-full text-xs", isActive && type !== "all" && "bg-foreground/10 text-foreground hover:bg-foreground/20")}
                onClick={() => setFilterType(type)}
              >
                {type === "all" ? (
                  <Filter className="h-3 w-3" />
                ) : (
                  (() => {
                    const Icon = TYPE_CONFIG[type].icon;
                    return <Icon className="h-3 w-3" />;
                  })()
                )}
                {type === "all" ? "All" : TYPE_CONFIG[type].label}
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {counts[type]}
                </Badge>
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex rounded-lg border border-border">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-r-none", viewMode === "grid" && "bg-muted")}
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-l-none border-l border-border", viewMode === "list" && "bg-muted")}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content grouped by project */}
      {Object.entries(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No assets found</p>
          <p className="mt-1 text-xs text-muted-foreground">Generate images, videos, or audio from the AI assistant.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([projectName, assets]) => (
          <div key={projectName}>
            <div className="mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{projectName}</h2>
              <Badge variant="outline" className="text-[10px]">
                {assets.length} {assets.length === 1 ? "asset" : "assets"}
              </Badge>
            </div>

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {assets.map((asset) => {
                  const config = TYPE_CONFIG[asset.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={asset.id}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
                    >
                      {/* Preview area */}
                      <div className={cn("flex h-32 items-center justify-center", config.bg)}>
                        <Icon className={cn("h-10 w-10 opacity-40", config.color)} />
                      </div>

                      {/* Info */}
                      <div className="flex flex-1 flex-col p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground leading-tight line-clamp-1">{asset.name}</p>
                          <Badge variant="outline" className={cn("shrink-0 text-[10px]", config.color)}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{asset.prompt}</p>
                        <div className="mt-auto flex items-center justify-between pt-3">
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileType2 className="h-3 w-3" />
                              {asset.fileSize}
                            </span>
                            {asset.resolution && <span>{asset.resolution}</span>}
                            {asset.duration && <span>{asset.duration}</span>}
                          </div>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="hidden px-4 py-2 font-medium md:table-cell">Model</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Size</th>
                      <th className="px-4 py-2 font-medium">Created</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const config = TYPE_CONFIG[asset.type];
                      const Icon = config.icon;
                      return (
                        <tr key={asset.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", config.bg)}>
                                <Icon className={cn("h-3.5 w-3.5", config.color)} />
                              </div>
                              <span className="font-medium">{asset.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={cn("text-[10px]", config.color)}>{config.label}</Badge>
                          </td>
                          <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">{asset.model}</td>
                          <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{asset.fileSize}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(asset.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
