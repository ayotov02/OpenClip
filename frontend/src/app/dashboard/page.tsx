"use client";

import Link from "next/link";
import {
  Scissors,
  Video,
  Send,
  BarChart3,
  Plus,
  ArrowUpRight,
  Clock,
  TrendingUp,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { mockProjects, mockJobs, mockPerformance, mockFacelessProjects } from "@/lib/mock-data";
import { getRelativeTime, formatDuration, formatNumber, getStatusColor } from "@/lib/helpers";

const stats = [
  { label: "Total Clips", value: "25", change: "+8 this week", icon: Scissors, color: "bg-primary/10 text-primary" },
  { label: "Faceless Videos", value: "3", change: "+1 today", icon: Video, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { label: "Published", value: "18", change: "3 scheduled", icon: Send, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  { label: "Total Views", value: "138.5K", change: "+23% vs last week", icon: BarChart3, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
];

export default function DashboardPage() {
  const recentProjects = mockProjects.slice(0, 4);
  const activeJobs = mockJobs.filter((j) => j.status === "running");
  const totalViews = mockPerformance.reduce((sum, d) => sum + d.views, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Welcome + Quick Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back. Here is what is happening.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/projects">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Button>
          </Link>
          <Link href="/dashboard/faceless">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Video className="h-3.5 w-3.5" />
              Faceless Video
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.change}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Jobs */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Active Jobs</CardTitle>
              <Badge variant="outline" className="text-xs">
                {activeJobs.length} running
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeJobs.length > 0 ? (
              activeJobs.map((job) => (
                <div key={job.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{job.title}</p>
                    <span className="text-xs text-muted-foreground">{job.progress}%</span>
                  </div>
                  <Progress value={job.progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {job.stage}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No active jobs</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Projects</CardTitle>
              <Link href="/dashboard/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Scissors className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{project.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {getRelativeTime(project.createdAt)}
                        <span>·</span>
                        <span>{formatDuration(project.duration)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {project.clipCount > 0 && (
                      <span className="text-xs text-muted-foreground">{project.clipCount} clips</span>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${getStatusColor(project.status)}`}>
                      {project.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Recent Faceless */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Faceless</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockFacelessProjects.slice(0, 2).map((fp) => (
              <div key={fp.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Video className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fp.title}</p>
                  <p className="text-xs text-muted-foreground">{fp.template}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Weekly Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{formatNumber(totalViews)}</p>
            <p className="text-xs text-muted-foreground">total views across all platforms</p>
            <div className="mt-3 flex gap-4">
              <div>
                <p className="text-lg font-semibold text-foreground">{formatNumber(mockPerformance.reduce((s, d) => s + d.likes, 0))}</p>
                <p className="text-xs text-muted-foreground">likes</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{formatNumber(mockPerformance.reduce((s, d) => s + d.shares, 0))}</p>
                <p className="text-xs text-muted-foreground">shares</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{formatNumber(mockPerformance.reduce((s, d) => s + d.comments, 0))}</p>
                <p className="text-xs text-muted-foreground">comments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { name: "FastAPI", status: "online" },
              { name: "Celery Workers", status: "online" },
              { name: "WhisperX", status: "online" },
              { name: "Ollama (Qwen3)", status: "online" },
              { name: "Redis", status: "online" },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{svc.name}</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">{svc.status}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
