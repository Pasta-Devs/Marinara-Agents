import { z } from "zod";
import { slpFilledDefault } from "./slp-schema-defaults.js";

export const SLURP_MODEL_JOB_KINDS = [
  "dm_reply",
  "rewrite",
  "thread",
  "brief",
  "bank_grow",
  "arc",
  "schedule",
  "fan_type_voice",
  "continuity",
  "assist",
  "image_prompt",
  "plan",
  "page",
] as const;
export type SlurpModelJobKind = (typeof SLURP_MODEL_JOB_KINDS)[number];
/**
 * The kinds the world spends on its own (0.3.6). `assist`, `fan_type_voice` and `schedule` only ever run
 * when the player presses a button, so they never touch the budget and have no row in Settings.
 */
export const SLURP_WORLD_JOB_KINDS = SLURP_MODEL_JOB_KINDS.filter(
  (kind) => kind !== "assist" && kind !== "fan_type_voice" && kind !== "schedule",
);
export type SlurpModelWorkerContext = "present" | "background";

const jobPolicy = (priority: number, maxPerDay: number) =>
  z
    .object({
      enabled: z.boolean().default(true),
      priority: z.number().int().min(1).max(10).default(priority),
      maxPerDay: z.number().int().min(0).max(500).default(maxPerDay),
    })
    .default({ enabled: true, priority, maxPerDay });

/**
 * What each limit is sized for (task F, SIM-REPORT "Budget sizing": a normal day measured with 8 Creators,
 * + 25 % headroom): `base + perCreator × active Creators`, rounded up. A limit the player never set follows
 * this as Creators come and go; a limit they set stays theirs (`customLimits`). A job kind missing here
 * (for example Stir's "plan" row) keeps its schema default and is never sized.
 */
export const SLURP_MODEL_BUDGET_SIZING = {
  callsPerHour: { base: 6, perCreator: 1 },
  callsPerDay: { base: 40, perCreator: 6 },
  jobs: {
    // Messages a Creator sends on their own (openers, follow-ups, late replies). The player's own sends are never capped.
    dm_reply: { base: 15, perCreator: 2 },
    rewrite: { base: 3, perCreator: 1.25 },
    thread: { base: 8, perCreator: 0.6 },
    brief: { base: 2, perCreator: 0.25 },
    bank_grow: { base: 5, perCreator: 0.6 },
    arc: { base: 2, perCreator: 0.25 },
    schedule: { base: 2, perCreator: 0.25 },
    fan_type_voice: { base: 10, perCreator: 0 },
    continuity: { base: 4, perCreator: 0.6 },
    assist: { base: 40, perCreator: 0 },
    // One rewrite per picture: posts, DM pictures and ad pictures. Never below the 60 it shipped with.
    image_prompt: { base: 60, perCreator: 2 },
    // Creator Pages: a player's "Let <Creator> design it" taps plus the rare page refresh after big news.
    page: { base: 4, perCreator: 0.25 },
  } as Partial<Record<SlurpModelJobKind, { base: number; perCreator: number }>>,
} as const;

/** The limits a player can own: the two shared caps and each job's daily limit (by job kind). */
export type SlurpModelBudgetLimit = "callsPerHour" | "callsPerDay" | SlurpModelJobKind;

/** The fixed defaults before task F. A saved budget from then keeps only the limits that differ from these. */
const SLURP_MODEL_BUDGET_LEGACY_DEFAULTS: Record<string, number> = {
  callsPerHour: 4,
  callsPerDay: 20,
  dm_reply: 40,
  rewrite: 12,
  thread: 8,
  brief: 6,
  bank_grow: 2,
  arc: 2,
  schedule: 2,
  fan_type_voice: 10,
  continuity: 12,
  assist: 40,
  image_prompt: 60,
};

const sized = ({ base, perCreator }: { base: number; perCreator: number }, creators: number) =>
  Math.ceil(base + perCreator * Math.max(0, Math.floor(creators)));

/**
 * A budget saved before task F has no `customLimits`. Only the limits the player changed from the old
 * fixed defaults are theirs; every untouched one moves to the new sizing, and the player gets a one-time
 * note (`raisedNotice`) that the defaults went up.
 */
function migrateSlurpModelBudget(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if ("customLimits" in record || Object.keys(record).length === 0) return raw;
  const jobs = (record.jobs && typeof record.jobs === "object" ? record.jobs : {}) as Record<string, unknown>;
  const valueOf = (limit: string): unknown =>
    limit === "callsPerHour" || limit === "callsPerDay"
      ? record[limit]
      : (jobs[limit] as { maxPerDay?: unknown } | undefined)?.maxPerDay;
  const customLimits = Object.entries(SLURP_MODEL_BUDGET_LEGACY_DEFAULTS)
    .filter(([limit, legacy]) => typeof valueOf(limit) === "number" && valueOf(limit) !== legacy)
    .map(([limit]) => limit);
  return { ...record, customLimits, raisedNotice: true };
}

export const slurpModelBudgetSchema = slpFilledDefault(
  z.preprocess(
    migrateSlurpModelBudget,
    z.object({
      mode: z.enum(["off", "present", "background"]).default("present"),
      connectionId: z.string().trim().min(1).nullable().default(null),
      // The numbers below are the sizing for no Creators; `resolveSlurpModelBudget` sizes them for the real count.
      callsPerHour: z.number().int().min(0).max(100).default(6),
      callsPerDay: z.number().int().min(0).max(500).default(40),
      jobs: slpFilledDefault(
        z.object({
          dm_reply: jobPolicy(1, 15),
          rewrite: jobPolicy(2, 3),
          // Sized so the shipped audience is not capped below its "Runs per day" (R1-104).
          thread: jobPolicy(3, 8),
          brief: jobPolicy(4, 2),
          bank_grow: jobPolicy(5, 5),
          arc: jobPolicy(6, 2),
          schedule: jobPolicy(6, 2),
          fan_type_voice: jobPolicy(7, 10),
          // Reads new message batches for Creator statements. Lowest priority: nothing waits on it.
          continuity: jobPolicy(8, 4),
          // The player's own Write / Improve taps (AI assist). Present work, never paced.
          assist: jobPolicy(2, 40),
          // "Enhance image prompts": one rewrite per picture. Its own daily limit only (see below).
          image_prompt: jobPolicy(3, 60),
          // Stir (W): "What should we stir up?" turns the player's words into a plan. Present work, never
          // paced. Flat like writing help (the player's own taps, not the world), so no sizing entry.
          plan: jobPolicy(2, 20),
          // Creator Pages (design and refresh). Low priority: a page can wait for a quiet hour.
          page: jobPolicy(7, 4),
        }),
      ),
      /** Limits the player set by hand. Every other limit follows the number of active Creators. */
      customLimits: z.array(z.string()).default([]),
      /** Set once when an older budget moved to the sized defaults; Pulse tells the player, then clears it. */
      raisedNotice: z.boolean().default(false),
    }),
  ),
);

export type SlurpModelBudget = z.infer<typeof slurpModelBudgetSchema>;

/** The budget as it applies with `creators` active Creators: every limit the player did not set is sized. */
export function resolveSlurpModelBudget(budget: SlurpModelBudget, creators: number): SlurpModelBudget {
  const custom = new Set(budget.customLimits);
  const cap = (limit: "callsPerHour" | "callsPerDay", max: number) =>
    custom.has(limit) ? budget[limit] : Math.min(max, sized(SLURP_MODEL_BUDGET_SIZING[limit], creators));
  const jobs = { ...budget.jobs };
  for (const kind of SLURP_MODEL_JOB_KINDS) {
    const sizing = SLURP_MODEL_BUDGET_SIZING.jobs[kind];
    if (sizing && !custom.has(kind)) jobs[kind] = { ...jobs[kind], maxPerDay: Math.min(500, sized(sizing, creators)) };
  }
  return { ...budget, callsPerHour: cap("callsPerHour", 100), callsPerDay: cap("callsPerDay", 500), jobs };
}

/** The player sets one limit by hand: it keeps that value from now on, whatever the Creator count. */
export function setSlurpModelBudgetLimit(
  budget: SlurpModelBudget,
  limit: SlurpModelBudgetLimit,
  value: number,
): SlurpModelBudget {
  const customLimits = budget.customLimits.includes(limit) ? budget.customLimits : [...budget.customLimits, limit];
  return limit === "callsPerHour" || limit === "callsPerDay"
    ? { ...budget, [limit]: value, customLimits }
    : { ...budget, jobs: { ...budget.jobs, [limit]: { ...budget.jobs[limit], maxPerDay: value } }, customLimits };
}

export type SlurpModelBudgetLedger = {
  hour: string;
  day: string;
  callsThisHour: number;
  callsToday: number;
  byKindToday: Partial<Record<SlurpModelJobKind, number>>;
};

const hourKey = (at: Date) => at.toISOString().slice(0, 13);
const dayKey = (at: Date) => at.toISOString().slice(0, 10);

export function readSlurpModelBudgetLedger(raw: string | null | undefined, at = new Date()): SlurpModelBudgetLedger {
  let parsed: Partial<SlurpModelBudgetLedger> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as Partial<SlurpModelBudgetLedger>) : {};
  } catch {
    parsed = {};
  }
  // A hand-edited or corrupt counter must read as zero, never as NaN that passes every limit.
  const count = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const sameDay = parsed.day === dayKey(at);
  const sameHour = sameDay && parsed.hour === hourKey(at);
  return {
    hour: hourKey(at),
    day: dayKey(at),
    callsThisHour: sameHour ? count(parsed.callsThisHour) : 0,
    callsToday: sameDay ? count(parsed.callsToday) : 0,
    byKindToday:
      sameDay && parsed.byKindToday && typeof parsed.byKindToday === "object"
        ? (Object.fromEntries(
            Object.entries(parsed.byKindToday).map(([kind, value]) => [kind, count(value)]),
          ) as SlurpModelBudgetLedger["byKindToday"])
        : {},
  };
}

export function slurpModelWorkerAllows(budget: SlurpModelBudget, context: SlurpModelWorkerContext): boolean {
  return budget.mode !== "off" && (context === "present" || budget.mode === "background");
}

/**
 * A quarter of every cap is held back for replies to the player. Priority only ordered the queue,
 * so background continuity and rewrites could spend the whole day and a player's message waited
 * until midnight UTC for an answer.
 */
export function slurpModelBudgetCap(cap: number, kind: SlurpModelJobKind): number {
  return kind === "dm_reply" ? cap : cap - Math.floor(cap / 4);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure world upkeep: always paced over the day (nothing the player pressed waits on these). */
export const SLURP_UPKEEP_JOB_KINDS: ReadonlySet<SlurpModelJobKind> = new Set([
  "rewrite",
  "brief",
  "bank_grow",
  "continuity",
]);

/**
 * How much of a daily cap world upkeep may have used by `at` (user, fix phase 1b): the day's calls are
 * spread evenly over the whole (UTC ledger) day, so the budget is reached by the evening instead of
 * being spent in the first hour and then leaving the world quiet until midnight. One hour of headroom
 * lets the first call of the day through; allowance a quiet morning did not use carries over.
 */
export function slurpModelBudgetPacedCap(cap: number, at: Date): number {
  const dayStart = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const elapsed = Math.min(1, (at.getTime() - dayStart) / DAY_MS);
  return Math.min(cap, Math.ceil(cap * elapsed + cap / 24));
}

/**
 * Kinds that count only against their own daily limit. A picture's prompt rewrite runs once per
 * picture and never ran under the text budget; on the shared 20 calls a day it would take the
 * replies' share, so it gets a row of its own that counts and caps it without touching the rest.
 */
export const SLURP_OWN_CAP_JOB_KINDS: ReadonlySet<SlurpModelJobKind> = new Set(["image_prompt"]);

export function spendSlurpModelBudget(
  budget: SlurpModelBudget,
  ledger: SlurpModelBudgetLedger,
  kind: SlurpModelJobKind,
  /** Set for world upkeep (see `SLURP_UPKEEP_JOB_KINDS`, written audience replies, background storylines). */
  pacedAt?: Date,
): SlurpModelBudgetLedger | null {
  const policy = budget.jobs[kind];
  const kindCalls = ledger.byKindToday[kind] ?? 0;
  if (SLURP_OWN_CAP_JOB_KINDS.has(kind)) {
    // Its own limit, but still Slurp's AI: the budget mode "Off" stops it too (user, V).
    if (budget.mode === "off" || !policy.enabled || policy.maxPerDay <= kindCalls) return null;
    return { ...ledger, byKindToday: { ...ledger.byKindToday, [kind]: kindCalls + 1 } };
  }
  const dayCap = slurpModelBudgetCap(budget.callsPerDay, kind);
  if (
    !policy.enabled ||
    slurpModelBudgetCap(budget.callsPerHour, kind) <= ledger.callsThisHour ||
    dayCap <= ledger.callsToday ||
    policy.maxPerDay <= kindCalls ||
    (pacedAt &&
      (slurpModelBudgetPacedCap(dayCap, pacedAt) <= ledger.callsToday ||
        slurpModelBudgetPacedCap(policy.maxPerDay, pacedAt) <= kindCalls))
  )
    return null;
  return {
    ...ledger,
    callsThisHour: ledger.callsThisHour + 1,
    callsToday: ledger.callsToday + 1,
    byKindToday: { ...ledger.byKindToday, [kind]: kindCalls + 1 },
  };
}

/** When a temporary cap opens again. `null` means the job is disabled until settings change. */
export function slurpModelBudgetRetryAt(
  budget: SlurpModelBudget,
  ledger: SlurpModelBudgetLedger,
  kind: SlurpModelJobKind,
  at = new Date(),
): string | null {
  const policy = budget.jobs[kind];
  if (!policy.enabled || budget.callsPerHour === 0 || budget.callsPerDay === 0 || policy.maxPerDay === 0) return null;
  if (
    ledger.callsToday >= slurpModelBudgetCap(budget.callsPerDay, kind) ||
    (ledger.byKindToday[kind] ?? 0) >= policy.maxPerDay
  ) {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1)).toISOString();
  }
  if (ledger.callsThisHour >= slurpModelBudgetCap(budget.callsPerHour, kind)) {
    return new Date(
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), at.getUTCHours() + 1),
    ).toISOString();
  }
  // Another in-process claim may have won between the read and reservation. Retry soon without
  // treating ordinary budget contention as a provider failure.
  return new Date(at.getTime() + 60_000).toISOString();
}

// ponytail: one flat guess for prompt + answer tokens per call; measure real calls if the hint needs to be exact.
export const SLURP_TOKENS_PER_CALL_ESTIMATE = 3000;

/**
 * "Posts per day" grows with the Creators too (user decision on F): 2 + 1.9 per active Creator, the
 * sim's sizing (17 at 8 Creators), never below the old default 4 (orchestrator, 2026-09-29) and at
 * most the setting's 96. A number the player set stays theirs, low or not.
 */
export const SLURP_SIZED_POSTS_PER_DAY_MIN = 4;
export function slurpSizedPostsPerDay(activeCreators: number): number {
  return Math.min(96, Math.max(SLURP_SIZED_POSTS_PER_DAY_MIN, Math.round(2 + 1.9 * Math.max(0, activeCreators))));
}

/**
 * Whether a stored "Posts per day" is the player's. Settings saved before it grew with the Creators
 * carry no flag: a number other than the shipped 4 was set by hand, the shipped 4 grows.
 */
export function slurpPostsPerDayIsCustom(stored: { postsPerDay?: unknown; postsPerDayCustom?: unknown }): boolean {
  if (typeof stored.postsPerDayCustom === "boolean") return stored.postsPerDayCustom;
  return stored.postsPerDay !== undefined && stored.postsPerDay !== 4;
}

/**
 * What a sized budget means in a day, for the plain-words summary in Settings: the most the world may
 * write on its own, plus the posts (1 text call + 1 picture prompt rewrite + 1 picture each, outside
 * the shared caps). Replies to the player's own messages are never counted: they are never capped.
 */
export function slurpModelBudgetOutlook(budget: SlurpModelBudget, postsPerDay: number) {
  const on = budget.mode !== "off";
  const limit = (kind: SlurpModelJobKind) =>
    on && budget.jobs[kind].enabled ? Math.min(budget.jobs[kind].maxPerDay, budget.callsPerDay) : 0;
  const pictureRewrites = budget.jobs.image_prompt.enabled
    ? Math.min(postsPerDay, budget.jobs.image_prompt.maxPerDay)
    : 0;
  const textCalls = (on ? budget.callsPerDay : 0) + postsPerDay + pictureRewrites;
  return {
    posts: postsPerDay,
    creatorMessages: limit("dm_reply"),
    threads: limit("thread"),
    fanMessages: limit("rewrite"),
    textCalls,
    pictures: postsPerDay,
    tokens: textCalls * SLURP_TOKENS_PER_CALL_ESTIMATE,
  };
}
