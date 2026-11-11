// ──────────────────────────────────────────────
// Otome Forge: bond stories (0.23.0)
// ──────────────────────────────────────────────
// POST /runs/:run/bond/:li writes the story of the bond rank he stands at (C/shared/bond.ts), once, on the tap: a canon
// Character Story of his (`story-bond-<li>-<level>`, no new chapter regex) whose heart is that rank's reveal, planned by
// bondPlanMessages in the post-confession register. Playing it is what opens the next rank (bondRankOf counts the played
// ones), so the ranks cannot be skipped and every one of them is read.
// Canon, unlike an extra story (#2025): kept in the ledger, written to the timeline and recall like any Character Story,
// and its reveal joins his bible (S/bond.ts fillBondReveals, read on the next scene). It pays its beats as a side story
// does, and nothing more (S/state/rewards.ts PAYS_BEATS).
import type { Chapter, LiId } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  bondRankAt,
  bondStoriesPlayed,
  bondStoryKey,
  type BondRank,
} from "../../../../../client/src/features/otome-forge/shared/bond.js";
import { LAST_STAGE } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { bondRankOf } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget } from "../ids.js";
import { BondPlanSchema, STORY_PLAN_TOKENS, type BondPlanReply } from "../items/replies.js";
import { fillBondReveals } from "../bond.js";
import { bondPlanMessages } from "../prompts.js";
import { readRun } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { sideStoryNodes, type StoryPlanContext } from "../items/character-story.js";
import { clean, planLedger, type ChapterDeps, type PlannedChapter } from "../story/chapters.js";
import { recallText } from "../story/canon.js";

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const locked = (message: string) => new OtomeForgeError(409, message, "locked");

/**
 * The bond plan's reply as a bond story, or the first rule it breaks: a side story's nodes and tags (sideStoryNodes),
 * his ledger rows only, and the rank it settles. It carries no voiced line: a bond story is not a Memory.
 */
export function normalizeBondPlan(
  reply: BondPlanReply,
  context: StoryPlanContext,
  bond: { rank: BondRank; reveal: string },
): (Omit<PlannedChapter, "foil"> & { bond: { rank: number; reveal: string } }) | string {
  const { li } = context;
  const side = sideStoryNodes(reply, context);
  if (typeof side === "string") return side;
  // Number 0: a side story is never a main chapter, so no misunderstanding falls due in it.
  const ledger = planLedger(reply, { ...context, number: 0 }, new Set([li]), {
    main: false,
    idPrefix: `c-${context.key}`,
    knows: [li],
  });
  if (typeof ledger === "string") return ledger;
  return {
    title: clean(reply.title, 200),
    tags: side.tags,
    summary: clean(reply.summary, 1200),
    nodes: side.nodes,
    ledger: {
      relationship: ledger.relationship.filter((row) => row.li === li),
      conflict: ledger.conflict.filter((row) => row.li === li),
      offscreen: [],
    },
    bond: { rank: bond.rank.level, reveal: bond.reveal },
  };
}

/**
 * The rank whose story is waiting for him: the one he stands at, once his finale is read, while it is unplayed. It is
 * always at most one beyond the played ones (bondRankOf), so a rank cannot be skipped by banking affection.
 */
export function waitingBondRank(liState: { points: number; stage: number }, played: number): BondRank | undefined {
  if (liState.stage < LAST_STAGE) return undefined;
  const level = bondRankOf(liState.points, true, played);
  return bondRankAt(level);
}

/**
 * POST /runs/:run/bond/:li: the story of the bond rank he stands at, written now (one structured call), or the one
 * written already; 409 `locked` before his finale or once that rank's story is played. May fail as any plan does (503
 * `no-connection`, 422 `declined`, 502 `bad-format`); nothing is saved then, and the next tap tries again.
 */
export async function ensureBondStory(
  deps: ChapterDeps,
  runId: string,
  li: LiId,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const unit = run.units.find((candidate) => candidate.id === li && candidate.bible);
  const liState = run.state.lis[li];
  if (!unit || !liState) throw notFound("love interest");
  if (liState.stage < LAST_STAGE) throw locked(`Bond ranks open after ${unit.name}'s finale.`);
  const played = bondStoriesPlayed(run.state.chapters, li);
  const rank = waitingBondRank(liState, played);
  if (!rank) throw locked(`Every bond rank with ${unit.name} is played for now.`);
  const key = bondStoryKey(li, rank.level);
  const read = () => deps.store.readDoc(chapterId(runId, key), normalizeChapter);
  const stored = await read();
  if (stored) return stored;
  // The reveal is his bible's entry for this rank; it is written first (one call, once) so the story is planned around
  // the same truth the scenes will later know.
  const reveals = await fillBondReveals(deps, runId, li, { debugMode, signal });
  const reveal = reveals.find((entry) => entry.level === rank.level)?.truth ?? "";
  signal?.throwIfAborted();
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    // Read again in the queue: the state the story is written against is the one of this moment.
    const now = (await readRun(deps.store, runId)) ?? run;
    const nowState = now.state.lis[li];
    if (!nowState || nowState.stage < LAST_STAGE) throw locked(`Bond ranks open after ${unit.name}'s finale.`);
    if (bondStoriesPlayed(now.state.chapters, li) > played)
      throw locked(`${unit.name} has moved on: open the next bond rank instead.`);
    const memory = await recallText(deps, runId, {
      job: "narration",
      cast: [li],
      query: { plan: unit.bible?.want ?? "", speakers: [unit.name] },
      signal,
      debugMode,
    });
    const context = { units: now.units, state: now.state, world: now.world, li, key };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job: "narration",
      label: `bond-plan/${key}`,
      messages: bondPlanMessages({
        world: now.world,
        player: now.player,
        unit,
        state: now.state,
        rank,
        reveal,
        memory: memory.text,
      }),
      memory,
      schema: BondPlanSchema,
      normalize: (reply) => {
        const plan = normalizeBondPlan(reply, context, { rank, reveal });
        return typeof plan === "string" ? plan : reply;
      },
      maxTokens: STORY_PLAN_TOKENS,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const plan = normalizeBondPlan(value, context, { rank, reveal }) as Exclude<
      ReturnType<typeof normalizeBondPlan>,
      string
    >;
    const chapter: Chapter = {
      key,
      kind: "story",
      li,
      lead: li,
      ...plan,
      plannedAt: new Date().toISOString(),
      connectionId,
    };
    // One another request saved first wins.
    return (
      (await deps.store.mutateDoc(
        runDocTarget("chapter", chapterId(runId, key)),
        normalizeChapter,
        (current) => current ?? chapter,
      )) ?? chapter
    );
  });
}
