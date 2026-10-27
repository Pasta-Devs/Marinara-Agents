import { z } from "zod";

// Zod 3 intentionally omits an own "__proto__" key while parsing z.record.
// Validate records as entries so every valid user key survives without ever
// being assigned through an object's prototype setter.
export function ltmStringRecordSchema<T extends z.ZodTypeAny>(keySchema: z.ZodString, valueSchema: T) {
  return z
    .preprocess(
      (value) =>
        value && typeof value === "object" && !Array.isArray(value) ? { entries: Object.entries(value) } : value,
      z
        .object({
          entries: z.array(z.tuple([keySchema, valueSchema])),
        })
        .strict(),
    )
    .transform(({ entries }) => Object.fromEntries(entries) as Record<string, z.infer<T>>);
}

export const ltmNoteTypeSchema = z.enum([
  "source",
  "timeline_event",
  "character",
  "relationship",
  "scene",
  "thread",
  "world",
  "tone",
]);

export const ltmNoteTitleSchema = z.string().trim().min(1).max(240);
export const ltmEvidenceUnitTitleSchema = z.string().trim().min(1).max(80);

export const ltmStatusSchema = z.enum(["active", "resolved", "archived"]);

export const ltmEvidenceUnitStatusSchema = z.enum(["active", "resolved", "archived", "developing"]);

export const ltmEvidenceUnitBucketSchema = z.enum([
  "timeline_event",
  "character_fact",
  "relationship_state",
  "world_fact",
  "thread",
  "tone",
  "anchor",
]);

export const ltmClaimKindSchema = z.enum(["static", "change"]);

const ltmModeEnumSchema = z.enum(["roleplay", "conversation", "game"]);
/**
 * The retired "visual_novel" chat mode folds into Roleplay, its behavioural
 * successor (mirrors the Engine's retired-chat-mode migration). Persisted
 * vault entries and requests written by older builds may still carry the
 * retired value, so it is normalized here instead of failing the parse.
 */
export const ltmModeSchema = z.preprocess(
  (value) => (value === "visual_novel" ? "roleplay" : value),
  ltmModeEnumSchema,
);
export const LTM_EXTRACTION_MODES = ltmModeEnumSchema.options;

export const ltmExtractionReasoningEffortSchema = z.enum(["none", "low", "medium", "high"]);

export const ltmExtractionVerbositySchema = z.enum(["none", "low", "medium", "high"]);

export const ltmVaultFolderSchema = z.enum([
  "sources",
  "timeline",
  "characters",
  "relationships",
  "scenes",
  "threads",
  "world",
  "tone",
]);

export const LTM_NOTE_TYPE_TO_VAULT_FOLDER = {
  source: "sources",
  timeline_event: "timeline",
  character: "characters",
  relationship: "relationships",
  scene: "scenes",
  thread: "threads",
  world: "world",
  tone: "tone",
} as const satisfies Record<z.infer<typeof ltmNoteTypeSchema>, z.infer<typeof ltmVaultFolderSchema>>;

export const LTM_NOTE_ID_PREFIXES_BY_TYPE = {
  source: ["source_"],
  timeline_event: ["timeline_"],
  character: ["char_"],
  relationship: ["rel_"],
  scene: ["scene_"],
  thread: ["thread_"],
  world: ["world_", "faction_", "location_", "rule_", "rules"],
  tone: ["tone_"],
} as const satisfies Record<z.infer<typeof ltmNoteTypeSchema>, readonly string[]>;

export function allowedStoredNoteIdPrefixes(type: z.infer<typeof ltmNoteTypeSchema>) {
  return LTM_NOTE_ID_PREFIXES_BY_TYPE[type];
}

const LTM_SOURCE_SUMMARY_SCENE_TAGS = ["source_summary", "chat_summary"] as const;

export function hasLtmSourceSummarySceneTag(tags: readonly string[]) {
  return LTM_SOURCE_SUMMARY_SCENE_TAGS.some((tag) => tags.includes(tag));
}

export function isLtmSourceLikeNote(note: { type: z.infer<typeof ltmNoteTypeSchema>; tags: readonly string[] }) {
  return note.type === "source";
}

export const ltmIsoTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => !Number.isNaN(Date.parse(value)), "Timestamp must be parseable ISO-8601.");

export const ltmSafeRelativePathSchema = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => !value.includes("\0"), "Path cannot contain NUL bytes.")
  .refine((value) => !value.startsWith("/") && !value.startsWith("\\"), "Path must be relative.")
  .refine((value) => !/^[A-Za-z]:[\\/]/.test(value), "Path must not include a Windows drive prefix.")
  .refine(
    (value) => value.split(/[\\/]+/).every((part) => part.length > 0 && part !== "." && part !== ".."),
    "Path must not contain empty, current, or parent segments.",
  );

export const ltmIdentifierSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, "Identifier must be lowercase snake_case.");

export const ltmNoteIdSchema = ltmIdentifierSchema;

export const ltmSubjectReferenceSchema = z
  .object({
    kind: z.enum(["character", "persona", "local_character"]),
    id: z.string().trim().min(1).max(120),
  })
  .strict();

export const ltmSubjectSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Subject keys cannot contain control characters."),
    ref: ltmSubjectReferenceSchema.optional(),
  })
  .strict();

export const ltmSubjectsSchema = z
  .array(ltmSubjectSchema)
  .min(1)
  .max(2)
  .refine((subjects) => new Set(subjects.map((subject) => subject.key)).size === subjects.length, {
    message: "Subjects must be distinct.",
  })
  .refine((subjects) => subjects.every((subject, index) => index === 0 || subjects[index - 1]!.key < subject.key), {
    message: "Subjects must be sorted by stable key.",
  });

export function hasLocalCharacterSubject(subjects: readonly z.infer<typeof ltmSubjectSchema>[] | undefined) {
  return subjects?.some(
    (subject) => subject.ref?.kind === "local_character" || subject.key.startsWith("local_character:"),
  );
}

export const ltmSourceProvenanceSchema = z
  .object({
    kind: z.enum(["character", "lorebook", "chat_summary", "chat_transcript"]),
    sourceId: z.string().min(1).max(120),
    entryId: z.string().min(1).max(120).optional(),
  })
  .strict();

export const ltmSectionKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, "Section key must be lowercase snake_case.");

export const ltmScopeSchema = z
  .object({
    chatId: z.string().min(1).max(120).optional(),
    chatIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    groupId: z.string().min(1).max(120).optional(),
    groupIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    characterIds: z.array(z.string().min(1).max(120)).max(100).optional(),
    personaId: z.string().min(1).max(120).optional(),
    personaIds: z.array(z.string().min(1).max(120)).max(100).optional(),
  })
  .strict();

export function ltmScopeAliasConflict(
  scope:
    | {
        chatId?: string;
        chatIds?: readonly string[];
        groupId?: string;
        groupIds?: readonly string[];
        personaId?: string;
        personaIds?: readonly string[];
      }
    | null
    | undefined,
) {
  for (const [scalar, values, label] of [
    [scope?.chatId, scope?.chatIds, "chatId/chatIds"],
    [scope?.groupId, scope?.groupIds, "groupId/groupIds"],
    [scope?.personaId, scope?.personaIds, "personaId/personaIds"],
  ] as const) {
    if (scalar && values !== undefined && !values.includes(scalar)) return `${label} must identify the same scope.`;
  }
  return null;
}

export const ltmWriteScopeSchema = ltmScopeSchema.superRefine((scope, ctx) => {
  const conflict = ltmScopeAliasConflict(scope);
  if (conflict) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: conflict });
});

/**
 * The context that a source was successfully extracted against. Keep the
 * source material hash separate from the context fields so a stale draft can
 * explain whether its content or extraction context changed.
 */
export const ltmExtractionFingerprintSchema = z
  .object({
    version: z.union([z.literal(2), z.literal(3)]),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    provenance: ltmSourceProvenanceSchema.nullable(),
    scope: ltmScopeSchema,
    modes: z.array(ltmModeSchema).min(1).max(8),
    extractionMode: ltmModeSchema,
  })
  .strict();

export const ltmLinkRelationSchema = z.enum([
  "occurred_in",
  "triggered_by",
  "resolved_in",
  "evidenced_by",
  "affects_relationship",
  "affects_character",
  "caused_by",
  "involves",
  "blocks",
  "planted_in",
  "paid_off_in",
  "extracted_from",
]);

export const ltmLinkSchema = z
  .object({
    target: ltmNoteIdSchema,
    relation: ltmLinkRelationSchema,
    aspect: z.string().max(50).optional(),
  })
  .strict();

/**
 * Structured extraction importance. Used by compilation, UI editing, and
 * retrieval weighting instead of encoding markers into section text.
 */
export const ltmImportanceSchema = z.enum(["critical", "major", "moderate", "minor"]);

/**
 * Relationship dimensions are optional 0-100 scores. Omitted values are treated
 * as the neutral baseline by consumers.
 */
export const ltmRelationshipDimensionsSchema = z
  .object({
    trust: z.number().int().min(0).max(100).optional(),
    respect: z.number().int().min(0).max(100).optional(),
    loyalty: z.number().int().min(0).max(100).optional(),
    intimacy: z.number().int().min(0).max(100).optional(),
    tension: z.number().int().min(0).max(100).optional(),
    hostility: z.number().int().min(0).max(100).optional(),
    dependency: z.number().int().min(0).max(100).optional(),
    affection: z.number().int().min(0).max(100).optional(),
    lust: z.number().int().min(0).max(100).optional(),
    protectiveness: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const ltmRelationshipDimensionChangesSchema = z
  .object({
    trust: z.number().int().min(-100).max(100).optional(),
    respect: z.number().int().min(-100).max(100).optional(),
    loyalty: z.number().int().min(-100).max(100).optional(),
    intimacy: z.number().int().min(-100).max(100).optional(),
    tension: z.number().int().min(-100).max(100).optional(),
    hostility: z.number().int().min(-100).max(100).optional(),
    dependency: z.number().int().min(-100).max(100).optional(),
    affection: z.number().int().min(-100).max(100).optional(),
    lust: z.number().int().min(-100).max(100).optional(),
    protectiveness: z.number().int().min(-100).max(100).optional(),
  })
  .strict();

export const ltmIdentityMatchBasisSchema = z.enum([
  "bound_subjects",
  "exact_name",
  "unique_alias",
  "trait_or_qualified_alias",
  "spelling_variation",
  "unordered_pair",
]);

export const ltmInteropSourceSchema = z.enum(["characters", "lorebooks", "chats", "messages"]);

export type LtmNoteType = z.infer<typeof ltmNoteTypeSchema>;
export type LtmStatus = z.infer<typeof ltmStatusSchema>;
export type LtmEvidenceUnitStatus = z.infer<typeof ltmEvidenceUnitStatusSchema>;
export type LtmEvidenceUnitBucket = z.infer<typeof ltmEvidenceUnitBucketSchema>;
export type LtmImportance = z.infer<typeof ltmImportanceSchema>;
export type LtmRelationshipDimensions = z.infer<typeof ltmRelationshipDimensionsSchema>;
export type LtmRelationshipDimensionChanges = z.infer<typeof ltmRelationshipDimensionChangesSchema>;
export type LtmExtractionReasoningEffort = z.infer<typeof ltmExtractionReasoningEffortSchema>;
export type LtmExtractionVerbosity = z.infer<typeof ltmExtractionVerbositySchema>;
export type LtmMode = z.infer<typeof ltmModeSchema>;
export type LtmScope = z.infer<typeof ltmScopeSchema>;
export type LtmExtractionFingerprint = z.infer<typeof ltmExtractionFingerprintSchema>;
export type LtmSubjectReference = z.infer<typeof ltmSubjectReferenceSchema>;
export type LtmSubject = z.infer<typeof ltmSubjectSchema>;
export type LtmLink = z.infer<typeof ltmLinkSchema>;
export type LtmSourceProvenance = z.infer<typeof ltmSourceProvenanceSchema>;
export type LtmIdentityMatchBasis = z.infer<typeof ltmIdentityMatchBasisSchema>;
export type LtmClaimKind = z.infer<typeof ltmClaimKindSchema>;
export type LtmInteropSource = z.infer<typeof ltmInteropSourceSchema>;
