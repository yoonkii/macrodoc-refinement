// ---------------------------------------------------------------------------
// Text refinement store — streaming AI text transformation.
// Ported from Flutter: providers/text_refine_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';

import { streamRefine } from '../api';
import { streamWithProvider } from '../byom-api';
import { MAX_CHARACTERS } from '../constants';
import { buildRefinementPrompt } from '../prompt-builder';
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

function cancelActiveStream(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
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

      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ errorMessage: `Error: ${message}` });
    } finally {
      if (!signal.aborted) {
        set({ isProcessing: false, isStreaming: false });
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
      const currentKey = get()
        .activeProfiles.map((p) => `${p.id}:${p.isActive}`)
        .join();
      const newKey = profiles.map((p) => `${p.id}:${p.isActive}`).join();

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
