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

/**
 * Hidden identities receive only reviewed physical tokens, never raw profile prose.
 *
 * A multi-word token matches across intervening adjectives, so "long silver hair" still reports
 * "long hair" rather than nothing.
 * ponytail: word-window matching only, no synonyms — "lean" still misses "slender". Add a synonym
 * table here if reviewers find the vocabulary too literal in practice.
 */
export function reviewedNoodlerPhysicalFacts(value: string) {
  const normalized = value.toLocaleLowerCase();
  return REVIEWED_PHYSICAL_FACT_TOKENS.filter((token) => {
    const words = token.split(" ");
    if (words.length === 1) return normalized.includes(token);
    // The token list is fixed lowercase prose, so no escaping is needed.
    const pattern = words.join("(?:\\s+[\\p{L}-]+){0,2}\\s+");
    return new RegExp(`\\b${pattern}\\b`, "u").test(normalized);
  });
}
