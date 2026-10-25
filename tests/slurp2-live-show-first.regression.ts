import { slurp2Source } from "./slurp2-source.ts";
import assert from "node:assert/strict";
import {
  slurpLiveActLines,
  slurpLiveSegmentLineAt,
  slurpLiveForViewer,
  slurpLivePicturesFree,
  slurpLivePictureTriggers,
  slurpLiveShotText,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live.ts";
import { slurpLivePictureBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-private-prompt.ts";
import { slurpLiveSegmentPrompt } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-prompt.ts";
import {
  slurpLiveMergeRoom,
  slurpLiveParseRoom,
  slurpLiveRoomPatch,
  slurpLiveRoomRewind,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-room.ts";

// act / shot come out of a segment answer as script lines at the segment start; missing ones are fine.
const answer = {
  act: " Ring light, slow tease ",
  shot: "She sits on the bed in a silk robe, ring light on her face.",
  lines: [],
};
assert.deepEqual(slurpLiveActLines(answer, 240_000), [
  { at: 240_000, kind: "act", text: "Ring light, slow tease" },
  { at: 240_000, kind: "shot", text: "She sits on the bed in a silk robe, ring light on her face." },
]);
assert.deepEqual(slurpLiveActLines({ lines: [] }, 0), []);
assert.deepEqual(slurpLiveActLines(null, 0), []);

const startedAt = "2026-10-25T12:00:00.000Z";
const start = Date.parse(startedAt);
const show = {
  id: "show",
  hostKind: "creator",
  hostId: "creator",
  startedAt,
  endsAt: "2026-10-25T12:20:00.000Z",
  endedAt: null,
  goal: 100,
  raised: 0,
  goalHitAt: null,
  script: [
    { at: 0, kind: "act", text: "Hello, room" },
    { at: 0, kind: "shot", text: "Opening shot" },
    { at: 1_000, kind: "narration", text: "hi" },
    { at: 240_000, kind: "shot", text: "Second shot" },
  ],
  events: [],
  queue: [],
  menu: [],
  segment: null,
  private: null,
  privateClaims: [],
  pictures: [],
  pictureViewers: [],
  pictureViewerId: null,
  pictureSeenAt: null,
  picturesAllowed: true,
  mode: "text",
  room: {
    shown: [],
    promises: [],
    refused: [],
    jokes: [],
    goal: "top comes off",
    before: { index: 1, shown: [], promises: [], refused: [], jokes: [] },
  },
} as any;
const at = (ms: number) => new Date(start + ms);

// Shot lines and the rewind ledger never reach a viewer; act lines do.
const view = slurpLiveForViewer(show, "p", at(300_000));
assert.ok(view.script.some((line: any) => line.kind === "act"));
assert.ok(!view.script.some((line: any) => line.kind === "shot"));
assert.equal(view.room.before, undefined);
assert.equal(view.room.goal, "top comes off");

// Pictures mode is the default when allowed and free; an explicit text choice or another holder blocks it.
assert.equal(view.mode, "pictures");
assert.equal(slurpLiveForViewer({ ...show, picturesAllowed: false }, "p", at(0)).mode, "text");
assert.equal(
  slurpLiveForViewer({ ...show, pictureViewers: [{ personaId: "q", mode: "pictures", seenAt: null }] }, "p", at(0))
    .mode,
  "text",
);
assert.equal(
  slurpLivePicturesFree({ ...show, pictureViewers: [{ personaId: "p", mode: "text", seenAt: null }] }, "p"),
  true,
);
assert.equal(
  slurpLiveForViewer({ ...show, pictureViewers: [{ personaId: "p", mode: "text", seenAt: null }] }, "p", at(0)).mode,
  "text",
);

// shot:<n> is due once its segment's shot is on stage, in pictures mode only.
const watching = (mode: string, ms = 10_000) => ({
  ...show,
  pictureViewers: [{ personaId: "p", mode, seenAt: at(ms).toISOString() }],
});
assert.deepEqual(slurpLivePictureTriggers(watching("pictures"), "p", at(10_000)), ["shot:0"]);
assert.deepEqual(
  slurpLivePictureTriggers(watching("pictures", 250_000), "p", at(250_000)).filter((t) => t.startsWith("shot")),
  ["shot:1"],
);
assert.deepEqual(slurpLivePictureTriggers(watching("text"), "p", at(10_000)), []);
const taken = {
  ...watching("pictures"),
  pictures: [{ personaId: "p", trigger: "shot:0", status: "ready", mediaId: "m", mediaPath: "x" }],
};
assert.ok(!slurpLivePictureTriggers(taken, "p", at(10_000)).includes("shot:0"));
assert.equal(slurpLiveShotText(show, "shot:1"), "Second shot");
assert.equal(slurpLiveShotText(show, "goal"), undefined);
assert.match(
  slurpLivePictureBrief({ hostName: "Mia", trigger: "shot:1", level: 1, spiceLines: [], shot: "Second shot" }),
  /Second shot/,
);

// The per-viewer cap is 12.
const full = {
  ...watching("pictures"),
  pictures: Array.from({ length: 11 }, (_, i) => ({
    personaId: "p",
    trigger: `menu:${i}`,
    status: "ready",
    mediaId: "m",
    mediaPath: "x",
  })),
};
assert.equal(slurpLivePictureTriggers(full, "p", at(10_000)).length, 1);
assert.equal(
  slurpLivePictureTriggers(
    {
      ...full,
      pictures: [
        ...full.pictures,
        { personaId: "p", trigger: "menu:x", status: "ready", mediaId: "m", mediaPath: "x" },
      ],
    },
    "p",
    at(10_000),
  ).length,
  0,
);

// room.goal is the first reward named; after the goal is hit the next new one fills secondGoal.
const patch = slurpLiveRoomPatch({ goalReward: " robe drops ", did: [], promise: [], joke: [] });
assert.equal(patch.goal, "robe drops");
assert.equal(slurpLiveRoomPatch({ lines: [] }).goal, undefined);
const empty = { shown: [], promises: [], refused: [], jokes: [] };
const first = slurpLiveMergeRoom(empty, patch);
assert.equal(first.goal, "robe drops");
assert.equal(slurpLiveMergeRoom(first, { goal: "other" }).goal, "robe drops");
assert.equal(slurpLiveMergeRoom(first, { goal: "other" }).secondGoal, undefined);
assert.equal(slurpLiveMergeRoom(first, { goal: "robe drops" }, true).secondGoal, undefined);
const second = slurpLiveMergeRoom(first, { goal: "top comes off" }, true);
assert.equal(second.secondGoal, "top comes off");
assert.equal(slurpLiveMergeRoom(second, { goal: "third" }, true).secondGoal, "top comes off");
// The ledger survives a store round trip and a rewind to the state before the dropped segment.
assert.equal(slurpLiveParseRoom(JSON.stringify(second)).secondGoal, "top comes off");
const written = { ...second, before: { ...first, index: 3 } };
const rewound = slurpLiveRoomRewind(slurpLiveParseRoom(JSON.stringify(written)), 3);
assert.equal(rewound.goal, "robe drops");
assert.equal(rewound.secondGoal, undefined);

// The prompt asks for 14-20 lines with *actions* and quoted speech, plus act, shot and goalReward.
const prompt = slurpLiveSegmentPrompt({
  hostName: "Mia",
  segmentIndex: 1,
  minutes: 4,
  level: 1,
  spiceLines: [],
  queuedMenuLabels: [],
  recentPlayerChatLines: [],
  recentTips: [],
  totalSegments: 5,
  room: first,
  goalReached: false,
} as any);
assert.match(prompt, /14-20/);
assert.match(prompt, /\*actions\*/);
assert.match(prompt, /"double quotes"/);
for (const key of ["act", "shot", "goalReward"]) assert.ok(prompt.includes(`"${key}"`), key);
assert.match(prompt, /robe drops/);
// The service places act/shot lines like any other line: an offset inside the segment, so
// segment 1's title and shot start when segment 1 starts, not at its last millisecond.
const [act1] = slurpLiveActLines({ act: "Second act" }, 0);
assert.equal(slurpLiveSegmentLineAt(1, act1!.at, 200_000), 240_000, "a later segment's act starts with it");
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-service.ts"),
  /slurpLiveActLines\(parsed, 0\)/,
);
console.log("slurp2-live-show-first ok");
