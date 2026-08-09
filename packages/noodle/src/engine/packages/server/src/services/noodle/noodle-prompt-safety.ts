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
  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function escapePromptAttribute(value: string) {
  return escapePromptText(value).replace(/"/g, "&quot;");
}

export function escapePromptText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function characterContextFromRow(row: {
  id: string;
  data: unknown;
  avatarPath?: string | null;
}) {
  const data = promptRecord(row.data);
  const extensions = promptRecord(data.extensions);
  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : "Character";
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

/** A hinted identity receives only broad, allowlisted source themes. */
export function hintedNoodlerSourceBrief(
  snapshot: NoodlerSourceSnapshot | null,
) {
  if (!snapshot)
    return "General temperament and creative interests from the source profile.";
  const themes = Object.fromEntries(
    (["personality", "scenario", "appearance", "backstory"] as const).flatMap(
      (field) => {
        const value = snapshot[field].trim();
        return value ? [[field, escapePromptText(value)]] : [];
      },
    ),
  );
  return Object.keys(themes).length > 0
    ? JSON.stringify(themes, null, 2)
    : "General temperament and creative interests from the source profile.";
}
