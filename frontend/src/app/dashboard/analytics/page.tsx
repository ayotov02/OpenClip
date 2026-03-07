"use client";

import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  Share2,
  MessageCircle,
  Users,
  Search,
  Hash,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  mockPerformance, mockCompetitors, mockTrending, mockHashtags,
} from "@/lib/mock-data";
import { formatNumber, getRelativeTime, getPlatformColor } from "@/lib/helpers";

export default function AnalyticsPage() {
  const totalViews = mockPerformance.reduce((s, d) => s + d.views, 0);
  const totalLikes = mockPerformance.reduce((s, d) => s + d.likes, 0);
  const totalShares = mockPerformance.reduce((s, d) => s + d.shares, 0);
  const totalComments = mockPerformance.reduce((s, d) => s + d.comments, 0);
  const maxViews = Math.max(...mockPerformance.map((d) => d.views));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Performance, competitors, trends, and hashtag insights
        </p>
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="competitors" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Competitors
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="hashtags" className="gap-1.5">
            <Hash className="h-3.5 w-3.5" />
            Hashtags
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-6 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Views", value: totalViews, icon: Eye, change: "+23%", up: true },
              { label: "Likes", value: totalLikes, icon: Heart, change: "+18%", up: true },
              { label: "Shares", value: totalShares, icon: Share2, change: "+34%", up: true },
              { label: "Comments", value: totalComments, icon: MessageCircle, change: "+12%", up: true },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                    <span className={`flex items-center gap-0.5 text-xs ${stat.up ? "text-emerald-600" : "text-red-600"}`}>
                      {stat.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {stat.change}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">{formatNumber(stat.value)}</p>
                  <p className="text-xs text-muted-foreground">{stat.label} this week</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Views — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-48">
                {mockPerformance.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{formatNumber(day.views)}</span>
                    <div
                      className="w-full rounded-t-md bg-primary/20 hover:bg-primary/40 transition-colors"
                      style={{ height: `${(day.views / maxViews) * 160}px` }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(day.date).toLocaleDateString("en", { weekday: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitors Tab */}
        <TabsContent value="competitors" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search competitors..." className="pl-9" />
            </div>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Competitor
            </Button>
          </div>

          <div className="space-y-3">
            {mockCompetitors.map((comp) => (
              <Card key={comp.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${getPlatformColor(comp.platform)}`}>
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{comp.handle}</p>
                        <Badge variant="outline" className={`text-[10px] capitalize ${getPlatformColor(comp.platform)}`}>
                          {comp.platform}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatNumber(comp.followers)} followers</span>
                        <span className="flex items-center gap-0.5 text-emerald-600">
                          <TrendingUp className="h-3 w-3" />
                          +{comp.followersGrowth}%
                        </span>
                        <span>{comp.postsPerWeek} posts/week</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{comp.avgEngagement}%</p>
                    <p className="text-xs text-muted-foreground">avg engagement</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-1">
                      <Clock className="h-3 w-3" />
                      {getRelativeTime(comp.lastScraped)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="mt-6 space-y-6">
          <div className="space-y-3">
            {mockTrending.map((trend) => (
              <Card key={trend.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      trend.velocity === "rising"
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : "bg-muted"
                    }`}>
                      {trend.velocity === "rising" ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{trend.topic}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={`text-[10px] capitalize ${getPlatformColor(trend.platform)}`}>
                          {trend.platform}
                        </Badge>
                        <span>{trend.sourceCount} sources</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatNumber(trend.totalEngagement)}</p>
                      <p className="text-xs text-muted-foreground">engagement</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${
                        trend.velocity === "rising"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {trend.velocity}
                    </Badge>
                    <Button size="sm" variant="outline" className="text-xs gap-1">
                      <Zap className="h-3 w-3" />
                      Create
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Hashtags Tab */}
        <TabsContent value="hashtags" className="mt-6 space-y-6">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Hashtag</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Volume</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Growth</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Competition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockHashtags.map((tag) => (
                      <tr key={tag.tag} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-primary">{tag.tag}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {formatNumber(tag.volume)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="flex items-center justify-end gap-0.5 text-sm text-emerald-600">
                            <TrendingUp className="h-3 w-3" />
                            +{tag.growth}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              tag.competition === "low"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : tag.competition === "medium"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {tag.competition}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
