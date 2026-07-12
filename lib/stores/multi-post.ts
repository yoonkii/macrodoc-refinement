// ---------------------------------------------------------------------------
// Multi-post store — generates all 4 platform versions in one API call.
// Ported from Flutter: providers/multi_post_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';

import { generateMultiPost } from '../api';
import type { MultiPostResult } from '../api';
import { track } from '../analytics';
import { generateWithProvider } from '../byom-api';
import { PLATFORM_KEYS } from '../types';
import type { StyleProfile } from '../types';
import { buildMultiPostPrompt } from '../prompt-builder';
import { captureScrubbedError } from '../sentry';
import { useModelConfigStore } from './model-config';

export interface MultiPostState {
  platformOutputs: Record<string, string>;
  platformErrors: Record<string, boolean>;
  isGenerating: boolean;
  errorMessage: string;
}

export interface MultiPostActions {
  generateAll: (
    inputText: string,
    activeProfiles: StyleProfile[],
    toneValue: number,
  ) => Promise<void>;
  retryPlatform: (
    platform: string,
    inputText: string,
    activeProfiles: StyleProfile[],
    toneValue: number,
  ) => Promise<void>;
  clear: () => void;
}

export type MultiPostStore = MultiPostState & MultiPostActions;

// Internal mutable state kept outside the store to avoid re-renders.
let multiPostAbortController: AbortController | null = null;

function cancelActiveMultiPost(): void {
  if (multiPostAbortController) {
    multiPostAbortController.abort();
    multiPostAbortController = null;
  }
}

/**
 * Generate multi-post content via BYOM provider. The prompt asks for JSON
 * output with keys: linkedin, x, instagram, substack. We parse the raw
 * text response to extract those keys.
 */
async function generateMultiPostViaBYOM(prompt: string, signal?: AbortSignal): Promise<MultiPostResult> {
  const modelConfig = useModelConfigStore.getState().config;
  const rawText = await generateWithProvider(prompt, modelConfig, signal);

  // Extract JSON from the response — the model may wrap it in markdown code fences
  let jsonStr = rawText.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error('Failed to parse multi-post JSON response from AI provider');
  }

  return {
    linkedin: typeof parsed['linkedin'] === 'string' ? parsed['linkedin'] : '',
    x: typeof parsed['x'] === 'string' ? parsed['x'] : '',
    instagram: typeof parsed['instagram'] === 'string' ? parsed['instagram'] : '',
    substack: typeof parsed['substack'] === 'string' ? parsed['substack'] : '',
  };
}

export const useMultiPostStore = create<MultiPostStore>((set, get) => ({
  // ── State ──
  platformOutputs: {},
  platformErrors: {},
  isGenerating: false,
  errorMessage: '',

  // ── Actions ──

  async generateAll(
    inputText: string,
    activeProfiles: StyleProfile[],
    toneValue: number,
  ): Promise<void> {
    if (inputText.length === 0) return;

    // Cancel any in-flight request before starting a new one
    cancelActiveMultiPost();

    const controller = new AbortController();
    multiPostAbortController = controller;
    const { signal } = controller;

    set({
      isGenerating: true,
      platformOutputs: {},
      platformErrors: {},
      errorMessage: '',
    });

    const modelConfig = useModelConfigStore.getState().config;
    const useDefault = modelConfig.provider === 'default' || !modelConfig.apiKey.trim();
    // Effective route, so analytics reflect what actually served the request.
    const effectiveProvider = useDefault ? 'default' : modelConfig.provider;

    try {
      const prompt = buildMultiPostPrompt({
        inputText,
        activeProfiles,
        toneValue,
      });

      const results = useDefault
        ? await generateMultiPost(prompt, signal)
        : await generateMultiPostViaBYOM(prompt, signal);

      // If aborted between completion and state update, bail out
      if (signal.aborted) return;

      const outputs: Record<string, string> = { ...results };
      const errors: Record<string, boolean> = {};

      // Mark any platform with empty output as errored
      for (const platform of PLATFORM_KEYS) {
        const output = outputs[platform];
        if (!output || output.length === 0) {
          errors[platform] = true;
        }
      }

      set({ platformOutputs: outputs, platformErrors: errors });

      // Anonymous per-platform success/failure counts — no generated text.
      const platformsFailed = PLATFORM_KEYS.filter((key) => errors[key]).length;
      track('multi_post_generated', {
        provider: effectiveProvider,
        platforms_ok: PLATFORM_KEYS.length - platformsFailed,
        platforms_failed: platformsFailed,
      });
    } catch (error: unknown) {
      // Aborted requests are not errors
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (signal.aborted) return;

      captureScrubbedError(error, 'multi-post.generateAll');

      const message =
        error instanceof Error
          ? error.message.replace(/^Exception: /, '')
          : String(error);

      // Mark all platforms as errored on total failure
      const errors: Record<string, boolean> = {};
      for (const platform of PLATFORM_KEYS) {
        errors[platform] = true;
      }

      set({ errorMessage: message, platformErrors: errors });

      // Total failure — every platform failed.
      track('multi_post_generated', {
        provider: effectiveProvider,
        platforms_ok: 0,
        platforms_failed: PLATFORM_KEYS.length,
      });
    } finally {
      if (!signal.aborted) {
        set({ isGenerating: false });
      }
      if (multiPostAbortController === controller) {
        multiPostAbortController = null;
      }
    }
  },

  async retryPlatform(
    platform: string,
    inputText: string,
    activeProfiles: StyleProfile[],
    toneValue: number,
  ): Promise<void> {
    if (inputText.length === 0) return;

    // Share the abort slot with generateAll: a newer generateAll() (or another
    // retry) aborts this in-flight retry so a stale response can never overwrite
    // fresher output, and vice versa.
    cancelActiveMultiPost();
    const controller = new AbortController();
    multiPostAbortController = controller;
    const { signal } = controller;

    // Clear the error for this platform and reflect that generation is underway
    set((state) => ({
      isGenerating: true,
      errorMessage: '',
      platformErrors: { ...state.platformErrors, [platform]: false },
    }));

    try {
      const prompt = buildMultiPostPrompt({
        inputText,
        activeProfiles,
        toneValue,
      });

      const modelConfig = useModelConfigStore.getState().config;
      const useDefault = modelConfig.provider === 'default' || !modelConfig.apiKey.trim();
      const results = useDefault
        ? await generateMultiPost(prompt, signal)
        : await generateMultiPostViaBYOM(prompt, signal);

      // A newer request superseded this retry — discard its result.
      if (signal.aborted) return;

      set((state) => {
        const updatedOutputs = { ...state.platformOutputs };
        const updatedErrors = { ...state.platformErrors };

        // Update the retried platform
        const output = results[platform as keyof typeof results];
        if (output && output.length > 0) {
          updatedOutputs[platform] = output;
          updatedErrors[platform] = false;
        } else {
          updatedErrors[platform] = true;
        }

        // Also update any other platforms that were errored if we got new data
        for (const key of PLATFORM_KEYS) {
          if (key === platform) continue;
          if (
            updatedErrors[key] === true &&
            results[key as keyof typeof results] &&
            results[key as keyof typeof results].length > 0
          ) {
            updatedOutputs[key] = results[key as keyof typeof results];
            updatedErrors[key] = false;
          }
        }

        return {
          platformOutputs: updatedOutputs,
          platformErrors: updatedErrors,
        };
      });
    } catch (error: unknown) {
      // Aborted retries are not errors — a newer request took over.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (signal.aborted) return;

      captureScrubbedError(error, 'multi-post.retryPlatform');
      set((state) => ({
        platformErrors: { ...state.platformErrors, [platform]: true },
      }));
    } finally {
      if (!signal.aborted) {
        set({ isGenerating: false });
      }
      if (multiPostAbortController === controller) {
        multiPostAbortController = null;
      }
    }
  },

  clear(): void {
    set({
      platformOutputs: {},
      platformErrors: {},
      isGenerating: false,
      errorMessage: '',
    });
  },
}));
