import assert from "node:assert/strict";
import {
  slurpLiveDurationMinutes,
  slurpLivePhase,
  slurpLiveReplyAllowed,
  slurpLiveShouldStart,
  slurpLiveTopTip,
  slurpLiveVisible,
  slurpLiveSegmentIndex,
  slurpLiveSegmentToWrite,
  slurpLiveSegmentLineAt,
  slurpLiveDropAhead,
  slurpLiveWatched,
  slurpLiveForViewer,
  slurpLiveParseLines,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import {
  slurpLiveMergeRoom,
  slurpLiveParseRoom,
  slurpLiveRoomLines,
  slurpLiveRoomPatch,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-room.ts";
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
const minute = (value: number) => new Date(Date.parse(startedAt) + value * 60_000);
const withSegment = (segment: any) => ({ ...show, segment }) as any;
assert.equal(slurpLiveSegmentToWrite(withSegment(null), minute(1)), 0, "write the current segment first");
assert.equal(slurpLiveSegmentToWrite(withSegment({ index: 0, lease: null }), minute(1)), null, "not ahead too early");
assert.equal(slurpLiveSegmentToWrite(withSegment({ index: 0, lease: null }), minute(2)), 1, "write ahead from halfway");
assert.equal(
  slurpLiveSegmentToWrite(withSegment({ index: 1, lease: null }), minute(3)),
  null,
  "one segment ahead only",
);
assert.equal(slurpLiveSegmentToWrite(withSegment({ index: 1, lease: "l" }), minute(3)), 1, "a stuck lease retries");
assert.equal(
  slurpLiveSegmentToWrite(withSegment({ index: 0, lease: null }), minute(9)),
  2,
  "a skipped segment is caught up",
);
assert.equal(
  slurpLiveSegmentToWrite(withSegment({ index: 4, lease: null }), minute(19)),
  null,
  "no segment past the end",
);
assert.equal(slurpLiveSegmentLineAt(1, 30_000, 120_000), 270_000, "on-time lines keep their place");
const late = [0, 120_000, 239_999].map((at) => slurpLiveSegmentLineAt(0, at, 180_000));
assert.ok(
  late.every((at) => at >= 182_000 && at < 240_000),
  "late lines fit the time left",
);
assert.ok(late[0]! < late[1]! && late[1]! < late[2]!, "late lines keep their order");
const ahead = {
  ...show,
  segment: { index: 2, lease: null, claimedAt: null },
  script: [
    { at: 200_000, kind: "crowd" as const, text: "now" },
    { at: 500_000, kind: "crowd" as const, text: "ahead" },
    { at: 500_000, kind: "reaction" as const, text: "dm", personaId: "p" },
  ],
  queue: [{ itemId: "i", label: "Kiss", name: "Fan", at: 400_000, served: true, servedIn: 2, requestId: "r" }],
  room: {
    shown: ["top off"],
    promises: [],
    refused: ["feet"],
    jokes: [],
    before: { index: 2, shown: [], promises: ["top off at the goal"], refused: [], jokes: [] },
  },
} as any;
const dropped = slurpLiveDropAhead(ahead, minute(6));
assert.deepEqual(dropped?.segment, { index: 1, lease: null, claimedAt: null });
assert.deepEqual(
  dropped?.script.map((line) => line.text),
  ["now", "dm"],
);
assert.equal(dropped?.queue[0]?.served, false, "orders of the dropped segment are served again");
assert.deepEqual(
  dropped?.room,
  { shown: [], promises: ["top off at the goal"], refused: ["feet"], jokes: [] },
  "the ledger forgets a dropped segment but keeps refusals",
);
assert.equal(slurpLiveDropAhead(ahead, minute(9)), null, "a segment already on air stays");

const patch = slurpLiveRoomPatch({ did: ["Robe off", 3], promise: "top off at the goal", joke: "" });
assert.deepEqual(patch, { shown: ["Robe off"], promises: ["top off at the goal"], jokes: [""] });
let room = slurpLiveMergeRoom(slurpLiveParseRoom(null), patch);
assert.deepEqual(room, { shown: ["Robe off"], promises: ["top off at the goal"], refused: [], jokes: [] });
room = slurpLiveMergeRoom(room, { shown: ["robe off", "kiss to the cam"] }, true);
assert.deepEqual(room.shown, ["Robe off", "kiss to the cam"], "nothing is recorded twice");
assert.deepEqual(room.promises, [], "kept promises clear at the goal");
assert.equal(slurpLiveParseRoom("not json").shown.length, 0);
assert.match(slurpLiveRoomLines(room, false).join("\n"), /never redo.*Robe off; kiss to the cam/);
assert.match(
  slurpLiveRoomLines({ ...room, promises: ["top off"] }, true).join("\n"),
  /Keep what you promised the room now: top off/,
);
assert.equal(
  slurpLiveParseLines({ lines: [{ at: 1, kind: "crowd", text: "10 to go", requires: "goal-open" }] })[0]?.requires,
  "goal-open",
);
const goalShow = {
  ...show,
  goalHitAt: "2026-10-23T12:02:00.000Z",
  room: slurpLiveParseRoom(null),
  menu: [],
  queue: [],
  privateClaims: [],
  pictures: [],
  pictureViewers: [],
  script: [
    { at: 60_000, kind: "crowd" as const, text: "early", requires: "goal-open" as const },
    { at: 180_000, kind: "crowd" as const, text: "stale", requires: "goal-open" as const },
    { at: 180_000, kind: "crowd" as const, text: "kept" },
  ],
} as any;
assert.deepEqual(
  slurpLiveForViewer(goalShow, null, minute(4)).script.map((line) => line.text),
  ["early", "kept"],
  "goal-open lines after the goal drop out",
);
assert.equal(slurpLiveWatched(startedAt, new Date("2026-10-23T12:01:29.000Z")), true);
assert.equal(slurpLiveWatched(startedAt, new Date("2026-10-23T12:01:31.000Z")), false);
const service = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-service.ts");
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-routes.ts");
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/live/slp-live-storage.ts");
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
assert.doesNotMatch(service, /slurpLiveMissedPrompt/, "the late-join catch-up costs no model call");
assert.match(service, /if \(!current \|\| !slurpLiveWatched\(current.lastSeenAt, at\)\) return/);
assert.doesNotMatch(service, /slurpLiveScriptPrompt|slurpLiveFinishPrompt/);
assert.match(service, /createSlurpEventsStorage/);
assert.match(service, /createPost/);
assert.match(service, /liveShowId === show\.id/);
assert.match(service, /menuLabel:/);
assert.match(service, /slurp-live-start/);
assert.match(storage, /!row\.announcedFor/);
assert.match(storage, /!row\.announcementPostId/);
assert.match(storage, /isNull\(slurpLiveShows\.startedNoticeAt\)/);
assert.match(storage, /startedRow\.startedNoticeAt !== at\.toISOString\(\)/);
assert.match(routes, /tipInThread\([\s\S]*?"Live show tip"/);
assert.match(routes, /replyToSlurpLiveChat/);
assert.doesNotMatch(routes, /getSlurpLiveMissed/);
assert.match(routes, /"\/live\/stir"/);
assert.match(routes, /storage\.byStirRequestId\(parsed\.data\.requestId\)/);
assert.match(routes, /announceSlurpLive\(app\.db, planned\)/);
assert.match(routes, /storage\.startPlanned\(planned\.id, new Date\(\)\)/);
assert.match(routes, /storage\.cancelUnstarted\(planned\.id\)/);
const stirLive = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/stir/SlpStirGoLive.tsx");
assert.match(stirLive, /onOpenLive\?\.\(show\.id\)/);
assert.match(stirLive, /goLiveScheduled/);
assert.match(routes, /"\/live\/:id\/menu"/);
assert.match(scheduler, /advanceSlurpLive/);
assert.match(liveScreen, /matchTop/);
const liveChat = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveChat.tsx");
assert.match(liveChat, /aria-live/);
assert.match(liveScreen, /setInterval\(\(\) => setNow/);
assert.match(liveScreen, /newRequestId\(\)/);
assert.match(liveScreen, /firstTipper/);
assert.match(liveScreen, /chatLabel/);
assert.match(liveScreen, /SlpLiveMenuSheet/);
assert.match(liveScreen, /newRequestId\(\)/);
assert.match(liveScreen, /customTip/);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveStage.tsx"),
  /show\.viewers/,
  "the stage shows the viewer count",
);
assert.match(liveScreen, /<SlpLiveStage/);
assert.match(
  liveChat,
  /joinedLate \? catchUpLines\(show, elapsed, t\) : \[\]/,
  "a late viewer gets a catch-up built in code",
);
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
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveStage.tsx"),
  /role="status"\s+aria-label=\{t\("ui\.slurp\.live\.liveNow"\)\}/,
);
assert.match(liveScreen, /!personaId && \(/);
assert.match(liveChat, /filter\(\(order\) => order\.at <= elapsed\)/);
const postCard = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/post/SlpPostCard.tsx");
assert.match(postCard, /ctx\.liveHostId === post\.authorAccountId/);
console.log("slurp2 live shows: ok");
