"use client";

import { LayoutGrid, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToneStore, selectCurrentTierLabel } from "@/lib/stores/tone";
import { useTextRefineStore } from "@/lib/stores/text-refine";
import { useMultiPostStore } from "@/lib/stores/multi-post";
import {
  useStyleProfilesStore,
  selectActiveProfiles,
} from "@/lib/stores/style-profiles";
import { snapToTier } from "@/lib/prompt-builder";
import { Slider } from "@/components/ui/slider";

/** The 5 discrete tone tiers displayed above the slider. */
const TONE_TIER_ENTRIES: Array<{ value: number; label: string }> = [
  { value: -1.0, label: "Board Memo" },
  { value: -0.5, label: "Business Professional" },
  { value: 0.0, label: "Balanced" },
  { value: 0.5, label: "Conversational" },
  { value: 1.0, label: "Texting a Friend" },
];

export function ToneSlider() {
  const toneStore = useToneStore();
  const textRefineStore = useTextRefineStore();
  const multiPostStore = useMultiPostStore();
  const styleProfileStore = useStyleProfilesStore();

  const currentTierLabel = selectCurrentTierLabel(toneStore);
  const activeProfiles = selectActiveProfiles(styleProfileStore);
  const snappedValue = snapToTier(toneStore.toneValue);
  const hasInput = textRefineStore.inputText.length > 0;

  function handleGenerateAll() {
    multiPostStore.generateAll(
      textRefineStore.inputText,
      activeProfiles,
      toneStore.toneValue
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {/* Slider area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tier labels row */}
        <div className="flex justify-between px-1 mb-2">
          {TONE_TIER_ENTRIES.map((tier) => {
            const isActive = snappedValue === tier.value;
            return (
              <span
                key={tier.value}
                className={cn(
                  "font-mono text-[11px] tracking-wide text-center flex-1 truncate transition-colors duration-150",
                  isActive
                    ? "text-[var(--amber)] font-semibold"
                    : "text-[var(--text-muted)] font-normal"
                )}
              >
                {tier.label}
              </span>
            );
          })}
        </div>

        {/* Slider */}
        <Slider
          value={toneStore.toneValue}
          onValueChange={(val) => {
            const numVal = Array.isArray(val) ? val[0] : val;
            toneStore.setTone(numVal);
          }}
          min={-1}
          max={1}
          step={0.5}
          className="[&_[data-slot=slider-track]]:bg-[var(--border)] [&_[data-slot=slider-range]]:bg-[var(--amber)] [&_[data-slot=slider-thumb]]:bg-[var(--amber)] [&_[data-slot=slider-thumb]]:border-[var(--amber)] [&_[data-slot=slider-thumb]]:shadow-none"
        />

        {/* Current tier label */}
        <p className="text-center font-mono text-[11px] font-medium text-[var(--amber)] tracking-wide mt-1">
          {currentTierLabel}
        </p>
      </div>

      {/* Generate All button */}
      <button
        type="button"
        onClick={handleGenerateAll}
        disabled={!hasInput || multiPostStore.isGenerating}
        className={cn(
          "inline-flex items-center gap-1.5 px-4 py-1.5 h-8 rounded-full shrink-0",
          "font-sans text-xs font-medium transition-colors",
          !hasInput || multiPostStore.isGenerating
            ? "border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed"
            : "border border-[var(--amber)] text-[var(--amber)] hover:bg-[var(--amber)] hover:text-[#1A1816]"
        )}
      >
        {multiPostStore.isGenerating ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <LayoutGrid className="size-3.5" />
        )}
        {multiPostStore.isGenerating ? "Generating..." : "Generate All"}
      </button>
    </div>
  );
}
