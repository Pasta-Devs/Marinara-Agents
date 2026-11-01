// ──────────────────────────────────────────────
// Otome Forge: extra stories, unlocked by prestige past level 10 (#2025)
// ──────────────────────────────────────────────
// Past level 10 a love interest's affection keeps counting: every 300 is a prestige point, and every three points
// unlock one extra story with him (SH/economy.ts prestigeOf, derived from his points, which are never capped; a choice
// loss never takes an unlocked story back: affectionFloorOf). POST /runs/:run/prestige/:li writes the next one on the
// player's tap: his chapter `prestige-<li>-<n>`, planned by P25 (S/items/prompts.ts) and then read like a Character
// Story (kind "story", him alone in every node, no stage move, each beat read to its end paying its Starlight).
// It is something the two of them imagine or play out for fun, so it is never canon: its picks change nothing between
// them (S/story/beats.ts), it is no memory source (S/story/canon.ts) and its plan has no ledger. Writing is
// idempotent: the chapter docs are the record of what was claimed, planning runs in the run's foreground queue, which
// reads the chapter again first, and with nothing new unlocked the latest one is returned, so two taps write one story.
import type { Chapter, LiId } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  nextPrestige,
  prestigeOf,
  type PrestigeKind,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, prestigeKey, runDocTarget } from "../ids.js";
import { readRun } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import type { OtomeStore } from "../store.js";
import { recallText } from "../story/canon.js";
import { clean, type ChapterDeps, type PlannedChapter } from "../story/chapters.js";
import { sideStoryNodes, type StoryPlanContext } from "./character-story.js";
import {
  PrestigePlanSchema,
  STORY_PLAN_TEMPERATURE,
  STORY_PLAN_TOKENS,
  prestigeKindsFor,
  prestigePlanMessages,
  type PrestigePlanReply,
} from "./prompts.js";

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const locked = (message: string) => new OtomeForgeError(409, message, "locked");

/**
 * P25's reply as an extra story, or the first rule it breaks: a kind this world may have (a kink only under NSFW
 * Heat), a premise, and a side story's nodes and tags (sideStoryNodes). It carries no ledger: nothing in it is canon.
 */
export function normalizePrestigePlan(
  reply: PrestigePlanReply,
  context: Omit<StoryPlanContext, "key">,
): (Omit<PlannedChapter, "foil"> & { prestige: { kind: PrestigeKind; premise: string } }) | string {
  const kinds = prestigeKindsFor(context.world);
  const kind = kinds.find((candidate) => candidate === reply.kind.trim().toLowerCase());
  if (!kind) return `kind must be one of ${kinds.join(", ")}`;
  const premise = clean(reply.premise, 600);
  if (!premise) return "premise is empty";
  const side = sideStoryNodes(reply, context);
  if (typeof side === "string") return side;
  return {
    title: clean(reply.title, 200),
    tags: side.tags,
    summary: clean(reply.summary, 1200),
    nodes: side.nodes,
    ledger: { relationship: [], conflict: [], offscreen: [] },
    prestige: { kind, premise },
  };
}

/** His extra stories written so far, oldest first. */
export async function prestigeStories(store: Pick<OtomeStore, "listRun">, runId: string, li: LiId) {
  const number = (chapter: Chapter) => Number(chapter.key.slice(chapter.key.lastIndexOf("-") + 1));
  return (await store.listRun("chapter", runId))
    .map((record) => normalizeChapter(record.data))
    .filter((chapter): chapter is Chapter => !!chapter?.prestige && chapter.li === li)
    .sort((a, b) => number(a) - number(b));
}

/**
 * POST /runs/:run/prestige/:li: his next unlocked extra story, written now (P25, one structured call), or his latest
 * one when nothing new is unlocked; 409 `locked` before the first unlocks. May fail as any plan does (503
 * `no-connection`, 422 `declined`, 502 `bad-format`); nothing is saved then, and the next tap tries again.
 */
export async function ensurePrestigeStory(
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
  const written = await prestigeStories(deps.store, runId, li);
  const n = nextPrestige(liState.points, written.length) ?? written.length;
  if (!n) throw locked(`No extra story with ${unit.name} is unlocked yet.`);
  const key = prestigeKey(li, n);
  const read = () => deps.store.readDoc(chapterId(runId, key), normalizeChapter);
  const stored = await read();
  if (stored) return stored;
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    // Read again in the queue: the state the story is written against is the one of this moment.
    const now = (await readRun(deps.store, runId)) ?? run;
    if (prestigeOf(now.state.lis[li]?.points ?? 0).unlocked < n) {
      throw locked(`No extra story with ${unit.name} is unlocked yet.`);
    }
    const memory = await recallText(deps, runId, {
      job: "structured",
      cast: [li],
      query: { plan: unit.bible?.want ?? "", speakers: [unit.name] },
      signal,
      debugMode,
    });
    const context = { units: now.units, state: now.state, world: now.world, li };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job: "structured",
      label: `prestige-plan/${key}`,
      messages: prestigePlanMessages({
        world: now.world,
        player: now.player,
        unit,
        state: now.state,
        n,
        earlier: written.map((chapter) => ({
          title: chapter.title,
          kind: chapter.prestige!.kind,
          premise: chapter.prestige!.premise,
        })),
        memory,
      }),
      schema: PrestigePlanSchema,
      normalize: (reply) => {
        const plan = normalizePrestigePlan(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      temperature: STORY_PLAN_TEMPERATURE,
      maxTokens: STORY_PLAN_TOKENS,
      debugMode,
      lane: "foreground",
      signal,
    });
    signal?.throwIfAborted();
    const plan = normalizePrestigePlan(value, context) as Exclude<ReturnType<typeof normalizePrestigePlan>, string>;
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
