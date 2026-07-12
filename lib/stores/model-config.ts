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
  /**
   * The API key for the CURRENT provider. Kept as a derived, flattened field so
   * every existing call site (`config.apiKey`) keeps working unchanged. The
   * source of truth per provider lives in `keys`.
   */
  apiKey: string;
}

export interface ModelConfigState {
  config: ModelConfig;
  /** Per-provider API keys, so switching providers doesn't lose an entered key. */
  keys: Partial<Record<ProviderKey, string>>;
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

/** Shape of the persisted slice (state only, no actions). */
type PersistedModelConfig = ModelConfigState;

export const useModelConfigStore = create<ModelConfigStore>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_CONFIG },
      keys: {},

      setProvider(provider: ProviderKey): void {
        // When switching provider, auto-select the first model for that provider
        // and restore that provider's previously-entered key (if any). Re-
        // selecting the SAME provider therefore keeps its key intact.
        const models = PROVIDER_MODELS[provider];
        const firstModel = models?.[0]?.id ?? '';
        set((state) => ({
          config: {
            provider,
            model: firstModel,
            apiKey: state.keys[provider] ?? '',
          },
        }));
      },

      setModel(model: string): void {
        set((state) => ({
          config: { ...state.config, model },
        }));
      },

      setApiKey(key: string): void {
        // Update both the derived current-provider key and the per-provider map.
        set((state) => ({
          config: { ...state.config, apiKey: key },
          keys: { ...state.keys, [state.config.provider]: key },
        }));
      },

      reset(): void {
        set({ config: { ...DEFAULT_CONFIG }, keys: {} });
      },
    }),
    {
      name: 'mdr-model-config',
      version: 1,
      // v0 shape: `{ config: { provider, model, apiKey } }` with no `keys` map.
      // Lift the single apiKey into the per-provider map so a returning user's
      // saved key survives the upgrade.
      migrate: (persisted, version): PersistedModelConfig => {
        if (version === 0 && persisted && typeof persisted === 'object') {
          const previous = persisted as { config?: Partial<ModelConfig> };
          const config: ModelConfig = {
            provider: previous.config?.provider ?? DEFAULT_CONFIG.provider,
            model: previous.config?.model ?? DEFAULT_CONFIG.model,
            apiKey: previous.config?.apiKey ?? '',
          };
          const keys: Partial<Record<ProviderKey, string>> = {};
          if (config.provider !== 'default' && config.apiKey) {
            keys[config.provider] = config.apiKey;
          }
          return { config, keys };
        }
        // Already current (or unrecognized) — return as-is.
        return persisted as PersistedModelConfig;
      },
    },
  ),
);
