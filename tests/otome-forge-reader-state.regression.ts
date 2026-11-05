// Otome Forge's reader (M2a, C/lib/reader-state.ts): a beat's lines with the picked option spliced in, the choice
// waiting at its line, first play kept on a resumed read and offered again on a replay, skip-read stopping at the first
// line not read before (or a choice), Ease off cutting the beat at its aftermath (keeping a pick at the cut, as the
// server's canon does), and who is on stage with which face.
// M2b: a Confrontation played as a beat of stances (its mainline indexes what the server counts), each line's ref (the
// favourite and the voice cache key, new for every rewrite), a place's picture found by its name, and a route chapter
// held by a rupture.
import assert from "node:assert/strict";
import test from "node:test";
import { voiceCacheKey } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/audio.ts";
import {
  buildTimeline,
  confrontationBeat,
  initialPicks,
  lineRef,
  placeEntry,
  readerBeat,
  readyUrl,
  onStageAt,
  ruptureHold,
  openingLine,
  openingNode,
  skipTarget,
  sumGrants,
  voiceOf,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/reader-state.ts";
import type {
  BeatView,
  ConfrontationView,
  RunLiView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { canonicalSegments } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";

const HE = { subject: "he", object: "him", possessive: "his" };
const ILVAR: RunLiView = {
  id: "li-ilvar-0001",
  name: "Ilvar Thorne",
  pronouns: HE,
  source: "card",
  voiceGender: "male",
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

test("an Ease off on a branch line keeps that pick's selection and branch, as the server's canon does", () => {
  const marker = "[The scene was cut short by the player. Continue from its aftermath without depicting it.]";
  // Eased off while reading the branch of choice-1 (at 1): the cut is segment 1, and the pick was made before it.
  const cut = beat({
    segments: [...beat().segments, { speaker: "", text: marker }],
    choiceCanon: { "choice-1": "option-1" },
    easedOff: { at: 1 },
  });
  const canon = canonicalSegments({ ...cut, effects: {}, applied: {} }, "Mira")!
    .map((segment) => segment.text)
    .filter((text) => !text.startsWith("["));
  assert.deepEqual(canon, ["Rain on the dome.", "You came back.", "You were alone.", "Unscientific."]);
  // The resumed first read, and a replay (where a small choice before the cut is offered again).
  for (const replay of [false, true]) {
    const timeline = buildTimeline(cut, initialPicks(cut, replay), "Mira");
    assert.deepEqual(
      timeline.lines.filter((line) => line.kind !== "aftermath").map((line) => line.segment.text),
      canon,
      `the backlog and the replay show the canon (replay: ${replay})`,
    );
    assert.deepEqual(
      timeline.lines.map((line) => [line.kind, line.main]),
      [
        ["segment", 0],
        ["segment", 1],
        ["selection", 1],
        ["branch", 1],
        ["aftermath", 1],
      ],
    );
    assert.equal(timeline.lines[2]!.segment.speaker, "Mira");
    assert.equal(timeline.pending.size, 0, "nothing is offered at the cut");
  }
  // This read's own pick on a replay is the one it shows.
  assert.equal(buildTimeline(cut, { "choice-1": "option-2" }, "Mira").lines[2]!.segment.text, "You shrug.");
});

test("a `locked` refusal of a route chapter's scene is its love interest's rupture; nothing else is", () => {
  assert.equal(ruptureHold("locked", { kind: "route", li: CASSIAN.id }), CASSIAN.id);
  assert.equal(ruptureHold("locked", { kind: "repair", li: CASSIAN.id }), null);
  assert.equal(ruptureHold("locked", { kind: "main" }), null);
  assert.equal(ruptureHold("conflict", { kind: "route", li: CASSIAN.id }), null);
  assert.equal(ruptureHold(null, null), null);
});

test("the face on stage is his latest line's; narration keeps it; a first name finds him", () => {
  const timeline = buildTimeline(beat({ choices: [] }), {}, "Mira");
  // A future love interest's turn must not reveal him during the opening narration.
  assert.deepEqual(onStageAt(timeline.lines, 0, LIS), { li: null, face: "", speaking: false });
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

const option = (label: string, text: string, answer?: string) => ({
  label,
  selection: { kind: "dialogue" as const, text },
  ...(answer ? { segments: [{ speaker: "Ilvar", text: answer, expression: "angry" as const }] } : {}),
});
const stances = (answered?: "press") => ({
  press: option("Make him answer.", "Why?", answered === "press" ? "Fine." : undefined),
  hold: option("Wait.", "I'm here."),
  yield: option("Let go.", "Not tonight."),
  reveal: option("Tell him.", "I was scared."),
});

function confrontation(changes: Partial<ConfrontationView> = {}): ConfrontationView {
  const {
    segments: _segments,
    choices: _choices,
    choiceCanon: _canon,
    ...rest
  } = beat({ i: 2, kind: "confrontation" });
  return {
    ...rest,
    li: ILVAR.id,
    opening: [{ speaker: "", text: "The dome again." }],
    rounds: [{ round: 1, his: [{ speaker: "Ilvar", text: "Say it.", expression: "cold" }], options: stances() }],
    ...changes,
  };
}

test("a Confrontation is a beat of stances: its mainline is the opening, each round's lines, then the ending", () => {
  const first = readerBeat({ beat: beat(), confrontation: confrontation() });
  assert.equal(first.confrontation?.li, ILVAR.id);
  const open = buildTimeline(first.beat, initialPicks(first.beat, false), "Mira");
  assert.deepEqual(texts(open), ["The dome again.", "Say it."]);
  // Round 1's four stances wait at its last line, in a fixed order, under their own labels.
  const waiting = open.pending.get(1)!;
  assert.equal(waiting.id, "round-1");
  assert.deepEqual(
    waiting.options.map((item) => `${item.id}:${item.text}`),
    ["press:Make him answer.", "hold:Wait.", "yield:Let go.", "reveal:Tell him."],
  );

  // After the stance: the pick is canon (kept on a replay too), its answer follows, then round 2 and the ending.
  const played = confrontation({
    rounds: [
      { round: 1, his: [{ speaker: "Ilvar", text: "Say it." }], options: stances("press"), picked: "press" },
      { round: 2, his: [{ speaker: "Ilvar", text: "It was never the data.", expression: "hurt" }], options: stances() },
    ],
    ending: { kind: "truth", segments: [{ speaker: "Ilvar", text: "I left first." }] },
  });
  const read = confrontationBeat(played);
  for (const replay of [false, true]) {
    const lines = buildTimeline(read, initialPicks(read, replay), "Mira");
    assert.deepEqual(texts(lines), [
      "The dome again.",
      "Say it.",
      "Why?",
      "Fine.",
      "It was never the data.",
      "I left first.",
    ]);
    // The mainline the server counts read: opening 0, round 1 at 1 (its stance and answer share it), round 2 at 2.
    assert.deepEqual(
      lines.lines.map((line) => line.main),
      [0, 1, 1, 1, 2, 3],
    );
    assert.equal(lines.pending.get(4)?.id, "round-2");
  }
  // A plain beat stays itself.
  assert.equal(readerBeat({ beat: beat() }).confrontation, undefined);
  assert.throws(() => readerBeat({}));
});

test("a Closer is a beat of its own four answers, in their order, with the same mainline (#1938)", () => {
  const answers = {
    // Out of order on the wire: the reader keeps the Closer's own order, and never offers a stance.
    ask: option("Ask why.", "Why here?"),
    mirror: option("Tell your own.", "Me too."),
    tease: option("Tease.", "You're blushing."),
    reassure: option("Stay close.", "I'm here."),
    press: option("A stance.", "Not a Closer's."),
  } as ConfrontationView["rounds"][number]["options"];
  const view = confrontation({
    kind: "closer",
    rounds: [{ round: 1, his: [{ speaker: "Ilvar", text: "I used to come here alone." }], options: answers }],
  });
  const served = readerBeat({ beat: beat(), confrontation: view }).beat;
  const open = buildTimeline(served, initialPicks(served, false), "Mira");
  assert.deepEqual(texts(open), ["The dome again.", "I used to come here alone."]);
  assert.deepEqual(
    open.pending.get(1)!.options.map((item) => item.id),
    ["reassure", "tease", "mirror", "ask"],
  );
});

test("a round with no lines of its own still gets a line for its stances, so no two rounds share one", () => {
  const read = confrontationBeat(
    confrontation({
      opening: [],
      rounds: [
        { round: 1, his: [], options: stances("press"), picked: "press" },
        { round: 2, his: [], options: stances() },
      ],
    }),
  );
  assert.deepEqual(
    read.choices.map((choice) => choice.at),
    [0, 1],
  );
});

test("each line's ref names its version of the beat, so a rewrite never replays the old voice", () => {
  const picked = beat({ choiceCanon: { "choice-1": "option-1" } });
  const timeline = buildTimeline(picked, initialPicks(picked, false), "Mira");
  const refs = timeline.lines.map((_, index) => lineRef(timeline, index, "main-1/0r0"));
  assert.deepEqual(refs, [
    "main-1/0r0/0",
    "main-1/0r0/1",
    "main-1/0r0/1:option-1+0",
    "main-1/0r0/1:option-1+1",
    "main-1/0r0/2",
    "main-1/0r0/3",
  ]);
  assert.equal(voiceCacheKey("r-key", lineRef(timeline, 1, "main-1/0r1")), "otome-forge:r-key:main-1/0r1/1");
});

test("a place's picture is found by its name, and only a ready paint has one", () => {
  const places = [
    { name: "The Observation Room", tags: "dome", art: { state: "ready" as const, at: "", url: "/gallery/1.png" } },
    { name: "The Lab", tags: "glass", art: { state: "waiting-consent" as const, at: "" } },
  ];
  assert.equal(readyUrl(placeEntry(places, "the observation  room")?.art), "/gallery/1.png");
  assert.equal(readyUrl(placeEntry(places, "THE-observation-room")?.art), "/gallery/1.png");
  assert.equal(placeEntry([{ name: "Dottore’s wing 4", tags: "lab" }], "dottore's wing 4")?.name, "Dottore’s wing 4");
  assert.equal(placeEntry([{ name: "Dottore’s wing 4", tags: "lab" }], "Dottore’s wing 5"), null);
  assert.equal(readyUrl(placeEntry(places, "The Lab")?.art), null);
  assert.equal(placeEntry(places, "Elsewhere"), null);
  assert.equal(placeEntry(null, "The Lab"), null);
});
