import assert from "node:assert/strict";
import {
  SLURP_LIVE_ROOMS,
  slurpLiveCrowdCursor,
  slurpLiveCrowdDue,
  slurpLiveEnqueueCrowd,
  slurpLiveRoomType,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-rooms.ts";
import { slurpLiveCrowdPrompt } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-prompt.ts";
import { slurp2Source } from "./slurp2-source.ts";

assert.equal(slurpLiveRoomType("whales"), "whales");
assert.equal(slurpLiveRoomType("toString"), "default", "only real room ids");
assert.equal(slurpLiveRoomType(null), "default");

const lines = Array.from({ length: 14 }, (_, index) => ({ name: index ? `fan${index}` : " ", text: `line ${index}` }));
const queued = slurpLiveEnqueueCrowd("show", [...lines, { text: "   " }], 60_000, () => 0.5);
assert.equal(queued.length, 12, "a batch is capped at 12 lines");
assert.deepEqual(
  queued.slice(0, 2).map((event) => event.at),
  [66_000, 72_000],
  "lines are 3 to 9 seconds apart after the cursor",
);
assert.equal(queued[0]?.name, "Fan", "a blank handle falls back to Fan");
const gaps = slurpLiveEnqueueCrowd("show", lines, 0, () => 0).map((event) => event.at);
assert.equal(gaps[0], 3_000);
assert.equal(slurpLiveEnqueueCrowd("show", lines, 0, () => 1)[0]?.at, 9_000);

const other = { at: 500_000, kind: "chat" as const, name: "Player", text: "hi", fromPlayer: true };
assert.equal(slurpLiveCrowdCursor([other], "show", 60_000), 60_000, "player lines are not crowd queue");
assert.equal(slurpLiveCrowdCursor([...queued, other], "show", 60_000), queued.at(-1)?.at);
assert.equal(slurpLiveCrowdDue([], "show", 60_000), true);
assert.equal(slurpLiveCrowdDue(queued, "show", 60_000), false, "a full queue waits");
assert.equal(slurpLiveCrowdDue(queued, "show", queued.at(-1)!.at - 9_999), true, "under 10 s left asks again");
assert.equal(slurpLiveCrowdDue(queued, "other-show", 60_000), true, "another show's lines never count");

const prompt = slurpLiveCrowdPrompt({
  hostName: "Mia",
  minutes: 3,
  room: SLURP_LIVE_ROOMS.simps,
  narration: "takes off her hoodie",
  chat: "",
  fans: ["Rex"],
  level: 2,
});
assert.match(prompt, /simps/);
assert.match(prompt, /takes off her hoodie/);
assert.match(prompt, /Rex/);
assert.doesNotMatch(prompt, /Recent chat/, "no empty chat block");

const service = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-service.ts");
assert.match(
  service,
  /if \(!privateActive && show\.hostKind === "creator"\) await fillSlurpLiveCrowd\(db, current, settings, at\);/,
  "only a watched public Creator show runs the crowd lane",
);
assert.match(
  service,
  /SLURP_LIVE_REACTIONS\[\(Math\.floor\(elapsed \/ 1_000\) \+ index\) % SLURP_LIVE_REACTIONS\.length\]/,
  "pool lines are the fallback",
);
assert.match(
  service,
  /if \(show\.events\.some\(\(event\) => event\.fromPlayer && event\.at > Math\.max\(lastHost, elapsed - 20_000\)\)\) return;/,
  "an unanswered player line keeps the fast connection free for her reply",
);
assert.match(
  service,
  /at\.getTime\(\) \+ 10_000 > Date\.parse\(show\.endsAt\)\) return;/,
  "no crowd call at the very end",
);
assert.match(service, /room: SLURP_LIVE_ROOMS\[slurpLiveRoomType\(current\.crowd \?\? settings\.liveRoom\)\]/);
const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-routes.ts");
assert.match(routes, /crowd: parsed\.data\.crowd \?\? null/, "the player's room choice is stored");

console.log("slurp2 live crowd lane: ok");
