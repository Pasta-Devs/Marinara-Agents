import { z } from "zod";
import {
  DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE,
  DEFAULT_LTM_RECALL_PREAMBLE,
  DEFAULT_LTM_RECALL_STYLE,
  DEFAULT_LTM_RECALL_STYLE_WEIGHTS,
  LTM_EXTRACTION_MAX_CANDIDATES,
  LTM_EXTRACTION_MAX_REJECTION_DETAILS,
} from "./constants.js";

// Zod 3 intentionally omits an own "__proto__" key while parsing z.record.
// Validate records as entries so every valid user key survives without ever
// being assigned through an object's prototype setter.
function ltmStringRecordSchema<T extends z.ZodTypeAny>(keySchema: z.ZodString, valueSchema: T) {
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
const LTM_EXTRACTION_MODES = ltmModeEnumSchema.options;

export const ltmExtractionReasoningEffortSchema = z.enum(["none", "low", "medium", "high"]);

export const ltmExtractionVerbositySchema = z.enum(["none", "low", "medium", "high"]);

const ltmGlobalSettingsShape = z
  .object({
    version: z.literal(1).default(1),
    enableLongTermMemory: z.boolean().optional(),
    longTermMemoryBudgetTokens: z.number().int().min(128).max(16_384).optional(),
    longTermMemoryMaxChunks: z.number().int().min(1).max(100).optional(),
    longTermMemoryScoreThreshold: z.number().finite().min(0).max(1).optional(),
    longTermMemoryRecallContextMessages: z.number().int().min(1).max(20).optional(),
    longTermMemoryRecallStyle: z.enum(["balanced", "exact", "broad", "story", "custom"]).optional(),
    longTermMemorySemanticWeight: z.number().finite().min(0).max(1).nullable().optional(),
    longTermMemoryLexicalWeight: z.number().finite().min(0).max(1).nullable().optional(),
    longTermMemoryGraphWeight: z.number().finite().min(0).max(1).nullable().optional(),
    longTermMemoryKeywordWeight: z.number().finite().min(0).max(1).nullable().optional(),
    longTermMemoryIncludeResolved: z.boolean().optional(),
    longTermMemoryRecallPreamble: z.string().max(500).optional(),
    longTermMemoryDebug: z.boolean().optional(),
  })
  .strict();

const LTM_GLOBAL_LEGACY_KEYS = /^(importConcurrency|connectionId|model|instruction|autoApplyLowRisk)$/;

export const ltmGlobalSettingsSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const input = value as Record<string, unknown>;
  const normalized = { ...input };
  delete normalized.extractionMode;
  delete normalized.longTermMemoryMetadataWeight;
  for (const key of Object.keys(normalized)) {
    if (LTM_GLOBAL_LEGACY_KEYS.test(key)) delete normalized[key];
  }
  if ("longTermMemoryRecallStyle" in normalized) {
    normalized.longTermMemoryRecallStyle =
      input.longTermMemoryRecallStyle === "exact" ||
      input.longTermMemoryRecallStyle === "broad" ||
      input.longTermMemoryRecallStyle === "story" ||
      input.longTermMemoryRecallStyle === "custom" ||
      input.longTermMemoryRecallStyle === "balanced"
        ? input.longTermMemoryRecallStyle
        : undefined;
  }
  return normalized;
}, ltmGlobalSettingsShape);

export const ltmResolvedGlobalSettingsSchema = z
  .object({
    version: z.literal(1),
    enableLongTermMemory: z.boolean(),
    longTermMemoryBudgetTokens: z.number().int().min(128).max(16_384),
    longTermMemoryMaxChunks: z.number().int().min(1).max(100),
    longTermMemoryScoreThreshold: z.number().finite().min(0).max(1),
    longTermMemoryRecallContextMessages: z.number().int().min(1).max(20),
    longTermMemoryRecallStyle: z.enum(["balanced", "exact", "broad", "story", "custom"]),
    longTermMemorySemanticWeight: z.number().finite().min(0).max(1),
    longTermMemoryLexicalWeight: z.number().finite().min(0).max(1),
    longTermMemoryGraphWeight: z.number().finite().min(0).max(1),
    longTermMemoryKeywordWeight: z.number().finite().min(0).max(1),
    longTermMemoryIncludeResolved: z.boolean(),
    longTermMemoryRecallPreamble: z.string().max(500),
    longTermMemoryDebug: z.boolean(),
  })
  .strict();

export const DEFAULT_LTM_GLOBAL_SETTINGS = ltmResolvedGlobalSettingsSchema.parse({
  version: 1,
  enableLongTermMemory: true,
  longTermMemoryBudgetTokens: 4096,
  longTermMemoryMaxChunks: 20,
  longTermMemoryScoreThreshold: 0,
  longTermMemoryRecallContextMessages: 4,
  longTermMemoryRecallStyle: DEFAULT_LTM_RECALL_STYLE,
  longTermMemorySemanticWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.semanticWeight,
  longTermMemoryLexicalWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.lexicalWeight,
  longTermMemoryGraphWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.graphWeight,
  longTermMemoryKeywordWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.keywordWeight,
  longTermMemoryIncludeResolved: false,
  longTermMemoryRecallPreamble: DEFAULT_LTM_RECALL_PREAMBLE,
  longTermMemoryDebug: false,
});

const ltmExtractionPromptTemplateIdSchema = z.string().trim().min(1).max(64);

export const ltmExtractionPromptTemplateSchema = z
  .object({
    id: ltmExtractionPromptTemplateIdSchema,
    name: z.string().trim().min(1).max(120),
    prompt: z.string().min(1).max(20_000),
  })
  .strict();

const LTM_EXTRACTION_MODE_LABELS = {
  roleplay: "Roleplay",
  conversation: "Conversation",
  game: "Game",
} as const satisfies Record<(typeof LTM_EXTRACTION_MODES)[number], string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isLtmExtractionMode(value: unknown): value is (typeof LTM_EXTRACTION_MODES)[number] {
  return value === "roleplay" || value === "conversation" || value === "game";
}

function stripLegacyPromptTemplateMode(template: unknown) {
  if (!isRecord(template)) return template;
  const { mode: _mode, ...rest } = template;
  return rest;
}

function nextLegacyPromptTemplateId(mode: (typeof LTM_EXTRACTION_MODES)[number], usedIds: Set<string>) {
  const base = `legacy_${mode}_system_prompt`;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }
  let suffix = 2;
  while (usedIds.has(`${base}_${suffix}`)) suffix += 1;
  const id = `${base}_${suffix}`;
  usedIds.add(id);
  return id;
}

function foldRetiredVisualNovelMode(value: Record<string, unknown>) {
  // The retired "visual_novel" mode folds into Roleplay, its behavioural
  // successor (mirrors the Engine's retired-chat-mode migration). Stored
  // settings from before the retirement may still carry the key; without this
  // fold the strict schemas below would reject them.
  const folded: Record<string, unknown> = { ...value };
  for (const key of ["activePromptTemplateIdsByMode", "systemPromptsByMode"]) {
    const record = folded[key];
    if (!isRecord(record) || !("visual_novel" in record)) continue;
    const { visual_novel: legacyValue, ...rest } = record;
    folded[key] = rest.roleplay === undefined && legacyValue !== undefined ? { ...rest, roleplay: legacyValue } : rest;
  }
  return folded;
}

function normalizeLegacyExtractionSettings(value: unknown) {
  if (!isRecord(value)) return value;
  const input = foldRetiredVisualNovelMode(value);
  const normalized: Record<string, unknown> = { ...input };
  if (typeof input.useExtractionAgentOnGameMode !== "boolean" && typeof input.refinePass === "boolean") {
    normalized.useExtractionAgentOnGameMode = input.refinePass;
  }
  delete normalized.refinePass;
  delete normalized.rejectPlaceholderOutput;
  delete normalized.systemPrompt;
  delete normalized.systemPromptsByMode;
  delete normalized.activePromptTemplateId;

  const rawTemplates = Array.isArray(input.promptTemplates) ? input.promptTemplates : [];
  const promptTemplates = rawTemplates.map(stripLegacyPromptTemplateMode);
  const templateIds = new Set<string>();
  const legacyTemplateModes = new Map<string, (typeof LTM_EXTRACTION_MODES)[number]>();
  for (const template of rawTemplates) {
    if (!isRecord(template) || typeof template.id !== "string") continue;
    templateIds.add(template.id);
    if (isLtmExtractionMode(template.mode)) legacyTemplateModes.set(template.id, template.mode);
  }

  if (rawTemplates.length > 0) normalized.promptTemplates = promptTemplates;

  const modeIds = isRecord(input.activePromptTemplateIdsByMode) ? input.activePromptTemplateIdsByMode : {};
  const legacyActiveId = typeof input.activePromptTemplateId === "string" ? input.activePromptTemplateId : null;
  const hasLegacyPromptOverrides = typeof input.systemPrompt === "string" || isRecord(input.systemPromptsByMode);
  const hasLegacyActiveShape = Boolean(legacyActiveId) || legacyTemplateModes.size > 0 || hasLegacyPromptOverrides;
  let activePromptTemplateIdsByMode: Record<string, string | null> = {};

  if (hasLegacyActiveShape) {
    for (const mode of LTM_EXTRACTION_MODES) {
      const hasModeId = Object.prototype.hasOwnProperty.call(modeIds, mode);
      const modeId = modeIds[mode];
      if (
        typeof modeId === "string" &&
        templateIds.has(modeId) &&
        (!legacyTemplateModes.has(modeId) || legacyTemplateModes.get(modeId) === mode)
      ) {
        activePromptTemplateIdsByMode[mode] = modeId;
      } else if (modeId === null) {
        activePromptTemplateIdsByMode[mode] = null;
      } else if (
        !hasModeId &&
        legacyActiveId &&
        templateIds.has(legacyActiveId) &&
        (!legacyTemplateModes.has(legacyActiveId) || legacyTemplateModes.get(legacyActiveId) === mode)
      ) {
        activePromptTemplateIdsByMode[mode] = legacyActiveId;
      }
    }
  } else if (isRecord(input.activePromptTemplateIdsByMode)) {
    activePromptTemplateIdsByMode = {
      ...input.activePromptTemplateIdsByMode,
    } as Record<string, string | null>;
  }

  const systemPromptsByMode = isRecord(input.systemPromptsByMode) ? input.systemPromptsByMode : {};
  const legacySystemPrompt = typeof input.systemPrompt === "string" ? input.systemPrompt.trim() : "";
  const migratedTemplates = [...promptTemplates];
  for (const mode of LTM_EXTRACTION_MODES) {
    const modePrompt = typeof systemPromptsByMode[mode] === "string" ? systemPromptsByMode[mode].trim() : "";
    const prompt =
      modePrompt && modePrompt !== DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE[mode]
        ? modePrompt
        : legacySystemPrompt && legacySystemPrompt !== DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE[mode]
          ? legacySystemPrompt
          : "";
    if (!prompt || migratedTemplates.length >= 50) continue;
    const id = nextLegacyPromptTemplateId(mode, templateIds);
    migratedTemplates.push({
      id,
      name: `Legacy ${LTM_EXTRACTION_MODE_LABELS[mode]} prompt`,
      prompt,
    });
    if (!activePromptTemplateIdsByMode[mode]) activePromptTemplateIdsByMode[mode] = id;
  }

  if (migratedTemplates.length > 0) normalized.promptTemplates = migratedTemplates;
  if (Object.keys(activePromptTemplateIdsByMode).length > 0) {
    normalized.activePromptTemplateIdsByMode = activePromptTemplateIdsByMode;
  } else {
    delete normalized.activePromptTemplateIdsByMode;
  }

  return normalized;
}

const ltmActivePromptTemplateIdsByModeSchema = z
  .object({
    roleplay: z.string().min(1).max(64).nullable().optional(),
    conversation: z.string().min(1).max(64).nullable().optional(),
    game: z.string().min(1).max(64).nullable().optional(),
  })
  .strict();

const ltmPromptTemplatesSchema = z
  .array(ltmExtractionPromptTemplateSchema)
  .max(50)
  .refine(
    (templates) => new Set(templates.map((template) => template.id)).size === templates.length,
    "Prompt template IDs must be unique.",
  )
  .optional();

const ltmExtractionSettingsFields = {
  version: z.literal(1).default(1),
  connectionId: z.string().min(1).max(120).nullable().optional(),
  reasoningEffort: ltmExtractionReasoningEffortSchema.optional(),
  verbosity: ltmExtractionVerbositySchema.optional(),
  maxOutputTokens: z.number().int().min(512).max(32_768).optional(),
  temperature: z.number().finite().min(0).max(2).optional(),
  maxSourceTokens: z.number().int().min(128).max(65_536).optional(),
  maxExistingNoteTokens: z.number().int().min(128).max(32_768).optional(),
  existingNoteMaxChunks: z.number().int().min(1).max(100).optional(),
  existingNoteMaxTokens: z.number().int().min(128).max(32_768).optional(),
  promptTemplates: ltmPromptTemplatesSchema,
  activePromptTemplateIdsByMode: ltmActivePromptTemplateIdsByModeSchema.optional(),
  aiKeywordExtraction: z.boolean().optional(),
  useExtractionAgentOnGameMode: z.boolean().optional(),
};

const ltmExtractionSettingsShape = z
  .object(ltmExtractionSettingsFields)
  .strict()
  .superRefine((settings, ctx) => {
    const templateIds = new Set(settings.promptTemplates?.map((template) => template.id) ?? []);
    for (const mode of LTM_EXTRACTION_MODES) {
      const templateId = settings.activePromptTemplateIdsByMode?.[mode];
      if (templateId && !templateIds.has(templateId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activePromptTemplateIdsByMode", mode],
          message:
            "Active prompt template IDs must resolve to a configured template or be null for the built-in default.",
        });
      }
    }
  });

export const ltmExtractionSettingsPatchSchema = z.preprocess(
  (value) => normalizeLegacyExtractionSettings(value),
  z.object(ltmExtractionSettingsFields).strict(),
);

export const ltmExtractionSettingsSchema = z.preprocess((value) => {
  return normalizeLegacyExtractionSettings(value);
}, ltmExtractionSettingsShape);

export const ltmResolvedExtractionSettingsSchema = z
  .object({
    version: z.literal(1),
    connectionId: z.string().min(1).max(120).nullable(),
    systemPrompt: z.string().min(1).max(20_000),
    reasoningEffort: ltmExtractionReasoningEffortSchema,
    verbosity: ltmExtractionVerbositySchema,
    maxOutputTokens: z.number().int().min(512).max(32_768),
    temperature: z.number().finite().min(0).max(2),
    maxSourceTokens: z.number().int().min(128).max(65_536),
    maxExistingNoteTokens: z.number().int().min(128).max(32_768),
    existingNoteMaxChunks: z.number().int().min(1).max(100),
    existingNoteMaxTokens: z.number().int().min(128).max(32_768),
    promptTemplates: z.array(ltmExtractionPromptTemplateSchema).max(50),
    activePromptTemplateId: z.string().min(1).max(64).nullable(),
    activePromptTemplateIdsByMode: ltmActivePromptTemplateIdsByModeSchema,
    aiKeywordExtraction: z.boolean(),
    useExtractionAgentOnGameMode: z.boolean(),
  })
  .strict();

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

function allowedStoredNoteIdPrefixes(type: z.infer<typeof ltmNoteTypeSchema>) {
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

const ltmIdentifierSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, "Identifier must be lowercase snake_case.");

export const ltmNoteIdSchema = ltmIdentifierSchema;

export const ltmSubjectReferenceSchema = z
  .object({
    kind: z.enum(["character", "persona"]),
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

export const ltmSourceProvenanceSchema = z
  .object({
    kind: z.enum(["character", "lorebook", "chat_summary"]),
    sourceId: z.string().min(1).max(120),
    entryId: z.string().min(1).max(120).optional(),
  })
  .strict();

export const ltmSectionKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, "Section key must be lowercase snake_case.");

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

export const ltmLinkSchema = z
  .object({
    target: ltmNoteIdSchema,
    relation: z.enum([
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
    ]),
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

export const ltmDebugStatusSchema = z.enum(["started", "ok", "skipped", "warning", "error"]);

export const ltmDebugPhaseSchema = z.enum([
  "import",
  "source_note",
  "extraction",
  "llm",
  "compiler",
  "draft",
  "apply",
  "injection",
  "retrieval",
  "rebuild",
  "repair",
  "replay",
  "diagnostic",
]);

export const ltmDebugErrorSchema = z
  .object({
    name: z.string().max(120).optional(),
    message: z.string().max(2_000),
    stack: z.string().max(6_000).optional(),
    code: z.string().max(120).optional(),
  })
  .strict();

export const ltmDebugEventSchema = z
  .object({
    id: z.string().uuid(),
    ts: ltmIsoTimestampSchema,
    operationId: z.string().uuid(),
    phase: ltmDebugPhaseSchema,
    action: z.string().min(1).max(120),
    status: ltmDebugStatusSchema,
    message: z.string().max(2_000).optional(),
    durationMs: z.number().int().min(0).max(86_400_000).optional(),
    source: z.string().max(120).optional(),
    sourceId: z.string().max(240).optional(),
    sourceNoteId: ltmNoteIdSchema.optional(),
    draftId: z.string().uuid().optional(),
    noteId: ltmNoteIdSchema.optional(),
    mutationIds: z.array(z.string().uuid()).max(100).optional(),
    counts: z.record(z.number().int().min(0)).optional(),
    diagnostics: z.array(z.record(z.unknown())).max(80).optional(),
    provider: z.string().max(120).optional(),
    model: z.string().max(240).optional(),
    error: ltmDebugErrorSchema.optional(),
    details: z.record(z.unknown()).optional(),
    chatId: z.string().max(200).optional(),
    uiSummary: z.string().max(4_000).optional(),
  })
  .strict();

const ltmPolicySchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const {
      updateBehavior: _updateBehavior,
      reconcileEvery: _reconcileEvery,
      summarization: _summarization,
      pinAgainstSummarization: _pinAgainstSummarization,
      autoArchiveOn: _autoArchiveOn,
      ...rest
    } = value as Record<string, unknown>;
    return rest;
  },
  z
    .object({
      type: ltmNoteTypeSchema,
      injection: z.enum(["always_for_active_characters", "on_relevance", "never"]).default("on_relevance"),
      sectionsAlways: z.array(ltmSectionKeySchema).default([]),
      sectionsOnRelevance: z.array(z.union([ltmSectionKeySchema, z.literal("*")])).default(["*"]),
    })
    .strict(),
);

const ltmPoliciesConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    policies: z.array(ltmPolicySchema).default([]),
  })
  .strict();

const ltmRetrievalConfigShape = z
  .object({
    version: z.literal(1).default(1),
    maxChunks: z.number().int().min(1).max(100).default(12),
    maxTokens: z.number().int().min(128).max(16_384).default(2_048),
    semanticWeight: z.number().finite().min(0).max(1).default(0.6),
    lexicalWeight: z.number().finite().min(0).max(1).default(0.3),
    graphWeight: z.number().finite().min(0).max(1).default(0.1),
    keywordWeight: z.number().finite().min(0).max(1).default(0.2),
    maxMetadataCandidates: z.number().int().min(1).max(5_000).default(256),
    maxDirectCandidates: z.number().int().min(1).max(5_000).default(128),
    maxLexicalCandidates: z.number().int().min(1).max(5_000).default(128),
    maxKeywordCandidates: z.number().int().min(1).max(5_000).default(128),
    maxVectorCandidates: z.number().int().min(1).max(5_000).default(256),
    maxGraphCandidates: z.number().int().min(1).max(5_000).default(128),
    maxMandatoryCandidates: z.number().int().min(1).max(5_000).default(128),
  })
  .strict()
  .refine(
    (value) => value.semanticWeight + value.lexicalWeight + value.graphWeight + value.keywordWeight > 0,
    "At least one retrieval weight must be positive.",
  );

const ltmRetrievalConfigSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { enabled: _enabled, ...rest } = value as Record<string, unknown>;
  return rest;
}, ltmRetrievalConfigShape);

export const ltmRetentionConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    auditWindowDays: z.number().int().min(1).max(3_650).default(30),
    usageRetentionDays: z.number().int().min(1).max(3_650).default(180),
    receiptRetentionDays: z.number().int().min(1).max(3_650).default(180),
    eventRetentionDays: z.number().int().min(1).max(3_650).default(180),
    incompleteGenerationRetentionDays: z.number().int().min(1).max(3_650).default(30),
    quarantineRetentionDays: z.number().int().min(1).max(3_650).default(90),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of [
      "usageRetentionDays",
      "receiptRetentionDays",
      "eventRetentionDays",
      "incompleteGenerationRetentionDays",
      "quarantineRetentionDays",
    ] as const) {
      if (value[key] < value.auditWindowDays) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} cannot be shorter than auditWindowDays.`,
        });
      }
    }
  });

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

export const ltmIdentityMatchBasisSchema = z.enum([
  "bound_subjects",
  "exact_name",
  "unique_alias",
  "trait_or_qualified_alias",
  "spelling_variation",
  "unordered_pair",
]);

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

export const ltmTransferRebuildSummarySchema = z
  .object({
    generatedAt: ltmIsoTimestampSchema,
    noteCount: z.number().int().min(0),
    chunkCount: z.number().int().min(0),
    embeddedChunkCount: z.number().int().min(0),
    embeddingsAvailable: z.boolean(),
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
      kind: z.literal("set_subjects"),
      noteId: ltmNoteIdSchema,
      subjects: ltmSubjectsSchema,
    })
    .strip(),
]);

export const ltmExtractionDropReasonSchema = z.enum([
  "invalid_format",
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
    message: z.string().min(1).max(240),
    snippet: z.string().min(1).max(280).optional(),
    issues: z.array(z.string().trim().min(1).max(240)).max(8).optional(),
    recovery: ltmExtractionRecoveryHintSchema.optional(),
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
  })
  .strict();

export const ltmExtractionOutcomeStateSchema = z.enum(["success", "partial_success", "no_suggestions_created"]);

export const ltmExtractionOutcomeSchema = z
  .object({
    state: ltmExtractionOutcomeStateSchema,
    totalCandidates: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    keptUnits: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    droppedUnits: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
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
    providerCandidates: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    normalizedAdditions: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    parserRejections: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    validationRejections: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    deduplications: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
    keptUnits: z.number().int().min(0).max(LTM_EXTRACTION_MAX_CANDIDATES),
  })
  .strict()
  .superRefine((accounting, ctx) => {
    const candidates = accounting.providerCandidates + accounting.normalizedAdditions;
    const dispositions =
      accounting.parserRejections + accounting.validationRejections + accounting.deduplications + accounting.keptUnits;
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
    kind: z.enum(["section", "link", "keywords", "status", "subjects"]),
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

export const ltmRejectedSuggestionsResponseSchema = z
  .object({
    suggestions: z.array(ltmRejectedSuggestionSchema).max(10_000),
    total: z.number().int().min(0).max(10_000),
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

export const ltmInteropSourceSchema = z.enum(["characters", "lorebooks", "chats"]);

export const ltmInteropPreviewRequestSchema = z
  .object({
    source: ltmInteropSourceSchema,
    limit: z.number().int().min(1).max(100).default(100),
    scope: ltmScopeSchema.optional(),
    mode: ltmModeSchema.optional(),
  })
  .strict();

const ltmInteropPreviewSampleBaseSchema = z.object({
  sourceId: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  mutationCount: z.number().int().min(0).max(10_000),
  summary: z.string().max(2_000),
  snippet: z.string().max(280),
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

export const ltmInteropPreviewResponseSchema = z
  .object({
    source: ltmInteropSourceSchema,
    scanned: z.number().int().min(0).max(100),
    draftable: z.number().int().min(0).max(100),
    importedCount: z.number().int().min(0).max(100),
    samples: z.array(ltmInteropPreviewSampleSchema).max(100),
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
    scope: ltmScopeSchema.optional(),
    mode: ltmModeSchema.optional(),
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

export const ltmImportSourceNotesRequestSchema = z
  .object({
    source: ltmInteropSourceSchema,
    sourceIds: z
      .array(z.string().min(1).max(120))
      .min(1)
      .max(100)
      .refine((sourceIds) => new Set(sourceIds).size === sourceIds.length, "Source ids must be unique."),
    limit: z.number().int().min(1).max(100).default(100),
    scope: ltmScopeSchema.optional(),
    connectionId: z.string().min(1).max(120).optional(),
    model: z.string().min(1).max(240).optional(),
    instruction: z.string().max(2_000).optional(),
    chatId: z.string().min(1).max(120).optional(),
    applyLowRisk: z.boolean().optional(),
    extract: z.boolean().default(true),
    importConcurrency: z.number().int().min(1).max(10).optional(),
    mode: ltmModeSchema.optional(),
  })
  .strict();

const ltmImportedSourceResultBaseSchema = z.object({
  sourceId: z.string().min(1).max(120),
  title: z.string().min(1).max(240),
  note: ltmNoteSchema,
  created: z.boolean(),
  sourceWriteStatus: z.enum(["created", "refreshed"]),
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
        extractionStatus: z.literal("failed"),
        retryable: z.literal(true),
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
    retryable: z.literal(true),
    error: z
      .object({
        code: z.literal("source_write_failed"),
        message: z.string().min(1).max(2_000),
      })
      .strict(),
  })
  .strict();

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
    const expectedBatchStatus =
      incomplete === 0
        ? "success"
        : response.counts.succeeded > 0
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

export const ltmEvidenceUnitExtractionResponseSchema = z
  .object({
    summary: z.string().max(2_000).default(""),
    units: z.array(ltmEvidenceUnitSchema).max(LTM_EXTRACTION_MAX_CANDIDATES).default([]),
  })
  .strict();

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

export const ltmLastInjectionResponseSchema = z.object({
  memoryCount: z.number(),
  tokenCount: z.number(),
  memories: z.array(ltmLastInjectionMemorySchema),
  state: z.enum(["injected", "no_matches", "not_recorded"]).default("not_recorded"),
  dispatchedAt: ltmIsoTimestampSchema.nullable().default(null),
});

export const ltmPendingDraftsCountResponseSchema = z.object({
  count: z.number(),
});

export type LtmNoteType = z.infer<typeof ltmNoteTypeSchema>;
export type LtmStatus = z.infer<typeof ltmStatusSchema>;
export type LtmEvidenceUnitStatus = z.infer<typeof ltmEvidenceUnitStatusSchema>;
export type LtmEvidenceUnitBucket = z.infer<typeof ltmEvidenceUnitBucketSchema>;
export type LtmImportance = z.infer<typeof ltmImportanceSchema>;
export type LtmRelationshipDimensions = z.infer<typeof ltmRelationshipDimensionsSchema>;
export type LtmRelationshipDimensionChanges = z.infer<typeof ltmRelationshipDimensionChangesSchema>;
export type LtmExtractionReasoningEffort = z.infer<typeof ltmExtractionReasoningEffortSchema>;
export type LtmExtractionVerbosity = z.infer<typeof ltmExtractionVerbositySchema>;
export type LtmGlobalSettings = z.infer<typeof ltmGlobalSettingsSchema>;
export type LtmResolvedGlobalSettings = z.infer<typeof ltmResolvedGlobalSettingsSchema>;
export type LtmExtractionSettings = z.infer<typeof ltmExtractionSettingsSchema>;
export type LtmExtractionSettingsPatch = z.infer<typeof ltmExtractionSettingsPatchSchema>;
export type LtmResolvedExtractionSettings = z.infer<typeof ltmResolvedExtractionSettingsSchema>;
export type LtmMode = z.infer<typeof ltmModeSchema>;
export type LtmScope = z.infer<typeof ltmScopeSchema>;
export type LtmExtractionFingerprint = z.infer<typeof ltmExtractionFingerprintSchema>;
export type LtmSubjectReference = z.infer<typeof ltmSubjectReferenceSchema>;
export type LtmSubject = z.infer<typeof ltmSubjectSchema>;
export type LtmNoteTransferMode = z.infer<typeof ltmNoteTransferModeSchema>;
export type LtmNoteTransferConflict = z.infer<typeof ltmNoteTransferConflictSchema>;
export type LtmNoteTransferPreviewItem = z.infer<typeof ltmNoteTransferPreviewItemSchema>;
export type LtmNoteTransferPreviewRequest = z.infer<typeof ltmNoteTransferPreviewRequestSchema>;
export type LtmNoteTransferPreviewResponse = z.infer<typeof ltmNoteTransferPreviewResponseSchema>;
export type LtmNoteTransferApplyRequest = z.infer<typeof ltmNoteTransferApplyRequestSchema>;
export type LtmSourceDerivedMemory = z.infer<typeof ltmSourceDerivedMemorySchema>;
export type LtmSourceDerivedMemoriesResponse = z.infer<typeof ltmSourceDerivedMemoriesResponseSchema>;
export type LtmLink = z.infer<typeof ltmLinkSchema>;
export type LtmSectionContribution = z.infer<typeof ltmSectionContributionSchema>;
export type LtmSection = z.infer<typeof ltmSectionSchema>;
export type LtmConflict = z.infer<typeof ltmConflictSchema>;
export type LtmNote = z.infer<typeof ltmNoteSchema>;
export type LtmBulkNoteArchiveAction = z.infer<typeof ltmBulkNoteArchiveActionSchema>;
export type LtmBulkNoteRequest = z.infer<typeof ltmBulkNoteRequestSchema>;
export type LtmBulkNoteResultStatus = z.infer<typeof ltmBulkNoteResultStatusSchema>;
export type LtmBulkNoteResult = z.infer<typeof ltmBulkNoteResultSchema>;
export type LtmSourceProvenance = z.infer<typeof ltmSourceProvenanceSchema>;
export type LtmEvent = z.infer<typeof ltmEventSchema>;
export type LtmDebugStatus = z.infer<typeof ltmDebugStatusSchema>;
export type LtmDebugPhase = z.infer<typeof ltmDebugPhaseSchema>;
export type LtmDebugError = z.infer<typeof ltmDebugErrorSchema>;
export type LtmDebugEvent = z.infer<typeof ltmDebugEventSchema>;
export type LtmRetentionConfig = z.infer<typeof ltmRetentionConfigSchema>;
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
export type LtmIdentityMatchBasis = z.infer<typeof ltmIdentityMatchBasisSchema>;
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
export type LtmTransferRebuildSummary = z.infer<typeof ltmTransferRebuildSummarySchema>;
export type LtmNoteTransferApplyResponse = z.infer<typeof ltmNoteTransferApplyResponseSchema>;
export type LtmRenameNoteSectionRequest = z.infer<typeof ltmRenameNoteSectionRequestSchema>;
export type LtmRenameNoteSectionPreviewResponse = z.infer<typeof ltmRenameNoteSectionPreviewResponseSchema>;
export type LtmRenameNoteSectionResponse = z.infer<typeof ltmRenameNoteSectionResponseSchema>;
export type LtmDeleteNoteSectionResponse = z.infer<typeof ltmDeleteNoteSectionResponseSchema>;
export type LtmDraftStatus = z.infer<typeof ltmDraftStatusSchema>;
export type LtmDraftApplyState = z.infer<typeof ltmDraftApplyStateSchema>;
export type LtmDraftIndexRebuildStatus = z.infer<typeof ltmDraftIndexRebuildStatusSchema>;
export type LtmDraftRisk = z.infer<typeof ltmDraftRiskSchema>;
export type LtmClaimKind = z.infer<typeof ltmClaimKindSchema>;
export type LtmDraftSource = z.infer<typeof ltmDraftSourceSchema>;
export type LtmDraftNoteInput = z.infer<typeof ltmDraftNoteInputSchema>;
export type LtmDraftMutation = z.infer<typeof ltmDraftMutationSchema>;
export type LtmExtractionDraft = z.infer<typeof ltmExtractionDraftSchema>;
export type LtmExtractionDropReason = z.infer<typeof ltmExtractionDropReasonSchema>;
export type LtmExtractionRecoveryHint = z.infer<typeof ltmExtractionRecoveryHintSchema>;
export type LtmExtractionDroppedCandidate = z.infer<typeof ltmExtractionDroppedCandidateSchema>;
export type LtmRejectedSuggestion = z.infer<typeof ltmRejectedSuggestionSchema>;
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
export type LtmRejectedSuggestionsResponse = z.infer<typeof ltmRejectedSuggestionsResponseSchema>;
export type LtmExtractSourceNoteRequest = z.infer<typeof ltmExtractSourceNoteRequestSchema>;
export type LtmExtractSourceNoteResponse = z.infer<typeof ltmExtractSourceNoteResponseSchema>;
export type LtmInteropSource = z.infer<typeof ltmInteropSourceSchema>;
export type LtmInteropPreviewRequest = z.infer<typeof ltmInteropPreviewRequestSchema>;
export type LtmInteropPreviewSample = z.infer<typeof ltmInteropPreviewSampleSchema>;
export type LtmInteropPreviewFreshness = z.infer<typeof ltmInteropPreviewFreshnessSchema>;
export type LtmInteropPreviewResponse = z.infer<typeof ltmInteropPreviewResponseSchema>;
export type LtmLorebookPreviewRequest = z.infer<typeof ltmLorebookPreviewRequestSchema>;
export type LtmLorebookPreviewEntry = z.infer<typeof ltmLorebookPreviewEntrySchema>;
export type LtmLorebookPreviewBook = z.infer<typeof ltmLorebookPreviewBookSchema>;
export type LtmLorebookPreviewResponse = z.infer<typeof ltmLorebookPreviewResponseSchema>;
export type LtmImportSourceNotesRequest = z.infer<typeof ltmImportSourceNotesRequestSchema>;
export type LtmImportedSourceResult = z.infer<typeof ltmImportedSourceResultSchema>;
export type LtmImportSourceWriteFailure = z.infer<typeof ltmImportSourceWriteFailureSchema>;
export type LtmImportSourceNotesBatchStatus = z.infer<typeof ltmImportSourceNotesBatchStatusSchema>;
export type LtmImportSourceNotesResponse = z.infer<typeof ltmImportSourceNotesResponseSchema>;
export type LtmEvidenceUnit = z.infer<typeof ltmEvidenceUnitSchema>;
export type LtmEvidenceUnitExtractionResponse = z.infer<typeof ltmEvidenceUnitExtractionResponseSchema>;
export type LtmLastInjectionMemory = z.infer<typeof ltmLastInjectionMemorySchema>;
export type LtmLastInjectionResponse = z.infer<typeof ltmLastInjectionResponseSchema>;
export type LtmPendingDraftsCountResponse = z.infer<typeof ltmPendingDraftsCountResponseSchema>;

/**
 * Settings stored in agent_configs.settings when type === "long-term-memory".
 * Recall defaults live in the file-backed global settings (config/settings.json)
 * and per-chat metadata; they are never read from agent settings at runtime.
 * Legacy agent records may still contain recall keys — the preprocessor strips
 * them so existing rows load without a destructive migration.
 */
const LTM_AGENT_LEGACY_RECALL_KEYS =
  /^(longTermMemoryBudgetTokens|longTermMemoryMaxChunks|longTermMemoryScoreThreshold|longTermMemoryRecallContextMessages|longTermMemoryRecallStyle|longTermMemorySemanticWeight|longTermMemoryLexicalWeight|longTermMemoryGraphWeight|longTermMemoryKeywordWeight|longTermMemoryIncludeResolved|longTermMemoryRecallPreamble|longTermMemoryDebug)$/;

const ltmAgentSettingsShape = z
  .object({
    author: z.string().optional(),
    connectionId: z.string().nullable().optional(),
    model: z.string().max(240).optional(),
    instruction: z.string().max(2_000).optional(),
    importConcurrency: z.number().int().min(1).max(10).optional(),
    importSource: ltmInteropSourceSchema.optional(),
    autoApplyLowRisk: z.boolean().optional(),
  })
  .strict();

export const ltmAgentSettingsSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const input = { ...(value as Record<string, unknown>) };
  delete input.extractionMode;
  delete input.importLimit;
  for (const key of Object.keys(input)) {
    if (LTM_AGENT_LEGACY_RECALL_KEYS.test(key)) delete input[key];
  }
  return input;
}, ltmAgentSettingsShape);

export type LtmAgentSettings = z.infer<typeof ltmAgentSettingsSchema>;

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
