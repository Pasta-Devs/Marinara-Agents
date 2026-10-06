/**
 * Spice: how far each Creator goes, one Slurp-wide limit, and the player's own taste.
 *
 * Pure, shared by the server (prompts, learning) and the client (Backstage › Spice, the Creator's
 * spice in Creator tools). Every value is plain words the player picked or typed.
 *
 * The three levels the player sees map onto the picture levels the post pipeline already uses
 * (`none · suggestive · nudity · explicit`, see the server's `slp-visual-brief.ts`): Flirty is a
 * tease, Suggestive shows skin and nudes, Explicit is sex. A stored "none" stays valid and simply
 * shows no pill.
 */

export const SLP_SPICE_LEVELS = ["flirty", "suggestive", "explicit"] as const;
export type SlpSpiceLevel = (typeof SLP_SPICE_LEVELS)[number];

/** The picture levels, lowest first. Mirrors `SLURP_VISUAL_SEXUAL_LEVELS` on the server. */
export const SLP_EXPLICIT_LEVELS = ["none", "suggestive", "nudity", "explicit"] as const;
export type SlpExplicitLevelName = (typeof SLP_EXPLICIT_LEVELS)[number];

export const SLP_SPICE_TO_EXPLICIT: Record<SlpSpiceLevel, Exclude<SlpExplicitLevelName, "none">> = {
  flirty: "suggestive",
  suggestive: "nudity",
  explicit: "explicit",
};

export function slpSpiceFromExplicit(level: string | null | undefined): SlpSpiceLevel | null {
  return SLP_SPICE_LEVELS.find((spice) => SLP_SPICE_TO_EXPLICIT[spice] === level) ?? null;
}

/** A Creator's level, never above the Slurp-wide limit. */
export function slpClampExplicitLevel<T extends SlpExplicitLevelName>(level: T, max: SlpSpiceLevel): T {
  const top = SLP_EXPLICIT_LEVELS.indexOf(SLP_SPICE_TO_EXPLICIT[max]);
  return SLP_EXPLICIT_LEVELS.indexOf(level) > top ? (SLP_EXPLICIT_LEVELS[top] as T) : level;
}

/**
 * One scale everywhere (0.3.17): Clean, then the three spice levels. Clean is the picture level
 * "none". The Slurp-wide limit keeps the three spice levels; a Creator's level may also be Clean.
 */
export const SLP_SPICE_STEPS = ["clean", ...SLP_SPICE_LEVELS] as const;
export type SlpSpiceStep = (typeof SLP_SPICE_STEPS)[number];
export const slpSpiceStepOf = (level: string | null | undefined): SlpSpiceStep | null =>
  level === "none" ? "clean" : slpSpiceFromExplicit(level);
export const slpExplicitOfStep = (step: SlpSpiceStep): SlpExplicitLevelName =>
  step === "clean" ? "none" : SLP_SPICE_TO_EXPLICIT[step];

/**
 * Which words posts and chats use once they get naked (0.3.17). It took the word lists out of the
 * old Writing presets, so the level alone says how far and this says how it is said.
 */
export const SLP_SPICE_LANGUAGES = ["soft", "frank", "dirty"] as const;
export type SlpSpiceLanguage = (typeof SLP_SPICE_LANGUAGES)[number];

export const SLP_TASTE_STRENGTHS = ["hint", "often", "obsessed"] as const;
export type SlpTasteStrength = (typeof SLP_TASTE_STRENGTHS)[number];

export const SLP_SPICE_CHIP_MAX = 60;
export const SLP_SPICE_CHIPS_MAX = 8;
export const SLP_TASTE_TEXT_MAX = 40;
export const SLP_TASTES_MAX = 12;
export const SLP_TASTE_NEVER_MAX = 12;

/** Ideas the Backstage offers with one tap. The player can type anything. */
export const SLP_TASTE_IDEAS = [
  "lingerie",
  "stockings",
  "feet",
  "toys",
  "roleplay",
  "praise",
  "dirty talk",
  "teasing",
  "dominant",
  "submissive",
  "outdoors",
  "shower",
  "oil",
  "cosplay",
  "uniforms",
  "spanking",
  "bondage",
  "edging",
] as const;

export type SlpTaste = { id: string; text: string; strength: SlpTasteStrength };

/** What Slurp has seen the player enjoy, per label. Decays slowly; see the server's learning. */
export type SlpTasteLearned = { score: number; signals: number; at: string };

/** A "Slurp noticed you like …" chip. `existing` asks to strengthen a taste already on the list. */
export type SlpTasteNoticed = { label: string; existing: boolean };

export type SlpSpiceState = {
  /** The Slurp-wide limit. No Creator goes further, whatever their own level says. */
  max: SlpSpiceLevel;
  tastes: SlpTaste[];
  /** Never, for anyone. */
  never: string[];
  learned: Record<string, SlpTasteLearned>;
  /** Noticed labels the player removed; never suggested again. */
  dismissed: string[];
  /** Null until set once from the old Writing preset (`readSlurpSpice`); read as "dirty". */
  language: SlpSpiceLanguage | null;
};

/** Slurp's own app setting that holds the state below. */
export const SLP_SPICE_SETTING_KEY = "slurp2.spice";

export const SLP_DEFAULT_SPICE: SlpSpiceState = {
  max: "explicit",
  tastes: [],
  never: [],
  learned: {},
  dismissed: [],
  language: null,
};

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, max).trim() : "";

/** A list of short phrases: trimmed, no duplicates (case-insensitive), capped. */
export function slpSpiceList(value: unknown, max: number, count: number): string[] {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map((entry) => text(entry, max))
    .filter((entry) => entry && !seen.has(entry.toLocaleLowerCase()) && seen.add(entry.toLocaleLowerCase()))
    .slice(0, count);
}

export const slpTasteKey = (label: string) => label.replace(/\s+/gu, " ").trim().toLocaleLowerCase();

export function normalizeSlpSpice(raw: unknown): SlpSpiceState {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const tastes = (Array.isArray(value.tastes) ? value.tastes : [])
    .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}))
    .map((entry) => ({
      id: text(entry.id, 64),
      text: text(entry.text, SLP_TASTE_TEXT_MAX),
      strength: SLP_TASTE_STRENGTHS.includes(entry.strength as SlpTasteStrength)
        ? (entry.strength as SlpTasteStrength)
        : "hint",
    }))
    .filter(
      (entry) => entry.id && entry.text && !seen.has(slpTasteKey(entry.text)) && seen.add(slpTasteKey(entry.text)),
    )
    .slice(0, SLP_TASTES_MAX);
  const learned: Record<string, SlpTasteLearned> = {};
  const rawLearned =
    value.learned && typeof value.learned === "object" ? (value.learned as Record<string, unknown>) : {};
  for (const [label, entry] of Object.entries(rawLearned).slice(0, 200)) {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const key = slpTasteKey(text(label, SLP_TASTE_TEXT_MAX));
    const score = Number(record.score);
    if (!key || !Number.isFinite(score) || score <= 0) continue;
    learned[key] = {
      score: Math.min(1000, score),
      signals: Math.max(0, Math.floor(Number(record.signals) || 0)),
      at: text(record.at, 40),
    };
  }
  return {
    max: SLP_SPICE_LEVELS.includes(value.max as SlpSpiceLevel) ? (value.max as SlpSpiceLevel) : "explicit",
    tastes,
    never: slpSpiceList(value.never, SLP_TASTE_TEXT_MAX, SLP_TASTE_NEVER_MAX),
    learned,
    dismissed: slpSpiceList(value.dismissed, SLP_TASTE_TEXT_MAX, 100).map(slpTasteKey),
    language: SLP_SPICE_LANGUAGES.includes(value.language as SlpSpiceLanguage)
      ? (value.language as SlpSpiceLanguage)
      : null,
  };
}

/** Free text from the sign-up chat ("feet, lingerie and toys") as chips. */
export function slpSpiceChips(value: string): string[] {
  return slpSpiceList(
    value.split(/[,;\n•]|\s+(?:and|&|und)\s+/iu).map((part) => part.replace(/^[\s\-–]+|[\s.]+$/gu, "")),
    SLP_SPICE_CHIP_MAX,
    SLP_SPICE_CHIPS_MAX,
  );
}

const LIMIT_LINES = {
  level: /^How far the page goes:\s*(flirty|suggestive|explicit)\.?\s*$/imu,
  turnOns: /^Happy to show:\s*(.+)$/imu,
  hardNoes: /^Hard noes:\s*(.+)$/imu,
};

/**
 * The sign-up chat used to write the spice level, the turn-ons and the hard noes into the free
 * strategy text. Read them back out: `rest` is the strategy without them.
 */
export function slpSpiceFromStrategyText(value: string): {
  rest: string;
  level: SlpSpiceLevel | null;
  turnOns: string[];
  hardNoes: string[];
  found: boolean;
} {
  const level = value.match(LIMIT_LINES.level)?.[1]?.toLocaleLowerCase() as SlpSpiceLevel | undefined;
  const turnOns = value.match(LIMIT_LINES.turnOns)?.[1] ?? "";
  const hardNoes = value.match(LIMIT_LINES.hardNoes)?.[1] ?? "";
  const found = Boolean(level || turnOns || hardNoes);
  const rest = found
    ? value
        .split("\n")
        .filter((line) => !Object.values(LIMIT_LINES).some((pattern) => pattern.test(line)))
        .join("\n")
        .trim()
    : value;
  return { rest, level: level ?? null, turnOns: slpSpiceChips(turnOns), hardNoes: slpSpiceChips(hardNoes), found };
}
