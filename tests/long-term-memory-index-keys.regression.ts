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
  const { buildLtmKeywordIndex, LTM_KEYWORD_MAX_SCORE, searchLtmKeywordIndex } = await import(
    `${source}/keyword-index.ts`
  );
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

  // Issue #1251: the scope filter must run before each bucket cap, or out-of-scope
  // chunks crowd in-scope chunks out of the exact, direct and fuzzy lanes entirely.
  const crowdedOutOfScope = Array.from({ length: 130 }, (_, index) => {
    const id = `out-of-scope-${String(index).padStart(3, "0")}`;
    return { ...chunk(id, `out_of_scope_${index}`), keywords: ["cobalt"], tags: ["cobalt"] };
  });
  const crowdedInScope = { ...chunk("zz-in-scope", "zz_in_scope_note"), keywords: ["cobalt"], tags: ["cobalt"] };
  const crowdedAllowed = new Set(["zz-in-scope"]);
  assert.deepEqual(
    searchLtmKeywordIndex(buildLtmKeywordIndex([...crowdedOutOfScope, crowdedInScope]), "cobalt", {
      topK: 10,
      allowedChunks: crowdedAllowed,
    }).map(({ chunkId }: { chunkId: string }) => chunkId),
    ["zz-in-scope"],
    "an in-scope chunk after 128 out-of-scope keyword entries must still produce an exact keyword hit",
  );
  assert.deepEqual(
    getLtmMetadataMatches(
      buildLtmMetadataIndex([...crowdedOutOfScope, crowdedInScope]),
      { tags: ["cobalt"] },
      { topK: 10, allowedChunks: crowdedAllowed },
    ).map(({ chunkId }: { chunkId: string }) => chunkId),
    ["zz-in-scope"],
    "an in-scope chunk after 128 out-of-scope tag entries must still produce a direct hit",
  );

  const catalogFillers = Array.from({ length: 512 }, (_, index) => {
    const id = `catalog-filler-${String(index).padStart(3, "0")}`;
    return { ...chunk(id, `catalog_filler_${index}`), keywords: [`aaa-${String(index).padStart(3, "0")}`] };
  });
  const lateKeywordChunk = { ...chunk("zz-late-keyword", "zz_late_keyword_note"), keywords: ["zzz-cobalt"] };
  assert.ok(
    searchLtmKeywordIndex(buildLtmKeywordIndex([...catalogFillers, lateKeywordChunk]), "cobalt", {
      topK: 10,
      allowedChunks: new Set(["zz-late-keyword"]),
    }).some(({ chunkId }: { chunkId: string }) => chunkId === "zz-late-keyword"),
    "a late-alphabet in-scope keyword must survive the fuzzy catalog cap",
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

  // Issue #1258: every lane must share one absolute 0-1 scale, or the score
  // threshold drops from many memories to almost none instead of removing the
  // progressively weaker matches. A 202-chunk corpus gives the idf magnitude the
  // old `score / (score + 1)` normalized away.
  const bm25Corpus = [
    ...Array.from({ length: 200 }, (_, index) => ({
      ...chunk(`filler-${String(index).padStart(3, "0")}`, `filler_note_${index}`),
      text: `filler unique${index} padding padding`,
      keywords: [],
    })),
    { ...chunk("calibration-strong", "calibration_note_strong"), text: "cobalt archive observatory", keywords: [] },
    { ...chunk("calibration-weak", "calibration_note_weak"), text: "cobalt padding padding padding", keywords: [] },
  ];
  const bm25Hits = searchLtmBm25(buildLtmBm25Index(bm25Corpus), "cobalt archive observatory", { topK: 10 });
  const strongBm25 = bm25Hits.find(({ chunkId }) => chunkId === "calibration-strong");
  const weakBm25 = bm25Hits.find(({ chunkId }) => chunkId === "calibration-weak");
  assert.ok(strongBm25, "the multi-term BM25 match must be found");
  assert.ok(weakBm25, "the single-term BM25 match must be found");
  assert.ok(
    bm25Hits.some((hit) => hit.normalizedScore < 0.9),
    "a long query must not normalize every BM25 hit above 0.9",
  );
  assert.ok(
    weakBm25.normalizedScore < strongBm25.normalizedScore,
    "a one-term hit must stay below a multi-term hit on the absolute scale",
  );
  assert.ok(
    weakBm25.normalizedScore < 0.5,
    "sharing one of three query terms must not approach the full-coverage score",
  );

  // Two generic shared keywords must not sum to the exact-phrase ceiling, while a
  // distinctive exact phrase must still reach high keyword relevance.
  const calibrationKeywords = buildLtmKeywordIndex([
    ...Array.from({ length: 15 }, (_, index) => ({
      ...chunk(`generic-${index}`, `generic_note_${index}`),
      keywords: ["mira", "tomas"],
    })),
    { ...chunk("calibration-distinctive", "calibration_note_distinctive"), keywords: ["crimson observatory ledger"] },
    ...Array.from({ length: 4 }, (_, index) => ({
      ...chunk(`unique-${index}`, `unique_note_${index}`),
      keywords: [`unique-keyword-${index}`],
    })),
  ]);
  const genericKeywordHits = searchLtmKeywordIndex(calibrationKeywords, "mira tomas", { topK: 10 });
  assert.ok(
    (genericKeywordHits[0]?.score ?? 0) / LTM_KEYWORD_MAX_SCORE < 0.5,
    "two generic shared keywords must stay well below full keyword relevance",
  );
  const distinctiveKeywordHit = searchLtmKeywordIndex(calibrationKeywords, "crimson observatory ledger", {
    topK: 10,
  })[0];
  assert.equal(distinctiveKeywordHit?.chunkId, "calibration-distinctive");
  assert.ok(
    (distinctiveKeywordHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE > 0.75,
    "a distinctive exact phrase must still score high",
  );
  // Frequency counts only chunks the search may return: `mira` is generic across
  // the vault but sits on a single chunk of this scope, so it keeps full weight.
  const scopedKeywordHit = searchLtmKeywordIndex(calibrationKeywords, "mira tomas", {
    topK: 10,
    allowedChunks: new Set(["generic-0", "calibration-distinctive", "unique-0", "unique-1", "unique-2", "unique-3"]),
  })[0];
  assert.equal(scopedKeywordHit?.chunkId, "generic-0");
  assert.equal(
    (scopedKeywordHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE,
    0.75,
    "a keyword common only outside the recall scope must keep full weight inside it",
  );

  // Issue #1264: the threshold filters the same strength of match in every style
  // while each preset's strongest lane carries the rescaled 0.7 ceiling and
  // graph-only neighbours (at most half the graph weight) stay under the default
  // threshold. A single ordinary keyword is now capped at half the lane, so only
  // two distinct keywords (or a name) clear the default threshold.
  const { DEFAULT_LTM_GLOBAL_SETTINGS } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");
  for (const [style, weights] of Object.entries(LTM_RECALL_STYLE_WEIGHTS)) {
    assert.equal(
      Math.max(...Object.values(weights)),
      0.7,
      `${style}: the strongest lane must carry the rescaled ceiling`,
    );
    assert.ok(
      weights.graphWeight * 0.5 < DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryScoreThreshold,
      `${style}: graph-only neighbours must stay under the default threshold`,
    );
  }
  for (const [style, weights] of Object.entries(LTM_RECALL_STYLE_WEIGHTS)) {
    assert.ok(
      weights.keywordWeight * (3 / LTM_KEYWORD_MAX_SCORE) >= DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryScoreThreshold,
      `${style}: two distinct keywords must clear the default threshold`,
    );
  }

  // Issue #1264: one ordinary exact keyword must not clear the lane alone, while a
  // name used mid-sentence, two distinct keywords, or a multi-word phrase keep full credit.
  const singleMatchIndex = buildLtmKeywordIndex([
    { ...chunk("everyday-chunk", "everyday_note"), keywords: ["half"] },
    { ...chunk("name-chunk", "name_note"), keywords: ["mira"] },
    { ...chunk("pair-chunk", "pair_note"), keywords: ["tomas", "cobalt"] },
  ]);
  const everydayHit = searchLtmKeywordIndex(singleMatchIndex, "There's half a sandwich left", { topK: 10 })[0];
  assert.equal(everydayHit?.chunkId, "everyday-chunk");
  assert.ok(
    (everydayHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE <= 0.5,
    "a single everyday exact keyword must cap at half the keyword lane",
  );
  const fuzzyMatchIndex = buildLtmKeywordIndex([
    {
      ...chunk("fuzzy-match-chunk", "fuzzy_match_note"),
      keywords: ["half", "half sandwich", "half meal", "half leftovers"],
    },
  ]);
  const fuzzyMatchHit = searchLtmKeywordIndex(fuzzyMatchIndex, "There's half sandwich meal leftovers", { topK: 10 })[0];
  assert.equal(fuzzyMatchHit?.chunkId, "fuzzy-match-chunk");
  assert.ok(
    (fuzzyMatchHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE <= 0.5,
    "one exact keyword must stay capped despite multiple fuzzy hits",
  );
  const sentenceStartHit = searchLtmKeywordIndex(singleMatchIndex, "Mira arrived", { topK: 10 })[0];
  assert.equal(sentenceStartHit?.chunkId, "name-chunk");
  assert.ok(
    (sentenceStartHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE <= 0.5,
    "capitalisation at the start of a sentence must not count as a name",
  );
  const nameHit = searchLtmKeywordIndex(singleMatchIndex, "Meet Mira at the bar", { topK: 10 })[0];
  assert.equal(nameHit?.chunkId, "name-chunk");
  assert.ok(
    (nameHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE >= 0.75,
    "a name used mid-sentence must keep full credit on a single keyword",
  );
  const pairHit = searchLtmKeywordIndex(singleMatchIndex, "tomas cobalt arrive", { topK: 10 })[0];
  assert.equal(pairHit?.chunkId, "pair-chunk");
  assert.ok((pairHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE >= 0.75, "two distinct keywords must keep full credit");
  const messageStartHit = searchLtmKeywordIndex(singleMatchIndex, "we can wait\nHalf a sandwich remains", {
    topK: 10,
  })[0];
  assert.equal(messageStartHit?.chunkId, "everyday-chunk");
  assert.ok(
    (messageStartHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE <= 0.5,
    "a word after a line or message break must not count as a name",
  );
  const adjacentNameHit = searchLtmKeywordIndex(singleMatchIndex, "I met Captain Mira today", { topK: 10 })[0];
  assert.equal(adjacentNameHit?.chunkId, "name-chunk");
  assert.ok(
    (adjacentNameHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE >= 0.75,
    "a name must keep full credit beside another capitalised word",
  );

  // Issue #1264: the BM25 reference is the eight highest-idf query terms present in
  // the index, so padding the query with lower-idf narration does not shrink a
  // matching chunk's normalized score.
  const referenceCorpus = [
    ...Array.from({ length: 200 }, (_, index) => {
      const tokens = ["filler"];
      if (index < 100) for (let term = 1; term <= 8; term += 1) tokens.push(`common${term}`);
      if (index < 190) for (let term = 9; term <= 12; term += 1) tokens.push(`common${term}`);
      return {
        ...chunk(`ref-filler-${String(index).padStart(3, "0")}`, `ref_filler_${index}`),
        text: tokens.join(" "),
      };
    }),
    { ...chunk("ref-match", "ref_match_note"), text: "cobalt" },
  ];
  const referenceIndex = buildLtmBm25Index(referenceCorpus);
  const baseQuery = `cobalt ${Array.from({ length: 8 }, (_, index) => `common${index + 1}`).join(" ")}`;
  const paddedQuery = `${baseQuery} common9 common10 common11 common12`;
  const baseMatch = searchLtmBm25(referenceIndex, baseQuery, { topK: 10 }).find(
    ({ chunkId }: { chunkId: string }) => chunkId === "ref-match",
  );
  const paddedMatch = searchLtmBm25(referenceIndex, paddedQuery, { topK: 10 }).find(
    ({ chunkId }: { chunkId: string }) => chunkId === "ref-match",
  );
  assert.ok(baseMatch, "the matching chunk must be found for the base BM25 query");
  assert.ok(paddedMatch, "the matching chunk must be found for the padded BM25 query");
  assert.ok(baseMatch.normalizedScore > 0.1, "a matching chunk must not normalize to near zero");
  assert.equal(
    paddedMatch.normalizedScore,
    baseMatch.normalizedScore,
    "query padding beyond the eight highest-idf terms must not change the reference",
  );

  // Issue #1264: a late-alphabet in-scope keyword must still fuzzy-match when the
  // scope holds more in-scope keywords than the fuzzy catalog cap.
  const wideKeywords = Array.from({ length: 600 }, (_, index) => {
    const id = `wide-${String(index).padStart(3, "0")}`;
    return { ...chunk(id, `wide_note_${index}`), keywords: [`aaa${String(index).padStart(3, "0")}`] };
  });
  const wideTarget = { ...chunk("wide-target", "wide_target_note"), keywords: ["zzzz cobalt"] };
  assert.ok(
    searchLtmKeywordIndex(buildLtmKeywordIndex([...wideKeywords, wideTarget]), "cobalt", {
      topK: 10,
      allowedChunks: new Set([...wideKeywords.map((entry) => entry.id), wideTarget.id]),
    }).some(({ chunkId }: { chunkId: string }) => chunkId === "wide-target"),
    "a late-alphabet in-scope keyword must survive the fuzzy catalog cap beyond 512 entries",
  );

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
