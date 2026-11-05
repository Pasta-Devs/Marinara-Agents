// ──────────────────────────────────────────────
// Otome Forge: story arcs (#1980): the arc planner and the arc a chapter belongs to.
// ──────────────────────────────────────────────
// An arc is a run of main chapters with a goal, a big event near its end and a reveal schedule; it lives in its own
// document (S/schemas/story-arc.ts) and is planned when no arc covers the chapter about to be played: lazily for the
// first, and from the end-of-arc choice for later ones (M2). The arc planner is the ONE writer that always sees the
// mystery's truth; every chapter planner sees it only in the chapter scheduled to reveal it (S/prompts.ts
// chapterPlanMessages).
// Planning happens inside the caller's queued task, never through a second readOrGenerate: that would queue behind
// itself on the run's serial lane and hang.
// The prompt asks for brevity on purpose: one short sentence per chapter purpose, and the normalizer refuses a longer
// one. An arc is a direction, not twelve chapters written in advance.
import type { ForgeMemoryContext } from "@forge-kit/story-memory-fit.mjs";
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
  ARC_PURPOSE_WORDS,
  ArcPlanSchema,
  normalizeArc,
  normalizeArcPlan,
  type ArcPlanContext,
  wordCountOf,
} from "../schemas/story-arc.js";
import type { OtomeStore } from "../store.js";
import { arcPlanMessages } from "../prompts.js";

/** The reply itself needs room for twelve short purposes and a small schedule; reasoning models need far more. */
export const ARC_PLAN_TOKENS = 16000;

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
 * Plans an arc for `from` and saves it, or returns the one a concurrent request already saved. Nothing else is written:
 * progress stays derived from the chapters, so a lost request cannot half-apply. One repair turn on a broken reply
 * comes from generateJson's own normalize, like every planner here. `memory` is the context input.memory is the text
 * of (recallText), so the generation core may fit it.
 */
export async function planArc(
  deps: ArcDeps,
  runId: string,
  input: ArcPlanInput,
  { debugMode, signal, memory }: { debugMode: boolean; signal?: AbortSignal; memory?: ForgeMemoryContext },
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
    ...(memory ? { memory } : {}),
    schema: ArcPlanSchema,
    normalize: (reply) => {
      const arc = normalizeArcPlan(reply, context);
      return typeof arc === "string" ? arc : reply;
    },
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
