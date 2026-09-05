/**
 * Advance the world.
 *
 * One function, two callers: the background tick and the catch-up when the player opens Slurp.
 * The plan requires exactly that shape, and it mirrors `applyStipend`, which bills on read and
 * needs no timer to stay correct.
 *
 * Everything here is free-tier. The maintainer's rule is that unattended work never calls the
 * model, so briefs and questions come from the combinatorial bank in `slurp-world-copy.ts`.
 * Auto-posting is the one exception to that rule and it lives in its own scheduler.
 */
import type { NoodleAuthorSnapshot } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createSlurpMessagesStorage } from "../storage/slurp-messages.storage.js";
import { createSlurpPopulationStorage } from "../storage/slurp-population.storage.js";
import { isAmbientNoodleAccount } from "./slurp-ambient-profiles.js";
import { tryNoodleOperation } from "./slurp-operation-lock.js";
import { slurpCreatorReach } from "./slurp-reach.js";
import { slurpAudienceQuestion, slurpCommissionBrief } from "./slurp-world-copy.js";
import { planSlurpWorldTick, type SlurpWorldAction, type SlurpWorldCreator } from "./slurp-world.js";

const TICK_KEY = "slurp.world.tick";

/** Posts older than this are no longer worth asking about. */
const RECENT_POST_DAYS = 7;

/** Silence this long and somebody drifts out of the funnel. Churn is the cure for repetition. */
const CHURN_SILENT_DAYS = 45;

export type SlurpWorldResult = {
  status: "advanced" | "idle" | "busy";
  actions: number;
};

async function readLastTick(db: DB): Promise<Date | null> {
  const raw = await createAppSettingsStorage(db).get(TICK_KEY);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

async function writeLastTick(db: DB, at: Date): Promise<void> {
  await createAppSettingsStorage(db).set(TICK_KEY, at.toISOString());
}

/**
 * Advance the world to `until`.
 *
 * The first call only records the mark and does nothing else: there is no stretch of time to
 * simulate yet, and inventing one would open a brand-new install onto a backlog it never earned.
 */
export async function advanceSlurpWorld(db: DB, until = new Date()): Promise<SlurpWorldResult> {
  const operation = await tryNoodleOperation("slurp-world-tick", async () => {
    const since = await readLastTick(db);
    if (!since) {
      await writeLastTick(db, until);
      return { status: "idle" as const, actions: 0 };
    }

    const noodle = createSlurpStorage(db);
    const settings = await noodle.getSettings();
    const accounts = await noodle.listNoodlerAccounts();
    const allAccounts = await noodle.listAccounts();

    // The ambient roster plus the generated population. Ambient accounts are real account rows and
    // can hold threads, so they can be commissioned from; population members act through the
    // snapshot paths. Both are drawn from, so the world is not six faces.
    const ambient = settings.allowRandomUsers
      ? allAccounts.filter((account) => isAmbientNoodleAccount(account)).map((account) => account.id)
      : [];
    const audience = ambient;

    const messages = createSlurpMessagesStorage(db);
    const cutoff = new Date(until.getTime() - RECENT_POST_DAYS * 86_400_000).toISOString();
    const postsByAccount = await noodle.listNoodlerPostsByAccounts(
      accounts.map((account) => account.id),
      8,
    );

    const creators: SlurpWorldCreator[] = await Promise.all(
      accounts.map(async (account) => ({
        id: account.id,
        followers: slurpCreatorReach({ accountId: account.id, createdAt: account.createdAt, realFollowers: 0 }, until),
        recentPostIds: (postsByAccount.get(account.id) ?? [])
          .filter((post) => post.createdAt >= cutoff && post.access !== "draft")
          .map((post) => post.id),
        // A queue nobody answered gets no more. Asking again while three requests sit unread is
        // how an obligation layer turns into a chore.
        openRequests: (await messages.listOpenCommissionsForCreator(account.id)).length,
      })),
    );

    // Churn. Somebody who has not been near a Creator in a long time drifts out of the funnel, so
    // the named cast rotates instead of freezing into the same thirty faces. Subscribers are left
    // alone: their tie ends when the subscription does, which has its own path and its own event.
    const population = createSlurpPopulationStorage(db);
    const staleBefore = new Date(until.getTime() - CHURN_SILENT_DAYS * 86_400_000).toISOString();
    for (const account of accounts) {
      for (const tie of await population.listTiesForCreator(account.id)) {
        if (tie.stage === "lapsed" || tie.stage === "stranger" || tie.stage === "subscriber") continue;
        if (tie.lastSeenAt >= staleBefore) continue;
        await population.lapseTie(tie.memberId, account.id).catch(() => undefined);
      }
    }

    const plan = planSlurpWorldTick({ since, until, creators, audience });
    let applied = 0;
    for (const action of plan) {
      try {
        if (await applyAction(db, action, until)) applied += 1;
      } catch (error) {
        // One failed action must not abandon the rest of the tick, and must never stop the mark
        // being written — otherwise the same stretch of time is replayed on every call.
        logger.warn(error, "[slurp-world] Could not apply a %s action", action.kind);
      }
    }
    await writeLastTick(db, until);
    return { status: applied > 0 ? ("advanced" as const) : ("idle" as const), actions: applied };
  });
  return operation.acquired ? operation.value : { status: "busy", actions: 0 };
}

async function applyAction(db: DB, action: SlurpWorldAction, at: Date): Promise<boolean> {
  const noodle = createSlurpStorage(db);
  const actor = await noodle.getNoodlerAccountById(action.actorAccountId);
  if (!actor) return false;

  if (action.kind === "commission") {
    const messages = createSlurpMessagesStorage(db);
    const brief = slurpCommissionBrief(`${action.creatorAccountId}:${action.actorAccountId}:${at.toISOString()}`);
    return Boolean(await messages.createCommission(action.actorAccountId, action.creatorAccountId, brief));
  }

  const snapshot: NoodleAuthorSnapshot = {
    id: actor.id,
    kind: "random_user",
    entityId: actor.entityId,
    handle: actor.handle,
    displayName: actor.displayName,
    avatarUrl: actor.avatarUrl,
    avatarCrop: actor.avatarCrop,
  };
  const result = await noodle.createNoodlerFanInteraction(action.postId, {
    id: newId(),
    creatorAccountId: action.creatorAccountId,
    actorId: actor.id,
    actorSnapshot: snapshot,
    runId: `world:${at.toISOString()}`,
    type: "reply",
    content: slurpAudienceQuestion(`${action.postId}:${action.actorAccountId}`),
  });
  if (!result?.created) return false;
  // Commenting is a step up the funnel, and the funnel is what a follower count is counted from.
  await createSlurpPopulationStorage(db)
    .advanceTie(actor.id, action.creatorAccountId, { stage: "liker", interactions: 1 })
    .catch(() => undefined);
  // A question is an obligation, so it is reported. An ordinary comment is not.
  await noodle.recordCreatorEvent(action.creatorAccountId, "comment", {
    subjectId: action.postId,
    actorLabel: actor.id,
  });
  return true;
}
