"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Video,
  Clock,
  BookOpen,
  Skull,
  ListOrdered,
  GraduationCap,
  Flame,
  Film,
  LinkIcon,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockFacelessProjects } from "@/lib/mock-data";
import { getRelativeTime, getStatusColor } from "@/lib/helpers";

const templates = [
  { id: "reddit-story", name: "Reddit Story", icon: MessageSquare, desc: "Screenshots + TTS + gameplay background", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  { id: "documentary", name: "Documentary", icon: Film, desc: "B-roll + narration + lower thirds", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { id: "top-10-listicle", name: "Top 10 Listicle", icon: ListOrdered, desc: "Countdown + stock footage", color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  { id: "motivational", name: "Motivational", icon: Flame, desc: "Cinematic footage + quotes + epic music", color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
  { id: "scary-story", name: "Scary Story", icon: Skull, desc: "Dark footage + eerie music + dramatic TTS", color: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
  { id: "educational", name: "Educational", icon: GraduationCap, desc: "Diagrams + animations + narration", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
];

export default function FacelessPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faceless Studio</h1>
          <p className="text-sm text-muted-foreground">
            Create complete videos from text, URLs, or Reddit posts
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Video
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Faceless Video</DialogTitle>
            </DialogHeader>

            {!selectedTemplate ? (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-4">Choose a template</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.color}`}>
                        <t.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)} className="text-xs">
                  ← Back to templates
                </Button>
                <Tabs defaultValue="topic">
                  <TabsList className="w-full">
                    <TabsTrigger value="topic" className="flex-1">Topic</TabsTrigger>
                    <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
                    <TabsTrigger value="reddit" className="flex-1">Reddit</TabsTrigger>
                  </TabsList>
                  <TabsContent value="topic" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Topic or Prompt</label>
                      <Textarea placeholder="e.g. 5 AI tools that will replace your job in 2026" rows={3} />
                    </div>
                  </TabsContent>
                  <TabsContent value="url" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Article or Video URL</label>
                      <Input placeholder="https://..." />
                    </div>
                  </TabsContent>
                  <TabsContent value="reddit" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reddit Post URL</label>
                      <Input placeholder="https://reddit.com/r/..." />
                    </div>
                  </TabsContent>
                </Tabs>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Voice</label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <option>Kokoro — af_heart (female)</option>
                      <option>Kokoro — bf_narrator (male)</option>
                      <option>Chatterbox — deep (male)</option>
                      <option>Chatterbox — warm (female)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Music Mood</label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <option>Dramatic</option>
                      <option>Cinematic</option>
                      <option>Upbeat</option>
                      <option>Eerie</option>
                      <option>Calm</option>
                      <option>Epic</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => setDialogOpen(false)} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate Video
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Template Quick Access */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Templates</h2>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedTemplate(t.id); setDialogOpen(true); }}
              className="flex flex-col items-center gap-2 rounded-xl border border-border/50 p-4 transition-all hover:border-primary/30 hover:bg-primary/5"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.color}`}>
                <t.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-foreground">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Faceless Projects */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent Videos</h2>
        <div className="space-y-3">
          {mockFacelessProjects.map((fp) => (
            <Link key={fp.id} href={`/dashboard/faceless/${fp.id}`}>
              <Card className="transition-shadow hover:shadow-md hover:shadow-primary/5 cursor-pointer mb-3">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                      <Video className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{fp.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getRelativeTime(fp.createdAt)}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{fp.template}</Badge>
                        <span>{fp.ttsVoice}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs ${getStatusColor(fp.status)}`}>
                    {fp.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
