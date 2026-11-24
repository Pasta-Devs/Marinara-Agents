// ──────────────────────────────────────────────
// Otome Hearth: what stands between her and a friend (#2458), as S/state/relationship.ts keeps it for a love interest
// ──────────────────────────────────────────────
// - A hurt in Messages (P17's `hurt` in a friend's thread): a serious one (major or rupture) opens their grievance with
//   her, at most one a story arc and never while one stands; anything milder, or a serious one past those limits,
//   costs FRIEND_HURT_COST points, never below the level reached.
// - Their grievance waits for FRIEND_SPACE_CHAPTERS main chapters read to their end (withFriendSpace) before their
//   make-up story opens (S/story/friends.ts); that story's last scene clears it and pays FRIEND_CLEARED_AFFECTION.
// - She may tell them she is upset with them; accepting their invitation to clear the air lets it go.
// Pure: the callers apply these inside one revision-checked write of `${R}:state`.
import type { LiId, RunState } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  FRIEND_CLEARED_AFFECTION,
  FRIEND_HURT_COST,
  FRIEND_SPACE_CHAPTERS,
  friendHeld,
  friendLevelFloor,
  friendLevelOf,
  type FriendState,
} from "../../../../../client/src/features/otome-forge/shared/friends.js";
import type { MessageHurt } from "./relationship.js";

const withFriend = (state: RunState, id: LiId, friend: FriendState): RunState => ({
  ...state,
  friends: { ...state.friends, [id]: friend },
});

/** `points` less `cost`, never below the floor of the level they had reached. */
const lessPoints = (points: number, cost: number) => Math.max(friendLevelFloor(friendLevelOf(points)), points - cost);

/**
 * The hurts her message gave her friends (see the header): `hurt` names each friend a hurt was kept for, `opened` those
 * whose grievance it opened. Hurts naming anyone but a friend are left to the love interests' rules.
 */
export function applyFriendHurts(
  state: RunState,
  hurts: readonly MessageHurt[],
  { at, arc }: { at: string; arc: number },
): { state: RunState; hurt: LiId[]; opened: LiId[] } {
  let next = state;
  const hurt: LiId[] = [];
  const opened: LiId[] = [];
  for (const { li, text, severity } of hurts) {
    const friend = next.friends[li];
    if (!friend) continue;
    hurt.push(li);
    // #2459: the finale settled every grievance, and none opens after it.
    if (severity !== "minor" && !friendHeld(friend) && friend.grievanceArc !== arc && !state.finale) {
      next = withFriend(next, li, {
        ...friend,
        grievance: { text: text.replace(/\s+/g, " ").trim().slice(0, 300), severity, opened: at, space: 0 },
        grievanceArc: arc,
      });
      opened.push(li);
    } else {
      next = withFriend(next, li, { ...friend, points: lessPoints(friend.points, FRIEND_HURT_COST) });
    }
  }
  return { state: next, hurt, opened };
}

/** A main chapter read to its end counts toward the space each friend's grievance waits for. */
export function withFriendSpace(state: RunState): RunState {
  let next = state;
  for (const [id, friend] of Object.entries(state.friends)) {
    if (friend.grievance && friend.grievance.space < FRIEND_SPACE_CHAPTERS) {
      next = withFriend(next, id, { ...friend, grievance: { ...friend.grievance, space: friend.grievance.space + 1 } });
    }
  }
  return next;
}

/** Their make-up story may open: a grievance stands, and it has had its space. */
export const mendOpen = (friend: FriendState | undefined): boolean =>
  !!friend?.grievance && friend.grievance.space >= FRIEND_SPACE_CHAPTERS;

/**
 * Their make-up story read to its end: their grievance clears, and the friendship pays FRIEND_CLEARED_AFFECTION as a
 * story earning. Null when there was nothing to clear (a replay, or a grievance already cleared).
 */
export function clearFriendGrievance(state: RunState, id: LiId): { state: RunState; affection: number } | null {
  const friend = state.friends[id];
  if (!friend?.grievance) return null;
  return {
    state: withFriend(state, id, { ...friend, grievance: null, points: friend.points + FRIEND_CLEARED_AFFECTION }),
    affection: FRIEND_CLEARED_AFFECTION,
  };
}

/** She tells them she is upset with them, or takes it back. */
export function setFriendUpset(state: RunState, id: LiId, upset: boolean, at: string): RunState {
  const friend = state.friends[id];
  if (!friend) return state;
  return withFriend(state, id, { ...friend, upset: upset ? { since: at } : null, ...(upset ? {} : { asked: null }) });
}

/**
 * #2459: the finale read to its end settles every grievance still standing, both ways: each love interest's open or
 * festering grievance is addressed by `key` and his rupture closes, and each friend's grievance clears (unpaid), with
 * no one upset any more. Stamps `finale`, after which none opens again.
 */
export function settleAtFinale(state: RunState, key: string, at: string): RunState {
  const lis = Object.fromEntries(
    Object.entries(state.lis).map(([id, li]) => [
      id,
      {
        ...li,
        grievances: li.grievances.map((grievance) =>
          grievance.status === "open" || grievance.status === "festering"
            ? { ...grievance, status: "addressed" as const, closedBy: key }
            : grievance,
        ),
        rupture: null,
        upset: null,
      },
    ]),
  );
  const friends = Object.fromEntries(
    Object.entries(state.friends).map(([id, friend]) => [id, { ...friend, grievance: null, upset: null }]),
  );
  return { ...state, lis, friends, finale: { at } };
}
