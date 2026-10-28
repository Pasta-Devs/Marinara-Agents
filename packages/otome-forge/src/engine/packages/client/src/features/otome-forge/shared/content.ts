// ──────────────────────────────────────────────
// Otome Forge: content settings (Heat, Darkness, Lines & Veils, image rating) and the rules that bound them
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles: the client's Content step shows these choices, and the server enforces the
// same rules on every write (the client is never trusted). Prompt wording for each limit is English and never
// localized; the client labels limits through its own literal map of ui.otomeForge.* keys.
//
// The 18+ gate unlocks NSFW Heat, Dark romance and image ratings above SFW. Non-consent stays a Line unless the world
// is Dark, its Heat is NSFW and the gate is confirmed; under SFW every sexual item is a Line; outside Dark, nothing
// aimed at the protagonist may be raised above a Line.

export const HEATS = ["sfw", "fade", "explicit"] as const;
export type Heat = (typeof HEATS)[number];

export const DARKNESSES = ["gentle", "angst", "dark"] as const;
export type Darkness = (typeof DARKNESSES)[number];

export const IMAGE_RATINGS = ["sfw", "suggestive", "explicit"] as const;
export type ImageRating = (typeof IMAGE_RATINGS)[number];

/** allow: may be written; veil: happens off the page only; line: never written, not even implied. */
export const LIMIT_LEVELS = ["allow", "veil", "line"] as const;
export type LimitLevel = (typeof LIMIT_LEVELS)[number];
export type CustomLimitLevel = Exclude<LimitLevel, "allow">;

export const LIMIT_IDS = [
  "violence-others",
  "gore",
  "threats",
  "captivity",
  "manipulation",
  "stalking",
  "violence-to-protagonist",
  "torture",
  "self-harm",
  "dubious-consent",
  "non-consent",
  "pregnancy",
] as const;
export type LimitId = (typeof LIMIT_IDS)[number];

export interface CustomLimit {
  text: string;
  level: CustomLimitLevel;
}

export interface ContentSettings {
  heat: Heat;
  darkness: Darkness;
  limits: Record<LimitId, LimitLevel>;
  custom: CustomLimit[];
}

export const CUSTOM_LIMITS_MAX = 10;
export const CUSTOM_LIMIT_TEXT_MAX = 120;

/** How each limit reads inside a prompt (English, never localized). */
export const LIMIT_PROMPT_TEXT: Record<LimitId, string> = {
  "violence-others": "violence toward other people",
  gore: "gore",
  threats: "threats",
  captivity: "captivity",
  manipulation: "manipulation",
  stalking: "stalking",
  "violence-to-protagonist": "a love interest's violence toward the protagonist",
  torture: "torture",
  "self-harm": "self-harm",
  "dubious-consent": "dubious consent",
  "non-consent": "non-consent",
  pregnancy: "pregnancy",
};

/** Sexual items: always Lines while Heat is SFW. */
const SEXUAL: ReadonlySet<LimitId> = new Set<LimitId>(["dubious-consent", "non-consent"]);
/** Menace aimed at the protagonist: only Dark romance may raise these above a Line. */
const AIMED_AT_PROTAGONIST: ReadonlySet<LimitId> = new Set<LimitId>([
  "violence-to-protagonist",
  "dubious-consent",
  "non-consent",
]);

/** The Lines & Veils each Darkness starts from (the design's Dark defaults; Angst and Gentle step down from them). */
export const LIMIT_DEFAULTS: Record<Darkness, Record<LimitId, LimitLevel>> = {
  gentle: {
    "violence-others": "veil",
    gore: "line",
    threats: "veil",
    captivity: "line",
    manipulation: "veil",
    stalking: "line",
    "violence-to-protagonist": "line",
    torture: "line",
    "self-harm": "line",
    "dubious-consent": "line",
    "non-consent": "line",
    pregnancy: "line",
  },
  angst: {
    "violence-others": "allow",
    gore: "veil",
    threats: "allow",
    captivity: "veil",
    manipulation: "allow",
    stalking: "veil",
    "violence-to-protagonist": "line",
    torture: "veil",
    "self-harm": "veil",
    "dubious-consent": "line",
    "non-consent": "line",
    pregnancy: "line",
  },
  dark: {
    "violence-others": "allow",
    gore: "allow",
    threats: "allow",
    captivity: "allow",
    manipulation: "allow",
    stalking: "allow",
    "violence-to-protagonist": "veil",
    torture: "veil",
    "self-harm": "veil",
    "dubious-consent": "veil",
    "non-consent": "line",
    pregnancy: "line",
  },
};

export function defaultLimits(darkness: Darkness): Record<LimitId, LimitLevel> {
  return { ...LIMIT_DEFAULTS[darkness] };
}

/**
 * The levels the player set away from their Darkness's defaults (limits held at Line aside). Changing Darkness keeps
 * these and takes the new Darkness's defaults for every other limit, so a Line the player chose is never lost.
 */
export function playerLimits(content: ContentSettings, ageGate: boolean): Partial<Record<LimitId, LimitLevel>> {
  const picks: Partial<Record<LimitId, LimitLevel>> = {};
  for (const id of LIMIT_IDS) {
    const level = content.limits[id];
    if (!limitIsFixed(id, content, ageGate) && level !== LIMIT_DEFAULTS[content.darkness][id]) picks[id] = level;
  }
  return picks;
}

/** The limits under `darkness`: its defaults, with the levels the player set (playerLimits) kept. */
export function limitsForDarkness(
  darkness: Darkness,
  picks: Partial<Record<LimitId, LimitLevel>>,
): Record<LimitId, LimitLevel> {
  const limits = defaultLimits(darkness);
  for (const id of LIMIT_IDS) limits[id] = picks[id] ?? limits[id];
  return limits;
}

/** Maintainer defaults: Heat SFW, Darkness Angst, image rating SFW. */
export const DEFAULT_IMAGE_RATING: ImageRating = "sfw";
export function defaultContent(): ContentSettings {
  return { heat: "sfw", darkness: "angst", limits: defaultLimits("angst"), custom: [] };
}

/** True when this content needs the 18+ gate: NSFW Heat or Dark romance. */
export function contentNeedsAgeGate(content: Pick<ContentSettings, "heat" | "darkness">): boolean {
  return content.heat !== "sfw" || content.darkness === "dark";
}

/** True when this image rating needs the 18+ gate (anything above SFW). */
export function imageRatingNeedsAgeGate(rating: ImageRating): boolean {
  return rating !== "sfw";
}

/** The settings the 18+ gate guards. */
export interface GatedSettings {
  heat: Heat;
  darkness: Darkness;
  imageRating: ImageRating;
}

/**
 * True when going from `from` to `to` raises a gated setting: Heat or the image rating above where it was, or Dark
 * romance from any other Darkness. Lowering a setting, or keeping it, never asks for the gate.
 */
export function raisesGatedSetting(from: GatedSettings, to: GatedSettings): boolean {
  return (
    HEATS.indexOf(to.heat) > HEATS.indexOf(from.heat) ||
    (to.darkness === "dark" && from.darkness !== "dark") ||
    IMAGE_RATINGS.indexOf(to.imageRating) > IMAGE_RATINGS.indexOf(from.imageRating)
  );
}

/**
 * True while the limit is held at Line whatever the player picks: sexual items under SFW, items aimed at the
 * protagonist outside Dark, and non-consent unless the world is Dark with NSFW Heat and the gate is confirmed.
 */
export function limitIsFixed(id: LimitId, content: Pick<ContentSettings, "heat" | "darkness">, ageGate: boolean) {
  if (SEXUAL.has(id) && content.heat === "sfw") return true;
  if (AIMED_AT_PROTAGONIST.has(id) && content.darkness !== "dark") return true;
  if (id === "non-consent") return !(ageGate && content.darkness === "dark" && content.heat !== "sfw");
  return false;
}

/**
 * The content as it may be used: without the gate, Heat drops to SFW and Dark to Angst; fixed limits become Lines;
 * custom limits are trimmed, emptied ones dropped, and capped. Only ever lowers a setting.
 */
export function enforceContent(content: ContentSettings, ageGate: boolean): ContentSettings {
  const heat: Heat = ageGate ? content.heat : "sfw";
  const darkness: Darkness = !ageGate && content.darkness === "dark" ? "angst" : content.darkness;
  const limits = { ...content.limits };
  for (const id of LIMIT_IDS) if (limitIsFixed(id, { heat, darkness }, ageGate)) limits[id] = "line";
  const custom = content.custom
    .map((limit) => ({ text: limit.text.trim().slice(0, CUSTOM_LIMIT_TEXT_MAX), level: limit.level }))
    .filter((limit) => limit.text)
    .slice(0, CUSTOM_LIMITS_MAX);
  return { heat, darkness, limits, custom };
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

function field(data: unknown, key: string): unknown {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>)[key] : undefined;
}

/** Stored or drafted content in its full shape: each bad or missing field takes its default. Enforces nothing. */
export function normalizeContent(data: unknown): ContentSettings {
  const fallback = defaultContent();
  const heat = field(data, "heat");
  const darkness = field(data, "darkness");
  const resolvedDarkness = isOneOf(DARKNESSES, darkness) ? darkness : fallback.darkness;
  const rawLimits = field(data, "limits");
  const limits = defaultLimits(resolvedDarkness);
  for (const id of LIMIT_IDS) {
    const level = field(rawLimits, id);
    if (isOneOf(LIMIT_LEVELS, level)) limits[id] = level;
  }
  const rawCustom = field(data, "custom");
  const custom: CustomLimit[] = [];
  for (const raw of Array.isArray(rawCustom) ? rawCustom : []) {
    const text = field(raw, "text");
    const level = field(raw, "level");
    if (typeof text === "string" && (level === "veil" || level === "line")) custom.push({ text, level });
  }
  return {
    heat: isOneOf(HEATS, heat) ? heat : fallback.heat,
    darkness: resolvedDarkness,
    limits,
    custom: custom.slice(0, CUSTOM_LIMITS_MAX),
  };
}

export function normalizeImageRating(value: unknown): ImageRating {
  return isOneOf(IMAGE_RATINGS, value) ? value : DEFAULT_IMAGE_RATING;
}
