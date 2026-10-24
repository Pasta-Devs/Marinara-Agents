import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createForgeStoryMemory,
  forgeStoryMemoryText,
  rankForgeStoryMemories,
} from "../packages/gacha-forge/src/story-memory.mjs";

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
  const failed = await f
    .create({
      summarize: async (request) => (request.kind === "detail" ? "Arden returned the moonstone." : "x".repeat(201)),
    })
    .recall({ runId: "world", query: "keeper" });
  assert.equal(failed.status.phase, "error");
  assert.equal(failed.status.retryable, true);
  assert.deepEqual(f.memory().overview, good);
  assert.equal(f.memory().records.length, 2, "completed detail work survives an overview failure");
  assert.equal(failed.overview, good.content);
  assert.ok(f.io.estimateTokens(forgeStoryMemoryText({ overview: failed.overview })) <= failed.budget);
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

test("a smaller eligible source projection rebuilds its overview without deleting archived originals", async () => {
  const rows = [source("1", "Keeper saved at Harborfall."), source("2", "Arden returned the moonstone.")];
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
  f.setRows(rows.slice(0, 1));
  const smaller = await service.recall({ runId: "world", query: "Harborfall moonstone" });
  assert.equal(smaller.status.phase, "ready");
  assert.match(smaller.overview, /Keeper saved/);
  assert.doesNotMatch(smaller.overview, /Arden|moonstone/);
  assert.deepEqual(f.memory().records, archives);
  assert.deepEqual(f.memory().overview.sources, [[archives[0].key, archives[0].fingerprint]]);
  assert.deepEqual(
    smaller.details.map((record) => record.id),
    ["1"],
  );
  const callsBefore = f.calls.length;
  assert.equal((await service.maintain({ runId: "world" })).status.phase, "ready");
  assert.equal(f.calls.length, callsBefore, "The smaller projection remains reusable across subsequent updates");
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

test("first canonical records cannot be rewritten by replay and late generation cannot publish after source drift/deletion", async () => {
  const f = fixture();
  await f.create().maintain({ runId: "world" });
  const original = f.memory();
  f.setRows([source("1", "REPLAY chose to abandon the keeper.")]);
  const replay = await f.create().maintain({ runId: "world" });
  assert.equal(replay.status.phase, "stale");
  assert.equal(replay.status.reason, "source-changed");
  assert.deepEqual(f.memory().records, original.records);
  assert.deepEqual(f.memory().overview, original.overview);

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

test("historical generation never sees later memory or replaces the newer overview", async () => {
  const f = fixture([source("1", "Keeper saved at Harborfall."), source("2", "FUTURE_SECRET: Arden is a dragon.")]);
  const service = f.create({
    summarize: async (request) => {
      f.calls.push(request);
      const input = JSON.parse(request.messages[1].content);
      return request.kind === "detail" ? input.source.content : input.records.map((record) => record.content).join(" ");
    },
  });
  await service.maintain({ runId: "world" });
  const newer = f.memory().overview;
  const historical = await service.recall({
    runId: "world",
    target: { chapter: 2, storyIndex: 0 },
    query: "Arden dragon Harborfall",
  });
  assert.match(historical.overview, /Keeper/u);
  assert.doesNotMatch(historical.text, /FUTURE_SECRET|dragon/u);
  assert.deepEqual(
    historical.details.map((record) => record.id),
    ["1"],
  );
  assert.deepEqual(f.memory().overview, newer);
  const request = JSON.parse(f.calls.at(-1).messages[1].content);
  assert.equal(request.previousOverview, "");
  assert.deepEqual(
    request.records.map((record) => record.id),
    ["1"],
  );
});

test("up to3 main chapters are recalled separately from all relevant character memories, with lexical/semantic fallback", async () => {
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
  const result = await service.recall({ runId: "world", query: "Harborfall captain" });
  assert.equal(result.details.filter((record) => record.kind === "chapter").length, 3);
  assert.deepEqual(
    result.details.filter((record) => record.kind === "chapter").map((record) => record.id),
    ["7", "6", "4"],
  );
  assert.equal(result.details.filter((record) => record.kind === "character-story").length, 2);
  assert.equal(result.details.filter((record) => record.kind === "chat").length, 2);
  assert.equal(result.details.length, 7, "Character memories do not spend the three-chapter allowance");
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
  assert.equal(excluded.details.length, 7);
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
  assert.equal(rankForgeStoryMemories(f.memory().records, "Harborfall", { maxRecalls: 99 }).length, 7);
  assert.equal(rankForgeStoryMemories(f.memory().records, "Harborfall", { maxRecalls: 1 }).length, 5);
  assert.equal(rankForgeStoryMemories(f.memory().records, "Harborfall", { maxRecalls: 0 }).length, 4);
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
  const result = await service.recall({ runId: "world", query: "coastal rescue" });
  assert.deepEqual(intents, ["document", "query"]);
  assert.equal(f.memory().records[0].embeddingSpaceId, "fixture-space");
  assert.equal(result.details.length, 1);
  assert.deepEqual(result.details[0].embedding, [1, 0]);
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

test("a source changed after maintenance is rechecked before the returned prompt adopts its overview", async () => {
  const f = fixture();
  await f.create().maintain({ runId: "world" });
  let reads = 0;
  const service = f.create({
    readSources: async () => {
      reads += 1;
      return reads > 2
        ? [source("1", "A different source superseded this history.")]
        : [source("1", "Mira saved the lighthouse keeper at Harborfall.")];
    },
  });
  const result = await service.recall({ runId: "world", query: "keeper" });
  assert.equal(result.text, "");
  assert.deepEqual(result.details, []);
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
