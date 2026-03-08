"use client";

import { useState } from "react";
import { Eye, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PostCard } from "@/components/intelligence/post-card";
import { PostDetail } from "@/components/intelligence/post-detail";
import { FeedFilters } from "@/components/intelligence/feed-filters";
import { mockScrapedPosts } from "@/lib/mock-data";
import type { ScrapedPost } from "@/lib/types";

export default function CompetitorSpyFeedPage() {
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [sortBy, setSortBy] = useState("scraped_at");
  const [selectedPost, setSelectedPost] = useState<ScrapedPost | null>(null);

  const filteredPosts = mockScrapedPosts
    .filter((p) => selectedPlatform === "all" || p.platform === selectedPlatform)
    .sort((a, b) => {
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "engagement_rate") return b.engagementRate - a.engagementRate;
      if (sortBy === "hook_score") return (b.hookScore ?? 0) - (a.hookScore ?? 0);
      return new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime();
    });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Eye className="h-5 w-5" />
            Competitor Spy Feed
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor competitor content across all platforms with AI-powered analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Competitor
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FeedFilters
        selectedPlatform={selectedPlatform}
        onPlatformChange={setSelectedPlatform}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Feed Grid */}
      {filteredPosts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              id={post.id}
              platform={post.platform}
              postType={post.postType}
              caption={post.caption}
              thumbnailUrl={post.thumbnailUrl}
              authorHandle={post.authorHandle}
              likes={post.likes}
              views={post.views}
              commentsCount={post.commentsCount}
              shares={post.shares}
              engagementRate={post.engagementRate}
              hookScore={post.hookScore}
              postedAt={post.postedAt}
              contentCategory={post.contentCategory}
              sentiment={post.sentiment}
              onClick={() => setSelectedPost(post)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Eye className="h-10 w-10 text-muted-foreground/30" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No posts found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add competitors and scrape their posts to start analyzing
          </p>
        </div>
      )}

      {/* Post Detail Modal */}
      <Dialog open={selectedPost !== null} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden">
          {selectedPost && (
            <PostDetail
              platform={selectedPost.platform}
              postType={selectedPost.postType}
              postUrl={selectedPost.postUrl}
              caption={selectedPost.caption}
              hashtags={selectedPost.hashtags}
              mentions={selectedPost.mentions}
              mediaUrl={selectedPost.mediaUrl}
              thumbnailUrl={selectedPost.thumbnailUrl}
              authorHandle={selectedPost.authorHandle}
              followersAtScrape={selectedPost.followersAtScrape}
              postedAt={selectedPost.postedAt}
              hookScore={selectedPost.hookScore}
              bodyScore={selectedPost.bodyScore}
              ctaScore={selectedPost.ctaScore}
              extractedHook={selectedPost.extractedHook}
              extractedCta={selectedPost.extractedCta}
              transcript={selectedPost.transcript}
              contentCategory={selectedPost.contentCategory}
              sentiment={selectedPost.sentiment}
              sentimentConfidence={selectedPost.sentimentConfidence}
              nicheRelevance={selectedPost.nicheRelevance}
              likes={selectedPost.likes}
              views={selectedPost.views}
              commentsCount={selectedPost.commentsCount}
              shares={selectedPost.shares}
              saves={selectedPost.saves}
              engagementRate={selectedPost.engagementRate}
              analyzedAt={selectedPost.analyzedAt}
              onBack={() => setSelectedPost(null)}
              onAnalyze={() => {}}
              onGenerateScript={() => {}}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
