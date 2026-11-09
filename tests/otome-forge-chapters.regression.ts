// Otome Forge's main chapters (M2a): the two Lead candidates (least recent, ripest conflict above 0), the chapter
// plan's checks (6–9 nodes, 1–2 moments, at most one climax, at most two CGs, the Foil on stage, every
// love interest in chapter 1, an off-screen line for each absent one, no tag for a Line, and conflict seeds that never
// repeat that love interest's last two kinds of angst, counting the same plan's), and the plan route: the prompt
// carries the knowledge boundary, the content contract, the kit's PLAYER AGENCY and every Foil candidate's full bible; a
// broken plan gets exactly one repair turn; a plan is written once; the next chapter waits. The planner sees every
// open grievance; the narrator the newest three, the rupture's and those its node may resolve. Side with (#2046): a
// main chapter may hold one side-with scene only after three main chapters without one (chapter 4 at the earliest),
// on a beat node with two to four love interests, and only when the planner marks it; any other mark is dropped.
// Your thoughts… (#2127): the next main chapter's plan reads the thoughts waiting on Home with its task (never in its
// cached part), keeps a copy on the chapter that the client never sees, and lets them go in the write that registers
// it; a plan that fails or is refused keeps them, thoughts sent while it is written wait for the chapter after, and a
// plan without thoughts gets the prompt it got before. The last Character Story's hand-off goes with the task of a
// main chapter's plan and first scene from chapter 2, never in the cached part, and changes nothing without one.
import assert from "node:assert/strict";
import test from "node:test";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import type {
  ChapterNode,
  RunState,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  chapterId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  normalizeChapter,
  toChapterView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  leadCandidates,
  normalizeChapterPlan,
  sideWithOpen,
  type PlanContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/chapters.ts";
import {
  beatMessages,
  chapterPlanMessages,
  storyHandOff,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  ChapterPlanSchema,
  type ChapterPlanReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/replies.ts";
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
  // A rupture adds 3 (here one the protagonist holds, from before #2156); a forgiven grievance counts for nothing. When
  // the ripest is also the least recent, the second candidate is the next least recent.
  const ripeSol = stateWith({
    [KAI]: { lastLead: 1 },
    [MIR]: { lastLead: 2, grievances: [grievance("g1", MIR, "forgiven")] },
    [SOL]: {
      rupture: { grievanceId: "g3", since: "2026-10-28" },
      grievances: [{ ...grievance("g3", SOL), by: "protagonist" as const }],
    },
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
  fails(
    { nodes: nodes.map((node, at) => (at === 4 ? { ...node, kind: "confrontation" } : node)) },
    /at most one climax/,
  );
  fails({ nodes: nodes.map((node) => ({ ...node, cg: true })) }, /at most 2 nodes may have cg/);
  fails({ foil: KAI }, /other than the Lead/);
  // A beat may be the protagonist's alone (#1955); a moment or the climax is played with a love interest.
  const moment = nodes.findIndex((node) => node.kind === "moment");
  const climax = nodes.findIndex((node) => node.kind === "confrontation");
  fails(
    { nodes: nodes.map((node, at) => (at === moment ? { ...node, cast: [] } : node)) },
    /moment node \d+ needs a love interest/,
  );
  fails(
    { nodes: nodes.map((node, at) => (at === climax ? { ...node, cast: [] } : node)) },
    /confrontation node \d+ needs a love interest/,
  );
  const alone = nodes.findIndex((node, at) => node.kind === "beat" && at !== 0);
  const plain = normalizeChapterPlan(
    parse(planReply({ nodes: nodes.map((node, at) => (at === alone ? { ...node, cast: [] } : node)) })),
    context(),
  );
  assert.equal(typeof plain, "object", `a beat with no love interest is kept: ${String(plain)}`);
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
    return beatMessages({ world, player, units, state, chapter, node, storySoFar: [], memory: "" });
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
  assert.equal(t.calls.length, 3, "the arc, the plan, and one repair turn");
  const planCall = t.calls.find((entry) =>
    entry.messages.some((message) => message.content.includes("chapter planner")),
  )!;
  // #2066: the story context and the planner's instructions are the system part, the rest the last user turn.
  const system = {
    content: planCall.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n"),
  };
  const user = planCall.messages.at(-1);
  assert.match(system.content, /^THE STORY: [^]*\n\nYou are the chapter planner/u, "the story context comes first");
  assert.ok(system!.content.includes(forgeKnowledgeBoundary), "P5 carries the knowledge boundary");
  assert.match(system!.content, /CONTENT CONTRACT/);
  assert.match(system!.content, /PLAYER AGENCY/);
  // #1980: the truth leaves the chapter planner; it is the arc planner's, and a chapter sees it only on the page it is
  // scheduled to reveal it (the fake arc schedules it in chapter 12, so chapter 1 gets none of it).
  assert.doesNotMatch(user!.content, /MYSTERY-TRUTH/, "no unscheduled chapter sees the hidden truth");
  assert.match(system.content, /The mystery: Who puts out the lanterns\?/, "it still knows the question");
  assert.match(user!.content, /HIDDEN-TRUTH/, "and the Lead's full bible");
  assert.equal(user!.content.split("BIBLE: ").length - 1, 3, "and every Foil candidate's full bible too");
  assert.match(user!.content, /Keep to the CONTENT CONTRACT above, silently\.$/);
  assert.match(
    t.calls[2]!.messages.at(-1)!.content,
    /6 to 9 nodes, not 4/,
    "the repair turn follows the arc and the plan",
  );
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
  assert.equal(t.calls.length, 3, "the arc, then one plan");
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
    // #1980: the entry names its story arc, for grouping the list.
    arc: 1,
    beatsRead: 0,
    nodes: 7,
  });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: "li-nobody-zz99" })).status, 404);
});

test("Side with (#2046): one every four main chapters at most, from chapter 4, counted from the stored plans", () => {
  const main = (number: number, sideWith = false) => ({
    number,
    nodes: [
      { i: 0, kind: "beat" as const, guide: "", cast: [KAI, MIR], ...(sideWith ? { sideWith: true as const } : {}) },
    ],
  });
  const none = [main(1), main(2), main(3)];
  assert.deepEqual(
    [1, 2, 3, 4].map((number) => sideWithOpen(none.slice(0, number - 1), number)),
    [false, false, false, true],
    "a story with none counts from before chapter 1",
  );
  const afterFour = [...none, main(4, true), main(5), main(6), main(7)];
  assert.deepEqual(
    [5, 6, 7, 8].map((number) => sideWithOpen(afterFour.slice(0, number - 1), number)),
    [false, false, false, true],
    "three main chapters complete between two",
  );
  assert.equal(sideWithOpen([...none, main(4), main(5), main(6, true)], 7), false, "the newest one counts");
});

test("Side with (#2046): the plan keeps one valid mark and drops every other, never as a repair", () => {
  const nodes = planReply().nodes as Array<Record<string, unknown>>;
  const marked = (...at: number[]) =>
    parse(planReply({ nodes: nodes.map((node, i) => (at.includes(i) ? { ...node, sideWith: true } : node)) }));
  const sides = (plan: ReturnType<typeof normalizeChapterPlan>) => {
    assert.equal(typeof plan, "object", String(plan));
    return typeof plan === "string" ? [] : plan.nodes.flatMap((node) => (node.sideWith ? [node.i] : []));
  };
  const open = context({ number: 4, sideWith: true });
  // Node 1 holds Kai and Mireille (named by name in the reply).
  assert.deepEqual(sides(normalizeChapterPlan(marked(1), open)), [1]);
  assert.deepEqual(sides(normalizeChapterPlan(marked(1), context({ number: 4 }))), [], "not while one may not come");
  assert.deepEqual(sides(normalizeChapterPlan(marked(0), open)), [], "node 0 holds Kai alone");
  // The climax with two love interests is still no side-with scene; neither is a moment.
  const climax = parse(
    planReply({
      nodes: nodes.map((node, i) => (i === 5 || i === 2 ? { ...node, cast: [KAI, MIR], sideWith: true } : node)),
    }),
  );
  assert.deepEqual(sides(normalizeChapterPlan(climax, open)), []);
  assert.deepEqual(sides(normalizeChapterPlan(marked(0, 3), open)), [3], "a mark that does not fit is passed over");
  assert.deepEqual(sides(normalizeChapterPlan(marked(1, 3), open)), [1], "the first mark that fits, and only it");
  const plan = normalizeChapterPlan(marked(1), open);
  if (typeof plan === "string") return;
  const chapter = {
    key: "main-4",
    kind: "main" as const,
    number: 4,
    lead: KAI,
    plannedAt: "",
    connectionId: "",
    ...plan,
  };
  assert.equal(JSON.stringify(toChapterView(chapter)).includes("sideWith"), false, "the mark stays on the server");
  assert.equal(normalizeChapter(JSON.parse(JSON.stringify(chapter)))!.nodes[1]!.sideWith, true, "and is stored");

  // The planner hears of it only while one may come.
  const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));
  const world = normalizeWorld({ connections: { narration: "conn-text" } });
  const prompt = (sideWith?: boolean) =>
    chapterPlanMessages({
      world,
      player: normalizePlayer({}),
      units,
      state: stateWith({}),
      number: 4,
      lead: KAI,
      memory: "",
      ...(sideWith === undefined ? {} : { sideWith }),
    })
      .map((message) => message.content)
      .join("\n\n");
  assert.match(prompt(true), /SIDE WITH \(optional, at most one node\)[^\n]*"sideWith": true/);
  assert.match(prompt(true), /never invent a disagreement to use it/);
  assert.doesNotMatch(prompt(false), /SIDE WITH|sideWith/);
  assert.equal(prompt(false), prompt(), "a planner that may not mark one gets the prompt it got before");

  // The narrator's rule names the protagonist even while the player document has no name.
  const node = { i: 0, kind: "beat", guide: "They argue.", cast: [KAI, MIR], sideWith: true } as ChapterNode;
  const scene = beatMessages({
    world,
    player: normalizePlayer({}),
    units,
    state: stateWith({}),
    chapter: { kind: "main", number: 4, title: "Rain", lead: KAI, foil: MIR, nodes: [node] },
    node,
    storySoFar: [],
    memory: "",
  }).at(-1)!.content;
  const side = scene.slice(scene.indexOf("SIDE WITH (this node)"));
  assert.match(side, /where it comes to the protagonist: exactly 2 options[^\n]*each the protagonist backing/);
  assert.match(side, /selection: what the protagonist says/);
});

test("Side with (#2046): POST /chapters/next lets chapter 4 keep its mark, and not chapter 5 after one in 2", async () => {
  const play = async (runKey: string, earlier: number) => {
    const t = await storyWorld({
      runKey,
      replies: [
        json(
          planReply({
            nodes: (planReply().nodes as Array<Record<string, unknown>>).map((node, i) =>
              i === 1 ? { ...node, sideWith: true } : node,
            ),
          }),
        ),
      ],
    });
    // The main chapters before it, each completed; chapter 2 held a side-with scene when `earlier` is 2.
    for (let number = 1; number < (earlier === 2 ? 5 : 4); number += 1) {
      const key = `main-${number}`;
      await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, key)), normalizeChapter, () => ({
        key,
        kind: "main",
        number,
        lead: KAI,
        foil: MIR,
        title: `Night ${number}`,
        tags: [],
        summary: "",
        nodes: [
          { i: 0, kind: "beat", guide: "Rain.", cast: [KAI, MIR], ...(number === earlier ? { sideWith: true } : {}) },
        ],
        ledger: { relationship: [], conflict: [], offscreen: [] },
        plannedAt: "2026-10-28T10:00:00.000Z",
        connectionId: "conn-text",
      }));
      await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
        ...state,
        chapters: { ...state.chapters, [key]: { beatsRead: 1, completed: "2026-10-28T10:00:00.000Z", applied: [] } },
      }));
    }
    const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
    assert.equal(planned.status, 200, JSON.stringify(planned.body));
    const planner = t.calls
      .find((entry) => entry.messages.some((message) => message.content.includes("chapter planner")))!
      .messages.map((message) => message.content)
      .join("\n\n");
    const stored = (await t.store.readDoc(chapterId(t.runId, planned.body.chapter.key), normalizeChapter))!;
    return { planner, sides: stored.nodes.flatMap((node) => (node.sideWith ? [node.i] : [])), key: stored.key };
  };
  const fourth = await play("r-side-aaaaaa", 0);
  assert.equal(fourth.key, "main-4");
  assert.match(fourth.planner, /SIDE WITH \(optional/);
  assert.deepEqual(fourth.sides, [1], "the mark is kept on the node it fits");
  const fifth = await play("r-side-bbbbbb", 2);
  assert.equal(fifth.key, "main-5");
  assert.doesNotMatch(fifth.planner, /SIDE WITH/, "only two main chapters completed since the last one");
  assert.deepEqual(fifth.sides, [], "and a mark the planner sets anyway is dropped");
});

test("Your thoughts… (#2127): the next main chapter's plan reads them with its task, keeps a copy and lets them go", async () => {
  const words = "THOUGHTS-1: I want to look into the north light, and I wish Kai would just hold me.";
  const later = "THOUGHTS-2: Mireille lied to me about the ledger. I can't let it go.";
  const at = "2026-11-06T09:00:00.000Z";
  const send = (text: string, when = at) => ({ text, at: when });
  const t = await storyWorld({
    runKey: "r-thought-aaaaaa",
    replies: [
      "not json",
      "still not json",
      "I can't help with planning this chapter.",
      "I'm unable to continue this story.",
      // While the plan is written the player sends newer thoughts: the plan's state write finds them there.
      () => {
        t.fake.interfere(stateId(t.runId), (data) => ({ ...data, thoughts: send(later, "2026-11-06T09:05:00.000Z") }));
        return json(planReply());
      },
      json(planReply({ title: "The Second Night", ledger: { relationship: [], conflict: [], offscreen: [] } })),
    ],
  });
  const state = async () => (await t.store.readDoc(stateId(t.runId), normalizeState))!;
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    thoughts: send(words),
  }));
  const planners = () =>
    t.calls.filter((entry) => entry.messages.some((message) => message.content.includes("chapter planner")));

  // A plan that comes back in the wrong format twice, then one the model refuses: nothing is saved, the thoughts wait.
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 502);
  assert.deepEqual((await state()).thoughts, send(words), "a failed plan keeps them");
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 422);
  assert.deepEqual((await state()).thoughts, send(words), "and so does a refused one");

  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const plan = planners().at(-1)!.messages;
  const tail = plan.at(-1)!.content;
  assert.ok(tail.includes(`THE PROTAGONIST'S THOUGHTS (the player's own words, for this chapter)`));
  assert.ok(tail.includes(`After what happened lately, Ines is thinking, feeling or planning this:\n"${words}"`));
  assert.match(tail, /Give these thoughts a real place in this chapter where the story allows, in its own way/u);
  assert.match(tail, /a love interest knows only what Ines says or does on the page/u);
  assert.ok(
    tail.indexOf("THOUGHTS-1") < tail.indexOf("Plan main chapter 1 now"),
    "they come before the task, after the recalls",
  );
  assert.ok(
    plan.slice(0, -1).every((message) => !message.content.includes("THOUGHTS-1")),
    "never in the cached story context or the instructions",
  );
  assert.ok(!plan.at(-1)!.cacheBreakpoint, "and never marked");
  const stored = (await t.store.readDoc(chapterId(t.runId, "main-1"), normalizeChapter))!;
  assert.equal(stored.thoughts, words, "the chapter keeps them for its scenes");
  assert.equal(JSON.stringify(planned.body).includes("THOUGHTS"), false, "and the client never sees them");
  assert.equal(toChapterView(stored).thoughts, undefined);
  // Sent while the plan was written, the newer thoughts wait for the next chapter; the chapter is registered anyway.
  assert.deepEqual((await state()).thoughts, send(later, "2026-11-06T09:05:00.000Z"));
  assert.deepEqual((await state()).chapters["main-1"], { beatsRead: 0, completed: null, applied: [] });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 409, "chapter 2 waits");
  assert.equal(planners().length, 5, "with no model call");
  assert.equal((await state()).thoughts?.text, later, "and the newer thoughts keep waiting for it");

  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    chapters: { ...current.chapters, "main-1": { beatsRead: 7, completed: at, applied: [] } },
  }));
  const second = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const next = planners().at(-1)!.messages.at(-1)!.content;
  assert.ok(next.includes(later) && !next.includes("THOUGHTS-1"), "the next chapter reads the newer ones alone");
  assert.equal((await t.store.readDoc(chapterId(t.runId, "main-2"), normalizeChapter))!.thoughts, later);
  assert.equal((await state()).thoughts, null, "then lets them go");
  assert.equal(
    (await t.store.readDoc(chapterId(t.runId, "main-1"), normalizeChapter))!.thoughts,
    words,
    "while chapter 1 keeps its own",
  );
});

test("Your thoughts… (#2127): a plan without thoughts gets the prompt it got before", () => {
  const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));
  const world = normalizeWorld({ connections: { narration: "conn-text" } });
  const prompt = (thoughts?: string) =>
    chapterPlanMessages({
      world,
      player: normalizePlayer({}),
      units,
      state: stateWith({}),
      number: 2,
      lead: KAI,
      memory: "",
      recalls: "",
      ...(thoughts === undefined ? {} : { thoughts }),
    });
  const before = prompt();
  assert.deepEqual(prompt(""), before);
  assert.deepEqual(prompt(" \n "), before, "whitespace alone is no thoughts");
  const after = prompt("I wish someone would hug me today.");
  assert.deepEqual(after.slice(0, -1), before.slice(0, -1), "the cached part is the same");
  const block = after.at(-1)!.content.replace(before.at(-1)!.content, "");
  assert.equal(
    after.at(-1)!.content.replace(/\n\nTHE PROTAGONIST'S THOUGHTS[^]*?on the page\./u, ""),
    before.at(-1)!.content,
    "the thoughts block is all that is added",
  );
  assert.ok(block.length > 0);
  // Named "the protagonist" while the player document has no name, and never softened or filtered.
  assert.match(after.at(-1)!.content, /After what happened lately, the protagonist is thinking/u);
  assert.match(after.at(-1)!.content, /"I wish someone would hug me today\."/u);
});

test("the hand-off from the last Character Story: with the task only, from chapter 2, and nothing without one", () => {
  const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));
  const world = normalizeWorld({ connections: { narration: "conn-text" }, openingSituation: "The quay at dusk." });
  const plan = (number: number, handOff?: string) =>
    chapterPlanMessages({
      world,
      player: normalizePlayer({}),
      units,
      state: stateWith({}),
      number,
      lead: KAI,
      memory: "",
      ...(handOff === undefined ? {} : { handOff }),
    });
  const line = storyHandOff("The Ledger Room", "plan");
  // Written before the prompt is fitted, it says what to do when the story in full gave way (Dottore on #2209).
  for (const task of ["plan", "scene"] as const) {
    assert.match(
      storyHandOff("The Ledger Room", task),
      /If STORY MEMORY does not give it, continue from the previous chapter\./u,
    );
  }
  assert.deepEqual(plan(2, ""), plan(2), "no hand-off: the prompt it got before");
  const after = plan(2, "The Ledger Room");
  assert.deepEqual(after.slice(0, -1), plan(2).slice(0, -1), "the cached part is the same");
  assert.ok(after.at(-1)!.content.includes(`${line}\n`), after.at(-1)!.content);
  assert.equal(
    after.at(-1)!.content.replace(`${line}\n`, ""),
    plan(2).at(-1)!.content,
    "one line is all that is added",
  );
  // Chapter 1 opens on the opening situation, never on a Character Story.
  assert.deepEqual(plan(1, "The Ledger Room"), plan(1));

  const scene = (number: number, i: number, handOff?: string) => {
    const nodes = [0, 1].map((n) => ({ i: n, kind: "beat", guide: "Rain.", cast: [KAI] }) as ChapterNode);
    const chapter = { kind: "main" as const, number, title: "Rain", lead: KAI, foil: MIR, nodes };
    return beatMessages({
      world,
      player: normalizePlayer({}),
      units,
      state: stateWith({}),
      chapter,
      node: nodes[i]!,
      storySoFar: i ? ["The rain starts."] : [],
      memory: "",
      ...(handOff === undefined ? {} : { handOff }),
    });
  };
  const first = scene(2, 0, "The Ledger Room");
  assert.deepEqual(first.slice(0, -1), scene(2, 0).slice(0, -1), "the cached part is the same");
  assert.ok(first.at(-1)!.content.includes(storyHandOff("The Ledger Room", "scene")), first.at(-1)!.content);
  assert.deepEqual(scene(2, 1, "The Ledger Room"), scene(2, 1), "a later scene takes none");
  assert.deepEqual(scene(1, 0, "The Ledger Room"), scene(1, 0), "nor chapter 1's first");
});
