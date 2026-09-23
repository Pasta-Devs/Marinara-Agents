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

/**
 * Both concealed modes describe the same person, so they receive the same seed and differ only in
 * what the instructions forbid saying. Name, scenario, and backstory are the googleable canon, so
 * they stay out of both; body, voice, and everyday texture are inseparable from the person and stay
 * in.
 */
/** A blank primary field must fall through to its extension rather than dropping the line. */
function promptField(primary: unknown, fallback?: unknown): string {
  if (typeof primary === "string" && primary.trim()) return primary;
  return typeof fallback === "string" && fallback.trim() ? fallback : "";
}

export function noodlerConcealedSourceText(data: unknown): string {
  const source = promptRecord(data);
  const extensions = promptRecord(source.extensions);
  return [
    `Description: ${promptField(source.description)}`,
    `Personality: ${promptField(source.personality)}`,
    `Appearance: ${promptField(source.appearance, extensions.appearance)}`,
  ]
    .filter((line) => line.split(": ").slice(1).join(": ").trim())
    .join("\n");
}

/** Character canon is private behavioral context, separate from linked identity disclosure. */
/**
 * A card field as Creator canon: macros resolved and length bounded.
 *
 * Cards are written for roleplay chats, so `{{user}}` and `{{char}}` reached every Slurp prompt
 * unresolved, and a long downloaded card added about 5 KB of backstory and scenario to each post
 * call. The head of each field carries the identity; the tail was mostly chat instructions.
 * ponytail: a flat character cap per field; summarise once per Creator if long cards still crowd
 * the prompt.
 */
function canonField(value: string, name: string, max: number): string {
  const text = value
    .replace(/\{\{\s*char\s*\}\}/giu, name || "the Creator")
    .replace(/\{\{\s*user\s*\}\}/giu, "the player")
    .replace(/\s+\n/gu, "\n")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return `${(end > max * 0.6 ? cut.slice(0, end + 1) : cut).trim()} …`;
}

export function slpCreatorCharacterCanonText(data: unknown, includeName: boolean): string {
  const source = promptRecord(data);
  const extensions = promptRecord(source.extensions);
  const name = promptField(source.name).trim();
  const field = (value: string, max: number) => canonField(value, name, max);
  return [
    ...(includeName ? [`Name: ${name}`] : []),
    `Description: ${field(promptField(source.description), 1600)}`,
    `Personality: ${field(promptField(source.personality), 900)}`,
    `Scenario: ${field(promptField(source.scenario), 700)}`,
    `Appearance: ${field(promptField(source.appearance, extensions.appearance), 700)}`,
    `Backstory: ${field(promptField(source.backstory, extensions.backstory), 900)}`,
  ]
    .filter((line) => line.split(": ").slice(1).join(": ").trim())
    .join("\n");
}

/** The full card, used only where the source identity is public. */
export function slpCreatorSourceText(data: unknown): string {
  const source = promptRecord(data);
  const extensions = promptRecord(source.extensions);
  return [
    `Name: ${promptField(source.name)}`,
    `Description: ${promptField(source.description)}`,
    `Personality: ${promptField(source.personality)}`,
    `Scenario: ${promptField(source.scenario)}`,
    `Appearance: ${promptField(source.appearance, extensions.appearance)}`,
    `Backstory: ${promptField(source.backstory, extensions.backstory)}`,
  ]
    .filter((line) => line.trim().split(": ").slice(1).join(": ").trim())
    .join("\n");
}
