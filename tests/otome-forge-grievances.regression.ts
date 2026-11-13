// Otome Hearth's grievances (#2156).
// His grievance with her is the rupture he holds. Only a serious break earns it (a walkout, or a scene's rupture with
// his trust at −2 or below after that pick), once a story arc, while someone else could still lead; anything milder,
// and any rupture she would hold, is saved as a major grievance. While it stands he is never a Lead (the server refuses
// him; with every one of them held, the usual pair), he earns no affection from anything (Starlight still pays, losses
// still apply), every date with him waits (409 `locked` before anything is worn, given, planned or paid), and his repair
// waits for two main chapters read to the end after it began (the chapter it opened in aside; a save from before #2156
// has the space waived). Only his repair clears it, for exactly 300 affection in place of the Lead's 150: no other
// node's `resolves`, planned before #2156 too, closes it.
// Her grievance with him is Routes' "I'm upset" flag: telling him queues one message from him; P17 tells him in its user
// turn (never its system message, nor Home's note) and offers him, once an upset and only while he holds no grievance
// of his own, to ask her out to clear the air. Accept lets the upset go and waits as the next Date Night with him (P26
// and its scenes say so); Decline ends his asking; taking it back lapses an invitation still waiting.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import type {
  Beat,
  Chapter,
  Effect,
  LiState,
  PhoneThread,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  GRIEVANCE_SPACE_CHAPTERS,
  WALKOUT_RUPTURE_TRUST,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/arcs.ts";
import {
  LEAD_AFFECTION,
  GRIEVANCE_CLEARED_AFFECTION,
  STARLIGHT_EARNINGS,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import { createBackgroundQueue } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/background-queue.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  beatId,
  chapterId,
  chatId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  normalizeSet as normalizeReadHim,
  readHimTarget,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-him.ts";
import {
  normalizeSet as normalizeReadMe,
  readMeTarget,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-me.ts";
import {
  normalizeReading,
  tarotTarget,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/tarot.ts";
import {
  chatTarget,
  normalizeThread,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/phone/chat.ts";
import {
  beatMessages,
  chatReplyMessages,
  closerMessages,
  confrontationMessages,
  noteMessages,
  repairPlanMessages,
  routePlanMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import { registerArcRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/arcs.ts";
import { registerClawRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/claw.ts";
import { registerDateRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/dates.ts";
import { registerPhoneRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/phone.ts";
import { registerReadHimRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/read-him.ts";
import { registerReadMeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/read-me.ts";
import { registerStoryRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/story.ts";
import { registerTarotRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/tarot.ts";
import {
  defaultLiState,
  normalizeState,
  readRun,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBeat,
  normalizeChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { applyChoiceEffects } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/relationship.ts";
import {
  grant,
  payClearing,
  readBeatToEnd,
  type ReadChapter,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/rewards.ts";
import {
  needsSpace,
  repairOffers,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/state/stages.ts";
import {
  leadCandidates,
  leaders,
  planNodes,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/chapters.ts";
import { applyConfrontation } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/confrontation.ts";
import { CAST, KAI, MIR, SOL, at, beatReply, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const system = (messages: Messages) =>
  messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
// 0.20.2: P17's user part is two messages, the cached one and the thread now with the task.
const user = (messages: Messages) =>
  messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
const DAY = "2026-10-28";
const UPSET = /The protagonist is upset with Kai and has said so to Kai\./;
const INVITE_OFFER = 'add "invite": true to the JSON object';

const fresh = (lis: Record<string, Partial<LiState>> = {}): RunState =>
  normalizeState({ lis: Object.fromEntries([KAI, MIR, SOL].map((li) => [li, { ...defaultLiState(), ...lis[li] }])) });

const pick = (state: RunState, effects: Effect[], i: number, arc?: number, key = "main-3") =>
  applyChoiceEffects(state, effects, { key, i, choice: "choice-1", at, arc });

/** His grievance with her, opened in main chapter 1 (`space`: what it has had; absent, from before #2156: waived). */
const held = (space?: number, id = "g-main-1-2-0"): Partial<LiState> => ({
  trust: -2,
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
  rupture: { grievanceId: id, since: at, ...(space === undefined ? {} : { space }) },
});

const BREAK: Effect = { li: KAI, trust: -1, grievance: { by: "li", text: "She sold him out.", severity: "rupture" } };

test("only a serious break opens his grievance, once a story arc, while someone else could lead", () => {
  // Trust above −2 after the pick: a major grievance, remembered and still −15, and no rupture.
  const mild = pick(fresh({ [KAI]: { points: 500 } }), [BREAK], 1, 2).state.lis[KAI]!;
  assert.equal(mild.trust, WALKOUT_RUPTURE_TRUST + 1);
  assert.deepEqual([mild.rupture, mild.grievances[0]!.severity, mild.points], [null, "major", 485]);
  // At −2 after it: his grievance opens with no space yet, and remembers its arc.
  const broken = pick(fresh({ [KAI]: { trust: -1 } }), [BREAK], 1, 2).state;
  const kai = broken.lis[KAI]!;
  assert.deepEqual(kai.rupture, { grievanceId: "g-main-3-1-0", since: at, space: 0 });
  assert.deepEqual([kai.grievances[0]!.severity, kai.grievanceArc], ["rupture", 2]);
  // Once cleared, another break in the same arc is a major one; in the next arc it opens again.
  const cleared: RunState = {
    ...broken,
    lis: {
      ...broken.lis,
      [KAI]: { ...kai, rupture: null, grievances: kai.grievances.map((item) => ({ ...item, status: "addressed" })) },
    },
  };
  const again = pick(cleared, [BREAK], 4, 2).state.lis[KAI]!;
  assert.deepEqual([again.rupture, again.grievances[1]!.severity], [null, "major"]);
  const nextArc = pick(cleared, [BREAK], 4, 3).state.lis[KAI]!;
  assert.deepEqual([nextArc.rupture?.grievanceId, nextArc.grievanceArc], ["g-main-3-4-0", 3]);
  // A rupture the protagonist would hold is a major grievance (her grievance is Routes' button), even at −3.
  const hers = pick(
    fresh({ [KAI]: { trust: -3 } }),
    [{ ...BREAK, grievance: { ...BREAK.grievance!, by: "protagonist" } }],
    1,
  );
  assert.deepEqual([hers.state.lis[KAI]!.rupture, hers.state.lis[KAI]!.grievances[0]!.severity], [null, "major"]);
  // With Mireille and Sol both holding one, Kai is the last who could lead: his break is a major one.
  const last = pick(
    fresh({
      [KAI]: { trust: -1 },
      [MIR]: { ...held(0), grievances: [{ ...held(0).grievances![0]!, li: MIR }] },
      [SOL]: { ...held(0), grievances: [{ ...held(0).grievances![0]!, li: SOL }] },
    }),
    [BREAK],
    1,
  ).state.lis[KAI]!;
  assert.deepEqual([last.rupture, last.grievances[0]!.severity], [null, "major"]);

  // A Confrontation walkout at −2 opens it, with its arc; a second walkout in that arc is a major grievance.
  const walkout = (state: RunState, key: string, arc: number) =>
    applyConfrontation(
      state,
      { key, nodes: [], title: "The pier" },
      {
        i: 6,
        confrontation: {
          li: KAI,
          rounds: [],
          endings: {},
          grievance: { text: "She walked out on him.", severity: "major" },
          disclosure: "",
          picks: ["press", "press", "press"],
          ending: "walkout",
        },
      },
      at,
      arc,
    ).state;
  const walked = walkout(fresh({ [KAI]: { trust: -2 } }), "main-4", 5).lis[KAI]!;
  assert.deepEqual([walked.rupture?.space, walked.grievanceArc], [0, 5]);
  const twice = walkout(
    { ...fresh(), lis: { ...fresh().lis, [KAI]: { ...walked, rupture: null, grievances: [], trust: -2 } } },
    "main-5",
    5,
  ).lis[KAI]!;
  assert.deepEqual([twice.rupture, twice.grievances[0]!.severity], [null, "major"]);
});

test("while it stands he earns no affection from anything, Starlight still pays, and losses still apply", () => {
  const state = fresh({ [KAI]: { ...held(0), points: 900 } });
  // Every source: an activity, a story earning, a side-with backing.
  const date = grant(state, { source: "date", starlight: 120, li: KAI, affection: 100 }, DAY);
  assert.deepEqual(date.granted, { starlight: 120, affection: 0 });
  assert.equal(grant(state, { source: "chapter", li: KAI, affection: 150 }, DAY).granted.affection, 0);
  const sided = pick(
    state,
    [
      { li: KAI, affection: 30 },
      { li: MIR, affection: -10 },
    ],
    2,
  );
  assert.equal(sided.state.lis[KAI]!.points, 900, "no backing gain");
  assert.equal(sided.state.lis[MIR]!.points, 0, "a loss stops at the floor");
  // A loss still lands, floor-protected.
  assert.equal(pick(state, [{ li: KAI, trust: -1 }], 2).state.lis[KAI]!.points, 885);
  // A rupture the protagonist holds (from before #2156) freezes nothing.
  const hers = fresh({ [KAI]: { ...held(), grievances: [{ ...held().grievances![0]!, by: "protagonist" }] } });
  assert.equal(grant(hers, { source: "date", li: KAI, affection: 100 }, DAY).granted.affection, 100);
  // The chapter he walks out in pays its Lead nothing.
  const chapter: ReadChapter = {
    key: "main-3",
    kind: "main",
    number: 3,
    lead: KAI,
    nodes: [{ i: 0, kind: "beat", guide: "", cast: [KAI] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
  };
  const read = readBeatToEnd(state, chapter, 0, { at, dayKey: DAY });
  assert.deepEqual(
    read.grants.filter((entry) => entry.affection),
    [],
    "no Lead affection while he holds it",
  );
});

test("his repair waits for two main chapters read to the end, not the one it opened in; it pays 300 once", () => {
  const chapter = (key: string, kind: Chapter["kind"] = "main"): ReadChapter => ({
    key,
    kind,
    number: kind === "main" ? Number(key.split("-")[1]) : undefined,
    lead: MIR,
    nodes: [{ i: 0, kind: "beat", guide: "", cast: [MIR, KAI] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
  });
  const read = (state: RunState, key: string) => readBeatToEnd(state, chapter(key), 0, { at, dayKey: DAY }).state;
  let state = fresh({ [KAI]: held(0) });
  assert.equal(needsSpace(state.lis[KAI]), true);
  // The chapter it opened in is not space; a story chapter is not either; he may be in a chapter that is.
  state = read(state, "main-1");
  state = readBeatToEnd(state, chapter("story-x", "story"), 0, { at, dayKey: DAY }).state;
  assert.equal(state.lis[KAI]!.rupture!.space, 0);
  state = read(state, "main-2");
  assert.deepEqual(repairOffers([], state, [KAI]), [
    { li: KAI, key: `repair-${KAI}-1`, space: { had: 1, needed: GRIEVANCE_SPACE_CHAPTERS } },
  ]);
  state = read(state, "main-3");
  assert.equal(needsSpace(state.lis[KAI]), false);
  state = read(state, "main-4");
  assert.equal(state.lis[KAI]!.rupture!.space, GRIEVANCE_SPACE_CHAPTERS, "it stops counting once it has had its space");
  // A save from before #2156: waived. One she holds offers no space at all.
  assert.equal(needsSpace(fresh({ [KAI]: held() }).lis[KAI]), false);
  const hers = fresh({ [KAI]: { ...held(), grievances: [{ ...held().grievances![0]!, by: "protagonist" }] } });
  assert.deepEqual(repairOffers([], hers, [KAI]), [{ li: KAI, key: `repair-${KAI}-1` }]);

  // The repair's completion pays 160 Starlight and no Lead affection; its clearing pays exactly 300 once it is closed.
  const repair: ReadChapter & Pick<Chapter, "grievance"> = {
    ...chapter("repair-x", "repair"),
    lead: KAI,
    grievance: "g-main-1-2-0",
  };
  const done = readBeatToEnd(state, repair, 0, { at, dayKey: DAY });
  assert.deepEqual(done.grants, [
    { source: "beat", starlight: STARLIGHT_EARNINGS.beat },
    { source: "chapter", starlight: STARLIGHT_EARNINGS.chapter },
  ]);
  assert.deepEqual(payClearing(done.state, repair).grants, [], "nothing while the grievance stands");
  const addressed: RunState = {
    ...done.state,
    lis: {
      ...done.state.lis,
      [KAI]: {
        ...done.state.lis[KAI]!,
        rupture: null,
        grievances: done.state.lis[KAI]!.grievances.map((item) => ({ ...item, status: "addressed" })),
      },
    },
  };
  const cleared = payClearing(addressed, repair);
  assert.deepEqual(cleared.grants, [{ source: "lead", li: KAI, affection: GRIEVANCE_CLEARED_AFFECTION }]);
  assert.equal(cleared.state.lis[KAI]!.points, addressed.lis[KAI]!.points + 300);
  // #2156: a grievance another chapter closed since the repair was planned pays nothing when that repair is read.
  const elsewhere: RunState = {
    ...addressed,
    lis: {
      ...addressed.lis,
      [KAI]: {
        ...addressed.lis[KAI]!,
        grievances: addressed.lis[KAI]!.grievances.map((item) => ({ ...item, closedBy: "main-2" })),
      },
    },
  };
  assert.deepEqual(payClearing(elsewhere, repair).grants, [], "closed elsewhere: no clearing");
  assert.equal(payClearing(elsewhere, repair).state, elsewhere, "and nothing written");
  // Closed by this repair's own read: it pays once.
  const byRepair: RunState = {
    ...addressed,
    lis: {
      ...addressed.lis,
      [KAI]: {
        ...addressed.lis[KAI]!,
        grievances: addressed.lis[KAI]!.grievances.map((item) => ({ ...item, closedBy: repair.key })),
      },
    },
  };
  assert.deepEqual(payClearing(byRepair, repair).grants, [
    { source: "lead", li: KAI, affection: GRIEVANCE_CLEARED_AFFECTION },
  ]);

  // The repair of a rupture she holds (from before #2156) pays its Lead, and no clearing: the tie, as a repair has no
  // climax.
  const mended = readBeatToEnd(hers, repair, 0, { at, dayKey: DAY });
  assert.deepEqual(
    mended.grants.filter((entry) => entry.affection),
    [{ source: "lead", li: KAI, affection: LEAD_AFFECTION.tie }],
  );
  const closed: RunState = {
    ...mended.state,
    lis: {
      ...mended.state.lis,
      [KAI]: {
        ...mended.state.lis[KAI]!,
        rupture: null,
        grievances: mended.state.lis[KAI]!.grievances.map((item) => ({ ...item, status: "addressed" })),
      },
    },
  };
  assert.deepEqual(payClearing(closed, repair).grants, [], "no clearing for hers");
});

test("he is never offered or accepted as a Lead while it stands; with every one held, the usual pair", async () => {
  const cast = CAST.map((li) => li.id);
  const state = fresh({ [KAI]: { ...held(0), lastLead: null }, [MIR]: { lastLead: 1 }, [SOL]: { lastLead: 2 } });
  assert.deepEqual(leaders(state, cast), [MIR, SOL]);
  assert.deepEqual(
    leadCandidates(state, cast).map((candidate) => candidate.li),
    [MIR, SOL],
    "never Kai, however long since he led or however ripe his conflict",
  );
  const everyone = fresh(
    Object.fromEntries(cast.map((li) => [li, { ...held(0), grievances: [{ ...held(0).grievances![0]!, li }] }])),
  );
  assert.deepEqual(leaders(everyone, cast), cast);
  assert.equal(leadCandidates(everyone, cast).length, 2);
  // Only his repair clears it: no new plan offers its id to a node.
  const nodes = planNodes(
    { nodes: [{ kind: "beat", guide: "", cast: ["Kai"], resolves: ["g-main-1-2-0", "g-other"] }] } as never,
    {
      units: CAST,
      state: fresh({
        [KAI]: {
          ...held(0),
          grievances: [...held(0).grievances!, { ...held(0).grievances![0]!, id: "g-other", severity: "minor" }],
        },
      }),
    },
  );
  assert.deepEqual(nodes[0]!.resolves, ["g-other"]);

  // The server: no candidate, a 409 `locked` for him, and no Make it right before his space, all without a call.
  const t = await storyWorld({ runKey: "r-griev-lead01", lis: { [KAI]: held(0) } });
  const story = (await t.call("GET", "/runs/:run/story")).body;
  assert.ok(!story.next.candidates.some((candidate: { li: string }) => candidate.li === KAI));
  assert.deepEqual(story.repairs, [{ li: KAI, key: `repair-${KAI}-1`, space: { had: 0, needed: 2 } }]);
  const lead = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.deepEqual([lead.status, lead.body.code], [409, "locked"]);
  const repair = await t.call("POST", "/runs/:run/repairs/:li", {}, { li: KAI });
  assert.deepEqual([repair.status, repair.body.code], [409, "locked"]);
  assert.equal(t.calls.length, 0);
});

/** A one-node chapter whose beat offers one small choice with `effects`, stored as a chapter planned before #2156. */
async function storedChoice(
  t: Awaited<ReturnType<typeof storyWorld>>,
  chapter: Partial<Chapter> & Pick<Chapter, "key" | "kind" | "lead">,
  effects: Effect[],
) {
  const planned: Chapter = {
    title: "Planned before",
    tags: [],
    summary: "",
    nodes: [{ i: 0, kind: "beat", guide: "The scene.", cast: [KAI, MIR], resolves: ["g-main-1-2-0"] }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "conn-text",
    ...chapter,
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, planned.key)), normalizeChapter, () => planned);
  const beat: Beat = {
    key: planned.key,
    i: 0,
    kind: "beat",
    places: [],
    segments: [
      { speaker: "", text: "The harbour is quiet." },
      { speaker: "Kai", text: "Say it." },
    ],
    choices: [
      {
        id: "choice-1",
        kind: "small",
        at: 1,
        options: [
          { id: "option-1", text: "Say it", selection: { kind: "dialogue", text: "I'm sorry." }, segments: [] },
          { id: "option-2", text: "Don't", selection: { kind: "action", text: "You look away." }, segments: [] },
        ],
      },
    ],
    choiceCanon: {},
    effects: { "choice-1": { "option-1": effects } },
    applied: {},
    musicMood: "tense",
    readThrough: 0,
    written: { at, connectionId: "conn-text", model: "fake" },
    rewrites: 0,
  };
  await t.store.mutateDoc(runDocTarget("beat", beatId(t.runId, planned.key, 0)), normalizeBeat, () => beat);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [planned.key]: { beatsRead: 0, completed: null, applied: [] } },
  }));
  return t.call(
    "POST",
    "/runs/:run/chapters/:key/beats/:i/choose",
    { choice: "choice-1", option: "option-1" },
    {
      key: planned.key,
      i: "0",
    },
  );
}

test("only his repair clears it, even a chapter planned before #2156; a pick opens it once its arc allows", async () => {
  const forgive: Effect[] = [{ li: KAI, resolve: { id: "g-main-1-2-0", status: "forgiven" } }];
  const t = await storyWorld({ runKey: "r-griev-pick01", lis: { [KAI]: held(0) } });
  assert.equal((await storedChoice(t, { key: "main-2", kind: "main", lead: MIR, number: 2 }, forgive)).status, 200);
  const after = (await t.state()).lis[KAI]!;
  assert.deepEqual([after.grievances[0]!.status, !!after.rupture], ["open", true], "a main chapter's pick can't");
  // His repair's pick can.
  await storedChoice(
    t,
    { key: `repair-${KAI}-1`, kind: "repair", lead: KAI, li: KAI, grievance: "g-main-1-2-0" },
    forgive,
  );
  const repaired = (await t.state()).lis[KAI]!;
  assert.deepEqual([repaired.grievances[0]!.status, repaired.rupture], ["forgiven", null]);

  // The arc a pick lands in: a main chapter's own. Kai's grievance opened in arc 2: a break in arc 2 is a major one,
  // and one in arc 3 opens it.
  const sold: Effect[] = [BREAK];
  const arcs = await storyWorld({ runKey: "r-griev-arc001", lis: { [KAI]: { trust: -1, grievanceArc: 2 } } });
  await storedChoice(arcs, { key: "main-5", kind: "main", lead: KAI, number: 5, arc: 2 }, sold);
  assert.deepEqual(
    (await arcs.state()).lis[KAI]!.grievances.map((item) => item.severity),
    ["major"],
  );
  const later = await storyWorld({ runKey: "r-griev-arc002", lis: { [KAI]: { trust: -1, grievanceArc: 2 } } });
  await storedChoice(later, { key: "main-9", kind: "main", lead: KAI, number: 9, arc: 3 }, sold);
  assert.deepEqual((await later.state()).lis[KAI]!.grievanceArc, 3);
});

/** Every route this file calls, with a background lane, on a fake router; `call` answers like Fastify. */
function allRoutes(deps: RouteDeps, runKey: string) {
  const table = new Map<string, RouteHandler>();
  const router = {
    get: (path: string, handler: RouteHandler) => void table.set(`GET ${path}`, handler),
    post: (path: string, handler: RouteHandler) => void table.set(`POST ${path}`, handler),
  };
  for (const register of [
    registerStoryRoutes,
    registerArcRoutes,
    registerDateRoutes,
    registerReadHimRoutes,
    registerReadMeRoutes,
    registerTarotRoutes,
    registerPhoneRoutes,
  ])
    register(router, deps);
  registerClawRoutes(router, deps);
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = table.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: runKey, ...params },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

async function world(
  runKey: string,
  lis: Record<string, Partial<LiState>>,
  replies: Array<(m: Messages) => string> = [],
) {
  const t = await storyWorld({ runKey, lis, replies });
  const background = createBackgroundQueue(t.runtime);
  const deps: RouteDeps = { ...t.deps, background, handle: createHandle(t.runtime.logger) };
  const settle = async () => {
    for (let turn = 0; turn < 400 && background.has(`${t.runId}:upset:${KAI}`); turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const thread = async () => (await t.store.readDoc(chatId(t.runId, KAI), normalizeThread)) as PhoneThread;
  return { ...t, deps, background, settle, thread, call: allRoutes(deps, runKey) };
}

const RM = "rm-1-abcdef";
const RH = "rh-1-abcdef";
const TR = "tr-1-abcdef";
const names = { li: "Kai", player: "Ines" };
const written = { createdAt: at, connectionId: "conn-text", model: "fake", finished: null };

/** Kai's date (`read`: its last scene read), and his Read Me set, Read Him set and Tarot reading, all answered. */
async function seedOpen(t: Awaited<ReturnType<typeof storyWorld>>, read: boolean) {
  const date: Chapter = {
    key: "date-1",
    kind: "date",
    lead: KAI,
    li: KAI,
    title: "Jellyfish Hour",
    tags: [],
    summary: "",
    nodes: [0, 1, 2].map((i) => ({ i, kind: "beat" as const, guide: "The scene.", cast: [KAI] })),
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "conn-text",
    date: {
      li: KAI,
      place: "aquarium",
      placeName: "The Lantern Aquarium",
      herLook: "base",
      hisLook: "base",
      goesWrong: false,
      makeItRight: null,
      keepsake: { brief: "The two of them before the jellyfish tank." },
    },
  };
  await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, date.key)), normalizeChapter, () => date);
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: { ...state.chapters, [date.key]: { beatsRead: read ? 3 : 1, completed: read ? at : null, applied: [] } },
  }));
  const line = (text: string) => ({ line: text, face: "" });
  await t.store.mutateDoc(readMeTarget(t.runId, RM), normalizeReadMe, () => ({
    version: 1 as const,
    setId: RM,
    li: KAI,
    names,
    context: "At the sea wall.",
    guesses: [
      {
        category: "likes" as const,
        line: "You take your tea bitter.",
        face: "" as const,
        fact: "Ines takes her tea bitter.",
        reactions: { right: line("Knew it."), close: line("Nearly."), wrong: line("Hm.") },
      },
    ],
    answers: [{ verdict: "right" as const, at }],
    ...written,
  }));
  await t.store.mutateDoc(readHimTarget(t.runId, RH), normalizeReadHim, () => ({
    version: 1 as const,
    setId: RH,
    li: KAI,
    stage: 1,
    names,
    tells: [],
    rounds: [
      {
        context: "At the bar.",
        line: "Fine.",
        face: "" as const,
        readings: ["Fine", "Tired", "Hurt"],
        trueIndex: 2,
        thought: "Not fine.",
        tell: null,
      },
    ],
    picks: [2],
    ...written,
  }));
  await t.store.mutateDoc(tarotTarget(t.runId, TR), normalizeReading, () => ({
    version: 1 as const,
    id: TR,
    li: KAI,
    mode: "you-read" as const,
    question: null,
    names,
    context: "Cards on the table.",
    opening: line("Shall we?"),
    cards: (["fool", "magician", "high-priestess"] as const).map((card) => ({
      card,
      reversed: false,
      line: "The card.",
      face: "" as const,
      readings: [0, 1, 2].map((n) => ({ text: `Reading ${n}`, reaction: "Mm.", face: "" as const })),
    })),
    answers: [0, 1, 2].map(() => ({ pick: 0, at })),
    closing: line("There."),
    ...written,
  }));
}

test("every date with him waits while it stands: 409 `locked` before anything is worn, given, planned or paid", async () => {
  const t = await world("r-griev-date01", { [KAI]: held(2) });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    owned: { ...state.owned, gifts: { flowers: 1 } },
  }));
  // Open ones too: a date read to its end, and a Read Me, a Read Him and a Tarot night each ready to finish.
  await seedOpen(t, true);
  const before = await t.state();
  const pose = { expression: "smile", pose: "pose" };
  const photo = { li: KAI, place: "harbour", herLook: "base", hisLook: "base", his: pose, her: pose };
  for (const [path, body, params] of [
    ["/runs/:run/dates", { li: KAI, place: "aquarium", herLook: "base", hisLook: "base", gift: "flowers" }, {}],
    ["/runs/:run/dates/:key/finish", {}, { key: "date-1" }],
    ["/runs/:run/read-him", { li: KAI }, {}],
    ["/runs/:run/read-him/:set/answer", { round: 0, pick: 1 }, { set: RH }],
    ["/runs/:run/read-him/:set/finish", {}, { set: RH }],
    ["/runs/:run/read-me", { li: KAI }, {}],
    ["/runs/:run/read-me/:set/answer", { guess: 0, verdict: "wrong" }, { set: RM }],
    ["/runs/:run/read-me/:set/finish", {}, { set: RM }],
    ["/runs/:run/tarot", { li: KAI, mode: "reads-you", picks: [0, 1, 2] }, {}],
    ["/runs/:run/tarot/:reading/answer", { card: 0, pick: 1 }, { reading: TR }],
    ["/runs/:run/tarot/:reading/finish", {}, { reading: TR }],
    ["/runs/:run/claw/finish", { li: KAI, round: "c-1-abcdef", first: "me", caught: [], cheered: false }, {}],
    ["/runs/:run/photos/prompt", photo, {}],
    ["/runs/:run/photos", { ...photo, id: "ph-1-abcdef" }, {}],
  ] as const) {
    const refused = await t.call("POST", path, body, params);
    assert.deepEqual([refused.status, refused.body.code], [409, "locked"], path);
  }
  assert.deepEqual(await t.state(), before, "nothing given, paid or counted");
  assert.equal(t.calls.length, 0, "nothing planned");
  const [readMe, readHim, tarot] = await Promise.all([
    t.store.readDoc(readMeTarget(t.runId, RM).id, normalizeReadMe),
    t.store.readDoc(readHimTarget(t.runId, RH).id, normalizeReadHim),
    t.store.readDoc(tarotTarget(t.runId, TR).id, normalizeReading),
  ]);
  assert.deepEqual(
    [readMe!.finished, readMe!.answers[0]!.verdict, readHim!.finished, readHim!.picks, tarot!.finished],
    [null, "right", null, [2], null],
    "each waits as it was",
  );
  // The hub knows: every activity with him shows that he needs space; with Mireille, none.
  const play = (await t.call("GET", "/runs/:run/play")).body;
  assert.deepEqual([play.lis[KAI].held, play.lis[MIR].held], [true, false]);
  // Mireille's dates go on.
  assert.equal(
    (
      await t.call("POST", "/runs/:run/claw/finish", {
        li: MIR,
        round: "c-1-abcdef",
        first: "me",
        caught: [],
        cheered: false,
      })
    ).status,
    200,
  );
});

const isReply = (messages: Messages) => system(messages).includes("in your private message thread");
const isDatePlan = (messages: Messages) => system(messages).includes("You plan one DATE");
const DATE_PLAN = {
  title: "Clearing the Air",
  place: "The old lighthouse",
  tags: [],
  goesWrong: false,
  beats: [{ guide: "He waits at the lamp." }, { guide: "He says what he did." }, { guide: "They walk back." }],
  keepsake: { brief: "Two figures at the lamp at dusk, from behind." },
};

/** A date scene: two lines and its one small choice, scored. */
const DATE_BEAT = {
  musicMood: "date",
  segments: [
    { speaker: "", text: "The lamp turns over the water." },
    { speaker: "Kai", text: "I owe you this.", expression: "tender" },
  ],
  choices: [
    {
      kind: "small",
      at: 1,
      options: [
        {
          text: "Listen",
          selection: { kind: "action", text: "You listen." },
          segments: [{ speaker: "Kai", text: "Good." }],
          score: 1,
        },
        {
          text: "Look away",
          selection: { kind: "action", text: "You look away." },
          segments: [{ speaker: "Kai", text: "Good." }],
          score: 0,
        },
      ],
    },
  ],
};

/** P17 answers with `invite` set (when given), P26 with DATE_PLAN, and anything else (a date's scene) with DATE_BEAT. */
function upsetModel(invite: () => boolean | undefined) {
  return Array.from({ length: 24 }, () => (messages: Messages) => {
    if (isReply(messages)) {
      const ask = invite();
      return json({
        messages: [{ text: "You're upset. I know." }, { text: "Let me take you somewhere." }],
        ...(ask === undefined ? {} : { invite: ask }),
      });
    }
    if (isDatePlan(messages)) return json(DATE_PLAN);
    return json(DATE_BEAT);
  });
}

test("telling him she is upset: one message from him, who knows it, and his invitation once; Accept is the next Date Night", async () => {
  const t = await world(
    "r-griev-upset1",
    {},
    upsetModel(() => true),
  );
  const told = await t.call("POST", "/runs/:run/routes/:li/upset", { upset: true }, { li: KAI });
  assert.deepEqual(told.body, { upset: true, writing: true });
  assert.equal((await t.state()).lis[KAI]!.upset?.since !== undefined, true);
  // Telling him again queues nothing more.
  assert.deepEqual((await t.call("POST", "/runs/:run/routes/:li/upset", { upset: true }, { li: KAI })).body, {
    upset: true,
    writing: false,
  });
  await t.settle();
  const [first] = t.calls.filter((call) => isReply(call.messages));
  assert.equal(t.calls.filter((call) => isReply(call.messages)).length, 1, "one message from him");
  // He knows, in the user turn alone; the system message keeps only the constant exception.
  assert.match(user(first!.messages), UPSET);
  assert.ok(user(first!.messages).includes("has just told you they are upset with you"));
  assert.ok(user(first!.messages).includes(INVITE_OFFER));
  assert.doesNotMatch(system(first!.messages), UPSET);
  assert.ok(system(first!.messages).includes("you may ask them out to clear the air"));
  // His invitation rides on his last message, and a stored thread keeps it.
  const messages = (await t.thread()).messages;
  assert.deepEqual(
    messages.map((message) => message.invite?.status),
    [undefined, "pending"],
  );
  assert.equal(normalizeThread(JSON.parse(JSON.stringify(await t.thread()))).messages[1]!.invite?.status, "pending");
  // The story view says she is upset with him, at any stage.
  assert.equal(
    (await t.call("GET", "/runs/:run/story")).body.routes.find((route: { li: string }) => route.li === KAI).upset,
    true,
  );

  // While it waits he is not offered it again.
  await t.call("POST", "/runs/:run/phone/:li/send", { text: "We'll see." }, { li: KAI });
  const second = t.calls.filter((call) => isReply(call.messages)).at(-1)!;
  assert.ok(!user(second.messages).includes(INVITE_OFFER), "once an upset");
  assert.match(user(second.messages), UPSET);

  // Accept: the upset goes, and the next Date Night with him is that evening, his place picked by the client.
  const invited = messages[1]!.id;
  const accepted = await t.call("POST", "/runs/:run/phone/:li/invite", { message: invited, accept: true }, { li: KAI });
  assert.deepEqual(accepted.body, { status: "accepted" });
  const kai = (await t.state()).lis[KAI]!;
  assert.deepEqual([kai.upset, typeof kai.asked], [null, "string"]);
  assert.equal((await t.thread()).messages[1]!.invite?.status, "accepted");
  assert.equal(
    (await t.call("POST", "/runs/:run/phone/:li/invite", { message: invited, accept: true }, { li: KAI })).body.status,
    "accepted",
    "an Accept sent again answers the same",
  );
  assert.equal(
    (await t.call("GET", "/runs/:run/dates")).body.lis.find((entry: { li: string }) => entry.li === KAI).asked,
    true,
  );
  assert.equal((await t.call("GET", "/runs/:run/play")).body.lis[KAI].asked, true);
  const date = await t.call("POST", "/runs/:run/dates", {
    li: KAI,
    place: "partner-choice",
    herLook: "base",
    hisLook: "base",
  });
  assert.equal(date.status, 200, JSON.stringify(date.body));
  const plan = t.calls.find((call) => isDatePlan(call.messages))!;
  assert.ok(user(plan.messages).includes("CLEARING THE AIR\nKai asked the protagonist out tonight to clear the air"));
  assert.doesNotMatch(system(plan.messages), /clear the air/);
  const chapter = (await t.store.readDoc(chapterId(t.runId, date.body.chapter.key), normalizeChapter))!;
  assert.equal(chapter.date?.clearAir, true);
  // Its scenes know it, in their own last turn.
  const scene = await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: chapter.key, i: "0" });
  assert.equal(scene.status, 200, JSON.stringify(scene.body));
  const narrator = t.calls.find((call) => /Narrate node 1 of/.test(user(call.messages)))!.messages;
  assert.ok(user(narrator).includes("Kai asked the protagonist out tonight to clear the air"));
  assert.equal((await t.state()).lis[KAI]!.asked, null, "the evening is planned: the invitation is spent");
  assert.equal((await t.state()).daily.affection[KAI] ?? 0, 0, "it pays as any date, when it is finished");
});

test("Decline ends his asking; taking it back lapses a waiting invitation; his own grievance keeps him from asking", async () => {
  const t = await world(
    "r-griev-upset2",
    {},
    upsetModel(() => true),
  );
  await t.call("POST", "/runs/:run/routes/:li/upset", { upset: true }, { li: KAI });
  await t.settle();
  const first = (await t.thread()).messages.at(-1)!;
  assert.deepEqual(
    (await t.call("POST", "/runs/:run/phone/:li/invite", { message: first.id, accept: false }, { li: KAI })).body,
    { status: "declined" },
  );
  assert.ok((await t.state()).lis[KAI]!.upset, "she is still upset");
  await t.call("POST", "/runs/:run/phone/:li/send", { text: "No." }, { li: KAI });
  const after = t.calls.filter((call) => isReply(call.messages)).at(-1)!;
  assert.ok(!user(after.messages).includes(INVITE_OFFER), "a decline ends his asking");
  assert.match(user(after.messages), UPSET);
  // An invitation he made unasked is dropped.
  assert.equal((await t.thread()).messages.at(-1)!.invite, undefined);

  // Taking it back and telling him again: he may ask once more. Taking it back lapses one waiting.
  assert.deepEqual((await t.call("POST", "/runs/:run/routes/:li/upset", { upset: false }, { li: KAI })).body, {
    upset: false,
    writing: false,
  });
  await t.call("POST", "/runs/:run/routes/:li/upset", { upset: true }, { li: KAI });
  await t.settle();
  const again = (await t.thread()).messages.at(-1)!;
  assert.equal(again.invite?.status, "pending");
  await t.call("POST", "/runs/:run/routes/:li/upset", { upset: false }, { li: KAI });
  assert.equal((await t.thread()).messages.at(-1)!.invite?.status, "lapsed");
  const lapsed = await t.call("POST", "/runs/:run/phone/:li/invite", { message: again.id, accept: true }, { li: KAI });
  assert.deepEqual([lapsed.status, lapsed.body.code], [409, "conflict"]);
  assert.equal((await t.state()).lis[KAI]!.asked, null);

  // An invitation saved after she took it back (his reply was being written) can't be accepted: it lapses.
  await t.store.updateDoc(chatTarget(t.runId, KAI), normalizeThread, (thread) => ({
    ...thread,
    messages: thread.messages.map((message, n, all) =>
      n === all.length - 1 ? { ...message, invite: { status: "pending" as const } } : message,
    ),
  }));
  const late = await t.call("POST", "/runs/:run/phone/:li/invite", { message: again.id, accept: true }, { li: KAI });
  assert.deepEqual(
    [late.status, late.body.code, (await t.thread()).messages.at(-1)!.invite?.status],
    [409, "conflict", "lapsed"],
  );

  // While he holds his own grievance he is never offered it, and an Accept is refused.
  const his = await world(
    "r-griev-upset3",
    { [KAI]: held(0) },
    upsetModel(() => true),
  );
  await his.call("POST", "/runs/:run/routes/:li/upset", { upset: true }, { li: KAI });
  await his.settle();
  const reply = his.calls.filter((call) => isReply(call.messages)).at(-1)!;
  assert.ok(!user(reply.messages).includes(INVITE_OFFER));
  assert.match(user(reply.messages), UPSET);
  assert.equal((await his.thread()).messages.at(-1)!.invite, undefined);
});

test("the hub says his invitation waits only while no date with him is open, which Play resumes first", async () => {
  const t = await world("r-griev-asked1", { [KAI]: { asked: at } });
  assert.equal((await t.call("GET", "/runs/:run/play")).body.lis[KAI].asked, true);
  await seedOpen(t, false);
  const play = (await t.call("GET", "/runs/:run/play")).body;
  assert.deepEqual([play.lis[KAI].asked, play.lis[KAI].makeItRight], [false, false]);
  // The invitation still waits, for the date after it.
  const dates = (await t.call("GET", "/runs/:run/dates")).body.lis.find((entry: { li: string }) => entry.li === KAI);
  assert.deepEqual([dates.asked, dates.open?.key], [true, "date-1"]);
});

test("the memo reaches his messages and the story's plans and scenes after the cache breakpoint, never Home's note", async () => {
  const t = await storyWorld({
    runKey: "r-griev-memo01",
    lis: { [KAI]: { upset: { since: at } } },
    replies: [json(planReply()), ...Array.from({ length: 4 }, () => json(beatReply()))],
  });
  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const p5 = t.calls.find((call) => system(call.messages).includes("You are the chapter planner"))!.messages;
  assert.match(p5.at(-1)!.content, UPSET, "P5: beside his bible, in its own part");
  assert.doesNotMatch(p5[0]!.content, UPSET, "never in the shared story context");
  await t.call("POST", "/runs/:run/chapters/:key/beats/:i", {}, { key: planned.body.chapter.key, i: "0" });
  const p6 = t.calls.filter((call) => /Narrate node 1 of/.test(user(call.messages))).at(-1)!.messages;
  assert.match(user(p6), UPSET, "P6: beside his scene card");
  assert.doesNotMatch(p6[0]!.content, UPSET);

  const run = (await readRun(t.store, t.runId))!;
  const unit = run.units.find((item) => item.id === KAI)!;
  const liState = run.state.lis[KAI]!;
  const note = noteMessages({
    world: run.world,
    player: run.player,
    unit,
    liState,
    today: { weekday: "Wednesday", hour: 9, special: [] },
    recalled: "",
    offscreen: "",
    recent: [],
    curt: false,
  });
  assert.doesNotMatch(note.map((message) => message.content).join("\n"), UPSET, "not on Home");
  const chat = chatReplyMessages({
    world: run.world,
    player: run.player,
    unit,
    liState,
    tail: [],
    memories: [],
    story: "",
  });
  assert.match(user(chat), UPSET);
  assert.doesNotMatch(system(chat), UPSET);
  // Without the upset, his messages carry no such line, and his system message is the same either way.
  const calm = chatReplyMessages({
    world: run.world,
    player: run.player,
    unit,
    liState: { ...liState, upset: null },
    tail: [],
    memories: [],
    story: "",
  });
  assert.doesNotMatch(user(calm), UPSET);
  assert.equal(system(calm), system(chat));

  // P10 and P11 beside his bible, P12 and P12c beside his scene card: each in its last turn, never its first.
  const base = { world: run.world, player: run.player, units: run.units, state: run.state, memory: "" };
  const climax = (kind: "confrontation" | "closer") => ({
    ...base,
    chapter: { kind: "main" as const, number: 2, title: "Night 2", lead: KAI, nodes: [] },
    node: { i: 0, kind, guide: "It comes to a head.", cast: [KAI] },
    storySoFar: [],
    li: KAI,
  });
  for (const [prompt, messages] of [
    ["P10", routePlanMessages({ ...base, li: KAI, stage: 2 })],
    ["P11", repairPlanMessages({ ...base, li: KAI, grievance: { id: "g-1", text: "She lied.", by: "li" } })],
    ["P12", confrontationMessages(climax("confrontation"))],
    ["P12c", closerMessages(climax("closer"))],
  ] as const) {
    assert.match(user(messages), UPSET, prompt);
    assert.doesNotMatch(messages[0]!.content, UPSET, prompt);
  }
  // A date's scenes never carry it, as its plan (P26) never does: only the clear-the-air evening says so.
  const dateScene = beatMessages({
    ...base,
    chapter: {
      kind: "date",
      title: "Jellyfish Hour",
      lead: KAI,
      li: KAI,
      nodes: [{ i: 0, kind: "beat", guide: "The tank glows.", cast: [KAI] }],
      date: {
        li: KAI,
        place: "aquarium",
        placeName: "The Lantern Aquarium",
        herLook: "base",
        hisLook: "base",
        goesWrong: false,
        makeItRight: null,
        keepsake: { brief: "The two of them before the jellyfish tank." },
      },
    },
    node: { i: 0, kind: "beat", guide: "The tank glows.", cast: [KAI] },
    storySoFar: [],
  });
  assert.doesNotMatch(dateScene.map((message) => message.content).join("\n"), UPSET, "not on a date");
});
