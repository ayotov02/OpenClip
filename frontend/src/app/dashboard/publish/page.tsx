"use client";

import {
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Youtube,
  Instagram,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockPublishJobs } from "@/lib/mock-data";
import { getRelativeTime, getStatusColor, getPlatformColor } from "@/lib/helpers";

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  scheduled: Clock,
  publishing: Send,
  published: CheckCircle2,
  failed: AlertCircle,
};

export default function PublishPage() {
  const scheduled = mockPublishJobs.filter((j) => j.status === "scheduled");
  const published = mockPublishJobs.filter((j) => j.status === "published");
  const failed = mockPublishJobs.filter((j) => j.status === "failed");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Publishing</h1>
          <p className="text-sm text-muted-foreground">
            Manage your scheduled and published posts
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">{scheduled.length} scheduled</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">{published.length} published</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({mockPublishJobs.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
          <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failed.length})</TabsTrigger>
        </TabsList>

        {["all", "scheduled", "published", "failed"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <div className="space-y-3">
              {(tab === "all" ? mockPublishJobs : mockPublishJobs.filter((j) => j.status === tab)).map((job) => {
                const StatusIcon = statusIcons[job.status] || Clock;
                return (
                  <Card key={job.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getPlatformColor(job.platform)}`}>
                          <Send className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
                            <Badge variant="outline" className={`text-[10px] capitalize ${getPlatformColor(job.platform)}`}>
                              {job.platform}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-md">
                            {job.description}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {job.status === "published" && job.publishedAt
                                ? `Published ${getRelativeTime(job.publishedAt)}`
                                : `Scheduled for ${new Date(job.scheduledAt).toLocaleDateString()} at ${new Date(job.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                              }
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {job.hashtags.map((tag) => (
                              <span key={tag} className="text-[10px] text-primary/70">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs gap-1 ${getStatusColor(job.status)}`}>
                          <StatusIcon className="h-3 w-3" />
                          {job.status}
                        </Badge>
                        {job.status === "published" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
