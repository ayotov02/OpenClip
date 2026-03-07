# Mobile-Responsive UI & PWA — Implementation Guide

## Overview
- **What:** Make the OpenClip frontend fully responsive for mobile/tablet devices and add Progressive Web App (PWA) support so users can install it on their home screen with offline access to the dashboard.
- **Why:** 60%+ of creator workflows start on mobile (browsing content, checking analytics). A PWA removes the need for a native app while providing app-like experience.
- **Dependencies:** Phase 1 Feature 8 (React Frontend), Phase 2 Feature 6 (Video Editor)

## Architecture

### Responsive Breakpoints
```
Mobile:   < 640px   (sm)  — Single column, bottom nav, stacked layouts
Tablet:   640-1024px (md) — Two column, collapsible sidebar
Desktop:  > 1024px  (lg)  — Full sidebar, multi-panel layouts
```

### PWA Components
```
Next.js App
├── next-pwa config (next.config.js)
├── public/
│   ├── manifest.json          # App manifest
│   ├── sw.js                  # Service worker (auto-generated)
│   ├── icons/                 # App icons (72-512px)
│   └── offline.html           # Offline fallback page
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MobileNav.tsx      # Bottom navigation bar
│   │   │   ├── ResponsiveSidebar.tsx  # Collapsible sidebar
│   │   │   └── AppShell.tsx       # Responsive app shell
│   │   ├── mobile/
│   │   │   ├── SwipeableCard.tsx   # Swipeable clip cards
│   │   │   ├── TouchTimeline.tsx   # Touch-friendly timeline
│   │   │   └── PullToRefresh.tsx   # Pull-to-refresh wrapper
│   │   └── pwa/
│   │       ├── InstallPrompt.tsx   # PWA install banner
│   │       └── OfflineIndicator.tsx # Offline status bar
│   └── hooks/
│       ├── useMediaQuery.ts       # Responsive breakpoint hook
│       ├── useInstallPrompt.ts    # PWA install prompt hook
│       └── useOnlineStatus.ts     # Network status hook
```

## Step-by-Step Implementation

### Step 1: Configure PWA with next-pwa
```bash
cd frontend
npm install next-pwa
```

```javascript
// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/api\/v1\/(projects|jobs|clips)/,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
      },
    },
  ],
});

module.exports = withPWA({
  // existing next config
});
```

### Step 2: Create App Manifest
```json
// public/manifest.json
{
  "name": "OpenClip — AI Video Creation",
  "short_name": "OpenClip",
  "description": "Open-source AI video creation platform",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#6366f1",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Step 3: Create Responsive Layout Components

```typescript
// src/hooks/useMediaQuery.ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

export const useIsMobile = () => useMediaQuery("(max-width: 639px)");
export const useIsTablet = () => useMediaQuery("(min-width: 640px) and (max-width: 1023px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
```

```typescript
// src/components/layout/MobileNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Film, Wand2, BarChart3, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/projects", icon: Film, label: "Projects" },
  { href: "/faceless", icon: Wand2, label: "Create" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background px-2 pb-safe md:hidden">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-1 px-3 py-1 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

```typescript
// src/components/layout/AppShell.tsx
"use client";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <div className="min-h-screen">
      {!isMobile && <Sidebar />}
      <main className={`${isMobile ? "pb-20" : "ml-64"} p-4 md:p-6`}>
        {children}
      </main>
      {isMobile && <MobileNav />}
    </div>
  );
}
```

### Step 4: Touch-Optimized Components

```typescript
// src/components/mobile/TouchTimeline.tsx
"use client";
import { useRef, useState } from "react";

interface TouchTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TouchTimeline({ duration, currentTime, onSeek }: TouchTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouch = (e: React.TouchEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSeek(pct * duration);
  };

  return (
    <div
      ref={trackRef}
      className="relative h-12 w-full touch-none"
      onTouchStart={(e) => { setIsDragging(true); handleTouch(e); }}
      onTouchMove={handleTouch}
      onTouchEnd={() => setIsDragging(false)}
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
      </div>
      <div
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary transition-transform ${isDragging ? "h-6 w-6" : "h-4 w-4"}`}
        style={{ left: `${(currentTime / duration) * 100}%` }}
      />
    </div>
  );
}
```

### Step 5: PWA Install Prompt

```typescript
// src/hooks/useInstallPrompt.ts
"use client";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return { canInstall: !!deferredPrompt && !isInstalled, isInstalled, install };
}
```

### Step 6: Responsive Tailwind Patterns

Apply responsive patterns across all pages:
```css
/* Key responsive utilities */
/* Bottom safe area for iOS */
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }

/* Touch targets: minimum 44x44px on mobile */
.touch-target { @apply min-h-[44px] min-w-[44px]; }
```

```typescript
// Responsive grid pattern used across pages
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {clips.map(clip => <ClipCard key={clip.id} clip={clip} />)}
</div>

// Responsive dialog → bottom sheet on mobile
<Dialog>
  <DialogContent className="sm:max-w-md max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:rounded-b-none max-sm:rounded-t-2xl">
    {/* content */}
  </DialogContent>
</Dialog>
```

## Best Practices
- **44px minimum touch targets:** All tappable elements must be at least 44x44px on mobile (Apple HIG).
- **Bottom sheet pattern:** Replace modal dialogs with bottom sheets on mobile for thumb-friendly interaction.
- **Avoid hover-only interactions:** Every hover effect must have a tap/press equivalent.
- **Cache API responses:** Service worker caches API responses so the dashboard loads instantly on repeat visits.
- **Lazy load heavy components:** Video editor and timeline components should use `dynamic()` import on mobile.
- **Test on real devices:** Simulators miss real touch behavior, scrolling physics, and safe areas.

## Testing
- Load dashboard on iPhone Safari → verify bottom nav, no horizontal scroll
- Load on iPad → verify two-column layout, collapsible sidebar
- Install PWA on Android Chrome → verify home screen icon, standalone mode
- Toggle airplane mode → verify offline indicator shows, cached pages load
- Test video editor touch timeline → verify seek works smoothly
- Verify all touch targets are >= 44px with Chrome DevTools

## Verification Checklist
- [ ] All pages responsive at 320px, 640px, 1024px, 1440px widths
- [ ] Bottom navigation visible on mobile, sidebar on desktop
- [ ] PWA installable on Chrome (Android) and Safari (iOS)
- [ ] Service worker caches static assets and API responses
- [ ] Offline fallback page displays when network unavailable
- [ ] Touch timeline works for video scrubbing
- [ ] Bottom sheets replace modals on mobile
- [ ] Safe area insets applied (iPhone notch/home indicator)
- [ ] No horizontal scrolling on any page at any breakpoint
- [ ] Lighthouse PWA score > 90
