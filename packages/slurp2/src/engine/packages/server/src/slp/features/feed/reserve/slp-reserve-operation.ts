import type { DB } from "../../../../db/connection.js";
import { slpIsBackgroundBusy, slpAdmissionRejectionCause } from "../../../base/host/slp-admission.js";
import { recordSlurpContinuityEvent } from "../../../data/continuity/slp-continuity-storage.js";
import { slurpContinuityIdentityOf } from "../../../modules/continuity/slp-continuity-rules.js";
import { completeSlurpCampaignStageFor } from "../../../data/feed/slp-campaign-storage.js";
import { createConnectionsStorage } from "../../../../services/storage/connections.storage.js";
import { resolveSlurpTextConnection } from "../../../base/identity/slp-connection.js";
import { resolveCreatorImageConnectionId } from "../../../base/media/slp-image-connections.js";
import { createSlurpStorage } from "../../../data/slp-storage.js";
import { slpCreatorReservePolicyFingerprint } from "../../../modules/records/slp-storage-model.js";
import { hasSlurpCreatorPostingIntervalConflict } from "../../../modules/feed/slp-posting-interval.js";
import { generateCreatorPost, resolveSlurpAutomaticPostAccess } from "../slp-generation-service.js";
import { slurpDeepDetailsImageRunRecorder } from "../../../data/feed/slp-post-deep-details-storage.js";
import { recordSlurpPromiseKept } from "../slp-post-plan-service.js";
import { generateCreatorPostImage } from "../../media/slp-media-contract.js";
import { tryCreatorAccountOperation } from "../../../base/locking/slp-account-operation-lock.js";
import { createCharactersStorage } from "../../../../services/storage/characters.storage.js";
import { createPromptOverridesStorage } from "../../../../services/storage/prompt-overrides.storage.js";
import {
  runSlurpAutoPostPollOperations,
  type SlurpReservePollOutcome,
} from "../../../modules/feed/slp-autopost-poll.js";
import { logger } from "../../../../lib/logger.js";
import { createCharacterGalleryStorage } from "../../../../services/storage/character-gallery.storage.js";
import { createChatsStorage } from "../../../../services/storage/chats.storage.js";
import { createGalleryStorage } from "../../../../services/storage/gallery.storage.js";
import { pickGalleryAttachmentForAccount } from "../slp-generated-activity-service.js";
import { slurpPlanSlot } from "../../../modules/feed/slp-planner.js";
import { slurpCreatorStrategy } from "../../../modules/creators/slp-creator-strategy.js";
import {
  completeSlurpOpportunity,
  findSlurpOpportunityBySlot,
  planSlurpOpportunity,
  slurpSkippedLastSlot,
} from "../../../data/feed/slp-opportunity-storage.js";

const DAY_MS = 24 * 60 * 60 * 1000;

class SlpCreatorAttemptUnavailableError extends Error {
  constructor(readonly status: "exhausted" | "holding") {
    super(`Automatic Slurp attempt ${status}.`);
  }
}

function plannedPublicationTimes(now: Date, postsPerDay: number): string[] {
  const interval = DAY_MS / postsPerDay;
  return Array.from({ length: postsPerDay }, (_, index) =>
    new Date(now.getTime() + interval * (index + 1)).toISOString(),
  );
}

export function isCreatorNightQuietTime(at: Date): boolean {
  const hour = at.getHours();
  return hour >= 23 || hour < 7;
}

export async function prepareNextCreatorReservePost(db: DB, at = new Date()): Promise<SlurpReservePollOutcome> {
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.autoPostingScheduleEnabled || settings.postsPerDay <= 0) return "disabled";
  const state = await noodle.ensureNoodlerReserveState(at);
  if (at.getTime() < Date.parse(state.preparationNotBefore)) return "holding";

  const [items, accounts] = await Promise.all([
    noodle.listNoodlerPreparedPosts(),
    noodle.listAutoPostEnabledAccounts(),
  ]);
  if (accounts.length === 0) return "ineligible";
  // A slot leaves the working set once it is a whole interval overdue, which is also when
  // `reconcileNoodlerPreparedPosts` retires it. This was a hardcoded hour that happened to agree
  // with that constant and with nothing else: at 4 posts a day a slot stopped being fillable an
  // hour after its time while its replacement was still five hours away.
  const active = items.filter(
    (item) =>
      (item.state === "scheduled" || item.state === "prepared") &&
      Date.parse(item.publishAt) > at.getTime() - DAY_MS / settings.postsPerDay,
  );
  const existingSlot = active
    .filter((item) => item.state === "scheduled")
    .filter((item) => settings.autoPostGenerationMode === "pre_generate" || Date.parse(item.publishAt) <= at.getTime())
    .sort((left, right) => Date.parse(left.publishAt) - Date.parse(right.publishAt))[0];
  let slotId = existingSlot?.id ?? null;
  let publishAt = existingSlot?.publishAt ?? null;
  let account = existingSlot ? accounts.find((candidate) => candidate.id === existingSlot.creatorAccountId) : null;

  if (!existingSlot) {
    const covered = active.map((item) => item.publishAt);
    // A candidate is covered when an existing slot is within a whole interval of it, matching the
    // per-creator spacing rule below. This used to be half an interval, and the two disagreeing is
    // why `postsPerDay` did not mean posts per day: a candidate half an interval after an existing
    // slot read as uncovered, and with a spare Creator to hand the per-creator rule let it through,
    // so the reserve laid down twice the requested number of slots. `reconcileNoodlerPreparedPosts`
    // then capped future slots back to `postsPerDay` and discarded the surplus, which is why a
    // production install had a hundred discarded rows against forty-two published, some of them
    // destroyed four minutes after they were created.
    publishAt =
      plannedPublicationTimes(at, settings.postsPerDay).find(
        (candidate) =>
          !covered.some(
            (existing) => Math.abs(Date.parse(existing) - Date.parse(candidate)) < DAY_MS / settings.postsPerDay,
          ),
      ) ?? null;
    if (!publishAt) return "covered";
    let eligibleAccounts = accounts;
    if (settings.nightQuiet && isCreatorNightQuietTime(new Date(publishAt))) {
      eligibleAccounts = accounts.filter((candidate) => candidate.kind !== "character");
    }
    if (eligibleAccounts.length === 0) return "ineligible";

    // `Date.parse("0")` is not zero — V8 reads it as the year 2000 — so an account that has never
    // posted must contribute a real 0 rather than a parsed sentinel. The reads are independent, so
    // fan them out instead of walking the creator list one round trip at a time.
    const activityTimes = new Map(
      await Promise.all(
        eligibleAccounts.map(async (candidate): Promise<[string, number[]]> => {
          const posts = await noodle.listNoodlerPostsByAccount(candidate.id, 1);
          const scheduledTimes = active
            .filter((item) => item.creatorAccountId === candidate.id)
            .map((item) => Date.parse(item.publishAt));
          return [candidate.id, [...posts.map((post) => Date.parse(post.createdAt)), ...scheduledTimes]];
        }),
      ),
    );
    eligibleAccounts = eligibleAccounts.filter(
      (candidate) =>
        !hasSlurpCreatorPostingIntervalConflict(
          activityTimes.get(candidate.id) ?? [],
          Date.parse(publishAt),
          settings.postsPerDay,
        ),
    );
    if (eligibleAccounts.length === 0) return "holding";
    account = [...eligibleAccounts].sort(
      (left, right) =>
        Math.max(...(activityTimes.get(left.id) ?? []), 0) - Math.max(...(activityTimes.get(right.id) ?? []), 0) ||
        left.id.localeCompare(right.id),
    )[0]!;
    const source = await noodle.resolveAccountSource(account);
    slotId = await noodle.createNoodlerScheduledPost({
      creatorAccountId: account.id,
      publishAt,
      policyFingerprint: slpCreatorReservePolicyFingerprint(account, settings, source?.updatedAt ?? null),
      createdAt: at.toISOString(),
    });
    if (!slotId) return "holding";
    if (settings.autoPostGenerationMode === "on_demand") return "scheduled";
  }
  if (!account || !slotId || !publishAt) return "ineligible";
  const selectedAccount = account;
  const selectedSlotId = slotId;
  const selectedPublishAt = publishAt;

  const locked = await tryCreatorAccountOperation(selectedAccount.id, async () => {
    const connection = await resolveSlurpTextConnection(createConnectionsStorage(db), settings.generationConnectionId);
    if (!connection) return "ineligible" as const;
    // Whether this Creator posts at all, decided before any model is called. A quiet slot costs
    // nothing: no text, no image, no attempt claim, and no failure mark. See `slp-planner.ts`.
    const planned = await findSlurpOpportunityBySlot(db, selectedSlotId);
    const decision =
      planned?.workflow === "skip"
        ? { skip: true as const, reason: planned.skipReason ?? ("quiet_day" as const) }
        : planned
          ? { skip: false as const }
          : slurpPlanSlot(selectedAccount.id, await noodle.countNoodlerPostsByAccount(selectedAccount.id), {
              skippedLast: await slurpSkippedLastSlot(db, selectedAccount.id),
              skipRate: slurpCreatorStrategy(selectedAccount.id, selectedAccount.settings.strategy).skipRate,
            });
    if (decision.skip) {
      await planSlurpOpportunity(db, {
        creatorAccountId: selectedAccount.id,
        slotId: selectedSlotId,
        sequence: await noodle.countNoodlerPostsByAccount(selectedAccount.id),
        workflow: "skip",
        skipReason: decision.reason,
        at,
        dueAt: new Date(selectedPublishAt),
      });
      await noodle.skipNoodlerScheduledPost(selectedSlotId, selectedPublishAt, at);
      // A quiet slot is part of the Creator's history too: later planning can see a quiet day.
      // Private, because nobody announces the post they did not make.
      const identity = slurpContinuityIdentityOf(selectedAccount);
      if (identity) {
        await recordSlurpContinuityEvent(db, {
          ...identity,
          eventType: "chosen_skip",
          source: "slurp_post",
          realityScope: "slurp",
          audienceScope: "creator_private",
          payload: { reason: decision.reason },
          relatedIds: [selectedSlotId],
          fingerprint: `skip:${selectedSlotId}`,
          contribution: "system",
          occurredAt: new Date(selectedPublishAt),
        }).catch((error: unknown) => logger.warn(error, "[slurp] Could not record a chosen skip in continuity"));
      }
      return "skipped" as const;
    }
    try {
      let payload = await generateCreatorPost(db, {
        account: selectedAccount,
        connection,
        prepareOnly: true,
        slotId: selectedSlotId,
        admissionMode: {
          kind: "background",
          beforeAttempt: async () => {
            const claim = await noodle.claimNoodlerAutomaticAttempt("text", settings.postsPerDay, at);
            if (claim.status !== "claimed") throw new SlpCreatorAttemptUnavailableError(claim.status);
            return (outcome) => noodle.completeNoodlerAutomaticAttempt(claim.claimId, outcome);
          },
        },
        request: {
          mode: "noodler",
          targetAccountId: selectedAccount.id,
          // No format and no guide. Both used to be pinned here, and between them they defeated
          // every variety mechanism on the one path that generates most posts: the format was
          // always `caption`, and the constant guide read as player direction, which makes the
          // generator stand its rotating variation down. The guide also said nothing the system prompt
          // does not already say.
          access: await resolveSlurpAutomaticPostAccess(noodle, selectedAccount.id),
        },
        publicationTime: new Date(selectedPublishAt),
        generatedAt: at,
      });
      // A reused picture arrives already staged. It is promoted or dropped exactly like a generated
      // one below, and never written into the stored payload as an object.
      const { stagedMedia: reusedMedia, ...prepared } = payload;
      payload = prepared;
      let stagedMedia: { promote: () => void; compensate: () => void } | null = reusedMedia ?? null;
      if (selectedAccount.settings.scheduler.autoPosting?.imagesEnabled && payload.imagePrompt) {
        const imageConnectionId = await resolveCreatorImageConnectionId(db, selectedAccount.id);
        // Fall back to the default image connection when a creator's mapped
        // override was deleted (getWithKey returns null), instead of silently
        // skipping scheduled image generation.
        const imageConnection =
          (imageConnectionId ? await createConnectionsStorage(db).getWithKey(imageConnectionId) : null) ??
          (await createConnectionsStorage(db).getDefaultForImageGeneration());
        if (imageConnection) {
          try {
            const linkedPublicAccount = await noodle.resolveAccountSource(selectedAccount);
            const image = await generateCreatorPostImage({
              account: selectedAccount,
              linkedPublicAccount,
              disclosureMode: selectedAccount.settings.privacy.identityDisclosure ?? "open",
              postContent: payload.content,
              draftPrompt: payload.imagePrompt,
              visualBrief: payload.visualBrief ?? undefined,
              settings,
              characters: createCharactersStorage(db),
              promptOverrides: createPromptOverridesStorage(db),
              imageConnection,
              db,
              debugMode: false,
              // An image is part of the post, not a separately-budgeted item: the daily cap
              // lives on the post (the text claim above) and the schedule already bounds how
              // many posts a day exist. Booking a second "image" budget only created a phantom
              // limiter that drained on its own — most visibly when image generation failed —
              // and made "8 posts/day" secretly mean two pools of 8. Keep background admission
              // for connection concurrency, but book no separate image quota.
              admissionMode: { kind: "background" },
              onImageRun: slurpDeepDetailsImageRunRecorder(db, payload.metadata.deepDetailsId, "reserve"),
            });
            // Promotion is deferred until the prepared row is durably committed below: a file
            // promoted first is owned by nothing if the row never lands, and staged files are
            // swept on restart.
            stagedMedia = image.stagedMedia ?? null;
            payload = {
              ...payload,
              metadata: { ...payload.metadata, ...image.metadata },
            };
          } catch (error) {
            if (
              slpIsBackgroundBusy(error) ||
              slpAdmissionRejectionCause(error) instanceof SlpCreatorAttemptUnavailableError
            ) {
              payload = {
                ...payload,
                metadata: {
                  ...payload.metadata,
                  imageGenerationDeferred: true,
                },
              };
            } else {
              payload = {
                ...payload,
                metadata: { ...payload.metadata, imageGenerationFailed: true },
              };
            }
          }
        } else {
          payload = {
            ...payload,
            metadata: {
              ...payload.metadata,
              imageGenerationFailed: true,
              imageGenerationError: "No image generation connection is configured.",
            },
          };
        }
      }
      // No generated picture, so the source character's gallery may supply one. A deferred image is
      // still coming and is left alone; a gallery image is finished, so the failure marks go.
      if (
        settings.allowGalleryImageAttachments &&
        payload.metadata.contentDelivery !== "text_only" &&
        typeof payload.metadata.noodlerMediaPath !== "string" &&
        payload.metadata.imageGenerationDeferred !== true
      ) {
        const source = await noodle.resolveAccountSource(selectedAccount);
        const attachment =
          source?.kind === "character"
            ? await pickGalleryAttachmentForAccount({
                account: source,
                chats: createChatsStorage(db),
                gallery: createGalleryStorage(db),
                characterGallery: createCharacterGalleryStorage(db),
              }).catch((error: unknown) => {
                logger.warn(error, "[slurp] Could not attach a gallery image for %s", selectedAccount.displayName);
                return null;
              })
            : null;
        if (attachment) {
          const { imageGenerationFailed: _failed, imageGenerationError: _error, ...metadata } = payload.metadata;
          payload = {
            ...payload,
            metadata: { ...metadata, ...attachment.metadata, galleryAttachmentImageUrl: attachment.imageUrl },
          };
        }
      }
      const completedAt = new Date();
      try {
        const filled = await noodle.fillNoodlerScheduledPost(selectedSlotId, {
          generatedAt: completedAt.toISOString(),
          expectedPublishAt: selectedPublishAt,
          payload,
          policyFingerprint: slpCreatorReservePolicyFingerprint(
            selectedAccount,
            settings,
            (await noodle.resolveAccountSource(selectedAccount))?.updatedAt ?? null,
          ),
        });
        if (!filled) {
          stagedMedia?.compensate();
          return "missed" as const;
        }
        // The plan is executed once the slot holds it. Publishing it later is mechanical.
        const opportunity = await findSlurpOpportunityBySlot(db, selectedSlotId);
        if (opportunity) {
          await completeSlurpOpportunity(db, opportunity.id, { at: completedAt });
          // The set's post id is not known until it publishes, so a scheduled set's teaser falls
          // back to the newest locked picture, which by then is normally that set.
          await completeSlurpCampaignStageFor(db, opportunity.id, { at: completedAt });
          await recordSlurpPromiseKept(db, opportunity, { at: completedAt });
        }
      } catch (persistError) {
        // The row never landed, so the staged image belongs to nothing: drop it before rethrowing.
        stagedMedia?.compensate();
        throw persistError;
      }
      // The row is durable now, so the file it references can take its final name. A crash
      // between the two leaves a row whose media is missing, which reconciliation clears.
      stagedMedia?.promote();
      return "prepared" as const;
    } catch (error) {
      if (slpIsBackgroundBusy(error)) return "busy" as const;
      const rejection = slpAdmissionRejectionCause(error);
      if (rejection instanceof SlpCreatorAttemptUnavailableError) return rejection.status;
      throw error;
    }
  });
  return locked.acquired ? locked.value : "busy";
}

export async function reconcileCreatorReserve(db: DB, at = new Date()): Promise<number> {
  const noodle = createSlurpStorage(db);
  await noodle.reconcileNoodlerPreparedPosts(at);
  return noodle.publishDueNoodlerPreparedPosts(at);
}

export async function runCreatorAutoPostPoll(
  db: DB,
  at = new Date(),
): Promise<{ published: number; reserve: Awaited<ReturnType<typeof prepareNextCreatorReservePost>> }> {
  const noodle = createSlurpStorage(db);
  return runSlurpAutoPostPollOperations({
    reconcile: async () => {
      await noodle.reconcileNoodlerPreparedPosts(at);
    },
    publishDue: () => noodle.publishDueNoodlerPreparedPosts(at),
    prepare: () => prepareNextCreatorReservePost(db, at),
    generationMode: async () => (await noodle.getSettings()).autoPostGenerationMode,
  });
}
