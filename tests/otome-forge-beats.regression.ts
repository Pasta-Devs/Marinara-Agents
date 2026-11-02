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
// pick keeps the pick; and a kept line is kept once. Who said what? (#2041) asks only a love interest's own spoken
// lines of what was played in completed chapters (never an option or stance not taken, the prologue, an extra story or
// a chapter still being read or written), each once, and hides with fewer than two love interests or too few lines.
// Side with (#2046): a side-with node's reply needs ONE small choice with an option backing each love interest present
// (a repair turn names what is missing); its effects are the game's, never the reply's; the pick moves affection once
// (+ for the one backed, − for each one passed over, never below a level reached), and the decisions name it.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeChoiceMessages } from "@forge-kit/player-choices-server.mjs";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type {
  Beat,
  Chapter,
  ChapterNode,
  Segment,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import type { NotebookEntry } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/read-me.ts";
import { estimateTextTokens } from "@forge-kit/shared-token-estimator.mjs";
import { z } from "zod";
import { generateJson } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/generation.ts";
import {
  SUMMARY_WORDING,
  createOtomeMemory,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  WHO_SAID_WHAT_BATCH,
  pickWhoSaidWhat,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/who-said-what.ts";
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
  sideWithInstruction,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import {
  beatId,
  chapterId,
  memoryId,
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
  squeezedMemory,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

const system = (messages: CapabilityLanguageModelMessage[]) => messages[0]!.content;
const isPlanner = (messages: CapabilityLanguageModelMessage[]) => system(messages).includes("chapter planner");
/** #1980: the arc planner runs before a chapter plan and is not the chapter plan. */
const isArcPlan = (messages: CapabilityLanguageModelMessage[]) =>
  system(messages).startsWith("You are the arc planner");

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
  const sent = t.calls.find((entry) => !isPlanner(entry.messages) && !isArcPlan(entry.messages))!.messages;
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
  assert.match(
    t.calls
      .filter((entry) => !isArcPlan(entry.messages))
      .at(-1)!
      .messages.at(-1)!.content,
    /Kai is still behind their mask/,
  );
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
      assert.match(
        prompt,
        /# Previous chapter in full: Night 2\nCANON-2-0/,
        `${name} has the previous chapter in full`,
      );
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
    const { text } = await recallText({ store: t.store }, t.runId, { job: "narration", ...who });
    assert.equal(text.includes("PRIVATE-LEDGER"), sees, `the private canon, for ${JSON.stringify(who)}`);
    assert.equal(text.includes("Burn the ledger"), sees, `the private decision, for ${JSON.stringify(who)}`);
    assert.ok(text.includes("Keep Kai's secret 1"), "a main chapter's decision is everyone's");
    // Whose it is and that it is private, so a scene with others in it keeps to the knowledge boundary. It completed
    // with Night 2, so it sorts before it: Night 2 is the previous chapter in full, and it the canon before.
    assert.equal(text.includes(`# Canon in full: ${MIREILLE_LEDGER}\nPRIVATE-LEDGER`), sees, "its heading");
    assert.equal(text.includes(`- ${MIREILLE_LEDGER}, node 1: Burn the ledger`), sees, "its decision's");
  }
});

/** The fake summarizer: a detail keeps only its source's MARKERS (never the prose around them), an overview joins. */
function markerSummary(messages: CapabilityLanguageModelMessage[]): string {
  const input = JSON.parse(messages.at(-1)!.content);
  const markers = (text: string) => (text.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g) ?? []).join(" ");
  if (input.source) return json({ summary: `SUMMARY: ${markers(input.source.content)}` });
  const records = input.records.map((record: { content: string }) => record.content);
  return json({ summary: [input.previousOverview, ...records].filter(Boolean).join(" ") });
}

/** The prompt without its "# Canon to date" overview (the fake's is one line). */
const beyondOverview = (text: string) => text.replace(/# Canon to date\n[^\n]*/u, "");

/** Waits for the memory's queued upkeep to finish; its phase then. */
async function memorySettled(memory: ReturnType<typeof createOtomeMemory>, runId: string) {
  for (let turn = 0; turn < 4000 && (await memory.status(runId)).phase === "pending"; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  return (await memory.status(runId)).phase;
}

/** A chapter of one node, completed at `completed` with `text` as its one line (or its lines; a string is narration). */
async function completeChapter(
  t: Awaited<ReturnType<typeof storyWorld>>,
  changes: Partial<Chapter> & Pick<Chapter, "key" | "kind" | "lead" | "title">,
  text: string | Array<string | Segment>,
  completed: string,
) {
  const chapter: Chapter = {
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", guide: "The scene.", cast: [changes.lead] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: completed,
    connectionId: "conn-text",
    ...changes,
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, chapter.key)), normalizeChapter, () => chapter);
  const beat: Beat = {
    key: chapter.key,
    i: 0,
    kind: "beat",
    places: [],
    segments: [text].flat().map((line) => (typeof line === "string" ? { speaker: "", text: line } : line)),
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
}

/** How the story names Kai's date "Jellyfish Hour" (S/story/canon.ts titleOf). */
const KAI_DATE =
  'Kai\'s own date chapter "Jellyfish Hour" (private: only the people in its scenes know what happened in it)';

/** Sol's one line in chapter 1 (node 3), for Who said what?. */
const SOL_SAID: Segment = { speaker: "Sol", text: "SOL-SAID: the pier lights fail one by one." };

test("only what was played reaches a prompt: the previous chapter in full, its memory and summary, its decisions", async () => {
  const option = (text: string, said: string, branch?: string) => ({
    text,
    selection: { kind: "dialogue", text: said },
    // A big choice ends its chapter, so its options have no branch.
    segments: branch ? [{ speaker: "Kai", text: branch }] : [],
  });
  const played = (i: number) =>
    i === 0
      ? beatReply({
          choices: [
            {
              kind: "small",
              at: 1,
              options: [
                option("Ask about the lamp", "KEPT-SAY: why the lamp?", "KEPT-BRANCH: he shrugs."),
                option("Leave", "UNPICKED-SAY: I'm going.", "UNPICKED-BRANCH: he lets her go."),
              ],
            },
          ],
        })
      : i === 6
        ? beatReply({
            choices: [
              {
                kind: "big",
                at: 2,
                options: [
                  option("KEPT-BIG", "KEPT-BIG-SAY: I'll stay."),
                  option("UNPICKED-BIG", "UNPICKED-BIG-SAY: I'll tell them."),
                ],
              },
            ],
          })
        : i === 3
          ? beatReply({ segments: [...beatReply().segments, SOL_SAID] })
          : beatReply();
  /** A line the next scene adds while it is written (the chapter in progress). */
  let writing: Segment | null = null;
  const replies = Array.from({ length: 80 }, () => (messages: CapabilityLanguageModelMessage[]) => {
    if (system(messages).includes(SUMMARY_WORDING)) return markerSummary(messages);
    if (isConfrontationPrompt(messages)) {
      // Each stance's answer long enough for Who said what?, so only the canon keeps the ones not taken out of it.
      const reply = confrontationReply();
      for (const round of reply.rounds) {
        for (const option of Object.values(round.options) as Array<{ segments: Segment[] }>) {
          option.segments[0]!.text += ", and the lamp keeps turning.";
        }
      }
      return json(reply);
    }
    const number = Number(/main chapter (\d+)/.exec(messages.at(-1)!.content)?.[1] ?? 1);
    if (isPlanner(messages)) {
      return json(planReply({ title: `Night ${number}`, ledger: { relationship: [], conflict: [], offscreen: [] } }));
    }
    const reply = played(Number(/Narrate node (\d+) of/.exec(messages.at(-1)!.content)?.[1] ?? 1) - 1);
    return json(writing ? { ...reply, segments: [...reply.segments, writing] } : reply);
  });
  const t = await storyWorld({ runKey: "r-played-aaaaaa", replies });
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  t.deps.memory = memory;
  // Every option not taken: the small choice's and the big one's, and the Confrontation's untaken stances and endings.
  const UNPLAYED = [
    "UNPICKED-SAY",
    "UNPICKED-BRANCH",
    "UNPICKED-BIG",
    "PRESS-1:",
    "YIELD-2:",
    "REVEAL-3:",
    "ANSWER-press-1",
    "ANSWER-yield-2",
    "ANSWER-reveal-3",
    "ENDING-TRUTH",
    "ENDING-WALKOUT",
  ];
  const PLAYED = ["KEPT-SAY", "KEPT-BRANCH", "KEPT-BIG-SAY", "HOLD-1:", "ANSWER-hold-3", "ENDING-STANDOFF"];
  const check = (what: string, text: string | undefined) => {
    assert.ok(text, `${what} is there`);
    assert.deepEqual(
      PLAYED.filter((marker) => !text.includes(marker)),
      [],
      `${what} holds every pick and its branch`,
    );
    assert.deepEqual(
      UNPLAYED.filter((marker) => text.includes(marker)),
      [],
      `${what} holds nothing that was not played`,
    );
  };
  try {
    assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
    const at = (i: number) => ({ key: "main-1", i: String(i) });
    for (let i = 0; i <= 6; i += 1) {
      const served = await t.call("POST", beatPath, {}, at(i));
      assert.equal(served.status, 200, JSON.stringify(served.body));
      for (let round = 1; served.body.confrontation && round <= 3; round += 1) {
        assert.equal((await t.call("POST", `${beatPath}/stance`, { round, stance: "hold" }, at(i))).status, 200);
      }
      if (i === 0 || i === 6) {
        const pick = { choice: "choice-1", option: "option-1" };
        assert.equal((await t.call("POST", `${beatPath}/choose`, pick, at(i))).status, 200);
      }
      assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, at(i))).status, 200);
    }
    await t.settle();
    assert.equal(await memorySettled(memory, t.runId), "ready");

    const [source] = await readMemorySources(t.store, t.runId);
    check("the memory source", source?.content);
    const detail = t.calls.find(
      (call) =>
        system(call.messages).includes(SUMMARY_WORDING) &&
        JSON.parse(call.messages.at(-1)!.content).source?.id === "main-1",
    );
    check("the summary's source", detail?.messages.at(-1)!.content);

    // Who said what? (#2041): the love interests' own spoken lines of what was played, each once.
    const game = async (params: Record<string, string> = {}) => {
      const served = await t.call("GET", "/runs/:run/who-said-what", {}, params);
      assert.equal(served.status, 200, JSON.stringify(served.body));
      return served.body as { choices: string[]; lines: Array<{ li: string; text: string }> };
    };
    const asked = await game();
    assert.deepEqual(asked.choices, [KAI, SOL], "the love interests who spoke, in cast order");
    const texts = asked.lines.map((entry) => entry.text);
    const by = (start: string) => asked.lines.filter((entry) => entry.text.startsWith(start)).map((entry) => entry.li);
    assert.deepEqual(by("KEPT-BRANCH"), [KAI], "a picked option's branch");
    assert.deepEqual(by("ANSWER-hold-3"), [KAI], "the stance taken");
    assert.deepEqual(by("ENDING-STANDOFF"), [], "narration");
    assert.deepEqual(by(SOL_SAID.text), [SOL]);
    assert.deepEqual(by("You came back."), [KAI], "once, though every scene says it");
    assert.deepEqual(
      UNPLAYED.filter((marker) => texts.some((text) => text.includes(marker))),
      [],
      "nothing that was not played",
    );
    for (const never of ["KEPT-SAY", "KEPT-BIG-SAY", "The lamp hisses.", "Someone had to.", "Say it, then."]) {
      assert.ok(!texts.some((text) => text.includes(never)), `${never} is the protagonist's, narration or too short`);
    }
    assert.equal((await t.call("GET", "/runs/:run/who-said-what", {}, { run: "r-nothing-zzzzzz" })).status, 404);

    assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
    const planner = t.calls
      .filter((call) => isPlanner(call.messages))
      .at(-1)!
      .messages.at(-1)!.content;
    check(
      "the previous chapter in full",
      /# Previous chapter in full: Night 1\n[^]*?(?=\n\n# Irrevocable)/u.exec(planner)?.[0],
    );
    const decisions = planner.slice(planner.indexOf(DECISIONS_HEADING));
    assert.match(decisions, /- Chapter 1 "Night 1", node 7: KEPT-BIG\.? \(dialogue: KEPT-BIG-SAY: I'll stay\.\)/u);
    assert.deepEqual(
      UNPLAYED.filter((marker) => planner.includes(marker)),
      [],
      "nothing that was not played anywhere in the next chapter's plan",
    );

    // The chapter being written is never asked from: chapter 2's first scene has a new line, and the game is the same.
    writing = { speaker: "Sol", text: "IN-PROGRESS: the pier bell rings for the chapter being written." };
    assert.equal((await t.call("POST", beatPath, {}, { key: "main-2", i: "0" })).status, 200);
    const scene = await t.store.readDoc(beatId(t.runId, "main-2", 0), normalizeBeat);
    assert.ok(
      scene?.segments.some((segment) => segment.text === writing!.text),
      "the new line is in its scene",
    );
    const shown = (view: typeof asked) => new Set(view.lines.map((entry) => `${entry.li} ${entry.text}`));
    assert.deepEqual(shown(await game()), shown(asked));
    await t.settle();
  } finally {
    memory.dispose();
  }
});

test("Who said what? asks only from completed chapters: never the prologue, an extra story or one still being read", async () => {
  const t = await storyWorld({ runKey: "r-asked-aaaaaa" });
  const said = (marker: string, ...speakers: string[]): Segment[] =>
    speakers.map((speaker, n) => ({ speaker, text: `${marker}-${n + 1}: the harbour keeps its lanterns lit.` }));
  const done = (hour: number) => `2026-10-28T${String(hour).padStart(2, "0")}:00:00.000Z`;
  await completeChapter(
    t,
    { key: "prologue", kind: "prologue", lead: KAI, title: "Prologue" },
    said("PROLOGUE", "Kai", "Sol"),
    done(9),
  );
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    said("MAIN", "Kai", "Sol", "Kai", "Sol", "Kai"),
    done(10),
  );
  await completeChapter(
    t,
    { key: "date-1", kind: "date", li: SOL, lead: SOL, title: "The Pier" },
    said("DATE", "Sol"),
    done(11),
  );
  await completeChapter(
    t,
    {
      key: `prestige-${KAI}-1`,
      kind: "story",
      li: KAI,
      lead: KAI,
      title: "A Quiet Life",
      prestige: { kind: "what-if", premise: "They keep a lighthouse together." },
    },
    said("PRESTIGE", "Kai", "Sol"),
    done(12),
  );
  // A completed chapter whose canon is not settled is left out whole, as the memory leaves it out: one with a scene
  // missing, and one whose second scene still waits on a big choice.
  const twoScenes = [0, 1].map((i) => ({ i, kind: "beat" as const, guide: "The scene.", cast: [KAI] }));
  for (const [key, marker] of [
    ["date-2", "MISSING"],
    ["date-3", "UNSETTLED"],
  ] as const) {
    await completeChapter(
      t,
      { key, kind: "date", li: KAI, lead: KAI, title: marker, nodes: twoScenes },
      said(marker, "Kai", "Sol"),
      done(12),
    );
  }
  const first = (await t.store.readDoc(beatId(t.runId, "date-3", 0), normalizeBeat))!;
  const pending = { id: "option-1", text: "Stay", selection: { kind: "dialogue" as const, text: "I'll stay." } };
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, "date-3", 1)), normalizeBeat, () => ({
    ...first,
    i: 1,
    choices: [{ id: "choice-1", kind: "big", at: 0, options: [{ ...pending, segments: [] }] }],
  }));
  await completeChapter(
    t,
    { key: "main-2", kind: "main", number: 2, lead: SOL, title: "Night 2" },
    said("READING", "Kai", "Sol"),
    done(13),
  );
  // Main chapter 2 is still being read: its scene is there, the chapter is not completed.
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, "main-2": { beatsRead: 0, applied: [] } },
  }));

  const served = await t.call("GET", "/runs/:run/who-said-what");
  assert.equal(served.status, 200, JSON.stringify(served.body));
  assert.deepEqual(served.body.choices, [KAI, SOL]);
  const asked = (served.body.lines as Array<{ li: string; text: string }>).map((entry) => `${entry.li} ${entry.text}`);
  assert.deepEqual(
    asked.sort(),
    [
      `${KAI} MAIN-1: the harbour keeps its lanterns lit.`,
      `${KAI} MAIN-3: the harbour keeps its lanterns lit.`,
      `${KAI} MAIN-5: the harbour keeps its lanterns lit.`,
      `${SOL} DATE-1: the harbour keeps its lanterns lit.`,
      `${SOL} MAIN-2: the harbour keeps its lanterns lit.`,
      `${SOL} MAIN-4: the harbour keeps its lanterns lit.`,
    ],
    "the main chapter and the date read to their ends, nothing else",
  );
});

test("Who said what? takes a love interest's own spoken lines once, and a random line from a random one", () => {
  const units = [
    { id: "li-ilvar-0001", name: "Ilvar Thorne" },
    { id: "li-cassian-0002", name: "Cassian" },
    { id: "li-rowan-0003", name: "Rowan Hale" },
    { id: "li-rowan-0004", name: "Rowan Pike" },
  ];
  const [ILVAR, CASSIAN] = [units[0]!.id, units[1]!.id];
  const long = `Ilvar: ${"the lens remembers every star we named. ".repeat(8)}`;
  const segments: Segment[] = [
    { speaker: "", text: "Narration: the dome is quiet tonight, and so are you." },
    { speaker: "Ilvar Thorne", text: "A thought he keeps to himself, and never says aloud.", thought: true },
    { speaker: "Mira Vale", text: "The protagonist speaks at length about the stars." },
    { speaker: "Mira", text: "Her first name alone is still the protagonist speaking." },
    { speaker: "Harbour Master", text: "Someone who is not a love interest says something long." },
    { speaker: "Rowan", text: "A first name two love interests share is never guessed." },
    { speaker: "Ilvar", text: "Stay." },
    { speaker: "Ilvar", text: "Say it, then." },
    { speaker: "Ilvar", text: "His first name alone is still Ilvar speaking." },
    { speaker: "Ilvar Thorne", text: "You came back.   How inefficient   of you." },
    { speaker: "Ilvar Thorne", text: "you came back. how inefficient of you." },
    { speaker: "Ilvar Thorne", text: "We both said this line, so nobody is asked it." },
    { speaker: "Cassian", text: "We both said this line, so nobody is asked it." },
    { speaker: "Ilvar Thorne", text: long },
    { speaker: "Cassian", text: "The canal ices over every winter, without fail." },
    { speaker: "Cassian", text: "I kept your letters in the clock tower drawer." },
    { speaker: "Rowan Hale", text: "Under his whole name, Rowan Hale is himself." },
  ];
  let n = 0;
  const cycle = (below: number) => n++ % below;
  const view = pickWhoSaidWhat(segments, units, "Mira Vale", cycle);
  assert.deepEqual(view.choices, [ILVAR, CASSIAN, "li-rowan-0003"], "in cast order, only who spoke");
  const asked = new Map(view.lines.map((line) => [line.text, line.li]));
  assert.equal(asked.size, view.lines.length, "each line once");
  const cut = [...asked.keys()].find((text) => text.startsWith("Ilvar: the lens"));
  assert.ok(cut && cut.length <= 161 && cut.endsWith("…") && !cut.endsWith(" …"), cut);
  assert.deepEqual(
    [...asked.entries()].filter(([text]) => text !== cut).sort(),
    [
      ["His first name alone is still Ilvar speaking.", ILVAR],
      ["I kept your letters in the clock tower drawer.", CASSIAN],
      ["The canal ices over every winter, without fail.", CASSIAN],
      ["Under his whole name, Rowan Hale is himself.", "li-rowan-0003"],
      ["You came back. How inefficient of you.", ILVAR],
    ].sort(),
    "no thought, narration, protagonist, other speaker, shared first name, short line or line two of them said",
  );

  // A random love interest each time: three lines of B's come up among 30 of A's.
  const many: Segment[] = [
    ...Array.from({ length: 30 }, (_, i) => ({
      speaker: "Ilvar",
      text: `Line number ${i + 1} from the dome, said by Ilvar.`,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      speaker: "Cassian",
      text: `Line number ${i + 1} from the canal, by Cassian.`,
    })),
  ];
  n = 0;
  const batch = pickWhoSaidWhat(many, units.slice(0, 2), "Mira Vale", cycle);
  assert.equal(batch.lines.length, WHO_SAID_WHAT_BATCH);
  assert.equal(batch.lines.filter((line) => line.li === CASSIAN).length, 3);
  assert.equal(new Set(batch.lines.map((line) => line.text)).size, WHO_SAID_WHAT_BATCH);
  // A protagonist who shares his first name: "Cassian" is her, so he has no line and there is no game.
  assert.deepEqual(pickWhoSaidWhat(many, units.slice(0, 2), "Cassian Grey"), { choices: [], lines: [] });

  // No game with one love interest who spoke, or too few lines.
  const empty = { choices: [], lines: [] };
  assert.deepEqual(pickWhoSaidWhat(many.slice(0, 30), units, "Mira Vale"), empty, "one love interest");
  assert.deepEqual(
    pickWhoSaidWhat([...many.slice(0, 3), ...many.slice(30, 32)], units, "Mira Vale"),
    empty,
    "five lines",
  );
  assert.deepEqual(pickWhoSaidWhat([...many.slice(0, 4), ...many.slice(30, 32)], units, "Mira Vale").lines.length, 6);

  // A long line with no space to cut at is cut by character: an emoji at the cut is kept whole, never split in half.
  const spaceless = { speaker: "Cassian", text: `${"あ".repeat(159)}😀${"い".repeat(20)}` };
  const served = pickWhoSaidWhat([spaceless, ...many.slice(0, 3), ...many.slice(30, 33)], units, "Mira Vale").lines;
  assert.deepEqual(
    served.filter((line) => line.text.startsWith("あ")),
    [{ li: CASSIAN, text: `${"あ".repeat(159)}😀…` }],
  );
});

test("with memory ready, every chapter is summarized into the overview; a love interest's own stays his beyond it", async () => {
  const t = await storyWorld({ runKey: "r-ready-aaaaaa", replies: Array.from({ length: 40 }, () => markerSummary) });
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "SHARED-QUAY: the lanterns along the quay go dark.",
    "2026-10-28T10:00:00.000Z",
  );
  // Mireille's route chapter, then Kai's date, completed after it.
  await completeChapter(
    t,
    { key: `route-${MIR}-2`, kind: "route", li: MIR, lead: MIR, stage: 2, title: "Mireille's Ledger" },
    "PRIVATE-LEDGER: Mireille shows Ines the forged pages of the harbour ledger.",
    "2026-10-28T11:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "date-1", kind: "date", li: KAI, lead: KAI, title: "Jellyfish Hour" },
    "KAI-DATE: Kai counts jellyfish under the pier lights.",
    "2026-10-28T12:00:00.000Z",
  );
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    assert.equal(await memory.maintain({ runId: t.runId }), true);
    assert.equal(await memorySettled(memory, t.runId), "ready");
    // A route chapter is the story's own chapter, a date is a side story (GF's Character Story); each is his own.
    const sources = await readMemorySources(t.store, t.runId);
    assert.deepEqual(
      sources.map((source) => [source.kind, source.title, source.audience ?? null]),
      [
        ["chapter", "Night 1", null],
        ["chapter", MIREILLE_LEDGER, [MIR]],
        ["character-story", KAI_DATE, [KAI]],
      ],
    );
    // Each one gets its detail summary and joins the overview of the whole timeline.
    const summarized = t.calls.flatMap((call) => {
      const source = JSON.parse(call.messages.at(-1)!.content).source;
      return source ? [source.id] : [];
    });
    assert.deepEqual(summarized, ["main-1", `route-${MIR}-2`, "date-1"]);
    const saved = t.fake.rows.get(memoryId(t.runId))!.data as { overview: { sources: Array<[string, string]> } };
    assert.deepEqual(
      saved.overview.sources.map(([key]) => JSON.parse(key)),
      [
        ["chapter", "main-1"],
        ["chapter", `route-${MIR}-2`],
        ["character-story", "date-1"],
      ],
    );

    // A plan's recall (P10, P11 and P5 recall with `cast` and a plan), a scene's (P6, P12) and a chat reply's (P17).
    const plan = (li: string, name: string) => ({
      job: "structured" as const,
      cast: [li],
      query: { plan: `${name} and the forged harbour ledger`, speakers: [name] },
    });
    for (const [who, hers] of [
      [{ job: "narration", cast: [KAI] }, false],
      [plan(KAI, "Kai"), false],
      [{ job: "narration", cast: [] }, false],
      [{ job: "chat", reader: KAI }, false],
      [{ job: "narration", cast: [MIR] }, true],
      [{ job: "narration", cast: [KAI, MIR] }, true],
      [plan(MIR, "Mireille"), true],
      [{ job: "chat", reader: MIR }, true],
    ] as const) {
      const { text } = await recallText({ store: t.store, memory, runtime: t.runtime }, t.runId, who);
      const label = JSON.stringify(who);
      // Everyone knows the whole timeline through the overview: her route chapter and his date as their summaries.
      assert.match(text, /# Canon to date\n[^\n]*SHARED-QUAY[^\n]*PRIVATE-LEDGER[^\n]*KAI-DATE/u, label);
      assert.ok(!text.includes("Canon in full"), `no chapter goes in word for word but the previous one, ${label}`);
      assert.equal(text.includes("forged pages"), hers, `her route's prose only as her previous chapter, ${label}`);
      // Beyond it, her route chapter reaches only a prompt for her: as the previous chapter in full there.
      const beyond = beyondOverview(text);
      assert.equal(beyond.includes("PRIVATE-LEDGER"), hers, `her route chapter beyond the overview, for ${label}`);
      assert.equal(beyond.includes("Mireille's Ledger"), hers, `its title, for ${label}`);
      if (hers) assert.ok(beyond.includes(`# Previous chapter in full: ${MIREILLE_LEDGER}\nPRIVATE-LEDGER`), label);
      else assert.match(beyond, /# Previous chapter in full: Night 1\nSHARED-QUAY/u, label);
    }

    // His date comes back for him as a small side memory, its summary, never its scenes; for her only in the overview.
    const asked = (reader: string) =>
      recallText({ store: t.store, memory, runtime: t.runtime }, t.runId, {
        job: "chat",
        reader,
        query: { cues: ["Do you remember the jellyfish under the pier?"] },
      });
    const kai = (await asked(KAI)).text;
    assert.ok(kai.includes(`# Recalled character-story: ${KAI_DATE}\nSUMMARY: KAI-DATE`), kai);
    assert.ok(!kai.includes("counts jellyfish"), "never its raw scenes");
    assert.ok(!beyondOverview((await asked(MIR)).text).includes("KAI-DATE"));
  } finally {
    memory.dispose();
  }
});

test("the previous chapter goes in whole, however long, when the model's window holds it", async () => {
  // About 15000 tokens of chapter on a 128k model: before #2039 only its last 12000 went in, whatever the window.
  const t = await storyWorld({
    runKey: "r-long-aaaaaa",
    replies: ['{"premise":"x"}'],
    model: { maxContext: 131_072, maxOutputTokens: null },
  });
  // A hundred lines of about 150 tokens each, as a narrator writes them.
  const lines = Array.from({ length: 100 }, (_, n) =>
    Array.from({ length: 100 }, (_, w) => `tide${(n * 100 + w) % 97}`).join(" "),
  );
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    ["LONG-START: the tide turns.", ...lines, "LONG-END: dawn."],
    "2026-10-28T10:00:00.000Z",
  );
  const memory = await recallText({ store: t.store }, t.runId, { job: "narration", cast: [KAI], continues: "main" });
  assert.ok(estimateTextTokens(memory.text) > 14_000, `a long chapter: ${estimateTextTokens(memory.text)} tokens`);
  assert.match(memory.text, /^# Previous chapter in full: Night 1\nLONG-START: the tide turns\./u);
  assert.ok(memory.text.includes("LONG-END: dawn."));
  const sent = [
    { role: "system" as const, content: "Reply with {premise}." },
    { role: "user" as const, content: `STORY MEMORY\n${memory.text}` },
  ];
  await generateJson(t.deps, {
    runId: t.runId,
    job: "narration",
    label: "long",
    messages: sent,
    memory,
    schema: z.object({ premise: z.string() }),
    temperature: 0.5,
    maxTokens: 600,
    debugMode: false,
    lane: "foreground",
  });
  assert.deepEqual(t.calls[0]!.messages, sent, "sent whole, with the whole reply room");
  assert.equal(t.calls[0]!.options?.maxTokens, 24_192);
});

test("a story saved by 0.6.16 catches up in the background: its own chapters are summarized into the overview", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const replies = Array.from({ length: 80 }, () => (messages: CapabilityLanguageModelMessage[]) => {
    if (system(messages).includes(SUMMARY_WORDING)) return markerSummary(messages);
    if (isPlanner(messages)) {
      return json(planReply({ title: "Night 3", ledger: { relationship: [], conflict: [], offscreen: [] } }));
    }
    return json(beatReply());
  });
  // Background upkeep waits at the Engine's admission until the test lets it through.
  const t = await storyWorld({
    runKey: "r-upgrade-aaaaaa",
    replies,
    model: {
      admissionRun: async (operation) => {
        await gate;
        return operation();
      },
    },
  });
  const route = `route-${MIR}-2`;
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "SHARED-QUAY: the lanterns go dark.",
    "2026-10-28T09:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: route, kind: "route", li: MIR, lead: MIR, stage: 2, title: "Mireille's Ledger" },
    "PRIVATE-LEDGER: Mireille shows Ines the forged pages.",
    "2026-10-28T10:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "date-1", kind: "date", li: KAI, lead: KAI, title: "Jellyfish Hour" },
    "KAI-DATE: Kai counts jellyfish under the pier lights.",
    "2026-10-28T11:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "main-2", kind: "main", number: 2, lead: KAI, title: "Night 2" },
    "SECOND-NIGHT: the bell rings at midnight.",
    "2026-10-28T12:00:00.000Z",
  );
  // The memory as 0.6.16 kept it: both main chapters summarized and in the overview; her route chapter and his date
  // stored word for word as `chat` records, out of the overview; ready.
  const key = (kind: string, id: string) => JSON.stringify([kind, id]);
  const old = {
    version: 1,
    records: [
      {
        id: "main-1",
        kind: "chapter",
        title: "Night 1",
        order: 10000,
        key: key("chapter", "main-1"),
        fingerprint: "fp-main-1",
        content: "SUMMARY: SHARED-QUAY",
      },
      {
        id: route,
        kind: "chat",
        title: MIREILLE_LEDGER,
        order: 15000,
        key: key("chat", route),
        fingerprint: "fp-route",
        content: "PRIVATE-LEDGER: Mireille shows Ines the forged pages.",
      },
      {
        id: "date-1",
        kind: "chat",
        title: KAI_DATE,
        order: 15001,
        key: key("chat", "date-1"),
        fingerprint: "fp-date",
        content: "KAI-DATE: Kai counts jellyfish under the pier lights.",
      },
      {
        id: "main-2",
        kind: "chapter",
        title: "Night 2",
        order: 20000,
        key: key("chapter", "main-2"),
        fingerprint: "fp-main-2",
        content: "SUMMARY: SECOND-NIGHT",
      },
    ],
    work: [],
    overview: {
      content: "OLD-OVERVIEW: SUMMARY: SHARED-QUAY SUMMARY: SECOND-NIGHT",
      sources: [
        [key("chapter", "main-1"), "fp-main-1"],
        [key("chapter", "main-2"), "fp-main-2"],
      ],
    },
    status: { phase: "ready", retryable: false, operationId: "op-0.6.16" },
  };
  const target = runDocTarget("memory", memoryId(t.runId));
  await t.fake.documents.create({
    ...target,
    packageId: "otome-forge",
    description: "",
    data: structuredClone(old),
    createdAt: "2026-10-28T12:00:00.000Z",
    updatedAt: "2026-10-28T12:00:00.000Z",
  });
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  t.deps.memory = memory;
  try {
    // Before the catch-up: recall answers at once, on the bounded canonical history, and queues the upkeep.
    const before = await recallText(t.deps, t.runId, { job: "narration", cast: [MIR], continues: "main" });
    assert.match(before.text, /# Previous chapter in full: Night 2\nSECOND-NIGHT/u);
    assert.ok(before.text.includes(`# Canon in full: ${MIREILLE_LEDGER}\nPRIVATE-LEDGER`));
    assert.equal((await memory.status(t.runId)).phase, "pending", "the catch-up is queued in the background");
    // A real prompt meanwhile: P5 is sent whole within the connection's context, the previous chapter in it.
    const sent = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const planner = t.calls.filter((call) => isPlanner(call.messages)).at(-1)!;
    assert.ok(planner.messages.at(-1)!.content.includes("# Previous chapter in full: Night 2\nSECOND-NIGHT"));
    // The Engine's own count (base-provider.ts: 6 a message, a margin of max(500, 2%)), so nothing of it is trimmed.
    const tokens = planner.messages.reduce((sum, message) => sum + estimateTextTokens(message.content) + 6, 0);
    const margin = Math.max(500, Math.ceil(32768 * 0.02));
    assert.ok(tokens + planner.options!.maxTokens! + margin <= 32768, "it fits the context window untrimmed");
    assert.ok(!t.calls.some((call) => system(call.messages).includes(SUMMARY_WORDING)), "no summary has run yet");

    release();
    assert.equal(await memorySettled(memory, t.runId), "ready");
    const saved = t.fake.rows.get(memoryId(t.runId))!.data as typeof old;
    // First canon stays canon: every 0.6.16 record is kept as it was; only the missing summaries are added.
    assert.deepEqual(saved.records.slice(0, 4), old.records);
    assert.deepEqual(
      saved.records.slice(4).map((record) => [record.key, record.content]),
      [
        [key("chapter", route), "SUMMARY: PRIVATE-LEDGER"],
        [key("character-story", "date-1"), "SUMMARY: KAI-DATE"],
      ],
    );
    // The overview is folded again over the whole timeline, her route and his date in their places.
    assert.deepEqual(
      saved.overview.sources.map(([source]) => source),
      [key("chapter", "main-1"), key("chapter", route), key("character-story", "date-1"), key("chapter", "main-2")],
    );
    // Recall now answers under the new rules: the overview, no chapter word for word but the previous one.
    const mir = (await recallText(t.deps, t.runId, { job: "narration", cast: [MIR], continues: "main" })).text;
    assert.match(mir, /# Canon to date\n[^\n]*PRIVATE-LEDGER[^\n]*KAI-DATE/u);
    assert.match(mir, /# Previous chapter in full: Night 2\nSECOND-NIGHT/u);
    assert.ok(!mir.includes("Canon in full") && !mir.includes("forged pages"));
    const kai = await recallText(t.deps, t.runId, {
      job: "chat",
      reader: KAI,
      query: { cues: ["Do you remember the jellyfish under the pier?"] },
    });
    assert.ok(kai.text.includes(`# Recalled character-story: ${KAI_DATE}\nSUMMARY: KAI-DATE`), kai.text);
  } finally {
    release();
    memory.dispose();
  }
});

/** How the story names Kai's route chapter "Kai's Lamp" (S/story/canon.ts titleOf). */
const KAI_ROUTE =
  "Kai's own route chapter \"Kai's Lamp\" (private: only the people in its scenes know what happened in it)";

test("the previous chapter in full is the last of the storyline the prompt continues, and what may give way", async () => {
  // No memory: the canonical history, GF's legacy one. Kai's date after Night 1, his route chapter after Night 2.
  const t = await storyWorld({ runKey: "r-storyline-aaaaaa", replies: [] });
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "NIGHT-ONE: the quay goes dark.",
    "2026-10-28T09:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "date-1", kind: "date", li: KAI, lead: KAI, title: "Jellyfish Hour" },
    "KAI-DATE: Kai counts jellyfish.",
    "2026-10-28T10:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "main-2", kind: "main", number: 2, lead: KAI, title: "Night 2" },
    "NIGHT-TWO: the bell rings.",
    "2026-10-28T11:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: `route-${KAI}-3`, kind: "route", li: KAI, lead: KAI, stage: 3, title: "Kai's Lamp" },
    "KAI-ROUTE: Kai lights the lamp for her.",
    "2026-10-28T12:00:00.000Z",
  );
  const recall = (options: Parameters<typeof recallText>[2]) => recallText({ store: t.store }, t.runId, options);
  const full = (title: string, text: string) => `# Canon in full: ${title}\n${text}`;
  // The main story's plans and scenes continue Night 2, his route's his route chapter; one who has none, Night 2; a
  // chat reply the newest he may know.
  for (const [options, previous] of [
    [{ cast: [KAI], continues: "main" }, "Night 2\nNIGHT-TWO"],
    [{ cast: [KAI], continues: KAI }, `${KAI_ROUTE}\nKAI-ROUTE`],
    [{ cast: [MIR], continues: MIR }, "Night 2\nNIGHT-TWO"],
    [{ reader: KAI }, `${KAI_ROUTE}\nKAI-ROUTE`],
  ] as const) {
    const { text } = await recall({ job: "structured", ...options });
    assert.ok(text.includes(`# Previous chapter in full: ${previous}`), `${JSON.stringify(options)}: ${text}`);
  }
  // GF's legacy rule: the previous chapter and all after it stay; what came before it may give way at the reply floor,
  // the storyline chapters first, then the dates, each oldest first.
  const main = await recall({ job: "structured", cast: [KAI], continues: "main" });
  assert.deepEqual(main.optional, [
    full("Night 1", "NIGHT-ONE: the quay goes dark."),
    full(KAI_DATE, "KAI-DATE: Kai counts jellyfish."),
  ]);
  assert.ok(main.text.includes(full(KAI_ROUTE, "KAI-ROUTE: Kai lights the lamp for her.")), "after it, it stays");
  const route = await recall({ job: "structured", cast: [KAI], continues: KAI });
  assert.deepEqual(route.optional, [
    full("Night 1", "NIGHT-ONE: the quay goes dark."),
    full("Night 2", "NIGHT-TWO: the bell rings."),
    full(KAI_DATE, "KAI-DATE: Kai counts jellyfish."),
  ]);

  // The newest of the others goes in however long, past the bound the older ones keep to.
  const long = Array.from({ length: 140 }, (_, n) =>
    Array.from({ length: 100 }, (_, w) => `lamp${(n + w) % 89}`).join(" "),
  );
  await completeChapter(
    t,
    { key: `route-${KAI}-4`, kind: "route", li: KAI, lead: KAI, stage: 4, title: "Kai's Long Watch" },
    ["LONG-WATCH-START", ...long, "LONG-WATCH-END"],
    "2026-10-28T13:00:00.000Z",
  );
  const after = await recall({ job: "structured", cast: [KAI], continues: "main" });
  assert.ok(estimateTextTokens(after.text) > 14_000, "a chapter past the bound");
  assert.ok(after.text.includes("LONG-WATCH-START") && after.text.includes("LONG-WATCH-END"), "kept whole");
  assert.ok(!after.optional.some((block) => block.includes("LONG-WATCH")), "after the previous chapter, so it stays");
});

test("with memory ready, recent canon is GF's: only older chapter summaries may give way, nothing twice", async () => {
  // The overview fold is refused, so everything but the newest chapter is recent canon beside the summaries.
  const replies = Array.from(
    { length: 40 },
    () => (messages: CapabilityLanguageModelMessage[]) =>
      JSON.parse(messages.at(-1)!.content).source ? markerSummary(messages) : "I can't help with summarizing this.",
  );
  const t = await storyWorld({ runKey: "r-lagging-aaaaaa", replies });
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "NIGHT-ONE: dark.",
    "2026-10-28T09:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "main-2", kind: "main", number: 2, lead: KAI, title: "Night 2" },
    "NIGHT-TWO: bell.",
    "2026-10-28T10:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "date-1", kind: "date", li: KAI, lead: KAI, title: "Jellyfish Hour" },
    "KAI-DATE: Kai counts jellyfish.",
    "2026-10-28T11:00:00.000Z",
  );
  await completeChapter(
    t,
    { key: "main-3", kind: "main", number: 3, lead: KAI, title: "Night 3" },
    "NIGHT-THREE: dawn.",
    "2026-10-28T12:00:00.000Z",
  );
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    assert.equal(await memory.maintain({ runId: t.runId }), true);
    assert.equal(await memorySettled(memory, t.runId), "error", "the overview never folded");
    const context = await recallText({ store: t.store, memory }, t.runId, {
      job: "structured",
      cast: [KAI],
      continues: "main",
    });
    for (const block of [
      "# Recent canon summary: Night 1\nSUMMARY: NIGHT-ONE",
      "# Recent canon summary: Night 2\nSUMMARY: NIGHT-TWO",
      `# Recent canon summary: ${KAI_DATE}\nSUMMARY: KAI-DATE`,
      "# Previous chapter in full: Night 3\nNIGHT-THREE: dawn.",
    ]) {
      assert.ok(context.text.includes(block), `${block}\n---\n${context.text}`);
    }
    // Night 2 is the newest chapter summary though his date is newer, and the date is a Character Story: both stay.
    assert.deepEqual(context.optional, ["# Recent canon summary: Night 1\nSUMMARY: NIGHT-ONE"]);
  } finally {
    memory.dispose();
  }

  // Memory caught up: the newest chapter is never repeated beside the overview when the prompt continues another one.
  const ready = await storyWorld({
    runKey: "r-covered-aaaaaa",
    replies: Array.from({ length: 40 }, () => markerSummary),
  });
  await completeChapter(
    ready,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "NIGHT-ONE: dark.",
    "2026-10-28T09:00:00.000Z",
  );
  await completeChapter(
    ready,
    { key: `route-${MIR}-2`, kind: "route", li: MIR, lead: MIR, stage: 2, title: "Mireille's Ledger" },
    "PRIVATE-LEDGER: Mireille shows Ines the forged pages of the harbour ledger.",
    "2026-10-28T10:00:00.000Z",
  );
  await completeChapter(
    ready,
    { key: "main-2", kind: "main", number: 2, lead: KAI, title: "Night 2" },
    "NIGHT-TWO: bell.",
    "2026-10-28T11:00:00.000Z",
  );
  await completeChapter(
    ready,
    { key: `route-${KAI}-3`, kind: "route", li: KAI, lead: KAI, stage: 3, title: "Kai's Lamp" },
    "KAI-ROUTE: Kai lights the lamp for her.",
    "2026-10-28T12:00:00.000Z",
  );
  const caught = createOtomeMemory({ runtime: ready.runtime, store: ready.store });
  try {
    assert.equal(await caught.maintain({ runId: ready.runId }), true);
    assert.equal(await memorySettled(caught, ready.runId), "ready");
    const recall = (options: Parameters<typeof recallText>[2]) =>
      recallText({ store: ready.store, memory: caught }, ready.runId, options);
    for (const options of [
      { job: "structured", cast: [KAI], continues: "main" },
      { job: "structured", cast: [KAI], continues: KAI },
    ] as const) {
      const { text } = await recall(options);
      assert.match(text, /# Canon to date\n[^\n]*NIGHT-TWO[^\n]*KAI-ROUTE/u, JSON.stringify(options));
      assert.ok(!text.includes("# Recent canon"), `the overview covers it: ${JSON.stringify(options)}\n${text}`);
    }
    // Another love interest's route chapter never comes back to Kai as a recalled detail, whatever the cue; for her
    // the same cue brings it back.
    const cued = (cast: string[]) =>
      recall({
        job: "narration",
        cast,
        continues: "main",
        query: { cues: ["the forged pages of the harbour ledger"] },
      });
    const kai = beyondOverview((await cued([KAI])).text);
    assert.ok(!kai.includes("PRIVATE-LEDGER") && !kai.includes("Mireille's Ledger"), kai);
    assert.ok((await cued([MIR])).text.includes(`# Recalled chapter: ${MIREILLE_LEDGER}\nSUMMARY: PRIVATE-LEDGER`));
  } finally {
    caught.dispose();
  }
});

test("dates a 0.6.16 story kept word for word wait on the bounded history, never all as written", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const t = await storyWorld({
    runKey: "r-olddates-aaaaaa",
    replies: Array.from({ length: 40 }, () => markerSummary),
    model: {
      admissionRun: async (operation) => {
        await gate;
        return operation();
      },
    },
  });
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    "NIGHT-ONE: dark.",
    "2026-10-28T09:00:00.000Z",
  );
  for (const [n, title, text] of [
    [1, "Jellyfish Hour", "KAI-DATE-ONE: Kai counts jellyfish."],
    [2, "Tide Pools", "KAI-DATE-TWO: Kai names the crabs."],
  ] as const) {
    await completeChapter(
      t,
      { key: `date-${n}`, kind: "date", li: KAI, lead: KAI, title },
      text,
      `2026-10-28T1${n}:00:00.000Z`,
    );
  }
  await completeChapter(
    t,
    { key: "main-2", kind: "main", number: 2, lead: KAI, title: "Night 2" },
    "NIGHT-TWO: bell.",
    "2026-10-28T13:00:00.000Z",
  );
  // As 0.6.16 kept it: the main chapters summarized and in the overview, the dates word for word as `chat` records.
  const key = (kind: string, id: string) => JSON.stringify([kind, id]);
  const record = (kind: string, id: string, order: number, content: string) => ({
    id,
    kind,
    title: id,
    order,
    key: key(kind, id),
    fingerprint: `fp-${id}`,
    content,
  });
  await t.fake.documents.create({
    ...runDocTarget("memory", memoryId(t.runId)),
    packageId: "otome-forge",
    description: "",
    data: {
      version: 1,
      records: [
        record("chapter", "main-1", 10000, "SUMMARY: NIGHT-ONE"),
        record("chat", "date-1", 15000, "KAI-DATE-ONE: Kai counts jellyfish."),
        record("chat", "date-2", 15001, "KAI-DATE-TWO: Kai names the crabs."),
        record("chapter", "main-2", 20000, "SUMMARY: NIGHT-TWO"),
      ],
      work: [],
      overview: {
        content: "SUMMARY: NIGHT-ONE SUMMARY: NIGHT-TWO",
        sources: [
          [key("chapter", "main-1"), "fp-main-1"],
          [key("chapter", "main-2"), "fp-main-2"],
        ],
      },
      status: { phase: "ready", retryable: false, operationId: "op-0.6.16" },
    },
    createdAt: "2026-10-28T13:00:00.000Z",
    updatedAt: "2026-10-28T13:00:00.000Z",
  });
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    const before = (
      await recallText({ store: t.store, memory }, t.runId, { job: "narration", cast: [KAI], continues: "main" })
    ).text;
    assert.ok(!before.includes("# Recent canon in full") && !before.includes("# Canon to date"), before);
    assert.ok(before.includes('# Canon in full: Kai\'s own date chapter "Tide Pools"'), "the bounded history instead");
    assert.equal((await memory.status(t.runId)).phase, "pending", "the catch-up is queued");
    release();
    assert.equal(await memorySettled(memory, t.runId), "ready");
    const after = (
      await recallText({ store: t.store, memory }, t.runId, { job: "narration", cast: [KAI], continues: "main" })
    ).text;
    assert.match(after, /# Canon to date\n[^\n]*KAI-DATE-ONE[^\n]*KAI-DATE-TWO/u);
    assert.ok(!after.includes("Canon in full") && !after.includes("names the crabs"), after);
  } finally {
    release();
    memory.dispose();
  }
});

test("what he learned in Read Me still comes back while the chapter just played has no summary yet", async () => {
  // Background upkeep never runs here, so the long chapter just completed keeps no summary.
  const t = await storyWorld({
    runKey: "r-readmelatest-aaaaaa",
    replies: [],
    model: { admissionRun: () => new Promise(() => undefined) },
  });
  const lines = Array.from({ length: 70 }, (_, n) =>
    Array.from({ length: 100 }, (_, w) => `wave${(n + w) % 83}`).join(" "),
  );
  await completeChapter(
    t,
    { key: "main-1", kind: "main", number: 1, lead: KAI, title: "Night 1" },
    lines,
    "2026-10-28T09:00:00.000Z",
  );
  const entry = (set: string, i: number, text: string): NotebookEntry => ({
    id: `${set}/${i}`,
    category: (["likes", "fears", "habits", "dreams"] as const)[i % 4]!,
    text,
    verdict: "right",
    at: "2026-10-28T08:00:00.000Z",
  });
  const known = [
    entry("rmold1", 0, "LIGHTHOUSE-NOTE: Ines climbs to the lighthouse lamp when she cannot sleep."),
    ...["rmset2", "rmset3", "rmset4"].flatMap((set) =>
      [0, 1, 2, 3].map((i) => entry(set, i, `${set}-${i}: Ines likes tea.`)),
    ),
  ];
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, known } },
  }));
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  try {
    const { text } = await recallText({ store: t.store, memory }, t.runId, {
      job: "narration",
      cast: [KAI],
      continues: "main",
      query: { cues: ["Ines cannot sleep, so she climbs toward the lighthouse lamp."] },
    });
    assert.ok(estimateTextTokens(text) > 6000 && text.includes("# Previous chapter in full: Night 1"), "sent in full");
    assert.ok(text.includes("likes: LIGHTHOUSE-NOTE"), "the chapter sent in full costs the side memories nothing");
  } finally {
    memory.dispose();
  }
});

test("the chapter plan, its scenes and its Confrontation hand their memory to the fit", async () => {
  // A connection with a 1M-token window, and memory recalled for a 60k one: the prompt fits the smaller with its whole
  // reply budget only once the recalled detail gives way. A caller that kept its memory from the fit would send it.
  const t = await storyWorld({
    runKey: "r-squeeze-aaaaaa",
    replies: router(),
    model: { maxContext: 1_000_000, maxOutputTokens: null },
  });
  t.deps.memory = squeezedMemory(60_000);
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  await readThrough(t, 0, 4);
  const served = await t.call("POST", beatPath, {}, node(5));
  assert.equal(served.status, 200, JSON.stringify(served.body));
  assert.ok(served.body.confrontation, "node 6 is the Confrontation");
  const prompts = [
    ["P5", t.calls.filter((call) => isPlanner(call.messages))],
    ["P6", t.calls.filter((call) => /Narrate node \d+ of/.test(call.messages.at(-1)!.content))],
    ["P12", t.calls.filter((call) => isConfrontationPrompt(call.messages))],
  ] as const;
  for (const [name, calls] of prompts) {
    assert.ok(calls.length, `${name} was sent`);
    for (const call of calls) {
      const text = call.messages.map((message) => message.content).join("\n");
      assert.ok(text.includes("SQUEEZED-OVERVIEW"), `${name} keeps the overview`);
      assert.ok(!text.includes("SQUEEZED-DETAIL"), `${name} lets the recalled detail give way`);
      assert.ok(call.options!.maxTokens! >= 24_192, `${name} keeps its whole reply budget`);
    }
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

test("the art hears of every beat: faces when served, places once when written, a rewrite's release", async () => {
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

/** #2046: a side-with reply between Kai and Mireille; `backs` per option, and a model's own effects on Kai's. */
const sideReply = (backs: unknown[] = [KAI, "Mireille"], kind = "small") =>
  beatReply({
    segments: [
      { speaker: "", text: "The tide map is spread across the lamp table.", place: "The Lamp Room" },
      { speaker: "Kai", text: "We take the tunnels. Tonight.", expression: "angry" },
      { speaker: "Mireille", text: "And drown in them? We wait for the ledger.", expression: "cold" },
    ],
    choices: [
      {
        kind,
        at: 2,
        options: [
          {
            text: "Back Kai's plan",
            selection: { kind: "dialogue", text: "We take the tunnels." },
            segments: kind === "big" ? [] : [{ speaker: "Kai", text: "KAI-BACKED: Finally, someone listens." }],
            backs: backs[0],
            effects: [{ li: KAI, trust: -1, affection: 999 }],
          },
          {
            text: "Side with Mireille",
            selection: { kind: "action", text: "You set your hand on the ledger beside Mireille's." },
            segments: kind === "big" ? [] : [{ speaker: "Mireille", text: "MIR-BACKED: Thank you." }],
            ...(backs.length > 1 ? { backs: backs[1] } : {}),
          },
        ],
      },
    ],
  });

test("Side with (#2046): the reply needs one small choice backing each love interest present", () => {
  const units = [
    { id: KAI, name: "Kai" },
    { id: MIR, name: "Mireille" },
    { id: SOL, name: "Sol" },
  ];
  const node = {
    i: 1,
    kind: "beat",
    guide: "They argue over the tunnels.",
    cast: [KAI, MIR],
    sideWith: true,
  } as ChapterNode;
  const context = {
    node,
    units,
    state: normalizeState({ lis: { [KAI]: {}, [MIR]: {} } }),
    last: false,
    sideWith: units.slice(0, 2),
  };
  const read = (reply: Record<string, any>) => normalizeBeatReply(reply as never, context);
  const ok = read(sideReply());
  assert.equal(typeof ok, "object", String(ok));
  if (typeof ok !== "string") {
    assert.deepEqual(ok.sideWith, { choice: "choice-1", backs: { "option-1": KAI, "option-2": MIR } }, "by id or name");
  }
  const rule =
    /this node is a side-with scene: it needs ONE small choice with exactly 2 options, one per love interest present \(Kai, Mireille\)/;
  assert.match(String(read(sideReply([KAI]))), rule);
  assert.match(String(read(sideReply([KAI]))), /option 2 must back a love interest present/);
  assert.match(
    String(read(sideReply([KAI, KAI]))),
    /option 2 must back a love interest present that no other option backs/,
  );
  assert.match(String(read(sideReply([KAI, SOL]))), /option 2 must back a love interest present/, "Sol is not here");
  assert.match(String(read(sideReply([KAI, "li-nobody-zz99"]))), /option 2 must back/);
  assert.match(String(read(beatReply())), /no option carries "backs"/);
  const twice = sideReply();
  twice.choices.push({ ...structuredClone(twice.choices[0]), at: 0 });
  assert.match(String(read(twice)), /only one choice may carry "backs"/);
  // A big choice may not end a node that is not the chapter's last; on the last, it is still no side-with choice.
  assert.match(
    String(normalizeBeatReply(sideReply(undefined, "big") as never, { ...context, last: true })),
    /must be a small one/,
  );
  // Three love interests present: Sol must be backed too.
  const three = { ...context, node: { ...node, cast: [KAI, MIR, SOL] }, sideWith: units };
  assert.match(String(normalizeBeatReply(sideReply() as never, three)), /exactly 3 options[^;]*; missing: Sol/);
  // Another small choice in the same scene stays allowed and keeps its own effects.
  const more = sideReply();
  more.choices.push({
    kind: "small",
    at: 0,
    options: [
      {
        text: "Pour the tea",
        selection: { kind: "action", text: "You pour." },
        segments: [{ speaker: "", text: "Steam." }],
      },
      { text: "Wait", selection: { kind: "action", text: "You wait." }, segments: [{ speaker: "", text: "Silence." }] },
    ],
  });
  const both = read(more);
  assert.equal(typeof both === "object" && both.sideWith?.choice, "choice-1");
  // An empty "backs" there (a JSON-mode reply filling every field it heard of) names no one, so it marks nothing.
  const blank = structuredClone(more);
  blank.choices[1].options[0].backs = null;
  blank.choices[1].options[1].backs = " ";
  const kept = read(blank);
  assert.equal(typeof kept === "object" && kept.sideWith?.choice, "choice-1", String(kept));
  // Without the node's side-with context, "backs" is just ignored.
  assert.equal(typeof normalizeBeatReply(sideReply() as never, { ...context, sideWith: undefined }), "object");
});

test("Side with (#2046): the P6 rule, with no softening; only on a main chapter's marked node", () => {
  const rule = sideWithInstruction(
    [
      { id: KAI, name: "Kai" },
      { id: MIR, name: "Mireille" },
    ],
    "Ines",
  );
  assert.match(rule, /SIDE WITH \(this node\): Kai \(id li-kai-ab12\), Mireille \(id li-mireille-cd34\) disagree here/);
  assert.match(rule, /exactly 2 options, one per love interest present/);
  assert.match(rule, /No option stays out of it, splits the difference or backs no one/);
  assert.match(rule, /"backs" field beside its "text" and "selection"/);
  assert.match(rule, /text: the pill's short intent, 2 to 6 words, addressed to the player/);
  assert.match(rule, /Leave "effects" out of that choice/);
  assert.doesNotMatch(rule, /civil|calm|gentle|respectful|non-graphic|tone it down|mild|polite/i);
});

test("Side with (#2046): the game sets its effects, the pick moves affection once, and the decisions name it", async () => {
  let sideCalls = 0;
  const t = await storyWorld({
    runKey: "r-side-aaaaaa",
    // Mireille stands at the floor of level 2: passing her over costs nothing she reached.
    lis: { [MIR]: { points: 300 } },
    replies: Array.from({ length: 60 }, () => (messages: CapabilityLanguageModelMessage[]) => {
      if (isPlanner(messages)) return json(planReply());
      if (isConfrontationPrompt(messages)) return json(confrontationReply());
      const at = Number(/Narrate node (\d+) of/.exec(messages.at(-1)!.content)?.[1] ?? 1) - 1;
      const repairing = messages.length > 2;
      if (at !== 1 && !repairing) return json(beatReply());
      sideCalls += 1;
      // The first try leaves Mireille's option without "backs": the repair turn names her.
      return json(sideCalls === 1 ? sideReply([KAI]) : sideReply());
    }),
  });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  // The plan marks node 1 (Kai and Mireille).
  await t.store.updateDoc(runDocTarget("chapter", chapterId(t.runId, "main-1")), normalizeChapter, (chapter) => ({
    ...chapter,
    nodes: chapter.nodes.map((node) => (node.i === 1 ? { ...node, sideWith: true as const } : node)),
  }));
  await readThrough(t, 0, 0);
  const served = await t.call("POST", beatPath, {}, node(1));
  assert.equal(served.status, 200, JSON.stringify(served.body));
  const sideCall = t.calls.find((entry) => /Narrate node 2 of/.test(entry.messages.at(-1)!.content))!;
  assert.match(system(sideCall.messages), /SIDE WITH \(this node\): Kai \(id li-kai-ab12\), Mireille/);
  assert.doesNotMatch(
    system(t.calls.find((entry) => /Narrate node 1 of/.test(entry.messages.at(-1)!.content))!.messages),
    /SIDE WITH/,
  );
  assert.match(
    t.calls
      .filter((entry) => /Narrate node 2 of/.test(entry.messages[1]?.content ?? ""))
      .at(-1)!
      .messages.at(-1)!.content,
    /side-with scene[\s\S]*option 2 must back a love interest present/,
    "the repair turn names what is missing",
  );
  assert.deepEqual(served.body.beat.sideWith, { choice: "choice-1", backs: { "option-1": KAI, "option-2": MIR } });
  assert.equal(served.body.beat.effects, undefined, "effects never reach the client");
  const stored = (await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat))!;
  assert.deepEqual(
    stored.effects["choice-1"],
    {
      "option-1": [
        { li: KAI, trust: 1, affection: 30 },
        { li: MIR, tension: 1, affection: -10 },
      ],
      "option-2": [
        { li: MIR, trust: 1, affection: 30 },
        { li: KAI, tension: 1, affection: -10 },
      ],
    },
    "the model's own effects (trust -1, affection 999) are replaced by the game's",
  );

  const choose = (option: string) => t.call("POST", `${beatPath}/choose`, { choice: "choice-1", option }, node(1));
  const before = await t.state();
  const picked = await choose("option-1");
  assert.equal(picked.status, 200, JSON.stringify(picked.body));
  assert.deepEqual(picked.body.affection, [{ li: KAI, amount: 30 }], "Mireille keeps the level she reached");
  const after = await t.state();
  assert.equal(after.lis[KAI]!.points, before.lis[KAI]!.points + 30);
  assert.equal(after.lis[KAI]!.trust, 1);
  assert.equal(after.lis[MIR]!.points, 300);
  assert.equal(after.lis[MIR]!.tension, 1);
  assert.equal(after.lis[SOL]!.points, before.lis[SOL]!.points, "Sol was not in the scene");
  const replay = await choose("option-2");
  assert.deepEqual([replay.body.affection, replay.body.remembered], [[], false], "a replay moves nothing");
  assert.deepEqual(replay.body.beat.choiceCanon, { "choice-1": "option-1" });
  assert.deepEqual(await t.state(), after);

  const canon = canonicalSegments((await t.store.readDoc(beatId(t.runId, "main-1", 1), normalizeBeat))!, "Ines")!;
  assert.deepEqual(
    canon.slice(3).map((segment) => segment.text),
    [
      "[Canonical player choice by Ines: Back Kai's plan.]",
      "We take the tunnels.",
      "KAI-BACKED: Finally, someone listens.",
    ],
    "the pick is canon like any other; the option not taken never is",
  );
  await readThrough(t, 1, 6);
  assert.ok((await t.state()).chapters["main-1"]!.completed, "the chapter is done");
  const { text } = await recallText({ store: t.store }, t.runId, { job: "narration", cast: [SOL], continues: "main" });
  const decisions = text.slice(text.indexOf(DECISIONS_HEADING));
  assert.ok(
    decisions.includes(
      `- Chapter 1 "The Dark Quay", node 2: sided with Kai over Mireille: Back Kai's plan. (dialogue: We take the tunnels.)`,
    ),
    decisions,
  );
  assert.ok(!text.includes("MIR-BACKED"), "the branch not taken never reaches a prompt");
  const [source] = await readMemorySources(t.store, t.runId);
  assert.ok(source!.content.includes("[Canonical player choice by Ines: Back Kai's plan.]"), "it is summarized too");
});
