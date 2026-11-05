import { z } from "zod";
import {
  ltmIdentifierSchema,
  ltmImportanceSchema,
  ltmIsoTimestampSchema,
  ltmModeSchema,
  ltmNoteIdSchema,
  ltmNoteTitleSchema,
  ltmNoteTypeSchema,
  ltmRelationshipDimensionChangesSchema,
  ltmRelationshipDimensionsSchema,
  ltmSafeRelativePathSchema,
  ltmScopeSchema,
  ltmSectionKeySchema,
  ltmStatusSchema,
  ltmStringRecordSchema,
} from "./primitives.js";

export const ltmIndexHealthSchema = z.enum(["not_built", "healthy", "degraded", "stale", "corrupt"]);

export const ltmMemoryChunkSchema = z
  .object({
    id: z.string().min(1).max(240),
    noteId: ltmNoteIdSchema,
    title: ltmNoteTitleSchema.optional(),
    sectionKey: ltmSectionKeySchema,
    text: z.string().min(1).max(20_000),
    noteType: ltmNoteTypeSchema,
    status: ltmStatusSchema,
    modes: z.array(ltmModeSchema).min(1).max(8),
    scope: ltmScopeSchema,
    tags: z.array(ltmIdentifierSchema).max(100),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30),
    salience: z.number().finite().min(0).max(1).optional(),
    confidence: z.number().finite().min(0).max(1).optional(),
    importance: ltmImportanceSchema.optional(),
    dimensions: ltmRelationshipDimensionsSchema.optional(),
    dimensionChanges: ltmRelationshipDimensionChangesSchema.optional(),
    updatedAt: ltmIsoTimestampSchema,
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const ltmEmbeddingIndexEntrySchema = z
  .object({
    chunkId: z.string().min(1).max(240),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    /** Hash of the embedded text. A rebuild reuses the vector of a chunk whose text hash is unchanged. */
    textHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    vector: z.array(z.number().finite()).min(1).optional(),
  })
  .strict();

export const ltmEmbeddingIndexSchema = z
  .object({
    version: z.literal(1),
    spaceId: z.string().min(1).max(240).optional(),
    model: z.string().min(1).max(240),
    dimension: z.number().int().min(1).nullable(),
    embeddedChunkCount: z.number().int().min(0),
    chunks: z.array(ltmEmbeddingIndexEntrySchema),
    /** Optional for pre-Phase 10 generations. New generations index entries by chunk ID. */
    byChunkId: z.record(z.string().min(1).max(240), z.number().int().min(0)).optional(),
  })
  .strict()
  .superRefine((index, ctx) => {
    const chunkIds = new Set<string>();
    let vectorCount = 0;
    for (const [entryIndex, entry] of index.chunks.entries()) {
      if (chunkIds.has(entry.chunkId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", entryIndex, "chunkId"],
          message: `Duplicate embedding chunk id: ${entry.chunkId}`,
        });
      }
      chunkIds.add(entry.chunkId);
      if (!entry.vector) continue;
      vectorCount += 1;
      if (index.dimension !== entry.vector.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chunks", entryIndex, "vector"],
          message: `Embedding vector dimension ${entry.vector.length} does not match ${index.dimension ?? "null"}.`,
        });
      }
    }
    if (vectorCount !== index.embeddedChunkCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["embeddedChunkCount"],
        message: `Embedded chunk count ${index.embeddedChunkCount} does not match ${vectorCount} vectors.`,
      });
    }
    if (vectorCount === 0 && index.dimension !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimension"],
        message: "Embedding dimension must be null when no vectors are stored.",
      });
    }
    if (vectorCount === 0 && index.spaceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["spaceId"],
        message: "Embedding spaceId must be omitted when no vectors are stored.",
      });
    }
    if (vectorCount > 0 && !index.spaceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["spaceId"],
        message: "Embedding spaceId is required when vectors are stored.",
      });
    }
    if (index.byChunkId) {
      if (Object.keys(index.byChunkId).length !== index.chunks.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["byChunkId"],
          message: "Embedding chunk catalog must contain every embedding entry.",
        });
      }
      for (const [chunkId, entryIndex] of Object.entries(index.byChunkId)) {
        if (index.chunks[entryIndex]?.chunkId !== chunkId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["byChunkId", chunkId],
            message: `Embedding chunk catalog entry ${chunkId} does not match its index position.`,
          });
        }
      }
    }
  });

export const ltmBm25PostingSchema = z
  .object({
    chunkId: z.string().min(1).max(240),
    count: z.number().int().min(1),
  })
  .strict();

export const ltmBm25IndexSchema = z
  .object({
    version: z.literal(1),
    chunkCount: z.number().int().min(0),
    avgDocLength: z.number().finite().min(0),
    documents: ltmStringRecordSchema(
      z.string().min(1).max(240),
      z.object({ length: z.number().int().min(0) }).strict(),
    ),
    terms: ltmStringRecordSchema(
      z.string().min(1),
      z
        .object({
          documentFrequency: z.number().int().min(0),
          postings: z.array(ltmBm25PostingSchema),
        })
        .strict(),
    ),
  })
  .strict();

export const ltmGraphEdgeSchema = z
  .object({
    source: ltmNoteIdSchema,
    target: ltmNoteIdSchema,
    relation: z.string().min(1).max(80),
  })
  .strict();

export const ltmGraphIndexSchema = z
  .object({
    version: z.literal(1),
    nodes: z.record(
      ltmNoteIdSchema,
      z
        .object({
          chunkIds: z.array(z.string().min(1).max(240)),
          outgoing: z.array(ltmGraphEdgeSchema),
          incoming: z.array(ltmGraphEdgeSchema),
        })
        .strict(),
    ),
  })
  .strict();

const ltmIndexStringBucketsSchema = ltmStringRecordSchema(
  z.string().min(1).max(240),
  z.array(z.string().min(1).max(240)),
);

export const ltmKeywordIndexSchema = z
  .object({
    version: z.literal(1),
    byKeyword: ltmIndexStringBucketsSchema,
    byChunkId: ltmIndexStringBucketsSchema,
  })
  .strict();

const ltmMetadataIndexShape = z
  .object({
    version: z.literal(1),
    chunks: ltmStringRecordSchema(z.string().min(1).max(240), ltmMemoryChunkSchema),
    byNoteId: ltmIndexStringBucketsSchema,
    byTag: ltmIndexStringBucketsSchema,
  })
  .strict();

export const ltmMetadataIndexSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const {
    byType: _byType,
    byStatus: _byStatus,
    byMode: _byMode,
    byScope: _byScope,
    ...rest
  } = value as Record<string, unknown>;
  return rest;
}, ltmMetadataIndexShape);

export const ltmIndexRebuildStateSchema = z.enum(["idle", "building", "failed"]);

const ltmIndexStateShape = z
  .object({
    version: z.literal(1),
    revision: z.number().int().min(0).default(0),
    dirty: z.boolean().default(true),
    dirtyAt: ltmIsoTimestampSchema.optional(),
    rebuildState: ltmIndexRebuildStateSchema.default("idle"),
    rebuildStartedAt: ltmIsoTimestampSchema.optional(),
    rebuildCompletedAt: ltmIsoTimestampSchema.optional(),
    error: z.string().min(1).max(2_000).optional(),
  })
  .strict();

export const ltmIndexStateSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { lastPublishedGenerationId: _lastPublishedGenerationId, ...rest } = value as Record<string, unknown>;
  return rest;
}, ltmIndexStateShape);

export const ltmStatusResponseSchema = z
  .object({
    initialized: z.boolean(),
    directory: z.string().min(1).max(240),
    notes: z
      .object({
        total: z.number().int().min(0),
        sourceNotes: z.number().int().min(0).default(0),
        savedMemories: z.number().int().min(0).default(0),
        pendingDrafts: z.number().int().min(0).default(0),
        byType: z.record(z.string().min(1), z.number().int().min(0)),
        byStatus: z.record(z.string().min(1), z.number().int().min(0)),
      })
      .strict(),
    events: z
      .object({
        logAvailable: z.boolean(),
        bytes: z.number().int().min(0).nullable(),
      })
      .strict(),
    indexes: z
      .object({
        health: ltmIndexHealthSchema,
        dirty: z.boolean(),
        rebuildState: ltmIndexRebuildStateSchema,
        errors: z.array(
          z
            .object({
              index: z.string().min(1).max(120),
              code: z.string().min(1).max(120),
            })
            .strict(),
        ),
        warnings: z.array(z.string().min(1).max(2_000)),
        generatedAt: ltmIsoTimestampSchema.nullable(),
        sourceHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
        noteCount: z.number().int().min(0).nullable(),
        chunkCount: z.number().int().min(0).nullable(),
        chunkFormatVersion: z.number().int().min(1).nullable(),
        embeddingsAvailable: z.boolean(),
        embeddedChunkCount: z.number().int().min(0),
        /** Label of the source recall would embed with now; null when none resolves. */
        embeddingSource: z.string().min(1).max(240).nullable(),
        /** Label of the source the stored vectors came from; null when the index has none. */
        indexedEmbeddingSource: z.string().min(1).max(240).nullable(),
      })
      .strict(),
  })
  .strict();

export const ltmIntegrityIssueSchema = z
  .object({
    severity: z.enum(["info", "warning", "error"]),
    code: z.string().min(1).max(120),
    path: ltmSafeRelativePathSchema.optional(),
    noteId: ltmNoteIdSchema.optional(),
    message: z.string().min(1).max(2_000),
  })
  .strict();

export const ltmIntegrityResponseSchema = z
  .object({
    ok: z.boolean(),
    health: ltmIndexHealthSchema,
    checkedAt: ltmIsoTimestampSchema,
    noteCount: z.number().int().min(0),
    eventCount: z.number().int().min(0),
    issues: z.array(ltmIntegrityIssueSchema).max(10_000),
  })
  .strict();

export const ltmRepairActionSchema = z.enum([
  "rebuild_indexes",
  "quarantine_malformed_notes",
  "backfill_imported_source_titles",
]);

export const ltmRepairRequestSchema = z
  .object({
    actions: z
      .array(ltmRepairActionSchema)
      .min(1)
      .max(3)
      .refine((actions) => new Set(actions).size === actions.length, "Repair actions must be unique."),
  })
  .strict();

export const ltmRepairActionResultSchema = z
  .object({
    action: ltmRepairActionSchema,
    result: z.enum(["rebuilt", "backfilled", "no_titles_to_backfill", "quarantined", "no_malformed_notes"]),
    count: z.number().int().min(0).optional(),
  })
  .strict();

export const ltmRepairResponseSchema = z
  .object({
    repairedAt: ltmIsoTimestampSchema,
    actions: z.array(ltmRepairActionResultSchema).min(1).max(3),
    integrity: ltmIntegrityResponseSchema,
  })
  .strict();
export type LtmIndexHealth = z.infer<typeof ltmIndexHealthSchema>;
export type LtmMemoryChunk = z.infer<typeof ltmMemoryChunkSchema>;
export type LtmEmbeddingIndexEntry = z.infer<typeof ltmEmbeddingIndexEntrySchema>;
export type LtmEmbeddingIndex = z.infer<typeof ltmEmbeddingIndexSchema>;
export type LtmBm25Posting = z.infer<typeof ltmBm25PostingSchema>;
export type LtmBm25Index = z.infer<typeof ltmBm25IndexSchema>;
export type LtmGraphEdge = z.infer<typeof ltmGraphEdgeSchema>;
export type LtmGraphIndex = z.infer<typeof ltmGraphIndexSchema>;
export type LtmKeywordIndex = z.infer<typeof ltmKeywordIndexSchema>;
export type LtmMetadataIndex = z.infer<typeof ltmMetadataIndexSchema>;
export type LtmIndexRebuildState = z.infer<typeof ltmIndexRebuildStateSchema>;
export type LtmIndexState = z.infer<typeof ltmIndexStateSchema>;
export type LtmStatusResponse = z.infer<typeof ltmStatusResponseSchema>;
export type LtmIntegrityIssue = z.infer<typeof ltmIntegrityIssueSchema>;
export type LtmIntegrityResponse = z.infer<typeof ltmIntegrityResponseSchema>;
export type LtmRepairAction = z.infer<typeof ltmRepairActionSchema>;
export type LtmRepairRequest = z.infer<typeof ltmRepairRequestSchema>;
export type LtmRepairActionResult = z.infer<typeof ltmRepairActionResultSchema>;
export type LtmRepairResponse = z.infer<typeof ltmRepairResponseSchema>;
