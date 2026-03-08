export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: "free" | "self-hosted" | "cloud";
}

export interface Project {
  id: string;
  title: string;
  sourceType: "upload" | "url";
  sourceUrl?: string;
  status: "pending" | "processing" | "completed" | "failed";
  clipCount: number;
  duration: number;
  aspectRatio: string;
  createdAt: string;
  thumbnailUrl?: string;
}

export interface Clip {
  id: string;
  projectId: string;
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  viralityScore: number;
  transcript: string;
  status: "pending" | "rendering" | "completed" | "failed";
  thumbnailUrl?: string;
  hookStrength: number;
  emotionalPeak: number;
  infoDensity: number;
  selfContained: number;
}

export interface FacelessProject {
  id: string;
  title: string;
  template: string;
  status: "pending" | "processing" | "completed" | "failed";
  ttsVoice: string;
  musicMood: string;
  scenes: Scene[];
  createdAt: string;
  thumbnailUrl?: string;
}

export interface Scene {
  id: string;
  narration: string;
  durationEst: number;
  searchKeywords: string[];
  mood: string;
  visualDescription: string;
}

export interface BrandKit {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  captionHighlight: string;
  fontHeading: string;
  fontBody: string;
  hasIntro: boolean;
  hasOutro: boolean;
  hasAudioBranding: boolean;
  createdAt: string;
}

export interface PublishJob {
  id: string;
  clipTitle: string;
  platform: "youtube" | "tiktok" | "instagram" | "facebook" | "linkedin" | "x";
  scheduledAt: string;
  publishedAt?: string;
  status: "scheduled" | "publishing" | "published" | "failed";
  title: string;
  description: string;
  hashtags: string[];
}

export interface CalendarEvent {
  id: string;
  clipTitle: string;
  platform: string;
  date: string;
  time: string;
  status: "scheduled" | "published" | "failed";
}

export interface CompetitorProfile {
  id: string;
  handle: string;
  platform: string;
  followers: number;
  followersGrowth: number;
  avgEngagement: number;
  postsPerWeek: number;
  topContentType: string;
  lastScraped: string;
}

export interface TrendingTopic {
  id: string;
  topic: string;
  platform: string;
  velocity: "rising" | "stable" | "falling";
  totalEngagement: number;
  sourceCount: number;
}

export interface HashtagData {
  tag: string;
  volume: number;
  growth: number;
  competition: "low" | "medium" | "high";
}

export interface PerformanceMetric {
  date: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
}

export interface JobProgress {
  id: string;
  type: "clip" | "faceless" | "publish" | "scrape";
  title: string;
  progress: number;
  stage: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
}

export interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  connected: boolean;
  connectedAt?: string;
}

export type ChatMode = "create" | "generate" | "compose" | "research";

export interface ChatThread {
  id: string;
  title: string;
  mode: ChatMode;
  isArchived: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// Intelligence / Spy Feed types
export interface ScrapedPost {
  id: string;
  competitorId?: string;
  platform: string;
  postUrl: string;
  postType: "video" | "image" | "carousel" | "text";
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  mediaUrl?: string;
  thumbnailUrl?: string;
  likes: number;
  views: number;
  commentsCount: number;
  shares: number;
  saves: number;
  engagementRate: number;
  authorHandle?: string;
  followersAtScrape: number;
  postedAt?: string;
  scrapedAt: string;
  hookScore?: number;
  bodyScore?: number;
  ctaScore?: number;
  extractedHook?: string;
  extractedCta?: string;
  transcript?: string;
  contentCategory?: string;
  sentiment?: "positive" | "negative" | "neutral";
  sentimentConfidence?: number;
  nicheRelevance?: number;
  aiAnalysis?: Record<string, unknown>;
  analyzedAt?: string;
}

export interface DiscoveryResult {
  id: string;
  query: string;
  platform: string;
  postUrl: string;
  postType: "video" | "image" | "carousel" | "text";
  title?: string;
  description?: string;
  caption?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  authorHandle?: string;
  authorFollowers: number;
  likes: number;
  views: number;
  commentsCount: number;
  shares: number;
  engagementRate: number;
  postedAt?: string;
  searchedAt: string;
  hookScore?: number;
  bodyScore?: number;
  ctaScore?: number;
  extractedHook?: string;
  extractedCta?: string;
  transcript?: string;
  contentCategory?: string;
  sentiment?: "positive" | "negative" | "neutral";
  nicheRelevance?: number;
  aiAnalysis?: Record<string, unknown>;
  analyzedAt?: string;
}

export type AssetType = "image" | "video" | "audio";

export interface CreativeAsset {
  id: string;
  name: string;
  type: AssetType;
  projectId?: string;
  projectName: string;
  prompt: string;
  model: string;
  resolution?: string;
  duration?: string;
  fileSize: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
}
