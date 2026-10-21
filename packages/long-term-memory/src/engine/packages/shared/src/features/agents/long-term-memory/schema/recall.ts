import { z } from "zod";
import { ltmIsoTimestampSchema, ltmNoteIdSchema, ltmSectionKeySchema, ltmStringRecordSchema } from "./primitives.js";

const ltmUsageChunkSchema = z
  .object({
    chunkId: z.string().min(1).max(240),
    noteId: ltmNoteIdSchema,
    sectionKey: ltmSectionKeySchema,
    lastRetrievedAt: ltmIsoTimestampSchema,
    lastInjectedAt: ltmIsoTimestampSchema,
    retrievalCount: z.number().int().min(0),
    injectionCount: z.number().int().min(0),
    totalInjectedTokens: z.number().int().min(0),
  })
  .strict();

export const ltmUsageSchema = z
  .object({
    version: z.literal(2),
    chats: ltmStringRecordSchema(
      z.string().min(1).max(120),
      z
        .object({
          chunks: ltmStringRecordSchema(z.string().min(1).max(240), ltmUsageChunkSchema),
        })
        .strict(),
    ),
    acceptedReceipts: ltmStringRecordSchema(
      z.string().min(1).max(240),
      z.union([ltmIsoTimestampSchema, z.literal(true)]),
    ).optional(),
  })
  .strict();

export type LtmUsage = z.infer<typeof ltmUsageSchema>;

export const ltmLastInjectionMemorySchema = z.object({
  noteId: z.string(),
  title: z.string(),
  tokenCount: z.number(),
  sectionKey: ltmSectionKeySchema.optional(),
  sourceNoteId: ltmNoteIdSchema.optional(),
  sourceTitle: z.string().optional(),
});

export const ltmInjectionUiSummarySchema = z.object({
  memoryCount: z.number().default(0),
  tokenCount: z.number().default(0),
  memories: z.array(ltmLastInjectionMemorySchema).default([]),
});

export const ltmRecallAttemptOutcomeSchema = z.enum(["completed", "skipped", "cancelled", "failed"]);

// Package-owned trace of one recall call. Only outcomes the package directly
// observed are recorded; a missing attempt means the host never invoked recall.
export const ltmRecallAttemptSchema = z
  .object({
    version: z.literal(1),
    chatId: z.string().max(200),
    attemptId: z.string().uuid(),
    at: ltmIsoTimestampSchema,
    outcome: ltmRecallAttemptOutcomeSchema,
    reason: z.string().max(120).optional(),
    debugEnabled: z.boolean().default(false),
    receiptId: z.string().uuid().optional(),
  })
  .strict();

export const ltmLastInjectionAttemptSchema = ltmRecallAttemptSchema.extend({
  confirmed: z.boolean().default(false),
});

export const ltmLastInjectionResponseSchema = z.object({
  memoryCount: z.number(),
  tokenCount: z.number(),
  memories: z.array(ltmLastInjectionMemorySchema),
  state: z.enum(["injected", "no_matches", "not_recorded"]).default("not_recorded"),
  dispatchedAt: ltmIsoTimestampSchema.nullable().default(null),
  attempt: ltmLastInjectionAttemptSchema.nullable().default(null),
});

/**
 * Why the semantic lane did or did not contribute to one recall. It separates a
 * lane that is switched off from a provider that is unavailable, an index built
 * for a different embedding space, and a valid index that simply matched nothing.
 */
export type LtmSemanticOutcome = "disabled" | "unavailable" | "incompatible" | "no_matches" | "contributed";

/** How one recall obtained its index, as observed by the loader that produced it. */
export type LtmIndexLoadOutcome = "loaded" | "upgraded" | "rebuilt" | "preloaded";
export type LtmLastInjectionMemory = z.infer<typeof ltmLastInjectionMemorySchema>;
export type LtmRecallAttemptOutcome = z.infer<typeof ltmRecallAttemptOutcomeSchema>;
export type LtmRecallAttempt = z.infer<typeof ltmRecallAttemptSchema>;
export type LtmLastInjectionAttempt = z.infer<typeof ltmLastInjectionAttemptSchema>;
export type LtmLastInjectionResponse = z.infer<typeof ltmLastInjectionResponseSchema>;
