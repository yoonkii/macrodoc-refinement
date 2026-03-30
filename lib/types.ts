// ---------------------------------------------------------------------------
// Core domain types for MacroDocRefinement
// Ported from Flutter: models/style_profile.dart, providers/tone_provider.dart
// ---------------------------------------------------------------------------

/** Profile type categorization for organising presets in the UI. */
export type ProfileType = 'platform' | 'personality' | 'custom' | 'learned';

/** Platform identifiers used as map keys in the multi-post feature. */
export type PlatformKey = 'linkedin' | 'x' | 'instagram' | 'substack';

export const PLATFORM_KEYS: readonly PlatformKey[] = [
  'linkedin',
  'x',
  'instagram',
  'substack',
] as const;

/**
 * A style profile defines how the AI should transform user text.
 *
 * - platform:    destination-specific presets (LinkedIn, X, Instagram, Substack)
 * - personality: voice/tone presets (MDR Style, Professional, Casual, Academic)
 * - custom:      user-created profiles
 * - learned:     auto-generated from writing samples (Phase 5)
 */
export interface StyleProfile {
  id: string;
  name: string;
  instructions: string;
  fewShots: string[];
  isActive: boolean;
  type: ProfileType;
  toneBaseline: number;
  charLimit: number | null;
}

/** A discrete tone tier mapping a slider position to a prompt fragment. */
export interface ToneTier {
  label: string;
  prompt: string;
}

/** Metadata for a social platform tab/card in the multi-post UI. */
export interface PlatformMeta {
  label: string;
  /** Lucide icon name (e.g. 'linkedin', 'twitter'). */
  iconName: string;
  /** Brand hex colour. */
  color: string;
  charLimit: number;
}
