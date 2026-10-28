import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// "Write it again" (R9) keeps the old answer until the new one exists: snapshot, delete, and a failed
// try puts the old answer back. Runs the real storage against a file database. Needs MARINARA_ENGINE_ROOT (a built staging Engine checkout); run it without
// tests/tsconfig.regressions.json, whose `@marinara-engine/shared` stub the Engine overlay cannot use.
const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));

type Row = Record<string, unknown>;
type FileDb = {
  select: () => { from: (table: unknown) => Promise<Row[]> };
  insert: (table: unknown) => { values: (row: unknown) => Promise<void> };
  _fileStore: { close: () => Promise<void>; registerTables: (tables: unknown[]) => Promise<void> };
};

async function main() {
  const overlayRoot = await mkdtemp(join(tmpdir(), "slurp2-dm-write-again-source-"));
  const dataDir = await mkdtemp(join(tmpdir(), "slurp2-dm-write-again-data-"));
  Object.assign(process.env, {
    AUTO_CREATE_DEFAULT_CONNECTION: "false",
    DATA_DIR: dataDir,
    LOG_LEVEL: "silent",
    MARINARA_ENV_FILE: join(dataDir, ".env"),
    MARINARA_LITE: "true",
    NODE_ENV: "test",
  });
  const load = <T>(path: string) => import(pathToFileURL(join(overlayRoot, path)).href) as Promise<T>;
  let db: FileDb | null = null;

  try {
    await mkdir(join(overlayRoot, "packages/server"), { recursive: true });
    await cp(join(engineRoot, "package.json"), join(overlayRoot, "package.json"));
    await cp(join(engineRoot, "packages/server/package.json"), join(overlayRoot, "packages/server/package.json"));
    await cp(join(engineRoot, "packages/server/src"), join(overlayRoot, "packages/server/src"), { recursive: true });
    await cp(join(engineRoot, "packages/shared"), join(overlayRoot, "packages/shared"), { recursive: true });
    await cp(join(repoRoot, "packages/slurp2/src/engine/packages"), join(overlayRoot, "packages"), {
      recursive: true,
      force: true,
    });
    // Slurp2's schema takes the host's `slurp.ts` name; the host's legacy schema stays in its barrel.
    const schemaRoot = join(overlayRoot, "packages/server/src/db/schema");
    await cp(join(engineRoot, "packages/server/src/db/schema/slurp.ts"), join(schemaRoot, "host-slurp.ts"));
    const hostSchema = await readFile(join(schemaRoot, "index.ts"), "utf8");
    await writeFile(
      join(schemaRoot, "index.ts"),
      hostSchema.replace('export * from "./slurp.js";', 'export * from "./host-slurp.js";'),
    );
    await symlink(join(engineRoot, "node_modules"), join(overlayRoot, "node_modules"), "dir");
    await symlink(
      join(engineRoot, "packages/server/node_modules"),
      join(overlayRoot, "packages/server/node_modules"),
      "dir",
    );

    const [{ createFileNativeDB }, schema, edit, queue] = await Promise.all([
      load<{ createFileNativeDB: () => Promise<FileDb> }>("packages/server/src/db/file-backed-store.ts"),
      load<Record<string, unknown>>("packages/server/src/db/schema/slurp.ts"),
      load<{
        snapshotSlurpMessages: (db: FileDb, threadId: string, ids: string[]) => Promise<Row[]>;
        deleteSlurpMessages: (db: FileDb, threadId: string, ids: string[]) => Promise<void>;
        restoreSlurpMessages: (db: FileDb, threadId: string, rows: Row[]) => Promise<void>;
      }>("packages/server/src/slp/data/messages/slp-message-edit-storage.ts"),
      load<{ createSlurpReplyQueueStorage: (db: FileDb) => { hasPending: (threadId: string) => Promise<boolean> } }>(
        "packages/server/src/slp/data/messages/slp-reply-queue-storage.ts",
      ),
    ]);
    db = await createFileNativeDB();
    await db._fileStore.registerTables(Object.values(schema));
    const t = "2026-10-12T12:00:00.000Z";
    await db.insert(schema.slpAccounts).values({
      id: "creator",
      kind: "character",
      entityId: "char-1",
      handle: "creator",
      displayName: "Creator",
      createdAt: t,
      updatedAt: t,
    });
    await db
      .insert(schema.slurpThreads)
      .values({ id: "thread", viewerAccountId: "persona-1", creatorAccountId: "creator", lastMessageAt: t });
    const line = (id: string, role: string, createdAt: string) =>
      db!
        .insert(schema.slurpMessages)
        .values({ id, threadId: "thread", senderAccountId: role, role, content: id, createdAt });
    await line("fan", "viewer", "2026-10-12T12:00:01.000Z");
    await line("answer-1", "creator", "2026-10-12T12:00:02.000Z");
    await line("answer-2", "creator", "2026-10-12T12:00:03.000Z");
    const ids = async () =>
      ((await db!.select().from(schema.slurpMessages)) as unknown as Row[]).map((row) => String(row.id)).sort();

    // The new answer could not be written: the old one is back, as it was.
    const old = await edit.snapshotSlurpMessages(db, "thread", ["answer-1", "answer-2"]);
    assert.equal(old.length, 2);
    await edit.deleteSlurpMessages(db, "thread", ["answer-1", "answer-2"]);
    assert.deepEqual(await ids(), ["fan"], "the old answer is out while the new one is written");
    await edit.restoreSlurpMessages(db, "thread", old);
    assert.deepEqual(await ids(), ["answer-1", "answer-2", "fan"], "a failed try keeps the old answer");
    const restored = ((await db.select().from(schema.slurpMessages)) as unknown as Row[]).find(
      (row) => row.id === "answer-2",
    )!;
    assert.equal(restored.createdAt, "2026-10-12T12:00:03.000Z", "same time and content");
    assert.equal(restored.content, "answer-2");
    assert.equal(await queue.createSlurpReplyQueueStorage(db).hasPending("thread"), false);
    console.log("slurp2 DM write again regression passed");
  } finally {
    await db?._fileStore.close();
    await rm(overlayRoot, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
