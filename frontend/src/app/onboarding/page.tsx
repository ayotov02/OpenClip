"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Video,
  Send,
  BarChart3,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Users,
  Target,
  Megaphone,
  Clock,
  TrendingUp,
  Hash,
  Eye,
  Zap,
  Loader2,
  CheckCircle2,
  Brain,
  Flame,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";

/* ──────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────── */

const TOTAL_STEPS = 5;

const FEATURE_CARDS = [
  {
    icon: Scissors,
    title: "AI Video Clipping",
    desc: "Upload long-form videos and let AI extract the most viral moments with context-aware scoring.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Video,
    title: "Faceless Studio",
    desc: "Generate complete videos from a text prompt — script, voiceover, B-roll, music, and captions.",
    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    icon: Send,
    title: "Auto Publishing",
    desc: "Schedule and auto-post to YouTube, TikTok, Instagram, LinkedIn, X, and Facebook.",
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    icon: BarChart3,
    title: "Competitor Intelligence",
    desc: "Scrape competitors, track trends, analyze hashtags, and discover viral content patterns.",
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  },
];

const NICHE_OPTIONS = [
  "Tech & AI",
  "Business & Finance",
  "Education",
  "Entertainment",
  "Gaming",
  "Health & Fitness",
  "Lifestyle & Vlogs",
  "Science",
  "News & Politics",
  "Motivation & Self-Improvement",
  "Food & Cooking",
  "Travel",
  "Fashion & Beauty",
  "Music",
  "Sports",
  "Other",
];

const PLATFORM_OPTIONS = [
  { id: "youtube", label: "YouTube", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { id: "tiktok", label: "TikTok", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  { id: "instagram", label: "Instagram", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { id: "facebook", label: "Facebook", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { id: "linkedin", label: "LinkedIn", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  { id: "x", label: "X (Twitter)", color: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
];

const VOICE_OPTIONS = [
  "Educational & Informative",
  "Entertaining & Fun",
  "Professional & Authoritative",
  "Casual & Conversational",
  "Provocative & Bold",
  "Inspirational & Motivational",
  "Calm & Soothing",
  "Energetic & Fast-paced",
];

const GOAL_OPTIONS = [
  { id: "grow", label: "Grow Audience", icon: Users, desc: "Build followers and subscribers" },
  { id: "revenue", label: "Drive Revenue", icon: TrendingUp, desc: "Monetize content and sell products" },
  { id: "authority", label: "Build Authority", icon: Target, desc: "Establish expertise in your niche" },
  { id: "educate", label: "Educate", icon: Brain, desc: "Teach and share knowledge" },
  { id: "entertain", label: "Entertain", icon: Flame, desc: "Create engaging, fun content" },
  { id: "brand", label: "Brand Awareness", icon: Megaphone, desc: "Promote a business or brand" },
];

const FREQUENCY_OPTIONS = ["Multiple times daily", "Daily", "3-5 times per week", "1-2 times per week", "A few times per month"];

const MOCK_COMPETITORS_SEARCH = [
  { handle: "@garyvee", platform: "tiktok", followers: "12.4M", niche: "Motivation & Business" },
  { handle: "@alexhormozi", platform: "instagram", followers: "3.2M", niche: "Business & Finance" },
  { handle: "@mkbhd", platform: "youtube", followers: "19.8M", niche: "Tech Reviews" },
  { handle: "@hubermanlab", platform: "youtube", followers: "5.6M", niche: "Science & Health" },
  { handle: "@thebloggingboy", platform: "tiktok", followers: "890K", niche: "AI & Tech" },
  { handle: "@zachking", platform: "instagram", followers: "24.1M", niche: "Entertainment" },
];

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1: Brand DNA
  const [brandName, setBrandName] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [voiceTraits, setVoiceTraits] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("");
  const [uniqueness, setUniqueness] = useState("");

  // Step 2: Competitors
  const [competitorMode, setCompetitorMode] = useState<"manual" | "auto" | null>(null);
  const [manualCompetitors, setManualCompetitors] = useState<{ handle: string; platform: string }[]>([]);
  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState("youtube");
  const [selectedAutoCompetitors, setSelectedAutoCompetitors] = useState<string[]>([]);
  const [autoSearching, setAutoSearching] = useState(false);
  const [autoResults, setAutoResults] = useState<typeof MOCK_COMPETITORS_SEARCH>([]);

  // Step 3: Intelligence
  const [enableScraping, setEnableScraping] = useState(true);
  const [scrapeFrequency, setScrapeFrequency] = useState("weekly");
  const [enableTrends, setEnableTrends] = useState(true);
  const [enableHashtags, setEnableHashtags] = useState(true);
  const [enablePerformance, setEnablePerformance] = useState(true);

  // Step 4: AI Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");

  const toggleVoice = (v: string) =>
    setVoiceTraits((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < 3 ? [...prev, v] : prev));

  const toggleGoal = (g: string) =>
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const addManualCompetitor = () => {
    if (!newHandle.trim()) return;
    const handle = newHandle.startsWith("@") ? newHandle.trim() : `@${newHandle.trim()}`;
    setManualCompetitors((prev) => [...prev, { handle, platform: newPlatform }]);
    setNewHandle("");
  };

  const removeManualCompetitor = (i: number) =>
    setManualCompetitors((prev) => prev.filter((_, idx) => idx !== i));

  const toggleAutoCompetitor = (handle: string) =>
    setSelectedAutoCompetitors((prev) =>
      prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle]
    );

  const runAutoSearch = () => {
    setAutoSearching(true);
    setTimeout(() => {
      setAutoResults(MOCK_COMPETITORS_SEARCH);
      setAutoSearching(false);
    }, 1500);
  };

  const runAnalysis = () => {
    setAnalyzing(true);
    const stages = [
      "Analyzing brand voice...",
      "Processing competitor landscape...",
      "Mapping content strategy...",
      "Generating recommendations...",
      "Building your brand profile...",
    ];
    stages.forEach((stage, i) => {
      setTimeout(() => setAnalysisStage(stage), i * 800);
    });
    setTimeout(() => {
      setAnalyzing(false);
      setAnalysisComplete(true);
    }, stages.length * 800);
  };

  useEffect(() => {
    if (step === 4 && !analysisComplete && !analyzing) {
      runAnalysis();
    }
  }, [step, analysisComplete, analyzing]);

  const canProceed = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return brandName.trim().length > 0 && (niche !== "" || customNiche.trim().length > 0);
      case 2:
        return (
          (competitorMode === "manual" && manualCompetitors.length > 0) ||
          (competitorMode === "auto" && selectedAutoCompetitors.length > 0) ||
          competitorMode === null
        );
      case 3:
        return true;
      case 4:
        return analysisComplete;
      default:
        return true;
    }
  };

  const next = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else router.push("/dashboard");
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const finish = () => router.push("/dashboard");

  /* ────────────────────────────────────────────
     Step 0: Welcome
     ──────────────────────────────────────────── */
  const renderWelcome = () => (
    <div className="space-y-8 animate-slide-up">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary animate-scale-in">
            <Scissors className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to Open<span className="text-primary">Clip</span>
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Your self-hosted AI video creation platform. Let&apos;s set up your brand identity
          so the AI understands your content, style, and goals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 stagger-slide">
        {FEATURE_CARDS.map((feature) => (
          <Card key={feature.title} className="transition-shadow hover:shadow-md hover:shadow-primary/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${feature.color}`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          This setup takes about 3 minutes. You can always change these settings later.
        </p>
      </div>
    </div>
  );

  /* ────────────────────────────────────────────
     Step 1: Brand DNA
     ──────────────────────────────────────────── */
  const renderBrandDNA = () => (
    <div className="space-y-8 animate-slide-up" key="brand-dna">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Brand DNA</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Tell us about your channel or brand. This becomes the AI&apos;s core context for every piece of content it creates.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Brand Name */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Channel / Brand Name *</label>
          <Input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. TechWithAnthony, The Hustle, NightOwl Productions"
            className="h-11"
          />
        </div>

        {/* Niche */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">What is your niche? *</label>
          <div className="flex flex-wrap gap-2">
            {NICHE_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => { setNiche(n); if (n !== "Other") setCustomNiche(""); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  niche === n
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {niche === "Other" && (
            <Input
              value={customNiche}
              onChange={(e) => setCustomNiche(e.target.value)}
              placeholder="Describe your niche..."
              className="mt-2"
            />
          )}
        </div>

        {/* Brand Voice */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Brand Voice <span className="text-muted-foreground font-normal">(pick up to 3)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {VOICE_OPTIONS.map((v) => (
              <button
                key={v}
                onClick={() => toggleVoice(v)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  voiceTraits.includes(v)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {voiceTraits.includes(v) && <Check className="inline h-3 w-3 mr-1" />}
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Target Audience</label>
          <Textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="Describe who watches your content — age range, interests, demographics, pain points..."
            rows={3}
          />
        </div>

        {/* Goals */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Primary Goals</label>
          <div className="grid gap-2 md:grid-cols-3">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.id}
                onClick={() => toggleGoal(g.id)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  goals.includes(g.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <g.icon className={`h-4 w-4 shrink-0 ${goals.includes(g.id) ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className={`text-xs font-semibold ${goals.includes(g.id) ? "text-primary" : "text-foreground"}`}>{g.label}</p>
                  <p className="text-[10px] text-muted-foreground">{g.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Platforms */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Active Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  platforms.includes(p.id)
                    ? `border-primary/30 ${p.color}`
                    : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {platforms.includes(p.id) && <Check className="h-3 w-3" />}
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Posting Frequency</label>
          <div className="flex flex-wrap gap-2">
            {FREQUENCY_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  frequency === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Uniqueness */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">What makes your content unique?</label>
          <Textarea
            value={uniqueness}
            onChange={(e) => setUniqueness(e.target.value)}
            placeholder="Your secret sauce — what separates your content from everyone else in your niche?"
            rows={3}
          />
        </div>
      </div>
    </div>
  );

  /* ────────────────────────────────────────────
     Step 2: Competitors
     ──────────────────────────────────────────── */
  const renderCompetitors = () => (
    <div className="space-y-8 animate-slide-up" key="competitors">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Competitor Discovery</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Identify creators in your space. OpenClip will track their content, engagement, and posting patterns to inform your strategy.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Mode Selection */}
        {competitorMode === null ? (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => setCompetitorMode("manual")}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Manual Input</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add competitor handles you already know
                </p>
              </div>
            </button>
            <button
              onClick={() => { setCompetitorMode("auto"); runAutoSearch(); }}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-8 transition-all hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                <Search className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Auto Search</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  AI finds competitors based on your niche
                </p>
              </div>
            </button>
          </div>
        ) : competitorMode === "manual" ? (
          /* Manual Mode */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Add Competitors</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCompetitorMode(null)}>
                Switch to Auto Search
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@handle"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && addManualCompetitor()}
              />
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="x">X</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <Button onClick={addManualCompetitor} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            {manualCompetitors.length > 0 && (
              <div className="space-y-2">
                {manualCompetitors.map((comp, i) => (
                  <div
                    key={`${comp.handle}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 animate-scale-in"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{comp.handle}</p>
                        <p className="text-xs text-muted-foreground capitalize">{comp.platform}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeManualCompetitor(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {manualCompetitors.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">No competitors added yet</p>
                <p className="text-xs text-muted-foreground">Type a handle above and click Add</p>
              </div>
            )}
          </div>
        ) : (
          /* Auto Mode */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Suggested Competitors
                {niche && <span className="ml-2 font-normal text-muted-foreground">for {niche}</span>}
              </h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCompetitorMode(null)}>
                Switch to Manual
              </Button>
            </div>

            {autoSearching ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Searching for competitors in your niche...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {autoResults.map((comp) => {
                  const selected = selectedAutoCompetitors.includes(comp.handle);
                  return (
                    <button
                      key={comp.handle}
                      onClick={() => toggleAutoCompetitor(comp.handle)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                        selected ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          selected ? "bg-primary/10" : "bg-muted"
                        }`}>
                          <Users className={`h-4 w-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{comp.handle}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">{comp.platform}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{comp.followers} followers</span>
                            <span>·</span>
                            <span>{comp.niche}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}>
                        {selected && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedAutoCompetitors.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {selectedAutoCompetitors.length} competitor{selectedAutoCompetitors.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Competitor data is private</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All scraping happens on your own server. No data leaves your instance. You can skip this step and add competitors later from Analytics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ────────────────────────────────────────────
     Step 3: Content Intelligence
     ──────────────────────────────────────────── */
  const renderIntelligence = () => (
    <div className="space-y-8 animate-slide-up" key="intelligence">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Content Intelligence</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Configure how OpenClip monitors your niche — scraping, trend detection, and analytics.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Competitor Scraping */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Search className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Competitor Scraping</p>
                  <p className="text-xs text-muted-foreground">
                    Periodically scrape competitor profiles for new posts, engagement, and growth metrics
                  </p>
                </div>
              </div>
              <Switch checked={enableScraping} onCheckedChange={setEnableScraping} />
            </div>
            {enableScraping && (
              <div className="mt-4 ml-13 pl-13">
                <div className="flex items-center gap-3 mt-3 ml-[52px]">
                  <label className="text-xs text-muted-foreground">Frequency:</label>
                  <div className="flex gap-1.5">
                    {["daily", "weekly", "monthly"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setScrapeFrequency(f)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          scrapeFrequency === f
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend Detection */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Trend Detection</p>
                  <p className="text-xs text-muted-foreground">
                    Identify rising topics, formats, and content patterns across platforms using BERTopic clustering
                  </p>
                </div>
              </div>
              <Switch checked={enableTrends} onCheckedChange={setEnableTrends} />
            </div>
          </CardContent>
        </Card>

        {/* Hashtag Tracking */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Hash className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Hashtag Tracking</p>
                  <p className="text-xs text-muted-foreground">
                    Monitor hashtag volume, growth, and competition levels to optimize your discoverability
                  </p>
                </div>
              </div>
              <Switch checked={enableHashtags} onCheckedChange={setEnableHashtags} />
            </div>
          </CardContent>
        </Card>

        {/* Performance Analytics */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Performance Analytics</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-import views, likes, shares, and comments from your connected social accounts
                  </p>
                </div>
              </div>
              <Switch checked={enablePerformance} onCheckedChange={setEnablePerformance} />
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              All intelligence features run on your own hardware. Scraping uses Crawlee + Playwright
              within your Docker stack. No external services or API keys required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  /* ────────────────────────────────────────────
     Step 4: AI Analysis Overview
     ──────────────────────────────────────────── */
  const renderAnalysis = () => (
    <div className="space-y-8 animate-slide-up" key="analysis">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Your Brand Profile</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          AI has analyzed your inputs and built a comprehensive brand context layer.
        </p>
      </div>

      {analyzing ? (
        <div className="max-w-md mx-auto flex flex-col items-center gap-6 py-12">
          <div className="relative">
            <div className="h-20 w-20 rounded-full border-4 border-border flex items-center justify-center">
              <Brain className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary animate-pulse-dot" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">{analysisStage}</p>
            <div className="w-64">
              <Progress value={analysisStage ? (["Analyzing brand voice...", "Processing competitor landscape...", "Mapping content strategy...", "Generating recommendations...", "Building your brand profile..."].indexOf(analysisStage) + 1) * 20 : 0} className="h-1.5" />
            </div>
          </div>
        </div>
      ) : analysisComplete ? (
        <div className="max-w-2xl mx-auto space-y-6 stagger-slide">
          {/* Brand Summary */}
          <Card className="border-primary/20">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Brand Summary</h3>
                  <p className="text-xs text-muted-foreground">Generated by Qwen3</p>
                </div>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                <strong>{brandName || "Your Brand"}</strong> is a {niche || customNiche || "content"} channel
                {voiceTraits.length > 0 && <> with a <em>{voiceTraits.join(", ").toLowerCase()}</em> voice</>}
                {targetAudience && <>, targeting {targetAudience.toLowerCase().slice(0, 80)}</>}.
                {goals.length > 0 && <> The primary focus is on {goals.map((g) => GOAL_OPTIONS.find((o) => o.id === g)?.label.toLowerCase()).filter(Boolean).join(" and ")}.</>}
                {platforms.length > 0 && <> Active across {platforms.length} platform{platforms.length > 1 ? "s" : ""} with {frequency.toLowerCase() || "regular"} posting cadence.</>}
                {uniqueness && <> Key differentiator: {uniqueness.slice(0, 100)}.</>}
              </p>
            </CardContent>
          </Card>

          {/* Detected Keywords */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Detected Tone Keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  ...(voiceTraits.length > 0 ? voiceTraits : ["Informative"]),
                  "Authentic",
                  "Data-driven",
                  niche === "Tech & AI" ? "Forward-thinking" : "Relatable",
                  "Actionable",
                ].map((kw) => (
                  <Badge key={kw} variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    {kw}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommended Content Pillars */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Recommended Content Pillars
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { pillar: "Trending Topic Breakdowns", match: "94%" },
                  { pillar: "How-To Tutorials", match: "91%" },
                  { pillar: "Industry News Commentary", match: "87%" },
                  { pillar: "Behind-the-Scenes / Process", match: "82%" },
                ].map((item) => (
                  <div key={item.pillar} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <span className="text-xs font-medium text-foreground">{item.pillar}</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {item.match} match
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Competitor Landscape */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Competitor Landscape
              </h3>
              {(competitorMode === "manual" && manualCompetitors.length > 0) ||
               (competitorMode === "auto" && selectedAutoCompetitors.length > 0) ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {competitorMode === "manual" ? manualCompetitors.length : selectedAutoCompetitors.length} competitors
                    identified. OpenClip will begin tracking their content
                    {enableScraping ? ` ${scrapeFrequency}` : " on demand"}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(competitorMode === "manual"
                      ? manualCompetitors.map((c) => c.handle)
                      : selectedAutoCompetitors
                    ).map((h) => (
                      <Badge key={h} variant="outline" className="text-xs">
                        {h}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No competitors selected. You can add them later from the Analytics dashboard.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Suggested Schedule */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Suggested Posting Schedule
              </h3>
              <div className="space-y-2">
                {platforms.length > 0 ? (
                  platforms.map((p) => {
                    const times: Record<string, string> = {
                      youtube: "Tue/Thu/Sat at 2:00 PM",
                      tiktok: "Daily at 11:00 AM & 7:00 PM",
                      instagram: "Mon/Wed/Fri at 12:00 PM",
                      facebook: "Tue/Thu at 10:00 AM",
                      linkedin: "Tue/Wed at 8:00 AM",
                      x: "Daily at 9:00 AM & 5:00 PM",
                    };
                    return (
                      <div key={p} className="flex items-center justify-between text-xs rounded-lg border border-border/50 p-3">
                        <span className="font-medium text-foreground capitalize">{p}</span>
                        <span className="text-muted-foreground">{times[p] || "3x per week"}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">Connect platforms in Settings to get personalized schedule recommendations.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Intelligence Status */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Intelligence Modules
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { name: "Competitor Scraping", enabled: enableScraping },
                  { name: "Trend Detection", enabled: enableTrends },
                  { name: "Hashtag Tracking", enabled: enableHashtags },
                  { name: "Performance Analytics", enabled: enablePerformance },
                ].map((mod) => (
                  <div key={mod.name} className="flex items-center gap-2 text-xs">
                    <div className={`h-2 w-2 rounded-full ${mod.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                    <span className={mod.enabled ? "text-foreground" : "text-muted-foreground"}>{mod.name}</span>
                    <span className={`ml-auto text-[10px] ${mod.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {mod.enabled ? "Active" : "Off"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );

  /* ────────────────────────────────────────────
     Render
     ──────────────────────────────────────────── */
  const stepLabels = ["Welcome", "Brand DNA", "Competitors", "Intelligence", "Overview"];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Scissors className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-foreground">
                Open<span className="text-primary">Clip</span>
              </span>
            </div>
            {step > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Step {step} of {TOTAL_STEPS - 1}
                </span>
              </div>
            )}
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`h-1 w-full rounded-full transition-all duration-500 ${
                    i < step
                      ? "bg-primary"
                      : i === step
                      ? "bg-primary/50"
                      : "bg-border"
                  }`}
                />
                <span className={`text-[10px] transition-colors ${
                  i <= step ? "text-foreground font-medium" : "text-muted-foreground"
                }`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-10">
        {step === 0 && renderWelcome()}
        {step === 1 && renderBrandDNA()}
        {step === 2 && renderCompetitors()}
        {step === 3 && renderIntelligence()}
        {step === 4 && renderAnalysis()}
      </div>

      {/* Bottom Nav */}
      <div className="sticky bottom-0 border-t border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <div>
            {step > 0 ? (
              <Button variant="ghost" onClick={back} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
          </div>
          <div className="flex items-center gap-3">
            {step > 0 && step < TOTAL_STEPS && (
              <Button variant="ghost" className="text-xs text-muted-foreground" onClick={() => setStep(4)}>
                Skip to finish
              </Button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={next} disabled={!canProceed()} className="gap-1.5">
                {step === 0 ? "Get Started" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={!canProceed()} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Launch Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
