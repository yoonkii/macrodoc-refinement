import { cn } from "@/lib/utils";

interface LimitMeterProps {
  count: number;
  limit: number;
}

/** Ratio at which the meter flips from calm (teal) to warning (amber). */
const WARN_THRESHOLD = 0.8;

/**
 * VU-meter style character counter for platform tabs.
 *
 * Renders a mono `{count} / {limit}` line above a 2px fill bar. The bar width
 * tracks count/limit (clamped to 100%) and animates over 150ms so it reads like
 * a live level meter while multi-post text streams in. Color escalates
 * teal → amber (>=80%) → error (over limit); over-limit also reddens the
 * counter text. No glyphs, no emoji — the bar carries the signal.
 */
export function LimitMeter({ count, limit }: LimitMeterProps) {
  const ratio = limit > 0 ? count / limit : 0;
  const isOver = count > limit;
  const fillPercent = Math.min(ratio, 1) * 100;
  const fillColor = isOver
    ? "var(--error)"
    : ratio >= WARN_THRESHOLD
      ? "var(--amber)"
      : "var(--teal)";

  return (
    <div className="w-full">
      <div
        className={cn(
          "font-mono text-[10px] tabular-nums text-right",
          isOver ? "text-[var(--error)]" : "text-[var(--text-muted)]"
        )}
      >
        {count} / {limit}
      </div>
      <div className="mt-1 h-[2px] w-full rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="limit-meter-fill h-full rounded-full"
          style={{ width: `${fillPercent}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}
