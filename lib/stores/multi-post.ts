// ---------------------------------------------------------------------------
// Multi-post store — generates all 4 platform versions in one API call.
// Ported from Flutter: providers/multi_post_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';

import { generateMultiPost } from '../api';
import type { MultiPostResult } from '../api';
import { generateWithProvider } from '../byom-api';
import { PLATFORM_KEYS } from '../types';
import type { StyleProfile } from '../types';
import { buildMultiPostPrompt } from '../prompt-builder';
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

/**
 * Generate multi-post content via BYOM provider. The prompt asks for JSON
 * output with keys: linkedin, x, instagram, substack. We parse the raw
 * text response to extract those keys.
 */
async function generateMultiPostViaBYOM(prompt: string): Promise<MultiPostResult> {
  const modelConfig = useModelConfigStore.getState().config;
  const rawText = await generateWithProvider(prompt, modelConfig);

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

    set({
      isGenerating: true,
      platformOutputs: {},
      platformErrors: {},
      errorMessage: '',
    });

    try {
      const prompt = buildMultiPostPrompt({
        inputText,
        activeProfiles,
        toneValue,
      });

      const modelConfig = useModelConfigStore.getState().config;
      const results =
        modelConfig.provider === 'default'
          ? await generateMultiPost(prompt)
          : await generateMultiPostViaBYOM(prompt);

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
    } catch (error: unknown) {
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
    } finally {
      set({ isGenerating: false });
    }
  },

  async retryPlatform(
    platform: string,
    inputText: string,
    activeProfiles: StyleProfile[],
    toneValue: number,
  ): Promise<void> {
    if (inputText.length === 0) return;

    // Clear the error for this platform before retrying
    set((state) => ({
      platformErrors: { ...state.platformErrors, [platform]: false },
    }));

    try {
      const prompt = buildMultiPostPrompt({
        inputText,
        activeProfiles,
        toneValue,
      });

      const modelConfig = useModelConfigStore.getState().config;
      const results =
        modelConfig.provider === 'default'
          ? await generateMultiPost(prompt)
          : await generateMultiPostViaBYOM(prompt);

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
    } catch {
      set((state) => ({
        platformErrors: { ...state.platformErrors, [platform]: true },
      }));
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
