"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Scissors,
  Clock,
  Upload,
  LinkIcon,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { mockProjects } from "@/lib/mock-data";
import { getRelativeTime, formatDuration, getStatusColor } from "@/lib/helpers";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = mockProjects.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Upload videos or paste URLs to generate AI clips
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="url" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="url" className="flex-1 gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Paste URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </TabsTrigger>
              </TabsList>
              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Video URL</label>
                  <Input placeholder="https://youtube.com/watch?v=..." />
                  <p className="text-xs text-muted-foreground">
                    Supports YouTube, Vimeo, and direct video URLs
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Title (optional)</label>
                  <Input placeholder="Auto-detected from video" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => setDialogOpen(false)}>Create Project</Button>
                </div>
              </TabsContent>
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Drag and drop your video here
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    MP4, MOV, MKV, WebM — up to 10 GB
                  </p>
                  <Button variant="outline" size="sm" className="mt-4">
                    Browse Files
                  </Button>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => setDialogOpen(false)}>Upload & Create</Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {["all", "completed", "processing", "pending", "failed"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "ghost"}
              size="sm"
              className="text-xs capitalize h-8"
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
              <Card className="transition-shadow hover:shadow-md hover:shadow-primary/5 cursor-pointer">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Scissors className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{project.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getRelativeTime(project.createdAt)}
                        </span>
                        <span>{formatDuration(project.duration)}</span>
                        <span className="flex items-center gap-1">
                          {project.sourceType === "url" ? <LinkIcon className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                          {project.sourceType}
                        </span>
                        <span>{project.aspectRatio}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {project.clipCount > 0 && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">{project.clipCount}</p>
                        <p className="text-xs text-muted-foreground">clips</p>
                      </div>
                    )}
                    <Badge variant="outline" className={`text-xs ${getStatusColor(project.status)}`}>
                      {project.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Scissors className="h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">No projects found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first project to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
