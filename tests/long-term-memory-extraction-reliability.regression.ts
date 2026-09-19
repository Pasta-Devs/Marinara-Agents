import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { runLongTermMemoryEvidenceUnitExtraction } = await import(`${source}/evidence-unit-extraction.ts`);
  const { sourceHashForLtmSourceNote } = await import(`${source}/source-hash.ts`);
  const root = await mkdtemp(join(tmpdir(), "marinara-ltm-extraction-reliability-"));
  const timestamp = "2026-08-09T00:00:00.000Z";
  const sourceNote = {
    id: "source_extraction_reliability",
    title: "Extraction reliability source",
    type: "source" as const,
    status: "active" as const,
    modes: ["roleplay" as const],
    scope: {},
    tags: ["source_summary"],
    keywords: [],
    links: [],
    provenance: { kind: "chat_summary" as const, sourceId: "chat-a", entryId: "summary-a" },
    sections: { source: { text: "Mara sealed the observatory gate.", updatedAt: timestamp } },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  const sourceHash = sourceHashForLtmSourceNote(sourceNote);
  const validUnit = {
    bucket: "timeline_event",
    subjectId: "observatory_gate_sealed",
    sectionKey: "event",
    text: "Mara sealed the observatory gate.",
    claimKind: "change",
    importance: "major",
    evidence: [`source_note:${sourceNote.id}`],
    confidence: 0.95,
    salience: 0.9,
    status: "active",
    links: [{ target: sourceNote.id, relation: "extracted_from" }],
    sourceHash,
  };
  const validContent = JSON.stringify({ summary: "One durable event.", units: [validUnit] });
  const calls: any[] = [];
  let response: any = { content: validContent, finishReason: "stop" };
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
  const options: any = {
    sourceNote,
    sourceText: sourceNote.sections.source.text,
    existingNotes: [],
    scope: {},
    modes: ["roleplay"],
    sourceHash,
    allowedBuckets: ["timeline_event"],
    mode: "roleplay",
    root,
    operationId: randomUUID(),
    reasoningEffort: "low",
    languageModel: {
      name: "FixtureModel",
      model: "fixture-model",
      maxContext: null,
      maxOutputTokens: null,
      fitContext(messages: any[], fitOptions: any) {
        return {
          messages,
          maxTokens: fitOptions.maxTokens,
          estimatedTokensBefore: 20,
          estimatedTokensAfter: 20,
          trimmed: false,
        };
      },
      async chatComplete(_messages: any[], chatOptions: any) {
        calls.push(chatOptions);
        if (response instanceof Error) throw response;
        return response;
      },
    },
  };
  try {
    for (const testCase of [
      {
        response: { content: "  ", finishReason: "stop" },
        expectedCode: "ltm_model_output_empty",
        message: "empty output must not trigger a repair call",
      },
      {
        response: { content: "{}", finishReason: "stop" },
        expectedCode: "ltm_model_output_unusable",
        message: "unusable output must not trigger a repair call",
      },
      {
        response: { content: "{malformed", finishReason: "stop" },
        expectedCode: "ltm_model_output_unusable",
        message: "malformed output must not trigger a repair call",
      },
      {
        response: {
          content: JSON.stringify({ units: Array.from({ length: 1_000 }, () => validUnit) }),
          finishReason: "stop",
        },
        expectedCode: "ltm_model_output_unusable",
        matchMessage: /maximum is/u,
        message: "oversized output must not trigger a repair call",
      },
      {
        response: { content: '{"summary":"unfinished', finishReason: "length" },
        expectedCode: "ltm_model_output_truncated",
        message: "truncated output must not trigger a repair call",
      },
    ]) {
      calls.length = 0;
      response = testCase.response;
      await assert.rejects(
        () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
        (error: any) =>
          error.code === testCase.expectedCode && (!testCase.matchMessage || testCase.matchMessage.test(error.message)),
      );
      assert.equal(calls.length, 1, testCase.message);
    }

    calls.length = 0;
    response = {
      content: JSON.stringify({ units: [validUnit, null] }),
      finishReason: "stop",
      usage: { promptTokens: 40, completionTokens: 12, completionReasoningTokens: 8, totalTokens: 60 },
    };
    const mixed = await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() });
    assert.equal(calls.length, 1);
    assert.equal(mixed.response.units.length, 1);
    assert.equal(mixed.parserRejections, 1);
    assert.equal(mixed.droppedCandidates.length, 1);

    calls.length = 0;
    response = new Error("400 response_format unsupported");
    let fallbackCalls = 0;
    options.languageModel.chatComplete = async (_messages: any[], chatOptions: any) => {
      calls.push(chatOptions);
      fallbackCalls += 1;
      if (fallbackCalls <= 2) throw new Error("400 response_format unsupported");
      return {
        content: validContent,
        finishReason: "stop",
        usage: { promptTokens: 40, completionTokens: 12, totalTokens: 52 },
      };
    };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      /response_format unsupported/u,
    );
    assert.equal(calls.length, 2, "schema compatibility is the only allowed second call");
    assert.equal("responseFormat" in calls[1], false);

    calls.length = 0;
    fallbackCalls = 0;
    options.reasoningEffort = "low";
    options.languageModel.chatComplete = async (_messages: any[], chatOptions: any) => {
      calls.push(chatOptions);
      fallbackCalls += 1;
      if (fallbackCalls === 1)
        throw Object.assign(new Error("unsupported response_format"), { status: 400, param: "response_format" });
      if (fallbackCalls === 2)
        throw Object.assign(new Error("unsupported reasoning effort"), { status: 400, param: "reasoning_effort" });
      return { content: validContent, finishReason: "stop" };
    };
    const dualFallback = await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() });
    assert.equal(dualFallback.response.units.length, 1);
    assert.equal(calls.length, 3, "response-format and reasoning fallbacks are independently bounded");
    assert.equal("responseFormat" in calls[1], false);
    assert.equal("reasoningEffort" in calls[2], false);

    calls.length = 0;
    options.reasoningEffort = "low";
    options.maxOutputTokens = 200;
    options.languageModel.maxContext = 1_000;
    options.languageModel.fitContext = (messages: any[], _fitOptions: any) => ({
      messages,
      maxTokens: 123,
      estimatedTokensBefore: 950,
      estimatedTokensAfter: 950,
      trimmed: false,
    });
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) =>
        error.code === "ltm_model_output_budget_unviable" &&
        /requested=200/u.test(error.message) &&
        /providerCapped=200/u.test(error.message) &&
        /fitted=123/u.test(error.message),
    );
    assert.equal(calls.length, 0, "unviable fitted budgets fail before the provider call");

    calls.length = 0;
    options.languageModel.maxContext = null;
    options.languageModel.maxOutputTokens = 123;
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) => error.code === "ltm_model_output_budget_unviable" && /fitted=123/u.test(error.message),
    );
    assert.equal(calls.length, 0, "provider-capped budgets fail without max-context metadata");

    calls.length = 0;
    options.maxOutputTokens = null;
    options.languageModel.maxOutputTokens = null;
    options.languageModel.fitContext = (messages: any[], fitOptions: any) => ({
      messages,
      maxTokens: fitOptions.maxTokens,
      estimatedTokensBefore: 20,
      estimatedTokensAfter: 20,
      trimmed: false,
    });
    options.languageModel.chatComplete = async (_messages: any[], _chatOptions: any) => {
      calls.push(_chatOptions);
      throw Object.assign(new Error("schema quota exceeded"), {
        status: 400,
        code: "quota_exceeded",
        param: "response_format",
      });
    };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      /quota exceeded/u,
    );
    assert.equal(calls.length, 1, "permanent quota errors do not trigger compatibility fallback");
    const { processLongTermMemorySource } = await import(`${source}/source-processing.ts`);
    const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
    const { LongTermMemoryDraftStore } = await import(`${source}/draft-store.ts`);
    const commitRoot = await mkdtemp(join(tmpdir(), "marinara-ltm-source-commit-"));
    try {
      const storage = new LongTermMemoryStorage(commitRoot);
      const committedSource = await storage.createNote({
        id: "source_context_commit",
        title: "Context commit source",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-context-commit" },
        sections: { source: { text: "Mara sealed the observatory gate at dusk.", updatedAt: timestamp } },
      });
      const commitUnit = {
        ...validUnit,
        evidence: [`source_note:${committedSource.id}`],
        links: [{ target: committedSource.id, relation: "extracted_from" }],
      };

      // A failed preparation must leave the source note untouched even when a different context is requested.
      options.languageModel.chatComplete = async () => {
        throw new Error("provider down");
      };
      await assert.rejects(() =>
        processLongTermMemorySource({
          sourceNote: committedSource,
          languageModel: options.languageModel,
          scope: { chatId: "chat-b", chatIds: ["chat-b"] },
          modes: ["roleplay"],
          mode: "roleplay",
          extractionMode: "roleplay",
          operationId: randomUUID(),
          root: commitRoot,
        }),
      );
      const untouched = await storage.getNote(committedSource.id);
      assert.deepEqual(untouched?.scope, committedSource.scope, "failed preparation must not rebind source scope");
      assert.equal(Object.hasOwn(untouched ?? {}, "destinationScope"), false);
      assert.equal(untouched?.version, committedSource.version, "failed preparation must not write the source note");

      // A clean batch whose only non-kept unit was deduplicated must still be marked current.
      options.languageModel.chatComplete = async () => ({
        content: JSON.stringify({ summary: "One durable event.", units: [commitUnit, commitUnit] }),
        finishReason: "stop",
      });
      const committed = await processLongTermMemorySource({
        sourceNote: committedSource,
        languageModel: options.languageModel,
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        modes: ["roleplay"],
        mode: "roleplay",
        extractionMode: "roleplay",
        operationId: randomUUID(),
        root: commitRoot,
      });
      assert.equal(committed.outcome.state, "partial_success");
      assert.equal(committed.outcome.droppedUnits, 0);
      assert.ok(committed.accounting.deduplications > 0);
      assert.equal(
        Boolean((await storage.getNote(committedSource.id))?.extractionFingerprint),
        true,
        "clean deduplicated batch must persist the extraction fingerprint",
      );

      // A different requested destination must be bound and committed atomically with the fingerprint.
      const rebound = await processLongTermMemorySource({
        sourceNote: committedSource,
        languageModel: options.languageModel,
        scope: { chatId: "chat-b", chatIds: ["chat-b"] },
        modes: ["roleplay"],
        mode: "roleplay",
        extractionMode: "roleplay",
        operationId: randomUUID(),
        root: commitRoot,
      });
      assert.equal(rebound.outcome.state, "partial_success");
      const reboundNote = await storage.getNote(committedSource.id);
      assert.deepEqual(reboundNote?.destinationScope, { chatId: "chat-b", chatIds: ["chat-b"] });
      assert.deepEqual(reboundNote?.modes, ["roleplay"]);
      assert.equal(reboundNote?.extractionFingerprint?.scope.chatId, "chat-b");

      // A concurrent context change during extraction must be rejected, not silently overwritten.
      options.languageModel.chatComplete = async () => {
        await storage.updateNote(committedSource.id, {
          destinationScope: { chatId: "chat-c", chatIds: ["chat-c"] },
        });
        return {
          content: JSON.stringify({ summary: "One durable event.", units: [commitUnit, commitUnit] }),
          finishReason: "stop",
        };
      };
      await assert.rejects(
        () =>
          processLongTermMemorySource({
            sourceNote: committedSource,
            languageModel: options.languageModel,
            scope: { chatId: "chat-d", chatIds: ["chat-d"] },
            modes: ["roleplay"],
            mode: "roleplay",
            extractionMode: "roleplay",
            operationId: randomUUID(),
            root: commitRoot,
          }),
        (error: any) => error.code === "ltm_source_context_changed",
      );
      const conflicted = await storage.getNote(committedSource.id);
      assert.deepEqual(conflicted?.destinationScope, { chatId: "chat-c", chatIds: ["chat-c"] });
      assert.equal(conflicted?.extractionFingerprint?.scope.chatId, "chat-b");

      // An independent context writer must wait until draft finalization and source persistence finish.
      const lateSource = await storage.createNote({
        id: "source_context_late_commit",
        title: "Late commit source",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-late-commit" },
        sections: { source: { text: "Mara sealed the observatory gate at dusk.", updatedAt: timestamp } },
      });
      const lateUnit = {
        ...validUnit,
        evidence: [`source_note:${lateSource.id}`],
        links: [{ target: lateSource.id, relation: "extracted_from" }],
      };
      const originalCreateDraft = LongTermMemoryDraftStore.prototype.createDraft;
      let releaseWriter!: () => void;
      const writerReady = new Promise<void>((resolve) => {
        releaseWriter = resolve;
      });
      let writerStarted = false;
      let writerFinished = false;
      const writer = (async () => {
        await writerReady;
        writerStarted = true;
        await storage.updateNote(lateSource.id, {
          destinationScope: { chatId: "chat-c", chatIds: ["chat-c"] },
        });
        writerFinished = true;
      })();
      LongTermMemoryDraftStore.prototype.createDraft = async function (input: any) {
        const draft = await originalCreateDraft.call(this, input);
        if (input.source?.sourceNoteId === lateSource.id) {
          releaseWriter();
          await new Promise<void>((resolve) => setImmediate(resolve));
          assert.equal(writerStarted, true);
          assert.equal(writerFinished, false, "concurrent writes must wait for source finalization");
        }
        return draft;
      };
      try {
        options.languageModel.chatComplete = async () => ({
          content: JSON.stringify({ summary: "One durable event.", units: [lateUnit, lateUnit] }),
          finishReason: "stop",
        });
        const result = await processLongTermMemorySource({
          sourceNote: lateSource,
          languageModel: options.languageModel,
          scope: { chatId: "chat-b", chatIds: ["chat-b"] },
          modes: ["roleplay"],
          mode: "roleplay",
          extractionMode: "roleplay",
          operationId: randomUUID(),
          root: commitRoot,
        });
        await writer;
        assert.equal(writerFinished, true);
        const lateConflicted = await storage.getNote(lateSource.id);
        assert.deepEqual(lateConflicted?.destinationScope, { chatId: "chat-c", chatIds: ["chat-c"] });
        assert.equal(lateConflicted?.extractionFingerprint?.scope.chatId, "chat-b");
        const lateDrafts = await new LongTermMemoryDraftStore(commitRoot).listDrafts();
        assert.deepEqual(
          lateDrafts.filter((draft) => draft.source.sourceNoteId === lateSource.id).map((draft) => draft.id),
          [result.draft.id],
        );
      } finally {
        LongTermMemoryDraftStore.prototype.createDraft = originalCreateDraft;
        releaseWriter();
        await writer;
      }
    } finally {
      await rm(commitRoot, { recursive: true, force: true });
    }
  } finally {
    release();
    await rm(root, { recursive: true, force: true });
  }
  process.stdout.write(
    "Long-Term Memory extraction reliability regression: terminal responses, bounded fallback, usage, and candidate isolation ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-extraction-reliability", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
