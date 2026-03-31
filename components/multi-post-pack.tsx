"use client";

import { X, Copy, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMultiPostStore } from "@/lib/stores/multi-post";
import { useTextRefineStore } from "@/lib/stores/text-refine";
import { useToneStore } from "@/lib/stores/tone";
import {
  useStyleProfilesStore,
  selectActiveProfiles,
} from "@/lib/stores/style-profiles";
import { PLATFORM_META } from "@/lib/constants";
import { PLATFORM_KEYS } from "@/lib/types";
import type { PlatformKey } from "@/lib/types";
import { GlassCard } from "@/components/glass-card";

export function MultiPostPack() {
  const multiPostStore = useMultiPostStore();
  const textRefineStore = useTextRefineStore();
  const toneStore = useToneStore();
  const styleProfileStore = useStyleProfilesStore();
  const activeProfiles = selectActiveProfiles(styleProfileStore);

  const hasOutputs = Object.keys(multiPostStore.platformOutputs).length > 0;
  const hasErrors = Object.values(multiPostStore.platformErrors).some(Boolean);
  const hasGlobalError = multiPostStore.errorMessage.length > 0;

  // Hide when nothing to show
  if (
    !multiPostStore.isGenerating &&
    !hasOutputs &&
    !hasErrors &&
    !hasGlobalError
  ) {
    return null;
  }

  function handleRetry(platform: PlatformKey) {
    multiPostStore.retryPlatform(
      platform,
      textRefineStore.inputText,
      activeProfiles,
      toneStore.toneValue
    );
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API may be denied
    }
  }

  return (
    <GlassCard className="mt-3" innerClassName="p-5">
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim,var(--text-muted))]">
            Multi-Post Pack
          </span>
          <div className="flex-1" />
          {multiPostStore.isGenerating && (
            <Loader2 className="size-4 text-[var(--amber)] animate-spin" />
          )}
          {hasOutputs && !multiPostStore.isGenerating && (
            <button
              type="button"
              onClick={() => multiPostStore.clear()}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Global error */}
        {hasGlobalError && !hasOutputs && (
          <div className="rounded-md border border-[var(--error)]/20 bg-[var(--error-dim)] p-3 mb-3">
            <p className="font-sans text-sm text-[var(--error)]">
              {multiPostStore.errorMessage}
            </p>
          </div>
        )}

        {/* Platform cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {PLATFORM_KEYS.map((platform) => (
            <PlatformCard
              key={platform}
              platform={platform}
              output={multiPostStore.platformOutputs[platform] ?? null}
              hasError={multiPostStore.platformErrors[platform] ?? false}
              isLoading={multiPostStore.isGenerating}
              onRetry={() => handleRetry(platform)}
              onCopy={handleCopy}
            />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

interface PlatformCardProps {
  platform: PlatformKey;
  output: string | null;
  hasError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  onCopy: (text: string) => void;
}

function PlatformCard({
  platform,
  output,
  hasError,
  isLoading,
  onRetry,
  onCopy,
}: PlatformCardProps) {
  const meta = PLATFORM_META[platform];
  const charCount = output?.length ?? 0;
  const isOverLimit = meta.charLimit > 0 && charCount > meta.charLimit;

  return (
    <GlassCard>
      <div className="flex flex-col relative overflow-hidden">
        {/* Top-edge gradient accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, ${meta.color}, transparent)`,
          }}
        />
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
          <span
            className="inline-block size-2 rounded-full shrink-0"
            style={{ backgroundColor: meta.color }}
          />
          <span
            className="text-xs font-medium text-[var(--text)] truncate flex-1"
          >
            {meta.label}
          </span>
          {output && !isLoading && (
            <span
              className={cn(
                "font-mono text-[10px] font-medium px-2 py-0.5 rounded-md",
                isOverLimit
                  ? "bg-[var(--error-dim)] text-[var(--error)]"
                  : "bg-[var(--elevated)] text-[var(--text-muted)]"
              )}
              style={!isOverLimit ? { color: meta.color } : undefined}
            >
              {charCount} / {meta.charLimit}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="min-h-[100px] flex-1">
          {isLoading ? (
            /* Skeleton shimmer */
            <div className="p-3 space-y-2">
              {[0.7, 0.85, 0.9, 0.5].map((width, i) => (
                <div
                  key={i}
                  className="h-3 rounded-sm bg-[var(--elevated)] animate-pulse"
                  style={{ width: `${width * 100}%` }}
                />
              ))}
            </div>
          ) : hasError ? (
            /* Error state */
            <div className="flex flex-col items-center justify-center h-full p-3">
              <AlertCircle className="size-5 text-[var(--error)] mb-2" />
              <p className="font-sans text-xs text-[var(--error)] font-medium mb-2">
                Generation failed
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-sans border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                <RefreshCw className="size-3" />
                Retry
              </button>
            </div>
          ) : output && output.length > 0 ? (
            /* Content */
            <div className="overflow-y-auto max-h-[200px] p-3">
              <p className="font-sans text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap select-text">
                {output}
              </p>
            </div>
          ) : (
            /* Empty */
            <div className="flex items-center justify-center h-full p-3">
              <p className="font-sans text-[10px] text-[var(--text-muted)]">
                No output yet
              </p>
            </div>
          )}
        </div>

        {/* Footer: copy button */}
        {output && output.length > 0 && !isLoading && (
          <div className="border-t border-[var(--border)] px-2 py-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => onCopy(output)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <Copy className="size-3" />
              Copy
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
