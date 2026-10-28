// Otome Forge's reader (M2a, C/lib/reader-state.ts): a beat's lines with the picked option spliced in, the choice
// waiting at its line, first play kept on a resumed read and offered again on a replay, skip-read stopping at the first
// line not read before (or a choice), Ease off cutting the beat at its aftermath, and who is on stage with which face.
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimeline,
  initialPicks,
  onStageAt,
  openingLine,
  openingNode,
  skipTarget,
  sumGrants,
  voiceOf,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/reader-state.ts";
import type {
  BeatView,
  RunLiView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";

const HE = { subject: "he", object: "him", possessive: "his" };
const ILVAR: RunLiView = {
  id: "li-ilvar-0001",
  name: "Ilvar Thorne",
  pronouns: HE,
  source: "card",
  accent: "#9DB8F0",
  level: 1,
  stage: 1,
};
const CASSIAN: RunLiView = { ...ILVAR, id: "li-cassian-0002", name: "Cassian", source: "archetype" };
const LIS = [ILVAR, CASSIAN];

function beat(changes: Partial<BeatView> = {}): BeatView {
  return {
    key: "main-1",
    i: 0,
    kind: "beat",
    places: [],
    segments: [
      { speaker: "", text: "Rain on the dome." },
      { speaker: "Ilvar Thorne", text: "You came back.", expression: "cold" },
      { speaker: "Mira", text: "I shouldn't have.", thought: true },
      { speaker: "Ilvar", text: "Stay.", expression: "tender" },
    ],
    choices: [
      {
        id: "choice-1",
        kind: "small",
        at: 1,
        options: [
          {
            id: "option-1",
            text: "Tell him the truth.",
            selection: { kind: "dialogue", text: "You were alone." },
            segments: [{ speaker: "Ilvar", text: "Unscientific.", expression: "flustered" }],
          },
          {
            id: "option-2",
            text: "Shrug.",
            selection: { kind: "action", text: "You shrug." },
            segments: [{ speaker: "", text: "He looks away." }],
          },
        ],
      },
    ],
    choiceCanon: {},
    musicMood: "tense",
    readThrough: 0,
    written: { at: "2026-10-28T10:00:00.000Z", connectionId: "conn", model: "model" },
    rewrites: 0,
    ...changes,
  };
}

const texts = (timeline: ReturnType<typeof buildTimeline>) => timeline.lines.map((line) => line.segment.text);

test("a pending choice waits at its line; a pick splices in the selection (her words or narration) and the branch", () => {
  const open = buildTimeline(beat(), {}, "Mira");
  assert.deepEqual(texts(open), ["Rain on the dome.", "You came back.", "I shouldn't have.", "Stay."]);
  assert.equal(open.pending.get(1)?.id, "choice-1");

  const picked = buildTimeline(beat(), { "choice-1": "option-1" }, "Mira");
  assert.deepEqual(texts(picked), [
    "Rain on the dome.",
    "You came back.",
    "You were alone.",
    "Unscientific.",
    "I shouldn't have.",
    "Stay.",
  ]);
  assert.equal(picked.pending.size, 0);
  assert.equal(picked.lines[2]!.segment.speaker, "Mira", "a dialogue selection is the protagonist's line");
  assert.deepEqual(
    picked.lines.slice(2, 4).map((line) => [line.kind, line.main]),
    [
      ["selection", 1],
      ["branch", 1],
    ],
  );
  const shrug = buildTimeline(beat(), { "choice-1": "option-2" }, "Mira");
  assert.equal(shrug.lines[2]!.segment.speaker, "", "an action selection is narration");
});

test("first play is canon: a resumed read keeps the pick, a replay offers it again, a big choice never changes", () => {
  const read = beat({ choiceCanon: { "choice-1": "option-2" } });
  assert.deepEqual(initialPicks(read, false), { "choice-1": "option-2" });
  assert.equal(buildTimeline(read, initialPicks(read, false), "Mira").pending.size, 0);
  assert.equal(buildTimeline(read, initialPicks(read, true), "Mira").pending.get(1)?.id, "choice-1");

  const big = beat({
    choices: [
      {
        ...beat().choices[0]!,
        kind: "big",
        at: 3,
        options: beat().choices[0]!.options.map((option) => ({ ...option, segments: [] })),
      },
    ],
    choiceCanon: { "choice-1": "option-1" },
  });
  const replay = buildTimeline(big, initialPicks(big, true), "Mira");
  assert.equal(replay.pending.size, 0, "a made big choice is kept on a replay");
  assert.equal(replay.lines.at(-1)!.segment.text, "You were alone.");
});

test("skip-read lands on the first line not read before, or on a choice, and never skips an unread line", () => {
  const timeline = buildTimeline(beat({ choices: [] }), {}, "Mira");
  assert.equal(skipTarget(timeline, 0, 0), 0, "nothing read before: nothing to skip");
  assert.equal(skipTarget(timeline, 0, 2), 2, "stops on the line at readThrough");
  assert.equal(skipTarget(timeline, 0, 3), 3, "everything read: the last line");
  const waiting = buildTimeline(beat(), {}, "Mira");
  assert.equal(skipTarget(waiting, 0, 3), 1, "stops where a choice waits");
  assert.equal(skipTarget(waiting, 1, 3), 1, "never past a pending choice");
  assert.equal(openingLine(timeline, 2, false), 2, "a resumed first read opens where it stopped");
  assert.equal(openingLine(timeline, 3, true), 0, "a replay opens at the start");
});

test("Ease off cuts the beat at its segment, drops the server's marker, and ends on the aftermath line", () => {
  const segments = [
    ...beat().segments,
    { speaker: "", text: "[The scene was cut short by the player. Continue from its aftermath without depicting it.]" },
  ];
  const cut = buildTimeline(beat({ segments, easedOff: { at: 1 } }), {}, "Mira");
  assert.deepEqual(
    cut.lines.map((line) => line.kind),
    ["segment", "segment", "aftermath"],
  );
  assert.equal(cut.pending.size, 0, "no choice after the cut");
  assert.equal(cut.lines.at(-1)!.main, 1);
  // A declined scene eased off before it was written: only the aftermath, at segment 0.
  const declined = buildTimeline(beat({ segments: [], choices: [], easedOff: { at: 0 } }), {}, "Mira");
  assert.deepEqual(
    declined.lines.map((line) => [line.kind, line.main]),
    [["aftermath", 0]],
  );
});

test("the face on stage is his latest line's; narration keeps it; a first name finds him", () => {
  const timeline = buildTimeline(beat({ choices: [] }), {}, "Mira");
  // Before anyone speaks, the first love interest who speaks in this beat stands there, never one who is not in it.
  assert.deepEqual(onStageAt(timeline.lines, 0, LIS), { li: ILVAR, face: "", speaking: false });
  const alone = buildTimeline(
    beat({
      choices: [],
      segments: [
        { speaker: "", text: "Rain." },
        { speaker: "Mira", text: "Alone again." },
      ],
    }),
    {},
    "Mira",
  );
  assert.deepEqual(onStageAt(alone.lines, 1, LIS), { li: null, face: "", speaking: false }, "nobody in the scene");
  assert.deepEqual(onStageAt(timeline.lines, 1, LIS), { li: ILVAR, face: "cold", speaking: true });
  assert.deepEqual(onStageAt(timeline.lines, 2, LIS), { li: ILVAR, face: "cold", speaking: false });
  assert.deepEqual(onStageAt(timeline.lines, 3, LIS), { li: ILVAR, face: "tender", speaking: true });
  assert.deepEqual(voiceOf({ speaker: "Mira", text: "…", thought: true }, LIS, "Mira Vale"), {
    kind: "protagonist",
    thought: true,
  });
  assert.deepEqual(voiceOf({ speaker: "", text: "…", thought: true }, LIS, "Mira Vale"), {
    kind: "protagonist",
    thought: true,
  });
  assert.deepEqual(voiceOf({ speaker: "Ilvar", text: "…", thought: true }, LIS, "Mira Vale"), {
    kind: "li",
    li: ILVAR,
    thought: true,
  });
  assert.deepEqual(voiceOf({ speaker: "The Warden", text: "…" }, LIS, "Mira Vale"), {
    kind: "other",
    name: "The Warden",
    thought: false,
  });
});

test("a chapter opens at its first node not read to the end; grants sum by love interest", () => {
  assert.equal(
    openingNode([
      { i: 0, state: "read" },
      { i: 1, state: "ready" },
      { i: 2, state: "unwritten" },
    ]),
    1,
  );
  assert.equal(
    openingNode([
      { i: 0, state: "read" },
      { i: 1, state: "read" },
    ]),
    0,
    "a finished chapter replays from the start",
  );
  assert.deepEqual(
    sumGrants([
      { source: "beat", starlight: 30 },
      { source: "chapter", starlight: 160 },
      { source: "lead", li: ILVAR.id, affection: 150 },
      { source: "foil", li: CASSIAN.id, affection: 60 },
    ]),
    {
      starlight: 190,
      affection: [
        { li: ILVAR.id, amount: 150 },
        { li: CASSIAN.id, amount: 60 },
      ],
    },
  );
});
