import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { logger } from "../../../lib/logger.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  bumpSlurpWorldEpoch,
  applySlurpWorldSkip,
  setSlurpWorldOffset,
} from "../../data/settings/slp-world-clock-storage.js";
import { slurpWorldNowMs } from "../../../../../shared/src/slp/slp-world-clock.js";
import { selectCheckpointsToPrune, slurpSkipTarget } from "../../modules/maintenance/slp-timeline.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import type { SlpBackupJobs } from "./slp-backup-jobs.js";

/**
 * Timeline checkpoints and the two operations built on them (docs/WORLD-CLOCK.md):
 * a forward date skip, and a restore that is the only way back. A checkpoint is a
 * normal Slurp backup archive kept next to a small JSON sidecar. The index lives on
 * disk, not in the database, so a restore can never roll the list back with the data.
 */
export type CheckpointKind = "manual" | "auto" | "safety";

export type CheckpointMeta = {
  id: string;
  kind: CheckpointKind;
  label: string;
  /** Real time the checkpoint was written. */
  createdAt: string;
  /** World date the checkpoint captured. */
  worldDate: string;
  worldNowMs: number;
  bytes: number;
  creators: number;
  posts: number;
  mediaFiles: number;
};

export const CHECKPOINT_DIR = join(DATA_DIR, "slurp2-checkpoints");
export const AUTO_CHECKPOINT_KEEP_DEFAULT = 5;
export const AUTO_CHECKPOINT_KEEP_MAX = 50;
/** Safety checkpoints (made before a restore) are kept in a small ring of their own. */
export const SAFETY_CHECKPOINT_KEEP = 3;
export const AUTO_CHECKPOINT_KEEP_KEY = "slurp2.world.autoCheckpointKeep";
/** A skip can go this far ahead of the current world date. */
export const MAX_SKIP_DAYS = 3650;
const CHECKPOINT_ID = /^[0-9a-f-]{36}$/;

export async function readAutoCheckpointKeep(db: FastifyInstance["db"]): Promise<number> {
  const raw = Number(await createAppSettingsStorage(db).get(AUTO_CHECKPOINT_KEEP_KEY));
  return Number.isInteger(raw) && raw >= 1 && raw <= AUTO_CHECKPOINT_KEEP_MAX ? raw : AUTO_CHECKPOINT_KEEP_DEFAULT;
}

export async function listCheckpoints(): Promise<CheckpointMeta[]> {
  let names: string[];
  try {
    names = await readdir(CHECKPOINT_DIR);
  } catch {
    return [];
  }
  const found: CheckpointMeta[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const meta = JSON.parse(await readFile(join(CHECKPOINT_DIR, name), "utf8")) as CheckpointMeta;
      // A sidecar without its archive (or a half-written pair) is not a checkpoint.
      if (!CHECKPOINT_ID.test(meta.id) || !(await stat(join(CHECKPOINT_DIR, `${meta.id}.zip`)).catch(() => null)))
        continue;
      found.push(meta);
    } catch {
      /* unreadable sidecar: ignore */
    }
  }
  return found.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removeCheckpoint(id: string): Promise<boolean> {
  if (!CHECKPOINT_ID.test(id)) return false;
  const existed = Boolean(await stat(join(CHECKPOINT_DIR, `${id}.json`)).catch(() => null));
  await unlink(join(CHECKPOINT_DIR, `${id}.json`)).catch(() => {});
  await unlink(join(CHECKPOINT_DIR, `${id}.zip`)).catch(() => {});
  return existed;
}

/** Keep the newest `keep` auto and `SAFETY_CHECKPOINT_KEEP` safety checkpoints; manual ones are never touched. */
export async function pruneCheckpoints(keep: number): Promise<void> {
  for (const old of selectCheckpointsToPrune(await listCheckpoints(), keep, SAFETY_CHECKPOINT_KEEP)) {
    await removeCheckpoint(old.id);
  }
}

export function createSlpTimelineJobs(app: FastifyInstance, deps: SlpRouteDeps, backup: SlpBackupJobs) {
  const { noodle } = deps;
  const {
    newBackupJob,
    failJob,
    runExclusive,
    writeBackupArchive,
    applyRestoreArchive,
    inspectRestoreArchive,
    backupJobs,
  } = backup;
  type Job = ReturnType<typeof newBackupJob>;

  /** Write one checkpoint. The caller holds the exclusive run. Writes to a temp name first, so a crash leaves no half pair. */
  const writeCheckpoint = async (job: Job, kind: CheckpointKind, label: string): Promise<CheckpointMeta> => {
    await mkdir(CHECKPOINT_DIR, { recursive: true });
    const id = randomUUID();
    const zipPath = join(CHECKPOINT_DIR, `${id}.zip`);
    const worldNowMs = slurpWorldNowMs();
    try {
      await writeBackupArchive(job, zipPath);
      const meta: CheckpointMeta = {
        id,
        kind,
        label,
        createdAt: new Date().toISOString(),
        worldDate: new Date(worldNowMs).toISOString(),
        worldNowMs,
        bytes: job.archiveBytes,
        creators: job.creators,
        posts: job.posts,
        mediaFiles: job.mediaFiles,
      };
      await writeFile(join(CHECKPOINT_DIR, `${id}.json.tmp`), JSON.stringify(meta), { mode: 0o600 });
      await rename(join(CHECKPOINT_DIR, `${id}.json.tmp`), join(CHECKPOINT_DIR, `${id}.json`));
      // The archive stays; the job must not advertise it as a one-shot download.
      job.filePath = null;
      return meta;
    } catch (error) {
      await unlink(zipPath).catch(() => {});
      await unlink(join(CHECKPOINT_DIR, `${id}.json.tmp`)).catch(() => {});
      throw error;
    }
  };

  /** The skip or restore already committed; a failed cleanup must not turn it into a failed job. */
  const pruneQuietly = async () => {
    try {
      await pruneCheckpoints(await readAutoCheckpointKeep(app.db));
    } catch (error) {
      logger.warn(error, "[slurp-timeline] Could not prune old checkpoints");
    }
  };

  const finish = (job: Job, detail: string) => {
    job.stage = "completed";
    job.state = "completed";
    job.terminalAt = Date.now();
    job.detail = detail;
  };

  const run = (job: Job, body: () => Promise<void>) => {
    backupJobs.set(job.id, job);
    void runExclusive(job, body).catch((error) => failJob(job, error));
    return job;
  };

  const createCheckpointJob = (label: string) => {
    const job = newBackupJob("export", "Waiting for the checkpoint worker.");
    return run(job, async () => {
      const meta = await writeCheckpoint(job, "manual", label);
      finish(job, `Checkpoint saved at world date ${meta.worldDate}.`);
    });
  };

  /**
   * Replace everything with `archive` and bring the world date and paused flag back to
   * what `to` and `priorPaused` say. Slurp stays paused for the whole replace and the
   * epoch is bumped before and after, so late model or image answers are refused.
   * The caller holds the exclusive run.
   */
  const replaceWith = async (
    job: Job,
    archive: Buffer,
    to: CheckpointMeta,
    priorPaused: boolean,
    keep: number,
    expectedMedia?: number,
  ) => {
    // The archive carries the keep count it was saved with; `keep` is the player's choice, read once by the job before any replace.
    await noodle.updateSlurpSettings({ paused: true });
    // The first fence: model and image answers that return after this point are refused.
    await bumpSlurpWorldEpoch(app.db);
    job.skipped = [];
    job.mediaCompleted = 0;
    job.mediaBytes = 0;
    await applyRestoreArchive(job, archive, true, true);
    if (job.skipped.length > 0) throw new Error(`The restore skipped ${job.skipped.length} archive entries.`);
    if (expectedMedia !== undefined && job.mediaCompleted !== expectedMedia)
      throw new Error("Not every media file was restored.");
    await createAppSettingsStorage(app.db).set(AUTO_CHECKPOINT_KEEP_KEY, String(keep));
    await setSlurpWorldOffset(app.db, to.worldNowMs - Date.now());
    await bumpSlurpWorldEpoch(app.db);
    await noodle.updateSlurpSettings({ paused: priorPaused });
  };

  /** Put `from` back after a failed step; reports both failures if the rollback fails too. */
  const rollBack = async (
    job: Job,
    from: CheckpointMeta,
    priorPaused: boolean,
    keep: number,
    error: unknown,
  ): Promise<never> => {
    const reason = error instanceof Error ? error.message : String(error);
    job.stage = "rolling-back";
    job.detail = "That failed. Putting the previous state back.";
    try {
      await replaceWith(job, await readFile(join(CHECKPOINT_DIR, `${from.id}.zip`)), from, priorPaused, keep);
    } catch (rollbackError) {
      const rollbackReason = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(
        `${reason} The rollback failed too (${rollbackReason}). Checkpoint ${from.id} still holds the previous state.`,
      );
    }
    throw new Error(`${reason} The previous state is back.`);
  };

  /**
   * Forward date skip. The checkpoint comes first and a failed checkpoint aborts the skip.
   * The skip itself only moves dates (`applySlurpWorldSkip`): no tick, post, message,
   * stipend or purge runs, now or later. If moving the dates fails half way, the checkpoint is put back.
   */
  const createSkipJob = (days: number) => {
    const job = newBackupJob("export", "Waiting for the date skip worker.");
    return run(job, async () => {
      const target = slurpSkipTarget(slurpWorldNowMs(), days, MAX_SKIP_DAYS);
      job.stage = "checkpoint";
      const meta = await writeCheckpoint(job, "auto", `Before skipping ${days} day${days === 1 ? "" : "s"}`);
      const priorPaused = (await noodle.getSlurpSettings()).paused;
      const keep = await readAutoCheckpointKeep(app.db);
      job.stage = "skipping";
      job.detail = "Moving the world date.";
      try {
        await applySlurpWorldSkip(app.db, new Date(target));
      } catch (error) {
        return rollBack(job, meta, priorPaused, keep, error);
      }
      await pruneQuietly();
      finish(job, `World date moved ${days} day${days === 1 ? "" : "s"} forward. Nothing was simulated.`);
    });
  };

  /**
   * Restore a checkpoint. Order matters:
   * 1. read and verify the archive before anything changes;
   * 2. write a safety checkpoint of the current state;
   * 3. pause Slurp, fence in-flight model/image work with a new epoch, replace everything;
   * 4. check what came back; on any failure, put the safety checkpoint back;
   * 5. set the world date to the checkpoint's date and the paused flag to what it was before.
   */
  const createRestoreCheckpointJob = (id: string) => {
    const job = newBackupJob("restore", "Waiting for the restore worker.");
    return run(job, async () => {
      if (!CHECKPOINT_ID.test(id)) throw new Error("That checkpoint does not exist.");
      const meta = (await listCheckpoints()).find((entry) => entry.id === id);
      if (!meta) throw new Error("That checkpoint does not exist.");
      job.stage = "verifying";
      job.detail = "Checking the checkpoint archive.";
      const archive = await readFile(join(CHECKPOINT_DIR, `${id}.zip`));
      if (archive.length !== meta.bytes)
        throw new Error("The checkpoint archive is damaged (size differs from its record).");
      const inspection = inspectRestoreArchive(archive);
      const expectedMedia = inspection.manifest.mediaCount;
      if (typeof expectedMedia === "number" && expectedMedia !== inspection.mediaEntries.length) {
        throw new Error("The checkpoint archive is damaged (media files are missing).");
      }
      if (!inspection.tables.accounts) throw new Error("The checkpoint archive holds no accounts.");

      job.stage = "safety-checkpoint";
      job.detail = "Saving the current state first.";
      const safety = await writeCheckpoint(job, "safety", `Before restoring ${meta.worldDate.slice(0, 10)}`);
      const priorPaused = (await noodle.getSlurpSettings()).paused;
      const keep = await readAutoCheckpointKeep(app.db);
      try {
        await replaceWith(job, archive, meta, priorPaused, keep, inspection.mediaEntries.length);
      } catch (error) {
        return rollBack(job, safety, priorPaused, keep, error);
      }
      await pruneQuietly();
      finish(
        job,
        `Restored the checkpoint from world date ${meta.worldDate}. A safety checkpoint of the previous state was kept.`,
      );
    });
  };

  return { createCheckpointJob, createSkipJob, createRestoreCheckpointJob };
}

export type SlpTimelineJobs = ReturnType<typeof createSlpTimelineJobs>;
