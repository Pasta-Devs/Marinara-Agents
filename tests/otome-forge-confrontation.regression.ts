// Otome Forge's Confrontation (M2b): P12's reply is normalized list by list with P6's rules; composure starts at 2 and
// moves by each picked stance within 0–4, so 0 is the truth (trust +1), 4 a walkout (a major grievance, or a rupture at
// trust −2 or below) and anything else a standoff (tension +1); Reveal records her disclosure; every stance is first
// play only and lands once, with the clamps; the view never shows composure, an answer not taken or an ending not
// reached; nothing is written after the confrontation before it ends; its canon holds the rounds played and the
// ending; an Ease off cuts it with the marker and no ending, while one after the ending keeps its canon and the node
// after it (written once); a love interest thinks at most once on any path through it; P12 carries the boundary and
// the scene contract.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type {
  ConfrontationView,
  LiState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  composureAfter,
  endingFor,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/arcs.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  beatId,
  runDocTarget,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { defaultLiState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { segmentLists } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import {
  EASE_OFF_MARKER,
  canonicalSegments,
  readBeat,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import { normalizeConfrontationReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/confrontation.ts";
import type { ConfrontationReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import {
  KAI,
  beatReply,
  confrontationReply,
  isConfrontationPrompt,
  json,
  planReply,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

type World = Awaited<ReturnType<typeof storyWorld>>;
type Messages = CapabilityLanguageModelMessage[];
type Stance = "press" | "hold" | "yield" | "reveal";

const system = (messages: Messages) => messages[0]!.content;
const beatPath = "/runs/:run/chapters/:key/beats/:i";
const node = (i: number) => ({ key: "main-1", i: String(i) });
const labels = (t: World, label: string) =>
  t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === label).length;

/** A main chapter planned with Kai leading; the confrontation (node 6 of 7) is answered by `game()`. */
async function fightWorld(
  runKey: string,
  {
    kai = {},
    game = () => confrontationReply(),
    content,
  }: { kai?: Partial<LiState>; game?: () => Record<string, unknown>; content?: ReturnType<typeof defaultContent> } = {},
) {
  const replies = Array.from({ length: 60 }, () => (messages: Messages) => {
    if (system(messages).includes("chapter planner")) return json(planReply());
    if (isConfrontationPrompt(messages)) return json(game());
    return json(beatReply());
  });
  const t = await storyWorld({ runKey, replies, lis: { [KAI]: kai }, ...(content ? { content } : {}) });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await t.call("POST", beatPath, {}, node(i))).status, 200);
    assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(i))).status, 200);
  }
  await t.settle();
  const served = await t.call("POST", beatPath, {}, node(5));
  assert.equal(served.status, 200, JSON.stringify(served.body));
  return { ...t, served };
}

const stance = (t: World, round: number, picked: Stance) =>
  t.call("POST", `${beatPath}/stance`, { round, stance: picked }, node(5));

async function play(t: World, stances: Stance[]) {
  const results = [];
  for (const [k, picked] of stances.entries()) {
    const result = await stance(t, k + 1, picked);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    results.push(result);
  }
  return results;
}

test("composure starts at 2 and moves within 0–4; 0 is the truth, 4 a walkout, anything else a standoff", () => {
  assert.equal(composureAfter([]), 2);
  assert.equal(composureAfter([-1, -1, -1]), 0, "clamped at 0");
  assert.equal(composureAfter([1, 1, 1]), 4, "clamped at 4");
  assert.equal(composureAfter([-1, -1, 1]), 1);
  assert.equal(composureAfter([1, 1, -1]), 3);
  assert.equal(composureAfter([-1, -1, -1, 1]), 1, "a clamp at 0 is not remembered as a debt");
  assert.deepEqual([0, 1, 2, 3, 4].map(endingFor), ["truth", "standoff", "standoff", "standoff", "walkout"]);
});

test("P12's reply is normalized list by list with P6's rules", () => {
  const state = { lis: { [KAI]: defaultLiState() } } as never;
  const lists = segmentLists({
    node: { i: 5, kind: "confrontation", guide: "", cast: [KAI] },
    units: [{ id: KAI, name: "Kai" }],
    state,
    last: false,
  });
  const shape = { li: KAI, node: { place: "The Lamp Room" }, cgOpen: false };
  const normalize = (reply: Record<string, unknown>) =>
    normalizeConfrontationReply(reply as unknown as ConfrontationReply, shape, lists);
  const good = normalize(confrontationReply());
  assert.ok(typeof good === "object");
  assert.equal(good.confrontation.rounds.length, 3);
  assert.deepEqual(good.confrontation.picks, []);
  assert.equal(good.musicMood, "angst");
  assert.equal(good.segments[0]!.place, "The Lamp Room");
  assert.equal(good.confrontation.rounds[0]!.his[0]!.place, "The Lamp Room", "later lists continue in its place");
  assert.equal(good.confrontation.rounds[2]!.options.reveal.composure, -1);
  assert.equal(good.confrontation.rounds[0]!.options.press.label, "press 1.", "labels get their full stop");
  assert.deepEqual(good.places, [{ name: "The Lamp Room", tags: "lighthouse interior, great lens, no humans" }]);
  // A place a round or an ending moves to is recorded with the opening's, so it is painted too.
  const moved = normalize({
    ...confrontationReply(),
    places: [...confrontationReply().places, { name: "The Gallery Stair", tags: "spiral stair, rain, no humans" }],
    endings: {
      ...confrontationReply().endings,
      walkout: [{ speaker: "", text: "He goes down the stair.", place: "The Gallery Stair" }],
    },
  });
  assert.ok(typeof moved === "object");
  assert.deepEqual(
    moved.places.map((place) => place.name),
    ["The Lamp Room", "The Gallery Stair"],
  );
  assert.equal(moved.confrontation.endings.walkout[0]!.place, "The Gallery Stair");
  // At most four places in the whole game, as in an ordinary beat: a fifth gets the repair turn, so no line is set in
  // a place the beat does not record (and paint).
  const placed = (name: string) => ({ speaker: "", text: `In ${name}.`, place: name });
  const five = ["A", "B", "C", "D", "E"].map((letter) => `Place ${letter}`);
  const spread = (names: string[]) => {
    const reply = confrontationReply({
      places: names.map((name) => ({ name, tags: `${name.toLowerCase()}, no humans` })),
    });
    reply.opening = names.slice(0, 4).map(placed);
    reply.rounds[0].lines = [placed(names[names.length - 1]!), ...reply.rounds[0].lines];
    reply.endings.truth = [placed(names[1]!)];
    return reply;
  };
  assert.match(String(normalize(spread(five))), /^rounds\[0\]\.lines: the confrontation uses more than 4 places$/);
  const four = normalize(spread(five.slice(0, 4)));
  assert.ok(typeof four === "object", String(four));
  const recorded = new Set(four.places.map((place) => place.name));
  const every = [
    four.segments,
    ...four.confrontation.rounds.flatMap((round) => [
      round.his,
      ...Object.values(round.options).map((option) => option.segments),
    ]),
    ...Object.values(four.confrontation.endings),
  ];
  assert.deepEqual([...recorded], five.slice(0, 4));
  assert.ok(every.flat().every((segment) => !segment.place || recorded.has(segment.place)));
  // The reply's voices reach every list: a minor speaker in the opening, a round, an answer and an ending is voiced
  // with the gender the writer gave.
  const keeper = { speaker: "Old Keeper", text: "The lamp is mine to tend." };
  const voiced = confrontationReply({ voices: { "Old Keeper": "male" } });
  voiced.opening = [...voiced.opening, keeper];
  voiced.rounds[0].lines = [...voiced.rounds[0].lines, keeper];
  voiced.rounds[0].options.press.segments = [keeper];
  voiced.endings.truth = [...voiced.endings.truth, keeper];
  const genders = normalize(voiced);
  assert.ok(typeof genders === "object", String(genders));
  const keeperLines = [
    genders.segments,
    genders.confrontation.rounds[0]!.his,
    genders.confrontation.rounds[0]!.options.press.segments,
    genders.confrontation.endings.truth,
  ].map((segments) => segments.find((segment) => segment.speaker === "Old Keeper"));
  assert.deepEqual(
    keeperLines.map((segment) => segment?.gender),
    ["male", "male", "male", "male"],
  );

  const base = confrontationReply();
  const rounds = base.rounds as Array<Record<string, any>>;
  const legacy = normalize({ ...base, rounds: rounds.map(({ lines, ...round }) => ({ ...round, his: lines })) });
  assert.equal(typeof legacy, "object", "a round's lines under `his` are read too");
  const withRound = (k: number, change: (round: Record<string, any>) => Record<string, any>) => ({
    ...base,
    rounds: rounds.map((round, index) => (index === k ? change(structuredClone(round)) : round)),
  });
  assert.match(String(normalize({ ...base, rounds: rounds.slice(0, 2) })), /exactly 3/);
  assert.match(
    String(normalize(withRound(1, (round) => ({ ...round, options: { ...round.options, yield: undefined } })))),
    /rounds\[1\]\.options\.yield needs a label/,
  );
  assert.match(
    String(
      normalize(
        withRound(0, (round) => {
          round.options.hold.composure = 2;
          return round;
        }),
      ),
    ),
    /composure must be -1, 0 or 1/,
  );
  assert.match(
    String(
      normalize(
        withRound(2, (round) => {
          round.options.press.segments = Array.from({ length: 4 }, () => ({ speaker: "Kai", text: "No." }));
          return round;
        }),
      ),
    ),
    /more than 3 segments/,
  );
  assert.match(String(normalize({ ...base, endings: { truth: base.endings.truth } })), /endings\.walkout/);
  assert.match(String(normalize({ ...base, grievance: {} })), /grievance\.text is required/);
  assert.match(String(normalize({ ...base, disclosure: "" })), /disclosure is required/);
  assert.match(
    String(
      normalize(
        withRound(0, (round) => ({ ...round, lines: [{ speaker: "Kai", text: "...don't go.", thought: true }] })),
      ),
    ),
    /still behind their mask/,
    "a love interest's thought before stage 2 gets the repair turn here too",
  );
});

test("the view hides composure, the answers not taken and the endings; nothing is written past it before it ends", async () => {
  const t = await fightWorld("r-view-aaaaaa");
  const view = t.served.body.confrontation as ConfrontationView;
  assert.equal(t.served.body.beat.kind, "confrontation");
  assert.equal(t.served.body.beat.confrontation, undefined, "the stored game never reaches the client");
  assert.equal(view.li, KAI);
  assert.equal(view.key, "main-1");
  assert.equal(view.i, 5);
  assert.equal(view.opening[0]!.text, "OPENING: the lamp turns.");
  assert.equal(view.rounds.length, 1, "only the round being played");
  assert.equal(view.ending, undefined);
  const text = JSON.stringify(view);
  for (const hidden of ["composure", "ANSWER-", "ENDING-", "She called him a liar", "the bell that night"]) {
    assert.ok(!text.includes(hidden), `the view never shows ${hidden}`);
  }
  assert.deepEqual(Object.keys(view.rounds[0]!.options), ["press", "hold", "yield", "reveal"]);

  // P12: one call, with the boundary, the scene contract and his card, never his hidden truth.
  const [fight] = t.calls.filter((call) => isConfrontationPrompt(call.messages));
  assert.equal(labels(t, "confrontation/main-1/5"), 1);
  assert.ok(system(fight!.messages).includes(forgeKnowledgeBoundary));
  assert.match(system(fight!.messages), /CONTENT CONTRACT/);
  assert.match(system(fight!.messages), /follow naturally from ANY of the four stances/);
  assert.doesNotMatch(system(fight!.messages), /refuse Kai outright/, "the refusal rule is Dark romance's");
  assert.ok(!fight!.messages.at(-1)!.content.includes("HIDDEN-TRUTH"));

  // Nothing is written after it before it ends: no lookahead, and the next node waits.
  await t.settle();
  assert.equal(labels(t, "beat/main-1/6"), 0, "no lookahead past an unfinished confrontation");
  const early = await t.call("POST", beatPath, {}, node(6));
  assert.equal(early.status, 409);
  assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(5))).body.grants.length, 0);
  assert.equal((await stance(t, 2, "hold")).status, 409, "rounds are played in order");

  const [first] = await play(t, ["hold"]);
  assert.equal(first!.body.round.round, 1);
  assert.equal(first!.body.round.picked, "hold");
  assert.equal(first!.body.round.options.hold.segments[0].text, "ANSWER-hold-1");
  assert.equal(first!.body.round.options.press.segments, undefined);
  assert.equal(first!.body.next.round, 2);
  assert.equal(first!.body.confrontation.rounds.length, 2);
  assert.ok(!JSON.stringify(first!.body).includes("composure"));
  // The same stance again returns what it did; another one for that round is refused.
  const before = await t.state();
  const replay = await stance(t, 1, "hold");
  assert.deepEqual(replay.body.round, first!.body.round);
  assert.deepEqual(await t.state(), before, "a replay changes nothing");
  const other = await stance(t, 1, "press");
  assert.equal(other.status, 409);
  assert.equal(other.body.code, "locked");
  // A rewrite is gone once a stance is taken.
  assert.equal((await t.call("POST", beatPath, { rewrite: true }, node(5))).status, 409);
});

test("the truth earns trust; Reveal records her disclosure once; the ending is canon for what follows", async () => {
  const t = await fightWorld("r-true-aaaaaa");
  const results = await play(t, ["reveal", "yield", "yield"]);
  assert.equal(results[0]!.body.remembered, true, "a Reveal is remembered");
  assert.deepEqual(results[0]!.body.rememberedBy, [KAI]);
  assert.deepEqual(results[2]!.body.ending, {
    kind: "truth",
    segments: [{ speaker: "Kai", text: "ENDING-TRUTH: I let it go dark.", expression: "hurt", place: "The Lamp Room" }],
  });
  assert.equal(results[2]!.body.next, undefined);
  const state = await t.state();
  assert.equal(state.lis[KAI]!.trust, 1, "the truth: trust +1");
  assert.equal(state.lis[KAI]!.tension, 0);
  assert.deepEqual(
    state.lis[KAI]!.disclosures.map(({ text, ref }) => ({ text, ref })),
    [{ text: "Ines said she was the one who rang the bell that night.", ref: "main-1/5" }],
  );
  assert.ok(state.chapters["main-1"]!.applied.includes("5/stance-1"));
  assert.ok(state.chapters["main-1"]!.applied.includes("5/confrontation"));
  // Reveal in every round still tells him once: the same words never crowd out what she told him before.
  const told = await fightWorld("r-tell-aaaaaa");
  await play(told, ["reveal", "reveal", "reveal"]);
  assert.equal((await told.state()).lis[KAI]!.disclosures.length, 1);
  // Replaying every round changes nothing.
  for (const [k, picked] of (["reveal", "yield", "yield"] as const).entries()) await stance(t, k + 1, picked);
  assert.deepEqual(await t.state(), state);

  // Its canon: the rounds played and the ending; the lookahead writes the next node from it.
  const beat = (await readBeat(t.store, t.runId, "main-1", 5))!;
  const canon = canonicalSegments(beat, "Ines")!.map((segment) => segment.text);
  assert.ok(canon.includes("HIS-1: You don't know what you're asking."));
  assert.ok(canon.some((line) => line.includes("round 1 of the confrontation: reveal")));
  assert.ok(canon.includes("REVEAL-1: Tell me the truth."));
  assert.ok(canon.includes("ANSWER-yield-3"));
  assert.equal(canon.at(-1), "ENDING-TRUTH: I let it go dark.");
  assert.ok(!canon.some((line) => line.includes("ANSWER-press")), "no stance not taken is canon");
  await t.settle();
  assert.equal(labels(t, "beat/main-1/6"), 1, "the ending queued the next node");
  const next = t.calls.filter((call) => /Narrate node 7 of 7/.test(call.messages.at(-1)!.content)).at(-1)!;
  assert.match(next.messages.at(-1)!.content, /ENDING-TRUTH/);
  // Read to its end (its mainline: two opening lines, one of his per round, the ending: index 5), it pays once.
  assert.deepEqual((await t.call("POST", `${beatPath}/read`, { segment: 4 }, node(5))).body.grants, []);
  const read = await t.call("POST", `${beatPath}/read`, { segment: 5 }, node(5));
  assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }]);
  assert.equal((await readBeat(t.store, t.runId, "main-1", 5))!.readThrough, 5);
  assert.deepEqual((await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(5))).body.grants, []);
});

test("a walkout opens a major grievance, or a rupture at low trust; a standoff charges tension within the caps", async () => {
  const walkout = await fightWorld("r-walk-aaaaaa", { kai: { points: 945, stage: 2 } });
  assert.equal((await walkout.state()).lis[KAI]!.points, 945, "reading an argument never costs affection");
  const [, , last] = await play(walkout, ["press", "press", "hold"]);
  assert.equal(last!.body.ending.kind, "walkout", "2 → 3 → 4 → 4");
  let kai = (await walkout.state()).lis[KAI]!;
  assert.deepEqual(
    kai.grievances.map(({ by, severity, status, opened }) => ({ by, severity, status, opened })),
    [{ by: "li", severity: "major", status: "open", opened: "main-1/5" }],
  );
  assert.equal(kai.rupture, null);
  assert.deepEqual([kai.points, kai.stage], [930, 2], "the walkout costs 15 points without losing a level or stage");
  const afterWalkout = await walkout.state();
  await play(walkout, ["press", "press", "hold"]);
  assert.deepEqual(await walkout.state(), afterWalkout, "replaying the canonical walkout never costs points again");
  const read = await walkout.call("POST", `${beatPath}/read`, { segment: 99 }, node(5));
  assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }]);
  assert.equal((await walkout.state()).lis[KAI]!.points, 930, "the argument's read keeps its normal reward only");

  const cold = await fightWorld("r-cold-aaaaaa", { kai: { trust: -2, points: 900, stage: 2 } });
  await play(cold, ["press", "press", "press"]);
  kai = (await cold.state()).lis[KAI]!;
  assert.equal(kai.grievances[0]!.severity, "rupture");
  assert.equal(kai.rupture?.grievanceId, kai.grievances[0]!.id);
  assert.equal(kai.stage, 2, "nothing unlocked is taken back");
  assert.equal(kai.points, 900, "the reached level's floor survives a rupture");
  const story = await cold.call("GET", "/runs/:run/story");
  assert.equal(story.body.routes[0].next.blockedBy, "rupture");
  assert.equal(story.body.repairs[0].li, KAI);

  const standoff = await fightWorld("r-stnd-aaaaaa", { kai: { points: 945 } });
  await play(standoff, ["hold", "hold", "hold"]);
  assert.equal((await standoff.state()).lis[KAI]!.tension, 1);
  assert.equal((await standoff.state()).lis[KAI]!.points, 945, "tension alone never costs affection");
  // Tension already moved twice this chapter: the chapter's cap holds it.
  const capped = await fightWorld("r-capd-aaaaaa", {
    kai: { tension: 2, chapterDelta: { "main-1": { trust: 0, tension: 2 } } },
  });
  await play(capped, ["hold", "hold", "hold"]);
  assert.equal((await capped.state()).lis[KAI]!.tension, 2);
  // Trust at its top stays there.
  const top = await fightWorld("r-topt-aaaaaa", { kai: { trust: 3 } });
  await play(top, ["yield", "yield", "yield"]);
  assert.equal((await top.state()).lis[KAI]!.trust, 3);
});

test("stances whose effects never landed land when the beat is read; an Ease off keeps what was played", async () => {
  const t = await fightWorld("r-lost-aaaaaa");
  await play(t, ["reveal", "yield"]);
  // The last stance saved on the beat by a request that stopped before its state write.
  await t.store.updateDoc(runDocTarget("beat", beatId(t.runId, "main-1", 5)), normalizeBeat, (beat) =>
    beat
      ? { ...beat, confrontation: { ...beat.confrontation!, picks: ["reveal", "yield", "yield"], ending: "truth" } }
      : beat,
  );
  assert.equal((await t.state()).lis[KAI]!.trust, 0);
  const read = await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(5));
  assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }]);
  const state = await t.state();
  assert.equal(state.lis[KAI]!.trust, 1, "the ending's trust landed with the read");
  assert.equal(state.lis[KAI]!.disclosures.length, 1, "the earlier Reveal is not recorded twice");
  const replay = await stance(t, 3, "yield");
  assert.equal(replay.status, 200);
  assert.deepEqual(await t.state(), state, "and never again");

  const eased = await fightWorld("r-ease-aaaaaa");
  await play(eased, ["hold"]);
  const off = await eased.call("POST", `${beatPath}/ease-off`, { segment: 3 }, node(5));
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.deepEqual(off.body.grants, [{ source: "beat", starlight: 30 }]);
  assert.equal((await stance(eased, 2, "hold")).status, 409, "no stance after an Ease off");
  const beat = (await readBeat(eased.store, eased.runId, "main-1", 5))!;
  const canon = canonicalSegments(beat, "Ines")!.map((segment) => segment.text);
  assert.ok(canon.includes("ANSWER-hold-1"), "the round played stays canon");
  assert.equal(canon.at(-1), EASE_OFF_MARKER);
  const kai = (await eased.state()).lis[KAI]!;
  assert.deepEqual([kai.trust, kai.tension, kai.grievances.length], [0, 0, 0], "no ending, no ending effects");
  assert.equal((eased.served.body.confrontation as ConfrontationView).rounds.length, 1);
});

test("in Dark romance her stances include refusing him", async () => {
  const content = { ...defaultContent(), darkness: "dark" as const };
  const t = await fightWorld("r-dark-aaaaaa", { content });
  const [fight] = t.calls.filter((call) => isConfrontationPrompt(call.messages));
  assert.match(system(fight!.messages), /at least one stance lets the protagonist refuse Kai outright/);
});

test("a love interest thinks at most once on any path through a Confrontation", async () => {
  const state = { lis: { [KAI]: { ...defaultLiState(), stage: 3 } } } as never;
  const lists = segmentLists({
    node: { i: 5, kind: "confrontation", guide: "", cast: [KAI] },
    units: [{ id: KAI, name: "Kai" }],
    state,
    last: false,
  });
  const normalize = (reply: Record<string, unknown>) =>
    normalizeConfrontationReply(
      reply as unknown as ConfrontationReply,
      { li: KAI, node: { place: "The Lamp Room" }, cgOpen: false },
      lists,
    );
  const thought = (text: string) => ({ speaker: "Kai", text, thought: true });
  const base = confrontationReply();
  const rounds = base.rounds as Array<Record<string, any>>;
  /** The reply with a thought of his added to round `k`'s lines, or to the answers of `stances` in round `k`. */
  const thinking = (k: number, stances: Stance[] | "lines", reply: Record<string, any> = base) => ({
    ...reply,
    rounds: (reply.rounds as Array<Record<string, any>>).map((round, index) => {
      if (index !== k) return round;
      const next = structuredClone(round);
      if (stances === "lines") next.lines.push(thought(`LINES-${k}`));
      for (const stance of stances === "lines" ? [] : stances) next.options[stance].segments.push(thought(stance));
      return next;
    }),
  });
  const ending = (reply: Record<string, any>, kinds: string[]) => ({
    ...reply,
    endings: Object.fromEntries(
      Object.entries(reply.endings as Record<string, unknown[]>).map(([kind, list]) => [
        kind,
        kinds.includes(kind) ? [...list, thought(`END-${kind}`)] : list,
      ]),
    ),
  });
  const opening = { ...base, opening: [...(base.opening as unknown[]), thought("OPENING")] };
  const once = /Kai may have at most one thought line in this scene/;

  // One on every path is fine: in the opening alone, in every answer of one round (only one is taken), in each ending.
  for (const [name, reply] of [
    ["the opening", opening],
    ["round 2's lines", thinking(1, "lines")],
    ["every answer of round 2", thinking(1, ["press", "hold", "yield", "reveal"])],
    ["every ending", ending(base, ["truth", "walkout", "standoff"])],
  ] as const) {
    assert.equal(typeof normalize(reply), "object", `one thought, in ${name}`);
  }
  // Two on one path are not, wherever the second falls.
  for (const [name, reply] of [
    ["the opening and round 3's lines", thinking(2, "lines", opening)],
    ["round 1's press answer and round 3's hold answer", thinking(2, ["hold"], thinking(0, ["press"]))],
    ["round 1's lines and its yield answer", thinking(0, ["yield"], thinking(0, "lines"))],
    ["the opening and the walkout", ending(opening, ["walkout"])],
  ] as const) {
    assert.match(String(normalize(reply)), once, `two thoughts, in ${name}`);
  }
  assert.equal(rounds.length, 3);

  // P12 says so.
  const t = await fightWorld("r-thnk-aaaaaa", { kai: { stage: 3 } });
  const [fight] = t.calls.filter((call) => isConfrontationPrompt(call.messages));
  assert.match(system(fight!.messages), /at most ONE thought line in the whole confrontation, on any path/);
});

test("an Ease off after a Confrontation's ending keeps its canon and the node after it, written once", async () => {
  const narration = (t: World) => labels(t, "beat/main-1/6");
  // The lookahead the ending queued was written before the Ease off.
  const t = await fightWorld("r-ease2-aaaaaa");
  await play(t, ["hold", "hold", "hold"]);
  await t.settle();
  assert.ok(await readBeat(t.store, t.runId, "main-1", 6), "the ending queued the next node");
  assert.equal(narration(t), 1);
  const ended = (await readBeat(t.store, t.runId, "main-1", 5))!;
  const off = await t.call("POST", `${beatPath}/ease-off`, { segment: 4 }, node(5));
  assert.equal(off.status, 200, JSON.stringify(off.body));
  const cut = (await readBeat(t.store, t.runId, "main-1", 5))!;
  assert.ok(cut.easedOff, "the Ease off is saved");
  assert.deepEqual(canonicalSegments(cut, "Ines"), canonicalSegments(ended, "Ines"), "its canon is unchanged");
  assert.ok(await readBeat(t.store, t.runId, "main-1", 6), "the next node, written from that canon, is kept");
  assert.equal((await t.call("POST", beatPath, {}, node(6))).status, 200);
  await t.settle();
  assert.equal(narration(t), 1, "and paid for once");

  // The lookahead is still being written when the Ease off lands: it is saved all the same.
  const late = await fightWorld("r-ease3-aaaaaa");
  const getById = late.fake.documents.getById;
  const fight = beatId(late.runId, "main-1", 5);
  let reads = 0;
  let eased: ReturnType<typeof late.call> | null = null;
  late.fake.documents.getById = async (packageId, id) => {
    if (id === fight && !eased && new Error().stack?.includes("generateBeat")) {
      reads += 1;
      // Its second read of the fight is the story so far: the Ease off lands before it.
      if (reads === 2) {
        eased = late.call("POST", `${beatPath}/ease-off`, { segment: 4 }, node(5));
        await eased;
      }
    }
    return getById(packageId, id);
  };
  await play(late, ["hold", "hold", "hold"]);
  await late.settle();
  assert.equal((await eased!)?.status, 200, "the Ease off landed while the next node was written");
  assert.ok(await readBeat(late.store, late.runId, "main-1", 6), "the lookahead is kept");
  assert.equal((await late.call("POST", beatPath, {}, node(6))).status, 200);
  await late.settle();
  assert.equal(narration(late), 1, "and the next node is paid for once");
});
