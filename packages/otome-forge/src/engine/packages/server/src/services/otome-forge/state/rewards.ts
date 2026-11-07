// ──────────────────────────────────────────────
// Otome Forge: Starlight and affection grants (plan §1.11, M2a "Rewards")
// ──────────────────────────────────────────────
// grant() is the one place Starlight and affection are added, but for a side-with pick's gain (#2046), which lands with
// its pick (S/state/relationship.ts), and a repair's clearing (#2156, payClearing below). Story earnings (a beat, a chapter, and the chapter's Lead and Foil) are never
// capped. Activity earnings are capped per local day: Starlight at 400 in all, affection at 150 per
// love interest. The day is forgeDayKey(Date.now()) in the request's time zone (every route runs inside
// forgeTimeZoneRoutes), so it ends at the player's own midnight. Choice losses are separate from earnings and never
// refund those caps; the affection level already reached is their floor. #2156: while his grievance with her stands
// (SH/dates.ts heldAgainst) he earns no affection from anything; Starlight is paid as ever.
//
// readBeatToEnd() is the whole state change of reading a beat to its end: +30 the first time, and when that beat is the
// chapter's last node, the chapter's Starlight, the Lead's and Foil's affection, the planner's ledger and the Lead's
// `lastLead`. A birthday scene's gift (#2153) pays its affection then too, never capped, as a date's gift does.
// `chapters[key]` records the beat and the completion in the same write, so each lands once. Everything here is pure;
// the read route applies it inside one revision-checked write of `${R}:state`.
// #2156: a main chapter read to its end counts toward the space each grievance he holds waits for, and the repair of a
// grievance he holds pays no Lead affection: its clearing (payClearing) pays GRIEVANCE_CLEARED_AFFECTION once the
// repair has closed the grievance, in the same write. The repair of one she holds pays its Lead as before.
import { forgeDayKey } from "@forge-kit/time-zone-server.mjs";
import type {
  Chapter,
  ChapterKind,
  Grant,
  LiId,
  RunState,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { GRIEVANCE_SPACE_CHAPTERS } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { heldAgainst } from "../../../../../client/src/features/otome-forge/shared/dates.js";
import {
  ACTIVITY_STARLIGHT_DAILY_CAP,
  AFFECTION_EARNINGS,
  GRIEVANCE_CLEARED_AFFECTION,
  OUTSIDE_AFFECTION_DAILY_CAP,
  STARLIGHT_EARNINGS,
  isStoryReward,
  type RewardSource,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { GIFT_AFFECTION } from "../../../../../client/src/features/otome-forge/shared/shop.js";
import { mainChapterNumber } from "../ids.js";
import { STATE_LIMITS, keepNewest } from "../schemas/state.js";

export interface GrantRequest {
  source: RewardSource;
  starlight?: number;
  /** The love interest the affection goes to; affection for one the run does not have is not granted. */
  li?: LiId;
  affection?: number;
}

/** What a grant actually added, after the daily caps. */
export interface Granted {
  starlight: number;
  affection: number;
}

const whole = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

/**
 * Adds Starlight to the wallet and affection points to `li`, within the day's caps for an activity. `dayKey` defaults
 * to today in the request's time zone. This earning-only path ignores negative amounts.
 */
export function grant(
  state: RunState,
  request: GrantRequest,
  dayKey: string = forgeDayKey(Date.now()),
): { state: RunState; granted: Granted } {
  const story = isStoryReward(request.source);
  const daily = state.daily.dayKey === dayKey ? state.daily : { dayKey, starlight: 0, affection: {} };
  const li = request.li && state.lis[request.li] ? request.li : null;
  const starlight = story
    ? whole(request.starlight)
    : Math.min(whole(request.starlight), Math.max(0, ACTIVITY_STARLIGHT_DAILY_CAP - daily.starlight));
  const earned = li ? (daily.affection[li] ?? 0) : 0;
  const affection =
    !li || heldAgainst(state.lis[li])
      ? 0
      : story
        ? whole(request.affection)
        : Math.min(whole(request.affection), Math.max(0, OUTSIDE_AFFECTION_DAILY_CAP - earned));
  if (!starlight && !affection) return { state, granted: { starlight: 0, affection: 0 } };
  return {
    state: {
      ...state,
      wallet: { ...state.wallet, starlight: state.wallet.starlight + starlight },
      lis:
        li && affection
          ? { ...state.lis, [li]: { ...state.lis[li]!, points: state.lis[li]!.points + affection } }
          : state.lis,
      daily: story
        ? state.daily
        : {
            dayKey,
            starlight: daily.starlight + starlight,
            affection: li && affection ? { ...daily.affection, [li]: earned + affection } : daily.affection,
          },
    },
    granted: { starlight, affection },
  };
}

/** The chapter fields reading a beat needs. */
export type ReadChapter = Pick<
  Chapter,
  "key" | "kind" | "number" | "lead" | "foil" | "nodes" | "ledger" | "gift" | "grievance"
>;

export interface ReadOutcome {
  state: RunState;
  /** What this read earned (the wire's grants); empty when the beat was read before. */
  grants: Grant[];
  /** True once the chapter's last node has been read (now or before). */
  chapterDone: boolean;
}

/**
 * Completion pay per chapter kind. A repair chapter pays a main one's Starlight (proposal: the plan names no number for
 * it), and the repair of a grievance he holds its clearing in place of the Lead's affection (#2156, payClearing). A
 * Character Story (M4) pays only for its beats, and a date (M5) pays as an activity from its own route, so neither is
 * here.
 */
const COMPLETION: Partial<Record<ChapterKind, { source: RewardSource; starlight: number }>> = {
  main: { source: "chapter", starlight: STARLIGHT_EARNINGS.chapter },
  repair: { source: "chapter", starlight: STARLIGHT_EARNINGS.chapter },
  route: { source: "route-chapter", starlight: STARLIGHT_EARNINGS.routeChapter },
};
/** A date's beats are part of the date, which is paid as a capped activity. The prologue pays its beat, and no affection. */
const PAYS_BEATS: ReadonlySet<ChapterKind> = new Set<ChapterKind>(["prologue", "main", "route", "repair", "story"]);

/** The newest main chapter number the state has finished, or 0 (a conflict planted outside a main chapter). */
function latestMain(state: RunState): number {
  let latest = 0;
  for (const [key, progress] of Object.entries(state.chapters)) {
    const number = progress.completed ? mainChapterNumber(key) : null;
    if (number && number > latest) latest = number;
  }
  return latest;
}

/** The planner's ledger saved to the state: its lines, its conflicts, and each newly planted kind of angst. */
function saveLedger(state: RunState, chapter: ReadChapter): RunState {
  const { key, ledger } = chapter;
  const number = chapter.number ?? latestMain(state);
  const lis = { ...state.lis };
  const conflicts = [...state.ledgers.conflicts];
  for (const row of ledger.conflict) {
    const index = conflicts.findIndex((entry) => entry.id === row.id);
    const li = lis[row.li];
    if (row.action === "plant" && index < 0 && li) {
      conflicts.push({ id: row.id, li: row.li, type: row.type, status: "open", chapter: number, key });
      lis[row.li] = { ...li, angst: keepNewest([...li.angst, row.type], STATE_LIMITS.list) };
    } else if (row.action === "resolve" && index >= 0) {
      conflicts[index] = { ...conflicts[index]!, status: "resolved" };
    }
  }
  const lines = (rows: ReadonlyArray<{ li: LiId; line: string }>) => rows.map(({ li, line }) => ({ key, li, line }));
  return {
    ...state,
    lis,
    ledgers: {
      relationship: keepNewest([...state.ledgers.relationship, ...lines(ledger.relationship)], STATE_LIMITS.ledger),
      conflicts: keepNewest(conflicts, STATE_LIMITS.ledger),
      offscreen: keepNewest([...state.ledgers.offscreen, ...lines(ledger.offscreen)], STATE_LIMITS.ledger),
    },
  };
}

/**
 * #2156: main chapter `key` was read to its end: one more chapter of space for each grievance he holds that still
 * waits for it, but the one that opened in this chapter.
 */
function withSpace(state: RunState, key: string): RunState {
  let lis = state.lis;
  for (const [id, li] of Object.entries(state.lis)) {
    const space = li.rupture?.space;
    if (space === undefined || space >= GRIEVANCE_SPACE_CHAPTERS || !heldAgainst(li)) continue;
    const opened = li.grievances.find((grievance) => grievance.id === li.rupture!.grievanceId)?.opened ?? "";
    if (opened.startsWith(`${key}/`)) continue;
    lis = { ...lis, [id]: { ...li, rupture: { ...li.rupture!, space: space + 1 } } };
  }
  return lis === state.lis ? state : { ...state, lis };
}

/** #2156: the grievance a repair chapter mends when it is his with her (`by: "li"`); one she holds pays as before. */
const hisToClear = (state: RunState, chapter: Pick<Chapter, "kind" | "lead" | "grievance">) =>
  chapter.kind === "repair"
    ? state.lis[chapter.lead]?.grievances.find((item) => item.id === chapter.grievance && item.by === "li")
    : undefined;

/**
 * #2156: what the repair of his grievance with her, completed by this read, pays once that grievance is closed:
 * GRIEVANCE_CLEARED_AFFECTION to him, a story earning, in place of its Lead's affection, and the one earning his
 * grievance never freezes (a save from before #2156 may still owe him another). Run after healRupture in the read's
 * write (S/story/beats.ts finishBeat); a repair whose grievance still stands, or one she holds, pays nothing more.
 */
export function payClearing(
  state: RunState,
  chapter: Pick<Chapter, "key" | "kind" | "lead" | "grievance">,
): { state: RunState; grants: Grant[] } {
  const li = state.lis[chapter.lead];
  const grievance = hisToClear(state, chapter);
  if (!grievance || grievance.status === "open" || grievance.status === "festering") return { state, grants: [] };
  // Only the repair that closed it pays: one closed elsewhere since it was planned (a main chapter's resolve, a date)
  // leaves it closed, and paid nothing here.
  if (grievance.closedBy && grievance.closedBy !== chapter.key) {
    return { state, grants: [] };
  }
  return {
    state: {
      ...state,
      lis: { ...state.lis, [chapter.lead]: { ...li!, points: li!.points + GRIEVANCE_CLEARED_AFFECTION } },
    },
    grants: [{ source: "lead", li: chapter.lead, affection: GRIEVANCE_CLEARED_AFFECTION }],
  };
}

/**
 * The state after beat `i` of `chapter` is read to its end. Only the next unread beat counts (`i ===
 * chapters[key].beatsRead`); any other read changes nothing. `at` stamps the completion; `dayKey` defaults to today in
 * the request's time zone.
 */
export function readBeatToEnd(
  state: RunState,
  chapter: ReadChapter,
  i: number,
  { at = new Date().toISOString(), dayKey = forgeDayKey(Date.now()) }: { at?: string; dayKey?: string } = {},
): ReadOutcome {
  const progress = state.chapters[chapter.key] ?? { beatsRead: 0, completed: null, applied: [] };
  if (i !== progress.beatsRead || i >= chapter.nodes.length) {
    return { state, grants: [], chapterDone: progress.completed !== null };
  }
  // A chapter already marked done (a state from an older build) is never paid twice.
  const finishing = i === chapter.nodes.length - 1 && !progress.completed;
  let next: RunState = {
    ...state,
    chapters: {
      ...state.chapters,
      [chapter.key]: { ...progress, beatsRead: i + 1, completed: finishing ? at : progress.completed },
    },
  };
  const grants: Grant[] = [];
  const pay = (wire: Grant["source"], request: GrantRequest) => {
    const result = grant(next, request, dayKey);
    next = result.state;
    if (result.granted.starlight) grants.push({ source: wire, starlight: result.granted.starlight });
    if (result.granted.affection) grants.push({ source: wire, li: request.li, affection: result.granted.affection });
  };

  if (PAYS_BEATS.has(chapter.kind)) pay("beat", { source: "beat", starlight: STARLIGHT_EARNINGS.beat });
  if (!finishing) return { state: next, grants, chapterDone: progress.completed !== null };

  // #2153: a birthday scene's gift, paid for in Starlight, so as a story earning it is never capped (as on a date).
  if (chapter.gift) pay("gift", { source: "chapter", li: chapter.lead, affection: GIFT_AFFECTION[chapter.gift] });
  const completion = COMPLETION[chapter.kind];
  if (completion) {
    pay("chapter", { source: completion.source, starlight: completion.starlight });
    // #2156: the repair of his grievance pays its clearing instead (payClearing), after it has closed the grievance.
    if (!hisToClear(next, chapter)) {
      pay("lead", { source: completion.source, li: chapter.lead, affection: AFFECTION_EARNINGS.lead });
    }
    if (chapter.foil && chapter.foil !== chapter.lead) {
      pay("foil", { source: completion.source, li: chapter.foil, affection: AFFECTION_EARNINGS.foil });
    }
  }
  next = saveLedger(next, chapter);
  if (chapter.kind === "main") next = withSpace(next, chapter.key);
  const lead = next.lis[chapter.lead];
  if (chapter.kind === "main" && chapter.number && lead) {
    next = { ...next, lis: { ...next.lis, [chapter.lead]: { ...lead, lastLead: chapter.number } } };
  }
  return { state: next, grants, chapterDone: true };
}
