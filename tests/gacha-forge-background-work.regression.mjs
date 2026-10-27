// Background story work must not undo Formation edits or make every state refresh pay for the full history.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  saveForgeFormation,
  waitForgeFormationLoad,
  waitForgeFormationSave,
} from "../packages/gacha-forge/src/formation-combat-client.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
const team = (name) => [{ name, board: { front: ["leader", null, null], back: [null, null, null] } }];

function host() {
  const posts = [];
  return {
    posts,
    loads: 0,
    _run: { runId: "world" },
    _hudView: "formation",
    _formation: { presets: team("optimistic"), active: 0 },
    _formationState: "ready",
    _loadFormation() {
      this.loads += 1;
    },
    _postJson(path, body) {
      const reply = deferred();
      posts.push({ path, body, reply });
      return reply.promise;
    },
  };
}

test("Formation saves run one at a time and send only the newest waiting edit", async () => {
  const forge = host();
  saveForgeFormation(forge, team("A"), 0);
  saveForgeFormation(forge, team("B"), 0);
  saveForgeFormation(forge, team("C"), 0);
  assert.equal(forge.posts.length, 1, "a second save waits for the first reply");
  forge.posts[0].reply.resolve({ ok: true, presets: team("A"), active: 0 });
  await settle();
  assert.deepEqual(
    forge.posts.map((post) => post.body.presets[0].name),
    ["A", "C"],
    "B was overtaken while it waited, so only the newest edit is sent",
  );
  assert.equal(forge._formation.presets[0].name, "optimistic", "an older reply never replaces newer edits");
  forge.posts[1].reply.resolve({ ok: true, presets: team("C saved"), active: 0 });
  await settle();
  assert.equal(forge._formation.presets[0].name, "C saved", "the newest reply is adopted as the server's copy");
  assert.equal(forge._formationSaves.size, 0);
});

test("a failed last save shows the saved team instead of a team no battle will use", async () => {
  const forge = host();
  saveForgeFormation(forge, team("A"), 0);
  forge.posts[0].reply.resolve({ ok: false, error: "write-conflict" });
  await settle();
  assert.equal(forge.loads, 1, "Formation reloads what the server kept");

  const away = host();
  away._hudView = "home";
  saveForgeFormation(away, team("A"), 0);
  away.posts[0].reply.resolve(null);
  await settle();
  assert.equal(away.loads, 0);
  assert.equal(away._formation, null, "the next visit loads the saved team");
  assert.equal(away._formationState, "idle");
});

test("a save request that throws never leaves the world's saves stuck", async () => {
  const forge = host();
  const post = forge._postJson;
  forge._postJson = () => Promise.reject(new Error("fixture reply handling threw"));
  saveForgeFormation(forge, team("A"), 0);
  await settle();
  assert.equal(forge.loads, 1, "it counts as a failed save, so Formation shows the saved team");
  assert.equal(forge._formationSaves.size, 0);
  forge._postJson = post;
  saveForgeFormation(forge, team("B"), 0);
  assert.equal(forge.posts.length, 1, "the next edit is still sent");
});

test("a battle reads the team only after the last edit is saved", async () => {
  const forge = host();
  let loads = 0;
  const resume = () => (loads += 1);
  forge._hudView = "combat";
  forge._combatNode = { combatIndex: 1 };
  forge._combatPhase = "loading";
  saveForgeFormation(forge, team("A"), 0);
  assert.equal(waitForgeFormationSave(forge, resume), true);
  // The player backs out and enters the fight again while the same save is still running.
  forge._combatNode = { combatIndex: 1 };
  assert.equal(waitForgeFormationSave(forge, resume), true, "a repeated render does not queue another load");
  forge.posts[0].reply.resolve({ ok: true, presets: team("A"), active: 0 });
  await settle();
  assert.equal(loads, 1, "the battle open now is loaded once");
  assert.equal(waitForgeFormationSave(forge, resume), false, "nothing waits once saved");

  forge._farmBusy = true;
  saveForgeFormation(forge, team("B"), 0);
  waitForgeFormationSave(forge, resume);
  forge._hudView = "farm";
  forge.posts[1].reply.resolve({ ok: true, presets: team("B"), active: 0 });
  await settle();
  assert.equal(loads, 1, "a battle left while it waited is never loaded");
  assert.equal(forge._farmBusy, false, "leaving it does not keep the farm locked");
  // A save that fails while the battle waits must not start it with the older team the server kept.
  let renders = 0;
  forge._renderBrowser = () => (renders += 1);
  forge._hudView = "combat";
  saveForgeFormation(forge, team("C"), 0);
  waitForgeFormationSave(forge, resume);
  forge.posts[2].reply.resolve({ ok: false, error: "write-conflict" });
  await settle();
  assert.equal(loads, 1, "the battle is not loaded");
  assert.equal(forge._hudView, "formation", "Formation opens again with the saved team");
  assert.equal(forge._formationBattleMode, true);
  assert.equal(forge._formationState, "idle", "so the next render reads the team from the server");
  assert.equal(renders, 1);
  // A tower fight goes back to the tower, where its team is picked.
  forge._hudView = "combat";
  forge._combatNode = { tower: true, floor: 3 };
  saveForgeFormation(forge, team("D"), 0);
  waitForgeFormationSave(forge, resume);
  forge.posts[3].reply.resolve(null);
  await settle();
  assert.equal(forge._hudView, "tower");

  // A failed save from a world the player has left does not touch the world now open.
  forge._hudView = "combat";
  forge._combatNode = { combatIndex: 3 };
  saveForgeFormation(forge, team("E"), 0);
  waitForgeFormationSave(forge, resume);
  forge._run = { runId: "other-world" };
  forge.posts[4].reply.resolve({ ok: false });
  await settle();
  assert.equal(forge._hudView, "combat");
  assert.equal(loads, 1);
});

test("reopening Formation waits for edits still being saved", async () => {
  const forge = host();
  saveForgeFormation(forge, team("A"), 0);
  saveForgeFormation(forge, team("B"), 0);
  forge._formation = null;
  forge._formationState = "loading";
  assert.equal(waitForgeFormationLoad(forge), true, "the read waits instead of missing B");
  forge.posts[0].reply.resolve({ ok: true, presets: team("A"), active: 0 });
  await settle();
  assert.equal(forge.loads, 0, "B is still being saved");
  forge.posts[1].reply.resolve({ ok: true, presets: team("B"), active: 0 });
  await settle();
  assert.equal(forge.loads, 1, "the team is read once B is saved");
  assert.equal(waitForgeFormationLoad(forge), false);

  // Several reopens while one save runs read the team once.
  saveForgeFormation(forge, team("C"), 0);
  forge._formationState = "loading";
  waitForgeFormationLoad(forge);
  waitForgeFormationLoad(forge);
  forge.posts[2].reply.resolve({ ok: true, presets: team("C"), active: 0 });
  await settle();
  assert.equal(forge.loads, 2);

  // A failed save reloads Formation itself, so the read queued behind it is not sent as well.
  saveForgeFormation(forge, team("D"), 0);
  forge._formationState = "loading";
  waitForgeFormationLoad(forge);
  forge._loadFormation = function () {
    this.loads += 1;
    waitForgeFormationLoad(this);
  };
  forge.posts[3].reply.resolve({ ok: false });
  await settle();
  assert.equal(forge.loads, 3);
});

test("the chapters list refills only when a reload brings different chapters", async () => {
  const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const start = source.indexOf("_loadChapters(){");
  const Chapters = new Function(`return class {${source.slice(start, source.indexOf("_fillChapters(){", start))}}`)();
  const list = { chapters: [{ chapter: 1 }], nextChapter: 2, nextUnlocked: true, ok: true };
  let reply;
  const forge = Object.assign(new Chapters(), {
    fills: 0,
    _run: { runId: "world" },
    _planChapter: 1,
    _hudView: "chapters",
    _fillChapters() {
      this.fills += 1;
    },
    _postJson: async () => reply,
  });
  reply = structuredClone(list);
  forge._loadChapters();
  await settle();
  assert.equal(forge.fills, 2, "a first load shows Loading, then the list");
  reply = structuredClone(list);
  forge._loadChapters();
  await settle();
  assert.equal(forge.fills, 2, "background work ending with nothing new leaves the cards in place");
  reply = null;
  forge._loadChapters();
  await settle();
  assert.equal(forge.fills, 2, "a failed reload keeps the list it has");
  reply = { ...structuredClone(list), chapters: [{ chapter: 1 }, { chapter: 2 }], nextChapter: 3 };
  forge._loadChapters();
  await settle();
  assert.equal(forge.fills, 3, "a chapter that finished in the background appears");
});

test("the shipped server retries a Formation save and skips the history count on refreshes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-background-work-")),
    packageId = "gacha-forge",
    runId = "background-work-proof",
    sessionId = `${runId}:session`,
    unitId = `${runId}:unit:alpha`,
    docs = new Map(),
    routes = new Map(),
    clone = structuredClone,
    originalFetch = globalThis.fetch;
  const seed = (id, kind, data) => docs.set(id, { id, packageId, kind, name: id, revision: 1, data: clone(data) });
  seed("index", "index", {
    activeRunId: runId,
    runs: [{ runId, name: "Background fixture", scenario: "Hold the pass.", connectionId: "fixture-story" }],
  });
  seed(sessionId, "session", {
    progress: { 1: { normal: 0 } },
    roster: { [unitId]: { id: unitId, name: "Alpha" } },
    account: { level: 100, xp: 0 },
    wallet: { funds: 0, aether: 0, vigor: 100 },
  });
  let raced = false,
    cleanup;
  try {
    globalThis.fetch = async () => Response.json([]);
    const modulePath = join(directory, "server.mjs");
    await writeFile(modulePath, await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url)));
    const { activate } = await import(pathToFileURL(modulePath).href);
    cleanup = await activate({
      dataDir: directory,
      package: { id: packageId },
      api: {
        runtime: {
          logger: Object.fromEntries(["info", "warn", "error", "debug"].map((level) => [level, () => {}])),
          json: { parseJsonish: JSON.parse },
          persistence: {
            documents: {
              getById: async (_package, id) => clone(docs.get(id) ?? null),
              list: async (_package, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
              create: async (document) => {
                const saved = { ...clone(document), revision: 1 };
                docs.set(saved.id, saved);
                return clone(saved);
              },
              update: async (document) => {
                const old = docs.get(document.id);
                if (document.id === sessionId && document.data?.presets && !raced) {
                  // Background story work commits to the same session between the save's read and its write.
                  raced = true;
                  docs.set(sessionId, { ...old, revision: old.revision + 1, data: { ...old.data, other: "kept" } });
                  return null;
                }
                if (old?.revision !== document.expectedRevision) return null;
                const saved = { ...old, ...clone(document), revision: old.revision + 1 };
                docs.set(saved.id, saved);
                return clone(saved);
              },
            },
          },
          languageModels: { resolveForRequest: async () => assert.fail("no model call is expected") },
        },
        registerPrivilegedRoutes: async (register) =>
          register({
            get: (path, handler) => routes.set(path, handler),
            post: (path, handler) => routes.set(path, handler),
          }),
      },
    });
    const presets = [{ name: "Pass", board: { front: ["leader", unitId, null], back: [null, null, null] } }];
    const saved = await routes.get("/formation/save")({ body: { runId, presets, active: 0 } });
    assert.equal(raced, true);
    assert.equal(saved.ok, true, "a concurrent session write no longer drops the move");
    assert.deepEqual(saved.presets[0].board.front, ["leader", unitId, null]);
    const session = docs.get(sessionId).data;
    assert.equal(session.other, "kept", "the retry keeps the other writer's change");
    assert.deepEqual(session.party.front, ["leader", unitId, null]);

    const boot = await routes.get("/state")({ query: {} });
    assert.equal(typeof boot.activeRun.contextTokens, "number", "boot still reports the context size");
    const refresh = await routes.get("/state")({ query: { light: "1" } });
    assert.equal(refresh.activeRun.runId, runId);
    assert.equal("contextTokens" in refresh.activeRun, false, "a refresh skips the full-history count");
  } finally {
    cleanup?.();
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
