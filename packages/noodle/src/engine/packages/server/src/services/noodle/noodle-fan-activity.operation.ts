import type {
  NoodleAuthorSnapshot,
  NoodleSettings,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { eq } from "../../db/file-query.js";
import { noodlerFanActivityState } from "../../db/schema/noodle.js";
import { now } from "../../utils/id-generator.js";
import { tryBackgroundConnection } from "../generation/connection-admission.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import {
  claimManualNoodleFanActivityRun,
  claimNoodleFanActivityRun,
  dueNoodleFanActivityRun,
  finishNoodleFanActivityRun,
  markNoodleFanActivityApplied,
  NOODLE_FAN_ACTIVITY_RUNS_PER_DAY,
  parsePersistedNoodleFanActivityDayPlan,
  reconcileNoodleFanActivityDayPlan,
  storeNoodleFanAcceptedActivities,
  type NoodleFanActivityDayPlanRun,
  type PersistedNoodleFanActivityDayPlan,
} from "./noodle-fan-activity-day-plan.js";
import {
  generateNoodlerFanActivityBatch,
  prepareNoodlerFanCreatorCandidates,
  resolveNoodlerFanActivityPolicy,
  resolveNoodlerFanConnection,
} from "./noodle-noodler-fan-activity.service.js";
import { tryNoodleOperation } from "./noodle-operation-lock.js";

const FAN_PLAN_ROW_PREFIX = "fan-day:";
const FAN_PLAN_RETENTION_DAYS = 7;
const FAN_ACTIVITY_RECOVERY_MAX_AGE_MS = 15 * 60 * 1000;

export type NoodlerFanRunResult = {
  status:
    | "generated"
    | "resumed"
    | "not_due"
    | "disabled"
    | "busy"
    | "limit_reached"
    | "connection_required"
    | "connection_not_found"
    | "no_eligible_posts"
    | "abandoned";
  created: number;
  runId?: string;
};

function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

async function readPlans(db: DB, at = new Date(), prune = true) {
  const rows = await db.select().from(noodlerFanActivityState);
  const plans = rows.flatMap((row) => {
    try {
      const plan = parsePersistedNoodleFanActivityDayPlan(JSON.parse(row.plan));
      return plan ? [plan] : [];
    } catch {
      return [];
    }
  });
  if (!prune) return plans;
  const cutoff = new Date(
    at.getFullYear(),
    at.getMonth(),
    at.getDate() - FAN_PLAN_RETENTION_DAYS,
  ).getTime();
  const retained = [];
  for (const plan of plans) {
    const [year, month, day] = plan.localDate.split("-").map(Number);
    const planTime = new Date(year!, month! - 1, day!).getTime();
    const hasRecoverableRun = plan.runs.some(
      (run) => run.status === "applying" || run.status === "generating",
    );
    if (planTime < cutoff && !hasRecoverableRun) {
      await db
        .delete(noodlerFanActivityState)
        .where(eq(noodlerFanActivityState.id, planRowId(plan)));
    } else {
      retained.push(plan);
    }
  }
  return retained;
}

async function readCurrentPlan(db: DB, at: Date) {
  const plans = await readPlans(db, at);
  return (
    plans.find(
      (plan) =>
        plan.localDate === localPlanDate(at) &&
        plan.timezone === localTimezone(),
    ) ?? null
  );
}

function localPlanDate(at: Date) {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

function planRowId(plan: PersistedNoodleFanActivityDayPlan) {
  return `${FAN_PLAN_ROW_PREFIX}${plan.localDate}:${plan.timezone}`;
}

async function writePlan(db: DB, plan: PersistedNoodleFanActivityDayPlan) {
  const id = planRowId(plan);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(noodlerFanActivityState)
      .where(eq(noodlerFanActivityState.id, id));
    if (rows[0]) {
      await tx
        .update(noodlerFanActivityState)
        .set({ plan: JSON.stringify(plan), updatedAt: now() })
        .where(eq(noodlerFanActivityState.id, id));
    } else {
      await tx
        .insert(noodlerFanActivityState)
        .values({ id, plan: JSON.stringify(plan), updatedAt: now() });
    }
  });
}

async function findRecoverablePlan(db: DB) {
  for (const plan of await readPlans(db, new Date(), false)) {
    const applying = plan.runs.find((run) => run.status === "applying");
    if (applying) return { plan, run: applying, interrupted: false };
    const generating = plan.runs.find((run) => run.status === "generating");
    if (generating) return { plan, run: generating, interrupted: true };
  }
  return null;
}

async function reconcilePlan(db: DB, settings: NoodleSettings, at: Date) {
  const noodle = createNoodleStorage(db);
  const creators = await noodle.listNoodlerAccounts();
  const eligibleIds = settings.fanActivityEnabled
    ? creators
        .filter(
          (creator) =>
            resolveNoodlerFanActivityPolicy(settings, creator).enabled,
        )
        .map((creator) => creator.id)
    : [];
  const plan = reconcileNoodleFanActivityDayPlan(
    await readCurrentPlan(db, at),
    eligibleIds,
    at,
    settings.fanActivityRunsPerDay,
  );
  await writePlan(db, plan);
  return plan;
}

async function applyAcceptedActivities(
  db: DB,
  plan: PersistedNoodleFanActivityDayPlan,
  run: NoodleFanActivityDayPlanRun,
  settings: NoodleSettings,
  finishedAt: Date,
) {
  const noodle = createNoodleStorage(db);
  let current = plan;
  let created = 0;
  // ponytail: interaction creation is idempotent by activity.id (see createNoodlerFanInteraction),
  // so a crash mid-loop just redoes a no-op create on resume — one write after the loop is enough.
  for (const activity of run.acceptedActivities) {
    if (activity.applied) continue;
    const creator = await noodle.getNoodlerAccountById(activity.creatorId);
    if (
      !creator ||
      !resolveNoodlerFanActivityPolicy(settings, creator).enabled
    ) {
      current = markNoodleFanActivityApplied(current, run.id, activity.id);
      continue;
    }
    const result = await noodle.createNoodlerFanInteraction(
      activity.targetPostId,
      {
        id: activity.id,
        creatorAccountId: activity.creatorId,
        actorId: activity.actorId,
        actorSnapshot: activity.snapshot as NoodleAuthorSnapshot,
        runId: run.id,
        type: activity.type as "like" | "reply" | "repost",
        content: activity.content,
      },
    );
    if (result?.created) created += 1;
    current = markNoodleFanActivityApplied(current, run.id, activity.id);
  }
  current = finishNoodleFanActivityRun(
    current,
    run.id,
    "completed",
    finishedAt,
  );
  await writePlan(db, current);
  return created;
}

export async function runNoodlerFanActivity(input: {
  db: DB;
  mode: "automatic" | "manual";
  at?: Date;
  debugMode?: boolean;
}): Promise<NoodlerFanRunResult> {
  const operation = await tryNoodleOperation(
    "noodler-fan-activity",
    async () => {
      const at = input.at ?? new Date();
      const noodle = createNoodleStorage(input.db);
      const settings = await noodle.getSettings();
      const recoverable = await findRecoverablePlan(input.db);
      if (recoverable?.interrupted) {
        const abandoned = finishNoodleFanActivityRun(
          recoverable.plan,
          recoverable.run.id,
          "abandoned",
          at,
        );
        await writePlan(input.db, abandoned);
      } else if (recoverable) {
        const claimedAt = Date.parse(recoverable.run.claimedAt ?? "");
        if (
          !Number.isFinite(claimedAt) ||
          at.getTime() - claimedAt > FAN_ACTIVITY_RECOVERY_MAX_AGE_MS
        ) {
          const abandoned = finishNoodleFanActivityRun(
            recoverable.plan,
            recoverable.run.id,
            "abandoned",
            at,
          );
          await writePlan(input.db, abandoned);
        } else {
          return {
            status: "resumed",
            created: await applyAcceptedActivities(
              input.db,
              recoverable.plan,
              recoverable.run,
              settings,
              at,
            ),
            runId: recoverable.run.id,
          };
        }
      }
      if (!settings.enableNoodler || !settings.fanActivityEnabled)
        return { status: "disabled", created: 0 };
      let plan = await reconcilePlan(input.db, settings, at);

      const connectionId = settings.generationConnectionId;
      if (!connectionId) return { status: "connection_required", created: 0 };
      const connection = await resolveNoodlerFanConnection(input.db, settings);
      if (!connection) return { status: "connection_not_found", created: 0 };
      const admission = tryBackgroundConnection(connection.id, at);
      if (!admission.acquired) return { status: "busy", created: 0 };

      try {
        let run: NoodleFanActivityDayPlanRun | null;
        if (input.mode === "manual") {
          const claimed = claimManualNoodleFanActivityRun(plan, at);
          plan = claimed.plan;
          run = claimed.run;
        } else {
          run = dueNoodleFanActivityRun(plan, at);
          if (!run) return { status: "not_due", created: 0 };
          plan = claimNoodleFanActivityRun(plan, run.id, at);
          run = plan.runs.find((candidate) => candidate.id === run!.id)!;
        }
        await writePlan(input.db, plan);

        const creators = await prepareNoodlerFanCreatorCandidates({
          db: input.db,
          settings,
          creatorIds: run.creatorIds,
        });
        if (creators.length === 0) {
          plan = finishNoodleFanActivityRun(plan, run.id, "skipped", at);
          await writePlan(input.db, plan);
          return { status: "no_eligible_posts", created: 0, runId: run.id };
        }

        try {
          const accepted = await generateNoodlerFanActivityBatch({
            db: input.db,
            settings,
            connection,
            creators,
            debugMode: input.debugMode,
          });
          plan = storeNoodleFanAcceptedActivities(plan, run.id, accepted);
          await writePlan(input.db, plan);
          const storedRun = plan.runs.find(
            (candidate) => candidate.id === run!.id,
          )!;
          const created = await applyAcceptedActivities(
            input.db,
            plan,
            storedRun,
            settings,
            at,
          );
          return { status: "generated", created, runId: run.id };
        } catch (error) {
          plan = finishNoodleFanActivityRun(plan, run.id, "abandoned", at);
          await writePlan(input.db, plan);
          throw error;
        }
      } finally {
        admission.release();
      }
    },
  );
  return operation.acquired ? operation.value : { status: "busy", created: 0 };
}

export async function getNoodlerFanActivityStatus(db: DB, at = new Date()) {
  const plan = await readCurrentPlan(db, at);
  const settings = await createNoodleStorage(db).getSettings();
  const automaticRuns = plan?.runs.filter((run) => !run.manual) ?? [];
  const lastRun = plan
    ? ([...plan.runs]
        .filter((run) => run.status !== "scheduled")
        .sort(
          (left, right) =>
            Date.parse(left.finishedAt ?? left.scheduledAt) -
            Date.parse(right.finishedAt ?? right.scheduledAt),
        )
        .at(-1) ?? null)
    : null;
  return {
    localDate: plan?.localDate ?? localPlanDate(at),
    usedRuns: automaticRuns.filter((run) => run.status !== "scheduled").length,
    runLimit:
      settings.fanActivityRunsPerDay ?? NOODLE_FAN_ACTIVITY_RUNS_PER_DAY,
    lastRun,
  };
}
