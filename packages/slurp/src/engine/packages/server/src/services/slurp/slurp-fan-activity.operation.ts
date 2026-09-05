import type { NoodleAuthorSnapshot } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { eq } from "../../db/file-query.js";
import { noodlerFanActivityState } from "../../db/schema/slurp.js";
import { now } from "../../utils/id-generator.js";
import { tryBackgroundConnection } from "../generation/connection-admission.js";
import { createSlurpStorage, type SlurpSettings } from "../storage/slurp.storage.js";
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
} from "./slurp-fan-activity-day-plan.js";
import {
  generateNoodlerFanActivityBatch,
  prepareNoodlerFanCreatorCandidates,
  resolveNoodlerFanActivityPolicy,
  resolveNoodlerFanConnection,
} from "./slurp-fan-activity.service.js";
import { tryNoodleOperation } from "./slurp-operation-lock.js";
import { createSlurpPopulationStorage } from "../storage/slurp-population.storage.js";
import { NOODLER_FAN_IDENTITY_PREFIX, populationNoodlerFanIdentityProvider } from "./slurp-fan-identity-provider.js";
import { newId } from "../../utils/id-generator.js";

const FAN_PLAN_ROW_PREFIX = "fan-day:";

/** People who have acted before and may act again, so a Creator gets recognisable regulars. */
const FAN_RUN_RETURNING = 10;

/** New faces per run. Small, but enough that the cast is never the same list twice in a row. */
const FAN_RUN_NEWCOMERS = 2;
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
  const cutoff = new Date(at.getFullYear(), at.getMonth(), at.getDate() - FAN_PLAN_RETENTION_DAYS).getTime();
  const retained = [];
  for (const plan of plans) {
    const [year, month, day] = plan.localDate.split("-").map(Number);
    const planTime = new Date(year!, month! - 1, day!).getTime();
    const hasRecoverableRun = plan.runs.some((run) => run.status === "applying" || run.status === "generating");
    if (planTime < cutoff && !hasRecoverableRun) {
      await db.delete(noodlerFanActivityState).where(eq(noodlerFanActivityState.id, planRowId(plan)));
    } else {
      retained.push(plan);
    }
  }
  return retained;
}

async function readCurrentPlan(db: DB, at: Date) {
  const plans = await readPlans(db, at);
  return plans.find((plan) => plan.localDate === localPlanDate(at) && plan.timezone === localTimezone()) ?? null;
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
    const rows = await tx.select().from(noodlerFanActivityState).where(eq(noodlerFanActivityState.id, id));
    if (rows[0]) {
      await tx
        .update(noodlerFanActivityState)
        .set({ plan: JSON.stringify(plan), updatedAt: now() })
        .where(eq(noodlerFanActivityState.id, id));
    } else {
      await tx.insert(noodlerFanActivityState).values({ id, plan: JSON.stringify(plan), updatedAt: now() });
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

async function reconcilePlan(db: DB, settings: SlurpSettings, at: Date) {
  const noodle = createSlurpStorage(db);
  const creators = await noodle.listNoodlerAccounts();
  const eligibleIds = settings.fanActivityEnabled
    ? creators
        .filter((creator) => resolveNoodlerFanActivityPolicy(settings, creator).enabled)
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
  settings: SlurpSettings,
  finishedAt: Date,
) {
  const noodle = createSlurpStorage(db);
  let current = plan;
  let created = 0;
  // ponytail: interaction creation is idempotent by activity.id (see createNoodlerFanInteraction),
  // so a crash mid-loop just redoes a no-op create on resume — one write after the loop is enough.
  for (const activity of run.acceptedActivities) {
    if (activity.applied) continue;
    const creator = await noodle.getNoodlerAccountById(activity.creatorId);
    if (!creator || !resolveNoodlerFanActivityPolicy(settings, creator).enabled) {
      current = markNoodleFanActivityApplied(current, run.id, activity.id);
      continue;
    }
    const result = await noodle.createNoodlerFanInteraction(activity.targetPostId, {
      id: activity.id,
      creatorAccountId: activity.creatorId,
      actorId: activity.actorId,
      actorSnapshot: activity.snapshot as NoodleAuthorSnapshot,
      runId: run.id,
      type: activity.type as "like" | "reply" | "repost",
      content: activity.content,
    });
    if (result?.created) {
      created += 1;
      // Fan activity is the highest-volume thing the audience does, and it fed nothing into the
      // funnel: follower counts barely moved from the very people who were most active. A repost
      // carries further than a like — it shows you to somebody else's feed — so it ranks higher.
      const population = createSlurpPopulationStorage(db);
      // Same guard as `advanceAudienceTie`: a recovered plan written before the population existed
      // still carries `noodler-fan:` archetype ids, and a tie for one is an unresolvable follower.
      if (!activity.actorId.startsWith(NOODLER_FAN_IDENTITY_PREFIX)) {
        await population
          .advanceTie(activity.actorId, activity.creatorId, {
            stage: activity.type === "repost" ? "follower" : "liker",
            interactions: 1,
          })
          .catch(() => undefined);
        await population.touch(activity.actorId).catch(() => undefined);
      }
    }
    current = markNoodleFanActivityApplied(current, run.id, activity.id);
  }
  current = finishNoodleFanActivityRun(current, run.id, "completed", finishedAt);
  await writePlan(db, current);
  return created;
}

export async function runNoodlerFanActivity(input: {
  db: DB;
  mode: "automatic" | "manual";
  at?: Date;
  debugMode?: boolean;
}): Promise<NoodlerFanRunResult> {
  const operation = await tryNoodleOperation("noodler-fan-activity", async () => {
    const at = input.at ?? new Date();
    const noodle = createSlurpStorage(input.db);
    const settings = await noodle.getSettings();
    const recoverable = await findRecoverablePlan(input.db);
    if (recoverable?.interrupted) {
      const abandoned = finishNoodleFanActivityRun(recoverable.plan, recoverable.run.id, "abandoned", at);
      await writePlan(input.db, abandoned);
    } else if (recoverable) {
      const claimedAt = Date.parse(recoverable.run.claimedAt ?? "");
      if (!Number.isFinite(claimedAt) || at.getTime() - claimedAt > FAN_ACTIVITY_RECOVERY_MAX_AGE_MS) {
        const abandoned = finishNoodleFanActivityRun(recoverable.plan, recoverable.run.id, "abandoned", at);
        await writePlan(input.db, abandoned);
      } else {
        return {
          status: "resumed",
          created: await applyAcceptedActivities(input.db, recoverable.plan, recoverable.run, settings, at),
          runId: recoverable.run.id,
        };
      }
    }
    if (!settings.fanActivityEnabled) return { status: "disabled", created: 0 };
    let plan = await reconcilePlan(input.db, settings, at);

    const connection = await resolveNoodlerFanConnection(input.db, settings);
    if (!connection) return { status: "connection_required", created: 0 };
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

      // Draw the cast for this run: mostly people who have acted before, so regulars recur and
      // can be recognised, plus a couple of new faces so the roster churns instead of freezing
      // into the same names forever. Churn is the cure for repetition — a fixed cast of thirty is
      // the old six-account problem with thirty faces.
      const population = createSlurpPopulationStorage(input.db);
      const returning = await population.listAll(40);
      const seeds = [
        ...returning.slice(0, FAN_RUN_RETURNING).map((member) => member.id.replace(/^slurp-fan:/u, "")),
        ...Array.from({ length: FAN_RUN_NEWCOMERS }, () => newId()),
      ];
      const cast = await Promise.all(seeds.map((seed) => population.ensure(seed, at)));
      // Mark the drawn cast as recently active. `listAll` orders by that column, so without this
      // it kept ordering by creation time: the same earliest members were redrawn forever and
      // anybody who actually showed up sank out of the pool. Regulars could never recur.
      await Promise.all(cast.map((member) => population.touch(member.id).catch(() => undefined)));

      // The cast carries its relationship to each Creator, so the prompt can say who is speaking.
      // A provider is per run but a relationship is per Creator, so the tie is resolved against the
      // Creator this run is about; with several, the first is used, which is what the run is
      // weighted around anyway.
      const relationshipCreatorId = run.creatorIds[0] ?? null;
      const ties = relationshipCreatorId
        ? new Map(
            (await population.listTiesForCreator(relationshipCreatorId)).map((tie) => [tie.memberId, tie] as const),
          )
        : new Map();
      const castWithHistory = cast.map((member) => {
        const tie = ties.get(member.id);
        return {
          ...member,
          ...(tie
            ? {
                stage: tie.stage,
                spent: tie.spent,
                knownForDays: Math.max(0, Math.round((at.getTime() - Date.parse(tie.firstSeenAt)) / 86_400_000) || 0),
              }
            : {}),
        };
      });

      const creators = await prepareNoodlerFanCreatorCandidates({
        db: input.db,
        settings,
        creatorIds: run.creatorIds,
        identityProvider: populationNoodlerFanIdentityProvider(castWithHistory),
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
        const storedRun = plan.runs.find((candidate) => candidate.id === run!.id)!;
        const created = await applyAcceptedActivities(input.db, plan, storedRun, settings, at);
        return { status: "generated", created, runId: run.id };
      } catch (error) {
        plan = finishNoodleFanActivityRun(plan, run.id, "abandoned", at);
        await writePlan(input.db, plan);
        throw error;
      }
    } finally {
      admission.release();
    }
  });
  return operation.acquired ? operation.value : { status: "busy", created: 0 };
}

export async function getNoodlerFanActivityStatus(db: DB, at = new Date()) {
  const plan = await readCurrentPlan(db, at);
  const settings = await createSlurpStorage(db).getSettings();
  const automaticRuns = plan?.runs.filter((run) => !run.manual) ?? [];
  const lastRun = plan
    ? ([...plan.runs]
        .filter((run) => run.status !== "scheduled")
        .sort(
          (left, right) =>
            Date.parse(left.finishedAt ?? left.scheduledAt) - Date.parse(right.finishedAt ?? right.scheduledAt),
        )
        .at(-1) ?? null)
    : null;
  return {
    localDate: plan?.localDate ?? localPlanDate(at),
    usedRuns: automaticRuns.filter((run) => run.status !== "scheduled").length,
    runLimit: settings.fanActivityRunsPerDay ?? NOODLE_FAN_ACTIVITY_RUNS_PER_DAY,
    lastRun,
  };
}
