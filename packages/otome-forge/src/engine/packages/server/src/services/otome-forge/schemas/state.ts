// ──────────────────────────────────────────────
// Otome Forge: the `${R}:state` document (Starlight and each love interest's points and stage), and the RunView
// ──────────────────────────────────────────────
// Later milestones add their own fields here, each with a default, so older states keep reading. M3: `home`. M4:
// `pity`, `owned`, `selector` and `pulls` (S/wish/pull.ts writes them, in the same write as the Starlight they cost).
// M5: each love interest's `tellsLearned`, the plush shelf (`owned.plush`), each love interest's newest Claw Machine
// rounds (`claw.rounds`) and the newest paid Read Him sets (`readHim.paid`).
// M6 adds none: the period tracker and caring messages never reach a server document (plan §1.9).
import { forgeStoryExpressionCast, forgeStoryExpressionsOn } from "@forge-kit/story-expressions-server.mjs";
import { z, type ZodType } from "zod";
import type {
  AlbumCg,
  ChapterProgress,
  Favorite,
  Grievance,
  HomeState,
  Ledgers,
  LiState,
  Player,
  RunState,
  RunView,
  TimelineEntry,
  Unit,
  WishPullRecord,
  World,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { FIRST_STAGE, LAST_STAGE } from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import {
  CLAW_MAX_CATCHES,
  CLAW_ROUNDS_KEPT,
  CLAW_ROUND_ID,
  isPlushSeries,
  plushLi,
  type ClawRound,
} from "../../../../../client/src/features/otome-forge/shared/claw.js";
import {
  READ_HIM_PAID_KEPT,
  READ_HIM_SET_ID,
  type ReadHimPaid,
} from "../../../../../client/src/features/otome-forge/shared/read-him.js";
import {
  STARTING_STARLIGHT,
  TENSION_MAX,
  TENSION_MIN,
  TRUST_MAX,
  TRUST_MIN,
  levelOf,
} from "../../../../../client/src/features/otome-forge/shared/economy.js";
import { FACES, type Face } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import {
  BANNER_KINDS,
  FOUR_STAR_EVERY,
  HARD_PITY,
  isItemId,
  type BannerKind,
  type PityCounter,
} from "../../../../../client/src/features/otome-forge/shared/wish.js";
import { isChapterKey, isLiId, playerId, stateId, worldId } from "../ids.js";
import { readChapterDelta } from "../state/relationship.js";
import type { OtomeStore } from "../store.js";
import { field, isRecord, readFields, validItems, wornLookUrl } from "./common.js";
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
/** Pulls remembered for a retried request id (S/wish/pull.ts). */
const PULLS_MAX = 20;
/** Tells are 3–5 per bible; the room covers a hand-edited one. */
const TELLS_MAX = 20;

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

const ClawPlayerSchema = z.enum(["me", "partner"]);
const ClawRoundSchema: ZodType<ClawRound> = z.object({
  id: z.string().regex(CLAW_ROUND_ID),
  li: z.string(),
  name: short(200),
  at: z.string(),
  first: ClawPlayerSchema,
  caught: z.array(z.object({ prize: short(100), by: ClawPlayerSchema })).max(CLAW_MAX_CATCHES),
  cheat: z.enum(["steady", "nudge", "extra", "freeze", "calculate"]).nullable(),
  paid: z.object({ starlight: z.number().int().min(0), affection: z.number().int().min(0) }),
  capped: z.boolean(),
  newPlush: z.array(short(100)).max(CLAW_MAX_CATCHES),
  firstPlush: z.boolean(),
  line: short(300).optional(),
});
const ReadHimPaidSchema: ZodType<ReadHimPaid> = z.object({
  setId: z.string().regex(READ_HIM_SET_ID),
  li: z.string(),
  starlight: z.number().int().min(0),
  affection: z.number().int().min(0),
});

/** A plush id the shelf can hold: a series plush, or `li:<li id>`. */
const isPlushId = (id: string) => isPlushSeries(id) || isLiId(plushLi(id));

/** The learned tells as distinct indexes, in the order they were learned. */
function normalizeTells(value: unknown): number[] {
  const tells: number[] = [];
  for (const index of validItems(
    z
      .number()
      .int()
      .min(0)
      .max(TELLS_MAX - 1),
    value,
  )) {
    if (!tells.includes(index)) tells.push(index);
  }
  return tells.slice(0, TELLS_MAX);
}

/**
 * Learned tells, as indexes into the mask tells `before` an edit, now as indexes into the tells `after` it. A tell the
 * edit removed or reworded is no longer one the protagonist read, so it is dropped.
 */
export function remapLearnedTells(
  learned: readonly number[],
  before: readonly string[],
  after: readonly string[],
): number[] {
  const remapped: number[] = [];
  for (const index of learned) {
    const tell = before[index];
    const next = tell === undefined ? -1 : after.indexOf(tell);
    if (next >= 0 && !remapped.includes(next)) remapped.push(next);
  }
  return remapped;
}

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
  tellsLearned: [],
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
      tellsLearned: normalizeTells,
    },
    defaultLiState,
    isRecord(raw) ? raw : undefined,
  );
}

const defaultLedgers = (): Ledgers => ({ relationship: [], conflicts: [], offscreen: [] });

const PullRecordSchema: ZodType<WishPullRecord> = z.object({
  id: short(80),
  banner: short(80),
  at: z.string(),
  results: z
    .array(
      z.object({
        item: short(80),
        rarity: z.union([z.literal(3), z.literal(4), z.literal(5)]),
        isNew: z.boolean(),
        refund: z.number().int().min(0),
      }),
    )
    .max(10),
});

/** Each banner kind's pity (M4): counts below the 5★ guarantee; a damaged counter starts again from 0. */
function normalizePity(raw: unknown): Record<BannerKind, PityCounter> {
  const pity = {} as Record<BannerKind, PityCounter>;
  for (const kind of BANNER_KINDS) {
    const counter = field(raw, kind);
    pity[kind] = {
      count: wholeNumber(field(counter, "count"), 0, 0, HARD_PITY - 1),
      since4: wholeNumber(field(counter, "since4"), 0, 0, FOUR_STAR_EVERY - 1),
    };
  }
  return pity;
}

/**
 * The owned item ids (M4), each once, in the order won, and when each was won (kept only for an owned id), and the
 * plush shelf (M5): plush id → how many. Never capped: ownership is never dropped.
 */
function normalizeOwned(raw: unknown): RunState["owned"] {
  const rawItems = field(raw, "items");
  const items = [...new Set((Array.isArray(rawItems) ? rawItems : []).filter(isItemId))];
  const at: Record<string, string> = {};
  for (const id of items) {
    const won = field(field(raw, "at"), id);
    if (typeof won === "string" && won.length <= 40) at[id] = won;
  }
  const plush: Record<string, number> = {};
  const rawPlush = field(raw, "plush");
  if (isRecord(rawPlush)) {
    for (const [id, count] of Object.entries(rawPlush)) {
      const value = wholeNumber(count, 0, 0);
      if (isPlushId(id) && value > 0) plush[id] = value;
    }
  }
  return { items, at, plush };
}

/** Who Home shows (M3): a love interest of the run, else the first in cast order; him unless the player picked Me. */
function normalizeHome(raw: unknown, lis: RunState["lis"]): HomeState {
  const li = field(raw, "li");
  return {
    li: typeof li === "string" && lis[li] ? li : null,
    show: field(raw, "show") === "me" ? "me" : "him",
  };
}

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
  const selector: RunState["selector"] = {};
  const rawSelector = field(data, "selector");
  if (isRecord(rawSelector)) {
    for (const [id, used] of Object.entries(rawSelector)) {
      // An item id is the Memory it claimed; `true` is a claim from before that was recorded (it never replays).
      if (isLiId(id) && (isItemId(used) || used === true)) selector[id] = used;
    }
  }
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
    home: normalizeHome(field(data, "home"), lis),
    album: { cgs: validItems(AlbumCgSchema, field(field(data, "album"), "cgs"), ALBUM_MAX) },
    pity: normalizePity(field(data, "pity")),
    owned: normalizeOwned(field(data, "owned")),
    selector,
    pulls: validItems(PullRecordSchema, field(data, "pulls"), PULLS_MAX),
    claw: { rounds: keepClawRounds(validItems(ClawRoundSchema, field(field(data, "claw"), "rounds"))) },
    readHim: {
      paid: keepNewest(validItems(ReadHimPaidSchema, field(field(data, "readHim"), "paid")), READ_HIM_PAID_KEPT),
    },
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
  pulls: PULLS_MAX,
  /** A timeline entry's text and the other short texts, in UTF-16 units (clipText). */
  text: TEXT_MAX,
};

/**
 * His painted faces for the look he wears now (the kit's forgeStoryExpressionCast: a ready set only, and only while
 * expressions are on): his worn outfit (M4), else his portrait, the base art/expressions.ts paints them on.
 */
export function readyFaces(world: Pick<World, "images">, unit: Unit): Partial<Record<Face, string>> | undefined {
  const { expressions } = forgeStoryExpressionCast(world.images, unit, wornLookUrl(unit), FACES);
  return expressions as Partial<Record<Face, string>> | undefined;
}

/**
 * True while the faces for the look worn now may still arrive: expressions are on, there is a look, and its set is
 * neither ready nor given up. The kit never repaints a failed or stopped set by itself, so its faces never come.
 */
export function facesComing(world: Pick<World, "images">, unit: Unit): boolean {
  const base = wornLookUrl(unit);
  if (!base || !forgeStoryExpressionsOn(world.images)) return false;
  const state = (unit.expressions[base] as { state?: unknown } | undefined)?.state;
  return state !== "ready" && state !== "failed" && state !== "stopped";
}

/**
 * The Claw Machine rounds the state keeps, in the order they were played: each love interest's newest
 * CLAW_ROUNDS_KEPT, and each one's first-plush round as well, so one love interest's play never evicts another's.
 * ponytail: a love interest's rounds older than his newest CLAW_ROUNDS_KEPT leave his memory and the replay guard (a
 * finish of one sent again by hand would pay again, within the day's cap); the upgrade path is rounds kept as their own
 * documents, as Read Him sets are, or a digest of each love interest's older rounds.
 */
export function keepClawRounds(rounds: readonly ClawRound[], max = CLAW_ROUNDS_KEPT): ClawRound[] {
  const room = new Map<string, number>();
  const kept: ClawRound[] = [];
  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    const round = rounds[index]!;
    const left = room.get(round.li) ?? max;
    if (left > 0 || round.firstPlush) kept.push(round);
    if (left > 0) room.set(round.li, left - 1);
  }
  return kept.reverse();
}

/** `text` cut to at most `max` UTF-16 units (what the state's schemas count), never inside a surrogate pair. */
export function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  let clipped = "";
  for (const character of text) {
    if (clipped.length + character.length > max) break;
    clipped += character;
  }
  return clipped;
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
        const worn = unit.wornOutfit ? unit.outfits.find((outfit) => outfit.id === unit.wornOutfit) : undefined;
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
          ...(worn ? { worn: { id: worn.id, url: worn.url } } : {}),
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
