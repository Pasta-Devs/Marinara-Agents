import type { DB } from "../../db/connection.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { resolveNoodlerImageConnectionId } from "./slurp-image-connections.js";
import { createSlurpStorage, noodlerReservePolicyFingerprint } from "../storage/slurp.storage.js";
import { generateNoodlerPost } from "./slurp-generation.service.js";
import { generateNoodlerPostImage } from "./slurp-images.service.js";
import { tryNoodlerAccountOperation } from "./slurp-account-operation-lock.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { BackgroundConnectionBusyError, ConnectionAttemptRejectedError } from "../generation/connection-admission.js";
import { runSlurpAutoPostPollOperations, type SlurpReservePollOutcome } from "./slurp-autopost-poll.js";

const DAY_MS = 24 * 60 * 60 * 1000;

class NoodlerAttemptUnavailableError extends Error {
  constructor(readonly status: "exhausted" | "holding") {
    super(`Automatic NoodleR attempt ${status}.`);
  }
}

function plannedPublicationTimes(now: Date, postsPerDay: number): string[] {
  const interval = DAY_MS / postsPerDay;
  return Array.from({ length: postsPerDay }, (_, index) =>
    new Date(now.getTime() + interval * (index + 1)).toISOString(),
  );
}

export function isNoodlerNightQuietTime(at: Date): boolean {
  const hour = at.getHours();
  return hour >= 23 || hour < 7;
}

export async function prepareNextNoodlerReservePost(db: DB, at = new Date()): Promise<SlurpReservePollOutcome> {
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
  const active = items.filter(
    (item) =>
      (item.state === "scheduled" || item.state === "prepared") &&
      Date.parse(item.publishAt) > at.getTime() - DAY_MS / 24,
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
    publishAt =
      plannedPublicationTimes(at, settings.postsPerDay).find(
        (candidate) =>
          !covered.some(
            (existing) => Math.abs(Date.parse(existing) - Date.parse(candidate)) < DAY_MS / settings.postsPerDay / 2,
          ),
      ) ?? null;
    if (!publishAt) return "covered";
    let eligibleAccounts = accounts;
    if (settings.nightQuiet && isNoodlerNightQuietTime(new Date(publishAt))) {
      eligibleAccounts = accounts.filter((candidate) => candidate.kind !== "character");
    }
    if (eligibleAccounts.length === 0) return "ineligible";

    // `Date.parse("0")` is not zero — V8 reads it as the year 2000 — so an account that has never
    // posted must contribute a real 0 rather than a parsed sentinel. The reads are independent, so
    // fan them out instead of walking the creator list one round trip at a time.
    const lastActivity = new Map(
      await Promise.all(
        eligibleAccounts.map(async (candidate): Promise<[string, number]> => {
          const posts = await noodle.listNoodlerPostsByAccount(candidate.id, 1);
          const scheduledTimes = active
            .filter((item) => item.creatorAccountId === candidate.id)
            .map((item) => Date.parse(item.publishAt));
          const lastPostedAt = posts[0] ? Date.parse(posts[0].createdAt) : 0;
          return [candidate.id, Math.max(lastPostedAt, ...scheduledTimes, 0)];
        }),
      ),
    );
    account = [...eligibleAccounts].sort(
      (left, right) =>
        (lastActivity.get(left.id) ?? 0) - (lastActivity.get(right.id) ?? 0) || left.id.localeCompare(right.id),
    )[0]!;
    const source = await noodle.resolveAccountSource(account);
    slotId = await noodle.createNoodlerScheduledPost({
      creatorAccountId: account.id,
      publishAt,
      policyFingerprint: noodlerReservePolicyFingerprint(account, settings, source?.updatedAt ?? null),
      createdAt: at.toISOString(),
    });
    if (settings.autoPostGenerationMode === "on_demand") return "scheduled";
  }
  if (!account || !slotId || !publishAt) return "ineligible";
  const selectedAccount = account;
  const selectedSlotId = slotId;
  const selectedPublishAt = publishAt;

  const locked = await tryNoodlerAccountOperation(selectedAccount.id, async () => {
    const connections = createConnectionsStorage(db);
    const connection = settings.generationConnectionId
      ? await connections.getWithKey(settings.generationConnectionId)
      : await connections.getDefaultForAgents();
    if (!connection) return "ineligible" as const;
    try {
      let payload = await generateNoodlerPost(db, {
        account: selectedAccount,
        connection,
        prepareOnly: true,
        admissionMode: {
          kind: "background",
          beforeAttempt: async () => {
            const claim = await noodle.claimNoodlerAutomaticAttempt("text", settings.postsPerDay, at);
            if (claim.status !== "claimed") throw new NoodlerAttemptUnavailableError(claim.status);
            return (outcome) => noodle.completeNoodlerAutomaticAttempt(claim.claimId, outcome);
          },
        },
        request: {
          mode: "noodler",
          targetAccountId: selectedAccount.id,
          format: "caption",
          access: "locked",
          noodlerPostGuide: "Write a standalone scheduled Slurp post.",
        },
        publicationTime: new Date(selectedPublishAt),
        generatedAt: at,
      });
      let stagedMedia: { promote: () => void; compensate: () => void } | null = null;
      if (selectedAccount.settings.scheduler.autoPosting?.imagesEnabled && payload.imagePrompt) {
        const imageConnectionId = await resolveNoodlerImageConnectionId(db, selectedAccount.id);
        // Fall back to the default image connection when a creator's mapped
        // override was deleted (getWithKey returns null), instead of silently
        // skipping scheduled image generation.
        const imageConnection =
          (imageConnectionId ? await createConnectionsStorage(db).getWithKey(imageConnectionId) : null) ??
          (await createConnectionsStorage(db).getDefaultForImageGeneration());
        if (imageConnection) {
          try {
            const linkedPublicAccount = await noodle.resolveAccountSource(selectedAccount);
            const image = await generateNoodlerPostImage({
              account: selectedAccount,
              linkedPublicAccount,
              disclosureMode: selectedAccount.settings.privacy.identityDisclosure ?? "secret",
              postContent: payload.content,
              draftPrompt: payload.imagePrompt,
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
              error instanceof BackgroundConnectionBusyError ||
              (error instanceof ConnectionAttemptRejectedError && error.cause instanceof NoodlerAttemptUnavailableError)
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
      const completedAt = new Date();
      try {
        const filled = await noodle.fillNoodlerScheduledPost(selectedSlotId, {
          generatedAt: completedAt.toISOString(),
          expectedPublishAt: selectedPublishAt,
          payload,
          policyFingerprint: noodlerReservePolicyFingerprint(
            selectedAccount,
            settings,
            (await noodle.resolveAccountSource(selectedAccount))?.updatedAt ?? null,
          ),
        });
        if (!filled) {
          stagedMedia?.compensate();
          return "missed" as const;
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
      if (error instanceof BackgroundConnectionBusyError) return "busy" as const;
      if (error instanceof ConnectionAttemptRejectedError && error.cause instanceof NoodlerAttemptUnavailableError) {
        return error.cause.status;
      }
      throw error;
    }
  });
  return locked.acquired ? locked.value : "busy";
}

export async function reconcileNoodlerReserve(db: DB, at = new Date()): Promise<number> {
  const noodle = createSlurpStorage(db);
  await noodle.reconcileNoodlerPreparedPosts(at);
  return noodle.publishDueNoodlerPreparedPosts(at);
}

export async function runNoodlerAutoPostPoll(
  db: DB,
  at = new Date(),
): Promise<{ published: number; reserve: Awaited<ReturnType<typeof prepareNextNoodlerReservePost>> }> {
  const noodle = createSlurpStorage(db);
  return runSlurpAutoPostPollOperations({
    reconcile: async () => {
      await noodle.reconcileNoodlerPreparedPosts(at);
    },
    publishDue: () => noodle.publishDueNoodlerPreparedPosts(at),
    prepare: () => prepareNextNoodlerReservePost(db, at),
    generationMode: async () => (await noodle.getSettings()).autoPostGenerationMode,
  });
}
