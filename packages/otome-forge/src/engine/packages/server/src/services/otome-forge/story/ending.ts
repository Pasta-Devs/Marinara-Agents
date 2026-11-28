// ──────────────────────────────────────────────
// Otome Hearth: End the Story (#2459)
// ──────────────────────────────────────────────
// Once every love interest stands at level 20 (the last bond rank), Story offers End the Story; nothing forces it.
// POST /runs/:run/ending takes the next step, once at a time, through the run's foreground queue:
// - no finale yet: the finale, a main chapter planned by P5 with its finale lines (S/story/chapters.ts planNextChapter
//   with `finale`): it settles the arc in progress, any standing grievance and the central mystery (its last node tells
//   the truth when no arc has), and ends happily. Its Lead is the one the Story screen would offer first.
// - the finale read to its end: the epilogue (`story-epilogue`), three scenes some time later with every love interest
//   and her friends (S/story/friend-stories.ts planFriendChapter).
// - an unfinished step is returned as it is.
// Reading the epilogue's last scene ends the story (S/state/rewards.ts sets `state.ended`); from then on it only opens
// to look at (S/routes/ended.ts). While the finale waits, no other main chapter or arc is planned.
import type { Chapter, RunState, StoryView } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { BOND_MAX_LEVEL, bondRankOf } from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { LAST_STAGE } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { bondStoriesPlayed } from "../../../../../client/src/features/otome-forge/shared/bond.js";
import { EPILOGUE_KEY } from "../../../../../client/src/features/otome-forge/shared/friends.js";
import { OtomeForgeError } from "../http.js";
import { chapterId } from "../ids.js";
import { readRun, type RunDocuments } from "../schemas/state.js";
import { normalizeChapter } from "../schemas/story.js";
import { leadCandidates, leaders, mainChapters, planNextChapter, type ChapterDeps } from "./chapters.js";
import { FRIEND_STORY_NODES, planFriendChapter } from "./friend-stories.js";
import { friendCards } from "./friends.js";

/** What the Story screen shows of the ending. */
export type EndingView = NonNullable<StoryView["ending"]>;

/** Every love interest in the cast stands at the last bond rank (level 20). */
export function everyoneAtTwenty(state: RunState, cast: readonly string[]): boolean {
  return (
    cast.length > 0 &&
    cast.every((li) => {
      const his = state.lis[li];
      return (
        !!his &&
        bondRankOf(his.points, his.stage >= LAST_STAGE, bondStoriesPlayed(state.chapters, li)) === BOND_MAX_LEVEL
      );
    })
  );
}

/** The ending as the Story screen sees it, from the run and its main chapters. */
export function endingView(run: RunDocuments, mains: readonly Chapter[], epilogue: Chapter | null): EndingView {
  const cast = run.units.filter((unit) => unit.bible).map((unit) => unit.id);
  const finale = mains.find((chapter) => chapter.ending === "finale");
  return {
    offered: !finale && !run.state.ended && everyoneAtTwenty(run.state, cast),
    ...(finale ? { finale: finale.key } : {}),
    ...(epilogue ? { epilogue: epilogue.key } : {}),
    ...(run.state.ended ? { ended: run.state.ended.at } : {}),
  };
}

/** POST /runs/:run/ending (see the header): the finale or the epilogue, planned now or as already planned. */
export async function nextEndingStep(
  deps: ChapterDeps,
  runId: string,
  { debugMode, signal }: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  const run = await readRun(deps.store, runId);
  if (!run) throw new OtomeForgeError(404, "No such Otome Hearth story.", "not-found");
  if (run.state.ended) throw new OtomeForgeError(409, "This story has ended.", "locked");
  const mains = await mainChapters(deps.store, runId);
  const finale = mains.find((chapter) => chapter.ending === "finale");
  if (!finale) {
    const cast = run.units.filter((unit) => unit.bible).map((unit) => unit.id);
    if (!everyoneAtTwenty(run.state, cast)) {
      throw new OtomeForgeError(409, "The story can end once every love interest reaches level 20.", "locked");
    }
    const open = mains.find((chapter) => !run.state.chapters[chapter.key]?.completed);
    if (open) throw new OtomeForgeError(409, "Finish the chapter you are reading first.", "conflict");
    const lead = leadCandidates(run.state, leaders(run.state, cast))[0]?.li ?? cast[0]!;
    return planNextChapter(deps, runId, lead, { debugMode, ...(signal ? { signal } : {}), finale: true });
  }
  if (!run.state.chapters[finale.key]?.completed) return finale;
  return planEpilogue(deps, runId, run, { debugMode, ...(signal ? { signal } : {}) });
}

/** The epilogue, planned once (three scenes, every love interest in each). */
function planEpilogue(
  deps: ChapterDeps,
  runId: string,
  run: RunDocuments,
  options: { debugMode: boolean; signal?: AbortSignal },
): Promise<Chapter> {
  return planFriendChapter(
    deps,
    runId,
    run,
    {
      key: EPILOGUE_KEY,
      planFor: { kind: "epilogue", friends: friendCards(run, "story", true) ?? [] },
      nodes: FRIEND_STORY_NODES.epilogue,
      cast: run.units.filter((unit) => unit.bible).map((unit) => unit.id),
      story: { ending: "epilogue" },
    },
    options,
  );
}

/** The epilogue chapter, once planned. */
export const readEpilogue = (deps: Pick<ChapterDeps, "store">, runId: string) =>
  deps.store.readDoc(chapterId(runId, EPILOGUE_KEY), normalizeChapter);
