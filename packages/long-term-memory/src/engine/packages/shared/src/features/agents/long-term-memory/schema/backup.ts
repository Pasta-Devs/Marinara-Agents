import { z } from "zod";
import { ltmIsoTimestampSchema, ltmScopeAliasConflict } from "./primitives.js";
import {
  ltmAgentSettingsSchema,
  ltmExtractionSettingsSchema,
  ltmGlobalSettingsSchema,
  ltmPoliciesConfigSchema,
  ltmRetentionConfigSchema,
  ltmRetrievalConfigSchema,
} from "./settings.js";
import { ltmNoteSchema } from "./notes.js";
import { ltmExtractionDraftSchema, ltmRejectedSuggestionSchema } from "./drafts.js";

export const ltmBackupSchema = z
  .object({
    format: z.literal("marinara-long-term-memory"),
    version: z.literal(1),
    exportedAt: ltmIsoTimestampSchema,
    notes: z.array(ltmNoteSchema).max(50_000),
    drafts: z.array(ltmExtractionDraftSchema).max(50_000),
    rejectedSuggestions: z.array(ltmRejectedSuggestionSchema).max(10_000).default([]),
    settings: z
      .object({
        global: ltmGlobalSettingsSchema,
        extraction: ltmExtractionSettingsSchema,
        policies: ltmPoliciesConfigSchema.optional(),
        retrieval: ltmRetrievalConfigSchema.optional(),
        retention: ltmRetentionConfigSchema,
        agent: ltmAgentSettingsSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((backup, ctx) => {
    for (const [index, note] of backup.notes.entries()) {
      const conflict = ltmScopeAliasConflict(note.scope);
      if (!conflict) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes", index, "scope"],
        message: conflict,
      });
    }
  });

export type LtmBackup = z.infer<typeof ltmBackupSchema>;
