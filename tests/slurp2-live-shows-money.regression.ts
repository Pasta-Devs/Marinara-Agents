import assert from "node:assert/strict";
import {
  slurpLiveCapEvents,
  slurpLiveClaimTipEvent,
  slurpLiveParseLines,
  slurpLiveReplyClaimAllowed,
  slurpLiveScriptFailed,
  SLURP_LIVE_EVENT_LIMIT,
  slurpLiveTipOffset,
  slurpLiveRecap,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import { slurpLiveMenuItems } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-menu.ts";
import { slurp2Source } from "./slurp2-source.ts";

const at = new Date("2026-10-23T12:00:00.000Z");
const tip = { at: 1, kind: "tip" as const, name: "Fan", amount: 25, text: "", requestId: "tip-1" };
const first = slurpLiveClaimTipEvent([], 0, 100, tip);
assert.ok(first);
assert.equal(first.raised, 25);
assert.equal(slurpLiveClaimTipEvent(first.events, first.raised, 100, tip), null, "same request id claims once");

assert.equal(slurpLiveReplyClaimAllowed(null, at), true);
assert.equal(slurpLiveReplyClaimAllowed(at.toISOString(), new Date(at.getTime() + 59_999)), false);
assert.equal(slurpLiveReplyClaimAllowed(at.toISOString(), new Date(at.getTime() + 60_000)), true);

const capped = slurpLiveCapEvents(
  Array.from({ length: SLURP_LIVE_EVENT_LIMIT + 1 }, (_, index) => ({
    at: index,
    kind: "chat" as const,
    name: "Fan",
    text: String(index),
  })),
);
assert.equal(capped.length, SLURP_LIVE_EVENT_LIMIT);
assert.equal(capped[0]?.text, "1");

assert.deepEqual(slurpLiveParseLines('```json\n{"lines":[{"at":0,"kind":"crowd","text":"hello"}]}\n```'), [
  { at: 0, kind: "crowd", text: "hello" },
]);
const badScript = slurpLiveParseLines("not json");
assert.equal(slurpLiveScriptFailed(badScript), true);
const offsets = Array.from({ length: 100 }, (_, index) => slurpLiveTipOffset("show", `fan-${index}`, 1_200_000));
assert.ok(offsets.some((offset) => offset < 240_000));
assert.ok(offsets.some((offset) => offset > 960_000));
assert.ok(offsets.every((offset) => offset >= 0 && offset < 1_200_000));
assert.equal(slurpLiveMenuItems(2, ["topic"], 30).length, 7);

const service = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-service.ts");
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-routes.ts");
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/live/slp-live-storage.ts");
assert.match(service, /trySlpOperation\("slurp-live-start"/);
assert.match(service, /reserveWeeklySpend/);
assert.match(service, /slurpLiveFanDue/);
assert.match(service, /slurpLiveRecap/);
assert.match(service, /slurpLiveReplyPrompt/);
assert.match(routes, /tipInThread\([\s\S]*?"Live show tip"/);
assert.match(routes, /releaseTip/);
assert.match(routes, /appendEvent/);
assert.match(routes, /claimMenu/);
assert.match(routes, /releaseMenu/);
assert.match(storage, /claimTip/);
assert.match(storage, /claimSegment/);
assert.match(storage, /segment\.index > index/);
assert.match(storage, /queue\.some\(\(entry\) => entry.requestId === order.requestId\)/);
assert.match(storage, /row\.hostKind === input\.hostKind\)\.length >= \(input\.hostKind === "creator" \? 2 : 1\)/);
assert.match(storage, /row\.missedSummary !== null/);
assert.match(storage, /claimReply/);
assert.match(storage, /slurpLiveCapEvents/);
console.log("slurp2 live shows money and claims: ok");
