// ──────────────────────────────────────────────
// Otome Hearth: a friend's own stories (#2458) and the epilogue (#2459), planned in one call each
// ──────────────────────────────────────────────
// POST /runs/:run/friends/:id/rank   → the rank story waiting for them: their next rank (2 to 5, in order) once their
//                                      level reaches it, while no grievance of theirs stands. Level 5's is their
//                                      finale; it also picks out a look for her (its `look`), her reward.
// POST /runs/:run/friends/:id/mend   → their make-up story while their grievance stands and has had its space.
// POST /runs/:run/hangouts {friends, place, herLook, topic?} → a hangout with any of her friends whose grievance does
//                                      not stand: her look worn first, then three scenes planned (#2502: around
//                                      what she wants to talk about, when the player says).
// Each is a `story-` chapter (SH/friends.ts keys) with `friendStory`, planned by friendPlanMessages through the run's
// foreground queue (readOrGenerate): two taps plan once, and a chapter already planned is returned as it is. Its
// nodes hold no love interest (cast []): the friends come through the story context (S/prompts.ts friendsBlock) and
// the scene framing (friendStoryFraming). What finishing one pays is S/state/rewards.ts's (readBeatToEnd).
import { z } from "zod";
import type {
  Chapter,
  ChapterNode,
  LiId,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  FRIEND_MAX_LEVEL,
  friendHeld,
  friendLevelOf,
  friendMendKey,
  friendRankKey,
  hangoutKey,
} from "../../../../../client/src/features/otome-forge/shared/friends.js";
import { LIS_MAX } from "../../../../../client/src/features/otome-forge/shared/cast.js";
import { generateJson, readOrGenerate } from "../generation.js";
import { OtomeForgeError } from "../http.js";
import { chapterId, runDocTarget } from "../ids.js";
import { friendPlanMessages, type FriendPlanFor } from "../prompts.js";
import { readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { mendOpen } from "../state/friends.js";
import { clean, planTags, type ChapterDeps } from "./chapters.js";
import { recallText } from "./canon.js";
import { friendCards } from "./friends.js";

/** How many scenes each kind of friend story has. */
export const FRIEND_STORY_NODES = { rank: 3, mend: 2, hangout: 3, epilogue: 3 } as const;
/** The words a plan's look keeps. */
const LOOK_NAME_MAX = 80;
const LOOK_LINE_MAX = 600;

export const FriendPlanSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  summary: z.string(),
  nodes: z.array(z.object({ guide: z.string(), place: z.string().optional() })),
  look: z.object({ name: z.string(), outfitLine: z.string() }).optional(),
  memento: z.string().optional(),
});
type FriendPlanReply = z.infer<typeof FriendPlanSchema>;

const notFound = (what: string) => new OtomeForgeError(404, `No such ${what}.`, "not-found");
const locked = (message: string) => new OtomeForgeError(409, message, "locked");

/** The reply as a chapter's plan, or the first rule it breaks. */
export function normalizeFriendPlan(
  reply: FriendPlanReply,
  { world, nodes, cast, look }: { world: RunDocuments["world"]; nodes: number; cast: LiId[]; look: boolean },
):
  | {
      title: string;
      tags: string[];
      summary: string;
      nodes: ChapterNode[];
      look?: { name: string; outfitLine: string };
    }
  | string {
  if (reply.nodes.length !== nodes) return `the story needs exactly ${nodes} nodes, not ${reply.nodes.length}`;
  const planned = reply.nodes.map(({ guide, place }, i): ChapterNode => ({
    i,
    kind: "beat",
    guide: clean(guide, 1200),
    cast,
    ...(clean(place, 200) ? { place: clean(place, 200) } : {}),
  }));
  if (planned.some((node) => !node.guide)) return "every node needs a guide";
  const tags = planTags(reply, world);
  if (typeof tags === "string") return tags;
  const name = clean(reply.look?.name, LOOK_NAME_MAX);
  const outfitLine = clean(reply.look?.outfitLine, LOOK_LINE_MAX);
  if (look && (!name || !outfitLine)) return "the finale needs the look they pick out for her";
  return {
    title: clean(reply.title, 200) || "Untitled",
    tags,
    summary: clean(reply.summary, 1200),
    nodes: planned,
    ...(look ? { look: { name, outfitLine } } : {}),
  };
}

/** The friend's story chapters already saved of a kind, by key prefix. */
async function savedKeys(deps: ChapterDeps, runId: string, prefix: string): Promise<Chapter[]> {
  return (await deps.store.listRun("chapter", runId))
    .map((record) => normalizeChapter(record.data))
    .filter((chapter): chapter is Chapter => !!chapter?.key.startsWith(prefix));
}

/**
 * Plans one friend story (or the epilogue) as chapter `key`, once: the chapter it already has is returned as it is.
 * `planFor` names what it is for; `cast` the love interests in each node ([] for a friend's story).
 */
export async function planFriendChapter(
  deps: ChapterDeps,
  runId: string,
  run: RunDocuments,
  {
    key,
    planFor,
    nodes,
    cast,
    story,
    look = false,
  }: {
    key: string;
    planFor: FriendPlanFor;
    nodes: number;
    cast: LiId[];
    story: Pick<Chapter, "friendStory" | "ending">;
    look?: boolean;
  },
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const read = () => deps.store.readDoc(chapterId(runId, key), normalizeChapter);
  return readOrGenerate(runId, read, async () => {
    signal?.throwIfAborted();
    const reader = story.friendStory?.friends ?? [];
    const memory = await recallText(deps, runId, {
      job: "narration",
      cast: [...reader, ...cast],
      query: { plan: "", speakers: run.units.map((unit) => unit.name) },
      signal,
      debugMode,
    });
    const context = { world: run.world, nodes, cast, look };
    const { value, connectionId } = await generateJson(deps, {
      runId,
      job: "narration",
      label: `friend-plan/${key}`,
      messages: friendPlanMessages({
        world: run.world,
        player: run.player,
        units: run.units,
        for: planFor,
        memory: memory.text,
        nodes,
      }),
      memory,
      schema: FriendPlanSchema,
      normalize: (reply) => {
        const plan = normalizeFriendPlan(reply, context);
        return typeof plan === "string" ? plan : reply;
      },
      maxTokens: 4000,
      debugMode,
      lane: "foreground",
      ...(signal ? { signal } : {}),
    });
    signal?.throwIfAborted();
    const plan = normalizeFriendPlan(value, context) as Exclude<ReturnType<typeof normalizeFriendPlan>, string>;
    const { look: chosen, ...planned } = plan;
    const memento = story.friendStory?.kind === "hangout" ? clean(value.memento, 1200) : "";
    const chapter: Chapter = {
      key,
      kind: "story",
      lead: "",
      ...planned,
      ...(story.friendStory
        ? {
            friendStory: {
              ...story.friendStory,
              ...(chosen ? { look: chosen } : {}),
              ...(memento ? { memento: { brief: memento } } : {}),
            },
          }
        : {}),
      ...(story.ending ? { ending: story.ending } : {}),
      ledger: { relationship: [], conflict: [], offscreen: [] },
      plannedAt: new Date().toISOString(),
      connectionId,
    };
    return (
      (await deps.store.mutateDoc(runDocTarget("chapter", chapterId(runId, key)), normalizeChapter, (current) =>
        current?.key ? current : chapter,
      )) ?? chapter
    );
  });
}

/** The run and the friend `id`, or a 404; a 409 while the world is being forged. */
async function friendRun(deps: ChapterDeps, runId: string, id: LiId) {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Hearth story");
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const unit = run.friends?.find((friend) => friend.id === id);
  const state = run.state.friends[id];
  if (!unit?.friend || !state) throw notFound("friend");
  return { run, unit, state };
}

/** The rank whose story waits for friend `id`: the next one, in order, once their level reaches it; null for none. */
export function waitingRank(state: RunState, id: LiId): number | null {
  const friend = state.friends[id];
  if (!friend) return null;
  let next = 2;
  while (next <= FRIEND_MAX_LEVEL && state.chapters[friendRankKey(id, next)]?.completed) next += 1;
  return next <= FRIEND_MAX_LEVEL && friendLevelOf(friend.points) >= next ? next : null;
}

/** POST /runs/:run/friends/:id/rank (see the header). */
export async function openRankStory(
  deps: ChapterDeps,
  runId: string,
  id: LiId,
  options: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const { run, unit, state } = await friendRun(deps, runId, id);
  if (friendHeld(state)) throw locked(`${unit.name} needs you to make it right first.`);
  const level = waitingRank(run.state, id);
  if (!level) throw locked(`No rank story waits with ${unit.name} yet.`);
  const card = friendCards(run, "story", true)?.find((entry) => entry.unit.id === id);
  if (!card) throw notFound("friend");
  return planFriendChapter(
    deps,
    runId,
    run,
    {
      key: friendRankKey(id, level),
      planFor: { kind: "rank", friend: card, level, look: level === FRIEND_MAX_LEVEL },
      nodes: FRIEND_STORY_NODES.rank,
      cast: [],
      story: { friendStory: { kind: "rank", friends: [id], level } },
      look: level === FRIEND_MAX_LEVEL,
    },
    options,
  );
}

/** POST /runs/:run/friends/:id/mend (see the header). */
export async function openMendStory(
  deps: ChapterDeps,
  runId: string,
  id: LiId,
  options: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const { run, unit, state } = await friendRun(deps, runId, id);
  const saved = await savedKeys(deps, runId, `story-friend-mend-${id}-`);
  const open = saved.find((chapter) => !run.state.chapters[chapter.key]?.completed);
  if (open) return open;
  if (!mendOpen(state)) throw locked(`${unit.name} needs some space before you can make it right.`);
  const card = friendCards(run, "story", true)?.find((entry) => entry.unit.id === id);
  if (!card) throw notFound("friend");
  return planFriendChapter(
    deps,
    runId,
    run,
    {
      key: friendMendKey(id, saved.length + 1),
      planFor: { kind: "mend", friend: card, grievance: state.grievance?.text ?? "" },
      nodes: FRIEND_STORY_NODES.mend,
      cast: [],
      story: { friendStory: { kind: "mend", friends: [id] } },
    },
    options,
  );
}

/**
 * Who comes to a hangout, checked before anything is worn or planned: her friends, once each (400 for none or too
 * many), every one of them hers (404) and holding no grievance with her (409 `locked`). 409 while the world is forged.
 */
export function hangoutCompany(run: RunDocuments, friends: readonly LiId[]) {
  if (run.world.forge.phase !== "ready") throw new OtomeForgeError(409, "The world is still being forged.", "conflict");
  const company = [...new Set(friends)];
  if (!company.length || company.length > LIS_MAX) throw new OtomeForgeError(400, "Choose who comes.", "bad-request");
  const cards = friendCards(run, "story", true) ?? [];
  const coming = company.map((id) => cards.find((card) => card.unit.id === id));
  if (coming.some((card) => !card)) throw notFound("friend");
  const held = company.find((id) => friendHeld(run.state.friends[id]));
  if (held) throw locked(`${cards.find((card) => card.unit.id === held)!.unit.name} needs you to make it right first.`);
  return { company, coming: coming as NonNullable<(typeof coming)[number]>[] };
}

/** POST /runs/:run/hangouts (see the header): her look is worn by the caller first. */
export async function startHangout(
  deps: ChapterDeps,
  runId: string,
  { friends, place, topic }: { friends: LiId[]; place: string; topic?: string },
  options: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const run = await readRun(deps.store, runId);
  if (!run) throw notFound("Otome Hearth story");
  const { company, coming } = hangoutCompany(run, friends);
  const saved = await savedKeys(deps, runId, "story-hangout-");
  return planFriendChapter(
    deps,
    runId,
    run,
    {
      key: hangoutKey(saved.length + 1),
      planFor: { kind: "hangout", friends: coming, place, ...(topic ? { topic } : {}) },
      nodes: FRIEND_STORY_NODES.hangout,
      cast: [],
      story: { friendStory: { kind: "hangout", friends: company, ...(place ? { place } : {}) } },
    },
    options,
  );
}
