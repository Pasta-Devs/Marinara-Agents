import { resolveMacros } from "@marinara-engine/shared";

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

/**
 * Engine macros for Slurp text (card fields, wardrobe looks). Cards are written for roleplay chats,
 * so `{{char}}` is the Creator and `{{user}}` the player; unresolved, the model saw template syntax
 * where the person should be. An empty name (the concealed brief) keeps the source name out of the
 * prompt. Slurp has no chat, so chat-only macros (`{{input}}`, chat variables) resolve to nothing;
 * `{{random::…}}` rolls again on every call.
 */
export function slpResolveCardMacros(text: string, name: string): string {
  if (!text.includes("{{")) return text;
  // Cards write `{{ Char }}` too; the Engine resolver only knows the tight form.
  const tight = text.replace(/\{\{\s*(char|user)\s*\}\}/giu, (_, macro: string) => `{{${macro.toLowerCase()}}}`);
  return resolveMacros(
    tight,
    { char: name.trim() || "the Creator", user: "the player", characters: [], variables: {} },
    { trimResult: false },
  );
}

export function noodlerConcealedSourceText(data: unknown): string {
  const source = promptRecord(data);
  const extensions = promptRecord(source.extensions);
  const field = (value: string) => slpResolveCardMacros(value, "");
  return [
    `Description: ${field(promptField(source.description))}`,
    `Personality: ${field(promptField(source.personality))}`,
    `Appearance: ${field(promptField(source.appearance, extensions.appearance))}`,
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
  const text = slpResolveCardMacros(value, name).replace(/\s+\n/gu, "\n").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return `${(end > max * 0.6 ? cut.slice(0, end + 1) : cut).trim()} …`;
}

/**
 * How much more of each card field the one cached card reading (canon anchors) gets than a post
 * does. A fact past a post's cut (a character who cannot speak, named in the last paragraph) is
 * read once there instead of riding in every prompt. Still bounded: about 19,000 characters at most.
 */
export const SLP_CANON_READING_SCALE = 4;

export function slpCreatorCharacterCanonText(data: unknown, includeName: boolean, scale = 1): string {
  const source = promptRecord(data);
  const extensions = promptRecord(source.extensions);
  const name = promptField(source.name).trim();
  const field = (value: string, max: number) => canonField(value, name, max * scale);
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
  const name = promptField(source.name);
  const field = (value: string) => slpResolveCardMacros(value, name);
  return [
    `Name: ${name}`,
    `Description: ${field(promptField(source.description))}`,
    `Personality: ${field(promptField(source.personality))}`,
    `Scenario: ${field(promptField(source.scenario))}`,
    `Appearance: ${field(promptField(source.appearance, extensions.appearance))}`,
    `Backstory: ${field(promptField(source.backstory, extensions.backstory))}`,
  ]
    .filter((line) => line.trim().split(": ").slice(1).join(": ").trim())
    .join("\n");
}

/**
 * Shortens over-long model text to at most `maxLength` without ending mid-word ("…QUESTI", #101):
 * at the last sentence end when that keeps most of the text, else at the last space. A hard cut
 * only when there is no space at all, and never inside a surrogate pair.
 */
export function slpCutAtBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const lastCodeUnit = text.charCodeAt(maxLength - 1);
  const head = text.slice(0, lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff ? maxLength - 1 : maxLength);
  // The character after the cut decides whether the head already ends on a whole word.
  if (/\s/u.test(text.charAt(head.length))) return head.trimEnd();
  const sentenceEnd = Math.max(...[...head.matchAll(/[.!?…]["')\]]?(?=\s)/gu)].map((m) => m.index + m[0].length), -1);
  if (sentenceEnd >= maxLength * 0.6) return head.slice(0, sentenceEnd);
  const space = head.search(/\s\S*$/u);
  return space > 0 ? head.slice(0, space).trimEnd() : head.trimEnd();
}
