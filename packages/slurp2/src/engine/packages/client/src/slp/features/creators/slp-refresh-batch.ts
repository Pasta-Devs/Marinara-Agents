import type { SlpCreatorRefreshNowOutcome } from "../../../../../shared/src/slp/slp-social.types.js";

/** Keep the existing three-creator limit while reporting each completed request. */
export async function refreshSlurpCreatorBatch(
  accountIds: string[],
  refresh: (accountId: string) => Promise<{ outcomes: SlpCreatorRefreshNowOutcome[] }>,
  onRemaining?: (remaining: number) => void,
): Promise<{ outcomes: SlpCreatorRefreshNowOutcome[] }> {
  const ids = [...new Set(accountIds)];
  const outcomes: SlpCreatorRefreshNowOutcome[][] = new Array(ids.length);
  let next = 0;
  let remaining = ids.length;
  // ponytail: undispatched creators need the page to stay open; durable resume
  // would require a server-owned batch and status endpoint.
  onRemaining?.(remaining);
  await Promise.all(
    Array.from({ length: Math.min(3, ids.length) }, async () => {
      while (next < ids.length) {
        const index = next++;
        const accountId = ids[index]!;
        try {
          outcomes[index] = (await refresh(accountId)).outcomes;
        } catch {
          outcomes[index] = [{ accountId, status: "error" }];
        } finally {
          onRemaining?.(--remaining);
        }
      }
    }),
  );
  return { outcomes: outcomes.flat() };
}

export type SlpCreatorRefreshOutcomeClass = "made" | "skipped" | "failed";

/** The one classifier both the result counts and the result toast's names read from. */
export function classifySlurpRefreshOutcome(
  status: SlpCreatorRefreshNowOutcome["status"],
): SlpCreatorRefreshOutcomeClass {
  if (status === "generated") return "made";
  if (status === "skipped" || status === "disabled" || status === "busy") return "skipped";
  return "failed";
}

/** What "Generate posts" did, for the toast after it (R1-068: failures and skips were never told). */
export function countSlurpRefreshOutcomes(outcomes: readonly SlpCreatorRefreshNowOutcome[]) {
  let made = 0;
  let skipped = 0;
  let failed = 0;
  for (const outcome of outcomes) {
    const outcomeClass = classifySlurpRefreshOutcome(outcome.status);
    if (outcomeClass === "made") made += 1;
    else if (outcomeClass === "skipped") skipped += 1;
    else failed += 1;
  }
  return { made, skipped, failed };
}

/** At most `limit` names for one outcome class, so the result toast never names the whole roster. */
export function slurpRefreshOutcomeNames(
  outcomes: readonly SlpCreatorRefreshNowOutcome[],
  outcomeClass: SlpCreatorRefreshOutcomeClass,
  nameFor: (accountId: string) => string,
  limit = 5,
): { names: string[]; extra: number } {
  const all = outcomes
    .filter((outcome) => classifySlurpRefreshOutcome(outcome.status) === outcomeClass)
    .map((outcome) => nameFor(outcome.accountId));
  return { names: all.slice(0, limit), extra: Math.max(0, all.length - limit) };
}
