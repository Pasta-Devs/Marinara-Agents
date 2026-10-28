// ──────────────────────────────────────────────
// Otome Forge: the `${R}:state` document (Starlight and each love interest's points and stage), and the RunView
// ──────────────────────────────────────────────
// Later milestones add their own fields here, each with a default, so older states keep reading.
import type {
  Player,
  RunState,
  RunView,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { isLiId, playerId, stateId, worldId } from "../ids.js";
import type { OtomeStore } from "../store.js";
import { field, isRecord } from "./common.js";
import { normalizePlayer } from "./player.js";
import { normalizeUnit } from "./unit.js";
import { normalizeWorld, toWorldView } from "./world.js";

// ponytail: the M1 numbers live here; M2a moves them to SH/economy.ts with the rest of the economy and its test.
export const STARTING_STARLIGHT = 2000;
export const POINTS_PER_LEVEL = 300;
export const MAX_LEVEL = 10;
export const FIRST_STAGE = 1;
export const LAST_STAGE = 6;

const wholeNumber = (value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;

export function normalizeState(data: unknown): RunState {
  const lis: RunState["lis"] = {};
  const rawLis = field(data, "lis");
  if (isRecord(rawLis)) {
    for (const [id, raw] of Object.entries(rawLis)) {
      if (!isLiId(id)) continue;
      lis[id] = {
        points: wholeNumber(field(raw, "points"), 0, 0),
        stage: wholeNumber(field(raw, "stage"), FIRST_STAGE, FIRST_STAGE, LAST_STAGE),
      };
    }
  }
  return {
    version: 1,
    wallet: { starlight: wholeNumber(field(field(data, "wallet"), "starlight"), STARTING_STARLIGHT, 0) },
    lis,
  };
}

/** Affection level 1–10 from points; it only rises because points only rise. */
export function levelOf(points: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(Math.max(0, points) / POINTS_PER_LEVEL));
}

/**
 * What GET /runs/:run returns. LIs follow the order of `state.lis` (setup order); a unit missing from it goes last.
 */
export function toRunView(runKey: string, world: World, player: Player, units: Unit[], state: RunState): RunView {
  const order = Object.keys(state.lis);
  const rank = (unit: Unit) => {
    const index = order.indexOf(unit.id);
    return index < 0 ? order.length : index;
  };
  return {
    runKey,
    world: toWorldView(world),
    player,
    lis: [...units]
      .sort((a, b) => rank(a) - rank(b))
      .map((unit) => {
        const progress = state.lis[unit.id] ?? { points: 0, stage: FIRST_STAGE };
        return {
          id: unit.id,
          name: unit.name,
          pronouns: unit.pronouns,
          source: unit.source,
          accent: unit.accent,
          ...(unit.portrait ? { portrait: unit.portrait } : {}),
          level: levelOf(progress.points),
          stage: progress.stage,
        };
      }),
    forge: world.forge,
    starlight: state.wallet.starlight,
  };
}

export interface RunDocuments {
  world: World;
  player: Player;
  units: Unit[];
  state: RunState;
}

/** Every M1 document of the run, normalized; null when the run has no world. */
export async function readRun(
  store: Pick<OtomeStore, "readDoc" | "listRun">,
  runId: string,
): Promise<RunDocuments | null> {
  const [world, player, unitRecords, state] = await Promise.all([
    store.readDoc(worldId(runId), normalizeWorld),
    store.readDoc(playerId(runId), normalizePlayer),
    store.listRun("unit", runId),
    store.readDoc(stateId(runId), normalizeState),
  ]);
  if (!world) return null;
  return {
    world,
    player: player ?? normalizePlayer(undefined),
    units: unitRecords.map((record) => normalizeUnit(record.data)),
    state: state ?? normalizeState(undefined),
  };
}
