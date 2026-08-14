import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename, dirname, relative } from "node:path";
import {
  ltmEventSchema,
  ltmIndexStateSchema,
  type LtmIndexHealth,
  type LtmIntegrityIssue,
  type LtmIntegrityResponse,
  type LtmNote,
  type LtmRepairAction,
  type LtmRepairResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { chunkNotes, stableJsonHash } from "./chunking.js";
import { ltmIndexStatePath } from "./index-state.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
import { logger } from "./package-runtime.js";
import {
  getLongTermMemoryDirectories,
  getLongTermMemoryRoot,
  LTM_VAULT_FOLDERS,
  notePathForId,
  safeJoin,
  vaultFolderForNoteType,
} from "./paths.js";
import {
  longTermMemoryRecallIndexPath,
  parseLtmRecallIndex,
  rebuildLongTermMemoryIndexes,
} from "./rebuild.js";
import { LongTermMemoryStorage } from "./storage.js";
import { parseStoredLtmNote } from "./stored-note.js";
import { withLtmVaultLock } from "./vault-lock.js";

type VaultFile = {
  folder: (typeof LTM_VAULT_FOLDERS)[number];
  path: string;
};

async function listVaultFiles(root: string): Promise<VaultFile[]> {
  const vault = getLongTermMemoryDirectories(root).vault;
  const files: VaultFile[] = [];
  for (const folder of LTM_VAULT_FOLDERS) {
    const folderPath = safeJoin(vault, folder);
    const entries = await readdir(folderPath, { withFileTypes: true }).catch((error) => {
      if (isEnoent(error)) return [];
      throw error;
    });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push({ folder, path: safeJoin(folderPath, entry.name) });
      }
    }
  }
  return files;
}

function publicPath(root: string, path: string) {
  return relative(root, path).split(/[\\/]+/).join("/");
}

async function checkEventLog(root: string, issues: LtmIntegrityIssue[]) {
  const path = getLongTermMemoryDirectories(root).eventLog;
  const displayPath = publicPath(root, path);
  let eventCount = 0;
  let index = 0;
  try {
    for await (const line of createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity })) {
      index += 1;
      if (!line.trim()) continue;
      try {
        ltmEventSchema.parse(JSON.parse(line));
        eventCount += 1;
      } catch (error) {
        issues.push({
          severity: "error",
          code: "malformed_event",
          path: displayPath,
          message:
            error instanceof Error
              ? `Line ${index}: ${error.message}`
              : `Line ${index}: Event failed validation.`,
        });
      }
    }
  } catch (error) {
    if (isEnoent(error)) return 0;
    logger.error(error, "[ltm] Event log unreadable at %s", displayPath);
    issues.push({
      severity: "error",
      code: "event_log_unreadable",
      path: displayPath,
      message: error instanceof Error ? error.message : "Event log could not be read.",
    });
  }
  return eventCount;
}

async function checkRecallIndex(root: string, notes: LtmNote[], issues: LtmIntegrityIssue[]): Promise<LtmIndexHealth> {
  const recallPath = longTermMemoryRecallIndexPath(root);
  const statePath = ltmIndexStatePath(root);
  const displayRecallPath = publicPath(root, recallPath);
  let index: ReturnType<typeof parseLtmRecallIndex>;
  try {
    index = parseLtmRecallIndex(JSON.parse(await readFile(recallPath, "utf8")));
  } catch (error) {
    if (isEnoent(error)) {
      if (notes.length > 0) {
        issues.push({
          severity: "warning",
          code: "indexes_not_built",
          path: displayRecallPath,
          message: "Long-term memory indexes have not been built for the current vault.",
        });
      }
      return "not_built";
    }
    logger.warn(error, "[ltm] Recall index could not be validated");
    issues.push({
      severity: "error",
      code: "recall_index_unreadable",
      path: displayRecallPath,
      message: "The long-term memory recall index cannot be read or validated.",
    });
    return "corrupt";
  }

  let health: LtmIndexHealth = "healthy";
  const sourceHash = stableJsonHash(chunkNotes(notes, { includeSourceNotes: false }));
  if (index.sourceHash !== sourceHash) {
    health = "stale";
    issues.push({
      severity: "warning",
      code: "index_source_hash_mismatch",
      path: displayRecallPath,
      message: "Recall index source hash does not match the current vault content.",
    });
  }

  let state;
  try {
    state = ltmIndexStateSchema.parse(JSON.parse(await readFile(statePath, "utf8")));
  } catch (error) {
    if (isEnoent(error)) {
      issues.push({
        severity: "warning",
        code: "index_state_missing",
        path: publicPath(root, statePath),
        message: "Recall index state is missing; rebuild indexes to restore freshness tracking.",
      });
      return health === "healthy" ? "degraded" : health;
    }
    logger.warn(error, "[ltm] Recall index state could not be validated");
    issues.push({
      severity: "error",
      code: "index_state_unreadable",
      path: publicPath(root, statePath),
      message: "Recall index state cannot be read or validated.",
    });
    return "corrupt";
  }

  if (state.dirty) {
    health = "stale";
    issues.push({
      severity: "warning",
      code: "indexes_dirty",
      path: publicPath(root, statePath),
      message: "The vault changed after the recall index was built.",
    });
  }
  if (state.rebuildState === "failed") {
    health = "stale";
    issues.push({
      severity: "warning",
      code: "index_rebuild_failed",
      path: publicPath(root, statePath),
      message: state.error ?? "The latest index rebuild failed.",
    });
  } else if (state.rebuildState === "building" && health === "healthy") {
    health = "degraded";
    issues.push({
      severity: "info",
      code: "index_rebuild_in_progress",
      path: publicPath(root, statePath),
      message: "The recall index is being rebuilt.",
    });
  }
  return health;
}

export async function checkLongTermMemoryIntegrity(
  root = getLongTermMemoryRoot(),
): Promise<LtmIntegrityResponse> {
  return withLtmVaultLock(root, () => checkLongTermMemoryIntegrityUnlocked(root));
}

async function checkLongTermMemoryIntegrityUnlocked(
  root: string,
): Promise<LtmIntegrityResponse> {
  const issues: LtmIntegrityIssue[] = [];
  const notesById = new Map<string, LtmNote>();

  for (const file of await listVaultFiles(root)) {
    const displayPath = publicPath(root, file.path);
    try {
      const note = parseStoredLtmNote(JSON.parse(await readFile(file.path, "utf8")));
      if (notesById.has(note.id)) {
        issues.push({
          severity: "error",
          code: "duplicate_note_id",
          path: displayPath,
          noteId: note.id,
          message: `More than one vault file contains note ID ${note.id}.`,
        });
      } else {
        notesById.set(note.id, note);
      }
      if (vaultFolderForNoteType(note.type) !== file.folder) {
        issues.push({
          severity: "error",
          code: "folder_type_mismatch",
          path: displayPath,
          noteId: note.id,
          message: `Note type ${note.type} belongs in ${vaultFolderForNoteType(note.type)}.`,
        });
      }
      const expectedPath = notePathForId(note.id, note.type, root);
      if (expectedPath !== file.path) {
        issues.push({
          severity: "warning",
          code: "path_id_mismatch",
          path: displayPath,
          noteId: note.id,
          message: `Filename should be ${basename(expectedPath)}.`,
        });
      }
    } catch (error) {
      logger.warn(error, "[ltm] Malformed note at %s", displayPath);
      issues.push({
        severity: "error",
        code: "malformed_note",
        path: displayPath,
        message: error instanceof Error ? error.message : "Note could not be read or validated.",
      });
    }
  }

  for (const note of notesById.values()) {
    for (const link of note.links) {
      if (!notesById.has(link.target)) {
        issues.push({
          severity: "warning",
          code: "missing_link_target",
          noteId: note.id,
          message: `Link target ${link.target} does not exist.`,
        });
      }
    }
  }

  const notes = [...notesById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const eventCount = await checkEventLog(root, issues);
  const health = await checkRecallIndex(root, notes, issues);
  const boundedIssues = issues.slice(0, 10_000);
  return {
    ok:
      !issues.some((issue) => issue.severity === "error") &&
      (health === "healthy" || (health === "not_built" && notes.length === 0)),
    health,
    checkedAt: nowIso(),
    noteCount: notes.length,
    eventCount,
    issues: boundedIssues,
  };
}

function titleCaseFromIdentifier(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stripImportPrefix(value: string) {
  return value
    .replace(/^source_import_(character|lorebook|chat)_/, "")
    .replace(/^scene_import_(character|lorebook|chat)_/, "")
    .replace(/_[a-f0-9]{10}$/i, "");
}

function importedSourceTitleFromNote(note: LtmNote) {
  const evidence = note.sections.source?.evidence ?? [];
  const chatName = evidence.find((entry) => entry.startsWith("chat_name:"))?.slice("chat_name:".length).trim();
  const messageRange = evidence
    .find((entry) => entry.startsWith("message_range:"))
    ?.slice("message_range:".length)
    .trim();
  if (note.tags.includes("imported_chat") && chatName) {
    return messageRange ? `${chatName}, msgs ${messageRange}` : chatName;
  }
  const name = titleCaseFromIdentifier(stripImportPrefix(note.id));
  if (note.tags.includes("imported_character")) return `Character \u2014 ${name}`;
  if (note.tags.includes("imported_lorebook")) return `Lorebook \u2014 ${name}`;
  return name || "Imported source";
}

async function quarantineMalformedNotes(root: string) {
  const quarantineRoot = safeJoin(root, `quarantine/malformed-${Date.now()}-${randomUUID()}`);
  let moved = 0;
  for (const file of await listVaultFiles(root)) {
    try {
      parseStoredLtmNote(JSON.parse(await readFile(file.path, "utf8")));
    } catch {
      const target = safeJoin(quarantineRoot, `${file.folder}/${basename(file.path)}`);
      await mkdir(dirname(target), { recursive: true });
      await rename(file.path, target);
      moved += 1;
    }
  }
  return moved;
}

async function rebuildCurrentIndexes(root: string) {
  return rebuildLongTermMemoryIndexes({ root });
}

export async function repairLongTermMemory(
  actions: LtmRepairAction[],
  root = getLongTermMemoryRoot(),
): Promise<LtmRepairResponse> {
  return withLtmVaultLock(root, async () => {
    let quarantined = 0;
    let backfilled = 0;
    if (actions.includes("quarantine_malformed_notes")) {
      quarantined = await quarantineMalformedNotes(root);
    }
    if (actions.includes("backfill_imported_source_titles")) {
      const storage = new LongTermMemoryStorage(root);
      for (const note of await storage.listNotes({ type: "source" })) {
        if (note.title?.trim() || !note.tags.some((tag) => tag.startsWith("imported_"))) continue;
        await storage.updateNote(note.id, { title: importedSourceTitleFromNote(note) });
        backfilled += 1;
      }
    }

    const rebuildNeeded =
      actions.includes("rebuild_indexes") || quarantined > 0 || backfilled > 0;
    const rebuilt = rebuildNeeded ? await rebuildCurrentIndexes(root) : null;
    const results: LtmRepairResponse["actions"] = actions.map((action) => {
      if (action === "rebuild_indexes") {
        return { action, result: "rebuilt", count: rebuilt?.chunkCount ?? 0 };
      }
      if (action === "quarantine_malformed_notes") {
        return {
          action,
          result: quarantined > 0 ? "quarantined" : "no_malformed_notes",
          count: quarantined,
        };
      }
      return {
        action,
        result: backfilled > 0 ? "backfilled" : "no_titles_to_backfill",
        count: backfilled,
      };
    });
    logger.info("[ltm] Completed maintenance repair with %d action(s)", results.length);
    return {
      repairedAt: nowIso(),
      actions: results,
      integrity: await checkLongTermMemoryIntegrity(root),
    };
  });
}
