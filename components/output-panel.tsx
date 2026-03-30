"use client";

import {
  Type,
  Loader2,
  X,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTextRefineStore } from "@/lib/stores/text-refine";
import { StreamingCursor } from "@/components/streaming-cursor";
import { Button } from "@/components/ui/button";

export function OutputPanel() {
  const store = useTextRefineStore();

  const hasText = store.refinedText.length > 0;
  const isStreamingWithText = store.isProcessing && hasText;
  const isLoadingWithoutText = store.isProcessing && !hasText;
  const isComplete = hasText && !store.isProcessing;
  const hasError = store.errorMessage.length > 0;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(store.refinedText);
    } catch {
      // Clipboard API may be denied; silently fail
    }
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="pb-4">
        <h2 className="font-display text-lg font-semibold text-[var(--text)]">
          Refined Text
        </h2>
      </div>

      {/* Content area */}
      <div
        className={cn(
          "flex-1 rounded-2xl border border-[var(--border)] overflow-hidden",
          "bg-[var(--bg)]"
        )}
      >
        {hasError ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center h-full p-6 bg-[var(--error-dim)]">
            <AlertCircle className="size-12 text-[var(--error)] mb-4" />
            <p className="font-display font-bold text-lg text-[var(--error)] mb-2">
              Error occurred
            </p>
            <p className="font-sans text-sm text-[var(--text)] text-center mb-6">
              {store.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                store.clearError();
                store.processNow();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-sm font-medium hover:bg-[var(--amber-hover)]"
            >
              <Loader2 className="size-4" />
              Try Again
            </button>
          </div>
        ) : isLoadingWithoutText ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center h-full p-6">
            <Loader2 className="size-8 text-[var(--amber)] animate-spin mb-4" />
            <p className="font-sans text-[var(--text-muted)] font-medium">
              Processing your text...
            </p>
          </div>
        ) : !hasText ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full p-6">
            <Type className="w-12 h-12 text-[var(--text-muted)] opacity-15 mb-5" />
            <p className="font-sans text-[var(--text-muted)] text-base text-center animate-pulse">
              Your refined text will appear here
            </p>
            <p className="font-sans text-[var(--text-muted)] text-sm text-center opacity-50 mt-2">
              Enter some text in the input panel to begin
            </p>
          </div>
        ) : (
          /* Text display: streaming or complete */
          <div className="h-full overflow-y-auto p-4">
            {isStreamingWithText ? (
              <p className="font-sans text-base text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {store.refinedText}
                <StreamingCursor />
              </p>
            ) : (
              <p className="font-sans text-base text-[var(--text)] leading-relaxed whitespace-pre-wrap select-text">
                {store.refinedText}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (only when complete) */}
      {isComplete && (
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => store.setRefinedText("")}
            className="text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error-dim)]"
          >
            <X className="size-4" data-icon="inline-start" />
            Clear
          </Button>

          <Button
            variant="outline"
            onClick={handleCopy}
            className="text-[var(--amber)] border-[var(--amber)]/30 hover:bg-[var(--amber-dim)]"
          >
            <Copy className="size-4" data-icon="inline-start" />
            Copy
          </Button>

          <button
            type="button"
            onClick={() => store.acceptRefinement()}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-sm font-medium hover:bg-[var(--amber-hover)] hover:scale-[1.03] active:scale-100 transition-all"
          >
            <Check className="size-4" />
            Accept
          </button>
        </div>
      )}
    </div>
  );
}
