"use client";

import { motion } from "framer-motion";

/**
 * Blinking amber cursor displayed inline during text streaming.
 *
 * 2px wide, 18px tall bar colored with the design system amber.
 * Pulses opacity 1 -> 0.2 on repeat. In dark mode, adds an amber
 * glow via box-shadow to match the Flutter _StreamingText cursor.
 *
 * The `streaming-cursor` class is a stable hook for the MDR theme, which
 * overrides the shape into a solid Lumon-green block with a steps() blink
 * (see globals.css `.mdr .streaming-cursor`). CSS animations outrank the inline
 * opacity Framer Motion sets, so the block blink wins without a logic change.
 */
export function StreamingCursor() {
  return (
    <motion.span
      className="streaming-cursor inline-block w-[2px] h-[16px] bg-[var(--amber)] align-text-bottom ml-0.5"
      style={{ boxShadow: "0 0 6px var(--amber-dim)" }}
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
