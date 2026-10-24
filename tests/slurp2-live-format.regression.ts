import assert from "node:assert/strict";
import {
  slurpLiveGoalTarget,
  slurpLiveIsWhale,
  slurpLiveWhaleAmount,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-format.ts";
import {
  slurpLiveForViewer,
  slurpLivePictureTriggers,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import { slurpLiveSegmentPrompt } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-prompt.ts";
import { slurp2Source } from "./slurp2-source.ts";

assert.equal(slurpLiveGoalTarget(100, 99), 100);
assert.equal(slurpLiveGoalTarget(100, 100), 200, "the second goal is twice the first");

const whales = Array.from({ length: 2_000 }, (_, index) =>
  slurpLiveIsWhale(`show-${index}`, "fan", 20 * 60_000, 1),
).filter(Boolean).length;
// p = 1 - 0.85^4 = about 48% for a 20-minute show.
assert.ok(whales > 850 && whales < 1_100, `whale rate ${whales} / 2000`);
assert.equal(slurpLiveIsWhale("show", "fan", 20 * 60_000, 1), slurpLiveIsWhale("show", "fan", 20 * 60_000, 1));
assert.equal(slurpLiveWhaleAmount(10, 400), 100, "a quarter of the goal at least");
assert.equal(slurpLiveWhaleAmount(30, 400), 150, "five normal tips at least");

const startedAt = "2026-10-24T12:00:00.000Z";
const at = new Date("2026-10-24T12:05:00.000Z");
const show = {
  id: "show",
  hostKind: "creator",
  hostId: "creator",
  startedAt,
  endsAt: "2026-10-24T12:20:00.000Z",
  endedAt: null,
  goal: 100,
  raised: 80,
  goalHitAt: null,
  script: [{ at: 200_000, kind: "picture", text: "", mediaId: "m", personaId: "p", requires: "goal-hit" }],
  events: [],
  queue: [],
  menu: [],
  segment: null,
  private: null,
  privateClaims: [],
  pictures: [],
  pictureViewers: [{ personaId: "p", mode: "pictures", seenAt: at.toISOString() }],
  pictureViewerId: null,
  pictureSeenAt: null,
  mode: "text",
} as any;
assert.ok(slurpLivePictureTriggers(show, "p", at).includes("goal"), "the goal picture is made from 80% on");
assert.ok(!slurpLivePictureTriggers({ ...show, raised: 79 }, "p", at).includes("goal"));
assert.equal(slurpLiveForViewer(show, "p", at).script.length, 0, "the goal picture hides until the goal is hit");
const hit = slurpLiveForViewer({ ...show, raised: 100, goalHitAt: "2026-10-24T12:04:00.000Z" }, "p", at);
assert.equal(hit.script[0]?.at, 240_000, "it appears at the goal moment");

const prompt = (input: object) =>
  slurpLiveSegmentPrompt({
    hostName: "Mia",
    segmentIndex: 1,
    minutes: 5,
    queuedMenuLabels: [],
    recentPlayerChatLines: [],
    recentTips: [],
    level: 2,
    totalSegments: 5,
    ...input,
  });
assert.match(prompt({ goalReached: true, secondGoal: 200 }), /second goal of 200 coins/);
assert.match(prompt({ goalReached: true, secondReached: true }), /Both tip goals are reached/);
assert.match(prompt({ segmentIndex: 4 }), /last call for tips/, "the finale makes a last call");

const service = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-service.ts");
assert.match(
  service,
  /slurpLiveIsWhale\(show\.id, fan\.id, duration, eligible\.length\)/,
  "whales tip through the fan budget",
);
assert.match(
  service,
  /event\.kind === "tip" \? `\$\{event\.name\} tipped/,
  "the crowd sees tips, so a whale gets a reaction",
);

const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-routes.ts");
assert.match(
  routes,
  /const regular = await storage\.isRegular\(show\.hostId, viewer\.id, id\);/,
  "a regular is someone from an earlier show",
);
assert.match(routes, /join: true,\s*\}\);\s*void replyToSlurpLiveChat\(app\.db, id\)/, "she greets a player who joins");
assert.match(
  service,
  /just joined the show \(\$\{event\.text === "regular" \? "a regular, back again" : "first time here"\}\)/,
);
const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/data/live/slp-live-storage.ts");
assert.match(storage, /if \(!fresh\.length\) return map\(row\);/, "a request id lands once, so two polls add one join");
assert.doesNotMatch(storage, /\{ goalHitAt: null \}/, "a released tip never takes back a goal moment already shown");
const chat = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/live/SlpLiveChat.tsx");
assert.match(chat, /!event\.join\)/, "the join line itself stays hidden");
assert.match(chat, /!show\.endedAt && elapsed > 120_000/, "an ended show has no catch-up");
const slots = {
  ...show,
  menu: [{ id: "item", label: "Kiss", price: 10, picture: true }],
  queue: [
    { itemId: "item", label: "Kiss", name: "Fan", at: 0, served: true, servedIn: 0, requestId: "r", status: "paid" },
  ],
  pictures: Array.from({ length: 6 }, (_, index) => ({
    personaId: "p",
    trigger: index ? `menu:old-${index}` : "goal",
    status: "ready",
  })),
};
assert.deepEqual(slurpLivePictureTriggers(slots, "p", at), ["menu:r"], "a hidden goal picture leaves its slot free");
assert.deepEqual(
  slurpLivePictureTriggers({ ...slots, raised: 100, goalHitAt: "2026-10-24T12:04:00.000Z" }, "p", at),
  [],
  "a shown goal picture counts",
);

console.log("slurp2 live format: ok");
