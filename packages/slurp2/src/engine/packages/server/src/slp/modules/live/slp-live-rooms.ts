import type { SlurpLiveEvent } from "./slp-live.js";

/** Who sits in a live chat and how they type, shaped like Echo Chamber's prompt templates. */
export const SLURP_LIVE_ROOMS = {
  default: "a mixed room: regulars, newcomers, a few thirsty ones and one joker",
  simps: "simps: devoted and lovestruck, over-the-top compliments, calling her queen, jealous of each other",
  hype: "a hype squad: CAPS, emojis and chants, cheering every move and pushing the tip goal",
  lurkers: "lurkers: quiet and shy, short lowercase lines, someone finally saying hi",
  whales: "whales: rich, confident regulars who talk about tips and requests, bossy and generous",
} as const;
export type SlurpLiveRoomType = keyof typeof SLURP_LIVE_ROOMS;
export const SLURP_LIVE_ROOM_TYPES = Object.keys(SLURP_LIVE_ROOMS) as SlurpLiveRoomType[];

export function slurpLiveRoomType(value: unknown): SlurpLiveRoomType {
  return typeof value === "string" && Object.hasOwn(SLURP_LIVE_ROOMS, value) ? (value as SlurpLiveRoomType) : "default";
}

/** Crowd lane lines carry this request id prefix, so the queue end is found without a new field. */
export const slurpLiveCrowdKey = (showId: string) => `live:${showId}:crowd:`;

/** The end of the queued crowd chat, or now when the queue is empty. */
export function slurpLiveCrowdCursor(events: readonly SlurpLiveEvent[], showId: string, elapsed: number): number {
  const key = slurpLiveCrowdKey(showId);
  return Math.max(elapsed, ...events.filter((event) => event.requestId?.startsWith(key)).map((event) => event.at));
}

/** A new crowd batch is due when less than 10 seconds of queued chat is left. */
export function slurpLiveCrowdDue(events: readonly SlurpLiveEvent[], showId: string, elapsed: number): boolean {
  return slurpLiveCrowdCursor(events, showId, elapsed) < elapsed + 10_000;
}

/** Places up to 12 crowd lines 3 to 9 seconds apart after the cursor, like Echo Chamber's reveal queue. */
export function slurpLiveEnqueueCrowd(
  showId: string,
  lines: readonly { name?: string; text: string }[],
  cursor: number,
  random: () => number = Math.random,
): SlurpLiveEvent[] {
  let at = cursor;
  return lines
    .filter((line) => line.text.trim())
    .slice(0, 12)
    .map((line, index) => {
      at += 3_000 + Math.round(random() * 6_000);
      return {
        at,
        kind: "chat" as const,
        name: line.name?.trim().slice(0, 40) || "Fan",
        text: line.text.trim().slice(0, 300),
        requestId: `${slurpLiveCrowdKey(showId)}${at}:${index}`,
      };
    });
}
