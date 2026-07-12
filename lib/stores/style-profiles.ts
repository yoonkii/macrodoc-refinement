// ---------------------------------------------------------------------------
// Style profiles store — persisted to localStorage with Zustand middleware.
// Ported from Flutter: providers/style_profile_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_PROFILES, VOICE_PACK_V1_NAMES } from '../constants';
import type { StyleProfile } from '../types';

const STORAGE_KEY = 'mdr-style-profiles';

// The standalone proofread toggle is rendered outside every reorderable group,
// so it must never participate in up/down moves. Kept in sync with the same
// constant in components/style-panel.tsx.
const PROOFREAD_ONLY_NAME = 'Proofread Only';

/** Rendered grouping used by the style panel — reorder stays within a group. */
type ProfileGroup = 'personality' | 'customLearned' | 'excluded';

/**
 * Classify a profile into the same buckets the panel renders:
 * - personality tiles (type 'personality', excluding the Proofread toggle)
 * - custom/learned tiles (type 'custom' or 'learned')
 * Everything else (platform presets, the Proofread toggle) is not reorderable.
 */
function groupOf(profile: StyleProfile): ProfileGroup {
  if (profile.name === PROOFREAD_ONLY_NAME) return 'excluded';
  if (profile.type === 'personality') return 'personality';
  if (profile.type === 'custom' || profile.type === 'learned') {
    return 'customLearned';
  }
  return 'excluded';
}

export interface StyleProfilesState {
  profiles: StyleProfile[];
  isLoading: boolean;
}

export interface StyleProfilesActions {
  addProfile: (profile: StyleProfile) => void;
  updateProfile: (updatedProfile: StyleProfile) => void;
  deleteProfile: (id: string) => void;
  toggleProfileActive: (id: string) => void;
  setProfileActive: (id: string, isActive: boolean) => void;
  reorderProfiles: (oldIndex: number, newIndex: number) => void;
  moveProfile: (id: string, direction: 'up' | 'down') => void;
}

export type StyleProfilesStore = StyleProfilesState & StyleProfilesActions;

/** Derived selector: returns only active profiles. */
export function selectActiveProfiles(state: StyleProfilesStore): StyleProfile[] {
  return state.profiles.filter((p) => p.isActive);
}

export const useStyleProfilesStore = create<StyleProfilesStore>()(
  persist(
    (set) => ({
      // ── State ──
      // DEFAULT_PROFILES serves as the initial value; persist middleware
      // will overwrite this with localStorage data on hydration.
      profiles: DEFAULT_PROFILES,
      isLoading: false,

      // ── Actions ──

      addProfile(profile: StyleProfile): void {
        const id = crypto.randomUUID();
        set((state) => ({
          profiles: [...state.profiles, { ...profile, id }],
        }));
      },

      updateProfile(updatedProfile: StyleProfile): void {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === updatedProfile.id ? updatedProfile : p,
          ),
        }));
      },

      deleteProfile(id: string): void {
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
        }));
      },

      toggleProfileActive(id: string): void {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, isActive: !p.isActive } : p,
          ),
        }));
      },

      setProfileActive(id: string, isActive: boolean): void {
        set((state) => {
          const profile = state.profiles.find((p) => p.id === id);
          if (!profile || profile.isActive === isActive) return state;
          return {
            profiles: state.profiles.map((p) =>
              p.id === id ? { ...p, isActive } : p,
            ),
          };
        });
      },

      reorderProfiles(oldIndex: number, newIndex: number): void {
        set((state) => {
          const newProfiles = [...state.profiles];
          const [removed] = newProfiles.splice(oldIndex, 1);
          // Adjust target index after removal (matches Flutter's convention)
          const adjustedIndex =
            oldIndex < newIndex ? newIndex - 1 : newIndex;
          newProfiles.splice(adjustedIndex, 0, removed);
          return { profiles: newProfiles };
        });
      },

      moveProfile(id: string, direction: 'up' | 'down'): void {
        set((state) => {
          const { profiles } = state;
          const index = profiles.findIndex((p) => p.id === id);
          if (index === -1) return state;

          const group = groupOf(profiles[index]);
          if (group === 'excluded') return state;

          // Walk toward the requested direction until we hit the nearest
          // profile in the SAME rendered group, skipping any interleaved
          // members of other groups (e.g. platform presets). This keeps the
          // reorder confined to what the panel shows as one contiguous list.
          const step = direction === 'up' ? -1 : 1;
          let neighbor = index + step;
          while (
            neighbor >= 0 &&
            neighbor < profiles.length &&
            groupOf(profiles[neighbor]) !== group
          ) {
            neighbor += step;
          }

          // No same-group neighbor in that direction — already the edge tile.
          if (neighbor < 0 || neighbor >= profiles.length) return state;

          const newProfiles = [...profiles];
          [newProfiles[index], newProfiles[neighbor]] = [
            newProfiles[neighbor],
            newProfiles[index],
          ];
          return { profiles: newProfiles };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      // Persist the profiles plus a marker recording that the v1 voice pack
      // has been merged. NOTE: `migrate` can't do this job — zustand skips it
      // entirely when the stored JSON has no numeric `version` field, which is
      // exactly the shape every pre-existing install has.
      partialize: (state) => ({ profiles: state.profiles, packV1: true }),
      version: 1,
      // Ship the voice-pack styles to EXISTING users. Persisted state
      // wholesale replaces DEFAULT_PROFILES on hydration, so new defaults
      // would otherwise only reach fresh installs. Until the `packV1` marker
      // lands in storage (on the user's next state change), the merge is
      // idempotent — additions are matched by name, so re-running it (or a
      // prior manual import of the pack) never duplicates. Once the marker is
      // persisted, deleted pack profiles stay deleted.
      merge: (persisted, current) => {
        const p = persisted as { profiles?: StyleProfile[]; packV1?: boolean } | undefined;
        if (!p || !Array.isArray(p.profiles)) return current;

        let profiles = p.profiles;
        if (!p.packV1) {
          const existingNames = new Set(profiles.map((x) => x.name));
          profiles = [
            ...profiles,
            ...DEFAULT_PROFILES.filter(
              (d) => VOICE_PACK_V1_NAMES.includes(d.name) && !existingNames.has(d.name),
            ),
          ];
        }
        return { ...current, profiles };
      },
    },
  ),
);
