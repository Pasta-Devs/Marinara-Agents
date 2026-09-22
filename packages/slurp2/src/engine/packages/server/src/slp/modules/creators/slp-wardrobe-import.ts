import {
  slpWardrobeImportDraftSchema,
  type SlpWardrobeImportDraft,
  type SlpWardrobeLook,
} from "../../../../../shared/src/slp/slp-wardrobe.js";

export const SLP_WARDROBE_IMPORT_SOURCE_LIMIT = 24_000;

function parseImportJson(content: string): unknown {
  const trimmed = content
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
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const key = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function parseSlpWardrobeImportDrafts(content: string, existing: readonly SlpWardrobeLook[] = []) {
  const parsed = parseImportJson(content) as { looks?: unknown } | unknown[] | null;
  const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.looks) ? parsed.looks : [];
  const seen = new Set(existing.flatMap((look) => [key(look.name), key(look.description)]));
  const out: SlpWardrobeImportDraft[] = [];
  for (const candidate of candidates) {
    const result = slpWardrobeImportDraftSchema.safeParse(candidate);
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
