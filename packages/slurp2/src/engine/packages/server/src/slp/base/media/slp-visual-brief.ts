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
};

/** The typed visual contract between post planning and image prompt writing. */
export function slurpVisualBriefText(brief: SlurpVisualBrief): string {
  return [
    `Subject: ${brief.subject}.`,
    `Action: ${brief.action}.`,
    `Setting: ${brief.setting}.`,
    `Company: ${brief.company}.`,
    brief.clothing ? `Clothing: ${brief.clothing}.` : "",
    `Camera: ${brief.camera}`,
    brief.mood ? `Mood and production effort: ${brief.mood}.` : "",
    `Sexual level: ${brief.sexualLevel}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Rules that let a renderer add wording without changing the planned visual scene. */
export function slurpVisualBriefPolicyText(brief: SlurpVisualBrief): string {
  return [
    `The visual brief is authoritative: preserve its subject, action, setting, company, clothing, camera, and sexual level (${brief.sexualLevel}).`,
    "Style and appearance may add detail, but they may not add a new event, person, outfit, viewpoint, nudity, explicit anatomy, or sexual activity.",
    // The camera block already forbids this, but the rewrite is free to rephrase the camera block
    // and regularly drops the clause while keeping the sentence. The company is a scene fact the
    // rewrite is told to preserve, so the same rule stated against the company survives.
    `Only the people named in Company are in the picture (${brief.company}). No first-person or point-of-view framing, and no hands, limbs, or anatomy belonging to anyone the company does not name.`,
    brief.sexualLevel === "none"
      ? "This scene is non-sexual. Do not add suggestive, nude, or explicit emphasis."
      : `Do not raise the sexual level above ${brief.sexualLevel}.`,
  ].join("\n");
}

/** A cheap last-resort check for obvious sexual escalation before text reaches an image provider. */
export function slurpVisualBriefPromptViolatesPolicy(brief: SlurpVisualBrief, prompt: string): boolean {
  const value = prompt.toLocaleLowerCase();
  const explicit = /\b(?:explicit|pornographic|sex|sexual|intercourse|penetration|cum|clit|pussy|cock|balls)\b/u;
  const nude = /\b(?:nude|naked|topless|bottomless|lingerie|nipples?|breasts?|genitals?)\b/u;
  if (brief.sexualLevel === "none") return explicit.test(value) || nude.test(value);
  if (brief.sexualLevel === "suggestive") return explicit.test(value) || nude.test(value);
  if (brief.sexualLevel === "nudity") return explicit.test(value);
  return false;
}
