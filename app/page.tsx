"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, FlaskConical, Settings } from "lucide-react";
import { useTextRefineStore } from "@/lib/stores/text-refine";
import { useToneStore } from "@/lib/stores/tone";
import {
  useStyleProfilesStore,
  selectActiveProfiles,
} from "@/lib/stores/style-profiles";
import { AppHeader } from "@/components/app-header";
import { InputPanel } from "@/components/input-panel";
import { OutputPanel } from "@/components/output-panel";
import { StylePanel } from "@/components/style-panel";
import { GlassCard } from "@/components/glass-card";
import { VoiceCloneDialog } from "@/components/voice-clone-dialog";
import { MdrTipToast } from "@/components/mdr-tip-toast";
import Link from "next/link";

const PROOFREAD_ONLY_NAME = "Proofread Only";

export default function Home() {
  const [showStylePanel, setShowStylePanel] = useState(true);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  const textRefineStore = useTextRefineStore();
  const toneStore = useToneStore();
  const styleProfileStore = useStyleProfilesStore();
  const activeProfiles = selectActiveProfiles(styleProfileStore);
  const profiles = styleProfileStore.profiles;

  // ── Global side-effects (run ONCE here, NOT in StylePanel which mounts 2x) ──

  // Auto-toggle: mutual exclusivity between Proofread Only and personality modes.
  useEffect(() => {
    const proofreadProfile = profiles.find((p) => p.name === PROOFREAD_ONLY_NAME);
    if (!proofreadProfile) return;

    const personalityActive = profiles.some(
      (p) => p.type === "personality" && p.name !== PROOFREAD_ONLY_NAME && p.isActive,
    );

    if (personalityActive && proofreadProfile.isActive) {
      styleProfileStore.setProfileActive(proofreadProfile.id, false);
    } else if (!personalityActive && !proofreadProfile.isActive) {
      styleProfileStore.setProfileActive(proofreadProfile.id, true);
    }
  }, [profiles, styleProfileStore]);

  // Tone sync: apply a personality's baseline tone ONLY at the moment the active
  // personality changes. Applying it on every profiles change (or resetting to 0
  // when none is active) would clobber manual slider adjustments, since this
  // effect also re-runs when the tone store updates. Tracking the previous active
  // personality id lets manual tweaks persist until a different personality is
  // selected.
  const prevActivePersonalityIdRef = useRef<string | null>(null);
  useEffect(() => {
    const activePersonality = profiles.find(
      (p) => p.type === "personality" && p.name !== PROOFREAD_ONLY_NAME && p.isActive,
    );
    const activeId = activePersonality?.id ?? null;

    if (activeId === prevActivePersonalityIdRef.current) return;
    prevActivePersonalityIdRef.current = activeId;

    // Only overwrite the tone when a personality becomes active. Deactivating a
    // personality leaves the current tone untouched so manual choices survive.
    if (activePersonality) {
      toneStore.setTone(activePersonality.toneBaseline);
    }
  }, [profiles, toneStore]);

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
    <div className="relative z-10 flex flex-col h-dvh overflow-hidden">
      <AppHeader
        showStylePanel={showStylePanel}
        onToggleStylePanel={handleToggleStylePanel}
        onToggleMobileDrawer={handleToggleMobileDrawer}
      />

      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-1 p-4 md:p-5 gap-3 md:gap-4 min-h-0">
          {/* Editor area — just the split pane, nothing else */}
          <div className="flex-[3] flex md:flex-row flex-col gap-3 md:gap-4 min-h-0 min-w-0">
            {/* min-w-0 keeps the panes at equal width even when the output
                contains an unbreakable token (URL, hashtag chain) — without it
                a flex item's min-width:auto lets content blow the pane out. */}
            <GlassCard className="flex-1 min-w-0 min-h-0" innerClassName="flex flex-col">
              <InputPanel />
            </GlassCard>
            <GlassCard className="flex-1 min-w-0 min-h-0" innerClassName="flex flex-col">
              <OutputPanel />
            </GlassCard>
          </div>

          {/* Style panel sidebar (desktop only) */}
          {showStylePanel && (
            <div className="hidden lg:block w-[280px] shrink-0 min-h-0">
              <GlassCard className="h-full" innerClassName="flex flex-col">
                <StylePanel />
              </GlassCard>
            </div>
          )}
        </div>

        {/* Shared legal disclaimer */}
        <p className="shrink-0 text-[10px] text-[var(--text-muted)] text-center px-4 py-1">
          Text is processed by your selected AI provider (Google&apos;s Gemini by default). By using this service, you confirm you are at least 18 years of age.
        </p>

        {/* Footer */}
        <footer className="shrink-0 border-t border-[var(--border)] py-2 px-4 text-center">
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
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileDrawer(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
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
            <div className="flex-1 min-h-0 overflow-y-auto">
              <StylePanel isInDrawer onNavigate={() => setShowMobileDrawer(false)} />
            </div>

            {/* Navigation links (hidden on desktop header) */}
            <nav className="mt-auto border-t border-[var(--border)] px-4 py-3 flex flex-col gap-1">
              <Link
                href="/playground"
                onClick={() => setShowMobileDrawer(false)}
                className="flex items-center gap-2 px-2 py-2 rounded-md text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                <FlaskConical className="size-4" />
                Style Playground
              </Link>
              <Link
                href="/settings"
                onClick={() => setShowMobileDrawer(false)}
                className="flex items-center gap-2 px-2 py-2 rounded-md text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                <Settings className="size-4" />
                Settings
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Voice-clone dialog — mounted ONCE here (StylePanel mounts twice: desktop
          sidebar + mobile drawer). Both triggers open it via the shared store. */}
      <VoiceCloneDialog />

      {/* One-time discovery tip for the hidden MDR theme. */}
      <MdrTipToast />
    </div>
  );
}
