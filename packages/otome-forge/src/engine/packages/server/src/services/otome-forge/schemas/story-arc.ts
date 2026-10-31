// ──────────────────────────────────────────────
// Otome Forge: the `${R}:arc:<n>` document (story arcs, #1980): a long-term plan for a run of main chapters.
// ──────────────────────────────────────────────
// One document per arc, read only by the arc path and storyView, never sent raw. The hidden story lives here (goal, the
// big event, the reveal schedule, the antagonist), so only toArcView may describe it, and only with the few fields a
// player may see. Chapter numbers are absolute main chapter numbers and never reset: an arc says which it covers, and
// nothing is renumbered. An arc has ended when main chapter `endsAt` is completed in the state; that is derived, never
// written here, so the plan and the progress cannot drift.
//
// The model never writes a chapter number: a reply gives purposes and reveal positions as 1-based indices and
// normalizeArcPlan stamps `from + index - 1`. Off-by-one in a twelve-chapter schedule is the likeliest structural
// failure, and this removes it. Brevity is part of the shape: one short sentence per purpose, and the schema caps it.
import { z, type ZodType } from "zod";
import type { LiId, StoryArc, StoryArcView } from "../../../../../client/src/features/otome-forge/shared/api-types.js";
export type { StoryArc, StoryArcView };
import { isRecord, readFields, validItems } from "./common.js";

/** The chapters a story arc covers, and a breathing arc's. */
export const ARC_LENGTH_MIN = 8;
export const ARC_LENGTH_MAX = 12;
export const BREATHING_LENGTH_MIN = 3;
export const BREATHING_LENGTH_MAX = 5;

/** A purpose is a moment, not prose: one short sentence (the cap keeps a planner from writing a chapter in the outline). */
export const ARC_PURPOSE_WORDS = 20;
const PURPOSE = 240;

/** The three ways a player may ask for the next arc (S/story/arcs #1983 M2). */
export const ARC_CHOICES = ["continue", "breathe", "newcomer"] as const;

/** How many arcs a run may hold (each is 8–12 chapters, so this is far beyond any played story). */
export const ARCS_MAX = 40;

const text = (max = 600) => z.string().max(max);

const PlanEntrySchema: ZodType<StoryArc["plan"][number]> = z.object({
  n: z.number().int().min(1),
  purpose: text(PURPOSE),
});

const RevealSchema: ZodType<StoryArc["reveals"][number]> = z.object({
  n: z.number().int().min(1),
  kind: z.enum(["piece", "truth"]),
  li: z.string().max(120).optional(),
  what: text(),
});

const AntagonistSchema: ZodType<NonNullable<StoryArc["antagonist"]>> = z.object({
  name: text(200),
  want: text(400),
  whyNow: text(400),
});

/** A stored arc, or null when it has no valid number (a damaged arc is never played on). */
export function normalizeArc(data: unknown): StoryArc | null {
  if (!isRecord(data)) return null;
  const number = typeof data.number === "number" ? Math.trunc(data.number) : 0;
  if (!Number.isInteger(number) || number < 1 || number > ARCS_MAX) return null;
  const arc = readFields<StoryArc>(
    {
      version: z.number().int().min(1),
      number: z.number().int().min(1).max(ARCS_MAX),
      kind: z.enum(["story", "breathing"]),
      label: text(200),
      theme: text(400),
      goal: text(600),
      from: z.number().int().min(1),
      endsAt: z.number().int().min(1),
      plan: (value) => validItems(PlanEntrySchema, value, ARC_LENGTH_MAX),
      endsWith: z.object({ n: z.number().int().min(1), what: text(600) }).nullable(),
      reveals: (value) => validItems(RevealSchema, value, ARC_LENGTH_MAX),
      antagonist: (value) => (AntagonistSchema.safeParse(value).success ? (value as StoryArc["antagonist"]) : null),
      choice: (value) =>
        isRecord(value) && ARC_CHOICES.includes(value.kind as StoryArc["choice"]["kind"])
          ? ({ kind: value.kind as StoryArc["choice"]["kind"] } as StoryArc["choice"])
          : ({ kind: "continue" } as StoryArc["choice"]),
      newcomer: (value) =>
        isRecord(value) && typeof value.li === "string"
          ? { li: value.li, how: typeof value.how === "string" ? value.how.slice(0, 600) : "" }
          : null,
      plannedAt: z.string(),
      connectionId: z.string(),
    },
    () => ({
      version: 1,
      number,
      kind: "story",
      label: "",
      theme: "",
      goal: "",
      from: 1,
      endsAt: 1,
      plan: [],
      endsWith: null,
      reveals: [],
      antagonist: null,
      newcomer: null,
      choice: { kind: "continue" },
      plannedAt: "",
      connectionId: "",
    }),
    data,
  );
  if (!arc.plan.length) return null;
  // The ending follows from the plan, whatever a damaged document says.
  arc.endsAt = arc.from + arc.plan.length - 1;
  // A reveal outside the arc, or out of order, is dropped rather than played early or late.
  arc.reveals = arc.reveals
    .filter((reveal) => reveal.n >= arc.from && reveal.n <= arc.endsAt && reveal.what)
    .sort((a, b) => a.n - b.n);
  // A breathing arc neither advances nor replaces the mystery.
  if (arc.kind === "breathing") {
    arc.reveals = [];
    arc.endsWith = null;
    arc.antagonist = null;
    arc.newcomer = null;
  }
  if (arc.kind === "story" && !arc.endsWith) arc.endsWith = { n: arc.endsAt, what: arc.goal };
  if (!arc.label.trim()) arc.label = String(arc.number);
  return arc;
}

export interface ArcPlanReply {
  kind: "story" | "breathing";
  label: string;
  theme: string;
  goal: string;
  /** One short sentence each, in play order; the server stamps the chapter numbers. */
  chapters: string[];
  /** How the arc ends, as one short sentence, and its 1-based position in `chapters` (0: the last). */
  endsWith: { what: string; chapter?: number | null };
  /** A piece or the truth, with the 1-based position of the chapter that reveals it. */
  reveals: Array<{ chapter: number; kind: "piece" | "truth"; li?: string | null; what: string }>;
  antagonist: { name: string; want: string; whyNow: string } | null;
  /** When a newcomer arrives, the one sentence naming the scene they are met in. */
  newcomer?: { how: string } | null;
}

export const ArcPlanSchema = z.object({
  kind: z.enum(["story", "breathing"]),
  label: text(200).min(1),
  theme: text(400),
  goal: text(600).min(1),
  chapters: z.array(text(PURPOSE).min(1)).min(1).max(24),
  endsWith: z.object({ what: text(600), chapter: z.number().int().nullable().optional() }).nullable(),
  reveals: z
    .array(
      z.object({
        chapter: z.number().int().min(1).max(24),
        kind: z.enum(["piece", "truth"]),
        li: text(120).nullable().optional(),
        what: text().min(1),
      }),
    )
    .max(24),
  antagonist: z.object({ name: text(200).min(1), want: text(400), whyNow: text(400) }).nullable(),
  newcomer: z
    .object({ how: text(600) })
    .nullable()
    .optional(),
});

/** The words a string holds (the purpose cap, the same counting the pack's prompts use). */
export function wordCountOf(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

export interface ArcPlanContext {
  number: number;
  from: number;
  /** Resolves a love interest named by id or exact name, or null. */
  resolveLi: (value: unknown) => string | null;
  /** The pieces already revealed earlier in the run, by love interest. */
  revealed: ReadonlySet<string>;
  /** The truth was already told: a new arc schedules no truth. */
  truthTold: boolean;
  /** The newcomer this arc brings in (#1983 M3), when the player asked for one. */
  newcomer?: { id: LiId; how?: string } | null;
  /** How the player asked for this arc. */
  choice?: StoryArc["choice"]["kind"];
}

/**
 * The reply as an arc, or the first rule it breaks (the repair turn names it). The whole schedule is stamped here: the
 * model's 1-based positions become chapter numbers, and nothing it wrote as a number survives.
 */
export function normalizeArcPlan(reply: z.infer<typeof ArcPlanSchema>, context: ArcPlanContext): StoryArc | string {
  // The player's choice decides the kind: breathing room is a breathing arc whatever the model wrote, and the story
  // going on (or someone new) is a story arc.
  const kind = context.choice === "breathe" ? "breathing" : context.choice ? "story" : reply.kind;
  const chapters = reply.chapters.map((purpose) => purpose.trim()).filter(Boolean);
  const count = chapters.length;
  const [min, max] =
    kind === "breathing" ? [BREATHING_LENGTH_MIN, BREATHING_LENGTH_MAX] : [ARC_LENGTH_MIN, ARC_LENGTH_MAX];
  if (count < min || count > max) return `a ${kind} arc needs ${min} to ${max} chapters, not ${count}`;
  const endsAt = context.from + count - 1;
  const long = chapters.findIndex((purpose) => wordCountOf(purpose) > ARC_PURPOSE_WORDS);
  if (!reply.label.trim()) return "the arc needs a short label the player will see";
  if (long >= 0) return `chapter purposes must be ${ARC_PURPOSE_WORDS} words or fewer (chapter ${context.from + long})`;
  const from = context.from;

  const plan = chapters.map((purpose, index) => ({ n: from + index, purpose }));

  const how = (reply.newcomer?.how ?? "").trim();
  if (context.newcomer && !how) return "say how the newcomer meets the protagonist, in one sentence (newcomer.how)";
  if (kind === "breathing") {
    if (reply.reveals.length) return "a breathing arc reveals nothing: leave reveals empty";
    if (reply.antagonist) return "a breathing arc has no antagonist";
    return {
      version: 1,
      number: context.number,
      kind,
      label: reply.label.trim(),
      theme: reply.theme.trim(),
      goal: reply.goal.trim(),
      from,
      endsAt,
      plan,
      endsWith: null,
      reveals: [],
      antagonist: null,
      newcomer: null,
      choice: { kind: context.choice ?? "continue" },
      plannedAt: "",
      connectionId: "",
    };
  }

  // Story arc: one ending, scheduled reveals in order, no repeat, nothing before its chapter, at most one per chapter.
  // The big event is always the arc's last chapter (chapters.ts carries it there), so its position is not the model's.
  const endsWith = reply.endsWith?.what.trim() ? { n: endsAt, what: reply.endsWith.what.trim() } : null;
  if (!endsWith) return "a story arc needs endsWith: how the arc ends, in one sentence";
  const reveals: StoryArc["reveals"] = [];
  const seenChapters = new Set<number>();
  const scheduled = new Set<LiId>();
  let sawTruth = false;
  for (const reveal of [...reply.reveals].sort((a, b) => a.chapter - b.chapter)) {
    const n = from + reveal.chapter - 1;
    if (reveal.chapter > count)
      return `a reveal is scheduled past the arc's last chapter (in chapter ${reveal.chapter})`;
    if (seenChapters.has(n)) return `chapter ${n} is scheduled to reveal twice; one reveal per chapter`;
    seenChapters.add(n);
    if (reveal.kind === "truth") {
      if (context.truthTold) return "the mystery's truth was already told: a new arc cannot reveal it again";
      if (sawTruth) return "the truth is revealed once per arc";
      sawTruth = true;
      reveals.push({ n, kind: "truth", what: reveal.what.trim() });
      continue;
    }
    const li = context.resolveLi(reveal.li);
    if (!li) return `a piece reveal must name one of the cast (got ${JSON.stringify(reveal.li ?? null)})`;
    if (context.revealed.has(li)) return `${li}'s piece of the mystery was already revealed; schedule another piece`;
    // A love interest holds one piece: scheduling it twice in the same arc would ask two chapters to say it once.
    if (scheduled.has(li)) return `${li}'s piece is already scheduled in this arc`;
    scheduled.add(li);
    reveals.push({ n, kind: "piece", li, what: reveal.what.trim() });
  }
  // The truth comes after every piece this arc schedules, and the arc ends with it when it reveals it at all.
  const truthAt = reveals.find((reveal) => reveal.kind === "truth")?.n;
  if (truthAt !== undefined) {
    const late = reveals.find((reveal) => reveal.kind === "piece" && reveal.n > truthAt);
    if (late) return "the truth is revealed before one of the pieces; schedule the pieces first";
    if (truthAt !== endsAt) return "the truth is revealed in the arc's last chapter";
  }
  return {
    version: 1,
    number: context.number,
    kind,
    label: reply.label.trim(),
    theme: reply.theme.trim(),
    goal: reply.goal.trim(),
    from,
    endsAt,
    plan,
    endsWith,
    reveals,
    antagonist: reply.antagonist
      ? {
          name: reply.antagonist.name.trim(),
          want: reply.antagonist.want.trim(),
          whyNow: reply.antagonist.whyNow.trim(),
        }
      : null,
    newcomer: context.newcomer ? { li: context.newcomer.id, how } : null,
    choice: { kind: context.choice ?? "continue" },
    plannedAt: "",
    connectionId: "",
  };
}

/** An arc's own mystery text: its scheduled reveal in chapter `n`, or undefined. */
export function revealAt(arc: StoryArc, n: number): StoryArc["reveals"][number] | undefined {
  return arc.reveals.find((reveal) => reveal.n === n);
}

/** The arc as a player sees it: never its goal, plan, ending, antagonist, reveals or any hidden text. */
export function toArcView(arc: StoryArc, read: number): StoryArcView {
  return {
    number: arc.number,
    kind: arc.kind,
    label: arc.label,
    from: arc.from,
    endsAt: arc.endsAt,
    read: Math.max(0, Math.min(read, arc.plan.length)),
    done: read >= arc.plan.length,
  };
}
