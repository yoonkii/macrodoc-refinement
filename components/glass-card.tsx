"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Flat Linear-style card with subtle border.
 * No glass effects, no blur, no glow — just clean surface + border.
 */
export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--surface)] border border-[var(--border)] rounded-md",
        className
      )}
    >
      {children}
    </div>
  );
}
