"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Play,
  Send,
  Music,
  Mic,
  Image,
  Clock,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { mockFacelessProjects } from "@/lib/mock-data";
import { getStatusColor } from "@/lib/helpers";

export default function FacelessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = mockFacelessProjects.find((p) => p.id === id) || mockFacelessProjects[0];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/faceless">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{project.title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Badge variant="outline" className="text-[10px]">{project.template}</Badge>
              <span>·</span>
              <span>{project.ttsVoice}</span>
              <span>·</span>
              <span>{project.musicMood} music</span>
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
            Export
          </Button>
          <Button size="sm" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Video Preview */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="relative aspect-video bg-gradient-to-br from-primary/5 to-emerald-500/5 rounded-t-xl flex items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-lg cursor-pointer hover:scale-105 transition-transform">
                  <Play className="h-7 w-7 text-primary ml-1" />
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
                    Preview
                  </Badge>
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs">
                    0:00 / 1:24
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Thumbnail Preview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Thumbnail</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <Image className="h-3 w-3" />
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/10 to-amber-500/10 flex items-center justify-center border border-border/50">
                <div className="text-center">
                  <Image className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p className="mt-2 text-xs text-muted-foreground">AI-generated thumbnail</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Script & Settings Sidebar */}
        <div className="space-y-4">
          {/* Script */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Script</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.scenes.length > 0 ? (
                project.scenes.map((scene, i) => (
                  <div key={scene.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">Scene {i + 1}</Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {scene.durationEst}s
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{scene.narration}</p>
                    <div className="flex flex-wrap gap-1">
                      {scene.searchKeywords.map((kw) => (
                        <Badge key={kw} variant="outline" className="text-[9px] bg-muted/50">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[9px]">{scene.mood}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Script generating...</p>
              )}
            </CardContent>
          </Card>

          {/* Config */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Mic, label: "Voice", value: project.ttsVoice },
                { icon: Music, label: "Music", value: project.musicMood },
                { icon: Image, label: "Template", value: project.template },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  <span className="font-medium text-foreground text-xs">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
