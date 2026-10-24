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
  slurpLivePlayerRecapText,
  slurpLiveMenuPriceInBounds,
  slurpLivePrivateOffersDue,
  slurpLiveMenuServed,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import { slurpAudienceWeeklySpend } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-audience-subscription.ts";
import { slurpLiveMenuItems } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-menu.ts";
import { slurp2Source } from "./slurp2-source.ts";
import { earn } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/economy/slp-earnings.ts";

const at = new Date("2026-10-23T12:00:00.000Z");
const tip = { at: 1, kind: "tip" as const, name: "Fan", amount: 25, text: "", requestId: "tip-1" };
const first = slurpLiveClaimTipEvent([], 0, 100, tip);
assert.ok(first);
assert.equal(first.raised, 25);
assert.equal(slurpLiveClaimTipEvent(first.events, first.raised, 100, tip), null, "same request id claims once");

assert.equal(slurpLiveReplyClaimAllowed(null, at), true);
assert.equal(slurpLiveReplyClaimAllowed(at.toISOString(), new Date(at.getTime() + 7_999)), false);
assert.equal(slurpLiveReplyClaimAllowed(at.toISOString(), new Date(at.getTime() + 8_000)), true);

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
const cappedWithTip = slurpLiveCapEvents([
  { at: 0, kind: "tip" as const, name: "Fan", text: "", amount: 5, requestId: "first-tip" },
  ...Array.from({ length: SLURP_LIVE_EVENT_LIMIT + 1 }, (_, index) => ({
    at: index + 1,
    kind: "chat" as const,
    name: "Fan",
    text: String(index),
  })),
]);
assert.equal(cappedWithTip[0]?.requestId, "first-tip", "old tips survive the cap for dedupe and the recap");
assert.equal(cappedWithTip.length, SLURP_LIVE_EVENT_LIMIT + 1);

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
assert.ok(slurpLiveMenuItems(2, ["topic"], 30).length > 0, "player menu uses the configured spice level");
const hardNoLabels = slurpLiveMenuItems(3, [], 30, ["nude", "toy"]).map((item) => item.label);
assert.ok(!hardNoLabels.some((label) => /nude|top|toy/i.test(label)), "hard-nos block related rungs both ways");
assert.equal(slurpLiveMenuPriceInBounds(1), true);
assert.equal(slurpLiveMenuPriceInBounds(9999), true);
assert.equal(slurpLiveMenuPriceInBounds(10000), false);
assert.equal(slurpLiveMenuPriceInBounds(2.5), false);
const recapShow = {
  hostKind: "player" as const,
  events: [tip, { ...tip, name: "Top Fan", amount: 50, requestId: "tip-2" }],
  menu: [{ id: "item-1", label: "Kiss", price: 30, picture: false }],
  raised: 80,
  queue: [
    { itemId: "item-1", label: "Kiss", name: "Fan", at: 0, served: true, requestId: "menu-1", status: "paid" as const },
  ],
  privateClaims: [],
} as any;
assert.match(slurpLivePlayerRecapText(recapShow), /80 earned, 1 menu items served, top tipper: Top Fan/);
assert.equal(slurpLivePrivateOffersDue(recapShow), true);
assert.equal(
  slurpLivePrivateOffersDue({
    ...recapShow,
    privateClaims: ["fan-1", "fan-2"].map((id) => ({ requestId: `live:show:private-offer:${id}` })),
  }),
  false,
);

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
assert.equal(slurpLiveMenuClaimState([{ ...pendingOrder, status: "paid" }], "menu-1", "item-1", "player"), "duplicate");
assert.equal(slurpLiveMenuServed([{ ...pendingOrder, status: "paid" }], "menu-1")?.[0]?.served, true);
assert.equal(slurpLiveMenuServed([{ ...pendingOrder, status: "paid", served: true }], "menu-1")?.[0]?.served, true);
assert.equal(slurpLiveMenuServed([pendingOrder], "menu-1"), null, "unpaid orders cannot be served");

const initialEarnings = {
  coins: 0,
  lifetime: 0,
  ledger: [],
  receipts: {},
  payoutOn: null,
  paidOutToday: 0,
} as const;
const creditedMenu = earn(initialEarnings, "tip", 24, at, "Live show menu", "menu-1");
assert.equal(creditedMenu.coins, 24);
assert.equal(creditedMenu.ledger[0]?.note, "Live show menu");
assert.equal(earn(creditedMenu, "tip", 24, at, "Live show menu", "menu-1"), creditedMenu, "credit is idempotent");

const budgetStart = { spent: 0, startedAt: null };
const budgetFirst = slurpAudienceWeeklySpend(budgetStart, 20, 30, at);
assert.deepEqual(budgetFirst, { spent: 20, startedAt: at.toISOString() });
assert.equal(
  slurpAudienceWeeklySpend(budgetFirst!, 11, 30, at),
  null,
  "menu purchases use the same weekly budget as other fan spending",
);

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
assert.match(storage, /slurpLiveMayStart\(active, input\.hostKind, input\.hostId/);
assert.match(storage, /claimReply/);
assert.match(storage, /slurpLiveCapEvents/);
assert.match(storage, /isNull\(slurpLiveShows\.endedAt\)/);
assert.match(storage, /\.delete\(slurpLiveShows\)\.where\(lt\(slurpLiveShows\.endedAt, slurpLivePruneBefore\(at\)\)\)/);
assert.match(storage, /audienceTipKeys: JSON\.stringify\(\[\.\.\.keys, audienceKey\]\)/);
assert.match(service, /await storage\.pruneEnded\(at\)/);
assert.match(routes, /slurpLiveCanWatch\(personaId/);
assert.match(routes, /kickSlurpLiveShow\(app\.db, id\)/, "a watcher's poll moves the show on");
assert.match(
  service,
  /liveBusy\.get\(show\.id\) \?\? 0\) < 120_000\) return;/,
  "one show never advances twice at once",
);
assert.match(
  service,
  /if \(fresh && !fresh\.endedAt\) await advanceShowNow/,
  "a stale snapshot never ends a show twice",
);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/live/slp-live-private-storage.ts"),
  /extending \? null : slurpLiveDropAhead\(map\(row\), at\)/,
  "a new private show rewrites a public segment written ahead",
);
assert.match(storage, /slurpLiveSegmentToWrite\(map\(row\), at\) !== index/);
assert.equal(
  routes.match(/fromPlayer: true/g)?.length,
  3,
  "player chat, tips and the join greeting are marked for her reply",
);
assert.match(routes, /if \(!duplicate\) void replyToSlurpLiveChat\(app\.db, show\.id\)/, "a tip gets a live reply");
assert.match(
  service,
  /if \(!playerLinesSince\(show, since, privateAt\)\.length\) return;/,
  "no reply without a player line",
);
assert.match(service, /replyRetries\.add\(show\.id\)/, "lines sent inside the reply gap are answered after it");
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-model.ts"),
  /\(kind === "reply" \|\| kind === "crowd"\) && settings\.liveConnectionId/,
  "replies and the crowd use the fast live connection",
);
assert.match(
  service,
  /releaseReply\(show\.id, at, show\.lastReplyAt\);\s*if \(!retried\) retryLater\(\);/,
  "a failed reply gives the lines back and retries once",
);
assert.match(storage, /set\(\{ lastReplyAt: previous \}\)/, "a released reply never re-answers old lines");
assert.match(service, /at: at\.getTime\(\) - Date\.parse\(show\.startedAt\)/, "her reply is stamped at claim time");

console.log("slurp2 live shows money and claims: ok");
