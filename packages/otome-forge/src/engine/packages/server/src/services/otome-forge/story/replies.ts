// ──────────────────────────────────────────────
// Otome Forge: the shapes the story prompts' replies take (P5 chapter plan, P6 beat, P12 Confrontation and P12c
// Closer), and the tags, kinds and limits those prompts share with the checks that read the replies
// ──────────────────────────────────────────────
// The prompts themselves (P5, P6, P10, P11, P12 and P12c) are in S/prompts.ts, which imports from here the angst kinds
// and chapter tags a plan may name, its node counts, which love interests a side-with node is between (#2046) and the
// segment limits. The checks are S/story/chapters.ts, S/story/routes-plan.ts, S/story/beats.ts and
// S/story/confrontation.ts.
import { z, type ZodType } from "zod";
import type {
  Chapter,
  ChapterNode,
  NodeKind,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import { LIMIT_IDS } from "../../../../../client/src/features/otome-forge/shared/content.js";

/** The kinds of angst a conflict seed may be; a new seed never repeats one of that love interest's last two. */
export const ANGST_TYPES = [
  "misunderstanding",
  "jealousy",
  "secret",
  "betrayal",
  "duty",
  "pride",
  "ideals",
  "past",
  "rivalry",
  "danger",
] as const;
export type AngstType = (typeof ANGST_TYPES)[number];

/** Story tags beyond the content LimitIds (plan M2a P5). */
export const STORY_TAGS = ["jealousy", "grief", "possessiveness", "betrayal", "violence"] as const;
export const CHAPTER_TAGS: readonly string[] = [...LIMIT_IDS, ...STORY_TAGS];

export const NODES_MIN = 6;
export const NODES_MAX = 9;

// ── P5's reply: the chapter plan (the prompt: S/prompts.ts chapterPlanMessages) ──

export interface ChapterPlanReply {
  title: string;
  tags: string[];
  /** P5 names one; P10 and P11 have none. */
  foil?: string;
  summary: string;
  nodes: Array<{
    kind: NodeKind;
    moment?: "read-him" | "call" | "date" | null;
    guide: string;
    cast: string[];
    place?: string | null;
    cg?: boolean | null;
    resolves?: string[] | null;
    /** #2046: P5 only, and only while one may come (S/story/chapters.ts sideWithOpen). */
    sideWith?: boolean | null;
  }>;
  /** The node that carries this chapter's scheduled reveal (#1980), when the arc schedules one here. */
  revealNode?: number | null;
  /** The node that carries the arc's big event, on the arc's last chapter. */
  eventNode?: number | null;
  ledger: {
    relationship: Array<{ li: string; line: string }>;
    conflict: Array<{
      id?: string | null;
      li: string;
      type: string;
      action: "plant" | "escalate" | "complicate" | "resolve";
    }>;
    offscreen: Array<{ li: string; line: string }>;
  };
}

const text = (max: number) => z.string().max(max);

export const ChapterPlanSchema: ZodType<ChapterPlanReply> = z.object({
  title: text(200).min(1),
  tags: z.array(text(40)).max(12),
  foil: text(120).optional(),
  summary: text(1200).min(1),
  revealNode: z.number().int().min(0).max(11).nullable().optional(),
  eventNode: z.number().int().min(0).max(11).nullable().optional(),
  nodes: z
    .array(
      z.object({
        kind: z.enum(["beat", "moment", "confrontation", "closer"]),
        moment: z.enum(["read-him", "call", "date"]).nullable().optional(),
        guide: text(4000).min(1),
        cast: z.array(text(120)).max(6),
        place: text(120).nullable().optional(),
        cg: z.boolean().nullable().optional(),
        resolves: z.array(text(80)).max(6).nullable().optional(),
        sideWith: z.boolean().nullable().optional(),
      }),
    )
    .min(1)
    .max(12),
  ledger: z.object({
    relationship: z.array(z.object({ li: text(120), line: text(600) })).max(12),
    conflict: z
      .array(
        z.object({
          id: text(80).nullable().optional(),
          li: text(120),
          type: text(80),
          action: z.enum(["plant", "escalate", "complicate", "resolve"]),
        }),
      )
      .max(8),
    offscreen: z.array(z.object({ li: text(120), line: text(600) })).max(8),
  }),
});

/** #2046: a side-with scene is one choice of two to SIDE_WITH_MAX options, one per love interest (the kit allows 4). */
export const SIDE_WITH_MAX = 4;

/** The love interests present in `node` when a side-with scene fits it (a beat node with 2 to SIDE_WITH_MAX), or null. */
export function sideWithFits<U extends Pick<Unit, "id">>(
  node: Pick<ChapterNode, "kind" | "cast">,
  units: readonly U[],
): U[] | null {
  const present = units.filter((unit) => node.cast.includes(unit.id));
  return node.kind === "beat" && present.length >= 2 && present.length <= SIDE_WITH_MAX ? present : null;
}

/** The love interests a node's side-with scene is between: a main chapter's marked node that fits, or null. */
export function sideWithCast<U extends Pick<Unit, "id">>(
  chapter: Pick<Chapter, "kind">,
  node: Pick<ChapterNode, "kind" | "cast" | "sideWith">,
  units: readonly U[],
): U[] | null {
  return chapter.kind === "main" && node.sideWith ? sideWithFits(node, units) : null;
}

// ── P6's reply: a beat (the prompt: S/prompts.ts beatMessages) ──

export const BEAT_SEGMENTS_MAX = 40;
export const BEAT_PLACES_MAX = 4;
// Under NSFW: Explicit, sex is never rushed (S/prompts.ts HEAT_TEXT), so a Closer's opened ending that reaches it gets
// more room, as a node does (S/prompts.ts INTIMATE_BEAT_WORDS_MAX and INTIMATE_BEAT_SEGMENTS_MAX). It fits the reply's
// budget (generation.ts outputBudget: 8192 tokens at least, plus reasoning headroom).
/** The segments a Closer's opened ending that reaches sex may hold (its other endings keep CONFRONTATION_ENDING_MAX). */
export const CLOSER_INTIMATE_ENDING_MAX = 20;

/** The reply's top level, kept whole for the kit's choice normalizer (zod drops keys a schema does not name). */
export interface BeatReply {
  segments: unknown[];
  places?: unknown;
  choices?: unknown;
  musicMood?: unknown;
  cg?: unknown;
  voices?: unknown;
}

export const BeatReplySchema: ZodType<BeatReply> = z.object({
  segments: z.array(z.unknown()).min(1),
  places: z.unknown().optional(),
  choices: z.unknown().optional(),
  musicMood: z.unknown().optional(),
  cg: z.unknown().optional(),
  voices: z.unknown().optional(),
});

// ── P12's and P12c's reply (the prompts: S/prompts.ts confrontationMessages, closerMessages) ──

export const CONFRONTATION_OPENING_MAX = 10;
export const CONFRONTATION_HIS_MAX = 4;
export const CONFRONTATION_ANSWER_MAX = 3;
export const CONFRONTATION_ENDING_MAX = 6;

/** The reply's top level, kept whole: S/story/confrontation.ts normalizes every list the way P6's segments are. */
export interface ConfrontationReply {
  opening: unknown[];
  rounds: unknown[];
  endings: Record<string, unknown>;
  grievance?: unknown;
  disclosure?: unknown;
  places?: unknown;
  musicMood?: unknown;
  cg?: unknown;
  voices?: unknown;
}

export const ConfrontationReplySchema: ZodType<ConfrontationReply> = z.object({
  opening: z.array(z.unknown()).min(1),
  rounds: z.array(z.unknown()).min(1),
  endings: z.record(z.string(), z.unknown()),
  grievance: z.unknown().optional(),
  disclosure: z.unknown().optional(),
  places: z.unknown().optional(),
  musicMood: z.unknown().optional(),
  cg: z.unknown().optional(),
  voices: z.unknown().optional(),
});
