import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { isSlurpCharacterFanAccount } from "../../../../../shared/src/slp/slp-audience-characters.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createSlurpMessagesStorage } from "../../data/slp-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import {
  slurpFanTypeForPinnedOrSeed,
  slurpFanTypeWeeklyBudget,
  slurpPickFanType,
  slurpResolveFanType,
  type SlurpFanType,
} from "../../../../../shared/src/slp/slp-fan-types.js";
import {
  slurpAudienceOpener,
  slurpFanNote,
  slurpPartnerCommentBodies,
  slurpAudienceQuestion,
  slurpAudienceReactionFrom,
  slurpRivalryBodies,
  slurpCoupleReactionBodies,
  SLURP_SHIPPED_TYPE_REACTIONS,
  slurpCommissionBrief,
  slurpCreatorPeerComment,
} from "../../modules/world/slp-world-copy.js";
import { slurpReactionBodiesForType, type SlurpReactionBanks } from "../../modules/world/slp-reaction-bank.js";
import { enqueueSlurpPendingText } from "./slp-pending-text-service.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { readSlurpCouplePartnerOf } from "../../data/projects/slp-creator-ties-storage.js";
import { readSlurpTieStamp } from "../../modules/projects/slp-tie-stamp.js";
import { hash } from "../../modules/projects/slp-project.js";
import { planSlurpCreatorPeerReactions, type SlurpWorldAction } from "../../../../../shared/src/slp/slp-world.js";
import type { SlurpSettings } from "../../modules/settings/slp-settings.js";
import { slurpPulseTieAdvance, type SlurpPulseAction } from "../../../../../shared/src/slp/slp-world-pulse.js";

/** The local day, so a per-pair roll is made once a day rather than on every page load. */
/** The Creator the player's page is with, when the fans know: they write about her now and then. */
async function publicPartnerName(db: DB, pageId: string): Promise<string | null> {
  const couple = await readSlurpCouplePartnerOf(db, pageId).catch(() => null);
  // Only once it is official and public: dating is "not official in public yet".
  if (!couple || couple.secret || (couple.stage !== "together" && couple.stage !== "rocky")) return null;
  return (
    (
      await createSlurpStorage(db)
        .getNoodlerAccountById(couple.partnerId)
        .catch(() => null)
    )?.displayName ?? null
  );
}

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
  settings: Pick<SlurpSettings, "fanTypes" | "messagesFanOpeners" | "messagesCommissionOpeners">,
  characterFanPinnedTypeIds: ReadonlyMap<string, string | null>,
): Promise<boolean> {
  const { fanTypes } = settings;
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
    // A collab post pays both pages.
    await noodle.creditPostIncome(action.postId, action.creatorAccountId, action.amount, "unlock", operationId);
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
    // The player's own page: a fan writes a note there, never a chat the player has to keep up.
    const target = await noodle.getNoodlerAccountById(action.creatorAccountId).catch(() => null);
    if (target?.kind === "persona" && target.sourceKind === "persona" && target.sourceEntityId) {
      const note = await createSlurpEventsStorage(db).recordAndPrune({
        recipientPersonaId: target.sourceEntityId,
        kind: "fan_note",
        creatorAccountId: target.id,
        subjectId: actor.id,
        actorLabel: actor.id,
        note: slurpFanNote(
          `${target.id}:${actor.id}:${at.toISOString()}`,
          settings.messagesFanOpeners,
          await publicPartnerName(db, target.id),
        ),
        operationId: `fan-note:${target.id}:${actor.id}:${localDayKey(at)}`,
      });
      if (!note) return false;
      await createSlurpPopulationStorage(db)
        .advanceTie(actor.id, target.id, { stage: "viewer", interactions: 1 })
        .catch(() => undefined);
      return true;
    }
    const messages = createSlurpMessagesStorage(db, () => noodle);
    const sent = await messages.sendViewerMessage(
      action.actorAccountId,
      action.creatorAccountId,
      slurpAudienceOpener(
        `${action.creatorAccountId}:${action.actorAccountId}:${at.toISOString()}`,
        settings.messagesFanOpeners,
      ),
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
    const messages = createSlurpMessagesStorage(db, () => noodle);
    const brief = slurpCommissionBrief(
      `${action.creatorAccountId}:${action.actorAccountId}:${at.toISOString()}`,
      settings.messagesCommissionOpeners,
    );
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
  const sides = isComment ? await rivalrySides(noodle, action.postId) : null;
  // Somebody she is publicly with: now and then the crowd talks to her about them (her public side).
  const partner =
    isComment && !sides && hash(`${action.postId}:${actor.id}:partner`) % 4 === 0
      ? await publicPartnerName(db, action.creatorAccountId)
      : null;
  const result = await noodle.createNoodlerWorldInteraction(action.postId, {
    creatorAccountId: action.creatorAccountId,
    actorId: actor.id,
    type: isComment ? "reply" : "like",
    // Tier 1 copy, so this stays free: the pulse runs unattended and must never call the model.
    // Under a rivalry post about half the crowd picks a side (7b-c); under a couple post they ship or mourn.
    content: isComment
      ? slurpAudienceReactionFrom(
          `${action.postId}:${actor.id}`,
          sides && hash(`${action.postId}:${actor.id}:side`) % 2 === 0
            ? sides.moment !== undefined
              ? slurpCoupleReactionBodies(sides.self, sides.rival, sides.moment)
              : slurpRivalryBodies(sides.self, sides.rival)
            : partner
              ? slurpPartnerCommentBodies(partner)
              : slurpReactionBodiesForType(banks, fanTypeId, SLURP_SHIPPED_TYPE_REACTIONS[fanTypeId ?? ""] ?? []),
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

/** What fans say under a rivalry or a couple post, or null for any other post. */
async function rivalrySides(
  noodle: ReturnType<typeof createSlurpStorage>,
  postId: string,
): Promise<{ self: string; rival: string; moment?: string } | null> {
  const post = await noodle.getNoodlerPostById(postId).catch(() => null);
  const stamp = post ? readSlurpTieStamp(post.metadata) : null;
  if (!post || (stamp?.kind !== "rival" && stamp?.kind !== "couple") || !stamp.partnerId) return null;
  // On a shared page the post's author is the page; the fans talk about the one who wrote it.
  const [self, rival] = await Promise.all([
    noodle.getNoodlerAccountById(stamp.hostId ?? post.authorAccountId),
    noodle.getNoodlerAccountById(stamp.partnerId),
  ]);
  if (!self || !rival) return null;
  // A couple post: `rival` is the partner, and the fans' mood follows the moment.
  return {
    self: self.displayName,
    // A secret couple with the player: the fans only know there is somebody.
    rival: stamp.secret ? "mystery bae" : rival.displayName,
    ...(stamp.kind === "couple" ? { moment: stamp.moment ?? "" } : {}),
  };
}

/**
 * Creators noticing each other (#1): now and then a like or a short comment on another Creator's
 * public post, persona Creators' posts included. Tier 1 copy, so it stays free like the replies.
 */
export async function applySlurpCreatorPeerReactions(
  db: DB,
  input: {
    accounts: readonly SlpAccount[];
    automaticCreators: readonly SlpAccount[];
    postsByAccount: ReadonlyMap<string, readonly { id: string; access: string; createdAt: string }[]>;
    cutoff: string;
    until: Date;
  },
): Promise<void> {
  const noodle = createSlurpStorage(db);
  const posts = input.accounts
    .filter((account) => !isSlurpCharacterFanAccount(account))
    .flatMap((account) =>
      (input.postsByAccount.get(account.id) ?? [])
        .filter((post) => post.access === "public" && post.createdAt >= input.cutoff)
        .map((post) => ({ postId: post.id, creatorAccountId: account.id })),
    );
  const existing = await noodle.listNoodlerInteractions(posts.map((post) => post.postId)).catch((error) => {
    logger.warn(error, "[slurp-world] Could not read Creator peer reactions");
    return null;
  });
  if (!existing) return;
  const reactions = planSlurpCreatorPeerReactions({
    actorAccountIds: input.automaticCreators.map((account) => account.id),
    posts,
    reacted: new Set(
      existing.filter((entry) => !entry.parentInteractionId).map((entry) => `${entry.actorAccountId}:${entry.postId}`),
    ),
    hourSeed: input.until.toISOString().slice(0, 13),
  });
  for (const reaction of reactions) {
    await noodle
      .createInteraction(reaction.postId, {
        actorAccountId: reaction.actorAccountId,
        type: reaction.kind === "comment" ? "reply" : "like",
        ...(reaction.kind === "comment"
          ? { content: slurpCreatorPeerComment(`${reaction.actorAccountId}:${reaction.postId}`) }
          : {}),
      })
      .catch((error) => logger.warn(error, "[slurp-world] Could not add a Creator peer %s", reaction.kind));
  }
}
