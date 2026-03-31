"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useTextRefineStore } from "@/lib/stores/text-refine";
import { useToneStore } from "@/lib/stores/tone";
import {
  useStyleProfilesStore,
  selectActiveProfiles,
} from "@/lib/stores/style-profiles";
import { AppHeader } from "@/components/app-header";
import { InputPanel } from "@/components/input-panel";
import { OutputPanel } from "@/components/output-panel";
import { ToneSlider } from "@/components/tone-slider";
import { MultiPostPack } from "@/components/multi-post-pack";
import { StylePanel } from "@/components/style-panel";
import { GlassCard } from "@/components/glass-card";
import Link from "next/link";

export default function Home() {
  const [showStylePanel, setShowStylePanel] = useState(true);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  const textRefineStore = useTextRefineStore();
  const toneStore = useToneStore();
  const styleProfileStore = useStyleProfilesStore();
  const activeProfiles = selectActiveProfiles(styleProfileStore);

  // Sync active profiles and tone value to the text refine store
  const updateActiveProfiles = textRefineStore.updateActiveProfiles;
  const updateToneValue = textRefineStore.updateToneValue;
  const toneValue = toneStore.toneValue;

  useEffect(() => {
    updateActiveProfiles(activeProfiles);
  }, [activeProfiles, updateActiveProfiles]);

  useEffect(() => {
    updateToneValue(toneValue);
  }, [toneValue, updateToneValue]);

  const handleToggleStylePanel = useCallback(() => {
    setShowStylePanel((prev) => !prev);
  }, []);

  const handleToggleMobileDrawer = useCallback(() => {
    setShowMobileDrawer((prev) => !prev);
  }, []);

  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader
        showStylePanel={showStylePanel}
        onToggleStylePanel={handleToggleStylePanel}
        onToggleMobileDrawer={handleToggleMobileDrawer}
      />

      <main className="flex-1 flex flex-col relative">
        <div className="flex flex-1 p-4 md:p-5 gap-3 md:gap-4">
          {/* Editor area */}
          <div className="flex-[3] flex flex-col gap-3 md:gap-4 min-w-0">
            {/* Split pane: side-by-side on desktop, stacked on mobile */}
            <div className="flex-1 flex md:flex-row flex-col gap-3">
              <GlassCard className="flex-1">
                <InputPanel />
              </GlassCard>
              <GlassCard className="flex-1">
                <OutputPanel />
              </GlassCard>
            </div>

            {/* Tone slider */}
            <GlassCard>
              <ToneSlider />
            </GlassCard>

            {/* Multi-post pack (conditional) */}
            <MultiPostPack />
          </div>

          {/* Style panel sidebar (desktop only) */}
          {showStylePanel && (
            <div className="hidden md:block w-[300px] shrink-0">
              <GlassCard className="h-full">
                <StylePanel />
              </GlassCard>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] py-3 px-4 text-center">
          <Link
            href="/legal"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Legal Disclaimers &amp; Disclosures
          </Link>
        </footer>
      </main>

      {/* Mobile drawer overlay */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileDrawer(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--surface)] border-r border-[var(--border)]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h2 className="text-sm font-semibold text-[var(--amber)]">
                Style Profiles
              </h2>
              <button
                type="button"
                onClick={() => setShowMobileDrawer(false)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                aria-label="Close drawer"
              >
                <X className="size-5" />
              </button>
            </div>
            <StylePanel isInDrawer />
          </div>
        </div>
      )}
    </div>
  );
}
