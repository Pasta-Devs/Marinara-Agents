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
  maxChunks?: number;
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
  return {
    budgetTokens:
      parseBudgetTokens(chatMetadata.longTermMemoryBudgetTokens) ??
      parseBudgetTokens(globalSettings?.longTermMemoryBudgetTokens),
    maxChunks:
      parseMaxChunks(chatMetadata.longTermMemoryMaxChunks) ?? parseMaxChunks(globalSettings?.longTermMemoryMaxChunks),
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
