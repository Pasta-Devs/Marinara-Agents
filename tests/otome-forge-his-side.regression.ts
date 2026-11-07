// Otome Hearth's his side (#2155): a big moment told again from the love interest's point of view, in Routes, at most
// once per story arc for each love interest.
// - The moments: a route gate that moves his stage, a climax ending in the truth, a walkout, Opened up or Shut out, a
//   rift a repair mends; never a Standoff, Almost, an eased-off gate, a declined node or another kind of chapter. Each
//   is noted in the read's own write, once, and the newest replaces the arc's note until his side of it is written.
// - Routes offers it once the chapter is finished; Read writes its one-node chapter with no model call (two taps make
//   one), opening in the scene's own place; P6 writes it as his side (only his thoughts, no choice, his card at the
//   moment's stage, the scene in the last turn, the story context alone cached), and other chapters' P6 is unchanged.
// - It is part of the chapter it follows: the next chapter built is given both in full, its timeline entry left out;
//   it is his own memory source, out of Who said what?; reading it pays its beat and moves nothing else.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  LiState,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { levelFloor } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  isChapterKey,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { whoSaidWhat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/who-said-what.ts";
import {
  NO_CHOICES_SENTENCE,
  beatMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import type { StoryArc } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story-arc.ts";
import {
  normalizeChapter,
  toChapterView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  normalizeBeatReply,
  type BeatContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import {
  readChapter,
  recallText,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import {
  hisSideArc,
  hisSideMomentOf,
  hisSideOffers,
  noteHisSide,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/his-side.ts";
import type { BeatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/replies.ts";
import {
  CAST,
  KAI,
  MIR,
  beatReply,
  bible,
  closerPlanReply,
  closerReply,
  confrontationReply,
  isCloserPrompt,
  isConfrontationPrompt,
  json,
  planReply,
  saveStoryMemory,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

type World = Awaited<ReturnType<typeof storyWorld>>;
type Messages = CapabilityLanguageModelMessage[];

const system = (messages: Messages) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
const user = (messages: Messages) => messages.at(-1)!.content;
const beatPath = "/runs/:run/chapters/:key/beats/:i";
const SIDE_KAI_0 = `side-${KAI}-0`;
const SIDE_LINE = "SIDE-LINE: she climbed every stair, and I counted each one.";
const SIDE_THOUGHT = "SIDE-THOUGHT: don't look at her. Look at the lamp.";
const isSidePrompt = (messages: Messages) => user(messages).includes("KAI'S SIDE");

/** His side's reply: Kai's line and several of his thoughts, whatever his stage, and a choice it may not offer. */
const sideReply = () =>
  beatReply({
    segments: [
      { speaker: "", text: "SIDE-OPENING: the lamp hisses; she is on the stairs.", place: "The Lamp Room" },
      { speaker: "Kai", text: SIDE_THOUGHT, thought: true, expression: "flustered" },
      { speaker: "Kai", text: SIDE_LINE, expression: "cold" },
      { speaker: "Kai", text: "SIDE-THOUGHT-2: she came back.", thought: true },
    ],
    choices: [
      {
        kind: "small",
        at: 1,
        options: [
          { text: "One", selection: { kind: "action", text: "One." }, segments: [{ speaker: "", text: "One." }] },
          { text: "Two", selection: { kind: "action", text: "Two." }, segments: [{ speaker: "", text: "Two." }] },
        ],
      },
    ],
  });

/** A valid P10 reply for Kai: four nodes, him in each, Mireille in the gate. */
const routePlan = (title = "The North Light") => ({
  title,
  tags: ["jealousy"],
  summary: "Kai takes her up to the lamp.",
  nodes: [
    { kind: "beat", guide: "Kai at the lamp, pretending not to wait.", cast: [KAI] },
    { kind: "beat", guide: "She reads his face at the bell.", cast: [KAI] },
    { kind: "beat", guide: "The lamp room at night.", cast: [KAI] },
    { kind: "beat", guide: "The gate: the mask cracks for one breath.", cast: [KAI, "Mireille"] },
  ],
  ledger: { relationship: [], conflict: [], offscreen: [] },
});

/**
 * Answers each planner and narrator; his side's narrator with sideReply. Chapter 1 is Kai's with a Closer, any later
 * one Mireille's with a Confrontation.
 */
function router(route = () => routePlan()) {
  let chapters = 0;
  return Array.from({ length: 80 }, () => (messages: Messages) => {
    if (isSidePrompt(messages)) return json(sideReply());
    if (system(messages).includes("route planner")) return json(route());
    if (system(messages).includes("chapter planner")) {
      chapters += 1;
      const ledger = { relationship: [], conflict: [], offscreen: [] };
      return json(chapters === 1 ? closerPlanReply() : planReply({ foil: "Kai", ledger }));
    }
    if (isCloserPrompt(messages)) return json(closerReply());
    if (isConfrontationPrompt(messages)) return json(confrontationReply());
    return json(beatReply());
  });
}

async function setState(t: World, change: (state: RunState) => RunState) {
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, change);
}
const kaiState = (t: World, change: Partial<LiState>) =>
  setState(t, (state) => ({ ...state, lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, ...change } } }));

/** Opens Kai's next route chapter and reads every node to its end; the reads' results, last one the gate's. */
async function playRoute(t: World) {
  const planned = await t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const key = planned.body.chapter.key as string;
  const reads = [];
  for (let i = 0; i < planned.body.chapter.nodes.length; i += 1) {
    const params = { key, i: String(i) };
    assert.equal((await t.call("POST", beatPath, {}, params)).status, 200);
    reads.push(await t.call("POST", `${beatPath}/read`, { segment: 99 }, params));
  }
  await t.settle();
  return { key, reads };
}

const sides = async (t: World) => (await t.call("GET", "/runs/:run/story")).body.hisSides;
const claim = (t: World, arc: unknown, li = KAI) => t.call("POST", "/runs/:run/sides/:li", { arc }, { li });

// ── The moments ──

const chapterOf = (kind: Chapter["kind"]) => ({ kind });
const climax = (ending: string, extra: Partial<Beat> = {}) =>
  ({ confrontation: { li: KAI, ending } as unknown as Beat["confrontation"], ...extra }) as Pick<
    Beat,
    "easedOff" | "confrontation"
  >;

test("only a big moment counts: a stage, the truth, a walkout, Opened up, Shut out or a mended rift", () => {
  const none = {};
  assert.deepEqual(hisSideMomentOf(chapterOf("route"), {}, { stageUp: { li: KAI } }), { li: KAI, moment: "stage" });
  assert.deepEqual(hisSideMomentOf(chapterOf("repair"), {}, { repaired: KAI }), { li: KAI, moment: "repair" });
  for (const ending of ["truth", "walkout", "opened", "shut"]) {
    assert.deepEqual(hisSideMomentOf(chapterOf("main"), climax(ending), none), { li: KAI, moment: ending });
  }
  assert.equal(hisSideMomentOf(chapterOf("main"), climax("standoff"), none), null, "a Standoff never counts");
  assert.equal(hisSideMomentOf(chapterOf("main"), climax("almost"), none), null, "Almost never counts");
  assert.equal(hisSideMomentOf(chapterOf("main"), {}, none), null, "a plain beat never counts");
  // An Ease off moves the stage (the scene happened, cut short) but is no moment; a declined node is saved cut at 0.
  const eased = { easedOff: { at: 2 } };
  assert.equal(hisSideMomentOf(chapterOf("route"), eased, { stageUp: { li: KAI } }), null);
  assert.equal(hisSideMomentOf(chapterOf("repair"), { easedOff: { at: 0 } }, { repaired: KAI }), null);
  assert.deepEqual(
    hisSideMomentOf(chapterOf("main"), climax("opened", { easedOff: { at: 1 } }), none),
    { li: KAI, moment: "opened" },
    "a climax eased off after its ending keeps its canon, so it counts",
  );
  for (const kind of ["story", "date", "prologue"] as const) {
    assert.equal(hisSideMomentOf(chapterOf(kind), climax("truth"), { stageUp: { li: KAI } }), null, kind);
  }
});

test("the arc is the story arc: a main chapter's own, else the one being played, 0 before the first", () => {
  const arcs = [
    { number: 1, from: 1, endsAt: 10 },
    { number: 2, from: 11, endsAt: 14 },
  ] as StoryArc[];
  assert.equal(hisSideArc({ kind: "main", arc: 1, number: 12 }, arcs), 1, "the chapter's own arc first");
  assert.equal(hisSideArc({ kind: "main", number: 12 }, arcs), 2, "else the arc covering it");
  assert.equal(hisSideArc({ kind: "main", number: 3 }, []), 0, "before arcs existed");
  assert.equal(hisSideArc({ kind: "route" }, arcs), 2, "a route chapter belongs to the arc being played");
  assert.equal(hisSideArc({ kind: "repair" }, []), 0);

  const state = normalizeState({ lis: { [KAI]: {}, [MIR]: {} } });
  const first = noteHisSide(state, KAI, { arc: 1, ref: "main-3/5", moment: "shut", stage: 2 });
  const second = noteHisSide(first, KAI, { arc: 2, ref: "main-12/6", moment: "truth", stage: 3 });
  const newest = noteHisSide(second, KAI, { arc: 1, ref: `route-${KAI}-3/3`, moment: "stage", stage: 3 });
  assert.deepEqual(
    newest.lis[KAI]!.hisSide.map(({ arc, moment }) => [arc, moment]),
    [
      [2, "truth"],
      [1, "stage"],
    ],
    "the newest moment of an arc replaces its note; another arc's stays",
  );
  assert.deepEqual(newest.lis[MIR]!.hisSide, [], "only his");
  assert.deepEqual(normalizeState({ lis: { [KAI]: {} } }).lis[KAI]!.hisSide, [], "a run from before has none");
  assert.deepEqual(
    normalizeState({ lis: { [KAI]: { hisSide: [{ arc: 41, ref: "x/1", moment: "stage", stage: 2 }] } } }).lis[KAI]!
      .hisSide,
    [],
    "a damaged note is dropped",
  );
});

test("his side's chapter key is side-<li>-<arc>, arc 0 to 99 by shape (the route bounds it at 40)", () => {
  for (const key of [`side-${KAI}-0`, `side-${KAI}-40`, `side-${KAI}-99`]) assert.equal(isChapterKey(key), true, key);
  for (const key of [`side-${KAI}-01`, `side-${KAI}-100`, `side-${KAI}`, "side-kai-1", "side-li-ka-1"]) {
    assert.equal(isChapterKey(key), false, key);
  }
});

test("Routes offers a side once its chapter is finished, and while it is read tells the moment it was written for", () => {
  const chapter = (key: string, title: string, extra: Partial<Chapter> = {}) =>
    normalizeChapter({
      key,
      kind: "main",
      lead: KAI,
      title,
      nodes: [{ i: 0, kind: "beat", guide: "g", cast: [KAI] }],
      ...extra,
    })!;
  const sideNote = { arc: 1, ref: "main-3/0", moment: "shut" as const, stage: 2 };
  const state = (chapters: Record<string, string | null>, hisSide = [sideNote]) =>
    normalizeState({
      lis: { [KAI]: { hisSide }, [MIR]: {} },
      chapters: Object.fromEntries(
        Object.entries(chapters).map(([key, completed]) => [key, { beatsRead: 1, completed, applied: [] }]),
      ),
    });
  const main3 = chapter("main-3", "The Bell");
  const done = "2026-11-07T10:00:00.000Z";
  assert.deepEqual(hisSideOffers([main3], state({ "main-3": null }), [KAI, MIR]), [], "not before it is finished");
  const offer = { li: KAI, arc: 1, key: `side-${KAI}-1`, moment: "shut", stage: 2, title: "The Bell", reading: false };
  assert.deepEqual(hisSideOffers([main3], state({ "main-3": done }), [KAI, MIR]), [offer]);
  // Written, then a later moment of the same arc: the side being read still tells the one it was written for.
  const side = chapter(`side-${KAI}-1`, "The Bell", { kind: "story", li: KAI, hisSide: sideNote });
  const later = [{ arc: 1, ref: "main-4/0", moment: "truth" as const, stage: 3 }];
  const main4 = chapter("main-4", "The Tide");
  assert.deepEqual(hisSideOffers([main3, main4, side], state({ "main-3": done, "main-4": done }, later), [KAI]), [
    { ...offer, reading: true },
  ]);
  assert.deepEqual(
    hisSideOffers([main3, side], state({ "main-3": done, [`side-${KAI}-1`]: done }), [KAI]),
    [],
    "a finished side is no longer on offer",
  );
});

// ── A route gate's side, end to end ──

test("a gate notes his side in the read's write, once; Read writes it with no call; it plays as his own scene", async () => {
  const t = await storyWorld({
    runKey: "r-hisside-aaaaaa",
    replies: router(),
    lis: { [KAI]: { points: levelFloor(3) } },
  });
  const { key, reads } = await playRoute(t);
  const gate = reads.at(-1)!.body;
  assert.deepEqual(gate.stageUp, { li: KAI, stage: 2 });
  assert.equal(gate.hisSide, KAI, "the read says his side waits");
  assert.ok(
    reads.slice(0, -1).every((read) => !("hisSide" in read.body)),
    "no other node of it is a moment",
  );
  assert.deepEqual((await t.state()).lis[KAI]!.hisSide, [{ arc: 0, ref: `${key}/3`, moment: "stage", stage: 2 }]);
  const again = await t.call("POST", `${beatPath}/read`, { segment: 99 }, { key, i: "3" });
  assert.equal("hisSide" in again.body, false, "a second read notes nothing");

  const offer = { li: KAI, arc: 0, key: SIDE_KAI_0, moment: "stage", stage: 2, title: "The North Light" };
  assert.deepEqual(await sides(t), [{ ...offer, reading: false }]);

  // Read: two taps write one chapter, with no model call.
  const before = t.calls.length;
  const [a, b] = await Promise.all([claim(t, 0), claim(t, 0)]);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual(b.body, a.body);
  assert.equal(t.calls.length, before, "Read calls no model");
  assert.equal(a.body.chapter.key, SIDE_KAI_0);
  assert.equal("hisSide" in a.body.chapter, false, "the moment stays on the server");
  const side = (await readChapter(t.store, t.runId, SIDE_KAI_0))!;
  assert.equal(side.kind, "story");
  assert.equal(side.li, KAI);
  assert.equal(side.title, "The North Light");
  assert.deepEqual(side.tags, ["jealousy"], "the scene's content tags");
  assert.deepEqual(side.hisSide, { arc: 0, ref: `${key}/3`, moment: "stage", stage: 2 });
  assert.deepEqual(side.nodes, [
    {
      i: 0,
      kind: "beat",
      guide: `Kai's side of "The North Light": the same events, told from Kai's point of view.`,
      cast: [KAI, MIR],
      place: "The Lamp Room",
    },
  ]);
  assert.deepEqual(await sides(t), [{ ...offer, reading: true }]);
  assert.equal((await claim(t, 41)).status, 400, "an arc past the last is refused");
  assert.equal((await claim(t, 1)).body.code, "locked", "no moment in that arc");
  assert.equal((await claim(t, 0, "li-nobody-zz99")).status, 404);

  // Written at his stage then (his card's slow burn), though he is at stage 6 now.
  await kaiState(t, { stage: 6 });
  const starlight = (await t.state()).wallet.starlight;
  const lisBefore = (await t.state()).lis;
  const params = { key: SIDE_KAI_0, i: "0" };
  const served = await t.call("POST", beatPath, {}, params);
  assert.equal(served.status, 200, JSON.stringify(served.body));
  assert.deepEqual(served.body.beat.choices, [], "his side offers no choice");
  assert.deepEqual(
    served.body.beat.segments.filter((segment: { thought?: boolean }) => segment.thought).length,
    2,
    "his thoughts, as many as the scene needs, at any stage",
  );
  const prompt = t.calls.find((call) => isSidePrompt(call.messages))!.messages;
  const instructions = prompt[1]!.content;
  assert.ok(instructions.includes(NO_CHOICES_SENTENCE), "choices stay off");
  assert.ok(!/PLAYER CHOICES|CHOICE EFFECTS/u.test(instructions));
  assert.ok(!instructions.includes("They are a person, not a camera"), "no protagonist thoughts");
  assert.ok(instructions.includes("by Kai only"));
  assert.deepEqual(
    prompt.map((message) => !!message.cacheBreakpoint),
    [true, ...prompt.slice(1).map(() => false)],
    "only the story context is a cache write",
  );
  const turn = user(prompt);
  assert.ok(
    turn.includes(`THE SCENE AS THE PROTAGONIST LIVED IT ("The North Light"):\n[The Lamp Room]\nThe lamp hisses.`),
  );
  assert.ok(turn.indexOf("THE SCENE AS THE PROTAGONIST LIVED IT") < turn.indexOf("KAI'S SIDE"));
  assert.ok(turn.includes("Kai's side of it: the same events, told again from Kai's point of view"));
  assert.ok(turn.includes("Slow burn: Kai never says what they feel"), "his card is at the moment's stage");
  assert.ok(!(system(prompt) + turn).includes("Kai has chosen the protagonist"), "never his stage now");
  assert.ok(turn.includes("- Thought lines: Kai only."));
  assert.ok(!turn.includes("big choice"), "no closing decision");
  assert.ok(!system(prompt).includes("THE SCENE AS THE PROTAGONIST LIVED IT"), "the scene is never cached");
  // No content wording of its own: what the content contract says, and nothing more.
  const gatePrompt = t.calls.find((call) => /Narrate node 4 of 4/u.test(user(call.messages)))!.messages;
  const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;
  for (const word of [/consent/giu, /graphic/giu, /\bSFW\b/gu, /fade/giu]) {
    assert.equal(count(turn, word), count(user(gatePrompt), word), String(word));
    assert.equal(count(instructions, word), count(gatePrompt[1]!.content, word), String(word));
  }

  const read = await t.call("POST", `${beatPath}/read`, { segment: 99 }, params);
  assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }], "its beat pays, nothing else");
  assert.equal(read.body.chapterDone, true);
  const after = await t.state();
  assert.equal(after.wallet.starlight, starlight + 30);
  assert.deepEqual(after.lis, lisBefore, "no affection, trust, tension or stage moves");
  assert.deepEqual(await sides(t), [], "read, it leaves Routes; it stays in the chapter list");
  assert.ok(
    (await t.call("GET", "/runs/:run/story")).body.chapters.some((entry: { key: string }) => entry.key === SIDE_KAI_0),
  );

  // His own memory source, named as the chapter's other side; never a line of Who said what?.
  const source = (await readMemorySources(t.store, t.runId)).find((entry) => entry.id === SIDE_KAI_0)!;
  assert.equal(source.kind, "chapter");
  assert.deepEqual(source.audience, [KAI]);
  assert.match(
    source.title,
    /^Kai's side of "The North Light" \(the same events, told again from Kai's point of view; private: Kai's thoughts/u,
  );
  assert.ok(source.content.includes(SIDE_LINE));
  const game = await whoSaidWhat(t.deps, t.runId);
  assert.ok(!game.lines.some((line) => line.text.includes("SIDE-LINE")), "his side's lines are never asked");

  // His side of this arc is written: the next gate in it notes nothing.
  await kaiState(t, { stage: 2, points: levelFloor(5) });
  const next = await playRoute(t);
  assert.deepEqual(next.reads.at(-1)!.body.stageUp, { li: KAI, stage: 3 });
  assert.equal("hisSide" in next.reads.at(-1)!.body, false, "one side per arc");
  assert.deepEqual((await t.state()).lis[KAI]!.hisSide, [{ arc: 0, ref: `${key}/3`, moment: "stage", stage: 2 }]);
});

test("his side is part of the chapter it follows: the next chapter's prompts get both in full, its timeline entry left out", async () => {
  const t = await storyWorld({
    runKey: "r-hisside-bbbbbb",
    replies: router(),
    lis: { [KAI]: { points: levelFloor(3) } },
  });
  const { key } = await playRoute(t);
  const recall = (options: Parameters<typeof recallText>[2]) => recallText(t.deps, t.runId, options);
  const narration = { job: "narration" as const, cast: [KAI] };
  // Unread, it goes nowhere.
  assert.ok(!(await recall({ ...narration, continues: KAI })).text.includes("other side"));

  assert.equal((await claim(t, 0)).status, 200);
  const params = { key: SIDE_KAI_0, i: "0" };
  assert.equal((await t.call("POST", beatPath, {}, params)).status, 200);
  // His side's own scene knows what he may know (his reader), never what the cast may.
  const recalled: unknown[] = [];
  t.deps.memory = {
    async recall(options) {
      recalled.push(options);
      return {
        status: { phase: "ready", retryable: false },
        lagging: false,
        overview: "",
        details: [],
        recalls: [],
        maxContext: null,
        text: "",
      } as never;
    },
    maintain: async () => true,
  };
  assert.equal((await t.call("POST", beatPath, { rewrite: true }, params)).status, 200);
  assert.equal((recalled.at(-1) as { reader?: string }).reader, KAI);
  t.deps.memory = undefined;
  assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, params)).status, 200);

  // The timeline as saved covers both; while they go in full, neither entry goes in beside them.
  const entry = (id: string, text: string) => ({ key: JSON.stringify(["chapter", id]), title: id, text });
  await saveStoryMemory(t.store, t.runId, {
    entries: [entry(key, "ROUTE-SUMMARY"), entry(SIDE_KAI_0, "SIDE-SUMMARY")],
  });
  for (const options of [{ continues: KAI }, {}]) {
    const { text } = await recall({ ...narration, ...options });
    const previous = text.indexOf("# Previous chapter in full:");
    const other = text.indexOf(`# The previous chapter's other side, in full: Kai's side of "The North Light"`);
    assert.ok(previous >= 0 && other > previous, JSON.stringify(options));
    assert.ok(text.indexOf(SIDE_LINE) > other, "his side in full, right after the chapter");
    assert.ok(!text.includes("ROUTE-SUMMARY") && !text.includes("SIDE-SUMMARY"), "neither entry beside them");
  }
  // His next chapter's scenes carry it in their cached story context, never with their own recalls.
  const cached = await recall({ ...narration, cached: { li: KAI }, continues: KAI });
  assert.ok(cached.text.includes(SIDE_LINE));
  assert.ok(!(cached.recalls?.text ?? "").includes(SIDE_LINE));

  // Once a newer chapter of his storyline is the previous one, his side goes by the timeline as his own chapter.
  await kaiState(t, { points: levelFloor(5) });
  await playRoute(t);
  const later = (await recall({ ...narration, continues: KAI })).text;
  assert.ok(!later.includes("other side, in full") && !later.includes(SIDE_LINE));
  assert.ok(later.includes("SIDE-SUMMARY"), "by its entry in the timeline");
});

test("a Closer's Opened up notes his side at its climax; Routes offers it once the chapter ends; the next plan gets it", async () => {
  const t = await storyWorld({ runKey: "r-hisside-cccccc", replies: router() });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  const node = (i: number) => ({ key: "main-1", i: String(i) });
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await t.call("POST", beatPath, {}, node(i))).status, 200);
    assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(i))).status, 200);
  }
  await t.settle();
  assert.equal((await t.call("POST", beatPath, {}, node(5))).status, 200);
  for (const round of [1, 2, 3]) {
    assert.equal((await t.call("POST", `${beatPath}/stance`, { round, stance: "reassure" }, node(5))).status, 200);
  }
  const climaxRead = await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(5));
  assert.equal(climaxRead.body.hisSide, KAI);
  const arc = (await readChapter(t.store, t.runId, "main-1"))!.arc!;
  assert.equal(arc, 1);
  assert.deepEqual((await t.state()).lis[KAI]!.hisSide, [{ arc, ref: "main-1/5", moment: "opened", stage: 1 }]);
  assert.deepEqual(await sides(t), [], "not before the chapter's last scene is read");
  assert.equal((await claim(t, arc)).body.code, "locked");
  assert.equal((await t.call("POST", beatPath, {}, node(6))).status, 200);
  assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(6))).body.chapterDone, true);
  const key = `side-${KAI}-${arc}`;
  assert.deepEqual(await sides(t), [
    { li: KAI, arc, key, moment: "opened", stage: 1, title: "The Dark Quay", reading: false },
  ]);

  assert.equal((await claim(t, arc)).status, 200);
  const side = { key, i: "0" };
  assert.equal((await t.call("POST", beatPath, {}, side)).status, 200);
  const prompt = t.calls.find((call) => isSidePrompt(call.messages))!.messages;
  assert.ok(user(prompt).includes("ENDING-OPENED: I've never told anyone that."), "the climax as it was played");
  assert.ok(user(prompt).includes("[Canonical player answer by Ines, round 1 of the closer: reassure"));
  assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, side)).status, 200);

  // The next chapter is built with chapter 1 and his side of it, in full.
  const plans = () => t.calls.filter((call) => system(call.messages).includes("chapter planner"));
  const planned = plans().length;
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: MIR })).status, 200);
  const plan = plans()[planned]!.messages;
  const all = plan.map((message) => message.content).join("\n");
  assert.ok(all.includes("# Previous chapter in full: The Dark Quay"));
  assert.ok(all.includes(`# The previous chapter's other side, in full: Kai's side of "The Dark Quay"`));
  assert.ok(all.indexOf(SIDE_LINE) > all.indexOf("# Previous chapter in full: The Dark Quay"));
  // Its scenes too: in the story context every call of the chapter shares (the cached part), whoever is in the node.
  assert.equal((await t.call("POST", beatPath, {}, { key: "main-2", i: "0" })).status, 200);
  const scene = t.calls.filter((call) => /Narrate node 1 of/u.test(user(call.messages))).at(-1)!.messages;
  assert.ok(scene[0]!.content.includes(SIDE_LINE) && scene[0]!.cacheBreakpoint, "in the cached story context");
  assert.ok(!user(scene).includes(SIDE_LINE), "never with the call's own recalls");
});

test("his side's reply: only his thoughts, at any stage, and no choice; other chapters' prompts are unchanged", () => {
  const units = CAST.map((li) => normalizeUnit({ id: li.id, name: li.name, source: "archetype", bible: bible() })!);
  const node = { i: 0, kind: "beat" as const, guide: "g", cast: [KAI, MIR] };
  const context: BeatContext = {
    node,
    units,
    state: normalizeState({ lis: { [KAI]: { stage: 1 }, [MIR]: { stage: 3 } } }),
    last: true,
    pov: KAI,
  };
  const thought = (speaker: string) => ({ speaker, text: `${speaker || "nobody"} thinks.`, thought: true });
  const reply = (segments: unknown[]) =>
    beatReply({ segments: [{ speaker: "", text: "The lamp." }, ...segments] }) as BeatReply;
  const kept = normalizeBeatReply(reply([thought("Kai"), thought("Kai"), thought("Kai")]), context);
  assert.ok(typeof kept !== "string", String(kept));
  assert.equal(kept.segments.filter((segment) => segment.thought).length, 3, "at stage 1, three of his thoughts");
  for (const [speaker, who] of [
    ["Ines", "the protagonist"],
    ["", "a thought with no speaker (the protagonist's)"],
    ["Mireille", "another love interest, far enough along elsewhere"],
  ]) {
    assert.match(
      String(normalizeBeatReply(reply([thought(speaker!)]), context)),
      /only Kai thinks in this scene/u,
      who,
    );
  }
  const withChoice = normalizeBeatReply(sideReply() as BeatReply, context);
  assert.ok(typeof withChoice !== "string", String(withChoice));
  assert.deepEqual(withChoice.choices, [], "a choice in the reply is dropped");

  // Any other chapter's P6 is the same with or without a scene handed to it.
  const input = {
    world: normalizeWorld({ language: "English" }),
    player: normalizePlayer({ name: "Ines" }),
    units,
    state: normalizeState({ lis: { [KAI]: { stage: 3 }, [MIR]: {} } }),
    chapter: normalizeChapter({
      key: "main-2",
      kind: "main",
      number: 2,
      lead: KAI,
      title: "T",
      nodes: [node, { ...node, i: 1 }],
    })!,
    node,
    storySoFar: [],
    memory: "MEMORY",
  };
  assert.deepEqual(beatMessages({ ...input, hisSide: "A SCENE" }), beatMessages(input));
  const story = { ...input, chapter: { ...input.chapter, kind: "story" as const, li: KAI, number: undefined } };
  assert.deepEqual(beatMessages({ ...story, hisSide: "A SCENE" }), beatMessages(story), "a Character Story too");
  const view = toChapterView({ ...input.chapter, hisSide: { arc: 0, ref: "main-1/0", moment: "truth", stage: 1 } });
  assert.equal("hisSide" in view, false);
});
