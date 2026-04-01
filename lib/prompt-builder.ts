// ---------------------------------------------------------------------------
// Composable system prompt builder with layered precedence.
// Ported from Flutter: services/prompt_builder.dart
//
// Prompt structure (top to bottom):
//   1. Core rules (brief, non-competing)
//   2. Voice / personality mode
//   3. Tone direction
//   4. Custom style instructions (HIGHEST priority — "FOLLOW EXACTLY")
//   5. Platform constraints
//   6. Input text + output marker (LAST — closest to model output)
//
// Key prompt engineering principles applied:
//   - Clear section delimiters (--- SECTION ---) for structural clarity
//   - Custom style instructions framed as PRIMARY directive
//   - Few-shot examples placed immediately after their parent instructions
//   - Input text at the very end (proximity to output principle)
//   - "REFINED TEXT" marker signals the model to start generating
//   - Drastically shorter base rules to avoid competing with user styles
// ---------------------------------------------------------------------------

import { TONE_TIERS } from './constants';
import type { StyleProfile, ToneTier } from './types';

// ── Pure functions ──────────────────────────────────────────────────────────

/** Snap a continuous float to the nearest discrete tier value. */
export function snapToTier(value: number): number {
  const tierValues = [...TONE_TIERS.keys()].sort((a, b) => a - b);
  let closest = tierValues[0];
  let minDistance = Math.abs(value - closest);

  for (const tier of tierValues) {
    const distance = Math.abs(value - tier);
    if (distance < minDistance) {
      minDistance = distance;
      closest = tier;
    }
  }
  return closest;
}

/** Human-readable label for the current tone tier. */
export function tierLabel(toneValue: number): string {
  const snapped = snapToTier(toneValue);
  const tier = TONE_TIERS.get(snapped) as ToneTier;
  return tier.label;
}

// ── Refinement prompt ───────────────────────────────────────────────────────

export interface RefinementPromptParams {
  inputText: string;
  activeProfiles: StyleProfile[];
  toneValue?: number;
  platformPreset?: StyleProfile | null;
  personalityMode?: StyleProfile | null;
  voiceCharacteristics?: string | null;
}

/**
 * Build the full refinement prompt with clear section delimiters
 * and optimized instruction ordering for maximum style influence.
 */
export function buildRefinementPrompt(params: RefinementPromptParams): string {
  const {
    inputText,
    activeProfiles,
    toneValue = 0.0,
    platformPreset = null,
    personalityMode = null,
    voiceCharacteristics = null,
  } = params;

  const parts: string[] = [];

  // 1. Core rules (brief, non-competing with user styles)
  parts.push(`You are a writing assistant. Rules:
- Respond in the SAME LANGUAGE as the input
- Maintain the original meaning — do not add new information
- Return ONLY the refined text — no explanations, no commentary
- Do not comment on or critique the input text
- Blend ALL active styles into ONE single unified text — never produce separate versions or paragraphs per style
- When multiple styles are active, fuse their qualities naturally into one cohesive voice`);

  // 2. Learned voice characteristics (lowest priority layer)
  if (voiceCharacteristics) {
    parts.push(`\n--- VOICE CHARACTERISTICS ---\nMatch this writing style:\n${voiceCharacteristics}`);
  }

  // 3. Personality mode — framed as primary voice
  if (personalityMode) {
    parts.push(`\n--- VOICE ---\nAdopt this voice and style:\n${personalityMode.instructions}`);
    if (personalityMode.fewShots.length > 0) {
      parts.push('\nVoice examples:');
      for (const shot of personalityMode.fewShots) {
        parts.push(`  ${shot}`);
      }
    }
  }

  // 4. Tone direction
  const tier = snapToTier(toneValue);
  const toneTier = TONE_TIERS.get(tier) as ToneTier;
  parts.push(`\n--- TONE ---\n${toneTier.prompt}`);

  // 5. Custom style profiles — these get HIGHEST priority
  const customProfiles = activeProfiles.filter((p) => {
    if (platformPreset && p.id === platformPreset.id) return false;
    if (personalityMode && p.id === personalityMode.id) return false;
    return true;
  });

  if (customProfiles.length > 0) {
    parts.push('\n--- STYLE INSTRUCTIONS (FOLLOW EXACTLY) ---');
    for (const profile of customProfiles) {
      parts.push(`\n[${profile.name}]: ${profile.instructions}`);
      if (profile.fewShots.length > 0) {
        parts.push('Examples to follow:');
        for (const shot of profile.fewShots) {
          parts.push(`  ${shot}`);
        }
      }
    }
  }

  // 6. Platform constraints (if any)
  if (platformPreset) {
    parts.push(`\n--- PLATFORM: ${platformPreset.name} ---`);
    parts.push(platformPreset.instructions);
    if (platformPreset.charLimit != null) {
      parts.push(`Maximum length: ${platformPreset.charLimit} characters.`);
    }
    if (platformPreset.fewShots.length > 0) {
      parts.push('Platform examples:');
      for (const shot of platformPreset.fewShots) {
        parts.push(`  ${shot}`);
      }
    }
  }

  // 7. Input text (LAST — closest to model output for proximity principle)
  parts.push(`\n--- TEXT TO REFINE ---\n${inputText}\n\n--- REFINED TEXT ---`);

  return parts.join('\n');
}

// ── Multi-post prompt ───────────────────────────────────────────────────────

export interface MultiPostPromptParams {
  inputText: string;
  activeProfiles: StyleProfile[];
  toneValue: number;
}

/**
 * Build a prompt that asks the model to produce all 4 platform versions
 * simultaneously, returning structured JSON.
 */
export function buildMultiPostPrompt(params: MultiPostPromptParams): string {
  const { inputText, activeProfiles, toneValue } = params;

  const parts: string[] = [];

  // 1. Core rules (brief)
  parts.push(`You are a writing assistant. Rules:
- Respond in the SAME LANGUAGE as the input
- Do not add information that was not in the original text
- Stay grounded in the source material — do not hallucinate
- Return ONLY valid JSON with keys: linkedin, x, instagram, substack`);

  // 2. Tone direction
  const snappedTone = snapToTier(toneValue);
  const toneTier = TONE_TIERS.get(snappedTone) as ToneTier;
  parts.push(`\n--- TONE ---\n${toneTier.prompt}`);

  // 3. Personality modes
  const personalityModes = activeProfiles.filter(
    (p) => p.type === 'personality',
  );
  if (personalityModes.length > 0) {
    parts.push('\n--- VOICE ---');
    for (const mode of personalityModes) {
      parts.push(`[${mode.name}]: ${mode.instructions}`);
      if (mode.fewShots.length > 0) {
        parts.push('Voice examples:');
        for (const shot of mode.fewShots) {
          parts.push(`  ${shot}`);
        }
      }
    }
  }

  // 4. Custom profiles — highest priority
  const customProfiles = activeProfiles.filter((p) => p.type === 'custom');
  if (customProfiles.length > 0) {
    parts.push('\n--- STYLE INSTRUCTIONS (FOLLOW EXACTLY) ---');
    for (const profile of customProfiles) {
      parts.push(`[${profile.name}]: ${profile.instructions}`);
      if (profile.fewShots.length > 0) {
        parts.push('Examples to follow:');
        for (const shot of profile.fewShots) {
          parts.push(`  ${shot}`);
        }
      }
    }
  }

  // 5. Platform-specific instructions
  parts.push(`\n--- PLATFORM INSTRUCTIONS ---

1. **linkedin** (max 1300 characters):
   Professional tone. Lead with a strong hook on the first line. Use line breaks between paragraphs for readability. Include relevant hashtags at the end (3-5). Frame insights as thought leadership. Be substantive, not fluffy.

2. **x** (max 280 characters):
   Concise and punchy. Use short sentences or fragments. Capture the core message in one compelling tweet. Include 1-2 hashtags only if space allows. No filler words.

3. **instagram** (max 2200 characters):
   Caption style — warm, relatable, personal. Lead with a hook or personal statement. Keep paragraphs short (1-2 sentences). Use emoji sparingly for emphasis. End with a call to action or question. Add a block of 5-10 hashtags at the very end.

4. **substack** (max 5000 characters):
   Long-form newsletter tone. Use section headers (##). Write in an intimate, conversational voice as if writing directly to subscribers. Develop ideas fully with examples and reflections. Include a sign-off.`);

  // 6. Input text (LAST — closest to model output)
  parts.push(`\n--- TEXT TO REFINE ---\n${inputText}\n\n--- JSON OUTPUT ---`);

  return parts.join('\n');
}
