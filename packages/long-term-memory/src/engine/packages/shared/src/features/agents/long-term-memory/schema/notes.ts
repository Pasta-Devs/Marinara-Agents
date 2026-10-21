import { z } from "zod";
import {
  allowedStoredNoteIdPrefixes,
  hasLocalCharacterSubject,
  isLtmSourceLikeNote,
  LTM_NOTE_TYPE_TO_VAULT_FOLDER,
  ltmClaimKindSchema,
  ltmEvidenceUnitBucketSchema,
  ltmEvidenceUnitStatusSchema,
  ltmEvidenceUnitTitleSchema,
  ltmExtractionFingerprintSchema,
  ltmIdentifierSchema,
  ltmImportanceSchema,
  ltmIsoTimestampSchema,
  ltmLinkSchema,
  ltmModeSchema,
  ltmNoteIdSchema,
  ltmNoteTitleSchema,
  ltmNoteTypeSchema,
  ltmRelationshipDimensionChangesSchema,
  ltmRelationshipDimensionsSchema,
  ltmSafeRelativePathSchema,
  ltmScopeSchema,
  ltmSectionKeySchema,
  ltmSourceProvenanceSchema,
  ltmStatusSchema,
  ltmSubjectsSchema,
  ltmVaultFolderSchema,
  ltmWriteScopeSchema,
} from "./primitives.js";

export const ltmNoteTransferModeSchema = z.enum(["copy", "move"]);

export const ltmNoteTransferConflictSeveritySchema = z.enum(["hard", "soft"]);

export const ltmNoteTransferConflictReasonSchema = z.enum(["exact_text", "same_source_type", "lexical_overlap"]);

export const ltmNoteTransferConflictSchema = z
  .object({
    noteId: ltmNoteIdSchema,
    targetNoteId: ltmNoteIdSchema,
    targetTitle: z.string().min(1).max(240),
    targetType: ltmNoteTypeSchema,
    targetPreview: z.string().max(600).optional(),
    severity: ltmNoteTransferConflictSeveritySchema,
    reason: ltmNoteTransferConflictReasonSchema,
    score: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

export const ltmNoteTransferPreviewItemSchema = z
  .object({
    noteId: ltmNoteIdSchema,
    title: z.string().min(1).max(240),
    type: ltmNoteTypeSchema,
    previewText: z.string().max(600),
    scope: ltmScopeSchema,
    nextScope: ltmScopeSchema,
    derived: z.boolean().default(false),
    sourceNoteId: ltmNoteIdSchema.optional(),
    sourceNoteIds: z.array(ltmNoteIdSchema).max(250).optional(),
    classification: z.enum(["ready", "no_op", "conflict"]),
    defaultIncluded: z.boolean(),
    reason: z.string().min(1).max(240).optional(),
    conflicts: z.array(ltmNoteTransferConflictSchema).max(3).default([]),
  })
  .strict();

export const ltmNoteTransferPreviewRequestSchema = z
  .object({
    noteIds: z.array(ltmNoteIdSchema).min(1).max(500),
    mode: ltmNoteTransferModeSchema,
    destinationChatId: z.string().min(1).max(120),
    derivedNoteIds: z
      .array(ltmNoteIdSchema)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, "Derived note IDs must be unique.")
      .optional(),
    includeDerived: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const requested = new Set(value.noteIds);
    if (value.derivedNoteIds?.some((id) => requested.has(id)))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["derivedNoteIds"],
        message: "Requested and derived transfer IDs must be disjoint.",
      });
  });

export const ltmNoteTransferPreviewResponseSchema = z
  .object({
    mode: ltmNoteTransferModeSchema,
    destinationChatId: z.string().min(1).max(120),
    selection: z
      .object({
        requestedNoteCount: z.number().int().min(0),
        totalNoteCount: z.number().int().min(0),
        requestedNoteIds: z.array(ltmNoteIdSchema).max(500),
        availableDerivedCount: z.number().int().min(0),
        includedDerivedCount: z.number().int().min(0),
        derivedNoteIds: z.array(ltmNoteIdSchema).max(500),
        includeDerived: z.boolean(),
      })
      .strict(),
    buckets: z
      .object({
        ready: z.array(ltmNoteIdSchema).max(500),
        noOp: z.array(ltmNoteIdSchema).max(500),
        conflict: z.array(ltmNoteIdSchema).max(500),
      })
      .strict(),
    items: z.array(ltmNoteTransferPreviewItemSchema).max(500),
  })
  .strict();

export const ltmNoteTransferApplyRequestSchema = z
  .object({
    requestedNoteIds: z
      .array(ltmNoteIdSchema)
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, "Requested note IDs must be unique."),
    derivedNoteIds: z
      .array(ltmNoteIdSchema)
      .max(500)
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, "Derived note IDs must be unique."),
    applyNoteIds: z
      .array(ltmNoteIdSchema)
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, "Applied note IDs must be unique."),
    mode: ltmNoteTransferModeSchema,
    destinationChatId: z.string().min(1).max(120),
  })
  .strict()
  .superRefine((value, ctx) => {
    const requested = new Set(value.requestedNoteIds);
    if (value.requestedNoteIds.length + value.derivedNoteIds.length > 500)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transfer selection cannot exceed 500 notes.",
      });
    if (value.derivedNoteIds.some((id) => requested.has(id)))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Requested and derived transfer IDs must be disjoint.",
      });
    const available = new Set([...value.requestedNoteIds, ...value.derivedNoteIds]);
    if (value.applyNoteIds.some((id) => !available.has(id)))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Applied note IDs must be part of the transfer selection.",
      });
  });

export const ltmSourceDerivedMemorySchema = z
  .object({
    id: ltmNoteIdSchema,
    title: ltmNoteTitleSchema.optional(),
    type: ltmNoteTypeSchema,
    status: ltmStatusSchema,
    scope: ltmScopeSchema,
    previewText: z.string().max(600),
    incomingLinkCount: z.number().int().min(0),
    outgoingLinkCount: z.number().int().min(0),
  })
  .strict();

export const ltmSourceDerivedMemoriesResponseSchema = z
  .object({
    sourceNoteId: ltmNoteIdSchema,
    sourceIncomingLinkCount: z.number().int().min(0),
    sourceOutgoingLinkCount: z.number().int().min(0),
    memories: z.array(ltmSourceDerivedMemorySchema),
  })
  .strict();

export const ltmEvidenceUnitSchema = z
  .object({
    id: z.string().uuid(),
    bucket: ltmEvidenceUnitBucketSchema,
    subjectId: ltmIdentifierSchema,
    sectionKey: ltmSectionKeySchema,
    title: ltmEvidenceUnitTitleSchema.optional(),
    text: z.string().min(1).max(2_000),
    claimKind: ltmClaimKindSchema.default("change"),
    importance: ltmImportanceSchema.default("moderate"),
    keywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    evidence: z.array(z.string().min(1).max(240)).min(1).max(20),
    confidence: z.number().finite().min(0).max(1),
    salience: z.number().finite().min(0).max(1),
    status: ltmEvidenceUnitStatusSchema,
    links: z.array(ltmLinkSchema).max(50).default([]),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    subjectNames: z.array(z.string().trim().min(1).max(240)).max(2).optional(),
    subjectKeys: z.array(z.string().trim().min(1).max(240)).max(3).optional(),
    subjects: ltmSubjectsSchema.optional(),
    dimensions: ltmRelationshipDimensionsSchema.optional(),
    dimensionChanges: ltmRelationshipDimensionChangesSchema.optional(),
  })
  .strip();

/**
 * Compiled note sections store metadata as structured fields. The text remains
 * user-editable prose; callers must not parse importance or dimensions from it.
 */
const ltmSectionContributionFields = {
  text: z.string().min(1).max(24_000),
  updatedAt: ltmIsoTimestampSchema,
  salience: z.number().finite().min(0).max(1).optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
  importance: ltmImportanceSchema.optional(),
  dimensions: ltmRelationshipDimensionsSchema.optional(),
  dimensionChanges: ltmRelationshipDimensionChangesSchema.optional(),
  evidence: z.array(z.string().min(1).max(240)).max(100).optional(),
};

export const ltmSectionContributionSchema = z.discriminatedUnion("owner", [
  z
    .object({
      ...ltmSectionContributionFields,
      owner: z.literal("source"),
      sourceNoteId: ltmNoteIdSchema,
      sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      ...ltmSectionContributionFields,
      owner: z.literal("manual"),
    })
    .strict(),
]);

export const ltmSectionSchema = z
  .object({
    text: z.string().min(1).max(24_000),
    updatedAt: ltmIsoTimestampSchema,
    salience: z.number().finite().min(0).max(1).optional(),
    confidence: z.number().finite().min(0).max(1).optional(),
    importance: ltmImportanceSchema.optional(),
    dimensions: ltmRelationshipDimensionsSchema.optional(),
    dimensionChanges: ltmRelationshipDimensionChangesSchema.optional(),
    evidence: z.array(z.string().min(1).max(240)).max(100).optional(),
    contributions: z.array(ltmSectionContributionSchema).max(100).optional(),
  })
  .strip();

export const ltmConflictSchema = z
  .object({
    field: z.string().min(1).max(200),
    existing: z.string().max(20_000),
    proposed: z.string().max(20_000),
    sourceTurn: z.number().int().min(0).optional(),
    resolution: z.enum(["pending", "accepted", "rejected", "user_decided"]),
    policy: z.string().min(1).max(120),
  })
  .strict();

export const ltmNoteSchema = z
  .object({
    id: ltmNoteIdSchema,
    title: ltmNoteTitleSchema.optional(),
    type: ltmNoteTypeSchema,
    status: ltmStatusSchema,
    modes: z.array(ltmModeSchema).min(1).max(8),
    scope: ltmScopeSchema.default({}),
    destinationScope: ltmScopeSchema.optional(),
    tags: z.array(ltmIdentifierSchema).max(100).default([]),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    manualKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    suppressedKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    createdAt: ltmIsoTimestampSchema,
    updatedAt: ltmIsoTimestampSchema,
    links: z.array(ltmLinkSchema).max(250).default([]),
    sections: z.record(ltmSectionKeySchema, ltmSectionSchema),
    conflicts: z.array(ltmConflictSchema).max(250).optional(),
    provenance: ltmSourceProvenanceSchema.optional(),
    subjects: ltmSubjectsSchema.optional(),
    version: z.number().int().min(1),
    extractionFingerprint: ltmExtractionFingerprintSchema.optional(),
    // Legacy v1 metadata. Freshness is derived exclusively from extractionFingerprint.
    extracted: z.boolean().optional(),
  })
  .strict()
  .superRefine((note, ctx) => {
    if (hasLocalCharacterSubject(note.subjects) && note.modes.some((mode) => mode !== "roleplay")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modes"],
        message: "Local character subjects are available only in Roleplay mode.",
      });
    }
    const allowedPrefixes = allowedStoredNoteIdPrefixes(note.type);
    if (!allowedPrefixes.some((prefix) => note.id === prefix || note.id.startsWith(prefix))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id"],
        message: `ID for ${note.type} notes must start with ${allowedPrefixes.join(" or ")}.`,
      });
    }

    if (Date.parse(note.updatedAt) < Date.parse(note.createdAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updatedAt"],
        message: "updatedAt cannot be earlier than createdAt.",
      });
    }

    if (note.provenance && note.type !== "source") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance"],
        message: "Only source notes can store import provenance.",
      });
    }

    if (note.destinationScope && note.type !== "source") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationScope"],
        message: "Only source notes can store an extraction destination scope.",
      });
    }

    if (note.type === "source" && !note.provenance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance"],
        message: "Source notes must store import provenance.",
      });
    }

    if (note.extractionFingerprint && !isLtmSourceLikeNote(note)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extractionFingerprint"],
        message: "Only source notes can store an extraction fingerprint.",
      });
    }

    if (note.subjects) {
      if (note.type === "character" && note.subjects.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subjects"],
          message: "Character notes must have exactly one subject.",
        });
      } else if (note.type === "relationship" && note.subjects.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subjects"],
          message: "Relationship notes must have exactly two subjects.",
        });
      } else if (note.type !== "character" && note.type !== "relationship") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subjects"],
          message: "Only character and relationship notes can store subjects.",
        });
      }
    }
  });

export const ltmBulkNoteArchiveActionSchema = z.enum(["notes_only", "with_derived"]);

const ltmAvailabilityScopePatchSchema = ltmWriteScopeSchema.refine(
  (scope) =>
    Boolean(
      scope.chatId ||
      scope.chatIds?.length ||
      scope.groupId ||
      scope.groupIds?.length ||
      scope.characterIds?.length ||
      scope.personaId ||
      scope.personaIds?.length,
    ),
  "Choose at least one place.",
);

export const ltmBulkNoteRequestSchema = z
  .object({
    noteIds: z
      .array(ltmNoteIdSchema)
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, "Note IDs must be unique."),
    status: ltmStatusSchema.optional(),
    modes: z
      .array(ltmModeSchema)
      .min(1)
      .max(8)
      .refine((modes) => new Set(modes).size === modes.length, "Modes must be unique.")
      .optional(),
    enableModes: z.array(ltmModeSchema).min(1).max(8).optional(),
    disableModes: z.array(ltmModeSchema).min(1).max(8).optional(),
    addScope: ltmAvailabilityScopePatchSchema.optional(),
    removeScope: ltmAvailabilityScopePatchSchema.optional(),
    addTags: z
      .array(ltmIdentifierSchema)
      .max(100)
      .refine((tags) => new Set(tags).size === tags.length, "Tags to add must be unique.")
      .optional(),
    removeTags: z
      .array(ltmIdentifierSchema)
      .max(100)
      .refine((tags) => new Set(tags).size === tags.length, "Tags to remove must be unique.")
      .optional(),
    archive: ltmBulkNoteArchiveActionSchema.optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      !request.status &&
      !request.modes &&
      !request.enableModes?.length &&
      !request.disableModes?.length &&
      !request.addScope &&
      !request.removeScope &&
      !request.addTags?.length &&
      !request.removeTags?.length &&
      !request.archive
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A bulk note request must include at least one mutation.",
      });
    }
    if (request.archive && request.status && request.status !== "archived") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Archive actions require archived status when a status is supplied.",
      });
    }
    const addTags = new Set(request.addTags ?? []);
    for (const [index, tag] of (request.removeTags ?? []).entries()) {
      if (addTags.has(tag)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["removeTags", index],
          message: "A tag cannot be added and removed in the same bulk request.",
        });
      }
    }
    const enabledModes = new Set(request.enableModes ?? []);
    for (const [index, mode] of (request.disableModes ?? []).entries())
      if (enabledModes.has(mode))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["disableModes", index],
          message: "A chat mode cannot be enabled and disabled in the same bulk request.",
        });
    if (request.modes && (request.enableModes?.length || request.disableModes?.length))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modes"],
        message: "Modes cannot be combined with incremental mode changes.",
      });
    const addScope = request.addScope;
    const removeScope = request.removeScope;
    const dimensions = [
      [
        "chat",
        [...(addScope?.chatIds ?? []), ...(addScope?.chatId ? [addScope.chatId] : [])],
        [...(removeScope?.chatIds ?? []), ...(removeScope?.chatId ? [removeScope.chatId] : [])],
      ],
      [
        "group",
        [...(addScope?.groupIds ?? []), ...(addScope?.groupId ? [addScope.groupId] : [])],
        [...(removeScope?.groupIds ?? []), ...(removeScope?.groupId ? [removeScope.groupId] : [])],
      ],
      ["character", addScope?.characterIds ?? [], removeScope?.characterIds ?? []],
      [
        "persona",
        [...(addScope?.personaIds ?? []), ...(addScope?.personaId ? [addScope.personaId] : [])],
        [...(removeScope?.personaIds ?? []), ...(removeScope?.personaId ? [removeScope.personaId] : [])],
      ],
    ] as const;
    for (const [dimension, added, removed] of dimensions) {
      const overlap = new Set(added.filter((id) => removed.includes(id)));
      if (overlap.size)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["addScope"],
          message: `Scope ${dimension} IDs cannot be added and removed in the same request: ${[...overlap].join(", ")}`,
        });
    }
  });

export const ltmBulkNoteResultStatusSchema = z.enum(["complete", "partial", "no_changes", "failed"]);

export const ltmBulkNoteResultSchema = z
  .object({
    status: ltmBulkNoteResultStatusSchema,
    requestedNoteIds: z.array(ltmNoteIdSchema).min(1).max(100),
    updatedNoteIds: z.array(ltmNoteIdSchema).max(100),
    affectedNoteIds: z.array(ltmNoteIdSchema).max(100),
    skippedNoteIds: z.array(ltmNoteIdSchema).max(100),
    failedNoteIds: z.array(ltmNoteIdSchema).max(100),
  })
  .strict()
  .superRefine((result, ctx) => {
    const requested = new Set(result.requestedNoteIds);
    const updated = new Set(result.updatedNoteIds);
    const skipped = new Set(result.skippedNoteIds);
    const failed = new Set(result.failedNoteIds);
    if (requested.size !== result.requestedNoteIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedNoteIds"],
        message: "Requested note IDs must be unique.",
      });
    }
    for (const [key, values] of [
      ["updatedNoteIds", updated],
      ["skippedNoteIds", skipped],
      ["failedNoteIds", failed],
    ] as const) {
      for (const id of values) {
        if (!requested.has(id))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must contain requested note IDs only.`,
          });
      }
    }
    for (const id of requested) {
      if (Number(updated.has(id)) + Number(skipped.has(id)) + Number(failed.has(id)) !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each requested note ID must have exactly one outcome.",
        });
        break;
      }
    }
    for (const id of result.updatedNoteIds) {
      if (!result.affectedNoteIds.includes(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["affectedNoteIds"],
          message: "Affected note IDs must include every updated note ID.",
        });
        break;
      }
    }
    const expectedStatus = result.affectedNoteIds.length
      ? skipped.size || failed.size
        ? "partial"
        : "complete"
      : failed.size
        ? "failed"
        : "no_changes";
    if (result.status !== expectedStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: `Bulk note status must be ${expectedStatus} for the returned outcomes.`,
      });
    }
  });

export const ltmVaultFileReferenceSchema = z
  .object({
    noteId: ltmNoteIdSchema,
    type: ltmNoteTypeSchema,
    folder: ltmVaultFolderSchema,
    relativePath: ltmSafeRelativePathSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (LTM_NOTE_TYPE_TO_VAULT_FOLDER[value.type] !== value.folder) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["folder"],
        message: `Folder must match note type ${value.type}.`,
      });
    }
  });

export const ltmEventSchema = z
  .object({
    id: z.string().uuid(),
    ts: ltmIsoTimestampSchema,
    type: z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
    target: ltmNoteIdSchema.optional(),
    actor: z.string().min(1).max(120).optional(),
    turn: z.number().int().min(0).optional(),
    cause: z.string().min(1).max(240).optional(),
    summary: z.string().max(2_000).optional(),
    payload: z.record(z.unknown()).default({}),
  })
  .strict();

const ltmNoteForkRequestBaseSchema = z
  .object({
    noteIds: z.array(ltmNoteIdSchema).min(2).max(100),
  })
  .strict();

export const ltmNoteForkPreviewRequestSchema = ltmNoteForkRequestBaseSchema.refine(
  (request) => new Set(request.noteIds).size === request.noteIds.length,
  "Fork note IDs must be unique.",
);

export const ltmNoteForkCandidateSchema = z
  .object({
    noteIds: z.array(ltmNoteIdSchema).min(2).max(100),
    canonicalNoteId: ltmNoteIdSchema,
    noteType: z.enum(["thread", "world"]),
    similarity: z.number().min(0).max(1),
    blockingReasons: z.array(z.string().min(1).max(500)).max(20),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const ltmNoteForkPreviewResponseSchema = z
  .object({
    candidates: z.array(ltmNoteForkCandidateSchema).max(100),
  })
  .strict();

export const ltmNoteForkApplyRequestSchema = ltmNoteForkRequestBaseSchema
  .extend({ canonicalNoteId: ltmNoteIdSchema, contentHash: z.string().regex(/^[a-f0-9]{64}$/) })
  .refine((request) => new Set(request.noteIds).size === request.noteIds.length, "Fork note IDs must be unique.");

export const ltmNoteForkApplyResponseSchema = z
  .object({
    canonicalNoteId: ltmNoteIdSchema,
    archivedNoteIds: z.array(ltmNoteIdSchema).max(99),
    backupId: z.string().uuid(),
  })
  .strict();

export const ltmTransferRebuildSummarySchema = z
  .object({
    generatedAt: ltmIsoTimestampSchema,
    noteCount: z.number().int().min(0),
    chunkCount: z.number().int().min(0),
    embeddedChunkCount: z.number().int().min(0),
    embeddingsAvailable: z.boolean(),
  })
  .strict();

export const ltmNoteTransferApplyResponseSchema = z
  .object({
    mode: ltmNoteTransferModeSchema,
    destinationChatId: z.string().min(1).max(120),
    updatedNoteIds: z.array(ltmNoteIdSchema).max(500),
    skippedNoteIds: z.array(ltmNoteIdSchema).max(500),
    derivedNoteIdsTouched: z.array(ltmNoteIdSchema).max(500),
    rebuild: ltmTransferRebuildSummarySchema.nullable(),
  })
  .strict();

export const ltmRenameNoteSectionRequestSchema = z
  .object({
    fromSectionKey: ltmSectionKeySchema,
    toSectionKey: ltmSectionKeySchema,
  })
  .strict()
  .refine((value) => value.fromSectionKey !== value.toSectionKey, "Section keys must be different.");

export const ltmRenameNoteSectionPreviewResponseSchema = z
  .object({
    fromSectionKey: ltmSectionKeySchema,
    toSectionKey: ltmSectionKeySchema,
    rewrittenDraftCount: z.number().int().min(0),
    rewrittenDraftIds: z.array(z.string().uuid()).max(10_000),
  })
  .strict();

const ltmSectionRebuildSchema = z.discriminatedUnion("status", [
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

export const ltmRenameNoteSectionResponseSchema = z
  .object({
    note: ltmNoteSchema,
    rewrittenDraftCount: z.number().int().min(0),
    rebuild: ltmSectionRebuildSchema,
  })
  .strict();

export const ltmDeleteNoteSectionResponseSchema = z
  .object({
    note: ltmNoteSchema,
    invalidatedDraftCount: z.number().int().min(0),
    rebuild: ltmSectionRebuildSchema,
  })
  .strict();
export type LtmNoteTransferMode = z.infer<typeof ltmNoteTransferModeSchema>;
export type LtmNoteTransferConflict = z.infer<typeof ltmNoteTransferConflictSchema>;
export type LtmNoteTransferPreviewItem = z.infer<typeof ltmNoteTransferPreviewItemSchema>;
export type LtmNoteTransferPreviewRequest = z.infer<typeof ltmNoteTransferPreviewRequestSchema>;
export type LtmNoteTransferPreviewResponse = z.infer<typeof ltmNoteTransferPreviewResponseSchema>;
export type LtmNoteTransferApplyRequest = z.infer<typeof ltmNoteTransferApplyRequestSchema>;
export type LtmSourceDerivedMemory = z.infer<typeof ltmSourceDerivedMemorySchema>;
export type LtmSourceDerivedMemoriesResponse = z.infer<typeof ltmSourceDerivedMemoriesResponseSchema>;
export type LtmSectionContribution = z.infer<typeof ltmSectionContributionSchema>;
export type LtmSection = z.infer<typeof ltmSectionSchema>;
export type LtmConflict = z.infer<typeof ltmConflictSchema>;
export type LtmNote = z.infer<typeof ltmNoteSchema>;
export type LtmBulkNoteArchiveAction = z.infer<typeof ltmBulkNoteArchiveActionSchema>;
export type LtmBulkNoteRequest = z.infer<typeof ltmBulkNoteRequestSchema>;
export type LtmBulkNoteResultStatus = z.infer<typeof ltmBulkNoteResultStatusSchema>;
export type LtmBulkNoteResult = z.infer<typeof ltmBulkNoteResultSchema>;
export type LtmEvent = z.infer<typeof ltmEventSchema>;
export type LtmNoteForkPreviewRequest = z.infer<typeof ltmNoteForkPreviewRequestSchema>;
export type LtmNoteForkCandidate = z.infer<typeof ltmNoteForkCandidateSchema>;
export type LtmNoteForkPreviewResponse = z.infer<typeof ltmNoteForkPreviewResponseSchema>;
export type LtmNoteForkApplyRequest = z.infer<typeof ltmNoteForkApplyRequestSchema>;
export type LtmNoteForkApplyResponse = z.infer<typeof ltmNoteForkApplyResponseSchema>;
export type LtmTransferRebuildSummary = z.infer<typeof ltmTransferRebuildSummarySchema>;
export type LtmNoteTransferApplyResponse = z.infer<typeof ltmNoteTransferApplyResponseSchema>;
export type LtmRenameNoteSectionRequest = z.infer<typeof ltmRenameNoteSectionRequestSchema>;
export type LtmRenameNoteSectionPreviewResponse = z.infer<typeof ltmRenameNoteSectionPreviewResponseSchema>;
export type LtmRenameNoteSectionResponse = z.infer<typeof ltmRenameNoteSectionResponseSchema>;
export type LtmDeleteNoteSectionResponse = z.infer<typeof ltmDeleteNoteSectionResponseSchema>;
export type LtmEvidenceUnit = z.infer<typeof ltmEvidenceUnitSchema>;
