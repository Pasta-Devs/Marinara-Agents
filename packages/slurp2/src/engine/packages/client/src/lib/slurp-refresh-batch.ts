import type { NoodlerRefreshNowOutcome } from "@marinara-engine/shared";

/** Keep the existing three-creator limit while reporting each completed request. */
export async function refreshSlurpCreatorBatch(
  accountIds: string[],
  refresh: (accountId: string) => Promise<{ outcomes: NoodlerRefreshNowOutcome[] }>,
  onRemaining?: (remaining: number) => void,
): Promise<{ outcomes: NoodlerRefreshNowOutcome[] }> {
  const ids = [...new Set(accountIds)];
  const outcomes: NoodlerRefreshNowOutcome[][] = new Array(ids.length);
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
