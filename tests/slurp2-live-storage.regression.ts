import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));

async function main() {
  const overlayRoot = await mkdtemp(join(tmpdir(), "slurp2-live-storage-source-"));
  const dataDir = await mkdtemp(join(tmpdir(), "slurp2-live-storage-data-"));
  Object.assign(process.env, {
    AUTO_CREATE_DEFAULT_CONNECTION: "false",
    DATA_DIR: dataDir,
    LOG_LEVEL: "silent",
    MARINARA_ENV_FILE: join(dataDir, ".env"),
    MARINARA_LITE: "true",
    NODE_ENV: "test",
  });
  const load = <T>(path: string) => import(pathToFileURL(join(overlayRoot, path)).href) as Promise<T>;
  let db: any;
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

    const [{ createFileNativeDB }, schema, { createSlurpLiveStorage }] = await Promise.all([
      load<{ createFileNativeDB: () => Promise<any> }>("packages/server/src/db/file-backed-store.ts"),
      load<Record<string, unknown>>("packages/server/src/db/schema/slurp.ts"),
      load<{ createSlurpLiveStorage: (db: any) => any }>("packages/server/src/slp/data/live/slp-live-storage.ts"),
    ]);
    db = await createFileNativeDB();
    await db._fileStore.registerTables(Object.values(schema));
    const live = createSlurpLiveStorage(db);
    const at = new Date("2026-10-23T12:00:00.000Z");
    const future = new Date("2026-10-23T13:00:00.000Z");
    const end = new Date("2026-10-23T13:20:00.000Z");
    const menu: unknown[] = [];
    await db.insert(schema.slurpLiveShows).values({
      id: "old-live",
      hostKind: "creator",
      hostId: "old-host",
      startedAt: at.toISOString(),
      endsAt: end.toISOString(),
      endedAt: null,
      goal: "10",
      raised: "0",
      script: "[]",
      events: "[]",
    });
    assert.equal((await live.list(20, at))[0]?.id, "old-live");
    await live.update("old-live", { endedAt: at.toISOString() });
    const planned = await live.plan("creator-a", future, end, future.toISOString(), 10, menu);
    assert.ok(planned);
    assert.equal(await live.plan("creator-a", future, end, null, 10, menu), null);
    assert.equal((await live.list(20, at))[0]?.id, "old-live");
    assert.equal((await live.upcomingAnnounced(at)).length, 0);
    await live.setAnnouncement(planned.id, "post-a");
    assert.equal((await live.upcomingAnnounced(at))[0]?.id, planned.id);
    assert.equal(await live.remind(planned.id, "player", at), true);
    assert.equal(await live.remind(planned.id, "player", at), true);
    assert.deepEqual((await live.get(planned.id)).reminders, ["player"]);

    const player = await live.createIfNone({
      hostKind: "player",
      hostId: "player-a",
      startedAt: at,
      endsAt: end,
      goal: 10,
      menu,
    });
    assert.ok(player);
    assert.equal(
      await live.createIfNone({ hostKind: "player", hostId: "player-b", startedAt: at, endsAt: end, goal: 10, menu }),
      null,
    );
    assert.equal((await live.list(20, at))[0]?.id, player.id);
    const creatorB = await live.createIfNone({
      hostKind: "creator",
      hostId: "creator-b",
      startedAt: at,
      endsAt: end,
      goal: 10,
      menu,
    });
    const creatorC = await live.createIfNone({
      hostKind: "creator",
      hostId: "creator-c",
      startedAt: at,
      endsAt: end,
      goal: 10,
      menu,
    });
    assert.ok(creatorB && creatorC);
    assert.equal(await live.privateClaim(creatorB.id, "viewer-a", "private-1", at), "new");
    assert.equal(await live.privateClaim(creatorB.id, "viewer-b", "private-2", at), "busy");
    assert.equal(await live.privateClaim(creatorB.id, "viewer-a", "private-1", at), "resume");
    const firstPrivate = await live.privateConfirm(creatorB.id, "private-1", at);
    assert.equal(firstPrivate?.private?.until, "2026-10-23T12:10:00.000Z");
    assert.equal(await live.privateClaim(creatorB.id, "viewer-a", "private-1", at), "duplicate");
    assert.equal(await live.privateClaim(creatorB.id, "viewer-b", "private-3", at), "busy");
    assert.equal(await live.privateClaim(creatorB.id, "viewer-a", "private-4", at), "new");
    const extension = await live.privateConfirm(creatorB.id, "private-4", new Date(at.getTime() + 60_000));
    assert.equal(extension?.private?.until, "2026-10-23T12:20:00.000Z");
    assert.equal(extension?.script.filter((line: any) => line.text === "she went private 🔒").length, 1);
    assert.equal(await live.setMode(creatorB.id, "viewer-a", "pictures", at), "pictures");
    assert.equal(await live.setMode(creatorB.id, "viewer-b", "pictures", at), null);
    assert.equal(await live.pictureClaim(creatorB.id, "viewer-a", "private:2", at), true);
    assert.equal(await live.pictureClaim(creatorB.id, "viewer-a", "private:2", at), false);
    assert.equal(await live.pictureClaim(creatorB.id, "viewer-b", "private:2", at), false);
    assert.equal(await live.startPlanned(planned.id, future), null);
    const deferred = await live.deferPlanned(planned.id, future);
    assert.equal(deferred.startedAt, "2026-10-23T13:15:00.000Z");
    assert.equal(deferred.endsAt, "2026-10-23T13:35:00.000Z");
    assert.equal((await live.upcomingAnnounced(future))[0]?.id, planned.id);
    await live.update(creatorB.id, { endedAt: future.toISOString() });
    const started = await live.startPlanned(planned.id, new Date(deferred.startedAt));
    assert.ok(started?.startedNoticeAt);
    assert.deepEqual(started.reminders, ["player"]);
    assert.equal(await live.remind(planned.id, "another", at), false);
    assert.equal((await live.upcomingAnnounced(at)).length, 0);
    console.log("slurp2 live storage: ok");
  } finally {
    if (db) await db._fileStore.close();
    await rm(overlayRoot, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
