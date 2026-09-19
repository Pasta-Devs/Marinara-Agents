import { z } from "zod";
import { previewSlurpAutopurge, runSlurpAutopurge } from "./slp-autopurge.js";
import { slpAccounts, slpPosts, slpInteractions, slurpMessages } from "../../../db/schema/slurp.js";
import { now } from "../../../utils/id-generator.js";
import { getSlurpOperationStatus, trySlurpDataDeletion } from "../../base/locking/slp-operation-lock.js";
import { summarizeCreatorMedia, removeCreatorAccountMedia, removeAllCreatorMedia } from "../../base/media/slp-media.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import {
  getCreatorImageConnections,
  updateCreatorImageConnections,
  clearCreatorImageConnections,
} from "../../base/media/slp-image-connections.js";
import { getSlurpPostGuidance, updateSlurpPostGuidance } from "../../data/settings/slp-post-guidance-storage.js";
import { isAmbientSlpAccount, dismissAmbientSlpAccount } from "../../data/audience/slp-ambient-profiles.js";
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
        creators: accounts.length,
        posts: posts.length,
        interactions: interactions.length,
        messages: messages.length,
      },
      media: summarizeCreatorMedia(),
      unused,
    };
  });
  app.post("/autopurge/run", async (_req, reply) => {
    const outcome = await runSlurpAutopurge(app.db, { reschedule: false });
    if (outcome.status === "busy") {
      return reply.code(409).send({ error: "Another Slurp backup or cleanup is already running." });
    }
    return outcome.result;
  });

  app.delete("/noodler/accounts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryCreatorAccountOperation(id, async () => {
      const imageConnections = await getCreatorImageConnections(app.db);
      const removedConnectionId = imageConnections.creatorConnectionIds[id];
      await updateCreatorImageConnections(app.db, (current) => {
        const creatorConnectionIds = { ...current.creatorConnectionIds };
        delete creatorConnectionIds[id];
        return { ...current, creatorConnectionIds };
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

  app.delete("/data/unused", async (_req, reply) => {
    const locked = await trySlurpDataDeletion(() => noodle.deleteUnusedSlurpData());
    if (!locked.acquired) return reply.code(409).send({ error: "Another Slurp operation is already running." });
    return locked.value;
  });
}
