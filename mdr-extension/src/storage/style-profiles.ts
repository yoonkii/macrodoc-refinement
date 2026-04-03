// ---------------------------------------------------------------------------
// chrome.storage wrapper for style profiles.
// Initialises with DEFAULT_PROFILES on first load.
// ---------------------------------------------------------------------------

import { DEFAULT_PROFILES } from '../shared/constants';
import type { StyleProfile } from '../shared/types';

const STORAGE_KEY = 'styleProfiles';
const INITIALIZED_KEY = 'styleProfilesInitialized';

export async function getStyleProfiles(): Promise<StyleProfile[]> {
  const data = await chrome.storage.local.get([STORAGE_KEY, INITIALIZED_KEY]);

  // Seed defaults on first load
  if (!data[INITIALIZED_KEY]) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: DEFAULT_PROFILES,
      [INITIALIZED_KEY]: true,
    });
    return [...DEFAULT_PROFILES];
  }

  return (data[STORAGE_KEY] as StyleProfile[] | undefined) ?? [...DEFAULT_PROFILES];
}

export async function setStyleProfiles(profiles: StyleProfile[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
}

export async function toggleProfile(profileId: string): Promise<StyleProfile[]> {
  const profiles = await getStyleProfiles();
  const updated = profiles.map((p) =>
    p.id === profileId ? { ...p, isActive: !p.isActive } : p,
  );
  await setStyleProfiles(updated);
  return updated;
}

export async function resetStyleProfiles(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: DEFAULT_PROFILES,
    [INITIALIZED_KEY]: true,
  });
}
