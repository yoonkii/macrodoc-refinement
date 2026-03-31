"use client";

import { cn } from "@/lib/utils";
import { useToneStore, selectCurrentTierLabel } from "@/lib/stores/tone";
import { snapToTier } from "@/lib/prompt-builder";
import { Slider } from "@/components/ui/slider";

/** The 5 discrete tone tiers displayed above the slider. */
const TONE_TIER_ENTRIES: Array<{ value: number; label: string; short: string }> = [
  { value: -1.0, label: "Board Memo", short: "Board" },
  { value: -0.5, label: "Business Professional", short: "Biz Pro" },
  { value: 0.0, label: "Balanced", short: "Balanced" },
  { value: 0.5, label: "Conversational", short: "Convo" },
  { value: 1.0, label: "Texting a Friend", short: "Friend" },
];

export function ToneSlider() {
  const toneStore = useToneStore();

  const currentTierLabel = selectCurrentTierLabel(toneStore);
  const snappedValue = snapToTier(toneStore.toneValue);

  return (
    <div className="flex flex-col gap-2 py-2">
      {/* Tier labels row — abbreviated for narrow sidebar */}
      <div className="flex justify-between px-0.5">
        {TONE_TIER_ENTRIES.map((tier) => {
          const isActive = snappedValue === tier.value;
          return (
            <span
              key={tier.value}
              className={cn(
                "font-mono text-[10px] tracking-wide text-center flex-1 truncate transition-colors duration-150",
                isActive
                  ? "text-[var(--amber)] font-semibold"
                  : "text-[var(--text-muted)] font-normal"
              )}
            >
              {tier.short}
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
        className="[&_[data-slot=slider-track]]:bg-[var(--border)] [&_[data-slot=slider-range]]:bg-[var(--amber)] [&_[data-slot=slider-thumb]]:bg-[var(--amber)] [&_[data-slot=slider-thumb]]:border-[var(--amber)] [&_[data-slot=slider-thumb]]:shadow-[0_0_0_4px_rgba(232,168,56,0.15),0_0_16px_rgba(232,168,56,0.25)]"
      />

      {/* Current tier label */}
      <p className="text-center font-mono text-[10px] font-medium text-[var(--amber)] tracking-wide">
        {currentTierLabel}
      </p>
    </div>
  );
}
