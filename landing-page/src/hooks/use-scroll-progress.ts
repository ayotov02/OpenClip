"use client";

import { useScroll, useTransform, type MotionValue } from "framer-motion";

export function useScrollProgress(): {
  scrollYProgress: MotionValue<number>;
  navOpacity: MotionValue<number>;
} {
  const { scrollYProgress } = useScroll();
  const navOpacity = useTransform(scrollYProgress, [0, 0.05], [0.6, 1]);

  return { scrollYProgress, navOpacity };
}
