# OpenClip Frontend Dashboard — Complete Build Prompt

> **Purpose:** This document is a comprehensive, step-by-step instruction for an AI agent to build the entire OpenClip frontend dashboard from scratch. Every page, component, data model, mock, and interaction is specified. Follow this document exactly.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Mock Authentication System](#2-mock-authentication-system)
3. [Mock Data Layer](#3-mock-data-layer)
4. [App Layout & Navigation](#4-app-layout--navigation)
5. [Pages & Features](#5-pages--features)
6. [Shared Components](#6-shared-components)
7. [Design System & Styling](#7-design-system--styling)
8. [File Structure](#8-file-structure)

---

## 1. Project Setup

### Tech Stack (Non-Negotiable)

| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 15 (App Router) | Framework |
| React | 19 | UI Library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | latest | Component primitives |
| Lucide React | latest | Icons |
| TanStack React Query | 5.x | Data fetching/caching |
| Recharts | 2.x | Charts & analytics |
| @dnd-kit/core + @dnd-kit/sortable | latest | Drag-and-drop |
| date-fns | latest | Date formatting |
| zustand | latest | Global state (editor, auth) |
| next-themes | latest | Dark/light mode |
| sonner | latest | Toast notifications |
| nuqs | latest | URL search params state |

### Initialize Project

```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd frontend
```

### Install Dependencies

```bash
# Core UI
npx shadcn@latest init

# Install ALL these shadcn/ui components (run each):
npx shadcn@latest add button card input label textarea select tabs dialog sheet dropdown-menu avatar badge separator progress slider switch checkbox radio-group tooltip popover command calendar table scroll-area alert alert-dialog skeleton toggle toggle-group collapsible breadcrumb pagination navigation-menu sidebar sonner chart

# Additional packages
npm install @tanstack/react-query recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns zustand next-themes nuqs lucide-react
```

### Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=OpenClip
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MOCK_MODE=true
```

---

## 2. Mock Authentication System

Build a complete mock auth system that mimics JWT authentication. This must be swappable with a real backend later by simply replacing the auth provider functions.

### Auth Store (`src/lib/stores/auth-store.ts`)

Use Zustand for auth state:

```typescript
interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: "owner" | "admin" | "editor" | "viewer"
  created_at: string
  workspace_id: string
  workspace_name: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => void
}
```

### Mock Auth Behavior

- **Login:** Accept any email/password combination. Generate a fake JWT token (`mock_jwt_token_xxxx`). Set the mock user:
  - `id`: `"usr_mock_001"`
  - `email`: whatever was entered
  - `name`: derived from email (before @)
  - `avatar_url`: `null`
  - `role`: `"owner"`
  - `workspace_id`: `"ws_mock_001"`
  - `workspace_name`: `"My Workspace"`
- **Register:** Same as login, but show a success toast "Account created!"
- **Logout:** Clear state, redirect to `/login`
- **Token persistence:** Store token in `localStorage` under key `openclip_token`. On app load, check localStorage and auto-restore session.
- **Auth guard:** Create a `useRequireAuth()` hook that redirects to `/login` if not authenticated.

### Auth Pages

#### `/login` page
- Centered card (max-w-md), dark background
- OpenClip logo/wordmark at top (text-based: "OpenClip" in bold + tagline "AI Video Creation Platform")
- Email input field
- Password input field
- "Sign In" primary button (full width)
- "Don't have an account? Sign up" link → `/register`
- On submit: call `login()`, redirect to `/dashboard`
- Show toast on error

#### `/register` page
- Same layout as login
- Name input field
- Email input field
- Password input field
- Confirm Password input field
- "Create Account" primary button (full width)
- "Already have an account? Sign in" link → `/login`
- On submit: call `register()`, redirect to `/dashboard`

### Auth Middleware (`src/middleware.ts`)

Protect all routes under `/(dashboard)` group. If no token in cookies/localStorage, redirect to `/login`. Public routes: `/login`, `/register`.

---

## 3. Mock Data Layer

Create a comprehensive mock data layer at `src/lib/mock-data/`. Every entity must have realistic, pre-populated data. This data will power the entire frontend.

### API Client (`src/lib/api/client.ts`)

Create an API client that checks `NEXT_PUBLIC_MOCK_MODE`:
- If `true`: return mock data from the mock-data files with realistic `await new Promise(resolve => setTimeout(resolve, 300-800))` delays
- If `false`: make real HTTP requests to `NEXT_PUBLIC_API_URL`

All API functions must be typed with request/response interfaces. Export a single `api` object with namespaced methods.

### Mock Data Files

#### `src/lib/mock-data/projects.ts`

Generate **8 mock projects** with realistic data:

```typescript
interface Project {
  id: string                    // "proj_001" through "proj_008"
  title: string                 // Realistic video titles
  source_type: "upload" | "url"
  source_url: string | null     // YouTube URLs for url type
  status: "pending" | "processing" | "completed" | "failed"
  thumbnail_url: string         // Use picsum.photos placeholder images
  duration: number              // seconds (120-3600)
  file_size: number             // bytes
  clip_count: number            // 0-12
  created_at: string            // ISO dates spread over last 30 days
  updated_at: string
}
```

Example titles: "How I Built a $10M SaaS in 12 Months", "The Psychology of Viral Content", "React Server Components Deep Dive", "Day in My Life as a Remote Developer", "Why Most Startups Fail: A Data Analysis", "Best Productivity Tools for 2026", "The Future of AI in Content Creation", "Building in Public: Month 3 Update"

Statuses: 5 completed, 1 processing, 1 pending, 1 failed

#### `src/lib/mock-data/clips.ts`

Generate **24 mock clips** (3 per completed project):

```typescript
interface Clip {
  id: string                     // "clip_001" through "clip_024"
  project_id: string             // FK to project
  title: string                  // AI-generated clip title
  start_time: number             // seconds
  end_time: number               // seconds
  duration: number               // 15-90 seconds
  virality_score: number         // 0.0-1.0 (e.g., 0.87)
  transcript: string             // 2-4 sentences of realistic transcript
  thumbnail_url: string          // picsum.photos
  clip_url: string               // "#" (non-functional)
  caption_style: string          // "karaoke" | "bold" | "minimal" | etc.
  aspect_ratio: "9:16" | "16:9" | "1:1" | "4:5"
  status: "pending" | "rendering" | "completed" | "failed"
  brand_kit_id: string | null
  created_at: string
}
```

#### `src/lib/mock-data/jobs.ts`

Generate **10 mock jobs**:

```typescript
interface Job {
  id: string                     // "job_001" through "job_010"
  project_id: string | null
  type: "clip" | "faceless" | "reframe" | "caption" | "publish" | "batch"
  status: "pending" | "started" | "progress" | "success" | "failure"
  progress: number               // 0-100
  message: string                // "Transcribing audio...", "Generating clips...", etc.
  result: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
```

Include realistic progress messages:
- "Downloading video..." (10%)
- "Extracting audio..." (20%)
- "Transcribing with WhisperX..." (35%)
- "Analyzing content with AI..." (50%)
- "Generating clips..." (65%)
- "Rendering clip 2 of 5..." (75%)
- "Applying captions..." (85%)
- "Uploading to storage..." (95%)
- "Complete!" (100%)

#### `src/lib/mock-data/faceless-projects.ts`

Generate **5 mock faceless projects**:

```typescript
interface FacelessProject {
  id: string
  title: string                  // "5 Mind-Blowing Space Facts", "Reddit AITA: The Wedding Disaster", etc.
  topic: string
  template: "reddit_story" | "documentary" | "listicle" | "motivational" | "scary_story" | "educational"
  style: string
  voice: string                  // "af_heart" | "bf_emma" | "am_adam" | "af_nova" | etc.
  voice_label: string            // "Heart (Female)" | "Emma (Female)" | etc.
  music_mood: string             // "calm" | "dramatic" | "upbeat" | "mysterious" | "dark" | "inspirational"
  duration: number               // target duration in seconds
  status: "pending" | "scripting" | "generating_audio" | "assembling" | "completed" | "failed"
  progress: number               // 0-100
  script: FacelessScript | null
  output_url: string | null
  thumbnail_url: string | null
  created_at: string
}

interface FacelessScript {
  title: string
  hook: string
  scenes: FacelessScene[]
  outro: string
  metadata: {
    total_duration_est: number
    scene_count: number
    word_count: number
    reading_speed_wpm: number
  }
}

interface FacelessScene {
  scene_number: number
  narration: string              // 1-3 sentences
  duration_est: number           // seconds
  visual_description: string
  search_keywords: string[]
  mood: string
  transition: "cut" | "fade" | "dissolve" | "wipe" | "zoom"
}
```

Create 1 complete script for the first faceless project with 6-8 scenes.

#### `src/lib/mock-data/brand-kits.ts`

Generate **3 mock brand kits**:

```typescript
interface BrandKit {
  id: string
  name: string                    // "Tech Channel", "Lifestyle Brand", "Finance Pro"
  is_default: boolean             // first one is default
  config: {
    logos: {
      light: string | null        // placeholder image URL or null
      dark: string | null
      position: "top-right" | "top-left" | "bottom-right" | "bottom-left"
      opacity: number             // 0.0-1.0
    }
    colors: {
      primary: string             // hex
      secondary: string
      accent: string
      caption_highlight: string
      caption_bg: string          // rgba
    }
    fonts: {
      heading: string | null      // font name or null
      body: string | null
      caption: string | null
    }
    intro_video: string | null
    outro_video: string | null
    caption_style: {
      preset: string              // "karaoke" | "bold" | etc.
      max_words: number
      position: string
      emoji: boolean
    }
  }
  created_at: string
}
```

Example kits:
1. **"Tech Channel"** — Primary: #6366f1 (indigo), Accent: #06b6d4 (cyan), Caption: karaoke, Position: top-right
2. **"Lifestyle Brand"** — Primary: #ec4899 (pink), Accent: #f59e0b (amber), Caption: bold, Position: bottom-right
3. **"Finance Pro"** — Primary: #059669 (emerald), Accent: #1d4ed8 (blue), Caption: minimal, Position: top-left

#### `src/lib/mock-data/social-accounts.ts`

Generate **4 mock connected social accounts**:

```typescript
interface SocialAccount {
  id: string
  platform: "youtube" | "tiktok" | "instagram" | "facebook" | "linkedin" | "x"
  platform_username: string       // "@openclip_demo"
  platform_display_name: string   // "OpenClip Demo"
  platform_avatar_url: string     // placeholder
  is_active: boolean
  connected_at: string
}
```

Accounts: YouTube (active), TikTok (active), Instagram (active), X (disconnected/inactive)

#### `src/lib/mock-data/scheduled-posts.ts`

Generate **15 mock scheduled posts** spread across the current month:

```typescript
interface ScheduledPost {
  id: string
  clip_id: string
  clip_title: string
  clip_thumbnail_url: string
  platform: "youtube" | "tiktok" | "instagram" | "facebook" | "linkedin" | "x"
  account_id: string
  title: string
  description: string
  hashtags: string[]
  scheduled_at: string            // ISO date, spread across current month
  published_at: string | null
  platform_post_url: string | null
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled"
  created_at: string
}
```

Mix: 5 published (past dates), 8 scheduled (future dates), 1 failed, 1 draft

#### `src/lib/mock-data/analytics.ts`

Generate realistic analytics data:

```typescript
interface PostMetric {
  id: string
  post_id: string
  platform: string
  snapshot_at: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  engagement_rate: number          // percentage
}

interface AnalyticsOverview {
  total_views: number              // e.g., 127430
  total_engagement: number         // e.g., 8921
  avg_engagement_rate: number      // e.g., 4.7
  total_posts: number              // e.g., 15
  top_platform: string             // "tiktok"
  views_change_pct: number         // e.g., +12.3 (vs last period)
  engagement_change_pct: number    // e.g., +5.1
}

// Time-series data for charts (last 30 days, one entry per day)
interface DailyMetric {
  date: string                     // "2026-02-01", "2026-02-02", etc.
  views: number
  likes: number
  comments: number
  shares: number
  engagement_rate: number
}

// Best posting times heatmap (7 days x 24 hours)
interface PostingTimeHeatmap {
  day: number                      // 0=Mon, 6=Sun
  hour: number                     // 0-23
  engagement_rate: number          // avg engagement rate for this time slot
}

// Per-platform breakdown
interface PlatformBreakdown {
  platform: string
  views: number
  likes: number
  comments: number
  engagement_rate: number
  post_count: number
}
```

Generate 30 days of daily metrics with realistic trends (slight upward trend, weekend dips). Generate full 7x24 heatmap data. Generate per-platform breakdown for YouTube, TikTok, Instagram, X.

#### `src/lib/mock-data/competitor-analytics.ts`

Generate **3 mock competitors** with analytics:

```typescript
interface CompetitorProfile {
  id: string
  platform: string
  username: string
  display_name: string
  avatar_url: string
  followers: number
  engagement_rate: number
  avg_views: number
  posts_per_week: number
  niche: string
}

interface CompetitorPost {
  id: string
  competitor_id: string
  title: string
  thumbnail_url: string
  views: number
  likes: number
  comments: number
  engagement_rate: number
  published_at: string
  url: string
}

interface CompetitorDailyMetric {
  date: string
  competitor_id: string
  views: number
  likes: number
  comments: number
  followers: number
  engagement_rate: number
}

interface TopicCluster {
  topic: string
  post_count: number
  avg_engagement_rate: number
  top_words: string[]
}
```

Competitors:
1. **"TechInsights"** (YouTube) — 250K followers, 5.2% ER, 45K avg views
2. **"ViralClips"** (TikTok) — 1.2M followers, 8.1% ER, 180K avg views
3. **"BizGrowth"** (Instagram) — 85K followers, 3.8% ER, 12K avg views

Generate 30 days of daily metrics per competitor. Generate 5 topic clusters.

#### `src/lib/mock-data/trending.ts`

Generate trending data:

```typescript
interface DetectedTrend {
  id: string
  title: string                    // "AI Video Editing Tools 2026"
  description: string
  category: string                 // "tech", "business", "lifestyle"
  velocity_score: number           // 0-100 (how fast it's growing)
  confidence: number               // 0-1
  platforms: string[]              // ["youtube", "tiktok"]
  related_hashtags: string[]
  detected_at: string
  peak_estimated_at: string        // When trend is expected to peak
  status: "emerging" | "growing" | "peaking" | "declining"
}

interface TrendingHashtag {
  id: string
  tag: string                      // "#AIvideoediting"
  platform: string
  volume_score: number             // 0-100
  engagement_score: number         // 0-100
  competition_score: number        // 0-100 (lower = less competition)
  overall_score: number            // composite
  trend_direction: "up" | "stable" | "down"
  posts_7d: number
  avg_engagement_rate: number
}
```

Generate 8 trending topics and 20 trending hashtags.

#### `src/lib/mock-data/webhooks.ts`

Generate **3 mock webhooks**:

```typescript
interface Webhook {
  id: string
  url: string                      // "https://n8n.example.com/webhook/abc123"
  events: string[]                 // ["job.completed", "video.published"]
  is_active: boolean
  failure_count: number
  secret: string                   // "whsec_xxxx...xxxx" (masked)
  created_at: string
}

interface WebhookDelivery {
  id: string
  webhook_id: string
  event_type: string
  status: "delivered" | "failed" | "pending"
  status_code: number | null
  response_body: string | null     // truncated
  attempts: number
  delivered_at: string | null
  created_at: string
}
```

#### `src/lib/mock-data/batches.ts`

Generate **2 mock batches**:

```typescript
interface Batch {
  id: string
  name: string
  total_items: number
  completed_items: number
  failed_items: number
  status: "pending" | "processing" | "completed" | "partial_failure" | "failed"
  created_at: string
}

interface BatchItem {
  id: string
  batch_id: string
  row_index: number
  topic: string
  style: string
  status: "pending" | "queued" | "processing" | "completed" | "failed"
  error_message: string | null
  output_url: string | null
}
```

Batch 1: "Weekly Content — March 2026", 10 items, 8 completed, 1 failed, 1 processing, status: processing
Batch 2: "Reddit Compilation", 5 items, 5 completed, 0 failed, status: completed

#### `src/lib/mock-data/voice-profiles.ts`

Generate **3 mock voice profiles**:

```typescript
interface VoiceProfile {
  id: string
  name: string                     // "My Studio Voice", "Energetic Host", "Calm Narrator"
  engine: "kokoro" | "chatterbox"
  voice_id: string                 // "af_heart", "bf_emma", "am_adam"
  voice_label: string              // "Heart (American Female)", "Emma (British Female)"
  is_cloned: boolean               // false for preset, true for custom
  reference_audio_url: string | null
  sample_audio_url: string | null  // "#"
  created_at: string
}
```

Also create a list of **all available TTS voices**:

```typescript
interface AvailableVoice {
  id: string                       // "af_heart"
  label: string                    // "Heart"
  gender: "male" | "female"
  accent: string                   // "American", "British", "Australian"
  engine: "kokoro" | "chatterbox"
  preview_url: string              // "#"
}
```

Include 8-10 voices: af_heart, af_nova, af_sky, bf_emma, bf_lily, am_adam, am_michael, bm_george, am_narrator, af_sarah.

#### `src/lib/mock-data/workspace.ts`

```typescript
interface Workspace {
  id: string
  name: string
  slug: string
  description: string
  avatar_url: string | null
  owner_id: string
  created_at: string
}

interface WorkspaceMember {
  id: string
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  role: "owner" | "admin" | "editor" | "viewer"
  joined_at: string
}

interface WorkspaceInvitation {
  id: string
  email: string
  role: "admin" | "editor" | "viewer"
  status: "pending" | "accepted" | "declined" | "expired"
  expires_at: string
  created_at: string
}
```

Generate 1 workspace with 4 members (owner + 3 others) and 2 pending invitations.

#### `src/lib/mock-data/api-keys.ts`

```typescript
interface ApiKey {
  id: string
  name: string                     // "Production", "Development", "n8n Integration"
  key_preview: string              // "oc_...a3f2" (last 4 chars visible)
  last_used_at: string | null
  created_at: string
}
```

Generate 3 API keys.

---

## 4. App Layout & Navigation

### Route Groups

```
src/app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx                 ← Sidebar + Header + Main content wrapper
│   ├── page.tsx                   ← Dashboard home (redirects or shows overview)
│   ├── projects/
│   │   ├── page.tsx               ← Projects list
│   │   ├── new/page.tsx           ← Upload / create project
│   │   └── [id]/
│   │       ├── page.tsx           ← Project detail (clips grid)
│   │       └── edit/page.tsx      ← Video editor
│   ├── faceless/
│   │   ├── page.tsx               ← Faceless projects list
│   │   └── new/page.tsx           ← Create faceless video form
│   ├── brands/
│   │   ├── page.tsx               ← Brand kits list
│   │   └── [id]/page.tsx          ← Edit brand kit
│   ├── calendar/
│   │   └── page.tsx               ← Content calendar
│   ├── analytics/
│   │   ├── page.tsx               ← Performance analytics overview
│   │   └── competitors/page.tsx   ← Competitor analytics
│   ├── trending/
│   │   └── page.tsx               ← Trending topics + hashtags
│   ├── batches/
│   │   ├── page.tsx               ← Batch list
│   │   └── [id]/page.tsx          ← Batch detail
│   ├── voices/
│   │   └── page.tsx               ← Voice profiles + TTS settings
│   ├── settings/
│   │   ├── page.tsx               ← General settings
│   │   ├── accounts/page.tsx      ← Social accounts
│   │   ├── api-keys/page.tsx      ← API key management
│   │   ├── webhooks/page.tsx      ← Webhook management
│   │   ├── team/page.tsx          ← Team/workspace members
│   │   └── billing/page.tsx       ← (placeholder — free, shows "Free Forever" banner)
│   └── layout.tsx
└── layout.tsx                     ← Root layout (providers, themes)
```

### Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

Structure:
```
┌────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌───────────────────────────────────┐ │
│ │          │ │ Header                             │ │
│ │          │ │ [Breadcrumb]   [Search] [Notif] [Avatar] │
│ │ Sidebar  │ ├───────────────────────────────────┤ │
│ │          │ │                                   │ │
│ │ Navigation│ │         Main Content Area         │ │
│ │          │ │         (scrollable)               │ │
│ │          │ │                                   │ │
│ │          │ │                                   │ │
│ └──────────┘ └───────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

- Sidebar: Fixed left, 256px wide (`w-64`), collapsible on tablet (icon-only mode 64px), hidden on mobile (sheet overlay)
- Header: Fixed top (within content area), 64px height
- Main content: Scrollable, `p-6` padding

### Sidebar Navigation Items

Use the shadcn/ui `Sidebar` component with these navigation groups:

**Main**
| Icon | Label | Route | Badge |
|------|-------|-------|-------|
| LayoutDashboard | Dashboard | `/` | — |
| Film | Projects | `/projects` | clip count |
| Wand2 | Faceless Studio | `/faceless` | — |
| Layers | Batches | `/batches` | — |

**Content**
| Icon | Label | Route | Badge |
|------|-------|-------|-------|
| CalendarDays | Calendar | `/calendar` | scheduled count |
| BarChart3 | Analytics | `/analytics` | — |
| TrendingUp | Trending | `/trending` | — |
| Users | Competitors | `/analytics/competitors` | — |

**Assets**
| Icon | Label | Route | Badge |
|------|-------|-------|-------|
| Palette | Brand Kits | `/brands` | — |
| Mic2 | Voices | `/voices` | — |

**Settings** (bottom section, separated)
| Icon | Label | Route | Badge |
|------|-------|-------|-------|
| Settings | Settings | `/settings` | — |

Also include at the very bottom:
- User avatar + name + workspace name
- Dark/light mode toggle

### Header Component

- Left: Breadcrumb (auto-generated from route)
- Right: Quick search (Command+K shortcut → command palette dialog), notification bell icon (badge with count "3"), user avatar dropdown (Profile, Settings, API Keys, Logout)

### Mobile Layout (< 640px)

- Sidebar hidden, replaced with hamburger menu button in header that opens sidebar as a sheet (slide from left)
- Bottom navigation bar with 5 items: Dashboard, Projects, Create (Faceless), Calendar, Settings
- Content area: full width, `p-4` padding

---

## 5. Pages & Features

### 5.1 Dashboard Home (`/`)

**Purpose:** Overview of recent activity, quick actions, key metrics.

**Layout:**
```
┌────────────────────────────────────────────────────┐
│ Welcome back, {name}                                │
│ Your workspace overview                             │
├──────────┬──────────┬──────────┬──────────┐        │
│ Total    │ Clips    │ Published│ Processing│        │
│ Projects │ Generated│ Posts    │ Jobs      │        │
│   8      │   24     │   5      │   2       │        │
│ +2 this  │ +8 this  │ +3 this  │           │        │
│ week     │ week     │ week     │           │        │
├──────────┴──────────┴──────────┴──────────┘        │
│                                                     │
│ ┌─── Quick Actions ─────────────────────────────┐  │
│ │ [Upload Video]  [Create Faceless]  [New Batch] │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ ┌─── Recent Projects ──────────────────── View All │
│ │ ProjectCard  ProjectCard  ProjectCard  ProjectCard│
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ ┌─── Active Jobs ──────────────────────────────── │
│ │ JobProgress    JobProgress                       │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ ┌─── Trending Now ──────────────────── View All ─ │
│ │ Trend  Trend  Trend  Trend                       │
│ └───────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

**Components:**
- 4 stat cards at top (use Card with icon, number, subtitle with change percentage and trend arrow)
- Quick action buttons row (3 large buttons with icons)
- Recent projects: horizontal scrollable row of 4 ProjectCard components
- Active jobs: list of JobProgress components (only show in-progress jobs)
- Trending now: 4 small trend cards showing title, velocity score, platforms

### 5.2 Projects List (`/projects`)

**Header:** "Projects" title + "New Project" button (primary)

**Filters row:** Status filter (All, Pending, Processing, Completed, Failed) as tab pills, Search input, Sort dropdown (Newest, Oldest, Title A-Z)

**Content:** Responsive grid of ProjectCard components:
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Each card shows: thumbnail (aspect-video), title, status badge, clip count, duration, created date (relative)
- Click card → navigate to `/projects/{id}`
- Hover shows "View Project" overlay on thumbnail

**Empty state:** Illustration + "No projects yet" + "Upload your first video" button

### 5.3 New Project (`/projects/new`)

**Layout:** Centered form card (max-w-2xl)

**Tabs:** "Upload" | "URL"

**Upload tab:**
- Drag-and-drop zone (dashed border, 200px height, icons, helper text)
- Accepts: MP4, MOV, MKV, WebM
- Max size: 10 GB (display this)
- After file selected: show filename, file size, remove button
- File type validation on drag/drop

**URL tab:**
- URL input field with placeholder "Paste YouTube, Vimeo, or direct video URL"
- URL validation (basic pattern match)

**Common fields (below tabs):**
- Title input (auto-populated from filename or URL)
- Settings collapsible section:
  - Clip Duration: Select (15s, 30s, 60s, 90s, Custom)
  - Aspect Ratio: Select (9:16 TikTok/Reels, 16:9 YouTube, 1:1 Square, 4:5 Instagram)
  - Language: Select (English, Spanish, French, German, Japanese, Korean, Chinese, Portuguese, Arabic, Hindi, + Auto-detect)
  - Brand Kit: Select (None, Tech Channel, Lifestyle Brand, Finance Pro) — from mock brand kits
  - Caption Style: Select (Karaoke, Pop, Fade, Highlight, Minimal, Bold, None)
  - Enable Speaker Detection: Switch toggle (default: on)
  - Enable AI Reframing: Switch toggle (default: on)

**Submit button:** "Create Project & Generate Clips" (primary, full width)

**On submit:** Show toast "Project created!", navigate to `/projects/{id}` which shows the job progress.

### 5.4 Project Detail (`/projects/[id]`)

**Header:** Project title (editable inline), status badge, created date, "Edit in Timeline" button, "Delete" button (destructive), dropdown menu (...) with: Download All Clips, Export XML (Premiere), Export XML (DaVinci)

**If processing:** Show large JobProgress component with progress bar, message, and animated spinner

**If completed:**

**Stats row:** 4 small stat badges (Total Clips: N, Best Score: 0.92, Total Duration: Xm Xs, Avg Score: 0.XX)

**Clips Grid:**
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` layout
- Sort: Score (highest first, default), Duration, Newest
- Each ClipCard shows:
  - Thumbnail (aspect-video container)
  - Play button overlay (centered, semi-transparent)
  - Score badge (top-right, colored: green > 0.8, yellow > 0.5, red < 0.5)
  - Duration badge (bottom-right, dark bg)
  - Title (font-semibold, line-clamp-2)
  - Transcript preview (text-xs, text-muted-foreground, line-clamp-2)
  - Action buttons row: Preview (play icon), Download (download icon), Edit (pencil icon), Publish (share icon)
- Clicking "Preview" opens a dialog with HTML5 video player, title, full transcript, and metadata
- Clicking "Publish" opens PublishDialog (see Calendar section)

### 5.5 Video Editor (`/projects/[id]/edit`)

**Full-screen layout (h-screen, no sidebar):**

```
┌────────────────────────────────────────────────────┐
│ ← Back to Project  │  Project Title  │ [Undo][Redo][Export] │
├────────────────────────────────────┬───────────────┤
│                                    │               │
│         Video Preview              │   Inspector   │
│     (black background,             │   Panel       │
│      centered video)               │   (w-80)      │
│                                    │               │
│                                    │  Clip Props   │
│                                    │  Trim Controls│
│                                    │  Caption Edit │
│                                    │  Style Select │
│                                    │  Brand Kit    │
├────────────────────────────────────┴───────────────┤
│ Timeline (h-48, horizontal scroll)                  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│ │Clip 1│ │Clip 2│ │Clip 3│ │Clip 4│ │Clip 5│      │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
│ ▲ playhead indicator                                │
└────────────────────────────────────────────────────┘
```

**Components:**
- **Top toolbar:** Back button, project title, Undo/Redo buttons (disabled state when no history), Export button (primary)
- **VideoPreview:** HTML5 `<video>` element, black container, play/pause on click, currentTime synced with timeline playhead
- **Inspector Panel** (right side, 320px, only visible when a clip is selected):
  - Clip title (editable input)
  - Virality score (display only, badge)
  - Trim Controls:
    - Start time slider (range input, step 0.1s, shows formatted time MM:SS.s)
    - End time slider (range input, step 0.1s)
    - Duration display (computed)
  - Caption section:
    - Style selector dropdown (Karaoke, Pop, Fade, Highlight, Minimal, Bold, Custom)
    - Transcript textarea (editable, for fixing caption text)
  - Brand Kit selector dropdown
  - Aspect Ratio display
- **Timeline:** Horizontal scrollable track, clips as colored rectangles proportional to duration, @dnd-kit sortable for reordering, click to select (highlight border), playhead line (vertical red line)

**Interactions:**
- Drag clips to reorder
- Click clip to select and show in inspector
- Trim sliders update clip in/out points
- Caption text editable inline
- Export button opens dialog: "Export as MP4" / "Export XML for Premiere" / "Export XML for DaVinci"

### 5.6 Faceless Studio — List (`/faceless`)

**Header:** "Faceless Studio" title + "Create New" button (primary)

**Content:** Grid of faceless project cards (same responsive grid as projects)
- Each card: thumbnail (or template color placeholder), title, template badge, status badge, duration, voice label, created date
- Click → expand/detail view (could be inline or new page, use dialog for simplicity)

### 5.7 Faceless Studio — Create (`/faceless/new`)

**This is the most complex creation form. Build as a multi-step wizard.**

**Step 1: Content Source** (tabs)
- **Topic tab:** Textarea "Describe your video topic" (3-500 chars), character count display
- **URL tab:** URL input "Paste an article or blog URL to convert into a video"
- **Reddit tab:** URL input "Paste a Reddit post URL" or text input for subreddit + post search

**Step 2: Template Selection**
- 6 template cards in a 2x3 grid (or 3x2 on desktop):

| Template | Color Preview | Description |
|----------|--------------|-------------|
| Reddit Story | `#ff4500` (Reddit orange) | Dark theme, Reddit UI mockup, upvote animations |
| Documentary | `#1e3a5f` (Dark blue) | Cinematic letterbox, gold accents, professional narration |
| Top 10 Listicle | Multicolor gradient | Bold numbered overlays, energetic transitions |
| Motivational | `#d4a543` (Gold) | Centered quotes, warm tones, serif typography |
| Scary Story | `#1a0000` (Dark red/black) | Glitch effects, film grain, red pulsing border |
| Educational | `#f8f9fa` (Light/white) | Clean layout, step indicators, colored accent blocks |

Each card: colored preview block (h-32), template name (bold), 1-line description, "Select" radio button. Selected state: ring-2 ring-primary.

**Step 3: Configuration**
- **Voice selection**: Dropdown with voice preview (play icon next to each option). Group by gender. Show engine (Kokoro/Chatterbox) as subtle badge.
- **Music mood**: Select (Calm, Dramatic, Upbeat, Mysterious, Dark, Inspirational, None)
- **Target duration**: Slider or select (30s, 60s, 90s, 120s, 180s, 300s)
- **Style**: Select (if not implied by template — documentary, listicle, story, motivational, educational, scary, reddit)
- **Audience**: Select (General, Young Adults, Professionals, Tech Enthusiasts, Students)
- **Tone**: Select (Engaging, Humorous, Serious, Dramatic, Educational, Inspirational)
- **Additional instructions**: Textarea (optional, "Any specific requirements...")

**Step 4: Review & Generate**
- Summary card showing all selections
- "Generate Video" button (primary, large)
- On submit: navigate to faceless detail showing progress

**Use a Stepper/progress indicator** at the top showing steps 1-4 with active/completed/upcoming states.

### 5.8 Brand Kits (`/brands`)

**Header:** "Brand Kits" + "New Brand Kit" button

**Grid of BrandKitCard components:**
- Color swatch strip at top (primary, secondary, accent colors as circles)
- Kit name
- Default badge (if is_default)
- Caption style badge
- Logo position text
- Edit button, Delete button, "Set as Default" button

### 5.9 Brand Kit Editor (`/brands/[id]`)

**Multi-section form page:**

**Section 1: Basic Info**
- Name input
- "Set as default" switch

**Section 2: Colors**
- 5 color inputs with color picker popover:
  - Primary, Secondary, Accent, Caption Highlight, Caption Background
  - Each shows hex value + color swatch preview
- Live preview strip showing all colors together

**Section 3: Logos**
- Light mode logo: file upload zone (accepts PNG), preview if uploaded, remove button
- Dark mode logo: same
- Position: Select (Top Right, Top Left, Bottom Right, Bottom Left)
- Opacity: Slider (0-100%)

**Section 4: Fonts**
- Heading font: file upload (OTF/TTF) or select from system fonts
- Body font: same
- Caption font: same

**Section 5: Intro/Outro**
- Intro video: file upload (MP4, max 60s), preview player if uploaded
- Outro video: same

**Section 6: Caption Style**
- Preset: Select (Karaoke, Pop, Fade, Highlight, Minimal, Bold, Custom)
- Max words per line: Number input (1-8, default 3)
- Position: Select (Bottom Center, Center, Top)
- Enable emoji: Switch

**Save button** (sticky bottom bar on scroll)

### 5.10 Content Calendar (`/calendar`)

**Header:** "Content Calendar" + view toggle (Month / Week) + navigation arrows (← →) + "Today" button + current month/year display

**Calendar Grid:**
- 7-column grid (Mon-Sun headers)
- Each day cell:
  - Date number (circle highlight if today)
  - Scheduled posts (max 3 visible, "+N more" overflow)
  - Each post: colored left-border by platform, truncated title, time, status dot
  - Click empty area → open SchedulePostDialog for that date
  - Click post → open post detail dialog

**SchedulePostDialog:**
- Platform Account: Select (connected accounts, show platform icon + name)
- Clip: Select (from completed clips, show thumbnail + title)
- Title: Input (auto-populated from clip title)
- Description: Textarea
- Hashtags: Input (comma-separated, with tag badges below)
- Date: Date picker (pre-filled from clicked date)
- Time: Time input (default 12:00)
- "Schedule" button + "Save as Draft" button

**Platform color coding:**
- YouTube: red, TikTok: slate/black, Instagram: pink, Facebook: blue, LinkedIn: sky blue, X: slate

**Post status dots:**
- Draft: gray, Scheduled: yellow, Publishing: blue (pulsing), Published: green, Failed: red

**Drag-and-drop:** Posts can be dragged between day cells to reschedule.

### 5.11 Analytics — Performance (`/analytics`)

**Header:** "Performance Analytics" + date range filter (Last 7 days, 30 days, 90 days, Custom) + platform filter (All, YouTube, TikTok, Instagram, X)

**Stats Cards Row (4 cards):**
- Total Views (number + % change vs previous period, green/red arrow)
- Total Engagement (likes+comments+shares, + % change)
- Avg Engagement Rate (percentage, + change)
- Posts Published (count, + change)

**Charts Section (2 columns on desktop, 1 on mobile):**

**Left column: Views & Engagement Over Time**
- Recharts `LineChart`
- X-axis: date (formatted "MMM d")
- Lines: Views (blue), Likes (pink), Comments (green), Shares (orange)
- Tooltip on hover
- Legend at bottom

**Right column: Engagement by Platform**
- Recharts `BarChart`
- X-axis: platform names
- Y-axis: engagement rate %
- Bars colored by platform (YouTube red, TikTok dark, IG pink, X slate)

**Full-width section: Best Posting Times**
- Heatmap grid (7 rows = days, 24 columns = hours)
- Cell color intensity represents engagement rate (gray → blue → indigo scale)
- Tooltip shows exact engagement rate on hover
- Row labels: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Column labels: 12a, 1a, ... 11p

**Bottom section: Top Performing Posts**
- Table with columns: Thumbnail (small), Title, Platform (icon), Views, Likes, Comments, ER %, Published (relative date)
- Sort by ER % (default), clickable headers
- 10 rows, pagination

### 5.12 Analytics — Competitors (`/analytics/competitors`)

**Header:** "Competitor Analytics" + "Add Competitor" button

**Competitor Selector:** Tabs or dropdown to switch between tracked competitors

**Per-Competitor View:**

**Profile Header Card:**
- Avatar (left), Display name + @username + platform badge
- 4 metric boxes: Followers, Engagement Rate, Avg Views, Posts/Week

**Tabbed content:**
- **Engagement tab:** LineChart (views, likes, comments, ER% over 30 days)
- **Growth tab:** AreaChart (follower count over 30 days, filled area)
- **Top Content tab:** Table (thumbnail, title, views, likes, comments, ER%, published date) — 10 rows
- **Topics tab:** Horizontal BarChart (topic clusters, posts count + avg ER%), topic word badges

**Comparison Section** (below per-competitor view):
- "Compare All" button
- BarChart: X-axis = competitor names, grouped bars for ER% and Posts/week

### 5.13 Trending (`/trending`)

**Two-column layout on desktop:**

**Left column: Trending Topics**
- List of TrendCard components (vertically stacked)
- Each TrendCard:
  - Title (bold)
  - Description (line-clamp-2, muted)
  - Platform badges (small icons)
  - Velocity score bar (0-100, colored gradient: green → yellow → red for urgency)
  - Status badge: Emerging (blue), Growing (green), Peaking (orange), Declining (red)
  - Detected time (relative: "2 hours ago")
  - Related hashtags (horizontal badge row, max 5)
  - "Create Video" button (outline, small) → navigates to /faceless/new with topic pre-filled

**Right column: Trending Hashtags**
- Sortable table:
  - Tag (#hashtag)
  - Platform (icon)
  - Volume score (bar)
  - Engagement score (bar)
  - Competition (bar, inverted — low is better, shown in green)
  - Overall score (bold number)
  - Trend direction (arrow up green, stable gray, down red)
  - Posts (7d count)

**Top section:** Quick filters — Platform (All / YouTube / TikTok / IG / X), Category (All / Tech / Business / Lifestyle / Entertainment)

### 5.14 Batches (`/batches`)

**Header:** "Batch Processing" + "New Batch" button

**Batch List:**
- Table rows: Name, Status badge, Progress bar (X/Y items), Completed count, Failed count, Created date, Actions (View)
- Click row → navigate to `/batches/{id}`

**New Batch Dialog (opened by button):**
- CSV file upload zone (accepts .csv)
- Batch name input
- Template explaining CSV format:
  ```
  Required: topic
  Optional: style, template, voice, duration, music_mood, audience
  ```
- "Download Sample CSV" link
- Submit button

**Batch Detail (`/batches/[id]`):**
- Header: Batch name, status badge, overall progress bar
- Stats: Total / Completed / Failed / Processing counts
- Items table: Row #, Topic, Style, Status badge, Output (link if completed), Error (expandable if failed), Actions (retry if failed)

### 5.15 Voices (`/voices`)

**Header:** "Voice Profiles" + "Clone New Voice" button

**Two sections:**

**Section 1: My Voice Profiles**
- Grid of VoiceCard components
- Each card: name, engine badge (Kokoro/Chatterbox), voice label, "Cloned" badge if applicable, play sample button (icon), edit name button, delete button

**Section 2: Available Voices**
- Table/grid of all available TTS voices
- Columns: Play sample (button with speaker icon), Voice name, Gender badge (M/F), Accent, Engine badge
- Click "Play" plays a mock audio sample (can be non-functional, just show the interaction)

**Clone Voice Dialog:**
- Name input ("My Custom Voice")
- Audio upload zone (accepts WAV/MP3, 5-30 seconds)
- Helper text: "Upload a clear audio sample of the voice you want to clone. 5-30 seconds, minimal background noise."
- Engine info: "Uses Chatterbox voice cloning"
- Create button

### 5.16 Settings — General (`/settings`)

**Sections:**

**Profile**
- Name input (pre-filled)
- Email input (pre-filled, disabled with "Change email" link)
- Avatar upload
- Save button

**Workspace**
- Workspace name input
- Workspace description textarea
- Save button

**Preferences**
- Default language: Select
- Default aspect ratio: Select (9:16, 16:9, 1:1, 4:5)
- Default caption style: Select
- Default voice: Select
- Dark mode: already handled by theme toggle

**Danger Zone** (red border section)
- Delete account button (destructive, requires confirmation dialog)

### 5.17 Settings — Social Accounts (`/settings/accounts`)

**Connected Accounts:**
- List of connected account cards:
  - Platform icon + platform name (colored)
  - Avatar + display name + @username
  - Status: "Connected" (green badge) or "Disconnected" (red badge with reason)
  - Connected date
  - "Disconnect" button (outline, destructive on hover)

**Connect New:**
- Grid of platform buttons for unconnected platforms:
  - Each button: Platform icon + "Connect YouTube" / "Connect TikTok" / etc.
  - Platform-colored borders
  - On click: show toast "OAuth flow would redirect to {platform}" (mock — no real OAuth)

### 5.18 Settings — API Keys (`/settings/api-keys`)

**Header:** "API Keys" + "Generate New Key" button

**Keys table:**
- Columns: Name, Key (masked: `oc_...xxxx`), Created, Last Used, Actions (copy full key, revoke)
- Revoke requires confirmation dialog

**Generate Key Dialog:**
- Name input ("Production", "Development", etc.)
- Generate button
- After generation: Show full key ONCE in a copyable code block with copy button, warning "Save this key — it won't be shown again"

### 5.19 Settings — Webhooks (`/settings/webhooks`)

**Header:** "Webhooks" + "Create Webhook" button

**Webhook list:**
- Cards for each webhook:
  - URL (monospace, truncated)
  - Events badges (job.completed, video.published, etc.)
  - Status: Active (green) / Inactive (gray)
  - Failure count (if > 0, show warning badge)
  - Active/Inactive toggle switch
  - "View Deliveries" button, "Delete" button

**Create Webhook Dialog:**
- URL input (with https:// prefix hint, validation)
- Events: Multi-select checkboxes:
  - job.completed — "When any job finishes"
  - job.failed — "When a job fails"
  - video.published — "When a video is published"
  - batch.completed — "When a batch run finishes"
  - clip.generated — "When a clip is generated"
- Create button
- After creation: Show secret in copyable code block, warning "Save this secret — it won't be shown again"

**Deliveries Dialog (opened from webhook card):**
- Table: Event Type, Status badge (Delivered/Failed/Pending), HTTP Status Code, Response (truncated, expandable), Attempts, Timestamp

### 5.20 Settings — Team (`/settings/team`)

**Workspace Members:**
- Table: Avatar, Name, Email, Role (dropdown for admins: Admin/Editor/Viewer), Joined date, Actions (remove — not for owner)
- Owner row has "Owner" badge, role is not changeable

**Invitations:**
- "Invite Member" button
- Pending invitations table: Email, Role, Status badge, Expires, Actions (Revoke)
- Invite Dialog: Email input, Role select (Admin/Editor/Viewer), "Send Invitation" button

---

## 6. Shared Components

### 6.1 `ProjectCard`
- Props: `project: Project`
- Thumbnail (aspect-video, rounded-t, object-cover), title, status badge, clip count badge, relative date
- Hover: subtle shadow elevation
- Link to `/projects/{id}`

### 6.2 `ClipCard`
- Props: `clip: Clip`, `onPreview`, `onDownload`, `onPublish`
- Thumbnail with play overlay, score badge (top-right, color-coded), duration badge (bottom-right)
- Title (line-clamp-2), transcript (text-xs, line-clamp-2)
- Action buttons row

### 6.3 `JobProgress`
- Props: `job: Job`
- Progress bar (shadcn Progress), percentage text, status message, status badge
- Animated: progress bar fills, message updates
- Mock: cycle through messages every 2s when status is "progress" using setInterval

### 6.4 `StatusBadge`
- Props: `status: string`, `variant?: "default" | "outline"`
- Color mapping:
  - pending: gray bg, gray text
  - processing/started/progress/publishing: blue bg, blue text, optional pulse animation
  - completed/success/published: green bg, green text
  - failed/failure: red bg, red text
  - draft: gray bg, gray text
  - scheduled: yellow bg, yellow text
  - cancelled: gray bg, strikethrough text
  - partial_failure: orange bg, orange text

### 6.5 `PageHeader`
- Props: `title: string`, `description?: string`, `actions?: React.ReactNode`
- Renders: H1 title, optional description (text-muted-foreground), right-aligned action buttons

### 6.6 `EmptyState`
- Props: `icon: LucideIcon`, `title: string`, `description: string`, `action?: { label: string, href: string }`
- Centered vertically, icon large + muted, title, description, optional CTA button

### 6.7 `StatCard`
- Props: `title: string`, `value: string | number`, `change?: number` (percentage), `icon: LucideIcon`
- Card with icon (muted), title (text-sm text-muted-foreground), value (text-2xl font-bold), change with arrow (green positive, red negative)

### 6.8 `PlatformIcon`
- Props: `platform: string`, `size?: number`
- Returns platform-specific icon with correct color
- YouTube: red, TikTok: slate, Instagram: pink gradient, Facebook: blue, LinkedIn: sky, X: slate

### 6.9 `ConfirmDialog`
- Props: `title`, `description`, `confirmLabel`, `variant` (default/destructive), `onConfirm`, `open`, `onOpenChange`
- Uses AlertDialog from shadcn/ui

### 6.10 `FileUploadZone`
- Props: `accept`, `maxSize`, `onFile`, `label`, `description`
- Dashed border, drag-and-drop, click to browse
- Shows file name + size after selection, remove button
- Drag-over state: primary color border + bg-primary/5

### 6.11 `ColorPicker`
- Props: `value: string` (hex), `onChange: (hex: string) => void`
- Shows color swatch circle + hex text
- Click opens popover with hex input + preset color grid (12 colors)

### 6.12 `DataTable`
- Reusable table wrapper using shadcn Table + proper header, body, pagination
- Props: `columns: Column[]`, `data: T[]`, `pagination?: boolean`

---

## 7. Design System & Styling

### Color Palette (CSS Variables / Tailwind Config)

Use shadcn/ui default theme with these customizations:

**Light mode:**
- Background: `#ffffff`
- Foreground: `#0a0a0a`
- Primary: `#6366f1` (indigo-500)
- Primary foreground: `#ffffff`
- Secondary: `#f4f4f5`
- Accent: `#06b6d4` (cyan-500)
- Muted: `#f4f4f5`
- Muted foreground: `#71717a`
- Destructive: `#ef4444`
- Border: `#e4e4e7`
- Card: `#ffffff`

**Dark mode:**
- Background: `#0a0a0a`
- Foreground: `#fafafa`
- Primary: `#818cf8` (indigo-400)
- Primary foreground: `#0a0a0a`
- Secondary: `#27272a`
- Accent: `#22d3ee` (cyan-400)
- Muted: `#27272a`
- Muted foreground: `#a1a1aa`
- Destructive: `#f87171`
- Border: `#27272a`
- Card: `#18181b`

### Platform Colors (use consistently everywhere)

```typescript
export const PLATFORM_COLORS = {
  youtube:   { bg: "bg-red-100 dark:bg-red-900/30",   border: "border-red-300 dark:border-red-700",   text: "text-red-700 dark:text-red-400",   hex: "#dc2626" },
  tiktok:    { bg: "bg-slate-100 dark:bg-slate-800",   border: "border-slate-300 dark:border-slate-600", text: "text-slate-700 dark:text-slate-300", hex: "#0a0a0a" },
  instagram: { bg: "bg-pink-100 dark:bg-pink-900/30",  border: "border-pink-300 dark:border-pink-700", text: "text-pink-700 dark:text-pink-400",  hex: "#e1306c" },
  facebook:  { bg: "bg-blue-100 dark:bg-blue-900/30",  border: "border-blue-300 dark:border-blue-700", text: "text-blue-700 dark:text-blue-400",  hex: "#1877f2" },
  linkedin:  { bg: "bg-sky-100 dark:bg-sky-900/30",    border: "border-sky-300 dark:border-sky-700",   text: "text-sky-700 dark:text-sky-400",   hex: "#0a66c2" },
  x:         { bg: "bg-slate-100 dark:bg-slate-800",   border: "border-slate-300 dark:border-slate-600", text: "text-slate-700 dark:text-slate-300", hex: "#000000" },
} as const
```

### Typography

- Page titles: `text-2xl font-bold tracking-tight` (H1)
- Section headers: `text-lg font-semibold` (H2)
- Card titles: `text-base font-semibold` (H3)
- Body: `text-sm` (14px base)
- Small/Muted: `text-xs text-muted-foreground`
- Monospace (code/keys): `font-mono text-sm`

### Spacing

- Page padding: `p-6` (desktop), `p-4` (mobile)
- Card padding: `p-4` or `p-6`
- Section gaps: `space-y-6`
- Grid gaps: `gap-4` or `gap-6`
- Component internal gaps: `gap-2` or `gap-3`

### Animation

- Page transitions: none (instant, Next.js App Router)
- Progress bars: `transition-all duration-500`
- Hover effects: `transition-colors` or `transition-shadow`
- Status pulse: `animate-pulse` for in-progress states
- Skeleton loading: Use shadcn Skeleton component on all data-dependent areas while loading
- Toast: Use Sonner (bottom-right position, auto-dismiss 5s)

### Responsive Breakpoints

- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1536px

All grids should be responsive:
- Projects/clips: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Stats cards: `grid-cols-2 lg:grid-cols-4`
- Charts: `grid-cols-1 lg:grid-cols-2` for side-by-side on desktop

---

## 8. File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # Dashboard home
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── edit/page.tsx
│   │   ├── faceless/
│   │   │   ├── page.tsx
│   │   │   └── new/page.tsx
│   │   ├── brands/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── calendar/
│   │   │   └── page.tsx
│   │   ├── analytics/
│   │   │   ├── page.tsx
│   │   │   └── competitors/page.tsx
│   │   ├── trending/
│   │   │   └── page.tsx
│   │   ├── batches/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── voices/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── accounts/page.tsx
│   │       ├── api-keys/page.tsx
│   │       ├── webhooks/page.tsx
│   │       ├── team/page.tsx
│   │       └── layout.tsx                 # Settings sidebar/tabs layout
│   ├── layout.tsx                         # Root layout (providers)
│   └── globals.css
├── components/
│   ├── ui/                                # shadcn/ui components (auto-generated)
│   ├── layout/
│   │   ├── app-sidebar.tsx
│   │   ├── app-header.tsx
│   │   ├── mobile-nav.tsx
│   │   └── breadcrumbs.tsx
│   ├── shared/
│   │   ├── project-card.tsx
│   │   ├── clip-card.tsx
│   │   ├── job-progress.tsx
│   │   ├── status-badge.tsx
│   │   ├── page-header.tsx
│   │   ├── empty-state.tsx
│   │   ├── stat-card.tsx
│   │   ├── platform-icon.tsx
│   │   ├── confirm-dialog.tsx
│   │   ├── file-upload-zone.tsx
│   │   ├── color-picker.tsx
│   │   └── data-table.tsx
│   ├── editor/
│   │   ├── video-preview.tsx
│   │   ├── timeline.tsx
│   │   ├── timeline-clip.tsx
│   │   ├── clip-inspector.tsx
│   │   └── trim-controls.tsx
│   ├── calendar/
│   │   ├── calendar-grid.tsx
│   │   ├── calendar-day-cell.tsx
│   │   ├── calendar-post-card.tsx
│   │   └── schedule-post-dialog.tsx
│   ├── analytics/
│   │   ├── views-chart.tsx
│   │   ├── platform-chart.tsx
│   │   ├── posting-heatmap.tsx
│   │   ├── top-posts-table.tsx
│   │   ├── competitor-profile.tsx
│   │   ├── competitor-engagement-chart.tsx
│   │   ├── competitor-growth-chart.tsx
│   │   ├── competitor-top-content.tsx
│   │   └── competitor-topics.tsx
│   ├── faceless/
│   │   ├── template-picker.tsx
│   │   ├── voice-selector.tsx
│   │   ├── script-preview.tsx
│   │   └── faceless-wizard.tsx
│   └── settings/
│       ├── social-account-card.tsx
│       ├── api-key-table.tsx
│       ├── webhook-card.tsx
│       ├── team-members-table.tsx
│       └── invite-dialog.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts                      # Main API client (mock/real switch)
│   │   └── types.ts                       # All TypeScript interfaces
│   ├── mock-data/
│   │   ├── projects.ts
│   │   ├── clips.ts
│   │   ├── jobs.ts
│   │   ├── faceless-projects.ts
│   │   ├── brand-kits.ts
│   │   ├── social-accounts.ts
│   │   ├── scheduled-posts.ts
│   │   ├── analytics.ts
│   │   ├── competitor-analytics.ts
│   │   ├── trending.ts
│   │   ├── webhooks.ts
│   │   ├── batches.ts
│   │   ├── voice-profiles.ts
│   │   ├── workspace.ts
│   │   └── api-keys.ts
│   ├── stores/
│   │   ├── auth-store.ts                  # Zustand auth state
│   │   └── editor-store.ts               # Zustand editor state
│   ├── hooks/
│   │   ├── use-require-auth.ts
│   │   ├── use-media-query.ts
│   │   └── use-debounce.ts
│   ├── utils.ts                           # cn() helper, formatters
│   └── constants.ts                       # Platform colors, caption styles, templates
├── providers/
│   ├── query-provider.tsx                 # TanStack React Query provider
│   └── theme-provider.tsx                 # next-themes provider
└── middleware.ts                           # Auth route protection
```

---

## Implementation Order

Build in this sequence for maximum efficiency:

1. **Project scaffold** — Next.js init, install deps, shadcn/ui init, file structure
2. **Design system** — globals.css, theme config, color variables, Tailwind customization
3. **Providers** — QueryProvider, ThemeProvider, wrap in root layout
4. **Types** — All TypeScript interfaces in `lib/api/types.ts`
5. **Mock data** — All mock data files
6. **API client** — Mock-mode API client with delays
7. **Auth system** — Zustand store, login/register pages, middleware, useRequireAuth
8. **Layout** — Dashboard layout, sidebar, header, mobile nav
9. **Shared components** — All components in `components/shared/`
10. **Dashboard home page**
11. **Projects** — list, new, detail pages
12. **Video editor** — preview, timeline, inspector
13. **Faceless studio** — list, create wizard
14. **Brand kits** — list, editor
15. **Content calendar** — calendar grid, schedule dialog
16. **Analytics** — performance dashboard, competitor analytics
17. **Trending** — topics + hashtags
18. **Batches** — list, detail
19. **Voices** — profiles, available voices
20. **Settings** — all sub-pages (general, accounts, API keys, webhooks, team)

---

## Critical Rules

1. **Every page must have a loading state** — Use Skeleton components while data loads (even mock data has simulated delays)
2. **Every page must have an empty state** — Show EmptyState component when no data exists
3. **Every destructive action needs confirmation** — Use ConfirmDialog before delete/revoke
4. **All forms must validate** — Client-side validation with clear error messages
5. **Dark mode must work everywhere** — Test every component in both light and dark mode
6. **Toast notifications** — Success on create/update/delete, error on failures
7. **Responsive** — Every page must work at 375px (mobile), 768px (tablet), 1440px (desktop)
8. **No hardcoded strings** — Use constants for repeated values (platform names, status labels, etc.)
9. **Mock data must be realistic** — Real-sounding titles, proper date ranges, consistent relationships (clip.project_id must match a real project)
10. **All links must work** — Every navigation element, button, and link must go somewhere real or open a dialog
