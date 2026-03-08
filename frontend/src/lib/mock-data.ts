import type {
  Project, Clip, FacelessProject, BrandKit, PublishJob,
  CalendarEvent, CompetitorProfile, TrendingTopic, HashtagData,
  PerformanceMetric, JobProgress, ApiKey, SocialAccount,
  ScrapedPost, DiscoveryResult,
} from "./types";

export const mockUser = {
  id: "u1",
  name: "Anthony",
  email: "anthony@openclip.dev",
  plan: "self-hosted" as const,
};

export const mockProjects: Project[] = [
  {
    id: "p1",
    title: "Joe Rogan #2109 - Naval Ravikant",
    sourceType: "url",
    sourceUrl: "https://youtube.com/watch?v=example1",
    status: "completed",
    clipCount: 8,
    duration: 10847,
    aspectRatio: "9:16",
    createdAt: "2026-03-06T14:30:00Z",
  },
  {
    id: "p2",
    title: "Y Combinator Startup School 2026",
    sourceType: "url",
    sourceUrl: "https://youtube.com/watch?v=example2",
    status: "processing",
    clipCount: 0,
    duration: 5412,
    aspectRatio: "9:16",
    createdAt: "2026-03-07T09:15:00Z",
  },
  {
    id: "p3",
    title: "Product Demo - Q1 Review",
    sourceType: "upload",
    status: "completed",
    clipCount: 5,
    duration: 3600,
    aspectRatio: "1:1",
    createdAt: "2026-03-05T11:00:00Z",
  },
  {
    id: "p4",
    title: "Lex Fridman #421 - Sam Altman",
    sourceType: "url",
    sourceUrl: "https://youtube.com/watch?v=example4",
    status: "completed",
    clipCount: 12,
    duration: 14400,
    aspectRatio: "9:16",
    createdAt: "2026-03-04T16:45:00Z",
  },
  {
    id: "p5",
    title: "Team Standup Recording",
    sourceType: "upload",
    status: "failed",
    clipCount: 0,
    duration: 1800,
    aspectRatio: "16:9",
    createdAt: "2026-03-03T08:00:00Z",
  },
];

export const mockClips: Clip[] = [
  {
    id: "c1", projectId: "p1", title: "The secret to happiness is low expectations",
    startTime: 1234, endTime: 1294, duration: 60, viralityScore: 94,
    transcript: "Naval explains why lowering expectations paradoxically leads to greater happiness and fulfillment in life...",
    status: "completed", hookStrength: 95, emotionalPeak: 90, infoDensity: 88, selfContained: 96,
  },
  {
    id: "c2", projectId: "p1", title: "How to get rich without getting lucky",
    startTime: 3456, endTime: 3516, duration: 60, viralityScore: 91,
    transcript: "The four kinds of luck and how specific knowledge combined with leverage creates wealth...",
    status: "completed", hookStrength: 92, emotionalPeak: 85, infoDensity: 95, selfContained: 90,
  },
  {
    id: "c3", projectId: "p1", title: "Meditation changed everything for me",
    startTime: 5678, endTime: 5708, duration: 30, viralityScore: 87,
    transcript: "Naval describes his meditation practice and how 60 days of consistent practice transformed his thinking...",
    status: "completed", hookStrength: 88, emotionalPeak: 92, infoDensity: 78, selfContained: 85,
  },
  {
    id: "c4", projectId: "p1", title: "Why I read the same books over and over",
    startTime: 7890, endTime: 7950, duration: 60, viralityScore: 83,
    transcript: "Reading the great books of all time and why rereading is more valuable than reading new material...",
    status: "completed", hookStrength: 80, emotionalPeak: 75, infoDensity: 92, selfContained: 88,
  },
  {
    id: "c5", projectId: "p1", title: "Code and media are the new leverage",
    startTime: 2100, endTime: 2145, duration: 45, viralityScore: 89,
    transcript: "The most interesting forms of leverage are products with no marginal cost of replication...",
    status: "rendering", hookStrength: 90, emotionalPeak: 82, infoDensity: 94, selfContained: 87,
  },
];

export const mockFacelessProjects: FacelessProject[] = [
  {
    id: "f1",
    title: "5 AI Tools That Will Replace Your Job in 2026",
    template: "top-10-listicle",
    status: "completed",
    ttsVoice: "kokoro-af_heart",
    musicMood: "dramatic",
    scenes: [
      { id: "s1", narration: "Artificial intelligence is no longer a buzzword — it's a job killer.", durationEst: 5.2, searchKeywords: ["AI", "robots", "automation"], mood: "dramatic", visualDescription: "Robots working in an office" },
      { id: "s2", narration: "Number five: AI coding assistants are writing better code than junior developers.", durationEst: 8.0, searchKeywords: ["coding", "programming", "computer"], mood: "tense", visualDescription: "Code on screen" },
      { id: "s3", narration: "Number four: AI customer service bots now resolve 80% of tickets.", durationEst: 7.5, searchKeywords: ["customer service", "chatbot", "headset"], mood: "informative", visualDescription: "Customer service center" },
    ],
    createdAt: "2026-03-06T10:00:00Z",
  },
  {
    id: "f2",
    title: "The Scariest Deep Sea Creatures Ever Found",
    template: "scary-story",
    status: "processing",
    ttsVoice: "chatterbox-deep",
    musicMood: "eerie",
    scenes: [],
    createdAt: "2026-03-07T08:30:00Z",
  },
  {
    id: "f3",
    title: "How the Pyramids Were Actually Built",
    template: "documentary",
    status: "completed",
    ttsVoice: "kokoro-bf_narrator",
    musicMood: "cinematic",
    scenes: [],
    createdAt: "2026-03-05T15:20:00Z",
  },
];

export const mockBrandKits: BrandKit[] = [
  {
    id: "b1", name: "Main Channel", primaryColor: "#7c3aed", secondaryColor: "#a78bfa",
    accentColor: "#f59e0b", captionHighlight: "#7c3aed", fontHeading: "Outfit",
    fontBody: "Inter", hasIntro: true, hasOutro: true, hasAudioBranding: true,
    createdAt: "2026-02-15T10:00:00Z",
  },
  {
    id: "b2", name: "Tech Reviews", primaryColor: "#0ea5e9", secondaryColor: "#38bdf8",
    accentColor: "#22c55e", captionHighlight: "#0ea5e9", fontHeading: "Space Grotesk",
    fontBody: "Inter", hasIntro: true, hasOutro: false, hasAudioBranding: false,
    createdAt: "2026-02-20T14:00:00Z",
  },
  {
    id: "b3", name: "Client - FitnessCo", primaryColor: "#ef4444", secondaryColor: "#f87171",
    accentColor: "#fbbf24", captionHighlight: "#ef4444", fontHeading: "Montserrat",
    fontBody: "Open Sans", hasIntro: true, hasOutro: true, hasAudioBranding: true,
    createdAt: "2026-03-01T09:00:00Z",
  },
];

export const mockPublishJobs: PublishJob[] = [
  {
    id: "pj1", clipTitle: "The secret to happiness", platform: "youtube",
    scheduledAt: "2026-03-08T14:00:00Z", status: "scheduled",
    title: "The Secret to Happiness Is Low Expectations #shorts",
    description: "Naval Ravikant explains his philosophy on happiness...",
    hashtags: ["#naval", "#happiness", "#philosophy", "#shorts"],
  },
  {
    id: "pj2", clipTitle: "The secret to happiness", platform: "tiktok",
    scheduledAt: "2026-03-08T15:00:00Z", status: "scheduled",
    title: "Naval on Happiness",
    description: "This will change how you think about happiness",
    hashtags: ["#naval", "#happiness", "#mindset", "#fyp"],
  },
  {
    id: "pj3", clipTitle: "How to get rich without getting lucky", platform: "instagram",
    scheduledAt: "2026-03-07T12:00:00Z", publishedAt: "2026-03-07T12:01:00Z",
    status: "published",
    title: "How to get rich without getting lucky",
    description: "Naval breaks down the 4 types of luck...",
    hashtags: ["#wealth", "#naval", "#reels", "#entrepreneur"],
  },
  {
    id: "pj4", clipTitle: "Code and media are the new leverage", platform: "linkedin",
    scheduledAt: "2026-03-09T09:00:00Z", status: "scheduled",
    title: "Why Code and Media Are the Ultimate Leverage",
    description: "Products with zero marginal cost of replication...",
    hashtags: ["#startups", "#tech", "#leverage"],
  },
];

export const mockCalendarEvents: CalendarEvent[] = [
  { id: "ce1", clipTitle: "The secret to happiness", platform: "youtube", date: "2026-03-08", time: "14:00", status: "scheduled" },
  { id: "ce2", clipTitle: "The secret to happiness", platform: "tiktok", date: "2026-03-08", time: "15:00", status: "scheduled" },
  { id: "ce3", clipTitle: "How to get rich", platform: "instagram", date: "2026-03-07", time: "12:00", status: "published" },
  { id: "ce4", clipTitle: "Code and media", platform: "linkedin", date: "2026-03-09", time: "09:00", status: "scheduled" },
  { id: "ce5", clipTitle: "AI tools replacing jobs", platform: "youtube", date: "2026-03-10", time: "16:00", status: "scheduled" },
  { id: "ce6", clipTitle: "AI tools replacing jobs", platform: "tiktok", date: "2026-03-10", time: "17:00", status: "scheduled" },
  { id: "ce7", clipTitle: "Meditation changed everything", platform: "instagram", date: "2026-03-11", time: "10:00", status: "scheduled" },
];

export const mockCompetitors: CompetitorProfile[] = [
  { id: "cp1", handle: "@garyvee", platform: "tiktok", followers: 12400000, followersGrowth: 2.3, avgEngagement: 4.8, postsPerWeek: 14, topContentType: "motivational", lastScraped: "2026-03-07T06:00:00Z" },
  { id: "cp2", handle: "@hubaborhidi", platform: "youtube", followers: 890000, followersGrowth: 5.1, avgEngagement: 6.2, postsPerWeek: 3, topContentType: "educational", lastScraped: "2026-03-07T06:00:00Z" },
  { id: "cp3", handle: "@alexhormozi", platform: "instagram", followers: 3200000, followersGrowth: 3.7, avgEngagement: 5.5, postsPerWeek: 7, topContentType: "business", lastScraped: "2026-03-07T06:00:00Z" },
  { id: "cp4", handle: "@mkbhd", platform: "youtube", followers: 19800000, followersGrowth: 0.8, avgEngagement: 3.2, postsPerWeek: 2, topContentType: "tech-review", lastScraped: "2026-03-06T18:00:00Z" },
];

export const mockTrending: TrendingTopic[] = [
  { id: "t1", topic: "AI Agents replacing SaaS", platform: "youtube", velocity: "rising", totalEngagement: 2400000, sourceCount: 847 },
  { id: "t2", topic: "Vibe coding", platform: "tiktok", velocity: "rising", totalEngagement: 5100000, sourceCount: 2341 },
  { id: "t3", topic: "Morning routine optimization", platform: "instagram", velocity: "stable", totalEngagement: 890000, sourceCount: 456 },
  { id: "t4", topic: "Open source AI models", platform: "youtube", velocity: "rising", totalEngagement: 1200000, sourceCount: 623 },
  { id: "t5", topic: "Solo founder to $1M ARR", platform: "x", velocity: "rising", totalEngagement: 3400000, sourceCount: 1892 },
];

export const mockHashtags: HashtagData[] = [
  { tag: "#ai", volume: 45000000, growth: 12.3, competition: "high" },
  { tag: "#shorts", volume: 89000000, growth: 3.1, competition: "high" },
  { tag: "#entrepreneur", volume: 23000000, growth: 5.7, competition: "medium" },
  { tag: "#productivity", volume: 18000000, growth: 8.2, competition: "medium" },
  { tag: "#facelesschannel", volume: 2100000, growth: 34.5, competition: "low" },
  { tag: "#aitools", volume: 8900000, growth: 22.1, competition: "medium" },
  { tag: "#passiveincome", volume: 15000000, growth: 6.8, competition: "medium" },
  { tag: "#contentcreator", volume: 31000000, growth: 4.2, competition: "high" },
];

export const mockPerformance: PerformanceMetric[] = [
  { date: "2026-03-01", views: 12400, likes: 890, shares: 120, comments: 45 },
  { date: "2026-03-02", views: 15600, likes: 1120, shares: 180, comments: 67 },
  { date: "2026-03-03", views: 8900, likes: 640, shares: 85, comments: 32 },
  { date: "2026-03-04", views: 23100, likes: 1890, shares: 340, comments: 112 },
  { date: "2026-03-05", views: 19800, likes: 1450, shares: 210, comments: 89 },
  { date: "2026-03-06", views: 31200, likes: 2340, shares: 420, comments: 156 },
  { date: "2026-03-07", views: 27500, likes: 2010, shares: 380, comments: 134 },
];

export const mockJobs: JobProgress[] = [
  { id: "j1", type: "clip", title: "Y Combinator Startup School 2026", progress: 67, stage: "Transcribing with WhisperX", status: "running", startedAt: "2026-03-07T09:15:00Z" },
  { id: "j2", type: "faceless", title: "The Scariest Deep Sea Creatures", progress: 34, stage: "Generating TTS narration", status: "running", startedAt: "2026-03-07T08:30:00Z" },
  { id: "j3", type: "publish", title: "Publishing to Instagram", progress: 100, stage: "Published", status: "completed", startedAt: "2026-03-07T12:00:00Z" },
];

export const mockApiKeys: ApiKey[] = [
  { id: "ak1", name: "Production", prefix: "oc_prod_7x8k", createdAt: "2026-02-01T10:00:00Z", lastUsed: "2026-03-07T08:45:00Z" },
  { id: "ak2", name: "Development", prefix: "oc_dev_3m2n", createdAt: "2026-02-15T14:00:00Z", lastUsed: "2026-03-06T22:30:00Z" },
];

export const mockSocialAccounts: SocialAccount[] = [
  { id: "sa1", platform: "youtube", handle: "@openclip", connected: true, connectedAt: "2026-02-20T10:00:00Z" },
  { id: "sa2", platform: "tiktok", handle: "@openclip", connected: true, connectedAt: "2026-02-20T10:05:00Z" },
  { id: "sa3", platform: "instagram", handle: "@openclip.ai", connected: true, connectedAt: "2026-02-22T09:00:00Z" },
  { id: "sa4", platform: "linkedin", handle: "OpenClip", connected: false },
  { id: "sa5", platform: "x", handle: "@openclip_ai", connected: false },
  { id: "sa6", platform: "facebook", handle: "OpenClip", connected: false },
];

export const mockScrapedPosts: ScrapedPost[] = [
  {
    id: "sp1", platform: "youtube", postUrl: "https://youtube.com/watch?v=ex1", postType: "video",
    caption: "How I Built a $10M SaaS in 12 Months (The EXACT Playbook) — Most founders overcomplicate this. Here's the truth about building profitable software companies without VC funding.",
    hashtags: ["#saas", "#startup", "#entrepreneur"], mentions: [],
    thumbnailUrl: undefined, mediaUrl: undefined,
    likes: 45200, views: 1200000, commentsCount: 3400, shares: 8900, saves: 12000,
    engagementRate: 0.048, authorHandle: "alexhormozi", followersAtScrape: 2800000,
    postedAt: "2026-03-05T10:00:00Z", scrapedAt: "2026-03-06T14:00:00Z",
    hookScore: 92, bodyScore: 85, ctaScore: 78,
    extractedHook: "Most founders overcomplicate this", extractedCta: "Link in bio for the free playbook",
    contentCategory: "educational", sentiment: "positive", sentimentConfidence: 0.94, nicheRelevance: 88,
    analyzedAt: "2026-03-06T14:05:00Z", aiAnalysis: {},
  },
  {
    id: "sp2", platform: "tiktok", postUrl: "https://tiktok.com/@creator/video/123", postType: "video",
    caption: "POV: You just automated your entire content workflow with AI and now you have 6 hours back per week",
    hashtags: ["#aitools", "#contentcreation", "#productivity"], mentions: [],
    thumbnailUrl: undefined, mediaUrl: undefined,
    likes: 89000, views: 2100000, commentsCount: 5600, shares: 23000, saves: 31000,
    engagementRate: 0.071, authorHandle: "techcreator", followersAtScrape: 1500000,
    postedAt: "2026-03-04T18:00:00Z", scrapedAt: "2026-03-06T14:00:00Z",
    hookScore: 95, bodyScore: 72, ctaScore: 65,
    extractedHook: "POV: You just automated your entire content workflow",
    extractedCta: "Comment 'AI' for the tool list",
    contentCategory: "entertainment", sentiment: "positive", sentimentConfidence: 0.89, nicheRelevance: 92,
    analyzedAt: "2026-03-06T14:05:00Z", aiAnalysis: {},
  },
  {
    id: "sp3", platform: "instagram", postUrl: "https://instagram.com/p/abc123", postType: "carousel",
    caption: "5 hooks that got me 10M+ views this month (save this for later). Swipe to see each one with examples.",
    hashtags: ["#hooks", "#viralcontent", "#contentcreator"], mentions: ["@hookmaster"],
    thumbnailUrl: undefined, mediaUrl: undefined,
    likes: 34000, views: 890000, commentsCount: 2100, shares: 15000, saves: 42000,
    engagementRate: 0.065, authorHandle: "contentstrategist", followersAtScrape: 890000,
    postedAt: "2026-03-03T12:00:00Z", scrapedAt: "2026-03-06T14:00:00Z",
    hookScore: 88, bodyScore: 90, ctaScore: 82,
    extractedHook: "5 hooks that got me 10M+ views this month",
    extractedCta: "Save this for later",
    contentCategory: "educational", sentiment: "positive", sentimentConfidence: 0.91, nicheRelevance: 95,
    analyzedAt: "2026-03-06T14:05:00Z", aiAnalysis: {},
  },
  {
    id: "sp4", platform: "twitter", postUrl: "https://x.com/creator/status/456", postType: "text",
    caption: "Hot take: 90% of 'AI video tools' are just wrappers around FFmpeg with a ChatGPT API call. The real innovation is in understanding what makes content actually perform.",
    hashtags: [], mentions: [],
    thumbnailUrl: undefined, mediaUrl: undefined,
    likes: 12000, views: 450000, commentsCount: 890, shares: 3400, saves: 0,
    engagementRate: 0.036, authorHandle: "techinnovator", followersAtScrape: 320000,
    postedAt: "2026-03-06T08:00:00Z", scrapedAt: "2026-03-06T14:00:00Z",
    hookScore: 91, bodyScore: 68, ctaScore: 15,
    extractedHook: "Hot take: 90% of 'AI video tools' are just wrappers",
    extractedCta: "",
    contentCategory: "entertainment", sentiment: "negative", sentimentConfidence: 0.72, nicheRelevance: 85,
    analyzedAt: "2026-03-06T14:05:00Z", aiAnalysis: {},
  },
  {
    id: "sp5", platform: "reddit", postUrl: "https://reddit.com/r/SaaS/comments/xyz", postType: "text",
    caption: "I spent 6 months building a faceless video tool. Here's what I learned about the creator economy and why most tools fail at the one thing that matters: caption accuracy.",
    hashtags: [], mentions: [],
    thumbnailUrl: undefined, mediaUrl: undefined,
    likes: 2400, views: 89000, commentsCount: 340, shares: 120, saves: 0,
    engagementRate: 0.032, authorHandle: "u/saasbuilder", followersAtScrape: 0,
    postedAt: "2026-03-02T16:00:00Z", scrapedAt: "2026-03-06T14:00:00Z",
    hookScore: 76, bodyScore: 92, ctaScore: 45,
    extractedHook: "I spent 6 months building a faceless video tool",
    extractedCta: "Check out the demo link in comments",
    contentCategory: "storytelling", sentiment: "positive", sentimentConfidence: 0.83, nicheRelevance: 98,
    analyzedAt: "2026-03-06T14:05:00Z", aiAnalysis: {},
  },
];

export const mockDiscoveryResults: DiscoveryResult[] = [
  {
    id: "dr1", query: "AI video editing tools", platform: "youtube",
    postUrl: "https://youtube.com/watch?v=disc1", postType: "video",
    title: "I Tested 50 AI Video Editors So You Don't Have To",
    description: "Comprehensive comparison of every major AI video editing tool in 2026.",
    caption: "I tested 50 AI video editors and ranked them from worst to best.",
    authorHandle: "techreviewer", authorFollowers: 1200000,
    likes: 67000, views: 2300000, commentsCount: 4500, shares: 12000,
    engagementRate: 0.036, postedAt: "2026-03-01T10:00:00Z", searchedAt: "2026-03-06T15:00:00Z",
    hookScore: 89, bodyScore: 86, ctaScore: 72, contentCategory: "educational",
    sentiment: "positive", nicheRelevance: 96,
  },
  {
    id: "dr2", query: "AI video editing tools", platform: "tiktok",
    postUrl: "https://tiktok.com/@reviewer/video/disc2", postType: "video",
    title: "This FREE AI tool replaced my $300/mo editing software",
    description: undefined,
    caption: "This FREE AI tool replaced my $300/mo editing software. And it's open source.",
    authorHandle: "creatorhacks", authorFollowers: 890000,
    likes: 120000, views: 3400000, commentsCount: 8900, shares: 45000,
    engagementRate: 0.051, postedAt: "2026-03-03T14:00:00Z", searchedAt: "2026-03-06T15:00:00Z",
    hookScore: 97, bodyScore: 65, ctaScore: 58, contentCategory: "promotional",
    sentiment: "positive", nicheRelevance: 90,
  },
  {
    id: "dr3", query: "AI video editing tools", platform: "reddit",
    postUrl: "https://reddit.com/r/VideoEditing/comments/disc3", postType: "text",
    title: "Honest review: AI video editors are still terrible at one thing",
    description: "After testing 20+ AI video editors, the caption sync is always off.",
    caption: "After testing 20+ AI video editors, here's my honest take on where they all fail.",
    authorHandle: "u/videoproducer", authorFollowers: 0,
    likes: 3200, views: 120000, commentsCount: 890, shares: 240,
    engagementRate: 0.036, postedAt: "2026-02-28T20:00:00Z", searchedAt: "2026-03-06T15:00:00Z",
    hookScore: 82, bodyScore: 91, ctaScore: 30, contentCategory: "educational",
    sentiment: "negative", nicheRelevance: 99,
  },
  {
    id: "dr4", query: "AI video editing tools", platform: "instagram",
    postUrl: "https://instagram.com/reel/disc4", postType: "video",
    title: "My AI editing workflow that saves 20 hours/week",
    description: undefined,
    caption: "My exact AI editing workflow that saves me 20 hours every single week. Follow for more creator tips.",
    authorHandle: "productivitycreator", authorFollowers: 450000,
    likes: 28000, views: 670000, commentsCount: 1200, shares: 8900,
    engagementRate: 0.085, postedAt: "2026-03-04T16:00:00Z", searchedAt: "2026-03-06T15:00:00Z",
    hookScore: 85, bodyScore: 78, ctaScore: 88, contentCategory: "tutorial",
    sentiment: "positive", nicheRelevance: 87,
  },
];
