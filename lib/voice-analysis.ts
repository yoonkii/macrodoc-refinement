// ---------------------------------------------------------------------------
// Voice analysis — pure, client-side helpers for the "Clone My Voice" flow.
//
// Two responsibilities, both LLM-free except where noted:
//   1. buildVoiceAnalysisPrompt — assembles the meta-prompt sent to the model
//      so it returns a compact set of imperative voice instructions.
//   2. selectExcerpts — heuristically picks 2–3 representative fragments from
//      the samples to seed the learned profile's few-shot examples. No LLM.
// ---------------------------------------------------------------------------

/**
 * Excerpt-length window. Fragments shorter than MIN read as stubs; fragments
 * longer than MAX bloat the prompt and stop being a crisp "voice sample".
 */
const EXCERPT_MIN_CHARS = 80;
const EXCERPT_MAX_CHARS = 240;

/** Target number of few-shot excerpts to surface. */
const MAX_EXCERPTS = 3;

/**
 * Split a single sample into sentence / paragraph fragments.
 *
 * We break on blank-line boundaries first (paragraphs), then on sentence
 * terminators — including CJK full-stop/exclamation/question marks — so the
 * heuristic works across the languages the app targets.
 */
function splitFragments(sample: string): string[] {
  return sample
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?。！？…])\s+/))
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);
}

/**
 * Pick 2–3 representative excerpts to become the learned profile's fewShots.
 *
 * Strategy:
 *   1. Prefer complete fragments in the [80, 240] char window.
 *   2. Draw from *different* samples first for variety, then backfill.
 *   3. If nothing lands in the ideal window (e.g. terse one-liners), fall back
 *      to trimmed/truncated whole samples so we never return an empty list.
 */
export function selectExcerpts(samples: string[]): string[] {
  const cleanedSamples = samples
    .map((sample) => sample.trim())
    .filter((sample) => sample.length > 0);

  if (cleanedSamples.length === 0) return [];

  const fragmentsPerSample: string[][] = cleanedSamples.map((sample) =>
    splitFragments(sample).filter(
      (fragment) =>
        fragment.length >= EXCERPT_MIN_CHARS &&
        fragment.length <= EXCERPT_MAX_CHARS,
    ),
  );

  const picked: string[] = [];

  // First pass: one ideal fragment from each distinct sample (variety).
  for (const fragments of fragmentsPerSample) {
    if (picked.length >= MAX_EXCERPTS) break;
    const candidate = fragments.find((fragment) => !picked.includes(fragment));
    if (candidate) picked.push(candidate);
  }

  // Second pass: backfill from any sample if we still have room.
  if (picked.length < MAX_EXCERPTS) {
    for (const fragments of fragmentsPerSample) {
      for (const fragment of fragments) {
        if (picked.length >= MAX_EXCERPTS) break;
        if (!picked.includes(fragment)) picked.push(fragment);
      }
      if (picked.length >= MAX_EXCERPTS) break;
    }
  }

  // Fallback: no fragment fit the ideal window — use trimmed whole samples so
  // the profile still gets at least one concrete example to anchor on.
  if (picked.length === 0) {
    for (const sample of cleanedSamples) {
      if (picked.length >= 2) break;
      picked.push(
        sample.length > EXCERPT_MAX_CHARS
          ? sample.slice(0, EXCERPT_MAX_CHARS).trim()
          : sample,
      );
    }
  }

  return picked;
}

/**
 * Build the meta-prompt that turns raw writing samples into a compact,
 * imperative voice profile. The model is instructed to respond in the same
 * language as the samples and to emit ONLY the instructions (no preamble).
 */
export function buildVoiceAnalysisPrompt(samples: string[]): string {
  const cleanedSamples = samples
    .map((sample) => sample.trim())
    .filter((sample) => sample.length > 0);

  const sampleBlock = cleanedSamples
    .map((sample, index) => `[Sample ${index + 1}]\n${sample}`)
    .join('\n\n');

  return `You are a writing-voice analyst.

Below are one or more writing samples that a person wrote themselves. Study them closely and produce a compact voice profile: a set of direct, imperative style instructions another writer — or an AI — could follow to sound exactly like this person.

Cover, wherever the samples reveal it:
- Sentence length and rhythm (short and punchy, long and winding, deliberately varied)
- Vocabulary and register (plain, technical, formal, slangy, playful)
- Punctuation and formatting habits (em dashes, ellipses, line breaks, lists, capitalization)
- Tone and attitude (warm, dry, blunt, earnest, ironic)
- Distinctive tics, favorite words, or recurring phrases
- Emoji and emoticon usage (which ones, how often, or never)
- The language(s) used — write every instruction in that same language

Rules:
- Write the profile as direct instructions: "Write with…", "Prefer…", "Avoid…", "Keep…".
- Keep the whole profile under 1,200 characters. Be specific and observed, never generic.
- Output ONLY the instructions. No preamble, no headings, no explanation, no quoting the samples back.

--- WRITING SAMPLES ---
${sampleBlock}

--- VOICE PROFILE (instructions only) ---`;
}
