// ──────────────────────────────────────────────
// Otome Forge: story arcs (#1980): the arc planner (P25) and the arc a chapter belongs to.
// ──────────────────────────────────────────────
// An arc is a run of main chapters with a goal, a big event near its end and a reveal schedule; it lives in its own
// document (S/schemas/story-arc.ts) and is planned when no arc covers the chapter about to be played: lazily for the
// first, and from the end-of-arc choice for later ones (M2). The arc planner is the ONE writer that always sees the
// mystery's truth; every chapter planner sees it only in the chapter scheduled to reveal it (S/story/prompts.ts).
// Planning happens inside the caller's queued task, never through a second readOrGenerate: that would queue behind
// itself on the run's serial lane and hang.
// The prompt asks for brevity on purpose: one short sentence per chapter purpose, and the normalizer refuses a longer
// one. An arc is a direction, not twelve chapters written in advance.
import type {
  ArcChoice,
  LiId,
  Player,
  RunState,
  StoryArc,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { generateJson, type GenerationDeps } from "../generation.js";
import { arcId, runDocTarget } from "../ids.js";
import {
  ARC_LENGTH_MAX,
  ARC_LENGTH_MIN,
  ARC_PURPOSE_WORDS,
  BREATHING_LENGTH_MAX,
  BREATHING_LENGTH_MIN,
  ArcPlanSchema,
  normalizeArc,
  normalizeArcPlan,
  type ArcPlanContext,
  wordCountOf,
} from "../schemas/story-arc.js";
import type { OtomeStore } from "../store.js";
import { STORY_PACING_INSTRUCTION, otomeWritingRules } from "../writing-rules.js";
import { otomeContentContract, otomeContractReminder } from "../content-contract.js";
import { bibleBlock, ledgerBlock, protagonistBlock } from "./prompts.js";

/** The reply itself needs room for twelve short purposes and a small schedule; reasoning models need far more. */
export const ARC_PLAN_TOKENS = 16000;
export const ARC_PLAN_TEMPERATURE = 0.8;

export interface ArcDeps extends GenerationDeps {
  store: OtomeStore;
}

/** Every arc of the run, oldest first. */
export async function listArcs(store: Pick<OtomeStore, "listRun">, runId: string): Promise<StoryArc[]> {
  return (await store.listRun("arc", runId))
    .map((record) => normalizeArc(record.data))
    .filter((arc): arc is StoryArc => !!arc)
    .sort((a, b) => a.number - b.number);
}

/** The arc that covers main chapter `number`, or undefined. */
export function arcCovering(arcs: readonly StoryArc[], number: number): StoryArc | undefined {
  return arcs.find((arc) => number >= arc.from && number <= arc.endsAt);
}

/** How many of an arc's chapters are done: completed main chapters in its range. */
export function arcRead(arc: StoryArc, chapters: ReadonlyArray<{ number?: number; key: string }>, state: RunState) {
  let read = 0;
  for (let n = arc.from; n <= arc.endsAt; n += 1) {
    const chapter = chapters.find((entry) => entry.number === n);
    if (chapter && state.chapters[chapter.key]?.completed) read += 1;
  }
  return read;
}

/**
 * What the run already knows of the mystery, from the arcs planned so far: the pieces already scheduled, and whether the
 * truth was told. A completed arc's reveal is what has surfaced (the arcs before the current one, and the current arc's
 * chapters already read), so a new arc never repeats one.
 */
export function revealedSoFar(
  arcs: readonly StoryArc[],
  chapters: ReadonlyArray<{ number?: number; key: string }>,
  state: RunState,
  upTo: number,
): { pieces: Set<LiId>; truth: boolean } {
  const pieces = new Set<LiId>();
  let truth = false;
  for (const arc of arcs) {
    for (const reveal of arc.reveals) {
      if (reveal.n >= upTo) continue;
      const chapter = chapters.find((entry) => entry.number === reveal.n);
      if (!chapter || !state.chapters[chapter.key]?.completed) continue;
      if (reveal.kind === "truth") truth = true;
      else if (reveal.li) pieces.add(reveal.li);
    }
  }
  return { pieces, truth };
}

/** The mystery's question the planner may see, from the world. */
const questionOf = (world: Pick<World, "mystery">) => world.mystery.question.trim();

export interface ArcPlanInput {
  world: World;
  player: Player;
  units: readonly Unit[];
  state: RunState;
  memory: string;
  previous: readonly StoryArc[];
  /** The run's chapters, so a reveal an earlier arc already played is refused (it is read, never planned). */
  chapters: ReadonlyArray<{ number?: number; key: string }>;
  number: number;
  from: number;
  /** How the player asked for this arc (#1983 M2): the story goes on, a breathing room, or someone new arrives. */
  choice?: ArcChoice;
  /** The newcomer this arc brings in (#1983 M3), when the choice is "newcomer" and they are written already. */
  newcomer?: { id: LiId; name: string } | null;
}

/**
 * The arc planner's prompt: the world, the mystery in full (this is the only writer that always sees the truth), what
 * each love interest wants, the arcs before this one so it does not repeat them, and the rule that keeps it brief.
 */
export function arcPlanMessages({
  world,
  player,
  units,
  state,
  memory,
  previous,
  chapters: _chapters,
  number,
  from,
  choice = "continue",
  newcomer = null,
}: ArcPlanInput) {
  const breathing = choice === "breathe";
  const count = breathing
    ? `${BREATHING_LENGTH_MIN} to ${BREATHING_LENGTH_MAX}`
    : `${ARC_LENGTH_MIN} to ${ARC_LENGTH_MAX}`;
  const system = [
    "You are the arc planner of an otome visual novel: a character-driven romance mystery. You plan one story arc: a run of main chapters with one goal, one big event near its end, and the mystery's reveals placed where they land. Each chapter is planned later from your outline, one at a time.",
    "Reply with ONLY a JSON object of this shape:",
    '{"kind": "<the kind asked for>", "label": "<2–5 words, spoiler-free; the player sees this>", "theme": "<one short sentence>", "goal": "<one short sentence: what the protagonist is after in this arc>", "chapters": ["<one short sentence per chapter, in play order>"], "endsWith": {"what": "<one short sentence: the big event the last chapter carries>", "chapter": 0}, "reveals": [{"chapter": 0, "kind": "piece|truth", "li": "<love interest id, piece only>", "what": "<one sentence: what the protagonist learns>"}], "antagonist": {"name": "<name>", "want": "<one short sentence>", "whyNow": "<one short sentence>"}' +
      (newcomer ? ', "newcomer": {"how": "<one short sentence: the scene they are met in>"}' : "") +
      "}",
    "FIELDS",
    `- chapters: ${count} short purposes, in play order. Each is one sentence of about 12 words and must not exceed ${ARC_PURPOSE_WORDS}. Say what happens in that chapter, not how it is written.`,
    "- chapter positions are 1-based within this arc (1 is its first chapter): endsWith.chapter and each reveals[].chapter. Never write a chapter number of your own.",
    "- reveals: 1 to 4, in the order they land. kind piece reveals one love interest's part of the mystery (name them by id); kind truth reveals the whole answer, only in the last chapter and only once.",
    "- antagonist: a person or force standing against the protagonist this arc; null when the arc's trouble is not a person.",
    "RULES",
    "- One arc, one goal: every chapter moves toward it and none resolves it before the arc's last.",
    "- Do not repeat an earlier arc: not its antagonist, its theme, its ending shape, its mystery question or a reveal already played.",
    "- Every love interest keeps a stake in the arc; none is written out of it.",
    ...(breathing
      ? [
          "- This is a BREATHING arc: no antagonist, no big event, no reveal and no new mystery. Its chapters are days with the people the protagonist loves, each one deepening a different person, and its last chapter lands warm, never on a cliffhanger.",
        ]
      : []),
    ...(newcomer
      ? [
          `- ${newcomer.name} (id ${newcomer.id}) arrives in this arc. Its first chapter is where they meet the protagonist and at least one of the others on the page; later chapters show how each of the cast takes them. They are never the antagonist and never a plot device: they want something of their own.`,
          `- Set newcomer.how to one sentence naming the scene they are met in: where, and who is with the protagonist when it happens.`,
        ]
      : []),
    "- The mystery's truth is yours to schedule, never to spend early: it is revealed in the last chapter, after the pieces.",
    `- Be brief. One sentence per field. No preamble, no restating the world, no explaining the outline. Every purpose over ${ARC_PURPOSE_WORDS} words is refused.`,
    `- Write the label, theme, goal, purposes, endsWith and reveals in ${world.language}.`,
    "- Omit an optional field rather than writing null.",
    "",
    STORY_PACING_INSTRUCTION,
    otomeWritingRules({ story: false, style: world.writingStyle, banned: world.bannedPhrases }),
    "",
    otomeContentContract({ world, lis: units.map((unit) => ({ name: unit.name })), kind: "planner" }),
  ].join("\n");
  const user = [
    "WORLD",
    world.setting.trim() || world.premise.trim(),
    questionOf(world) ? `The mystery: ${questionOf(world)}` : "",
    world.mystery.truth ? `The hidden truth (reveal it only where you schedule it): ${world.mystery.truth}` : "",
    "",
    "WHAT THE MYSTERY HOLDS, PER LOVE INTEREST",
    units
      .map((unit) =>
        world.mystery.pieces[unit.id]
          ? `${unit.id}: ${world.mystery.pieces[unit.id]!.piece} (hidden because ${world.mystery.pieces[unit.id]!.reasonToHide})`
          : "",
      )
      .filter(Boolean)
      .join("\n") || "(none)",
    "",
    "PROTAGONIST",
    protagonistBlock(player),
    "",
    "THE CAST (their drives, not their prose)",
    units
      .map((unit) =>
        [bibleBlock(unit, state, [unit.id], world), ledgerBlock(state, [unit], [unit.id])].filter(Boolean).join("\n"),
      )
      .join("\n\n"),
    "",
    "ARCS BEFORE THIS ONE (do not repeat them)",
    previous.length
      ? previous
          .map(
            (arc) =>
              `Arc ${arc.number} "${arc.label}" (${arc.kind}, chapters ${arc.from}–${arc.endsAt}): ${arc.goal}. Ends: ${
                arc.endsWith?.what ?? "quietly"
              }.${arc.antagonist ? ` Antagonist: ${arc.antagonist.name}.` : ""}${
                arc.reveals.length
                  ? ` Revealed: ${arc.reveals.map((reveal) => `${reveal.kind} in chapter ${reveal.n}`).join(", ")}.`
                  : ""
              }`,
          )
          .join("\n")
      : "(none: this is the first)",
    "",
    memory.trim() ? `STORY MEMORY\n${memory.trim()}` : "",
    "",
    `Plan arc ${number}, covering main chapters ${from} onward.`,
    otomeContractReminder("planner"),
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

/**
 * Plans an arc for `from` and saves it, or returns the one a concurrent request already saved. Nothing else is written:
 * progress stays derived from the chapters, so a lost request cannot half-apply. One repair turn on a broken reply
 * comes from generateJson's own normalize, like every planner here.
 */
export async function planArc(
  deps: ArcDeps,
  runId: string,
  input: ArcPlanInput,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<StoryArc> {
  const target = runDocTarget("arc", arcId(runId, input.number));
  const existing = await deps.store.readDoc(target.id, normalizeArc);
  if (existing) return existing;
  const { pieces, truth } = revealedSoFar(input.previous, input.chapters, input.state, input.from);
  const context: ArcPlanContext = {
    number: input.number,
    from: input.from,
    resolveLi: (value) => {
      const key = typeof value === "string" ? value.trim() : "";
      if (!key) return null;
      const byId = input.units.find((unit) => unit.id === key);
      if (byId) return byId.id;
      const byName = input.units.filter((unit) => unit.name.trim().toLowerCase() === key.toLowerCase());
      return byName.length === 1 ? byName[0]!.id : null;
    },
    revealed: pieces,
    truthTold: truth,
    choice: input.choice ?? "continue",
    ...(input.newcomer ? { newcomer: { id: input.newcomer.id } } : {}),
  };
  const { value, connectionId } = await generateJson(deps, {
    runId,
    job: "structured",
    label: `arc-plan/${input.number}`,
    messages: arcPlanMessages(input),
    schema: ArcPlanSchema,
    normalize: (reply) => {
      const arc = normalizeArcPlan(reply, context);
      return typeof arc === "string" ? arc : reply;
    },
    temperature: ARC_PLAN_TEMPERATURE,
    maxTokens: ARC_PLAN_TOKENS,
    debugMode,
    lane: "foreground",
    signal,
  });
  signal?.throwIfAborted();
  const planned = normalizeArcPlan(value, context) as StoryArc;
  const arc: StoryArc = { ...planned, plannedAt: new Date().toISOString(), connectionId };
  const saved = await deps.store.mutateDoc(target, normalizeArc, (current) => current ?? arc);
  return saved ?? arc;
}

/** The longest purpose the arc planner may write, for the normalizer's message. */
export const PURPOSE_WORDS = ARC_PURPOSE_WORDS;
export const overLongPurpose = (value: string) => wordCountOf(value) > ARC_PURPOSE_WORDS;
