import { unlink, readdir, readFile, stat } from "node:fs/promises";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { join } from "path";
import { randomUUID } from "node:crypto";
import { claimSlurpBackup } from "../../../services/slurp/slurp-operation-lock.js";
import { pauseNoodleAutoPost } from "../../../services/slurp/slurp-autopost-scheduler.service.js";
import { pauseNoodleRefreshScheduler } from "../../../services/slurp/slurp-refresh-scheduler.service.js";
import {
  listNoodlerMediaFiles,
  removeAllNoodlerMedia,
  restoreNoodlerMediaFile,
} from "../../../services/slurp/slurp-media.js";
import { type StoredZipEntry, jsonEntry, writeStoredZip, readStoredZip } from "../../../services/slurp/slurp-backup.js";
import { createWriteStream } from "fs";
import { finished } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";

/**
 * The backup/restore engine. Jobs, inspections, and the archive sweep timer live here and are
 * created once, when the maintenance routes mount.
 */
export function createSlpBackupJobs(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  // ── Backup: export and restore ────────────────────────────────────────────
  //
  // Both directions run as jobs rather than one long request: a real install carries thousands of
  // rows and every generated image, which takes far longer than a browser will wait. The client
  // starts a job, polls it, then downloads or reads the result.
  //
  // The archive format is shared with legacy Slurp on purpose. Its data files are named for
  // logical entities ("accounts", "posts"), not for physical tables, so a legacy export restores
  // into this package even though every table was renamed from slurp_* to slurp2_*.

  type BackupJob = {
    id: string;
    kind: "export" | "restore";
    state: string;
    stage: string;
    detail: string;
    creators: number;
    posts: number;
    interactions: number;
    mediaFiles: number;
    mediaCompleted: number;
    mediaBytes: number;
    archiveBytes: number;
    skipped: string[];
    error: string | null;
    filePath: string | null;
    terminalAt: number | null;
  };

  const backupJobs = new Map<string, BackupJob>();
  type RestoreInspection = {
    id: string;
    filePath: string;
    expiresAt: number;
    summary: ReturnType<typeof inspectRestoreArchive>["summary"];
  };
  const restoreInspections = new Map<string, RestoreInspection>();
  const BACKUP_RETENTION_MS = 24 * 60 * 60 * 1000;
  const RESTORE_INSPECTION_RETENTION_MS = 15 * 60 * 1000;
  const BACKUP_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
  const BACKUP_FILE_PREFIX = "slurp2-backup-";
  const RESTORE_INSPECTION_PREFIX = "slurp2-restore-inspection-";

  async function sweepBackupArchives() {
    const liveFilePaths = new Set<string>();
    const now = Date.now();
    for (const [id, job] of backupJobs) {
      if (job.filePath) liveFilePaths.add(job.filePath);
      if (job.terminalAt === null || now - job.terminalAt < BACKUP_RETENTION_MS) continue;
      if (job.filePath) await unlink(job.filePath).catch(() => {});
      backupJobs.delete(id);
    }
    for (const [id, inspection] of restoreInspections) {
      if (now < inspection.expiresAt) {
        liveFilePaths.add(inspection.filePath);
        continue;
      }
      await unlink(inspection.filePath).catch(() => {});
      restoreInspections.delete(id);
    }
    for (const name of await readdir(DATA_DIR)) {
      if (
        (!name.startsWith(BACKUP_FILE_PREFIX) && !name.startsWith(RESTORE_INSPECTION_PREFIX)) ||
        !name.endsWith(".zip")
      )
        continue;
      const stalePath = join(DATA_DIR, name);
      if (liveFilePaths.has(stalePath)) continue;
      await unlink(stalePath).catch(() => {});
    }
  }

  // Sweep orphaned archives once at startup and again each hour. The timer is unref'd so a
  // deactivated package never keeps the host process alive, and sweeps are idempotent.
  void sweepBackupArchives();
  const backupSweepTimer = setInterval(() => void sweepBackupArchives(), BACKUP_SWEEP_INTERVAL_MS);
  backupSweepTimer.unref();

  const newBackupJob = (kind: "export" | "restore", detail: string): BackupJob => ({
    id: randomUUID(),
    kind,
    state: "queued",
    stage: "queued",
    detail,
    creators: 0,
    posts: 0,
    interactions: 0,
    mediaFiles: 0,
    mediaCompleted: 0,
    mediaBytes: 0,
    archiveBytes: 0,
    skipped: [],
    error: null,
    filePath: null,
    terminalAt: null,
  });

  const failJob = (job: BackupJob, error: unknown) => {
    job.state = "error";
    job.stage = "error";
    job.error = error instanceof Error ? error.message : String(error);
    job.detail = job.error;
    job.terminalAt = Date.now();
  };

  /** Run a job body while the data is held still, releasing every lock in reverse order. */
  const runExclusive = async (job: BackupJob, body: () => Promise<void>) => {
    const release = claimSlurpBackup();
    if (!release) {
      failJob(job, "Slurp data is busy. Try again shortly.");
      return;
    }
    const releaseScheduler = await pauseNoodleAutoPost();
    const releaseRefreshScheduler = await pauseNoodleRefreshScheduler();
    try {
      await body();
    } catch (error) {
      failJob(job, error);
    } finally {
      releaseRefreshScheduler();
      releaseScheduler();
      release();
    }
  };

  const createBackupJob = async () => {
    const job = newBackupJob("export", "Waiting for the backup worker.");
    backupJobs.set(job.id, job);
    void runExclusive(job, async () => {
      job.state = "preparing";
      job.stage = "reading-data";
      job.detail = "Reading Slurp database records.";
      const backup = await noodle.exportSlurpBackup();
      job.creators = backup.tables.accounts.length;
      job.posts = backup.tables.posts.length;
      job.interactions = backup.tables.interactions.length;
      const mediaFiles = await listNoodlerMediaFiles();
      job.mediaFiles = mediaFiles.length;
      job.stage = "writing-archive";
      job.state = "writing";
      job.detail = `Writing archive. ${mediaFiles.length} media file${mediaFiles.length === 1 ? "" : "s"} found.`;
      const entries: StoredZipEntry[] = [
        {
          name: "manifest.json",
          read: async () =>
            jsonEntry("manifest.json", {
              format: "marinara-slurp-backup",
              formatVersion: 1,
              sourcePackage: "slurp2",
              exportedAt: new Date().toISOString(),
              dataFiles: Object.keys(backup.tables),
              mediaIncluded: true,
            }).data,
        },
        {
          name: "data/app-settings.json",
          read: async () => jsonEntry("app-settings.json", backup.settings).data,
        },
        ...Object.entries(backup.tables).map(([name, rows]) => ({
          name: `data/${name}.json`,
          read: async () => jsonEntry(`${name}.json`, rows).data,
        })),
        ...mediaFiles.map((media) => ({ name: media.relativePath, read: () => readFile(media.absolutePath) })),
      ];
      const filePath = join(DATA_DIR, `${BACKUP_FILE_PREFIX}${job.id}.zip`);
      const output = createWriteStream(filePath);
      const outputFinished = finished(output);
      await Promise.all([
        writeStoredZip(output, entries, ({ index, total, name, bytes }) => {
          job.mediaCompleted = Math.max(0, index - (entries.length - mediaFiles.length));
          if (name.startsWith("media/")) job.mediaBytes += bytes;
          job.detail = `Writing ${index} of ${total} archive entries. Last: ${name}.`;
        }),
        outputFinished,
      ]);
      job.filePath = filePath;
      job.archiveBytes = (await stat(filePath)).size;
      job.stage = "completed";
      job.state = "completed";
      job.terminalAt = Date.now();
      job.detail = `Backup ready. ${job.archiveBytes} bytes written.`;
    }).catch((error) => failJob(job, error));
    return job;
  };

  function inspectRestoreArchive(archive: Buffer) {
    const entries = readStoredZip(archive);
    const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
    const manifestRaw = byName.get("manifest.json");
    if (!manifestRaw) throw new Error("This archive has no manifest.json and is not a Slurp backup.");
    const manifest = JSON.parse(manifestRaw.toString("utf8")) as {
      format?: string;
      formatVersion?: number;
      sourcePackage?: string;
      exportedAt?: string;
    };
    if (manifest.format !== "marinara-slurp-backup") throw new Error("This file is not a Slurp backup.");
    if (manifest.formatVersion !== 1) {
      throw new Error(`This backup uses format version ${manifest.formatVersion}, which this build cannot read.`);
    }
    if (manifest.sourcePackage !== "slurp" && manifest.sourcePackage !== "slurp2") {
      throw new Error(`This backup came from ${manifest.sourcePackage ?? "an unknown package"}.`);
    }
    const readJson = (name: string): unknown => {
      const raw = byName.get(name);
      if (!raw) return null;
      try {
        return JSON.parse(raw.toString("utf8"));
      } catch {
        throw new Error(`Archive entry ${name} is not valid JSON.`);
      }
    };
    const tables: Record<string, unknown[]> = {};
    for (const name of byName.keys()) {
      if (!name.startsWith("data/") || !name.endsWith(".json")) continue;
      const logicalName = name.slice("data/".length, -".json".length);
      if (logicalName === "app-settings") continue;
      const rows = readJson(name);
      if (Array.isArray(rows)) tables[logicalName] = rows;
    }
    const settingsBlob = readJson("data/app-settings.json");
    const settings =
      settingsBlob && typeof settingsBlob === "object" && !Array.isArray(settingsBlob)
        ? (settingsBlob as Record<string, string>)
        : {};
    const mediaEntries = [...byName.entries()].filter(([name]) => name.startsWith("media/"));
    return {
      manifest,
      tables,
      settings,
      mediaEntries,
      summary: {
        sourcePackage: manifest.sourcePackage,
        exportedAt: manifest.exportedAt ?? null,
        creators: tables.accounts?.length ?? 0,
        posts: tables.posts?.length ?? 0,
        interactions: tables.interactions?.length ?? 0,
        mediaFiles: mediaEntries.length,
        mediaBytes: mediaEntries.reduce((total, [, data]) => total + data.length, 0),
        hasSlurp2Settings: Object.keys(settings).some((key) => key.startsWith("slurp2.")),
      },
    };
  }

  const createRestoreJob = (archive: Buffer, importSettings: boolean) => {
    const job = newBackupJob("restore", "Waiting for the restore worker.");
    backupJobs.set(job.id, job);
    void runExclusive(job, async () => {
      job.state = "preparing";
      job.stage = "reading-archive";
      job.detail = "Reading the backup archive.";
      const inspection = inspectRestoreArchive(archive);
      const { tables, settings, mediaEntries } = inspection;

      job.creators = tables.accounts?.length ?? 0;
      job.posts = tables.posts?.length ?? 0;
      job.interactions = tables.interactions?.length ?? 0;
      job.stage = "writing-data";
      job.state = "writing";
      job.detail = `Restoring ${job.creators} creator${job.creators === 1 ? "" : "s"} and ${job.posts} post${job.posts === 1 ? "" : "s"}.`;
      const result = await noodle.importSlurpBackup({ settings, tables, importSettings });
      job.skipped = result.skipped;

      job.stage = "writing-media";
      job.detail = "Restoring media files.";
      job.mediaFiles = mediaEntries.length;
      // Media is replaced wholesale alongside the rows it belongs to, so a restore cannot leave
      // images from the previous data set attached to posts that no longer exist.
      removeAllNoodlerMedia();
      for (const [name, data] of mediaEntries) {
        if (restoreNoodlerMediaFile(name, data)) {
          job.mediaCompleted += 1;
          job.mediaBytes += data.length;
        } else {
          job.skipped.push(name);
        }
      }

      job.stage = "completed";
      job.state = "completed";
      job.terminalAt = Date.now();
      job.detail = `Restore complete. ${job.creators} creators, ${job.posts} posts, ${job.mediaCompleted} media files.`;
    }).catch((error) => failJob(job, error));
    return job;
  };

  return {
    backupJobs,
    restoreInspections,
    RESTORE_INSPECTION_RETENTION_MS,
    RESTORE_INSPECTION_PREFIX,
    createBackupJob,
    inspectRestoreArchive,
    createRestoreJob,
  };
}

export type SlpBackupJobs = ReturnType<typeof createSlpBackupJobs>;
