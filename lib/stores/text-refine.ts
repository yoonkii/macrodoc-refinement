// ---------------------------------------------------------------------------
// Text refinement store — streaming AI text transformation.
// Ported from Flutter: providers/text_refine_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';

import { streamRefine } from '../api';
import { streamWithProvider } from '../byom-api';
import { MAX_CHARACTERS } from '../constants';
import { buildRefinementPrompt } from '../prompt-builder';
import { captureScrubbedError } from '../sentry';
import { useModelConfigStore } from './model-config';
import type { StyleProfile } from '../types';

export interface TextRefineState {
  inputText: string;
  refinedText: string;
  isProcessing: boolean;
  isStreaming: boolean;
  errorMessage: string;
  activeProfiles: StyleProfile[];
  toneValue: number;
}

export interface TextRefineActions {
  setInputText: (text: string) => void;
  setRefinedText: (text: string) => void;
  processNow: () => void;
  setSuppressAutoRefine: (value: boolean) => void;
  acceptRefinement: () => void;
  clearError: () => void;
  updateActiveProfiles: (profiles: StyleProfile[]) => void;
  updateToneValue: (value: number) => void;
}

export type TextRefineStore = TextRefineState & TextRefineActions;

// Internal mutable state not exposed in the Zustand store shape.
// Kept outside the store to avoid triggering re-renders on timer/controller changes.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

// While true, setInputText updates the text but does NOT schedule the 300ms
// auto-refine. Voice dictation flips this on so streaming appended transcripts
// don't spam the API; the caller fires a single processNow() on stop.
let suppressAutoRefine = false;

/**
 * Stable change-detection key for the active profile set. Includes every field
 * that affects the built prompt — instructions, few-shot examples, name, char
 * limit, and tone baseline — so that editing a profile's few-shots (or any of
 * those fields) re-triggers a refinement instead of being silently ignored.
 */
function activeProfilesKey(profiles: StyleProfile[]): string {
  return JSON.stringify(
    profiles.map((profile) => ({
      id: profile.id,
      isActive: profile.isActive,
      name: profile.name,
      instructions: profile.instructions,
      fewShots: profile.fewShots,
      charLimit: profile.charLimit,
      toneBaseline: profile.toneBaseline,
    })),
  );
}

/**
 * Toggle the `data-streaming` attribute on <html> so the ambient amber glow can
 * react to an in-flight refinement (see globals.css). Guarded for SSR.
 */
function setStreamingFlag(active: boolean): void {
  if (typeof document === 'undefined') return;
  if (active) {
    document.documentElement.setAttribute('data-streaming', '');
  } else {
    document.documentElement.removeAttribute('data-streaming');
  }
}

function cancelActiveStream(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  // Every abort is an exit path — clear the ambient glow. If a new stream is
  // starting it will re-set the flag immediately after this returns.
  setStreamingFlag(false);
}

export const useTextRefineStore = create<TextRefineStore>((set, get) => {
  /** Core processing logic — aborts previous stream, builds prompt, streams. */
  async function processText(text: string): Promise<void> {
    if (text.length === 0) {
      set({ refinedText: '' });
      return;
    }

    // Cancel any in-flight stream before starting a new one
    cancelActiveStream();

    const truncatedText =
      text.length > MAX_CHARACTERS ? text.slice(0, MAX_CHARACTERS) : text;

    abortController = new AbortController();
    const { signal } = abortController;

    set({
      isProcessing: true,
      isStreaming: true,
      refinedText: '',
      errorMessage: '',
    });
    setStreamingFlag(true);

    const { activeProfiles, toneValue } = get();

    // Separate platform and personality profiles for layered prompt building
    let platformPreset: StyleProfile | null = null;
    let personalityMode: StyleProfile | null = null;

    for (const profile of activeProfiles) {
      if (profile.type === 'platform' && !platformPreset) {
        platformPreset = profile;
      } else if (profile.type === 'personality' && !personalityMode) {
        personalityMode = profile;
      }
    }

    const prompt = buildRefinementPrompt({
      inputText: truncatedText,
      activeProfiles,
      toneValue,
      platformPreset,
      personalityMode,
    });

    try {
      const modelConfig = useModelConfigStore.getState().config;

      // Route to BYOM provider or default Cloud Run proxy
      // Fall back to default if provider is set but API key is missing
      const useDefault = modelConfig.provider === 'default' || !modelConfig.apiKey.trim();
      const stream = useDefault
        ? streamRefine(prompt, signal)
        : streamWithProvider(prompt, modelConfig, signal);

      for await (const chunk of stream) {
        // Check if we were aborted between chunks
        if (signal.aborted) return;
        set((state) => ({ refinedText: state.refinedText + chunk }));
      }
    } catch (error: unknown) {
      // Aborted streams are not errors
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (signal.aborted) return;

      captureScrubbedError(error, 'text-refine.processText');

      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ errorMessage: `Error: ${message}` });
    } finally {
      // Only the currently-owning stream clears state/glow. An aborted stream
      // was superseded by a newer one that already owns the flag.
      if (!signal.aborted) {
        set({ isProcessing: false, isStreaming: false });
        setStreamingFlag(false);
      }
      if (abortController?.signal === signal) {
        abortController = null;
      }
    }
  }

  /**
   * Debounced process trigger — coalesces rapid profile + tone changes
   * (e.g. toggling MDR cascades: profile toggle → proofread auto-toggle → tone sync)
   * into a single processText() call.
   */
  function scheduleProcess(): void {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      const { inputText } = get();
      if (inputText.length > 0) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = null;
        processText(inputText);
      }
    }, 80);
  }

  return {
    // ── State ──
    inputText: '',
    refinedText: '',
    isProcessing: false,
    isStreaming: false,
    errorMessage: '',
    activeProfiles: [],
    toneValue: 0,

    // ── Actions ──

    setInputText(text: string): void {
      set({ inputText: text, errorMessage: '' });

      if (text.length === 0) {
        cancelActiveStream();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = null;
        set({ refinedText: '', isProcessing: false, isStreaming: false });
        return;
      }

      // While dictation is active, hold the text but skip auto-refine — the
      // caller triggers one processNow() when recording stops.
      if (suppressAutoRefine) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = null;
        return;
      }

      // Debounce: clear previous timer, set new 300ms timer
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        processText(text);
      }, 300);
    },

    setRefinedText(text: string): void {
      set({ refinedText: text });
    },

    processNow(): void {
      const { inputText } = get();
      if (inputText.length > 0) {
        // Cancel any pending debounce
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = null;
        processText(inputText);
      }
    },

    setSuppressAutoRefine(value: boolean): void {
      suppressAutoRefine = value;
      // Turning suppression on cancels any refine already queued from the last
      // keystroke so nothing fires mid-dictation.
      if (value && debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },

    acceptRefinement(): void {
      const { refinedText, isProcessing } = get();
      if (refinedText.length > 0 && !isProcessing) {
        set({ inputText: refinedText, refinedText: '' });
      }
    },

    clearError(): void {
      set({ errorMessage: '' });
    },

    updateActiveProfiles(profiles: StyleProfile[]): void {
      const currentKey = activeProfilesKey(get().activeProfiles);
      const newKey = activeProfilesKey(profiles);

      if (currentKey !== newKey) {
        set({ activeProfiles: [...profiles] });
        scheduleProcess();
      }
    },

    updateToneValue(value: number): void {
      const { toneValue } = get();
      if (toneValue !== value) {
        set({ toneValue: value });
        scheduleProcess();
      }
    },
  };
});
