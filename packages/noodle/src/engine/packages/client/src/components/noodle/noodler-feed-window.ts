export const NOODLER_FEED_PAGE_SIZE = 20;
export const NOODLER_CREATOR_PAGE_SIZE = 10;

/** Advance only one bounded page while allowing every item to become reachable. */
export function nextNoodlerFeedLimit(
  currentLimit: number,
  total: number,
  pageSize = NOODLER_FEED_PAGE_SIZE,
): number {
  const normalizedCurrent = Math.max(0, Math.floor(currentLimit));
  const normalizedTotal = Math.max(0, Math.floor(total));
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  return Math.min(normalizedTotal, normalizedCurrent + normalizedPageSize);
}
