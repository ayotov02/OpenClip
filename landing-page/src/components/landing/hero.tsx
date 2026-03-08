"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play, ImageIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { GradientMesh } from "@/components/effects/gradient-mesh";
import { SplitText } from "@/components/effects/split-text";
import { LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import CountUp from "react-countup";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
      <GradientMesh />

      {/* Floating dots */}
      <div className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-indigo-500/40 animate-float" />
      <div className="absolute top-1/3 right-[20%] w-1.5 h-1.5 rounded-full bg-cyan-400/30 animate-float-delayed" />
      <div className="absolute bottom-1/3 left-[25%] w-1 h-1 rounded-full bg-indigo-400/30 animate-float-slow" />
      <div className="absolute top-2/3 right-[15%] w-2.5 h-2.5 rounded-full bg-purple-400/20 animate-float" />
      <div className="absolute bottom-1/4 right-[30%] w-1.5 h-1.5 rounded-full bg-cyan-300/20 animate-float-delayed" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <SplitText
          text="Create Viral Videos."
          as="h1"
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight font-[var(--font-inter-tight)]"
          stagger={0.04}
        />

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
          className="mt-6 text-2xl sm:text-3xl md:text-4xl font-semibold bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent font-[var(--font-inter-tight)]"
        >
          Free. Forever. Open-Source.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.6, ease: "easeOut" }}
          className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
        >
          The AI video platform that replaces OpusClip ($29/mo), AdSpy ($149/mo),
          and BuzzSumo ($199/mo). No watermarks. No subscriptions. Self-hosted.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.6, ease: "easeOut" }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href={LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-6 text-base animate-pulse-glow rounded-xl flex items-center gap-2"
            )}
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#how-it-works"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 px-8 py-6 text-base rounded-xl flex items-center gap-2"
            )}
          >
            <Play className="h-4 w-4" />
            Watch Demo
          </a>
        </motion.div>

        {/* Hero Image Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.4, duration: 0.8, ease: "easeOut" }}
          className="mt-16 animate-hero-float"
        >
          <div className="aspect-video max-w-4xl mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/10 to-cyan-400/10 border border-white/10 flex items-center justify-center glass">
            <div className="text-center">
              <ImageIcon className="h-16 w-16 mx-auto text-white/20" />
              <p className="mt-4 text-sm text-white/40">
                Replace with: Main dashboard screenshot
              </p>
              <p className="text-xs text-white/20 mt-1">1920x1080</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8, duration: 0.6, ease: "easeOut" }}
          className="mt-12 grid grid-cols-3 gap-8 max-w-lg mx-auto"
        >
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-400 font-[var(--font-inter-tight)]">
              <CountUp end={48} duration={2} delay={3} suffix="+" enableScrollSpy scrollSpyOnce />
            </p>
            <p className="text-xs text-zinc-500 mt-1">Features</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-400 font-[var(--font-inter-tight)]">
              $0
            </p>
            <p className="text-xs text-zinc-500 mt-1">Forever</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-cyan-400 font-[var(--font-inter-tight)]">
              100%
            </p>
            <p className="text-xs text-zinc-500 mt-1">Open Source</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
