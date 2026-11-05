import {
  SLP_WARDROBE_SUITABILITIES,
  SLP_WARDROBE_TAG_LIMIT,
  slpWardrobeImportDraftSchema,
  type SlpWardrobeImportDraft,
  type SlpWardrobeLook,
} from "../../../../../shared/src/slp/slp-wardrobe.js";

export const SLP_WARDROBE_IMPORT_SOURCE_LIMIT = 24_000;

function parseImportJson(content: string): unknown {
  const trimmed = content
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/giu, "")
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    const start = objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart) ? objectStart : arrayStart;
    const end = start === objectStart ? objectEnd : arrayEnd;
    if (start < 0 || end <= start) return salvageCutLooks(trimmed);
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return salvageCutLooks(trimmed);
    }
  }
}

/** A reply cut at the token budget: keep the looks that closed before the cut. */
function salvageCutLooks(reply: string): unknown[] | null {
  const looks: unknown[] = [];
  let depth = 0;
  let from = -1;
  let inString = false;
  let escaped = false;
  for (let index = reply.indexOf("[") + 1; index > 0 && index < reply.length; index += 1) {
    const char = reply[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) from = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth > 0) continue;
      try {
        looks.push(JSON.parse(reply.slice(from, index + 1)));
      } catch {
        // One broken look does not cost the others.
      }
    } else if (char === "]" && depth === 0) {
      break;
    }
  }
  return looks.length > 0 ? looks : null;
}

const key = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** The looks list under any name a model picks, or one bare look. */
function importCandidates(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const root = record(parsed);
  if (!root) return [];
  const list = [root.looks, root.outfits, root.wardrobe, root.items].find(Array.isArray);
  if (list) return list;
  return typeof root.name === "string" || typeof root.title === "string" ? [root] : [];
}

const text = (value: unknown): string =>
  typeof value === "string"
    ? value.trim()
    : Array.isArray(value)
      ? value
          .filter((part) => typeof part === "string")
          .join(" … ")
          .trim()
      : "";

/** Cut at a word end, not mid-word. */
const clip = (value: string, max: number) => {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

/**
 * Bend a model's look into the draft schema: known aliases, long fields clipped, odd keys dropped.
 * A look still needs a name, a description and evidence; nothing is invented here.
 */
function tidyImportLook(candidate: unknown): unknown {
  const look = record(candidate);
  if (!look) return candidate;
  const description = text(look.description) || text(look.outfit) || text(look.details);
  const summary = text(look.summary) || description.split(/(?<=[.!?])\s/u)[0] || "";
  const rawTags = Array.isArray(look.tags) ? look.tags : typeof look.tags === "string" ? look.tags.split(",") : [];
  const tags = [
    ...new Set(
      rawTags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => clip(tag.trim().toLowerCase(), 32))
        .filter(Boolean),
    ),
  ].slice(0, SLP_WARDROBE_TAG_LIMIT);
  const suitability = text(look.suitability).toLowerCase();
  return {
    name: clip(text(look.name) || text(look.title), 80),
    summary: clip(summary, 180),
    description: clip(description, 800),
    tags,
    suitability: (SLP_WARDROBE_SUITABILITIES as readonly string[]).includes(suitability) ? suitability : "both",
    enabled: typeof look.enabled === "boolean" ? look.enabled : true,
    evidence: clip(text(look.evidence) || text(look.quote) || text(look.source), 500),
  };
}

export function parseSlpWardrobeImportDrafts(content: string, existing: readonly SlpWardrobeLook[] = []) {
  const parsed = parseImportJson(content) as { looks?: unknown } | unknown[] | null;
  const candidates = importCandidates(parsed);
  const seen = new Set(existing.flatMap((look) => [key(look.name), key(look.description)]));
  const out: SlpWardrobeImportDraft[] = [];
  for (const candidate of candidates) {
    const result = slpWardrobeImportDraftSchema.safeParse(tidyImportLook(candidate));
    if (!result.success) continue;
    const keys = [key(result.data.name), key(result.data.description)];
    if (keys.some((entry) => seen.has(entry))) continue;
    keys.forEach((entry) => seen.add(entry));
    out.push({ ...result.data, tags: [...new Set(result.data.tags.map((tag) => tag.toLocaleLowerCase()))] });
    if (out.length >= 64) break;
  }
  return out;
}

export function buildSlpWardrobeImportMessages(sourceLabel: string, sourceText: string) {
  return [
    {
      role: "system" as const,
      content: [
        "Extract complete clothing looks explicitly supported by the supplied source for a Slurp Creator wardrobe.",
        "Do not invent, complete, embellish, or infer a look that the source does not describe. A vague style preference is not a complete look.",
        "Each look must be usable as one coherent outfit in an image prompt. Keep identity, body, personality, places, and plot out of clothing descriptions.",
        "summary is one compact model-facing line. description is a clear provider-ready visual description of the clothes and accessories only.",
        "suitability is public, locked, or both; choose both unless the source clearly limits where the look is used.",
        "evidence is a short exact-or-close source fragment proving the look exists.",
        'Return JSON only: {"looks":[{"name":"...","summary":"...","description":"...","tags":["..."],"suitability":"both","enabled":true,"evidence":"..."}]}.',
        "Return an empty looks array when the source contains no complete clothing look.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [`# Source`, sourceLabel, "", sourceText.slice(0, SLP_WARDROBE_IMPORT_SOURCE_LIMIT)].join("\n"),
    },
  ];
}
