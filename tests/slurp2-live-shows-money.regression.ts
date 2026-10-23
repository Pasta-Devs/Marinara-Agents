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
  slurpLiveCanWatch,
  slurpLiveAudienceTipDue,
  slurpLivePruneBefore,
  slurpLiveMenuClaimState,
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

assert.equal(slurpLiveCanWatch(undefined, true), false, "GET without persona never marks a watcher");
assert.equal(slurpLiveCanWatch("missing", false), false);
assert.equal(slurpLiveCanWatch("player", true), true);
const keys = ["live:show:fan-tip:fan-1"];
assert.equal(
  capped.some((event) => event.requestId === keys[0]),
  false,
  "capped events cannot dedupe tips",
);
assert.equal(slurpLiveAudienceTipDue(keys, keys[0]!), false, "keep tip keys outside capped events");
assert.equal(slurpLiveAudienceTipDue(keys, "live:show:fan-tip:fan-2"), true);
assert.equal(slurpLivePruneBefore(new Date("2026-10-23T12:00:00.000Z")), "2026-10-16T12:00:00.000Z");
const pendingOrder = {
  itemId: "item-1",
  label: "Request",
  name: "Fan",
  viewerId: "player",
  at: 0,
  served: false,
  requestId: "menu-1",
  status: "pending" as const,
};
assert.equal(slurpLiveMenuClaimState([], "menu-1", "item-1", "player"), "new");
assert.equal(slurpLiveMenuClaimState([pendingOrder], "menu-1", "item-1", "player"), "resume");
assert.equal(slurpLiveMenuClaimState([pendingOrder], "menu-1", "item-1", "other"), "conflict");
let charges = 0;
let settled = false;
const pay = () => {
  if (!settled) {
    charges++;
    settled = true;
  }
  return "sent";
};
assert.equal(pay(), "sent");
assert.equal(slurpLiveMenuClaimState([pendingOrder], "menu-1", "item-1", "player"), "resume");
assert.equal(pay(), "sent");
assert.equal(charges, 1, "retry uses the settled payment once");
assert.equal(slurpLiveMenuClaimState([{ ...pendingOrder, status: "paid" }], "menu-1", "item-1", "player"), "duplicate");

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
assert.match(storage, /slurpLiveMenuClaimState\(queue/);
assert.match(storage, /row\.hostKind === input\.hostKind\)\.length >= \(input\.hostKind === "creator" \? 2 : 1\)/);
assert.match(storage, /row\.missedSummary !== null/);
assert.match(storage, /claimReply/);
assert.match(storage, /slurpLiveCapEvents/);
assert.match(storage, /\.where\(isNull\(slurpLiveShows\.endedAt\)\)/);
assert.match(storage, /\.delete\(slurpLiveShows\)\.where\(lt\(slurpLiveShows\.endedAt, slurpLivePruneBefore\(at\)\)\)/);
assert.match(storage, /audienceTipKeys: JSON\.stringify\(\[\.\.\.keys, audienceKey\]\)/);
assert.match(service, /await storage\.pruneEnded\(at\)/);
assert.match(routes, /slurpLiveCanWatch\(personaId/);
console.log("slurp2 live shows money and claims: ok");
