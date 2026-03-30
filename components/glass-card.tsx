"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

/**
 * Double-bezel "Ethereal Glass" card.
 *
 * Outer shell: subtle border at 6% opacity with 24px radius and 3px padding.
 * Inner core: surface-colored container with 20px radius and a top-edge
 * inset highlight that simulates frosted glass refraction.
 *
 * Ported from the Flutter GlassCard widget.
 */
export function GlassCard({ children, className, innerClassName }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-[3px]",
        "bg-white/[0.03] dark:bg-white/[0.03]",
        "dark:shadow-[0_0_30px_-10px_rgba(232,168,56,0.05)]",
        className
      )}
    >
      <div
        className={cn(
          "rounded-[20px] bg-[var(--surface)] h-full",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),inset_0_-1px_2px_rgba(0,0,0,0.06)]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
