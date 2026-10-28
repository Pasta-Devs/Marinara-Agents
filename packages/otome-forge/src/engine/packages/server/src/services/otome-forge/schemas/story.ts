// ──────────────────────────────────────────────
// Otome Forge: the `${R}:chapter:${key}` and `${R}:beat:${key}:${i}` documents, read back into their full shapes
// ──────────────────────────────────────────────
// Both are written once by the story (S/story/*) and only ever read here, so a damaged list item is dropped and a
// damaged field takes its default; a document with no key or no index reads as missing (null), and is written again.
// The hidden parts (node guides, the ledger, a beat's effects, a date's plan and its scores) are stripped by
// toChapterView and toBeatView before anything reaches the client.
import { z, type ZodType } from "zod";
import type {
  Beat,
  BeatView,
  Chapter,
  ChapterLedger,
  ChapterNode,
  ChapterView,
  Confrontation,
  ConfrontationOption,
  Effect,
  ForgeChoice,
  Segment,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  CONFRONTATION_ENDINGS,
  CONFRONTATION_ROUNDS,
  FIRST_STAGE,
  LAST_STAGE,
  STANCES,
} from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import { LIMIT_IDS } from "../../../../../client/src/features/otome-forge/shared/content.js";
import {
  DATE_PLACE_KINDS,
  type DatePlan,
  type DateScore,
} from "../../../../../client/src/features/otome-forge/shared/dates.js";
import { FACES, MUSIC_MOODS } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { isChapterKey } from "../ids.js";
import { PaintSchema, isRecord, readFields, validItems } from "./common.js";

const short = (max = 600) => z.string().max(max);

export const SegmentSchema: ZodType<Segment> = z.object({
  speaker: short(120),
  text: short(4000),
  thought: z.boolean().optional(),
  expression: z.union([z.enum(FACES), z.literal("")]).optional(),
  place: short(120).optional(),
  gender: short(20).optional(),
});

const ChoiceSchema: ZodType<ForgeChoice> = z.object({
  id: short(40),
  kind: z.enum(["small", "big"]),
  at: z.number().int().min(0),
  options: z.array(
    z.object({
      id: short(40),
      text: short(400),
      selection: z.object({ kind: z.enum(["dialogue", "action"]), text: short(400) }),
      segments: z.array(SegmentSchema),
    }),
  ),
});

export const EffectSchema: ZodType<Effect> = z.object({
  li: z.string(),
  trust: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
  tension: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
  grievance: z
    .object({
      by: z.enum(["li", "protagonist"]),
      text: short(),
      severity: z.enum(["minor", "major", "rupture"]),
    })
    .optional(),
  disclose: short().optional(),
  resolve: z.object({ id: short(80), status: z.enum(["addressed", "forgiven", "festering"]) }).optional(),
});

const NodeSchema: ZodType<ChapterNode> = z.object({
  i: z.number().int().min(0),
  kind: z.enum(["beat", "moment", "confrontation"]),
  moment: z.enum(["read-him", "call", "date"]).optional(),
  guide: short(4000),
  cast: z.array(z.string()),
  place: short(120).optional(),
  cg: z.boolean().optional(),
  gate: z.boolean().optional(),
  resolves: z.array(short(80)).optional(),
  reveals: z.array(short(80)).optional(),
});

const LedgerSchema: ZodType<ChapterLedger> = z.object({
  relationship: z.array(z.object({ li: z.string(), line: short() })),
  conflict: z.array(
    z.object({
      id: short(80),
      li: z.string(),
      type: short(80),
      action: z.enum(["plant", "escalate", "complicate", "resolve"]),
    }),
  ),
  offscreen: z.array(z.object({ li: z.string(), line: short() })),
});

const emptyLedger = (): ChapterLedger => ({ relationship: [], conflict: [], offscreen: [] });

const SelectionSchema = z.object({ kind: z.enum(["dialogue", "action"]), text: short(400) });
const StanceOptionSchema: ZodType<ConfrontationOption> = z.object({
  label: short(200),
  selection: SelectionSchema,
  segments: z.array(SegmentSchema).min(1),
  composure: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});
const RoundSchema = z.object({
  his: z.array(SegmentSchema).min(1),
  options: z.object({
    press: StanceOptionSchema,
    hold: StanceOptionSchema,
    yield: StanceOptionSchema,
    reveal: StanceOptionSchema,
  }),
});
const EndingSegments = z.array(SegmentSchema).min(1);

/** A stored stance game (S/story/confrontation.ts writes it): three rounds, three endings, the picks so far. */
export const ConfrontationSchema: ZodType<Confrontation> = z.object({
  li: z.string(),
  rounds: z.array(RoundSchema).min(CONFRONTATION_ROUNDS).max(CONFRONTATION_ROUNDS),
  endings: z.object({ truth: EndingSegments, walkout: EndingSegments, standoff: EndingSegments }),
  grievance: z.object({ text: short(), severity: z.literal("major") }),
  disclosure: short(),
  picks: z.array(z.enum(STANCES)).max(CONFRONTATION_ROUNDS),
  ending: z.enum(CONFRONTATION_ENDINGS).optional(),
});

/** A date's plan (M5, SH/dates.ts); a damaged one reads as none, so the chapter is not a playable date. */
const DatePlanSchema: ZodType<DatePlan> = z.object({
  li: z.string(),
  place: z.enum(DATE_PLACE_KINDS as [DatePlan["place"], ...DatePlan["place"][]]),
  placeName: short(120),
  herLook: short(80),
  hisLook: short(80),
  goesWrong: z.boolean(),
  makeItRight: short(80).nullable(),
  keepsake: z.object({ brief: short(1200), art: PaintSchema.optional() }),
});

const SCORE_VALUES: ReadonlySet<unknown> = new Set([-1, 0, 1]);

/** A date beat's hidden scores: choiceId → optionId → −1/0/1; anything else is dropped. */
function readScores(value: unknown): Beat["scores"] {
  if (!isRecord(value)) return undefined;
  const scores: NonNullable<Beat["scores"]> = {};
  for (const [choice, options] of Object.entries(value)) {
    if (!isRecord(options)) continue;
    const kept = Object.entries(options).filter(([, score]) => SCORE_VALUES.has(score));
    if (kept.length) scores[choice] = Object.fromEntries(kept) as Record<string, DateScore>;
  }
  return Object.keys(scores).length ? scores : undefined;
}

/** `value` without its `key` field when that field is undefined (an optional field is absent, never undefined). */
function withoutEmpty<T extends object, K extends keyof T>(value: T, key: K): T {
  if (value[key] !== undefined) return value;
  const { [key]: _empty, ...rest } = value;
  return rest as T;
}

/** A stored chapter plan, or null when there is none (or it has no valid key). */
export function normalizeChapter(data: unknown): Chapter | null {
  if (!isRecord(data) || !isChapterKey(data.key)) return null;
  const read = readFields<Chapter>(
    {
      key: z.string(),
      kind: z.enum(["main", "route", "repair", "story", "date"]),
      number: z.number().int().min(1).optional(),
      li: z.string().optional(),
      stage: z.number().int().min(FIRST_STAGE).max(LAST_STAGE).optional(),
      grievance: short(80).optional(),
      lead: z.string(),
      foil: z.string().optional(),
      title: short(200),
      tags: (value) => validItems(short(40), value, 12),
      summary: short(1200),
      nodes: (value) => validItems(NodeSchema, value),
      ledger: (value) => (LedgerSchema.safeParse(value).success ? (value as ChapterLedger) : emptyLedger()),
      plannedAt: z.string(),
      connectionId: z.string(),
      voicedLine: short().optional(),
      date: (value) => {
        const parsed = DatePlanSchema.safeParse(value);
        return parsed.success ? parsed.data : undefined;
      },
    },
    () => ({
      key: data.key as string,
      kind: "main",
      lead: "",
      title: "",
      tags: [],
      summary: "",
      nodes: [],
      ledger: emptyLedger(),
      plannedAt: "",
      connectionId: "",
    }),
    data,
  );
  const chapter = withoutEmpty(read, "date");
  return chapter.nodes.length ? chapter : null;
}

/**
 * A stored beat, or null when there is none (or it has no valid key or index, or no segments; only a node eased off
 * before it was written has none).
 */
export function normalizeBeat(data: unknown): Beat | null {
  if (!isRecord(data) || !isChapterKey(data.key) || !Number.isInteger(data.i)) return null;
  const read = readFields<Beat>(
    {
      key: z.string(),
      i: z.number().int().min(0),
      kind: z.enum(["beat", "moment", "confrontation"]),
      places: (value) => validItems(z.object({ name: short(120), tags: short() }), value, 8),
      segments: (value) => validItems(SegmentSchema, value),
      choices: (value) => validItems(ChoiceSchema, value, 3),
      choiceCanon: z.record(z.string(), z.string()),
      effects: z.record(z.string(), z.record(z.string(), z.array(EffectSchema))),
      applied: (value) =>
        Object.fromEntries(
          Object.entries(isRecord(value) ? value : {})
            .filter(([, flag]) => flag === true)
            .map(([id]) => [id, true as const]),
        ),
      scores: readScores,
      musicMood: z.enum(MUSIC_MOODS),
      cg: z
        .object({
          at: z.number().int().min(0),
          brief: short(1200),
          cast: z.array(short(120)),
          explicit: z.literal(true).optional(),
          art: PaintSchema.optional(),
        })
        .optional(),
      readThrough: z.number().int().min(0),
      easedOff: z.object({ at: z.number().int().min(0), veil: z.array(z.enum(LIMIT_IDS)).optional() }).optional(),
      written: z.object({ at: z.string(), connectionId: z.string(), model: z.string() }),
      rewrites: z.number().int().min(0),
      shown: z.literal(true).optional(),
      confrontation: ConfrontationSchema.optional(),
    },
    () => ({
      key: data.key as string,
      i: data.i as number,
      kind: "beat",
      places: [],
      segments: [],
      choices: [],
      choiceCanon: {},
      effects: {},
      applied: {},
      musicMood: "tender",
      readThrough: 0,
      written: { at: "", connectionId: "", model: "" },
      rewrites: 0,
    }),
    data,
  );
  const beat = withoutEmpty(read, "scores");
  return beat.segments.length || beat.easedOff ? beat : null;
}

/**
 * The plan as the client sees it: no guides, casts, reveals, ledger, the grievance a repair is for, or a date's plan
 * (GET .../dates shows a date).
 */
export function toChapterView(chapter: Chapter): ChapterView {
  const { nodes, ledger: _ledger, connectionId: _connection, grievance: _grievance, date: _date, ...rest } = chapter;
  return {
    ...rest,
    nodes: nodes.map(({ i, kind, moment, cg, gate }) => ({
      i,
      kind,
      ...(moment ? { moment } : {}),
      ...(cg ? { cg } : {}),
      ...(gate ? { gate } : {}),
    })),
  };
}

/**
 * The beat as the client sees it: without its effects, its stored confrontation (it gets a view) or a date beat's
 * scores.
 */
export function toBeatView(beat: Beat): BeatView {
  const { effects: _effects, applied: _applied, confrontation: _confrontation, scores: _scores, ...rest } = beat;
  return rest;
}
