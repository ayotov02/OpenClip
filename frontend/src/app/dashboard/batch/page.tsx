"use client";

import {
  FileStack,
  Upload,
  Download,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getStatusColor } from "@/lib/helpers";

const mockBatchJobs = [
  { id: "bj1", title: "10 AI Tools Video Series", rows: 10, completed: 7, failed: 0, status: "running" as const },
  { id: "bj2", title: "March Content Batch", rows: 25, completed: 25, failed: 1, status: "completed" as const },
  { id: "bj3", title: "Client Onboarding Videos", rows: 5, completed: 0, failed: 0, status: "queued" as const },
];

export default function BatchPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Batch Processing</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV to generate multiple videos at once
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Download Template
        </Button>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-8">
          <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-base font-semibold text-foreground">
              Upload your CSV or spreadsheet
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Each row becomes a video. Columns map to: topic, template, voice, music mood, brand kit, and output format.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button className="gap-1.5">
                <Upload className="h-4 w-4" />
                Choose File
              </Button>
              <span className="text-xs text-muted-foreground">or drag and drop</span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              CSV, XLSX — up to 1,000 rows
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Batches */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Batch Jobs</h2>
        <div className="space-y-3">
          {mockBatchJobs.map((job) => {
            const progress = job.rows > 0 ? Math.round((job.completed / job.rows) * 100) : 0;
            return (
              <Card key={job.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <FileStack className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{job.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{job.rows} videos</span>
                          <span>·</span>
                          <span>{job.completed} completed</span>
                          {job.failed > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-red-600">{job.failed} failed</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${getStatusColor(job.status)}`}>
                        {job.status}
                      </Badge>
                      {job.status === "completed" && (
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <Download className="h-3 w-3" />
                          Download All
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
