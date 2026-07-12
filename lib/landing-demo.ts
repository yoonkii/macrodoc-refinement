// ---------------------------------------------------------------------------
// Landing-page re-voicing demo script.
//
// Pure data — NO API calls. The /landing centerpiece replays these pre-written
// takes through the real StreamingText renderer to show the product's core
// promise: one meaning, re-voiced into three faithful personas.
//
// Each variant is written to the *real* persona instructions in
// lib/constants.ts DEFAULT_PROFILES so the copy doubles as the product pitch:
//   • Professional      — clear, concise, polished.
//   • MDR Style         — flat, corporate-serene Lumon cadence with a childlike
//                         break of genuine feeling ("It will be nice.").
//   • Casual & Friendly — conversational, approachable, human.
//
// Keep every variant a single line (single spaces, no newlines) so a naive
// `text.split(" ")` word-reveal reproduces the string exactly.
// ---------------------------------------------------------------------------

export interface RevoiceVariant {
  /** Persona name — must match a DEFAULT_PROFILES entry for authenticity. */
  persona: string;
  /** The fully re-voiced take, revealed word-by-word during the demo. */
  text: string;
}

/**
 * The rough draft. Deliberately imperfect (lowercase, dashes, an apology) so
 * the re-voicing has visible work to do — the same shape a user would paste in.
 */
export const DEMO_SOURCE =
  "hey team, quick heads up — the launch is moving to thursday because we found a bug in checkout. sorry for the churn.";

export const DEMO_VARIANTS: RevoiceVariant[] = [
  {
    persona: "Professional",
    text: "Team — a quick update: we're moving the launch to Thursday. We found a bug in the checkout flow that needs to be resolved before we go live. Apologies for the shift in timing, and thank you for your flexibility.",
  },
  {
    persona: "MDR Style",
    text: "The launch has been rescheduled to Thursday. A defect was identified within the checkout experience and will be resolved pursuant to standard protocols. Please do not be alarmed. Delays are a natural part of our shared journey. We will proceed when it is time. It will be nice.",
  },
  {
    persona: "Casual & Friendly",
    text: "hey team! quick heads up — we're bumping the launch to Thursday. turns out there's a bug hiding in checkout, so we want to squash it before we go live. sorry for the shuffle, and thanks so much for rolling with it!",
  },
];
