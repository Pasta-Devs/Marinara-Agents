// Otome Forge's story arcs (#1980): the arc a run of main chapters follows. An arc's schedule is code, not prose: the
// model gives purposes and 1-based positions and the server stamps every chapter number (off-by-one in a twelve-chapter
// schedule is the likeliest failure); a breathing arc has no reveals, no big event and no antagonist; a reveal outside
// the arc or out of order is dropped; the truth comes only in the arc's last chapter, after its pieces, and never twice
// in a run; and the chapter planner sees the mystery's truth ONLY in the chapter scheduled to reveal it, placing it on a
// node (with its holder, for a piece) and putting the arc's big event in the last chapter's climax. A node in a chapter
// that reveals nothing never carries a reveal, so an early reveal cannot land. Nothing hidden reaches the client: the
// arc view carries its name, its range and how far in the player is, and toChapterView drops both stamped fields.
// #2047: an arc may hold one optional judgment (a question and 2–4 answers, the true one among them, unmarked); the last
// node of a chapter it lists may close on it once per arc, and the narrator sees the answers, never which is true.
import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChapterNode,
  StoryArc,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  defaultLiState,
  normalizeState,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import {
  normalizeChapter,
  toChapterView,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story.ts";
import {
  ArcPlanSchema,
  normalizeArc,
  normalizeArcPlan,
  revealAt,
  toArcView,
  type ArcPlanContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/story-arc.ts";
import { normalizeWorld } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/world.ts";
import {
  arcChoiceFor,
  judgmentFor,
  normalizeChapterPlan,
  type PlanContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/chapters.ts";
import {
  arcPlanMessages,
  beatMessages,
  chapterPlanMessages,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/prompts.ts";
import {
  ChapterPlanSchema,
  type ChapterPlanReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/replies.ts";
import {
  beatId,
  chapterId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { readRun } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { introduceLoveInterest } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/introduce.ts";
import {
  planArc,
  revealedSoFar,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/arc.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { CAST, HE, KAI, MIR, SOL, bible, json, planReply, storyWorld } from "./fixtures/otome-forge-story.ts";

const at = "2026-10-31T10:00:00.000Z";

const purposes = (count: number) =>
  Array.from({ length: count }, (_, index) => `Chapter ${index + 1}: the quay darkens and someone lies about it.`);

function arcReply(changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "story",
    label: "The drowned bell",
    theme: "trust paid for in secrets",
    goal: "the protagonist learns who rang the bell",
    chapters: purposes(10),
    endsWith: { what: "the bell is raised and the one who rang it is named", chapter: 10 },
    reveals: [
      { chapter: 5, kind: "piece", li: KAI, what: "Kai knew it was rung on purpose" },
      { chapter: 10, kind: "truth", what: "the harbour master gave the order" },
    ],
    antagonist: {
      name: "the harbour master",
      want: "the town stays quiet",
      whyNow: "the bell has started ringing again",
    },
    ...changes,
  };
}

const context = (changes: Partial<ArcPlanContext> = {}): ArcPlanContext => ({
  number: 1,
  from: 1,
  resolveLi: (value) => (value === "Kai" || value === KAI ? KAI : null),
  revealed: new Set<string>(),
  truthTold: false,
  ...changes,
});

const parse = (reply: Record<string, unknown>) => {
  const parsed = ArcPlanSchema.safeParse(reply);
  assert.ok(parsed.success, "the reply matches the schema");
  return parsed.data;
};

const arc = (changes: Record<string, unknown> = {}, ctx: Partial<ArcPlanContext> = {}): StoryArc => {
  const planned = normalizeArcPlan(parse(arcReply(changes)), context(ctx));
  assert.equal(typeof planned, "object", `the plan is accepted: ${planned}`);
  return planned as StoryArc;
};

test("the arc's length, range and schedule are stamped by the server, never written by the model", () => {
  const planned = arc();
  assert.equal(planned.from, 1);
  assert.equal(planned.endsAt, 10, "ten purposes end the arc at chapter 10");
  assert.deepEqual(
    planned.plan.map((entry) => entry.n),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.equal(planned.endsWith?.n, 10);
  assert.deepEqual(
    planned.reveals.map((reveal) => [reveal.n, reveal.kind]),
    [
      [5, "piece"],
      [10, "truth"],
    ],
  );
  // The positions are within the arc, wherever it starts.
  const later = arc({}, { number: 3, from: 21 });
  assert.equal(later.from, 21);
  assert.equal(later.endsAt, 30);
  assert.deepEqual(
    later.reveals.map((reveal) => reveal.n),
    [25, 30],
  );
});

test("a plan's length and brevity are checked: 8–12 story chapters, 3–5 breathing ones, a purpose of 20 words or fewer", () => {
  assert.match(String(normalizeArcPlan(parse(arcReply({ chapters: purposes(7) })), context())), /8 to 12/u);
  assert.match(String(normalizeArcPlan(parse(arcReply({ chapters: purposes(13) })), context())), /8 to 12/u);
  const long = [...purposes(9), "word ".repeat(25).trim()];
  assert.match(String(normalizeArcPlan(parse(arcReply({ chapters: long })), context())), /20 words or fewer/u);
  const breathing = normalizeArcPlan(
    parse(
      arcReply({
        kind: "breathing",
        chapters: purposes(4),
        endsWith: null,
        reveals: [],
        antagonist: null,
      }),
    ),
    context(),
  );
  assert.equal(typeof breathing, "object");
  assert.equal((breathing as StoryArc).endsAt, 4);
  assert.equal((breathing as StoryArc).endsWith, null);
  assert.deepEqual((breathing as StoryArc).reveals, []);
  assert.equal((breathing as StoryArc).antagonist, null);
  // A breathing arc neither reveals nor spends a big event.
  assert.match(
    String(normalizeArcPlan(parse(arcReply({ kind: "breathing", chapters: purposes(4) })), context())),
    /breathing arc reveals nothing/u,
  );
  assert.match(
    String(normalizeArcPlan(parse(arcReply({ kind: "breathing", chapters: purposes(4), reveals: [] })), context())),
    /no antagonist/u,
  );
});

test("the reveal schedule refuses what would break it: past the end, twice in a chapter, an old piece, a repeated truth, the truth before its chapter", () => {
  const reveal = (changes: Record<string, unknown>) =>
    String(
      normalizeArcPlan(
        parse(arcReply({ reveals: changes.reveals })),
        context(changes.context as Partial<ArcPlanContext> | undefined),
      ),
    );
  assert.match(
    reveal({ reveals: [{ chapter: 11, kind: "piece", li: KAI, what: "x" }] }),
    /past the arc's last chapter/u,
  );
  assert.match(
    reveal({
      reveals: [
        { chapter: 4, kind: "piece", li: KAI, what: "x" },
        { chapter: 4, kind: "piece", li: MIR, what: "y" },
      ],
    }),
    /reveal twice/u,
  );
  assert.match(
    reveal({ reveals: [{ chapter: 4, kind: "piece", li: KAI, what: "x" }], context: { revealed: new Set([KAI]) } }),
    /already revealed/u,
  );
  assert.match(
    reveal({ reveals: [{ chapter: 10, kind: "truth", what: "x" }], context: { truthTold: true } }),
    /already told/u,
  );
  assert.match(
    reveal({
      reveals: [
        { chapter: 6, kind: "truth", what: "x" },
        { chapter: 3, kind: "piece", li: KAI, what: "y" },
      ],
    }),
    /last chapter/u,
  );
  assert.match(
    reveal({
      reveals: [
        { chapter: 4, kind: "piece", li: KAI, what: "x" },
        { chapter: 8, kind: "truth", what: "y" },
      ],
    }),
    /last chapter/u,
  );
});

test("a repeated piece and a nameless label are refused, and the ending is always the arc's last chapter", () => {
  // #1985 review: a love interest holds one piece, so the same one cannot be scheduled twice in an arc.
  assert.match(
    String(
      normalizeArcPlan(
        parse(
          arcReply({
            reveals: [
              { chapter: 3, kind: "piece", li: KAI, what: "x" },
              { chapter: 6, kind: "piece", li: KAI, what: "y" },
            ],
          }),
        ),
        context(),
      ),
    ),
    /already scheduled in this arc/u,
  );
  assert.match(String(normalizeArcPlan(parse(arcReply({ label: "   " })), context())), /needs a short label/u);
  // The big event lands in the arc's last chapter whatever position the reply gives it (0 means the last).
  const planned = arc({ endsWith: { what: "the bell is raised", chapter: 0 } });
  assert.equal(planned.endsWith?.n, planned.endsAt);
  assert.equal(planned.endsWith?.n, 10);
});

test("a new arc reads what earlier arcs already revealed, so a repeat is refused", () => {
  const first = arc();
  const chapters = [
    { number: 4, key: "main-4" },
    { number: 5, key: "main-5" },
    { number: 10, key: "main-10" },
  ];
  const state = normalizeState({
    chapters: {
      "main-4": { beatsRead: 0, completed: "2026-10-30", applied: [] },
      "main-5": { beatsRead: 0, completed: "2026-10-30", applied: [] },
      "main-10": { beatsRead: 0, completed: "2026-10-31", applied: [] },
    },
  });
  const { pieces, truth } = revealedSoFar([first], chapters, state, 11);
  assert.deepEqual([...pieces], [KAI]);
  assert.equal(truth, true);
});

test("a stored arc keeps its range, drops a reveal outside it, and a breathing arc keeps no hidden text", () => {
  const stored = normalizeArc({
    ...arc(),
    from: 21,
    endsAt: 99,
    reveals: [
      { n: 30, kind: "truth", what: "the answer" },
      { n: 5, kind: "piece", li: KAI, what: "too early for this arc" },
    ],
  })!;
  assert.equal(stored.endsAt, 30, "the end follows from the plan, whatever the document said");
  assert.deepEqual(
    stored.reveals.map((reveal) => reveal.n),
    [30],
    "a reveal outside the arc is dropped rather than played early",
  );
  const quiet = normalizeArc({ ...arc(), kind: "breathing", reveals: [{ n: 3, kind: "piece", li: KAI, what: "x" }] })!;
  assert.deepEqual(quiet.reveals, []);
  assert.equal(quiet.endsWith, null);
  assert.equal(quiet.antagonist, null);
  assert.equal(normalizeArc({ plan: [] }), null, "an arc with no plan is no arc");
});

test("the player's view carries the name, the range and how far in they are, and no hidden text", () => {
  const planned = arc();
  const view = toArcView(planned, 4);
  assert.deepEqual(Object.keys(view).sort(), ["done", "endsAt", "from", "kind", "label", "number", "read"]);
  assert.equal(view.read, 4);
  assert.equal(view.done, false);
  assert.equal(toArcView(planned, 10).done, true);
  assert.equal(toArcView(planned, 40).read, 10, "progress never runs past the arc");
  assert.equal(revealAt(planned, 5)?.what, "Kai knew it was rung on purpose");
  assert.equal(revealAt(planned, 6), undefined);
});

// ── The chapter planner reads the arc ──

function world(content = defaultContent()) {
  return normalizeWorld({
    setting: "A harbour town that keeps one name quiet.",
    premise: "The lights die, and Kai knows why.",
    mystery: {
      question: "Who rang the bell?",
      truth: "The harbour master gave the order.",
      pieces: { [KAI]: { piece: "Kai knew it was rung on purpose.", reasonToHide: "He is afraid" } },
    },
    content,
  })!;
}

const units = CAST.map((li) => ({ ...normalizeUnit({}), id: li.id, name: li.name, pronouns: HE, bible: bible() }));

function prompt(arc: StoryArc | null, number: number, judgment = false) {
  const parsed = ChapterPlanSchema.safeParse(planReply());
  assert.ok(parsed.success);
  return chapterPlanMessages({
    world: world(),
    player: normalizePlayer({
      personaId: "",
      name: "Ines",
      pronouns: { subject: "she", object: "her", possessive: "her" },
      goal: "Find out why the lights die.",
      about: "",
    })!,
    units,
    state: normalizeState(undefined),
    number,
    lead: KAI,
    memory: "",
    arc,
    judgment,
  } satisfies Parameters<typeof chapterPlanMessages>[0]);
}

const shown = (messages: Array<{ content: string }>) => messages.map((message) => message.content).join("\n");

test("the chapter planner sees the truth only in the chapter scheduled to reveal it", () => {
  const planned = arc();
  const before = prompt(planned, 4);
  assert.doesNotMatch(shown(before), /harbour master gave the order/u, "nothing of the truth in chapter 4");
  assert.match(shown(before), /Nothing of the mystery is revealed in this chapter/u);
  const revealChapter = prompt(planned, 5);
  assert.match(shown(revealChapter), /Kai knew it was rung on purpose/u, "the piece, on the page");
  assert.match(shown(revealChapter), /THIS CHAPTER REVEALS/u);
  const last = prompt(planned, 10);
  assert.match(shown(last), /the harbour master gave the order/u, "the truth is the arc's to spend");
  assert.match(shown(last), /THIS IS THE ARC'S LAST CHAPTER/u);
  // The arc's block: this chapter's purpose, and the later ones marked as not to be played.
  assert.match(shown(before), /This chapter's purpose: Chapter 4/u);
  assert.match(shown(before), /do not play them yet/u);
});

function planContext(arc: StoryArc | null, number: number): PlanContext {
  return {
    units,
    state: { ...normalizeState(undefined), lis: Object.fromEntries(CAST.map((li) => [li.id, defaultLiState()])) },
    world: { content: defaultContent() },
    number,
    lead: KAI,
    arc,
  };
}

const reply = (changes: Record<string, unknown> = {}) => {
  const parsed = ChapterPlanSchema.safeParse(planReply(changes));
  assert.ok(parsed.success);
  return parsed.data as ChapterPlanReply;
};

test("a scheduled chapter must place its reveal on a node whose cast holds the holder", () => {
  const planned = arc();
  const missing = normalizeChapterPlan(reply(), planContext(planned, 5));
  assert.match(String(missing), /scheduled to reveal something/u);
  // Node 4's cast holds Kai.
  const placed = normalizeChapterPlan(reply({ revealNode: 4 }), planContext(planned, 5));
  assert.equal(typeof placed, "object", String(placed));
  if (typeof placed === "string") return;
  assert.deepEqual(placed.nodes[4]!.reveal, { kind: "piece", li: KAI });
  // A node without the holder is refused, not silently revealed.
  const withoutKai = planReply();
  withoutKai.nodes[3].cast = [SOL, MIR];
  const wrong = normalizeChapterPlan(reply({ nodes: withoutKai.nodes, revealNode: 3 }), planContext(planned, 5));
  assert.match(String(wrong), /must be in the node that reveals/u);
});

test("a chapter that reveals nothing never carries a reveal, and the last chapter puts the big event in its climax", () => {
  const planned = arc();
  const early = normalizeChapterPlan(reply({ revealNode: 2 }), planContext(planned, 4));
  assert.equal(typeof early, "object", String(early));
  if (typeof early !== "string") {
    assert.equal(
      early.nodes.some((node) => node.reveal),
      false,
      "a hallucinated early reveal cannot land",
    );
  }
  const lastMissing = normalizeChapterPlan(reply({ revealNode: 5 }), planContext(planned, 10));
  assert.match(String(lastMissing), /set eventNode to the climax node's index/u);
  const last = normalizeChapterPlan(reply({ eventNode: 5, revealNode: 5 }), planContext(planned, 10));
  assert.equal(typeof last, "object", String(last));
  if (typeof last === "string") return;
  assert.equal(last.nodes[5]!.arcEvent, true);
  assert.deepEqual(last.nodes[5]!.reveal, { kind: "truth" }, "the truth reveal is stamped from the schedule");
});

test("neither stamped field reaches the client", () => {
  const chapter = normalizeChapter({
    key: "main-5",
    kind: "main",
    number: 5,
    lead: KAI,
    title: "The Drowned Bell",
    tags: [],
    summary: "…",
    nodes: [{ i: 0, kind: "beat", guide: "…", cast: [KAI], reveal: { kind: "piece", li: KAI }, arcEvent: true }],
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "c1",
  })!;
  assert.equal(chapter.nodes[0]!.reveal?.kind, "piece", "the node keeps it on the server");
  const view = toChapterView(chapter);
  assert.equal("reveal" in view.nodes[0]!, false);
  assert.equal("arcEvent" in view.nodes[0]!, false);
});

test("a broken arc document still reads, and its usable parts survive", () => {
  const damaged = normalizeArc({
    number: 2,
    kind: "nonsense",
    label: "",
    from: 11,
    plan: [
      { n: 11, purpose: "a quiet day" },
      { n: 12, purpose: "a louder one" },
    ],
  })!;
  assert.equal(damaged.kind, "story", "an unknown kind reads as a story arc");
  assert.equal(damaged.endsAt, 12);
  assert.equal(damaged.label, "2", 'a nameless arc falls back to its number (the screen already says "Arc")');
  assert.equal(damaged.endsWith?.n, 12, "a story arc always ends with something");
  assert.equal(
    normalizeWorld({ setting: "x", content: defaultContent() }).mystery.truth,
    "",
    "the world has no truth to leak",
  );
  void SOL;
});

// ── M2: the end-of-arc choice (#1983) ──

test("the ways on: breathing room and the story going on always, someone new only while the cast has room", () => {
  const three = normalizeState({ lis: Object.fromEntries(CAST.map((li) => [li.id, defaultLiState()])) });
  assert.deepEqual(arcChoiceFor(three).options, ["breathe", "continue", "newcomer"]);
  assert.equal(arcChoiceFor(three).castFull, false);
  const five = normalizeState({
    lis: Object.fromEntries(
      [...CAST, { id: "li-fourth-aaaa", name: "Fourth" }, { id: "li-fifth-bbbb", name: "Fifth" }].map((li) => [
        li.id,
        defaultLiState(),
      ]),
    ),
  });
  assert.deepEqual(arcChoiceFor(five).options, ["breathe", "continue"], "a full cast hides the newcomer");
  assert.equal(arcChoiceFor(five).castFull, true);
});

test("the player's choice decides the arc's kind: breathing room is a breathing arc, whatever the model wrote", () => {
  const breathing = normalizeArcPlan(
    parse(
      arcReply({
        kind: "story",
        chapters: purposes(4),
        endsWith: null,
        reveals: [],
        antagonist: null,
      }),
    ),
    { ...context(), choice: "breathe" },
  );
  assert.equal(typeof breathing, "object", String(breathing));
  if (typeof breathing === "string") return;
  assert.equal(breathing.kind, "breathing");
  assert.deepEqual(breathing.reveals, []);
  assert.equal(breathing.endsWith, null);
  assert.deepEqual(breathing.choice, { kind: "breathe" });
  const going = normalizeArcPlan(parse(arcReply({ kind: "breathing", chapters: purposes(9), reveals: [] })), {
    ...context(),
    choice: "continue",
  });
  assert.equal(typeof going, "object", String(going));
  if (typeof going === "string") return;
  assert.equal(going.kind, "story", "the story going on is always a story arc");
  assert.deepEqual(going.choice, { kind: "continue" });
});

test("POST /arcs waits for a finished arc, and refuses a newcomer the player did not name", async () => {
  const t = await storyWorld({ runKey: "r-arcs-aaaaaa", replies: [json(planReply())] });
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  // The arc is still being played: there is nothing to choose yet.
  const early = await t.call("POST", "/runs/:run/arcs", { choice: "continue" });
  assert.equal(early.status, 409, JSON.stringify(early.body));
  assert.equal(early.body.code, "conflict");
  // The choice may not be "newcomer" without saying who arrives.
  const bare = await t.call("POST", "/runs/:run/arcs", { choice: "newcomer" });
  assert.equal(bare.status, 400, JSON.stringify(bare.body));
  // A chapter may not be planned past an arc that has ended without the choice (here the arc covers 10 chapters, so
  // chapter 2 is still inside it); the gate itself is exercised by the 409 above.
  const story = await t.call("GET", "/runs/:run/story");
  assert.equal(story.body.arc.number, 1);
  assert.equal(story.body.arcChoice, null, "no choice is offered mid-arc");
});

const WREN = {
  source: "archetype",
  archetype: "brilliant-monster",
  name: "Wren",
  pronouns: { subject: "they", object: "them", possessive: "their" },
};
const ARC_WITH_WREN = json(arcReply({ reveals: [], newcomer: { how: "Wren walks in out of the rain." } }));

/** Plans chapter 1 (and with it the first arc), then plays out the arc's ten chapters: the end-of-arc choice is open. */
async function finishFirstArc(t: Awaited<ReturnType<typeof storyWorld>>) {
  assert.equal((await t.call("POST", "/runs/:run/chapters/next", { lead: KAI })).status, 200);
  const first = (await t.store.readDoc(chapterId(t.runId, "main-1"), normalizeChapter))!;
  for (let n = 2; n <= 10; n += 1) {
    await t.store.mutateDoc(runDocTarget("chapter", chapterId(t.runId, `main-${n}`)), normalizeChapter, () => ({
      ...first,
      key: `main-${n}`,
      number: n,
    }));
  }
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    chapters: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`main-${i + 1}`, { beatsRead: 7, completed: at, applied: [] }]),
    ),
  }));
}

test("two end-of-arc choices at once plan one arc and bring in one newcomer: the second waits and pays for nothing", async () => {
  // A second tab, or a tap after coming back to Story during the long plan: both requests arrive before an arc is saved.
  const t = await storyWorld({
    runKey: "r-arcs-bbbbbb",
    replies: [json(planReply()), json(bible()), json(bible())],
    arcReply: () => ARC_WITH_WREN,
  });
  await finishFirstArc(t);
  const paid = () => t.calls.length;
  const before = paid();
  const newcomer = WREN;
  const answers = await Promise.all([
    t.call("POST", "/runs/:run/arcs", { choice: "newcomer", newcomer }),
    t.call("POST", "/runs/:run/arcs", { choice: "newcomer", newcomer }),
  ]);
  assert.deepEqual(
    answers.map((answer) => answer.status),
    [200, 409],
    JSON.stringify(answers.map((answer) => answer.body)),
  );
  assert.equal(paid() - before, 2, "one bible and one arc plan, both for the first request");
  const run = (await readRun(t.store, t.runId))!;
  assert.deepEqual(Object.keys(run.state.lis), [...CAST.map((li) => li.id), answers[0]!.body.li]);
  assert.equal(run.units.filter((unit) => unit.name === "Wren").length, 1, "nobody stays in the cast unintroduced");
});

test("a failed newcomer arc takes them out of the cast but keeps their bible, and the same arrival again reuses it", async () => {
  // Arc plans: chapter 1's is good; the newcomer's first plan and its repair turn do not match; the next one does.
  let arcCalls = 0;
  const t = await storyWorld({
    runKey: "r-arcs-cccccc",
    replies: [json(planReply()), json(bible()), json(bible())],
    arcReply: () => ((arcCalls += 1) === 2 || arcCalls === 3 ? json({}) : ARC_WITH_WREN),
  });
  await finishFirstArc(t);
  const cast = CAST.map((li) => li.id);
  const failed = await t.call("POST", "/runs/:run/arcs", { choice: "newcomer", newcomer: WREN });
  assert.equal(failed.status, 502, JSON.stringify(failed.body));
  const after = (await readRun(t.store, t.runId))!;
  assert.deepEqual(Object.keys(after.state.lis), cast, "out of the cast");
  assert.ok(
    after.world.web.every((row) => cast.includes(row.a) && cast.includes(row.b)),
    "and out of the world's web",
  );
  const kept = (await t.store.listRun("unit", t.runId))
    .map((record) => normalizeUnit(record.data))
    .filter((unit) => unit.name === "Wren");
  assert.equal(kept.length, 1, "their unit stays");
  assert.ok(kept[0]!.bible, "with the bible already paid for");
  const before = t.calls.length;
  const again = await t.call("POST", "/runs/:run/arcs", { choice: "newcomer", newcomer: WREN });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(t.calls.length - before, 1, "the arc plan alone: no second bible");
  assert.equal(again.body.li, kept[0]!.id, "the same newcomer, under the same id");
  const run = (await readRun(t.store, t.runId))!;
  assert.deepEqual(Object.keys(run.state.lis), [...cast, kept[0]!.id], "back in the cast, last");
  assert.equal(run.world.web.filter((row) => row.a === kept[0]!.id).length, CAST.length, "with a tie to each of them");
});

// ── M3: someone new arrives (#1983) ──

test("a newcomer is written in: a unit with a bible, their ties to the cast, and last in the cast order", async () => {
  const t = await storyWorld({ runKey: "r-arrive-aaaaaa", replies: [json(bible())] });
  const before = Object.keys((await t.call("GET", "/runs/:run/story")).body ? {} : {}).length;
  void before;
  const arrival = await introduceLoveInterest(
    t.deps,
    t.runId,
    {
      source: "archetype",
      archetype: "brilliant-monster",
      name: "Wren",
      pronouns: { subject: "they", object: "them", possessive: "their" },
    },
    {},
  );
  assert.equal(arrival.name, "Wren");
  const run = await readRun(t.store, t.runId);
  const cast = Object.keys(run!.state.lis);
  assert.equal(cast.at(-1), arrival.id, "appended last, so the cast order of everyone else is unchanged");
  const unit = run!.units.find((entry) => entry.id === arrival.id);
  assert.ok(unit?.bible, "a love interest exists once their bible does");
  assert.equal(unit?.name, "Wren");
  assert.equal(
    run!.world.web.filter((row) => row.a === arrival.id).length,
    CAST.length,
    "a tie to everyone already there",
  );
  // A full cast refuses another arrival.
  const full = normalizeState({
    lis: Object.fromEntries(
      [...CAST, { id: "li-fourth-aaaa" }, { id: "li-fifth-bbbb" }].map((li) => [li.id, defaultLiState()]),
    ),
  });
  void full;
});

test("a refused arrival is not invented: an unknown archetype is a 400 and writes nothing", async () => {
  const t = await storyWorld({ runKey: "r-arrive-bbbbbb" });
  const count = async () => (await readRun(t.store, t.runId))!.units.length;
  const had = await count();
  await assert.rejects(
    introduceLoveInterest(
      t.deps,
      t.runId,
      {
        source: "archetype",
        archetype: "not-an-archetype",
        name: "Nobody",
        pronouns: { subject: "they", object: "them", possessive: "their" },
      },
      {},
    ),
    /Unknown archetype/u,
  );
  assert.equal(await count(), had, "nothing was written");
});

test("a later arc planned through planArc refuses a piece an earlier arc already played (Dottore's proof gap)", async () => {
  // The first arc reveals Kai's piece in chapter 5 and the truth in chapter 10, and both chapters are read; a second arc
  // that schedules Kai's piece again must be refused by the planner's own repeat check, not only by the helper.
  const first = arc();
  const t = await storyWorld({
    runKey: "r-repeat-aaaaaa",
    // The model's answer for the second arc: the same piece, again.
    arcReply: () =>
      JSON.stringify(
        arcReply({
          label: "A second tide",
          reveals: [{ chapter: 3, kind: "piece", li: KAI, what: "the same piece again" }],
        }),
      ),
  });
  const run = (await readRun(t.store, t.runId))!;
  const chapters = [
    { number: 5, key: "main-5" },
    { number: 10, key: "main-10" },
  ];
  const state = {
    ...run.state,
    chapters: {
      "main-5": { beatsRead: 0, completed: "2026-10-30", applied: [] },
      "main-10": { beatsRead: 0, completed: "2026-10-31", applied: [] },
    },
  };
  await assert.rejects(
    planArc(
      t.deps,
      t.runId,
      {
        world: run.world,
        player: run.player,
        units: run.units.filter((unit) => unit.bible),
        state,
        memory: "",
        previous: [first],
        chapters,
        number: 2,
        from: 11,
        choice: "continue",
      },
      { debugMode: false },
    ),
    /already revealed|did not match/u,
  );
});

// ── #2047: a judgment the protagonist may get wrong ──

/** The planner's judgment: the true answer (the harbour master) listed first, as a planner tends to. */
const judgment = {
  chapters: [6, 8, 6, 10, 0, 11],
  question: " Who rang the bell? ",
  answers: ["The harbour master", "Kai", "Mireille"],
};
/** What the narrator gets: the question and the answers, sorted, and nothing else. */
const asked = { question: "Who rang the bell?", answers: ["Kai", "Mireille", "The harbour master"] };

const ines = normalizePlayer({
  personaId: "",
  name: "Ines",
  pronouns: { subject: "she", object: "her", possessive: "her" },
  goal: "Find out why the lights die.",
  about: "",
})!;

test("an arc keeps a valid judgment, its chapters before the truth, and drops a broken one without refusing the arc", () => {
  const planned = arc({ judgment });
  assert.deepEqual(
    planned.judgment,
    { ...asked, chapters: [6, 8] },
    "trimmed, the answers sorted so the true one no longer leads, and only chapters inside the arc before its truth",
  );
  assert.deepEqual(arc({ judgment }, { number: 3, from: 21 }).judgment?.chapters, [26, 28], "positions are 1-based");
  for (const broken of [
    { ...judgment, answers: ["Kai"] },
    { ...judgment, answers: ["Kai", "Mireille", "Sol", "The harbour master", "The keeper"] },
    { ...judgment, answers: ["Kai", " kai"] },
    { ...judgment, answers: ["Kai", "  "] },
    { ...judgment, answers: ["Kai", 3] },
    { ...judgment, answers: ["Kai", "x".repeat(161)] },
    { ...judgment, question: "   " },
    { ...judgment, chapters: [10] },
    { ...judgment, chapters: [] },
    { question: judgment.question, answers: judgment.answers },
    "Kai did it",
    null,
  ]) {
    assert.equal("judgment" in arc({ judgment: broken }), false, `dropped: ${JSON.stringify(broken)}`);
  }
  assert.equal("judgment" in arc(), false, "an arc with no such question has none");
  const breathing = normalizeArcPlan(
    parse(
      arcReply({
        kind: "breathing",
        chapters: purposes(4),
        endsWith: null,
        reveals: [],
        antagonist: null,
        judgment: { ...judgment, chapters: [2] },
      }),
    ),
    { ...context(), choice: "breathe" },
  );
  assert.equal(typeof breathing, "object", String(breathing));
  assert.equal("judgment" in (breathing as StoryArc), false, "a breathing arc never has one");
  // Stored: the same rules on absolute chapter numbers, and an arc from before #2047 reads without one.
  assert.deepEqual(normalizeArc(planned)!.judgment, planned.judgment, "a saved judgment reads back as it was");
  assert.deepEqual(
    normalizeArc({ ...planned, judgment: { ...asked, chapters: [6, 30, 10] } })!.judgment?.chapters,
    [6],
  );
  assert.equal("judgment" in normalizeArc(arc())!, false, "a legacy arc keeps working without one");
  assert.equal("judgment" in normalizeArc({ ...planned, kind: "breathing" })!, false);
  // Nothing marks the true answer, and nothing of it reaches the player.
  assert.deepEqual(Object.keys(planned.judgment!).sort(), ["answers", "chapters", "question"]);
  assert.deepEqual(Object.keys(toArcView(planned, 4)).sort(), [
    "done",
    "endsAt",
    "from",
    "kind",
    "label",
    "number",
    "read",
  ]);
});

test("the arc planner is told the judgment is optional, only for a real mystery, and never in a breathing arc", () => {
  for (const choice of ["continue", "breathe"] as const) {
    const system = arcPlanMessages({
      world: world(),
      player: ines,
      units,
      state: planContext(null, 1).state,
      memory: "",
      previous: [],
      chapters: [],
      number: 1,
      from: 1,
      choice,
    })[0]!.content;
    assert.match(system, /"judgment": \{"question"/u, `${choice}: the shape names it`);
    assert.match(
      system,
      /- judgment: OPTIONAL\. Only when this arc holds a mystery, suspects, a traitor or a disputed account/u,
    );
    assert.match(system, /2 to 4 plausible answers, worded the same way; the true one .* is always among them/u);
    assert.match(
      system,
      /Name the true answer in endsWith\.what or in the reveal that answers it, since later writers see only those/u,
      "a wrong guess can only play out when a later writer knows the answer",
    );
    assert.match(system, /Never in a breathing arc, and never invented to fill the field/u);
    assert.match(system, /when the arc has no such question, omit judgment\./u);
  }
});

test("the chapter planner of a listed chapter is told to leave its last node free for a big choice, and no other is", () => {
  const listed = shown(prompt(null, 4, true));
  assert.match(
    listed,
    /- This chapter's end may close on a judgment the protagonist can get wrong \(the narrator decides; it is optional\): put the climax second-to-last, so the last node can hold a big choice\./u,
  );
  assert.doesNotMatch(shown(prompt(null, 4)), /close on a judgment/u, "an unlisted chapter plans as before");
});

const judgedChapter = (nodes: ChapterNode[]) =>
  normalizeChapter({
    key: "main-6",
    kind: "main",
    number: 6,
    lead: KAI,
    foil: MIR,
    title: "The Bell",
    tags: [],
    summary: "…",
    nodes,
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "c1",
  })!;

const narration = (chapter: ReturnType<typeof judgedChapter>, i: number) =>
  shown(
    beatMessages({
      world: world(),
      player: ines,
      units,
      state: planContext(null, 6).state,
      chapter,
      node: chapter.nodes[i]!,
      storySoFar: [],
      memory: "",
    }),
  );

test("the last node of a chapter listed for the judgment may close on it: every answer, optional, no hint of the truth", () => {
  const planned = arc({ judgment });
  const plan = normalizeChapterPlan(reply(), { ...planContext(planned, 6), judgment: asked });
  assert.equal(typeof plan, "object", String(plan));
  if (typeof plan === "string") return;
  assert.deepEqual(plan.nodes.at(-1)!.judgment, asked, "the question and the answers, never the chapters");
  assert.equal(plan.nodes.filter((node) => node.judgment).length, 1, "the last node only");
  // The stored chapter keeps it for the narrator, and the client never sees it.
  const chapter = judgedChapter(plan.nodes);
  assert.deepEqual(chapter.nodes.at(-1)!.judgment, asked);
  assert.equal("judgment" in toChapterView(chapter).nodes.at(-1)!, false);
  const last = narration(chapter, chapter.nodes.length - 1);
  assert.ok(last.includes("This is the chapter's last node: if it ends on a big choice, make it a different kind"));
  const line = last.split("\n").find((entry) => entry.startsWith("- The big choice MAY be a judgment"));
  assert.ok(line, "the judgment line follows the varied-decision line");
  assert.ok(line.includes('"Who rang the bell?"'));
  assert.ok(line.includes('one option per answer and no others: "Kai", "Mireille", "The harbour master",'));
  for (const answer of asked.answers) assert.equal(line.split(`"${answer}"`).length, 2, `"${answer}" once`);
  assert.match(line, /you are not told which and neither is the protagonist/u);
  assert.match(line, /Whatever the player picks is canon, and the chapters after play it out/u);
  assert.match(line, /This is optional: a different kind of big choice, or none, is just as good\./u);
  assert.doesNotMatch(last, /gave the order/u, "the truth never reaches the narrator");
  assert.doesNotMatch(narration(chapter, 0), /MAY be a judgment/u, "a node before the last has no line");
  // A climax cannot hold a big choice, so a chapter that ends on its climax is not stamped (nor spends the judgment).
  const nodes = planReply().nodes;
  const climaxLast = normalizeChapterPlan(reply({ nodes: [...nodes.slice(0, 5), nodes[6], nodes[5]] }), {
    ...planContext(planned, 6),
    judgment: asked,
  });
  assert.equal(typeof climaxLast, "object", String(climaxLast));
  if (typeof climaxLast === "string") return;
  assert.equal(climaxLast.nodes.at(-1)!.kind, "confrontation");
  assert.equal(
    climaxLast.nodes.some((node) => node.judgment),
    false,
  );
});

const noDocs = { readDoc: async () => null };

test("a chapter in an arc without a judgment, or one not listed for it, gets no line at all", async () => {
  assert.equal(await judgmentFor(noDocs, "r", arc(), [], 6), null, "no judgment in the arc");
  assert.equal(await judgmentFor(noDocs, "r", arc({ judgment }), [], 7), null, "chapter 7 is not listed");
  assert.deepEqual(await judgmentFor(noDocs, "r", arc({ judgment }), [], 6), asked, "chapter 6 is");
  const plan = normalizeChapterPlan(reply(), planContext(arc(), 6));
  assert.equal(typeof plan, "object", String(plan));
  if (typeof plan === "string") return;
  assert.equal(
    plan.nodes.some((node) => "judgment" in node),
    false,
  );
  const last = narration(judgedChapter(plan.nodes), plan.nodes.length - 1);
  assert.ok(last.includes("This is the chapter's last node: if it ends on a big choice, make it a different kind"));
  assert.doesNotMatch(last, /judgment/u);
});

test("a judgment already asked is not offered again in the arc", async () => {
  const planned = arc({ judgment });
  const runId = "r-judged-aaaaaa";
  const docs = new Map<string, unknown>();
  const store = {
    readDoc: async <T>(id: string, normalize: (data: unknown) => T | null) => normalize(docs.get(id) ?? null),
  };
  const stamped = judgedChapter([
    { i: 0, kind: "beat", guide: "…", cast: [KAI] },
    { i: 1, kind: "beat", guide: "…", cast: [KAI], judgment: asked },
  ]);
  const big = {
    id: "c1",
    kind: "big",
    at: 1,
    options: asked.answers.map((answer, index) => ({
      id: `o${index}`,
      text: `Name ${answer}.`,
      selection: { kind: "dialogue", text: `It was ${answer}.` },
      segments: [],
    })),
  };
  const lastBeat = (changes: Record<string, unknown>) =>
    docs.set(beatId(runId, "main-6", 1), {
      key: "main-6",
      i: 1,
      kind: "beat",
      segments: [
        { speaker: "", text: "The bell is silent." },
        { speaker: "Ines", text: "I know who it was." },
      ],
      choices: [big],
      choiceCanon: {},
      ...changes,
    });
  lastBeat({ choiceCanon: { c1: "o1" } });
  assert.equal(await judgmentFor(store, runId, planned, [stamped], 8), null, "picked in chapter 6: spent");
  lastBeat({});
  assert.deepEqual(await judgmentFor(store, runId, planned, [stamped], 8), asked, "left unpicked: offered again");
  lastBeat({ choices: [{ ...big, kind: "small" }], choiceCanon: { c1: "o1" } });
  assert.deepEqual(await judgmentFor(store, runId, planned, [stamped], 8), asked, "only a small choice: not asked");
  lastBeat({ choiceCanon: { c1: "o1" }, easedOff: { at: 0 } });
  assert.deepEqual(await judgmentFor(store, runId, planned, [stamped], 8), asked, "eased off before it: not asked");
  // An earlier arc's chapter never spends a later arc's judgment.
  lastBeat({ choiceCanon: { c1: "o1" } });
  const later = arc({ judgment }, { number: 2, from: 11 });
  assert.deepEqual(await judgmentFor(store, runId, later, [stamped], 16), asked);
});

test("POST /chapters/next stamps the arc's judgment on a listed chapter's last node, and the player never sees it", async () => {
  let planPrompt = "";
  const t = await storyWorld({
    runKey: "r-judge-aaaaaa",
    replies: [
      (messages) => {
        planPrompt = messages.map((message) => String(message.content)).join("\n");
        return json(planReply());
      },
    ],
    arcReply: () => JSON.stringify(arcReply({ judgment: { ...judgment, chapters: [1, 4] } })),
  });
  const planned = await t.call("POST", "/runs/:run/chapters/next", { lead: KAI });
  assert.equal(planned.status, 200, JSON.stringify(planned.body));
  const stored = (await t.store.readDoc(chapterId(t.runId, "main-1"), normalizeChapter))!;
  assert.deepEqual(stored.nodes.at(-1)!.judgment, asked, "chapter 1 is listed: its last node may close on it");
  assert.equal(stored.nodes.filter((node) => node.judgment).length, 1);
  assert.match(planPrompt, /This chapter's end may close on a judgment .* put the climax second-to-last/u);
  assert.doesNotMatch(planPrompt, /Who rang the bell/u, "the chapter planner learns only that it is listed");
  assert.doesNotMatch(JSON.stringify(planned.body), /Who rang the bell|judgment/u, "nothing of it reaches the client");
});
