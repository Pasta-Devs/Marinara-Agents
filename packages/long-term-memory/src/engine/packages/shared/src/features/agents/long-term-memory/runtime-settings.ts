import {
  DEFAULT_LTM_RECALL_STYLE,
  LTM_RECALL_STYLE_WEIGHTS,
  parseLongTermMemoryRecallStyle,
  type LongTermMemoryRecallStyle,
  type LtmRecallWeights,
} from "./constants.js";
import type { LtmResolvedGlobalSettings } from "./schema.js";

export interface ResolvedLongTermMemoryRecallSettings {
  budgetTokens?: number;
  scoreThreshold?: number;
  recallStyle: LongTermMemoryRecallStyle;
  weights: LtmRecallWeights;
  debugEnabled: boolean;
  contextMessages: number;
  includeResolved: boolean;
  recallPreamble: string;
}

function parseSparseNumber(value: unknown, min: number, max: number, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (integer && !Number.isInteger(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

function parseBudgetTokens(value: unknown) {
  return parseSparseNumber(value, 128, 16_384, true);
}

function parseMaxChunks(value: unknown) {
  return parseSparseNumber(value, 1, 100, true);
}

/**
 * Recall is limited by its token budget alone. A memory averages about 75 tokens in the prompt (measured on a
 * 700-memory vault; sources are far larger), so the hints and the legacy conversion below count 80 with its title.
 */
export const LTM_RECALL_MEMORY_TOKENS = 80;
/** The recall prompt's own text (framing, preamble) before any memory. */
export const LTM_RECALL_OVERHEAD_TOKENS = 64;

/** About how many memories a recall budget holds; `memoryTokens` is the vault's measured average when known. */
export function ltmRecallBudgetMemories(budgetTokens: number, memoryTokens?: number | null) {
  return Math.max(
    0,
    Math.floor((budgetTokens - LTM_RECALL_OVERHEAD_TOKENS) / (memoryTokens || LTM_RECALL_MEMORY_TOKENS)),
  );
}

/**
 * Recall used to stop at a memory count as well (12 by default), which the budget rarely reached. A stored count
 * (settings file or chat) from those versions caps the budget at what that many memories cost, so an update recalls
 * as much as before. Saving a budget removes the count.
 */
export function ltmRecallBudgetWithLegacyCount(budgetTokens: number, legacyCount: unknown) {
  const count = parseMaxChunks(legacyCount);
  if (count === undefined) return budgetTokens;
  const forCount = Math.ceil((count * LTM_RECALL_MEMORY_TOKENS + LTM_RECALL_OVERHEAD_TOKENS) / 128) * 128;
  return Math.min(budgetTokens, forCount);
}

/** Issue #1264: the rescaled weights cap realistic matches near 0.5, so a saved
 * threshold above 0.4 would otherwise inject almost nothing. Read it as 0.4. */
export const LTM_RECALL_SCORE_THRESHOLD_CEILING = 0.4;

function parseScoreThreshold(value: unknown) {
  const parsed = parseSparseNumber(value, 0, 1);
  return parsed === undefined ? undefined : Math.min(parsed, LTM_RECALL_SCORE_THRESHOLD_CEILING);
}

function parseContextMessages(value: unknown) {
  return parseSparseNumber(value, 1, 20, true);
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readRecallStyle(value: unknown): LongTermMemoryRecallStyle | undefined {
  return value === "balanced" || value === "exact" || value === "broad" || value === "custom" || value === "story"
    ? value
    : undefined;
}

function readRecallPreamble(value: unknown) {
  if (typeof value !== "string") return undefined;
  const preamble = value.trim();
  return preamble.length > 0 && preamble.length <= 500 ? preamble : undefined;
}

function readWeight(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

function resolveWeights(metadata: Record<string, unknown>, fallback: LtmRecallWeights): LtmRecallWeights {
  return {
    semanticWeight: readWeight(metadata.longTermMemorySemanticWeight, fallback.semanticWeight),
    lexicalWeight: readWeight(metadata.longTermMemoryLexicalWeight, fallback.lexicalWeight),
    graphWeight: readWeight(metadata.longTermMemoryGraphWeight, fallback.graphWeight),
    keywordWeight: readWeight(metadata.longTermMemoryKeywordWeight, fallback.keywordWeight),
  };
}

function resolveGlobalWeights(
  globalSettings: LtmResolvedGlobalSettings | undefined,
  fallback: LtmRecallWeights,
): LtmRecallWeights {
  if (!globalSettings) return fallback;
  return {
    semanticWeight: readWeight(globalSettings.longTermMemorySemanticWeight, fallback.semanticWeight),
    lexicalWeight: readWeight(globalSettings.longTermMemoryLexicalWeight, fallback.lexicalWeight),
    graphWeight: readWeight(globalSettings.longTermMemoryGraphWeight, fallback.graphWeight),
    keywordWeight: readWeight(globalSettings.longTermMemoryKeywordWeight, fallback.keywordWeight),
  };
}

/**
 * Resolves the effective recall behavior for one chat. This is shared by the
 * generation path and client-side recall inspection so both use the same
 * per-chat override and style-weight rules.
 */
export function resolveLongTermMemoryRecallSettings(input: {
  chatMode: string;
  chatMetadata: Record<string, unknown>;
  globalSettings?: LtmResolvedGlobalSettings;
  requestDebug?: boolean;
}): ResolvedLongTermMemoryRecallSettings {
  const { chatMetadata, globalSettings } = input;
  const chatRecallStyle = readRecallStyle(chatMetadata.longTermMemoryRecallStyle);
  // Issue #1258: a per-mode style map never applied because resolved global
  // settings always carry a style; the balanced default is now the single fallback.
  const globalRecallStyle = globalSettings
    ? parseLongTermMemoryRecallStyle(globalSettings.longTermMemoryRecallStyle)
    : DEFAULT_LTM_RECALL_STYLE;
  const recallStyle = chatRecallStyle ?? globalRecallStyle;
  const styleWeights =
    recallStyle === "custom" ? LTM_RECALL_STYLE_WEIGHTS.balanced : LTM_RECALL_STYLE_WEIGHTS[recallStyle];
  const globalWeights =
    globalRecallStyle === "custom"
      ? resolveGlobalWeights(globalSettings, LTM_RECALL_STYLE_WEIGHTS.balanced)
      : LTM_RECALL_STYLE_WEIGHTS[globalRecallStyle];
  const budgetTokens =
    parseBudgetTokens(chatMetadata.longTermMemoryBudgetTokens) ??
    parseBudgetTokens(globalSettings?.longTermMemoryBudgetTokens);
  return {
    budgetTokens:
      budgetTokens === undefined
        ? undefined
        : ltmRecallBudgetWithLegacyCount(budgetTokens, chatMetadata.longTermMemoryMaxChunks),
    scoreThreshold:
      parseScoreThreshold(chatMetadata.longTermMemoryScoreThreshold) ??
      parseScoreThreshold(globalSettings?.longTermMemoryScoreThreshold),
    recallStyle,
    weights: resolveWeights(chatMetadata, recallStyle === "custom" ? globalWeights : styleWeights),
    debugEnabled:
      (readBoolean(chatMetadata.longTermMemoryDebug) ?? globalSettings?.longTermMemoryDebug ?? false) ||
      input.requestDebug === true,
    contextMessages:
      parseContextMessages(chatMetadata.longTermMemoryRecallContextMessages) ??
      parseContextMessages(globalSettings?.longTermMemoryRecallContextMessages) ??
      4,
    includeResolved:
      readBoolean(chatMetadata.longTermMemoryIncludeResolved) ?? globalSettings?.longTermMemoryIncludeResolved ?? false,
    recallPreamble:
      readRecallPreamble(chatMetadata.longTermMemoryRecallPreamble) ??
      globalSettings?.longTermMemoryRecallPreamble ??
      "",
  };
}

/** "Memories from chats": manual = I add them myself, review = collect them for review, save = save them for me. */
export const LTM_CHAT_MEMORIES_MODES = ["manual", "review", "save"] as const;
export type LtmChatMemoriesMode = (typeof LTM_CHAT_MEMORIES_MODES)[number];

export function readLtmChatMemoriesMode(value: unknown): LtmChatMemoriesMode | undefined {
  return value === "manual" || value === "review" || value === "save" ? value : undefined;
}

/** The global choice is stored as the two extraction booleans; import off with accept on reads as manual. */
export function ltmChatMemoriesModeOf(config: {
  autoImportChatSources?: boolean;
  autoAcceptSafeChanges?: boolean;
}): LtmChatMemoriesMode {
  return config.autoImportChatSources !== true ? "manual" : config.autoAcceptSafeChanges === true ? "save" : "review";
}

/**
 * One chat's background import and safe-change acceptance: its `longTermMemoryChatMemories` override, else the global
 * extraction booleans as stored (so a manual import keeps today's global auto-accept until the choice is saved).
 */
export function resolveLtmChatMemories(
  chatMetadata: Record<string, unknown>,
  config: { autoImportChatSources: boolean; autoAcceptSafeChanges: boolean },
) {
  const override = readLtmChatMemoriesMode(chatMetadata.longTermMemoryChatMemories);
  if (!override) return { autoImport: config.autoImportChatSources, autoAccept: config.autoAcceptSafeChanges };
  return { autoImport: override !== "manual", autoAccept: override === "save" };
}
