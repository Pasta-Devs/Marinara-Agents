import type { SlpLiveEvent } from "../../../../../shared/src/slp/slp-live.js";

/** Events the chat shows; leaves stay out, they would only clutter the room. */
const SHOWN = new Set<SlpLiveEvent["kind"]>(["join", "tip", "order", "goal", "done", "strip"]);

export const slpLiveEventKey = (event: SlpLiveEvent) =>
  `${event.at}:${event.kind}:${event.by ?? ""}:${event.amount ?? ""}:${event.itemId ?? ""}`;

/**
 * The next chat state (Echo Chamber's queue, LIVE-V3-PLAN.md): the first batch shows its tail at once, later
 * events wait in a queue and come in one by one, so a minute of the room reads as a flowing chat.
 */
export function slpLiveFeedMerge(
  feed: { shown: SlpLiveEvent[]; queue: SlpLiveEvent[]; seen: Set<string> },
  events: readonly SlpLiveEvent[],
  baseline = 6,
) {
  const fresh = events.filter((event) => SHOWN.has(event.kind) && !feed.seen.has(slpLiveEventKey(event)));
  const seen = new Set(feed.seen);
  for (const event of fresh) seen.add(slpLiveEventKey(event));
  if (feed.seen.size === 0) return { shown: fresh.slice(-baseline), queue: [], seen };
  return { shown: feed.shown, queue: [...feed.queue, ...fresh], seen };
}

/** How long the next queued line waits: quick when many are waiting, never a dead room. */
export const slpLiveFeedDelay = (queued: number) => Math.max(600, Math.min(3_000, 15_000 / Math.max(1, queued)));
