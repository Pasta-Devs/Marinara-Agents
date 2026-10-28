// ──────────────────────────────────────────────
// Otome Forge: arcs (plan §1.11 "Stages", M2b "Arcs"). Each love interest's six stages, what opens the next one, and the
// Confrontation's numbers
// ──────────────────────────────────────────────
// Pure TypeScript shared by both bundles. A love interest starts at stage 1 (Mask). Each later stage is opened by a free
// route chapter, which unlocks at an affection level; the stage itself moves only when that chapter's gate node is
// first read to its end (S/state/stages.ts). An open rupture keeps his route chapters locked until a repair chapter
// is read. Nothing unlocked is ever taken back. A regression pins every number here
// (tests/otome-forge-stages.regression.ts), so a change is always on purpose. `name` is an id: the client labels a
// stage through its own literal map of ui.otomeForge.* keys; `balance` is English prompt text, never localized.
import type { LiId } from "./api-types";
import { levelOf } from "./economy";

export const FIRST_STAGE = 1;
export const LAST_STAGE = 6;

export const STAGE_NAMES = ["mask", "crack", "pull", "wound", "reckoning", "bond"] as const;
export type StageName = (typeof STAGE_NAMES)[number];

/** What a route chapter's gate must hold before it may move him to that stage. */
export type GateKind = "gate" | "reveal" | "confrontation" | "finale";

export interface StageRow {
  stage: number;
  name: StageName;
  /** Mask : self, as the scene card tells the narrator. */
  balance: string;
  /** The affection level his route chapter for this stage unlocks at; null for stage 1, where every story starts. */
  unlockLevel: number | null;
  gate: GateKind | null;
}

export const STAGES: readonly StageRow[] = [
  { stage: 1, name: "mask", balance: "Mask 90 / self 10", unlockLevel: null, gate: null },
  { stage: 2, name: "crack", balance: "Mask 75 / self 25", unlockLevel: 3, gate: "gate" },
  { stage: 3, name: "pull", balance: "Mask 60 / self 40", unlockLevel: 5, gate: "gate" },
  // The gate node reveals his stage-4 secret.
  { stage: 4, name: "wound", balance: "The mask breaks", unlockLevel: 7, gate: "reveal" },
  // A Confrontation node, then a big choice before the gate completes.
  { stage: 5, name: "reckoning", balance: "Mask 40 / self 60", unlockLevel: 8, gate: "confrontation" },
  { stage: 6, name: "bond", balance: "Changed toward the protagonist only", unlockLevel: 10, gate: "finale" },
];

/** The row for `stage`, clamped into 1–6 (a damaged value reads as the nearest stage). */
export function stageRow(stage: number): StageRow {
  const index = Math.min(LAST_STAGE, Math.max(FIRST_STAGE, Math.trunc(stage) || FIRST_STAGE)) - 1;
  return STAGES[index]!;
}

/** How many nodes a route chapter has (its gate is the last), and a repair chapter (its last resolves the rupture). */
export const ROUTE_NODES_MIN = 4;
export const ROUTE_NODES_MAX = 6;
export const REPAIR_NODES_MIN = 2;
export const REPAIR_NODES_MAX = 3;

/** What blocks his next route chapter besides affection. */
export type RouteBlock = "rupture";

/** His next route chapter: the stage it opens, its key, whether it may start now, and what it still needs. */
export interface RouteNext {
  stage: number;
  key: string;
  unlocked: boolean;
  requires: { level: number };
  blockedBy: RouteBlock | null;
}

/** One love interest's arc on the Story screen (GET /runs/:run/story `routes`); `next` is null at stage 6. */
export interface RouteEntry {
  li: LiId;
  stage: number;
  next: RouteNext | null;
}

/** `route-<li>-<stage>`: the route chapter that opens `stage` for him. */
export const routeChapterKey = (li: LiId, stage: number) => `route-${li}-${stage}`;
/** `repair-<li>-<n>`: his n-th repair chapter. */
export const repairChapterKey = (li: LiId, n: number) => `repair-${li}-${n}`;

/**
 * Where his arc stands (plan M2b "Stage logic"): his stage, and the route chapter for the next one, unlocked once his
 * affection level reaches the stage's level and no rupture stands.
 */
export function routeStatus(li: LiId, liState: { stage: number; points: number; rupture: unknown | null }): RouteEntry {
  const stage = stageRow(liState.stage).stage;
  if (stage >= LAST_STAGE) return { li, stage, next: null };
  const row = stageRow(stage + 1);
  const level = row.unlockLevel ?? 1;
  const blockedBy: RouteBlock | null = liState.rupture ? "rupture" : null;
  return {
    li,
    stage,
    next: {
      stage: row.stage,
      key: routeChapterKey(li, row.stage),
      unlocked: !blockedBy && levelOf(liState.points) >= level,
      requires: { level },
      blockedBy,
    },
  };
}

// ── The Confrontation (a story node): three rounds of Press, Hold, Yield or Reveal ──

export const STANCES = ["press", "hold", "yield", "reveal"] as const;
export type Stance = (typeof STANCES)[number];

export const CONFRONTATION_ENDINGS = ["truth", "walkout", "standoff"] as const;
export type ConfrontationEnding = (typeof CONFRONTATION_ENDINGS)[number];

export const CONFRONTATION_ROUNDS = 3;
/**
 * His composure (never shown): it starts at 2, each picked option moves it by its own −1, 0 or +1, and it stays within
 * 0–4. After the last round, 0 is the truth (his guard is down), 4 is a walkout, and anything between is a standoff.
 */
export const COMPOSURE_START = 2;
export const COMPOSURE_MIN = 0;
export const COMPOSURE_MAX = 4;

/** His composure after these moves, clamped at every step. */
export function composureAfter(moves: readonly number[]): number {
  return moves.reduce(
    (composure, move) => Math.min(COMPOSURE_MAX, Math.max(COMPOSURE_MIN, composure + Math.sign(Number(move) || 0))),
    COMPOSURE_START,
  );
}

export function endingFor(composure: number): ConfrontationEnding {
  return composure <= COMPOSURE_MIN ? "truth" : composure >= COMPOSURE_MAX ? "walkout" : "standoff";
}

/** A walkout opens a rupture instead of a major grievance when trust is at or below this. */
export const WALKOUT_RUPTURE_TRUST = -2;
