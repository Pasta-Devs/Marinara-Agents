// #1784: when story memory is not ready, chats, proactive messages and Character Stories fall back to the legacy
// history. It must hold only played canon: never a scene pre-forged past the played frontier, of the current chapter
// or of a chapter forged ahead, nor a manual summary (Compress) made from such scenes. A narrator writing ahead still
// reads the pre-forged scenes before its own scene.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";

const packageId = "gacha-forge";
const runId = "played-history-proof";
const arden = `${runId}:unit:arden`;
const directory = await mkdtemp(join(tmpdir(), "gacha-played-history-"));
const modulePath = join(directory, "server.mjs");
await writeFile(modulePath, await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url)));
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
});
globalThis.fetch = async (input) => {
  assert.equal(new URL(input).pathname, "/api/connections", "Only local connection metadata may be fetched");
  return Response.json([{ id: "fixture-model", provider: "custom", model: "fixture-model", maxContext: 400000 }]);
};

const types = ["story", "combat", "story", "story", "combat", "story", "story", "story"];
const nodes = types.map((type, index) => ({ index: index + 1, type, title: `Node ${index + 1}`, goal: "Continue." }));
const marker = (chapter, scene) => `SCENE_${chapter}_${scene}`;

// Chapters 1-2 played in full. Chapter 3: scenes 0-1 played (node 3 done), scenes 2-3 pre-forged and unplayed.
// Chapter 4 is forged ahead with two scenes: a plan and scenes no play has reached.
function world({ bond = null, full = false, finished = false } = {}) {
  const docs = new Map();
  const seed = (id, kind, data) => docs.set(id, { id, kind, packageId, name: id, revision: 1, data });
  seed("index", "index", {
    activeRunId: runId,
    runs: [
      {
        runId,
        name: "Played history",
        scenario: "A lighthouse garden.",
        connectionId: "fixture-model",
        protagonist: { name: "Mari" },
        images: { off: true },
        story: { choices: false, preforge: "off", dailyUnitMessages: 24 },
      },
    ],
  });
  // full: pre-forge has written every scene of chapter 3 and of the Character Story.
  const written = { 1: 6, 2: 6, 3: full ? 6 : 4, 4: 2 };
  for (const [chapter, count] of Object.entries(written)) {
    seed(`${runId}:chapter:${chapter}`, "chapter-plan", { chapter: Number(chapter), title: `Title ${chapter}`, nodes });
    for (let scene = 0; scene < count; scene += 1)
      seed(`${runId}:beat:${chapter}:${scene}`, "beat", {
        chapter: Number(chapter),
        storyIndex: scene,
        segments: [{ speaker: "Arden", text: `${marker(chapter, scene)} The keeper spoke of tides.` }],
      });
  }
  const session = {
    roster: { [arden]: { level: 20, bondFights: 100000 } },
    wallet: { vigor: 1000, funds: 10000, aether: 1000 },
    account: { level: 100, xp: 0 },
    // finished: chapter 3 played to its end as well (a merge counts a chapter finished at the standard 10 nodes).
    progress: { 1: { normal: 8 }, 2: { normal: 8 }, 3: { normal: finished ? 10 : 3 } },
    bondChapters: {},
  };
  if (bond) {
    // A Character Story opened mid-chapter 3 is placed after it, with one of its scenes played.
    session.bondChapters[arden] = { after: 3, opened: 1000, beats: 1 };
    seed(`${runId}:chapter:bond-arden`, "chapter-plan", {
      title: "Arden's story",
      bondUnitId: arden,
      bondPart: 1,
      after: 3,
      nodes: [0, 1, 2].map((index) => ({ index: index + 1, type: "story", title: "Bond", goal: "Talk." })),
    });
    for (let scene = 0; scene < (full ? 3 : 1); scene += 1)
      seed(`${runId}:beat:bond-arden:${scene}`, "beat", {
        segments: [{ speaker: "Arden", text: `BOND_SCENE_${scene} A quiet walk.` }],
      });
  }
  seed(`${runId}:session`, "session", session);
  seed(arden, "unit", { unitId: arden, kind: "character", name: "Arden", rarity: 5, identitySex: "male" });
  seed(`${runId}:chat:arden`, "chat", { unitId: arden, name: "Arden", messages: [], sessions: [] });
  // Story memory is unavailable, so every history below is the legacy fallback.
  seed(`${runId}:summary:memory`, "summary", { status: { phase: "error", retryable: true }, records: [] });
  return docs;
}

let sequence = 0;
async function harness(options) {
  const docs = world(options);
  const routes = new Map();
  const prompts = [];
  const documents = {
    getById: async (_id, id) => structuredClone(docs.get(id) ?? null),
    list: async (_id, kind) => structuredClone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
    create: async (doc) => {
      if (docs.has(doc.id)) return null;
      docs.set(doc.id, { ...structuredClone(doc), revision: 1 });
      return structuredClone(docs.get(doc.id));
    },
    update: async (doc) => {
      const old = docs.get(doc.id);
      if (old?.revision !== doc.expectedRevision) return null;
      const saved = { ...old, ...structuredClone(doc), revision: old.revision + 1 };
      delete saved.expectedRevision;
      docs.set(doc.id, saved);
      return structuredClone(saved);
    },
    remove: async (_id, id) => docs.delete(id),
  };
  const bundle = await import(`${pathToFileURL(modulePath).href}?proof=${sequence++}`);
  await bundle.activate({
    dataDir: directory,
    package: { id: packageId, version: "fixture" },
    api: {
      runtime: {
        persistence: { documents, transaction: (operation) => operation({ documents }) },
        logger: { info() {}, warn() {}, error() {}, debug() {} },
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest() {
            return {
              connectionId: "fixture-model",
              model: "fixture-model",
              maxContext: 400000,
              maxOutputTokens: null,
              async chatComplete(messages) {
                const prompt = messages.map((message) => String(message.content)).join("\n");
                prompts.push(prompt);
                // A manual summary names every scene it was given.
                if (/You compress a finished chapter/u.test(messages[0].content))
                  return {
                    content: JSON.stringify({ digest: `DIGEST ${prompt.match(/(?:BOND_)?SCENE_[\d_]+/gu).join(" ")}` }),
                    finishReason: "stop",
                  };
                return /Narrate ONE story beat/u.test(messages[0].content)
                  ? {
                      content: JSON.stringify({ places: [], segments: [{ speaker: "Arden", text: "A line." }] }),
                      finishReason: "stop",
                    }
                  : { content: "Arden: A patient reply.", finishReason: "stop" };
              },
            };
          },
        },
      },
      async registerPrivilegedRoutes(register) {
        await register({
          get: (path, handler) => routes.set(path, handler),
          post: (path, handler) => routes.set(path, handler),
        });
      },
    },
  });
  const post = (path, body = {}) => routes.get(path)({ body: { runId, timeZone: "UTC", ...body } });
  return { post, prompts, docs };
}

const played = [1, 2]
  .flatMap((chapter) => [0, 1, 2, 3, 4, 5].map((scene) => marker(chapter, scene)))
  .concat(marker(3, 0), marker(3, 1));
const unplayed = [marker(3, 2), marker(3, 3), marker(4, 0), marker(4, 1)];
function assertPlayedOnly(prompt, label) {
  assert.ok(prompt, `${label}: a prompt was sent`);
  for (const scene of unplayed) assert.ok(!prompt.includes(scene), `${label}: unplayed ${scene} must not be known`);
  for (const scene of played) assert.ok(prompt.includes(scene), `${label}: played ${scene} stays`);
  // The current chapter keeps its legacy heading and holds exactly its played scenes.
  const current = /# Chapter 3\n([\s\S]*?)(?=\n\n# |$)/u.exec(prompt)?.[1] || "";
  assert.deepEqual(current.match(/SCENE_\d+_\d+/gu), [marker(3, 0), marker(3, 1)], `${label}: chapter 3 so far`);
}

test("a companion chat knows only played scenes", async () => {
  const forge = await harness();
  const sent = await forge.post("/chat/send", { unitId: arden, text: "Do you remember?" });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assertPlayedOnly(forge.prompts.at(-1), "chat");
});

test("a proactive message knows only played scenes", async () => {
  const forge = await harness();
  // The visible minute before a first message has already passed.
  const session = forge.docs.get(`${runId}:session`);
  session.data.proactiveMessages = {
    days: { [new Date().toISOString().slice(0, 10)]: { attempts: 0, nextAt: Date.now() - 1000 } },
    lastSeenAt: Date.now() - 1000,
    sourceRevision: 1,
  };
  const due = await forge.post("/chat/proactive/due");
  assert.equal(due.status, "sent", JSON.stringify(due));
  assertPlayedOnly(forge.prompts.at(-1), "proactive message");
});

test("a Character Story opened mid-chapter knows only played scenes", async () => {
  const forge = await harness();
  await forge.post("/bond-chapter/plan", { unitId: arden, part: 1 });
  assertPlayedOnly(
    forge.prompts.find((prompt) => /BOND CHAPTER/u.test(prompt)),
    "Character Story plan",
  );
  const scene = await harness({ bond: true });
  const beat = await scene.post("/bond-chapter/beat", { unitId: arden, part: 1, storyIndex: 1 });
  assert.equal(beat.ok, true, JSON.stringify(beat));
  const prompt = scene.prompts.find((entry) => /Narrate ONE story beat/u.test(entry));
  assertPlayedOnly(prompt, "Character Story scene");
  assert.match(prompt, /BOND_SCENE_0/u, "its own scene so far stays");
});

test("a narrator writing ahead still reads the scenes forged before its own", async () => {
  const forge = await harness();
  const beat = await forge.post("/beat", { chapter: 3, storyIndex: 4 });
  assert.equal(beat.ok, true, JSON.stringify(beat));
  const prompt = forge.prompts.find((entry) => /Narrate ONE story beat/u.test(entry));
  for (const scene of [marker(3, 0), marker(3, 1), marker(3, 2), marker(3, 3)])
    assert.match(prompt, new RegExp(scene, "u"));
  assert.doesNotMatch(prompt, /SCENE_4_/u, "a later chapter is not before scene 4 of chapter 3");
});

test("a manual summary of pre-forged scenes is not known before they are played", async () => {
  const forge = await harness({ bond: true, full: true });
  // Pre-forge wrote every scene, so Story so far offers Compress for chapter 3 and the Character Story.
  const { chapters } = await forge.post("/continuity");
  assert.equal(chapters.find((row) => row.chapter === 3)?.complete, true);
  assert.equal(chapters.find((row) => row.chapter === "bond-arden")?.complete, true);
  assert.equal((await forge.post("/compress", { chapter: 3 })).ok, true);
  assert.equal((await forge.post("/compress", { unitId: arden, part: 1 })).ok, true);
  const sent = await forge.post("/chat/send", { unitId: arden, text: "Do you remember?" });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const prompt = forge.prompts.at(-1);
  assertPlayedOnly(prompt, "chat after Compress");
  assert.doesNotMatch(prompt, /DIGEST|SCENE_3_[45]|BOND_SCENE_[12]/u, "no summary or scene past what was played");
  assert.match(prompt, /BOND_SCENE_0/u, "the played Character Story scene stays");
});

test("a Compress merge refuses a Character Story that is not played to its end", async () => {
  const forge = await harness({ bond: true, full: true, finished: true });
  assert.equal((await forge.post("/compress", { chapter: 3 })).ok, true);
  assert.equal((await forge.post("/compress", { unitId: arden, part: 1 })).ok, true);
  const merged = await forge.post("/compress/merge", { rows: ["3", "bond-arden"] });
  assert.equal(merged.error, "not-finished", JSON.stringify(merged));
  const sent = await forge.post("/chat/send", { unitId: arden, text: "Do you remember?" });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.doesNotMatch(forge.prompts.at(-1), /BOND_SCENE_[12]/u, "no unplayed Character Story scene, merged or not");
});
