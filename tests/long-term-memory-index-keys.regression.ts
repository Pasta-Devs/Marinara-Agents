import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";
import type { LtmBudgetedChunk } from "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/recall/budget.ts";
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
  const { buildLtmBm25Index, ltmHangulNameSyllables, searchLtmBm25 } = await import(`${source}/recall/bm25.ts`);
  const { buildLtmKeywordIndex, LTM_KEYWORD_MAX_SCORE, LTM_SINGLE_KEYWORD_BM25_AGREEMENT, searchLtmKeywordIndex } =
    await import(`${source}/recall/keyword-index.ts`);
  const { buildStopWordSet, normalizeKeywordTerms } = await import(`${source}/recall/keyword-extract.ts`);
  const { buildLtmMetadataIndex, getLtmMetadataMatches } = await import(`${source}/recall/metadata-index.ts`);
  const { parseLtmRecallIndex } = await import(`${source}/recall/rebuild.ts`);
  const { readLongTermMemoryUsage, recordLongTermMemoryInjection } = await import(`${source}/recall/usage.ts`);

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

  // Issue #1467: whole-token containment is a string scan now, not a regex per call.
  // It must keep the regex's edges: letters and digits (astral-plane ones too)
  // continue a token, while spaces, apostrophes and hyphens end one.
  const fuzzyMatches = (keywords: string[], query: string) =>
    searchLtmKeywordIndex(buildLtmKeywordIndex([{ ...chunk("edge-chunk", "edge_note"), keywords }]), query, {
      topK: 10,
    }).some(({ chunkId }: { chunkId: string }) => chunkId === "edge-chunk");
  for (const [keywords, query, expected, reason] of [
    [["bring ring"], "ring", true, "a whole occurrence after one inside a word must still match"],
    [["agent47"], "agent", false, "a digit must continue the token"],
    [["o'brien"], "brien", true, "an apostrophe must end a token"],
    [["Cobalt-Moon"], "cobalt", true, "a hyphenated keyword must match its parts"],
    [["東京都 新宿区"], "東京都", true, "a CJK word must match as a whole token"],
    [["東京都庁舎"], "東京都", false, "a CJK word must not match inside a longer one"],
    [["𐌰𐌱𐌲𐌳"], "𐌱𐌲𐌳", false, "an astral-plane letter before the match must continue the token"],
    [["𐌰𐌱 𐌲𐌳𐌴"], "𐌲𐌳𐌴", true, "astral-plane letters must match as a whole token"],
  ] as Array<[string[], string, boolean, string]>) {
    assert.equal(fuzzyMatches(keywords, query), expected, `${keywords[0]} / ${query}: ${reason}`);
  }
  // A persisted key may keep a raw hyphen, and an empty one must not hang the scan.
  const rawKeyIndex = buildLtmKeywordIndex([{ ...chunk("raw-key-chunk", "raw_key_note"), keywords: ["cobalt"] }]);
  rawKeyIndex.byKeyword["moon-cobalt"] = ["raw-hyphen-chunk"];
  rawKeyIndex.byKeyword[""] = ["empty-key-chunk"];
  assert.deepEqual(
    searchLtmKeywordIndex(rawKeyIndex, "moon cobalt", { topK: 10 })
      .map(({ chunkId }: { chunkId: string }) => chunkId)
      .sort(),
    ["raw-hyphen-chunk", "raw-key-chunk"],
    "a raw hyphen must end a token, and an empty persisted key must match nothing",
  );

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

  const { reciprocalRankFuse } = await import(`${source}/recall/ranking.ts`);
  const { LTM_LINKED_RECALL_MIN_RELEVANCE, LTM_RECALL_STYLE_WEIGHTS } =
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
  assert.deepEqual(
    unboundedRaw.map(({ fusedRank }: { fusedRank: number }) => fusedRank),
    [1, 2],
    "fused candidates expose their one-based rank before budget ordering",
  );

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
  // while each preset's strongest lane carries the rescaled 0.7 ceiling. A single
  // ordinary keyword is now capped at half the lane, so only two distinct keywords
  // (or a name) clear the default threshold.
  const { DEFAULT_LTM_GLOBAL_SETTINGS } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");
  for (const [style, weights] of Object.entries(LTM_RECALL_STYLE_WEIGHTS)) {
    assert.equal(
      Math.max(...Object.values(weights)),
      0.7,
      `${style}: the strongest lane must carry the rescaled ceiling`,
    );
  }
  // A linked memory skips the threshold but must still nearly match the chat itself.
  assert.ok(
    LTM_LINKED_RECALL_MIN_RELEVANCE > 0 &&
      LTM_LINKED_RECALL_MIN_RELEVANCE < DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryScoreThreshold,
    "the linked recall floor must sit above 0 and below the default threshold",
  );
  // Issue #1362: linked recall also follows a caused_by link between two events and a
  // thread paid_off_in link to its event, from either end, and nothing wider.
  const { findLtmLinkedNotes } = await import(`${source}/recall/graph.ts`);
  const linkTypes: Record<string, string> = {
    timeline_effect: "timeline_event",
    timeline_cause: "timeline_event",
    timeline_payoff: "timeline_event",
    thread_open: "thread",
    world_lore: "world",
  };
  const linkedFrom = (seed: string, links: Array<[string, string, string]>) => {
    const nodes: Record<string, { chunkIds: string[]; outgoing: any[]; incoming: any[] }> = {};
    for (const id of Object.keys(linkTypes)) nodes[id] = { chunkIds: [], outgoing: [], incoming: [] };
    for (const [from, relation, to] of links) {
      const edge = { source: from, target: to, relation };
      nodes[from]!.outgoing.push(edge);
      nodes[to]!.incoming.push(edge);
    }
    return findLtmLinkedNotes({ version: 1, nodes }, [seed], (id: string) => linkTypes[id]).map(
      (link: { noteId: string }) => link.noteId,
    );
  };
  const causedBy: Array<[string, string, string]> = [["timeline_effect", "caused_by", "timeline_cause"]];
  assert.deepEqual(linkedFrom("timeline_effect", causedBy), ["timeline_cause"]);
  assert.deepEqual(linkedFrom("timeline_cause", causedBy), ["timeline_effect"]);
  const paidOff: Array<[string, string, string]> = [["thread_open", "paid_off_in", "timeline_payoff"]];
  assert.deepEqual(linkedFrom("thread_open", paidOff), ["timeline_payoff"]);
  assert.deepEqual(linkedFrom("timeline_payoff", paidOff), ["thread_open"]);
  for (const links of [
    [["timeline_effect", "triggered_by", "timeline_cause"]],
    [["timeline_effect", "planted_in", "timeline_cause"]],
    [["timeline_effect", "involves", "timeline_cause"]],
    [["world_lore", "paid_off_in", "timeline_payoff"]],
    [["world_lore", "caused_by", "timeline_cause"]],
    [["thread_open", "paid_off_in", "world_lore"]],
  ] as Array<Array<[string, string, string]>>) {
    for (const seed of Object.keys(linkTypes)) {
      assert.deepEqual(
        linkedFrom(seed, links),
        [],
        `${links[0]![1]} ${links[0]![0]} -> ${links[0]![2]} must stay unfollowed from ${seed}`,
      );
    }
  }
  for (const [style, weights] of Object.entries(LTM_RECALL_STYLE_WEIGHTS)) {
    assert.ok(
      weights.keywordWeight * (3 / LTM_KEYWORD_MAX_SCORE) >= DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryScoreThreshold,
      `${style}: two distinct keywords must clear the default threshold`,
    );
  }
  // Issue #1465: in every style a capped single keyword stays under the default
  // threshold, and one lifted by BM25 agreement clears it.
  for (const [style, weights] of Object.entries(LTM_RECALL_STYLE_WEIGHTS)) {
    const threshold = DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryScoreThreshold;
    assert.ok(weights.keywordWeight * 0.5 < threshold, `${style}: a capped single keyword must stay under`);
    assert.ok(weights.keywordWeight * 0.75 >= threshold, `${style}: a lifted single keyword must clear`);
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
  const sentenceStartHit = searchLtmKeywordIndex(singleMatchIndex, "   Mira arrived", { topK: 10 })[0];
  assert.equal(sentenceStartHit?.chunkId, "name-chunk");
  assert.ok(
    (sentenceStartHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE <= 0.5,
    "capitalisation at sentence start after leading spaces must not count as a name",
  );
  const sentenceBoundaryHit = searchLtmKeywordIndex(singleMatchIndex, "We waited.   Mira arrived", { topK: 10 })[0];
  assert.equal(sentenceBoundaryHit?.chunkId, "name-chunk");
  assert.ok(
    (sentenceBoundaryHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE <= 0.5,
    "capitalisation after sentence punctuation and spaces must not count as a name",
  );
  const nameHit = searchLtmKeywordIndex(singleMatchIndex, "Meet   Mira at the bar", { topK: 10 })[0];
  assert.equal(nameHit?.chunkId, "name-chunk");
  assert.ok(
    (nameHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE >= 0.75,
    "a name used mid-sentence must keep full credit on a single keyword",
  );
  const pairHit = searchLtmKeywordIndex(singleMatchIndex, "tomas cobalt arrive", { topK: 10 })[0];
  assert.equal(pairHit?.chunkId, "pair-chunk");
  assert.ok((pairHit?.score ?? 0) / LTM_KEYWORD_MAX_SCORE >= 0.75, "two distinct keywords must keep full credit");
  const messageStartHit = searchLtmKeywordIndex(singleMatchIndex, "we can wait\n   Half a sandwich remains", {
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

  // Issue #1465: a single keyword the cap would cut is already rare in scope, so
  // BM25 agreement at the gate lifts it to three quarters of the lane. Everyday
  // words, names and two-keyword hits score as they did without the BM25 scores.
  const agreementIndex = buildLtmKeywordIndex([
    { ...chunk("violin-chunk", "violin_note"), keywords: ["violin"] },
    ...Array.from({ length: 10 }, (_, index) => ({
      ...chunk(`door-chunk-${index}`, `door_note_${index}`),
      keywords: ["door"],
    })),
    { ...chunk("name-chunk", "name_note"), keywords: ["mira"] },
    { ...chunk("pair-chunk", "pair_note"), keywords: ["tomas", "cobalt"] },
  ]);
  const agreementCredit = (query: string, chunkId: string, lexicalScore?: number) =>
    (searchLtmKeywordIndex(agreementIndex, query, {
      topK: 20,
      lexicalScores:
        lexicalScore === undefined
          ? undefined
          : new Map(Object.keys(agreementIndex.byChunkId).map((id) => [id, lexicalScore])),
    }).find((hit: { chunkId: string }) => hit.chunkId === chunkId)?.score ?? 0) / LTM_KEYWORD_MAX_SCORE;
  assert.equal(LTM_SINGLE_KEYWORD_BM25_AGREEMENT, 0.2);
  assert.equal(
    agreementCredit("She tuned the violin", "violin-chunk", 0.25),
    0.75,
    "one distinctive keyword with BM25 agreement must score three quarters",
  );
  assert.equal(
    agreementCredit("She tuned the violin", "violin-chunk", LTM_SINGLE_KEYWORD_BM25_AGREEMENT),
    0.75,
    "BM25 agreement must count from the gate itself",
  );
  for (const lexicalScore of [0.15, undefined]) {
    assert.ok(
      agreementCredit("She tuned the violin", "violin-chunk", lexicalScore) <= 0.5,
      `one distinctive keyword must stay capped with BM25 score ${lexicalScore ?? "missing"}`,
    );
  }
  const everydayCredit = agreementCredit("Shut the door", "door-chunk-0");
  assert.ok(everydayCredit > 0 && everydayCredit < 0.5, "an everyday keyword must sit under the cap");
  assert.equal(
    agreementCredit("Shut the door", "door-chunk-0", 0.9),
    everydayCredit,
    "a keyword the cap does not cut must not be lifted, even with high BM25 agreement",
  );
  for (const [query, chunkId] of [
    ["Meet   Mira at the bar", "name-chunk"],
    ["tomas cobalt arrive", "pair-chunk"],
  ]) {
    assert.equal(
      agreementCredit(query!, chunkId!, 0.9),
      agreementCredit(query!, chunkId!),
      `${chunkId}: names and two-keyword hits must not change with BM25 scores`,
    );
  }

  // Issue #1363: a known character name keeps full credit on a single keyword where
  // capitalisation cannot show it: sentence start, lowercase, or a caseless script.
  const knownNameIndex = buildLtmKeywordIndex([
    { ...chunk("everyday-chunk", "everyday_note"), keywords: ["half"] },
    { ...chunk("name-chunk", "name_note"), keywords: ["mira"] },
    { ...chunk("korean-name-chunk", "korean_name_note"), keywords: ["서래"] },
  ]);
  const knownNames = new Set(["mira", "서래"]);
  const keywordCredit = (query: string, names?: ReadonlySet<string>) =>
    (searchLtmKeywordIndex(knownNameIndex, query, { topK: 10, knownNames: names })[0]?.score ?? 0) /
    LTM_KEYWORD_MAX_SCORE;
  for (const query of ["Mira walked in.", "i told mira already", "Then Mira walked in.", "서래가 왔다"]) {
    assert.ok(keywordCredit(query) > 0, `${query}: the name chunk must still match`);
    if (!/^Then/.test(query)) {
      assert.ok(keywordCredit(query) <= 0.5, `${query}: without a known name this stays capped`);
    }
    assert.ok(keywordCredit(query, knownNames) >= 0.75, `${query}: a known name must keep full credit`);
  }
  assert.ok(
    keywordCredit("There's half a sandwich left", knownNames) <= 0.5,
    "a known name set must not lift an ordinary single keyword",
  );

  // Issue #1363: retrieval builds the known names from allowed character chunks only.
  {
    const lookupRoot = await mkdtemp(join(tmpdir(), "marinara-ltm-known-names-"));
    try {
      const { retrieveLongTermMemory } = await import(`${source}/recall/retrieval.ts`);
      const { buildLtmGraphIndex } = await import(`${source}/recall/graph.ts`);
      const recallChunks = [
        { ...chunk("half-world", "half_world"), title: "Half", keywords: ["half"], text: "a world note" },
        {
          ...chunk("mira-character", "mira_character"),
          title: "Mira",
          noteType: "character" as const,
          keywords: ["mira"],
          text: "a character note",
        },
        {
          ...chunk("half-character-elsewhere", "half_character_elsewhere"),
          title: "Half",
          noteType: "character" as const,
          keywords: ["half"],
          scope: { chatIds: ["other-chat"] },
          text: "a character note not in scope",
        },
        {
          ...chunk("seo-character", "seo_character"),
          title: "서래",
          noteType: "character" as const,
          keywords: ["서래"],
          text: "a character note",
        },
        {
          ...chunk("rin-character", "rin_character"),
          title: "린",
          noteType: "character" as const,
          keywords: ["린"],
          text: "a character note",
        },
        { ...chunk("rin-laugh", "rin_laugh"), keywords: [], text: "린이 웃었다" },
      ];
      const recallIndex = {
        version: 1 as const,
        generatedAt: "2026-08-14T00:00:00.000Z",
        sourceHash: "0".repeat(64),
        metadata: buildLtmMetadataIndex(recallChunks),
        bm25: buildLtmBm25Index(recallChunks),
        graph: buildLtmGraphIndex([], recallChunks),
        keywords: buildLtmKeywordIndex(recallChunks),
        embeddings: {
          version: 1 as const,
          model: "unavailable",
          dimension: null,
          embeddedChunkCount: 0,
          chunks: [],
          byChunkId: {},
        },
      };
      const recallScore = async (queryText: string, chunkId: string) =>
        (
          await retrieveLongTermMemory({
            root: lookupRoot,
            index: recallIndex,
            embeddingAdapter: null,
            queryText,
            mode: "roleplay",
            scope: { chatId: "chat-a", chatIds: ["chat-a"] },
            semanticWeight: 0,
            lexicalWeight: 0,
            graphWeight: 0,
            keywordWeight: 1,
            maxChunks: 5,
            maxTokens: 4096,
          })
        ).chunks.find((entry: { chunk: { id: string } }) => entry.chunk.id === chunkId)?.relevanceScore ?? 0;
      const midSentence = await recallScore("Then Mira walked in.", "mira-character");
      assert.ok(midSentence > 0, "the character chunk must be recalled for a mid-sentence name");
      assert.equal(await recallScore("Mira walked in.", "mira-character"), midSentence);
      assert.equal(await recallScore("i told mira already", "mira-character"), midSentence);
      const koreanScore = await recallScore("서래가 왔다", "seo-character");
      assert.ok(koreanScore >= midSentence, "a Korean character name must keep full credit");
      // "Half" titles a world note here and a character note outside the chat, so
      // neither the noteType filter nor the allowed filter may make it a known name.
      assert.ok(
        (await recallScore("There's half a sandwich left", "half-world")) < midSentence,
        "an ordinary single keyword must stay below a known name",
      );
      // Issue #1438 wiring: retrieval passes the character names to BM25, so a one-syllable
      // name with a different particle still reaches the memory through the bm25 lane.
      const rinRecall = await retrieveLongTermMemory({
        root: lookupRoot,
        index: recallIndex,
        embeddingAdapter: null,
        queryText: "린은 뭐 했지?",
        mode: "roleplay",
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        semanticWeight: 0,
        lexicalWeight: 1,
        graphWeight: 0,
        keywordWeight: 0,
        maxChunks: 5,
        maxTokens: 4096,
      });
      assert.deepEqual(
        rinRecall.chunks.find((entry: { chunk: { id: string } }) => entry.chunk.id === "rin-laugh")?.lanes,
        ["bm25"],
        "린은 must recall 린이 웃었다 through the bm25 lane",
      );
      // Issue #1467: with the keyword lane off, the keyword search must not run at
      // all, and the selection must match the same recall over the real keyword index.
      const unreadKeywords = {
        version: 1 as const,
        get byKeyword(): Record<string, string[]> {
          throw new Error("the keyword index must not be read when the keyword weight is 0");
        },
        byChunkId: recallIndex.keywords.byChunkId,
      };
      const skippedRecall = await retrieveLongTermMemory({
        root: lookupRoot,
        index: { ...recallIndex, keywords: unreadKeywords },
        embeddingAdapter: null,
        queryText: "린은 뭐 했지?",
        mode: "roleplay",
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        semanticWeight: 0,
        lexicalWeight: 1,
        graphWeight: 0,
        keywordWeight: 0,
        maxChunks: 5,
        maxTokens: 4096,
      });
      const selection = (recall: typeof rinRecall) =>
        recall.chunks.map((entry: { chunk: { id: string }; relevanceScore: number; lanes: string[] }) => [
          entry.chunk.id,
          entry.relevanceScore,
          entry.lanes.join(","),
        ]);
      assert.ok(
        skippedRecall.chunks.every((entry: { lanes: string[] }) => !entry.lanes.includes("keyword")),
        "a keyword weight of 0 must leave the keyword lane out",
      );
      assert.deepEqual(
        selection(skippedRecall),
        selection(rinRecall),
        "skipping the keyword search must not change the selection",
      );

      // Issue #1465 wiring: retrieval passes its BM25 scores to the keyword search,
      // so a memory sharing one distinctive word that BM25 agrees with is recalled
      // in the balanced style, while an everyday word stays out.
      const violinChunks = [
        {
          ...chunk("violin-smashed", "violin_smashed"),
          keywords: ["violin", "storm"],
          text: "Elena's violin was smashed in the storm; she hasn't played since.",
        },
        {
          ...chunk("violin-shop", "violin_shop"),
          keywords: ["violin", "station"],
          text: "A violin shop opened by the station.",
        },
        {
          ...chunk("cellar-door", "cellar_door"),
          keywords: ["door", "cellar"],
          text: "The cellar door sticks when it's wet.",
        },
        ...Array.from({ length: 12 }, (_, index) => ({
          ...chunk(`door-${index}`, `door_${index}`),
          keywords: ["door", `room${index}`],
          text: `The door of room ${index} creaks open.`,
        })),
      ];
      const violinIndex = {
        ...recallIndex,
        metadata: buildLtmMetadataIndex(violinChunks),
        bm25: buildLtmBm25Index(violinChunks),
        graph: buildLtmGraphIndex([], violinChunks),
        keywords: buildLtmKeywordIndex(violinChunks),
      };
      const violinRecall = async (keywordWeight: number) =>
        (
          await retrieveLongTermMemory({
            root: lookupRoot,
            index: violinIndex,
            embeddingAdapter: null,
            queryText: "Want to hear me play the violin? Shut the door first.",
            mode: "roleplay",
            ...LTM_RECALL_STYLE_WEIGHTS.balanced,
            keywordWeight,
            minScore: DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryScoreThreshold,
            maxChunks: 12,
            maxTokens: 4096,
          })
        ).chunks.map((entry: { chunk: { id: string } }) => entry.chunk.id);
      const balancedRecall = await violinRecall(LTM_RECALL_STYLE_WEIGHTS.balanced.keywordWeight);
      assert.ok(
        balancedRecall.includes("violin-smashed"),
        "one distinctive shared keyword with BM25 agreement must clear the default threshold",
      );
      assert.ok(
        !(await violinRecall(0)).includes("violin-smashed"),
        "BM25 alone must stay under the threshold, so the keyword lane is what recalls it",
      );
      assert.ok(
        balancedRecall.every((id: string) => id.startsWith("violin-")),
        "an everyday shared keyword must stay under the default threshold",
      );
    } finally {
      await rm(lookupRoot, { recursive: true, force: true });
    }
  }

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

  const rareTerms = Array.from({ length: 8 }, (_, index) => `rare${index}`);
  const commonText = Array.from({ length: 400 }, (_, index) => `common${index}`).join(" ");
  const commonOnlyIndex = buildLtmBm25Index([
    { ...chunk("common-only", "common_only"), text: commonText },
    ...Array.from({ length: 18 }, (_, index) => ({
      ...chunk(`common-filler-${index}`, `common_filler_${index}`),
      text: commonText,
    })),
    { ...chunk("rare-only", "rare_only"), text: rareTerms.join(" ") },
  ]);
  const commonOnlyHit = searchLtmBm25(
    commonOnlyIndex,
    [...rareTerms, ...Array.from({ length: 400 }, (_, index) => `common${index}`)].join(" "),
    {
      topK: 30,
    },
  ).find(({ chunkId }: { chunkId: string }) => chunkId === "common-only");
  assert.ok(
    !commonOnlyHit || commonOnlyHit.normalizedScore < 1,
    "terms excluded from the top-eight reference must not saturate the score",
  );

  // A memory whose only match is a ninth-ranked query term must still score; the
  // reference bounds the normalization, not which memories can be credited.
  const ninthTermIndex = buildLtmBm25Index([
    { ...chunk("rare-only", "rare_only_note"), text: rareTerms.join(" ") },
    ...Array.from({ length: 5 }, (_, index) => ({ ...chunk(`lantern-${index}`, `lantern_${index}`), text: "lantern" })),
    ...Array.from({ length: 4 }, (_, index) => ({ ...chunk(`other-${index}`, `other_${index}`), text: "harbour" })),
  ]);
  const ninthTermHit = searchLtmBm25(ninthTermIndex, [...rareTerms, "lantern"].join(" "), { topK: 10 }).find(
    ({ chunkId }: { chunkId: string }) => chunkId === "lantern-0",
  );
  assert.ok(
    ninthTermHit && ninthTermHit.normalizedScore > 0,
    "a memory matching only terms outside the eight-term reference must still score",
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
    assertOwnKeys(usage.acceptedReceipts ?? {}, "usage must retain reserved accounting IDs");
    // #1404: nothing reads per-memory counters, so injections no longer write them.
    assert.deepEqual(usage.chats, {}, "usage must not keep per-memory counters");
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  // Issue #1295: Korean recall. Short Hangul nouns must survive normalization,
  // particles must fold, and a spacing-only compound difference must still match.
  {
    for (const keyword of ["반지", "약속", "비밀", "서래", "무진", "선물", "동쪽 다리"]) {
      assert.ok(normalizeKeywordTerms(keyword).length > 0, `Korean keyword ${keyword} must remain searchable`);
    }

    const koreanKeywordChunk = { ...chunk("korean-keyword-chunk", "korean_keyword_note"), keywords: ["반지", "선물"] };
    const koreanKeywordIndex = buildLtmKeywordIndex([koreanKeywordChunk]);
    assert.deepEqual(
      searchLtmKeywordIndex(koreanKeywordIndex, "반지를", { topK: 10 }).map(
        ({ chunkId }: { chunkId: string }) => chunkId,
      ),
      ["korean-keyword-chunk"],
      "a Korean particle query must match the stored noun keyword",
    );

    const koreanChunks = [
      { ...chunk("korean-particle", "korean_particle_note"), text: "무진에게 반지를 선물", keywords: ["반지"] },
      { ...chunk("korean-spacing", "korean_spacing_note"), text: "그림선물", keywords: ["그림선물"] },
      { ...chunk("korean-other", "korean_other_note"), text: "시장에서 과일을 샀다", keywords: ["시장"] },
    ];
    const koreanBm25 = buildLtmBm25Index(koreanChunks);
    const bm25Hit = (query: string) =>
      searchLtmBm25(koreanBm25, query, { topK: 10 }).map(({ chunkId }: { chunkId: string }) => chunkId);

    assert.ok(
      bm25Hit("반지").includes("korean-particle"),
      "a bare-noun query must match a stored memory written with the particle form",
    );
    assert.ok(
      bm25Hit("그림 선물").includes("korean-spacing"),
      "a spaced query must match a space-less Korean compound",
    );
    assert.equal(
      bm25Hit("반지를").includes("korean-other"),
      false,
      "an unrelated Korean memory must not match a particle query",
    );

    // Issue #1438: a one-syllable character name folds with one allowed particle, but
    // only when a character note carries that name.
    const rinMemories = [
      { ...chunk("rin-laugh", "rin_laugh_note"), text: "린이 웃었다" },
      { ...chunk("rin-ring", "rin_ring_note"), text: "린에게 반지를 줬다" },
      { ...chunk("rin-call", "rin_call_note"), text: "린, 괜찮아?" },
      { ...chunk("rin-other", "rin_other_note"), text: "나는 시장에 갔다" },
    ];
    const rinProfile = { ...chunk("rin-profile", "char_rin"), noteType: "character" as const, title: "린" };
    const withName = buildLtmBm25Index([rinProfile, ...rinMemories]);
    const withoutName = buildLtmBm25Index(rinMemories);
    const rinHit = (index: ReturnType<typeof buildLtmBm25Index>, names: Set<string>, query: string) =>
      searchLtmBm25(index, query, { topK: 10, nameSyllables: names }).map(
        ({ chunkId }: { chunkId: string }) => chunkId,
      );
    const names = ltmHangulNameSyllables([rinProfile, ...rinMemories]);
    for (const query of ["린은 뭐 했지?", "린을", "린"]) {
      assert.deepEqual(
        rinHit(withName, names, query).sort(),
        ["rin-call", "rin-laugh", "rin-ring"],
        `${query} must find every memory written with the one-syllable name`,
      );
    }
    assert.deepEqual(
      rinHit(withName, names, "린는"),
      [],
      "a particle the name's final consonant forbids must not fold",
    );
    assert.deepEqual(rinHit(withName, names, "나를"), [], "a one-syllable word that is not a name must not fold");
    assert.deepEqual(
      rinHit(withoutName, ltmHangulNameSyllables(rinMemories), "린은 뭐 했지?"),
      [],
      "without a character note the one-syllable word must not fold",
    );
    for (const { id } of rinMemories) {
      assert.equal(
        withName.documents[id]!.length,
        withoutName.documents[id]!.length,
        "a name alias must not change BM25 document length",
      );
    }
    const bareName = buildLtmBm25Index([{ ...rinProfile, text: "린" }]);
    assert.deepEqual(
      rinHit(bareName, names, "린"),
      ["rin-profile"],
      "an index of bare names alone must still be searchable",
    );
  }

  // Issue #1295 (review): Hangul aliases must not inflate BM25 document length.
  // An English-only score must match an alias-free corpus of the same shape, and
  // a Hangul chunk's length must count only its written tokens.
  {
    const english = { ...chunk("mixed-en", "mixed_en_note"), text: "the silver ring glimmers" };
    const aliasHeavy = { ...chunk("mixed-ko", "mixed_ko_note"), text: "무진에게 반지를 선물" };
    const aliasFree = { ...chunk("mixed-plain", "mixed_plain_note"), text: "alpha beta gamma" };

    const withKorean = buildLtmBm25Index([english, aliasHeavy]);
    const withoutKorean = buildLtmBm25Index([english, aliasFree]);
    assert.equal(
      withKorean.documents["mixed-ko"]!.length,
      3,
      "a Hangul chunk's BM25 length must count only its written tokens, not aliases",
    );

    const ids = (index: ReturnType<typeof buildLtmBm25Index>) =>
      searchLtmBm25(index, "ring glimmers", { topK: 5 }).map(({ chunkId }: { chunkId: string }) => chunkId);
    const score = (index: ReturnType<typeof buildLtmBm25Index>) =>
      searchLtmBm25(index, "ring glimmers", { topK: 5 }).find(
        ({ chunkId }: { chunkId: string }) => chunkId === "mixed-en",
      )?.score;
    assert.deepEqual(ids(withKorean), ids(withoutKorean), "English ordering must not change when Hangul aliases exist");
    assert.equal(score(withKorean), score(withoutKorean), "English score must not be skewed by Hangul aliases");
  }

  console.info("Long-Term Memory reserved-key regressions passed.");
}

runRegressionToCompletion("long-term-memory-index-keys", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
