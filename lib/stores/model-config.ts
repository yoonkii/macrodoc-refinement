// ---------------------------------------------------------------------------
// Model configuration store — BYOM (Bring Your Own Model) settings.
// Persisted to localStorage so API keys never leave the browser.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { PROVIDER_MODELS } from '../constants';

export type ProviderKey = 'default' | 'openai' | 'anthropic' | 'google' | 'grok';

export interface ModelConfig {
  provider: ProviderKey;
  model: string;
  apiKey: string;
}

export interface ModelConfigState {
  config: ModelConfig;
}

export interface ModelConfigActions {
  setProvider: (provider: ProviderKey) => void;
  setModel: (model: string) => void;
  setApiKey: (key: string) => void;
  reset: () => void;
}

export type ModelConfigStore = ModelConfigState & ModelConfigActions;

const DEFAULT_CONFIG: ModelConfig = {
  provider: 'default',
  model: 'gemini-3.1-flash-lite-preview',
  apiKey: '',
};

export const useModelConfigStore = create<ModelConfigStore>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_CONFIG },

      setProvider(provider: ProviderKey): void {
        // When switching provider, auto-select the first model for that provider
        const models = PROVIDER_MODELS[provider];
        const firstModel = models?.[0]?.id ?? '';
        set({
          config: {
            provider,
            model: firstModel,
            // Preserve apiKey only if staying on same provider; clear otherwise
            apiKey: '',
          },
        });
      },

      setModel(model: string): void {
        set((state) => ({
          config: { ...state.config, model },
        }));
      },

      setApiKey(key: string): void {
        set((state) => ({
          config: { ...state.config, apiKey: key },
        }));
      },

      reset(): void {
        set({ config: { ...DEFAULT_CONFIG } });
      },
    }),
    {
      name: 'mdr-model-config',
    },
  ),
);
