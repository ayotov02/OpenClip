"use client";

import { useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Globe,
  Bell,
  Webhook,
  Users,
  Server,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { mockApiKeys, mockSocialAccounts } from "@/lib/mock-data";
import { getRelativeTime, getPlatformColor } from "@/lib/helpers";

export default function SettingsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your instance, API keys, social accounts, and preferences
        </p>
      </div>

      <Tabs defaultValue="api">
        <TabsList>
          <TabsTrigger value="api" className="gap-1.5">
            <Key className="h-3.5 w-3.5" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Social Accounts
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="h-3.5 w-3.5" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="instance" className="gap-1.5">
            <Server className="h-3.5 w-3.5" />
            Instance
          </TabsTrigger>
        </TabsList>

        {/* API Keys */}
        <TabsContent value="api" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              API keys for programmatic access to your OpenClip instance
            </p>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Generate Key
            </Button>
          </div>
          <div className="space-y-3">
            {mockApiKeys.map((key) => (
              <Card key={key.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Key className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{key.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{key.prefix}...****</code>
                        <span>·</span>
                        <span>Created {getRelativeTime(key.createdAt)}</span>
                        {key.lastUsed && (
                          <>
                            <span>·</span>
                            <span>Last used {getRelativeTime(key.lastUsed)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopy(key.id, key.prefix)}
                    >
                      {copied === key.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Social Accounts */}
        <TabsContent value="social" className="mt-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            Connect your social media accounts for auto-publishing
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {mockSocialAccounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${getPlatformColor(account.platform)}`}>
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">{account.platform}</p>
                      <p className="text-xs text-muted-foreground">{account.handle}</p>
                    </div>
                  </div>
                  {account.connected ? (
                    <Badge variant="outline" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline">Connect</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Webhooks */}
        <TabsContent value="webhooks" className="mt-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            Receive POST notifications when jobs complete
          </p>
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Webhook URL</label>
                <div className="flex gap-2">
                  <Input placeholder="https://your-server.com/webhooks/openclip" className="flex-1" />
                  <Button>Save</Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <label className="text-sm font-medium">Events</label>
                {[
                  { event: "clip.completed", desc: "When a clip finishes rendering" },
                  { event: "faceless.completed", desc: "When a faceless video finishes" },
                  { event: "publish.completed", desc: "When a post is published" },
                  { event: "scrape.completed", desc: "When a competitor scrape finishes" },
                ].map((item) => (
                  <div key={item.event} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">{item.event}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
              <Separator />
              <Button variant="outline" size="sm">Send Test Webhook</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instance */}
        <TabsContent value="instance" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Instance Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Version", value: "0.1.0-alpha" },
                { label: "Mode", value: "Self-Hosted (Docker)" },
                { label: "GPU", value: "NVIDIA RTX 4090 (24 GB)" },
                { label: "Models Loaded", value: "WhisperX, Qwen3-32B, Kokoro, YOLO11" },
                { label: "Uptime", value: "3d 14h 22m" },
                { label: "Celery Workers", value: "4 active" },
                { label: "Redis", value: "Connected (2.1 GB used)" },
                { label: "PostgreSQL", value: "Connected (847 MB)" },
                { label: "MinIO", value: "Connected (12.4 GB / 500 GB)" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
