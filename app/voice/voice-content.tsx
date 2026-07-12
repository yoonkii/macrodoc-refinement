"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useVoiceCloneStore,
  MAX_SAMPLE_TOTAL,
} from "@/lib/stores/voice-clone";
import { useStyleProfilesStore } from "@/lib/stores/style-profiles";
import { useModelConfigStore } from "@/lib/stores/model-config";
import { selectExcerpts } from "@/lib/voice-analysis";
import { buildRefinementPrompt } from "@/lib/prompt-builder";
import { streamRefine } from "@/lib/api";
import { streamWithProvider } from "@/lib/byom-api";
import type { StyleProfile } from "@/lib/types";
import { GlassCard } from "@/components/glass-card";
import {
  StreamingText,
  useTakeFinishedSettle,
} from "@/components/streaming-text";

/** Below this combined sample length, analysis produces weak results. */
const MIN_ANALYZE_CHARS = 200;
const NEAR_LIMIT_CHARS = Math.round(MAX_SAMPLE_TOTAL * 0.9);
const DEFAULT_PROFILE_NAME = "My Voice";

const MONO_LABEL =
  "font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))]";

const INPUT_BASE =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--amber)] transition-colors";

export function VoiceContent() {
  const samples = useVoiceCloneStore((s) => s.samples);
  const setSample = useVoiceCloneStore((s) => s.setSample);
  const addSample = useVoiceCloneStore((s) => s.addSample);
  const removeSample = useVoiceCloneStore((s) => s.removeSample);
  const analyze = useVoiceCloneStore((s) => s.analyze);
  const saveProfile = useVoiceCloneStore((s) => s.saveProfile);
  const isAnalyzing = useVoiceCloneStore((s) => s.isAnalyzing);
  const analysisError = useVoiceCloneStore((s) => s.analysisError);
  const clearError = useVoiceCloneStore((s) => s.clearError);
  const linkedProfileId = useVoiceCloneStore((s) => s.linkedProfileId);
  const setLinkedProfileId = useVoiceCloneStore((s) => s.setLinkedProfileId);

  const profiles = useStyleProfilesStore((s) => s.profiles);

  // Editable analysis state (kept local so edits stay uncommitted until save).
  const [analysis, setAnalysis] = useState("");
  const [name, setName] = useState(DEFAULT_PROFILE_NAME);
  const [excerpts, setExcerpts] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Live-test state.
  const [testText, setTestText] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isSettling = useTakeFinishedSettle(isStreaming);

  // Preload the linked learned profile once on entry.
  useEffect(() => {
    if (initialized) return;

    const linked = linkedProfileId
      ? profiles.find((p) => p.id === linkedProfileId)
      : undefined;
    const existing = linked ?? profiles.find((p) => p.type === "learned");

    if (existing) {
      if (!linkedProfileId) setLinkedProfileId(existing.id);
      setAnalysis(existing.instructions);
      setName(existing.name || DEFAULT_PROFILE_NAME);
      setExcerpts([...existing.fewShots]);
    }
    setInitialized(true);
  }, [initialized, linkedProfileId, profiles, setLinkedProfileId]);

  const totalChars = samples.reduce((sum, s) => sum + s.length, 0);
  const nearLimit = totalChars >= NEAR_LIMIT_CHARS;
  const overLimit = totalChars > MAX_SAMPLE_TOTAL;
  const canAnalyze =
    totalChars >= MIN_ANALYZE_CHARS && !overLimit && !isAnalyzing;
  const canSave = name.trim().length > 0 && analysis.trim().length > 0;
  const canTest = testText.trim().length > 0 && analysis.trim().length > 0;

  const linkedProfileExists =
    linkedProfileId != null &&
    profiles.some((p) => p.id === linkedProfileId);

  const handleAnalyze = useCallback(async () => {
    const result = await analyze();
    if (result === null) return;
    setAnalysis(result);
    setExcerpts(selectExcerpts(samples));
    setJustSaved(false);
  }, [analyze, samples]);

  const updateExcerpt = useCallback((index: number, value: string) => {
    setExcerpts((prev) => prev.map((e, i) => (i === index ? value : e)));
  }, []);

  const removeExcerpt = useCallback((index: number) => {
    setExcerpts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    saveProfile({
      name: name.trim(),
      instructions: analysis.trim(),
      fewShots: excerpts.map((e) => e.trim()).filter((e) => e.length > 0),
    });
    setJustSaved(true);
  }, [canSave, saveProfile, name, analysis, excerpts]);

  const handleTest = useCallback(async () => {
    if (!canTest) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setTestOutput("");

    // Build a temporary learned profile so the test mirrors production routing:
    // learned profiles flow through STYLE INSTRUCTIONS via activeProfiles.
    const tempProfile: StyleProfile = {
      id: "voice-test",
      name: name.trim() || DEFAULT_PROFILE_NAME,
      instructions: analysis.trim(),
      fewShots: excerpts.map((e) => e.trim()).filter((e) => e.length > 0),
      isActive: true,
      type: "learned",
      toneBaseline: 0,
      charLimit: null,
    };

    const prompt = buildRefinementPrompt({
      inputText: testText.trim(),
      activeProfiles: [tempProfile],
      toneValue: 0,
    });

    try {
      const modelConfig = useModelConfigStore.getState().config;
      const useDefault =
        modelConfig.provider === "default" || !modelConfig.apiKey.trim();
      const stream = useDefault
        ? streamRefine(prompt, controller.signal)
        : streamWithProvider(prompt, modelConfig, controller.signal);

      for await (const chunk of stream) {
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
      if (!controller.signal.aborted) setIsStreaming(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [canTest, name, analysis, excerpts, testText]);

  // Abort any in-flight test on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

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
            Clone My Voice
          </h1>
        </div>
      </header>

      {/* Two-column layout */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 md:p-5 gap-4">
        {/* Left column: samples + editable analysis */}
        <div className="lg:flex-1 min-w-0 min-h-0 overflow-y-auto">
          <GlassCard className="h-full" innerClassName="flex flex-col p-5">
            <h2 className={cn(MONO_LABEL, "mb-4")}>Your writing</h2>

            <div className="flex-1 overflow-y-auto space-y-5">
              {/* Samples */}
              <div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-3">
                  Paste things you wrote yourself — posts, emails, messages. The
                  closer they sound to you, the sharper the match.
                </p>
                <div className="space-y-2">
                  {samples.map((sample, index) => (
                    <div key={index} className="flex gap-2">
                      <textarea
                        value={sample}
                        onChange={(e) => setSample(index, e.target.value)}
                        placeholder="Paste something you wrote…"
                        rows={4}
                        className={cn(INPUT_BASE, "resize-y")}
                      />
                      {samples.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSample(index)}
                          className="self-start p-1.5 text-[var(--error)] hover:bg-[var(--error-dim)] rounded-md transition-colors"
                          aria-label="Remove sample"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  {samples.length < 5 ? (
                    <button
                      type="button"
                      onClick={addSample}
                      className="inline-flex items-center gap-1 text-sm text-[var(--amber)] hover:text-[var(--amber-hover)] transition-colors"
                    >
                      <Plus className="size-4" />
                      Add sample
                    </button>
                  ) : (
                    <span />
                  )}
                  <span
                    className={cn(
                      "font-mono text-[11px] tracking-[0.08em] tabular-nums",
                      overLimit
                        ? "text-[var(--error)]"
                        : nearLimit
                          ? "text-[var(--amber)]"
                          : "text-[var(--text-muted)]",
                    )}
                  >
                    {totalChars.toLocaleString()} /{" "}
                    {MAX_SAMPLE_TOTAL.toLocaleString()}
                  </span>
                </div>
              </div>

              {analysisError && (
                <div className="rounded-md border border-[var(--error)]/20 bg-[var(--error-dim)] px-3 py-2">
                  <p className="text-xs text-[var(--error)] leading-relaxed">
                    {analysisError}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 px-4 h-10 rounded-full font-sans text-sm font-medium transition-all",
                  canAnalyze
                    ? "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
                    : "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed",
                )}
              >
                {isAnalyzing ? (
                  <>
                    <span className="size-1.5 rounded-full bg-[#1A1816] pulse-dot" />
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
                      Analyzing your voice…
                    </span>
                  </>
                ) : analysis.trim().length > 0 ? (
                  "Re-analyze from samples"
                ) : (
                  "Analyze my voice"
                )}
              </button>

              {/* Editable analysis */}
              <div className="pt-2 border-t border-[var(--border)]">
                <h3 className={cn(MONO_LABEL, "mb-3 mt-3")}>Voice profile</h3>

                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Profile name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={DEFAULT_PROFILE_NAME}
                  className={INPUT_BASE}
                />

                <label className="block text-sm font-medium text-[var(--text)] mb-1.5 mt-4">
                  Voice instructions
                </label>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  This is what the AI follows. Edit anything that doesn&apos;t
                  sound right.
                </p>
                <textarea
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                  placeholder="Analyze your samples, or write your voice instructions here…"
                  rows={10}
                  className={cn(INPUT_BASE, "resize-y")}
                />

                <p className={cn(MONO_LABEL, "mb-2 mt-4")}>Voice examples</p>
                {excerpts.length > 0 ? (
                  <div className="space-y-2">
                    {excerpts.map((excerpt, index) => (
                      <div key={index} className="flex gap-2">
                        <textarea
                          value={excerpt}
                          onChange={(e) => updateExcerpt(index, e.target.value)}
                          rows={2}
                          className={cn(INPUT_BASE, "resize-y text-xs")}
                        />
                        <button
                          type="button"
                          onClick={() => removeExcerpt(index)}
                          className="self-start p-1.5 text-[var(--error)] hover:bg-[var(--error-dim)] rounded-md transition-colors"
                          aria-label="Remove example"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    No examples yet — analyze your samples to auto-select a few.
                  </p>
                )}
              </div>
            </div>

            {/* Save */}
            <div className="shrink-0 pt-4 border-t border-[var(--border)] mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-full font-sans text-sm font-medium transition-all",
                  canSave
                    ? "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
                    : "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed",
                )}
              >
                {linkedProfileExists ? "Update My Voice" : "Save My Voice"}
              </button>
              {justSaved && (
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--teal)]">
                  Saved
                </span>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right column: live test */}
        <div className="lg:flex-1 min-w-0 min-h-0 flex flex-col">
          <GlassCard className="h-full" innerClassName="flex flex-col p-5">
            <h2 className={cn(MONO_LABEL, "mb-4")}>Test your voice</h2>

            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex-1 min-h-0 flex flex-col">
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5 shrink-0">
                  Test text
                </label>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Type a plain sentence and see it in your voice…"
                  className="flex-1 w-full min-h-0 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none focus:border-[var(--amber)] transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={handleTest}
                disabled={!canTest || isStreaming}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-full font-sans text-xs font-medium transition-all",
                  canTest && !isStreaming
                    ? "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
                    : "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed",
                )}
              >
                {isStreaming ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Test
                  </>
                )}
              </button>

              <div className="flex-1 min-h-0 flex flex-col">
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5 shrink-0">
                  Preview
                </label>
                <div
                  className={cn(
                    "flex-1 min-h-0 rounded-md border border-[var(--border)] bg-[var(--bg)] overflow-auto",
                    isSettling && "take-settle",
                  )}
                >
                  {isStreaming && testOutput.length === 0 ? (
                    <div className="h-full flex flex-col justify-end p-3">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-[var(--amber)] pulse-dot" />
                        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--amber)]">
                          Take in progress&hellip;
                        </span>
                      </div>
                    </div>
                  ) : testOutput.length > 0 ? (
                    <div className="h-full overflow-y-auto p-3">
                      <StreamingText text={testOutput} isStreaming={isStreaming} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-4">
                      <Play className="size-8 text-[var(--text-muted)] opacity-15 mb-3" />
                      <p className="font-sans text-xs text-[var(--text-muted)] text-center">
                        Enter test text and click Test to preview
                      </p>
                      <p className="font-sans text-[10px] text-[var(--text-muted)] text-center opacity-50 mt-1">
                        Tests against your current edited voice profile
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
}
