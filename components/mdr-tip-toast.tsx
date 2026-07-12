"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { X } from "lucide-react";
import { useTextRefineStore } from "@/lib/stores/text-refine";

/** localStorage flag so the discovery tip is shown at most once, ever. */
const TIP_SHOWN_KEY = "mdr-tip-shown";
/** Auto-dismiss delay (ms). */
const AUTO_DISMISS_MS = 10_000;

/**
 * One-time discovery toast that points at the hidden MDR theme.
 *
 * It subscribes to the text-refine store and fires the very first time a
 * refinement completes successfully (processing → idle, non-empty output, no
 * error). This lives entirely outside the store's core flow — it only observes.
 * The shown-state is persisted in localStorage so it never repeats, and it is
 * suppressed outright when the user is already in the mdr theme.
 */
export function MdrTipToast() {
  const isProcessing = useTextRefineStore((s) => s.isProcessing);
  const refinedText = useTextRefineStore((s) => s.refinedText);
  const errorMessage = useTextRefineStore((s) => s.errorMessage);
  const { theme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const prevProcessingRef = useRef(isProcessing);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const wasProcessing = prevProcessingRef.current;
    prevProcessingRef.current = isProcessing;

    if (!mounted) return;
    // Never intrude while already in the theme this tip advertises.
    if (theme === "mdr") return;

    // Detect the completion edge: was streaming, now idle, with clean output.
    const justCompleted =
      wasProcessing &&
      !isProcessing &&
      refinedText.length > 0 &&
      errorMessage.length === 0;
    if (!justCompleted) return;

    if (window.localStorage.getItem(TIP_SHOWN_KEY) === "1") return;
    window.localStorage.setItem(TIP_SHOWN_KEY, "1");
    setVisible(true);
  }, [isProcessing, refinedText, errorMessage, theme, mounted]);

  // Arm the auto-dismiss timer whenever the toast becomes visible.
  useEffect(() => {
    if (!visible) return;
    dismissTimerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mdr-tip-toast fixed bottom-6 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <p className="flex-1 font-mono text-[11px] uppercase leading-relaxed tracking-[0.08em] text-[var(--text-muted)]">
          Tip: The work is mysterious and important.{" "}
          <span className="text-[var(--amber)]">
            Try clicking the title three times.
          </span>
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss tip"
          className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
