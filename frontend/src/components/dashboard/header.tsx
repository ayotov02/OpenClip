"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Moon, Sun, Scissors, Video, BarChart3 } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mockUser, mockJobs } from "@/lib/mock-data";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const activeJobs = mockJobs.filter((j) => j.status === "running").length;

  return (
    <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-center gap-4 px-6 pointer-events-none">
      {/* Center — Feature tabs */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/30 bg-background/70 backdrop-blur-md p-1">
        {[
          { label: "Projects", href: "/dashboard/projects", icon: Scissors },
          { label: "Faceless", href: "/dashboard/faceless", icon: Video },
          { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              pathname.startsWith(tab.href)
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Right — Actions */}
      <div className="pointer-events-auto absolute right-6 flex items-center gap-1">
        {/* Search trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-8 gap-2 rounded-full px-3 text-muted-foreground/70 hover:bg-background hover:shadow-sm md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Search...</span>
          <kbd className="ml-2 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
            /
          </kbd>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-background hover:shadow-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Active jobs indicator */}
        {activeJobs > 0 && (
          <div className="hidden items-center gap-1.5 rounded-full px-2 md:flex">
            <div className="relative h-6 w-6">
              <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="none" className="stroke-border" strokeWidth="2" />
                <circle
                  cx="12" cy="12" r="9" fill="none" className="stroke-primary" strokeWidth="2"
                  strokeDasharray={`${(67 / 100) * 56.5} 56.5`} strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-xs text-muted-foreground">
              {activeJobs} active
            </span>
          </div>
        )}

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center rounded-full p-0.5 transition-colors hover:bg-background hover:shadow-sm">
              <Avatar className="h-7 w-7 border border-border">
                <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                  {mockUser.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {mockUser.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{mockUser.name}</p>
                  <p className="text-xs text-muted-foreground">{mockUser.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px]">
                SELF-HOSTED
              </Badge>
              <span className="ml-2 text-sm">Instance Info</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
