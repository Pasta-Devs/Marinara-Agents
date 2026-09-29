import { z } from "zod";
import {
  isSlurpCharacterFanAccount,
  slurpAccountRowIsCreator,
  slurpCharacterIdFromFanEntityId,
} from "../../../../../shared/src/slp/slp-audience-characters.js";
import { previewSlurpAutopurge, runSlurpAutopurge } from "./slp-autopurge.js";
import {
  slpAccounts,
  slpPosts,
  slpInteractions,
  slurpMessages,
  slpRefreshRuns,
  slpCreatorPreparedPosts,
  slpCreatorFirstPostJobs,
  slurpImprovementJobs,
  slurpFollowUps,
  slurpThreads,
} from "../../../db/schema/slurp.js";
import { readSlurpStirPlays } from "../../data/assist/slp-stir-plays-storage.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../data/slp-storage.js";
import { mapThread } from "../../data/messages/slp-messages-storage-helpers.js";
import { slurpPulseNext, slurpPulsePlayTasks, slurpUpcomingAnnualEvents } from "../../modules/maintenance/slp-pulse.js";
import { now } from "../../../utils/id-generator.js";
import {
  getSlurpOperationStatus,
  isSlpOperationActive,
  trySlurpDataDeletion,
} from "../../base/locking/slp-operation-lock.js";
import { summarizeCreatorMedia, removeCreatorAccountMedia, removeAllCreatorMedia } from "../../base/media/slp-media.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import {
  getCreatorImageConnections,
  updateCreatorImageConnections,
  clearCreatorImageConnections,
} from "../../base/media/slp-image-connections.js";
import { getSlurpPostGuidance, updateSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import { isAmbientSlpAccount, dismissAmbientSlpAccount } from "../../data/audience/slp-ambient-profiles.js";
import { getCreatorFanActivityStatus } from "../audience/slp-audience-contract.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

export async function slpMaintenanceRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  const autopurgePreviewSchema = z.object({
    autopurgeRetentionValue: z.number().int().min(1).max(3650),
    autopurgeRetentionUnit: z.enum(["days", "weeks", "months"]),
    autopurgeKeepPosts: z.boolean(),
    autopurgeIncludeMessageMedia: z.boolean(),
  });
  app.post("/autopurge/preview", async (req, reply) => {
    const body = autopurgePreviewSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const settings = await noodle.getSlurpSettings();
    return previewSlurpAutopurge(app.db, { ...settings, ...body.data });
  });
  app.get("/maintenance/summary", async () => {
    const [accounts, posts, interactions, messages, unused] = await Promise.all([
      app.db.select().from(slpAccounts),
      app.db.select().from(slpPosts),
      app.db.select().from(slpInteractions),
      app.db.select().from(slurpMessages),
      noodle.previewUnusedSlurpData(),
    ]);
    return {
      generatedAt: now(),
      operations: getSlurpOperationStatus(),
      content: {
        creators: accounts.filter(slurpAccountRowIsCreator).length,
        posts: posts.length,
        interactions: interactions.length,
        messages: messages.length,
      },
      media: summarizeCreatorMedia(),
      unused,
    };
  });

  app.get("/slurp/tasks", async () => {
    const [refreshRuns, preparedPosts, firstPostJobs, improvementJobs, followUps, accounts, audience] =
      await Promise.all([
        app.db.select().from(slpRefreshRuns),
        app.db.select().from(slpCreatorPreparedPosts),
        app.db.select().from(slpCreatorFirstPostJobs),
        app.db.select().from(slurpImprovementJobs),
        app.db.select().from(slurpFollowUps),
        app.db.select().from(slpAccounts),
        getCreatorFanActivityStatus(app.db),
      ]);
    // Pulse (task C): Stir plays, what comes next, and how to try a failed task again.
    const slurp = createSlurpStorage(app.db);
    const [plays, threads, reserve, settings, occurrences] = await Promise.all([
      readSlurpStirPlays(app.db).catch(() => []),
      app.db.select().from(slurpThreads),
      slurp.getNoodlerReserveStatus().catch(() => null) as Promise<{
        creators: { accountId: string; slots: { id: string; publishAt: string }[] }[];
      } | null>,
      slurp.getSettings(),
      slurp.listStoryOccurrences().catch(() => []) as Promise<
        {
          id: string;
          blueprintId: string;
          status: string;
          startsAt: string;
          participantIds: readonly string[];
          blueprint: { name: string };
        }[]
      >,
    ]);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = (value: string) => Date.parse(value) >= cutoff;
    const terminal = new Set([
      "completed",
      "complete",
      "failed",
      "error",
      "abandoned",
      "published",
      "discarded",
      "sent",
      "cancelled",
    ]);
    const parseIds = (value: string) => {
      try {
        const parsed: unknown = JSON.parse(value || "[]");
        return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
      } catch {
        return [];
      }
    };
    const task = (input: {
      id: string;
      kind: string;
      status: string;
      createdAt?: string;
      updatedAt?: string;
      publishAt?: string;
      accountId?: string | null;
      accountIds?: string[];
      detail?: string | null;
      progress?: { completed: number; total: number } | null;
      /** What a tap opens: the post it made, or the chat it wrote in (the Creator is `accountIds[0]`). */
      postId?: string | null;
      viewerAccountId?: string | null;
      /** A failed task's way to try again: the same route the player's own button calls. */
      retry?: { path: string; body: unknown } | null;
    }) => ({ ...input, accountIds: input.accountIds ?? (input.accountId ? [input.accountId] : []) });
    const tasks = [
      ...(isSlpOperationActive("noodler-fan-activity")
        ? [
            task({
              id: "audience:active",
              kind: "audience-activity",
              status: "running",
              updatedAt: now(),
              detail: audience.lastRun?.error ?? `${audience.usedRuns}/${audience.runLimit} runs used today`,
            }),
          ]
        : []),
      ...refreshRuns
        .filter((row) => !terminal.has(row.status) || recent(row.updatedAt))
        .map((row) =>
          task({
            id: `refresh:${row.id}`,
            kind: "generate-posts",
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            accountIds: parseIds(row.activeAccountIds),
            detail: row.error,
            retry:
              row.status === "failed" && parseIds(row.activeAccountIds).length > 0
                ? { path: "/slurp/auto-post/refresh-targeted", body: { accountIds: parseIds(row.activeAccountIds) } }
                : null,
          }),
        ),
      ...preparedPosts
        .filter((row) => Date.parse(row.publishAt) > Date.now() || !terminal.has(row.state) || recent(row.updatedAt))
        .map((row) =>
          task({
            id: `prepared:${row.id}`,
            kind: Date.parse(row.publishAt) > Date.now() ? "scheduled-post" : "generate-post",
            status: Date.parse(row.publishAt) > Date.now() ? "scheduled" : row.state,
            createdAt: row.generatedAt,
            updatedAt: row.updatedAt,
            publishAt: row.publishAt,
            accountId: row.creatorAccountId,
            detail: Date.parse(row.publishAt) > Date.now() ? "Waiting for scheduled publish" : null,
          }),
        ),
      // A first post that made it or failed stays for a day, so Pulse can open it or say why.
      ...firstPostJobs
        .filter((row) => row.status === "running" || recent(row.updatedAt))
        .map((row) =>
          task({
            id: `first-post:${row.id}`,
            kind: "first-post",
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            accountId: row.creatorAccountId,
            detail: row.error,
            postId: row.postId,
            retry:
              row.status === "failed"
                ? {
                    path: "/slurp/first-posts/enqueue",
                    body: { executionId: `pulse-retry:${row.id}`, accountIds: [row.creatorAccountId] },
                  }
                : null,
          }),
        ),
      ...improvementJobs
        .filter((row) => !terminal.has(row.status) || recent(row.updatedAt))
        .map((row) =>
          task({
            id: `improvement:${row.id}`,
            kind: "creator-improvement",
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            accountIds: parseIds(row.accountIds),
            progress: { completed: Number(row.completed), total: Number(row.total) },
            detail: row.error,
          }),
        ),
      ...followUps
        .filter((row) => !terminal.has(row.status) || recent(row.updatedAt))
        .map((row) =>
          task({
            id: `follow-up:${row.id}`,
            // An opener was never promised; Pulse names it apart (task C).
            kind: row.type === "opener" ? "conversation-opener" : "conversation-follow-up",
            status: row.status,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            accountId: row.creatorAccountId,
            detail: row.reason,
            viewerAccountId: row.viewerAccountId,
          }),
        ),
      // Try again = play the steps that failed, nothing that already ran.
      ...slurpPulsePlayTasks(plays, new Date()).map((play) => {
        const entry = plays.find((candidate) => `play:${candidate.id}` === play.id);
        const failedSteps = entry?.steps
          .filter((step) => !step.ok)
          .map((step) => ({ action: step.action, input: step.input }));
        return task({
          ...play,
          retry:
            play.status === "failed" && failedSteps?.length
              ? { path: "/slurp/stir/play", body: { steps: failedSteps, origin: entry?.origin ?? "deck" } }
              : null,
        });
      }),
      ...(audience.lastRun && !isSlpOperationActive("noodler-fan-activity")
        ? [
            task({
              id: "audience:last-run",
              kind: "audience-activity",
              status: audience.lastRun.status,
              updatedAt: audience.lastRun.finishedAt ?? undefined,
              detail: audience.lastRun.error ?? `${audience.usedRuns}/${audience.runLimit} runs used today`,
              retry:
                audience.lastRun.status === "abandoned" ? { path: "/slurp/fan-activity/refresh-now", body: {} } : null,
            }),
          ]
        : []),
    ]
      .sort(
        (left, right) =>
          Date.parse(right.updatedAt ?? right.createdAt ?? "") - Date.parse(left.updatedAt ?? left.createdAt ?? ""),
      )
      .slice(0, 80);
    const at = new Date();
    const personaIds = new Set(accounts.filter((account) => account.kind === "persona").map((account) => account.id));
    const next = slurpPulseNext({
      now: at,
      slots: (reserve?.creators ?? []).flatMap((creator) =>
        creator.slots.map((slot) => ({ id: slot.id, accountId: creator.accountId, publishAt: slot.publishAt })),
      ),
      // Only the player's own chats: an AI fan is answered now and then, and never shown a time.
      replies: threads
        .map(mapThread)
        .filter(
          (thread) =>
            (thread.state === "active" || thread.state === "request") &&
            thread.needsReply &&
            personaIds.has(thread.viewerAccountId),
        )
        .map((thread) => ({
          threadId: thread.id,
          creatorAccountId: thread.creatorAccountId,
          viewerAccountId: thread.viewerAccountId,
          at: [thread.replyNotBeforeAt, thread.coolUntil].filter(Boolean).sort().at(-1) ?? null,
        })),
      followUps: followUps
        .filter((row) => row.status === "pending" || row.status === "claimed")
        .map((row) => ({
          id: row.id,
          creatorAccountId: row.creatorAccountId,
          viewerAccountId: row.viewerAccountId,
          type: row.type,
          at: row.scheduledAt,
          reason: row.reason,
        })),
      fansAt: audience.nextRunAt,
      events: [
        ...occurrences
          .filter((occurrence) => occurrence.status === "scheduled")
          .map((occurrence) => ({
            id: occurrence.id,
            name: occurrence.blueprint.name,
            startsAt: occurrence.startsAt,
            accountIds: [...occurrence.participantIds],
          })),
        ...slurpUpcomingAnnualEvents(settings.platformEvents, at).filter(
          (event) => !occurrences.some((occurrence) => occurrence.blueprintId === event.id),
        ),
      ],
    });
    return {
      tasks,
      next,
      accounts: accounts.map((account) => ({
        id: account.id,
        entityId: account.entityId,
        displayName: account.displayName,
        handle: account.handle,
        avatarUrl: account.avatarUrl,
        avatarCrop: null,
      })),
    };
  });
  app.post("/autopurge/run", async (_req, reply) => {
    const outcome = await runSlurpAutopurge(app.db, { reschedule: false });
    if (outcome.status === "busy") {
      return reply.code(409).send({ error: "Another Slurp backup or cleanup is already running." });
    }
    return outcome.result;
  });

  app.delete("/slurp/accounts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryCreatorAccountOperation(id, async () => {
      const imageConnections = await getCreatorImageConnections(app.db);
      const removedConnectionId = imageConnections.creatorConnectionIds[id];
      await updateCreatorImageConnections(app.db, (current) => {
        const creatorConnectionIds = { ...current.creatorConnectionIds };
        const creatorStyleProfileIds = { ...current.creatorStyleProfileIds };
        delete creatorConnectionIds[id];
        delete creatorStyleProfileIds[id];
        return { ...current, creatorConnectionIds, creatorStyleProfileIds };
      });
      // Same treatment for the post-guidance override, or a deleted Creator's direction would sit
      // in the blob forever and travel in every backup.
      const removedGuidance = (await getSlurpPostGuidance(app.db)).creators[id];
      await updateSlurpPostGuidance(app.db, (current) => {
        const creators = { ...current.creators };
        delete creators[id];
        return { ...current, creators };
      });
      try {
        const target = await noodle.getNoodlerAccountById(id, { includeHidden: true });
        const deleted = await noodle.deleteNoodlerAccount(id);
        // A deleted ambient account stays deleted; the seeder skips dismissed ids. Record the
        // dismissal only after the delete succeeded, or a failed delete would hide a live account.
        if (deleted && target && isAmbientSlpAccount(target)) await dismissAmbientSlpAccount(noodle, target.entityId);
        // A character's fan row leaves the audience too, or the next world tick makes it again.
        const fanOf =
          deleted && target && isSlurpCharacterFanAccount(target)
            ? slurpCharacterIdFromFanEntityId(target.entityId)
            : null;
        if (fanOf) await noodle.setAudienceCharacter(fanOf, false);
        if (deleted) removeCreatorAccountMedia(id);
        return deleted;
      } catch (error) {
        if (removedConnectionId) {
          await updateCreatorImageConnections(app.db, (current) => ({
            ...current,
            creatorConnectionIds: {
              ...current.creatorConnectionIds,
              [id]: removedConnectionId,
            },
          }));
        }
        if (removedGuidance) {
          await updateSlurpPostGuidance(app.db, (current) => ({
            ...current,
            creators: { ...current.creators, [id]: removedGuidance },
          }));
        }
        throw error;
      }
    });
    if (!locked.acquired) {
      return reply.code(409).send({
        error: "Another operation for this Slurp account is already running.",
      });
    }
    const deleted = locked.value;
    if (!deleted) return reply.code(404).send({ error: "Slurp stage profile not found" });
    return deleted;
  });

  app.delete("/data", async (_req, reply) => {
    const locked = await trySlurpDataDeletion(async () => {
      const result = await noodle.deleteAllSlurpData();
      await clearCreatorImageConnections(app.db);
      removeAllCreatorMedia();
      return result;
    });
    if (!locked.acquired) return reply.code(409).send({ error: "Another Slurp operation is already running." });
    return locked.value;
  });

  // The recovery reset: keeps Creators, their artwork and every setting (deleteAllSlurpData).
  // ponytail: refresh runs, first-post jobs and DM replies do not check the deletion lock, so one
  // already generating can still land a post or message after the reset; a per-thread and per-run
  // epoch check before commit would close that.
  app.delete("/data/activity", async (_req, reply) => {
    const locked = await trySlurpDataDeletion(async () => {
      // The wallet stays, so coins paid for a commission that will now never arrive come back first.
      await createSlurpMessagesStorage(app.db).refundOpenCommissions();
      return noodle.deleteAllSlurpData({ keepCreators: true });
    });
    if (!locked.acquired) return reply.code(409).send({ error: "Another Slurp operation is already running." });
    return locked.value;
  });

  app.delete("/data/unused", async (_req, reply) => {
    const locked = await trySlurpDataDeletion(() => noodle.deleteUnusedSlurpData());
    if (!locked.acquired) return reply.code(409).send({ error: "Another Slurp operation is already running." });
    return locked.value;
  });
}
