// ---------------------------------------------------------------------------
// Tone slider store — manages the -1.0 to +1.0 tone value.
// Ported from Flutter: providers/tone_provider.dart
// ---------------------------------------------------------------------------

import { create } from 'zustand';

import { tierLabel } from '../prompt-builder';

export interface ToneState {
  toneValue: number;
}

export interface ToneActions {
  setTone: (value: number) => void;
}

export type ToneStore = ToneState & ToneActions;

/** Derived selector: human-readable tier label for the current value. */
export function selectCurrentTierLabel(state: ToneStore): string {
  return tierLabel(state.toneValue);
}

export const useToneStore = create<ToneStore>((set, get) => ({
  // ── State ──
  toneValue: 0,

  // ── Actions ──
  setTone(value: number): void {
    const clamped = Math.max(-1.0, Math.min(1.0, value));
    if (get().toneValue === clamped) return;
    set({ toneValue: clamped });
  },
}));
