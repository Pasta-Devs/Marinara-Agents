import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { slurpWorldEpoch, slurpWorldNow, slurpWorldOffsetMs } from "../../../../../shared/src/slp/slp-world-clock.js";
import { isSlurpBackupActive } from "../../base/locking/slp-backup-state.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import type { SlpBackupJobs } from "./slp-backup-jobs.js";
import {
  AUTO_CHECKPOINT_KEEP_KEY,
  AUTO_CHECKPOINT_KEEP_MAX,
  MAX_SKIP_DAYS,
  createSlpTimelineJobs,
  listCheckpoints,
  readAutoCheckpointKeep,
  removeCheckpoint,
} from "./slp-timeline-jobs.js";

const skipSchema = z.object({ days: z.number().int().min(1).max(MAX_SKIP_DAYS) });
const checkpointSchema = z.object({ label: z.string().trim().max(80).optional() });
const keepSchema = z.object({ autoCheckpointKeep: z.number().int().min(1).max(AUTO_CHECKPOINT_KEEP_MAX) });

/** World date, skip, checkpoints and restore. The work itself runs as backup jobs; poll /backup/jobs/:id. */
export function slpTimelineRoutes(app: FastifyInstance, deps: SlpRouteDeps, backup: SlpBackupJobs) {
  const jobs = createSlpTimelineJobs(app, deps, backup);
  const publicJob = (job: { filePath: string | null }) => {
    const { filePath: _filePath, ...rest } = job as typeof job & Record<string, unknown>;
    return rest;
  };

  app.get("/world/clock", async () => ({
    worldNow: slurpWorldNow().toISOString(),
    realNow: new Date().toISOString(),
    offsetMs: slurpWorldOffsetMs(),
    epoch: slurpWorldEpoch(),
    maxSkipDays: MAX_SKIP_DAYS,
    autoCheckpointKeep: await readAutoCheckpointKeep(app.db),
    autoCheckpointKeepMax: AUTO_CHECKPOINT_KEEP_MAX,
    checkpoints: await listCheckpoints(),
  }));

  app.post("/world/clock/skip", async (req, reply) => {
    const body = skipSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return reply.code(202).send(publicJob(jobs.createSkipJob(body.data.days)));
  });

  app.post("/world/clock/checkpoints", async (req, reply) => {
    const body = checkpointSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return reply.code(202).send(publicJob(jobs.createCheckpointJob(body.data.label || "Manual checkpoint")));
  });

  app.delete("/world/clock/checkpoints/:id", async (req, reply) => {
    // A restore may be reading the checkpoint it will roll back to.
    if (isSlurpBackupActive()) return reply.code(409).send({ error: "Slurp data is busy. Try again shortly." });
    const removed = await removeCheckpoint((req.params as { id: string }).id);
    return reply.code(removed ? 204 : 404).send();
  });

  app.post("/world/clock/checkpoints/:id/restore", async (req, reply) => {
    return reply.code(202).send(publicJob(jobs.createRestoreCheckpointJob((req.params as { id: string }).id)));
  });

  app.put("/world/clock/settings", async (req, reply) => {
    const body = keepSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    await createAppSettingsStorage(app.db).set(AUTO_CHECKPOINT_KEEP_KEY, String(body.data.autoCheckpointKeep));
    // Stored only. A lower count takes effect at the next skip or restore, so stepping the value down never deletes anything by itself.
    return { autoCheckpointKeep: body.data.autoCheckpointKeep };
  });
}
