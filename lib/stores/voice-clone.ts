// ---------------------------------------------------------------------------
// Voice-clone store — drives the "Clone My Voice" flow.
//
// Persists ONLY the durable inputs (the user's pasted samples + which learned
// profile this flow manages). Analysis state (isAnalyzing / analysisError) and
// the dialog-open flag are transient and intentionally excluded from persist.
//
// The store owns the model call (analyze) and the save handoff (saveProfile),
// so both the dialog and the dedicated /voice page share one code path.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { generateBatch } from '../api';
import { track } from '../analytics';
import { generateWithProvider } from '../byom-api';
import { buildVoiceAnalysisPrompt } from '../voice-analysis';
import type { StyleProfile } from '../types';
import { useModelConfigStore } from './model-config';
import { useStyleProfilesStore } from './style-profiles';

/**
 * Cap on the combined length of all samples. The proxy rejects prompts over
 * ~10k chars; this leaves headroom for the meta-prompt scaffolding. Exported
 * for the UI's live character counter.
 */
export const MAX_SAMPLE_TOTAL = 8000;

/** Friendly fallback when the model returns nothing usable. */
const EMPTY_ANALYSIS_MESSAGE =
  'The analysis came back empty. Add a bit more of your own writing and try again.';

/** Friendly fallback when analyze is called with no usable samples. */
const NO_SAMPLES_MESSAGE = 'Paste at least one thing you wrote, then analyze.';

export interface VoiceCloneState {
  /** The user's pasted writing samples (one per textarea). */
  samples: string[];
  /** Id of the learned StyleProfile this flow manages, if one exists yet. */
  linkedProfileId: string | null;
  // ── Transient (never persisted) ──
  isAnalyzing: boolean;
  analysisError: string | null;
  isDialogOpen: boolean;
}

/** Payload for persisting an edited analysis back to the style-profiles store. */
export interface SaveVoiceProfileInput {
  name: string;
  instructions: string;
  fewShots: string[];
}

export interface VoiceCloneActions {
  setSample: (index: number, text: string) => void;
  addSample: () => void;
  removeSample: (index: number) => void;
  setLinkedProfileId: (id: string | null) => void;
  clearError: () => void;
  openDialog: () => void;
  closeDialog: () => void;
  /**
   * Run the voice analysis. Builds the meta-prompt, routes through the proxy
   * or the user's BYOM provider, and returns the analysis text. Does NOT save a
   * profile — the caller edits the result first. Returns null on error/empty.
   */
  analyze: () => Promise<string | null>;
  /**
   * Persist an edited analysis as a learned StyleProfile. Updates the linked
   * profile in place when it still exists; otherwise creates a new active
   * learned profile and records its id in linkedProfileId.
   */
  saveProfile: (input: SaveVoiceProfileInput) => void;
}

export type VoiceCloneStore = VoiceCloneState & VoiceCloneActions;

const STORAGE_KEY = 'mdr-voice-clone';

/**
 * Clamp the combined sample text to MAX_SAMPLE_TOTAL, preserving whole samples
 * where possible and truncating only the sample that crosses the budget. This
 * is a defensive backstop; the UI also disables analyze past the cap.
 */
function clampSamples(samples: string[]): string[] {
  const clamped: string[] = [];
  let used = 0;
  for (const sample of samples) {
    if (used >= MAX_SAMPLE_TOTAL) break;
    const remaining = MAX_SAMPLE_TOTAL - used;
    const slice = sample.length > remaining ? sample.slice(0, remaining) : sample;
    clamped.push(slice);
    used += slice.length;
  }
  return clamped;
}

export const useVoiceCloneStore = create<VoiceCloneStore>()(
  persist(
    (set, get) => ({
      // ── State ──
      samples: [''],
      linkedProfileId: null,
      isAnalyzing: false,
      analysisError: null,
      isDialogOpen: false,

      // ── Sample editing ──
      setSample(index: number, text: string): void {
        set((state) => ({
          samples: state.samples.map((s, i) => (i === index ? text : s)),
        }));
      },

      addSample(): void {
        set((state) => ({ samples: [...state.samples, ''] }));
      },

      removeSample(index: number): void {
        set((state) => {
          const next = state.samples.filter((_, i) => i !== index);
          // Always keep at least one editable field.
          return { samples: next.length > 0 ? next : [''] };
        });
      },

      setLinkedProfileId(id: string | null): void {
        set({ linkedProfileId: id });
      },

      clearError(): void {
        set({ analysisError: null });
      },

      openDialog(): void {
        set({ isDialogOpen: true });
      },

      closeDialog(): void {
        set({ isDialogOpen: false });
      },

      // ── Model call ──
      async analyze(): Promise<string | null> {
        const usableSamples = get()
          .samples.map((sample) => sample.trim())
          .filter((sample) => sample.length > 0);

        if (usableSamples.length === 0) {
          set({ analysisError: NO_SAMPLES_MESSAGE });
          return null;
        }

        set({ isAnalyzing: true, analysisError: null });

        try {
          const prompt = buildVoiceAnalysisPrompt(clampSamples(usableSamples));

          // Route exactly like other call sites: proxy unless the user has
          // configured their own provider + key.
          const modelConfig = useModelConfigStore.getState().config;
          const useDefault =
            modelConfig.provider === 'default' || !modelConfig.apiKey.trim();

          const raw = useDefault
            ? await generateBatch(prompt)
            : await generateWithProvider(prompt, modelConfig);

          const analysis = raw.trim();
          if (analysis.length === 0) {
            set({ analysisError: EMPTY_ANALYSIS_MESSAGE });
            return null;
          }

          // Anonymous signal — sample count and aggregate length only, never
          // the sample text or the analysis output.
          track('voice_analyzed', {
            samples: usableSamples.length,
            total_chars: usableSamples.reduce(
              (sum, sample) => sum + sample.length,
              0,
            ),
          });

          return analysis;
        } catch (error: unknown) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : 'Analysis failed. Please try again.';
          set({ analysisError: message });
          return null;
        } finally {
          set({ isAnalyzing: false });
        }
      },

      // ── Save handoff ──
      saveProfile(input: SaveVoiceProfileInput): void {
        // Anonymous signal — counts only, never the sample or excerpt text.
        track('voice_cloned', {
          samples: get().samples.filter((sample) => sample.trim().length > 0)
            .length,
          excerpts: input.fewShots.length,
        });

        const styleStore = useStyleProfilesStore.getState();
        const linkedId = get().linkedProfileId;
        const existing = linkedId
          ? styleStore.profiles.find((p) => p.id === linkedId)
          : undefined;

        if (existing) {
          // Update in place, preserving id + active state.
          styleStore.updateProfile({
            ...existing,
            name: input.name,
            instructions: input.instructions,
            fewShots: input.fewShots,
            type: 'learned',
          });
          return;
        }

        // Create a fresh learned profile. addProfile assigns its own id, so we
        // diff the profile list to recover it and record the link.
        const idsBefore = new Set(styleStore.profiles.map((p) => p.id));
        const newProfile: StyleProfile = {
          id: '', // ignored — addProfile assigns a UUID
          name: input.name,
          instructions: input.instructions,
          fewShots: input.fewShots,
          isActive: true,
          type: 'learned',
          toneBaseline: 0,
          charLimit: null,
        };
        styleStore.addProfile(newProfile);

        const created = useStyleProfilesStore
          .getState()
          .profiles.find((p) => !idsBefore.has(p.id));
        if (created) {
          set({ linkedProfileId: created.id });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      // Only durable inputs survive reloads.
      partialize: (state) => ({
        samples: state.samples,
        linkedProfileId: state.linkedProfileId,
      }),
    },
  ),
);
