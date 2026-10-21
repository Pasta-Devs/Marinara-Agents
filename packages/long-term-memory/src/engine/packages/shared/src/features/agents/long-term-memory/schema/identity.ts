import { z } from "zod";
import {
  ltmIdentityMatchBasisSchema,
  ltmIsoTimestampSchema,
  ltmNoteIdSchema,
  ltmScopeSchema,
  ltmSectionKeySchema,
  ltmSubjectSchema,
  ltmSubjectsSchema,
} from "./primitives.js";
import { ltmTransferRebuildSummarySchema } from "./notes.js";
import { ltmIntegrityResponseSchema } from "./indexes.js";

export const ltmIdentityRepairNoteMatchSchema = z
  .object({
    noteId: ltmNoteIdSchema,
    title: z.string().min(1).max(240),
    createdAt: ltmIsoTimestampSchema,
    basis: ltmIdentityMatchBasisSchema,
    alreadyBound: z.boolean(),
    exactFullName: z.boolean(),
  })
  .strict();

export const ltmIdentityRepairAdditiveContentSchema = z
  .object({
    sectionKey: ltmSectionKeySchema,
    addedLines: z.array(z.string().min(1).max(20_000)).max(2_000),
    sourceNoteIds: z.array(ltmNoteIdSchema).min(1).max(500),
  })
  .strict();

export const ltmIdentityRepairSupersedingOptionSchema = z
  .object({
    noteIds: z.array(ltmNoteIdSchema).min(1).max(500),
    text: z.string().min(1).max(20_000),
  })
  .strict();

export const ltmIdentityRepairSupersedingConflictSchema = z
  .object({
    sectionKey: ltmSectionKeySchema,
    options: z.array(ltmIdentityRepairSupersedingOptionSchema).min(2).max(500),
  })
  .strict();

export const ltmIdentityRepairCandidateSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    noteType: z.enum(["character", "relationship"]),
    subjects: ltmSubjectsSchema,
    subjectNames: z.array(z.string().min(1).max(240)).min(1).max(2),
    canonicalNoteId: ltmNoteIdSchema,
    duplicateNoteIds: z.array(ltmNoteIdSchema).max(499),
    notes: z.array(ltmIdentityRepairNoteMatchSchema).min(1).max(500),
    matchBasis: z.array(ltmIdentityMatchBasisSchema).min(1).max(5),
    additiveContent: z.array(ltmIdentityRepairAdditiveContentSchema).max(100),
    supersedingConflicts: z.array(ltmIdentityRepairSupersedingConflictSchema).max(100),
    blockingReasons: z.array(z.string().min(1).max(500)).max(100),
  })
  .strict();

export const ltmIdentityRepairUnresolvedSchema = z
  .object({
    noteId: ltmNoteIdSchema,
    noteType: z.enum(["character", "relationship"]),
    title: z.string().min(1).max(240),
    reason: z.enum(["ambiguous", "untrusted", "invalid_cardinality"]),
    basis: z.string().min(1).max(120),
    candidateSubjectKeys: z.array(z.string().min(1).max(240)).max(20).default([]),
  })
  .strict();

export const ltmIdentityRepairPreviewRequestSchema = z
  .object({
    scope: ltmScopeSchema.default({}),
    canonicalNoteIds: z.record(ltmNoteIdSchema).optional(),
  })
  .strict();

export const ltmIdentityRepairPreviewResponseSchema = z
  .object({
    generatedAt: ltmIsoTimestampSchema,
    scope: ltmScopeSchema,
    counts: z
      .object({
        analyzedNotes: z.number().int().min(0),
        candidateCount: z.number().int().min(0),
        bindableNotes: z.number().int().min(0),
        duplicateNotes: z.number().int().min(0),
        unresolvedNotes: z.number().int().min(0),
      })
      .strict(),
    candidates: z.array(ltmIdentityRepairCandidateSchema).max(500),
    unresolved: z.array(ltmIdentityRepairUnresolvedSchema).max(10_000),
  })
  .strict();

export const ltmIdentityRepairSelectionSchema = z
  .object({
    candidateId: z.string().regex(/^[a-f0-9]{64}$/),
    canonicalNoteId: ltmNoteIdSchema,
    excludedNoteIds: z
      .array(ltmNoteIdSchema)
      .max(499)
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, "Excluded note IDs must be unique."),
    sectionChoices: z
      .array(
        z
          .object({
            sectionKey: ltmSectionKeySchema,
            noteId: ltmNoteIdSchema,
          })
          .strict(),
      )
      .max(100)
      .default([])
      .refine(
        (choices) => new Set(choices.map((choice) => choice.sectionKey)).size === choices.length,
        "Section choices must be unique.",
      ),
  })
  .strict()
  .refine((selection) => !selection.excludedNoteIds.includes(selection.canonicalNoteId), {
    path: ["excludedNoteIds"],
    message: "The canonical note cannot be excluded.",
  });

export const ltmIdentityRepairApplyRequestSchema = z
  .object({
    scope: ltmScopeSchema.default({}),
    repairs: z
      .array(ltmIdentityRepairSelectionSchema)
      .min(1)
      .max(500)
      .refine(
        (repairs) => new Set(repairs.map((repair) => repair.candidateId)).size === repairs.length,
        "Repair candidates must be unique.",
      ),
  })
  .strict();

export const ltmIdentityRepairApplyResultSchema = z
  .object({
    candidateId: z.string().regex(/^[a-f0-9]{64}$/),
    canonicalNoteId: ltmNoteIdSchema,
    archivedNoteIds: z.array(ltmNoteIdSchema).max(499),
    excludedNoteIds: z.array(ltmNoteIdSchema).max(499),
    rewrittenNoteCount: z.number().int().min(0),
    rewrittenDraftCount: z.number().int().min(0),
  })
  .strict();

export const ltmIdentityRepairApplyResponseSchema = z
  .object({
    repairedAt: ltmIsoTimestampSchema,
    backup: z
      .object({
        id: z.string().uuid(),
        createdAt: ltmIsoTimestampSchema,
      })
      .strict(),
    repairs: z.array(ltmIdentityRepairApplyResultSchema).min(1).max(500),
    rebuild: ltmTransferRebuildSummarySchema,
    integrity: ltmIntegrityResponseSchema,
  })
  .strict();

const ltmIdentityNameSchema = z.string().trim().min(1).max(240);
export const ltmSubjectIdentityReviewSchema = z
  .object({
    name: ltmIdentityNameSchema,
    candidates: z.array(z.object({ name: ltmIdentityNameSchema, subject: ltmSubjectSchema }).strict()).max(10),
    allowDifferent: z.boolean(),
    matchedSubjectKey: ltmSubjectSchema.shape.key.optional(),
  })
  .strict();

export const ltmSubjectIdentityDecisionSchema = z.discriminatedUnion("action", [
  z.object({ name: ltmIdentityNameSchema, action: z.literal("bind"), subjectKey: ltmSubjectSchema.shape.key }).strict(),
  z.object({ name: ltmIdentityNameSchema, action: z.literal("different") }).strict(),
  z.object({ name: ltmIdentityNameSchema, action: z.literal("skip") }).strict(),
]);
export const ltmResolveSubjectIdentityRequestSchema = z
  .object({
    choices: z.array(ltmSubjectIdentityDecisionSchema).min(1).max(2),
  })
  .strict();

export const ltmSavedSubjectIdentityChoiceSchema = z.discriminatedUnion("action", [
  z.object({ name: ltmIdentityNameSchema, action: z.literal("bind"), subject: ltmSubjectSchema }).strict(),
  z.object({ name: ltmIdentityNameSchema, action: z.literal("different"), subject: ltmSubjectSchema }).strict(),
  z.object({ name: ltmIdentityNameSchema, action: z.literal("skip") }).strict(),
]);
export type LtmIdentityRepairNoteMatch = z.infer<typeof ltmIdentityRepairNoteMatchSchema>;
export type LtmIdentityRepairAdditiveContent = z.infer<typeof ltmIdentityRepairAdditiveContentSchema>;
export type LtmIdentityRepairSupersedingOption = z.infer<typeof ltmIdentityRepairSupersedingOptionSchema>;
export type LtmIdentityRepairSupersedingConflict = z.infer<typeof ltmIdentityRepairSupersedingConflictSchema>;
export type LtmIdentityRepairCandidate = z.infer<typeof ltmIdentityRepairCandidateSchema>;
export type LtmIdentityRepairUnresolved = z.infer<typeof ltmIdentityRepairUnresolvedSchema>;
export type LtmIdentityRepairPreviewRequest = z.infer<typeof ltmIdentityRepairPreviewRequestSchema>;
export type LtmIdentityRepairPreviewResponse = z.infer<typeof ltmIdentityRepairPreviewResponseSchema>;
export type LtmIdentityRepairSelection = z.infer<typeof ltmIdentityRepairSelectionSchema>;
export type LtmIdentityRepairApplyRequest = z.infer<typeof ltmIdentityRepairApplyRequestSchema>;
export type LtmIdentityRepairApplyResult = z.infer<typeof ltmIdentityRepairApplyResultSchema>;
export type LtmIdentityRepairApplyResponse = z.infer<typeof ltmIdentityRepairApplyResponseSchema>;
export type LtmSubjectIdentityReview = z.infer<typeof ltmSubjectIdentityReviewSchema>;
export type LtmSubjectIdentityDecision = z.infer<typeof ltmSubjectIdentityDecisionSchema>;
export type LtmSavedSubjectIdentityChoice = z.infer<typeof ltmSavedSubjectIdentityChoiceSchema>;
