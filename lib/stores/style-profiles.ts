// ---------------------------------------------------------------------------
// Style profiles store — persisted to localStorage with Zustand middleware.
// Ported from Flutter: providers/style_profile_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_PROFILES } from '../constants';
import type { StyleProfile } from '../types';

const STORAGE_KEY = 'mdr-style-profiles';

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
    }),
    {
      name: STORAGE_KEY,
      // Only persist the profiles array, not the loading flag
      partialize: (state) => ({ profiles: state.profiles }),
    },
  ),
);
