import { join, resolve, sep } from "node:path";
import {
  LTM_NOTE_TYPE_TO_VAULT_FOLDER,
  ltmNoteIdSchema,
  ltmNoteTypeSchema,
  ltmSafeRelativePathSchema,
  type LtmNoteType,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { getPackageDataDir } from "./package-runtime.js";

export const LTM_DIR_NAME = "long-term-memory";
export const LTM_VAULT_DIR = "vault";
export const LTM_VAULT_FOLDERS = ["sources", "timeline", "characters", "relationships", "scenes", "world", "threads", "tone"] as const;

export function getLongTermMemoryRoot(dataDir = getPackageDataDir()) { return join(dataDir, LTM_DIR_NAME); }
export function getLongTermMemoryDirectories(root = getLongTermMemoryRoot()) {
  return {
    root, vault: join(root, LTM_VAULT_DIR), events: join(root, "events"), debug: join(root, "debug"),
    indexes: join(root, "indexes"), config: join(root, "config"), drafts: join(root, "drafts"),
    transactions: join(root, "transactions"), receipts: join(root, "events", "receipts"),
    eventLog: join(root, "events", "log.jsonl"), debugLog: join(root, "debug", "log.jsonl"),
  };
}
export function vaultFolderForNoteType(type: LtmNoteType) { return LTM_NOTE_TYPE_TO_VAULT_FOLDER[type]; }
export function notePathForId(id: string, type: LtmNoteType, root = getLongTermMemoryRoot()) {
  return join(root, LTM_VAULT_DIR, vaultFolderForNoteType(ltmNoteTypeSchema.parse(type)), `${ltmNoteIdSchema.parse(id)}.json`);
}
export function assertInsideDirectory(root: string, candidate: string) {
  const base = resolve(root); const path = resolve(candidate);
  if (path !== base && !path.startsWith(`${base}${sep}`)) throw new Error(`Path escapes long-term memory root: ${candidate}`);
  return path;
}
export function safeJoin(root: string, relativePath: string) {
  const safe = ltmSafeRelativePathSchema.parse(relativePath);
  return assertInsideDirectory(root, join(root, ...safe.split(/[\\/]+/)));
}
