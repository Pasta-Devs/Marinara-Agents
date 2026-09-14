import { z } from "zod";

export const SLURP_MODEL_JOB_KINDS = [
  "dm_reply",
  "rewrite",
  "thread",
  "brief",
  "bank_grow",
  "arc",
  "schedule",
  "fan_type_voice",
] as const;
export type SlurpModelJobKind = (typeof SLURP_MODEL_JOB_KINDS)[number];
export type SlurpModelWorkerContext = "present" | "background";

const jobPolicy = (priority: number, maxPerDay: number) =>
  z
    .object({
      enabled: z.boolean().default(true),
      priority: z.number().int().min(1).max(10).default(priority),
      maxPerDay: z.number().int().min(0).max(500).default(maxPerDay),
    })
    .default({ enabled: true, priority, maxPerDay });

export const slurpModelBudgetSchema = z
  .object({
    mode: z.enum(["off", "present", "background"]).default("present"),
    connectionId: z.string().trim().min(1).nullable().default(null),
    callsPerHour: z.number().int().min(0).max(100).default(4),
    callsPerDay: z.number().int().min(0).max(500).default(20),
    jobs: z
      .object({
        dm_reply: jobPolicy(1, 40),
        rewrite: jobPolicy(2, 12),
        thread: jobPolicy(3, 6),
        brief: jobPolicy(4, 6),
        bank_grow: jobPolicy(5, 2),
        arc: jobPolicy(6, 2),
        schedule: jobPolicy(6, 2),
        fan_type_voice: jobPolicy(7, 10),
      })
      .default({}),
  })
  .default({});

export type SlurpModelBudget = z.infer<typeof slurpModelBudgetSchema>;

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

export function spendSlurpModelBudget(
  budget: SlurpModelBudget,
  ledger: SlurpModelBudgetLedger,
  kind: SlurpModelJobKind,
): SlurpModelBudgetLedger | null {
  const policy = budget.jobs[kind];
  const kindCalls = ledger.byKindToday[kind] ?? 0;
  if (
    !policy.enabled ||
    budget.callsPerHour <= ledger.callsThisHour ||
    budget.callsPerDay <= ledger.callsToday ||
    policy.maxPerDay <= kindCalls
  )
    return null;
  return {
    ...ledger,
    callsThisHour: ledger.callsThisHour + 1,
    callsToday: ledger.callsToday + 1,
    byKindToday: { ...ledger.byKindToday, [kind]: kindCalls + 1 },
  };
}
