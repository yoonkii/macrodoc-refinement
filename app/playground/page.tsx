"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useStyleProfilesStore } from "@/lib/stores/style-profiles";
import { streamRefine } from "@/lib/api";
import { buildRefinementPrompt } from "@/lib/prompt-builder";
import type { StyleProfile, ProfileType } from "@/lib/types";
import { GlassCard } from "@/components/glass-card";
import { StreamingCursor } from "@/components/streaming-cursor";
import { Button } from "@/components/ui/button";

const TONE_LABELS: Array<{ value: number; label: string }> = [
  { value: -1.0, label: "Board Memo" },
  { value: -0.5, label: "Business Professional" },
  { value: 0.0, label: "Balanced" },
  { value: 0.5, label: "Conversational" },
  { value: 1.0, label: "Texting a Friend" },
];

export default function PlaygroundPage() {
  const router = useRouter();
  const store = useStyleProfilesStore();

  // Form state
  const [styleName, setStyleName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [fewShots, setFewShots] = useState<string[]>([""]);
  const [toneBaseline, setToneBaseline] = useState(0);

  // Test state
  const [testText, setTestText] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const canTest = testText.trim().length > 0 && instructions.trim().length > 0;
  const canSave = styleName.trim().length > 0 && instructions.trim().length > 0;

  // Find the closest tone label for display
  const currentToneLabel =
    TONE_LABELS.reduce((closest, tier) =>
      Math.abs(tier.value - toneBaseline) < Math.abs(closest.value - toneBaseline)
        ? tier
        : closest
    ).label;

  function addFewShot() {
    setFewShots((prev) => [...prev, ""]);
  }

  function removeFewShot(index: number) {
    setFewShots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFewShot(index: number, value: string) {
    setFewShots((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  const handleTest = useCallback(async () => {
    if (!canTest) return;

    // Cancel any in-flight stream
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setTestOutput("");

    const validFewShots = fewShots
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Build a temporary profile to pass through the prompt builder
    const tempProfile: StyleProfile = {
      id: "playground-test",
      name: styleName.trim() || "Custom Style",
      instructions: instructions.trim(),
      fewShots: validFewShots,
      isActive: true,
      type: "custom" as ProfileType,
      toneBaseline,
      charLimit: null,
    };

    const prompt = buildRefinementPrompt({
      inputText: testText.trim(),
      activeProfiles: [tempProfile],
      toneValue: toneBaseline,
      personalityMode: tempProfile,
    });

    try {
      for await (const chunk of streamRefine(prompt, controller.signal)) {
        if (controller.signal.aborted) return;
        setTestOutput((prev) => prev + chunk);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (controller.signal.aborted) return;

      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setTestOutput(`Error: ${message}`);
    } finally {
      if (!controller.signal.aborted) {
        setIsStreaming(false);
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [canTest, testText, instructions, fewShots, styleName, toneBaseline]);

  function handleSave() {
    if (!canSave) return;

    const validFewShots = fewShots
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newProfile: StyleProfile = {
      id: crypto.randomUUID(),
      name: styleName.trim(),
      instructions: instructions.trim(),
      fewShots: validFewShots,
      isActive: false,
      type: "custom" as ProfileType,
      toneBaseline,
      charLimit: null,
    };

    store.addProfile(newProfile);
    router.push("/");
  }

  return (
    <div className="relative z-10 flex flex-col h-dvh overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="flex items-center h-12 px-4 gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <h1 className="text-base font-semibold tracking-tight text-[var(--text)]">
            Style Playground
          </h1>
        </div>
      </header>

      {/* Main content — two-column layout */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 md:p-5 gap-4">
        {/* Left column: Configuration (60%) */}
        <div className="lg:flex-[3] min-h-0 overflow-y-auto">
          <GlassCard className="h-full" innerClassName="flex flex-col p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))] mb-4">
              Configuration
            </h2>

            <div className="flex-1 overflow-y-auto space-y-5">
              {/* Style name */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Style Name
                </label>
                <input
                  type="text"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder="e.g., My Custom Style"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--amber)] transition-colors"
                />
              </div>

              {/* System prompt / instructions */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  System Prompt / Instructions
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Describe how text should be refined with this style..."
                  rows={8}
                  className="w-full min-h-[200px] rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-y focus:border-[var(--amber)] transition-colors"
                />
              </div>

              {/* Few-shot examples */}
              <div>
                <p className="text-sm font-medium text-[var(--text)] mb-2">
                  Few-Shot Examples (Optional)
                </p>
                {fewShots.map((shot, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <textarea
                      value={shot}
                      onChange={(e) => updateFewShot(index, e.target.value)}
                      placeholder='Example: Instead of "X", write "Y"'
                      rows={2}
                      className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none focus:border-[var(--amber)] transition-colors"
                    />
                    {fewShots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFewShot(index)}
                        className="self-start p-1.5 text-[var(--error)] hover:bg-[var(--error-dim)] rounded-md transition-colors"
                        aria-label="Remove example"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFewShot}
                  className="inline-flex items-center gap-1 text-sm text-[var(--amber)] hover:text-[var(--amber-hover)] transition-colors"
                >
                  <Plus className="size-4" />
                  Add Example
                </button>
              </div>

              {/* Tone baseline slider */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Tone Baseline
                </label>
                {/* Tier labels */}
                <div className="flex justify-between px-0.5 mb-2">
                  {TONE_LABELS.map((tier) => (
                    <span
                      key={tier.value}
                      className={cn(
                        "font-mono text-[10px] tracking-wide text-center flex-1 truncate transition-colors duration-150",
                        tier.label === currentToneLabel
                          ? "text-[var(--amber)] font-semibold"
                          : "text-[var(--text-muted)] font-normal"
                      )}
                    >
                      {tier.label}
                    </span>
                  ))}
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.5}
                  value={toneBaseline}
                  onChange={(e) => setToneBaseline(parseFloat(e.target.value))}
                  className="w-full accent-[var(--amber)] cursor-pointer"
                />
                <p className="text-center font-mono text-[10px] font-medium text-[var(--amber)] tracking-wide mt-1">
                  {currentToneLabel}
                </p>
              </div>
            </div>

            {/* Save button */}
            <div className="shrink-0 pt-4 border-t border-[var(--border)] mt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 h-10 rounded-full font-sans text-sm font-medium transition-all",
                  canSave
                    ? "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
                    : "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed"
                )}
              >
                Save Style
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Right column: Live preview (40%) */}
        <div className="lg:flex-[2] min-h-0 flex flex-col">
          <GlassCard className="h-full" innerClassName="flex flex-col p-5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))] mb-4">
              Live Preview
            </h2>

            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* Test text input */}
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Test Text
                </label>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Enter sample text to test your style..."
                  rows={4}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none focus:border-[var(--amber)] transition-colors"
                />
              </div>

              {/* Test button */}
              <button
                type="button"
                onClick={handleTest}
                disabled={!canTest || isStreaming}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 h-9 rounded-full font-sans text-xs font-medium transition-all",
                  canTest && !isStreaming
                    ? "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
                    : "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed"
                )}
              >
                {isStreaming ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Test
                  </>
                )}
              </button>

              {/* Output area */}
              <div className="flex-1 min-h-0 rounded-md border border-[var(--border)] bg-[var(--bg)] overflow-auto">
                {isStreaming && testOutput.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4">
                    <Loader2 className="size-5 text-[var(--amber)] animate-spin mb-3" />
                    <p className="font-sans text-xs text-[var(--text-muted)] font-medium">
                      Processing your text...
                    </p>
                  </div>
                ) : testOutput.length > 0 ? (
                  <div className="h-full overflow-y-auto p-3">
                    <p className="font-sans text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                      {testOutput}
                      {isStreaming && <StreamingCursor />}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-4">
                    <Play className="size-8 text-[var(--text-muted)] opacity-15 mb-3" />
                    <p className="font-sans text-xs text-[var(--text-muted)] text-center">
                      Enter test text and click Test to preview
                    </p>
                    <p className="font-sans text-[10px] text-[var(--text-muted)] text-center opacity-50 mt-1">
                      Your style instructions will be applied to the test text
                    </p>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
