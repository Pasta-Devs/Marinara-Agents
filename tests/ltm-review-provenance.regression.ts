import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { prepareLongTermMemorySource, processLongTermMemorySource } = await import(`${source}/source-processing.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
  const root = await mkdtemp(join(tmpdir(), "marinara-ltm-review-provenance-"));
  const storage = new LongTermMemoryStorage(root);
  const timestamp = "2026-09-19T00:00:00.000Z";
  const release = configurePackageRuntime({
    isDebugAgentsEnabled: () => false,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    dataDir: root,
    resources: {
      listCharacters: async () => [],
      listPersonas: async () => [],
      listLorebooks: async () => [],
    },
    persistence: {
      getChat: async () => null,
      listChats: async () => [],
      updateChatMetadata: async () => {},
    },
  });
  const languageModel = {
    name: "FixtureModel",
    model: "fixture-model",
    maxContext: null,
    maxOutputTokens: null,
    fitContext(messages: unknown[], options: { maxTokens: number }) {
      return {
        messages,
        maxTokens: options.maxTokens,
        estimatedTokensBefore: 20,
        estimatedTokensAfter: 20,
        trimmed: false,
      };
    },
    async chatComplete() {
      return { content: JSON.stringify({ summary: "No new durable memory.", units: [] }), finishReason: "stop" };
    },
  };
  try {
    for (const kind of ["character", "lorebook", "chat_summary"] as const) {
      const sourceNote = await storage.createNote({
        id: `source_${kind}`,
        title: `${kind} source`,
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: {},
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind, sourceId: `${kind}-source` },
        sections: { source: { text: "A bounded source note.", updatedAt: timestamp } },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      });
      const prepared = await prepareLongTermMemorySource({
        sourceNote,
        languageModel,
        operationId: randomUUID(),
        root,
      });
      assert.equal(prepared.reviewRequired, true, `${kind} provenance must require review`);
      const committed = await processLongTermMemorySource({
        sourceNote,
        languageModel,
        operationId: randomUUID(),
        root,
        applyLowRisk: true,
      });
      assert.equal(
        committed.draft.reviewRequired,
        true,
        `${kind} provenance must remain review-gated after finalization`,
      );
    }

    const guardedSource = await storage.createNote({
      id: "source_commit_guard",
      title: "commit guard source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: {},
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: { kind: "chat_summary", sourceId: "guard-summary" },
      sections: { source: { text: "A source whose review provenance is exposed at commit.", updatedAt: timestamp } },
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    });
    const guardedPrepared = await prepareLongTermMemorySource({
      sourceNote: guardedSource,
      languageModel: null,
      directGameMode: true,
      directSourceText: "## world_fact\nweather: cloudy",
      mode: "game",
      operationId: randomUUID(),
      root,
    });
    assert.equal(guardedPrepared.reviewRequired, false, "deterministic preparation is not itself review-gated");
    const guardedCommitted = await processLongTermMemorySource({
      sourceNote: guardedSource,
      languageModel: null,
      directGameMode: true,
      directSourceText: "## world_fact\nweather: cloudy",
      mode: "game",
      operationId: randomUUID(),
      root,
      applyLowRisk: true,
    });
    assert.equal(
      guardedCommitted.draft.reviewRequired,
      true,
      "commit must recompute review from review-required provenance",
    );
    assert.ok(guardedCommitted.draft.mutations.length > 0, "commit guard must have a real mutation to protect");
    assert.deepEqual(
      guardedCommitted.appliedMutationIds,
      [],
      "review-required provenance must prevent low-risk auto-apply even when preparation was false",
    );
  } finally {
    release();
    await rm(root, { recursive: true, force: true });
  }
}

export const completion = runRegressionToCompletion("ltm-review-provenance", main);
void completion.catch((error) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
