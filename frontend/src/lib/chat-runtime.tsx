"use client";

import {
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  type ThreadMessageLike,
  type AppendMessage,
  type ExternalStoreThreadListAdapter,
} from "@assistant-ui/react";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

export type ChatMode = "create" | "generate" | "compose" | "research";

type LocalThread = {
  id: string;
  title: string;
  mode: ChatMode;
  isArchived: boolean;
  createdAt: Date;
};

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "running" | "complete" | "error";
  createdAt: Date;
};

/* ──────────────────────────────────────────────
   Mode Context
   ────────────────────────────────────────────── */

const ChatModeContext = createContext<{
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
}>({ mode: "create", setMode: () => {} });

export const useChatMode = () => useContext(ChatModeContext);

/* ──────────────────────────────────────────────
   Convert LocalMessage → ThreadMessageLike
   ────────────────────────────────────────────── */

function toThreadMessage(msg: LocalMessage): ThreadMessageLike {
  return {
    role: msg.role,
    content: [{ type: "text" as const, text: msg.content || " " }],
    id: msg.id,
    createdAt: msg.createdAt,
    ...(msg.role === "assistant" && {
      status:
        msg.status === "running"
          ? { type: "running" as const }
          : msg.status === "error"
            ? { type: "incomplete" as const, reason: "error" as const }
            : { type: "complete" as const, reason: "stop" as const },
    }),
  };
}

const stableConvertMessage = (msg: LocalMessage): ThreadMessageLike =>
  toThreadMessage(msg);

/* ──────────────────────────────────────────────
   Mock Responses per Mode
   ────────────────────────────────────────────── */

const MOCK_RESPONSES: Record<ChatMode, string[]> = {
  create: [
    "I'll create a video based on your input. Here's the plan:\n\n**Script Outline:**\n1. **Hook** (0-5s): A bold opening statement to grab attention\n2. **Context** (5-15s): Setting up the problem or topic\n3. **Main Content** (15-45s): Core value delivery with supporting points\n4. **CTA** (45-55s): Call-to-action for engagement\n\n**Settings:**\n- Template: Top 10 Listicle\n- Voice: Kokoro — af_heart (female)\n- Music: Dramatic\n- Resolution: 1080x1920 (9:16)\n\nWould you like me to proceed with this outline, or adjust anything?",
    "Great topic! I've analyzed trending content in this space. Here's what I recommend:\n\n**Video Strategy:**\n- **Format:** Faceless documentary style\n- **Duration:** 60-90 seconds for maximum retention\n- **B-Roll:** Stock footage from Pexels matched to narration\n- **Captions:** Karaoke style with brand colors\n\n**Scene Breakdown:**\n| Scene | Duration | Visual | Narration |\n|-------|----------|--------|----------|\n| 1 | 5s | Dramatic montage | Hook statement |\n| 2 | 15s | Data visualization | Problem setup |\n| 3 | 30s | B-roll footage | Main content |\n| 4 | 10s | Brand outro | CTA |\n\nShall I generate the full script and start rendering?",
  ],
  generate: [
    "I'll generate that image for you using **FLUX.1 schnell**. Here's the concept:\n\n**Prompt Engineering:**\n```\nProfessional YouTube thumbnail, bold text overlay area,\nhigh contrast lighting, cinematic composition,\nvibrant colors, 1280x720, photorealistic\n```\n\n**Specs:**\n- Model: FLUX.1 [schnell] (8-step)\n- Resolution: 1280 x 720\n- Style: YouTube-optimized thumbnail\n- Text overlay: Reserved left-third for title\n\nGenerating now... This typically takes 3-8 seconds on your GPU.\n\n*Once complete, the image will appear in your Creative Assets under the current project.*",
    "Here are the image generation options I can offer:\n\n**Available Models:**\n1. **FLUX.1 schnell** — Fast (3-8s), great for thumbnails and social graphics\n2. **Wan 2.1 T2V** — Video clips from text (8-15s generation)\n\n**Style Presets:**\n- Cinematic / Film\n- Minimalist / Clean\n- Bold / High Contrast\n- Illustrated / Cartoon\n- Dark / Moody\n\nDescribe what you'd like to generate, and I'll handle the prompt engineering for optimal results.",
  ],
  compose: [
    "I'll synthesize that narration for you. Here's the voice configuration:\n\n**Voice Settings:**\n- **Engine:** Kokoro (fast, high quality)\n- **Voice:** af_heart (female, warm)\n- **Speed:** 1.0x (natural pace)\n- **Format:** WAV, 44.1kHz, 16-bit\n\n**Preview:**\n> *\"Your narration text will be spoken naturally with appropriate pauses and emphasis...\"*\n\n**Estimated Duration:** ~32 seconds\n**Processing Time:** ~2 seconds\n\nThe audio file will be saved to your Creative Assets. You can also use it directly in any Faceless Studio project.\n\nWant me to proceed, or would you prefer a different voice?",
    "Here are the available voice options:\n\n**Kokoro (Fast — 2-3s generation):**\n- `af_heart` — Female, warm and engaging\n- `bf_narrator` — Male, professional narrator\n- `af_bright` — Female, energetic and upbeat\n- `bm_calm` — Male, calm and authoritative\n\n**Chatterbox (Premium — 5-8s generation):**\n- `deep` — Male, deep and cinematic\n- `warm` — Female, warm and natural\n- `clone` — Your voice (requires 10s reference audio)\n\n**Voice Cloning:**\nUpload a 10-second audio sample and Chatterbox will clone the voice for personalized narration.\n\nWhich voice would you like to use?",
  ],
  research: [
    "Based on your project data and competitor analysis, here's what I found:\n\n**Trending in Your Niche:**\n1. 🔥 **AI Agents replacing SaaS** — 2.4M engagement, 847 sources, rising\n2. 🔥 **Vibe coding** — 5.1M engagement, trending on TikTok\n3. 📊 **Open source AI models** — 1.2M engagement, rising on YouTube\n\n**Competitor Insights:**\n- @garyvee posted 14 times this week (avg 4.8% engagement)\n- @alexhormozi shifted to more Reels content (+37% follower growth)\n- @mkbhd's top-performing format: 60s tech explainers\n\n**Recommendation:**\nCreate content around \"AI Agents replacing SaaS\" — it's in your niche with high growth and moderate competition. Best format: 60-90s explainer with data overlay style.\n\nWant me to draft a script for this topic?",
    "I've analyzed your performance data across all connected platforms:\n\n**This Week's Performance:**\n| Metric | Value | vs Last Week |\n|--------|-------|-------------|\n| Views | 138.5K | +23% |\n| Likes | 8.3K | +18% |\n| Shares | 1.7K | +34% |\n| Comments | 635 | +12% |\n\n**Top Performing Content:**\n1. \"The secret to happiness\" — 94 virality score, 31.2K views\n2. \"How to get rich without getting lucky\" — 91 score, 23.1K views\n\n**Optimal Posting Times:**\n- YouTube: Tue/Thu 2:00 PM\n- TikTok: Daily 11:00 AM & 7:00 PM\n- Instagram: Mon/Wed/Fri 12:00 PM\n\nWould you like a deeper analysis on any specific metric or platform?",
  ],
};

const SUGGESTIONS: Record<ChatMode, { prompt: string }[]> = {
  create: [
    { prompt: "Create a 60-second explainer about AI tools" },
    { prompt: "Generate a Reddit story video with gameplay background" },
    { prompt: "Make a top 10 listicle about productivity hacks" },
  ],
  generate: [
    { prompt: "Create a YouTube thumbnail for my AI video" },
    { prompt: "Generate a channel banner in my brand colors" },
    { prompt: "Design a social media post graphic" },
  ],
  compose: [
    { prompt: "Narrate this script in a professional male voice" },
    { prompt: "Generate an intro jingle for my channel" },
    { prompt: "Clone my voice from a reference sample" },
  ],
  research: [
    { prompt: "What's trending in my niche right now?" },
    { prompt: "Analyze my top competitor's posting strategy" },
    { prompt: "Show my performance analytics for this week" },
  ],
};

/* ──────────────────────────────────────────────
   Mock Threads (initial)
   ────────────────────────────────────────────── */

const INITIAL_THREADS: LocalThread[] = [
  { id: "t1", title: "AI Tools Video Script", mode: "create", isArchived: false, createdAt: new Date("2026-03-07T09:00:00Z") },
  { id: "t2", title: "Channel Thumbnails", mode: "generate", isArchived: false, createdAt: new Date("2026-03-06T14:00:00Z") },
  { id: "t3", title: "Competitor Analysis Q1", mode: "research", isArchived: false, createdAt: new Date("2026-03-05T11:00:00Z") },
  { id: "t4", title: "Narration Test Voices", mode: "compose", isArchived: true, createdAt: new Date("2026-03-04T08:00:00Z") },
];

/* ──────────────────────────────────────────────
   Provider
   ────────────────────────────────────────────── */

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Derive mode from URL
  const mode: ChatMode = useMemo(() => {
    if (pathname.startsWith("/dashboard/generate")) return "generate";
    if (pathname.startsWith("/dashboard/compose")) return "compose";
    if (pathname.startsWith("/dashboard/research")) return "research";
    return "create";
  }, [pathname]);

  const setMode = useCallback(
    (m: ChatMode) => {
      const routes: Record<ChatMode, string> = {
        create: "/dashboard/create",
        generate: "/dashboard/generate",
        compose: "/dashboard/compose",
        research: "/dashboard/research",
      };
      router.push(routes[m]);
    },
    [router],
  );

  // Derive threadId from URL
  const currentThreadId = useMemo(() => {
    const match = pathname.match(
      /\/dashboard\/(?:create|generate|compose|research)\/([^/]+)/,
    );
    return match ? match[1] : null;
  }, [pathname]);

  // Thread + message state
  const [threads, setThreads] = useState<LocalThread[]>(INITIAL_THREADS);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear messages when thread changes
  useEffect(() => {
    if (!currentThreadId) {
      setLocalMessages([]);
    }
  }, [currentThreadId]);

  // Simulate streaming response
  const simulateResponse = useCallback(
    (assistantId: string, responseText: string) => {
      let idx = 0;
      const words = responseText.split(" ");

      const tick = () => {
        if (idx >= words.length) {
          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, status: "complete" as const } : m,
            ),
          );
          setIsRunning(false);
          return;
        }

        const chunk = words.slice(idx, idx + 3).join(" ") + " ";
        idx += 3;

        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk }
              : m,
          ),
        );

        timerRef.current = setTimeout(tick, 40 + Math.random() * 30);
      };

      timerRef.current = setTimeout(tick, 300);
    },
    [],
  );

  // Handle new message
  const onNew = useCallback(
    async (message: AppendMessage) => {
      const textPart = message.content.find(
        (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
      );
      if (!textPart?.text) return;
      const userText = textPart.text;

      const userMsg: LocalMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: userText,
        createdAt: new Date(),
      };

      const assistantId = `asst_${Date.now()}`;
      const assistantMsg: LocalMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "running",
        createdAt: new Date(),
      };

      setLocalMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsRunning(true);

      // Create thread if none exists
      let threadId = currentThreadId;
      if (!threadId) {
        const newThread: LocalThread = {
          id: `thread_${Date.now()}`,
          title: userText.slice(0, 60),
          mode,
          isArchived: false,
          createdAt: new Date(),
        };
        setThreads((prev) => [newThread, ...prev]);
        threadId = newThread.id;

        const routes: Record<ChatMode, string> = {
          create: "/dashboard/create",
          generate: "/dashboard/generate",
          compose: "/dashboard/compose",
          research: "/dashboard/research",
        };
        router.push(`${routes[mode]}/${newThread.id}`);
      }

      // Pick a mock response
      const responses = MOCK_RESPONSES[mode];
      const response = responses[Math.floor(Math.random() * responses.length)];
      simulateResponse(assistantId, response);
    },
    [currentThreadId, mode, router, simulateResponse],
  );

  const onCancel = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsRunning(false);
    setLocalMessages((prev) =>
      prev.map((m) =>
        m.status === "running" ? { ...m, status: "complete" as const } : m,
      ),
    );
  }, []);

  // Thread list adapter
  const modeRouteBase = useMemo(() => {
    const routes: Record<ChatMode, string> = {
      create: "/dashboard/create",
      generate: "/dashboard/generate",
      compose: "/dashboard/compose",
      research: "/dashboard/research",
    };
    return routes[mode];
  }, [mode]);

  const threadListAdapter: ExternalStoreThreadListAdapter = useMemo(
    () => ({
      threadId: currentThreadId || undefined,
      threads: threads
        .filter((t) => !t.isArchived)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: "regular" as const,
        })),
      archivedThreads: threads
        .filter((t) => t.isArchived)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: "archived" as const,
        })),
      onSwitchToNewThread: async () => {
        router.push(modeRouteBase);
      },
      onSwitchToThread: async (threadId: string) => {
        router.push(`${modeRouteBase}/${threadId}`);
      },
      onRename: async (threadId: string, newTitle: string) => {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t)),
        );
      },
      onArchive: async (threadId: string) => {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, isArchived: true } : t,
          ),
        );
      },
      onUnarchive: async (threadId: string) => {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, isArchived: false } : t,
          ),
        );
      },
      onDelete: async (threadId: string) => {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (currentThreadId === threadId) router.push(modeRouteBase);
      },
    }),
    [currentThreadId, threads, router, modeRouteBase],
  );

  // Build runtime
  const runtime = useExternalStoreRuntime({
    messages: localMessages,
    convertMessage: stableConvertMessage,
    isRunning,
    onNew,
    onCancel,
    adapters: {
      threadList: threadListAdapter,
    },
    suggestions: currentThreadId ? undefined : SUGGESTIONS[mode],
  });

  return (
    <ChatModeContext.Provider value={{ mode, setMode }}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </ChatModeContext.Provider>
  );
}
