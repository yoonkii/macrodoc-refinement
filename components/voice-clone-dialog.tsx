"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useVoiceCloneStore,
  MAX_SAMPLE_TOTAL,
} from "@/lib/stores/voice-clone";
import { useStyleProfilesStore } from "@/lib/stores/style-profiles";
import { selectExcerpts } from "@/lib/voice-analysis";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Below this combined sample length, analysis produces weak results. */
const MIN_ANALYZE_CHARS = 200;

/** Turn the counter amber once the user nears the cap. */
const NEAR_LIMIT_CHARS = Math.round(MAX_SAMPLE_TOTAL * 0.9);

const DEFAULT_PROFILE_NAME = "My Voice";

type Step = "paste" | "profile";

const MONO_LABEL =
  "font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))]";

const INPUT_BASE =
  "w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--amber)] transition-colors";

export function VoiceCloneDialog() {
  const router = useRouter();

  const isOpen = useVoiceCloneStore((s) => s.isDialogOpen);
  const closeDialog = useVoiceCloneStore((s) => s.closeDialog);
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

  const [step, setStep] = useState<Step>("paste");
  const [analysis, setAnalysis] = useState("");
  const [name, setName] = useState(DEFAULT_PROFILE_NAME);
  const [excerpts, setExcerpts] = useState<string[]>([]);

  // Preload step 2 when opening onto an existing learned profile. Falls back to
  // any learned profile if the flow hasn't recorded a link yet (e.g. imported).
  useEffect(() => {
    if (!isOpen) return;

    const linked = linkedProfileId
      ? profiles.find((p) => p.id === linkedProfileId)
      : undefined;
    const existing = linked ?? profiles.find((p) => p.type === "learned");

    if (existing) {
      if (!linkedProfileId) setLinkedProfileId(existing.id);
      setAnalysis(existing.instructions);
      setName(existing.name || DEFAULT_PROFILE_NAME);
      setExcerpts([...existing.fewShots]);
      setStep("profile");
    } else {
      setStep("paste");
      setName(DEFAULT_PROFILE_NAME);
    }
    clearError();
    // Only re-run when the dialog transitions to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const totalChars = samples.reduce((sum, s) => sum + s.length, 0);
  const nearLimit = totalChars >= NEAR_LIMIT_CHARS;
  const overLimit = totalChars > MAX_SAMPLE_TOTAL;
  const canAnalyze =
    totalChars >= MIN_ANALYZE_CHARS && !overLimit && !isAnalyzing;
  const canSave = name.trim().length > 0 && analysis.trim().length > 0;

  const handleAnalyze = useCallback(async () => {
    const result = await analyze();
    if (result === null) return;
    setAnalysis(result);
    setExcerpts(selectExcerpts(samples));
    setStep("profile");
  }, [analyze, samples]);

  const handleReanalyze = useCallback(() => {
    clearError();
    setStep("paste");
  }, [clearError]);

  const updateExcerpt = useCallback((index: number, value: string) => {
    setExcerpts((prev) => prev.map((e, i) => (i === index ? value : e)));
  }, []);

  const removeExcerpt = useCallback((index: number) => {
    setExcerpts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const cleanedExcerpts = excerpts
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    saveProfile({
      name: name.trim(),
      instructions: analysis.trim(),
      fewShots: cleanedExcerpts,
    });
    closeDialog();
  }, [canSave, excerpts, name, analysis, saveProfile, closeDialog]);

  const handleOpenFullEditor = useCallback(() => {
    closeDialog();
    router.push("/voice");
  }, [closeDialog, router]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">
            {step === "paste" ? "Clone My Voice" : "Your voice profile"}
          </DialogTitle>
        </DialogHeader>

        {step === "paste" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Paste a few things you wrote yourself — posts, emails, messages.
              The more it sounds like you, the better the match. Nothing you
              paste leaves your device except to run the analysis.
            </p>

            <div className="flex flex-col gap-3 max-h-[42vh] overflow-y-auto pr-1">
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

            <div className="flex items-center justify-between">
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
                {totalChars.toLocaleString()} / {MAX_SAMPLE_TOTAL.toLocaleString()}
              </span>
            </div>

            {analysisError && (
              <ErrorNote message={analysisError} />
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
              ) : (
                "Analyze my voice"
              )}
            </button>
            {totalChars < MIN_ANALYZE_CHARS && (
              <p className="text-center font-mono text-[11px] tracking-[0.08em] text-[var(--text-muted)]">
                Add at least {MIN_ANALYZE_CHARS} characters to analyze
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                Voice instructions
              </label>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                This is what the AI follows. Edit anything that doesn&apos;t
                sound right.
              </p>
              <textarea
                value={analysis}
                onChange={(e) => setAnalysis(e.target.value)}
                rows={10}
                className={cn(INPUT_BASE, "resize-y")}
              />
            </div>

            <div>
              <p className={cn(MONO_LABEL, "mb-2")}>Voice examples</p>
              {excerpts.length > 0 ? (
                <div className="flex flex-col gap-2">
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
                  No examples selected — the instructions above stand on their
                  own.
                </p>
              )}
            </div>

            {analysisError && <ErrorNote message={analysisError} />}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleReanalyze}
                disabled={isAnalyzing}
                className="inline-flex items-center justify-center px-4 h-10 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--amber)]/40 transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Re-analyze"
                )}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  "flex-1 inline-flex items-center justify-center px-4 h-10 rounded-full font-sans text-sm font-medium transition-all",
                  canSave
                    ? "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
                    : "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed",
                )}
              >
                Save &amp; activate
              </button>
            </div>
          </div>
        )}

        {/* Full-editor handoff */}
        <div className="-mx-4 -mb-4 px-4 py-2.5 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleOpenFullEditor}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--amber)] transition-colors"
          >
            Open full editor
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[var(--error)]/20 bg-[var(--error-dim)] px-3 py-2">
      <p className="text-xs text-[var(--error)] leading-relaxed">{message}</p>
    </div>
  );
}
