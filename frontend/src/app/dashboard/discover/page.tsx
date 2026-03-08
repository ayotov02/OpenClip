"use client";

import { useState } from "react";
import { Compass, Search, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PostCard } from "@/components/intelligence/post-card";
import { PostDetail } from "@/components/intelligence/post-detail";
import { FeedFilters } from "@/components/intelligence/feed-filters";
import { mockDiscoveryResults } from "@/lib/mock-data";
import type { DiscoveryResult } from "@/lib/types";

const SUGGESTED_QUERIES = [
  "AI video editing tools",
  "faceless YouTube channels",
  "short form content strategy",
  "creator economy trends",
  "viral TikTok hooks",
  "passive income content",
];

export default function NicheDiscoveryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(true); // true to show mock data
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedContentType, setSelectedContentType] = useState("all");
  const [sortBy, setSortBy] = useState("searched_at");
  const [selectedResult, setSelectedResult] = useState<DiscoveryResult | null>(null);

  const filteredResults = mockDiscoveryResults
    .filter((r) => selectedPlatform === "all" || r.platform === selectedPlatform)
    .filter((r) => selectedContentType === "all" || r.postType === selectedContentType)
    .sort((a, b) => {
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "engagement_rate") return b.engagementRate - a.engagementRate;
      if (sortBy === "hook_score") return (b.hookScore ?? 0) - (a.hookScore ?? 0);
      return new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime();
    });

  function handleSearch() {
    if (!searchQuery.trim()) return;
    setHasSearched(true);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Compass className="h-5 w-5" />
          Niche Discovery
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore any niche across all platforms. Find trending content, analyze what works, and create from it.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter a niche, topic, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 h-10"
          />
        </div>
        <Button className="gap-1.5 h-10" onClick={handleSearch}>
          <Search className="h-4 w-4" />
          Discover
        </Button>
      </div>

      {/* Suggested queries */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Try:</span>
        {SUGGESTED_QUERIES.map((q) => (
          <Badge
            key={q}
            variant="outline"
            className="text-xs cursor-pointer hover:bg-muted transition-colors"
            onClick={() => { setSearchQuery(q); setHasSearched(true); }}
          >
            {q}
          </Badge>
        ))}
      </div>

      {hasSearched && (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Results Feed */}
          <div className="lg:col-span-3 space-y-4">
            <FeedFilters
              selectedPlatform={selectedPlatform}
              onPlatformChange={setSelectedPlatform}
              selectedContentType={selectedContentType}
              onContentTypeChange={setSelectedContentType}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            {filteredResults.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredResults.map((result) => (
                  <PostCard
                    key={result.id}
                    id={result.id}
                    platform={result.platform}
                    postType={result.postType}
                    caption={result.caption || result.title}
                    thumbnailUrl={result.thumbnailUrl}
                    authorHandle={result.authorHandle}
                    likes={result.likes}
                    views={result.views}
                    commentsCount={result.commentsCount}
                    shares={result.shares}
                    engagementRate={result.engagementRate}
                    hookScore={result.hookScore}
                    postedAt={result.postedAt}
                    contentCategory={result.contentCategory}
                    sentiment={result.sentiment}
                    onClick={() => setSelectedResult(result)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Compass className="h-10 w-10 text-muted-foreground/30" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">No results for this filter</p>
              </div>
            )}
          </div>

          {/* Trending Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  Trending Now
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { topic: "AI Video Generation", count: "12.4K posts", velocity: "rising" },
                  { topic: "Faceless YouTube", count: "8.9K posts", velocity: "rising" },
                  { topic: "Short Form Strategy", count: "15.2K posts", velocity: "stable" },
                  { topic: "Creator Tools 2026", count: "6.1K posts", velocity: "rising" },
                  { topic: "Caption Accuracy", count: "3.8K posts", velocity: "rising" },
                ].map((trend) => (
                  <div
                    key={trend.topic}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => { setSearchQuery(trend.topic); setHasSearched(true); }}
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">{trend.topic}</p>
                      <p className="text-[10px] text-muted-foreground">{trend.count}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        trend.velocity === "rising"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400"
                      }`}
                    >
                      {trend.velocity}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Recent Searches</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {["AI video editing tools", "faceless content", "hook formulas"].map((q) => (
                  <div
                    key={q}
                    className="rounded-lg border border-border/50 p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => { setSearchQuery(q); setHasSearched(true); }}
                  >
                    <p className="text-xs text-foreground">{q}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Result Detail Modal */}
      <Dialog open={selectedResult !== null} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          {selectedResult && (
            <PostDetail
              platform={selectedResult.platform}
              postType={selectedResult.postType}
              postUrl={selectedResult.postUrl}
              caption={selectedResult.caption || selectedResult.description}
              thumbnailUrl={selectedResult.thumbnailUrl}
              authorHandle={selectedResult.authorHandle}
              followersAtScrape={selectedResult.authorFollowers}
              postedAt={selectedResult.postedAt}
              hookScore={selectedResult.hookScore}
              bodyScore={selectedResult.bodyScore}
              ctaScore={selectedResult.ctaScore}
              extractedHook={selectedResult.extractedHook}
              extractedCta={selectedResult.extractedCta}
              transcript={selectedResult.transcript}
              contentCategory={selectedResult.contentCategory}
              sentiment={selectedResult.sentiment}
              nicheRelevance={selectedResult.nicheRelevance}
              likes={selectedResult.likes}
              views={selectedResult.views}
              commentsCount={selectedResult.commentsCount}
              shares={selectedResult.shares}
              engagementRate={selectedResult.engagementRate}
              analyzedAt={selectedResult.analyzedAt}
              onBack={() => setSelectedResult(null)}
              onAnalyze={() => {}}
              onGenerateScript={() => {}}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
