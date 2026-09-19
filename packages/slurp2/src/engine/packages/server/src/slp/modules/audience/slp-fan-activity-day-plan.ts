import type { SlpAuthorSnapshot } from "../../../../../shared/src/slp/slp-social.types.js";

export const SLP_FAN_ACTIVITY_DAY_PLAN_VERSION = 1 as const;
export const SLP_FAN_ACTIVITY_RUNS_PER_DAY = 8 as const;
export const SLP_FAN_ACTIVITY_MAX_RUNS_PER_DAY = 96 as const;
export const SLP_FAN_ACTIVITY_MAX_MANUAL_RUNS = 24 as const;
export const NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN = 12 as const;
export const NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR = 4 as const;

export type SlpFanActivityRunStatus = "scheduled" | "generating" | "applying" | "completed" | "skipped" | "abandoned";

export interface SlpFanAcceptedActivity {
  id: string;
  creatorId: string;
  type: string;
  targetPostId: string;
  content: string | null;
  /** The comment this one answers. Null when it answers the post itself. */
  parentInteractionId: string | null;
  actorId: string;
  snapshot: SlpAuthorSnapshot;
  applied: boolean;
}

export interface SlpFanActivityDayPlanRun {
  id: string;
  scheduledAt: string;
  creatorIds: string[];
  status: SlpFanActivityRunStatus;
  acceptedActivities: SlpFanAcceptedActivity[];
  claimedAt: string | null;
  finishedAt: string | null;
  manual?: boolean;
}

export interface PersistedSlpFanActivityDayPlan {
  version: typeof SLP_FAN_ACTIVITY_DAY_PLAN_VERSION;
  localDate: string;
  timezone: string;
  runs: SlpFanActivityDayPlanRun[];
  nextCreatorOffset: number;
}

export interface SlpFanActivityToStore {
  creatorId: string;
  type: string;
  targetPostId: string;
  content?: string | null;
  /** The comment this one answers, when it answers one rather than the post. */
  parentInteractionId?: string | null;
  actorId: string;
  snapshot: SlpAuthorSnapshot;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isStatus(value: unknown): value is SlpFanActivityRunStatus {
  return (
    value === "scheduled" ||
    value === "generating" ||
    value === "applying" ||
    value === "completed" ||
    value === "skipped" ||
    value === "abandoned"
  );
}

function localDate(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

function timezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

function creatorList(creatorIds: string[]): string[] {
  return [...new Set(creatorIds.filter((id) => typeof id === "string" && id.length > 0))].sort();
}

function validAuthorSnapshot(value: unknown): value is SlpAuthorSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (row.kind === "persona" || row.kind === "character" || row.kind === "random_user") &&
    typeof row.entityId === "string" &&
    typeof row.handle === "string" &&
    typeof row.displayName === "string" &&
    (row.avatarUrl === null || typeof row.avatarUrl === "string") &&
    (row.avatarCrop === null || (typeof row.avatarCrop === "object" && !Array.isArray(row.avatarCrop)))
  );
}

function validActivity(value: unknown): value is SlpFanAcceptedActivity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.creatorId === "string" &&
    (row.type === "like" || row.type === "reply") &&
    typeof row.targetPostId === "string" &&
    typeof row.actorId === "string" &&
    (row.content === null || typeof row.content === "string") &&
    (row.parentInteractionId === null ||
      row.parentInteractionId === undefined ||
      typeof row.parentInteractionId === "string") &&
    typeof row.applied === "boolean" &&
    validAuthorSnapshot(row.snapshot)
  );
}

function validRun(value: unknown): value is SlpFanActivityDayPlanRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    isTimestamp(row.scheduledAt) &&
    Array.isArray(row.creatorIds) &&
    row.creatorIds.length <= NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN &&
    new Set(row.creatorIds).size === row.creatorIds.length &&
    row.creatorIds.every((id) => typeof id === "string") &&
    isStatus(row.status) &&
    Array.isArray(row.acceptedActivities) &&
    row.acceptedActivities.every(validActivity) &&
    (row.claimedAt === null || isTimestamp(row.claimedAt)) &&
    (row.finishedAt === null || isTimestamp(row.finishedAt))
  );
}

export function parsePersistedSlpFanActivityDayPlan(value: unknown): PersistedSlpFanActivityDayPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== SLP_FAN_ACTIVITY_DAY_PLAN_VERSION) return null;
  if (typeof row.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(row.localDate)) return null;
  if (typeof row.timezone !== "string" || !row.timezone || !Array.isArray(row.runs)) return null;
  const validRuns = row.runs.every(validRun);
  const manualRunCount = validRuns
    ? row.runs.filter((run) => (run as SlpFanActivityDayPlanRun).manual === true).length
    : 0;
  const automaticRunCount = validRuns ? row.runs.length - manualRunCount : 0;
  if (
    row.runs.length < 1 ||
    !validRuns ||
    automaticRunCount > SLP_FAN_ACTIVITY_MAX_RUNS_PER_DAY ||
    manualRunCount > SLP_FAN_ACTIVITY_MAX_MANUAL_RUNS
  ) {
    return null;
  }
  if (
    typeof row.nextCreatorOffset !== "number" ||
    !Number.isInteger(row.nextCreatorOffset) ||
    row.nextCreatorOffset < 0
  ) {
    return null;
  }
  return {
    version: SLP_FAN_ACTIVITY_DAY_PLAN_VERSION,
    localDate: row.localDate,
    timezone: row.timezone,
    runs: row.runs,
    nextCreatorOffset: row.nextCreatorOffset,
  };
}

function scheduledRuns(at: Date, runsPerDay: number = SLP_FAN_ACTIVITY_RUNS_PER_DAY): SlpFanActivityDayPlanRun[] {
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  return Array.from({ length: runsPerDay }, (_, index) => ({
    id: `${localDate(at)}-run-${index + 1}`,
    scheduledAt: new Date(start.getTime() + (index * 24 * 60 * 60 * 1000) / runsPerDay).toISOString(),
    creatorIds: [],
    status: "scheduled" as const,
    acceptedActivities: [],
    claimedAt: null,
    finishedAt: null,
    manual: false,
  }));
}

export function reconcileSlpFanActivityDayPlan(
  current: PersistedSlpFanActivityDayPlan | null,
  creatorIds: string[],
  at: Date,
  runsPerDay: number = SLP_FAN_ACTIVITY_RUNS_PER_DAY,
): PersistedSlpFanActivityDayPlan {
  const date = localDate(at);
  const zone = timezone();
  if (current?.localDate === date && current.timezone === zone) {
    const targetRuns = Math.max(1, Math.min(SLP_FAN_ACTIVITY_MAX_RUNS_PER_DAY, runsPerDay));
    const manualRuns = current.runs.filter((run) => run.manual);
    const automaticRuns = current.runs.filter((run) => !run.manual);
    const usedRuns = automaticRuns.filter((run) => run.status !== "scheduled");
    const scheduledRunsById = new Map(
      automaticRuns.filter((run) => run.status === "scheduled").map((run) => [run.id, run]),
    );
    const retainedScheduledRuns = [...scheduledRunsById.values()].slice(0, Math.max(0, targetRuns - usedRuns.length));
    const retainedIds = new Set([...usedRuns, ...retainedScheduledRuns].map((run) => run.id));
    const addedRuns = scheduledRuns(at, targetRuns)
      .filter((run) => !retainedIds.has(run.id))
      .slice(0, Math.max(0, targetRuns - usedRuns.length - retainedScheduledRuns.length));
    const creators = creatorList(creatorIds);
    let offset = creators.length === 0 ? 0 : current.nextCreatorOffset % creators.length;
    for (const run of addedRuns) {
      const count = Math.min(NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN, creators.length);
      run.creatorIds = Array.from({ length: count }, (_, index) => creators[(offset + index) % creators.length]!);
      offset = creators.length === 0 ? 0 : (offset + count) % creators.length;
    }
    return reconcileOverdueSlpFanActivityRuns(
      {
        ...current,
        runs: [...usedRuns, ...retainedScheduledRuns, ...addedRuns, ...manualRuns],
        nextCreatorOffset: offset,
      },
      at,
    );
  }

  const creators = creatorList(creatorIds);
  const runs = scheduledRuns(at, Math.max(1, Math.min(SLP_FAN_ACTIVITY_MAX_RUNS_PER_DAY, runsPerDay)));
  let offset = creators.length === 0 ? 0 : (current?.nextCreatorOffset ?? 0) % creators.length;
  for (const run of runs) {
    const count = Math.min(NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN, creators.length);
    run.creatorIds = Array.from({ length: count }, (_, index) => creators[(offset + index) % creators.length]!);
    offset = creators.length === 0 ? 0 : (offset + count) % creators.length;
  }
  return {
    version: SLP_FAN_ACTIVITY_DAY_PLAN_VERSION,
    localDate: date,
    timezone: zone,
    runs,
    nextCreatorOffset: offset,
  };
}

function reconcileOverdueSlpFanActivityRuns(
  plan: PersistedSlpFanActivityDayPlan,
  at: Date,
): PersistedSlpFanActivityDayPlan {
  const due = dueScheduledRuns(plan, at);
  const newest = due.at(-1)?.id;
  if (!newest) return plan;
  return {
    ...plan,
    runs: plan.runs.map((run) =>
      run.status === "scheduled" && Date.parse(run.scheduledAt) <= at.getTime() && run.id !== newest
        ? { ...run, status: "skipped", finishedAt: at.toISOString() }
        : run,
    ),
  };
}

export function dueSlpFanActivityRun(plan: PersistedSlpFanActivityDayPlan, at: Date): SlpFanActivityDayPlanRun | null {
  return dueScheduledRuns(plan, at).at(-1) ?? null;
}

function dueScheduledRuns(plan: PersistedSlpFanActivityDayPlan, at: Date): SlpFanActivityDayPlanRun[] {
  return plan.runs
    .filter((run) => run.status === "scheduled" && Date.parse(run.scheduledAt) <= at.getTime())
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
}

export function claimSlpFanActivityRun(
  plan: PersistedSlpFanActivityDayPlan,
  runId: string,
  at: Date,
): PersistedSlpFanActivityDayPlan {
  const reconciled = reconcileOverdueSlpFanActivityRuns(plan, at);
  const run = reconciled.runs.find((candidate) => candidate.id === runId);
  if (!run || run.status !== "scheduled" || Date.parse(run.scheduledAt) > at.getTime()) {
    throw new Error("That Slurp fan activity run is not due or is no longer available.");
  }
  return {
    ...reconciled,
    runs: reconciled.runs.map((candidate) =>
      candidate.id === runId ? { ...candidate, status: "generating", claimedAt: at.toISOString() } : candidate,
    ),
  };
}

export function storeSlpFanAcceptedActivities(
  plan: PersistedSlpFanActivityDayPlan,
  runId: string,
  activities: SlpFanActivityToStore[],
): PersistedSlpFanActivityDayPlan {
  return {
    ...plan,
    runs: plan.runs.map((run) =>
      run.id !== runId
        ? run
        : {
            ...run,
            status: "applying",
            acceptedActivities: activities.map((activity) => ({
              id: `${runId}-${activity.creatorId}-${activity.targetPostId}-${activity.type}-${activity.actorId}`,
              creatorId: activity.creatorId,
              type: activity.type,
              targetPostId: activity.targetPostId,
              actorId: activity.actorId,
              content: activity.content ?? null,
              parentInteractionId: activity.parentInteractionId ?? null,
              snapshot: activity.snapshot,
              applied: false,
            })),
          },
    ),
  };
}

export function markSlpFanActivityApplied(
  plan: PersistedSlpFanActivityDayPlan,
  runId: string,
  activityId: string,
): PersistedSlpFanActivityDayPlan {
  return {
    ...plan,
    runs: plan.runs.map((run) =>
      run.id !== runId
        ? run
        : {
            ...run,
            acceptedActivities: run.acceptedActivities.map((activity) =>
              activity.id === activityId ? { ...activity, applied: true } : activity,
            ),
          },
    ),
  };
}

export function finishSlpFanActivityRun(
  plan: PersistedSlpFanActivityDayPlan,
  runId: string,
  status: "completed" | "skipped" | "abandoned",
  at: Date,
): PersistedSlpFanActivityDayPlan {
  if (status !== "completed" && status !== "skipped" && status !== "abandoned") {
    throw new Error("Invalid Slurp fan activity finish status.");
  }
  return {
    ...plan,
    runs: plan.runs.map((run) => (run.id === runId ? { ...run, status, finishedAt: at.toISOString() } : run)),
  };
}

export function nextAvailableSlpFanActivityRun(plan: PersistedSlpFanActivityDayPlan): SlpFanActivityDayPlanRun | null {
  return plan.runs.find((run) => run.status === "scheduled") ?? null;
}

export function claimManualSlpFanActivityRun(
  plan: PersistedSlpFanActivityDayPlan,
  at: Date,
): {
  plan: PersistedSlpFanActivityDayPlan;
  run: SlpFanActivityDayPlanRun;
} {
  const automaticRuns = plan.runs.filter((run) => !run.manual);
  const manualRuns = plan.runs.filter((run) => run.manual).slice(-(SLP_FAN_ACTIVITY_MAX_MANUAL_RUNS - 1));
  const run: SlpFanActivityDayPlanRun = {
    id: `${plan.localDate}-manual-${at.getTime()}`,
    scheduledAt: at.toISOString(),
    creatorIds: [...new Set(automaticRuns.flatMap((candidate) => candidate.creatorIds))].slice(
      0,
      NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN,
    ),
    status: "generating",
    acceptedActivities: [],
    claimedAt: at.toISOString(),
    finishedAt: null,
    manual: true,
  };
  return {
    plan: { ...plan, runs: [...automaticRuns, ...manualRuns, run] },
    run,
  };
}
