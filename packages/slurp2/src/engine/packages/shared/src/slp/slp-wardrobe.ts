import { z } from "zod";

export const SLP_WARDROBE_LOOK_LIMIT = 64;
export const SLP_WARDROBE_TAG_LIMIT = 12;
export const SLP_WARDROBE_SUITABILITIES = ["public", "locked", "both"] as const;
export const SLP_WARDROBE_SOURCE_KINDS = ["manual", "character", "lorebook", "text", "legacy"] as const;

export const slpWardrobeLookInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(800),
    tags: z.array(z.string().trim().min(1).max(32)).max(SLP_WARDROBE_TAG_LIMIT).default([]),
    suitability: z.enum(SLP_WARDROBE_SUITABILITIES).default("both"),
    enabled: z.boolean().default(true),
  })
  .strict();

export const slpWardrobeLookSchema = slpWardrobeLookInputSchema.extend({
  id: z.string().min(1).max(80),
  source: z
    .object({
      kind: z.enum(SLP_WARDROBE_SOURCE_KINDS),
      label: z.string().trim().max(160).optional(),
    })
    .strict(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const slpWardrobeImportDraftSchema = slpWardrobeLookInputSchema.extend({
  evidence: z.string().trim().min(1).max(500),
});

export const slpWardrobeSceneSchema = z
  .object({
    wardrobeId: z.string().trim().max(80).nullable().optional(),
    setting: z.string().trim().max(500),
    action: z.string().trim().max(500),
    expression: z.string().trim().max(300),
    visualDirection: z.string().trim().max(500),
    /** What they wear in this photo. Optional so scenes stored before it existed still parse. */
    outfit: z.string().trim().max(300).optional(),
  })
  .strict();

export type SlpWardrobeLookInput = z.infer<typeof slpWardrobeLookInputSchema>;
export type SlpWardrobeLook = z.infer<typeof slpWardrobeLookSchema>;
export type SlpWardrobeImportDraft = z.infer<typeof slpWardrobeImportDraftSchema>;
export type SlpWardrobeScene = z.infer<typeof slpWardrobeSceneSchema>;

export function readSlpWardrobeLooks(value: unknown): SlpWardrobeLook[] {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const looks: SlpWardrobeLook[] = [];
  const ids = new Set<string>();
  for (const candidate of parsed) {
    const result = slpWardrobeLookSchema.safeParse(candidate);
    if (!result.success || ids.has(result.data.id)) continue;
    ids.add(result.data.id);
    looks.push(result.data);
    if (looks.length >= SLP_WARDROBE_LOOK_LIMIT) break;
  }
  return looks;
}

export function slpWardrobeLookFits(look: SlpWardrobeLook, access: "public" | "locked"): boolean {
  return look.enabled && (look.suitability === "both" || look.suitability === access);
}

/** Compact enough to show the model the complete closet; full descriptions are expanded later. */
export function formatSlpWardrobeCloset(looks: readonly SlpWardrobeLook[]): string {
  return looks
    .filter((look) => look.enabled)
    .map(
      (look) =>
        `- ${look.id} | ${look.name} | ${look.suitability} | ${look.summary}${look.tags.length ? ` | ${look.tags.join(", ")}` : ""}`,
    )
    .join("\n");
}
