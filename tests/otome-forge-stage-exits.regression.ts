// Otome Hearth #2024: a love interest who leaves a scene leaves the stage. The scene, Confrontation and Closer writers
// mark a segment's `exits` with the names of those who leave (or whom the protagonist leaves behind); the server keeps
// only the love interests it knows (by id, whole name or first name) and stores them as ids; the reader takes them off
// the stage from that line (after it, when the line is their own) until they speak again, and shows whoever is still
// there. A beat with no `exits` (every beat written before) keeps whoever spoke last, as before.
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimeline,
  confrontationBeat,
  onStageAt,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/reader-state.ts";
import type {
  BeatView,
  ChapterNode,
  ConfrontationView,
  RunLiView,
  Segment,
  Unit,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  normalizeBeatReply,
  segmentLists,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import { normalizeConfrontationReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/confrontation.ts";
import {
  beatMessages,
  closerMessages,
  confrontationMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import { CAST, HE, KAI, MIR, SHE, beatReply, bible, confrontationReply } from "./fixtures/otome-forge-story.ts";

const li = (id: string, name: string): RunLiView => ({
  id,
  name,
  pronouns: HE,
  source: "card",
  voiceGender: "male",
  accent: "#9DB8F0",
  level: 1,
  stage: 1,
});
const KAI_LI = li(KAI, "Kai Arden");
const MIR_LI = li(MIR, "Mireille");
const LIS = [KAI_LI, MIR_LI];
const NOBODY = { li: null, face: "", speaking: false };

function scene(segments: Segment[]): BeatView {
  return {
    key: "main-1",
    i: 0,
    kind: "beat",
    places: [],
    segments,
    choices: [],
    choiceCanon: {},
    musicMood: "tender",
    readThrough: 0,
    rewrites: 0,
    state: "unread",
  } as unknown as BeatView;
}
const lines = (segments: Segment[]) => buildTimeline(scene(segments), {}, "Ines").lines;

test("a love interest who leaves is off the stage until he speaks again; on his own exit line he is still there", () => {
  const read = lines([
    { speaker: "Kai", text: "Stay here.", expression: "cold" },
    { speaker: "", text: "He walks out into the rain.", exits: [KAI] },
    { speaker: "", text: "You are alone with the lamp." },
    { speaker: "Kai", text: "I forgot my coat.", expression: "tender" },
    { speaker: "Kai", text: "Goodnight.", exits: [KAI] },
    { speaker: "", text: "The door shuts behind him." },
  ]);
  assert.deepEqual(onStageAt(read, 0, LIS), { li: KAI_LI, face: "cold", speaking: true });
  assert.deepEqual(onStageAt(read, 1, LIS), NOBODY, "gone from the line he leaves on");
  assert.deepEqual(onStageAt(read, 2, LIS), NOBODY, "and stays gone while the protagonist is alone");
  assert.deepEqual(onStageAt(read, 3, LIS), { li: KAI_LI, face: "tender", speaking: true }, "back when he speaks");
  assert.deepEqual(onStageAt(read, 4, LIS), { li: KAI_LI, face: "", speaking: true }, "his own exit line is his");
  assert.deepEqual(onStageAt(read, 5, LIS), NOBODY, "gone after his own exit line");
});

test("when one love interest leaves, whoever is still there stays on stage", () => {
  const read = lines([
    { speaker: "Mireille", text: "He won't say it.", expression: "flustered" },
    { speaker: "Kai", text: "I'm leaving." },
    { speaker: "", text: "Kai is gone. Mireille stays by the window.", exits: [KAI] },
    { speaker: "", text: "Now they both go.", exits: [MIR, KAI] },
  ]);
  assert.deepEqual(onStageAt(read, 2, LIS), { li: MIR_LI, face: "flustered", speaking: false });
  assert.deepEqual(onStageAt(read, 3, LIS), NOBODY);
});

test("a beat with no exits keeps whoever spoke last, as every beat written before did", () => {
  const read = lines([
    { speaker: "Kai", text: "Stay here.", expression: "cold" },
    { speaker: "", text: "He walks out into the rain." },
    { speaker: "", text: "You are alone with the lamp." },
  ]);
  assert.deepEqual(onStageAt(read, 2, LIS), { li: KAI_LI, face: "cold", speaking: false });
});

test("a Confrontation's walkout ending takes him off the stage the same way", () => {
  const view = {
    ...scene([]),
    kind: "confrontation",
    li: KAI,
    opening: [{ speaker: "Kai", text: "Say it, then.", expression: "angry" }],
    rounds: [],
    ending: { kind: "walkout", segments: [{ speaker: "", text: "The door slams.", exits: [KAI] }] },
  } as unknown as ConfrontationView;
  const read = buildTimeline(confrontationBeat(view), {}, "Ines").lines;
  assert.deepEqual(onStageAt(read, read.length - 1, LIS), NOBODY);
});

const context = {
  node: { i: 0, kind: "beat", guide: "Rain.", cast: [KAI, MIR] } as ChapterNode,
  units: CAST,
  state: normalizeState({}),
  last: false,
};

test("the server keeps exits only for love interests it knows, as ids, once each", () => {
  const result = normalizeBeatReply(
    beatReply({
      segments: [
        { speaker: "Kai", text: "Goodnight.", exits: ["Kai", KAI, "kai"] },
        { speaker: "", text: "Both of them go.", exits: [MIR, "Mireille", "The harbour master", 7, ""] },
        { speaker: "", text: "A stranger leaves.", exits: ["The harbour master"] },
        { speaker: "", text: "He goes too.", exits: "Kai" },
        { speaker: "", text: "Rain." },
      ],
    }),
    context,
  );
  assert.equal(typeof result, "object", String(result));
  if (typeof result === "string") return;
  assert.deepEqual(
    result.segments.map((segment) => segment.exits),
    [[KAI], [MIR], undefined, [KAI], undefined],
  );
  assert.equal("exits" in result.segments[4]!, false, "no field when nobody leaves");
  const game = normalizeConfrontationReply(
    confrontationReply({
      endings: {
        truth: [{ speaker: "Kai", text: "I let it go dark.", expression: "hurt" }],
        walkout: [{ speaker: "", text: "The door slams.", exits: ["Kai", "Ghost"] }],
        standoff: [{ speaker: "", text: "Neither of you moves." }],
      },
    }),
    { li: KAI, node: context.node, cgOpen: false },
    segmentLists(context),
  );
  assert.equal(typeof game, "object", String(game));
  if (typeof game !== "string") assert.deepEqual(game.confrontation.endings.walkout[0]!.exits, [KAI]);
});

test("a stored beat keeps its exits, and a beat stored before keeps its segments", () => {
  const stored = (segments: unknown[]) =>
    normalizeBeat({ key: "main-1", i: 0, kind: "beat", segments, choices: [], choiceCanon: {} })!.segments;
  assert.deepEqual(stored([{ speaker: "", text: "He goes.", exits: [KAI] }]), [
    { speaker: "", text: "He goes.", exits: [KAI] },
  ]);
  assert.deepEqual(stored([{ speaker: "Kai", text: "Stay.", expression: "cold" }]), [
    { speaker: "Kai", text: "Stay.", expression: "cold" },
  ]);
});

test("the scene, Confrontation and Closer writers each ask for exits once, also when the protagonist walks away", () => {
  const world = normalizeWorld({ title: "Rain", premise: "Lanterns.", connections: { narration: "conn-text" } });
  const units: Unit[] = CAST.map((cast) => ({
    ...normalizeUnit({}),
    id: cast.id,
    name: cast.name,
    pronouns: HE,
    bible: bible(),
  }));
  const input = { world, units, player: { ...normalizePlayer({}), name: "Ines", pronouns: SHE }, state: context.state };
  const node = (kind: ChapterNode["kind"]) => ({ i: 0, kind, guide: "Rain.", cast: [KAI] }) as ChapterNode;
  const chapter = (one: ChapterNode) =>
    ({ kind: "main", number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [one] }) as const;
  const at = (kind: ChapterNode["kind"]) => ({
    ...input,
    chapter: chapter(node(kind)),
    node: node(kind),
    storySoFar: "",
    memory: "",
    li: KAI,
  });
  const prompts = {
    scene: beatMessages(at("beat")),
    confrontation: confrontationMessages(at("confrontation")),
    closer: closerMessages(at("closer")),
  };
  for (const [kind, messages] of Object.entries(prompts)) {
    const system = messages[0]!.content;
    assert.equal(system.split('"exits": ["Name"]').length - 1, 1, kind);
    assert.match(system, /- exits: only on the segment where love interests leave the scene/, kind);
    // The protagonist walking away leaves them behind just the same: they are no longer on her stage.
    assert.match(system, /or the protagonist leaves them behind/, kind);
  }
});

test("Confrontation and Closer options speak to the player as you, never about the heroine (#2030)", () => {
  const world = normalizeWorld({ title: "Rain", premise: "Lanterns.", connections: { narration: "conn-text" } });
  const units: Unit[] = CAST.map((cast) => ({
    ...normalizeUnit({}),
    id: cast.id,
    name: cast.name,
    pronouns: HE,
    bible: bible(),
  }));
  const input = { world, units, player: { ...normalizePlayer({}), name: "Ines", pronouns: SHE }, state: context.state };
  const node = (kind: ChapterNode["kind"]) => ({ i: 0, kind, guide: "Rain.", cast: [KAI] }) as ChapterNode;
  const chapter = (one: ChapterNode) =>
    ({ kind: "main", number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [one] }) as const;
  const at = (kind: ChapterNode["kind"]) => ({
    ...input,
    chapter: chapter(node(kind)),
    node: node(kind),
    storySoFar: "",
    memory: "",
    li: KAI,
  });
  for (const [kind, messages] of [
    ["confrontation", confrontationMessages(at("confrontation"))],
    ["closer", closerMessages(at("closer"))],
  ] as const) {
    const system = messages[0]!.content;
    assert.match(
      system,
      /label: [^.]*addressed to the player as a bare command or with "you"/u,
      `${kind} labels speak to the player`,
    );
    assert.match(
      system,
      /never with the protagonist's name or "she", "he" or "they" for them/u,
      `${kind} labels never say she`,
    );
    assert.match(system, /kind action, narrated to "you"/u, `${kind} actions are narrated to you`);
  }
});
