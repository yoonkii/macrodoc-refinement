"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

/**
 * Double-bezel glass card from the Ethereal Glass aesthetic.
 *
 * Outer shell: 16px radius, 3px padding for the gradient border effect,
 * subtle gradient background with 5% white border that brightens on hover.
 *
 * Inner core: 13px radius (16-3), backdrop-blur-[40px], dark glass fill,
 * subtle inset feel.
 *
 * Layout classes (flex-1, min-h-0, h-full, shrink-0, etc.) go on the outer div
 * via `className`. Content arrangement classes go on the inner div via
 * `innerClassName` — it always gets `h-full` by default.
 */
export function GlassCard({ children, className, innerClassName }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-[3px] border transition-colors duration-300",
        "bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-white/[0.04]",
        "border-white/[0.05] hover:border-white/[0.09]",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-[13px] bg-[rgba(8,8,10,0.85)] backdrop-blur-[40px]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
