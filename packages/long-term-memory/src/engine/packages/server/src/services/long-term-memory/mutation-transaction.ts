import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, unlink } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, relative, sep } from "node:path";
import { z } from "zod";
import {
  ltmEventSchema,
  ltmSafeRelativePathSchema,
  type LtmEvent,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { appendJsonLineAtomic, writeJsonAtomic } from "./atomic-json.js";
import { markLtmIndexesDirty, rebuildLtmNoteSummary, updateLtmNoteSummary } from "./index-state.js";
import { isEnoent, nowIso } from "./ltm-utils.js";
import { assertInsideDirectory, getLongTermMemoryDirectories, safeJoin } from "./paths.js";
import { logger } from "./package-runtime.js";
import { appendLtmActivityEvents } from "./activity-index.js";

const changeSchema = z
  .object({ path: ltmSafeRelativePathSchema, before: z.unknown().nullable(), after: z.unknown().nullable() })
  .strict();
export const ltmMutationTransactionSchema = z
  .object({
    version: z.literal(1),
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    status: z.enum(["prepared", "committing", "committed"]),
    files: z.array(changeSchema).min(1),
    events: z.array(ltmEventSchema),
  })
  .strict();
export type LtmMutationTransaction = z.infer<typeof ltmMutationTransactionSchema>;
export type LtmMutationFileChange = { path: string; before: unknown | null; after: unknown | null };
const journalPath = (root: string, id: string) =>
  safeJoin(getLongTermMemoryDirectories(root).transactions, `${id}.json`);
function create(root: string, files: LtmMutationFileChange[], events: LtmEvent[]) {
  return ltmMutationTransactionSchema.parse({
    version: 1,
    id: randomUUID(),
    createdAt: nowIso(),
    status: "prepared",
    files: files.map((file) => ({
      ...file,
      path: ltmSafeRelativePathSchema.parse(
        relative(assertInsideDirectory(root, root), assertInsideDirectory(root, file.path)).split(sep).join("/"),
      ),
    })),
    events,
  });
}
async function apply(root: string, tx: LtmMutationTransaction, state: "before" | "after") {
  for (const file of tx.files) {
    const path = safeJoin(root, file.path);
    const value = file[state];
    if (value === null)
      await unlink(path).catch((error) => {
        if (!isEnoent(error)) throw error;
      });
    else await writeJsonAtomic(path, value);
  }
}
async function remove(root: string, tx: LtmMutationTransaction) {
  await unlink(journalPath(root, tx.id)).catch((error) => {
    if (!isEnoent(error)) throw error;
  });
}
async function publish(root: string, tx: LtmMutationTransaction, deduplicate = false) {
  const eventLog = getLongTermMemoryDirectories(root).eventLog;
  const pending = new Map(tx.events.map((event) => [event.id, event]));
  if (deduplicate)
    try {
      const lines = createInterface({ input: createReadStream(eventLog), crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = ltmEventSchema.safeParse(JSON.parse(line));
          if (parsed.success) pending.delete(parsed.data.id);
        } catch {
          // Historical JSONL may contain a malformed line; new events remain publishable.
        }
      }
    } catch (error) {
      if (!isEnoent(error)) throw error;
    }
  for (const event of deduplicate ? pending.values() : tx.events) await appendJsonLineAtomic(eventLog, event);
  await appendLtmActivityEvents(root, tx.events);
  await remove(root, tx);
}
export async function commitLtmMutation(root: string, input: { files: LtmMutationFileChange[]; events?: LtmEvent[] }) {
  const prepared = create(root, input.files, input.events ?? []);
  await writeJsonAtomic(journalPath(root, prepared.id), prepared);
  let committed = false;
  try {
    await markLtmIndexesDirty(root);
    const committing = ltmMutationTransactionSchema.parse({ ...prepared, status: "committing" });
    await writeJsonAtomic(journalPath(root, prepared.id), committing);
    await apply(root, committing, "after");
    const done = ltmMutationTransactionSchema.parse({ ...committing, status: "committed" });
    await writeJsonAtomic(journalPath(root, done.id), done);
    committed = true;
    await updateLtmNoteSummary(root, done.id, done.files);
    await publish(root, done);
  } catch (error) {
    if (committed) {
      logger.warn(error, "[ltm] Vault mutation committed; deferred recovery will finish its journal");
      return;
    }
    await apply(root, prepared, "before");
    await markLtmIndexesDirty(root);
    await remove(root, prepared);
    throw error;
  }
}
export async function recoverLtmMutations(root: string) {
  const dir = getLongTermMemoryDirectories(root).transactions;
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (isEnoent(error)) return [];
    throw error;
  });
  const transactions: LtmMutationTransaction[] = [];
  for (const entry of entries.filter((x) => x.isFile() && x.name.endsWith(".json"))) {
    const path = safeJoin(dir, entry.name);
    const raw = await readFile(path, "utf8");
    try {
      transactions.push(ltmMutationTransactionSchema.parse(JSON.parse(raw)));
    } catch (error) {
      if (!(error instanceof SyntaxError || error instanceof z.ZodError)) throw error;
      const target = safeJoin(root, `quarantine/transactions/${Date.now()}-${randomUUID()}/${entry.name}`);
      await mkdir(dirname(target), { recursive: true });
      await rename(path, target);
      logger.warn(error, `[ltm] Quarantined invalid mutation journal ${entry.name}`);
    }
  }
  const committed: LtmMutationTransaction[] = [];
  for (const tx of transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (tx.status === "committed") {
      await apply(root, tx, "after");
      committed.push(tx);
    } else {
      await apply(root, tx, "before");
      await remove(root, tx);
    }
    await markLtmIndexesDirty(root);
  }
  if (committed.length) await rebuildLtmNoteSummary(root);
  for (const tx of committed) await publish(root, tx, true);
}
