import { z } from "zod";
import {
  ltmInteropSourceSchema,
  ltmModeSchema,
  ltmNoteIdSchema,
  ltmScopeSchema,
  ltmSourceProvenanceSchema,
} from "./primitives.js";
import { ltmNoteSchema } from "./notes.js";
import {
  ltmExtractionAccountingSchema,
  ltmExtractionDiagnosticSchema,
  ltmExtractionDraftSchema,
  ltmExtractionOutcomeSchema,
} from "./drafts.js";

const ltmPreviewQuerySchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().max(200).optional(),
);

export const ltmInteropPreviewRequestSchema = z
  .object({
    source: ltmInteropSourceSchema,
    limit: z.number().int().min(1).max(100).default(100),
    sourceScope: ltmScopeSchema.optional(),
    // Kept for clients built against the Phase 1 request contract.
    scope: ltmScopeSchema.optional(),
    mode: ltmModeSchema.optional(),
    query: ltmPreviewQuerySchema,
    cursor: z.string().min(1).max(2048).optional(),
    // Chat Messages only: list the history of one branch of the scoped chat group.
    branchChatId: z.string().min(1).max(200).optional(),
  })
  .strict();

const ltmInteropPreviewSampleBaseSchema = z.object({
  sourceId: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  importMode: ltmModeSchema,
  mutationCount: z.number().int().min(0).max(10_000),
  summary: z.string().max(2_000),
  snippet: z.string().max(280),
  // Chat Messages pieces only: lets a row keep the range visible when its chat name is cut.
  messageRange: z
    .object({ chatName: z.string().min(1).max(240), first: z.number().int().min(1), last: z.number().int().min(1) })
    .strict()
    .refine((range) => range.last >= range.first)
    .optional(),
  // Chat Summaries rows without a numbered message range; a sample sets at most one of the two fields.
  summaryRange: z
    .object({ chatName: z.string().min(1).max(240), label: z.string().min(1).max(80) })
    .strict()
    .optional(),
});

export const ltmInteropPreviewFreshnessSchema = z.enum([
  "new",
  "current",
  "source_updated",
  "context_updated",
  "extraction_incomplete",
]);

export const ltmInteropPreviewSampleSchema = z.discriminatedUnion("status", [
  ltmInteropPreviewSampleBaseSchema
    .extend({
      status: z.literal("pending"),
      freshness: z.literal("new"),
    })
    .strict(),
  ltmInteropPreviewSampleBaseSchema
    .extend({
      status: z.literal("imported"),
      freshness: ltmInteropPreviewFreshnessSchema.exclude(["new"]),
      existingNoteId: ltmNoteIdSchema,
      existingNoteTitle: z.string().min(1).max(240),
    })
    .strict(),
]);

// A source note whose source no preview candidate matches any more. Only reported by an unfiltered first page.
export const ltmInteropPreviewOutdatedSchema = z
  .object({
    noteId: ltmNoteIdSchema,
    title: z.string().min(1).max(240),
    provenance: ltmSourceProvenanceSchema,
  })
  .strict();

export const ltmInteropPreviewResponseSchema = z
  .object({
    source: ltmInteropSourceSchema,
    scanned: z.number().int().min(0).max(100),
    draftable: z.number().int().min(0).max(100),
    importedCount: z.number().int().min(0).max(100),
    samples: z.array(ltmInteropPreviewSampleSchema).max(100),
    totals: z
      .object({
        matches: z.number().int().min(0).max(1_000_000),
        ready: z.number().int().min(0).max(1_000_000),
        imported: z.number().int().min(0).max(1_000_000),
      })
      .strict(),
    outdated: z.array(ltmInteropPreviewOutdatedSchema).max(1_000).optional(),
    truncated: z.boolean(),
    hasMore: z.boolean().optional(),
    nextCursor: z.string().max(2048).nullable().optional(),
  })
  .strict()
  .superRefine((response, ctx) => {
    const pending = response.samples.filter((sample) => sample.status === "pending").length;
    const imported = response.samples.length - pending;
    for (const [key, actual, expected] of [
      ["scanned", response.scanned, response.samples.length],
      ["draftable", response.draftable, pending],
      ["importedCount", response.importedCount, imported],
    ] as const) {
      if (actual !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} does not match the returned preview rows.`,
        });
      }
    }
  });

export const ltmLorebookPreviewRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(100),
    sourceScope: ltmScopeSchema.optional(),
    // Kept for clients built against the Phase 1 request contract.
    scope: ltmScopeSchema.optional(),
    mode: ltmModeSchema.optional(),
    query: ltmPreviewQuerySchema,
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict();

export const ltmLorebookPreviewEntrySchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(240),
    candidateCount: z.number().int().min(1).max(10_000),
    candidates: z.array(ltmInteropPreviewSampleSchema).min(1).max(10_000),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.candidateCount !== entry.candidates.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["candidateCount"],
        message: "candidateCount does not match the returned entry chunks.",
      });
    }
  });

const ltmLorebookPreviewCountsSchema = z
  .object({
    entries: z.number().int().min(0).max(1_000_000),
    candidates: z.number().int().min(0).max(1_000_000),
    pending: z.number().int().min(0).max(1_000_000),
    imported: z.number().int().min(0).max(1_000_000),
  })
  .strict();

function validateLorebookPreviewCounts(
  counts: z.infer<typeof ltmLorebookPreviewCountsSchema>,
  expected: {
    entries: number;
    candidates: number;
    pending: number;
    imported: number;
  },
  ctx: z.RefinementCtx,
) {
  for (const key of ["entries", "candidates", "pending", "imported"] as const) {
    if (counts[key] !== expected[key])
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["counts", key],
        message: `${key} does not match the returned lorebook entries.`,
      });
  }
}

export const ltmLorebookPreviewBookSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(240),
    description: z.string().max(600),
    category: z.string().min(1).max(120),
    tags: z.array(z.string().min(1).max(120)).max(100),
    scope: ltmScopeSchema,
    counts: ltmLorebookPreviewCountsSchema,
    totals: ltmLorebookPreviewCountsSchema,
    entries: z.array(ltmLorebookPreviewEntrySchema).max(10_000),
  })
  .strict()
  .superRefine((book, ctx) => {
    const candidates = book.entries.flatMap((entry) => entry.candidates);
    validateLorebookPreviewCounts(
      book.counts,
      {
        entries: book.entries.length,
        candidates: candidates.length,
        pending: candidates.filter((candidate) => candidate.status === "pending").length,
        imported: candidates.filter((candidate) => candidate.status === "imported").length,
      },
      ctx,
    );
  });

export const ltmLorebookPreviewResponseSchema = z
  .object({
    counts: ltmLorebookPreviewCountsSchema.extend({
      books: z.number().int().min(0).max(100),
    }),
    books: z.array(ltmLorebookPreviewBookSchema).max(100),
    totals: ltmLorebookPreviewCountsSchema.extend({
      books: z.number().int().min(0).max(1_000_000),
    }),
    outdated: z.array(ltmInteropPreviewOutdatedSchema).max(1_000).optional(),
    truncated: z.boolean(),
    hasMore: z.boolean().optional(),
    nextCursor: z.string().max(2048).nullable().optional(),
  })
  .strict()
  .superRefine((response, ctx) => {
    validateLorebookPreviewCounts(
      response.counts,
      {
        entries: response.books.reduce((total, book) => total + book.counts.entries, 0),
        candidates: response.books.reduce((total, book) => total + book.counts.candidates, 0),
        pending: response.books.reduce((total, book) => total + book.counts.pending, 0),
        imported: response.books.reduce((total, book) => total + book.counts.imported, 0),
      },
      ctx,
    );
    if (response.counts.books !== response.books.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["counts", "books"],
        message: "books does not match the returned lorebooks.",
      });
  });

export const ltmSourceDetailsRequestSchema = z
  .object({
    source: ltmInteropSourceSchema,
    sourceIds: z
      .array(z.string().min(1).max(120))
      .min(1)
      .max(100)
      .refine((sourceIds) => new Set(sourceIds).size === sourceIds.length, "Source ids must be unique."),
    sourceScope: ltmScopeSchema.optional(),
    // Kept for clients built against the Phase 1 request contract.
    scope: ltmScopeSchema.optional(),
    mode: ltmModeSchema.optional(),
    chatId: z.string().min(1).max(120).optional(),
  })
  .strict();

const ltmSourceDetailContentSchema = z.object({ content: z.string().min(1).max(500_000) }).strict();

export const ltmSourceDetailSchema = z.discriminatedUnion("status", [
  ltmInteropPreviewSampleBaseSchema
    .extend({
      status: z.literal("pending"),
      freshness: z.literal("new"),
      ...ltmSourceDetailContentSchema.shape,
    })
    .strict(),
  ltmInteropPreviewSampleBaseSchema
    .extend({
      status: z.literal("imported"),
      freshness: ltmInteropPreviewFreshnessSchema.exclude(["new"]),
      existingNoteId: ltmNoteIdSchema,
      existingNoteTitle: z.string().min(1).max(240),
      ...ltmSourceDetailContentSchema.shape,
    })
    .strict(),
]);

export const ltmSourceDetailsResponseSchema = z
  .object({
    source: ltmInteropSourceSchema,
    details: z.array(ltmSourceDetailSchema).max(100),
    missingSourceIds: z.array(z.string().min(1).max(120)).max(100),
  })
  .strict();

export const ltmImportSourceNotesRequestSchema = z
  .object({
    source: ltmInteropSourceSchema,
    sourceIds: z
      .array(z.string().min(1).max(120))
      .min(1)
      .max(100)
      .refine((sourceIds) => new Set(sourceIds).size === sourceIds.length, "Source ids must be unique."),
    limit: z.number().int().min(1).max(100).default(100),
    sourceScope: ltmScopeSchema.optional(),
    destinationScope: ltmScopeSchema.optional(),
    // Kept for clients built against the Phase 1 request contract.
    scope: ltmScopeSchema.optional(),
    connectionId: z.string().min(1).max(120).optional(),
    model: z.string().min(1).max(240).optional(),
    instruction: z.string().max(2_000).optional(),
    chatId: z.string().min(1).max(120).optional(),
    applyLowRisk: z.boolean().optional(),
    extract: z.boolean().default(true),
    importConcurrency: z.number().int().min(1).max(10).optional(),
    mode: ltmModeSchema.optional(),
    modes: z.array(ltmModeSchema).min(1).max(3).optional(),
  })
  .strict();

const ltmImportedSourceResultBaseSchema = z.object({
  sourceId: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  note: ltmNoteSchema,
  created: z.boolean(),
  sourceWriteStatus: z.enum(["created", "refreshed"]),
  extractionMode: ltmModeSchema,
  extractionMethod: z.enum(["llm", "deterministic", "none"]),
  outcome: ltmExtractionOutcomeSchema,
  accounting: ltmExtractionAccountingSchema,
  appliedMutationIds: z.array(z.string().uuid()).max(500),
  skippedMutationIds: z.array(z.string().uuid()).max(500),
});

export const ltmImportedSourceResultSchema = z
  .discriminatedUnion("extractionStatus", [
    ltmImportedSourceResultBaseSchema
      .extend({
        extractionStatus: z.literal("succeeded"),
        retryable: z.literal(false),
        draft: ltmExtractionDraftSchema.nullable(),
        diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500),
      })
      .strict(),
    ltmImportedSourceResultBaseSchema
      .extend({
        extractionStatus: z.literal("incomplete"),
        retryable: z.literal(true),
        draft: ltmExtractionDraftSchema,
        diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500),
      })
      .strict(),
    ltmImportedSourceResultBaseSchema
      .extend({
        extractionStatus: z.literal("failed"),
        retryable: z.boolean(),
        error: z
          .object({
            code: z.string().min(1).max(120),
            message: z.string().min(1).max(2_000),
          })
          .strict(),
        draft: z.null(),
        diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500),
      })
      .strict(),
    ltmImportedSourceResultBaseSchema
      .extend({
        extractionStatus: z.literal("cancelled"),
        retryable: z.literal(true),
        error: z
          .object({
            code: z.literal("cancelled"),
            message: z.string().min(1).max(2_000),
          })
          .strict(),
        draft: z.null(),
        diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500),
      })
      .strict(),
    ltmImportedSourceResultBaseSchema
      .extend({
        extractionStatus: z.literal("not_started"),
        retryable: z.literal(false),
        draft: z.null(),
        diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500),
      })
      .strict(),
  ])
  .superRefine((result, ctx) => {
    if (result.created !== (result.sourceWriteStatus === "created")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceWriteStatus"],
        message: "Source write status must agree with whether the note was created or refreshed.",
      });
    }
  });

export const ltmImportSourceWriteFailureSchema = z
  .object({
    sourceId: z.string().min(1).max(120),
    title: z.string().min(1).max(240),
    sourceWriteStatus: z.literal("failed"),
    extractionStatus: z.literal("not_started"),
    retryable: z.boolean(),
    error: z
      .object({
        code: z.enum(["source_write_failed", "ltm_source_destination_conflict", "ltm_source_identity_conflict"]),
        message: z.string().min(1).max(2_000),
      })
      .strict(),
  })
  .strict()
  .superRefine((failure, ctx) => {
    if (failure.retryable !== (failure.error.code === "source_write_failed"))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retryable"],
        message: "Source identity and destination conflicts are not retryable; source write failures are retryable.",
      });
  });

export const ltmImportSourceNotesBatchStatusSchema = z.enum(["success", "partial_success", "failed", "cancelled"]);

export const ltmImportSourceNotesResponseSchema = z
  .object({
    operationId: z.string().uuid(),
    batchStatus: ltmImportSourceNotesBatchStatusSchema,
    source: ltmInteropSourceSchema,
    imported: z.array(ltmImportedSourceResultSchema).max(100),
    writeFailures: z.array(ltmImportSourceWriteFailureSchema).max(100),
    missingSourceIds: z.array(z.string().min(1).max(120)).max(100),
    counts: z
      .object({
        requested: z.number().int().min(0).max(100),
        sourceNotesWritten: z.number().int().min(0).max(100),
        succeeded: z.number().int().min(0).max(100),
        failed: z.number().int().min(0).max(100),
        cancelled: z.number().int().min(0).max(100),
        missing: z.number().int().min(0).max(100),
        sourceWriteFailed: z.number().int().min(0).max(100),
      })
      .strict(),
  })
  .strict()
  .superRefine((response, ctx) => {
    const expected = {
      requested: response.imported.length + response.writeFailures.length + response.missingSourceIds.length,
      sourceNotesWritten: response.imported.length,
      succeeded: response.imported.filter((item) => item.extractionStatus === "succeeded").length,
      failed: response.imported.filter((item) => item.extractionStatus === "failed").length,
      cancelled: response.imported.filter((item) => item.extractionStatus === "cancelled").length,
      missing: response.missingSourceIds.length,
      sourceWriteFailed: response.writeFailures.length,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (response.counts[key as keyof typeof expected] !== value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["counts", key],
          message: `${key} does not match the returned item outcomes.`,
        });
      }
    }
    const incomplete =
      response.counts.failed + response.counts.cancelled + response.counts.missing + response.counts.sourceWriteFailed;
    const hasIncomplete = response.imported.some((item) => item.extractionStatus === "incomplete");
    const expectedBatchStatus =
      incomplete === 0 && !hasIncomplete
        ? "success"
        : response.counts.succeeded > 0 || hasIncomplete
          ? "partial_success"
          : response.counts.cancelled > 0 &&
              response.counts.failed === 0 &&
              response.counts.missing === 0 &&
              response.counts.sourceWriteFailed === 0
            ? "cancelled"
            : "failed";
    if (response.batchStatus !== expectedBatchStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batchStatus"],
        message: `Batch status must be ${expectedBatchStatus} for the returned item outcomes.`,
      });
    }
  });
export type LtmInteropPreviewRequest = z.infer<typeof ltmInteropPreviewRequestSchema>;
export type LtmInteropPreviewSample = z.infer<typeof ltmInteropPreviewSampleSchema>;
export type LtmInteropPreviewFreshness = z.infer<typeof ltmInteropPreviewFreshnessSchema>;
export type LtmInteropPreviewOutdated = z.infer<typeof ltmInteropPreviewOutdatedSchema>;
export type LtmInteropPreviewResponse = z.infer<typeof ltmInteropPreviewResponseSchema>;
export type LtmLorebookPreviewRequest = z.infer<typeof ltmLorebookPreviewRequestSchema>;
export type LtmLorebookPreviewEntry = z.infer<typeof ltmLorebookPreviewEntrySchema>;
export type LtmLorebookPreviewBook = z.infer<typeof ltmLorebookPreviewBookSchema>;
export type LtmLorebookPreviewResponse = z.infer<typeof ltmLorebookPreviewResponseSchema>;
export type LtmSourceDetailsRequest = z.infer<typeof ltmSourceDetailsRequestSchema>;
export type LtmSourceDetail = z.infer<typeof ltmSourceDetailSchema>;
export type LtmSourceDetailsResponse = z.infer<typeof ltmSourceDetailsResponseSchema>;
export type LtmImportSourceNotesRequest = z.infer<typeof ltmImportSourceNotesRequestSchema>;
export type LtmImportedSourceResult = z.infer<typeof ltmImportedSourceResultSchema>;
export type LtmImportSourceWriteFailure = z.infer<typeof ltmImportSourceWriteFailureSchema>;
export type LtmImportSourceNotesBatchStatus = z.infer<typeof ltmImportSourceNotesBatchStatusSchema>;
export type LtmImportSourceNotesResponse = z.infer<typeof ltmImportSourceNotesResponseSchema>;
