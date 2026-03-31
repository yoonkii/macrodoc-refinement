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
    <div className="flex flex-col h-full p-4 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="pb-3 shrink-0">
        <h2 className="text-sm font-medium text-[var(--text)]">
          Refined Text
        </h2>
      </div>

      {/* Content area */}
      <div
        className={cn(
          "flex-1 min-h-0 rounded-md border border-[var(--border)] overflow-auto",
          "bg-[var(--bg)]"
        )}
      >
        {hasError ? (
          /* Error state */
          <div className="flex flex-col items-center justify-center h-full p-4 bg-[var(--error-dim)]">
            <AlertCircle className="size-8 text-[var(--error)] mb-3" />
            <p className="font-semibold text-sm text-[var(--error)] mb-1">
              Error occurred
            </p>
            <p className="font-sans text-xs text-[var(--text)] text-center mb-4">
              {store.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                store.clearError();
                store.processNow();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-xs font-medium hover:bg-[var(--amber-hover)]"
            >
              <Loader2 className="size-3.5" />
              Try Again
            </button>
          </div>
        ) : isLoadingWithoutText ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Loader2 className="size-5 text-[var(--amber)] animate-spin mb-3" />
            <p className="font-sans text-xs text-[var(--text-muted)] font-medium">
              Processing your text...
            </p>
          </div>
        ) : !hasText ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Type className="size-8 text-[var(--text-muted)] opacity-15 mb-3" />
            <p className="font-sans text-xs text-[var(--text-muted)] text-center">
              Your refined text will appear here
            </p>
            <p className="font-sans text-[10px] text-[var(--text-muted)] text-center opacity-50 mt-1">
              Enter some text in the input panel to begin
            </p>
          </div>
        ) : (
          /* Text display: streaming or complete */
          <div className="h-full overflow-y-auto p-3">
            {isStreamingWithText ? (
              <p className="font-sans text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {store.refinedText}
                <StreamingCursor />
              </p>
            ) : (
              <p className="font-sans text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap select-text">
                {store.refinedText}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (only when complete) */}
      {isComplete && (
        <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => store.setRefinedText("")}
            className="h-8 text-xs text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error-dim)]"
          >
            <X className="size-3.5" data-icon="inline-start" />
            Clear
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 text-xs text-[var(--amber)] border-[var(--amber)]/30 hover:bg-[var(--amber-dim)]"
          >
            <Copy className="size-3.5" data-icon="inline-start" />
            Copy
          </Button>

          <button
            type="button"
            onClick={() => store.acceptRefinement()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 h-8 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-xs font-medium hover:bg-[var(--amber-hover)] transition-colors"
          >
            <Check className="size-3.5" />
            Accept
          </button>
        </div>
      )}
    </div>
  );
}
