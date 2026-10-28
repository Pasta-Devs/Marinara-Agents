import { z } from "zod";
import { LTM_EXTRACTION_MAX_CANDIDATES, LTM_EXTRACTION_MAX_REJECTION_DETAILS } from "../constants.js";
import {
  hasLocalCharacterSubject,
  LTM_NOTE_ID_PREFIXES_BY_TYPE,
  ltmClaimKindSchema,
  ltmExtractionFingerprintSchema,
  ltmIdentifierSchema,
  ltmImportanceSchema,
  ltmIsoTimestampSchema,
  ltmLinkRelationSchema,
  ltmLinkSchema,
  ltmModeSchema,
  ltmNoteIdSchema,
  ltmNoteTitleSchema,
  ltmNoteTypeSchema,
  ltmRelationshipDimensionChangesSchema,
  ltmRelationshipDimensionsSchema,
  ltmScopeSchema,
  ltmSectionKeySchema,
  ltmSourceProvenanceSchema,
  ltmStatusSchema,
  ltmSubjectsSchema,
  ltmWriteScopeSchema,
} from "./primitives.js";
import { ltmConflictSchema, ltmEvidenceUnitSchema, ltmSectionSchema } from "./notes.js";
import { ltmSavedSubjectIdentityChoiceSchema, ltmSubjectIdentityReviewSchema } from "./identity.js";

export const ltmDraftStatusSchema = z.enum(["pending", "accepted", "auto_applied", "superseded", "invalidated"]);

export const ltmDraftApplyStateSchema = z.enum(["not_started", "applying", "complete"]);

export const ltmDraftIndexRebuildStatusSchema = z.enum(["not_requested", "pending", "succeeded", "failed"]);

export const ltmDraftRiskSchema = z.enum(["low", "medium", "high"]);

export const ltmDraftSourceSchema = z
  .object({
    chatId: z.string().min(1).max(120).optional(),
    sourceNoteId: ltmNoteIdSchema,
    summaryEntryId: z.string().min(1).max(120).optional(),
    sourceHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    extractionFingerprint: ltmExtractionFingerprintSchema.optional(),
  })
  .strict();

export const ltmDraftNoteInputSchema = z
  .object({
    id: ltmNoteIdSchema,
    title: ltmNoteTitleSchema.optional(),
    type: ltmNoteTypeSchema,
    status: ltmStatusSchema.default("active"),
    modes: z.array(ltmModeSchema).min(1).max(8),
    scope: ltmWriteScopeSchema.default({}),
    destinationScope: ltmWriteScopeSchema.optional(),
    tags: z.array(ltmIdentifierSchema).max(100).default([]),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    manualKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    suppressedKeywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    createdAt: ltmIsoTimestampSchema.optional(),
    updatedAt: ltmIsoTimestampSchema.optional(),
    extracted: z.boolean().optional(),
    links: z.array(ltmLinkSchema).max(250).default([]),
    sections: z.record(ltmSectionKeySchema, ltmSectionSchema),
    conflicts: z.array(ltmConflictSchema).max(250).optional(),
    provenance: ltmSourceProvenanceSchema.optional(),
    subjects: ltmSubjectsSchema.optional(),
    version: z.number().int().min(1).optional(),
  })
  .strip()
  .superRefine((note, ctx) => {
    if (hasLocalCharacterSubject(note.subjects) && note.modes.some((mode) => mode !== "roleplay")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modes"],
        message: "Local character subjects are available only in Roleplay mode.",
      });
    }
    const allowedPrefixes = LTM_NOTE_ID_PREFIXES_BY_TYPE[note.type];
    if (!allowedPrefixes.some((prefix) => note.id === prefix || note.id.startsWith(prefix))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id"],
        message: `ID for ${note.type} notes must start with ${allowedPrefixes.join(" or ")}.`,
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
  });

const ltmDraftMutationBaseSchema = z.object({
  id: z.string().uuid(),
  claimKind: ltmClaimKindSchema.default("change"),
  risk: ltmDraftRiskSchema.default("medium"),
  confidence: z.number().finite().min(0).max(1).default(0.5),
  summary: z.string().min(1).max(1_000),
  evidence: z.array(z.string().min(1).max(240)).min(1).max(20),
});

export const ltmDraftMutationSchema = z.discriminatedUnion("kind", [
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("create_note"),
      note: ltmDraftNoteInputSchema,
    })
    .strip(),
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("append_section"),
      noteId: ltmNoteIdSchema,
      sectionKey: ltmSectionKeySchema,
      text: z.string().min(1).max(20_000),
      salience: z.number().finite().min(0).max(1).optional(),
      importance: ltmImportanceSchema.optional(),
      dimensions: ltmRelationshipDimensionsSchema.optional(),
      dimensionChanges: ltmRelationshipDimensionChangesSchema.optional(),
    })
    .strip(),
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("update_section"),
      noteId: ltmNoteIdSchema,
      sectionKey: ltmSectionKeySchema,
      section: ltmSectionSchema,
    })
    .strip(),
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("add_link"),
      noteId: ltmNoteIdSchema,
      link: ltmLinkSchema,
    })
    .strip(),
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("set_keywords"),
      noteId: ltmNoteIdSchema,
      keywords: z.array(z.string().trim().min(1).max(80)).max(30),
    })
    .strip(),
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("set_status"),
      noteId: ltmNoteIdSchema,
      status: ltmStatusSchema,
    })
    .strip(),
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("set_title"),
      noteId: ltmNoteIdSchema,
      title: ltmNoteTitleSchema,
    })
    .strip(),
  ltmDraftMutationBaseSchema
    .extend({
      kind: z.literal("set_subjects"),
      noteId: ltmNoteIdSchema,
      subjects: ltmSubjectsSchema,
    })
    .strip(),
]);

export const ltmExtractionDropReasonSchema = z.enum([
  "invalid_format",
  "candidate_overflow",
  "placeholder_output",
  "quote_not_found_in_source",
  "missing_source_evidence",
  "source_summary_payload",
  "unsupported_bucket",
  "target_note_outside_scope",
  "ambiguous_subject",
  "untrusted_subject",
  "invalid_subject_cardinality",
  "too_long_to_keep_safely",
]);

export const ltmExtractionRecoveryHintSchema = z
  .object({
    noteType: ltmNoteTypeSchema.optional(),
    noteId: ltmNoteIdSchema.optional(),
    sectionKey: ltmSectionKeySchema.optional(),
    status: ltmStatusSchema.optional(),
  })
  .strict();

export const ltmExtractionDroppedCandidateSchema = z
  .object({
    index: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    reason: ltmExtractionDropReasonSchema,
    validatorCode: z.string().trim().min(1).max(120).optional(),
    message: z.string().min(1).max(240),
    snippet: z.string().min(1).max(280).optional(),
    issues: z.array(z.string().trim().min(1).max(240)).max(8).optional(),
    recovery: ltmExtractionRecoveryHintSchema.optional(),
    identityReview: z.array(ltmSubjectIdentityReviewSchema).min(1).max(2).optional(),
    recoveryCandidate: ltmEvidenceUnitSchema
      .extend({
        subjectId: z.preprocess(
          (value) =>
            typeof value === "string"
              ? value
                  .trim()
                  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "_")
                  .replace(/^_+|_+$/g, "")
                  .replace(/_+/g, "_")
                  .slice(0, 120)
                  .replace(/_+$/g, "")
              : value,
          ltmIdentifierSchema,
        ),
      })
      .optional(),
  })
  .strict();

export const ltmRejectedSuggestionSchema = z
  .object({
    id: z.string().uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    source: ltmDraftSourceSchema,
    scope: ltmScopeSchema,
    modes: z.array(ltmModeSchema).min(1).max(8),
    candidate: ltmExtractionDroppedCandidateSchema,
    createdAt: ltmIsoTimestampSchema,
    lastSeenAt: ltmIsoTimestampSchema,
    identityResolution: z
      .object({
        choices: z.array(ltmSavedSubjectIdentityChoiceSchema).min(1).max(2),
        resolvedAt: ltmIsoTimestampSchema,
        draftId: z.string().uuid().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ltmExtractionOutcomeStateSchema = z.enum(["success", "partial_success", "no_suggestions_created"]);

export const ltmExtractionOutcomeSchema = z
  .object({
    state: ltmExtractionOutcomeStateSchema,
    incomplete: z.boolean().default(false),
    totalCandidates: z.number().int().min(0),
    keptUnits: z.number().int().min(0),
    droppedUnits: z.number().int().min(0),
    droppedCandidates: z
      .array(ltmExtractionDroppedCandidateSchema)
      .max(LTM_EXTRACTION_MAX_REJECTION_DETAILS)
      .default([]),
    droppedCandidateDetailsTruncated: z.boolean().default(false),
  })
  .strict();

export const ltmExtractionResponseSchema = z
  .object({
    summary: z.string().max(2_000).default(""),
    mutations: z.array(ltmDraftMutationSchema).default([]),
  })
  .strict();

export const ltmExtractionDiagnosticSchema = z
  .object({
    severity: z.enum(["warning", "error"]),
    code: z.string().min(1).max(120),
    candidateIndex: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES).optional(),
    mutationId: z.string().uuid().optional(),
    noteId: ltmNoteIdSchema.optional(),
    message: z.string().min(1).max(2_000),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const ltmExtractionAccountingSchema = z
  .object({
    providerCandidates: z.number().int().min(0),
    normalizedAdditions: z.number().int().min(0),
    parserRejections: z.number().int().min(0),
    validationRejections: z.number().int().min(0),
    deduplications: z.number().int().min(0),
    keptUnits: z.number().int().min(0),
    userSkips: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((accounting, ctx) => {
    const candidates = accounting.providerCandidates + accounting.normalizedAdditions;
    const dispositions =
      accounting.parserRejections +
      accounting.validationRejections +
      accounting.deduplications +
      accounting.keptUnits +
      (accounting.userSkips ?? 0);
    if (candidates !== dispositions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Extraction accounting is unbalanced: ${candidates} candidates but ${dispositions} dispositions.`,
      });
    }
  });

export const ltmExtractionDraftSchema = z
  .object({
    id: z.string().uuid(),
    status: ltmDraftStatusSchema.default("pending"),
    applyState: ltmDraftApplyStateSchema.default("not_started"),
    indexRebuildStatus: ltmDraftIndexRebuildStatusSchema.default("not_requested"),
    indexRebuildAt: ltmIsoTimestampSchema.optional(),
    indexRebuildError: z.string().min(1).max(2_000).optional(),
    createdAt: ltmIsoTimestampSchema,
    updatedAt: ltmIsoTimestampSchema,
    operationId: z.string().uuid().optional(),
    reviewRequired: z.boolean().default(false),
    source: ltmDraftSourceSchema,
    scope: ltmScopeSchema.default({}),
    modes: z.array(ltmModeSchema).min(1).max(8),
    summary: z.string().max(2_000).default(""),
    mutations: z.array(ltmDraftMutationSchema).default([]),
    diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500).optional(),
    extractionOutcome: ltmExtractionOutcomeSchema.optional(),
    accounting: ltmExtractionAccountingSchema.optional(),
    appliedAt: ltmIsoTimestampSchema.optional(),
    appliedMutationIds: z.array(z.string().uuid()).optional(),
    skippedMutationIds: z.array(z.string().uuid()).optional(),
    supersededAt: ltmIsoTimestampSchema.optional(),
    supersededByDraftId: z.string().uuid().optional(),
    invalidatedAt: ltmIsoTimestampSchema.optional(),
    invalidationReason: z.string().min(1).max(2_000).optional(),
  })
  .strip();

export const ltmResolveSubjectIdentityResponseSchema = z
  .object({
    resolved: z.literal(true),
    suggestionId: z.string().uuid(),
    draft: ltmExtractionDraftSchema.nullable(),
  })
  .strict();

export const ltmDraftFreshnessSchema = z.enum([
  "fresh",
  "hashless",
  "stale",
  "missing",
  "invalid",
  "superseded",
  "invalidated",
  "not_pending",
]);

export const ltmDraftBlockReasonCodeSchema = z.enum([
  "source_stale",
  "source_context_unbound",
  "source_missing",
  "source_invalid",
  "draft_superseded",
  "draft_invalidated",
  "draft_not_pending",
  "projection_failed",
  "no_mutations",
]);

export const ltmDraftBlockReasonSchema = z
  .object({
    code: ltmDraftBlockReasonCodeSchema,
    message: z.string().min(1).max(2_000),
  })
  .strict();

export const ltmMutationDispositionSchema = z.enum(["new", "merge", "rewrite"]);

export const ltmDraftReviewChangeSchema = z
  .object({
    kind: z.enum(["section", "link", "keywords", "status", "subjects", "title"]),
    key: z.string().min(1).max(240),
    before: z.string().max(20_000).optional(),
    after: z.string().max(20_000),
  })
  .strict();

export const ltmDraftReviewMutationSchema = z
  .object({
    draftId: z.string().uuid(),
    mutation: ltmDraftMutationSchema,
    disposition: ltmMutationDispositionSchema,
    diagnostics: z.array(ltmExtractionDiagnosticSchema).max(100),
    changes: z.array(ltmDraftReviewChangeSchema).max(100),
  })
  .strict();

export const ltmDraftReviewTargetSchema = z
  .object({
    noteId: ltmNoteIdSchema,
    title: ltmNoteTitleSchema.optional(),
    noteType: ltmNoteTypeSchema,
    rows: z.array(ltmDraftReviewMutationSchema).min(1).max(1_000),
  })
  .strict();

export const ltmDraftReviewDraftSchema = z
  .object({
    draft: ltmExtractionDraftSchema,
    freshness: ltmDraftFreshnessSchema,
    blockReasons: z.array(ltmDraftBlockReasonSchema).max(20),
    diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500),
    candidateRejections: z.array(ltmExtractionDroppedCandidateSchema).max(80),
    deduplications: z.array(ltmExtractionDiagnosticSchema).max(500),
  })
  .strict();

export const ltmDraftReviewSourceSchema = z
  .object({
    sourceNoteId: ltmNoteIdSchema,
    modes: z.array(ltmModeSchema).min(1).max(8),
    drafts: z.array(ltmDraftReviewDraftSchema).min(1).max(500),
    targets: z.array(ltmDraftReviewTargetSchema).max(500),
  })
  .strict();

export const ltmDraftReviewResponseSchema = z
  .object({
    generatedAt: ltmIsoTimestampSchema,
    sources: z.array(ltmDraftReviewSourceSchema).max(500),
    counts: z
      .object({
        sources: z.number().int().min(0),
        drafts: z.number().int().min(0),
        mutations: z.number().int().min(0),
        blockedDrafts: z.number().int().min(0),
        candidateRejections: z.number().int().min(0),
        deduplications: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export const ltmDraftLinkChoiceSchema = z
  .object({
    mutationId: z.string().uuid(),
    linkTarget: ltmNoteIdSchema,
    linkRelation: ltmLinkRelationSchema,
    selectedTarget: ltmNoteIdSchema,
  })
  .strict();

export type LtmDraftLinkChoice = z.infer<typeof ltmDraftLinkChoiceSchema>;

export const ltmDraftPreflightRequestSchema = z
  .object({
    mutationIds: z
      .array(z.string().uuid())
      .min(1)
      .max(1_000)
      .refine((ids) => new Set(ids).size === ids.length, "Mutation IDs must be unique."),
    editedMutations: z.array(ltmDraftMutationSchema).max(1_000).optional(),
    linkChoices: z.array(ltmDraftLinkChoiceSchema).max(1_000).optional(),
    bulk: z.boolean().default(false),
  })
  .strict();

export const ltmDraftPreflightBlockerSchema = z
  .object({
    code: z.string().min(1).max(120),
    message: z.string().min(1).max(2_000),
  })
  .strict();

export const ltmDraftPreflightRowSchema = z
  .object({
    mutationId: z.string().uuid(),
    targetId: ltmNoteIdSchema,
    disposition: ltmMutationDispositionSchema,
    status: z.enum(["ready", "blocked"]),
    autoIncluded: z.boolean(),
    blockers: z.array(ltmDraftPreflightBlockerSchema).max(20),
    conflicts: z.array(ltmConflictSchema).max(250),
  })
  .strict();

export const ltmDraftPreflightResponseSchema = z
  .object({
    draftId: z.string().uuid(),
    selectedMutationIds: z.array(z.string().uuid()).max(1_000),
    readyMutationIds: z.array(z.string().uuid()).max(10_000),
    blockedMutationIds: z.array(z.string().uuid()).max(10_000),
    autoIncludedMutationIds: z.array(z.string().uuid()).max(10_000),
    rows: z.array(ltmDraftPreflightRowSchema).max(10_000),
  })
  .strict();

export const ltmRejectedSuggestionsResponseSchema = z
  .object({
    suggestions: z.array(ltmRejectedSuggestionSchema).max(10_000),
    total: z.number().int().min(0).max(10_000),
  })
  .strict();

export const ltmRejectedSuggestionsClearResponseSchema = z
  .object({
    deletedCount: z.number().int().min(0).max(10_000),
    sourceNoteId: ltmNoteIdSchema,
  })
  .strict();

export const ltmExtractSourceNoteRequestSchema = z
  .object({
    chatId: z.string().min(1).max(120).optional(),
    connectionId: z.string().min(1).max(120).optional(),
    model: z.string().min(1).max(240).optional(),
    instruction: z.string().max(2_000).optional(),
    applyLowRisk: z.boolean().optional(),
    mode: ltmModeSchema.optional(),
    modes: z.array(ltmModeSchema).min(1).max(8).optional(),
  })
  .strict()
  .default({});

const ltmExtractionTransportPayloadSchema = z
  .object({
    summary: z.string().max(2_000),
    mutations: z.array(ltmDraftMutationSchema),
  })
  .strict();

export const ltmExtractSourceNoteResponseSchema = z
  .object({
    operationId: z.string().uuid(),
    draft: ltmExtractionDraftSchema.nullable(),
    diagnostics: z.array(ltmExtractionDiagnosticSchema).max(500),
    outcome: ltmExtractionOutcomeSchema,
    accounting: ltmExtractionAccountingSchema,
    response: ltmExtractionTransportPayloadSchema,
    appliedMutationIds: z.array(z.string().uuid()).max(500),
    skippedMutationIds: z.array(z.string().uuid()).max(500),
  })
  .strict();

export const ltmEvidenceUnitExtractionResponseSchema = z
  .object({
    summary: z.string().max(2_000).default(""),
    units: z.array(ltmEvidenceUnitSchema).max(LTM_EXTRACTION_MAX_CANDIDATES).default([]),
    incomplete: z.boolean().default(false),
  })
  .strict();

export const ltmPendingDraftsCountResponseSchema = z.object({
  count: z.number(),
});
export type LtmDraftStatus = z.infer<typeof ltmDraftStatusSchema>;
export type LtmDraftApplyState = z.infer<typeof ltmDraftApplyStateSchema>;
export type LtmDraftIndexRebuildStatus = z.infer<typeof ltmDraftIndexRebuildStatusSchema>;
export type LtmDraftRisk = z.infer<typeof ltmDraftRiskSchema>;
export type LtmDraftSource = z.infer<typeof ltmDraftSourceSchema>;
export type LtmDraftNoteInput = z.infer<typeof ltmDraftNoteInputSchema>;
export type LtmDraftMutation = z.infer<typeof ltmDraftMutationSchema>;
export type LtmExtractionDraft = z.infer<typeof ltmExtractionDraftSchema>;
export type LtmExtractionDropReason = z.infer<typeof ltmExtractionDropReasonSchema>;
export type LtmExtractionRecoveryHint = z.infer<typeof ltmExtractionRecoveryHintSchema>;
export type LtmExtractionDroppedCandidate = z.infer<typeof ltmExtractionDroppedCandidateSchema>;
export type LtmRejectedSuggestion = z.infer<typeof ltmRejectedSuggestionSchema>;
export type LtmResolveSubjectIdentityResponse = z.infer<typeof ltmResolveSubjectIdentityResponseSchema>;
export type LtmExtractionOutcomeState = z.infer<typeof ltmExtractionOutcomeStateSchema>;
export type LtmExtractionOutcome = z.infer<typeof ltmExtractionOutcomeSchema>;
export type LtmExtractionResponse = z.infer<typeof ltmExtractionResponseSchema>;
export type LtmExtractionDiagnostic = z.infer<typeof ltmExtractionDiagnosticSchema>;
export type LtmExtractionAccounting = z.infer<typeof ltmExtractionAccountingSchema>;
export type LtmDraftFreshness = z.infer<typeof ltmDraftFreshnessSchema>;
export type LtmDraftBlockReason = z.infer<typeof ltmDraftBlockReasonSchema>;
export type LtmMutationDisposition = z.infer<typeof ltmMutationDispositionSchema>;
export type LtmDraftReviewChange = z.infer<typeof ltmDraftReviewChangeSchema>;
export type LtmDraftReviewMutation = z.infer<typeof ltmDraftReviewMutationSchema>;
export type LtmDraftReviewTarget = z.infer<typeof ltmDraftReviewTargetSchema>;
export type LtmDraftReviewDraft = z.infer<typeof ltmDraftReviewDraftSchema>;
export type LtmDraftReviewSource = z.infer<typeof ltmDraftReviewSourceSchema>;
export type LtmDraftReviewResponse = z.infer<typeof ltmDraftReviewResponseSchema>;
export type LtmDraftPreflightRequest = z.infer<typeof ltmDraftPreflightRequestSchema>;
export type LtmDraftPreflightBlocker = z.infer<typeof ltmDraftPreflightBlockerSchema>;
export type LtmDraftPreflightRow = z.infer<typeof ltmDraftPreflightRowSchema>;
export type LtmDraftPreflightResponse = z.infer<typeof ltmDraftPreflightResponseSchema>;
export type LtmRejectedSuggestionsResponse = z.infer<typeof ltmRejectedSuggestionsResponseSchema>;
export type LtmRejectedSuggestionsClearResponse = z.infer<typeof ltmRejectedSuggestionsClearResponseSchema>;
export type LtmExtractSourceNoteRequest = z.infer<typeof ltmExtractSourceNoteRequestSchema>;
export type LtmExtractSourceNoteResponse = z.infer<typeof ltmExtractSourceNoteResponseSchema>;
export type LtmEvidenceUnitExtractionResponse = z.infer<typeof ltmEvidenceUnitExtractionResponseSchema>;
export type LtmPendingDraftsCountResponse = z.infer<typeof ltmPendingDraftsCountResponseSchema>;
