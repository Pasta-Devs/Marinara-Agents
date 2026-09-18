import type { NoodleAuthorSnapshot } from "@marinara-engine/shared";
import type { DB } from "../../../db/connection.js";
import { eq } from "../../../db/file-query.js";
import { noodlerFanActivityState } from "../../../db/schema/slurp.js";
import { now } from "../../../utils/id-generator.js";
import { tryBackgroundConnection } from "../../../services/generation/connection-admission.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { snapshotForAccount } from "../../data/host/slp-storage-mappers.js";
import { type SlurpSettings } from "../../modules/settings/slp-settings.js";
import {
  claimManualNoodleFanActivityRun,
  claimNoodleFanActivityRun,
  dueNoodleFanActivityRun,
  finishNoodleFanActivityRun,
  markNoodleFanActivityApplied,
  parsePersistedNoodleFanActivityDayPlan,
  reconcileNoodleFanActivityDayPlan,
  storeNoodleFanAcceptedActivities,
  type NoodleFanActivityDayPlanRun,
  type PersistedNoodleFanActivityDayPlan,
} from "../../modules/audience/slp-fan-activity-day-plan.js";
import {
  generateNoodlerFanActivityBatch,
  prepareNoodlerFanCreatorCandidates,
  resolveNoodlerFanActivityPolicy,
  resolveNoodlerFanConnection,
} from "./slp-fan-activity-service.js";
import { tryNoodleOperation } from "../../base/locking/slp-operation-lock.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { isSlurpPopulationMemberId } from "../../../../../shared/src/slp/slp-population.js";
import {
  NOODLER_FAN_IDENTITY_PREFIX,
  populationNoodlerFanIdentityProvider,
  type NoodlerFanCastMember,
} from "../../modules/audience/slp-fan-identity-provider.js";
import {
  SLURP_FAN_VOICE_PROMPT_MAX,
  slurpFanMemoryForPrompt,
  slurpFanTypeForPinnedOrSeed,
  slurpFanTypeSpendTier,
  slurpFanTypeTraits,
  slurpFanTypeWeeklyBudget,
  slurpResolveFanType,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import {
  selectSlurpAudienceCharacterIds,
  slurpAudienceCharacterFanTypeId,
  slurpAudienceCharacterTraits,
  slurpAudienceCharacterVoice,
} from "../../modules/audience/slp-audience-characters.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { newId } from "../../../utils/id-generator.js";
import { claimSlurpModelBudget, slurpModelWorkerAllows } from "../../base/model/slp-model-worker.js";

const FAN_PLAN_ROW_PREFIX = "fan-day:";

/** People who have acted before and may act again, so a Creator gets recognisable regulars. */
const FAN_RUN_RETURNING = 10;

/** New faces per run. Small, but enough that the cast is never the same list twice in a row. */
const FAN_RUN_NEWCOMERS = 2;
const FAN_PLAN_RETENTION_DAYS = 7;
const FAN_ACTIVITY_RECOVERY_MAX_AGE_MS = 15 * 60 * 1000;

export function noodlerFanActivityRunLimit(settings: Pick<SlurpSettings, "fanActivityRunsPerDay" | "modelBudget">) {
  return Math.min(settings.fanActivityRunsPerDay, settings.modelBudget.jobs.thread.maxPerDay);
}

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

/**
 * The characters the user invited, as cast members for one run.
 *
 * Each one is an account row, not a population member, so it carries `snapshotForAccount` of that
 * row. `createNoodlerFanInteraction` compares the planned snapshot against the live row and refuses
 * anything that differs, so a synthesised snapshot would be silently dropped at apply time.
 *
 * A character has no Fan Type of its own, so one is derived: the pinned type when the user chose
 * one, else the id-derived pick that an ambient account already uses. That is what supplies the
 * spend budget, the traits, and the behaviour weights.
 *
 * Rotation is by run id, so inviting more characters than the limit does not silence the tail of
 * the list forever.
 */
async function drawAudienceCharacterCast(
  db: DB,
  settings: SlurpSettings,
  runId: string,
): Promise<NoodlerFanCastMember[]> {
  const limit = settings.audienceCharacterLimit ?? 0;
  if (limit <= 0) return [];
  const noodle = createSlurpStorage(db);
  // Provision first: a character invited since the last run has no row yet, and a renamed one
  // needs its handle and avatar refreshed before the snapshot is taken.
  await noodle.ensureAudienceCharacterAccounts().catch(() => undefined);
  const invited = await noodle.listAudienceCharacterAccounts().catch(() => []);
  if (invited.length === 0) return [];
  const chosen = selectSlurpAudienceCharacterIds(
    invited.map((entry) => entry.characterId),
    limit,
    runId,
  );
  const byCharacterId = new Map(invited.map((entry) => [entry.characterId, entry.account]));
  const characters = createCharactersStorage(db);
  // Only the drawn characters are read. The invited list can be long, and a card is the largest
  // row this feature touches.
  const cards = new Map(
    await Promise.all(
      chosen.map(
        async (characterId) => [characterId, await characters.getById(characterId).catch(() => null)] as const,
      ),
    ),
  );
  return chosen.flatMap((characterId) => {
    const account = byCharacterId.get(characterId);
    if (!account) return [];
    const type = slurpFanTypeForPinnedOrSeed(
      settings.fanTypes,
      slurpAudienceCharacterFanTypeId(settings, characterId),
      account.id,
    );
    const weeklyBudget = slurpFanTypeWeeklyBudget(type, account.id);
    // The character's own words are the point of inviting them, so the card wins over the Fan
    // Type's voice. The Type still supplies everything the card cannot say: spend, hours, weights.
    // A card with no personality or description falls back rather than sending an empty voice.
    const card = cards.get(characterId);
    const cardTraits = slurpAudienceCharacterTraits(card);
    return [
      {
        id: account.id,
        handle: account.handle,
        displayName: account.displayName,
        archetype: type.engineArchetype,
        traits: cardTraits.length > 0 ? cardTraits : slurpFanTypeTraits(type, account.id),
        spendTier: slurpFanTypeSpendTier(weeklyBudget),
        voice: slurpAudienceCharacterVoice(card, SLURP_FAN_VOICE_PROMPT_MAX) ?? type.voice,
        tone: type.tone,
        snapshot: snapshotForAccount(account),
      },
    ];
  });
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
    noodlerFanActivityRunLimit(settings),
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
      type: activity.type as "like" | "reply",
      content: activity.content,
      parentInteractionId: activity.parentInteractionId ?? null,
    });
    if (result?.created) {
      created += 1;
      // Fan activity is the highest-volume thing the audience does, and it fed nothing into the
      // Fan likes and replies are the only audience interactions in Slurp.
      const population = createSlurpPopulationStorage(db);
      // Same guard as `advanceAudienceTie`: a recovered plan written before the population existed
      // still carries `noodler-fan:` archetype ids, and a tie for one is an unresolvable follower.
      if (!activity.actorId.startsWith(NOODLER_FAN_IDENTITY_PREFIX)) {
        // Ties are keyed by plain id, so an invited character earns a relationship here like anybody
        // else in the crowd.
        await population
          .advanceTie(activity.actorId, activity.creatorId, {
            stage: "liker",
            interactions: 1,
          })
          .catch(() => undefined);
        // `lastActiveAt` lives on the population row, and only a generated member has one. An
        // account standing in the crowd — ambient or invited character — has nothing to touch.
        if (isSlurpPopulationMemberId(activity.actorId)) {
          await population.touch(activity.actorId).catch(() => undefined);
        }
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
  const operation = await tryNoodleOperation<NoodlerFanRunResult>("noodler-fan-activity", async () => {
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
      const workerContext = input.mode === "manual" ? "present" : "background";
      if (
        !slurpModelWorkerAllows(settings.modelBudget, workerContext) ||
        !(await claimSlurpModelBudget(input.db, settings.modelBudget, "thread", at))
      ) {
        return { status: "limit_reached", created: 0 };
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
      // Each member carries their Fan Type's voice, which is the one thing that makes a Lurker's
      // three words and a Superfan's paragraph read as two different people.
      const populationCast = (
        await Promise.all(seeds.map((seed) => population.ensure(seed, at, settings.fanTypes)))
      ).map((member) => {
        const type = slurpResolveFanType(settings.fanTypes, member);
        return { ...member, voice: type.voice, tone: type.tone };
      });
      // Mark the drawn cast as recently active. `listAll` orders by that column, so without this
      // it kept ordering by creation time: the same earliest members were redrawn forever and
      // anybody who actually showed up sank out of the pool. Regulars could never recur.
      //
      // Only population members are touched: `lastActiveAt` lives on the population row, and a
      // character fan is an account, so touching its id would update nothing.
      await Promise.all(populationCast.map((member) => population.touch(member.id).catch(() => undefined)));

      // The characters the user put in the audience, rotated so that inviting more than the limit
      // does not silence the ones at the end of the list.
      const cast = [...populationCast, ...(await drawAudienceCharacterCast(input.db, settings, run.id))];

      // The cast carries its relationship to each Creator. Resolved for every creator in the run,
      // not just the first: a run covers up to twelve, and reusing one creator's ties for all of
      // them told the model a false history rather than no history.
      const tiesByCreator = new Map(
        await Promise.all(
          run.creatorIds.map(
            async (creatorId) =>
              [
                creatorId,
                new Map(
                  (await population.listTiesForCreator(creatorId)).map((tie) => [
                    tie.memberId,
                    {
                      stage: tie.stage,
                      spent: tie.spent,
                      knownForDays: Math.max(
                        0,
                        Math.round((at.getTime() - Date.parse(tie.firstSeenAt)) / 86_400_000) || 0,
                      ),
                      audienceArc: tie.audienceArc,
                      memory: slurpFanMemoryForPrompt(tie, at),
                    },
                  ]),
                ),
              ] as const,
          ),
        ),
      );

      const creators = await prepareNoodlerFanCreatorCandidates({
        db: input.db,
        settings,
        creatorIds: run.creatorIds,
        identityProvider: populationNoodlerFanIdentityProvider(cast, tiesByCreator),
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
    runLimit: noodlerFanActivityRunLimit(settings),
    lastRun,
  };
}
