import type { ContextFitResult } from "../llm/base-provider.js";

export interface NoodleTimelinePostTargetRange {
  minimum: number;
  maximum: number;
}

/** A timeline answer with less room than this would stop mid-JSON, so the refresh fails instead. */
export const NOODLE_TIMELINE_MIN_OUTPUT_TOKENS = 1024;
/**
 * The fitter estimates 4 characters per token, but the timeline's IDs, timestamps and digits cost
 * several times that on some tokenizers (Gemma spends a token per digit), and KoboldCpp cuts the start
 * of a prompt that overflows. Part of the estimate is kept back as slack.
 */
const PROMPT_ESTIMATE_SLACK = 0.15;

function normalizedCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function noodleTimelineRefreshMaxTokens(selectedAuthorCount: number) {
  return 4096 + normalizedCount(selectedAuthorCount) * 1024;
}

/**
 * Returns the max_tokens that lets the whole timeline prompt reach the model, or null when less than
 * the minimum answer would fit beside it. `fit` is the context fitter's result for the requested budget.
 *
 * ponytail: the bundled fitter predates Engine #4124. When a prompt with no chat history does not fit
 * beside max_tokens, it deletes the prompt body (accounts, profiles, chats and timeline) and keeps the
 * full max_tokens. This hands answer room back instead, from the fitter's own estimate plus slack.
 * Ceiling: the estimate is still characters / 4. Upgrade path: generate through the Engine's live LLM
 * integration (Capability API 1.31), and count real tokens where the backend can.
 */
export function noodleTimelineMaxTokensForPrompt(
  fit: Pick<ContextFitResult, "maxContext" | "reservedTokens" | "estimatedTokensBefore">,
  requestedMaxTokens: number,
): number | null {
  if (fit.maxContext === undefined) return requestedMaxTokens;
  const room =
    fit.maxContext - (fit.reservedTokens ?? 0) - Math.ceil(fit.estimatedTokensBefore * (1 + PROMPT_ESTIMATE_SLACK));
  const maxTokens = Math.min(requestedMaxTokens, room);
  return maxTokens >= Math.min(requestedMaxTokens, NOODLE_TIMELINE_MIN_OUTPUT_TOKENS) ? maxTokens : null;
}

export function noodleTimelinePostTargetRange(
  selectedAuthorCount: number,
  maximumPostsPerRefresh: number,
): NoodleTimelinePostTargetRange {
  const maximum = Math.min(normalizedCount(selectedAuthorCount), normalizedCount(maximumPostsPerRefresh));
  if (maximum === 0) return { minimum: 0, maximum: 0 };
  return {
    minimum: Math.max(1, Math.min(maximum - 1, Math.ceil((maximum * 2) / 3))),
    maximum,
  };
}

export function noodleTimelinePostTargetInstruction(selectedAuthorCount: number, maximumPostsPerRefresh: number) {
  const target = noodleTimelinePostTargetRange(selectedAuthorCount, maximumPostsPerRefresh);
  const amount =
    target.maximum === 0
      ? "create no new posts"
      : target.minimum === target.maximum
        ? `aim for ${target.maximum} posts across the selected non-persona accounts`
        : `aim for ${target.minimum}-${target.maximum} posts across the selected non-persona accounts, varying naturally within that range`;
  return `Normal target: ${amount}. Generate only the interactions that fit current activity. The configured post quota is a hard safety ceiling, not a slot count to fill.`;
}
