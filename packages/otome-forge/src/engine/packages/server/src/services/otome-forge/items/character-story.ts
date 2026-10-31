// ──────────────────────────────────────────────
// Otome Forge: an item's own chapter `story-<itemId>` (plan M4 "First open"): a Memory's Character Story, a Moment, or
// a look's first-wear beat
// ──────────────────────────────────────────────
// Written on the item's first open (S/items/open.ts), against the canon of that day, and then read like any chapter:
// the M2a beat engine writes each node with P6 and its Character Story framing (P22; P23 for a single node), the
// reader plays it, and each beat read to its end pays its Starlight (S/state/rewards.ts: a story chapter pays only for
// its beats). It has no gate and moves no stage.
// - memory5: P21 plans 3–5 nodes and the voiced line the Memory's card plays (one structured call).
// - moment4: one node from the Moment's premise, with no planning call.
// - his-look5: one node, the first time he wears the look, with no planning call.
// Every node holds only its love interest: the chapter is his own (kind "story", `li`), so its canon reaches only his
// own prompts and scenes he is in (S/story/canon.ts), like a route chapter. Writing it is idempotent: planning runs
// in the run's foreground queue, which reads the chapter again first, so two opens plan once, and the item's `story`
// (and `voicedLine`, which the chapter keeps) are filled from the chapter that was saved, by any later open too.
import type {
  Chapter,
  ChapterNode,
  LiId,
  RunState,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { NOTICED_WORDS_MAX } from "../../../../../client/src/features/otome-forge/shared/wardrobe.js";
import type { Item } from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { updateIfChanged } from "../art/paint.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, itemId, itemStoryKey, runDocTarget } from "../ids.js";
import { readRun } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { normalizeItem } from "../schemas/wish.js";
import { recallText } from "../story/canon.js";
import { clean, planLedger, planNodes, planTags, type ChapterDeps, type PlannedChapter } from "../story/chapters.js";
import {
  STORY_NODES_MAX,
  STORY_NODES_MIN,
  STORY_PLAN_TEMPERATURE,
  STORY_PLAN_TOKENS,
  StoryPlanSchema,
  checkLine,
  storyPlanMessages,
  type StoryPlanReply,
} from "./prompts.js";

/** The item kinds whose first open writes a chapter. */
export const STORY_KINDS: ReadonlySet<Item["kind"]> = new Set(["memory5", "moment4", "his-look5"]);

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");

export interface StoryPlanContext {
  units: ReadonlyArray<Pick<Unit, "id" | "name">>;
  state: RunState;
  world: Parameters<typeof planTags>[1];
  li: LiId;
  key: string;
}

/**
 * P21's reply as a Character Story, or the first rule it breaks: 3–5 nodes of beats or moments, every one holding him
 * alone (another love interest named in a node is left out), no key image (the Memory has its own) and nothing
 * resolved in passing, tags without a Line, the ledger's rows about him alone, and a voiced line of at most 20 words.
 */
export function normalizeStoryPlan(
  reply: StoryPlanReply,
  context: StoryPlanContext,
): (Omit<PlannedChapter, "foil"> & { voicedLine: string }) | string {
  const { li } = context;
  if (reply.nodes.length < STORY_NODES_MIN || reply.nodes.length > STORY_NODES_MAX) {
    return `the story needs ${STORY_NODES_MIN} to ${STORY_NODES_MAX} nodes, not ${reply.nodes.length}`;
  }
  if (reply.nodes.some((node) => node.kind === "confrontation")) return "a Character Story has no confrontation node";
  if (reply.nodes.some((node) => node.kind === "closer")) return "a Character Story has no closer node";
  const nodes: ChapterNode[] = planNodes(reply, context).map(({ i, kind, moment, guide, place }) => ({
    i,
    kind,
    ...(moment ? { moment } : {}),
    guide,
    cast: [li],
    ...(place ? { place } : {}),
  }));
  if (nodes.some((node) => !node.guide)) return "every node needs a guide";
  const tags = planTags(reply, context.world);
  if (typeof tags === "string") return tags;
  // Number 0: a side story is never a main chapter, so no misunderstanding falls due in it.
  const ledger = planLedger(reply, { ...context, number: 0 }, new Set([li]), {
    main: false,
    idPrefix: `c-${context.key}`,
    knows: [li],
  });
  if (typeof ledger === "string") return ledger;
  const line = checkLine(reply.voicedLine, NOTICED_WORDS_MAX);
  if (typeof line === "string") return `voicedLine: ${line}`;
  // Only his rows are kept: a ledger row of a `story-` chapter is read as private to the love interest it names
  // (S/story/prompts.ts knownTo), so a row about anyone else would carry his private story into their plans.
  const own = {
    relationship: ledger.relationship.filter((row) => row.li === li),
    conflict: ledger.conflict.filter((row) => row.li === li),
    offscreen: [],
  };
  return {
    title: clean(reply.title, 200),
    tags,
    summary: clean(reply.summary, 1200),
    nodes,
    ledger: own,
    voicedLine: line.text,
  };
}

/** One node holding him alone, for an item with no planning call. */
const singleNode = (li: LiId, guide: string): ChapterNode[] => [{ i: 0, kind: "beat", guide, cast: [li] }];

/** The one-node chapter a Moment or a first-wear beat is, built from the item with no model call. */
export function singleStoryChapter(item: Item, unit: Pick<Unit, "id" | "name">, at: string): Chapter | null {
  const { name } = unit;
  const premise = item.premise?.trim() || item.title;
  const guide =
    item.kind === "moment4"
      ? `A MOMENT between ${name} and the protagonist: ${premise} One complete scene, with its own small turn.`
      : item.kind === "his-look5" && item.look
        ? `${name} wears a new look for the first time: "${item.look.name}" (${item.look.outfitLine}). The protagonist sees ${name} in it: one short scene of how ${name} carries it, why ${name} wore it now, and what it changes between them for a moment.`
        : "";
  if (!guide) return null;
  return {
    key: itemStoryKey(item.id),
    kind: "story",
    li: unit.id,
    lead: unit.id,
    title: item.title,
    tags: [],
    summary: item.kind === "moment4" ? (item.premise?.trim() ?? "") : "",
    nodes: singleNode(unit.id, guide),
    ledger: { relationship: [], conflict: [], offscreen: [] },
    plannedAt: at,
    connectionId: "",
  };
}

/** Saves the chapter (one another request saved first wins), then names it on the item with its voiced line. */
async function saveStory(deps: ChapterDeps, runId: string, item: string, chapter: Chapter): Promise<Chapter> {
  const saved =
    (await deps.store.mutateDoc(
      runDocTarget("chapter", chapterId(runId, chapter.key)),
      normalizeChapter,
      (current) => current ?? chapter,
    )) ?? chapter;
  await linkStory(deps, runId, item, saved.key, saved.voicedLine);
  return saved;
}

/** The item names its chapter, and a voiced line, once each: a later call changes nothing it already holds. */
async function linkStory(deps: ChapterDeps, runId: string, item: string, key: string, voicedLine?: string) {
  await updateIfChanged(deps.store, runDocTarget("item", itemId(runId, item)), normalizeItem, (current) => {
    const story = current.story ?? { key };
    const line = current.voicedLine ?? voicedLine;
    if (current.story && current.voicedLine === line) return undefined;
    return { ...current, story, ...(line ? { voicedLine: line } : {}) };
  });
}

/**
 * The item's own chapter, written now if it has none: P21 for a Memory, one node for a Moment or a first-wear beat.
 * Null for an item with no story (a Snapshot, a look other than his 5★, an item with no love interest). May fail as any
 * plan does (503 `no-connection`, 422 `declined`, 502 `bad-format`); nothing is saved then, and the next open tries
 * again.
 */
export async function ensureItemStory(
  deps: ChapterDeps,
  runId: string,
  item: Item,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter | null> {
  if (!STORY_KINDS.has(item.kind) || !item.li) return null;
  const li = item.li;
  const key = itemStoryKey(item.id);
  const read = () => deps.store.readDoc(chapterId(runId, key), normalizeChapter);
  const stored = await read();
  if (stored) {
    // An open that saved the chapter but stopped before the item was linked: this one links it, line and all.
    await linkStory(deps, runId, item.id, key, stored.voicedLine);
    return stored;
  }
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Forge run");
  const unit = run.units.find((candidate) => candidate.id === li && candidate.bible);
  if (!unit) throw notFound("love interest");
  if (item.kind !== "memory5") {
    const chapter = singleStoryChapter(item, unit, new Date().toISOString());
    return chapter ? saveStory(deps, runId, item.id, chapter) : null;
  }
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    // Read again in the queue: the state the story is written against is the one of this moment.
    const now = (await readRun(deps.store, runId)) ?? run;
    const memory = await recallText(deps, runId, {
      job: "structured",
      cast: [li],
      query: { plan: item.premise ?? item.title, speakers: [unit.name] },
      signal,
      debugMode,
    });
    const context: StoryPlanContext = { units: now.units, state: now.state, world: now.world, li, key };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `story-plan/${key}`,
      messages: storyPlanMessages({
        world: now.world,
        player: now.player,
        unit,
        state: now.state,
        item,
        memory,
      }),
      schema: StoryPlanSchema,
      normalize: (reply) => {
        const plan = normalizeStoryPlan(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      temperature: STORY_PLAN_TEMPERATURE,
      maxTokens: STORY_PLAN_TOKENS,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const plan = normalizeStoryPlan(value, context) as Exclude<ReturnType<typeof normalizeStoryPlan>, string>;
    return saveStory(deps, runId, item.id, {
      key,
      kind: "story",
      li,
      lead: li,
      ...plan,
      // The banner's title is the one the player already knows.
      title: item.title || plan.title,
      plannedAt: new Date().toISOString(),
      connectionId,
    });
  });
}
