import { randomUUID } from "node:crypto";
import { logger } from "../package-runtime.js";
import { createReadStream } from "node:fs";
import { open, readdir, readFile, rm, stat, unlink } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import {
  ltmIsoTimestampSchema,
  ltmRetentionConfigSchema,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { DEFAULT_LTM_RETENTION_CONFIG } from "../default-config.js";
import { fsyncPath, renameWithRetry, writeJsonAtomic } from "./atomic-json.js";
import { isEnoent } from "../ltm-utils.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { readLtmSettingsFile } from "../settings.js";
import { readLongTermMemoryUsage, longTermMemoryUsagePath } from "../recall/usage.js";
import { withLtmVaultLock } from "./vault-lock.js";
import { pruneLtmActivityIndex } from "./activity-index.js";

const lastRetentionRun = new Map<string, number>();
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
// An accepted id only stops a repeat of the same dispatch from being recorded twice, which
// arrives within moments. Retention runs at most daily, so an id lives one to two days.
const ACCEPTED_RECEIPT_RETENTION_MS = 24 * 60 * 60 * 1000;
// Review and Activity show only pending and invalidated drafts, so drafts in the first three states
// have no reader. An invalidated draft can't be applied, and invalidation sets its updatedAt, so it
// leaves Review one audit window after it was invalidated. Pending drafts are always kept.
const EXPIRING_DRAFT_STATUSES = new Set(["accepted", "auto_applied", "superseded", "invalidated"]);

async function pruneEventLog(path: string, cutoff: number) {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  let output;
  let removed = 0;
  try {
    output = await open(tmp, "wx", 0o600);
    const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let expired = false;
      try {
        const event = JSON.parse(trimmed);
        expired = Boolean(event.ts && new Date(event.ts).getTime() < cutoff);
      } catch {}
      if (expired) removed++;
      else await output.writeFile(`${line}\n`, "utf8");
    }
    await output.sync();
    await output.close();
    output = undefined;
    if (removed) {
      await renameWithRetry(tmp, path);
      await fsyncPath(dirname(path));
    } else await unlink(tmp);
    return removed;
  } catch (error) {
    await output?.close().catch(() => {});
    await unlink(tmp).catch(() => {});
    if (isEnoent(error)) return 0;
    throw error;
  }
}

export const longTermMemoryRetentionConfigPath = (root = getLongTermMemoryRoot()) =>
  safeJoin(getLongTermMemoryDirectories(root).config, "retention.json");

const LTM_REPAIR_BACKUP_KINDS = ["identity-repairs", "forks"] as const;

export function getLtmRepairBackupsRoot(
  kind: (typeof LTM_REPAIR_BACKUP_KINDS)[number],
  root = getLongTermMemoryRoot(),
) {
  return join(dirname(root), "backups", `long-term-memory-${kind}`);
}

// A repair backup only serves the rollback inside the call that made it, so keep the newest few.
// `keepPath` is the backup the repair just made: it survives even when modification times tie.
export async function pruneLtmRepairBackups(directory: string, options: { keepPath?: string; keep?: number } = {}) {
  const { keepPath, keep = 3 } = options;
  try {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (isEnoent(error)) return [];
      throw error;
    });
    const backups = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const path = join(directory, entry.name);
          return { path, mtimeMs: (await stat(path)).mtimeMs };
        }),
    );
    const newest = (a: (typeof backups)[number], b: (typeof backups)[number]) =>
      Number(b.path === keepPath) - Number(a.path === keepPath) || b.mtimeMs - a.mtimeMs;
    for (const backup of backups.sort(newest).slice(keep)) await rm(backup.path, { recursive: true, force: true });
  } catch (error) {
    logger.warn(error, "[ltm] Could not prune repair backups in %s", directory);
  }
}

export async function removeLtmRepairBackups(root = getLongTermMemoryRoot()) {
  for (const kind of LTM_REPAIR_BACKUP_KINDS)
    await rm(getLtmRepairBackupsRoot(kind, root), { recursive: true, force: true });
}

async function runLongTermMemoryRetentionUnsafe({
  root = getLongTermMemoryRoot(),
  now = new Date(),
  force = false,
} = {}) {
  const dirs = getLongTermMemoryDirectories(root);
  const key = resolve(root);
  const lastRun = lastRetentionRun.get(key);
  if (!force && lastRun !== undefined && now.getTime() - lastRun < RETENTION_INTERVAL_MS)
    return { ran: false, skippedThrottled: true, skippedPendingRecovery: false, quarantineArtifacts: 0 };

  const tx = await readdir(dirs.transactions).catch((e) => {
    if (isEnoent(e)) return [];
    throw e;
  });
  if (tx.some((x) => x.endsWith(".json"))) {
    return { ran: false, skippedPendingRecovery: true, quarantineArtifacts: 0 };
  }

  const { settings: config } = await readLtmSettingsFile(
    longTermMemoryRetentionConfigPath(root),
    ltmRetentionConfigSchema,
    DEFAULT_LTM_RETENTION_CONFIG,
  );

  const DAY_MS = 86400000;
  const quarantineCutoff = now.getTime() - config.quarantineRetentionDays * DAY_MS;
  const acceptedReceiptCutoff = now.getTime() - ACCEPTED_RECEIPT_RETENTION_MS;
  const receiptCutoff = now.getTime() - config.receiptRetentionDays * DAY_MS;
  const eventCutoff = now.getTime() - config.eventRetentionDays * DAY_MS;
  const incompleteGenCutoff = now.getTime() - config.incompleteGenerationRetentionDays * DAY_MS;
  const draftCutoff = now.getTime() - config.auditWindowDays * DAY_MS;

  let quarantineArtifacts = 0;
  let receiptsRemoved = 0;
  let eventsRemoved = 0;
  let incompleteReceiptsRemoved = 0;
  let draftsRemoved = 0;

  // 1. Quarantine cleanup
  const quarantine = join(root, "quarantine");
  for (const entry of await readdir(quarantine, { withFileTypes: true }).catch((e) => {
    if (isEnoent(e)) return [];
    throw e;
  })) {
    const path = join(quarantine, entry.name);
    if ((await stat(path)).mtimeMs < quarantineCutoff) {
      await rm(path, { recursive: true, force: true });
      quarantineArtifacts++;
    }
  }

  // 2. Usage pruning. Nothing writes per-memory counters any more, so clear any that an older version left.
  try {
    const usage = await readLongTermMemoryUsage(root);
    let usageChanged = false;
    if (Object.keys(usage.chats).length) {
      usage.chats = {};
      usageChanged = true;
    }
    if (usage.acceptedReceipts) {
      for (const [receiptId, acceptedAt] of Object.entries(usage.acceptedReceipts)) {
        if (acceptedAt === true || new Date(acceptedAt).getTime() < acceptedReceiptCutoff) {
          delete usage.acceptedReceipts[receiptId];
          usageChanged = true;
        }
      }
    }
    if (usageChanged) {
      await writeJsonAtomic(longTermMemoryUsagePath(root), usage);
    }
  } catch (e) {
    if (!isEnoent(e)) throw e;
  }

  // 3. Receipt cleanup
  for (const entry of await readdir(dirs.receipts, { withFileTypes: true }).catch((e) => {
    if (isEnoent(e)) return [];
    throw e;
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = safeJoin(dirs.receipts, entry.name);
    const raw = await readFile(path, "utf8");
    let receipt;
    try {
      receipt = JSON.parse(raw);
    } catch {
      // skip malformed receipt files
      continue;
    }
    if (receipt.dispatchedAt && new Date(receipt.dispatchedAt).getTime() < receiptCutoff) {
      await rm(path, { force: true });
      receiptsRemoved++;
    }
  }

  // 4. Event log cleanup
  for (const eventLogPath of [dirs.eventLog, dirs.debugLog]) {
    eventsRemoved += await pruneEventLog(eventLogPath, eventCutoff);
  }
  try {
    await pruneLtmActivityIndex(root, eventCutoff);
  } catch (error) {
    logger.warn(error, "[ltm] Deferred activity index pruning during retention");
  }

  // 5. Incomplete generation receipt cleanup
  const runtimeReceiptsDir = safeJoin(dirs.events, "runtime-receipts");
  for (const entry of await readdir(runtimeReceiptsDir, { withFileTypes: true }).catch((e) => {
    if (isEnoent(e)) return [];
    throw e;
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = safeJoin(runtimeReceiptsDir, entry.name);
    if ((await stat(path)).mtimeMs < incompleteGenCutoff) {
      await rm(path, { force: true });
      incompleteReceiptsRemoved++;
    }
  }

  // 6. Finished and invalidated draft cleanup. Every draft write holds the vault lock, which retention holds too.
  for (const entry of await readdir(dirs.drafts, { withFileTypes: true }).catch((e) => {
    if (isEnoent(e)) return [];
    throw e;
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = safeJoin(dirs.drafts, entry.name);
    let draft;
    try {
      draft = JSON.parse(await readFile(path, "utf8"));
    } catch {
      // skip malformed draft files
      continue;
    }
    // An invalid updatedAt keeps the draft: new Date(null) would read as 1970 and delete it.
    const updatedAt = ltmIsoTimestampSchema.safeParse(draft?.updatedAt);
    if (EXPIRING_DRAFT_STATUSES.has(draft?.status) && updatedAt.success && Date.parse(updatedAt.data) < draftCutoff) {
      await rm(path, { force: true });
      draftsRemoved++;
    }
  }

  lastRetentionRun.set(key, now.getTime());
  return {
    ran: true,
    skippedPendingRecovery: false,
    quarantineArtifacts,
    receiptsRemoved,
    eventsRemoved,
    incompleteReceiptsRemoved,
    draftsRemoved,
  };
}

export function runLongTermMemoryRetention(options: Parameters<typeof runLongTermMemoryRetentionUnsafe>[0] = {}) {
  return withLtmVaultLock(options.root ?? getLongTermMemoryRoot(), () => runLongTermMemoryRetentionUnsafe(options));
}
