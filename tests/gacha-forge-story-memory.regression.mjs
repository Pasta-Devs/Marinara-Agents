import assert from "node:assert/strict";
import { test } from "node:test";
import { orderForgeStorySources } from "../sources/forge-kit/story-memory-integration.mjs";
import {
  createForgeStoryMemory,
  forgeStoryMemoryText,
  rankForgeStoryMemories,
} from "../sources/forge-kit/story-memory.mjs";

const source = (id, content, extra = {}) => ({
  id,
  kind: "chapter",
  title: `Chapter ${id}`,
  content,
  order: Number(id) || 1,
  ...extra,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
};

function fixture(initial = [source("1", "Mira saved the lighthouse keeper at Harborfall.")]) {
  let saved = null;
  let revision = null;
  let failWrites = 0;
  let context = 2000;
  let rows = initial;
  const calls = [];
  const logs = [];
  const reads = { source: 0, context: 0 };
  const io = {
    async readMemory() {
      return { data: structuredClone(saved), revision };
    },
    async updateMemory(_runId, update) {
      if (failWrites > 0) {
        failWrites -= 1;
        return false;
      }
      if (update.expectedRevision !== revision) return false;
      saved = structuredClone(update.data);
      revision = (revision || 0) + 1;
      return true;
    },
    async readSources(_runId, target) {
      reads.source += 1;
      return structuredClone(target ? rows.filter((row) => row.order < target.chapter) : rows);
    },
    async resolveContext() {
      reads.context += 1;
      return { maxContext: context, model: "fixture", connectionId: "fixture" };
    },
    async summarize(request) {
      calls.push(structuredClone({ ...request, signal: undefined }));
      const input = JSON.parse(request.messages[1].content);
      return request.kind === "detail" ? input.source.content : "Mira saved the keeper. The harbor alliance endures.";
    },
    estimateTokens: (text) => [...text].length,
    log: (error) => logs.push(error),
  };
  return {
    io,
    calls,
    logs,
    reads,
    create: (overrides = {}) => createForgeStoryMemory({ ...io, ...overrides }),
    memory: () => structuredClone(saved),
    setRows: (value) => {
      rows = value;
    },
    setContext: (value) => {
      context = value;
    },
    failNextWrites: (count) => {
      failWrites = count;
    },
    seed: (value) => {
      saved = structuredClone(value);
      revision = (revision || 0) + 1;
    },
  };
}

test("completed canon is summarized once across retries, CAS conflicts and service restart", async () => {
  const f = fixture();
  const service = f.create();
  f.failNextWrites(1);
  const first = await service.maintain({ runId: "world" });
  assert.equal(first.status.phase, "ready");
  assert.equal(f.memory().records[0].content, "Mira saved the lighthouse keeper at Harborfall.");
  assert.ok(first.status.overviewTokens <= 200);
  assert.equal(f.calls.length, 2);
  await service.maintain({ runId: "world" });
  await f.create().maintain({ runId: "world" });
  assert.equal(f.calls.length, 2);
  const before = { ...f.reads };
  assert.equal((await f.create().status("world")).recordCount, 1);
  assert.deepEqual(f.reads, before, "status inspection must not backfill or resolve a model");
});

test("overview grows and recompresses to the consuming model's10percent while originals remain intact", async () => {
  const f = fixture();
  const service = f.create({
    async summarize(request) {
      f.calls.push(request);
      const input = JSON.parse(request.messages[1].content);
      return request.kind === "detail"
        ? input.source.content
        : request.tokenBudget < 100
          ? "Keeper saved; alliance."
          : "Mira saved the keeper. The harbor alliance endures.";
    },
  });
  await service.maintain({ runId: "world" });
  const original = f.memory().records[0];
  f.setRows([source("1", original.content), source("2", "The alliance built a bridge over Frost River.")]);
  const next = await service.maintain({ runId: "world" });
  assert.equal(next.status.phase, "ready");
  assert.deepEqual(f.memory().records[0], original);
  assert.equal(f.memory().records.length, 2);
  const overviewCall = f.calls.at(-1);
  const inputs = JSON.parse(overviewCall.messages[1].content);
  assert.match(inputs.previousOverview, /keeper/u);
  assert.deepEqual(
    inputs.records.map((record) => record.id),
    ["2"],
  );
  f.setContext(500);
  const smaller = await service.maintain({ runId: "world" });
  assert.equal(smaller.budget, 50);
  assert.ok(smaller.status.overviewTokens <= 50);
  assert.equal(
    smaller.status.overviewTokens,
    f.io.estimateTokens(forgeStoryMemoryText({ overview: smaller.overview })),
  );
  assert.equal(f.memory().records.length, 2);
  assert.deepEqual(f.memory().records[0], original);
});

test("unknown context never fabricates a cap or pays for summaries; oversized output never replaces good memory", async () => {
  const f = fixture();
  const service = f.create();
  f.setContext(null);
  const unknown = await service.recall({ runId: "world", query: "Harborfall" });
  assert.equal(unknown.status.phase, "context-unknown");
  assert.equal(unknown.budget, null);
  assert.equal(unknown.maxContext, null);
  assert.equal(unknown.text, "");
  assert.equal(f.calls.length, 0);
  assert.equal((await service.status("world")).overviewBudget, undefined);
  f.setContext(2000);
  await service.maintain({ runId: "world" });
  const good = f.memory().overview;
  f.setRows([
    source("1", "Mira saved the lighthouse keeper at Harborfall."),
    source("2", "Arden returned the moonstone."),
  ]);
  const oversized = f.create({
    summarize: async (request) => (request.kind === "detail" ? "Arden returned the moonstone." : "x".repeat(201)),
  });
  const failed = await oversized.maintain({ runId: "world" });
  assert.equal(failed.status.phase, "error");
  assert.equal(failed.status.retryable, true);
  assert.deepEqual(f.memory().overview, good);
  assert.equal(f.memory().records.length, 2, "completed detail work survives an overview failure");
  // The good overview lags only the latest chapter, which generation sends in full.
  const recalled = await oversized.recall({ runId: "world", query: "keeper" });
  assert.equal(recalled.status.phase, "ready");
  assert.equal(recalled.overview, good.content);
  assert.ok(f.io.estimateTokens(forgeStoryMemoryText({ overview: recalled.overview })) <= recalled.budget);
});

test("unknown compression capacity stops before chunk probes and preserves reusable memory until configured", async () => {
  const f = fixture();
  let compressionContext = 2000;
  let probes = 0;
  const service = f.create({
    resolveContext: async (_runId, { job }) => ({ maxContext: job === "compress" ? compressionContext : 2000 }),
    fitsSummary: async () => {
      probes += 1;
      return compressionContext != null;
    },
  });
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  const good = f.memory();
  const callsBefore = f.calls.length;
  const probesBefore = probes;
  compressionContext = null;
  const unavailable = await service.maintain({ runId: "world" });
  assert.equal(unavailable.status.phase, "context-unknown");
  assert.equal(unavailable.status.retryable, false);
  assert.equal(unavailable.status.reason, "configure-compress-context");
  assert.equal(f.calls.length, callsBefore);
  assert.equal(probes, probesBefore, "Unknown capacity must not probe chunks or invalidate a reusable overview");
  assert.deepEqual(f.memory().records, good.records);
  assert.deepEqual(f.memory().overview, good.overview);
  compressionContext = 2000;
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  assert.equal(f.calls.length, callsBefore, "Restoring context reuses the complete canonical overview");
});

test("a smaller eligible source projection is rebuilt in the background without deleting archived originals", async () => {
  const rows = [
    source("1", "Keeper saved at Harborfall."),
    source("2", "Arden returned the moonstone."),
    source("3", "FUTURE_SECRET: the Frost River bridge fell."),
  ];
  const f = fixture(rows);
  const service = f.create({
    summarize: async (request) => {
      f.calls.push(request);
      const input = JSON.parse(request.messages[1].content);
      return request.kind === "detail"
        ? input.source.content
        : [input.previousOverview, ...input.records.map((record) => record.content)].filter(Boolean).join(" ");
    },
  });
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  const archives = f.memory().records;
  const newer = f.memory().overview;
  f.setRows(rows.slice(0, 2));
  // The saved overview covers a source outside this projection, so it is not sent; chapter 1 goes in as its
  // saved summary until the rebuild.
  const callsBefore = f.calls.length;
  const behind = await service.recall({ runId: "world", query: "Harborfall moonstone" });
  assert.equal(behind.status.phase, "ready");
  assert.equal(behind.overview, "");
  assert.doesNotMatch(JSON.stringify(behind), /FUTURE_SECRET|bridge/u);
  assert.deepEqual(behind.recent, [
    { id: "1", kind: "chapter", title: "Chapter 1", content: "Keeper saved at Harborfall.", summary: true },
    { id: "2", kind: "chapter", title: "Chapter 2", latest: true },
  ]);
  assert.deepEqual(
    behind.details.map((record) => record.id),
    ["2"],
  );
  assert.equal(behind.lagging, true);
  assert.equal(f.calls.length, callsBefore, "recall never rebuilds the projection in the foreground");
  assert.deepEqual(f.memory().overview, newer);
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  assert.deepEqual(f.memory().records, archives);
  assert.deepEqual(
    f.memory().overview.sources,
    archives.slice(0, 2).map((record) => [record.key, record.fingerprint]),
  );
  const smaller = await service.recall({ runId: "world", query: "Harborfall moonstone" });
  assert.equal(smaller.status.phase, "ready");
  assert.match(smaller.overview, /Keeper saved/);
  assert.match(smaller.overview, /moonstone/);
  assert.doesNotMatch(smaller.text, /FUTURE_SECRET|bridge/);
  assert.deepEqual(
    smaller.details.map((record) => record.id),
    ["1", "2"],
  );
  const rebuilt = f.calls.length;
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  assert.equal(f.calls.length, rebuilt, "The smaller projection remains reusable across subsequent updates");
});

test("failed overview restarts from persisted detail, and interrupted status is recoverable without a UI model call", async () => {
  const f = fixture();
  const failed = f.create({
    summarize: async (request) => {
      f.calls.push(request);
      if (request.kind === "overview") throw new Error("fixture offline");
      return "Keeper saved.";
    },
  });
  assert.equal((await failed.maintain({ runId: "world" })).status.phase, "error");
  assert.equal(f.memory().records.length, 1);
  f.seed({ ...f.memory(), status: { phase: "pending", retryable: false } });
  const resumed = f.create();
  const count = f.calls.length;
  assert.deepEqual(await resumed.status("world"), {
    phase: "stale",
    retryable: true,
    reason: "interrupted",
    recordCount: 1,
  });
  assert.equal(f.calls.length, count);
  await resumed.maintain({ runId: "world" });
  assert.equal(f.calls.length, count + 1);
  assert.equal(f.calls.at(-1).kind, "overview");
});

test("first canon stays canon when its source reads differently, memory carries on, and late generation cannot publish after source drift/deletion", async () => {
  const oath = { kind: "character-story", title: "Arden's oath", order: 1.5 };
  const f = fixture([
    source("1", "Mira saved the lighthouse keeper at Harborfall."),
    source("oath", "Arden swore an oath to guard the keeper.", oath),
  ]);
  await f.create().maintain({ runId: "world" });
  const original = f.memory();
  const paid = f.calls.length;
  // A replay, a package update or edited data that renders summarized canon differently.
  const drifted = source("1", "REPLAY chose to abandon the keeper.");
  const driftedStory = source("oath", "REPLAY Arden broke the oath.", oath);
  f.setRows([drifted, driftedStory]);
  const replay = await f.create().maintain({ runId: "world" });
  assert.equal(replay.status.phase, "ready");
  assert.deepEqual(f.memory().records, original.records);
  assert.deepEqual(f.memory().overview, original.overview);
  assert.equal(f.calls.length, paid, "the changed sources are neither summarized nor folded again");
  // Later canon is still summarized and folded onto the overview built over the first records.
  const moonstone = source("2", "Arden returned the moonstone.");
  f.setRows([drifted, driftedStory, moonstone]);
  assert.equal((await f.create().maintain({ runId: "world" })).status.phase, "ready");
  assert.deepEqual(f.memory().records.slice(0, 2), original.records);
  assert.equal(f.memory().records[2].content, "Arden returned the moonstone.");
  const extension = f.calls.slice(paid);
  assert.deepEqual(
    extension.map((call) => call.kind),
    ["detail", "overview"],
  );
  assert.equal(JSON.parse(extension[0].messages[1].content).source.id, "2");
  assert.equal(JSON.parse(extension[1].messages[1].content).previousOverview, original.overview.content);
  assert.deepEqual(
    f.memory().overview.sources,
    f.memory().records.map((record) => [record.key, record.fingerprint]),
  );
  const caughtUp = await f.create().recall({ runId: "world", query: "keeper" });
  assert.equal(caughtUp.lagging, false, "changed canon owes no background work");
  // Recall stays on memory: the overview and the first records, never the changed text.
  f.setRows([drifted, driftedStory, moonstone, source("3", "Mira left Harborfall.")]);
  const recalled = await f.create().recall({ runId: "world", query: "keeper oath moonstone" });
  assert.equal(recalled.status.phase, "ready");
  assert.equal(recalled.overview, f.memory().overview.content);
  assert.deepEqual(recalled.recent, [{ id: "3", kind: "chapter", title: "Chapter 3", latest: true }]);
  for (const [index, id] of ["1", "oath"].entries())
    assert.equal(recalled.details.find((record) => record.id === id)?.content, original.records[index].content);
  assert.doesNotMatch(JSON.stringify(recalled), /REPLAY/u);
  // A replay's historical recall keeps first canon too, and still sees nothing after its target.
  const historical = await f.create().recall({ runId: "world", target: { chapter: 3 }, query: "keeper oath" });
  assert.equal(historical.status.phase, "ready");
  assert.equal(historical.overview, f.memory().overview.content, "the overview covers only canon before chapter 3");
  assert.deepEqual(historical.recent, [{ id: "2", kind: "chapter", title: "Chapter 2", latest: true }]);
  assert.doesNotMatch(JSON.stringify(historical), /REPLAY|left Harborfall/u);

  // While later canon is summarized, a change to canon that has a record does not cancel it; a change to the
  // source being summarized still discards the paid summary.
  for (const changed of ["1", "2"]) {
    const isolated = fixture();
    await isolated.create().maintain({ runId: "world" });
    const keeper = source("1", "Mira saved the lighthouse keeper at Harborfall.");
    isolated.setRows([keeper, moonstone]);
    const started = deferred();
    const gate = deferred();
    const service = isolated.create({
      summarize: async (request) => {
        if (request.kind === "detail") {
          started.resolve();
          await gate.promise;
        }
        return isolated.io.summarize(request);
      },
    });
    const work = service.maintain({ runId: "world" });
    await started.promise;
    isolated.setRows(changed === "1" ? [drifted, moonstone] : [keeper, source("2", "REPLAY lost the moonstone.")]);
    gate.resolve();
    const result = await work;
    assert.equal(result.status.phase, changed === "1" ? "ready" : "stale", changed);
    assert.deepEqual(
      isolated.memory().records.map((record) => record.content),
      changed === "1"
        ? ["Mira saved the lighthouse keeper at Harborfall.", "Arden returned the moonstone."]
        : ["Mira saved the lighthouse keeper at Harborfall."],
    );
  }

  for (const invalidate of [false, true]) {
    const isolated = fixture();
    const started = deferred();
    const gate = deferred();
    const service = isolated.create({
      summarize: async () => {
        started.resolve();
        return gate.promise;
      },
    });
    const work = service.maintain({ runId: "world" });
    await started.promise;
    if (invalidate) service.invalidate("world");
    else isolated.setRows([source("1", "Different canonical source during generation.")]);
    gate.resolve("An obsolete paid recap.");
    const result = await work;
    assert.equal(result.status.phase, "stale");
    assert.equal(isolated.memory().records.length, 0);
    assert.equal(isolated.memory().overview, null);
  }
});

test("historical recall never sees later memory, builds no overview of its own and never replaces the newer one", async () => {
  const f = fixture([
    source("1", "Keeper saved at Harborfall."),
    source("2", "Arden crossed the Harborfall bridge."),
    source("3", "FUTURE_SECRET: Arden is a dragon."),
  ]);
  const service = f.create({
    summarize: async (request) => {
      f.calls.push(request);
      const input = JSON.parse(request.messages[1].content);
      return request.kind === "detail" ? input.source.content : input.records.map((record) => record.content).join(" ");
    },
  });
  await service.maintain({ runId: "world" });
  const newer = f.memory();
  const calls = f.calls.length;
  // Chapter 1 is this replay's previous chapter, which the caller sends in full.
  const historical = await service.recall({
    runId: "world",
    target: { chapter: 2, storyIndex: 0 },
    query: "Arden dragon Harborfall",
  });
  assert.equal(historical.status.phase, "ready");
  assert.equal(historical.overview, "", "the newer overview covers chapters after the replay");
  assert.doesNotMatch(historical.text, /FUTURE_SECRET|dragon|bridge/u);
  assert.deepEqual(
    historical.details.map((record) => record.id),
    ["1"],
  );
  assert.deepEqual(historical.recent, [{ id: "1", kind: "chapter", title: "Chapter 1", latest: true }]);
  // Without an eligible overview, the replay's earlier chapter goes in as its own saved summary.
  const earlier = await service.recall({
    runId: "world",
    target: { chapter: 3, storyIndex: 0 },
    query: "Arden dragon Harborfall",
  });
  assert.equal(earlier.status.phase, "ready");
  assert.equal(earlier.overview, "");
  assert.doesNotMatch(JSON.stringify(earlier), /FUTURE_SECRET|dragon/u);
  assert.deepEqual(earlier.recent, [
    { id: "1", kind: "chapter", title: "Chapter 1", content: "Keeper saved at Harborfall.", summary: true },
    { id: "2", kind: "chapter", title: "Chapter 2", latest: true },
  ]);
  assert.deepEqual(
    earlier.details.map((record) => record.id),
    ["2"],
  );
  assert.equal(f.calls.length, calls, "a replay pays for no summary of its own");
  assert.deepEqual(f.memory(), newer);
});

test("up to3 main chapters and up to3 side memories are recalled in separate lanes, with lexical/semantic fallback", async () => {
  const f = fixture([
    source("1", "Harborfall keeper is recovering."),
    source("1", "Harborfall captain gave Mira a sapphire.", {
      kind: "character-story",
      title: "Mira's trust",
      order: 2,
    }),
    source("1", "Harborfall captain promised a voyage.", { kind: "chat", title: "Captain conversation", order: 3 }),
    source("4", "Harborfall stores need salt."),
    source("5", "Distant volcano erupted."),
    source("6", "Harborfall lighthouse needs repairs."),
    source("7", "Harborfall breakwater survived the storm."),
    source("2", "Harborfall captain entrusted Mira with the rescue plan.", {
      kind: "character-story",
      title: "Captain trust",
      order: 8,
    }),
    source("7", "Harborfall captain promised to return.", { kind: "chat", title: "Captain promise", order: 9 }),
    source("3", "Unrelated moonbase volcano survey.", { kind: "chat", title: "Moonbase conversation", order: 10 }),
  ]);
  const service = f.create({
    resolveEmbeddings: async () => {
      throw new Error("fixture no embeddings");
    },
  });
  await service.maintain({ runId: "world" });
  const result = await service.recall({ runId: "world", query: "Harborfall captain" });
  assert.equal(result.details.filter((record) => record.kind === "chapter").length, 3);
  assert.deepEqual(
    result.details.filter((record) => record.kind === "chapter").map((record) => record.id),
    ["7", "6", "4"],
  );
  assert.equal(
    result.details.filter((record) => record.kind !== "chapter").length,
    3,
    "Character Stories, events and chats share one three-record allowance",
  );
  assert.equal(result.details.length, 6, "Side memories do not spend the three-chapter allowance");
  assert.equal(f.memory().records.length, 10, "All canonical sources remain archived for the overview");
  assert.ok(result.details.some((record) => record.kind === "character-story"));
  assert.ok(result.details.some((record) => record.kind === "chat"));
  assert.ok(result.details.every((record) => !record.content.includes("volcano")));
  assert.notEqual(result.details[0].kind, "chapter", "Selection retains global relevance for whole-block fitting");
  const headings = [...forgeStoryMemoryText(result).matchAll(/^# Recalled (chapter|character-story|chat):/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(headings.slice(0, 3), ["chapter", "chapter", "chapter"]);
  assert.ok(
    headings.slice(3).every((kind) => kind !== "chapter"),
    "Prompt layers put chapter recall before separate character memories",
  );
  const savedOverview = f.memory().overview;
  const callsBefore = f.calls.length;
  const excluded = await service.recall({ runId: "world", query: "Harborfall captain", excludeChapterIds: ["7"] });
  assert.deepEqual(
    excluded.details.filter((record) => record.kind === "chapter").map((record) => record.id),
    ["6", "4", "1"],
  );
  assert.ok(
    excluded.details.some((record) => record.kind === "chat" && record.id === "7"),
    "Only main-chapter candidates are excluded",
  );
  assert.equal(excluded.details.length, 6);
  assert.deepEqual(
    f.memory().overview,
    savedOverview,
    "Excluding a required full chapter does not change canonical overview coverage",
  );
  assert.equal(f.memory().records.length, 10);
  assert.equal(f.calls.length, callsBefore, "Changing optional recall does not regenerate stored history");
  assert.equal(rankForgeStoryMemories(f.memory().records, "unknown spaceship").length, 0);
  const record = {
    key: "semantic",
    kind: "chapter",
    title: "Rescue",
    content: "The kitten escaped danger.",
    order: 1,
    embedding: [1, 0],
    embeddingSpaceId: "fixture",
  };
  assert.deepEqual(rankForgeStoryMemories([record], "animal saved", { vector: [1, 0], spaceId: "fixture" }), [record]);
  assert.deepEqual(rankForgeStoryMemories([record], "animal saved", { vector: [1, 0], spaceId: "other-model" }), []);
  assert.deepEqual(
    rankForgeStoryMemories([record], "animal saved", { vector: [Number.NaN, 0], spaceId: "fixture" }),
    [],
  );
  assert.equal(
    rankForgeStoryMemories(f.memory().records, "Harborfall", { maxRecalls: 99 }).filter(
      (record) => record.kind === "chapter",
    ).length,
    3,
  );
  assert.equal(rankForgeStoryMemories(f.memory().records, "Harborfall", { maxRecalls: 99 }).length, 6);
  assert.equal(rankForgeStoryMemories(f.memory().records, "Harborfall", { maxRecalls: 1 }).length, 4);
  assert.equal(rankForgeStoryMemories(f.memory().records, "Harborfall", { maxRecalls: 0 }).length, 3);
  assert.equal(rankForgeStoryMemories(f.memory().records, "Harborfall", { maxSideRecalls: 0 }).length, 3);
  assert.ok(
    rankForgeStoryMemories(f.memory().records, "Harborfall", { scope: "chapters" }).every(
      (record) => record.kind === "chapter",
    ),
  );
});

test("embeddings use document/query intent and only current-space vectors are used", async () => {
  const f = fixture();
  const intents = [];
  const service = f.create({
    resolveEmbeddings: async () => ({
      spaceId: "fixture-space",
      embed: async (texts, _signal, intent) => {
        intents.push(intent);
        return texts.map(() => [1, 0]);
      },
    }),
  });
  await service.maintain({ runId: "world" });
  const result = await service.recall({ runId: "world", query: "coastal rescue" });
  assert.deepEqual(intents, ["document", "query"]);
  assert.equal(f.memory().records[0].embeddingSpaceId, "fixture-space");
  assert.equal(typeof f.memory().records[0].embedding, "string", "vectors are saved as compact base64");
  assert.equal(result.details.length, 1);
  assert.equal(result.details[0].embedding, undefined, "vectors never reach the prompt");
});

test("a delayed overview cannot overwrite a newer completed-canon overview from another service", async () => {
  const f = fixture();
  const started = deferred();
  const gate = deferred();
  const old = f.create({
    summarize: async (request) => {
      if (request.kind === "detail") return "Keeper saved.";
      started.resolve();
      return gate.promise;
    },
  });
  const oldWork = old.maintain({ runId: "world" });
  await started.promise;
  f.setRows([source("1", "Mira saved the lighthouse keeper at Harborfall."), source("2", "Arden returned.")]);
  assert.equal((await f.create().maintain({ runId: "world" })).status.phase, "ready");
  const newer = f.memory().overview;
  assert.equal(newer.sources.length, 2);
  gate.resolve("An obsolete overview with only the keeper.");
  assert.equal((await oldWork).status.phase, "stale");
  assert.deepEqual(f.memory().overview, newer);
  assert.equal(f.memory().status.phase, "ready", "the older worker cannot replace the newer worker's status");
});

test("concurrent maintenance joins persisted work without repeating model calls, and cached reads do not scale per source", async () => {
  const rows = Array.from({ length: 12 }, (_unused, index) => source(String(index), `Canon event ${index}.`));
  const f = fixture(rows);
  const service = f.create();
  await Promise.all([service.maintain({ runId: "world" }), service.maintain({ runId: "world" })]);
  assert.equal(f.calls.filter((call) => call.kind === "detail").length, rows.length);
  assert.equal(f.calls.filter((call) => call.kind === "overview").length, rows.length);
  for (const call of f.calls.filter((entry) => entry.kind === "overview")) {
    assert.equal(JSON.parse(call.messages[1].content).records.length, 1, "backfill folds one detail at a time");
  }
  const before = f.reads.source;
  await service.maintain({ runId: "world" });
  assert.equal(f.reads.source - before, 2, "cached archives only need the initial snapshot and final source fence");
});

test("unknown context avoids embedding calls, and unavailable memory I/O cannot block narration", async () => {
  const f = fixture();
  f.setContext(null);
  let embeddingCalls = 0;
  const service = f.create({
    resolveEmbeddings: async () => {
      embeddingCalls += 1;
      throw new Error("must not resolve embeddings without a usable cap");
    },
  });
  assert.equal((await service.recall({ runId: "world", query: "Harborfall" })).status.phase, "context-unknown");
  assert.equal(embeddingCalls, 0);
  const unavailable = f.create({
    readMemory: async () => {
      throw new Error("fixture storage unavailable");
    },
  });
  f.setContext(2000);
  const result = await unavailable.recall({ runId: "world", query: "Harborfall" });
  assert.equal(result.status.phase, "error");
  assert.equal(result.text, "");
  assert.deepEqual(result.details, []);
});

test("a source changed after maintenance keeps its first canon, and one whose record is gone is rechecked before the prompt adopts its overview", async () => {
  const f = fixture();
  await f.create().maintain({ runId: "world" });
  const saved = f.memory();
  f.setRows([source("1", "A different source superseded this history.")]);
  const drifted = await f.create().recall({ runId: "world", query: "keeper" });
  assert.equal(drifted.status.phase, "ready");
  assert.equal(drifted.overview, saved.overview.content);
  assert.doesNotMatch(drifted.text, /superseded/u);
  // Canon replaced on purpose loses its record first, as chapter regeneration does.
  f.seed({ ...saved, records: [] });
  const result = await f.create().recall({ runId: "world", query: "keeper" });
  assert.equal(result.overview, "");
  assert.equal(result.text, "");
  assert.deepEqual(result.details, []);
});

// A recall that waited for the gated summary would deadlock, so the timeout turns that regression into a failure.
test(
  "recall answers from saved memory without summarizing or waiting for in-flight maintenance",
  { timeout: 5000 },
  async () => {
    const rows = [source("1", "Keeper saved at Harborfall."), source("2", "Arden returned the moonstone.")];
    const f = fixture(rows);
    await f.create().maintain({ runId: "world" });
    const saved = f.memory().overview;
    f.setRows([...rows, source("3", "The Frost River bridge opened.")]);
    const started = deferred();
    const gate = deferred();
    let requests = 0;
    const service = f.create({
      summarize: async (request) => {
        requests += 1;
        started.resolve();
        await gate.promise;
        return f.io.summarize(request);
      },
    });
    let finished = false;
    const work = service.maintain({ runId: "world" }).then((result) => {
      finished = true;
      return result;
    });
    await started.promise;
    const recalled = await service.recall({ runId: "world", query: "moonstone" });
    assert.equal(finished, false, "recall resolved while the background summary was still running");
    assert.equal(requests, 1, "only the background job asked for a summary");
    assert.equal(recalled.status.phase, "ready");
    assert.equal(recalled.overview, saved.content);
    assert.deepEqual(
      recalled.details.map((record) => record.id),
      ["2"],
    );
    gate.resolve();
    assert.equal((await work).status.phase, "ready");
    const background = requests;
    const caughtUp = await service.recall({ runId: "world", query: "bridge" });
    assert.equal(requests, background);
    assert.equal(caughtUp.overview, f.memory().overview.content);
    assert.equal(f.memory().overview.sources.length, 3);
    assert.deepEqual(
      caughtUp.details.map((record) => record.id),
      ["3"],
    );
  },
);

test("recall stays ready when memory lags the latest chapter or side canon, but not an earlier chapter with no summary", async () => {
  const rows = [source("1", "Keeper saved at Harborfall."), source("2", "Arden returned the moonstone.")];
  const f = fixture(rows);
  const service = f.create();
  await service.maintain({ runId: "world" });
  const overview = f.memory().overview.content;
  const calls = f.calls.length;
  const chat = source("chat", "Arden promised to guard the moonstone.", { kind: "chat", order: 2.5 });
  const story = source("story", "Mira trusted Arden with the moonstone.", { kind: "character-story", order: 2.6 });
  // Side canon with no summary yet is handed over as written, beside the latest chapter the caller sends in full.
  // A conversation is private, so it is never required canon: it is recalled when relevant, as written until saved.
  const written = [
    { id: "story", kind: "character-story", title: "Chapter story", content: "Mira trusted Arden with the moonstone." },
  ];
  const recalledChat = (result) => result.details.find((record) => record.id === "chat")?.content;
  // Side canon reaches the overview later; recall still has every archived chapter.
  f.setRows([...rows, chat, story]);
  const side = await service.recall({ runId: "world", query: "moonstone" });
  assert.equal(side.status.phase, "ready");
  assert.equal(side.overview, overview);
  assert.deepEqual(side.recent, [{ id: "2", kind: "chapter", title: "Chapter 2", latest: true }, ...written]);
  assert.equal(recalledChat(side), "Arden promised to guard the moonstone.");
  // The caller sends the latest chapter in full, so it may also be missing from memory.
  f.setRows([...rows, chat, story, source("3", "The Frost River bridge opened.")]);
  const latest = await service.recall({ runId: "world", query: "moonstone" });
  assert.equal(latest.status.phase, "ready");
  assert.equal(latest.overview, overview);
  assert.equal(latest.lagging, true, "the background job still owes summaries");
  assert.deepEqual(latest.details.map((record) => record.id).sort(), ["2", "chat"]);
  assert.deepEqual(latest.recent, [...written, { id: "3", kind: "chapter", title: "Chapter 3", latest: true }]);
  // Once chapter 3 is no longer the latest, its canon would be missing from the prompt: it has no summary yet.
  f.setRows([...rows, chat, story, source("3", "The Frost River bridge opened."), source("4", "Mira left.")]);
  const behind = await service.recall({ runId: "world", query: "moonstone" });
  assert.equal(behind.status.phase, "stale");
  assert.equal(behind.overview, "");
  assert.equal(behind.text, "");
  assert.deepEqual(behind.details, []);
  assert.equal(f.calls.length, calls, "recall never pays for summaries");
});

// A background job whose detail summaries land but whose overview fold fails.
const recapOnly = (f, overrides = {}) =>
  f.create({
    summarize: async (request) => {
      f.calls.push(request);
      if (request.kind === "overview") throw new Error("fixture overview offline");
      return `Recap: ${JSON.parse(request.messages[1].content).source.content}`;
    },
    ...overrides,
  });

test("newer side canon inserted before covered canon keeps the saved overview and is sent beside it without model calls", async () => {
  const rows = [source("1", "Keeper saved at Harborfall."), source("2", "Arden returned the moonstone.")];
  const f = fixture(rows);
  await f.create().maintain({ runId: "world" });
  const saved = f.memory().overview;
  const calls = f.calls.length;
  // A Character Story opened after chapter 1 but finished now sorts before the covered chapter 2.
  const story = source("story", "Mira trusted Arden with the moonstone.", {
    kind: "character-story",
    title: "Trust",
    order: 1.5,
  });
  f.setRows([rows[0], story, rows[1]]);
  const service = f.create();
  const inserted = await service.recall({ runId: "world", query: "moonstone" });
  assert.equal(inserted.status.phase, "ready");
  assert.equal(inserted.overview, saved.content, "everything the overview covers is still canon");
  assert.deepEqual(inserted.recent, [
    { id: "story", kind: "character-story", title: "Trust", content: "Mira trusted Arden with the moonstone." },
    { id: "2", kind: "chapter", title: "Chapter 2", latest: true },
  ]);
  assert.equal(inserted.lagging, true, "the background job still owes the rebuilt chronology");
  // An overview that covers canon after a replay's target is future memory there.
  const replay = await service.recall({ runId: "world", target: { chapter: 2, storyIndex: 0 }, query: "moonstone" });
  assert.equal(replay.status.phase, "ready");
  assert.equal(replay.overview, "");
  assert.doesNotMatch(JSON.stringify(replay), /returned the moonstone|harbor alliance/u);
  assert.deepEqual(
    replay.recent.map((entry) => [entry.id, entry.latest ? "latest" : entry.content]),
    [
      ["1", "latest"],
      ["story", "Mira trusted Arden with the moonstone."],
    ],
  );
  // Covered canon that reads differently keeps its first record, so the overview stays and the changed text never
  // reaches the prompt.
  f.setRows([source("1", "REPLAY abandoned the keeper."), story, rows[1]]);
  const changed = await service.recall({ runId: "world", query: "moonstone" });
  assert.equal(changed.status.phase, "ready");
  assert.equal(changed.overview, saved.content);
  assert.deepEqual(changed.recent, inserted.recent);
  assert.doesNotMatch(JSON.stringify(changed), /REPLAY/u);
  assert.equal(f.calls.length, calls, "recall never pays for summaries");
  // Until the rebuilt overview lands, the inserted canon goes in as its saved summary.
  f.setRows([rows[0], story, rows[1]]);
  assert.equal((await recapOnly(f).maintain({ runId: "world" })).status.phase, "error");
  assert.deepEqual(f.memory().overview, saved, "a failed rebuild keeps the saved overview");
  const background = f.calls.length;
  const summarized = await service.recall({ runId: "world", query: "moonstone" });
  assert.equal(summarized.overview, saved.content);
  assert.deepEqual(summarized.recent, [
    {
      id: "story",
      kind: "character-story",
      title: "Trust",
      content: "Recap: Mira trusted Arden with the moonstone.",
      summary: true,
    },
    { id: "2", kind: "chapter", title: "Chapter 2", latest: true },
  ]);
  assert.equal(f.calls.length, background, "recall never pays for summaries");
});

test(
  "summarized side canon not yet in the overview is sent once as its summary, and stays there when the fold fails",
  { timeout: 5000 },
  async () => {
    const rows = [source("1", "Keeper saved at Harborfall."), source("2", "Arden returned the moonstone.")];
    const f = fixture(rows);
    await f.create().maintain({ runId: "world" });
    const saved = f.memory().overview;
    const story = source("story", "Mira trusted Arden with the moonstone.", {
      kind: "character-story",
      title: "Trust",
      order: 3,
    });
    f.setRows([...rows, story]);
    const started = deferred();
    const gate = deferred();
    const service = f.create({
      summarize: async (request) => {
        f.calls.push(request);
        if (request.kind === "detail") return `Recap: ${JSON.parse(request.messages[1].content).source.content}`;
        started.resolve();
        await gate.promise;
        throw new Error("fixture overview offline");
      },
    });
    const work = service.maintain({ runId: "world" });
    await started.promise;
    const calls = f.calls.length;
    const expected = [
      { id: "2", kind: "chapter", title: "Chapter 2", latest: true },
      {
        id: "story",
        kind: "character-story",
        title: "Trust",
        content: "Recap: Mira trusted Arden with the moonstone.",
        summary: true,
      },
    ];
    // The story's summary is saved while its overview fold is still running.
    const folding = await service.recall({ runId: "world", query: "moonstone" });
    assert.equal(folding.status.phase, "ready");
    assert.equal(folding.overview, saved.content);
    assert.deepEqual(folding.recent, expected);
    assert.deepEqual(
      folding.details.map((record) => record.id),
      ["2"],
      "the relevant story summary is sent once, as recent canon, not ranked again",
    );
    assert.equal(folding.lagging, true);
    gate.resolve();
    assert.equal((await work).status.phase, "error");
    const failed = await service.recall({ runId: "world", query: "moonstone" });
    assert.equal(failed.status.phase, "ready");
    assert.equal(failed.overview, saved.content);
    assert.deepEqual(failed.recent, expected);
    assert.deepEqual(
      failed.details.map((record) => record.id),
      ["2"],
    );
    assert.equal(failed.lagging, false, "a failed fold waits for Retry");
    assert.equal(f.calls.length, calls, "recall never pays for summaries");
    assert.deepEqual(f.memory().overview, saved);
  },
);

test("earlier chapters behind the overview go in as their summaries in story order, unless one has no summary yet", async () => {
  const chapters = [
    "Keeper saved at Harborfall.",
    "Arden returned the moonstone.",
    "The Frost River bridge opened.",
    "Mira left Harborfall.",
  ].map((content, index) => source(String(index + 1), content));
  const f = fixture(chapters.slice(0, 1));
  await f.create().maintain({ runId: "world" });
  const saved = f.memory().overview;
  // Chapters 2-4 are summarized, but folding them into the overview fails.
  f.setRows(chapters);
  assert.equal((await recapOnly(f).maintain({ runId: "world" })).status.phase, "error");
  const calls = f.calls.length;
  // A chat finished since then is private: it is recalled when relevant, not sent as required canon.
  const chat = source("chat", "Arden promised to guard the moonstone.", {
    kind: "chat",
    title: "Arden conversation",
    order: 2.5,
  });
  f.setRows([...chapters.slice(0, 2), chat, ...chapters.slice(2)]);
  const service = f.create();
  const behind = await service.recall({ runId: "world", query: "moonstone bridge" });
  assert.equal(behind.status.phase, "ready");
  assert.equal(behind.overview, saved.content);
  assert.deepEqual(behind.recent, [
    { id: "2", kind: "chapter", title: "Chapter 2", content: "Recap: Arden returned the moonstone.", summary: true },
    { id: "3", kind: "chapter", title: "Chapter 3", content: "Recap: The Frost River bridge opened.", summary: true },
    { id: "4", kind: "chapter", title: "Chapter 4", latest: true },
  ]);
  assert.deepEqual(
    behind.details.map((record) => record.id),
    ["chat"],
    "summaries sent as recent canon are not ranked again",
  );
  assert.equal(behind.lagging, false, "a failed fold waits for Retry");
  // Chapter 4 also has a summary once chapter 5 is the latest, but chapter 5 has none once chapter 6 is.
  f.setRows([...chapters.slice(0, 2), chat, ...chapters.slice(2), source("5", "Arden followed.")]);
  assert.equal((await service.recall({ runId: "world", query: "moonstone" })).status.phase, "ready");
  f.setRows([
    ...chapters.slice(0, 2),
    chat,
    ...chapters.slice(2),
    source("5", "Arden followed."),
    source("6", "Dawn."),
  ]);
  const missing = await service.recall({ runId: "world", query: "moonstone" });
  assert.notEqual(missing.status.phase, "ready");
  assert.equal(missing.overview, "");
  assert.equal(missing.text, "");
  assert.equal(missing.recent, undefined);
  assert.equal(f.calls.length, calls, "recall never pays for summaries");
});

test("memory waiting for Retry or a summary context is not queued again by every generation", async () => {
  const rows = [source("1", "Keeper saved at Harborfall.")];
  const f = fixture(rows);
  const service = f.create();
  await service.maintain({ runId: "world" });
  f.setRows([...rows, source("2", "Arden returned the moonstone.")]);
  for (const phase of ["error", "context-unknown"]) {
    f.seed({ ...f.memory(), status: { phase, retryable: phase === "error", reason: "fixture" } });
    const result = await service.recall({ runId: "world", query: "moonstone" });
    assert.equal(result.status.phase, "ready", phase);
    assert.equal(result.lagging, false, `${phase} waits for Retry or configuration`);
  }
  f.seed({ ...f.memory(), status: { phase: "ready", retryable: false } });
  assert.equal((await service.recall({ runId: "world", query: "moonstone" })).lagging, true);
});

test("background maintenance sizes the overview for the smallest reader, so narration reuses it without model calls", async () => {
  const f = fixture();
  const windows = { structured: 2000, narration: 600, chat: 1000, compress: 2000 };
  const asked = [];
  const service = f.create({
    resolveContext: async (_runId, { job } = {}) => {
      asked.push(job);
      return { maxContext: windows[job] };
    },
    async summarize(request) {
      f.calls.push(request);
      const input = JSON.parse(request.messages[1].content);
      return request.kind === "detail"
        ? input.source.content
        : request.tokenBudget < 100
          ? "Keeper saved."
          : "Mira saved the keeper. The harbor alliance endures.";
    },
  });
  // An explicit job still sizes the overview for that job alone.
  assert.equal((await service.maintain({ runId: "world", job: "structured" })).budget, 200);
  // Recall never resizes the overview; narration goes without it until the background job does.
  const tooLarge = await service.recall({ runId: "world", job: "narration", query: "keeper" });
  assert.equal(tooLarge.status.phase, "ready");
  assert.equal(tooLarge.overview, "", "an overview over narration's 10% is not sent");
  assert.doesNotMatch(tooLarge.text, /alliance/u);
  assert.equal(tooLarge.lagging, true, "the background job still owes narration an overview that fits");
  asked.length = 0;
  const background = await service.maintain({ runId: "world" });
  assert.deepEqual(asked, ["structured", "narration", "chat", "compress"]);
  assert.equal(background.status.phase, "ready");
  assert.equal(background.budget, 60);
  assert.ok(background.status.overviewTokens <= 60);
  const calls = f.calls.length;
  const narration = await service.recall({ runId: "world", job: "narration", query: "keeper" });
  assert.equal(narration.status.phase, "ready");
  assert.equal(narration.overview, "Keeper saved.");
  for (const job of ["structured", "chat"])
    assert.equal((await service.recall({ runId: "world", job, query: "keeper" })).overview, narration.overview);
  assert.equal(f.calls.length, calls, "every reader uses the background overview without model calls");
});

test("a reader with unknown context keeps background memory saved as ready but reports that it needs configuration", async () => {
  const f = fixture();
  const windows = { structured: 2000, narration: null, chat: 1000, compress: 2000 };
  const service = f.create({ resolveContext: async (_runId, { job } = {}) => ({ maxContext: windows[job] }) });
  const background = await service.maintain({ runId: "world" });
  assert.equal(background.status.phase, "ready");
  assert.equal(background.budget, 100, "the overview is sized for the smallest known reader");
  assert.equal(f.memory().status.phase, "ready", "the saved overview stays usable by the known readers");
  assert.deepEqual(f.memory().status.unknownReaders, ["narration"]);
  const reported = await service.status("world");
  assert.deepEqual(
    [reported.phase, reported.retryable, reported.reason],
    ["context-unknown", false, "configure-context"],
    "Continuity asks for narration's context instead of reporting Ready",
  );
  assert.equal(
    (await service.recall({ runId: "world", job: "narration", query: "keeper" })).status.phase,
    "context-unknown",
  );
  const structured = await service.recall({ runId: "world", job: "structured", query: "keeper" });
  assert.equal(structured.status.phase, "ready");
  assert.equal(structured.overview, f.memory().overview.content);
  const calls = f.calls.length;
  windows.narration = 1000;
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  assert.equal(f.calls.length, calls, "configuring the reader reuses the saved overview");
  assert.equal(f.memory().status.unknownReaders, undefined);
  assert.equal((await service.status("world")).phase, "ready");
});

test("oversized raw sources and archived recaps use actual fit-tested Unicode chunks without marking partial work complete", async () => {
  const original = "雪🙂 keeper at Harborfall ".repeat(5);
  const f = fixture([source("1", original)]);
  const requests = [];
  const options = {
    fitsSummary: async ({ kind, messages }) => {
      const input = JSON.parse(messages[1].content);
      return [...(kind === "detail" ? input.source.content : input.records[0].content)].length <= 11;
    },
    summarize: async (request) => {
      const input = JSON.parse(request.messages[1].content);
      requests.push({ kind: request.kind, input });
      return request.kind === "detail" ? input.source.content : "Keeper saved at Harborfall.";
    },
  };
  const result = await f.create(options).maintain({ runId: "world" });
  assert.equal(result.status.phase, "ready");
  const detailParts = requests.filter((request) => request.kind === "detail").map((request) => request.input.source);
  assert.equal(detailParts.map((part) => part.content).join(""), original);
  assert.ok(detailParts.length > 1);
  assert.ok(detailParts.every((part) => [...part.content].length <= 11));
  assert.ok(
    detailParts.every((part) => !/[\ud800-\udbff]$/u.test(part.content) && !/^[\udc00-\udfff]/u.test(part.content)),
  );
  assert.equal(f.memory().records.length, 1);
  const recap = f.memory().records[0].content;
  const overviewParts = requests
    .filter((request) => request.kind === "overview")
    .map((request) => request.input.records[0].content);
  assert.equal(overviewParts.join(""), recap, "every part of the detailed archive reaches the rolling overview");
  assert.ok(overviewParts.length > 1);
  assert.equal(f.memory().work.length, 0);
  assert.ok(result.status.overviewTokens <= result.budget);
});

test("restart resumes durable paid detail and overview chunks without exposing unfinished source coverage", async () => {
  for (const failureKind of ["detail", "overview"]) {
    const f = fixture([source("1", "Keeper saved. Harborfall is safe. Mira returned.")]);
    const attempted = [];
    let fail = true;
    const options = {
      fitsSummary: async ({ kind, messages }) => {
        const input = JSON.parse(messages[1].content);
        return [...(kind === "detail" ? input.source.content : input.records[0].content)].length <= 10;
      },
      summarize: async (request) => {
        const input = JSON.parse(request.messages[1].content);
        const part = request.kind === "detail" ? input.source : input.records[0];
        attempted.push({ kind: request.kind, range: part.range });
        if (fail && request.kind === failureKind && part.range.from > 0)
          throw new Error("fixture offline after first successful part");
        return request.kind === "detail" ? part.content : "Keeper saved.";
      },
    };
    assert.equal((await f.create(options).maintain({ runId: "world" })).status.phase, "error");
    assert.equal(f.memory().records.length, failureKind === "detail" ? 0 : 1);
    assert.equal(f.memory().overview, null, "a partial source is not a usable canon overview");
    const work = f.memory().work[0];
    assert.equal(work.offset, 10);
    const previousAttempts = attempted.length;
    fail = false;
    assert.equal((await f.create(options).maintain({ runId: "world" })).status.phase, "ready");
    const resumed = attempted.slice(previousAttempts).filter((request) => request.kind === failureKind);
    assert.ok(resumed.length > 0);
    assert.ok(
      resumed.every((request) => request.range.from >= work.offset),
      "persisted successful parts are not regenerated",
    );
    assert.equal(f.memory().records.length, 1);
    assert.equal(f.memory().work.length, 0);
  }
});

test("context shrink rebuilds from all intact detail chunks instead of truncating a large old overview", async () => {
  const f = fixture([source("1", "The keeper saved Mira. ".repeat(8))]);
  let small = false;
  const seen = [];
  const options = {
    fitsSummary: async ({ kind, messages }) => {
      const input = JSON.parse(messages[1].content);
      return !small || kind !== "overview" || [...input.records[0].content].length <= 15;
    },
    summarize: async (request) => {
      const input = JSON.parse(request.messages[1].content);
      if (request.kind === "detail") return input.source.content;
      if (small) {
        seen.push(input);
        return "Keeper saved Mira.";
      }
      return "Keeper saved Mira. ".repeat(8);
    },
  };
  await f.create(options).maintain({ runId: "world" });
  const detail = f.memory().records[0];
  const oldOverview = f.memory().overview.content;
  assert.ok(oldOverview.length > 50);
  small = true;
  f.setContext(500);
  const result = await f.create(options).maintain({ runId: "world" });
  assert.equal(result.status.phase, "ready");
  assert.ok(result.status.overviewTokens <= 50);
  assert.equal(seen[0].previousOverview, "", "the overlarge old constant is not silently trimmed and reused");
  assert.equal(seen.map((input) => input.records[0].content).join(""), detail.content);
  assert.deepEqual(f.memory().records[0], detail);
});

test("a smaller compressor rebuilds an overview even when the consuming model context is unchanged", async () => {
  const f = fixture([source("1", "Keeper saved Mira. ".repeat(8))]);
  let smallerCompressor = false;
  const seen = [];
  const options = {
    fitsSummary: async ({ kind, messages }) => {
      const input = JSON.parse(messages[1].content);
      return (
        !smallerCompressor ||
        kind !== "overview" ||
        (input.previousOverview.length <= 30 && [...input.records[0].content].length <= 15)
      );
    },
    summarize: async (request) => {
      const input = JSON.parse(request.messages[1].content);
      if (request.kind === "detail") return input.source.content;
      if (smallerCompressor) {
        seen.push(input);
        return "Keeper saved Mira.";
      }
      return "Keeper saved Mira. ".repeat(8);
    },
  };
  await f.create(options).maintain({ runId: "world" });
  const detail = f.memory().records[0];
  smallerCompressor = true;
  const result = await f.create(options).maintain({ runId: "world" });
  assert.equal(result.status.phase, "ready");
  assert.equal(result.maxContext, 2000);
  assert.equal(seen[0].previousOverview, "");
  assert.equal(seen.map((input) => input.records[0].content).join(""), detail.content);
  assert.deepEqual(f.memory().records[0], detail);
});

test("an input that cannot fit even one Unicode point fails without model work or a source-complete stamp", async () => {
  const f = fixture();
  const result = await f.create({ fitsSummary: async () => false }).maintain({ runId: "world" });
  assert.equal(result.status.phase, "error");
  assert.equal(f.calls.length, 0);
  assert.equal(f.memory().records.length, 0);
  assert.equal(f.memory().overview, null);
  assert.equal(f.memory().work.length, 0);
});

const sideSource = (id, kind, opened, order, content = "The keeper returned safely.") =>
  source(id, content, { kind, title: "Keeper", order, opening: { after: 0, opened } });

test("opening chronology reuses legacy paid archives and embeddings while rebuilding only the misordered overview", async () => {
  const bond = sideSource("bond", "character-story", 20, 5000);
  const event = sideSource("event", "story-event", 10, 6000);
  const f = fixture([bond, event]);
  const embeddingInputs = [];
  const options = {
    resolveEmbeddings: async () => ({
      spaceId: "fixture",
      embed: async (texts, _signal, intent) => {
        embeddingInputs.push({ texts, intent });
        return texts.map(() => [1, 0]);
      },
    }),
  };
  await f.create(options).maintain({ runId: "world" });
  const paid = f.memory().records;
  assert.deepEqual(
    embeddingInputs.map((input) => [input.texts.length, input.intent]),
    [[2, "document"]],
    "new records are embedded in one batch",
  );
  assert.ok(paid.every((record) => record.embeddingSpaceId === "fixture"));
  const previousCalls = f.calls.length;
  const previousEmbeddings = embeddingInputs.length;
  const service = f.create({ ...options, orderSources: orderForgeStorySources });
  const result = await service.maintain({ runId: "world" });
  assert.equal(result.status.phase, "ready");
  assert.deepEqual(f.memory().records, paid, "numeric identities, details and embeddings stay byte-compatible");
  assert.equal(embeddingInputs.length, previousEmbeddings, "paid document embeddings are reused");
  const rebuild = f.calls.slice(previousCalls);
  assert.deepEqual(
    rebuild.map((call) => call.kind),
    ["overview", "overview"],
  );
  assert.deepEqual(
    rebuild.map((call) => JSON.parse(call.messages[1].content).records[0].id),
    ["event", "bond"],
  );
  assert.equal(JSON.parse(rebuild[0].messages[1].content).previousOverview, "");
  const recalled = await service.recall({ runId: "world", query: "keeper" });
  assert.deepEqual(
    recalled.details.map((record) => record.id),
    ["bond", "event"],
    "equal relevance prefers the later opening",
  );
  assert.deepEqual(f.memory().records, paid, "ephemeral recency never rewrites archived order");
  assert.doesNotMatch(JSON.stringify(f.memory()), /"(?:opening|viewOrder)"/u);
  assert.doesNotMatch(JSON.stringify(f.calls), /"(?:opening|viewOrder)"/u);
});

test("a later opening extends a prefix overview without repeating paid detail or embedding work", async () => {
  const bond = sideSource("bond", "character-story", 10, 5000);
  const event = sideSource("event", "story-event", 20, 6000);
  const f = fixture([bond, event]);
  await f.create().maintain({ runId: "world" });
  const paid = f.memory().records;
  const overview = f.memory().overview;
  const previousCalls = f.calls.length;
  f.setRows([bond, event, sideSource("later", "story-event", 30, 6001)]);
  await f.create({ orderSources: orderForgeStorySources }).maintain({ runId: "world" });
  assert.deepEqual(f.memory().records.slice(0, 2), paid);
  const extension = f.calls.slice(previousCalls);
  assert.deepEqual(
    extension.map((call) => call.kind),
    ["detail", "overview"],
  );
  assert.equal(JSON.parse(extension[0].messages[1].content).source.id, "later");
  assert.equal(JSON.parse(extension[1].messages[1].content).previousOverview, overview.content);
});

test("inserting an earlier opening rebuilds the overview in the background, while recall keeps it and sends the inserted canon beside it", async () => {
  const bond = sideSource("bond", "character-story", 20, 5000);
  const event = sideSource("event", "story-event", 30, 6000);
  const earlier = sideSource("earlier", "story-event", 10, 6001);
  const f = fixture([bond, event]);
  await f.create().maintain({ runId: "world" });
  const paid = f.memory().records;
  const saved = f.memory().overview;
  f.setRows([bond, event, earlier]);
  const failed = await f
    .create({
      orderSources: orderForgeStorySources,
      summarize: async () => {
        throw new Error("fixture offline before inserted detail");
      },
    })
    .maintain({ runId: "world" });
  assert.equal(failed.status.phase, "error");
  const previousCalls = f.calls.length;
  const recalled = await f.create({ orderSources: orderForgeStorySources }).recall({ runId: "world", query: "keeper" });
  assert.equal(recalled.status.phase, "ready");
  assert.equal(recalled.overview, saved.content, "everything the saved overview covers is still canon");
  assert.deepEqual(recalled.recent, [
    { id: "earlier", kind: "story-event", title: "Keeper", content: "The keeper returned safely." },
  ]);
  assert.equal(recalled.lagging, false, "the failed rebuild waits for Retry");
  assert.equal(f.calls.length, previousCalls);
  assert.deepEqual(f.memory().overview, saved);
  await f.create({ orderSources: orderForgeStorySources }).maintain({ runId: "world" });
  const rebuild = f.calls.slice(previousCalls).filter((call) => call.kind === "overview");
  assert.deepEqual(
    rebuild.map((call) => JSON.parse(call.messages[1].content).records[0].id),
    ["earlier", "bond", "event"],
  );
  assert.equal(JSON.parse(rebuild[0].messages[1].content).previousOverview, "");
  assert.deepEqual(f.memory().records.slice(0, 2), paid);
});

test("legacy partial detail checkpoints resume after enabling opening metadata without repeating successful chunks", async () => {
  const event = sideSource("event", "story-event", 10, 6000, "The keeper returned safely with the lighthouse key.");
  const f = fixture([event]);
  const attempts = [];
  let fail = true;
  const options = {
    fitsSummary: async ({ kind, messages }) => {
      const input = JSON.parse(messages[1].content);
      return [...(kind === "detail" ? input.source.content : input.records[0].content)].length <= 10;
    },
    summarize: async (request) => {
      const input = JSON.parse(request.messages[1].content);
      const part = request.kind === "detail" ? input.source : input.records[0];
      attempts.push({ kind: request.kind, id: part.id, from: part.range.from });
      if (fail && request.kind === "detail" && part.range.from > 0) throw new Error("fixture interrupted");
      return request.kind === "detail" ? part.content : "Keeper returned.";
    },
  };
  assert.equal((await f.create(options).maintain({ runId: "world" })).status.phase, "error");
  const checkpoint = f.memory().work[0];
  assert.equal(checkpoint.offset, 10);
  const previousAttempts = attempts.length;
  f.setRows([sideSource("bond", "character-story", 20, 5000), event]);
  fail = false;
  assert.equal(
    (await f.create({ ...options, orderSources: orderForgeStorySources }).maintain({ runId: "world" })).status.phase,
    "ready",
  );
  const resumed = attempts
    .slice(previousAttempts)
    .filter((attempt) => attempt.kind === "detail" && attempt.id === "event");
  assert.ok(resumed.length > 0);
  assert.ok(resumed.every((attempt) => attempt.from >= checkpoint.offset));
  assert.equal(f.memory().work.length, 0);
});

test("mixed-boundary permutation preserves unknown, main and chat slots and accepts boundary zero", () => {
  const rows = [
    source("main", "main"),
    sideSource("bond", "character-story", 30, 2),
    sideSource("unknown", "story-event", 0, 3),
    source("chat", "chat", { kind: "chat", order: 4 }),
    sideSource("event", "story-event", 10, 5),
    sideSource("invalid", "story-event", Number.NaN, 6),
    sideSource("negative", "story-event", -1, 7),
  ];
  assert.deepEqual(
    orderForgeStorySources(rows).map((row) => row.id),
    ["main", "event", "unknown", "chat", "bond", "invalid", "negative"],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["main", "bond", "unknown", "chat", "event", "invalid", "negative"],
  );
});

const memoryRecord = (key, kind, content, order, extra = {}) => ({
  key,
  id: key,
  kind,
  title: key,
  content,
  order,
  ...extra,
});

test("recall ranks like the Engine's advanced recall: a relevance floor, names over common words, the latest cue first", () => {
  const records = [
    memoryRecord("pier", "chapter", "The lanterns were lit along the pier at dusk.", 1),
    memoryRecord("cart", "chapter", "Mira watched while Arden fixed the old cart.", 2),
    memoryRecord("volcano", "chapter", "Smoke rose over the distant volcano.", 3),
  ];
  assert.deepEqual(rankForgeStoryMemories(records, "spaceship engines"), [], "nothing irrelevant fills the slots");
  // A name the story writes mid-sentence outweighs common words, unless it only says who is talking.
  const said = "I asked Arden about the pier lanterns.";
  assert.equal(rankForgeStoryMemories(records, said)[0].key, "cart");
  assert.equal(rankForgeStoryMemories(records, { cues: [said], speakers: ["Arden"] })[0].key, "pier");
  // Plan text close to everything cannot outrank what was just played.
  const ranked = rankForgeStoryMemories(records, {
    plan: "Lanterns, carts, smoke, the pier, the volcano and the old roads of the valley.",
    cues: ["Smoke rose again over the volcano."],
  });
  assert.equal(ranked[0].key, "volcano");
  // Each record is costed whole: one too large for the budget is skipped and a smaller one still gets in.
  const long = memoryRecord("long", "chapter", `The volcano woke. ${"Ash fell on every roof. ".repeat(40)}`, 4);
  const fitted = rankForgeStoryMemories([...records, long], "volcano ash", {
    budgetTokens: 120,
    estimateTokens: (value) => [...value].length,
  });
  assert.deepEqual(
    fitted.map((record) => record.key),
    ["volcano"],
  );
  // Meaning alone counts once it is clearly similar: cosine 0.5 clears the 0.45 floor, 0.4 does not.
  const vectorRecord = (key, similarity) =>
    memoryRecord(key, "chapter", "Quiet evening.", 1, {
      embedding: [similarity, Math.sqrt(1 - similarity ** 2)],
      embeddingSpaceId: "space",
    });
  assert.deepEqual(
    rankForgeStoryMemories([vectorRecord("close", 0.5), vectorRecord("far", 0.4)], "a calm night", {
      vectors: [[1, 0]],
      spaceId: "space",
    }).map((record) => record.key),
    ["close"],
  );
});

test(
  "query vectors are skipped without saved vectors, give up after 1.5 seconds, and fall back to the latest cue",
  { timeout: 10000 },
  async () => {
    const rows = [source("1", "Keeper saved at Harborfall."), source("2", "Arden returned the moonstone.")];
    const f = fixture(rows);
    const calls = [];
    let mode = "down";
    const service = f.create({
      resolveEmbeddings: async () => ({
        spaceId: "space",
        embed: async (texts, signal, intent) => {
          calls.push([intent, texts.length]);
          if (mode === "down") return null;
          if (intent === "document") return texts.map(() => [1, 0]);
          if (mode === "hang") return new Promise(() => {});
          return mode === "single" && texts.length > 1 ? null : texts.map(() => [0, 1]);
        },
      }),
    });
    await service.maintain({ runId: "world" });
    assert.ok(f.memory().records.every((record) => !record.embedding));
    calls.length = 0;
    await service.recall({ runId: "world", query: { plan: "harbor", cues: ["moonstone"] } });
    assert.deepEqual(calls, [], "no record has a vector, so no query is embedded");
    mode = "ready";
    await service.maintain({ runId: "world" });
    assert.ok(f.memory().records.every((record) => record.embeddingSpaceId === "space"));
    mode = "hang";
    const started = performance.now();
    const hung = await service.recall({ runId: "world", query: "moonstone" });
    assert.ok(performance.now() - started < 3000, "a stalled embedder cannot hold generation up");
    assert.deepEqual(
      hung.details.map((record) => record.id),
      ["2"],
      "recall falls back to words",
    );
    mode = "single";
    calls.length = 0;
    await service.recall({ runId: "world", query: { plan: "harbor", cues: ["first", "moonstone"] } });
    assert.deepEqual(calls, [
      ["query", 3],
      ["query", 1],
    ]);
  },
);

test("vectors are kept up in the background: one batch, a refused text on its own, and a new embedding model", async () => {
  const rows = [
    source("1", "Keeper saved at Harborfall."),
    source("2", "REFUSED text the embedder rejects."),
    source("3", "Arden returned the moonstone."),
  ];
  const f = fixture(rows);
  const calls = [];
  let space = "a";
  let down = false;
  const service = f.create({
    resolveEmbeddings: async () => ({
      spaceId: space,
      embed: async (texts, _signal, intent) => {
        calls.push([intent, texts.length]);
        if (down) throw new Error("embedder offline");
        return texts.some((text) => text.includes("REFUSED")) ? null : texts.map(() => [1, 0]);
      },
    }),
  });
  down = true;
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready", "vectors never fail memory");
  assert.deepEqual(calls, [
    ["document", 3],
    ["document", 1],
  ]);
  assert.ok(
    f.memory().records.every((record) => !record.embedding),
    "an offline embedder stops at once",
  );
  down = false;
  calls.length = 0;
  await service.maintain({ runId: "world" });
  assert.deepEqual(calls, [
    ["document", 3],
    ["document", 1],
    ["document", 1],
    ["document", 1],
  ]);
  assert.deepEqual(
    f.memory().records.map((record) => record.embeddingSpaceId),
    ["a", undefined, "a"],
  );
  calls.length = 0;
  space = "b";
  await service.maintain({ runId: "world" });
  assert.deepEqual(
    f.memory().records.map((record) => record.embeddingSpaceId),
    ["b", undefined, "b"],
  );
  assert.deepEqual(calls[0], ["document", 3], "a new embedding model re-embeds every record");
});

test("private conversations stay with their unit, and another unit's Character Story arrives only through the overview", async () => {
  const private_ = (row, audience) => Object.defineProperty(row, "audience", { value: audience });
  const rows = () => [
    source("1", "Keeper saved at Harborfall."),
    private_(
      source("chat-a", "Arden swore to guard the moonstone.", { kind: "chat", title: "Arden chat", order: 1.2 }),
      ["unit:arden"],
    ),
    private_(source("chat-b", "Bryn hid the moonstone map.", { kind: "chat", title: "Bryn chat", order: 1.4 }), [
      "unit:bryn",
    ]),
    private_(
      source("story-a", "Arden found the moonstone in the reef.", {
        kind: "character-story",
        title: "Arden story",
        order: 1.6,
      }),
      ["unit:arden"],
    ),
    source("2", "Mira left Harborfall."),
  ];
  const f = fixture(rows());
  const service = f.create({ readSources: async () => rows() });
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  const folded = f.calls.filter((call) => call.kind === "overview").map((call) => JSON.parse(call.messages[1].content));
  assert.ok(
    folded.every((input) => input.records.every((record) => record.kind !== "chat")),
    "chats never reach the shared overview",
  );
  assert.equal(
    f.calls.filter((call) => call.kind === "detail" && /chat/u.test(call.messages[1].content)).length,
    0,
    "a chat is its own record, with no second summary",
  );
  assert.ok(f.memory().overview.sources.every(([key]) => JSON.parse(key)[0] !== "chat"));
  const ids = (result) => result.details.map((record) => record.id).sort();
  assert.deepEqual(ids(await service.recall({ runId: "world", query: "moonstone", reader: "unit:arden" })), [
    "chat-a",
    "story-a",
  ]);
  assert.deepEqual(ids(await service.recall({ runId: "world", query: "moonstone", reader: "unit:bryn" })), ["chat-b"]);
  assert.deepEqual(ids(await service.recall({ runId: "world", query: "moonstone", cast: ["unit:bryn"] })), [
    "chat-b",
    "story-a",
  ]);
  assert.deepEqual(ids(await service.recall({ runId: "world", query: "moonstone", cast: [] })), ["story-a"]);
  assert.deepEqual(ids(await service.recall({ runId: "world", query: "moonstone" })), ["chat-a", "chat-b", "story-a"]);
  // Until the overview covers it, another unit's Character Story is not sent to a chat as recent canon either.
  const unfolded = fixture(rows());
  const recaps = recapOnly(unfolded, { readSources: async () => rows() });
  assert.equal((await recaps.maintain({ runId: "world" })).status.phase, "error");
  const recent = async (reader) =>
    (await recaps.recall({ runId: "world", query: "moonstone", reader })).recent?.map((entry) => entry.id);
  assert.deepEqual(await recent("unit:arden"), ["1", "story-a", "2"]);
  assert.deepEqual(await recent("unit:bryn"), ["1", "2"]);
});

test("an overview saved before chats were private is not sent to a restricted reader until it is rebuilt", async () => {
  const chat = Object.defineProperty(
    source("chat-a", "Arden swore to guard the moonstone.", { kind: "chat", title: "Arden chat", order: 1.5 }),
    "audience",
    { value: ["unit:arden"] },
  );
  const rows = [source("1", "Keeper saved at Harborfall."), chat, source("2", "Mira left Harborfall.")];
  const f = fixture(rows);
  await f.create().maintain({ runId: "world" });
  const memory = f.memory();
  const chatRecord = memory.records.find((record) => record.kind === "chat");
  f.seed({
    ...memory,
    overview: {
      content: "Arden swore to guard the moonstone, and Mira left.",
      sources: memory.records.map((record) => [record.key, record.fingerprint]),
    },
  });
  assert.ok(chatRecord);
  const service = f.create();
  assert.equal(
    (await service.recall({ runId: "world", query: "moonstone" })).overview,
    "Arden swore to guard the moonstone, and Mira left.",
    "an unrestricted reader keeps it",
  );
  for (const restriction of [{ reader: "unit:bryn" }, { cast: [] }]) {
    const restricted = await service.recall({ runId: "world", query: "moonstone", ...restriction });
    assert.equal(restricted.overview, "");
    assert.doesNotMatch(JSON.stringify(restricted), /swore/u);
  }
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  assert.ok(f.memory().overview.sources.every(([key]) => JSON.parse(key)[0] !== "chat"));
  assert.notEqual((await service.recall({ runId: "world", query: "x", reader: "unit:bryn" })).overview, "");
});

test("a long text the embedder refuses never blocks the rest, and Cancel stops vector upkeep at once", async () => {
  const rows = [
    source("1", `REFUSED ${"A very long recap of the first chapter. ".repeat(40)}`),
    source("2", "Arden returned the moonstone."),
    source("3", "Keeper saved at Harborfall."),
  ];
  const f = fixture(rows);
  const embedder = {
    spaceId: "space",
    embed: async (texts) => (texts.some((text) => text.includes("REFUSED")) ? null : texts.map(() => [1, 0])),
  };
  const service = f.create({ resolveEmbeddings: async () => embedder });
  await service.maintain({ runId: "world" });
  assert.deepEqual(
    f.memory().records.map((record) => record.embeddingSpaceId),
    [undefined, "space", "space"],
  );
  f.setRows([...rows, source("4", "Mira left.")]);
  await service.maintain({ runId: "world" });
  assert.equal(f.memory().records.find((record) => record.id === "4").embeddingSpaceId, "space");
  // The story's Cancel or a reset aborts the signal: no further batch runs and nothing more is written.
  const many = fixture(Array.from({ length: 40 }, (_, index) => source(String(index + 1), `Day ${index + 1}.`)));
  const story = new AbortController();
  let batches = 0;
  const cancelled = many.create({
    resolveEmbeddings: async () => ({
      spaceId: "space",
      embed: async (texts) => {
        batches += 1;
        story.abort();
        return texts.map(() => [1, 0]);
      },
    }),
  });
  await cancelled.maintain({ runId: "world", signal: story.signal });
  assert.equal(batches, 1);
  assert.ok(many.memory().records.every((record) => !record.embedding));
});
