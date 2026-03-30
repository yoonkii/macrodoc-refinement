import { cn } from "@/lib/utils";

interface CharCounterProps {
  current: number;
  max: number;
}

/**
 * Pill-shaped character counter badge.
 *
 * Displays "current / max" in JetBrains Mono. When the character count
 * exceeds the limit, switches to an error-colored state with bold weight.
 *
 * Ported from the Flutter CharacterCounter widget.
 */
export function CharCounter({ current, max }: CharCounterProps) {
  const isOver = current > max;

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full font-mono text-xs",
        isOver
          ? "bg-[var(--error-dim)] text-[var(--error)] font-bold"
          : "bg-[var(--elevated)] text-[var(--text-muted)]"
      )}
    >
      {current} / {max}
    </span>
  );
}
