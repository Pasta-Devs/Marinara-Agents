import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(
  process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"),
);
const packageSharedRoot = join(
  repoRoot,
  "packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory",
);
const packageServerRoot = join(
  repoRoot,
  "packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory",
);
const engineSharedRoot = join(
  engineRoot,
  "packages/shared/src/features/agents/long-term-memory",
);
const engineServerRoot = join(
  engineRoot,
  "packages/server/src/services/long-term-memory",
);

type Fixture = {
  version: number;
  query: string;
  scope: { chatId: string; chatIds: string[] };
  notes: unknown[];
};

async function importModule<T>(root: string, name: string): Promise<T> {
  return import(pathToFileURL(join(root, `${name}.ts`)).href) as Promise<T>;
}

async function paired<T>(name: string, shared = false) {
  const packageRoot = shared ? packageSharedRoot : packageServerRoot;
  const sourceRoot = shared ? engineSharedRoot : engineServerRoot;
  return Promise.all([
    importModule<T>(packageRoot, name),
    importModule<T>(sourceRoot, name),
  ]);
}

async function main() {
  const fixture = JSON.parse(
    await readFile(
      join(repoRoot, "tests/fixtures/long-term-memory-source-parity.v1.json"),
      "utf8",
    ),
  ) as Fixture;
  assert.equal(fixture.version, 1);

  const [packageSchema, engineSchema] = await paired<any>("schema", true);
  const packageNotes = fixture.notes.map((note) =>
    packageSchema.ltmNoteSchema.parse(note),
  );
  const engineNotes = fixture.notes.map((note) =>
    engineSchema.ltmNoteSchema.parse(note),
  );
  assert.deepEqual(
    packageNotes,
    engineNotes,
    "LTM note schema parsing diverged",
  );
  assert.deepEqual(
    packageSchema.DEFAULT_LTM_GLOBAL_SETTINGS,
    engineSchema.DEFAULT_LTM_GLOBAL_SETTINGS,
    "global defaults diverged",
  );
  assert.deepEqual(
    packageSchema.ltmRetrievalConfigSchema.parse({}),
    engineSchema.ltmRetrievalConfigSchema.parse({}),
    "retrieval schema defaults diverged",
  );

  const [packageRuntime, engineRuntime] = await paired<any>(
    "runtime-settings",
    true,
  );
  const recallInput = {
    chatMode: "roleplay",
    chatMetadata: {
      longTermMemoryRecallStyle: "exact",
      longTermMemoryMaxChunks: 7,
    },
    globalSettings: packageSchema.DEFAULT_LTM_GLOBAL_SETTINGS,
  };
  assert.deepEqual(
    packageRuntime.resolveLongTermMemoryRecallSettings(recallInput),
    engineRuntime.resolveLongTermMemoryRecallSettings({
      ...recallInput,
      globalSettings: engineSchema.DEFAULT_LTM_GLOBAL_SETTINGS,
    }),
    "recall setting resolution diverged",
  );

  const [packageDefaults, engineDefaults] = await paired<any>("default-config");
  assert.deepEqual(
    packageDefaults.DEFAULT_LTM_POLICIES,
    engineDefaults.DEFAULT_LTM_POLICIES,
  );
  assert.deepEqual(
    packageDefaults.DEFAULT_LTM_RETRIEVAL_CONFIG,
    engineDefaults.DEFAULT_LTM_RETRIEVAL_CONFIG,
  );
  assert.deepEqual(
    packageDefaults.DEFAULT_LTM_RETENTION_CONFIG,
    engineDefaults.DEFAULT_LTM_RETENTION_CONFIG,
  );

  const [packageChunking, engineChunking] = await paired<any>("chunking");
  const packageChunks = packageChunking.chunkNotes(packageNotes);
  const engineChunks = engineChunking.chunkNotes(engineNotes);
  assert.deepEqual(packageChunks, engineChunks, "chunk generation diverged");

  const [packageBm25, engineBm25] = await paired<any>("bm25");
  const packageBm25Index = packageBm25.buildLtmBm25Index(packageChunks);
  const engineBm25Index = engineBm25.buildLtmBm25Index(engineChunks);
  assert.deepEqual(
    packageBm25Index,
    engineBm25Index,
    "BM25 index generation diverged",
  );
  const packageLexical = packageBm25.searchLtmBm25(
    packageBm25Index,
    fixture.query,
  );
  const engineLexical = engineBm25.searchLtmBm25(
    engineBm25Index,
    fixture.query,
  );
  assert.deepEqual(packageLexical, engineLexical, "BM25 retrieval diverged");

  const [packageKeyword, engineKeyword] = await paired<any>("keyword-index");
  const packageKeywordIndex =
    packageKeyword.buildLtmKeywordIndex(packageChunks);
  const engineKeywordIndex = engineKeyword.buildLtmKeywordIndex(engineChunks);
  assert.deepEqual(
    packageKeywordIndex,
    engineKeywordIndex,
    "keyword index generation diverged",
  );
  const packageKeywordHits = packageKeyword.searchLtmKeywordIndex(
    packageKeywordIndex,
    fixture.query,
  );
  const engineKeywordHits = engineKeyword.searchLtmKeywordIndex(
    engineKeywordIndex,
    fixture.query,
  );
  assert.deepEqual(
    packageKeywordHits,
    engineKeywordHits,
    "keyword retrieval diverged",
  );

  const [packageMetadata, engineMetadata] = await paired<any>("metadata-index");
  const packageMetadataIndex =
    packageMetadata.buildLtmMetadataIndex(packageChunks);
  const engineMetadataIndex =
    engineMetadata.buildLtmMetadataIndex(engineChunks);
  assert.deepEqual(
    packageMetadataIndex,
    engineMetadataIndex,
    "metadata index generation diverged",
  );
  assert.deepEqual(
    packageMetadata.getLtmMetadataMatches(packageMetadataIndex, {
      scope: fixture.scope,
      tags: ["archive"],
    }),
    engineMetadata.getLtmMetadataMatches(engineMetadataIndex, {
      scope: fixture.scope,
      tags: ["archive"],
    }),
    "metadata retrieval diverged",
  );

  const [packageGraph, engineGraph] = await paired<any>("graph");
  const packageGraphIndex = packageGraph.buildLtmGraphIndex(
    packageNotes,
    packageChunks,
  );
  const engineGraphIndex = engineGraph.buildLtmGraphIndex(
    engineNotes,
    engineChunks,
  );
  assert.deepEqual(
    packageGraphIndex,
    engineGraphIndex,
    "graph index generation diverged",
  );
  assert.deepEqual(
    packageGraph.expandLtmGraph(packageGraphIndex, ["world_cobalt_archive"]),
    engineGraph.expandLtmGraph(engineGraphIndex, ["world_cobalt_archive"]),
    "graph retrieval diverged",
  );

  const lanes = [
    {
      name: "lexical",
      weight: 1,
      items: packageLexical.map((hit: any) => ({
        chunkId: hit.chunkId,
        rawScore: hit.score,
        reason: "lexical",
      })),
    },
    {
      name: "keyword",
      weight: 0.5,
      items: packageKeywordHits.map((hit: any) => ({
        chunkId: hit.chunkId,
        rawScore: hit.score,
        reason: "keyword",
      })),
    },
  ];
  const [packageRanking, engineRanking] = await paired<any>("ranking");
  const packageRanked = packageRanking.reciprocalRankFuse(lanes);
  const engineRanked = engineRanking.reciprocalRankFuse(lanes);
  assert.deepEqual(packageRanked, engineRanked, "rank fusion diverged");

  const [packageBudget, engineBudget] = await paired<any>("budget");
  const budgetOptions = {
    maxChunks: 3,
    maxTokens: 256,
    explain: true,
    dedupeExactText: true,
  };
  assert.deepEqual(
    packageBudget.applyLtmBudget(
      packageRanked,
      new Map(packageChunks.map((chunk: any) => [chunk.id, chunk])),
      budgetOptions,
    ),
    engineBudget.applyLtmBudget(
      engineRanked,
      new Map(engineChunks.map((chunk: any) => [chunk.id, chunk])),
      budgetOptions,
    ),
    "retrieval budgeting diverged",
  );

  process.stdout.write(
    `Long-Term Memory source parity: ${packageNotes.length} notes, ${packageChunks.length} chunks, ${packageRanked.length} ranked candidates\n`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
