/** The shipped Slurp generation guidance defaults, current and legacy (read by the settings normalizer). */

// Package-owned default for the editable Slurp generation guidance. This is the
// single tone prompt: creator personality, mood balance, and the adult flirty lean
// all live here so they are visible and editable in Slurp settings, not hardcoded.
// Keep this value aligned with the Slurp settings surface.
export const LEGACY_SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE =
  "All NoodleR creators and viewers are adults (18+). This is an adult creator page: flirty, suggestive, teasing, and sensual posts are common, and explicit posts appear regularly when they suit the creator — but they are not required and need not be the majority. Tease the locked posts and answer flirty comments in kind. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one bluntly, a funny one filthily. Ordinary posts — updates, humor, behind the scenes, project news — matter just as much and keep both the page and the character human. Keep low mood or conflict uncommon and character-specific, and do not let recent posts set the default mood.";

export const LEGACY_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page: flirty, suggestive, teasing, and sensual posts are common, and explicit posts appear regularly when they suit the creator — but they are not required and need not be the majority. Tease the locked posts and answer flirty comments in kind. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one bluntly, a funny one filthily. Ordinary posts — updates, humor, behind the scenes, project news — matter just as much and keep both the page and the character human. Keep low mood or conflict uncommon and character-specific, and do not let recent posts set the default mood.";

/** The old Writing spice presets (before 0.3.17), written verbatim into `generationGuidance`. */
export const SLURP_GUIDANCE_PRESETS = {
  mild: "All Slurp creators and viewers are adults (18+). This is an adult creator page, but a restrained one: posts are flirty, teasing, and suggestive rather than graphic. Innuendo, charm, and anticipation do the work, and locked posts are teased instead of described. Do not write explicit sexual detail. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one flirts bluntly. Ordinary posts about their day, work, and mood stay just as important as the flirty ones.",
  steamy:
    "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normally sexually suggestive to outright NSFW. Creators will use Slurp to often excite their readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material. When a post is explicit or shows nudity, always use thorough, graphic, horny descriptions. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact.",
  explicit:
    "All Slurp creators and viewers are adults (18+). This is an explicit adult creator page. Sexual content is the norm here rather than the exception, and creators describe it directly and in detail when it suits them. Tease the locked posts hard and answer flirty comments in kind. Always use thorough, graphic, horny descriptions for nudity and sex. Name the body in dirty everyday words, not clinical ones: tits, nipples, ass, pussy, clit, cock, balls, cum, wet, dripping, hard, leaking. Describe how it looks, feels, and moves. Keep each creator's personality intact: a shy creator is explicit shyly, a blunt one is explicit bluntly. Ordinary posts about their day, work, and mood still appear and keep the feed believable.",
} as const;

export type SlurpGuidanceLevel = keyof typeof SLURP_GUIDANCE_PRESETS;

// House style (0.3.17), no spice: level and Language reach the prompt as their own lines. The presets
// above stay only so `readSlurpSpice` can recognise and migrate them.
export const SLURP_HOUSE_STYLE_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page. How far each creator goes is set by their spice level; their personality decides how: a shy creator stays tamer and flirts shyly, an outgoing one is bolder and blunter. Tease the locked posts and answer flirty comments in kind. Ordinary posts about their day, work, and mood matter just as much and keep the feed believable. Keep each creator's personality intact.";

export const SLP_CREATOR_DEFAULT_GENERATION_GUIDANCE: string = SLURP_HOUSE_STYLE_GUIDANCE;

/** The middle level shipped with a typo before the levels existed; migrate it forward. */
export const LEGACY_TYPO_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normallly sexually suggestive to outright NSFW. Creators will use Slurp to often excite its readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material.";

export const LEGACY_STEAMY_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normally sexually suggestive to outright NSFW. Creators will use Slurp to often excite their readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material.";

export const LEGACY_EXPLICIT_SLURP_DEFAULT_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an explicit adult creator page. Sexual content is the norm here rather than the exception, and creators describe it directly and in detail when it suits them. Tease the locked posts hard and answer flirty comments in kind. Keep each creator's personality intact: a shy creator is explicit shyly, a blunt one is explicit bluntly. Ordinary posts about their day, work, and mood still appear and keep the feed believable.";

/**
 * The LEGACY_* guidance constants above are every previously shipped default. An install that
 * never edited the guidance stored one of them verbatim, so it is migrated to the current default
 * instead of being kept as if the user had chosen it. Comparison is exact: an edited string
 * differs by at least one character and is preserved as the user's own.
 */
