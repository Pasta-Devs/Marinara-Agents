import { readdir, readFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ltmRetentionConfigSchema } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { DEFAULT_LTM_RETENTION_CONFIG } from "./default-config.js";
import { readJsonFile, writeJsonAtomic, writeTextAtomic } from "./atomic-json.js";
import { isEnoent } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, getLongTermMemoryRoot, safeJoin } from "./paths.js";
import { readLongTermMemoryUsage, longTermMemoryUsagePath } from "./usage.js";
import { withLtmVaultLock } from "./vault-lock.js";

const lastRetentionRun = new Map<string, number>();
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const longTermMemoryRetentionConfigPath = (root = getLongTermMemoryRoot()) =>
  safeJoin(getLongTermMemoryDirectories(root).config, "retention.json");

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

  const config = ltmRetentionConfigSchema.parse(
    await readJsonFile(longTermMemoryRetentionConfigPath(root), DEFAULT_LTM_RETENTION_CONFIG),
  );

  const DAY_MS = 86400000;
  const quarantineCutoff = now.getTime() - config.quarantineRetentionDays * DAY_MS;
  const usageCutoff = now.getTime() - config.usageRetentionDays * DAY_MS;
  const receiptCutoff = now.getTime() - config.receiptRetentionDays * DAY_MS;
  const eventCutoff = now.getTime() - config.eventRetentionDays * DAY_MS;
  const incompleteGenCutoff = now.getTime() - config.incompleteGenerationRetentionDays * DAY_MS;

  let quarantineArtifacts = 0;
  let usageChatsPruned = 0;
  let receiptsRemoved = 0;
  let eventsRemoved = 0;
  let incompleteReceiptsRemoved = 0;

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

  // 2. Usage pruning
  try {
    const usage = await readLongTermMemoryUsage(root);
    let usageChanged = false;
    for (const [chatId, chat] of Object.entries(usage.chats)) {
      for (const chunkId of Object.keys(chat.chunks)) {
        const chunk = chat.chunks[chunkId];
        const lastActivity = Math.max(
          new Date(chunk.lastRetrievedAt).getTime(),
          new Date(chunk.lastInjectedAt).getTime(),
        );
        if (lastActivity < usageCutoff) {
          delete chat.chunks[chunkId];
          usageChanged = true;
          usageChatsPruned++;
        }
      }
      if (Object.keys(chat.chunks).length === 0) {
        delete usage.chats[chatId];
        usageChanged = true;
      }
    }
    if (usage.acceptedReceipts) {
      for (const [receiptId, acceptedAt] of Object.entries(usage.acceptedReceipts)) {
        if (acceptedAt === true || new Date(acceptedAt).getTime() < receiptCutoff) {
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
    try {
      const receipt = JSON.parse(await readFile(path, "utf8"));
      if (
        receipt.dispatchedAt &&
        new Date(receipt.dispatchedAt).getTime() < receiptCutoff
      ) {
        await rm(path, { force: true });
        receiptsRemoved++;
      }
    } catch {
      // skip malformed receipt files
    }
  }

  // 4. Event log cleanup
  for (const eventLogPath of [dirs.eventLog, dirs.debugLog]) {
    try {
      const content = await readFile(eventLogPath, "utf8").catch((e) => {
        if (isEnoent(e)) return null;
        throw e;
      });
      if (!content) continue;
      const lines = content.split("\n");
      const filtered = lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        try {
          const event = JSON.parse(trimmed);
          if (event.ts && new Date(event.ts).getTime() < eventCutoff) {
            eventsRemoved++;
            return false;
          }
          return true;
        } catch {
          return true;
        }
      });
      if (filtered.length < lines.filter((line) => line.trim()).length) {
        await writeTextAtomic(
          eventLogPath,
          filtered.join("\n") + (filtered.length ? "\n" : ""),
        );
      }
    } catch (e) {
      if (!isEnoent(e)) throw e;
    }
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

  lastRetentionRun.set(key, now.getTime());
  return {
    ran: true,
    skippedPendingRecovery: false,
    quarantineArtifacts,
    usageChatsPruned,
    receiptsRemoved,
    eventsRemoved,
    incompleteReceiptsRemoved,
  };
}

export function runLongTermMemoryRetention(options: Parameters<typeof runLongTermMemoryRetentionUnsafe>[0] = {}) {
  return withLtmVaultLock(options.root ?? getLongTermMemoryRoot(), () =>
    runLongTermMemoryRetentionUnsafe(options),
  );
}
