import { randomUUID } from "node:crypto";
import { rename, rm, stat } from "node:fs/promises";
import {
  DEFAULT_LTM_GLOBAL_SETTINGS,
  ltmAgentSettingsSchema,
  ltmBackupSchema,
  ltmExtractionDraftSchema,
  ltmExtractionSettingsSchema,
  ltmGlobalSettingsSchema,
  ltmRetentionConfigSchema,
  type LtmBackup,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  DEFAULT_LTM_EXTRACTION_CONFIG,
} from "./extraction-config.js";
import {
  DEFAULT_LTM_RETENTION_CONFIG,
} from "./default-config.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import {
  createLtmBackupRestoreJournal,
  ltmBackupRestoreWorkspacePath,
  removeLtmBackupRestoreJournal,
  recoverInterruptedLtmBackupRestore,
  withActiveLtmBackupRestore,
  writeLtmBackupRestoreJournal,
} from "./restore-recovery.js";
import {
  getLongTermMemoryDirectories,
  getLongTermMemoryRoot,
  notePathForId,
  safeJoin,
} from "./paths.js";
import { getLtmGlobalSettings, ltmSettingsPath } from "./settings.js";
import { ltmExtractionConfigPath } from "./extraction-config.js";
import { longTermMemoryRetentionConfigPath } from "./retention.js";
import { LongTermMemoryDraftStore } from "./draft-store.js";
import { LongTermMemoryStorage } from "./storage.js";
import { rebuildLongTermMemoryIndexes } from "./rebuild.js";
import { checkLongTermMemoryIntegrity } from "./maintenance.js";
import { withLtmVaultLock } from "./vault-lock.js";
import {
  readAllRejectedSuggestions,
  writeRejectedSuggestions,
} from "./rejected-suggestions.js";

const backupFormat = "marinara-long-term-memory" as const;

async function readConfig<T>(path: string, schema: { parse(value: unknown): T }, fallback: unknown) {
  return schema.parse(await readJsonFile(path, fallback));
}

export async function exportLongTermMemoryData(root = getLongTermMemoryRoot()): Promise<LtmBackup> {
  return withLtmVaultLock(root, async () => {
    const storage = new LongTermMemoryStorage(root);
    await storage.initializeLtmStore();
    const dirs = getLongTermMemoryDirectories(root);
    const [notes, drafts, rejectedSuggestions, global, extraction, retention, agent] = await Promise.all([
      storage.listNotes(),
      new LongTermMemoryDraftStore(root).listDrafts(),
      readAllRejectedSuggestions(root),
      getLtmGlobalSettings(root).then((value) => ltmGlobalSettingsSchema.parse(value)),
      readConfig(ltmExtractionConfigPath(root), ltmExtractionSettingsSchema, { version: 1 }),
      readConfig(longTermMemoryRetentionConfigPath(root), ltmRetentionConfigSchema, DEFAULT_LTM_RETENTION_CONFIG),
      readConfig(safeJoin(dirs.config, "agent-settings.json"), ltmAgentSettingsSchema, {}),
    ]);
    return ltmBackupSchema.parse({
      format: backupFormat,
      version: 1,
      exportedAt: new Date().toISOString(),
      notes,
      drafts,
      rejectedSuggestions,
      settings: { global, extraction, retention, agent },
    });
  });
}

export function parseLongTermMemoryBackup(value: unknown): LtmBackup {
  return ltmBackupSchema.parse(value);
}

export function previewLongTermMemoryBackup(value: unknown, root = getLongTermMemoryRoot()) {
  const backup = parseLongTermMemoryBackup(value);
  return exportLongTermMemoryData(root).then((current) => ({
    format: backup.format,
    version: backup.version,
    exportedAt: backup.exportedAt,
    incoming: { notes: backup.notes.length, drafts: backup.drafts.length, rejectedSuggestions: backup.rejectedSuggestions.length },
    current: { notes: current.notes.length, drafts: current.drafts.length, rejectedSuggestions: current.rejectedSuggestions.length },
    settings: Object.keys(backup.settings),
  }));
}

async function pathExists(path: string) {
  return stat(path).then(() => true).catch(() => false);
}

async function writeBackupRoot(root: string, backup: LtmBackup) {
  const storage = new LongTermMemoryStorage(root);
  await storage.initializeLtmStore();
  const dirs = getLongTermMemoryDirectories(root);
  await storage.cleanup();
  await Promise.all([
    rm(dirs.vault, { recursive: true, force: true }),
    rm(dirs.drafts, { recursive: true, force: true }),
  ]);
  await storage.initializeLtmStore();
  for (const note of backup.notes)
    await writeJsonAtomic(notePathForId(note.id, note.type, root), note);
  for (const draft of backup.drafts)
    await writeJsonAtomic(safeJoin(dirs.drafts, `${draft.id}.json`), ltmExtractionDraftSchema.parse(draft));
  await writeRejectedSuggestions(backup.rejectedSuggestions, root);
  await Promise.all([
    writeJsonAtomic(ltmSettingsPath(root), backup.settings.global),
    writeJsonAtomic(ltmExtractionConfigPath(root), backup.settings.extraction),
    writeJsonAtomic(longTermMemoryRetentionConfigPath(root), backup.settings.retention),
    writeJsonAtomic(safeJoin(dirs.config, "agent-settings.json"), backup.settings.agent),
  ]);
  await Promise.all([
    rm(dirs.indexes, { recursive: true, force: true }),
    rm(dirs.transactions, { recursive: true, force: true }),
    rm(dirs.events, { recursive: true, force: true }),
    rm(dirs.debug, { recursive: true, force: true }),
  ]);
  await storage.cleanup();
}

export async function replaceLongTermMemoryData(value: unknown, root = getLongTermMemoryRoot()) {
  const backup = parseLongTermMemoryBackup(value);
  return withLtmVaultLock(root, () => withActiveLtmBackupRestore(root, async () => {
    const id = randomUUID();
    const staging = ltmBackupRestoreWorkspacePath(root, "restore-staging", id);
    const previous = ltmBackupRestoreWorkspacePath(root, "restore-previous", id);
    let journal: ReturnType<typeof createLtmBackupRestoreJournal> | undefined;
    let journalWritten = false;
    try {
      await rm(staging, { recursive: true, force: true });
      await rm(previous, { recursive: true, force: true });
      journal = createLtmBackupRestoreJournal(await pathExists(root));
      await writeBackupRoot(staging, backup);
      const stagedRebuild = await rebuildLongTermMemoryIndexes({ root: staging });
      const stagedIntegrity = await checkLongTermMemoryIntegrity(staging);
      if (!stagedIntegrity.ok)
        throw new Error("Imported Long-Term Memory data failed integrity verification.");
      await writeLtmBackupRestoreJournal(root, journal);
      journalWritten = true;
      const activeStorage = new LongTermMemoryStorage(root);
      await activeStorage.cleanup();
      if (journal.hadPreviousRoot) await rename(root, previous);
      await writeLtmBackupRestoreJournal(root, { ...journal, phase: "current_root_moved" });
      await rename(staging, root);
      await writeLtmBackupRestoreJournal(root, { ...journal, phase: "published" });
      const restoredStorage = new LongTermMemoryStorage(root);
      await restoredStorage.initializeLtmStore();
      const integrity = await checkLongTermMemoryIntegrity(root);
      if (!integrity.ok) throw new Error("Imported Long-Term Memory data failed integrity verification.");
      await writeLtmBackupRestoreJournal(root, { ...journal, phase: "verified" });
      await rm(previous, { recursive: true, force: true });
      await removeLtmBackupRestoreJournal(root);
       return { notes: backup.notes.length, drafts: backup.drafts.length, rejectedSuggestions: backup.rejectedSuggestions.length, rebuild: stagedRebuild, integrity };
    } catch (error) {
      if (journalWritten && journal) {
        try {
          await recoverInterruptedLtmBackupRestore(root, { rollbackPublished: true });
        } catch (recoveryError) {
          throw new AggregateError([error, recoveryError], "Long-Term Memory restore and rollback both failed.");
        }
        await new LongTermMemoryStorage(root).cleanup();
      } else {
        await Promise.allSettled([
          rm(staging, { recursive: true, force: true }),
          rm(previous, { recursive: true, force: true }),
          removeLtmBackupRestoreJournal(root),
        ]);
      }
      throw error;
    }
  }));
}

export async function deleteAllLongTermMemoryData(root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const backup = await exportLongTermMemoryData(root);
    return replaceLongTermMemoryData({
      ...backup,
      exportedAt: new Date().toISOString(),
      notes: [],
      drafts: [],
      rejectedSuggestions: [],
    }, root);
  });
}

export async function resetLongTermMemorySettings(root = getLongTermMemoryRoot()) {
  return withLtmVaultLock(root, async () => {
    const backup = await exportLongTermMemoryData(root);
    const dirs = getLongTermMemoryDirectories(root);
    const extraction = ltmExtractionSettingsSchema.parse(DEFAULT_LTM_EXTRACTION_CONFIG);
    await Promise.all([
      writeJsonAtomic(ltmSettingsPath(root), DEFAULT_LTM_GLOBAL_SETTINGS),
      writeJsonAtomic(ltmExtractionConfigPath(root), extraction),
      writeJsonAtomic(longTermMemoryRetentionConfigPath(root), DEFAULT_LTM_RETENTION_CONFIG),
      writeJsonAtomic(safeJoin(dirs.config, "agent-settings.json"), {}),
    ]);
    return {
      settings: await exportLongTermMemoryData(root).then((current) => current.settings),
      notes: backup.notes.length,
      drafts: backup.drafts.length,
      rejectedSuggestions: backup.rejectedSuggestions.length,
    };
  });
}
