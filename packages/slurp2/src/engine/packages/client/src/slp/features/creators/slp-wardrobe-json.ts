import {
  SLP_WARDROBE_LOOK_LIMIT,
  slpWardrobeLookInputSchema,
  type SlpWardrobeLook,
  type SlpWardrobeLookInput,
} from "../../../../../shared/src/slp/slp-wardrobe.js";

export const SLP_WARDROBE_JSON_FORMAT = "slurp-wardrobe";

const SCHEMA_NOTE =
  "looks[]: name (1-80 chars), summary (1-180), description (1-800, exact clothing for the image model; {{random}} tokens are kept as written), tags (up to 12 strings, 32 chars each), suitability (public | locked | both), enabled (true | false). Up to " +
  SLP_WARDROBE_LOOK_LIMIT +
  " looks.";

export function buildSlpWardrobeJson(looks: readonly SlpWardrobeLook[]): string {
  return JSON.stringify(
    {
      format: SLP_WARDROBE_JSON_FORMAT,
      version: 1,
      schema: SCHEMA_NOTE,
      looks: looks.map(({ name, summary, description, tags, suitability, enabled }) => ({
        name,
        summary,
        description,
        tags,
        suitability,
        enabled,
      })),
    },
    null,
    2,
  );
}

export type SlpWardrobeJsonResult = { looks: SlpWardrobeLookInput[]; errors: string[] };

/** Reads an exported wardrobe file, a bare array of looks, or one look. Unknown fields are ignored. */
export function parseSlpWardrobeJson(raw: string): SlpWardrobeJsonResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { looks: [], errors: ["The file is not valid JSON."] };
  }
  const record = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const list = Array.isArray(data)
    ? data
    : record
      ? "looks" in record
        ? record.looks
        : "name" in record
          ? [record]
          : null
      : null;
  if (!Array.isArray(list)) return { looks: [], errors: ['Expected a "looks" list.'] };
  const looks: SlpWardrobeLookInput[] = [];
  const errors: string[] = [];
  if (list.length > SLP_WARDROBE_LOOK_LIMIT) errors.push(`Only the first ${SLP_WARDROBE_LOOK_LIMIT} looks are read.`);
  list.slice(0, SLP_WARDROBE_LOOK_LIMIT).forEach((item, index) => {
    const entry = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const parsed = slpWardrobeLookInputSchema.safeParse({
      name: entry.name,
      summary: entry.summary,
      description: entry.description,
      tags: entry.tags,
      suitability: entry.suitability,
      enabled: entry.enabled,
    });
    if (parsed.success) looks.push(parsed.data);
    else {
      const issue = parsed.error.issues[0];
      errors.push(`Look ${index + 1}: ${issue?.path.join(".") || "value"} ${issue?.message ?? "is invalid"}`);
    }
  });
  return { looks, errors };
}

export function downloadSlpWardrobeJson(json: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
