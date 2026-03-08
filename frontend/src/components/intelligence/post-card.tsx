"use client";

import { Play, Eye, Heart, MessageSquare, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/intelligence/score-badge";
import { formatNumber, getRelativeTime, getPlatformColor } from "@/lib/helpers";

interface PostCardProps {
  id: string;
  platform: string;
  postType: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  authorHandle?: string | null;
  likes: number;
  views: number;
  commentsCount: number;
  shares: number;
  engagementRate: number;
  hookScore?: number | null;
  postedAt?: string | null;
  contentCategory?: string | null;
  sentiment?: string | null;
  onClick?: () => void;
}

export function PostCard({
  platform, postType, caption, thumbnailUrl, authorHandle,
  likes, views, commentsCount, shares, engagementRate,
  hookScore, postedAt, contentCategory, sentiment,
  onClick,
}: PostCardProps) {
  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Thumbnail / Preview */}
        <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
              {postType === "video" && <Play className="h-8 w-8" />}
              <span className="text-[10px] uppercase tracking-wider">{postType}</span>
            </div>
          )}

          {/* Platform badge */}
          <div className="absolute top-2 left-2">
            <Badge className={`text-[10px] ${getPlatformColor(platform)}`}>
              {platform}
            </Badge>
          </div>

          {/* Hook score badge */}
          {hookScore != null && (
            <div className="absolute top-2 right-2">
              <ScoreBadge score={hookScore} label="" size="sm" />
            </div>
          )}

          {/* Engagement rate */}
          <div className="absolute bottom-2 right-2">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-[10px]">
              {(engagementRate * 100).toFixed(1)}% ER
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Author + time */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {authorHandle ? `@${authorHandle}` : "Unknown"}
            </span>
            {postedAt && (
              <span className="text-[10px] text-muted-foreground">
                {getRelativeTime(postedAt)}
              </span>
            )}
          </div>

          {/* Caption preview */}
          {caption && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {caption}
            </p>
          )}

          {/* Metrics row */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {formatNumber(views)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" /> {formatNumber(likes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> {formatNumber(commentsCount)}
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="h-3 w-3" /> {formatNumber(shares)}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {contentCategory && (
              <Badge variant="outline" className="text-[9px]">{contentCategory}</Badge>
            )}
            {sentiment && (
              <Badge variant="outline" className="text-[9px]">{sentiment}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
