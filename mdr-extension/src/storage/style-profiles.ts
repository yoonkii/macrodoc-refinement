// ---------------------------------------------------------------------------
// chrome.storage wrapper for style profiles.
// Initialises with DEFAULT_PROFILES on first load.
// ---------------------------------------------------------------------------

import { DEFAULT_PROFILES } from '../shared/constants';
import type { ProfileType, StyleProfile } from '../shared/types';

const STORAGE_KEY = 'styleProfiles';
const INITIALIZED_KEY = 'styleProfilesInitialized';

// ── Sync validation limits ──────────────────────────────────────────────────
// Synced profiles arrive from the MDR web app's localStorage, which is
// attacker-influenceable on any page the content script runs on. Treat every
// field as untrusted: enforce a known shape, a bounded set of types, and hard
// caps on counts/sizes so a malicious or corrupt sync cannot bloat
// chrome.storage or smuggle an oversized instruction block into the prompt.
const MAX_SYNCED_PROFILES = 50;
const MAX_NAME_LENGTH = 100;
const MAX_INSTRUCTIONS_LENGTH = 5000;
const MAX_FEWSHOT_LENGTH = 2000;
const MAX_FEWSHOTS = 50;
const VALID_PROFILE_TYPES: ReadonlySet<ProfileType> = new Set<ProfileType>([
  'platform',
  'personality',
  'custom',
  'learned',
]);

/**
 * Structurally validate one untrusted profile from a web sync. Returns a
 * normalised StyleProfile when the entry is well-formed and within limits, or
 * null when it must be dropped. Missing optional numeric fields are defaulted
 * rather than rejected so minor schema drift does not discard valid profiles.
 */
function validateSyncedProfile(candidate: unknown): StyleProfile | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const p = candidate as Record<string, unknown>;

  if (typeof p.id !== 'string' || p.id.length === 0 || p.id.length > MAX_NAME_LENGTH) {
    return null;
  }
  if (typeof p.name !== 'string' || p.name.length === 0 || p.name.length > MAX_NAME_LENGTH) {
    return null;
  }
  if (typeof p.instructions !== 'string' || p.instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    return null;
  }
  if (typeof p.isActive !== 'boolean') return null;
  if (typeof p.type !== 'string' || !VALID_PROFILE_TYPES.has(p.type as ProfileType)) {
    return null;
  }
  if (!Array.isArray(p.fewShots) || p.fewShots.length > MAX_FEWSHOTS) return null;
  const fewShots: string[] = [];
  for (const shot of p.fewShots) {
    if (typeof shot !== 'string' || shot.length > MAX_FEWSHOT_LENGTH) return null;
    fewShots.push(shot);
  }

  return {
    id: p.id,
    name: p.name,
    instructions: p.instructions,
    fewShots,
    isActive: p.isActive,
    type: p.type as ProfileType,
    toneBaseline: typeof p.toneBaseline === 'number' ? p.toneBaseline : 0,
    charLimit: typeof p.charLimit === 'number' ? p.charLimit : null,
  };
}

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
  incoming: unknown[],
): Promise<{ merged: StyleProfile[]; addedCount: number; updatedCount: number }> {
  const existing = await getStyleProfiles();
  const existingById = new Map(existing.map((p) => [p.id, p]));
  const mergedById = new Map(existingById);

  let addedCount = 0;
  let updatedCount = 0;

  for (const candidate of incoming) {
    const profile = validateSyncedProfile(candidate);
    if (!profile) {
      // Drop invalid entries silently rather than rejecting the whole sync.
      console.warn('[MDR] Dropped invalid synced profile during merge');
      continue;
    }

    if (mergedById.has(profile.id)) {
      // Update existing profile with validated incoming data.
      mergedById.set(profile.id, profile);
      updatedCount += 1;
    } else {
      // New profile — append only while under the hard cap. Existing profiles
      // are never dropped by the cap; only new arrivals beyond the ceiling are
      // ignored so a flood of synced entries cannot exhaust storage.
      if (mergedById.size >= MAX_SYNCED_PROFILES) {
        console.warn('[MDR] Synced profile cap reached; skipping additional entries');
        continue;
      }
      mergedById.set(profile.id, profile);
      addedCount += 1;
    }
  }

  const merged = Array.from(mergedById.values());
  await setStyleProfiles(merged);

  return { merged, addedCount, updatedCount };
}
