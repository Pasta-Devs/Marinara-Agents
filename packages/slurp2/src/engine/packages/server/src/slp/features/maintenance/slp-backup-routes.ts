import { createReadStream } from "fs";
import { unlink, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "path";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { getErrorMessage } from "../../../services/slurp/slurp-public-support.js";
import { isRestoreInspectionExpired, restoreImportSettingsRequested } from "../../../services/slurp/slurp-backup.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";
import { createSlpBackupJobs, type SlpBackupJobs } from "./slp-backup-jobs.js";

type RestoreInspection = Parameters<SlpBackupJobs["restoreInspections"]["set"]>[1];

export async function slpBackupRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const {
    createBackupJob,
    backupJobs,
    inspectRestoreArchive,
    RESTORE_INSPECTION_PREFIX,
    RESTORE_INSPECTION_RETENTION_MS,
    restoreInspections,
    createRestoreJob,
  } = createSlpBackupJobs(app, deps);
  app.post("/backup/jobs", async (_req, reply) => reply.code(202).send(await createBackupJob()));
  app.get("/backup/jobs/:id", async (req, reply) => {
    const job = backupJobs.get((req.params as { id: string }).id);
    if (!job) return reply.code(404).send({ error: "Backup job not found." });
    const { filePath: _filePath, terminalAt: _terminalAt, ...publicJob } = job;
    return publicJob;
  });
  app.get("/backup/jobs/:id/download", async (req, reply) => {
    const job = backupJobs.get((req.params as { id: string }).id);
    if (!job) return reply.code(404).send({ error: "Backup job not found." });
    if (job.state !== "completed" || !job.filePath) return reply.code(409).send({ error: job.detail });
    const stream = createReadStream(job.filePath);
    // The archive is a one-shot download: it is removed as soon as it has been handed over, so a
    // full copy of every creator and image does not sit in the data directory indefinitely.
    stream.once("close", () => {
      void unlink(job.filePath!).catch(() => {});
      job.filePath = null;
    });
    return reply
      .header("content-type", "application/zip")
      .header("content-disposition", `attachment; filename="slurp2-backup.zip"`)
      .send(stream);
  });

  // Fastify refuses a body whose content type it has no parser for, and an upload of every
  // creator plus every generated image is far past the host's default body limit.
  const MAX_RESTORE_BYTES = 2 * 1024 * 1024 * 1024;
  app.addContentTypeParser("application/zip", { parseAs: "buffer", bodyLimit: MAX_RESTORE_BYTES }, (_req, body, done) =>
    done(null, body),
  );

  app.post("/restore/inspections", { bodyLimit: MAX_RESTORE_BYTES }, async (req, reply) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply.code(400).send({ error: "Upload a Slurp backup archive." });
    }
    try {
      const parsed = inspectRestoreArchive(body);
      const id = randomUUID();
      const filePath = join(DATA_DIR, `${RESTORE_INSPECTION_PREFIX}${id}.zip`);
      await writeFile(filePath, body, { mode: 0o600 });
      const inspection: RestoreInspection = {
        id,
        filePath,
        expiresAt: Date.now() + RESTORE_INSPECTION_RETENTION_MS,
        summary: parsed.summary,
      };
      restoreInspections.set(id, inspection);
      return reply.code(201).send({
        id,
        expiresAt: new Date(inspection.expiresAt).toISOString(),
        ...inspection.summary,
      });
    } catch (error) {
      return reply.code(400).send({ error: getErrorMessage(error) });
    }
  });

  app.delete("/restore/inspections/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const inspection = restoreInspections.get(id);
    if (!inspection) return reply.code(204).send();
    restoreInspections.delete(id);
    await unlink(inspection.filePath).catch(() => {});
    return reply.code(204).send();
  });

  app.post("/restore/inspections/:id/apply", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const inspection = restoreInspections.get(id);
    if (!inspection || isRestoreInspectionExpired(inspection.expiresAt)) {
      if (inspection) {
        restoreInspections.delete(id);
        await unlink(inspection.filePath).catch(() => {});
      }
      return reply.code(410).send({ error: "This restore preview expired. Upload the archive again." });
    }
    const archive = await readFile(inspection.filePath);
    restoreInspections.delete(id);
    await unlink(inspection.filePath).catch(() => {});
    const importSettings = restoreImportSettingsRequested(req.query);
    return reply.code(202).send(createRestoreJob(archive, importSettings));
  });

  app.post("/restore/jobs", { bodyLimit: MAX_RESTORE_BYTES }, async (req, reply) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply.code(400).send({ error: "Upload a Slurp backup archive." });
    }
    // Settings stay untouched unless the user ticked "also import settings" in the restore dialog.
    const importSettings = restoreImportSettingsRequested(req.query);
    return reply.code(202).send(createRestoreJob(body, importSettings));
  });
}
