// ──────────────────────────────────────────────
// Agents: bounded worker-pool helpers
// ──────────────────────────────────────────────

export async function settleAgentJobsWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];

  const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 1;
  const concurrent = Math.max(1, Math.min(items.length, normalizedLimit));
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: concurrent }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        try {
          results[index] = { status: "fulfilled", value: await worker(items[index]!, index) };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    }),
  );

  return results;
}
