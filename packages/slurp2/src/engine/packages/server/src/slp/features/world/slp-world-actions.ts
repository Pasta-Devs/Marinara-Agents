import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import {
  slurpFanTypeForPinnedOrSeed,
  slurpFanTypeWeeklyBudget,
  slurpPickFanType,
  slurpResolveFanType,
  type SlurpFanType,
} from "../../modules/audience/slp-fan-types.js";
import {
  slurpAudienceOpener,
  slurpAudienceQuestion,
  slurpAudienceReactionFrom,
  SLURP_SHIPPED_TYPE_REACTIONS,
  slurpCommissionBrief,
} from "../../modules/world/slp-world-copy.js";
import { slurpReactionBodiesForType, type SlurpReactionBanks } from "../../modules/world/slp-reaction-bank.js";
import { enqueueSlurpPendingText } from "./slp-pending-text-service.js";
import { type SlurpWorldAction } from "../../modules/world/slp-world.js";
import { slurpPulseTieAdvance, type SlurpPulseAction } from "../../modules/world/slp-world-pulse.js";

/** The local day, so a per-pair roll is made once a day rather than on every page load. */
export function localDayKey(at: Date): string {
  return `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
}

/**
 * Who is acting.
 *
 * An actor is either an ambient profile, which has a real Slurp account row, or a generated
 * population member, which has no account row at all. Both must work: resolving accounts only
 * silently dropped every population action and left the world back at six faces.
 */
async function resolveActor(
  db: DB,
  actorAccountId: string,
  characterFanPinnedTypeIds: ReadonlyMap<string, string | null>,
  fanTypes: readonly SlurpFanType[],
): Promise<{
  id: string;
  entityId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  fanTypeId?: string | null;
  archetype?: string;
} | null> {
  const account = await createSlurpStorage(db).getNoodlerAccountById(actorAccountId);
  if (account) {
    const isCharacterFan = characterFanPinnedTypeIds.has(account.id);
    const fanType = isCharacterFan
      ? slurpFanTypeForPinnedOrSeed(fanTypes, characterFanPinnedTypeIds.get(account.id) ?? null, account.id)
      : null;
    return {
      id: account.id,
      entityId: account.entityId,
      handle: account.handle,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      ...(fanType ? { fanTypeId: fanType.id, archetype: fanType.engineArchetype } : {}),
    };
  }
  const member = await createSlurpPopulationStorage(db).get(actorAccountId);
  if (!member) return null;
  return {
    id: member.id,
    entityId: member.id,
    handle: member.handle,
    displayName: member.displayName,
    avatarUrl: null,
    fanTypeId: member.fanTypeId,
    archetype: member.archetype,
  };
}

export async function applyAction(
  db: DB,
  action: SlurpWorldAction,
  at: Date,
  noodle: ReturnType<typeof createSlurpStorage>,
  fanTypes: readonly SlurpFanType[],
  characterFanPinnedTypeIds: ReadonlyMap<string, string | null>,
): Promise<boolean> {
  const actor = await resolveActor(db, action.actorAccountId, characterFanPinnedTypeIds, fanTypes);
  if (!actor) return false;

  if (action.kind === "tip") {
    const operationId = `audience-tip:${action.creatorAccountId}:${actor.id}:${localDayKey(at)}`;
    if (await noodle.hasCreatorIncomeOperation(action.creatorAccountId, operationId)) return false;
    const fanType =
      actor.fanTypeId || actor.archetype ? slurpResolveFanType(fanTypes, actor) : slurpPickFanType(fanTypes, actor.id);
    if (
      !(await createSlurpPopulationStorage(db).reserveWeeklySpend(
        actor.id,
        action.creatorAccountId,
        action.amount,
        slurpFanTypeWeeklyBudget(fanType, actor.id),
        at,
      ))
    )
      return false;
    await noodle.creditCreatorIncome(action.creatorAccountId, action.amount, "tip", operationId);
    await createSlurpPopulationStorage(db)
      .advanceTie(actor.id, action.creatorAccountId, {
        stage: "follower",
        spent: action.amount,
        tipped: action.amount,
        interactions: 1,
      })
      .catch(() => undefined);
    await noodle.notifyCreatorIncome(action.creatorAccountId, "tip", action.amount, actor.id);
    return true;
  }

  if (action.kind === "unlock") {
    const population = createSlurpPopulationStorage(db);
    if ((await noodle.listPostUnlocksForViewer(actor.id)).some((unlock) => unlock.postId === action.postId))
      return false;
    const fanType =
      actor.fanTypeId || actor.archetype ? slurpResolveFanType(fanTypes, actor) : slurpPickFanType(fanTypes, actor.id);
    if (
      !(await population.reserveWeeklySpend(
        actor.id,
        action.creatorAccountId,
        action.amount,
        slurpFanTypeWeeklyBudget(fanType, actor.id),
        at,
      ))
    )
      return false;
    const created = await noodle.recordAudiencePostUnlock(actor.id, action.creatorAccountId, action.postId);
    if (!created) {
      // A stale or duplicate unlock must hand its reservation back, or it blocks the week's budget.
      await population.releaseWeeklySpend(actor.id, action.creatorAccountId, action.amount, at).catch(() => undefined);
      return false;
    }
    const operationId = `audience-unlock:${action.postId}:${actor.id}`;
    await noodle.creditCreatorIncome(action.creatorAccountId, action.amount, "unlock", operationId);
    await population
      .advanceTie(actor.id, action.creatorAccountId, {
        stage: "liker",
        spent: action.amount,
        unlocked: action.amount,
        interactions: 1,
      })
      .catch(() => undefined);
    await noodle.notifyCreatorIncome(action.creatorAccountId, "unlock", action.amount, actor.id, action.postId);
    return true;
  }

  if (action.kind === "message") {
    const messages = createSlurpMessagesStorage(db);
    const sent = await messages.sendViewerMessage(
      action.actorAccountId,
      action.creatorAccountId,
      slurpAudienceOpener(`${action.creatorAccountId}:${action.actorAccountId}:${at.toISOString()}`),
    );
    if (sent.status !== "sent") return false;
    await enqueueSlurpPendingText(db, {
      kind: "opener",
      subjectId: sent.message.id,
      creatorAccountId: action.creatorAccountId,
      actorLabel: actor.id,
    });
    const population = createSlurpPopulationStorage(db);
    await population
      .advanceTie(actor.id, action.creatorAccountId, { stage: "viewer", interactions: 1 })
      .catch(() => undefined);
    await population.touch(actor.id).catch(() => undefined);
    return true;
  }

  if (action.kind === "commission") {
    const messages = createSlurpMessagesStorage(db);
    const brief = slurpCommissionBrief(`${action.creatorAccountId}:${action.actorAccountId}:${at.toISOString()}`);
    const commission = await messages.createCommission(action.actorAccountId, action.creatorAccountId, brief);
    // `"open_request"` means this fan already has one waiting. Piling on a second is exactly what
    // the cap exists to stop, so the tick spends its action elsewhere.
    if (!commission || commission === "open_request") return false;
    // The brief is a placeholder. Queue it to be written properly the next time the player is here.
    await enqueueSlurpPendingText(db, {
      kind: "commission",
      subjectId: commission.id,
      creatorAccountId: action.creatorAccountId,
      actorLabel: actor.id,
    });
    const population = createSlurpPopulationStorage(db);
    await population
      .advanceTie(actor.id, action.creatorAccountId, { stage: "viewer", interactions: 1 })
      .catch(() => undefined);
    await population.touch(actor.id).catch(() => undefined);
    return true;
  }

  const result = await noodle.createNoodlerWorldInteraction(action.postId, {
    creatorAccountId: action.creatorAccountId,
    actorId: actor.id,
    type: "reply",
    content: slurpAudienceQuestion(`${action.postId}:${action.actorAccountId}`),
  });
  if (!result?.created) return false;
  await enqueueSlurpPendingText(db, {
    kind: "question",
    subjectId: result.interaction.id,
    creatorAccountId: action.creatorAccountId,
    postId: action.postId,
    actorLabel: actor.id,
  });
  // Commenting is a step up the funnel, and the funnel is what a follower count is counted from.
  const population = createSlurpPopulationStorage(db);
  await population
    .advanceTie(actor.id, action.creatorAccountId, { stage: "liker", interactions: 1 })
    .catch(() => undefined);
  // Mark them as recently active, or `listAll` keeps ordering by creation time and the same people
  // are drawn forever while everyone who actually shows up sinks out of the pool.
  await population.touch(actor.id).catch(() => undefined);
  // A question is an obligation, so it is reported. An ordinary comment is not.
  await noodle.recordCreatorEvent(action.creatorAccountId, "comment", {
    subjectId: action.postId,
    actorLabel: actor.id,
  });
  return true;
}

/**
 * Apply one pulse reaction.
 *
 * Free tier: no model call, ever. All three kinds write a real interaction row, so they show as
 * named people, feed the funnel, and cost nothing. A "follow" differs only in how far it moves the
 * tie. A follow still counts when its like row already exists, so an earlier like never blocks it.
 *
 * A "comment" carries Tier 1 copy. Most comments on a real post are three words from somebody who
 * wanted to be seen typing them, and paying a model to write those is backwards: they are the
 * highest-volume text on the platform and the least worth reading. The batched run keeps the
 * model, and keeps it for comments that have actually seen the post.
 */
export async function applyPulse(
  db: DB,
  action: SlurpPulseAction,
  banks: SlurpReactionBanks,
  fanTypes: readonly SlurpFanType[],
  characterFanPinnedTypeIds: ReadonlyMap<string, string | null>,
): Promise<boolean> {
  const noodle = createSlurpStorage(db);
  const actor = await resolveActor(db, action.actorAccountId, characterFanPinnedTypeIds, fanTypes);
  if (!actor) return false;
  const isComment = action.kind === "comment";
  // Whose words these are. A comment is the only place the audience is heard, so it draws from the
  // actor's own Fan Type bank before the shared one.
  // An ambient account has no population row, so it is drawn onto a type by id, as the money pass
  // already does, rather than all sounding like the fallback type.
  const fanTypeId = !isComment
    ? null
    : actor.fanTypeId || actor.archetype
      ? slurpResolveFanType(fanTypes, actor).id
      : slurpPickFanType(fanTypes, actor.id).id;
  const result = await noodle.createNoodlerWorldInteraction(action.postId, {
    creatorAccountId: action.creatorAccountId,
    actorId: actor.id,
    type: isComment ? "reply" : "like",
    // Tier 1 copy, so this stays free: the pulse runs unattended and must never call the model.
    content: isComment
      ? slurpAudienceReactionFrom(
          `${action.postId}:${actor.id}`,
          slurpReactionBodiesForType(banks, fanTypeId, SLURP_SHIPPED_TYPE_REACTIONS[fanTypeId ?? ""] ?? []),
        )
      : null,
  });
  if (!result) return false;
  const advance = slurpPulseTieAdvance(action.kind, result.created);
  if (!advance) return false;
  const population = createSlurpPopulationStorage(db);
  // A follow whose like row already existed counts only when it actually moves the tie.
  const before = result.created
    ? null
    : await population.ensureTie(actor.id, action.creatorAccountId).catch(() => null);
  const after = await population.advanceTie(actor.id, action.creatorAccountId, advance).catch(() => null);
  if (!result.created && (!before || !after || after.stage === before.stage)) return false;
  await population.touch(actor.id).catch(() => undefined);
  return true;
}
