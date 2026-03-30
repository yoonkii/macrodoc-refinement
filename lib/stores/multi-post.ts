// ---------------------------------------------------------------------------
// Multi-post store — generates all 4 platform versions in one API call.
// Ported from Flutter: providers/multi_post_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';

import { generateMultiPost } from '../api';
import { PLATFORM_KEYS } from '../types';
import type { StyleProfile } from '../types';
import { buildMultiPostPrompt } from '../prompt-builder';

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

      const results = await generateMultiPost(prompt);
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

      const results = await generateMultiPost(prompt);

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
