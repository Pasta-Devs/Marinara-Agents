import { readdir, readFile } from "node:fs/promises";
import {
  ltmIndexStateSchema,
  type LtmIndexState,
  type LtmNote,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { readJsonFile, writeJsonAtomic } from "./atomic-json.js";
import { quarantineLtmIndexArtifact } from "./index-quarantine.js";
import { nowIso } from "./ltm-utils.js";
import { getLongTermMemoryDirectories, LTM_VAULT_FOLDERS, safeJoin } from "./paths.js";
import { logger, withKeyedLock } from "./package-runtime.js";
import { parseStoredLtmNote } from "./stored-note.js";
const locks = new Map<string, Promise<void>>();
export function ltmIndexStatePath(root: string) {
  return safeJoin(getLongTermMemoryDirectories(root).indexes, "state.json");
}
const noteSummaryPath = (root: string) => safeJoin(getLongTermMemoryDirectories(root).indexes, "note-summary.json");
type LtmNoteSummary = {
  version: 1;
  lastMutationId?: string;
  total: number;
  sourceNotes: number;
  savedMemories: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
};
const emptySummary = (): LtmNoteSummary => ({
  version: 1,
  total: 0,
  sourceNotes: 0,
  savedMemories: 0,
  byType: {},
  byStatus: {},
});
function isCountBucket(value: unknown): value is Record<string, number> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((count) => Number.isInteger(count) && (count as number) >= 0),
  );
}
function isNoteSummary(value: unknown): value is LtmNoteSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  return (
    summary.version === 1 &&
    Number.isInteger(summary.total) &&
    summary.total >= 0 &&
    Number.isInteger(summary.sourceNotes) &&
    summary.sourceNotes >= 0 &&
    Number.isInteger(summary.savedMemories) &&
    summary.savedMemories >= 0 &&
    isCountBucket(summary.byType) &&
    isCountBucket(summary.byStatus)
  );
}
function addNote(summary: LtmNoteSummary, note: LtmNote, delta: 1 | -1) {
  summary.total += delta;
  if (note.type === "source") summary.sourceNotes += delta;
  else summary.savedMemories += delta;
  for (const [key, value] of [
    [note.type, summary.byType],
    [note.status, summary.byStatus],
  ] as const) {
    value[key] = (value[key] ?? 0) + delta;
    if (value[key] === 0) delete value[key];
  }
}
export async function rebuildLtmNoteSummary(root: string) {
  const summary = emptySummary();
  const dirs = getLongTermMemoryDirectories(root);
  for (const folder of LTM_VAULT_FOLDERS) {
    for (const entry of await readdir(safeJoin(dirs.vault, folder), { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const note = parseStoredLtmNote(
        JSON.parse(await readFile(safeJoin(dirs.vault, `${folder}/${entry.name}`), "utf8")),
      );
      addNote(summary, note, 1);
    }
  }
  await writeJsonAtomic(noteSummaryPath(root), summary);
  return summary;
}
export async function writeLtmNoteSummary(root: string, notes: LtmNote[]) {
  const summary = emptySummary();
  for (const note of notes) addNote(summary, note, 1);
  await writeJsonAtomic(noteSummaryPath(root), summary);
  return summary;
}
export async function readLtmNoteSummary(root: string) {
  const summary = await readJsonFile<unknown>(noteSummaryPath(root), null);
  if (isNoteSummary(summary)) return summary as LtmNoteSummary;
  return rebuildLtmNoteSummary(root);
}
export async function updateLtmNoteSummary(
  root: string,
  mutationId: string,
  changes: Array<{ before: unknown; after: unknown }>,
) {
  const stored = await readJsonFile<unknown>(noteSummaryPath(root), null);
  if (!isNoteSummary(stored)) return rebuildLtmNoteSummary(root);
  const summary = stored as LtmNoteSummary;
  if (summary.lastMutationId === mutationId) return summary;
  for (const change of changes) {
    const before = parseNote(change.before);
    const after = parseNote(change.after);
    if (before) addNote(summary, before, -1);
    if (after) addNote(summary, after, 1);
  }
  summary.lastMutationId = mutationId;
  await writeJsonAtomic(noteSummaryPath(root), summary);
  return summary;
}
function parseNote(value: unknown) {
  if (!value) return null;
  try {
    return parseStoredLtmNote(value);
  } catch {
    return null;
  }
}
async function readDisk(root: string) {
  return ltmIndexStateSchema.parse(await readJsonFile(ltmIndexStatePath(root), { version: 1 }));
}
async function readOrRecover(root: string) {
  try {
    return await readDisk(root);
  } catch (error) {
    logger.warn(error, "[ltm] Quarantining malformed index state");
    await quarantineLtmIndexArtifact(root, ltmIndexStatePath(root));
    const state = ltmIndexStateSchema.parse({
      version: 1,
      revision: Date.now(),
      dirty: true,
      dirtyAt: nowIso(),
      rebuildState: "failed",
      rebuildCompletedAt: nowIso(),
      error: "Malformed long-term memory index state was quarantined; rebuild indexes.",
    });
    await writeJsonAtomic(ltmIndexStatePath(root), state);
    return state;
  }
}
export async function readLtmIndexState(root: string) {
  try {
    return await readDisk(root);
  } catch (error) {
    return withKeyedLock(locks, root, () => readOrRecover(root));
  }
}
async function update(root: string, fn: (state: LtmIndexState) => LtmIndexState) {
  return withKeyedLock(locks, root, async () => {
    const next = ltmIndexStateSchema.parse(fn(await readOrRecover(root)));
    await writeJsonAtomic(ltmIndexStatePath(root), next);
    return next;
  });
}
export function markLtmIndexesDirty(root: string) {
  return update(root, (state) => ({ ...state, revision: state.revision + 1, dirty: true, dirtyAt: nowIso() }));
}
export function markLtmIndexesBuilding(root: string) {
  return update(root, (state) => ({
    ...state,
    revision: state.revision + 1,
    dirty: true,
    dirtyAt: state.dirtyAt ?? nowIso(),
    rebuildState: "building",
    rebuildStartedAt: nowIso(),
    rebuildCompletedAt: undefined,
    error: undefined,
  }));
}
export function markLtmIndexesClean(root: string) {
  return update(root, (state) => ({
    ...state,
    revision: state.revision + 1,
    dirty: false,
    dirtyAt: undefined,
    rebuildState: "idle",
    rebuildCompletedAt: nowIso(),
    error: undefined,
  }));
}
export function markLtmIndexesFailed(root: string, error: unknown) {
  return update(root, (state) => ({
    ...state,
    revision: state.revision + 1,
    dirty: true,
    rebuildState: "failed",
    rebuildCompletedAt: nowIso(),
    error: error instanceof Error ? error.message.slice(0, 2_000) : "Recall index rebuild failed.",
  }));
}
