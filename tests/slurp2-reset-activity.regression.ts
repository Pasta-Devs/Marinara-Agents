import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// "Start over, keep Creators" (DELETE /data/activity) runs the real storage against a file database:
// activity and its media go, Creators, follows, settings and Creator artwork stay. The full reset
// still removes the Creators. Needs MARINARA_ENGINE_ROOT (a built staging Engine checkout); run it without
// tests/tsconfig.regressions.json, whose `@marinara-engine/shared` stub the Engine overlay cannot use.
const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));

type FileDb = {
  select: () => { from: (table: unknown) => Promise<Array<Record<string, unknown>>> };
  insert: (table: unknown) => { values: (row: unknown) => Promise<void> };
  _fileStore: { close: () => Promise<void>; registerTables: (tables: unknown[]) => Promise<void> };
};
type Storage = {
  getSettings: () => Promise<{ postsPerDay: number }>;
  updateSettings: (patch: Record<string, unknown>) => Promise<unknown>;
  deleteAllSlurpData: (options?: { keepCreators?: boolean }) => Promise<{ deletedCreators: number }>;
};

async function main() {
  const overlayRoot = await mkdtemp(join(tmpdir(), "slurp2-reset-activity-source-"));
  const dataDir = await mkdtemp(join(tmpdir(), "slurp2-reset-activity-data-"));
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

    const [{ createFileNativeDB }, schema, { createSlurpStorage }, media] = await Promise.all([
      load<{ createFileNativeDB: () => Promise<FileDb> }>("packages/server/src/db/file-backed-store.ts"),
      load<Record<string, unknown>>("packages/server/src/db/schema/slurp.ts"),
      load<{ createSlurpStorage: (db: FileDb) => Storage }>("packages/server/src/slp/data/slp-storage.ts"),
      load<{ resolveCreatorMediaAbsolutePath: (path: string) => string | null }>(
        "packages/server/src/slp/base/media/slp-media.ts",
      ),
    ]);
    db = await createFileNativeDB();
    await db._fileStore.registerTables(Object.values(schema));
    const storage = createSlurpStorage(db);
    const t = "2026-09-29T12:00:00.000Z";
    const mediaFile = async (name: string) => {
      const path = media.resolveCreatorMediaAbsolutePath(`slurp2-media/${name}`);
      assert.ok(path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "x");
      return path;
    };
    const postPicture = await mediaFile("post.png");
    const avatar = await mediaFile("avatar.png");

    await db.insert(schema.slpAccounts).values({
      id: "creator",
      kind: "character",
      entityId: "char-1",
      handle: "creator",
      displayName: "Creator",
      createdAt: t,
      updatedAt: t,
    });
    await db.insert(schema.slpAccountSubscriptions).values({
      id: "sub",
      viewerAccountId: "persona-1",
      creatorAccountId: "creator",
      createdAt: t,
    });
    await db.insert(schema.slpPosts).values({
      id: "post",
      authorAccountId: "creator",
      content: "hi",
      metadata: JSON.stringify({ noodlerMediaPath: "slurp2-media/post.png" }),
      createdAt: t,
      updatedAt: t,
    });
    await db.insert(schema.slurpThreads).values({
      id: "thread",
      viewerAccountId: "persona-1",
      creatorAccountId: "creator",
      lastMessageAt: t,
    });
    await db.insert(schema.slurpMessages).values({
      id: "message",
      threadId: "thread",
      senderAccountId: "creator",
      role: "creator",
      createdAt: t,
    });
    await storage.updateSettings({ postsPerDay: 7, postsPerDayCustom: true });

    await storage.deleteAllSlurpData({ keepCreators: true });
    const count = async (table: string) => (await db!.select().from(schema[table])).length;
    assert.equal(await count("slpAccounts"), 1, "the recovery reset keeps Creators");
    assert.equal(await count("slpAccountSubscriptions"), 1, "the recovery reset keeps follows");
    assert.equal((await storage.getSettings()).postsPerDay, 7, "the recovery reset keeps Slurp settings");
    assert.equal(await count("slpPosts"), 0);
    assert.equal(await count("slurpThreads"), 0);
    assert.equal(await count("slurpMessages"), 0);
    assert.equal(existsSync(postPicture), false, "a deleted post's picture is removed");
    assert.equal(existsSync(avatar), true, "Creator artwork survives the recovery reset");

    const full = await storage.deleteAllSlurpData();
    assert.equal(full.deletedCreators, 1);
    assert.equal(await count("slpAccounts"), 0, "the full reset still removes Creators");
    assert.equal((await storage.getSettings()).postsPerDay === 7, false, "the full reset clears settings");
    console.log("slurp2 reset-activity regression passed");
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
