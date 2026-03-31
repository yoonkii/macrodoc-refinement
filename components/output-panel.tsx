"use client";

import { useState } from "react";
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
import { useMultiPostStore } from "@/lib/stores/multi-post";
import { useToneStore } from "@/lib/stores/tone";
import {
  useStyleProfilesStore,
  selectActiveProfiles,
} from "@/lib/stores/style-profiles";
import { PLATFORM_META } from "@/lib/constants";
import type { PlatformKey } from "@/lib/types";
import { StreamingCursor } from "@/components/streaming-cursor";
import { Button } from "@/components/ui/button";

type OutputTab = "refined" | PlatformKey;

const TAB_ITEMS: Array<{ key: OutputTab; label: string }> = [
  { key: "refined", label: "Refined" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "substack", label: "Substack" },
];

export function OutputPanel() {
  const store = useTextRefineStore();
  const multiPostStore = useMultiPostStore();
  const toneStore = useToneStore();
  const styleProfileStore = useStyleProfilesStore();
  const activeProfiles = selectActiveProfiles(styleProfileStore);

  const [activeTab, setActiveTab] = useState<OutputTab>("refined");

  const hasText = store.refinedText.length > 0;
  const isStreamingWithText = store.isProcessing && hasText;
  const isLoadingWithoutText = store.isProcessing && !hasText;
  const isComplete = hasText && !store.isProcessing;
  const hasError = store.errorMessage.length > 0;

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API may be denied; silently fail
    }
  }

  function handleGenerateAll() {
    multiPostStore.generateAll(
      store.inputText,
      activeProfiles,
      toneStore.toneValue
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Tab bar — replaces the old "REFINED TEXT" header */}
      <div className="shrink-0 border-b border-[var(--border)]">
        <div className="flex overflow-x-auto scrollbar-none">
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "shrink-0 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors relative",
                  isActive
                    ? "text-[var(--amber)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                )}
              >
                {tab.label}
                {/* Active tab underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-[var(--amber)] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col p-5 pt-3">
        {activeTab === "refined" ? (
          <RefinedTabContent
            hasText={hasText}
            isStreamingWithText={isStreamingWithText}
            isLoadingWithoutText={isLoadingWithoutText}
            isComplete={isComplete}
            hasError={hasError}
            refinedText={store.refinedText}
            errorMessage={store.errorMessage}
            onCopy={() => handleCopy(store.refinedText)}
            onClear={() => store.setRefinedText("")}
            onAccept={() => store.acceptRefinement()}
            onRetry={() => {
              store.clearError();
              store.processNow();
            }}
          />
        ) : (
          <PlatformTabContent
            platform={activeTab}
            output={multiPostStore.platformOutputs[activeTab] ?? ""}
            isGenerating={multiPostStore.isGenerating}
            onCopy={handleCopy}
            onGenerate={handleGenerateAll}
          />
        )}
      </div>
    </div>
  );
}

// ── Refined Tab (existing streaming behavior) ──

interface RefinedTabContentProps {
  hasText: boolean;
  isStreamingWithText: boolean;
  isLoadingWithoutText: boolean;
  isComplete: boolean;
  hasError: boolean;
  refinedText: string;
  errorMessage: string;
  onCopy: () => void;
  onClear: () => void;
  onAccept: () => void;
  onRetry: () => void;
}

function RefinedTabContent({
  hasText,
  isStreamingWithText,
  isLoadingWithoutText,
  isComplete,
  hasError,
  refinedText,
  errorMessage,
  onCopy,
  onClear,
  onAccept,
  onRetry,
}: RefinedTabContentProps) {
  return (
    <>
      {/* Content area */}
      <div
        className={cn(
          "flex-1 min-h-0 rounded-md border border-[var(--border)] overflow-auto",
          "bg-[var(--bg)]"
        )}
      >
        {hasError ? (
          <div className="flex flex-col items-center justify-center h-full p-4 bg-[var(--error-dim)]">
            <AlertCircle className="size-8 text-[var(--error)] mb-3" />
            <p className="font-semibold text-sm text-[var(--error)] mb-1">
              Error occurred
            </p>
            <p className="font-sans text-xs text-[var(--text)] text-center mb-4">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-xs font-medium hover:bg-[var(--amber-hover)]"
            >
              <Loader2 className="size-3.5" />
              Try Again
            </button>
          </div>
        ) : isLoadingWithoutText ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Loader2 className="size-5 text-[var(--amber)] animate-spin mb-3" />
            <p className="font-sans text-xs text-[var(--text-muted)] font-medium">
              Processing your text...
            </p>
          </div>
        ) : !hasText ? (
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
          <div className="h-full overflow-y-auto p-3">
            {isStreamingWithText ? (
              <p className="font-sans text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {refinedText}
                <StreamingCursor />
              </p>
            ) : (
              <p className="font-sans text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap select-text">
                {refinedText}
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
            onClick={onClear}
            className="h-8 text-xs text-[var(--error)] border-[var(--error)]/30 hover:bg-[var(--error-dim)]"
          >
            <X className="size-3.5" data-icon="inline-start" />
            Clear
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="h-8 text-xs text-[var(--amber)] border-[var(--amber)]/30 hover:bg-[var(--amber-dim)]"
          >
            <Copy className="size-3.5" data-icon="inline-start" />
            Copy
          </Button>

          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 h-8 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-xs font-medium hover:bg-[var(--amber-hover)] transition-colors"
          >
            <Check className="size-3.5" />
            Accept
          </button>
        </div>
      )}
    </>
  );
}

// ── Platform Tab ──

interface PlatformTabContentProps {
  platform: PlatformKey;
  output: string;
  isGenerating: boolean;
  onCopy: (text: string) => void;
  onGenerate: () => void;
}

function PlatformTabContent({
  platform,
  output,
  isGenerating,
  onCopy,
  onGenerate,
}: PlatformTabContentProps) {
  const meta = PLATFORM_META[platform];
  const hasContent = output.length > 0;
  const charCount = output.length;
  const isOverLimit = meta.charLimit > 0 && charCount > meta.charLimit;

  return (
    <>
      {/* Character count badge when content exists */}
      {hasContent && (
        <div className="flex items-center justify-between pb-2 shrink-0">
          <span
            className={cn(
              "font-mono text-[10px] font-medium px-2 py-0.5 rounded-md",
              isOverLimit
                ? "bg-[var(--error-dim)] text-[var(--error)]"
                : "bg-[var(--elevated)] text-[var(--text-muted)]"
            )}
          >
            {charCount} / {meta.charLimit}
          </span>
        </div>
      )}

      {/* Content area */}
      <div
        className={cn(
          "flex-1 min-h-0 rounded-md border border-[var(--border)] overflow-auto",
          "bg-[var(--bg)]"
        )}
      >
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Loader2 className="size-5 text-[var(--amber)] animate-spin mb-3" />
            <p className="font-sans text-xs text-[var(--text-muted)] font-medium">
              Generating {meta.label} version...
            </p>
          </div>
        ) : hasContent ? (
          <div className="h-full overflow-y-auto p-3">
            <p className="font-sans text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap select-text">
              {output}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 gap-3">
            <Type className="size-8 text-[var(--text-muted)] opacity-15" />
            <p className="font-sans text-xs text-[var(--text-muted)] text-center">
              Click &lsquo;Generate&rsquo; to create {meta.label} version
            </p>
            <button
              type="button"
              onClick={onGenerate}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--amber)] text-[#1A1816] font-sans text-xs font-medium hover:bg-[var(--amber-hover)] transition-colors"
            >
              Generate
            </button>
          </div>
        )}
      </div>

      {/* Copy button when content exists */}
      {hasContent && !isGenerating && (
        <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(output)}
            className="h-8 text-xs text-[var(--amber)] border-[var(--amber)]/30 hover:bg-[var(--amber-dim)]"
          >
            <Copy className="size-3.5" data-icon="inline-start" />
            Copy
          </Button>
        </div>
      )}
    </>
  );
}
