import type { NoodlerSourceSnapshot } from "@marinara-engine/shared";

function promptRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return promptRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function escapePromptAttribute(value: string) {
  return escapePromptText(value).replace(/"/g, "&quot;");
}

export function escapePromptText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function characterContextFromRow(row: { id: string; data: unknown; avatarPath?: string | null }) {
  const data = promptRecord(row.data);
  const extensions = promptRecord(data.extensions);
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Character";
  const lines = [`<character name="${escapePromptAttribute(name)}">`];
  for (const [label, value] of [
    ["Description", data.description],
    ["Personality", data.personality],
    ["Scenario", data.scenario],
    ["First message", data.first_mes],
    ["Appearance", data.appearance ?? extensions.appearance],
    ["Backstory", data.backstory ?? extensions.backstory],
  ] as const) {
    if (typeof value === "string" && value.trim()) {
      lines.push(`${label}: ${escapePromptText(value.trim())}`);
    }
  }
  lines.push(`</character>`);
  return lines.join("\n");
}

const REVIEWED_HINTED_THEME_TOKENS = [
  "adventurous",
  "artistic",
  "bookish",
  "calm",
  "cheerful",
  "creative",
  "curious",
  "friendly",
  "gentle",
  "inventive",
  "kind",
  "musical",
  "outgoing",
  "playful",
  "reserved",
  "scientific",
  "sporty",
  "technical",
  "thoughtful",
  "witty",
] as const;

const REVIEWED_PHYSICAL_FACT_TOKENS = [
  "adult",
  "androgynous",
  "athletic",
  "beard",
  "blind",
  "curly hair",
  "dark hair",
  "freckles",
  "glasses",
  "horns",
  "light hair",
  "long hair",
  "muscular",
  "prosthetic",
  "scar",
  "short hair",
  "slender",
  "tattoo",
  "wings",
] as const;

/** A hinted identity receives only reviewed, non-identifying theme tokens. */
export function reviewedNoodlerTemperamentThemes(value: string) {
  const personalityWords = new Set(value.toLocaleLowerCase().match(/[a-z]+/gu) ?? []);
  return REVIEWED_HINTED_THEME_TOKENS.filter((token) => personalityWords.has(token));
}

export function hintedNoodlerSourceBrief(snapshot: NoodlerSourceSnapshot | null) {
  if (!snapshot) return "General temperament and creative interests from the source profile.";
  const themes = reviewedNoodlerTemperamentThemes(snapshot.personality);
  return themes.length > 0
    ? `Approved source themes: ${themes.join(", ")}.`
    : "General temperament and creative interests from the source profile.";
}

/** Hidden identities receive only reviewed physical tokens, never raw profile prose. */
export function reviewedNoodlerPhysicalFacts(value: string) {
  const normalized = value.toLocaleLowerCase();
  return REVIEWED_PHYSICAL_FACT_TOKENS.filter((token) => normalized.includes(token));
}
