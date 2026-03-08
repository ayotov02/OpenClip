"use client";

import {
  Sparkles,
  Zap,
  MessageSquare,
  Target,
  TrendingUp,
  Hash,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScoreBar } from "@/components/intelligence/score-badge";
import { TranscriptViewer } from "@/components/intelligence/transcript-viewer";
import { formatNumber } from "@/lib/helpers";

interface IntelligencePanelProps {
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
  likes: number;
  views: number;
  commentsCount: number;
  shares: number;
  saves?: number;
  engagementRate: number;
  hashtags?: string[] | null;
  postUrl: string;
  analyzedAt?: string | null;
  onAnalyze?: () => void;
  onGenerateScript?: () => void;
}

function getSentimentColor(sentiment: string | null | undefined) {
  if (sentiment === "positive") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (sentiment === "negative") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400";
}

export function IntelligencePanel({
  hookScore, bodyScore, ctaScore,
  extractedHook, extractedCta,
  transcript, contentCategory, sentiment, sentimentConfidence,
  nicheRelevance, likes, views, commentsCount, shares, saves,
  engagementRate, hashtags, postUrl, analyzedAt,
  onAnalyze, onGenerateScript,
}: IntelligencePanelProps) {
  const hasAnalysis = analyzedAt != null;

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div>
        <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          AI Scores
        </h4>
        {hasAnalysis ? (
          <div className="space-y-2.5">
            <ScoreBar score={hookScore} label="Hook Strength" />
            <ScoreBar score={bodyScore} label="Body Retention" />
            <ScoreBar score={ctaScore} label="CTA Clarity" />
            <ScoreBar score={nicheRelevance} label="Niche Relevance" />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">Not yet analyzed</p>
            {onAnalyze && (
              <Button size="sm" className="mt-2 gap-1 text-xs" onClick={onAnalyze}>
                <Zap className="h-3 w-3" /> Run Analysis
              </Button>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Engagement */}
      <div>
        <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Engagement
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Views", value: formatNumber(views) },
            { label: "Likes", value: formatNumber(likes) },
            { label: "Comments", value: formatNumber(commentsCount) },
            { label: "Shares", value: formatNumber(shares) },
            ...(saves != null ? [{ label: "Saves", value: formatNumber(saves) }] : []),
            { label: "ER", value: `${(engagementRate * 100).toFixed(1)}%` },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border border-border/50 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{metric.label}</p>
              <p className="text-sm font-bold text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Extracted Elements */}
      {hasAnalysis && (
        <>
          <div className="space-y-3">
            {extractedHook && (
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Zap className="h-3.5 w-3.5" /> Extracted Hook
                </h4>
                <p className="rounded-lg border border-border/50 bg-muted/30 p-2 text-xs italic text-foreground">
                  &ldquo;{extractedHook}&rdquo;
                </p>
              </div>
            )}
            {extractedCta && (
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Target className="h-3.5 w-3.5" /> Extracted CTA
                </h4>
                <p className="rounded-lg border border-border/50 bg-muted/30 p-2 text-xs italic text-foreground">
                  &ldquo;{extractedCta}&rdquo;
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Category & Sentiment */}
          <div className="flex flex-wrap gap-2">
            {contentCategory && (
              <Badge variant="outline" className="text-[10px]">
                <MessageSquare className="mr-1 h-3 w-3" />
                {contentCategory}
              </Badge>
            )}
            {sentiment && (
              <Badge className={`text-[10px] ${getSentimentColor(sentiment)}`}>
                {sentiment}
                {sentimentConfidence != null && ` ${Math.round(sentimentConfidence * 100)}%`}
              </Badge>
            )}
          </div>

          <Separator />
        </>
      )}

      {/* Transcript */}
      <TranscriptViewer transcript={transcript} />

      {/* Hashtags */}
      {hashtags && hashtags.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Hash className="h-3.5 w-3.5" /> Hashtags
            </h4>
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[9px] bg-muted/50">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Actions */}
      <div className="space-y-2">
        {onGenerateScript && (
          <Button className="w-full gap-1.5 text-xs" onClick={onGenerateScript}>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Similar Script
          </Button>
        )}
        <Button variant="outline" className="w-full gap-1.5 text-xs" asChild>
          <a href={postUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            View Original Post
          </a>
        </Button>
      </div>
    </div>
  );
}
