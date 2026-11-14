import { z } from "zod";
import { ltmNoteIdSchema } from "./primitives.js";
import { ltmAiCheckRebuildSchema } from "./tidy.js";

/** One "Find duplicate people" apply merges at most this many groups. */
export const LTM_PEOPLE_APPLY_MAX = 100;
/** A proposed group holds the keep and at most this many memories merged into it. */
export const LTM_PEOPLE_GROUP_MAX = 8;

const ltmPeopleMemoryRefSchema = z.object({ id: ltmNoteIdSchema, title: z.string().max(240) }).strict();

export const ltmDuplicatePeopleSuggestionSchema = z
  .object({
    /** The most complete memory of the group; the others merge into it. */
    keep: ltmPeopleMemoryRefSchema,
    merge: z.array(ltmPeopleMemoryRefSchema).min(1).max(LTM_PEOPLE_GROUP_MAX),
  })
  .strict();

export const ltmDuplicatePeoplePreviewResponseSchema = z
  .object({
    /** Active person memories in places that hold at least two. */
    total: z.number().int().min(0),
    /** Person memories whose model call returned a usable answer. */
    checked: z.number().int().min(0),
    /** True when some person memories were left unchecked to keep one review bounded. */
    truncated: z.boolean(),
    /** Position to carry on after when this batch stopped at the call limit (send it as `after`); null when nothing is left. */
    next: z.string().nullable(),
    /** Model calls whose reply could not be used. */
    failedChunks: z.number().int().min(0),
    suggestions: z.array(ltmDuplicatePeopleSuggestionSchema),
  })
  .strict();

const ltmDuplicatePeopleGroupSchema = z
  .object({ keepId: ltmNoteIdSchema, mergeIds: z.array(ltmNoteIdSchema).min(1).max(LTM_PEOPLE_GROUP_MAX) })
  .strict();

export const ltmDuplicatePeopleApplyRequestSchema = z
  .object({
    groups: z
      .array(ltmDuplicatePeopleGroupSchema)
      .min(1)
      .max(LTM_PEOPLE_APPLY_MAX)
      .refine(
        (groups) => {
          const ids = groups.flatMap((group) => [group.keepId, ...group.mergeIds]);
          return new Set(ids).size === ids.length;
        },
        { message: "A memory can be in only one group." },
      ),
  })
  .strict();

export const ltmDuplicatePeopleApplyResponseSchema = z
  .object({
    merged: z.array(ltmDuplicatePeopleGroupSchema),
    /** Ids that no longer qualify (missing, archived, not a person, other place, cannot merge); nothing changed for them. */
    skipped: z.array(ltmNoteIdSchema),
    /** The vault backup taken before merging; null when nothing merged. */
    backup: z
      .object({ id: z.string().min(1), createdAt: z.string().min(1) })
      .strict()
      .nullable(),
    /** Null when nothing merged, so no rebuild ran. */
    rebuild: ltmAiCheckRebuildSchema.nullable(),
  })
  .strict();

export type LtmDuplicatePeopleSuggestion = z.infer<typeof ltmDuplicatePeopleSuggestionSchema>;
export type LtmDuplicatePeoplePreviewResponse = z.infer<typeof ltmDuplicatePeoplePreviewResponseSchema>;
export type LtmDuplicatePeopleApplyRequest = z.infer<typeof ltmDuplicatePeopleApplyRequestSchema>;
export type LtmDuplicatePeopleApplyResponse = z.infer<typeof ltmDuplicatePeopleApplyResponseSchema>;
