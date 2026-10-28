// ──────────────────────────────────────────────
// Otome Forge: the `${R}:state` document (Starlight and each love interest's points and stage), and the RunView
// ──────────────────────────────────────────────
// Later milestones add their own fields here, each with a default, so older states keep reading.
import { forgeStoryExpressionCast, forgeStoryExpressionsOn } from "@forge-kit/story-expressions-server.mjs";
import { z, type ZodType } from "zod";
import type {
  AlbumCg,
  ChapterProgress,
  Favorite,
  Grievance,
  Ledgers,
  LiState,
  Player,
  RunState,
  RunView,
  TimelineEntry,
  Unit,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FIRST_STAGE, LAST_STAGE } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import {
  STARTING_STARLIGHT,
  TENSION_MAX,
  TENSION_MIN,
  TRUST_MAX,
  TRUST_MIN,
  levelOf,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { FACES, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { isChapterKey, isLiId, playerId, stateId, worldId } from "../ids.js";
import { readChapterDelta } from "../state/relationship.js";
import type { OtomeStore } from "../store.js";
import { field, isRecord, readFields, validItems } from "./common.js";
import { normalizePlayer } from "./player.js";
import { normalizeUnit } from "./unit.js";
import { normalizeWorld, toWorldView } from "./world.js";

export { FIRST_STAGE, LAST_STAGE };

const TEXT_MAX = 600;
const LIST_MAX = 200;
const LEDGER_MAX = 300;
const TIMELINE_MAX = 500;
const FAVORITES_MAX = 300;
const ALBUM_MAX = 500;

const wholeNumber = (value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;

const short = (max = TEXT_MAX) => z.string().max(max);

const GrievanceSchema: ZodType<Grievance> = z.object({
  id: short(80),
  li: z.string(),
  by: z.enum(["li", "protagonist"]),
  text: short(),
  severity: z.enum(["minor", "major", "rupture"]),
  opened: short(120),
  status: z.enum(["open", "addressed", "forgiven", "festering"]),
});

const DisclosureSchema = z.object({ text: short(), at: z.string(), ref: short(120) });

const RelationshipLineSchema = z.object({ key: short(120), li: z.string(), line: short() });
const ConflictSchema: ZodType<Ledgers["conflicts"][number]> = z.object({
  id: short(80),
  li: z.string(),
  type: short(80),
  status: z.enum(["open", "resolved"]),
  chapter: z.number().int().min(0),
  key: short(120).optional(),
});
const TimelineSchema: ZodType<TimelineEntry> = z.object({
  at: z.string(),
  li: z.string(),
  kind: short(60),
  text: short(),
  ref: short(200).optional(),
});
const FavoriteSchema: ZodType<Favorite> = z.object({
  at: z.string(),
  li: z.string().optional(),
  text: short(2000),
  ref: short(200),
});

const AlbumCgSchema: ZodType<AlbumCg> = z.object({
  key: short(200),
  url: z.string().max(2000),
  ref: short(200),
  at: z.string(),
  li: z.string().optional(),
});

/** A love interest's state with every M2a field defaulted (trust and tension 0, no grievances, never led). */
export const defaultLiState = (): LiState => ({
  points: 0,
  stage: FIRST_STAGE,
  trust: 0,
  tension: 0,
  chapterDelta: {},
  grievances: [],
  rupture: null,
  disclosures: [],
  revealed: [],
  lastLead: null,
  angst: [],
  firsts: {},
});

function normalizeLiState(raw: unknown): LiState {
  return readFields<LiState>(
    {
      points: (value) => wholeNumber(value, 0, 0),
      stage: (value) => wholeNumber(value, FIRST_STAGE, FIRST_STAGE, LAST_STAGE),
      trust: (value) => wholeNumber(value, 0, TRUST_MIN, TRUST_MAX),
      tension: (value) => wholeNumber(value, 0, TENSION_MIN, TENSION_MAX),
      chapterDelta: readChapterDelta,
      grievances: (value) => validItems(GrievanceSchema, value, LIST_MAX),
      rupture: z.object({ grievanceId: short(80), since: z.string() }).nullable(),
      disclosures: (value) => validItems(DisclosureSchema, value, LIST_MAX),
      revealed: (value) => validItems(short(80), value, LIST_MAX),
      lastLead: z.number().int().min(0).nullable(),
      angst: (value) => validItems(short(80), value, LIST_MAX),
      firsts: z.record(z.string(), z.string()),
    },
    defaultLiState,
    isRecord(raw) ? raw : undefined,
  );
}

const defaultLedgers = (): Ledgers => ({ relationship: [], conflicts: [], offscreen: [] });

export function normalizeState(data: unknown): RunState {
  const lis: RunState["lis"] = {};
  const rawLis = field(data, "lis");
  if (isRecord(rawLis)) {
    for (const [id, raw] of Object.entries(rawLis)) {
      if (isLiId(id)) lis[id] = normalizeLiState(raw);
    }
  }
  const chapters: RunState["chapters"] = {};
  const rawChapters = field(data, "chapters");
  if (isRecord(rawChapters)) {
    for (const [key, raw] of Object.entries(rawChapters)) {
      if (!isChapterKey(key)) continue;
      chapters[key] = readFields<ChapterProgress>(
        {
          beatsRead: (value) => wholeNumber(value, 0, 0),
          completed: z.string().nullable(),
          applied: (value) => validItems(short(120), value),
        },
        () => ({ beatsRead: 0, completed: null, applied: [] }),
        isRecord(raw) ? raw : undefined,
      );
    }
  }
  const rawDaily = field(data, "daily");
  const affection: Record<string, number> = {};
  const rawAffection = field(rawDaily, "affection");
  if (isRecord(rawAffection)) {
    for (const [id, value] of Object.entries(rawAffection)) {
      if (isLiId(id)) affection[id] = wholeNumber(value, 0, 0);
    }
  }
  const rawLedgers = field(data, "ledgers");
  return {
    version: 1,
    wallet: { starlight: wholeNumber(field(field(data, "wallet"), "starlight"), STARTING_STARLIGHT, 0) },
    lis,
    daily: {
      dayKey: typeof field(rawDaily, "dayKey") === "string" ? (field(rawDaily, "dayKey") as string) : "",
      starlight: wholeNumber(field(rawDaily, "starlight"), 0, 0),
      affection,
    },
    chapters,
    ledgers: isRecord(rawLedgers)
      ? {
          relationship: validItems(RelationshipLineSchema, rawLedgers.relationship, LEDGER_MAX),
          conflicts: validItems(ConflictSchema, rawLedgers.conflicts, LEDGER_MAX),
          offscreen: validItems(RelationshipLineSchema, rawLedgers.offscreen, LEDGER_MAX),
        }
      : defaultLedgers(),
    timeline: validItems(TimelineSchema, field(data, "timeline"), TIMELINE_MAX),
    favorites: validItems(FavoriteSchema, field(data, "favorites"), FAVORITES_MAX),
    album: { cgs: validItems(AlbumCgSchema, field(field(data, "album"), "cgs"), ALBUM_MAX) },
  };
}

/** Lists the state keeps bounded: the newest `max` entries (ledgers, timeline and favorites grow by appending). */
export function keepNewest<T>(items: readonly T[], max: number): T[] {
  return items.length > max ? items.slice(items.length - max) : [...items];
}
export const STATE_LIMITS = {
  ledger: LEDGER_MAX,
  timeline: TIMELINE_MAX,
  favorites: FAVORITES_MAX,
  list: LIST_MAX,
  album: ALBUM_MAX,
};

/**
 * His painted faces for the look he wears now (the kit's forgeStoryExpressionCast: a ready set only, and only while
 * expressions are on). The worn look is his portrait until outfits arrive (M4).
 */
export function readyFaces(world: Pick<World, "images">, unit: Unit): Partial<Record<Face, string>> | undefined {
  // ponytail: his portrait is the look until M4 adds a worn one (art/expressions.ts paints on the same base).
  const { expressions } = forgeStoryExpressionCast(world.images, unit, unit.portrait ?? "", FACES);
  return expressions as Partial<Record<Face, string>> | undefined;
}

/**
 * True while the faces for the look worn now may still arrive: expressions are on, there is a look, and its set is
 * neither ready nor given up. The kit never repaints a failed or stopped set by itself, so its faces never come.
 */
export function facesComing(world: Pick<World, "images">, unit: Unit): boolean {
  const base = unit.portrait ?? "";
  if (!base || !forgeStoryExpressionsOn(world.images)) return false;
  const state = (unit.expressions[base] as { state?: unknown } | undefined)?.state;
  return state !== "ready" && state !== "failed" && state !== "stopped";
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
        const progress = state.lis[unit.id] ?? defaultLiState();
        const expressions = readyFaces(world, unit);
        return {
          id: unit.id,
          name: unit.name,
          pronouns: unit.pronouns,
          source: unit.source,
          ...(unit.cardId ? { cardId: unit.cardId } : {}),
          voiceGender: unit.voiceGender,
          accent: unit.accent,
          ...(unit.portrait ? { portrait: unit.portrait } : {}),
          level: levelOf(progress.points),
          stage: progress.stage,
          ...(expressions ? { expressions } : {}),
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
