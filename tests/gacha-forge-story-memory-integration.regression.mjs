import assert from "node:assert/strict";
import { test } from "node:test";
import { createForgeStoryMemoryIntegration } from "../packages/gacha-forge/src/story-memory-integration.mjs";
import { createForgeStoryMemory } from "../packages/gacha-forge/src/story-memory.mjs";

function fixture(options = {}) {
  const realMemory = options.realMemory;
  const runId = "memory-frontier";
  const phase = options.phase || "ready";
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
      if (realMemory) return createForgeStoryMemory(options);
      return {
        async maintain() {
          return { status: { phase: "ready" } };
        },
        async recall(options) {
          requests.push(options);
          const sources = await adapters.readSources(runId, options.target);
          return {
            status: { phase },
            text: sources.map((source) => source.content).join("\n"),
          };
        },
        async status() {
          return { phase: "ready" };
        },
        invalidate() {},
      };
    },
    documents: options.documents || {
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
    readSegments: options.readSegments || (async (_, chapter, index) => [{ text: `Canonical ${chapter}:${index}` }]),
    renderSegments: (segments) => segments.map((segment) => segment.text).join("\n"),
    bondHistory: (value) => Object.entries(value.bondChapters).map(([unitId, data]) => ({ unitId, part: 1, ...data })),
    bondChapterId: (unitId) => `bond-${unitId}`,
    bondLength: 3,
    generate:
      options.generate ||
      (async () => {
        throw new Error("No provider calls in integration tests");
      }),
    readConnections:
      options.readConnections ||
      (async () => [{ id: "main", provider: "custom", model: "fixture", maxContext: 10000 }]),
    resolveModelMetadata: options.resolveModelMetadata,
    findKnownModel: () => undefined,
    estimateTokens: (value) => Math.ceil(value.length / 4),
    background: (callback) => callback(),
    renderContext: options.renderContext,
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

test("a known consumer with unknown compression context requests configuration and recovers when it is set", async () => {
  let saved;
  let revision = 0;
  let compressionContext = null;
  let generations = 0;
  let contextReads = 0;
  let loseContextAfterPreflight = false;
  const f = fixture({
    realMemory: true,
    run: { compressConnectionId: "compressor" },
    readConnections: async () => {
      contextReads += 1;
      return [
        { id: "main", provider: "custom", model: "known-consumer", maxContext: 10000 },
        {
          id: "compressor",
          provider: "custom",
          model: "unknown-compressor",
          maxContext: loseContextAfterPreflight && contextReads > 2 ? null : compressionContext,
        },
      ];
    },
    documents: {
      getById: async () => saved && { data: structuredClone(saved), revision },
      create: async ({ data }) => {
        if (saved) return false;
        saved = structuredClone(data);
        revision += 1;
        return true;
      },
      update: async ({ expectedRevision, data }) => {
        if (expectedRevision !== revision) return false;
        saved = structuredClone(data);
        revision += 1;
        return true;
      },
    },
    generate: async ({ kind, messages }) => {
      generations += 1;
      const input = JSON.parse(messages[1].content);
      return { ok: true, value: kind === "detail" ? input.source.content : "The canonical chapter was completed." };
    },
  });
  f.plan(1);
  f.session.progress = { 1: { normal: 3 } };
  assert.equal((await f.memory.resolveContext(f.runId)).maxContext, 10000);
  const unavailable = await f.memory.maintain({ runId: f.runId });
  assert.equal(unavailable.status.phase, "context-unknown");
  assert.equal(unavailable.status.retryable, false);
  assert.equal(unavailable.status.reason, "configure-compress-context");
  assert.equal(generations, 0);
  assert.equal((await f.memory.status(f.runId)).phase, "context-unknown");
  assert.equal(saved.records.length, 0);
  assert.equal(saved.work.length, 0);
  compressionContext = 10000;
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
  assert.equal(generations, 2);
  assert.equal(saved.records.length, 1);
  const good = structuredClone(saved);
  contextReads = 0;
  loseContextAfterPreflight = true;
  const changed = await f.memory.maintain({ runId: f.runId });
  assert.equal(changed.status.phase, "context-unknown", "A window removed after preflight keeps its distinct reason");
  assert.equal(changed.status.retryable, false);
  assert.equal(contextReads, 3, "Unknown capacity must stop at the first fit check, without searching smaller chunks");
  assert.equal(generations, 2);
  assert.deepEqual(saved.overview, good.overview);
  assert.deepEqual(saved.records, good.records);
  loseContextAfterPreflight = false;
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
  assert.equal(generations, 2);
});

test("the full previous canonical chapter precedes current beats and does not spend a recall slot", async () => {
  let rendered;
  const f = fixture({ renderContext: (result, options) => (rendered = { result, ...options }) });
  f.plan(1, ["story", "story", "story"]);
  f.plan(2);
  f.session.progress = { 1: { normal: 3 } };
  const current = "# Current chapter so far\nCURRENT_CANONICAL_BEAT";
  await f.memory.context({
    runId: f.runId,
    chapter: 2,
    storyIndex: 1,
    query: "unrelated to previous chapter",
    prefix: current,
    fallback: () => "COMPRESSED_HISTORY",
  });
  assert.deepEqual(f.requests.at(-1).excludeChapterIds, ["1"]);
  assert.equal(
    rendered.prefix,
    `# Previous chapter in full: Chapter 1\nCanonical 1:0\n\nCanonical 1:1\n\nCanonical 1:2\n\n${current}`,
  );
});

test("replay gets its own previous chapter in full and cannot include later completed or prefabricated chapters", async () => {
  let rendered;
  const f = fixture({ renderContext: (result, options) => (rendered = { result, ...options }) });
  for (let chapter = 1; chapter <= 4; chapter += 1) f.plan(chapter);
  f.session.progress = { 1: { normal: 3 }, 2: { normal: 3 }, 3: { normal: 3 } };
  await f.context(2);
  assert.deepEqual(f.requests.at(-1).excludeChapterIds, ["1"]);
  assert.match(rendered.prefix, /Canonical 1:0\n\nCanonical 1:1$/);
  assert.doesNotMatch(rendered.prefix, /Canonical [234]:/);
  await f.context(4);
  assert.deepEqual(f.requests.at(-1).excludeChapterIds, ["3"]);
  assert.match(rendered.prefix, /Canonical 3:0\n\nCanonical 3:1$/);
  assert.doesNotMatch(rendered.prefix, /Canonical 4:/);
});

test("a memory recovery fallback still retains the entire previous chapter over a manual summary", async () => {
  let rendered;
  const f = fixture({ phase: "error", renderContext: (result, options) => (rendered = { result, ...options }) });
  f.plan(1);
  f.session.progress = { 1: { normal: 3 } };
  await f.memory.context({
    runId: f.runId,
    chapter: 2,
    storyIndex: 0,
    prefix: "CURRENT_CANONICAL_BEAT",
    fallback: () => "MANUAL_SUMMARY_OF_PREVIOUS_CHAPTER\n\nCURRENT_CANONICAL_BEAT",
  });
  assert.equal(rendered.result.maxContext, 10000);
  assert.deepEqual(rendered.result.details, []);
  assert.match(rendered.prefix, /MANUAL_SUMMARY_OF_PREVIOUS_CHAPTER/);
  assert.match(rendered.prefix, /# Previous chapter in full: Chapter 1\nCanonical 1:0\n\nCanonical 1:1/);
  assert.equal(rendered.prefix.match(/CURRENT_CANONICAL_BEAT/gu)?.length, 1);
});

test("legacy recovery never doubles an already complete previous chapter, current scene or locked decisions", async () => {
  let rendered;
  const f = fixture({ phase: "error", renderContext: (result, options) => (rendered = { result, ...options }) });
  f.plan(1);
  f.session.progress = { 1: { normal: 3 } };
  const history = "# Chapter 1\nCanonical 1:0\n\nCanonical 1:1\n\nCURRENT_CANONICAL_BEAT\nLOCKED_DECISION";
  await f.memory.context({
    runId: f.runId,
    chapter: 2,
    storyIndex: 1,
    prefix: "CURRENT_CANONICAL_BEAT",
    fate: "LOCKED_DECISION",
    fallback: () => history,
  });
  assert.equal(rendered.prefix, history, "History that already fits must stay byte-for-byte intact");
  assert.equal(rendered.fate, "", "Locked decisions are already in legacy history");
});

test("unknown context keeps the full previous chapter in the plain legacy fallback without inventing a limit", async () => {
  const f = fixture({
    phase: "context-unknown",
    readConnections: async () => [],
    renderContext: () => {
      throw new Error("Unknown capacity must not mark plain legacy history as budget-enforced memory");
    },
  });
  f.plan(1);
  f.session.progress = { 1: { normal: 3 } };
  const history = await f.context(2);
  assert.equal(typeof history, "string");
  assert.ok(history.startsWith("legacy fallback\n\n"));
  assert.match(history, /# Previous chapter in full: Chapter 1\nCanonical 1:0\n\nCanonical 1:1$/);
  assert.equal(await f.memory.resolveContext(f.runId).then((context) => context.maxContext), null);
});

test("live-chat recovery deduplicates played text across different legacy headings and supplies it when absent", async () => {
  let rendered;
  const f = fixture({ phase: "error", renderContext: (result, options) => (rendered = { result, ...options }) });
  f.plan(1);
  f.session.progress = { 1: { normal: 3 } };
  const body = "CURRENT_PLAYED_START\n\nCURRENT_PLAYED_END";
  const previous = "# Chapter 1\nCanonical 1:0\n\nCanonical 1:1";
  const context = (history) =>
    f.memory.context({
      runId: f.runId,
      chapter: 2,
      storyIndex: 0,
      current: true,
      prefix: `# Current chapter so far\n${body}`,
      fallback: () => history,
    });
  const history = `${previous}\n\n# Chapter 2\n${body}`;
  await context(history);
  assert.equal(rendered.prefix, history, "Different legacy headings must not duplicate the played chapter body");
  await context(previous);
  assert.equal(rendered.prefix, `${previous}\n\n# Current chapter so far\n${body}`);
  f.session.progress = {};
  await context("COMPRESSED_FIRST_CHAPTER");
  assert.equal(rendered.prefix, `COMPRESSED_FIRST_CHAPTER\n\n# Current chapter so far\n${body}`);
});
