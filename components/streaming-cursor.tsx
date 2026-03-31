"use client";

import { motion } from "framer-motion";

/**
 * Blinking amber cursor displayed inline during text streaming.
 *
 * 2px wide, 18px tall bar colored with the design system amber.
 * Pulses opacity 1 -> 0.2 on repeat. In dark mode, adds an amber
 * glow via box-shadow to match the Flutter _StreamingText cursor.
 */
export function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-[16px] bg-[var(--amber)] align-text-bottom ml-0.5"
      animate={{ opacity: [1, 0.2] }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
    />
  );
}
