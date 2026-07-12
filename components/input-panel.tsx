"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ClipboardPaste, RefreshCw, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useTextRefineStore } from "@/lib/stores/text-refine";
import { useSpeechInput } from "@/lib/use-speech-input";
import { MAX_CHARACTERS, DEMO_SAMPLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export function InputPanel() {
  const store = useTextRefineStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Snapshot of the input at the moment recording started — lets us skip a
  // needless refine on stop if dictation produced nothing.
  const preRecordingTextRef = useRef("");
  const [showPermHint, setShowPermHint] = useState(false);

  // Append each finalized transcript segment to the input. Reads live store
  // state (not the render-time `store`) so the closure never goes stale across
  // successive segments.
  const appendTranscript = useCallback((transcript: string) => {
    const state = useTextRefineStore.getState();
    const current = state.inputText;
    const next = current ? `${current} ${transcript}` : transcript;
    state.setInputText(next);
    if (textareaRef.current) {
      textareaRef.current.value = next;
    }
  }, []);

  const speech = useSpeechInput({ onFinalTranscript: appendTranscript });

  // Surface the permission hint briefly, then auto-clear it.
  useEffect(() => {
    if (!speech.permissionDenied) return;
    setShowPermHint(true);
    const timer = setTimeout(() => setShowPermHint(false), 5000);
    return () => clearTimeout(timer);
  }, [speech.permissionDenied]);

  function handleToggleMic() {
    if (speech.isRecording) {
      speech.stop();
      store.setSuppressAutoRefine(false);
      // Refine once, only if dictation actually changed the text.
      const changed =
        useTextRefineStore.getState().inputText !== preRecordingTextRef.current;
      if (changed) store.processNow();
    } else {
      preRecordingTextRef.current = useTextRefineStore.getState().inputText;
      store.setSuppressAutoRefine(true);
      speech.start();
    }
  }

  // Sync textarea value when store.inputText changes externally (e.g. acceptRefinement)
  useEffect(() => {
    const el = textareaRef.current;
    if (el && el.value !== store.inputText) {
      el.value = store.inputText;
    }
  }, [store.inputText]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    store.setInputText(e.target.value);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        store.setInputText(text);
        if (textareaRef.current) {
          textareaRef.current.value = text;
        }
      }
    } catch {
      // Clipboard API may be denied; silently fail
    }
  }

  function handleClear() {
    store.setInputText("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.focus();
    }
  }

  function handleDemoSample(text: string, label: string) {
    // The chip label is fixed app copy (see DEMO_SAMPLES), not user-written
    // content — safe to record. The sample text itself is never sent.
    track("demo_chip_used", { label });
    // Push into the store (the sync effect mirrors it into the uncontrolled
    // textarea) and refine immediately, skipping the type-debounce.
    store.setInputText(text);
    if (textareaRef.current) {
      textareaRef.current.value = text;
    }
    store.processNow();
  }

  const charCount = store.inputText.length;
  const isEmpty = charCount === 0;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header — matches output panel tab bar height */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-[var(--border)]">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))]">
          Input Text
        </h2>
        {store.isProcessing && (
          <span className="flex items-center gap-1.5" aria-label="Recording">
            <span className="size-1.5 rounded-full bg-[var(--amber)] pulse-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--amber)]">
              REC
            </span>
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex flex-col p-5 pt-3">
        {/* Textarea container with char counter inside */}
        <div
          className={cn(
            "flex-1 min-h-0 rounded-md border border-[var(--border)] bg-[var(--bg)] relative",
            "transition-all duration-150",
            "focus-within:border-[var(--amber)] focus-within:shadow-[0_0_0_2px_rgba(232,168,56,0.15)]"
          )}
        >
          <textarea
            ref={textareaRef}
            defaultValue={store.inputText}
            onChange={handleChange}
            placeholder="Type or paste your text here..."
            className={cn(
              "w-full h-full resize-none p-3 pb-7",
              "bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)]",
              "font-sans text-sm leading-relaxed",
              "outline-none border-none rounded-md"
            )}
          />
          {/* Char counter inside textarea, bottom-right */}
          <span className="absolute bottom-2 right-3 font-mono text-[10px] text-[var(--text-muted)] opacity-50 pointer-events-none">
            {charCount} / {MAX_CHARACTERS}
          </span>
        </div>

        {/* Live dictation preview — interim text is NOT written to the store
            (that would spam the 300ms auto-refine); shown here as a muted,
            single-line hint until the segment finalizes and appends. */}
        {speech.isRecording && speech.interimTranscript && (
          <p className="shrink-0 mt-2 font-mono text-[11px] text-[var(--text-muted)] truncate">
            {speech.interimTranscript}
          </p>
        )}

        {/* Microphone-blocked hint — auto-clears after a few seconds. */}
        {showPermHint && (
          <p className="shrink-0 mt-2 text-[11px] text-[var(--text-muted)]">
            Microphone blocked — check site permissions
          </p>
        )}

        {/* First-run demo chips — only while the input is empty */}
        {isEmpty && (
          <div className="shrink-0 flex flex-wrap gap-2 pt-3">
            {DEMO_SAMPLES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => handleDemoSample(sample.text, sample.label)}
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.08em]",
                  "px-2.5 py-1.5 rounded-md border border-[var(--border)]",
                  "text-[var(--text-muted)] transition-colors duration-150",
                  "hover:border-[var(--amber)]/50 hover:text-[var(--amber)]"
                )}
              >
                {sample.label}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="shrink-0 flex items-center justify-between pt-3">
          <button
            type="button"
            onClick={() => store.processNow()}
            disabled={isEmpty}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 h-9 rounded-full",
              "font-sans text-xs font-medium transition-all",
              isEmpty
                ? "bg-[var(--amber)]/10 text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)] shadow-[0_0_12px_var(--amber-dim)]"
            )}
          >
            <RefreshCw className="size-3.5" />
            Process Now
          </button>

          <div className="flex items-center gap-2">
            {/* Voice input — hidden entirely on browsers without the Web Speech
                API (e.g. Firefox). Recording state = filled amber + pulsing dot. */}
            {speech.isSupported &&
              (speech.isRecording ? (
                <button
                  type="button"
                  onClick={handleToggleMic}
                  aria-label="Stop recording"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-9 rounded-lg",
                    "font-sans text-xs font-medium transition-all",
                    "bg-[var(--amber)] text-[#1A1816] hover:bg-[var(--amber-hover)]",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-[#1A1816] pulse-dot" />
                  <Mic className="size-3.5" />
                  Stop
                </button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleMic}
                  aria-label="Start voice input"
                  className="h-9 text-xs text-[var(--amber)] border-[var(--amber)]/30 hover:bg-[var(--amber-dim)]"
                >
                  <Mic className="size-3.5" data-icon="inline-start" />
                  Mic
                </Button>
              ))}

            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              className="h-9 text-xs text-[var(--amber)] border-[var(--amber)]/30 hover:bg-[var(--amber-dim)]"
            >
              <ClipboardPaste className="size-3.5" data-icon="inline-start" />
              Paste
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-9 text-xs text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error-dim)]"
            >
              <X className="size-3.5" data-icon="inline-start" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
