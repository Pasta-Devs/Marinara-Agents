// ──────────────────────────────────────────────
// Otome Forge: the `${R}:chapter:${key}` and `${R}:beat:${key}:${i}` documents, read back into their full shapes
// ──────────────────────────────────────────────
// Both are written once by the story (S/story/*) and only ever read here, so a damaged list item is dropped and a
// damaged field takes its default; a document with no key or no index reads as missing (null), and is written again.
// The hidden parts (node guides, the ledger, a beat's effects) are stripped by toChapterView and toBeatView before
// anything reaches the client.
import { z, type ZodType } from "zod";
import type {
  Beat,
  BeatView,
  Chapter,
  ChapterLedger,
  ChapterNode,
  ChapterView,
  Effect,
  ForgeChoice,
  Segment,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LIMIT_IDS } from "../../../../../client/src/features/otome-forge/shared/content.js";
import { FACES, MUSIC_MOODS } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { isChapterKey } from "../ids.js";
import { isRecord, readFields, validItems } from "./common.js";

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

/** A stored chapter plan, or null when there is none (or it has no valid key). */
export function normalizeChapter(data: unknown): Chapter | null {
  if (!isRecord(data) || !isChapterKey(data.key)) return null;
  const chapter = readFields<Chapter>(
    {
      key: z.string(),
      kind: z.enum(["main", "route", "repair", "story", "date"]),
      number: z.number().int().min(1).optional(),
      li: z.string().optional(),
      lead: z.string(),
      foil: z.string().optional(),
      title: short(200),
      tags: (value) => validItems(short(40), value, 12),
      summary: short(1200),
      nodes: (value) => validItems(NodeSchema, value),
      ledger: (value) => (LedgerSchema.safeParse(value).success ? (value as ChapterLedger) : emptyLedger()),
      plannedAt: z.string(),
      connectionId: z.string(),
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
  return chapter.nodes.length ? chapter : null;
}

/**
 * A stored beat, or null when there is none (or it has no valid key or index, or no segments; only a node eased off
 * before it was written has none).
 */
export function normalizeBeat(data: unknown): Beat | null {
  if (!isRecord(data) || !isChapterKey(data.key) || !Number.isInteger(data.i)) return null;
  const beat = readFields<Beat>(
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
      musicMood: z.enum(MUSIC_MOODS),
      cg: z.object({ at: z.number().int().min(0), brief: short(1200), cast: z.array(short(120)) }).optional(),
      readThrough: z.number().int().min(0),
      easedOff: z.object({ at: z.number().int().min(0), veil: z.array(z.enum(LIMIT_IDS)).optional() }).optional(),
      written: z.object({ at: z.string(), connectionId: z.string(), model: z.string() }),
      rewrites: z.number().int().min(0),
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
  return beat.segments.length || beat.easedOff ? beat : null;
}

/** The plan as the client sees it: no guides, casts or ledger. */
export function toChapterView(chapter: Chapter): ChapterView {
  const { nodes, ledger: _ledger, connectionId: _connection, ...rest } = chapter;
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

/** The beat as the client sees it: without its effects. */
export function toBeatView(beat: Beat): BeatView {
  const { effects: _effects, applied: _applied, ...rest } = beat;
  return rest;
}
