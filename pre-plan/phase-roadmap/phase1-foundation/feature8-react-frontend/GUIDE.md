# React Frontend (Next.js Dashboard) — Implementation Guide

## Overview
- **What:** Build the Next.js 15 + React 19 frontend with shadcn/ui — a dashboard for uploading videos, viewing AI-generated clips, managing projects, and monitoring job progress.
- **Why:** The frontend is how users interact with the platform. A clean, fast UI with real-time job progress is essential for a good experience.
- **Dependencies:** Feature 1 (Project Setup), Feature 2 (FastAPI Backend)

## Architecture

### Page Structure (App Router)
```
src/app/
├── layout.tsx              # Root layout with sidebar navigation
├── page.tsx                # Landing / redirect to dashboard
├── (auth)/
│   ├── login/page.tsx      # Login form
│   └── register/page.tsx   # Registration form
├── (dashboard)/
│   ├── layout.tsx          # Dashboard layout with sidebar
│   ├── page.tsx            # Dashboard home (recent projects)
│   ├── projects/
│   │   ├── page.tsx        # Project list
│   │   ├── new/page.tsx    # New project (upload or URL)
│   │   └── [id]/
│   │       ├── page.tsx    # Project detail (clips view)
│   │       └── clips/
│   │           └── [clipId]/page.tsx  # Single clip preview + edit
│   ├── brands/
│   │   └── page.tsx        # Brand kits management
│   └── settings/
│       └── page.tsx        # User settings, API keys
```

### Component Architecture
```
components/
├── ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
├── layout/
│   ├── sidebar.tsx         # Navigation sidebar
│   ├── header.tsx          # Top bar with user menu
│   └── page-header.tsx     # Page title + breadcrumbs
├── projects/
│   ├── project-card.tsx    # Project list item
│   ├── upload-form.tsx     # Video upload with drag-drop
│   └── url-input.tsx       # URL input form
├── clips/
│   ├── clip-card.tsx       # Clip preview card with score
│   ├── clip-player.tsx     # Video player for clip preview
│   └── clip-grid.tsx       # Grid layout for clips
├── jobs/
│   ├── job-progress.tsx    # Progress bar with status
│   └── job-list.tsx        # Active jobs sidebar
└── shared/
    ├── loading.tsx         # Loading states
    └── error-boundary.tsx  # Error handling
```

## GCP Deployment
- **Service:** Cloud Run
- **Machine:** 1 vCPU / 1 GB RAM (auto-scaling 1-5 instances)
- **Docker:** Next.js standalone build
- **Cost estimate:** $10-30/month

## Step-by-Step Implementation

### Step 1: Install Dependencies
```bash
cd frontend
npm install @tanstack/react-query axios lucide-react
npx shadcn@latest add button card dialog input label toast progress badge tabs separator avatar dropdown-menu sheet
```

### Step 2: Create API Client
Create `src/lib/api.ts`:
```typescript
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API functions
export async function createProject(file: File | null, url: string | null, title: string) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (url) formData.append("source_url", url);
  formData.append("title", title);

  const { data } = await api.post("/projects", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getProject(id: string) {
  const { data } = await api.get(`/projects/${id}`);
  return data;
}

export async function generateClips(projectId: string, settings: ClipSettings) {
  const { data } = await api.post(`/projects/${projectId}/clips`, settings);
  return data;
}

export async function getJobStatus(jobId: string) {
  const { data } = await api.get(`/jobs/${jobId}`);
  return data;
}

interface ClipSettings {
  num_clips: number;
  min_duration: number;
  max_duration: number;
}
```

### Step 3: Create React Query Provider
Create `src/lib/query-provider.tsx`:
```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000, retry: 1 },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### Step 4: Create Dashboard Layout
Create `src/app/(dashboard)/layout.tsx`:
```typescript
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### Step 5: Create Upload Form Component
Create `src/components/projects/upload-form.tsx`:
```typescript
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link, Loader2 } from "lucide-react";
import { createProject } from "@/lib/api";

export function UploadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type.startsWith("video/")) {
      setFile(droppedFile);
      setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
    }
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await createProject(file, url || null, title || "Untitled");
      router.push(`/projects/${result.project_id}`);
    } catch {
      // Show toast error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>New Project</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upload">
          <TabsList className="mb-4">
            <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" />Upload</TabsTrigger>
            <TabsTrigger value="url"><Link className="mr-2 h-4 w-4" />URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">
                {file ? file.name : "Drop video here or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">MP4, MOV, MKV, WebM — up to 10 GB</p>
              <input
                id="file-input"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setTitle(f.name.replace(/\.[^/.]+$/, "")); }
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="url">
            <Input
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </TabsContent>
        </Tabs>

        <Input
          className="mt-4"
          placeholder="Project title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Button
          className="mt-4 w-full"
          onClick={handleSubmit}
          disabled={loading || (!file && !url)}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Project
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Step 6: Create Job Progress Component
Create `src/components/jobs/job-progress.tsx`:
```typescript
"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getJobStatus } from "@/lib/api";

interface JobProgressProps {
  jobId: string;
  onComplete?: (result: any) => void;
}

export function JobProgress({ jobId, onComplete }: JobProgressProps) {
  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJobStatus(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "success" || status === "failure") return false;
      return 2000; // Poll every 2s while processing
    },
  });

  useEffect(() => {
    if (job?.status === "success" && onComplete) {
      onComplete(job.result);
    }
  }, [job?.status]);

  if (!job) return null;

  const progress = (job.progress?.progress ?? 0) * 100;
  const message = job.progress?.message || job.status;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{message}</span>
        <Badge variant={job.status === "success" ? "default" : "secondary"}>
          {job.status}
        </Badge>
      </div>
      <Progress value={progress} />
    </div>
  );
}
```

### Step 7: Create Clip Card Component
Create `src/components/clips/clip-card.tsx`:
```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Play } from "lucide-react";

interface ClipCardProps {
  clip: {
    index: number;
    title: string;
    score: number;
    duration: number;
    thumbnail_url: string;
    clip_url: string;
    transcript: string;
  };
}

export function ClipCard({ clip }: ClipCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        <img
          src={clip.thumbnail_url}
          alt={clip.title}
          className="object-cover w-full h-full"
        />
        <Badge className="absolute top-2 right-2">
          Score: {clip.score}
        </Badge>
        <div className="absolute bottom-2 right-2 text-xs bg-black/70 text-white px-2 py-1 rounded">
          {Math.round(clip.duration)}s
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm line-clamp-2">{clip.title}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{clip.transcript}</p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="flex-1">
            <Play className="mr-1 h-3 w-3" /> Preview
          </Button>
          <Button size="sm" asChild className="flex-1">
            <a href={clip.clip_url} download>
              <Download className="mr-1 h-3 w-3" /> Download
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 8: Create Frontend Dockerfile
Create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

Update `next.config.ts`:
```typescript
const nextConfig = {
  output: "standalone",
};
export default nextConfig;
```

## Best Practices
- **React Query for data fetching:** Handles caching, polling, and stale data automatically.
- **Polling for job progress:** Poll every 2s while job is active, stop on completion.
- **Optimistic updates:** Show upload immediately in project list, update when confirmed.
- **shadcn/ui:** Use built-in components for consistency. Don't build custom primitives.
- **Server components by default:** Only use `"use client"` when you need interactivity.
- **Standalone output:** Required for Docker deployment on Cloud Run.

## Testing
- Login flow works
- Upload video via drag-drop and file picker
- URL input creates project
- Job progress bar updates in real-time
- Clips appear after processing completes
- Clip preview plays video
- Download button works

## Verification Checklist
- [ ] Next.js app starts without errors
- [ ] Login/register flows work
- [ ] Video upload via drag-drop works
- [ ] URL input creates a project
- [ ] Job progress updates in real-time (polling)
- [ ] Clip grid displays after processing
- [ ] Clip preview plays correctly
- [ ] Download button works
- [ ] Responsive layout (desktop + mobile)
- [ ] Docker image builds and runs
- [ ] Cloud Run deployment serves the app
