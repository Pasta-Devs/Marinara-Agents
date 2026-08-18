import { randomUUID } from "node:crypto";
import { readFile, rm, stat, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { z } from "zod";
import { fsyncPath, renameWithRetry, writeJsonAtomic } from "./atomic-json.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
const schema = z
  .object({
    version: z.literal(1),
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    phase: z.enum(["staged", "current_root_moved", "published", "rebuilt", "verified"]),
    hadPreviousRoot: z.boolean(),
  })
  .strict();
const active = new Set<string>();
export const isLtmBackupRestoreActive = (root: string) => active.has(resolve(root));
export async function withActiveLtmBackupRestore<T>(root: string, operation: () => Promise<T>) {
  const key = resolve(root);
  active.add(key);
  try {
    return await operation();
  } finally {
    active.delete(key);
  }
}
export const ltmBackupRestoreWorkspacePath = (root: string, label: string, id: string) =>
  join(dirname(root), `.${basename(root)}-${label}-${id}`);
export const ltmBackupRestoreJournalPath = (root: string) => join(dirname(root), `.${basename(root)}-restore.json`);
export type LtmBackupRestoreJournal = z.infer<typeof schema>;
export function createLtmBackupRestoreJournal(hadPreviousRoot: boolean): LtmBackupRestoreJournal {
  return schema.parse({ version: 1, id: randomUUID(), createdAt: nowIso(), phase: "staged", hadPreviousRoot });
}
export async function writeLtmBackupRestoreJournal(root: string, journal: LtmBackupRestoreJournal) {
  const parsed = schema.parse(journal);
  await writeJsonAtomic(ltmBackupRestoreJournalPath(root), parsed);
  return parsed;
}
export async function removeLtmBackupRestoreJournal(root: string) {
  await unlink(ltmBackupRestoreJournalPath(root)).catch((e) => {
    if (!isEnoent(e)) throw e;
  });
  await fsyncPath(dirname(root));
}
async function exists(path: string) {
  return stat(path)
    .then(() => true)
    .catch((error) => {
      if (isEnoent(error)) return false;
      throw error;
    });
}
export async function recoverInterruptedLtmBackupRestore(root: string, options: { rollbackPublished?: boolean } = {}) {
  let journal;
  try {
    journal = schema.parse(JSON.parse(await readFile(ltmBackupRestoreJournalPath(root), "utf8")));
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
  const staging = ltmBackupRestoreWorkspacePath(root, "restore-staging", journal.id);
  const previous = ltmBackupRestoreWorkspacePath(root, "restore-previous", journal.id);
  const previousExists = await exists(previous);
  const preservePublished = !options.rollbackPublished && ["published", "rebuilt", "verified"].includes(journal.phase);
  if (preservePublished || journal.phase === "verified") {
    if (await exists(root)) await rm(previous, { recursive: true, force: true });
    else if (previousExists) await renameWithRetry(previous, root);
    else throw new Error("Published long-term memory restore has no canonical or rollback root.");
  } else if (journal.hadPreviousRoot && previousExists) {
    await rm(root, { recursive: true, force: true });
    await renameWithRetry(previous, root);
  } else if (journal.hadPreviousRoot && journal.phase !== "staged")
    throw new Error("Interrupted long-term memory restore is missing its rollback root.");
  else if (!journal.hadPreviousRoot) await rm(root, { recursive: true, force: true });
  await rm(staging, { recursive: true, force: true });
  await rm(previous, { recursive: true, force: true });
  await unlink(ltmBackupRestoreJournalPath(root));
  await fsyncPath(dirname(root));
  return true;
}
