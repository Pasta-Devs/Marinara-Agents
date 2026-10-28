// Otome Forge's main chapters (M2a): the two Lead candidates (least recent, ripest conflict above 0), the chapter
// plan's checks (6–9 nodes, 1–2 moments, one confrontation as the climax, at most two CGs, the Foil on stage, every
// love interest in chapter 1, an off-screen line for each absent one, no tag for a Line, and conflict seeds that never
// repeat that love interest's last two kinds of angst, counting the same plan's), and the plan route: the prompt
// carries the knowledge boundary, the content contract, the kit's PLAYER AGENCY and every Foil candidate's full bible; a
// broken plan gets exactly one repair turn; a plan is written once; the next chapter waits. The planner sees every
// open grievance; the narrator the newest three, the rupture's and those its node may resolve.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type {
  ChapterNode,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import { chapterId } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeChapter } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  leadCandidates,
  normalizeChapterPlan,
  type PlanContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/chapters.ts";
import {
  ChapterPlanSchema,
  beatMessages,
  chapterPlanMessages,
  type ChapterPlanReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import { CAST, HE, KAI, MIR, SOL, bible, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

function stateWith(lis: Record<string, Partial<RunState["lis"][string]>>, changes: Partial<RunState> = {}): RunState {
  const base = normalizeState(undefined);
  return {
    ...base,
    lis: Object.fromEntries(CAST.map((li) => [li.id, { ...defaultLiState(), ...lis[li.id] }])),
    ...changes,
  };
}

const grievance = (id: string, li: string, status: "open" | "forgiven" = "open") => ({
  id,
  li,
  by: "li" as const,
  text: "She lied about the ledger.",
  severity: "minor" as const,
  opened: "main-1/2",
  status,
});

function context(changes: Partial<PlanContext> = {}): PlanContext {
  return {
    units: CAST,
    state: stateWith({}),
    world: { content: defaultContent() },
    number: 1,
    lead: KAI,
    ...changes,
  };
}

const parse = (reply: Record<string, unknown>) => {
  const parsed = ChapterPlanSchema.safeParse(reply);
  assert.ok(parsed.success, "the reply matches the schema");
  return parsed.data as ChapterPlanReply;
};

test("Lead candidates: the least recent (never led first, ties by cast order) and the ripest conflict", () => {
  const cast = CAST.map((li) => li.id);
  assert.deepEqual(leadCandidates(stateWith({}), cast), [
    { li: KAI, reason: "least-recent" },
    { li: MIR, reason: "least-recent" },
  ]);
  // Kai led chapter 1 and Mireille chapter 2: Sol never has. Mireille holds two open grievances: the ripest.
  const state = stateWith({
    [KAI]: { lastLead: 1, tension: 2 },
    [MIR]: { lastLead: 2, tension: 1, grievances: [grievance("g1", MIR), grievance("g2", MIR)] },
  });
  assert.deepEqual(leadCandidates(state, cast), [
    { li: SOL, reason: "least-recent" },
    { li: MIR, reason: "ripe-conflict" },
  ]);
  // A rupture adds 3; a forgiven grievance counts for nothing. When the ripest is also the least recent, the second
  // candidate is the next least recent.
  const ripeSol = stateWith({
    [KAI]: { lastLead: 1 },
    [MIR]: { lastLead: 2, grievances: [grievance("g1", MIR, "forgiven")] },
    [SOL]: { rupture: { grievanceId: "g3", since: "2026-10-28" }, grievances: [grievance("g3", SOL)] },
  });
  assert.deepEqual(leadCandidates(ripeSol, cast), [
    { li: SOL, reason: "least-recent" },
    { li: KAI, reason: "least-recent" },
  ]);
  // Nobody's conflict is ripe: the Lead who just led is never offered as one; the next least recent is.
  assert.deepEqual(leadCandidates(stateWith({ [KAI]: { lastLead: 1 } }), cast), [
    { li: MIR, reason: "least-recent" },
    { li: SOL, reason: "least-recent" },
  ]);
});

test("a chapter plan keeps the shape: 6–9 nodes, 1–2 moments, one confrontation as the climax, at most two CGs", () => {
  const plan = normalizeChapterPlan(parse(planReply()), context());
  assert.equal(typeof plan, "object");
  if (typeof plan === "string") return;
  assert.equal(plan.foil, MIR, "the Foil is named by name and saved by id");
  assert.deepEqual(plan.tags, ["violence-others", "jealousy"], "unknown tags are dropped");
  assert.deepEqual(plan.nodes[1]!.cast, [KAI, MIR]);
  assert.deepEqual(plan.nodes[2], {
    i: 2,
    kind: "moment",
    moment: "read-him",
    guide: "Ines reads Kai's face at the bell.",
    cast: [KAI],
  });
  assert.deepEqual(plan.ledger.conflict, [{ id: "c1-1", li: KAI, type: "secret", action: "plant" }]);

  const nodes = planReply().nodes as Array<Record<string, unknown>>;
  const without = (index: number) => nodes.filter((_, at) => at !== index);
  const fails = (changes: Record<string, unknown>, pattern: RegExp) =>
    assert.match(String(normalizeChapterPlan(parse(planReply(changes)), context())), pattern);
  fails({ nodes: nodes.slice(0, 5) }, /6 to 9 nodes/);
  fails({ nodes: [...nodes, ...nodes.slice(0, 3)] }, /6 to 9 nodes/);
  fails({ nodes: without(2).concat({ kind: "beat", guide: "More.", cast: [KAI] }) }, /1 or 2 moment/);
  fails(
    { nodes: nodes.map((node, at) => (at < 3 ? { ...node, kind: "moment", moment: "call" } : node)) },
    /1 or 2 moment/,
  );
  fails({ nodes: [nodes[5], ...without(5)] }, /second-to-last or last/);
  fails({ nodes: nodes.map((node, at) => (at === 4 ? { ...node, kind: "confrontation" } : node)) }, /exactly one/);
  fails({ nodes: nodes.map((node) => ({ ...node, cg: true })) }, /at most 2 nodes may have cg/);
  fails({ foil: KAI }, /other than the Lead/);
  // A Foil who is never on stage would be paid for a chapter he was not in.
  const withoutMireille = (nodes as Array<{ cast: string[] }>).map((node) => ({
    ...node,
    cast: node.cast.filter((li) => li !== MIR && li !== "Mireille"),
  }));
  const offscreen = { ...planReply().ledger, offscreen: [{ li: MIR, line: "Mireille audits the vault." }] };
  assert.match(
    String(
      normalizeChapterPlan(parse(planReply({ nodes: withoutMireille, ledger: offscreen })), context({ number: 2 })),
    ),
    /the Foil must appear in at least one node/,
  );
});

test("chapter 1 brings in every love interest, and every absent one gets an off-screen line", () => {
  const nodes = (planReply().nodes as Array<{ cast: string[] }>).map((node) => ({
    ...node,
    cast: node.cast.filter((li) => li !== SOL),
  }));
  assert.match(String(normalizeChapterPlan(parse(planReply({ nodes })), context())), /every love interest.*li-sol/);
  const later = context({ number: 2 });
  assert.match(String(normalizeChapterPlan(parse(planReply({ nodes })), later)), /offscreen.*li-sol-ef56/);
  const plan = normalizeChapterPlan(
    parse(
      planReply({ nodes, ledger: { ...planReply().ledger, offscreen: [{ li: "Sol", line: "Sol drank alone." }] } }),
    ),
    later,
  );
  assert.equal(typeof plan, "object");
  if (typeof plan !== "string") assert.deepEqual(plan.ledger.offscreen, [{ li: SOL, line: "Sol drank alone." }]);
});

test("a conflict seed never repeats his last two kinds of angst; one open misunderstanding, resolved within two chapters", () => {
  const plant = (type: string, li = KAI) =>
    planReply({ ledger: { relationship: [], conflict: [{ li, type, action: "plant" }], offscreen: [] } });
  const angsty = context({ number: 3, state: stateWith({ [KAI]: { angst: ["secret", "jealousy", "pride"] } }) });
  assert.match(String(normalizeChapterPlan(parse(plant("pride")), angsty)), /repeats one of their last two/);
  assert.match(String(normalizeChapterPlan(parse(plant("jealousy")), angsty)), /repeats one of their last two/);
  assert.equal(typeof normalizeChapterPlan(parse(plant("secret")), angsty), "object", "older angst may return");
  assert.match(String(normalizeChapterPlan(parse(plant("sulking")), angsty)), /conflict type must be one of/);
  // Two seeds of one kind in the same plan: the first counts as his newest angst, and as his open misunderstanding.
  const twice = (type: string) =>
    planReply({
      ledger: {
        relationship: [],
        conflict: [
          { li: KAI, type, action: "plant" },
          { li: "Kai", type, action: "plant" },
        ],
        offscreen: [],
      },
    });
  assert.match(String(normalizeChapterPlan(parse(twice("jealousy")), context())), /repeats one of their last two/);
  assert.match(
    String(normalizeChapterPlan(parse(twice("misunderstanding")), context())),
    /repeats one of their last two/,
  );

  const open = { id: "c1-1", li: KAI, type: "misunderstanding", status: "open" as const, chapter: 1 };
  const misunderstood = (number: number) =>
    context({ number, state: stateWith({}, { ledgers: { relationship: [], conflicts: [open], offscreen: [] } }) });
  assert.match(
    String(normalizeChapterPlan(parse(plant("misunderstanding")), misunderstood(2))),
    /already has an open misunderstanding/,
  );
  assert.match(String(normalizeChapterPlan(parse(plant("secret")), misunderstood(3))), /c1-1 must be resolved/);
  const resolved = planReply({
    ledger: {
      relationship: [],
      conflict: [{ id: "c1-1", li: KAI, type: "misunderstanding", action: "resolve" }],
      offscreen: [],
    },
  });
  const plan = normalizeChapterPlan(parse(resolved), misunderstood(3));
  assert.equal(typeof plan, "object");
  if (typeof plan !== "string") {
    assert.deepEqual(plan.ledger.conflict, [{ id: "c1-1", li: KAI, type: "misunderstanding", action: "resolve" }]);
  }
});

test("a chapter that reaches for a Line is refused; open grievances may be resolved only by id", () => {
  const content = { ...defaultContent(), limits: { ...defaultContent().limits, "violence-others": "line" as const } };
  assert.match(
    String(normalizeChapterPlan(parse(planReply()), context({ world: { content } }))),
    /reaches for a Line \(violence-others\)/,
  );
  const nodes = (planReply().nodes as Array<Record<string, unknown>>).map((node, at) =>
    at === 5 ? { ...node, resolves: ["g1", "made-up"] } : node,
  );
  const state = stateWith({ [MIR]: { grievances: [grievance("g1", MIR)] } });
  const plan = normalizeChapterPlan(parse(planReply({ nodes })), context({ state }));
  assert.equal(typeof plan, "object");
  if (typeof plan !== "string") assert.deepEqual(plan.nodes[5]!.resolves, ["g1"]);
});

test("the planner sees every open grievance; the narrator the newest three, the rupture's and those its node resolves", () => {
  const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));
  const grievances = [0, 1, 2, 3, 4].map((n) => ({
    ...grievance(`g${n}`, KAI),
    text: `GRIEVANCE-${n}: the lamp was left dark.`,
    severity: n === 0 ? ("rupture" as const) : ("minor" as const),
  }));
  const state = stateWith({ [KAI]: { grievances, rupture: { grievanceId: "g0", since: "main-1/2" } } });
  const world = normalizeWorld({ connections: { narration: "conn-text" } });
  const player = normalizePlayer({});
  const shown = (messages: Array<{ content: string }>) => {
    const prompt = messages.map((message) => message.content).join("\n");
    return [0, 1, 2, 3, 4].filter((n) => prompt.includes(`GRIEVANCE-${n}`));
  };
  assert.deepEqual(
    shown(chapterPlanMessages({ world, player, units, state, number: 2, lead: KAI, memory: "" })),
    [0, 1, 2, 3, 4],
  );
  const beat = (resolves?: string[]) => {
    const node = { i: 0, kind: "beat", guide: "Rain.", cast: [KAI], ...(resolves ? { resolves } : {}) } as ChapterNode;
    const chapter = { kind: "main" as const, number: 2, title: "Rain", lead: KAI, foil: MIR, nodes: [node] };
    return beatMessages({ world, player, units, state, chapter, node, storySoFar: "", memory: "" });
  };
  assert.deepEqual(shown(beat(["g1"])), [0, 1, 2, 3, 4], "a grievance the node may resolve keeps its text");
  assert.deepEqual(shown(beat()), [0, 2, 3, 4], "the rupture's grievance, and the newest three");
});

test("POST /chapters/next plans once, with the boundary, the contract and one repair turn; the next one waits", async () => {
  const t = await storyWorld({
    runKey: "r-plan-aaaaaa",
    replies: [json(planReply({ nodes: planReply().nodes.slice(0, 4) })), json(planReply())],
  });
  const story = await t.call("GET", "/runs/:run/story");
  assert.equal(story.status, 200);
  assert.deepEqual(story.body.next, {
    kind: "main",
    number: 1,
    candidates: [
      { li: KAI, reason: "least-recent" },
      { li: MIR, reason: "least-recent" },
    ],
  });

  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  assert.equal(t.calls.length, 2, "one repair turn");
  const [system, user] = t.calls[0]!.messages;
  assert.ok(system!.content.includes(forgeKnowledgeBoundary), "P5 carries the knowledge boundary");
  assert.match(system!.content, /CONTENT CONTRACT/);
  assert.match(system!.content, /PLAYER AGENCY/);
  assert.match(user!.content, /MYSTERY-TRUTH/, "the planner sees the hidden truth");
  assert.match(user!.content, /HIDDEN-TRUTH/, "and the Lead's full bible");
  assert.equal(user!.content.split("BIBLE: ").length - 1, 3, "and every Foil candidate's full bible too");
  assert.match(user!.content, /Keep to the CONTENT CONTRACT above, silently\.$/);
  assert.match(t.calls[1]!.messages.at(-1)!.content, /6 to 9 nodes, not 4/);
  assert.ok(t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === "chapter-plan/main-1"));

  const view = planned.body.chapter;
  assert.equal(view.key, "main-1");
  assert.equal(view.foil, MIR);
  assert.equal(view.nodes[0].guide, undefined, "guides stay on the server");
  assert.equal(view.ledger, undefined, "and so does the ledger");
  const stored = await t.store.readDoc(chapterId(t.runId, "main-1"), normalizeChapter);
  assert.equal(stored?.nodes[0]?.guide, "The quay goes dark; Kai finds Ines at the lamp.");

  const again = await t.call("POST", "/runs/:run/chapters/next", { lead: MIR });
  assert.equal(again.status, 409, "chapter 2 waits for chapter 1");
  assert.equal(t.calls.length, 2);
  const detail = await t.call("GET", "/runs/:run/chapters/:key", {}, { key: "main-1" });
  assert.deepEqual(
    detail.body.beats.map((beat: { state: string }) => beat.state),
    Array(7).fill("unwritten"),
  );
  const after = await t.call("GET", "/runs/:run/story");
  assert.equal(after.body.next, null);
  assert.deepEqual(after.body.chapters[0], {
    key: "main-1",
    kind: "main",
    title: "The Dark Quay",
    lead: KAI,
    state: "in-progress",
    beatsRead: 0,
    nodes: 7,
  });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: "li-nobody-zz99" })).status, 404);
});
