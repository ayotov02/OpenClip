"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PLATFORMS = ["all", "youtube", "tiktok", "instagram", "twitter", "reddit"] as const;
const CONTENT_TYPES = ["all", "video", "image", "carousel", "text"] as const;
const SORT_OPTIONS = [
  { value: "scraped_at", label: "Recent" },
  { value: "views", label: "Most Viewed" },
  { value: "engagement_rate", label: "Highest ER" },
  { value: "hook_score", label: "Best Hook" },
] as const;

interface FeedFiltersProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  selectedContentType?: string;
  onContentTypeChange?: (type: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
}

export function FeedFilters({
  selectedPlatform, onPlatformChange,
  selectedContentType, onContentTypeChange,
  sortBy, onSortChange,
  searchQuery, onSearchChange,
  searchPlaceholder = "Search posts...",
}: FeedFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Platform filter */}
        <div className="flex items-center gap-1">
          {PLATFORMS.map((p) => (
            <Button
              key={p}
              variant={selectedPlatform === p ? "default" : "outline"}
              size="sm"
              className="h-7 text-[10px] px-2.5"
              onClick={() => onPlatformChange(p)}
            >
              {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>

        {/* Content type filter */}
        {onContentTypeChange && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1">
              {CONTENT_TYPES.map((t) => (
                <Button
                  key={t}
                  variant={selectedContentType === t ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[10px] px-2.5"
                  onClick={() => onContentTypeChange(t)}
                >
                  {t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}
                </Button>
              ))}
            </div>
          </>
        )}

        {/* Sort */}
        <div className="ml-auto flex items-center gap-1">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={sortBy === opt.value ? "default" : "ghost"}
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => onSortChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
