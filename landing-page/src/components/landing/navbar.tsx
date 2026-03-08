"use client";

import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NAV_LINKS, LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 100], [0.6, 0.95]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 0.08]);

  return (
    <>
      <motion.header
        style={{
          backgroundColor: useTransform(
            bgOpacity,
            (v) => `rgba(10, 10, 11, ${v})`
          ),
          borderBottomColor: useTransform(
            borderOpacity,
            (v) => `rgba(255, 255, 255, ${v})`
          ),
        }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b"
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-1.5 text-xl font-bold tracking-tight font-[var(--font-inter-tight)]">
            Open<span className="text-indigo-500">Clip</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1" />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-400 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:block">
            <a
              href={LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "default" }),
                "bg-indigo-600 hover:bg-indigo-500 text-white px-5"
              )}
            >
              Get Started
            </a>
          </div>

          <button
            className="md:hidden text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>
      </motion.header>

      {/* Mobile menu */}
      <motion.div
        initial={false}
        animate={mobileOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        className={cn(
          "fixed top-16 left-0 right-0 z-40 glass p-6 flex flex-col gap-4 md:hidden",
          !mobileOpen && "pointer-events-none"
        )}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className="text-sm text-zinc-300 hover:text-white transition-colors py-2"
          >
            {link.label}
          </a>
        ))}
        <a
          href={LINKS.github}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "default" }),
            "bg-indigo-600 hover:bg-indigo-500 text-white w-full mt-2"
          )}
        >
          Get Started
        </a>
      </motion.div>
    </>
  );
}
