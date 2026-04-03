// ---------------------------------------------------------------------------
// chrome.storage wrapper for BYOM (Bring Your Own Model) configuration.
// API keys are stored locally and never leave the browser.
// ---------------------------------------------------------------------------

export type ProviderKey = 'default' | 'openai' | 'anthropic' | 'google' | 'grok';

export interface ModelConfig {
  provider: ProviderKey;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = 'modelConfig';

const DEFAULT_CONFIG: ModelConfig = {
  provider: 'default',
  model: 'gemini-3.1-flash-lite-preview',
  apiKey: '',
};

export async function getModelConfig(): Promise<ModelConfig> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as ModelConfig | undefined) ?? { ...DEFAULT_CONFIG };
}

export async function setModelConfig(config: Partial<ModelConfig>): Promise<void> {
  const current = await getModelConfig();
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...current, ...config },
  });
}

export async function resetModelConfig(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...DEFAULT_CONFIG },
  });
}
