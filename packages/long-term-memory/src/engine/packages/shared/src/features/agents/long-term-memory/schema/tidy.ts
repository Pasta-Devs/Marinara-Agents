import { z } from "zod";
import { ltmIsoTimestampSchema, ltmNoteIdSchema, ltmStoryTimeJumpSchema, ltmStoryTimeSchema } from "./primitives.js";

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

// Find story dates: chat pieces dated from what the Engine saved, or scanned by the model for stated dates and time
// jumps. The server checks every quote against the piece text; nothing is written until apply.
export const LTM_STORY_DATES_MAX_ROWS = 500;
const ltmStorySourceHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

/** A date the scan found in a piece's text, with the words it was read from. */
export const ltmStoryDatesStatedSchema = z
  .object({
    date: z.string().min(1).max(120),
    time: z.string().min(1).max(80).optional(),
    quote: z.string().min(1).max(240),
  })
  .strict();

export const ltmStoryDatesScopeResponseSchema = ltmAiCheckScopeResponseSchema
  .extend({
    /** Per chat: pieces with a date from the user or the Engine, pieces the scan has read, and the rest. */
    chats: z.array(
      z
        .object({
          chatId: z.string().min(1).max(120),
          dated: z.number().int().min(0),
          checked: z.number().int().min(0),
          notChecked: z.number().int().min(0),
        })
        .strict(),
    ),
  })
  .strict();

const ltmStoryDatesRowBase = {
  noteId: ltmNoteIdSchema,
  /** Hash of the piece text the row was read from; apply refuses the row when the text changed since. */
  sourceHash: ltmStorySourceHashSchema,
};
export const ltmStoryDatesPreviewRowSchema = z.discriminatedUnion("kind", [
  /** Dated from what the Engine saved for the piece's messages; the model did not read it. */
  z
    .object({
      kind: z.literal("engine"),
      ...ltmStoryDatesRowBase,
      chatId: z.string().min(1).max(120),
      title: z.string().max(240),
      storyTime: ltmStoryTimeSchema,
    })
    .strict(),
  /** What the model found in the piece text, after the server's checks. */
  z
    .object({
      kind: z.literal("scan"),
      ...ltmStoryDatesRowBase,
      chatId: z.string().min(1).max(120),
      title: z.string().max(240),
      stated: ltmStoryDatesStatedSchema.nullable(),
      jumps: z.array(ltmStoryTimeJumpSchema).max(100),
      /** Per jump: where the story stands after it once this preview is applied ("Day 23 · Friday"); null when not worked out. */
      reaches: z.array(z.string().min(1).max(600).nullable()).max(100),
    })
    .strict(),
]);

export const ltmStoryDatesRejectedReasonSchema = z.enum([
  // The piece is absent from the reply, or its entry has the wrong shape; it stays not checked.
  "missing",
  "unknown_id",
  "duplicate_id",
  "invalid",
  "quote_not_found",
  "date_not_in_quote",
  // A time of day or a relative word in the date.
  "not_a_date",
  "time_not_in_quote",
  "implied_without_morning",
  // Kept as a vague jump: the exact amount is not in the quote.
  "amount_not_in_quote",
  // Kept as "some time": the unit is not in the quote.
  "unit_not_in_quote",
  // A weekday named after a jump; the weekday is left out.
  "weekday_after_jump",
  // A date named after a jump; the jumps before it are left out.
  "jump_before_date",
]);
export const ltmStoryDatesRejectedSchema = z
  .object({
    /** Null when the reply named a piece that was not sent. */
    noteId: ltmNoteIdSchema.nullable(),
    kind: z.enum(["piece", "stated", "time", "jump"]),
    quote: z.string().max(240).optional(),
    reason: ltmStoryDatesRejectedReasonSchema,
  })
  .strict();

export const ltmStoryDatesPreviewResponseSchema = z
  .object({
    /** Chat pieces in the vault (not archived). */
    total: z.number().int().min(0),
    /** Pieces this batch dated from the Engine or the model answered for. */
    checked: z.number().int().min(0),
    /** Pieces this batch read that stay not checked: missing from a reply or in a failed call. */
    unchecked: z.number().int().min(0),
    truncated: z.boolean(),
    /** Position to carry on after (send it as `after`); null when nothing is left. */
    next: z.string().nullable(),
    failedChunks: z.number().int().min(0),
    pieces: z.array(ltmStoryDatesPreviewRowSchema).max(LTM_STORY_DATES_MAX_ROWS),
    rejected: z.array(ltmStoryDatesRejectedSchema),
  })
  .strict();

export const ltmStoryDatesApplyRowSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("engine"), ...ltmStoryDatesRowBase }).strict(),
  z
    .object({
      kind: z.literal("scan"),
      ...ltmStoryDatesRowBase,
      stated: ltmStoryDatesStatedSchema.nullable(),
      jumps: z.array(ltmStoryTimeJumpSchema).max(100),
    })
    .strict(),
]);

export const ltmStoryDatesApplyRequestSchema = z
  .object({
    rows: z
      .array(ltmStoryDatesApplyRowSchema)
      .min(1)
      .max(LTM_STORY_DATES_MAX_ROWS)
      .refine((rows) => new Set(rows.map((row) => row.noteId)).size === rows.length, {
        message: "Memory ids must be unique.",
      }),
  })
  .strict();

export const ltmStoryDatesApplyResponseSchema = z
  .object({
    applied: z.array(ltmNoteIdSchema),
    /** Rows not written: the piece is gone or archived, its text changed, or the Engine no longer dates it. */
    skipped: z
      .array(
        z
          .object({
            noteId: ltmNoteIdSchema,
            reason: z.enum(["missing", "not_a_chat_piece", "text_changed", "no_engine_date", "failed"]),
          })
          .strict(),
      )
      .max(LTM_STORY_DATES_MAX_ROWS),
    /** Entries of written rows that failed the checks again and were left out. */
    rejected: z.array(ltmStoryDatesRejectedSchema),
    rebuild: ltmAiCheckRebuildSchema.nullable(),
  })
  .strict();

export type LtmAiCheckScopeResponse = z.infer<typeof ltmAiCheckScopeResponseSchema>;
export type LtmTidySuggestion = z.infer<typeof ltmTidySuggestionSchema>;
export type LtmTidyPreviewResponse = z.infer<typeof ltmTidyPreviewResponseSchema>;
export type LtmTidyApplyRequest = z.infer<typeof ltmTidyApplyRequestSchema>;
export type LtmTidyApplyResponse = z.infer<typeof ltmTidyApplyResponseSchema>;
export type LtmStoryDatesStated = z.infer<typeof ltmStoryDatesStatedSchema>;
export type LtmStoryDatesScopeResponse = z.infer<typeof ltmStoryDatesScopeResponseSchema>;
export type LtmStoryDatesPreviewRow = z.infer<typeof ltmStoryDatesPreviewRowSchema>;
export type LtmStoryDatesRejected = z.infer<typeof ltmStoryDatesRejectedSchema>;
export type LtmStoryDatesPreviewResponse = z.infer<typeof ltmStoryDatesPreviewResponseSchema>;
export type LtmStoryDatesApplyRow = z.infer<typeof ltmStoryDatesApplyRowSchema>;
export type LtmStoryDatesApplyResponse = z.infer<typeof ltmStoryDatesApplyResponseSchema>;
