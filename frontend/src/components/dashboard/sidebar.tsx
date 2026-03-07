"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Scissors,
  Video,
  Palette,
  CalendarDays,
  Send,
  BarChart3,
  Settings,
  PanelLeft,
  Sparkles,
  LayoutDashboard,
  FileStack,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "CREATE",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
      { href: "/dashboard/projects", icon: Scissors, label: "Projects" },
      { href: "/dashboard/faceless", icon: Video, label: "Faceless Studio" },
      { href: "/dashboard/brands", icon: Palette, label: "Brand Kits" },
    ],
  },
  {
    label: "DISTRIBUTE",
    items: [
      { href: "/dashboard/calendar", icon: CalendarDays, label: "Calendar" },
      { href: "/dashboard/publish", icon: Send, label: "Publishing" },
      { href: "/dashboard/batch", icon: FileStack, label: "Batch" },
    ],
  },
  {
    label: "ANALYZE",
    items: [
      { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/dashboard/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-border/50 transition-all duration-200",
        collapsed ? "w-16" : "w-[260px]"
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex h-14 items-center gap-2 px-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {!collapsed && (
          <span className="text-base font-bold text-foreground">
            Open<span className="text-primary">Clip</span>
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 py-4">
        {navGroups.map((group, gi) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="mb-1 px-4 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              const NavContent = (
                <Link
                  href={item.href}
                  className={cn(
                    "group relative mx-2 flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-1.5 h-5 w-[3px] rounded-r-full bg-primary" />
                  )}
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                </Link>
              );

              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{NavContent}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.href}>{NavContent}</div>
              );
            })}
            {gi < navGroups.length - 1 && !collapsed && (
              <Separator className="mx-4 my-3 bg-border/50" />
            )}
          </div>
        ))}
      </ScrollArea>

      {/* Self-Hosted Banner */}
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            Self-Hosted
          </div>
          <p className="mt-1 text-xs text-primary/70">
            Running locally — unlimited, free forever
          </p>
        </div>
      )}
    </aside>
  );
}
