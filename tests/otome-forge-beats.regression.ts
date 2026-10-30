// Otome Forge's beats (M2a): the narrator's "NEVER offer choices" sentence is the one the kit replaces; effects are
// read at the indexes the kit numbers choices and options by; the first canonical pick applies its effects once and a
// replay changes nothing; Rewrite only before a choice; Ease off cuts the canon with its marker and makes no model
// call; a refusal is a 422 that writes nothing; the lookahead and the player's own request write a beat once; moment
// and confrontation nodes are written as beats; a LI's thought before stage 2 gets the repair turn, under his first
// name too, and one thought per scene counts every branch a player can read; Cancel stops a write; a chapter's grants
// land once; every prompt keeps the earlier chapters and their big choices when memory cannot answer, and never gets
// another love interest's private canon, with memory ready too, while the one it gets says whose it is and that it is
// private; a rewrite never replaces a beat played meanwhile; a
// pick whose effects were lost lands when its beat is read; Ease off removes the lookahead on a retry, when the
// lookahead is saved just after the cut, and when the cut lands between the lookahead's reads of the beat it follows;
// a pick past the cut changes nothing, also when the cut lands while the pick is saved; an Ease off before a saved
// pick keeps the pick; and a kept line is kept once.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeChoiceMessages } from "@forge-kit/player-choices-server.mjs";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type {
  Beat,
  Chapter,
  ChapterNode,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  SUMMARY_WORDING,
  createOtomeMemory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  normalizeBeatReply,
  segmentLists,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import { normalizeConfrontationReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/confrontation.ts";
import {
  DECISIONS_HEADING,
  EASE_OFF_MARKER,
  canonicalSegments,
  readChapter,
  recallText,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import {
  NO_CHOICES_SENTENCE,
  beatMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import {
  beatId,
  chapterId,
  playerId,
  runDocTarget,
  stateId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  KAI,
  MIR,
  SOL,
  beatReply,
  confrontationReply,
  isConfrontationPrompt,
  json,
  closerPlanReply,
  planReply,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

const system = (messages: CapabilityLanguageModelMessage[]) => messages[0]!.content;
const isPlanner = (messages: CapabilityLanguageModelMessage[]) => system(messages).includes("chapter planner");

/**
 * Answers every call: the plan for the planner, a stance game for the Confrontation (M2b), `beat(index)` for the
 * narrator (the node index from the prompt).
 */
function router(beat: (node: number) => Record<string, unknown> = () => beatReply()) {
  return Array.from({ length: 60 }, () => (messages: CapabilityLanguageModelMessage[]) => {
    if (isPlanner(messages)) return json(planReply());
    if (isConfrontationPrompt(messages)) return json(confrontationReply());
    const node = Number(/Narrate node (\d+) of/.exec(messages.at(-1)!.content)?.[1] ?? 1) - 1;
    return json(beat(node));
  });
}

const beatPath = "/runs/:run/chapters/:key/beats/:i";
/** How the story names Mireille's route chapter "Mireille's Ledger" (S/story/canon.ts titleOf). */
const MIREILLE_LEDGER =
  "Mireille's own route chapter \"Mireille's Ledger\" (private: only the people in its scenes know what happened in it)";
const node = (i: number) => ({ key: "main-1", i: String(i) });
const labels = (t: Awaited<ReturnType<typeof storyWorld>>, label: string) =>
  t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === label).length;

async function plannedWorld(runKey: string, beat?: (node: number) => Record<string, unknown>, cancellation = false) {
  const t = await storyWorld({ runKey, replies: router(beat), cancellation });
  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  return t;
}

/** Reads beats `from`..`to` to their ends, in order, making no choices (a Confrontation is held all three rounds). */
async function readThrough(t: Awaited<ReturnType<typeof storyWorld>>, from: number, to: number, key = "main-1") {
  const results = [];
  for (let i = from; i <= to; i += 1) {
    const at = { key, i: String(i) };
    const served = await t.call("POST", beatPath, {}, at);
    assert.equal(served.status, 200, JSON.stringify(served.body));
    if (served.body.confrontation) {
      for (let round = 1; round <= 3; round += 1) {
        const taken = await t.call("POST", `${beatPath}/stance`, { round, stance: "hold" }, at);
        assert.equal(taken.status, 200, JSON.stringify(taken.body));
      }
    }
    results.push(await t.call("POST", `${beatPath}/read`, { segment: 99 }, at));
  }
  return results;
}

const twoChoices = () =>
  beatReply({
    choices: [
      {
        kind: "small",
        at: 2,
        options: [
          {
            text: "Tell him about your brother",
            selection: { kind: "dialogue", text: "My brother drowned here." },
            segments: [{ speaker: "Kai", text: "I know.", expression: "hurt" }],
            effects: [
              { li: KAI, trust: 1, disclose: "She told him her brother drowned." },
              { li: SOL, trust: 1 },
            ],
          },
          {
            text: "Say nothing",
            selection: { kind: "action", text: "You watch the lamp turn." },
            segments: [{ speaker: "", text: "The silence stretches." }],
            effects: [{ li: "Kai", tension: 5 }],
          },
        ],
      },
      {
        kind: "small",
        at: 0,
        options: [
          {
            text: "Greet him",
            selection: { kind: "dialogue", text: "Evening, keeper." },
            segments: [{ speaker: "Kai", text: "Hm." }],
          },
          {
            text: "Mock the lamp",
            selection: { kind: "dialogue", text: "Still polishing that relic?" },
            segments: [{ speaker: "Kai", text: "Get out.", expression: "angry" }],
            effects: [{ li: KAI, grievance: { by: "li", text: "She mocked his lamp.", severity: "minor" } }],
          },
        ],
      },
    ],
  });

test("the narrator's sentence is the one the kit replaces; P6 carries the boundary, the contract and the effects", async () => {
  assert.equal(
    forgeChoiceMessages([{ role: "system", content: NO_CHOICES_SENTENCE }], {
      enabled: true,
      terminal: false,
    })[0]!.content.startsWith("The player may choose their own dialogue or actions"),
    true,
    "the kit finds and replaces NO_CHOICES_SENTENCE",
  );
  const t = await plannedWorld("r-trig-aaaaaa");
  assert.equal((await t.call("POST", beatPath, {}, node(0))).status, 200);
  const sent = t.calls.find((entry) => !isPlanner(entry.messages))!.messages;
  assert.ok(!system(sent).includes(NO_CHOICES_SENTENCE));
  assert.match(system(sent), /PLAYER CHOICES/);
  assert.match(system(sent), /CHOICE EFFECTS/);
  assert.match(system(sent), /SPEAKER VOICES/);
  assert.ok(system(sent).includes(forgeKnowledgeBoundary), "P6 carries the knowledge boundary");
  assert.match(system(sent), /CONTENT CONTRACT[\s\S]*Darkness: Angst/);
  assert.match(system(sent), /tender, flustered, cold, hurt, angry/);
  assert.ok(!sent.at(-1)!.content.includes("HIDDEN-TRUTH"), "a scene card shows an unrevealed secret only as tells");
  assert.ok(!sent.at(-1)!.content.includes("MYSTERY-TRUTH"), "the narrator never sees the mystery's truth");
  assert.match(sent.at(-1)!.content, /The story opens here: The lanterns/);
});

test("moment nodes are written as beats with their framing; a confrontation node is a stance game", async () => {
  const t = await plannedWorld("r-kind-aaaaaa");
  const chapter = (await readChapter(t.store, t.runId, "main-1"))!;
  const [world, player, state] = await Promise.all([
    t.store.readDoc(worldId(t.runId), normalizeWorld),
    t.store.readDoc(playerId(t.runId), normalizePlayer),
    t.state(),
  ]);
  const prompt = (i: number) =>
    beatMessages({
      world: world!,
      player: player!,
      units: [],
      state,
      chapter,
      node: chapter.nodes[i]!,
      storySoFar: "",
      memory: "",
    })
      .map((message) => message.content)
      .join("\n");
  assert.match(prompt(2), /READ HIM moment/);
  assert.match(prompt(5), /CONFRONTATION, the chapter's climax/);
  assert.match(prompt(6), /the chapter's last/);
  assert.match(prompt(6), /ONE BIG choice/, "the last node may end on a big choice");
  assert.doesNotMatch(prompt(5), /ONE BIG choice/);
  // #1949: the closing decision differs from the recent ones, in the plan and on the last node only.
  const varied =
    "not always whom the protagonist goes with, and never a choice between love interests two chapters running";
  assert.ok(
    prompt(6).includes(`This is the chapter's last node: if it ends on a big choice, make it a different kind`),
  );
  assert.ok(prompt(6).includes(varied) && !prompt(5).includes(varied), "the last node only");
  const plan = system(t.calls.find((entry) => isPlanner(entry.messages))!.messages);
  assert.ok(plan.includes("Never plan a chapter on the template of the ones before it") && plan.includes(varied));
  assert.match(
    plan,
    /The Foil's goal competes with the protagonist's or the Lead's, and not always for the protagonist/,
  );
  await readThrough(t, 0, 1);
  const moment = await t.call("POST", beatPath, {}, node(2));
  assert.equal(moment.body.beat.kind, "moment");
  await readThrough(t, 2, 4);
  const confrontation = await t.call("POST", beatPath, {}, node(5));
  assert.equal(confrontation.body.beat.kind, "confrontation");
  assert.equal(confrontation.body.confrontation.rounds.length, 1, "only the round being played is shown");
  assert.equal(labels(t, "confrontation/main-1/5"), 1, "P12 wrote it in one call");
  assert.equal(labels(t, "beat/main-1/5"), 0);
});

test("the lookahead and the player's own request write a beat once", async () => {
  const t = await plannedWorld("r-look-aaaaaa");
  const first = await t.call("POST", beatPath, {}, node(0));
  assert.equal(first.status, 200);
  // The lookahead for node 1 is queued; the player asks for it at once.
  const second = await t.call("POST", beatPath, {}, node(1));
  assert.equal(second.status, 200);
  await t.settle();
  assert.equal(labels(t, "beat/main-1/1"), 1, "beat 1 was written once");
  assert.equal(labels(t, "beat/main-1/0"), 1);
  assert.equal(labels(t, "beat/main-1/2"), 1, "serving beat 1 queued beat 2");
  assert.equal(labels(t, "beat/main-1/3"), 0, "never further than one ahead");
  assert.equal((await t.call("POST", beatPath, {}, node(4))).status, 409, "a beat two ahead cannot be written yet");
  const again = await t.call("POST", beatPath, {}, node(1));
  assert.deepEqual(again.body.beat, second.body.beat);
});

test("effects map to the kit's ids; the first canonical pick applies them once, and a replay changes nothing", async () => {
  const t = await plannedWorld("r-pick-aaaaaa", (i) => (i === 0 ? twoChoices() : beatReply()));
  const served = await t.call("POST", beatPath, {}, node(0));
  const view = served.body.beat;
  assert.equal(view.effects, undefined, "effects never reach the client");
  assert.deepEqual(
    view.choices.map((choice: { id: string; at: number }) => [choice.id, choice.at]),
    [
      ["choice-2", 0],
      ["choice-1", 2],
    ],
    "the kit sorts by `at` and keeps the reply's numbering",
  );
  const stored = (await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat))!;
  assert.deepEqual(stored.effects, {
    "choice-1": {
      "option-1": [{ li: KAI, trust: 1, disclose: "She told him her brother drowned." }],
      "option-2": [{ li: KAI, tension: 1 }],
    },
    "choice-2": { "option-2": [{ li: KAI, grievance: { by: "li", text: "She mocked his lamp.", severity: "minor" } }] },
  });

  const choose = (choice: string, option: string) => t.call("POST", `${beatPath}/choose`, { choice, option }, node(0));
  assert.equal((await choose("choice-1", "option-1")).status, 409, "the earlier choice comes first");
  const mocked = await choose("choice-2", "option-2");
  assert.equal(mocked.status, 200);
  assert.equal(mocked.body.remembered, true);
  assert.deepEqual(mocked.body.rememberedBy, [KAI], "the toast names whom the pick touched");
  assert.equal((await t.state()).lis[KAI]!.grievances.length, 1);
  const told = await choose("choice-1", "option-1");
  assert.equal(told.body.remembered, true);
  assert.deepEqual(told.body.beat.choiceCanon, { "choice-2": "option-2", "choice-1": "option-1" });
  const after = await t.state();
  assert.equal(after.lis[KAI]!.trust, 1);
  assert.deepEqual(
    after.lis[KAI]!.disclosures.map((item) => item.text),
    ["She told him her brother drowned."],
  );
  assert.equal(after.lis[SOL]!.trust, 0, "Sol was not in the scene");

  // A replay with the other option, before and after the beat is read: canon and state stay as they are.
  const replay = await choose("choice-1", "option-2");
  assert.equal(replay.body.remembered, false);
  assert.deepEqual(replay.body.beat.choiceCanon, told.body.beat.choiceCanon);
  assert.deepEqual(await t.state(), after);
  const read = await t.call("POST", `${beatPath}/read`, { segment: 2 }, node(0));
  assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }]);
  const settled = await t.state();
  assert.equal((await choose("choice-1", "option-2")).body.remembered, false);
  assert.deepEqual(await t.state(), settled);
  const picked = (await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat))!;
  assert.deepEqual(
    canonicalSegments(picked, "Ines")!.map((segment) => segment.text),
    [
      "The lamp hisses.",
      "[Canonical player choice by Ines: Mock the lamp.]",
      "Still polishing that relic?",
      "Get out.",
      "You came back. How inefficient of you.",
      "Someone had to.",
      "[Canonical player choice by Ines: Tell him about your brother.]",
      "My brother drowned here.",
      "I know.",
    ],
  );
});

test("Rewrite is for the beat being read before any choice; it drops the beats after it", async () => {
  const t = await plannedWorld("r-rewr-aaaaaa", (i) => (i === 1 ? twoChoices() : beatReply()));
  await readThrough(t, 0, 0);
  await t.call("POST", beatPath, {}, node(1));
  await t.settle();
  assert.equal(labels(t, "beat/main-1/2"), 1, "the lookahead wrote beat 2");
  assert.equal((await t.call("POST", beatPath, { rewrite: true }, node(0))).status, 409, "beat 0 is read");
  const rewritten = await t.call("POST", beatPath, { rewrite: true }, node(1));
  assert.equal(rewritten.status, 200);
  assert.equal(rewritten.body.beat.rewrites, 1);
  assert.equal(labels(t, "beat/main-1/1"), 2, "a rewrite costs one call");
  await t.settle();
  assert.equal(labels(t, "beat/main-1/2"), 2, "beat 2 followed the old beat 1 and was written again");
  await t.call("POST", `${beatPath}/choose`, { choice: "choice-2", option: "option-1" }, node(1));
  assert.equal((await t.call("POST", beatPath, { rewrite: true }, node(1))).status, 409, "not after a choice");
});

test("Ease off cuts the canon with its marker, makes no model call, and drops the lookahead", async () => {
  const t = await plannedWorld("r-ease-aaaaaa");
  await t.call("POST", beatPath, {}, node(0));
  await t.settle();
  const before = t.calls.length;
  assert.ok(await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat), "the lookahead wrote beat 1");
  const eased = await t.call("POST", `${beatPath}/ease-off`, { segment: 1 }, node(0));
  assert.equal(eased.status, 200);
  assert.equal(t.calls.length, before, "no model call");
  assert.deepEqual(eased.body.beat.easedOff, { at: 1 });
  assert.deepEqual(eased.body.veilSuggestions, ["violence-others"], "allowed tags of the chapter");
  assert.deepEqual(eased.body.grants, [{ source: "beat", starlight: 30 }], "the scene counts as read");
  assert.equal(await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat), null, "the lookahead is gone");
  const stored = (await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat))!;
  assert.deepEqual(
    canonicalSegments(stored, "Ines")!.map((segment) => segment.text),
    ["The lamp hisses.", "You came back. How inefficient of you.", EASE_OFF_MARKER],
  );
  await t.call("POST", beatPath, {}, node(1));
  const next = t.calls.at(-1)!.messages.at(-1)!.content;
  assert.ok(next.includes(EASE_OFF_MARKER), "the next scene continues from the aftermath");
  assert.ok(!next.includes("Someone had to."), "and never sees what was cut");

  const veiled = await t.call("POST", "/runs/:run/veil", { limits: ["violence-others", "non-consent"] });
  assert.equal(veiled.body.world.content.limits["violence-others"], "veil");
  assert.equal(veiled.body.world.content.limits["non-consent"], "line", "a Line is never raised to a Veil");
});

test("a refusal is a 422 that writes nothing; a LI's thought before stage 2 gets the repair turn", async () => {
  const t = await storyWorld({
    runKey: "r-decl-aaaaaa",
    replies: [
      json(planReply()),
      "I can't help with writing this scene.",
      "I'm unable to continue this story.",
      json(beatReply({ segments: [...beatReply().segments, { speaker: "Kai", text: "Don't leave.", thought: true }] })),
      json(beatReply()),
    ],
  });
  await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  const declined = await t.call("POST", beatPath, {}, node(0));
  assert.equal(declined.status, 422);
  assert.equal(declined.body.code, "declined");
  assert.equal(await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat), null);
  const repaired = await t.call("POST", beatPath, {}, node(0));
  assert.equal(repaired.status, 200);
  assert.match(t.calls[4]!.messages.at(-1)!.content, /Kai is still behind their mask/);
});

test("a love interest's thought under his first name alone keeps the stage and one-per-beat rules", () => {
  const units = [{ id: KAI, name: "Kai Arden" }];
  const at = { i: 0, kind: "beat", guide: "Rain.", cast: [KAI] } as ChapterNode;
  const thought = (speaker: string) => ({ speaker, text: "Stay.", thought: true });
  const reply = (...lines: object[]) => ({ segments: [{ speaker: "", text: "Rain on the glass." }, ...lines] });
  const masked = normalizeState({ lis: { [KAI]: {} } });
  assert.match(
    String(normalizeBeatReply(reply(thought("Kai")), { node: at, units, state: masked, last: false })),
    /Kai Arden is still behind their mask/,
  );
  const open = normalizeState({ lis: { [KAI]: { stage: 2 } } });
  assert.match(
    String(
      normalizeBeatReply(reply(thought("Kai"), thought("Kai Arden")), { node: at, units, state: open, last: false }),
    ),
    /at most one thought line/,
  );
  assert.equal(
    typeof normalizeBeatReply(reply(thought("Kai")), { node: at, units, state: open, last: false }),
    "object",
  );
  // Every choice is played, one option each: a thought on the mainline and one in a branch, or one in a branch of
  // each of two choices, makes two in the scene; one in each option of the same choice is still one.
  const option = (label: string, lines: object[]) => ({
    text: label,
    selection: { kind: "action", text: `You ${label.toLowerCase()}.` },
    segments: lines.length ? lines : [{ speaker: "", text: "The rain eases." }],
  });
  const choice = (index: number, first: object[], second: object[] = []) => ({
    kind: "small",
    at: index,
    options: [option(`Stay ${index}`, first), option(`Leave ${index}`, second)],
  });
  const scene = (lines: object[], choices: object[]) => ({
    segments: [{ speaker: "", text: "Rain on the glass." }, { speaker: "", text: "The lamp hums." }, ...lines],
    choices,
  });
  const check = (value: ReturnType<typeof scene>) =>
    String(normalizeBeatReply(value, { node: at, units, state: open, last: false }));
  assert.match(check(scene([thought("Kai")], [choice(0, [thought("Kai")])])), /at most one thought line/);
  assert.match(
    check(scene([], [choice(0, [thought("Kai")]), choice(1, [thought("Kai")])])),
    /at most one thought line/,
  );
  assert.equal(check(scene([], [choice(0, [thought("Kai")], [thought("Kai Arden")])])), "[object Object]");
});

test("an explicit saved-place reference canonicalizes mainline and every branch without merging numbered rooms", () => {
  const canonical = "Dottore’s wing4";
  const context = {
    node: { i: 0, kind: "beat", guide: "The same laboratory.", cast: [KAI] } as ChapterNode,
    units: [{ id: KAI, name: "Kai" }],
    state: normalizeState({ lis: { [KAI]: {} } }),
    last: false,
    places: {
      "dottore-s-wing4": {
        name: canonical,
        tags: "laboratory, green glass, no humans",
        art: { state: "ready" as const, at: "old", url: "/saved-lab.png" },
      },
    },
  };
  const reply = twoChoices();
  reply.places = [{ name: "dottore’s wing5", tags: "obsolete new tags", reuse: "dottore-s-wing4" }];
  for (const segment of reply.segments) segment.place = "dottore’s wing5";
  for (const choice of reply.choices)
    for (const option of choice.options) for (const segment of option.segments) delete segment.place;
  const result = normalizeBeatReply(reply, context);
  assert.equal(typeof result, "object", String(result));
  if (typeof result === "string") return;
  assert.deepEqual(result.places, [{ name: canonical, tags: "laboratory, green glass, no humans" }]);
  for (const segment of [
    ...result.segments,
    ...result.choices.flatMap((choice) => choice.options.flatMap((option) => option.segments)),
  ])
    assert.equal(segment.place, canonical);
  assert.equal(JSON.stringify(result).includes('"reuse"'), false, "references are not new saved identity fields");
  const rawGame = confrontationReply({
    places: reply.places,
    opening: [{ speaker: "", text: "The argument begins.", place: "dottore’s wing5" }],
  });
  const game = normalizeConfrontationReply(
    rawGame,
    { li: KAI, node: context.node, cgOpen: false },
    segmentLists(context),
  );
  assert.equal(typeof game, "object", String(game));
  if (typeof game !== "string") {
    assert.deepEqual(game.places, result.places);
    const lines = [
      ...game.segments,
      ...game.confrontation.rounds.flatMap((round) => [
        ...round.his,
        ...Object.values(round.options).flatMap((option) => option.segments),
      ]),
      ...Object.values(game.confrontation.endings).flat(),
    ];
    for (const line of lines)
      assert.equal(line.place, canonical, "every unchosen Confrontation branch retains the same canonical background");
  }
  const untagged = normalizeBeatReply(reply, {
    ...context,
    places: { "dottore-s-wing4": { name: canonical, tags: "" } },
  });
  assert.equal(typeof untagged, "object");
  if (typeof untagged !== "string")
    assert.equal(
      untagged.places[0]!.tags,
      "obsolete new tags",
      "a location without a description can still take its first tags",
    );
  const different = normalizeBeatReply(
    beatReply({
      places: [{ name: "Room 5", tags: "laboratory, no humans" }],
      segments: [{ speaker: "", text: "Another room.", place: "Room 5" }],
    }),
    { ...context, places: { "room-4": { name: "Room 4", tags: "laboratory, no humans" } } },
  );
  assert.equal(typeof different, "object");
  if (typeof different !== "string") assert.equal(different.places[0]!.name, "Room 5");
  const unknown = normalizeBeatReply(
    beatReply({ places: [{ name: "The lab", tags: "laboratory", reuse: "missing-key" }] }),
    context,
  );
  assert.match(String(unknown), /reuse.*existing|unknown.*place/i, "unknown references enter the existing repair path");
});

test("Confrontation place references retain their specific repair reason without changing segment-list null handling", () => {
  const context = {
    node: { i: 0, kind: "confrontation", guide: "The lab.", cast: [KAI] } as ChapterNode,
    units: [{ id: KAI, name: "Kai" }],
    state: normalizeState({ lis: { [KAI]: {} } }),
    last: false,
    places: {
      "saved-a": { name: "Laboratory A", tags: "laboratory, no humans" },
      "saved-b": { name: "Laboratory B", tags: "laboratory, no humans" },
    },
  };
  for (const [places, reason] of [
    [[{ name: "The lab", reuse: "missing-key" }], /reuse.*existing saved place key/],
    [[{ name: "", reuse: "saved-a" }], /reused place needs its scene name/],
    [
      [
        { name: "The lab", reuse: "saved-a" },
        { name: "The lab", reuse: "saved-b" },
      ],
      /conflicting reuse references/,
    ],
  ] as const) {
    const reply = confrontationReply({ places });
    const result = normalizeConfrontationReply(
      reply,
      { li: KAI, node: context.node, cgOpen: false },
      segmentLists(context),
    );
    assert.match(String(result), reason);
    assert.equal(
      segmentLists(context).list({ segments: reply.opening, places }, ""),
      null,
      "the segment-list null contract remains intact",
    );
  }
});

test("optional background reuse treats blank values as omission, trims keys and rejects invalid supplied references", () => {
  const context = {
    node: { i: 0, kind: "beat", guide: "A new room.", cast: [] } as ChapterNode,
    units: [],
    state: normalizeState({ lis: {} }),
    last: false,
    places: { "saved-lab": { name: "The saved laboratory", tags: "laboratory, no humans" } },
  };
  const place = { name: "Room 5", tags: "glass room, no humans" };
  const reply = beatReply({ places: [place], segments: [{ speaker: "", text: "A new room.", place: place.name }] });
  const baseline = normalizeBeatReply(reply, context);
  assert.equal(typeof baseline, "object");
  for (const reuse of [undefined, null, "", " \t\n"]) {
    assert.deepEqual(
      normalizeBeatReply({ ...reply, places: [{ ...place, reuse }] }, context),
      baseline,
      `omission: ${JSON.stringify(reuse)}`,
    );
  }
  const trimmed = normalizeBeatReply({ ...reply, places: [{ ...place, reuse: "  saved-lab\t " }] }, context);
  assert.equal(typeof trimmed, "object", String(trimmed));
  if (typeof trimmed !== "string") assert.deepEqual(trimmed.places, [context.places["saved-lab"]]);
  for (const reuse of [false, 0, {}, [], "missing-key", "  missing-key  "]) {
    assert.match(
      String(normalizeBeatReply({ ...reply, places: [{ ...place, reuse }] }, context)),
      /reuse.*existing saved place key/,
      `invalid: ${JSON.stringify(reuse)}`,
    );
  }
});

test("a declined scene can be eased off from the declined panel: no call, read, and the story goes on without it", async () => {
  const t = await storyWorld({
    runKey: "r-decl-bbbbbb",
    replies: [
      json(planReply()),
      "I can't help with writing this scene.",
      "I'm unable to continue this story.",
      json(beatReply()),
    ],
  });
  await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal((await t.call("POST", beatPath, {}, node(0))).status, 422);
  assert.equal(
    (await t.call("POST", `${beatPath}/ease-off`, { segment: 0 }, node(1))).status,
    409,
    "only the node being read",
  );
  const before = t.calls.length;
  const eased = await t.call("POST", `${beatPath}/ease-off`, { segment: 0 }, node(0));
  assert.equal(eased.status, 200, JSON.stringify(eased.body));
  assert.equal(t.calls.length, before, "no model call");
  assert.deepEqual(eased.body.beat.segments, []);
  assert.deepEqual(eased.body.beat.easedOff, { at: 0 });
  assert.deepEqual(eased.body.grants, [{ source: "beat", starlight: 30 }], "the scene counts as read");
  assert.equal((await t.state()).chapters["main-1"]!.beatsRead, 1);
  const again = await t.call("POST", beatPath, {}, node(0));
  assert.deepEqual(again.body.beat.easedOff, { at: 0 }, "the cut scene is served as it is, never written again");
  assert.equal((await t.call("POST", beatPath, {}, node(1))).status, 200);
  const next = t.calls[before]!.messages.at(-1)!.content;
  assert.match(next, /Narrate node 2 of/);
  assert.ok(next.includes(EASE_OFF_MARKER), "the next scene continues from the aftermath");
});

test("Cancel stops a write before anything is saved", async () => {
  const t = await plannedWorld("r-cncl-aaaaaa", undefined, true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const resolve = t.runtime.languageModels.resolveForRequest;
  t.runtime.languageModels.resolveForRequest = async (request) => {
    const model = await resolve(request);
    return {
      ...model,
      chatComplete: async (messages, options) => {
        await gate;
        return model.chatComplete(messages, options);
      },
    };
  };
  const pending = t.call("POST", beatPath, {}, node(0));
  await new Promise((done) => setTimeout(done, 10));
  assert.deepEqual((await t.call("POST", "/runs/:run/cancel")).body, { ok: true });
  const cancelled = await pending;
  assert.equal(cancelled.status, 409);
  release();
  await t.settle();
  assert.equal(await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat), null);
});

test("reading the last node completes the chapter once: Starlight, Lead and Foil affection, ledger, lastLead", async () => {
  const t = await plannedWorld("r-done-aaaaaa");
  const reads = await readThrough(t, 0, 6);
  assert.deepEqual(reads.at(-1)!.body.grants, [
    { source: "beat", starlight: 30 },
    { source: "chapter", starlight: 160 },
    { source: "lead", li: KAI, affection: 150 },
    { source: "foil", li: MIR, affection: 60 },
  ]);
  assert.equal(reads.at(-1)!.body.chapterDone, true);
  const state = await t.state();
  assert.equal(state.wallet.starlight, 2000 + 7 * 30 + 160);
  assert.equal(state.lis[KAI]!.points, 150);
  assert.equal(state.lis[MIR]!.points, 60);
  assert.equal(state.lis[KAI]!.lastLead, 1);
  assert.deepEqual(state.lis[KAI]!.angst, ["secret"]);
  assert.deepEqual(state.ledgers.relationship, [{ key: "main-1", li: KAI, line: "Kai let her see the lamp room." }]);
  const again = await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(6));
  assert.deepEqual(again.body.grants, []);
  assert.deepEqual(await t.state(), state);
  const story = await t.call("GET", "/runs/:run/story");
  assert.equal(story.body.chapters[0].state, "done");
  assert.deepEqual(story.body.next.candidates[0], { li: MIR, reason: "least-recent" });
  assert.equal(labels(t, "beat/main-1/6"), 1, "no lookahead past the last node");
});

/** A terminal beat for chapter `number`: its node's marked line, then one big choice on the last segment. */
function markedBeat(number: number, i: number, last: boolean) {
  const segments = [{ speaker: "", text: `CANON-${number}-${i}: the lamp hisses.` }, ...beatReply().segments.slice(1)];
  if (!last) return beatReply({ segments });
  const option = (text: string, said: string) => ({ text, selection: { kind: "dialogue", text: said }, segments: [] });
  return beatReply({
    segments,
    choices: [
      {
        kind: "big",
        at: segments.length - 1,
        options: [option(`Keep Kai's secret ${number}`, "I'll say nothing."), option("Tell the court", "He did it.")],
      },
    ],
  });
}

test("every story prompt keeps the earlier chapters and their big choices when memory cannot answer", async () => {
  // A compress model that refuses every summary: memory never gets past `error`.
  const replies = Array.from({ length: 200 }, () => (messages: CapabilityLanguageModelMessage[]) => {
    if (system(messages).includes(SUMMARY_WORDING)) return "I can't help with summarizing this.";
    if (isConfrontationPrompt(messages)) return json(confrontationReply());
    const number = Number(/main chapter (\d+)/.exec(messages.at(-1)!.content)?.[1] ?? 1);
    if (isPlanner(messages)) {
      // Main chapter 3 follows two Confrontations: the planner is told to end it with a Closer (#1938).
      const plan = /This chapter's climax is a closer/.test(system(messages)) ? closerPlanReply : planReply;
      return json(plan({ title: `Night ${number}`, ledger: { relationship: [], conflict: [], offscreen: [] } }));
    }
    const i = Number(/Narrate node (\d+) of/.exec(messages.at(-1)!.content)?.[1] ?? 1) - 1;
    return json(markedBeat(number, i, i === 6));
  });
  const t = await storyWorld({ runKey: "r-cont-aaaaaa", replies });
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  t.deps.memory = memory;
  const settled = async () => {
    for (let turn = 0; turn < 2000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    return (await memory.status(t.runId)).phase;
  };
  const play = async (number: number) => {
    assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
    const at = (i: number) => ({ key: `main-${number}`, i: String(i) });
    for (let i = 0; i <= 6; i += 1) {
      const served = await t.call("POST", beatPath, {}, at(i));
      assert.equal(served.status, 200);
      for (let round = 1; served.body.confrontation && round <= 3; round += 1) {
        assert.equal((await t.call("POST", `${beatPath}/stance`, { round, stance: "hold" }, at(i))).status, 200);
      }
      if (i === 6) {
        const big = { choice: "choice-1", option: "option-1" };
        assert.equal((await t.call("POST", `${beatPath}/choose`, big, at(i))).status, 200);
      }
      assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, at(i))).status, 200);
    }
    await t.settle();
  };
  try {
    await play(1);
    await play(2);
    assert.equal(await settled(), "error", "the refused summaries leave memory in error");
    assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
    assert.equal((await t.call("POST", beatPath, {}, { key: "main-3", i: "0" })).status, 200);
    const planner = t.calls
      .filter((call) => isPlanner(call.messages))
      .at(-1)!
      .messages.at(-1)!.content;
    const narrator = t.calls.filter((call) => /Narrate node 1 of/.test(call.messages.at(-1)!.content)).at(-1)!;
    for (const [name, prompt] of [
      ["P5", planner],
      ["P6", narrator.messages.at(-1)!.content],
    ] as const) {
      assert.ok(prompt.includes("CANON-1-0") && prompt.includes("CANON-2-0"), `${name} keeps both earlier chapters`);
      assert.match(prompt, /# Latest chapter: Night 2/, `${name} has the latest chapter in full`);
      assert.ok(prompt.includes(DECISIONS_HEADING), `${name} carries the irrevocable decisions`);
      assert.match(prompt, /Chapter 1 "Night 1", node 7: Keep Kai's secret 1\. \(dialogue: I'll say nothing\.\)/);
      assert.match(prompt, /Chapter 2 "Night 2", node 7: Keep Kai's secret 2/);
    }
  } finally {
    memory.dispose();
  }

  // Another man's private chapter (his route) reaches only his own reader and the scenes he is in, decision included.
  const key = "route-li-mireille-cd34-2";
  const done = (await t.state()).chapters["main-2"]!.completed!;
  const route: Chapter = {
    key,
    kind: "route",
    li: MIR,
    lead: MIR,
    title: "Mireille's Ledger",
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", guide: "The ledger.", cast: [MIR] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: done,
    connectionId: "conn-text",
  };
  const choice = (id: string, text: string) => ({
    id,
    text,
    selection: { kind: "action" as const, text: `You ${text.toLowerCase()}.` },
    segments: [],
  });
  const privateBeat: Beat = {
    key,
    i: 0,
    kind: "beat",
    places: [],
    segments: [{ speaker: "", text: "PRIVATE-LEDGER: the forged pages." }],
    choices: [
      {
        id: "choice-1",
        kind: "big",
        at: 0,
        options: [choice("option-1", "Burn the ledger"), choice("option-2", "Keep it")],
      },
    ],
    choiceCanon: { "choice-1": "option-1" },
    effects: {},
    applied: {},
    musicMood: "tense",
    readThrough: 0,
    written: { at: done, connectionId: "conn-text", model: "fake" },
    rewrites: 0,
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, key)), normalizeChapter, () => route);
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, key, 0)), normalizeBeat, () => privateBeat);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [key]: { beatsRead: 1, completed: done, applied: [] } },
  }));
  for (const [who, sees] of [
    [{ cast: [KAI] }, false],
    [{ cast: [] }, false],
    [{ reader: KAI }, false],
    [{ cast: [KAI, MIR] }, true],
    [{ reader: MIR }, true],
  ] as const) {
    const text = await recallText({ store: t.store }, t.runId, { job: "narration", ...who });
    assert.equal(text.includes("PRIVATE-LEDGER"), sees, `the private canon, for ${JSON.stringify(who)}`);
    assert.equal(text.includes("Burn the ledger"), sees, `the private decision, for ${JSON.stringify(who)}`);
    assert.ok(text.includes("Keep Kai's secret 1"), "a main chapter's decision is everyone's");
    // Whose it is and that it is private, so a scene with others in it keeps to the knowledge boundary.
    assert.equal(text.includes(`# Canon in full: ${MIREILLE_LEDGER}\nPRIVATE-LEDGER`), sees, "its heading");
    assert.equal(text.includes(`- ${MIREILLE_LEDGER}, node 1: Burn the ledger`), sees, "its decision's");
  }
});

test("with memory ready, a love interest's route chapter reaches only the scenes and plans they are in", async () => {
  // The fake summarizer: a detail echoes its source, an overview joins the previous one with its records.
  const summarizer = (messages: CapabilityLanguageModelMessage[]) => {
    const input = JSON.parse(messages.at(-1)!.content);
    if (input.source) return json({ summary: `${input.source.title}: ${input.source.content}` });
    const records = input.records.map((record: { content: string }) => record.content).join(" ");
    return json({ summary: [input.previousOverview, records].filter(Boolean).join(" ") });
  };
  const t = await storyWorld({ runKey: "r-ready-aaaaaa", replies: Array.from({ length: 40 }, () => summarizer) });
  const chapterOf = (changes: Partial<Chapter> & Pick<Chapter, "key" | "kind" | "lead" | "title">): Chapter => ({
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", guide: "The scene.", cast: [changes.lead] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: "2026-10-28T10:00:00.000Z",
    connectionId: "conn-text",
    ...changes,
  });
  const complete = async (chapter: Chapter, text: string, completed: string) => {
    await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => chapter);
    const beat: Beat = {
      key: chapter.key,
      i: 0,
      kind: "beat",
      places: [],
      segments: [{ speaker: "", text }],
      choices: [],
      choiceCanon: {},
      effects: {},
      applied: {},
      musicMood: "tense",
      readThrough: 0,
      written: { at: completed, connectionId: "conn-text", model: "fake" },
      rewrites: 0,
    };
    await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, chapter.key, 0)), normalizeBeat, () => beat);
    await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      chapters: { ...state.chapters, [chapter.key]: { beatsRead: 1, completed, applied: [] } },
    }));
  };
  await complete(
    chapterOf({ key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" }),
    "SHARED-QUAY: the lanterns along the quay go dark.",
    "2026-10-28T10:00:00.000Z",
  );
  // Mireille's route chapter, completed after it.
  await complete(
    chapterOf({ key: `route-${MIR}-2`, kind: "route", li: MIR, lead: MIR, stage: 2, title: "Mireille's Ledger" }),
    "PRIVATE-LEDGER: Mireille shows Ines the forged pages of the harbour ledger.",
    "2026-10-28T11:00:00.000Z",
  );
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    assert.equal(await memory.maintain({ runId: t.runId }), true);
    for (let turn = 0; turn < 2000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal((await memory.status(t.runId)).phase, "ready");
    // The kit's source carries the same name, so a detail it recalls (older, by relevance) says whose it is too.
    const sources = await readMemorySources(t.store, t.runId);
    assert.deepEqual(
      sources.map((source) => [source.kind, source.title]),
      [
        ["chapter", "Night 1"],
        ["chat", MIREILLE_LEDGER],
      ],
    );
    // A plan's recall (P10, P11 and P5 recall with `cast` and a plan), and a scene's (P6, P12).
    const plan = (li: string, name: string) => ({
      job: "structured" as const,
      cast: [li],
      query: { plan: `${name} and the forged harbour ledger`, speakers: [name] },
    });
    for (const [who, sees] of [
      [{ job: "narration", cast: [KAI] }, false],
      [plan(KAI, "Kai"), false],
      [{ job: "narration", cast: [] }, false],
      [{ job: "narration", reader: KAI }, false],
      [{ job: "narration", cast: [MIR] }, true],
      [{ job: "narration", cast: [KAI, MIR] }, true],
      [plan(MIR, "Mireille"), true],
      [{ job: "narration", reader: MIR }, true],
    ] as const) {
      const text = await recallText({ store: t.store, memory, runtime: t.runtime }, t.runId, who);
      const label = JSON.stringify(who);
      assert.match(text, /# Canon to date\n/, `the ready memory answers, for ${label}`);
      assert.ok(text.includes("SHARED-QUAY"), `a main chapter is everyone's, for ${label}`);
      // The fake summarizer echoes a source, so its text stands for its summary too (in the overview or a detail).
      assert.equal(text.includes("PRIVATE-LEDGER"), sees, `the route chapter or its summary, for ${label}`);
      assert.equal(text.includes("Mireille's Ledger"), sees, `the route chapter's title, for ${label}`);
      if (sees) {
        assert.equal(text.split("PRIVATE-LEDGER").length, 2, `in full once, never ranked again, for ${label}`);
        assert.ok(text.indexOf("# Latest chapter: Night 1") < text.indexOf("PRIVATE-LEDGER"), "in story order");
        assert.ok(text.includes(`# Canon in full: ${MIREILLE_LEDGER}\nPRIVATE-LEDGER`), `whose it is, for ${label}`);
      }
    }
  } finally {
    memory.dispose();
  }
});

test("a rewrite never replaces a beat whose choice was made while it was written", async () => {
  const t = await plannedWorld("r-race-aaaaaa", (i) => (i === 1 ? twoChoices() : beatReply()));
  await readThrough(t, 0, 0);
  await t.call("POST", beatPath, {}, node(1));
  await t.settle();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const resolve = t.runtime.languageModels.resolveForRequest;
  t.runtime.languageModels.resolveForRequest = async (request) => {
    const model = await resolve(request);
    return {
      ...model,
      chatComplete: async (messages, options) => {
        await gate;
        return model.chatComplete(messages, options);
      },
    };
  };
  const rewriting = t.call("POST", beatPath, { rewrite: true }, node(1));
  await new Promise((done) => setTimeout(done, 10));
  // The reader reopened meanwhile: it is served the stored beat, and the player picks on it.
  const reopened = await t.call("POST", beatPath, {}, node(1));
  assert.equal(reopened.body.beat.rewrites, 0);
  const picked = await t.call("POST", `${beatPath}/choose`, { choice: "choice-2", option: "option-2" }, node(1));
  assert.equal(picked.status, 200);
  release();
  const rewritten = await rewriting;
  assert.equal(rewritten.status, 409, "the rewrite lands on a beat that is canon now");
  await t.settle();
  const stored = (await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat))!;
  assert.deepEqual([stored.rewrites, stored.choiceCanon], [0, { "choice-2": "option-2" }], "the beat played stays");
  assert.deepEqual((await t.state()).chapters["main-1"]!.applied, ["1/choice-2"]);
});

test("a pick whose effects never reached the state lands when its beat is read", async () => {
  const t = await plannedWorld("r-lost-aaaaaa", (i) => (i === 0 ? twoChoices() : beatReply()));
  await t.call("POST", beatPath, {}, node(0));
  // The state write fails on every attempt: the pick is saved on the beat, its effects are not.
  for (let attempt = 0; attempt < 4; attempt += 1) t.fake.interfere(stateId(t.runId));
  const lost = await t.call("POST", `${beatPath}/choose`, { choice: "choice-2", option: "option-2" }, node(0));
  assert.equal(lost.status, 409);
  const saved = (await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat))!;
  assert.deepEqual(saved.choiceCanon, { "choice-2": "option-2" });
  assert.equal((await t.state()).lis[KAI]!.grievances.length, 0);
  // After a reload the reader shows that pick as made and never sends it again; the beat is read to its end.
  assert.equal(
    (await t.call("POST", `${beatPath}/choose`, { choice: "choice-1", option: "option-1" }, node(0))).status,
    200,
  );
  const read = await t.call("POST", `${beatPath}/read`, { segment: 99 }, node(0));
  assert.deepEqual(read.body.grants, [{ source: "beat", starlight: 30 }]);
  const state = await t.state();
  assert.deepEqual(
    state.lis[KAI]!.grievances.map((grievance) => grievance.text),
    ["She mocked his lamp."],
    "the lost pick's grievance landed with the read",
  );
  assert.deepEqual([...state.chapters["main-1"]!.applied].sort(), ["0/choice-1", "0/choice-2"]);
  assert.equal(state.lis[KAI]!.trust, 1, "and the other pick's effects once");
});

test("Ease off removes the lookahead on a retry, and a lookahead saved just after the cut removes itself", async () => {
  const t = await plannedWorld("r-eas2-aaaaaa");
  await t.call("POST", beatPath, {}, node(0));
  await t.settle();
  assert.ok(await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat), "the lookahead wrote beat 1");
  const remove = t.fake.documents.remove;
  let broken = true;
  t.fake.documents.remove = async (...args) => {
    if (!broken) return remove(...args);
    broken = false;
    throw new Error("The store went away.");
  };
  assert.equal((await t.call("POST", `${beatPath}/ease-off`, { segment: 1 }, node(0))).status, 500);
  const retried = await t.call("POST", `${beatPath}/ease-off`, { segment: 1 }, node(0));
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.body.grants, [{ source: "beat", starlight: 30 }]);
  assert.equal(await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat), null, "the retry removed it");

  // The Ease off lands after the lookahead checked the beat before it, just before it saves.
  const u = await plannedWorld("r-eas3-aaaaaa");
  const create = u.fake.documents.create;
  let eased: ReturnType<typeof u.call> | null = null;
  u.fake.documents.create = async (input) => {
    if (input.id === beatId(u.runId, "main-1", 1) && !eased) {
      eased = u.call("POST", `${beatPath}/ease-off`, { segment: 1 }, node(0));
      await eased;
    }
    return create(input);
  };
  await u.call("POST", beatPath, {}, node(0));
  await u.settle();
  assert.equal((await eased!)?.status, 200);
  assert.equal(await u.store.readDoc(beatId(u.runId, "main-1", 1), normalizeBeat), null, "the stale lookahead is gone");
  await u.call("POST", beatPath, {}, node(1));
  assert.ok(u.calls.at(-1)!.messages.at(-1)!.content.includes(EASE_OFF_MARKER), "beat 1 follows the cut scene");
});

test("a pick past an Ease off cut changes nothing, even while the cut beat is not counted as read", async () => {
  const told = beatReply({
    choices: [
      {
        kind: "small",
        at: 2,
        options: [
          {
            text: "Tell him about your brother",
            selection: { kind: "dialogue", text: "My brother drowned here." },
            segments: [{ speaker: "Kai", text: "I know." }],
            effects: [{ li: KAI, trust: 1, disclose: "She told him her brother drowned." }],
          },
          {
            text: "Say nothing",
            selection: { kind: "action", text: "You watch the lamp turn." },
            segments: [{ speaker: "", text: "The silence stretches." }],
          },
        ],
      },
    ],
  });
  const t = await plannedWorld("r-cutp-aaaaaa", (i) => (i === 0 ? told : beatReply()));
  await t.call("POST", beatPath, {}, node(0));
  await t.settle();
  // The state write of the cut's finish fails on every attempt: the cut is saved, the beat is not counted as read.
  for (let attempt = 0; attempt < 4; attempt += 1) t.fake.interfere(stateId(t.runId));
  assert.equal((await t.call("POST", `${beatPath}/ease-off`, { segment: 0 }, node(0))).status, 409);
  assert.deepEqual((await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat))!.easedOff, { at: 0 });
  const before = await t.state();
  assert.equal(before.chapters["main-1"]!.beatsRead, 0);
  const picked = await t.call("POST", `${beatPath}/choose`, { choice: "choice-1", option: "option-1" }, node(0));
  assert.equal(picked.status, 200);
  assert.equal(picked.body.remembered, false);
  assert.deepEqual((await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat))!.choiceCanon, {});
  assert.deepEqual(await t.state(), before, "no effect of a choice the story never holds");
  const retried = await t.call("POST", `${beatPath}/ease-off`, { segment: 0 }, node(0));
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.body.grants, [{ source: "beat", starlight: 30 }]);
  assert.equal((await t.state()).lis[KAI]!.trust, 0);

  // The cut lands while the pick is being saved: the pick read the beat before the cut, and its write finds the cut.
  const u = await plannedWorld("r-cutq-aaaaaa", (i) => (i === 0 ? told : beatReply()));
  await u.call("POST", beatPath, {}, node(0));
  await u.settle();
  const first = beatId(u.runId, "main-1", 0);
  const update = u.fake.documents.update;
  let eased: ReturnType<typeof u.call> | null = null;
  u.fake.documents.update = async (input) => {
    if (input.id === first && !eased && (input.data as Beat).choiceCanon?.["choice-1"]) {
      eased = u.call("POST", `${beatPath}/ease-off`, { segment: 0 }, node(0));
      await eased;
    }
    return update(input);
  };
  const raced = await u.call("POST", `${beatPath}/choose`, { choice: "choice-1", option: "option-1" }, node(0));
  assert.equal((await eased!)?.status, 200);
  assert.equal(raced.status, 200);
  assert.equal(raced.body.remembered, false);
  const cut = (await u.store.readDoc(first, normalizeBeat))!;
  assert.deepEqual([cut.easedOff, cut.choiceCanon], [{ at: 0 }, {}]);
  assert.equal((await u.state()).lis[KAI]!.trust, 0, "no effect of a pick the cut came before");
});

test("an Ease off before a pick already saved keeps that pick in the canon", async () => {
  const t = await plannedWorld("r-cutb-aaaaaa", (i) => (i === 0 ? twoChoices() : beatReply()));
  await t.call("POST", beatPath, {}, node(0));
  await t.settle();
  const choose = (choice: string, option: string) => t.call("POST", `${beatPath}/choose`, { choice, option }, node(0));
  assert.equal((await choose("choice-2", "option-1")).status, 200);
  assert.equal((await choose("choice-1", "option-1")).body.remembered, true);
  // A stale tab still at the first line eases off there: the cut moves to the last pick, whose effects are applied.
  const eased = await t.call("POST", `${beatPath}/ease-off`, { segment: 0 }, node(0));
  assert.equal(eased.status, 200);
  assert.deepEqual(eased.body.beat.easedOff, { at: 2 });
  assert.deepEqual(eased.body.grants, [{ source: "beat", starlight: 30 }]);
  const stored = (await t.store.readDoc(beatId(t.runId, "main-1", 0), normalizeBeat))!;
  assert.deepEqual(
    canonicalSegments(stored, "Ines")!.map((segment) => segment.text),
    [
      "The lamp hisses.",
      "[Canonical player choice by Ines: Greet him.]",
      "Evening, keeper.",
      "Hm.",
      "You came back. How inefficient of you.",
      "Someone had to.",
      "[Canonical player choice by Ines: Tell him about your brother.]",
      "My brother drowned here.",
      "I know.",
      EASE_OFF_MARKER,
    ],
  );
  const state = await t.state();
  assert.equal(state.lis[KAI]!.trust, 1);
  assert.deepEqual(
    state.lis[KAI]!.disclosures.map((item) => item.text),
    ["She told him her brother drowned."],
    "what the state holds is what the story says",
  );
});

test("an Ease off between the lookahead's two reads of the beat it follows stops that lookahead", async () => {
  const t = await plannedWorld("r-eas4-aaaaaa");
  const getById = t.fake.documents.getById;
  const first = beatId(t.runId, "main-1", 0);
  let reads = 0;
  let eased: ReturnType<typeof t.call> | null = null;
  // The lookahead's generateBeat reads beat 0 twice (the beat it follows, and the story so far); the cut lands just
  // before the second read, whichever of the two it is.
  t.fake.documents.getById = async (packageId, id) => {
    if (id === first && !eased && t.fake.rows.has(id) && new Error().stack?.includes("generateBeat")) {
      reads += 1;
      if (reads === 2) {
        eased = t.call("POST", `${beatPath}/ease-off`, { segment: 1 }, node(0));
        await eased;
      }
    }
    return getById(packageId, id);
  };
  await t.call("POST", beatPath, {}, node(0));
  await t.settle();
  assert.equal((await eased!)?.status, 200);
  assert.equal(
    await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat),
    null,
    "the stale lookahead is not kept",
  );
  assert.ok(
    t.logs.some(
      (entry) =>
        entry.level === "warn" &&
        entry.message.includes("Lookahead for") &&
        String(entry.args[2]).includes("The scene before this one changed"),
    ),
  );
  assert.equal((await t.call("POST", beatPath, {}, node(1))).status, 200);
  const next = t.calls.at(-1)!.messages.at(-1)!.content;
  assert.ok(next.includes(EASE_OFF_MARKER), "beat 1 follows the cut scene");
  assert.ok(!next.includes("Someone had to."));
});

test("keeping a line twice keeps it once; letting it go removes it", async () => {
  const t = await storyWorld({ runKey: "r-favs-aaaaaa" });
  const keep = (body: object = {}) =>
    t.call("POST", "/runs/:run/favorites", { text: "Stay.", ref: "main-1/0r0/1", li: KAI, ...body });
  assert.equal((await keep()).body.favorites.length, 1);
  assert.equal((await keep({ keep: true })).body.favorites.length, 1, "sent again, it is kept once");
  assert.deepEqual((await keep({ keep: false })).body.favorites, []);
  assert.deepEqual((await keep({ keep: false })).body.favorites, [], "letting it go twice changes nothing");
});

test("the art hears of every beat: faces when served, places and its CG once when written, a rewrite's release", async () => {
  const t = await plannedWorld("r-arts-aaaaaa");
  const at = new Date().toISOString();
  const seen: Array<[string, string, number, boolean?]> = [];
  t.deps.art = {
    repaintExpressions: async () => assert.fail("serving a beat must not repaint expressions"),
    queueExpressions: (_runId, beat, { debugMode }) => {
      seen.push(["faces", (beat.segments[0] as { text: string }).text, beat.segments.length, debugMode]);
    },
    queueScenePaints: async (_runId, beat, { review }) => {
      seen.push(["scene", beat.key, beat.i, review]);
      throw new Error("the art broke");
    },
    releaseBeatArt: async (_runId, beat) => {
      seen.push(["release", "", beat.cg?.at ?? -1]);
    },
    dispose: () => undefined,
  };
  const served = await t.call("POST", beatPath, { reviewImagePrompts: true }, node(0));
  assert.equal(served.status, 200, "an art call that throws never breaks the story");
  await t.settle();
  assert.deepEqual(
    seen.filter(([kind]) => kind === "scene"),
    [
      ["scene", "main-1", 0, true],
      ["scene", "main-1", 1, true],
    ],
    "each written beat once, the lookahead's included, with the request's review mode",
  );
  assert.equal(seen.filter(([kind]) => kind === "faces").length, 1, "faces for the beat served");
  const warned = t.logs.find((entry) => entry.level === "warn" && entry.message.includes("Art for"));
  assert.deepEqual(warned?.args, ["main-1", 0, "scene", "the art broke"], "and is logged once per failure");
  // Served again from the store: faces again (a set may resume), no second scene paint.
  await t.call("POST", beatPath, {}, node(0));
  assert.equal(seen.filter(([kind]) => kind === "faces").length, 2);
  assert.equal(seen.filter(([kind]) => kind === "scene").length, 2);
  // A rewrite paints its own scene and lets the replaced beat's CG go, and the lookahead it drops.
  for (const i of [0, 1]) {
    const art = { state: "ready" as const, at, url: `/cg${i}.png`, ref: `global-gallery:g${i}` };
    await t.store.updateDoc(runDocTarget("beat", beatId(t.runId, "main-1", i)), normalizeBeat, (beat) =>
      beat ? { ...beat, cg: { at: 1, brief: "Kai at the lens.", cast: ["Kai"], art } } : beat,
    );
  }
  const rewritten = await t.call("POST", beatPath, { rewrite: true }, node(0));
  assert.equal(rewritten.status, 200);
  await t.settle();
  assert.equal(seen.filter(([kind]) => kind === "release").length, 2, "the replaced beat and the dropped lookahead");
});
