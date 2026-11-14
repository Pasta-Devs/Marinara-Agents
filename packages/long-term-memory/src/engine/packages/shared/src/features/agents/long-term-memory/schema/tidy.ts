import { z } from "zod";
import { ltmIsoTimestampSchema, ltmNoteIdSchema } from "./primitives.js";

/** One Tidy with AI apply archives at most this many memories (the same cap as other bulk note requests). */
export const LTM_TIDY_APPLY_MAX_NOTES = 500;

/**
 * The request every AI check preview takes: `after` is the previous response's `next`, an opaque position in the
 * check's order. Only memories after it are read, so the vault changing between batches cannot skip or repeat any.
 */
export const ltmAiCheckPreviewRequestSchema = z.object({ after: z.string().optional() }).strict();

export const ltmTidyReasonSchema = z.enum(["duplicate", "covered", "placeholder"]);

const ltmTidyMemoryRefSchema = z.object({ id: ltmNoteIdSchema, title: z.string().max(240) }).strict();

export const ltmTidySuggestionSchema = z
  .object({
    reason: ltmTidyReasonSchema,
    /** The memory that stays. Null for a placeholder, which has nothing to stay for. */
    keep: ltmTidyMemoryRefSchema.nullable(),
    archive: z.array(ltmTidyMemoryRefSchema).min(1).max(LTM_TIDY_APPLY_MAX_NOTES),
  })
  .strict();

export const ltmTidyPreviewResponseSchema = z
  .object({
    /** Memories that could be tidied (not source records, not archived). */
    total: z.number().int().min(0),
    /** Memories whose model call returned a usable answer. */
    checked: z.number().int().min(0),
    /** True when some groups were left unchecked to keep one review bounded. */
    truncated: z.boolean(),
    /** Position to carry on after when this batch stopped at the call limit (send it as `after`); null when nothing is left. */
    next: z.string().nullable(),
    /** Model calls whose reply could not be used. */
    failedChunks: z.number().int().min(0),
    suggestions: z.array(ltmTidySuggestionSchema),
  })
  .strict();

export const ltmTidyApplyRequestSchema = z
  .object({
    noteIds: z
      .array(ltmNoteIdSchema)
      .min(1)
      .max(LTM_TIDY_APPLY_MAX_NOTES)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Memory ids must be unique." }),
  })
  .strict();

/** The recall-index rebuild an AI check runs once after it changed notes. */
export const ltmAiCheckRebuildSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("complete"),
      generatedAt: ltmIsoTimestampSchema,
      noteCount: z.number().int().min(0),
      chunkCount: z.number().int().min(0),
      embeddedChunkCount: z.number().int().min(0),
      embeddingsAvailable: z.boolean(),
    })
    .strict(),
  z.object({ status: z.literal("deferred"), error: z.string().min(1) }).strict(),
]);

/** What an AI check would read and which connection it would use, shown before the user presses Start. */
export const ltmAiCheckScopeResponseSchema = z
  .object({
    /** The memories the check would read if every model call succeeded; the preview's `checked`. */
    count: z.number().int().min(0),
    /** The connection the check would use. Null when none is set up, or when it is picked at random per run. */
    connectionId: z.string().nullable(),
    /** That connection's model; null with a null connection. */
    model: z.string().nullable(),
  })
  .strict();

export const ltmTidyApplyResponseSchema = z
  .object({
    archived: z.array(ltmNoteIdSchema),
    /** Missing, already archived or source-record ids; nothing was changed for them. */
    skipped: z.array(ltmNoteIdSchema),
    /** Null when nothing was archived, so no rebuild ran. */
    rebuild: ltmAiCheckRebuildSchema.nullable(),
  })
  .strict();

export type LtmAiCheckScopeResponse = z.infer<typeof ltmAiCheckScopeResponseSchema>;
export type LtmTidySuggestion = z.infer<typeof ltmTidySuggestionSchema>;
export type LtmTidyPreviewResponse = z.infer<typeof ltmTidyPreviewResponseSchema>;
export type LtmTidyApplyRequest = z.infer<typeof ltmTidyApplyRequestSchema>;
export type LtmTidyApplyResponse = z.infer<typeof ltmTidyApplyResponseSchema>;
