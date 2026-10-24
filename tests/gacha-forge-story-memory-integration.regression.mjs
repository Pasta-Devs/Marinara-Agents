import assert from "node:assert/strict";
import { test } from "node:test";
import { createForgeStoryMemoryIntegration } from "../packages/gacha-forge/src/story-memory-integration.mjs";

function fixture(options = {}) {
  const runId = "memory-frontier";
  const plans = new Map();
  const session = { progress: {}, bondChapters: {} };
  const chats = [];
  const requests = [];
  let adapters;
  const plan = (chapter, nodes = ["story", "combat", "story"]) => {
    const value = { chapter, title: `Chapter ${chapter}`, nodes: nodes.map((type) => ({ type })) };
    plans.set(chapter, value);
    return value;
  };
  const memory = createForgeStoryMemoryIntegration({
    createMemory(options) {
      adapters = options;
      return {
        async maintain() {
          return { status: { phase: "ready" } };
        },
        async recall(options) {
          requests.push(options);
          const sources = await adapters.readSources(runId, options.target);
          return { status: { phase: "ready" }, text: sources.map((source) => source.content).join("\n") };
        },
        async status() {
          return { phase: "ready" };
        },
        invalidate() {},
      };
    },
    documents: {
      async getById() {
        return null;
      },
    },
    packageId: "gacha-forge",
    readRun: async () => ({ connectionId: "main", ...options.run }),
    readSession: async () => session,
    readPlan: async (_, chapter) => plans.get(chapter),
    listPlans: async () => [...plans].map(([chapter, data]) => ({ id: `${runId}:chapter:${chapter}`, data })),
    listChats: async () => chats,
    allNodes: (value) => value?.nodes || [],
    storyNodes: (value) => (value?.nodes || []).filter((node) => node.type === "story"),
    readSegments: async (_, chapter, index) => [{ text: `Canonical ${chapter}:${index}` }],
    renderSegments: (segments) => segments.map((segment) => segment.text).join("\n"),
    bondHistory: (value) => Object.entries(value.bondChapters).map(([unitId, data]) => ({ unitId, part: 1, ...data })),
    bondChapterId: (unitId) => `bond-${unitId}`,
    bondLength: 3,
    generate: async () => {
      throw new Error("No provider calls in integration tests");
    },
    readConnections:
      options.readConnections ||
      (async () => [{ id: "main", provider: "custom", model: "fixture", maxContext: 10000 }]),
    resolveModelMetadata: options.resolveModelMetadata,
    findKnownModel: () => undefined,
    estimateTokens: (value) => Math.ceil(value.length / 4),
    background: (callback) => callback(),
    logger: { warn() {} },
  });
  const context = (chapter, storyIndex = 0) =>
    memory.context({
      runId,
      chapter,
      storyIndex,
      query: "conversation",
      job: "structured",
      fallback: () => "legacy fallback",
    });
  const addChat = (chapter) =>
    chats.push({
      id: `${runId}:chat:keeper`,
      data: {
        name: "Keeper",
        sessions: [{ at: 123, count: 2, chapter, memory: "All saved conversations must reach current writing." }],
      },
    });
  return { runId, plans, session, requests, memory, plan, context, addChat };
}

test("new chapter writing includes legacy chats even when pre-generation assigned a future chapter label", async () => {
  const f = fixture();
  f.plan(1);
  f.plan(2);
  f.plan(3);
  f.plan(6);
  f.session.progress = { 1: { normal: 3 }, 2: { normal: 3 } };
  f.addChat(6);
  assert.deepEqual(await f.memory.frontier(f.runId), { chapter: 3, nodeIndex: 0 });
  assert.match(await f.context(3), /All saved conversations/);
  assert.equal(f.requests.at(-1).target, undefined);
  assert.match(await f.context(7), /All saved conversations/);
  assert.equal(f.requests.at(-1).target, undefined);
});

test("a true earlier-chapter replay excludes ambiguous later legacy chats", async () => {
  const f = fixture();
  f.plan(1);
  f.plan(2);
  f.plan(3);
  f.session.progress = { 1: { normal: 3 }, 2: { normal: 3 } };
  f.addChat(3);
  assert.doesNotMatch(await f.context(1), /All saved conversations/);
  assert.deepEqual(f.requests.at(-1).target, { chapter: 1, storyIndex: 0 });
});

test("within-chapter classification uses played node progress rather than generated beat presence", async () => {
  const f = fixture();
  f.plan(1);
  f.plan(2);
  f.session.progress = { 1: { normal: 1 } };
  f.addChat(2);
  assert.match(await f.context(1, 1), /All saved conversations/);
  assert.equal(f.requests.at(-1).target, undefined);
  assert.doesNotMatch(await f.context(1, 0), /All saved conversations/);
  assert.deepEqual(f.requests.at(-1).target, { chapter: 1, storyIndex: 0 });
});

test("preforged plans cannot advance an unplayed world's canonical frontier", async () => {
  const f = fixture();
  f.plan(1);
  f.plan(9);
  assert.deepEqual(await f.memory.frontier(f.runId), { chapter: 1, nodeIndex: 0 });
  f.addChat(9);
  assert.match(await f.context(1, 0), /All saved conversations/);
});

test("Character Story first writing sees current canon while earlier played scenes remain historical", async () => {
  const f = fixture();
  f.plan(1);
  f.plan("bond-keeper", ["story", "story", "story"]);
  f.session.progress = { 1: { normal: 3 } };
  f.session.bondChapters.keeper = { after: 1, opened: 10, beats: 1 };
  f.addChat(6);
  assert.match(await f.context("bond-keeper", 1), /All saved conversations/);
  assert.equal(f.requests.at(-1).target, undefined);
  assert.doesNotMatch(await f.context("bond-keeper", 0), /All saved conversations/);
  assert.deepEqual(f.requests.at(-1).target, { chapter: "bond-keeper", storyIndex: 0 });
});

test("planned endings are not certified as completed chapter or Character Story facts", async () => {
  const f = fixture();
  f.plan(1).premise = "PLANNED: the keeper dies at the end.";
  f.plan("bond-keeper", ["story", "story", "story"]).premise = "PLANNED: Mari abandons the keeper.";
  f.session.progress = { 1: { normal: 3 } };
  f.session.bondChapters.keeper = { after: 1, opened: 10, beats: 3 };
  const sources = await f.memory.readSources(f.runId);
  assert.equal(sources.length, 2);
  assert.ok(sources.every((source) => source.content.includes("Canonical")));
  assert.ok(sources.every((source) => !source.content.includes("PLANNED")));
  assert.doesNotMatch(await f.context(2), /keeper dies|Mari abandons/);
});

test("current chat context preserves only played beats of an open Character Story", async () => {
  const f = fixture();
  f.plan(1);
  f.plan("bond-keeper", ["story", "story", "story"]);
  f.session.progress = { 1: { normal: 3 } };
  f.session.bondChapters.keeper = { after: 1, opened: 10, beats: 1 };
  const response = await f.memory.context({
    runId: f.runId,
    chapter: 2,
    storyIndex: 0,
    query: "keeper",
    current: true,
    job: "chat",
    fallback: () => "legacy fallback",
  });
  assert.equal(response.match(/Canonical bond-keeper:0/g)?.length, 1);
  assert.doesNotMatch(response, /Canonical bond-keeper:[12]/);
  assert.equal(
    (await f.memory.readSources(f.runId)).some((source) => source.kind === "character-story"),
    false,
  );
  f.session.bondChapters.keeper.beats = 3;
  const completed = await f.context(2);
  assert.equal(
    completed.match(/Canonical bond-keeper:0/g)?.length,
    1,
    "Completed stories must not duplicate a partial prefix",
  );
});

test("unavailable loopback metadata uses only the public model facade and status stays a pure read", async () => {
  const resolved = [];
  const f = fixture({
    run: { narrationConnectionId: "narrator" },
    readConnections: async () => {
      throw new Error("HTTP 401 Android local authentication");
    },
    resolveModelMetadata: async (id) => {
      resolved.push(id);
      return { model: "fixture", maxContext: id === "main" ? 2048 : 8192 };
    },
  });
  await f.memory.status(f.runId);
  assert.deepEqual(resolved, [], "Inspecting memory must not resolve a model or generate text");
  const context = await f.memory.resolveContext(f.runId, { job: "narration" });
  assert.equal(context.maxContext, 2048, "Public selected and fallback windows still use the smaller bound");
  assert.deepEqual(resolved, ["narrator", "main"]);
});

test("missing HTTP and public context capacities remain unknown", async () => {
  const f = fixture({
    readConnections: async () => [],
    resolveModelMetadata: async () => ({ model: "unknown", maxContext: null }),
  });
  assert.equal((await f.memory.resolveContext(f.runId)).maxContext, null);
});
