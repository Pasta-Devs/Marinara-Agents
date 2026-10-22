import { z } from "zod";
import {
  DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE,
  DEFAULT_LTM_RECALL_PREAMBLE,
  DEFAULT_LTM_RECALL_STYLE,
  DEFAULT_LTM_RECALL_STYLE_WEIGHTS,
} from "../constants.js";
import {
  LTM_EXTRACTION_MODES,
  ltmExtractionReasoningEffortSchema,
  ltmExtractionVerbositySchema,
  ltmInteropSourceSchema,
  ltmModeSchema,
  ltmNoteTypeSchema,
  ltmSectionKeySchema,
} from "./primitives.js";

const ltmGlobalSettingsShape = z
  .object({
    version: z.literal(1).default(1),
    enableLongTermMemory: z.boolean().optional(),
    longTermMemoryBudgetTokens: z.number().int().min(128).max(16_384).optional(),
    longTermMemoryMaxChunks: z.number().int().min(1).max(100).optional(),
    longTermMemoryScoreThreshold: z.number().finite().min(0).max(1).optional(),
    longTermMemoryRecallContextMessages: z.number().int().min(1).max(20).optional(),
    longTermMemoryRecallStyle: z.enum(["balanced", "exact", "broad", "story", "custom"]).optional(),
    longTermMemorySemanticWeight: z.number().finite().min(0).max(1).optional(),
    longTermMemoryLexicalWeight: z.number().finite().min(0).max(1).optional(),
    longTermMemoryGraphWeight: z.number().finite().min(0).max(1).optional(),
    longTermMemoryKeywordWeight: z.number().finite().min(0).max(1).optional(),
    longTermMemoryStopWords: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
    longTermMemoryStopWordsFilterGenerated: z.boolean().optional(),
    longTermMemoryIncludeResolved: z.boolean().optional(),
    longTermMemoryRecallPreamble: z.string().max(500).optional(),
    longTermMemoryDebug: z.boolean().optional(),
    longTermMemoryShareWithPackages: z.boolean().optional(),
    sourcesAvailabilityModes: z.array(ltmModeSchema).min(1).max(3).optional(),
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
  for (const key of [
    "longTermMemorySemanticWeight",
    "longTermMemoryLexicalWeight",
    "longTermMemoryGraphWeight",
    "longTermMemoryKeywordWeight",
  ]) {
    if (normalized[key] == null) delete normalized[key];
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
    if (normalized.longTermMemoryRecallStyle === undefined) delete normalized.longTermMemoryRecallStyle;
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
    longTermMemoryStopWords: z.array(z.string().trim().min(1).max(80)).max(200),
    longTermMemoryStopWordsFilterGenerated: z.boolean(),
    longTermMemoryIncludeResolved: z.boolean(),
    longTermMemoryRecallPreamble: z.string().max(500),
    longTermMemoryDebug: z.boolean(),
    /** Other packages (Slurp, Noodle) may read memories available everywhere through the package services. */
    longTermMemoryShareWithPackages: z.boolean(),
    sourcesAvailabilityModes: z.array(ltmModeSchema).min(1).max(3).optional(),
  })
  .strict();

export const DEFAULT_LTM_GLOBAL_SETTINGS = ltmResolvedGlobalSettingsSchema.parse({
  version: 1,
  enableLongTermMemory: true,
  longTermMemoryBudgetTokens: 4096,
  longTermMemoryMaxChunks: 12,
  longTermMemoryScoreThreshold: 0.35,
  longTermMemoryRecallContextMessages: 4,
  longTermMemoryRecallStyle: DEFAULT_LTM_RECALL_STYLE,
  longTermMemorySemanticWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.semanticWeight,
  longTermMemoryLexicalWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.lexicalWeight,
  longTermMemoryGraphWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.graphWeight,
  longTermMemoryKeywordWeight: DEFAULT_LTM_RECALL_STYLE_WEIGHTS.keywordWeight,
  longTermMemoryStopWords: [],
  longTermMemoryStopWordsFilterGenerated: true,
  longTermMemoryIncludeResolved: false,
  longTermMemoryRecallPreamble: DEFAULT_LTM_RECALL_PREAMBLE,
  longTermMemoryDebug: false,
  longTermMemoryShareWithPackages: true,
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
  // The broad existing-note prompt budget no longer exists (issue #1086); discard
  // stale persisted values instead of rejecting the whole strict settings object.
  delete normalized.maxExistingNoteTokens;
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
  existingNoteMaxChunks: z.number().int().min(1).max(100).optional(),
  existingNoteMaxTokens: z.number().int().min(128).max(32_768).optional(),
  promptTemplates: ltmPromptTemplatesSchema,
  activePromptTemplateIdsByMode: ltmActivePromptTemplateIdsByModeSchema.optional(),
  aiKeywordExtraction: z.boolean().optional(),
  finishCutOffAnswers: z.boolean().optional(),
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
    existingNoteMaxChunks: z.number().int().min(1).max(100),
    existingNoteMaxTokens: z.number().int().min(128).max(32_768),
    promptTemplates: z.array(ltmExtractionPromptTemplateSchema).max(50),
    activePromptTemplateId: z.string().min(1).max(64).nullable(),
    activePromptTemplateIdsByMode: ltmActivePromptTemplateIdsByModeSchema,
    aiKeywordExtraction: z.boolean(),
    finishCutOffAnswers: z.boolean(),
    useExtractionAgentOnGameMode: z.boolean(),
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

export const ltmPoliciesConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    policies: z.array(ltmPolicySchema).default([]),
  })
  .strict();

// Legacy backup input: nothing reads it. Older backups carry it, and restore validates and ignores it. Keep every
// field, because the shape is strict and removing one fails those backups.
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

export const ltmRetrievalConfigSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { enabled: _enabled, ...rest } = value as Record<string, unknown>;
  return rest;
}, ltmRetrievalConfigShape);

export const ltmRetentionConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    auditWindowDays: z.number().int().min(1).max(3_650).default(30),
    // No cleanup uses it since per-memory usage counters were dropped, so it isn't checked against
    // auditWindowDays. Kept so older settings files and backups still parse.
    usageRetentionDays: z.number().int().min(1).max(3_650).default(180),
    receiptRetentionDays: z.number().int().min(1).max(3_650).default(180),
    eventRetentionDays: z.number().int().min(1).max(3_650).default(180),
    incompleteGenerationRetentionDays: z.number().int().min(1).max(3_650).default(30),
    quarantineRetentionDays: z.number().int().min(1).max(3_650).default(90),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of [
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
export type LtmGlobalSettings = z.infer<typeof ltmGlobalSettingsSchema>;
export type LtmResolvedGlobalSettings = z.infer<typeof ltmResolvedGlobalSettingsSchema>;
export type LtmExtractionSettings = z.infer<typeof ltmExtractionSettingsSchema>;
export type LtmExtractionSettingsPatch = z.infer<typeof ltmExtractionSettingsPatchSchema>;
export type LtmResolvedExtractionSettings = z.infer<typeof ltmResolvedExtractionSettingsSchema>;
export type LtmRetentionConfig = z.infer<typeof ltmRetentionConfigSchema>;

/**
 * Settings stored in agent_configs.settings when type === "long-term-memory".
 * Recall defaults live in the file-backed global settings (config/settings.json)
 * and per-chat metadata; they are never read from agent settings at runtime.
 * Legacy agent records may still contain recall keys — the preprocessor strips
 * them so existing rows load without a destructive migration.
 */
const LTM_AGENT_LEGACY_RECALL_KEYS =
  /^(longTermMemoryBudgetTokens|longTermMemoryMaxChunks|longTermMemoryScoreThreshold|longTermMemoryRecallContextMessages|longTermMemoryRecallStyle|longTermMemorySemanticWeight|longTermMemoryLexicalWeight|longTermMemoryGraphWeight|longTermMemoryKeywordWeight|longTermMemoryStopWords|longTermMemoryStopWordsFilterGenerated|longTermMemoryIncludeResolved|longTermMemoryRecallPreamble|longTermMemoryDebug)$/;

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
