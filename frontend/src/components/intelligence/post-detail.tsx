"use client";

import { ArrowLeft, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IntelligencePanel } from "@/components/intelligence/intelligence-panel";
import { getPlatformColor, getRelativeTime, formatNumber } from "@/lib/helpers";

interface PostDetailProps {
  platform: string;
  postType: string;
  postUrl: string;
  caption?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  authorHandle?: string | null;
  followersAtScrape?: number;
  postedAt?: string | null;
  // Analysis
  hookScore?: number | null;
  bodyScore?: number | null;
  ctaScore?: number | null;
  extractedHook?: string | null;
  extractedCta?: string | null;
  transcript?: string | null;
  contentCategory?: string | null;
  sentiment?: string | null;
  sentimentConfidence?: number | null;
  nicheRelevance?: number | null;
  // Engagement
  likes: number;
  views: number;
  commentsCount: number;
  shares: number;
  saves?: number;
  engagementRate: number;
  analyzedAt?: string | null;
  onBack: () => void;
  onAnalyze?: () => void;
  onGenerateScript?: () => void;
}

export function PostDetail({
  platform, postType, postUrl, caption, hashtags, mentions,
  mediaUrl, thumbnailUrl, authorHandle, followersAtScrape, postedAt,
  hookScore, bodyScore, ctaScore, extractedHook, extractedCta,
  transcript, contentCategory, sentiment, sentimentConfidence, nicheRelevance,
  likes, views, commentsCount, shares, saves, engagementRate,
  analyzedAt, onBack, onAnalyze, onGenerateScript,
}: PostDetailProps) {
  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* LEFT PANE: The Post */}
      <div className="flex-1 border-r border-border/50 p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge className={`text-[10px] ${getPlatformColor(platform)}`}>
            {platform}
          </Badge>
          <Badge variant="outline" className="text-[10px]">{postType}</Badge>
        </div>

        {/* Media */}
        <div className="relative aspect-video rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
              {postType === "video" && (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-lg">
                  <Play className="h-7 w-7 text-primary ml-1" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Author info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {authorHandle ? `@${authorHandle}` : "Unknown Author"}
            </p>
            {followersAtScrape != null && followersAtScrape > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatNumber(followersAtScrape)} followers
              </p>
            )}
          </div>
          {postedAt && (
            <span className="text-xs text-muted-foreground">{getRelativeTime(postedAt)}</span>
          )}
        </div>

        {/* Caption */}
        {caption && (
          <div className="rounded-lg border border-border/50 p-3">
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{caption}</p>
          </div>
        )}

        {/* Hashtags */}
        {hashtags && hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Mentions */}
        {mentions && mentions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mentions.map((m) => (
              <Badge key={m} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                {m}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PANE: Intelligence Panel */}
      <ScrollArea className="w-full lg:w-[380px] p-4">
        <IntelligencePanel
          hookScore={hookScore}
          bodyScore={bodyScore}
          ctaScore={ctaScore}
          extractedHook={extractedHook}
          extractedCta={extractedCta}
          transcript={transcript}
          contentCategory={contentCategory}
          sentiment={sentiment}
          sentimentConfidence={sentimentConfidence}
          nicheRelevance={nicheRelevance}
          likes={likes}
          views={views}
          commentsCount={commentsCount}
          shares={shares}
          saves={saves}
          engagementRate={engagementRate}
          hashtags={hashtags}
          postUrl={postUrl}
          analyzedAt={analyzedAt}
          onAnalyze={onAnalyze}
          onGenerateScript={onGenerateScript}
        />
      </ScrollArea>
    </div>
  );
}
