import type { SlpLiveEvent } from "../../../../../shared/src/slp/slp-live.js";

/** Events the chat shows; leaves stay out, they would only clutter the room. */
const SHOWN = new Set<SlpLiveEvent["kind"]>(["join", "tip", "order", "goal", "done", "strip", "say", "chat", "you"]);

/** A chat line: the event plus a key that stays the same across polls. */
export type SlpLiveLine = SlpLiveEvent & { key: string };

const eventKey = (event: SlpLiveEvent) =>
  `${event.at}:${event.kind}:${event.by ?? ""}:${event.amount ?? ""}:${event.itemId ?? ""}`;

/**
 * The next chat state (Echo Chamber's queue, LIVE-V3-PLAN.md): the first batch shows its tail at once, later
 * events wait in a queue and come in one by one, so a minute of the room reads as a flowing chat.
 */
export function slpLiveFeedMerge(
  feed: { shown: SlpLiveLine[]; queue: SlpLiveLine[]; seen: Set<string> },
  events: readonly SlpLiveEvent[],
  baseline = 6,
) {
  // Two equal tips from one fan in one minute look alike, so equal events are numbered in log order.
  const counts = new Map<string, number>();
  const lines = events.flatMap((event) => {
    if (!SHOWN.has(event.kind)) return [];
    const base = eventKey(event);
    const index = counts.get(base) ?? 0;
    counts.set(base, index + 1);
    return [{ ...event, key: `${base}#${index}` }];
  });
  const fresh = lines.filter((line) => !feed.seen.has(line.key));
  const seen = new Set(feed.seen);
  for (const line of fresh) seen.add(line.key);
  if (feed.seen.size === 0) return { shown: fresh.slice(-baseline), queue: [], seen };
  return { shown: feed.shown, queue: [...feed.queue, ...fresh], seen };
}

/** How long the next queued line waits: quick when many are waiting, never a dead room. */
export const slpLiveFeedDelay = (queued: number) => Math.max(600, Math.min(3_000, 15_000 / Math.max(1, queued)));
