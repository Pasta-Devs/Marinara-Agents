// ──────────────────────────────────────────────
// Otome Forge: stage gates, rupture and repair (plan M2b "Stage logic", "Rupture"; design "Arcs", "Angst as state")
// ──────────────────────────────────────────────
// The game owns the stage. A route chapter `route-<li>-<s>` opens once his affection reaches the stage's level and no
// rupture stands (SH/arcs.ts routeStatus). His stage moves from s−1 to s only when that chapter's gate node (its last)
// is first read to its end: the read counts the beat, moves the stage, adds every secret revealed by then to
// `revealed` (his stage-4 secret at stage 4), and dates a `stage-<s>` timeline entry, all in the one revision-checked
// write of `${R}:state` that the read makes (S/story/beats.ts finishBeat). An Ease off of the gate counts too: the
// scene happened, cut short.
// A rupture keeps his route chapters locked (none starts, none opens a beat, and no gate is counted: gateShut) until a
// repair chapter `repair-<li>-<n>` is read: reading its resolving node (the last) to its end marks the grievance
// `addressed` and closes the rupture, or moves it to another rupture still owed (a pick in it that forgave the
// grievance closed it already: the read still reports the repair). Nothing unlocked is ever taken back: nothing here
// lowers a stage, points or a level, and what was read still replays.
//
// Every function is pure; a step that does not apply returns the state it was given.
import type {
  Bible,
  Chapter,
  Effect,
  Grievance,
  LiId,
  RepairEntry,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  LAST_STAGE,
  repairChapterKey,
  routeStatus,
  type RouteEntry,
} from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { STATE_LIMITS, defaultLiState, keepNewest } from "../schemas/state.js";

const isUnresolved = (grievance: Grievance) => grievance.status === "open" || grievance.status === "festering";

/** True when beat `i` is the one the read counted now: `beatsRead` moved past it in this write. */
export function countedNow(before: RunState, after: RunState, key: string, i: number): boolean {
  return (before.chapters[key]?.beatsRead ?? 0) === i && (after.chapters[key]?.beatsRead ?? 0) === i + 1;
}

/**
 * True while a rupture keeps his gate (beat `i` of a route chapter) from being counted read now: it would move his
 * stage and complete the chapter. The scene in which the rupture itself opened can still be finished.
 */
export function gateShut(state: RunState, chapter: Pick<Chapter, "key" | "kind" | "li" | "nodes">, i: number): boolean {
  const his = chapter.kind === "route" && chapter.li ? state.lis[chapter.li] : undefined;
  const rupture = his?.rupture;
  const progress = state.chapters[chapter.key];
  if (!rupture || !chapter.nodes[i]?.gate || progress?.completed || (progress?.beatsRead ?? 0) !== i) return false;
  return his.grievances.find((grievance) => grievance.id === rupture.grievanceId)?.opened !== `${chapter.key}/${i}`;
}

export interface GateOutcome {
  state: RunState;
  /** Set when this read moved his stage. */
  stageUp: { li: LiId; stage: number } | null;
}

/**
 * The stage move a route chapter's gate makes when beat `i` was just counted read (countedNow). Only from the stage
 * just below the chapter's (a stage is never skipped, never moved twice, never lowered). `secrets` are his bible's.
 */
export function passGate(
  state: RunState,
  chapter: Pick<Chapter, "key" | "kind" | "li" | "stage" | "title" | "nodes">,
  i: number,
  { secrets, at }: { secrets: Bible["secrets"]; at: string },
): GateOutcome {
  const li = chapter.li;
  const stage = chapter.stage;
  const current = li ? state.lis[li] : undefined;
  if (chapter.kind !== "route" || !li || !current || !stage || !chapter.nodes[i]?.gate) return { state, stageUp: null };
  if (current.stage !== stage - 1 || stage > LAST_STAGE) return { state, stageUp: null };
  const revealed = [...current.revealed];
  for (const secret of secrets) {
    if (secret.revealAt.stage <= stage && !revealed.includes(secret.id)) revealed.push(secret.id);
  }
  return {
    state: {
      ...state,
      lis: { ...state.lis, [li]: { ...current, stage, revealed: keepNewest(revealed, STATE_LIMITS.list) } },
      timeline: keepNewest(
        [...state.timeline, { at, li, kind: `stage-${stage}`, text: chapter.title, ref: chapter.key }],
        STATE_LIMITS.timeline,
      ),
    },
    stageUp: { li, stage },
  };
}

export interface RepairOutcome {
  state: RunState;
  /** Set when this read closed the rupture with him. */
  repaired: LiId | null;
}

/**
 * What reading a repair chapter's resolving node to its end does: its grievance is `addressed` (unless a choice
 * already closed it), and the rupture closes, or stands on the next rupture-severity grievance still owed. `picked`:
 * the effects of the node's own first-play picks. One of them that forgave or addressed the grievance closed the
 * rupture at the pick; reading the node to its end is still the repair, so it is reported then.
 */
export function healRupture(
  state: RunState,
  chapter: Pick<Chapter, "kind" | "li" | "grievance" | "nodes">,
  i: number,
  at: string,
  picked: readonly Effect[] = [],
): RepairOutcome {
  const li = chapter.li;
  const grievanceId = chapter.grievance;
  const current = li ? state.lis[li] : undefined;
  if (chapter.kind !== "repair" || !li || !grievanceId || !current) return { state, repaired: null };
  if (!chapter.nodes[i]?.resolves?.includes(grievanceId)) return { state, repaired: null };
  const closedByPick = picked.some(
    (effect) => effect.li === li && effect.resolve?.id === grievanceId && effect.resolve.status !== "festering",
  );
  const grievances = current.grievances.map((grievance) =>
    grievance.id === grievanceId && isUnresolved(grievance)
      ? { ...grievance, status: "addressed" as const }
      : grievance,
  );
  let rupture = current.rupture;
  if (rupture && !grievances.some((grievance) => grievance.id === rupture!.grievanceId && isUnresolved(grievance))) {
    const next = grievances.find((grievance) => grievance.severity === "rupture" && isUnresolved(grievance));
    rupture = next ? { grievanceId: next.id, since: at } : null;
  }
  const repaired = (!!current.rupture || closedByPick) && !rupture ? li : null;
  if (grievances.every((grievance, index) => grievance === current.grievances[index]) && rupture === current.rupture) {
    return { state, repaired };
  }
  return { state: { ...state, lis: { ...state.lis, [li]: { ...current, grievances, rupture } } }, repaired };
}

/** Every love interest's arc on the Story screen, in cast order (`cast`: LI ids). */
export function routeEntries(state: RunState, cast: readonly LiId[]): RouteEntry[] {
  return cast.map((li) => routeStatus(li, state.lis[li] ?? defaultLiState()));
}

/**
 * The repair on offer for each love interest a rupture stands with (GET /story `repairs`): the unfinished repair for
 * that rupture's grievance when one is planned, else the key the next one takes (`chapters`: the run's chapters).
 */
export function repairOffers(
  chapters: ReadonlyArray<Pick<Chapter, "key" | "kind" | "li" | "grievance">>,
  state: RunState,
  cast: readonly LiId[],
): RepairEntry[] {
  return cast.flatMap((li) => {
    const rupture = state.lis[li]?.rupture;
    if (!rupture) return [];
    const his = chapters.filter((chapter) => chapter.kind === "repair" && chapter.li === li);
    const open = his.find(
      (chapter) => chapter.grievance === rupture.grievanceId && !state.chapters[chapter.key]?.completed,
    );
    return [{ li, key: open?.key ?? repairChapterKey(li, his.length + 1) }];
  });
}
