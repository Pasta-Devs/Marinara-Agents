/** October 2026 Discord bugs (packages/slurp2/docs/FEEDBACK-2026-10.md, B1-B3). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SLURP_REPLY_BUBBLE_STALE_MS,
  slurpReplyBubbleStale,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.ts";

const server = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/slp");
const src = (path: string) => readFileSync(join(server, path), "utf8");

// ── B2: a DM stuck on "already writing back" ──
// A queued bubble long past its delivery time is stuck; it must not hold the thread busy.
const now = Date.parse("2026-10-06T12:00:00Z");
assert.equal(slurpReplyBubbleStale(new Date(now + 60_000).toISOString(), now), false, "still on its way");
assert.equal(slurpReplyBubbleStale(new Date(now - 30_000).toISOString(), now), false, "due a moment ago: next tick");
assert.equal(slurpReplyBubbleStale(new Date(now - SLURP_REPLY_BUBBLE_STALE_MS - 1).toISOString(), now), true);
assert.equal(slurpReplyBubbleStale("not a date", now), true, "a broken row cannot block either");
// One rule where every caller asks (Get reply now and the away-reply loop): stale bubbles are dropped.
const queue = src("data/messages/slp-reply-queue-storage.ts");
assert.match(
  queue,
  /async hasPending[\s\S]*?slurpReplyBubbleStale\(String\(row\.deliverAt\)\)[\s\S]*?delete\(slurpReplyBubbles\)/u,
);
// A bubble whose delivery keeps failing is dropped once it is stale, not retried forever.
assert.match(
  src("features/messages/slp-message-scheduler-service.ts"),
  /Failed to deliver bubble[\s\S]*?if \(slurpReplyBubbleStale\(bubble\.deliverAt\)\) await replyQueue\.remove\(bubble\.id\)/u,
);
// The reply claim is unique per thread, so stale claims of any Creator on the thread are cleared.
assert.match(
  src("data/messages/slp-reply-storage-methods.ts"),
  /const stale = await db\.select\(\)\.from\(slurpMessageClaims\)\.where\(eq\(slurpMessageClaims\.threadId, threadId\)\);/u,
);

console.log("slurp2 feedback bugs regression passed");
