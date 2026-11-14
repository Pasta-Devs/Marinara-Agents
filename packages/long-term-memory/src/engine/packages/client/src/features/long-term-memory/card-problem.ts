import type {
  LtmDebugEvent,
  LtmLastInjectionAttempt,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";

/** The limit a recall cut memories to: the token limit (`budget`) or the memory count (`lower_rank`). */
export type LeftOutLimit = "budget" | "lower_rank";

/** The one problem the Long-Term Memory card names, with what its button needs. */
export type CardProblem =
  | { kind: "recall"; attempt: LtmLastInjectionAttempt }
  | { kind: "saveFailed"; cause: string | null }
  | { kind: "setup" }
  | { kind: "leftOut"; count: number; limit: LeftOutLimit };

/**
 * The single most serious problem, or null. Order: the reply didn't use memory, a save failed, no extraction model,
 * memories left out by a limit. `recall` is the last attempt only when it outranks the receipt (`attemptOverrides`).
 */
export function pickCardProblem(input: {
  recall: LtmLastInjectionAttempt | null;
  saveFailed: { cause: string | null } | null;
  needsSetup: boolean;
  leftOut: { count: number; limit: LeftOutLimit } | null;
}): CardProblem | null {
  if (input.recall) return { kind: "recall", attempt: input.recall };
  if (input.saveFailed) return { kind: "saveFailed", cause: input.saveFailed.cause };
  if (input.needsSetup) return { kind: "setup" };
  if (input.leftOut && input.leftOut.count > 0) return { kind: "leftOut", ...input.leftOut };
  return null;
}

/** The locale key for why the last recall's memories weren't used. */
export function recallProblemKey(attempt: LtmLastInjectionAttempt) {
  if (attempt.outcome === "cancelled") return "ui.longTermMemory.lastinjectionsummary.recallCancelled";
  if (attempt.outcome === "failed") return "ui.longTermMemory.lastinjectionsummary.recallFailed";
  if (attempt.outcome === "skipped") {
    if (attempt.reason === "chat_not_found")
      return "ui.longTermMemory.lastinjectionsummary.recallSkippedChatUnavailable";
    if (attempt.reason === "empty_query") return "ui.longTermMemory.lastinjectionsummary.recallSkippedEmptyQuery";
    if (attempt.reason === "prompt_budget") return "ui.longTermMemory.lastinjectionsummary.recallSkippedPromptBudget";
    return "ui.longTermMemory.lastinjectionsummary.recallSkipped";
  }
  return "ui.longTermMemory.lastinjectionsummary.recallNotConfirmed";
}

/** The recall's explanation event, when explanations were on for it. */
export const recallExplanationOf = (events: LtmDebugEvent[] | undefined) =>
  events?.find((event) => event.action === "recall_explanation");

const rowsOf = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];

/**
 * What a recall's explanation says a limit cut: the recorded rows (the closest misses) rejected for the token limit or
 * the memory count, each memory once and none that was added. The limit named is the one that cut more; a tie names the
 * token limit. Null when nothing was cut or the event is missing (explanations off).
 */
export function leftOutFromExplanation(event: Pick<LtmDebugEvent, "details"> | undefined) {
  if (!event) return null;
  const added = new Set(rowsOf(event.details?.selected).map((row) => row.noteId));
  const cut: Record<LeftOutLimit, Set<unknown>> = { budget: new Set(), lower_rank: new Set() };
  rowsOf(event.details?.rejected).forEach((row, index) => {
    if (added.has(row.noteId)) return;
    if (row.rejectionReason !== "budget" && row.rejectionReason !== "lower_rank") return;
    cut[row.rejectionReason].add(typeof row.noteId === "string" ? row.noteId : index);
  });
  const count = new Set([...cut.budget, ...cut.lower_rank]).size;
  if (!count) return null;
  return { count, limit: (cut.lower_rank.size > cut.budget.size ? "lower_rank" : "budget") as LeftOutLimit };
}
