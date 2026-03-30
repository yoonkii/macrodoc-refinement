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
    <GlassCard className="mt-4">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="font-display text-base font-semibold text-[var(--text)]">
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
          <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error-dim)] p-4 mb-4">
            <p className="font-sans text-sm text-[var(--error)]">
              {multiPostStore.errorMessage}
            </p>
          </div>
        )}

        {/* Platform cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      <div className="flex flex-col">
        {/* Top-edge gradient accent */}
        <div
          className="h-0.5 rounded-t-[20px]"
          style={{
            background: `linear-gradient(to right, ${meta.color}99, transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-black/[0.04] dark:border-white/[0.04]">
          <span
            className="font-display text-[13px] font-semibold text-[var(--text)] truncate flex-1"
          >
            {meta.label}
          </span>
          {output && !isLoading && (
            <span
              className={cn(
                "font-mono text-[10px] font-medium px-2.5 py-0.5 rounded-full",
                isOverLimit
                  ? "bg-[var(--error-dim)] text-[var(--error)]"
                  : "bg-black/[0.06] dark:bg-white/[0.06]"
              )}
              style={!isOverLimit ? { color: meta.color } : undefined}
            >
              {charCount} / {meta.charLimit}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="min-h-[120px] flex-1">
          {isLoading ? (
            /* Skeleton shimmer */
            <div className="p-4 space-y-2.5">
              {[0.7, 0.85, 0.9, 0.5].map((width, i) => (
                <div
                  key={i}
                  className="h-3.5 rounded-md bg-[var(--elevated)] animate-pulse"
                  style={{ width: `${width * 100}%` }}
                />
              ))}
            </div>
          ) : hasError ? (
            /* Error state */
            <div className="flex flex-col items-center justify-center h-full p-5">
              <AlertCircle className="size-7 text-[var(--error)] mb-2.5" />
              <p className="font-sans text-[13px] text-[var(--error)] font-medium mb-2.5">
                Generation failed
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-sans border"
                style={{
                  color: meta.color,
                  borderColor: `${meta.color}4D`,
                }}
              >
                <RefreshCw className="size-3.5" />
                Retry
              </button>
            </div>
          ) : output && output.length > 0 ? (
            /* Content */
            <div className="overflow-y-auto max-h-[250px] p-4">
              <p className="font-sans text-[13px] text-[var(--text)] leading-relaxed whitespace-pre-wrap select-text">
                {output}
              </p>
            </div>
          ) : (
            /* Empty */
            <div className="flex items-center justify-center h-full p-4">
              <p className="font-sans text-[13px] text-[var(--text-muted)]">
                No output yet
              </p>
            </div>
          )}
        </div>

        {/* Footer: copy button */}
        {output && output.length > 0 && !isLoading && (
          <div className="border-t border-black/[0.04] dark:border-white/[0.04] px-2.5 py-2 flex justify-end">
            <button
              type="button"
              onClick={() => onCopy(output)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-sans transition-colors hover:opacity-80"
              style={{ color: meta.color }}
            >
              <Copy className="size-3.5" />
              Copy
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
