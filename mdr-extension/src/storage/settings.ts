// ---------------------------------------------------------------------------
// chrome.storage wrapper for general extension settings.
// ---------------------------------------------------------------------------

export interface ExtensionSettings {
  /** Show the inline floating "Refine" widget on text selection. */
  inlineWidgetEnabled: boolean;
  /** Tone slider value persisted across sessions. */
  toneValue: number;
}

const STORAGE_KEY = 'extensionSettings';

const DEFAULT_SETTINGS: ExtensionSettings = {
  inlineWidgetEnabled: true,
  toneValue: 0,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as ExtensionSettings | undefined) ?? { ...DEFAULT_SETTINGS };
}

export async function setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...current, ...settings },
  });
}

export async function resetSettings(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...DEFAULT_SETTINGS },
  });
}
