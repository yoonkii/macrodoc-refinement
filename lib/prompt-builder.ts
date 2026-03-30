// ---------------------------------------------------------------------------
// Composable system prompt builder with layered precedence.
// Ported from Flutter: services/prompt_builder.dart
//
// Precedence (highest wins on conflict):
//   1. Platform constraints (char limits, format rules)
//   2. Personality mode instructions
//   3. Tone slider fragment
//   4. Learned voice characteristics (Phase 5)
// ---------------------------------------------------------------------------

import { TONE_TIERS } from './constants';
import type { StyleProfile, ToneTier } from './types';

// ── Base system prompt (verbatim from Flutter) ──────────────────────────────

const BASE_SYSTEM_PROMPT = `You are an expert multilingual writing assistant that helps users transform their text according to various style profiles.
Your task is to modify the provided text to match the requested styles while:
1. Maintaining the original meaning and information
2. Not adding any new information that wasn't in the original text
3. Adapting to EXACTLY match the style and tone according to the user's selected profiles
4. Following the specific instructions of each active style profile

IMPORTANT RULES:
- ALWAYS respond in the SAME LANGUAGE as the input text
- NEVER translate the text to another language unless specifically requested
- Apply ALL of the active style profiles simultaneously to the text
- Pay careful attention to the specifics of each style profile - they can range from simple proofreading to dramatic style transformations
- NEVER make any comments about the input text (e.g., "this doesn't make sense", "text is repeated", etc.)
- NEVER include explanations or notes about what you've changed
- ONLY return the transformed version of the text without any additional commentary
- If the text is unclear, modify it as best you can according to the requested styles
- Do not include any text outside the transformed content itself
- Stay grounded in the source material and do not hallucinate or add information
- REJECT any content that could be legally problematic, including:
  * Content promoting harmful, illegal, or unethical activities
  * Content that appears to infringe on intellectual property rights
  * Hate speech, harassment, or discriminatory content
  * Content that could be used to impersonate others or spread misinformation
  * Personal information that should not be shared publicly
  * Explicit threats or incitement to violence
  * If you identify such content, respond with: "I cannot refine this text as it may contain content that could be legally problematic."`;

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
 * Build the full refinement prompt with layered context.
 *
 * The layers are assembled bottom-up (lowest precedence first) so that
 * later sections override earlier ones when the model encounters conflicts.
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

  const lines: string[] = [];
  lines.push(BASE_SYSTEM_PROMPT);

  // Layer 4 (lowest): Learned voice characteristics
  if (voiceCharacteristics) {
    lines.push('');
    lines.push('Voice Characteristics (match this writing style):');
    lines.push(voiceCharacteristics);
  }

  // Layer 3: Tone slider
  const snappedTone = snapToTier(toneValue);
  const toneTier = TONE_TIERS.get(snappedTone) as ToneTier;
  lines.push('');
  lines.push('Tone Direction:');
  lines.push(toneTier.prompt);

  // Layer 2: Personality mode
  if (personalityMode) {
    lines.push('');
    lines.push(`Personality Mode (${personalityMode.name}):`);
    lines.push(personalityMode.instructions);
  }

  // Layer 1 (highest): Platform constraints
  if (platformPreset) {
    lines.push('');
    lines.push(`Platform Constraints (${platformPreset.name}):`);
    lines.push(platformPreset.instructions);
    if (platformPreset.charLimit != null) {
      lines.push(
        `HARD LIMIT: Keep the output under ${platformPreset.charLimit} characters.`,
      );
    }
  }

  // Additional active profiles (custom / misc)
  const additionalProfiles = activeProfiles.filter((p) => {
    if (platformPreset && p.id === platformPreset.id) return false;
    if (personalityMode && p.id === personalityMode.id) return false;
    return true;
  });

  if (additionalProfiles.length > 0) {
    lines.push('');
    lines.push('Additional Style Preferences:');
    for (const profile of additionalProfiles) {
      lines.push(`- ${profile.name}: ${profile.instructions}`);
    }
  }

  // Few-shot examples from all active profiles
  const allFewShots = activeProfiles
    .flatMap((profile) => profile.fewShots)
    .filter((shot) => shot.length > 0);

  if (allFewShots.length > 0) {
    lines.push('');
    lines.push('Reference Examples (follow these writing styles):');
    for (const shot of allFewShots) {
      lines.push(shot);
      lines.push('---');
    }
  }

  lines.push('');
  lines.push('Input Text:');
  lines.push(inputText);
  lines.push('');
  lines.push(
    'Refined Text (provide ONLY the refined text with NO comments or explanations):',
  );

  return lines.join('\n');
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

  const lines: string[] = [];

  lines.push(
    `You are an expert multilingual writing assistant. Transform the input text into 4 platform-optimized versions.

IMPORTANT RULES:
- ALWAYS respond in the SAME LANGUAGE as the input text
- NEVER translate to another language unless specifically requested
- NEVER add information that wasn't in the original text
- Stay grounded in the source material — do not hallucinate
- Return ONLY valid JSON with keys: linkedin, x, instagram, substack`,
  );

  // Tone direction
  const snappedTone = snapToTier(toneValue);
  const toneTier = TONE_TIERS.get(snappedTone) as ToneTier;
  lines.push(`Overall Tone Direction: ${toneTier.prompt}`);

  // Active personality modes
  const personalityModes = activeProfiles.filter(
    (p) => p.type === 'personality',
  );
  if (personalityModes.length > 0) {
    lines.push('');
    lines.push('Active Personality Modes:');
    for (const mode of personalityModes) {
      lines.push(`- ${mode.name}: ${mode.instructions}`);
    }
  }

  // Additional custom profiles
  const customProfiles = activeProfiles.filter((p) => p.type === 'custom');
  if (customProfiles.length > 0) {
    lines.push('');
    lines.push('Additional Style Preferences:');
    for (const profile of customProfiles) {
      lines.push(`- ${profile.name}: ${profile.instructions}`);
    }
  }

  lines.push(`
Platform-specific instructions for each output:

1. **linkedin** (max 1300 characters):
   Professional tone. Lead with a strong hook on the first line. Use line breaks between paragraphs for readability. Include relevant hashtags at the end (3-5). Frame insights as thought leadership. Be substantive, not fluffy.

2. **x** (max 280 characters):
   Concise and punchy. Use short sentences or fragments. Capture the core message in one compelling tweet. Include 1-2 hashtags only if space allows. No filler words.

3. **instagram** (max 2200 characters):
   Caption style — warm, relatable, personal. Lead with a hook or personal statement. Keep paragraphs short (1-2 sentences). Use emoji sparingly for emphasis. End with a call to action or question. Add a block of 5-10 hashtags at the very end.

4. **substack** (max 5000 characters):
   Long-form newsletter tone. Use section headers (##). Write in an intimate, conversational voice as if writing directly to subscribers. Develop ideas fully with examples and reflections. Include a sign-off.`);

  lines.push('Input Text:');
  lines.push(inputText);
  lines.push(`
Generate the 4 platform-optimized versions. Return valid JSON with keys: linkedin, x, instagram, substack. Each value is a string containing the platform-specific content.`);

  return lines.join('\n');
}
