import { randomUUID } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import { relative, sep } from "node:path";
import { z } from "zod";
import { ltmEventSchema, ltmSafeRelativePathSchema, type LtmEvent } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { appendJsonLineAtomic, writeJsonAtomic } from "./atomic-json.js";
import { markLtmIndexesDirty } from "./index-state.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
import { assertInsideDirectory, getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { logger } from "./package-runtime.js";

const changeSchema = z.object({ path: ltmSafeRelativePathSchema, before: z.unknown().nullable(), after: z.unknown().nullable() }).strict();
export const ltmMutationTransactionSchema = z.object({ version: z.literal(1), id: z.string().uuid(), createdAt: z.string().datetime(), status: z.enum(["prepared", "committing", "committed"]), files: z.array(changeSchema).min(1), events: z.array(ltmEventSchema) }).strict();
export type LtmMutationTransaction = z.infer<typeof ltmMutationTransactionSchema>;
export type LtmMutationFileChange = { path: string; before: unknown | null; after: unknown | null };
const journalPath = (root: string, id: string) => safeJoin(getLongTermMemoryDirectories(root).transactions, `${id}.json`);
function create(root: string, files: LtmMutationFileChange[], events: LtmEvent[]) { return ltmMutationTransactionSchema.parse({ version: 1, id: randomUUID(), createdAt: nowIso(), status: "prepared", files: files.map((file) => ({ ...file, path: ltmSafeRelativePathSchema.parse(relative(assertInsideDirectory(root, root), assertInsideDirectory(root, file.path)).split(sep).join("/")) })), events }); }
async function apply(root: string, tx: LtmMutationTransaction, state: "before" | "after") { for (const file of tx.files) { const path = safeJoin(root, file.path); const value = file[state]; if (value === null) await unlink(path).catch((error) => { if (!isEnoent(error)) throw error; }); else await writeJsonAtomic(path, value); } }
async function remove(root: string, tx: LtmMutationTransaction) { await unlink(journalPath(root, tx.id)).catch((error) => { if (!isEnoent(error)) throw error; }); }
async function publish(root: string, tx: LtmMutationTransaction) { const eventLog=getLongTermMemoryDirectories(root).eventLog; const delivered=new Set<string>(); try{for(const line of (await readFile(eventLog,"utf8")).split("\n")){if(!line.trim())continue;const parsed=ltmEventSchema.safeParse(JSON.parse(line));if(parsed.success)delivered.add(parsed.data.id);}}catch(error){if(!isEnoent(error))throw error;} for (const event of tx.events) if(!delivered.has(event.id)){await appendJsonLineAtomic(eventLog,event);delivered.add(event.id);} await remove(root, tx); }
export async function commitLtmMutation(root: string, input: { files: LtmMutationFileChange[]; events?: LtmEvent[] }) {
  const prepared = create(root, input.files, input.events ?? []); await writeJsonAtomic(journalPath(root, prepared.id), prepared); let committed = false;
  try { await markLtmIndexesDirty(root); const committing = ltmMutationTransactionSchema.parse({ ...prepared, status: "committing" }); await writeJsonAtomic(journalPath(root, prepared.id), committing); await apply(root, committing, "after"); const done = ltmMutationTransactionSchema.parse({ ...committing, status: "committed" }); await writeJsonAtomic(journalPath(root, done.id), done); committed = true; await publish(root, done); }
  catch (error) { if (committed) { logger.warn(error, "[ltm] Vault mutation committed; deferred recovery will finish its journal"); return; } await apply(root, prepared, "before"); await markLtmIndexesDirty(root); await remove(root, prepared); throw error; }
}
export async function recoverLtmMutations(root: string) { const dir = getLongTermMemoryDirectories(root).transactions; const entries = await readdir(dir, { withFileTypes: true }).catch((error) => { if (isEnoent(error)) return []; throw error; }); for (const entry of entries.filter((x) => x.isFile() && x.name.endsWith(".json")).sort((a,b) => a.name.localeCompare(b.name))) { const tx = ltmMutationTransactionSchema.parse(JSON.parse(await readFile(safeJoin(dir, entry.name), "utf8"))); if (tx.status === "committed") { await apply(root, tx, "after"); await markLtmIndexesDirty(root); await publish(root, tx); } else { await apply(root, tx, "before"); await markLtmIndexesDirty(root); await remove(root, tx); } } }
