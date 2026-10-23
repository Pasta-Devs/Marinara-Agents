import assert from "node:assert/strict";
import {
  slurpLiveDurationMinutes,
  slurpLivePhase,
  slurpLiveReplyAllowed,
  slurpLiveShouldStart,
  slurpLiveTopTip,
  slurpLiveVisible,
  slurpLiveSegmentIndex,
  slurpLiveWatched,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import { slurp2Source } from "./slurp2-source.ts";

assert.ok(slurpLiveDurationMinutes(0) >= 20 && slurpLiveDurationMinutes(0) <= 40);
assert.equal(slurpLiveDurationMinutes(20), 40);
const startedAt = "2026-10-23T12:00:00.000Z";
const show = {
  id: "live-1",
  hostKind: "creator" as const,
  hostId: "creator-1",
  startedAt,
  endsAt: "2026-10-23T12:20:00.000Z",
  endedAt: null,
  goal: 100,
  raised: 20,
  goalHitAt: null,
  script: [
    { at: 0, kind: "narration" as const, text: "start" },
    { at: 60_000, kind: "crowd" as const, text: "later" },
  ],
  events: [{ at: 0, kind: "tip" as const, name: "Fan", amount: 12, text: "" }],
  lastReplyAt: null,
  recapPostId: null,
};
assert.equal(slurpLiveVisible(show, new Date("2026-10-23T12:00:30.000Z")).script.length, 1);
assert.equal(slurpLivePhase(show, new Date("2026-10-23T12:19:00.000Z")), "finish");
assert.equal(slurpLiveTopTip(show.events)?.amount, 12);
assert.equal(
  slurpLiveTopTip([...show.events, { at: 1, kind: "tip" as const, name: "Whale", amount: 50, text: "" }])?.amount,
  50,
);
assert.equal(slurpLiveReplyAllowed(null), true);
assert.equal(slurpLiveReplyAllowed("2026-10-23T12:00:00.000Z", new Date("2026-10-23T12:00:59.000Z")), false);
assert.equal(slurpLiveReplyAllowed("2026-10-23T12:00:00.000Z", new Date("2026-10-23T12:01:00.000Z")), true);
assert.equal(slurpLiveShouldStart({ active: true, random: 0 }), false);
assert.equal(slurpLiveShouldStart({ active: false, random: 0 }), true);
assert.equal(slurpLiveSegmentIndex(show, new Date("2026-10-23T12:04:00.000Z")), 1);
assert.equal(slurpLiveWatched(startedAt, new Date("2026-10-23T12:01:29.000Z")), true);
assert.equal(slurpLiveWatched(startedAt, new Date("2026-10-23T12:01:31.000Z")), false);
const service = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-service.ts");
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-routes.ts");
const scheduler = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-world-scheduler-service.ts",
);
const liveScreen = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveScreen.tsx");
const liveDestination = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHomeDestinations.tsx",
);
const liveBackstage = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/backstage/SlpBackstageOverviewPanel.tsx",
);
assert.match(service, /slurpLiveSegmentPrompt/);
assert.match(service, /slurpLiveMissedPrompt/);
assert.match(service, /if \(!current \|\| !slurpLiveWatched\(current.lastSeenAt, at\)\) return/);
assert.doesNotMatch(service, /slurpLiveScriptPrompt|slurpLiveFinishPrompt/);
assert.match(service, /createSlurpEventsStorage/);
assert.match(service, /createPost/);
assert.match(routes, /tipInThread\([\s\S]*?"Live show tip"/);
assert.match(routes, /replyToSlurpLiveChat/);
assert.match(routes, /getSlurpLiveMissed/);
assert.match(routes, /"\/live\/:id\/menu"/);
assert.match(scheduler, /advanceSlurpLive/);
assert.match(liveScreen, /matchTop/);
const liveChat = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveChat.tsx");
assert.match(liveChat, /aria-live/);
assert.match(liveScreen, /setInterval\(\(\) => setNow/);
assert.match(liveScreen, /crypto\.randomUUID\(\)/);
assert.match(liveScreen, /firstTipper/);
assert.match(liveScreen, /chatLabel/);
assert.match(liveScreen, /SlpLiveMenuSheet/);
assert.match(liveScreen, /requestId: crypto\.randomUUID\(\)/);
assert.match(liveScreen, /customTip/);
assert.match(liveScreen, /show\.viewers/);
assert.match(liveChat, /show\.missedSummary/);
assert.match(liveChat, /atBottom/);
assert.match(liveChat, /newMessages/);
assert.match(liveChat, /previousLines\.current = currentKeys/);
assert.match(liveChat, /if \(added\) setNewCount/);
assert.match(liveChat, /nameColor\(line\.name\)/);
const liveMenu = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveMenuSheet.tsx");
assert.match(liveMenu, /item\.picture/);
assert.match(liveMenu, /<SlpSheet open/);
assert.match(liveMenu, /closeDisabled=\{pending\}/);
const liveNowRow = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveNowRow.tsx");
const homeHub = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenHub.tsx");
assert.match(liveNowRow, /ui\.slurp\.live\.liveNow/);
assert.match(liveNowRow, /ui\.slurp\.live\.badge/);
assert.match(homeHub, /<SlpLiveNowRow/);
assert.match(liveDestination, /view: "live"/);
assert.match(liveDestination, /returnTo: navigation/);
assert.match(liveBackstage, /extLive/);
const liveHooks = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/slp-live-hooks.ts");
assert.match(liveHooks, /!query\.state\.data\?\.endedAt/);
assert.match(liveHooks, /enabled: Boolean\(id\)/);
assert.match(liveHooks, /personaId \? `\?personaId=\$\{encodeURIComponent\(personaId\)\}` : ""/);
assert.match(liveScreen, /useSlpLiveShow\(showId, personaId\)/);
assert.match(liveScreen, /role="status"\s+aria-label=\{t\("ui\.slurp\.live\.liveNow"\)\}/);
assert.match(liveScreen, /!personaId && \(/);
assert.match(liveChat, /filter\(\(order\) => order\.at <= elapsed\)/);
const postCard = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/post/SlpPostCard.tsx");
assert.match(postCard, /ctx\.liveHostId === post\.authorAccountId/);
console.log("slurp2 live shows: ok");
