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

/**
 * Merge incoming profiles (e.g. from the web app) with existing extension profiles.
 * - New profiles (by ID) are appended.
 * - Existing profiles (by ID) are updated in place.
 * - Profiles that exist only in the extension are preserved (never deleted).
 * Returns the merged array and the count of newly added profiles.
 */
export async function mergeProfiles(
  incoming: StyleProfile[],
): Promise<{ merged: StyleProfile[]; addedCount: number; updatedCount: number }> {
  const existing = await getStyleProfiles();
  const existingById = new Map(existing.map((p) => [p.id, p]));
  const mergedById = new Map(existingById);

  let addedCount = 0;
  let updatedCount = 0;

  for (const profile of incoming) {
    if (!profile.id || !profile.name) continue; // skip malformed entries

    if (mergedById.has(profile.id)) {
      // Update existing profile with incoming data
      mergedById.set(profile.id, { ...profile });
      updatedCount += 1;
    } else {
      // New profile — append
      mergedById.set(profile.id, { ...profile });
      addedCount += 1;
    }
  }

  const merged = Array.from(mergedById.values());
  await setStyleProfiles(merged);

  return { merged, addedCount, updatedCount };
}
