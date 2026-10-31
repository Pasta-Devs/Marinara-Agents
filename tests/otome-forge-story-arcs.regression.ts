// Otome Forge's story arcs (#1980): the arc a run of main chapters follows. An arc's schedule is code, not prose: the
// model gives purposes and 1-based positions and the server stamps every chapter number (off-by-one in a twelve-chapter
// schedule is the likeliest failure); a breathing arc has no reveals, no big event and no antagonist; a reveal outside
// the arc or out of order is dropped; the truth comes only in the arc's last chapter, after its pieces, and never twice
// in a run; and the chapter planner sees the mystery's truth ONLY in the chapter scheduled to reveal it, placing it on a
// node (with its holder, for a piece) and putting the arc's big event in the last chapter's climax. A node in a chapter
// that reveals nothing never carries a reveal, so an early reveal cannot land. Nothing hidden reaches the client: the
// arc view carries its name, its range and how far in the player is, and toChapterView drops both stamped fields.
import assert from "node:assert/strict";
import test from "node:test";
import type { StoryArc } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
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
  normalizeChapterPlan,
  type PlanContext,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/chapters.ts";
import {
  chapterPlanMessages,
  ChapterPlanSchema,
  type ChapterPlanReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/story/prompts.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { CAST, HE, KAI, MIR, SOL, bible, planReply } from "./fixtures/otome-forge-story.ts";

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

function prompt(arc: StoryArc | null, number: number) {
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
  assert.equal(damaged.label, "Arc 2", "a nameless arc still has a name to show");
  assert.equal(damaged.endsWith?.n, 12, "a story arc always ends with something");
  assert.equal(
    normalizeWorld({ setting: "x", content: defaultContent() }).mystery.truth,
    "",
    "the world has no truth to leak",
  );
  void SOL;
});
