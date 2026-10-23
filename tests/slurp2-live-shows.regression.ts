import assert from "node:assert/strict";
import {
  slurpLiveDurationMinutes,
  slurpLivePhase,
  slurpLiveReplyAllowed,
  slurpLiveShouldStart,
  slurpLiveTopTip,
  slurpLiveVisible,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import { slurp2Source } from "./slurp2-source.ts";

assert.ok(slurpLiveDurationMinutes(0) >= 20 && slurpLiveDurationMinutes(0) <= 40);
assert.equal(slurpLiveDurationMinutes(20), 40);
const startedAt = "2026-10-23T12:00:00.000Z";
const show = {
  id: "live-1", hostKind: "creator" as const, hostId: "creator-1", startedAt,
  endsAt: "2026-10-23T12:20:00.000Z", endedAt: null, goal: 100, raised: 20, goalHitAt: null,
  script: [{ at: 0, kind: "narration" as const, text: "start" }, { at: 60_000, kind: "crowd" as const, text: "later" }],
  events: [{ at: 0, kind: "tip" as const, name: "Fan", amount: 12, text: "" }], lastReplyAt: null, recapPostId: null,
};
assert.equal(slurpLiveVisible(show, new Date("2026-10-23T12:00:30.000Z")).script.length, 1);
assert.equal(slurpLivePhase(show, new Date("2026-10-23T12:19:00.000Z")), "finish");
assert.equal(slurpLiveTopTip(show.events)?.amount, 12);
assert.equal(slurpLiveTopTip([...show.events, { at: 1, kind: "tip" as const, name: "Whale", amount: 50, text: "" }])?.amount, 50);
assert.equal(slurpLiveReplyAllowed(null), true);
assert.equal(slurpLiveReplyAllowed("2026-10-23T12:00:00.000Z", new Date("2026-10-23T12:00:59.000Z")), false);
assert.equal(slurpLiveReplyAllowed("2026-10-23T12:00:00.000Z", new Date("2026-10-23T12:01:00.000Z")), true);
assert.equal(slurpLiveShouldStart({ active: true, random: 0 }), false);
assert.equal(slurpLiveShouldStart({ active: false, random: 0 }), true);
const service = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-service.ts");
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-routes.ts");
const scheduler = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-world-scheduler-service.ts");
assert.match(service, /slurpLiveScriptPrompt/);
assert.match(service, /slurpLiveFinishPrompt/);
assert.match(service, /createSlurpEventsStorage/);
assert.match(service, /createPost/);
assert.match(routes, /tipInThread\([^\n]+"Live show tip"/);
assert.match(routes, /replyToSlurpLiveChat/);
assert.match(scheduler, /advanceSlurpLive/);
console.log("slurp2 live shows: ok");
