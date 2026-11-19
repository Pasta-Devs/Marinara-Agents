// ──────────────────────────────────────────────
// Otome Forge: what a scene changed in the story state, so a Rewrite can take it back (0.38.0)
// ──────────────────────────────────────────────
// The maintainer asked that Rewrite always show, in dates and Character Stories as in the main story, and chose that it
// takes back the scene's picks. A pick's effects (trust, tension, affection points, grievances, disclosures, a rupture)
// and a plain read to the end (the scene counted, its Starlight) are recorded on the beat as they land (StateUndo), as
// the parts of RunState they changed, before and after. A Rewrite reverts them, newest first, with a three-way merge:
// a part still as the scene left it goes back as it was; a number something else moved since keeps that move (only
// the scene's own change is taken out); a list loses what the scene added and gets back what it changed; anything else
// changed since is left alone. A read that moved more than the scene (a stage, a repair, his side, the chapter's end)
// starts work a revert cannot undo (memory upkeep, his side's scene, the gate's secrets), so it blocks the Rewrite.
import type { Beat, RunState, StateUndo } from "../../../../../client/src/features/otome-forge/shared/api-types.js";

/** Why a scene cannot be rewritten: its Ease off, a Confrontation's stance, a pick or read from before 0.38.0, or a
 *  read that moved more than the scene. */
export type RewriteBlock = "eased-off" | "stance" | "unrecorded" | NonNullable<StateUndo["blocked"]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const copy = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

/** The parts of RunState that changed from `before` to `after`: `lis` and `chapters` by id, other fields whole. */
function changedParts(before: RunState, after: RunState) {
  const was: Record<string, unknown> = {};
  const now: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof RunState>;
  for (const key of keys) {
    const from = before[key] as unknown;
    const to = after[key] as unknown;
    if (same(from, to)) continue;
    if ((key === "lis" || key === "chapters") && isRecord(from) && isRecord(to)) {
      const ids = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter((id) => !same(from[id], to[id]));
      was[key] = Object.fromEntries(ids.map((id) => [id, copy(from[id])]));
      now[key] = Object.fromEntries(ids.map((id) => [id, copy(to[id])]));
    } else {
      was[key] = copy(from);
      now[key] = copy(to);
    }
  }
  return { before: was, after: now };
}

/** The record of one change, or null when it changed nothing. */
export function stateUndo(
  kind: StateUndo["kind"],
  before: RunState,
  after: RunState,
  extra: Pick<StateUndo, "choice" | "covers" | "blocked"> = {},
): StateUndo | null {
  const parts = changedParts(before, after);
  if (!Object.keys(parts.after).length) return null;
  return { kind, ...extra, ...parts };
}

/** The identity of a list item: its id, else the item itself. */
const itemKey = (item: unknown) =>
  isRecord(item) && typeof item.id === "string" ? `id:${item.id}` : `json:${JSON.stringify(item)}`;

function revertList(current: unknown[], before: unknown[], after: unknown[]): unknown[] {
  const was = new Map(before.map((item) => [itemKey(item), item]));
  const now = new Map(after.map((item) => [itemKey(item), item]));
  const kept: unknown[] = [];
  for (const item of current) {
    const key = itemKey(item);
    if (now.has(key) && !was.has(key)) {
      // Added by the change: it goes, unless something changed it since.
      if (!same(item, now.get(key))) kept.push(item);
    } else if (now.has(key) && was.has(key)) kept.push(revertValue(item, was.get(key), now.get(key)));
    else kept.push(item);
  }
  // Removed by the change (a list bounded as it grew) and still gone: it comes back where it was: after the item of the
  // old list before it, else before the one after it, else at its old place.
  const order = before.map(itemKey);
  const position = (key: string) => kept.findIndex((item) => itemKey(item) === key);
  for (const [index, key] of order.entries()) {
    if (now.has(key) || position(key) >= 0) continue;
    const previous = order
      .slice(0, index)
      .reverse()
      .find((other) => position(other) >= 0);
    const following = order.slice(index + 1).find((other) => position(other) >= 0);
    const at = previous ? position(previous) + 1 : following ? position(following) : Math.min(index, kept.length);
    kept.splice(at, 0, copy(was.get(key)));
  }
  return kept;
}

/** `current` with the change from `before` to `after` taken out (see the header). */
function revertValue(current: unknown, before: unknown, after: unknown): unknown {
  if (same(current, after)) return copy(before);
  if (typeof current === "number" && typeof before === "number" && typeof after === "number") {
    const value = current + (before - after);
    return before >= 0 && after >= 0 ? Math.max(0, value) : value;
  }
  if (Array.isArray(current) && Array.isArray(before) && Array.isArray(after)) {
    return revertList(current, before, after);
  }
  if (isRecord(current) && isRecord(before) && isRecord(after)) {
    // A day's counters belong to their day: a new day keeps its own.
    if (typeof after.dayKey === "string" && current.dayKey !== after.dayKey) return current;
    const out: Record<string, unknown> = { ...current };
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (same(before[key], after[key])) continue;
      if (!(key in after)) {
        if (!(key in current)) out[key] = copy(before[key]);
      } else if (!(key in before)) {
        if (same(current[key], after[key])) delete out[key];
      } else {
        out[key] = revertValue(current[key], before[key], after[key]);
      }
    }
    return out;
  }
  return current;
}

/** `state` with the change from `before` to `after` taken out: a Rewrite, or with the two swapped, a redo. */
function takeOut(state: RunState, before: Record<string, unknown>, after: Record<string, unknown>): RunState {
  const next: Record<string, unknown> = { ...state };
  const current = state as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if ((key === "lis" || key === "chapters") && isRecord(before[key]) && isRecord(after[key])) {
      const byId: Record<string, unknown> = { ...(isRecord(current[key]) ? current[key] : {}) };
      const was = before[key];
      const now = after[key];
      for (const id of new Set([...Object.keys(was), ...Object.keys(now)])) {
        if (!(id in now)) {
          if (!(id in byId)) byId[id] = copy(was[id]);
        } else if (!(id in was)) {
          if (same(byId[id], now[id])) delete byId[id];
        } else {
          byId[id] = revertValue(byId[id], was[id], now[id]);
        }
      }
      next[key] = byId;
    } else {
      next[key] = revertValue(current[key], before[key], after[key]);
    }
  }
  return next as unknown as RunState;
}

/** `state` with this change taken back. */
export const revertUndo = (state: RunState, undo: StateUndo): RunState => takeOut(state, undo.before, undo.after);

/** `state` with this change made again: a Rewrite that reverted it and then found its scene changed puts it back. */
export const redoUndo = (state: RunState, undo: StateUndo): RunState => takeOut(state, undo.after, undo.before);

/**
 * Why this beat cannot be rewritten now, or null when it can. Its picks and its read must each be on record, so a
 * Rewrite can take them back; a finish may cover picks it applied itself.
 */
export function rewriteBlock(
  beat: Pick<Beat, "easedOff" | "confrontation" | "choiceCanon" | "undo">,
): RewriteBlock | null {
  if (beat.easedOff) return "eased-off";
  if (beat.confrontation?.picks.length) return "stance";
  const undo = beat.undo ?? [];
  const blocked = undo.find((entry) => entry.blocked)?.blocked;
  if (blocked) return blocked;
  const covered = new Set(
    undo.flatMap((entry) => (entry.kind === "pick" && entry.choice ? [entry.choice] : (entry.covers ?? []))),
  );
  return Object.keys(beat.choiceCanon).every((choice) => covered.has(choice)) ? null : "unrecorded";
}
