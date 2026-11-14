import { z } from "zod";
import { ltmNoteIdSchema } from "./primitives.js";
import { ltmAiCheckRebuildSchema } from "./tidy.js";

/** One "Link older relationships" apply adds at most this many links. */
export const LTM_LINKS_APPLY_MAX = 500;

const ltmLinkMemoryRefSchema = z.object({ id: ltmNoteIdSchema, title: z.string().max(240) }).strict();

export const ltmRelationshipLinkSuggestionSchema = z
  .object({
    relationship: ltmLinkMemoryRefSchema,
    person: ltmLinkMemoryRefSchema,
    /** "name": the relationship's subject or title matches the person exactly, no model needed. "model": the model proposed it. */
    origin: z.enum(["name", "model"]),
  })
  .strict();

export const ltmRelationshipLinksPreviewResponseSchema = z
  .object({
    /** Active relationship memories with no link to a person memory yet. */
    total: z.number().int().min(0),
    /** Relationships matched by name or whose model call returned a usable answer. */
    checked: z.number().int().min(0),
    /** True when some relationships were left unchecked to keep one review bounded. */
    truncated: z.boolean(),
    /** Position to carry on after when this batch stopped at the call limit (send it as `after`); null when nothing is left. */
    next: z.string().nullable(),
    /** Model calls whose reply could not be used. */
    failedChunks: z.number().int().min(0),
    suggestions: z.array(ltmRelationshipLinkSuggestionSchema),
  })
  .strict();

const ltmRelationshipLinkPairSchema = z.object({ relationshipId: ltmNoteIdSchema, personId: ltmNoteIdSchema }).strict();

export const ltmRelationshipLinksApplyRequestSchema = z
  .object({
    links: z
      .array(ltmRelationshipLinkPairSchema)
      .min(1)
      .max(LTM_LINKS_APPLY_MAX)
      .refine(
        (pairs) => new Set(pairs.map((pair) => `${pair.relationshipId}\0${pair.personId}`)).size === pairs.length,
        {
          message: "Links must be unique.",
        },
      ),
  })
  .strict();

export const ltmRelationshipLinksApplyResponseSchema = z
  .object({
    linked: z.array(ltmRelationshipLinkPairSchema),
    /** Pairs that no longer qualify (missing, archived, wrong type, other place, already linked); nothing changed for them. */
    skipped: z.array(ltmRelationshipLinkPairSchema),
    /** Null when nothing was linked, so no rebuild ran. */
    rebuild: ltmAiCheckRebuildSchema.nullable(),
  })
  .strict();

export type LtmRelationshipLinkSuggestion = z.infer<typeof ltmRelationshipLinkSuggestionSchema>;
export type LtmRelationshipLinksPreviewResponse = z.infer<typeof ltmRelationshipLinksPreviewResponseSchema>;
export type LtmRelationshipLinksApplyRequest = z.infer<typeof ltmRelationshipLinksApplyRequestSchema>;
export type LtmRelationshipLinksApplyResponse = z.infer<typeof ltmRelationshipLinksApplyResponseSchema>;
