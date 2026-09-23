// Pure Backstage formatting, presets and vocabulary, split out of
// components/slurp/SlurpBackstageWorkflow.tsx in Slice 10. No feature import, so every feature
// may read it without a contract.

import { cn } from "../../../lib/utils";
import { SLURP_ROW_ACTIVE_CLASS, SLURP_ROW_CLASS } from "../../base/chrome/SlpChrome";
import { SLURP_SETTINGS_SECTIONS } from "../../base/navigation/slp-navigation.types";

export const settingsSections = SLURP_SETTINGS_SECTIONS;
// Three shipped spice levels. Kept byte-identical to the server presets so the settings surface
// can tell which level is active and restore one exactly.
export const SLURP_GUIDANCE_PRESETS = {
  mild: "All Slurp creators and viewers are adults (18+). This is an adult creator page, but a restrained one: posts are flirty, teasing, and suggestive rather than graphic. Innuendo, charm, and anticipation do the work, and locked posts are teased instead of described. Do not write explicit sexual detail. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one flirts bluntly. Ordinary posts about their day, work, and mood stay just as important as the flirty ones.",
  steamy:
    "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normally sexually suggestive to outright NSFW. Creators will use Slurp to often excite their readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material. When a post is explicit or shows nudity, always use thorough, graphic, horny descriptions. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact.",
  explicit:
    "All Slurp creators and viewers are adults (18+). This is an explicit adult creator page. Sexual content is the norm here rather than the exception, and creators describe it directly and in detail when it suits them. Tease the locked posts hard and answer flirty comments in kind. Always use thorough, graphic, horny descriptions for nudity and sex. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact: a shy creator is explicit shyly, a blunt one is explicit bluntly. Ordinary posts about their day, work, and mood still appear and keep the feed believable.",
} as const;
export const SLURP_GUIDANCE_LEVELS = ["mild", "steamy", "explicit"] as const;

/**
 * Shipped instruction sets for the image prompt rewrite. `default` is byte-identical to the server
 * default so the surface can tell which one is active; `danbooru` is an experimental set for
 * tag-driven anime models, which want the style block first and the appearance tags right after it.
 */
export const SLURP_IMAGE_INTERPRETATION_PRESETS = {
  default:
    "Edit this image prompt into a concise provider-ready image prompt. Preserve the original subject, action, setting, clothing, composition, visual style, and sexual intensity. Preserve explicit style from the original prompt, character context, image instructions, or style guidance. Do not add a new event, person, pose, outfit, viewpoint, nudity, explicit anatomy, or sexual activity. Do not turn an ordinary update into a fashion shoot or erotic image. Do not add realistic, photographic, camera, lens, or natural-lighting language unless the supplied context requests it. Do not convert a stylized character into a realistic image. Treat image instructions as guidance, not text to copy. Return only the provider-ready image prompt.",
  danbooru:
    'You are the final prompt editor for a Danbooru-tag-driven anime image model. Rewrite the supplied draft into ONE provider-ready image prompt. MANDATORY STRUCTURE (do not change this order): 1. Keep the leading quality/style tag block exactly as it appears: every tag, same order, verbatim. Never add, remove, reword, or reorder quality, score, safety (safe/sensitive/nsfw/explicit), resolution, or @artist tags - they belong to the user\'s style profile. 2. Immediately after it, place the character\'s appearance tags VERBATIM from the supplied character context or appearance notes: copy them word for word, lowercase, comma-separated, spaces instead of underscores, score tags keep their underscore. Never re-describe them as prose, never paraphrase, never rename or drop one, and never repeat them later in the prompt. 3. Then the scene as lowercase comma-separated tags: outfit, pose, expression, action, setting, lighting, camera, mood. 4. If a detail has no usable tag (rare props, vistas, layered outfits), add one short lowercase clause at the very end. FORBIDDEN: Never emit labels or headings such as "Character appearance notes:", "X\'s Appearance:", "Appearance:", "Style:", or any field name. Those are instructions to you, not image content. Do not add any safety token of your own; the leading block already declares the content level. Do not add realistic, photorealistic, photographic, camera, lens, or natural-lighting language unless the supplied context clearly requests that style, and never convert an anime, cartoon, game, manga, comic, illustration, painterly, fantasy, or stylized character into a realistic image. Do not invent an art style when none is specified; keep the prompt style-neutral. Do not duplicate hair, clothing, or appearance tags anywhere in the prompt. No captions, dialogue text, UI, watermarks, logos, signatures, speech bubbles, or meta instructions. CONTENT: follow the supplied post mood and image instructions. When the scene shows nudity or sex, keep thorough, graphic body language and dirty everyday words (tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking); never replace them with clinical or euphemistic wording. Treat the supplied image instructions as guidance about intent, not as text to copy into the result. Write the prompt as one comma-separated line of lowercase tags, with no headings and no explanations.',
} as const;
export const SLURP_IMAGE_INTERPRETATION_STYLES = ["default", "danbooru"] as const;
export const DEFAULT_SLURP_GENERATION_GUIDANCE: string = SLURP_GUIDANCE_PRESETS.steamy;
export const DEFAULT_SLURP_IMAGE_GENERATION_PROMPT =
  "Create a provider-ready image prompt for the supplied adult Creator post. Preserve the post's subject, action, setting, mood, clothing, and established appearance. Use the Creator's personality to shape expression and presentation, not to invent a new event or sexualize an ordinary moment. Add nudity, explicit anatomy, or sexual activity only when the post or an explicit trusted instruction already requires it. Keep the image coherent, believable, and suitable for the post's public or locked access level. Use only the visual details needed for this scene.";

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not update settings.";
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

// Same row, same highlight as every other Slurp destination.
export const sectionTabClass = (active: boolean) =>
  cn(SLURP_ROW_CLASS, active ? SLURP_ROW_ACTIVE_CLASS : "text-[var(--slurp-muted)]");

/** One labelled row of mutually exclusive buttons, the shape every Audience choice shares. */
export function localDateTimeValue(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export const ARC_MOODS = [
  "just_posted",
  "post_landed",
  "post_flopped",
  "afterglow",
  "overexposed",
  "paid_well",
  "goal_hit",
  "lapse_sting",
  "tipsy",
  "tired",
  "rattled",
] as const;
