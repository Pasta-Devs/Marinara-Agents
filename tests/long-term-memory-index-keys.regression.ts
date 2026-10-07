import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";
import type { LtmBudgetedChunk } from "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/budget.ts";
import type { LtmMemoryChunk } from "../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
const reservedKeys = ["constructor", "__proto__", "prototype"] as const;

function chunk(id: string, noteId: string): LtmMemoryChunk {
  return {
    id,
    noteId,
    sectionKey: "details",
    text: "constructor __proto__ prototype",
    noteType: "world",
    status: "active",
    modes: ["roleplay"],
    scope: {},
    tags: ["constructor", "prototype"],
    keywords: ["constructor", "prototype"],
    updatedAt: "2026-08-14T00:00:00.000Z",
    sourceHash: "0".repeat(64),
  };
}

function budgetedChunk(value: LtmMemoryChunk): LtmBudgetedChunk {
  return {
    chunk: value,
    score: 1,
    relevanceScore: 1,
    reasons: [],
    lanes: [],
    tier: 3,
    estimatedTokens: 3,
  };
}

function assertOwnKeys(record: object, message: string) {
  for (const key of reservedKeys) {
    assert.equal(Object.hasOwn(record, key), true, `${message}: ${key}`);
  }
}

async function main() {
  const { buildLtmBm25Index, searchLtmBm25 } = await import(`${source}/bm25.ts`);
  const { buildLtmKeywordIndex, searchLtmKeywordIndex } = await import(`${source}/keyword-index.ts`);
  const { buildStopWordSet } = await import(`${source}/keyword-extract.ts`);
  const { buildLtmMetadataIndex, getLtmMetadataMatches } = await import(`${source}/metadata-index.ts`);
  const { parseLtmRecallIndex } = await import(`${source}/rebuild.ts`);
  const { readLongTermMemoryUsage, recordLongTermMemoryInjection } = await import(`${source}/usage.ts`);

  const chunks = [
    chunk("constructor", "constructor"),
    chunk("__proto__", "constructor"),
    chunk("prototype", "prototype"),
  ];

  const bm25 = buildLtmBm25Index(chunks);
  const keyword = buildLtmKeywordIndex(chunks);
  keyword.byKeyword = Object.fromEntries([...Object.entries(keyword.byKeyword), ["__proto__", ["__proto__"]]]);
  const metadata = buildLtmMetadataIndex(chunks);
  metadata.byTag = Object.fromEntries([...Object.entries(metadata.byTag), ["__proto__", ["__proto__"]]]);
  const parsedRecall = parseLtmRecallIndex(
    JSON.parse(
      JSON.stringify({
        version: 1,
        generatedAt: "2026-08-14T00:00:00.000Z",
        sourceHash: "0".repeat(64),
        bm25,
        metadata,
        graph: { version: 1, nodes: {} },
        keywords: keyword,
        embeddings: {
          version: 1,
          model: "unavailable",
          dimension: null,
          embeddedChunkCount: 0,
          chunks: [],
        },
      }),
    ),
  );

  assertOwnKeys(parsedRecall.bm25.documents, "BM25 documents must retain reserved chunk IDs");
  assertOwnKeys(parsedRecall.bm25.terms, "BM25 terms must retain reserved tokens");
  assert.deepEqual(
    searchLtmBm25(parsedRecall.bm25, reservedKeys.join(" "), { topK: 10 }).map(
      ({ chunkId }: { chunkId: string }) => chunkId,
    ),
    [...reservedKeys].sort((left, right) => left.localeCompare(right)),
  );
  const bm25WithoutConstructor = {
    ...parsedRecall.bm25,
    terms: Object.fromEntries(Object.entries(parsedRecall.bm25.terms).filter(([key]) => key !== "constructor")),
  };
  assert.deepEqual(
    searchLtmBm25(bm25WithoutConstructor, "constructor", { topK: 10 }),
    [],
    "BM25 must not read inherited constructor entries",
  );

  assertOwnKeys(parsedRecall.keywords.byChunkId, "keyword index must retain reserved chunk IDs");
  assertOwnKeys(parsedRecall.keywords.byKeyword, "keyword index must retain reserved keyword keys");
  assert.deepEqual(
    searchLtmKeywordIndex(parsedRecall.keywords, "constructor", {
      topK: 10,
    }).map(({ chunkId }: { chunkId: string }) => chunkId),
    [...reservedKeys].sort((left, right) => left.localeCompare(right)),
  );
  const keywordsWithoutConstructor = {
    ...parsedRecall.keywords,
    byKeyword: Object.fromEntries(
      Object.entries(parsedRecall.keywords.byKeyword).filter(([key]) => key !== "constructor"),
    ),
  };
  assert.deepEqual(
    searchLtmKeywordIndex(keywordsWithoutConstructor, "constructor", {
      topK: 10,
    }),
    [],
    "keyword search must not read inherited constructor entries",
  );

  const stopWordChunk = { ...chunk("stopword-chunk", "stopword-note"), keywords: ["cobalt", "cobalt archive"] };
  const stopWordIndex = buildLtmKeywordIndex([stopWordChunk]);
  assert.equal(
    Object.hasOwn(stopWordIndex.byKeyword, "cobalt"),
    true,
    "custom stop words must never remove a stored keyword from the keyword index",
  );
  assert.ok(
    searchLtmKeywordIndex(stopWordIndex, "cobalt", { topK: 10 }).some(
      ({ chunkId }: { chunkId: string }) => chunkId === "stopword-chunk",
    ),
    "a stored keyword must trigger recall when no custom stop word applies",
  );
  const stopWords = buildStopWordSet(["cobalt"]);
  assert.deepEqual(
    searchLtmKeywordIndex(stopWordIndex, "cobalt", { topK: 10, stopWords }),
    [],
    "a custom stop word must block its stored keyword from triggering recall",
  );
  assert.equal(
    Object.hasOwn(stopWordIndex.byKeyword, "cobalt"),
    true,
    "blocking a keyword at recall time must leave the stored keyword index untouched",
  );

  const hyphenChunk = { ...chunk("hyphen-chunk", "hyphen-note"), keywords: ["Cobalt-Moon"] };
  const hyphenIndex = buildLtmKeywordIndex([hyphenChunk]);
  assert.ok(
    searchLtmKeywordIndex(hyphenIndex, "Cobalt-Moon", { topK: 10 }).some(
      ({ chunkId }: { chunkId: string }) => chunkId === "hyphen-chunk",
    ),
    "a hyphenated stored keyword must trigger recall when no custom stop word applies",
  );
  assert.deepEqual(
    searchLtmKeywordIndex(hyphenIndex, "Cobalt-Moon", {
      topK: 10,
      stopWords: buildStopWordSet(["cobalt-moon"]),
    }),
    [],
    "a hyphenated custom stop word must block its own trigger even while its parts may still match",
  );
  assert.deepEqual(
    searchLtmKeywordIndex(hyphenIndex, "Cobalt-Moon", {
      topK: 10,
      stopWords: buildStopWordSet(["cobalt"]),
    }),
    [],
    "a single-token custom stop word must reject a hyphenated query token that contains it",
  );
  const builtinHyphenChunk = {
    ...chunk("builtin-hyphen-chunk", "builtin-hyphen-note"),
    keywords: ["state-of-the-art"],
  };
  const builtinHyphenIndex = buildLtmKeywordIndex([builtinHyphenChunk]);
  assert.deepEqual(
    searchLtmKeywordIndex(builtinHyphenIndex, "state-of-the-art", { topK: 10, stopWords: buildStopWordSet([]) }),
    [],
    "a hyphenated query token containing a built-in stop-word component must be rejected",
  );

  const falsePositiveChunk = { ...chunk("king-chunk", "king-note"), keywords: ["king"] };
  const falsePositiveIndex = buildLtmKeywordIndex([falsePositiveChunk]);
  assert.deepEqual(
    searchLtmKeywordIndex(falsePositiveIndex, "I was looking for the map", { topK: 10 }),
    [],
    "a keyword that only appears inside another word must not produce a keyword hit",
  );
  const phraseChunk = { ...chunk("phrase-chunk", "phrase-note"), keywords: ["king cobra"] };
  const phraseIndex = buildLtmKeywordIndex([phraseChunk]);
  const phraseHit = searchLtmKeywordIndex(phraseIndex, "king", { topK: 10 })[0];
  assert.equal(phraseHit?.chunkId, "phrase-chunk", "a whole-token overlap must still trigger a fuzzy keyword hit");
  assert.ok((phraseHit?.score ?? 0) < 4, "a fuzzy keyword hit must stay below the exact-phrase score ceiling");

  const regexKeyIndex = buildLtmKeywordIndex([{ ...chunk("regex-key-chunk", "regex-key-note"), keywords: ["cobalt"] }]);
  regexKeyIndex.byKeyword["cobalt("] = ["regex-key-chunk"];
  assert.ok(
    searchLtmKeywordIndex(regexKeyIndex, "cobalt", { topK: 10 }).some(
      ({ chunkId }: { chunkId: string }) => chunkId === "regex-key-chunk",
    ),
    "a persisted keyword key with regex metacharacters must not break keyword search",
  );

  const { reciprocalRankFuse } = await import(`${source}/ranking.ts`);
  const { LTM_RECALL_STYLE_WEIGHTS } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/constants.ts");
  for (const [style, weights] of Object.entries(LTM_RECALL_STYLE_WEIGHTS)) {
    if (weights.semanticWeight <= weights.lexicalWeight) continue;
    const ranked = reciprocalRankFuse([
      {
        name: "vector",
        weight: weights.semanticWeight,
        items: [{ chunkId: "vector-top", rawScore: 0.9, reason: "vector" }],
      },
      {
        name: "bm25",
        weight: weights.lexicalWeight,
        items: Array.from({ length: 10 }, (_, index) => ({ chunkId: `bm25-${index}`, rawScore: 40, reason: "bm25" })),
      },
    ]);
    assert.equal(
      ranked[0]?.chunkId,
      "vector-top",
      `${style}: the top semantic hit must outrank deep BM25 hits when its lane weight is higher`,
    );
  }
  const unboundedRaw = reciprocalRankFuse([
    { name: "vector", weight: 0.6, items: [{ chunkId: "vector-top", rawScore: 1, reason: "vector" }] },
    { name: "bm25", weight: 0.3, items: [{ chunkId: "bm25-top", rawScore: 1_000_000, reason: "bm25" }] },
  ]);
  assert.equal(unboundedRaw[0]?.chunkId, "vector-top", "an unbounded raw score must not invert lane weights");

  assertOwnKeys(parsedRecall.metadata.chunks, "metadata index must retain reserved chunk IDs");
  assertOwnKeys(parsedRecall.metadata.byTag, "metadata index must retain reserved tags");
  assert.deepEqual(
    getLtmMetadataMatches(parsedRecall.metadata, { tags: [...reservedKeys] }, { topK: 10 }).map(
      ({ chunkId }: { chunkId: string }) => chunkId,
    ),
    ["__proto__", "constructor", "prototype"],
  );
  const metadataWithoutConstructor = {
    ...parsedRecall.metadata,
    byTag: Object.fromEntries(Object.entries(parsedRecall.metadata.byTag).filter(([key]) => key !== "constructor")),
  };
  assert.deepEqual(
    getLtmMetadataMatches(metadataWithoutConstructor, { tags: ["constructor"] }, { topK: 10 }),
    [],
    "metadata search must not read inherited constructor entries",
  );

  const root = await mkdtemp(join(tmpdir(), "marinara-ltm-index-keys-"));
  try {
    for (const [index, key] of reservedKeys.entries()) {
      const input = {
        chatId: key,
        chunks: [budgetedChunk(chunks[index]!)],
        serializedTokenCount: 3,
        accountingId: key,
      };
      assert.ok(await recordLongTermMemoryInjection(input, root));
      assert.equal(
        await recordLongTermMemoryInjection(input, root),
        null,
        `accounting receipt ${key} must remain idempotent`,
      );
    }

    const usage = await readLongTermMemoryUsage(root);
    assertOwnKeys(usage.chats, "usage must retain reserved chat IDs");
    assertOwnKeys(usage.acceptedReceipts ?? {}, "usage must retain reserved accounting IDs");
    for (const key of reservedKeys) {
      assert.equal(Object.hasOwn(usage.chats[key]!.chunks, key), true);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  console.info("Long-Term Memory reserved-key regressions passed.");
}

runRegressionToCompletion("long-term-memory-index-keys", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
