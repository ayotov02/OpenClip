"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Share2,
  Clock,
  Sparkles,
  Flame,
  Play,
  Send,
  Film,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { VideoEditor } from "@/components/editor/video-editor";
import { mockProjects, mockClips } from "@/lib/mock-data";
import { formatDuration, getScoreColor, getScoreBg, getStatusColor } from "@/lib/helpers";

function ScoreRing({ score, size = 48, label }: { score: number; size?: number; label: string }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-border" strokeWidth="3" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            className={score >= 80 ? "stroke-emerald-500" : score >= 60 ? "stroke-amber-500" : "stroke-orange-500"}
            strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = mockProjects.find((p) => p.id === id) || mockProjects[0];
  const clips = mockClips.filter((c) => c.projectId === project.id);

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{project.title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{formatDuration(project.duration)}</span>
              <span>·</span>
              <span>{project.aspectRatio}</span>
              <span>·</span>
              <Badge variant="outline" className={`text-[10px] ${getStatusColor(project.status)}`}>
                {project.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export All
          </Button>
          <Button size="sm" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor" className="gap-1.5">
            <Film className="h-3.5 w-3.5" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="clips">Clips ({clips.length})</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-4">
          <VideoEditor projectId={id} />
        </TabsContent>

        <TabsContent value="clips" className="mt-6">
          {clips.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {clips.map((clip, i) => (
                <Card key={clip.id} className="overflow-hidden transition-shadow hover:shadow-md hover:shadow-primary/5">
                  <CardContent className="p-0">
                    {/* Video Preview Placeholder */}
                    <div className="relative aspect-video bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-lg">
                        <Play className="h-5 w-5 text-primary ml-0.5" />
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge className={`text-[10px] ${getScoreBg(clip.viralityScore)}`}>
                          <Flame className="h-3 w-3 mr-1" />
                          {clip.viralityScore}
                        </Badge>
                      </div>
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-[10px]">
                          {formatDuration(clip.duration)}
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(clip.status)}`}>
                          {clip.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          #{i + 1} — {clip.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {clip.transcript}
                        </p>
                      </div>

                      <Separator />

                      {/* Score Breakdown */}
                      <div className="flex items-center justify-between px-2">
                        <ScoreRing score={clip.hookStrength} size={40} label="Hook" />
                        <ScoreRing score={clip.emotionalPeak} size={40} label="Emotion" />
                        <ScoreRing score={clip.infoDensity} size={40} label="Info" />
                        <ScoreRing score={clip.selfContained} size={40} label="Self-cont." />
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                        <Button size="sm" className="flex-1 text-xs gap-1">
                          <Share2 className="h-3 w-3" />
                          Publish
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">No clips yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This project is still processing
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transcript" className="mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Full transcript with timestamps</span>
                </div>
                <div className="space-y-3 text-sm text-foreground leading-relaxed">
                  {clips.map((clip) => (
                    <div key={clip.id} className="flex gap-3">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground mt-0.5">
                        {formatDuration(clip.startTime)}
                      </span>
                      <p>{clip.transcript}</p>
                    </div>
                  ))}
                  {clips.length === 0 && (
                    <p className="text-muted-foreground">Transcript will appear after processing completes.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Project Settings</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "Aspect Ratio", value: project.aspectRatio },
                  { label: "Source Type", value: project.sourceType },
                  { label: "Max Clip Duration", value: "60s" },
                  { label: "Language", value: "English (auto-detect)" },
                  { label: "Caption Style", value: "Karaoke" },
                  { label: "Brand Kit", value: "Main Channel" },
                ].map((setting) => (
                  <div key={setting.label} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <span className="text-sm text-muted-foreground">{setting.label}</span>
                    <span className="text-sm font-medium text-foreground">{setting.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
