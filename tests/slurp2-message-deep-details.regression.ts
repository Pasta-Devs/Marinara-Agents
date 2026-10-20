import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Deep details for a Creator reply in a chat: the record is written per reply, a thread keeps the
// newest 50, only a persona seated in the thread reads it, and the thread response carries only the
// kept record ids (which is what makes the Message menu offer the item). Runs the real storage and route against a
// file database. Needs MARINARA_ENGINE_ROOT (a built staging Engine checkout); run it without
// tests/tsconfig.regressions.json, whose `@marinara-engine/shared` stub the Engine overlay cannot use.
const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));

type Row = Record<string, unknown>;
type FileDb = {
  select: () => { from: (table: unknown) => Promise<Row[]> };
  insert: (table: unknown) => { values: (row: unknown) => Promise<void> };
  _fileStore: { close: () => Promise<void>; registerTables: (tables: unknown[]) => Promise<void> };
};
type Message = { id: string; role: string; metadata: Row };
type Inject = (options: { method: "GET"; url: string }) => Promise<{ statusCode: number; json: () => Row }>;

async function main() {
  const overlayRoot = await mkdtemp(join(tmpdir(), "slurp2-message-deep-details-source-"));
  const dataDir = await mkdtemp(join(tmpdir(), "slurp2-message-deep-details-data-"));
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

    const [{ createFileNativeDB }, schema, slpStorage, deep, context, routes, record, { default: fastify }, shared] =
      await Promise.all([
        load<{ createFileNativeDB: () => Promise<FileDb> }>("packages/server/src/db/file-backed-store.ts"),
        load<Record<string, unknown>>("packages/server/src/db/schema/slurp.ts"),
        load<{
          createSlurpStorage: (db: FileDb) => Row;
          createSlurpMessagesStorage: (db: FileDb) => { resetThread: (threadId: string) => Promise<void> };
        }>("packages/server/src/slp/data/slp-storage.ts"),
        load<{
          SLP_MESSAGE_DEEP_DETAILS_LIMIT: number;
          saveSlurpMessageDeepDetails: (db: FileDb, input: Row) => Promise<void>;
          listSlurpMessageDeepDetailIds: (db: FileDb, threadId: string) => Promise<string[]>;
        }>("packages/server/src/slp/data/messages/slp-message-deep-details-storage.ts"),
        load<{
          createSlpMessagesContext: (
            app: unknown,
            slurp: unknown,
            messages: unknown,
          ) => Row & { visibleMessages: (threadId: string, side: "viewer" | "creator") => Promise<Message[]> };
        }>("packages/server/src/slp/features/messages/slp-messages-context.ts"),
        load<{ slpMessageDeepDetailsRoutes: (app: unknown, messaging: unknown) => Promise<void> }>(
          "packages/server/src/slp/features/messages/slp-message-deep-details-routes.ts",
        ),
        load<{ buildSlurpMessageDeepDetailsRecord: (ctx: Row) => Row & { chat: Row } }>(
          "packages/server/src/slp/features/messages/slp-message-deep-details-record.ts",
        ),
        load<{ default: () => { decorate: (key: string, value: unknown) => void; inject: Inject } }>(
          "packages/server/node_modules/fastify/fastify.js",
        ),
        load<{ slpMessageDeepDetailsId: (messageId: string) => string }>("packages/shared/src/slp/slp-deep-details.ts"),
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
    for (const [id, viewerAccountId] of [
      ["thread", "persona-1"],
      ["other-thread", "persona-2"],
    ])
      await db
        .insert(schema.slurpThreads)
        .values({ id, viewerAccountId, creatorAccountId: "creator", lastMessageAt: t });
    const message = (id: string, role: string, threadId = "thread") =>
      db!.insert(schema.slurpMessages).values({ id, threadId, senderAccountId: role, role, content: id, createdAt: t });
    await message("fan-line", "viewer");
    await message("old-reply", "creator"); // written before records existed
    await message("reply", "creator");
    await message("reply:1", "creator"); // the same reply's second bubble
    await message("other-reply", "creator", "other-thread");
    await db.insert(schema.slurpMessages).values({
      id: "paid",
      threadId: "thread",
      senderAccountId: "creator",
      role: "creator",
      kind: "ppv",
      content: "PAID CAPTION",
      price: "50",
      createdAt: t,
    });

    // 1. The record holds what the generator had, as it was: nothing is invented or re-read.
    const built = record.buildSlurpMessageDeepDetailsRecord({
      input: {
        connection: { id: "txt-0", name: "Main", provider: "openai", model: "gpt-test" },
        rapport: { tier: "regular", score: 44, contributions: [] },
        subscribed: true,
        isRequest: false,
        notes: [{ id: "n1", tier: "longterm", text: "works nights" }],
        threadState: { posture: "warm", adultLevel: "flirty" },
        creatorState: { emotion: "content", intent: "connect" },
      },
      support: false,
      stance: {
        warmth: "warm",
        latitude: "normal",
        imageMode: "friendly",
        canSendImage: true,
        instructions: ["be warm"],
        evidence: [{ layer: "availability", value: "away", effect: "shortens the reply, does not chill it" }],
      },
      messages: [
        { role: "system", content: "SECRET CARD" },
        { role: "user", content: "data" },
      ],
      options: { temperature: 0.95, topP: 0.95, maxTokens: 2048 },
      content: '{"content":"hi"}',
    });
    assert.deepEqual(built.model, {
      provider: "openai",
      model: "gpt-test",
      connectionId: "txt-0",
      connectionName: "Main",
      temperature: 0.95,
      topP: 0.95,
      maxTokens: 2048,
    });
    assert.equal(built.rawResponse, '{"content":"hi"}');
    assert.deepEqual(built.chat.relationship, { posture: "warm", adultLevel: "flirty" });
    assert.deepEqual(built.chat.memories, [{ tier: "longterm", text: "works nights" }]);
    assert.equal((built.chat.stance as { evidence: Row[] }).evidence[0]!.layer, "availability");
    // Slurp Support's thread has no fan stance in its prompt, so the record claims none.
    const staff = record.buildSlurpMessageDeepDetailsRecord({
      input: { connection: {}, rapport: { tier: "stranger", score: 0 }, subscribed: false, isRequest: false },
      support: true,
      stance: { evidence: [] },
      messages: [],
      options: {},
      content: "",
    });
    assert.equal(staff.chat.stance, null);
    assert.equal(staff.chat.relationship, null);

    // 2. A reply's record is kept, and every bubble of that reply leads to it. Nothing else does.
    const save = (messageId: string, threadId: string, generatedAt = t) =>
      deep.saveSlurpMessageDeepDetails(db!, {
        messageId,
        threadId,
        creatorAccountId: "creator",
        record: { ...built, generatedAt },
      });
    await save("reply", "thread");
    await save("other-reply", "other-thread");
    const slurp = slpStorage.createSlurpStorage(db);
    const messages = slpStorage.createSlurpMessagesStorage(db);
    const messaging = context.createSlpMessagesContext({ db }, slurp, messages);
    // What the thread view does with the ids the thread response carries.
    const offered = async () => {
      const kept = new Set(await deep.listSlurpMessageDeepDetailIds(db!, "thread"));
      return (await messaging.visibleMessages("thread", "viewer"))
        .filter((entry) => entry.role === "creator" && kept.has(shared.slpMessageDeepDetailsId(entry.id)))
        .map((entry) => entry.id)
        .sort();
    };
    assert.deepEqual(await offered(), ["reply", "reply:1"], "only recorded Creator replies offer Deep details");
    // Both ways into a chat carry the ids and nothing else of the record; both reply paths write it.
    const source = (path: string) =>
      readFileSync(
        join(repoRoot, "packages/slurp2/src/engine/packages/server/src/slp/features/messages", path),
        "utf8",
      );
    const threadRoutes = source("slp-messages-thread-routes.ts");
    assert.equal(threadRoutes.split("deepDetailIds: ").length, 3, "the thread route and the compose route");
    assert.ok(!/record|getSlurpMessageDeepDetails\b/u.test(threadRoutes.match(/deepDetailIds: [^\n]+/gu)!.join("")));
    for (const path of ["slp-message-operation.ts", "slp-follow-up-scheduler-service.ts"])
      assert.match(
        source(path),
        /saveSlurpMessageDeepDetails\([^,]+, \{\s*messageId: stored\.id,[\s\S]{0,160}?record: reply\.deepDetails,/u,
        `${path} records the reply under its first bubble`,
      );

    // 3. Only a persona with a seat in the thread reads the record.
    const app = fastify();
    app.decorate("db", db);
    await routes.slpMessageDeepDetailsRoutes(app, { ...messaging, requireViewer: async (id: string) => ({ id }) });
    const read = (messageId: string, personaId: string) =>
      app.inject({ method: "GET", url: `/slurp/messages/${messageId}/deep-details?personaId=${personaId}` });
    const mine = await read("reply:1", "persona-1");
    assert.equal(mine.statusCode, 200);
    assert.equal((mine.json().details as { messages: Row[] }).messages[0]!.content, "SECRET CARD");
    assert.equal((await read("reply", "persona-2")).statusCode, 404, "another persona's thread stays closed");
    assert.equal((await read("other-reply", "persona-1")).statusCode, 404);
    assert.equal((await read("fan-line", "persona-1")).statusCode, 404, "a fan's own line has no details");
    const paid = await read("paid", "persona-1");
    assert.equal(paid.statusCode, 404, "a locked paid message does not show its text through this route");
    assert.ok(!JSON.stringify(paid.json()).includes("PAID CAPTION"));
    // A record is read only through the thread it was written in.
    await save("old-reply", "other-thread");
    assert.equal((await read("old-reply", "persona-1")).json().details, null);
    assert.equal((await read("reply", "")).statusCode, 400);
    assert.equal((await read("old-reply", "persona-1")).json().details, null, "an old reply has no record");

    // 4. A thread keeps its newest records only; the oldest lose the menu item with the record.
    const limit = deep.SLP_MESSAGE_DEEP_DETAILS_LIMIT;
    assert.equal(limit, 50);
    for (let index = 0; index < limit; index += 1)
      await save(`later-${index}`, "thread", new Date(Date.parse(t) + (index + 1) * 1000).toISOString());
    const kept = new Set(await deep.listSlurpMessageDeepDetailIds(db, "thread"));
    assert.equal(kept.size, limit);
    assert.ok(!kept.has("reply") && kept.has("later-0") && kept.has(`later-${limit - 1}`));
    assert.deepEqual(await offered(), [], "a pruned reply no longer offers Deep details");
    assert.equal((await deep.listSlurpMessageDeepDetailIds(db, "other-thread")).length, 2, "pruning is per thread");

    // 5. Clearing a chat removes its records: they hold the prompt and its private notes.
    await messages.resetThread("thread");
    assert.equal((await deep.listSlurpMessageDeepDetailIds(db, "thread")).length, 0);
    assert.equal((await deep.listSlurpMessageDeepDetailIds(db, "other-thread")).length, 2);

    // 6. The entry point is the existing Message menu, on recorded replies only: no button on bubbles.
    const bubble = readFileSync(
      join(repoRoot, "packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpMessageBubble.tsx"),
      "utf8",
    );
    const view = readFileSync(
      join(repoRoot, "packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadView.tsx"),
      "utf8",
    );
    assert.match(
      view,
      /hasDeepDetails=\{\s*entry\.message\.role === "creator" &&\s*deepDetailIds\.has\(slpMessageDeepDetailsId\(entry\.message\.id\)\)/u,
    );
    const sheet = bubble.slice(bubble.indexOf("<SlpSheet"), bubble.indexOf("</SlpSheet>"));
    assert.match(sheet, /\{hasDeepDetails && personaId && \(\s*<SlpSheetItem/u);
    assert.equal(bubble.split("ui.slurp.deepDetails.title").length, 2, "one entry point, inside the menu");
    console.log("slurp2 message deep details regression passed");
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
