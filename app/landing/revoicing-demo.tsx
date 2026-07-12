"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StreamingText } from "@/components/streaming-text";
import { DEMO_SOURCE, DEMO_VARIANTS } from "@/lib/landing-demo";
import { cn } from "@/lib/utils";

// Word-reveal cadence (ms). Jitter between MIN..MAX makes the stream feel typed
// by a model rather than metronomic — matches the real product's SSE rhythm.
const WORD_MIN_MS = 40;
const WORD_MAX_MS = 70;
// How long a finished take rests (cursor off) so the reader can absorb it.
const HOLD_MS = 1900;
// Brief pause on the persona/tab switch before the next take begins streaming.
const SWITCH_MS = 550;

/**
 * Auto-playing re-voicing stage for the /landing centerpiece.
 *
 * One source sentence is re-voiced through three real personas in an infinite
 * loop, revealed word-by-word through the product's own {@link StreamingText}
 * so the token-bloom + cursor are the genuine rendering — no API calls.
 *
 * Accessibility / performance:
 *   • prefers-reduced-motion → no streaming; full takes shown statically and the
 *     persona chips become a manual switcher.
 *   • document.hidden → the loop freezes (no wasted timers) and resumes exactly
 *     where it left off, tracked via refs so re-runs never lose position.
 *   • The output reserves the height of the *tallest* take at every width via an
 *     invisible grid-stacked sizer, so streaming never shifts layout.
 */
export function RevoicingDemo() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [personaIndex, setPersonaIndex] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [streaming, setStreaming] = useState(true);
  // Bumped on a manual chip jump to restart the driver effect cleanly.
  const [restartNonce, setRestartNonce] = useState(0);

  // Refs are the source of truth for loop position so a freeze/resume (or a
  // manual jump) can seed the next run without a stale-closure snapshot.
  const personaRef = useRef(0);
  const wordRef = useRef(0);

  // Pre-split every take once; the active take drives the reveal.
  const wordLists = useMemo(
    () => DEMO_VARIANTS.map((variant) => variant.text.split(" ")),
    [],
  );

  // ── Environment listeners: reduced-motion + tab visibility ────────────────
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motionQuery.matches);
    const onMotionChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    motionQuery.addEventListener("change", onMotionChange);

    const onVisibility = () => setPaused(document.hidden);
    setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // ── The reveal loop ───────────────────────────────────────────────────────
  useEffect(() => {
    // Static path handles reduced-motion; a hidden tab freezes the loop.
    if (reducedMotion || paused) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (cancelled) return;
      const totalWords = wordLists[personaRef.current].length;

      if (wordRef.current < totalWords) {
        wordRef.current += 1;
        setWordCount(wordRef.current);
        setStreaming(true);
        const delay = WORD_MIN_MS + Math.random() * (WORD_MAX_MS - WORD_MIN_MS);
        timer = setTimeout(step, delay);
        return;
      }

      // Take complete: drop the cursor, let it rest, then switch personas.
      setStreaming(false);
      timer = setTimeout(() => {
        if (cancelled) return;
        personaRef.current = (personaRef.current + 1) % DEMO_VARIANTS.length;
        wordRef.current = 0;
        setPersonaIndex(personaRef.current);
        setWordCount(0);
        setStreaming(true);
        timer = setTimeout(step, SWITCH_MS);
      }, HOLD_MS);
    };

    // Re-seed render state from refs so a resume continues seamlessly.
    setPersonaIndex(personaRef.current);
    setWordCount(wordRef.current);
    step();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reducedMotion, paused, restartNonce, wordLists]);

  // Chip click: manual switcher under reduced-motion, or a live jump otherwise.
  const jumpToPersona = useCallback(
    (index: number) => {
      personaRef.current = index;
      wordRef.current = 0;
      setPersonaIndex(index);
      setWordCount(0);
      setStreaming(true);
      // Restart the driver so the loop continues from the chosen persona.
      setRestartNonce((nonce) => nonce + 1);
    },
    [],
  );

  const activeWords = wordLists[personaIndex];
  const shownText = reducedMotion
    ? DEMO_VARIANTS[personaIndex].text
    : activeWords.slice(0, wordCount).join(" ");
  const isStreamingNow = reducedMotion ? false : streaming;

  return (
    <div className="flex flex-col gap-5">
      {/* Studio status strip */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Live studio — re-voicing
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          <span
            className={cn(
              "size-1.5 rounded-full bg-[var(--amber)]",
              isStreamingNow && "pulse-dot",
            )}
          />
          {isStreamingNow ? "Rec" : "Take"}
        </span>
      </div>

      {/* Source rough draft */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4">
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Source
        </p>
        <p className="font-sans text-sm leading-relaxed text-[var(--text-muted)]">
          {DEMO_SOURCE}
        </p>
      </div>

      {/* Persona tabs */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Re-voicing persona"
      >
        {DEMO_VARIANTS.map((variant, index) => {
          const active = index === personaIndex;
          return (
            <button
              key={variant.persona}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => jumpToPersona(index)}
              className={cn(
                "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150",
                active
                  ? "border-[var(--amber)] bg-[var(--amber-dim)] text-[var(--amber)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {variant.persona}
            </button>
          );
        })}
      </div>

      {/* Re-voiced output — height reserved for the tallest take (no shift) */}
      <div>
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--amber)]">
          {DEMO_VARIANTS[personaIndex].persona}
        </p>
        <div className="grid">
          {/* Invisible sizer: every take stacked in one cell fixes the height to
              the tallest at any viewport width. */}
          {DEMO_VARIANTS.map((variant) => (
            <p
              key={variant.persona}
              aria-hidden
              className="invisible col-start-1 row-start-1 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap"
            >
              {variant.text}
            </p>
          ))}
          {/* Live take rendered by the product's own streaming component. */}
          <div className="col-start-1 row-start-1" aria-live="polite">
            <StreamingText text={shownText} isStreaming={isStreamingNow} />
          </div>
        </div>
      </div>
    </div>
  );
}
