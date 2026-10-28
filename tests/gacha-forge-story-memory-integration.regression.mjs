import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fitForgeMemoryPrompt,
  forgeComposeMemoryPrompt,
  forgeMemoryContext,
} from "../sources/forge-kit/story-memory-fit.mjs";
import {
  createForgeStoryMemoryIntegration,
  forgeChatRecallQuery,
  forgeKnowledgeBoundary,
} from "../sources/forge-kit/story-memory-integration.mjs";
import { createForgeStoryMemory, forgeStoryMemoryText } from "../sources/forge-kit/story-memory.mjs";

// Summaries keep 10240 output tokens free, so tests that really compress need more than the 10k default window.
const summaryConnections = async () => [{ id: "main", provider: "custom", model: "fixture", maxContext: 32768 }];
const deferred = () => {
  let resolve;
  const promise = new Promise((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
// A revisioned memory document for tests that run the real memory core.
const memoryDocuments = () => {
  let saved;
  let revision = 0;
  return {
    getById: async () => (saved ? { data: structuredClone(saved), revision } : null),
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
  };
};

function fixture(options = {}) {
  const realMemory = options.realMemory;
  const onMaintain = options.maintain;
  const recallOverride = options.recall;
  const runId = "memory-frontier";
  const phase = options.phase || "ready";
  const plans = new Map();
  const session = { progress: {}, bondChapters: {} };
  const chats = [];
  const requests = [];
  const maintained = [];
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
        async maintain(options) {
          maintained.push(options);
          return (await onMaintain?.(options)) || { status: { phase: "ready" } };
        },
        async recall(options) {
          requests.push(options);
          if (recallOverride) return recallOverride(options);
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
    runStory: options.runStory,
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
  return { runId, plans, session, requests, maintained, memory, plan, context, addChat };
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
        { id: "main", provider: "custom", model: "known-consumer", maxContext: 32768 },
        {
          id: "compressor",
          provider: "custom",
          model: "unknown-compressor",
          // Background work reads the three reader windows, then the compression preflight.
          maxContext: loseContextAfterPreflight && contextReads > 4 ? null : compressionContext,
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
  assert.equal((await f.memory.resolveContext(f.runId)).maxContext, 32768);
  const unavailable = await f.memory.maintain({ runId: f.runId });
  assert.equal(unavailable.status.phase, "context-unknown");
  assert.equal(unavailable.status.retryable, false);
  assert.equal(unavailable.status.reason, "configure-compress-context");
  assert.equal(generations, 0);
  assert.equal((await f.memory.status(f.runId)).phase, "context-unknown");
  assert.equal(saved.records.length, 0);
  assert.equal(saved.work.length, 0);
  compressionContext = 32768;
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
  assert.equal(generations, 2);
  assert.equal(saved.records.length, 1);
  const good = structuredClone(saved);
  contextReads = 0;
  loseContextAfterPreflight = true;
  const changed = await f.memory.maintain({ runId: f.runId });
  assert.equal(changed.status.phase, "context-unknown", "A window removed after preflight keeps its distinct reason");
  assert.equal(changed.status.retryable, false);
  assert.equal(contextReads, 5, "Unknown capacity must stop at the first fit check, without searching smaller chunks");
  assert.equal(generations, 2);
  assert.deepEqual(saved.overview, good.overview);
  assert.deepEqual(saved.records, good.records);
  loseContextAfterPreflight = false;
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
  assert.equal(generations, 2);
});

test("summary requests leave thinking models at least 10240 output tokens, or the model's smaller maximum but never under 8192", async () => {
  let compressor = { maxContext: 10855 };
  const f = fixture({
    run: { compressConnectionId: "compressor" },
    readConnections: async () => [
      { id: "main", provider: "custom", model: "fixture", maxContext: 200000 },
      { id: "compressor", provider: "custom", model: "fixture-compressor", ...compressor },
    ],
  });
  // 400 characters estimate as 100 tokens; each message adds 4 and every request 512.
  const messages = [{ role: "user", content: "x".repeat(400) }];
  const budget = (tokenBudget) => f.memory.summaryBudget({ runId: f.runId, messages, tokenBudget });
  assert.equal(await budget(2000), null, "a small overview budget no longer shrinks the output reserve");
  compressor = { maxContext: 10856 };
  const fitting = await budget(2000);
  assert.equal(fitting.maxTokens, 10240);
  assert.equal(fitting.requestBudget(messages), 10240);
  assert.equal(fitting.requestBudget([...messages, { role: "user", content: "x" }]), 0);
  assert.equal(await budget(20000), null, "a larger overview budget raises the reserve");
  compressor = { maxContext: 32768 };
  assert.equal((await budget(undefined)).maxTokens, 32152, "detail requests keep every token that remains");
  compressor = { maxContext: 9615, maxOutputTokens: 9000 };
  assert.equal(await budget(2000), null);
  compressor = { maxContext: 9616, maxOutputTokens: 9000 };
  const capped = await budget(20000);
  assert.equal(capped.maxTokens, 9000, "a model that cannot write 10240 tokens needs only its own maximum");
  assert.equal(capped.requestBudget(messages), 9000);
  // Every generation needs 8192, so a smaller maximum still reserves that: its own attempt fails at no cost,
  // and a fallback model has room.
  compressor = { maxContext: 8807, maxOutputTokens: 4096 };
  assert.equal(await budget(20000), null);
  compressor = { maxContext: 8808, maxOutputTokens: 4096 };
  const floor = await budget(20000);
  assert.equal(floor.maxTokens, 8192);
  assert.equal(floor.requestBudget(messages), 8192);
  assert.equal(floor.requestBudget([...messages, { role: "user", content: "x" }]), 0);
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

test("memory that fell behind answers with legacy history at once and catches up once in the background", async () => {
  let gate = deferred();
  // The story's own signal, which Cancel and a reset abort.
  const story = new AbortController();
  const f = fixture({
    phase: "stale",
    maintain: () => gate.promise,
    runStory: (_runId, operation) => operation(story.signal),
  });
  f.plan(1);
  f.plan(2);
  f.session.progress = { 1: { normal: 3 } };
  const histories = await Promise.all([f.context(2), f.context(2), f.context(2)]);
  assert.ok(
    histories.every((history) => history.startsWith("legacy fallback\n\n# Previous chapter in full: Chapter 1")),
    "Generation never waits for the summary model",
  );
  await settle();
  assert.deepEqual(
    f.maintained,
    [{ runId: f.runId, signal: story.signal }],
    "One background job, sized for every reader rather than this job, stopped by the story's Cancel",
  );
  assert.equal((await f.memory.status(f.runId)).phase, "pending");
  await f.context(2);
  gate.resolve();
  await settle();
  assert.equal(f.maintained.length, 1, "Generation adds no canon, so it never re-arms the running job");
  assert.equal((await f.memory.status(f.runId)).phase, "ready");
  // Completions during a running job still coalesce into one fresh snapshot.
  gate = deferred();
  for (let completion = 0; completion < 3; completion += 1) f.memory.schedule(f.runId);
  await settle();
  assert.equal(f.maintained.length, 2);
  gate.resolve();
  await settle();
  assert.equal(f.maintained.length, 3, "Completions during the job coalesce into one fresh snapshot");
  for (const phase of ["error", "context-unknown"]) {
    const failed = fixture({ phase });
    failed.plan(1);
    failed.plan(2);
    failed.session.progress = { 1: { normal: 3 } };
    assert.match(await failed.context(2), /^legacy fallback/);
    await settle();
    assert.deepEqual(failed.maintained, [], `${phase} waits for Retry or configuration instead of paying again`);
  }
  const replay = fixture({ phase: "stale" });
  for (let chapter = 1; chapter <= 3; chapter += 1) replay.plan(chapter);
  replay.session.progress = { 1: { normal: 3 }, 2: { normal: 3 } };
  assert.match(await replay.context(2), /^legacy fallback/);
  assert.deepEqual(replay.requests.at(-1).target, { chapter: 2, storyIndex: 0 });
  await settle();
  assert.deepEqual(replay.maintained, [], "A replay neither builds its own overview nor schedules maintenance");
});

test("generation never re-arms a running memory job, so a failing summary is tried once and then waits for Retry", async () => {
  const started = deferred();
  const gate = deferred();
  let attempts = 0;
  const f = fixture({
    realMemory: true,
    readConnections: summaryConnections,
    documents: memoryDocuments(),
    generate: async () => {
      attempts += 1;
      started.resolve();
      await gate.promise;
      return { ok: false, error: "fixture summary offline" };
    },
  });
  f.plan(1);
  f.plan(2);
  f.session.progress = { 1: { normal: 3 } };
  // Chapter 1 has no summary yet, so the first current generation queues the background job.
  assert.match(await f.context(2), /^# Previous chapter in full: Chapter 1\n/u);
  await started.promise;
  assert.equal((await f.memory.status(f.runId)).phase, "pending");
  for (let generation = 0; generation < 3; generation += 1) await f.context(2);
  gate.resolve();
  await settle();
  assert.equal(attempts, 1, "generations during the job did not queue the failing summary again");
  assert.equal((await f.memory.status(f.runId)).phase, "error");
  await f.context(2);
  await settle();
  assert.equal(attempts, 1, "an idle generation leaves the failed summary for Retry");
  assert.equal((await f.memory.status(f.runId)).phase, "error");
});

test("canon the overview does not cover surrounds the previous chapter in story order, as required text that survives fitting", async () => {
  let failOverview = false;
  let generations = 0;
  const f = fixture({
    realMemory: true,
    readConnections: summaryConnections,
    documents: memoryDocuments(),
    generate: async ({ kind, messages }) => {
      generations += 1;
      if (kind === "overview" && failOverview) return { ok: false, error: "fixture overview offline" };
      const input = JSON.parse(messages[1].content);
      return { ok: true, value: kind === "detail" ? `SUMMARY ${input.source.id}` : "OVERVIEW of chapter 1." };
    },
    renderContext: (result, options) => forgeMemoryContext(result, { ...options, renderMemory: forgeStoryMemoryText }),
  });
  for (let chapter = 1; chapter <= 4; chapter += 1) f.plan(chapter);
  f.session.progress = { 1: { normal: 3 } };
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
  // An event opened after chapter 1, and chapters 2 and 3, are summarized, but folding them into the overview fails.
  Object.assign(f.plan("event-1", ["story"]), { eventId: "event-record", after: 1, opened: 100 });
  Object.assign(f.session.progress, { 2: { normal: 3 }, 3: { normal: 3 }, "event-1": { normal: 1 } });
  failOverview = true;
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "error");
  // A Character Story opened after chapter 3, the latest chapter, has no summary yet.
  f.plan("bond-keeper", ["story", "story", "story"]);
  f.session.bondChapters.keeper = { after: 3, opened: 200, beats: 3 };
  const paid = generations;
  const context = await f.memory.context({
    runId: f.runId,
    chapter: 4,
    storyIndex: 0,
    query: "summary",
    job: "structured",
    prefix: "# Current chapter so far\nCURRENT_BEAT",
    fallback: () => "legacy fallback",
  });
  await settle();
  assert.equal(generations, paid, "generation pays for no summary, and the failed fold waits for Retry");
  const required = [
    "# Recent canon summary: Story event: Chapter event-1\nSUMMARY event-1",
    "# Recent canon summary: Chapter 2\nSUMMARY 2",
    "# Previous chapter in full: Chapter 3\nCanonical 3:0\n\nCanonical 3:1",
    "# Recent canon in full: Chapter bond-keeper\nCanonical bond-keeper:0\n\nCanonical bond-keeper:1\n\nCanonical bond-keeper:2",
    "# Current chapter so far\nCURRENT_BEAT",
  ].join("\n\n");
  assert.equal(context.prefix, required);
  assert.deepEqual(
    context.details.map((record) => record.id),
    ["1"],
    "only canon the overview covers is optional recall",
  );
  // Fitting drops optional recall first; the recent canon stays whole and in story order.
  const estimate = (messages) => messages.reduce((sum, message) => sum + [...message.content].length + 4, 0);
  const messages = forgeComposeMemoryPrompt(
    (history) => [
      { role: "system", content: "FIXED_LORE" },
      { role: "user", content: history },
    ],
    [context],
  );
  const fit = fitForgeMemoryPrompt(messages, { maxContext: estimate(messages) + 511, estimateMessages: estimate });
  assert.equal(fit.fits, true);
  assert.equal(fit.droppedDetails, 1);
  assert.equal(fit.messages[1].content, `# Canon to date\nOVERVIEW of chapter 1.\n\n${required}`);
});

for (const failAt of [1, 3])
  test(`legacy fallback survives event source failure on read${failAt}`, async () => {
    let eventReads = 0;
    const f = fixture({
      phase: "pending",
      readSegments: async (_, chapter, index) => {
        if (chapter === "event-1" && ++eventReads >= failAt) throw new Error("Controlled event segment read failure");
        return [{ text: `Canonical ${chapter}:${index}` }];
      },
    });
    f.plan(1);
    Object.assign(f.plan("event-1", ["story"]), { eventId: "event-record", after: 1, opened: 100 });
    f.session.progress = { 1: { normal: 3 }, "event-1": { normal: 1 } };
    assert.match(await f.context(2), /legacy fallback/);
    assert.ok(eventReads >= failAt);
  });
function pairedSideStories({ eventOpened, bondOpened, eventAfter = 1, bondAfter = 1 }, options = {}) {
  const f = fixture(options);
  f.plan(1);
  f.plan(2);
  Object.assign(f.plan("event-1", ["story"]), { eventId: "event-record", after: eventAfter, opened: eventOpened });
  f.plan("bond-keeper", ["story", "story", "story"]);
  f.session.progress = { 1: { normal: 3 }, 2: { normal: 3 }, "event-1": { normal: 1 } };
  f.session.bondChapters.keeper = { after: bondAfter, opened: bondOpened, beats: 3 };
  return f;
}
for (const target of ["event", "bond"])
  for (const [label, sourceOpened, targetOpened, sourceAfter, targetAfter, expected] of [
    ["later", 200, 100, 1, 1, false],
    ["earlier", 100, 200, 1, 1, true],
    ["equal", 100, 100, 1, 1, false],
    ["missing-source", undefined, 100, 1, 1, false],
    ["missing-target", 100, undefined, 1, 1, false],
    ["zero-source", 0, 100, 1, 1, false],
    ["zero-target", 100, 0, 1, 1, false],
    ["unknown-earlier-boundary", 0, 0, 1, 2, true],
  ])
    test(`${target} replay scopes ${label} cross-kind canon`, async () => {
      const f = pairedSideStories(
        target === "event"
          ? { eventOpened: targetOpened, bondOpened: sourceOpened, eventAfter: targetAfter, bondAfter: sourceAfter }
          : { eventOpened: sourceOpened, bondOpened: targetOpened, eventAfter: sourceAfter, bondAfter: targetAfter },
      );
      const rows = await f.memory.readSources(f.runId, {
        chapter: target === "event" ? "event-1" : "bond-keeper",
        storyIndex: 0,
      });
      assert.equal(
        rows.some((row) => row.kind === (target === "event" ? "character-story" : "story-event")),
        expected,
        JSON.stringify(rows),
      );
    });

for (const [eventOpened, bondOpened] of [
  [10, 20],
  [20, 10],
  [1792950000001, 1792950000002],
  [1792950000002, 1792950000001],
  [0, 0],
])
  test(`current canon and actual compression rank side stories ${eventOpened}/${bondOpened}`, async () => {
    let saved,
      revision = 0;
    const compressed = [];
    const f = pairedSideStories(
      { eventOpened, bondOpened },
      {
        realMemory: true,
        readConnections: summaryConnections,
        documents: {
          getById: async () => (saved ? { data: structuredClone(saved), revision } : null),
          create: async ({ data }) => {
            if (saved) return false;
            saved = structuredClone(data);
            revision++;
            return true;
          },
          update: async ({ expectedRevision, data }) => {
            if (expectedRevision !== revision) return false;
            saved = structuredClone(data);
            revision++;
            return true;
          },
        },
        generate: async ({ kind, messages }) => {
          const value = JSON.parse(messages[1].content);
          if (kind === "detail") compressed.push(value.source.id);
          return {
            ok: true,
            value: kind === "detail" ? value.source.content : "Canonical history in its established order.",
          };
        },
      },
    );
    const expected =
      eventOpened > 0 && bondOpened > 0 && eventOpened < bondOpened
        ? ["event-1", "bond-keeper"]
        : ["bond-keeper", "event-1"];
    const rows = await f.memory.readSources(f.runId);
    assert.deepEqual(
      rows.filter((row) => ["story-event", "character-story"].includes(row.kind)).map((row) => row.id),
      expected,
    );
    assert.equal(rows.find((row) => row.id === "1").order, 10000);
    assert.equal(rows.find((row) => row.id === "2").order, 20000);
    assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
    assert.deepEqual(
      compressed.filter((id) => expected.includes(id)),
      expected,
      "The real memory core must retain the rank after its own numeric sort",
    );
  });

test("a later side-story opening keeps existing memory fingerprints and compression work", async () => {
  let saved,
    revision = 0;
  const compressed = [];
  const f = pairedSideStories(
    { eventOpened: 10, bondOpened: 20 },
    {
      realMemory: true,
      readConnections: summaryConnections,
      documents: {
        getById: async () => (saved ? { data: structuredClone(saved), revision } : null),
        create: async ({ data }) => {
          if (saved) return false;
          saved = structuredClone(data);
          revision++;
          return true;
        },
        update: async ({ expectedRevision, data }) => {
          if (expectedRevision !== revision) return false;
          saved = structuredClone(data);
          revision++;
          return true;
        },
      },
      generate: async ({ kind, messages }) => {
        const value = JSON.parse(messages[1].content);
        if (kind === "detail") compressed.push(value.source.id);
        return { ok: true, value: kind === "detail" ? value.source.content : "Established canon in order." };
      },
    },
  );
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
  const before = new Map((await f.memory.readSources(f.runId)).map((row) => [row.id, row.order])),
    calls = compressed.length;
  Object.assign(f.plan("event-2", ["story"]), { eventId: "next-event", after: 1, opened: 30 });
  f.session.progress["event-2"] = { normal: 1 };
  for (const row of await f.memory.readSources(f.runId))
    if (before.has(row.id)) assert.equal(row.order, before.get(row.id));
  assert.equal((await f.memory.maintain({ runId: f.runId })).status.phase, "ready");
  assert.deepEqual(
    compressed.slice(calls),
    ["event-2"],
    "Existing canonical detail summaries must not be regenerated just because the boundary acquired a later event",
  );
});

test("recall searches with what was just played, then the call site's cues, and passes who may know it", async () => {
  const f = fixture();
  f.plan(1);
  f.plan(2);
  f.session.progress = { 1: { normal: 3 }, 2: { normal: 1 } };
  await f.memory.context({
    runId: f.runId,
    chapter: 2,
    storyIndex: 1,
    query: { plan: "Chapter 2 plan", cues: ["The duel ended in a draw."], speakers: ["Mira"] },
    prefix: "# Current chapter so far\nThe gate creaked.\n[Canonical player choice by Mira: Open the gate]",
    job: "narration",
    cast: ["memory-frontier:unit:keeper"],
    fallback: () => "legacy fallback",
  });
  const request = f.requests.at(-1);
  assert.deepEqual(request.query, {
    cues: ["The gate creaked.\nOpen the gate", "The duel ended in a draw."],
    window: "The gate creaked.\nOpen the gate",
    plan: "Chapter 2 plan",
    speakers: ["Mira"],
  });
  assert.deepEqual(request.cast, ["memory-frontier:unit:keeper"]);
  assert.equal(request.reader, undefined);
  // Before the first beat, the end of the previous chapter is what was just played.
  await f.memory.context({
    runId: f.runId,
    chapter: 2,
    storyIndex: 0,
    query: "legacy words",
    job: "chat",
    current: true,
    reader: "memory-frontier:unit:keeper",
    fallback: () => "legacy fallback",
  });
  assert.deepEqual(f.requests.at(-1).query.cues, ["Canonical 1:0\n\nCanonical 1:1", "legacy words"]);
  assert.equal(f.requests.at(-1).reader, "memory-frontier:unit:keeper");
});

test("chats and Character Stories carry their audience, and a chat sees only its own unit's open Character Story", async () => {
  const f = fixture();
  f.plan(1);
  f.plan("bond-keeper", ["story", "story", "story"]);
  f.plan("bond-bryn", ["story", "story", "story"]);
  f.session.progress = { 1: { normal: 3 } };
  f.session.bondChapters.keeper = { after: 1, opened: 10, beats: 3 };
  f.session.bondChapters.bryn = { after: 1, opened: 11, beats: 1 };
  f.addChat(1);
  const sources = await f.memory.readSources(f.runId);
  const audience = (kind) => sources.find((source) => source.kind === kind)?.audience;
  assert.deepEqual(audience("chat"), ["memory-frontier:unit:keeper"]);
  assert.deepEqual(audience("character-story"), ["keeper"]);
  assert.doesNotMatch(JSON.stringify(sources), /audience/u, "the audience is never saved or summarized");
  const chat = (reader) =>
    f.memory.context({
      runId: f.runId,
      chapter: 2,
      storyIndex: 0,
      query: "keeper",
      current: true,
      job: "chat",
      reader,
      fallback: () => "legacy fallback",
    });
  assert.match(await chat("bryn"), /Canonical bond-bryn:0/u);
  assert.doesNotMatch(await chat("keeper"), /Canonical bond-bryn/u);
});

test("a chat's recall query is what the player said since the companion last spoke, with speakers kept apart", () => {
  const messages = [
    { who: "player", text: "Old question." },
    { who: "unit", text: "Old answer." },
    { who: "player", text: "Did you see the reef?" },
    { who: "player", text: "The moonstone was there." },
  ];
  assert.deepEqual(forgeChatRecallQuery(messages, { speakers: ["Arden", "", "Mira"] }), {
    cues: ["Did you see the reef?", "The moonstone was there."],
    window: "Old question.\nOld answer.\nDid you see the reef?\nThe moonstone was there.",
    speakers: ["Arden", "Mira"],
  });
  // With the companion speaking last, the player's latest message is the cue.
  assert.deepEqual(forgeChatRecallQuery([...messages, { who: "unit", text: "Yes." }]).cues, [
    "The moonstone was there.",
  ]);
  assert.deepEqual(forgeChatRecallQuery([]), { cues: [], window: "", speakers: [] });
});

test("the knowledge boundary keeps in-world knowledge and the fiction's own boundary", () => {
  assert.match(forgeKnowledgeBoundary, /only what they saw or took part in/u);
  assert.match(forgeKnowledgeBoundary, /learned inside the story from the protagonist or another in-world source/u);
  assert.match(forgeKnowledgeBoundary, /another character's private conversations/u);
  assert.match(forgeKnowledgeBoundary, /no player, game, prompt, instructions or memory notes/u);
});

test("chapter summaries other than the newest are offered to the fitter oldest first; events and canon in full never are", async () => {
  let rendered;
  const f = fixture({
    renderContext: (result, options) => (rendered = options),
    recall: async () => ({
      status: { phase: "ready" },
      recent: [
        { id: "1", kind: "chapter", title: "Chapter 1", content: "RECAP_1", summary: true },
        { id: "festival", kind: "story-event", title: "Story event: Festival", content: "EVENT_IN_FULL" },
        { id: "2", kind: "chapter", title: "Chapter 2", content: "RECAP_2", summary: true },
        { id: "3", kind: "chapter", title: "Chapter 3", content: "RECAP_3", summary: true },
        // A summarized event opened after Chapter 3 sorts after it, but Chapter 3 is still the newest chapter.
        { id: "fair", kind: "story-event", title: "Story event: Fair", content: "FAIR_RECAP", summary: true },
        { id: "4", kind: "chapter", title: "Chapter 4", latest: true },
      ],
    }),
  });
  for (let chapter = 1; chapter <= 5; chapter += 1) f.plan(chapter);
  f.session.progress = { 1: { normal: 3 }, 2: { normal: 3 }, 3: { normal: 3 }, 4: { normal: 3 } };
  await f.context(5);
  assert.deepEqual(rendered.optional, [
    "# Recent canon summary: Chapter 1\nRECAP_1",
    "# Recent canon summary: Chapter 2\nRECAP_2",
  ]);
  for (const block of rendered.optional) assert.ok(rendered.prefix.includes(`${block}\n\n`));
  assert.match(
    rendered.prefix,
    /# Recent canon summary: Chapter 3\nRECAP_3\n\n# Recent canon summary: Story event: Fair\nFAIR_RECAP\n\n# Previous chapter in full: Chapter 4\n/u,
  );
});

test("legacy recovery lets the fitter leave out canon before the previous chapter: older chapters first, then side canon", async () => {
  let rendered;
  const f = fixture({
    phase: "error",
    renderContext: (result, options) =>
      (rendered = forgeMemoryContext(result, { ...options, renderMemory: forgeStoryMemoryText })),
  });
  for (let chapter = 1; chapter <= 4; chapter += 1) f.plan(chapter);
  Object.assign(f.plan("event-1", ["story"]), { eventId: "event-record-1", after: 1, opened: 100 });
  Object.assign(f.plan("event-3", ["story"]), { eventId: "event-record-3", after: 3, opened: 300 });
  f.session.progress = {
    1: { normal: 3 },
    2: { normal: 3 },
    3: { normal: 3 },
    "event-1": { normal: 1 },
    "event-3": { normal: 1 },
  };
  // As the bundle's _r returns it: a Character Story opened before chapter 1, chapters 1-3 with one opened after
  // chapter 2, the chapter so far and locked decisions; starts[n] is where chapter n's turn begins, the last its end.
  const blocks = [
    "# Bond before 1\nBOND_0",
    "# Chapter 1\nCanonical 1:0\n\nCanonical 1:1",
    "# Chapter 2\nCanonical 2:0\n\nCanonical 2:1",
    "# Bond after 2\nBOND_2",
    "# Chapter 3\nCanonical 3:0\n\nCanonical 3:1",
    "# Chapter 4 so far\nCURRENT_BEAT",
    "LOCKED_DECISION",
  ];
  const starts = [];
  Object.assign(starts, { 1: 1, 2: 2, 3: 4, 4: 5 });
  const event1 = "# Story event: Chapter event-1\nCanonical event-1:0";
  const event3 = "# Story event: Chapter event-3\nCanonical event-3:0";
  await f.memory.context({
    runId: f.runId,
    chapter: 4,
    storyIndex: 1,
    prefix: "CURRENT_BEAT",
    fallback: () => ({ blocks, starts }),
  });
  assert.equal(rendered.text, [...blocks, event1, event3].join("\n\n"), "the same history, byte for byte");
  assert.deepEqual(rendered.optional, [blocks[1], blocks[2], blocks[0], event1, blocks[3]]);
  // A digest covering the previous chapter keeps its turn, and the previous chapter in full is added after it.
  const digested = [
    "# Chapter 1\nCanonical 1:0\n\nCanonical 1:1",
    "# Chapters 2-3 (summary)\nDIGEST",
    "# Chapter 4 so far\nCURRENT_BEAT",
  ];
  await f.memory.context({
    runId: f.runId,
    chapter: 4,
    storyIndex: 1,
    prefix: "CURRENT_BEAT",
    fallback: () => ({ blocks: digested, starts: Object.assign([], { 1: 0, 2: 1, 4: 2 }) }),
  });
  assert.deepEqual(rendered.optional, [digested[0], event1]);
  assert.match(rendered.text, /# Chapters 2-3 \(summary\)\nDIGEST\n\n# Chapter 4 so far/u);
  assert.match(rendered.text, /# Previous chapter in full: Chapter 3\nCanonical 3:0\n\nCanonical 3:1$/u);
  // Through the fitter: nothing goes while the reply keeps its floor, then the oldest chapter first.
  const estimate = (messages) => messages.reduce((sum, message) => sum + [...message.content].length + 4, 0);
  await f.memory.context({
    runId: f.runId,
    chapter: 4,
    storyIndex: 1,
    prefix: "CURRENT_BEAT",
    fallback: () => ({ blocks, starts }),
  });
  const messages = forgeComposeMemoryPrompt((history) => [{ role: "user", content: history }], [rendered]);
  const size = estimate(messages);
  const roomy = fitForgeMemoryPrompt(messages, {
    maxContext: size + 512 + 8192,
    maxTokens: 20000,
    estimateMessages: estimate,
  });
  assert.equal(roomy.messages, messages);
  const tight = fitForgeMemoryPrompt(messages, {
    maxContext: size + 512 + 8192 - blocks[1].length - 2,
    maxTokens: 20000,
    estimateMessages: estimate,
  });
  assert.equal(tight.droppedSummaries, 1);
  assert.equal(tight.messages[0].content, [blocks[0], ...blocks.slice(2), event1, event3].join("\n\n"));
  const kept = [...blocks.slice(4), event3].join("\n\n");
  const least = fitForgeMemoryPrompt(messages, {
    maxContext: 8192 + 512 + kept.length + 4,
    maxTokens: 20000,
    estimateMessages: estimate,
  });
  assert.equal(least.droppedSummaries, 5);
  assert.equal(least.messages[0].content, kept, "the previous chapter onward stays");
  const short = fitForgeMemoryPrompt(messages, {
    maxContext: 8192 + 512 + kept.length + 3,
    maxTokens: 20000,
    estimateMessages: estimate,
  });
  assert.equal(short.fits, true, "required canon is never left out, even when the reply then gets less than its floor");
  assert.equal(short.messages[0].content, kept);
  // A builder that repeats the history is never rewritten.
  const doubled = forgeComposeMemoryPrompt(
    (history) => [{ role: "user", content: `${history}\n${history}` }],
    [rendered],
  );
  const repeated = fitForgeMemoryPrompt(doubled, {
    maxContext: estimate(doubled) + 512 + 8192 - 1,
    maxTokens: 20000,
    estimateMessages: estimate,
  });
  assert.equal(repeated.reason, "memory-context-ambiguous");
  assert.equal(repeated.messages, doubled);
});
