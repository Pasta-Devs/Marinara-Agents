/**
 * How harsh the audience is allowed to be.
 *
 * Pure, like the other Slurp rule modules.
 *
 * Spice and tone are different axes and were being confused. `generationGuidance` and its three
 * presets govern how explicit a Creator's own posts are; none of them says anything about whether
 * the *audience* is kind. So the crowd was uniformly warm, and a world where nobody is ever cool
 * toward you has no stakes: praise from a room that only praises is worth nothing.
 *
 * The dial defaults to the middle. The maintainer wants the full range available, but this package
 * ships to other people and a hostile default would ambush somebody who wanted a relaxed session.
 * Moving it up is one tap; being ambushed is not recoverable.
 */

export const SLURP_AUDIENCE_TONES = ["warm", "mixed", "unfiltered"] as const;

export type SlurpAudienceTone = (typeof SLURP_AUDIENCE_TONES)[number];

export const SLURP_DEFAULT_AUDIENCE_TONE: SlurpAudienceTone = "mixed";

const TONE_INSTRUCTIONS: Record<SlurpAudienceTone, string> = {
  warm: "The audience is kind. Nobody is cruel, dismissive, or critical. People who lose interest simply go quiet rather than saying anything unkind.",
  mixed:
    "The audience is mostly supportive but honest. Blunt reactions, mild disappointment, and people saying a post did not land for them all happen, and are said plainly rather than cruelly. Nobody is abusive.",
  unfiltered:
    "The audience is a real crowd and not a fan club. Alongside the supportive majority there are critics, people who complain about the price, people who liked the older work better, and people who unsubscribe loudly. Keep it in character and never abusive, but do not soften a reaction that would honestly be cold.",
};

export function slurpAudienceToneInstruction(tone: SlurpAudienceTone | undefined): string {
  return TONE_INSTRUCTIONS[tone ?? SLURP_DEFAULT_AUDIENCE_TONE];
}

/** Read a stored value back, falling back rather than throwing on anything unexpected. */
export function readSlurpAudienceTone(value: unknown): SlurpAudienceTone {
  return SLURP_AUDIENCE_TONES.includes(value as SlurpAudienceTone)
    ? (value as SlurpAudienceTone)
    : SLURP_DEFAULT_AUDIENCE_TONE;
}
