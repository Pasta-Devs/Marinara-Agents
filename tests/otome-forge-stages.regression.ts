// Otome Forge's arcs (M2b): the stage table is pinned; a route chapter opens at its affection level and never during a
// rupture; its plan keeps the shape (4–6 nodes, him in each, the gate last, a stage-4 gate reveals his secret, a
// stage-5 chapter holds a confrontation and its gate a big choice); the stage moves only when the gate is first read
// to its end, once, with its timeline entry and the route chapter's grants; a rupture locks route chapters until a
// repair chapter's resolving node is read (a pick in it that forgives the rupture still reports the repair); nothing
// unlocked is taken back; P10 and P11 carry the knowledge boundary, and no plan (P5, P10, P11) sees another love
// interest's own chapter through the ledgers, conflicts, grievances or disclosures it left.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type {
  Grievance,
  LiState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  COMPOSURE_MAX,
  COMPOSURE_MIN,
  COMPOSURE_START,
  CONFRONTATION_ROUNDS,
  REPAIR_NODES_MAX,
  REPAIR_NODES_MIN,
  ROUTE_NODES_MAX,
  ROUTE_NODES_MIN,
  STAGES,
  WALKOUT_RUPTURE_TRUST,
  routeStatus,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/arcs.ts";
import {
  beatId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeBeat } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { otomeSceneCard } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/scene-card.ts";
import { normalizeBeatReply } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/beats.ts";
import {
  readBeat,
  readChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/canon.ts";
import {
  KAI,
  MIR,
  SOL,
  at,
  beatReply,
  bible,
  confrontationReply,
  isConfrontationPrompt,
  json,
  planReply,
  storyWorld,
} from "./fixtures/otome-forge-story.ts";

type World = Awaited<ReturnType<typeof storyWorld>>;
type Messages = CapabilityLanguageModelMessage[];

const system = (messages: Messages) => messages[0]!.content;
const user = (messages: Messages) => messages.at(-1)!.content;
const beatPath = "/runs/:run/chapters/:key/beats/:i";
const labels = (t: World, label: string) =>
  t.logs.filter((entry) => entry.level === "debugOverride" && entry.args[0] === label).length;
const calls = (t: World, needle: string) => t.calls.filter((call) => system(call.messages).includes(needle));
const mentions = (messages: Messages, pattern: RegExp) => messages.some((message) => pattern.test(message.content));

/** A valid P10 reply for Kai: four nodes, him in each, Mireille in one. */
function routePlan(changes: Record<string, unknown> = {}) {
  return {
    title: "The North Light",
    tags: [],
    summary: "Kai takes her up to the lamp.",
    nodes: [
      { kind: "beat", guide: "Kai at the lamp, pretending not to wait.", cast: [KAI] },
      { kind: "moment", moment: "read-him", guide: "She reads his face at the bell.", cast: [KAI] },
      { kind: "beat", guide: "Mireille interrupts with the ledger.", cast: [KAI, "Mireille"] },
      { kind: "beat", guide: "The gate: the mask cracks for one breath.", cast: [KAI] },
    ],
    ledger: { relationship: [{ li: KAI, line: "He let her into the lamp room." }], conflict: [], offscreen: [] },
    ...changes,
  };
}

/** A valid P11 reply: two quiet nodes with Kai. */
function repairPlan(changes: Record<string, unknown> = {}) {
  return {
    title: "Low Tide",
    tags: [],
    summary: "Kai comes back to the quay.",
    nodes: [
      { kind: "beat", guide: "He waits at the quay, not apologizing.", cast: [KAI] },
      { kind: "beat", guide: "It costs him: he tells her why he walked.", cast: [KAI] },
    ],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    ...changes,
  };
}

/** A terminal beat that ends on one big choice. */
const bigChoiceBeat = () =>
  beatReply({
    choices: [
      {
        kind: "big",
        at: 2,
        options: [
          { text: "Stay with him", selection: { kind: "dialogue", text: "I'm staying." }, segments: [] },
          { text: "Leave the light", selection: { kind: "action", text: "You go down the stairs." }, segments: [] },
        ],
      },
    ],
  });

/**
 * Answers the route planner with `route()`, the repair planner with `repair()`, the chapter planner with the fixture's
 * plan, every narrator with `beat(i)`.
 */
function router({
  route = () => routePlan(),
  repair = () => repairPlan(),
  beat = () => beatReply(),
}: {
  route?: (messages: Messages) => Record<string, unknown>;
  repair?: (messages: Messages) => Record<string, unknown>;
  beat?: (i: number, messages: Messages) => Record<string, unknown>;
} = {}) {
  return Array.from({ length: 80 }, () => (messages: Messages) => {
    if (system(messages).includes("route planner")) return json(route(messages));
    if (system(messages).includes("repair planner")) return json(repair(messages));
    if (system(messages).includes("chapter planner")) return json(planReply());
    if (isConfrontationPrompt(messages)) return json(confrontationReply());
    // The node from the narrator's own prompt (a repair turn ends on its note instead).
    const prompt = messages.find((message) => message.role === "user" && /Narrate node/.test(message.content));
    const i = Number(/Narrate node (\d+) of/.exec(prompt?.content ?? "")?.[1] ?? 1) - 1;
    return json(beat(i, messages));
  });
}

const POINTS_FOR_LEVEL = (level: number) => (level - 1) * 300;

async function arcWorld(runKey: string, kai: Partial<LiState>, replies = router()) {
  return storyWorld({ runKey, replies, lis: { [KAI]: kai } });
}

/** Opens his next route chapter and reads every node to its end (big choices take their first option). */
async function playRoute(t: World, li = KAI) {
  const planned = await t.call("POST", "/runs/:run/routes/:li/next", {}, { li });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const key = planned.body.chapter.key as string;
  const reads = [];
  for (let i = 0; i < planned.body.chapter.nodes.length; i += 1) {
    const params = { key, i: String(i) };
    const served = await t.call("POST", beatPath, {}, params);
    assert.equal(served.status, 200, JSON.stringify(served.body));
    for (let round = 1; served.body.confrontation && round <= 3; round += 1) {
      assert.equal((await t.call("POST", `${beatPath}/stance`, { round, stance: "hold" }, params)).status, 200);
    }
    for (const choice of served.body.beat.choices) {
      await t.call("POST", `${beatPath}/choose`, { choice: choice.id, option: "option-1" }, params);
    }
    reads.push(await t.call("POST", `${beatPath}/read`, { segment: 99 }, params));
  }
  await t.settle();
  return { key, chapter: planned.body.chapter, reads };
}

test("the stage table, node counts and Confrontation numbers are pinned", () => {
  assert.deepEqual(
    STAGES.map(({ stage, name, unlockLevel, gate }) => [stage, name, unlockLevel, gate]),
    [
      [1, "mask", null, null],
      [2, "crack", 3, "gate"],
      [3, "pull", 5, "gate"],
      [4, "wound", 7, "reveal"],
      [5, "reckoning", 8, "confrontation"],
      [6, "bond", 10, "finale"],
    ],
  );
  assert.deepEqual(
    STAGES.map((row) => row.balance),
    [
      "Mask 90 / self 10",
      "Mask 75 / self 25",
      "Mask 60 / self 40",
      "The mask breaks",
      "Mask 40 / self 60",
      "Changed toward the protagonist only",
    ],
  );
  assert.deepEqual([ROUTE_NODES_MIN, ROUTE_NODES_MAX, REPAIR_NODES_MIN, REPAIR_NODES_MAX], [4, 6, 2, 3]);
  assert.deepEqual(
    [CONFRONTATION_ROUNDS, COMPOSURE_START, COMPOSURE_MIN, COMPOSURE_MAX, WALKOUT_RUPTURE_TRUST],
    [3, 2, 0, 4, -2],
  );
  // Each route chapter opens at its level, never while a rupture stands, and stage 6 has none.
  const at = (stage: number, level: number, rupture: unknown = null) =>
    routeStatus(KAI, { stage, points: POINTS_FOR_LEVEL(level), rupture }).next;
  assert.deepEqual(at(1, 2), {
    stage: 2,
    key: `route-${KAI}-2`,
    unlocked: false,
    requires: { level: 3 },
    blockedBy: null,
  });
  assert.equal(at(1, 3)!.unlocked, true);
  assert.equal(at(2, 4)!.unlocked, false);
  assert.equal(at(2, 5)!.unlocked, true);
  assert.equal(at(3, 7)!.unlocked, true);
  assert.equal(at(4, 7)!.unlocked, false, "stage 5 needs level 8");
  assert.equal(at(4, 8)!.unlocked, true);
  assert.equal(at(5, 9)!.unlocked, false);
  assert.equal(at(5, 10)!.unlocked, true);
  assert.deepEqual(at(1, 10, { grievanceId: "g", since: "x" }), {
    stage: 2,
    key: `route-${KAI}-2`,
    unlocked: false,
    requires: { level: 3 },
    blockedBy: "rupture",
  });
  assert.equal(at(6, 10), null);
});

test("a route chapter opens at its level, plans once, and only its gate moves the stage, once", async () => {
  const t = await arcWorld("r-gate-aaaaaa", { points: POINTS_FOR_LEVEL(2) });
  const early = await t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI });
  assert.equal(early.status, 409);
  assert.equal(early.body.code, "locked");
  assert.equal(t.calls.length, 0, "a locked route chapter never calls the model");

  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, points: POINTS_FOR_LEVEL(3) } },
  }));
  const story = await t.call("GET", "/runs/:run/story");
  assert.deepEqual(story.body.routes[0], {
    li: KAI,
    stage: 1,
    next: { stage: 2, key: `route-${KAI}-2`, unlocked: true, requires: { level: 3 }, blockedBy: null },
  });
  assert.deepEqual(story.body.repairs, []);

  // Two taps at once plan it once.
  const [first, second] = await Promise.all([
    t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI }),
    t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI }),
  ]);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(second.body, first.body);
  assert.equal(labels(t, `route-plan/route-${KAI}-2`), 1);
  const chapter = (await readChapter(t.store, t.runId, `route-${KAI}-2`))!;
  assert.equal(chapter.kind, "route");
  assert.equal(chapter.li, KAI);
  assert.equal(chapter.stage, 2);
  assert.equal(chapter.foil, undefined, "a route chapter has no Foil");
  assert.deepEqual(
    chapter.nodes.map((node) => !!node.gate),
    [false, false, false, true],
    "the gate is the last node",
  );
  assert.equal(first.body.chapter.nodes.at(-1).gate, true, "the client sees which node is the gate");
  assert.equal(first.body.chapter.nodes.at(-1).reveals, undefined, "never which secrets it reveals");

  // P10: the stage line, the planner contract and the knowledge boundary.
  const [planner] = calls(t, "route planner");
  assert.match(system(planner!.messages), /MAY move Kai from stage 1 \(Mask\) to stage 2 \(Crack\)/);
  assert.ok(system(planner!.messages).includes(forgeKnowledgeBoundary));
  assert.match(system(planner!.messages), /CONTENT CONTRACT/);

  // Reading every node but the gate leaves the stage; reading the gate moves it, with its grants.
  const key = `route-${KAI}-2`;
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await t.call("POST", beatPath, {}, { key, i: String(i) })).status, 200);
    await t.call("POST", `${beatPath}/read`, { segment: 99 }, { key, i: String(i) });
    assert.equal((await t.state()).lis[KAI]!.stage, 1, `node ${i + 1} is not the gate`);
  }
  assert.equal((await t.call("POST", beatPath, {}, { key, i: "3" })).status, 200);
  const gatePrompt = t.calls.filter((call) => /Narrate node 4 of 4/.test(user(call.messages))).at(-1)!;
  assert.match(user(gatePrompt.messages), /This node is the GATE of Kai's route/);
  assert.ok(!user(gatePrompt.messages).includes("HIDDEN-TRUTH"), "a stage-2 gate reveals no stage-4 secret");
  const [read, again] = await Promise.all([
    t.call("POST", `${beatPath}/read`, { segment: 99 }, { key, i: "3" }),
    t.call("POST", `${beatPath}/read`, { segment: 99 }, { key, i: "3" }),
  ]);
  const moved = [read, again].filter((result) => result.body.stageUp);
  assert.equal(moved.length, 1, "two reads of the gate move the stage once");
  assert.deepEqual(moved[0]!.body.stageUp, { li: KAI, stage: 2 });
  const state = await t.state();
  assert.equal(state.lis[KAI]!.stage, 2);
  assert.deepEqual(
    state.timeline.map(({ li, kind, ref }) => ({ li, kind, ref })),
    [{ li: KAI, kind: "stage-2", ref: key }],
  );
  assert.equal(state.wallet.starlight, 2000 + 4 * 30 + 300, "four beats and the route chapter's 300");
  assert.equal(state.lis[KAI]!.points, POINTS_FOR_LEVEL(3) + 150, "the route chapter's 150 affection");
  assert.equal(state.lis[MIR]!.points, 0, "no Foil is paid");
  const after = await t.call("GET", "/runs/:run/story");
  assert.deepEqual(after.body.routes[0].stage, 2);
  assert.deepEqual(after.body.routes[0].next, {
    stage: 3,
    key: `route-${KAI}-3`,
    unlocked: false,
    requires: { level: 5 },
    blockedBy: null,
  });
  assert.deepEqual(
    after.body.chapters.find((entry: { key: string }) => entry.key === key),
    {
      key,
      kind: "route",
      title: "The North Light",
      li: KAI,
      stage: 2,
      lead: KAI,
      state: "done",
      beatsRead: 4,
      nodes: 4,
    },
  );
  // A tap on the finished route chapter's stage opens nothing new (its key is done; the next one is locked).
  assert.equal((await t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI })).status, 409);
});

test("a route plan keeps the shape; a stage-4 gate reveals his secret; stage 5 needs a confrontation and a big choice", async () => {
  // Stage 4: the gate reveals the stage-4 secret; a plan without him in every node gets the repair turn.
  let routeCalls = 0;
  const t = await arcWorld(
    "r-four-aaaaaa",
    { stage: 3, points: POINTS_FOR_LEVEL(7) },
    router({
      route: () =>
        (routeCalls += 1) === 1
          ? routePlan({ nodes: routePlan().nodes.map((node, i) => (i === 1 ? { ...node, cast: [SOL] } : node)) })
          : routePlan({ title: "The Dark Lamp" }),
    }),
  );
  const { key, reads } = await playRoute(t);
  const planners = calls(t, "route planner");
  assert.equal(planners.length, 2, "a plan that leaves him out of a node gets the one repair turn");
  assert.match(user(planners[1]!.messages), /must be in every node/);
  assert.match(user(planners[0]!.messages), /The gate reveals this secret of Kai.*HIDDEN-TRUTH/);
  const chapter = (await readChapter(t.store, t.runId, key))!;
  assert.deepEqual(chapter.nodes.at(-1)!.reveals, ["north-light"]);
  const gate = t.calls.filter((call) => /Narrate node 4 of 4/.test(user(call.messages))).at(-1)!;
  assert.ok(user(gate.messages).includes("HIDDEN-TRUTH"), "the gate's narrator is told the secret to reveal");
  for (const call of t.calls.filter((entry) => /Narrate node [123] of 4/.test(user(entry.messages)))) {
    assert.ok(!user(call.messages).includes("HIDDEN-TRUTH"), "no node before the gate is told it");
  }
  assert.deepEqual(reads.at(-1)!.body.stageUp, { li: KAI, stage: 4 });
  const state = await t.state();
  assert.deepEqual(state.lis[KAI]!.revealed, ["north-light"]);
  const unit = { name: "Kai", pronouns: { subject: "he", object: "him", possessive: "his" }, bible: bible() };
  assert.match(otomeSceneCard(unit, state.lis[KAI]!), /The protagonist knows: HIDDEN-TRUTH/);

  // Stage 5: a plan with no confrontation gets the repair turn; the gate must end on a big choice.
  let fiveCalls = 0;
  let gateCalls = 0;
  const five = await arcWorld(
    "r-five-aaaaaa",
    { stage: 4, points: POINTS_FOR_LEVEL(8) },
    router({
      route: () =>
        (fiveCalls += 1) === 1
          ? routePlan()
          : routePlan({
              nodes: [
                ...routePlan().nodes.slice(0, 2),
                { kind: "confrontation", guide: "She confronts him about the bell.", cast: [KAI] },
                routePlan().nodes[3],
              ],
            }),
      beat: (i) => (i === 3 && (gateCalls += 1) === 1 ? beatReply() : i === 3 ? bigChoiceBeat() : beatReply()),
    }),
  );
  const played = await playRoute(five);
  assert.match(user(calls(five, "route planner")[1]!.messages), /needs exactly one confrontation node before the gate/);
  assert.deepEqual(
    played.chapter.nodes.map((node: { kind: string; gate?: boolean }) => [node.kind, !!node.gate]),
    [
      ["beat", false],
      ["moment", false],
      ["confrontation", false],
      ["beat", true],
    ],
  );
  assert.equal(labels(five, `confrontation/${played.key}/2`), 1, "the stance game is written in one call");
  const gates = five.calls.filter((call) =>
    call.messages.some((message) => /Narrate node 4 of 4/.test(message.content)),
  );
  assert.equal(gates.length, 2, "a stage-5 gate without a big choice gets the one repair turn");
  assert.match(user(gates[0]!.messages), /End this node on ONE BIG choice/);
  assert.match(user(gates[1]!.messages), /must end on ONE big choice/);
  assert.deepEqual(played.reads.at(-1)!.body.stageUp, { li: KAI, stage: 5 });
  // The rule itself, without the routes.
  const context = {
    node: { ...played.chapter.nodes[3], guide: "", cast: [KAI] },
    units: [{ id: KAI, name: "Kai" }],
    state: await five.state(),
    last: true,
    mustChoose: true,
  };
  assert.match(String(normalizeBeatReply(beatReply() as never, context)), /must end on ONE big choice/);
  assert.equal(typeof normalizeBeatReply(bigChoiceBeat() as never, context), "object");
  assert.equal(typeof normalizeBeatReply(beatReply() as never, { ...context, mustChoose: false }), "object");

  // The confrontation can never be the gate.
  const gateFight = await arcWorld(
    "r-gfgt-aaaaaa",
    { stage: 1, points: POINTS_FOR_LEVEL(3) },
    router({
      route: () =>
        routePlan({
          nodes: [...routePlan().nodes.slice(0, 3), { kind: "confrontation", guide: "Fight.", cast: [KAI] }],
        }),
    }),
  );
  const refused = await gateFight.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI });
  assert.equal(refused.status, 502);
  assert.match(user(calls(gateFight, "route planner")[1]!.messages), /cannot be the confrontation/);
});

const ruptureOf = (id = "g-main-1-2-0"): { grievances: Grievance[]; rupture: LiState["rupture"] } => ({
  grievances: [
    {
      id,
      li: KAI,
      by: "li",
      text: "She sold his secret to the harbour master.",
      severity: "rupture",
      opened: "main-1/2",
      status: "open",
    },
  ],
  rupture: { grievanceId: id, since: at },
});

test("a rupture locks his route chapters until a repair chapter's resolving node is read", async () => {
  const t = await arcWorld("r-rupt-aaaaaa", { points: POINTS_FOR_LEVEL(3) });
  // His route chapter is planned and its first beat served before the rupture opens.
  const planned = await t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI });
  assert.equal(planned.status, 200);
  const key = planned.body.chapter.key as string;
  assert.equal((await t.call("POST", beatPath, {}, { key, i: "0" })).status, 200);
  await t.settle();
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, ...ruptureOf() } },
  }));

  // The beat on screen can still be finished; no beat after it opens, and nothing new is planned.
  assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, { key, i: "0" })).status, 200);
  const served = await t.call("POST", beatPath, {}, { key, i: "1" });
  assert.equal(served.status, 409);
  assert.equal(served.body.code, "locked");
  // Nor can a beat never written be eased off past the lock (the one the lookahead wrote is set aside here).
  const lookahead = await readBeat(t.store, t.runId, key, 1);
  await t.store.removeDoc(beatId(t.runId, key, 1));
  const skipped = await t.call("POST", `${beatPath}/ease-off`, { segment: 0 }, { key, i: "1" });
  assert.equal(skipped.status, 409);
  assert.equal(skipped.body.code, "locked");
  assert.equal((await t.state()).chapters[key]!.beatsRead, 1);
  if (lookahead) await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, key, 1)), normalizeBeat, () => lookahead);
  const story = await t.call("GET", "/runs/:run/story");
  assert.equal(story.body.routes[0].next.blockedBy, "rupture");
  assert.equal(story.body.routes[0].next.unlocked, false);
  assert.deepEqual(story.body.repairs, [{ li: KAI, key: `repair-${KAI}-1` }]);
  assert.ok(
    story.body.next.candidates.some((candidate: { li: string; reason: string }) => candidate.li === KAI),
    "main chapters go on, and his conflict is the ripest",
  );

  // Make it right: P11, two nodes, the last resolving the rupture; two taps plan it once.
  const [repair, again] = await Promise.all([
    t.call("POST", "/runs/:run/repairs/:li", {}, { li: KAI }),
    t.call("POST", "/runs/:run/repairs/:li", {}, { li: KAI }),
  ]);
  assert.equal(repair.status, 200, JSON.stringify(repair.body));
  assert.deepEqual(again.body, repair.body);
  assert.equal(labels(t, `repair-plan/repair-${KAI}-1`), 1);
  const [planner] = calls(t, "repair planner");
  assert.match(system(planner!.messages), /The repair costs Kai something; it doesn't erase what happened\./);
  assert.ok(system(planner!.messages).includes(forgeKnowledgeBoundary));
  assert.match(user(planner!.messages), /She sold his secret/);
  const repairKey = repair.body.chapter.key as string;
  const chapter = (await readChapter(t.store, t.runId, repairKey))!;
  assert.equal(chapter.kind, "repair");
  assert.equal(chapter.grievance, "g-main-1-2-0");
  assert.deepEqual(chapter.nodes.at(-1)!.resolves, ["g-main-1-2-0"]);
  assert.equal(repair.body.chapter.grievance, undefined, "the client never sees which grievance it is for");
  assert.equal((await t.call("GET", "/runs/:run/story")).body.repairs[0].key, repairKey);

  // Reading the first node changes nothing; the resolving node closes the rupture.
  assert.equal((await t.call("POST", beatPath, {}, { key: repairKey, i: "0" })).status, 200);
  await t.call("POST", `${beatPath}/read`, { segment: 99 }, { key: repairKey, i: "0" });
  assert.ok((await t.state()).lis[KAI]!.rupture, "only the resolving node repairs it");
  const narrator = t.calls.filter((call) => /Narrate node 1 of 2/.test(user(call.messages))).at(-1)!;
  assert.match(user(narrator.messages), /This is a REPAIR chapter.*She sold his secret/);
  assert.equal((await t.call("POST", beatPath, {}, { key: repairKey, i: "1" })).status, 200);
  const healed = await t.call("POST", `${beatPath}/read`, { segment: 99 }, { key: repairKey, i: "1" });
  assert.equal(healed.body.repaired, KAI);
  const state = await t.state();
  assert.equal(state.lis[KAI]!.rupture, null);
  assert.equal(state.lis[KAI]!.grievances[0]!.status, "addressed");
  assert.equal(state.lis[KAI]!.stage, 1, "a repair moves no stage");
  const after = await t.call("GET", "/runs/:run/story");
  assert.deepEqual(after.body.repairs, []);
  assert.equal(after.body.routes[0].next.unlocked, true);
  // His route chapter goes on from where it paused.
  assert.equal((await t.call("POST", beatPath, {}, { key, i: "1" })).status, 200);
  assert.equal(
    (await t.call("POST", "/runs/:run/repairs/:li", {}, { li: KAI })).status,
    409,
    "nothing is left to repair",
  );
});

/** A beat whose one small choice's first option opens a rupture with Kai. */
const ruptureChoiceBeat = () =>
  beatReply({
    choices: [
      {
        kind: "small",
        at: 2,
        options: [
          {
            text: "Sell him out",
            selection: { kind: "dialogue", text: "I told the harbour master." },
            segments: [{ speaker: "Kai", text: "Get out.", expression: "angry" }],
            effects: [{ li: KAI, grievance: { by: "li", text: "She sold him out.", severity: "rupture" } }],
          },
          {
            text: "Stay",
            selection: { kind: "action", text: "You stay." },
            segments: [{ speaker: "", text: "Quiet." }],
          },
        ],
      },
    ],
  });

test("a rupture keeps a gate the lookahead wrote shut, Ease off included, and still replays what was read", async () => {
  const t = await arcWorld(
    "r-shut-aaaaaa",
    { points: POINTS_FOR_LEVEL(3) },
    router({ beat: (i) => (i === 2 ? ruptureChoiceBeat() : beatReply()) }),
  );
  const planned = await t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI });
  const key = planned.body.chapter.key as string;
  const at = (i: number) => ({ key, i: String(i) });
  for (const i of [0, 1]) {
    assert.equal((await t.call("POST", beatPath, {}, at(i))).status, 200);
    assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, at(i))).status, 200);
  }
  const served = await t.call("POST", beatPath, {}, at(2));
  await t.settle();
  assert.ok(await readBeat(t.store, t.runId, key, 3), "the lookahead wrote the gate before the pick");
  const choice = served.body.beat.choices[0].id;
  await t.call("POST", `${beatPath}/choose`, { choice, option: "option-1" }, at(2));
  assert.ok((await t.state()).lis[KAI]!.rupture, "the pick opened a rupture");
  // The scene the rupture opened in opens again (a reload) and is finished.
  assert.equal((await t.call("POST", beatPath, {}, at(2))).status, 200);
  assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, at(2))).status, 200);
  const before = await t.state();

  // His gate stays shut whichever way it is asked for: served, eased off (the declined panel's offer) or read.
  for (const [path, body] of [
    [beatPath, {}],
    [`${beatPath}/ease-off`, { segment: 0 }],
    [`${beatPath}/read`, { segment: 99 }],
  ] as const) {
    const refused = await t.call("POST", path, body, at(3));
    assert.equal(refused.status, 409, path);
    assert.equal(refused.body.code, "locked", path);
  }
  const after = await t.state();
  assert.equal(after.lis[KAI]!.stage, 1, "no stage moves while the rupture stands");
  assert.deepEqual(after.chapters[key], before.chapters[key], "the gate is not counted, the chapter not completed");
  assert.equal(after.wallet.starlight, before.wallet.starlight, "nothing is paid");
  const gate = (await readBeat(t.store, t.runId, key, 3))!;
  assert.equal(gate.easedOff, undefined, "a refused Ease off cuts nothing");
  assert.equal((await t.call("POST", beatPath, {}, at(3))).status, 409, "a refused read does not open it either");
  // Nothing is taken back: the beats already read replay.
  assert.equal((await t.call("POST", beatPath, {}, at(0))).status, 200);
  assert.equal((await t.call("POST", beatPath, {}, at(1))).status, 200);

  // A rupture opened in the gate's own scene lets that scene be finished: the stage it reached is not taken back.
  const own = await arcWorld(
    "r-owng-aaaaaa",
    { points: POINTS_FOR_LEVEL(3) },
    router({ beat: (i) => (i === 3 ? ruptureChoiceBeat() : beatReply()) }),
  );
  const { reads } = await playRoute(own);
  assert.deepEqual(reads.at(-1)!.body.stageUp, { li: KAI, stage: 2 });
  const owned = await own.state();
  assert.equal(owned.lis[KAI]!.stage, 2);
  assert.ok(owned.lis[KAI]!.rupture, "and the rupture stands for the next one");
});

test("a finished route chapter replays while a rupture stands", async () => {
  const t = await arcWorld("r-rply-aaaaaa", { points: POINTS_FOR_LEVEL(3) });
  const { key, chapter } = await playRoute(t);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, ...ruptureOf() } },
  }));
  for (let i = 0; i < chapter.nodes.length; i += 1) {
    assert.equal((await t.call("POST", beatPath, {}, { key, i: String(i) })).status, 200, `node ${i}`);
  }
});

test("a repair plan keeps its shape; a rupture that moves on is offered its own repair; nothing unlocked is taken back", async () => {
  let repairCalls = 0;
  const t = await arcWorld(
    "r-rpln-aaaaaa",
    {
      stage: 3,
      points: POINTS_FOR_LEVEL(6),
      ...{
        grievances: [...ruptureOf("g-a").grievances, ...ruptureOf("g-b").grievances],
        rupture: { grievanceId: "g-a", since: at },
      },
    },
    router({
      repair: () =>
        (repairCalls += 1) === 1
          ? repairPlan({ nodes: [...repairPlan().nodes, { kind: "confrontation", guide: "Fight.", cast: [KAI] }] })
          : repairPlan(),
    }),
  );
  const first = await t.call("POST", "/runs/:run/repairs/:li", {}, { li: KAI });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.match(user(calls(t, "repair planner")[1]!.messages), /no confrontation node/);
  const key = first.body.chapter.key as string;
  for (const i of [0, 1]) {
    await t.call("POST", beatPath, {}, { key, i: String(i) });
    await t.call("POST", `${beatPath}/read`, { segment: 99 }, { key, i: String(i) });
  }
  const state = await t.state();
  assert.deepEqual(state.lis[KAI]!.rupture?.grievanceId, "g-b", "another rupture still owed keeps the gates shut");
  assert.equal(state.lis[KAI]!.stage, 3);
  assert.equal(state.lis[KAI]!.points, POINTS_FOR_LEVEL(6) + 150, "the repair pays; nothing is taken back");
  const story = await t.call("GET", "/runs/:run/story");
  assert.deepEqual(story.body.repairs, [{ li: KAI, key: `repair-${KAI}-2` }]);
  assert.equal(story.body.routes[0].next.blockedBy, "rupture");
});

test("a love interest's route chapter leaves nothing in another's plans: ledger lines, conflicts, grievances, disclosures", async () => {
  // Mireille's route chapter toward stage 2 leaves a relationship line, an off-screen line about Kai, a conflict seed,
  // and (a pick in its second node) a grievance she holds and something the protagonist told her.
  const mireilleRoute = (ledger: Record<string, unknown>) => ({
    title: "Glasshouse",
    tags: [],
    summary: "Mireille takes her into the glasshouse.",
    nodes: [
      { kind: "beat", guide: "Mireille waits in the glasshouse.", cast: [MIR] },
      { kind: "beat", guide: "Mireille shows her the forged pages.", cast: [MIR] },
      { kind: "moment", moment: "read-him", guide: "Ines reads her face.", cast: [MIR] },
      { kind: "beat", guide: "The gate: the mask cracks.", cast: [MIR] },
    ],
    ledger: { relationship: [], conflict: [], offscreen: [], ...ledger },
  });
  const PRIVATE_LEDGER = {
    relationship: [{ li: MIR, line: "PRIVATE-LINE: Mireille showed Ines the forged harbour pages." }],
    conflict: [{ li: MIR, type: "betrayal", action: "plant" }],
    offscreen: [{ li: KAI, line: "PRIVATE-OFFSCREEN: Kai kept the lamp alone." }],
  };
  const pick = beatReply({
    choices: [
      {
        kind: "small",
        at: 1,
        options: [
          {
            text: "Doubt the pages",
            selection: { kind: "dialogue", text: "These could be anyone's." },
            segments: [{ speaker: "Mireille", text: "They are mine.", expression: "hurt" }],
            effects: [
              {
                li: MIR,
                grievance: { by: "li", text: "PRIVATE-GRIEVANCE: she doubted the pages.", severity: "minor" },
                disclose: "PRIVATE-DISCLOSURE: The protagonist said she once forged a letter.",
              },
            ],
          },
          {
            text: "Believe her",
            selection: { kind: "action", text: "You nod." },
            segments: [{ speaker: "", text: "Quiet." }],
          },
        ],
      },
    ],
  });
  const t = await storyWorld({
    runKey: "r-bndy-aaaaaa",
    lis: { [KAI]: { points: POINTS_FOR_LEVEL(3) }, [MIR]: { points: POINTS_FOR_LEVEL(5) } },
    replies: router({
      route: (messages) =>
        !user(messages).includes(`(id ${MIR})`)
          ? routePlan()
          : mireilleRoute(/toward stage 2 now/.test(user(messages)) ? PRIVATE_LEDGER : {}),
      beat: (i, messages) => (i === 1 && mentions(messages, /Mireille's route chapter/) ? pick : beatReply()),
    }),
  });
  const { key } = await playRoute(t, MIR);
  const state = await t.state();
  assert.ok(state.chapters[key]!.completed, "her route chapter is complete");
  assert.equal(state.lis[MIR]!.grievances.length, 1, "the pick left a grievance");
  const conflict = `c-route-2-${MIR}-1`;
  assert.deepEqual(state.ledgers.conflicts, [
    { id: conflict, li: MIR, type: "betrayal", status: "open", chapter: 0, key },
  ]);

  // Kai's own route plan (P10) and a main chapter led by Kai (P5): none of it.
  const kaiPlan = await t.call("POST", "/runs/:run/routes/:li/next", {}, { li: KAI });
  assert.equal(kaiPlan.status, 200, JSON.stringify(kaiPlan.body));
  const mainPlan = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(mainPlan.status, 200, JSON.stringify(mainPlan.body));
  const p10 = calls(t, "route planner").at(-1)!;
  const p5 = calls(t, "chapter planner").at(-1)!;
  for (const [name, call] of [
    ["P10 for Kai", p10],
    ["P5 led by Kai", p5],
  ] as const) {
    const text = user(call.messages);
    assert.match(text, /\nLEDGERS\n/, name);
    assert.ok(!text.includes("PRIVATE-"), `${name}: nothing of her chapter (${/.*PRIVATE-.*/.exec(text)?.[0]})`);
    assert.ok(!text.includes(conflict), `${name}: nor its conflict seed`);
  }
  // Her own next route plan (P10 toward stage 3) still has all of it.
  const ownPlan = await t.call("POST", "/runs/:run/routes/:li/next", {}, { li: MIR });
  assert.equal(ownPlan.status, 200, JSON.stringify(ownPlan.body));
  const own = user(calls(t, "route planner").at(-1)!.messages);
  assert.match(own, /toward stage 3 now/);
  assert.match(own, new RegExp(`- ${key}, Mireille: PRIVATE-LINE: Mireille showed Ines`));
  assert.match(own, new RegExp(`- ${conflict} \\(betrayal, Mireille, since chapter 0\\)`));
  assert.match(own, new RegExp(`- Kai \\(${key}\\): PRIVATE-OFFSCREEN`));
  assert.match(own, /Open grievance g-route-li-mireille-cd34-2-1-0 \(minor, held by Mireille\): PRIVATE-GRIEVANCE/);
  assert.match(own, /The protagonist has told Mireille: PRIVATE-DISCLOSURE/);
});

test("a pick in a repair's resolving node that forgives the rupture still reports the repair", async () => {
  const forgive = beatReply({
    choices: [
      {
        kind: "small",
        at: 1,
        options: [
          {
            text: "Forgive him",
            selection: { kind: "dialogue", text: "I forgive you." },
            segments: [{ speaker: "Kai", text: "Don't.", expression: "hurt" }],
            effects: [{ li: KAI, resolve: { id: "g-main-1-2-0", status: "forgiven" } }],
          },
          {
            text: "Wait",
            selection: { kind: "action", text: "You wait." },
            segments: [{ speaker: "", text: "Quiet." }],
          },
        ],
      },
    ],
  });
  const t = await arcWorld(
    "r-rpck-aaaaaa",
    { points: POINTS_FOR_LEVEL(3), ...ruptureOf() },
    router({ beat: (i, messages) => (i === 1 && mentions(messages, /REPAIR chapter/) ? forgive : beatReply()) }),
  );
  const repair = await t.call("POST", "/runs/:run/repairs/:li", {}, { li: KAI });
  assert.equal(repair.status, 200, JSON.stringify(repair.body));
  const key = repair.body.chapter.key as string;
  const at = (i: number) => ({ key, i: String(i) });
  assert.equal((await t.call("POST", beatPath, {}, at(0))).status, 200);
  assert.equal((await t.call("POST", `${beatPath}/read`, { segment: 99 }, at(0))).status, 200);
  const served = await t.call("POST", beatPath, {}, at(1));
  assert.equal(served.status, 200, JSON.stringify(served.body));
  const chose = await t.call("POST", `${beatPath}/choose`, { choice: "choice-1", option: "option-1" }, at(1));
  assert.equal(chose.status, 200, JSON.stringify(chose.body));
  const picked = (await t.state()).lis[KAI]!;
  assert.equal(picked.rupture, null, "the pick closed the rupture");
  assert.equal(picked.grievances[0]!.status, "forgiven");
  const healed = await t.call("POST", `${beatPath}/read`, { segment: 99 }, at(1));
  assert.equal(healed.status, 200, JSON.stringify(healed.body));
  assert.equal(healed.body.repaired, KAI, "the chapter's end says it was made right");
  assert.equal((await t.state()).lis[KAI]!.grievances[0]!.status, "forgiven", "the read keeps the pick's status");
  // Read again, it says nothing more.
  const again = await t.call("POST", `${beatPath}/read`, { segment: 99 }, at(1));
  assert.equal(again.body.repaired, undefined);
});
