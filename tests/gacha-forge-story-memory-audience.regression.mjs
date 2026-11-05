import assert from "node:assert/strict";
import { test } from "node:test";

// The shipped server bundle, driven through its real routes: who may know a unit's private conversations and
// another unit's Character Story.
const bundle = new URL("../packages/gacha-forge/server.mjs", import.meta.url).href;
const packageId = "gacha-forge";
const runId = "audience-proof";
const arden = `${runId}:unit:arden`;
const bryn = `${runId}:unit:bryn`;
const clone = (value) => structuredClone(value);
globalThis.fetch = async () =>
  Response.json([{ id: "fixture", provider: "custom", model: "fixture-only", maxContext: 100000 }]);

let instance = 0;
async function harness({ bondBeats = 3, events = false } = {}) {
  const docs = new Map();
  const routes = new Map();
  const calls = [];
  const seed = (id, kind, data) => docs.set(id, { id, packageId, kind, name: id, revision: 1, data: clone(data) });
  seed("index", "index", {
    activeRunId: runId,
    runs: [
      {
        runId,
        name: "Proof",
        scenario: "Mari keeps the lighthouse.",
        connectionId: "fixture",
        protagonist: { name: "Mari" },
        story: { choices: false, preforge: "off", seasonalEvents: events },
        images: { enabled: false },
      },
    ],
  });
  seed(`${runId}:session`, "session", {
    progress: { 1: { normal: 3 }, 2: { normal: 3 } },
    roster: { [arden]: { level: 20, bondFights: 100000 }, [bryn]: { level: 20, bondFights: 100000 } },
    bondChapters: { [bryn]: { after: 2, beats: bondBeats, opened: 123456 } },
    account: { level: 100, xp: 0 },
    wallet: { funds: 1, aether: 1, vigor: 1000 },
  });
  seed(arden, "unit", { kind: "character", name: "Arden", role: "Warrior", affinity: "fire", rarity: 5 });
  seed(bryn, "unit", { kind: "character", name: "Bryn", role: "Mage", affinity: "water", rarity: 5 });
  for (const chapter of [1, 2]) {
    seed(`${runId}:chapter:${chapter}`, "chapter-plan", {
      chapter,
      title: `Chapter ${chapter}`,
      premise: "x",
      nodes: Array.from({ length: 3 }, (_, index) => ({ index: index + 1, type: "story", title: "S", goal: "g" })),
    });
    for (let index = 0; index < 3; index += 1)
      seed(`${runId}:beat:${chapter}:${index}`, "beat", {
        chapter,
        storyIndex: index,
        segments: [{ speaker: "", text: `Main ${chapter}.${index}` }],
      });
  }
  seed(`${runId}:chapter:bond-bryn`, "chapter-plan", {
    chapter: "bond-bryn",
    bondUnitId: bryn,
    title: "Bryn's secret",
    premise: "x",
    nodes: Array.from({ length: 3 }, (_, index) => ({ index: index + 1, type: "story", title: "Secret" })),
  });
  for (let index = 0; index < bondBeats; index += 1)
    seed(`${runId}:beat:bond-bryn:${index}`, "beat", {
      chapter: "bond-bryn",
      storyIndex: index,
      segments: [{ speaker: "Bryn", text: `BRYN-STORY ${index}: Bryn confesses she stole the map.` }],
      ...(index === 1
        ? {
            choices: [{ id: "c1", kind: "big", options: [{ id: "o1", text: "BRYN-DECISION: forgive Bryn" }] }],
            choiceCanon: { c1: "o1" },
          }
        : {}),
    });
  for (const [unitId, name, at] of [
    [arden, "Arden", 1000],
    [bryn, "Bryn", 2000],
  ])
    seed(`${runId}:chat:${name.toLowerCase()}`, "chat", {
      unitId,
      name,
      messages: [],
      sessions: [
        {
          memory: `${name.toUpperCase()}-CHAT: ${name} talked about the moonstone.`,
          quote: `${name.toUpperCase()}-QUOTE: Keep the moonstone safe.`,
          chapter: 2,
          at,
          count: 2,
        },
      ],
    });
  const now = Date.now();
  if (events)
    seed(`${runId}:story-event:1`, "story-event", {
      seq: 1,
      chapter: "event-1",
      startedAt: now,
      endsAt: now + 1e9,
      state: "ready",
      title: "Lantern Festival",
      theme: "lanterns",
      premise: "A festival on the pier.",
      cast: [arden],
      rewards: [],
    });
  const documents = {
    async getById(_package, id) {
      return clone(docs.get(id) ?? null);
    },
    async list(_package, kind) {
      return clone([...docs.values()].filter((doc) => !kind || doc.kind === kind));
    },
    async create(doc) {
      if (docs.has(doc.id)) return null;
      const saved = { ...clone(doc), revision: 1 };
      docs.set(doc.id, saved);
      return clone(saved);
    },
    async update(doc) {
      const previous = docs.get(doc.id);
      if (!previous || previous.revision !== doc.expectedRevision) return null;
      const saved = { ...previous, ...clone(doc), revision: previous.revision + 1 };
      delete saved.expectedRevision;
      docs.set(doc.id, saved);
      return clone(saved);
    },
    async remove(_package, id, revision) {
      return docs.get(id)?.revision === revision && docs.delete(id);
    },
  };
  const server = await import(`${bundle}?audience=${(instance += 1)}`);
  await server.activate({
    package: { id: packageId, version: "fixture" },
    api: {
      runtime: {
        persistence: { documents, transaction: async (work) => work({ documents }) },
        logger: { info() {}, warn() {}, error() {}, debug() {} },
        json: { parseJsonish: JSON.parse },
        languageModels: {
          async resolveForRequest({ connectionId }) {
            return {
              connectionId,
              model: "fixture-only",
              maxContext: 100000,
              async chatComplete(messages) {
                calls.push(clone(messages));
                const memory = messages[0].content.includes("Summarize only the supplied canonical story history");
                return {
                  content: memory ? JSON.stringify({ summary: "Recap without markers." }) : "{}",
                  finishReason: "stop",
                };
              },
            };
          },
        },
      },
      async registerPrivilegedRoutes(register) {
        await register({
          get(path, handler) {
            routes.set(`GET ${path}`, handler);
          },
          post(path, handler) {
            routes.set(`POST ${path}`, handler);
          },
        });
      },
    },
  });
  const post = (path, body = {}) => routes.get(`POST ${path}`)({ body: { runId, ...clone(body) } });
  const chat = async (unitId, text) => {
    const reply = await post("/chat/send", { unitId, text });
    assert.equal(reply.ok, true, JSON.stringify(reply));
    return JSON.stringify(calls.at(-1));
  };
  const settled = async () => {
    await post("/story-memory/retry");
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const { memory } = await post("/story-memory/status");
      if (!["pending", "stale"].includes(memory.phase)) return memory;
      await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error("story memory did not settle");
  };
  return { calls, post, chat, settled };
}

test("a unit's chat never gets another unit's Character Story, even while memory is not ready", async () => {
  const host = await harness();
  // No summary is saved yet, so the legacy history stands in for memory.
  assert.doesNotMatch(await host.chat(arden, "How are you?"), /BRYN-STORY/u);
  assert.match(await host.chat(bryn, "How are you?"), /BRYN-STORY/u, "Bryn's own chat keeps Bryn's story");
  // An unfinished one stays out too.
  const partial = await harness({ bondBeats: 2 });
  assert.doesNotMatch(await partial.chat(arden, "How are you?"), /BRYN-STORY|BRYN-DECISION/u);
});

test("another unit's Character Story decisions stay out of a chat once memory is ready", async () => {
  const host = await harness();
  assert.equal((await host.settled()).phase, "ready");
  assert.doesNotMatch(await host.chat(arden, "Anything new?"), /BRYN-DECISION/u);
  assert.match(await host.chat(bryn, "Anything new?"), /BRYN-DECISION/u, "Bryn's own decisions stay in Bryn's chat");
});

test("a chat lists its own conversations with their verbatim line, and recall does not repeat them", async () => {
  const host = await harness();
  assert.equal((await host.settled()).phase, "ready");
  const prompt = await host.chat(arden, "Do you still have the moonstone?");
  assert.match(prompt, /ARDEN-CHAT: Arden talked about the moonstone\. One line from it: \\"ARDEN-QUOTE/u);
  assert.equal(prompt.match(/ARDEN-CHAT/gu)?.length, 1, "a listed conversation is not recalled again");
  assert.doesNotMatch(prompt, /BRYN-CHAT/u);
});

test("a seasonal event's planner sees only its own cast's conversations", async () => {
  const host = await harness({ events: true });
  const result = await host.post("/story-event/plan", { chapter: "event-1" });
  const plan = host.calls.find((messages) => messages[0].content.includes("You are the chapter planner"));
  assert.ok(plan, JSON.stringify(result));
  const prompt = JSON.stringify(plan);
  assert.match(prompt, /ARDEN-CHAT/u);
  assert.doesNotMatch(prompt, /BRYN-CHAT/u);
});
