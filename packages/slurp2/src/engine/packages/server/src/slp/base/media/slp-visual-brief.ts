export const SLURP_VISUAL_SEXUAL_LEVELS = ["none", "suggestive", "nudity", "explicit"] as const;
export type SlurpVisualSexualLevel = (typeof SLURP_VISUAL_SEXUAL_LEVELS)[number];

export type SlurpVisualBrief = {
  subject: string;
  action: string;
  setting: string;
  company: string;
  clothing: string | null;
  camera: string;
  mood: string | null;
  sexualLevel: SlurpVisualSexualLevel;
  /** The post writer's name for a known character ("fubuki (one punch man)"); not part of the text. */
  knownAs?: string;
};

/** The typed visual contract between post planning and image prompt writing. */
export function slurpVisualBriefText(brief: SlurpVisualBrief): string {
  return [
    `Subject: ${brief.subject}.`,
    `Action: ${brief.action}.`,
    brief.mood ? `Mood and production effort: ${brief.mood}.` : "",
    `Setting: ${brief.setting}.`,
    `Company: ${brief.company}.`,
    brief.clothing ? `Clothing: ${brief.clothing}.` : "",
    `Viewpoint: ${brief.camera}`,
    `Sexual level: ${brief.sexualLevel}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Rules that let a renderer add wording without changing the planned visual scene. */
export function slurpVisualBriefPolicyText(brief: SlurpVisualBrief): string {
  return [
    `The visual brief is authoritative: preserve its subject, action, setting, company, clothing, viewpoint, and sexual level (${brief.sexualLevel}).`,
    "Style and appearance may add detail, but they may not add a new event, person, outfit, viewpoint, nudity, explicit anatomy, or sexual activity.",
    // The viewpoint block already forbids this, but the rewrite is free to rephrase the viewpoint block
    // and regularly drops the clause while keeping the sentence. The company is a scene fact the
    // rewrite is told to preserve, so the same rule stated against the company survives.
    `Only the people named in Company are in the picture (${brief.company}). No first-person or point-of-view framing, and no hands, limbs, or anatomy belonging to anyone the company does not name.`,
    brief.sexualLevel === "none"
      ? "This scene is non-sexual. Do not add suggestive, nude, or explicit emphasis."
      : `Do not raise the sexual level above ${brief.sexualLevel}.`,
  ].join("\n");
}

const NEGATED_TERM = /\b(?:no|non|not|without|never)[\s-]+[a-z]+/gu;
// A limit in the handed text ("not a nude portrait") reaches over a few words, so it is cut wider.
const NEGATED_LIMIT = /\b(?:no|non|not|without|never)\b(?:[\s-]+[a-z]+){1,3}/gu;

/**
 * A cheap last-resort check for sexual escalation before text reaches an image provider. `known` is
 * the scene's own facts the rewrite was handed (the card's appearance and the draft): a word the
 * rewrite found there is carried over, not escalated. Without it a card that says "large breasts"
 * rejected every rewrite of a clothed scene. Limits in `known` ("no nudity") are not carried.
 */
export function slurpVisualBriefPromptViolatesPolicy(
  brief: SlurpVisualBrief | undefined,
  prompt: string | null | undefined,
  known: string = "",
): boolean {
  if (!brief || !prompt) return false;
  // Negated terms are the brief's own limits ("no nudity, non-sexual"), not an escalation. Reading
  // them as matches rejected every rewrite that kept the level line.
  const value = prompt.toLocaleLowerCase().replace(NEGATED_TERM, " ");
  const carried = new Set(
    known
      .toLocaleLowerCase()
      .replace(NEGATED_LIMIT, " ")
      .match(/[a-z]+/gu),
  );
  const has = (pattern: RegExp) => (value.match(new RegExp(pattern.source, "gu")) ?? []).some((w) => !carried.has(w));
  const explicit = /\b(?:explicit|pornographic|sex|sexual|intercourse|penetration|cum|clit|pussy|cock|balls)\b/u;
  const nude = /\b(?:nude|naked|topless|bottomless|lingerie|nipples?|breasts?|genitals?)\b/u;
  if (brief.sexualLevel === "none") return has(explicit) || has(nude);
  // Suggestive allows "partly undressed", so lingerie and a mention of breasts are within it.
  if (brief.sexualLevel === "suggestive")
    return has(explicit) || has(/\b(?:nude|naked|topless|bottomless|nipples?|genitals?)\b/u);
  if (brief.sexualLevel === "nudity") return has(explicit);
  return false;
}
