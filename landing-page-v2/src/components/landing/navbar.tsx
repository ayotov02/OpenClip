"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { NAV_LINKS, GITHUB_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/50 backdrop-blur-md border-b border-black/[0.03]">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-20">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          OpenClip.
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-black/50 hover:text-black transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "default" }),
            "rounded-full px-7 h-10 text-sm"
          )}
        >
          Get Started
        </a>
      </div>
    </nav>
  );
}
