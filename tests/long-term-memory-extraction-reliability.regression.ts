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
  const { readLtmDebugLog } = await import(`${source}/debug-log.ts`);
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
    for (const usage of [
      undefined,
      { promptTokens: 40, completionTokens: 12, completionReasoningTokens: 8, totalTokens: 60 },
      { promptTokens: 40 },
      { promptTokens: 0, completionTokens: 0 },
    ]) {
      calls.length = 0;
      response = { content: validContent, finishReason: "stop", usage };
      const operationId = randomUUID();
      await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId });
      assert.equal(calls.length, 1, "debug accounting must not change provider calls");
      const events = await readLtmDebugLog({ operationId }, root);
      const request = events.find((event) => event.action === "evidence_unit_request")!;
      const result = events.find((event) => event.action === "evidence_unit_response")!;
      assert.ok(request.counts!.estimatedPromptTokens > 0, "request usage must be explicitly estimated");
      assert.equal(request.counts!.promptTokens, undefined);
      assert.deepEqual(result.counts, { responseChars: validContent.length, ...usage });
    }

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
        response: { content: '{"summary":"unfinished', finishReason: "length" },
        expectedCode: "ltm_model_output_truncated",
        message: "truncated output must not trigger a repair call",
      },
      {
        response: { content: '{"summary":"unfinished', finishReason: "max_tokens" },
        expectedCode: "ltm_model_output_truncated",
        message: "max_tokens finish reason without recoverable units must fail explicitly",
      },
      {
        response: { content: '{"summary":"unfinished', finishReason: "token_limit" },
        expectedCode: "ltm_model_output_truncated",
        message: "token_limit finish reason without recoverable units must fail explicitly",
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
      content: JSON.stringify({ units: Array.from({ length: 1_000 }, () => validUnit) }),
      finishReason: "stop",
    };
    const overflowRun = await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() });
    assert.equal(calls.length, 1, "oversized output must not trigger a repair call");
    assert.equal(overflowRun.totalCandidates, 1_000);
    assert.equal(overflowRun.response.units.length, 999);
    assert.equal(overflowRun.parserRejections, 1);
    assert.equal(overflowRun.droppedCandidates.length, 1);
    assert.equal(overflowRun.droppedCandidates[0]?.reason, "candidate_overflow");

    for (const finishReason of ["length", "max_tokens", "token_limit"]) {
      calls.length = 0;
      const truncatedPayloadContent =
        '{"summary":"Text contains a fake \\\"units\\\":[{\\\"subjectId\\\":\\\"fake\\\"}] array","units":[' +
        JSON.stringify(validUnit) +
        ',{"bucket":"timeline_event","subjectId":"partial_event","sectionKey":"event","text":"Mara was interrup';
      response = { content: truncatedPayloadContent, finishReason };
      const operationId = randomUUID();
      const recoveredRun = await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId });
      assert.equal(calls.length, 1);
      assert.equal(recoveredRun.response.incomplete, true);
      assert.equal(recoveredRun.response.units.length, 1);
      assert.equal(recoveredRun.response.units[0]?.subjectId, "observatory_gate_sealed");
      const events = await readLtmDebugLog({ operationId }, root);
      const result = events.find((event) => event.action === "evidence_unit_response")!;
      assert.equal(result.status, "warning", "recovered truncation must remain visible in debug reporting");
      assert.equal(result.details!.finishReason, finishReason);
    }

    calls.length = 0;
    const slimUnit = {
      bucket: "timeline_event",
      subjectId: "observatory_gate_sealed",
      sectionKey: "event",
      text: "Mara sealed the observatory gate.",
      claimKind: "change",
      importance: "major",
      confidence: 0.95,
      salience: 0.9,
      status: "active",
      links: [{ target: sourceNote.id, relation: "extracted_from" }],
    };
    response = {
      content: JSON.stringify({ summary: "Slim unit.", units: [slimUnit] }),
      finishReason: "stop",
    };
    const slimRun = await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() });
    assert.equal(calls.length, 1);
    assert.equal(slimRun.response.units.length, 1);
    assert.equal(Boolean(slimRun.response.units[0]?.id), true);
    assert.equal(slimRun.response.units[0]?.sourceHash, sourceHash);
    assert.deepEqual(slimRun.response.units[0]?.evidence, [`source_note:${sourceNote.id}`]);

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
    options.languageModel.chatComplete = async (_messages: any[], chatOptions: any) => {
      calls.push(chatOptions);
      throw Object.assign(new Error("provider rejected request"), { status: 400, code: "invalid_schema" });
    };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      /provider rejected request/u,
    );
    assert.equal(calls.length, 1, "invalid_schema must not trigger a response-format fallback");

    calls.length = 0;
    options.languageModel.chatComplete = async (_messages: any[], chatOptions: any) => {
      calls.push(chatOptions);
      throw Object.assign(new Error("provider rejected request"), { status: 400, code: "reasoning_effort_limit" });
    };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      /provider rejected request/u,
    );
    assert.equal(calls.length, 1, "reasoning_effort_limit must not trigger a reasoning fallback");

    calls.length = 0;
    options.reasoningEffort = "low";
    options.maxOutputTokens = 200;
    options.languageModel.maxContext = 1_000;
    options.languageModel.maxOutputTokens = 150;
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
        /providerCapped=150/u.test(error.message) &&
        /fitted=123/u.test(error.message),
    );
    assert.equal(calls.length, 0, "unviable fitted budgets fail before the provider call");

    calls.length = 0;
    options.languageModel.maxContext = null;
    options.languageModel.maxOutputTokens = 123;
    const cappedOperationId = randomUUID();
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: cappedOperationId }),
      (error: any) =>
        error.code === "ltm_model_output_budget_unviable" &&
        /requested=200/u.test(error.message) &&
        /providerCapped=123/u.test(error.message) &&
        /fitted=123/u.test(error.message),
    );
    assert.equal(calls.length, 0, "provider-capped budgets fail without max-context metadata");
    const cappedEvents = await readLtmDebugLog({ operationId: cappedOperationId }, root);
    const preflight = cappedEvents.find((event) => event.action === "evidence_unit_context_preflight");
    assert.ok(preflight, "missing context metadata must not suppress the preflight failure event");
    assert.equal(preflight.status, "error");
    assert.equal(preflight.counts!.estimatedPromptTokens, undefined);

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
    const { processLongTermMemorySource, processLongTermMemorySourceBatch } = await import(
      `${source}/source-processing.ts`
    );
    const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
    const { LongTermMemoryDraftStore } = await import(`${source}/draft-store.ts`);
    const { withLtmVaultLock } = await import(`${source}/vault-lock.ts`);
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

      const failedBatch = await processLongTermMemorySourceBatch({
        items: [
          {
            sourceId: committedSource.id,
            title: committedSource.title!,
            note: committedSource,
            created: false,
            extractionMode: "roleplay",
          },
        ],
        operationId: randomUUID(),
        signal: new AbortController().signal,
        concurrency: 1,
        root: commitRoot,
      });
      assert.equal(failedBatch[0]?.extractionStatus, "failed");
      assert.equal(failedBatch[0]?.error?.code, "ltm_model_configuration");
      assert.equal(failedBatch[0]?.retryable, false);

      const providerFailureCases = [
        { status: 429, code: "insufficient_quota", retryable: false },
        { code: "quota_exceeded", retryable: false },
        { status: 429, code: "rate_limit_exceeded", retryable: true },
      ];
      for (const failureCase of providerFailureCases) {
        options.languageModel.chatComplete = async () => {
          throw Object.assign(new Error(failureCase.code), failureCase);
        };
        const providerFailure = await processLongTermMemorySourceBatch({
          items: [
            {
              sourceId: committedSource.id,
              title: committedSource.title!,
              note: committedSource,
              created: false,
              extractionMode: "roleplay",
            },
          ],
          languageModel: options.languageModel,
          operationId: randomUUID(),
          signal: new AbortController().signal,
          concurrency: 1,
          root: commitRoot,
        });
        assert.equal(providerFailure[0]?.error?.code, failureCase.code);
        assert.equal(providerFailure[0]?.retryable, failureCase.retryable);
      }

      const deterministicSource = await storage.createNote({
        id: "source_deterministic_batch",
        title: "Deterministic batch source",
        type: "source",
        status: "active",
        modes: ["game"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-deterministic-batch" },
        sections: { source: { text: "## world_fact\nVault: The moon vault is sealed.", updatedAt: timestamp } },
      });
      const filteredTarget = await storage.createNote({
        id: "world_deterministic_target",
        title: "Moon vault",
        type: "world",
        status: "active",
        modes: ["game"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: [],
        links: [],
        sections: { facts: { text: "The moon vault was opened.", updatedAt: timestamp } },
      });
      const excludedTarget = await storage.createNote({
        id: "world_deterministic_excluded",
        title: "Excluded moon vault",
        type: "world",
        status: "active",
        modes: ["game"],
        scope: { chatId: "chat-b", chatIds: ["chat-b"] },
        tags: [],
        keywords: [],
        links: [],
        sections: { facts: { text: "The moon vault is sealed.", updatedAt: timestamp } },
      });
      const deterministicSecondSource = await storage.createNote({
        id: "source_deterministic_batch_second",
        title: "Second deterministic source",
        type: "source",
        status: "active",
        modes: ["game"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-deterministic-batch-second" },
        sections: { source: { text: "## world_fact\nVault: The moon vault is sealed.", updatedAt: timestamp } },
      });
      const originalListNotes = LongTermMemoryStorage.prototype.listNotes;
      let listNotesCalls = 0;
      LongTermMemoryStorage.prototype.listNotes = async function (...args: any[]) {
        listNotesCalls += 1;
        return originalListNotes.apply(this, args);
      };
      try {
        const deterministicBatch = await processLongTermMemorySourceBatch({
          items: [
            {
              sourceId: deterministicSource.id,
              title: deterministicSource.title!,
              note: deterministicSource,
              created: false,
              extractionMode: "game",
              deterministicSourceText: "## world_fact\nVault: The moon vault is sealed.",
            },
            {
              sourceId: "source_deterministic_batch_second",
              title: "Second deterministic source",
              note: deterministicSecondSource,
              created: true,
              extractionMode: "game",
              deterministicSourceText: "## world_fact\nVault: The moon vault is sealed.",
            },
          ],
          languageModel: options.languageModel,
          operationId: randomUUID(),
          signal: new AbortController().signal,
          concurrency: 2,
          root: commitRoot,
          directGameMode: true,
        });
        assert.deepEqual(
          deterministicBatch.map((result) => result.extractionStatus),
          ["succeeded", "succeeded"],
        );
        assert.equal(
          listNotesCalls,
          2,
          "deterministic batches must use one preparation snapshot plus one rebuild scan",
        );
        assert.equal(deterministicBatch[0]?.outcome.droppedUnits, 0);
        assert.equal(deterministicBatch[1]?.outcome.droppedUnits, 0);
        assert.ok(deterministicBatch[0]?.draft?.mutations.length);
        assert.equal(filteredTarget.id, "world_deterministic_target");
        assert.equal(JSON.stringify(deterministicBatch[0]?.draft).includes(excludedTarget.id), false);
      } finally {
        LongTermMemoryStorage.prototype.listNotes = originalListNotes;
      }

      // Issue #1087: preparation for every item finishes before any commit, so a sibling
      // source's create is invisible to the pre-batch index and only exists as a batch-overlay
      // projection. Commit-time reconciliation must reuse that target instead of creating a
      // duplicate note under a second id.
      const batchSourceAlpha = await storage.createNote({
        id: "source_batch_reconcile_alpha",
        title: "Cobalt archive alpha",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-batch-alpha" },
        sections: {
          source: {
            text: "The cobalt archive alpha ledger records the observatory vault survey.",
            updatedAt: timestamp,
          },
        },
      });
      const batchSourceBeta = await storage.createNote({
        id: "source_batch_reconcile_beta",
        title: "Cobalt archive beta",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-batch-beta" },
        sections: {
          source: {
            text: "The cobalt archive beta ledger records the observatory vault survey.",
            updatedAt: timestamp,
          },
        },
      });
      const worldUnitFor = (note: any, subjectId: string, text: string) => ({
        bucket: "world_fact",
        subjectId,
        sectionKey: "facts",
        title: "Cobalt Archive",
        text,
        claimKind: "static",
        importance: "major",
        evidence: [`source_note:${note.id}`],
        confidence: 0.95,
        salience: 0.8,
        status: "active",
        links: [{ target: note.id, relation: "extracted_from" }],
        sourceHash: sourceHashForLtmSourceNote(note),
      });
      const alphaUnit = worldUnitFor(
        batchSourceAlpha,
        "cobalt_archive_alpha",
        "The cobalt archive alpha ledger records the observatory vault survey.",
      );
      const betaUnit = worldUnitFor(
        batchSourceBeta,
        "cobalt_archive_beta",
        "The cobalt archive beta ledger records the observatory vault survey.",
      );
      options.languageModel.chatComplete = async (messages: any[], chatOptions: any) => {
        calls.push(chatOptions);
        const unit = JSON.stringify(messages).includes("alpha ledger") ? alphaUnit : betaUnit;
        return { content: JSON.stringify({ summary: "Cobalt archive fact.", units: [unit] }), finishReason: "stop" };
      };
      const siblingBatch = await processLongTermMemorySourceBatch({
        items: [
          {
            sourceId: batchSourceAlpha.id,
            title: batchSourceAlpha.title!,
            note: batchSourceAlpha,
            created: false,
            extractionMode: "roleplay",
          },
          {
            sourceId: batchSourceBeta.id,
            title: batchSourceBeta.title!,
            note: batchSourceBeta,
            created: false,
            extractionMode: "roleplay",
          },
        ],
        languageModel: options.languageModel,
        operationId: randomUUID(),
        signal: new AbortController().signal,
        concurrency: 2,
        root: commitRoot,
      });
      assert.deepEqual(
        siblingBatch.map((result: any) => result.extractionStatus),
        ["succeeded", "succeeded"],
        JSON.stringify(siblingBatch.map((result: any) => result.error)),
      );
      const createdNoteIds = (result: any) =>
        (result.draft?.mutations ?? [])
          .filter((mutation: any) => mutation.kind === "create_note")
          .map((mutation: any) => mutation.note.id);
      assert.deepEqual(
        createdNoteIds(siblingBatch[0]),
        ["world_cobalt_archive_alpha"],
        "the first source creates its derived target",
      );
      assert.deepEqual(
        createdNoteIds(siblingBatch[1]),
        ["world_cobalt_archive_alpha"],
        "a sibling source in the same batch must reuse the first source's target instead of creating a duplicate",
      );

      // Issue #1087 concurrent case: a compatible note committed after the preparation index
      // snapshot (here, during the provider call) must still be reused at commit instead of a
      // second note being created. The batch overlay does not cover this note, so only the fresh
      // commit-time vault scan can see it.
      const freshnessSource = await storage.createNote({
        id: "source_commit_freshness",
        title: "Cobalt archive freshness",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-commit-freshness" },
        sections: {
          source: {
            text: "The cobalt archive gamma ledger records the observatory vault survey.",
            updatedAt: timestamp,
          },
        },
      });
      const gammaUnit = worldUnitFor(
        freshnessSource,
        "cobalt_archive_gamma",
        "The cobalt archive gamma ledger records the observatory vault survey.",
      );
      options.languageModel.chatComplete = async (_messages: any[], chatOptions: any) => {
        calls.push(chatOptions);
        // Loaded after the preparation index snapshot (which happens before the provider call),
        // so only the commit-time fresh scan can observe it.
        await storage.createNote({
          id: "world_cobalt_archive_delta",
          title: "Cobalt Archive",
          type: "world",
          status: "active",
          modes: ["roleplay"],
          scope: { chatId: "chat-a", chatIds: ["chat-a"] },
          tags: [],
          keywords: [],
          links: [],
          sections: {
            facts: { text: "The cobalt archive delta ledger records the vault survey.", updatedAt: timestamp },
          },
        });
        return {
          content: JSON.stringify({ summary: "Cobalt archive fact.", units: [gammaUnit] }),
          finishReason: "stop",
        };
      };
      const committedDuringPreparation = await processLongTermMemorySource({
        sourceNote: freshnessSource,
        languageModel: options.languageModel,
        mode: "roleplay",
        modes: ["roleplay"],
        extractionMode: "roleplay",
        operationId: randomUUID(),
        root: commitRoot,
      });
      const mutationTargetNoteIds = (result: any) =>
        (result.draft?.mutations ?? []).map((mutation: any) =>
          mutation.kind === "create_note" ? mutation.note.id : mutation.noteId,
        );
      assert.deepEqual(
        [...new Set(mutationTargetNoteIds(committedDuringPreparation))],
        ["world_cobalt_archive_delta"],
        "a note committed after the preparation snapshot must be reused instead of duplicated",
      );

      // Issue #1087 archived case: the commit-time candidate set must keep retrieval's active-only
      // view. An archived compatible memory is not a recall target, so the source creates a fresh
      // active note instead of reviving and mutating the archived one.
      const archivedSource = await storage.createNote({
        id: "source_commit_archived",
        title: "Archived commit source",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-commit-archived" },
        sections: {
          source: {
            text: "The obsidian archive epsilon ledger records the sealed vault survey.",
            updatedAt: timestamp,
          },
        },
      });
      const archivedTarget = await storage.createNote({
        id: "world_obsidian_vault_sealed",
        title: "Obsidian Archive",
        type: "world",
        status: "archived",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: [],
        links: [],
        sections: {
          facts: {
            text: "The obsidian archive epsilon ledger records the earlier vault survey.",
            updatedAt: timestamp,
          },
        },
      });
      const archivedUnit = {
        ...worldUnitFor(
          archivedSource,
          "obsidian_archive_epsilon",
          "The obsidian archive epsilon ledger records the sealed vault survey.",
        ),
        title: "Obsidian Archive",
      };
      options.languageModel.chatComplete = async () => ({
        content: JSON.stringify({ summary: "Obsidian archive fact.", units: [archivedUnit] }),
        finishReason: "stop",
      });
      const archivedCommit = await processLongTermMemorySource({
        sourceNote: archivedSource,
        languageModel: options.languageModel,
        mode: "roleplay",
        modes: ["roleplay"],
        extractionMode: "roleplay",
        operationId: randomUUID(),
        root: commitRoot,
      });
      assert.deepEqual(
        [...new Set(mutationTargetNoteIds(archivedCommit))],
        ["world_obsidian_archive_epsilon"],
        "an archived compatible memory must not be reused by commit-time reconciliation",
      );
      assert.equal(
        (await storage.getNote(archivedTarget.id))?.status,
        "archived",
        "commit-time reconciliation must not mutate an archived memory",
      );

      // Issue #1087 duplicate-candidate case: once a sibling target is both durable and still in the
      // batch overlay, the two representations must merge to one candidate. Counting them twice
      // turned a valid reuse into a spurious ambiguity, so the second source duplicated the note.
      await storage.createNote({
        id: "world_basalt_archive_alpha",
        title: "Basalt Archive",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: [],
        links: [],
        sections: {
          facts: { text: "The basalt archive alpha ledger records the previous vault survey.", updatedAt: timestamp },
        },
      });
      const overlaySourceAlpha = await storage.createNote({
        id: "source_batch_overlay_alpha",
        title: "Basalt overlay alpha",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-batch-overlay-alpha" },
        sections: {
          source: {
            text: "The basalt archive alpha ledger records the sealed vault survey.",
            updatedAt: timestamp,
          },
        },
      });
      const overlaySourceBeta = await storage.createNote({
        id: "source_batch_overlay_beta",
        title: "Basalt overlay beta",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-batch-overlay-beta" },
        sections: {
          source: {
            text: "The basalt archive beta ledger records the sealed vault survey.",
            updatedAt: timestamp,
          },
        },
      });
      const basaltAlphaUnit = {
        ...worldUnitFor(
          overlaySourceAlpha,
          "basalt_archive_alpha",
          "The basalt archive alpha ledger records the sealed vault survey.",
        ),
        title: "Basalt Archive",
      };
      const basaltBetaUnit = {
        ...worldUnitFor(
          overlaySourceBeta,
          "basalt_archive_beta",
          "The basalt archive beta ledger records the sealed vault survey.",
        ),
        title: "Basalt Archive",
      };
      options.languageModel.chatComplete = async (messages: any[], chatOptions: any) => {
        calls.push(chatOptions);
        const unit = JSON.stringify(messages).includes("alpha ledger") ? basaltAlphaUnit : basaltBetaUnit;
        return { content: JSON.stringify({ summary: "Basalt archive fact.", units: [unit] }), finishReason: "stop" };
      };
      const overlayBatch = await processLongTermMemorySourceBatch({
        items: [
          {
            sourceId: overlaySourceAlpha.id,
            title: overlaySourceAlpha.title!,
            note: overlaySourceAlpha,
            created: false,
            extractionMode: "roleplay",
          },
          {
            sourceId: overlaySourceBeta.id,
            title: overlaySourceBeta.title!,
            note: overlaySourceBeta,
            created: false,
            extractionMode: "roleplay",
          },
        ],
        languageModel: options.languageModel,
        operationId: randomUUID(),
        signal: new AbortController().signal,
        concurrency: 2,
        root: commitRoot,
      });
      assert.deepEqual(
        overlayBatch.map((result: any) => result.extractionStatus),
        ["succeeded", "succeeded"],
        JSON.stringify(overlayBatch.map((result: any) => result.error)),
      );
      assert.deepEqual(
        [...new Set(mutationTargetNoteIds(overlayBatch[1]))],
        ["world_basalt_archive_alpha"],
        "a durable target also present in the batch overlay must reconcile as one candidate",
      );
      assert.equal(
        (overlayBatch[1] as any)?.diagnostics?.some(
          (diagnostic: any) => diagnostic.code === "candidate_reconciliation_ambiguous",
        ),
        false,
        "the duplicate durable/overlay candidate must not read as ambiguous",
      );

      // Issue #1087 terminal-overlay case: once the durable target is archived (or resolved) after a
      // batch item projected it while active, the stale active overlay copy must not revive it as a
      // reconciliation candidate. The terminal durable state wins, so the second source creates a
      // fresh memory instead of mutating an archived note.
      const graniteSourceAlpha = await storage.createNote({
        id: "source_granite_batch_alpha",
        title: "Granite overlay alpha",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-granite-alpha" },
        sections: {
          source: { text: "The granite archive alpha ledger records the sealed vault survey.", updatedAt: timestamp },
        },
      });
      const graniteSourceBeta = await storage.createNote({
        id: "source_granite_batch_beta",
        title: "Granite overlay beta",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-granite-beta" },
        sections: {
          source: { text: "The granite archive beta ledger records the sealed vault survey.", updatedAt: timestamp },
        },
      });
      const graniteTarget = await storage.createNote({
        id: "world_granite_archive_alpha",
        title: "Granite Archive",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: [],
        links: [],
        sections: {
          facts: { text: "The granite archive alpha ledger records the previous vault survey.", updatedAt: timestamp },
        },
      });
      const graniteAlphaUnit = {
        ...worldUnitFor(
          graniteSourceAlpha,
          "granite_archive_alpha",
          "The granite archive alpha ledger records the sealed vault survey.",
        ),
        title: "Granite Archive",
      };
      const graniteBetaUnit = {
        ...worldUnitFor(
          graniteSourceBeta,
          "granite_archive_beta",
          "The granite archive beta ledger records the flooded vault survey.",
        ),
        title: "Granite Archive",
      };
      options.languageModel.chatComplete = async (messages: any[], chatOptions: any) => {
        calls.push(chatOptions);
        const unit = JSON.stringify(messages).includes("alpha ledger") ? graniteAlphaUnit : graniteBetaUnit;
        return { content: JSON.stringify({ summary: "Granite archive fact.", units: [unit] }), finishReason: "stop" };
      };
      // Archive the durable target after the first item's projection but before the second item commits,
      // leaving the batch overlay holding a stale active copy of it.
      const originalCreateDraftForOverlayStatus = LongTermMemoryDraftStore.prototype.createDraft;
      let graniteTargetArchived = false;
      LongTermMemoryDraftStore.prototype.createDraft = async function (input: any) {
        const draft = await originalCreateDraftForOverlayStatus.call(this, input);
        if (!graniteTargetArchived && input.source?.sourceNoteId === graniteSourceAlpha.id) {
          graniteTargetArchived = true;
          await storage.updateNote(graniteTarget.id, { status: "archived" });
        }
        return draft;
      };
      try {
        const graniteBatch = await processLongTermMemorySourceBatch({
          items: [
            {
              sourceId: graniteSourceAlpha.id,
              title: graniteSourceAlpha.title!,
              note: graniteSourceAlpha,
              created: false,
              extractionMode: "roleplay",
            },
            {
              sourceId: graniteSourceBeta.id,
              title: graniteSourceBeta.title!,
              note: graniteSourceBeta,
              created: false,
              extractionMode: "roleplay",
            },
          ],
          languageModel: options.languageModel,
          operationId: randomUUID(),
          signal: new AbortController().signal,
          concurrency: 2,
          root: commitRoot,
        });
        assert.deepEqual(
          graniteBatch.map((result: any) => result.extractionStatus),
          ["succeeded", "succeeded"],
          JSON.stringify(graniteBatch.map((result: any) => result.error)),
        );
        assert.equal(graniteTargetArchived, true, "the durable target must be archived between item commits");
        assert.deepEqual(
          [...new Set(mutationTargetNoteIds(graniteBatch[1]))],
          ["world_granite_archive_beta"],
          "a terminal durable target must not be revived by a stale active batch overlay",
        );
        assert.equal(
          (graniteBatch[1] as any)?.diagnostics?.some(
            (diagnostic: any) => diagnostic.code === "candidate_reconciliation_ambiguous",
          ),
          false,
          "the terminal durable target must be filtered, not read as ambiguous",
        );
        assert.equal(
          (await storage.getNote(graniteTarget.id))?.status,
          "archived",
          "commit-time reconciliation must not revive an archived memory",
        );
      } finally {
        LongTermMemoryDraftStore.prototype.createDraft = originalCreateDraftForOverlayStatus;
      }

      // Issue #1087 lock-scope case: the ordered commit loop must hold one vault lock across items
      // so an independent writer cannot land between commits and make the shared batch overlay
      // stale. An external task that acquires the vault lock outside the batch's async context
      // must therefore wait for the whole loop, not for the gap between items.
      const lockScopeSourceAlpha = await storage.createNote({
        id: "source_lock_scope_alpha",
        title: "Lock scope alpha",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-lock-scope-alpha" },
        sections: {
          source: { text: "The lock scope alpha ledger records the sealed vault survey.", updatedAt: timestamp },
        },
      });
      const lockScopeSourceBeta = await storage.createNote({
        id: "source_lock_scope_beta",
        title: "Lock scope beta",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-lock-scope-beta" },
        sections: {
          source: { text: "The lock scope beta ledger records the sealed vault survey.", updatedAt: timestamp },
        },
      });
      const lockScopeAlphaUnit = worldUnitFor(
        lockScopeSourceAlpha,
        "lock_scope_alpha",
        "The lock scope alpha ledger records the sealed vault survey.",
      );
      const lockScopeBetaUnit = worldUnitFor(
        lockScopeSourceBeta,
        "lock_scope_beta",
        "The lock scope beta ledger records the sealed vault survey.",
      );
      options.languageModel.chatComplete = async (messages: any[], chatOptions: any) => {
        calls.push(chatOptions);
        const unit = JSON.stringify(messages).includes("alpha ledger") ? lockScopeAlphaUnit : lockScopeBetaUnit;
        return { content: JSON.stringify({ summary: "Lock scope fact.", units: [unit] }), finishReason: "stop" };
      };
      const lockOrder: string[] = [];
      let signalExternal!: () => void;
      const externalGate = new Promise<void>((resolve) => {
        signalExternal = resolve;
      });
      // Started outside the batch's async context, so its continuation keeps an unheld lock scope
      // and genuinely contends for the vault lock instead of re-entering the batch's held one.
      const externalLockWriter = (async () => {
        await externalGate;
        await withLtmVaultLock(storage.root, async () => {
          lockOrder.push("external-writer");
        });
      })();
      const originalCreateDraftForLockScope = LongTermMemoryDraftStore.prototype.createDraft;
      LongTermMemoryDraftStore.prototype.createDraft = async function (input: any) {
        const draft = await originalCreateDraftForLockScope.call(this, input);
        if (input.source?.sourceNoteId === lockScopeSourceAlpha.id) {
          signalExternal();
          // Let the external task reach the lock while this item's commit still holds it.
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
        if (input.source?.sourceNoteId === lockScopeSourceBeta.id) lockOrder.push("item-two-commit");
        return draft;
      };
      try {
        const lockScopeBatch = await processLongTermMemorySourceBatch({
          items: [
            {
              sourceId: lockScopeSourceAlpha.id,
              title: lockScopeSourceAlpha.title!,
              note: lockScopeSourceAlpha,
              created: false,
              extractionMode: "roleplay",
            },
            {
              sourceId: lockScopeSourceBeta.id,
              title: lockScopeSourceBeta.title!,
              note: lockScopeSourceBeta,
              created: false,
              extractionMode: "roleplay",
            },
          ],
          languageModel: options.languageModel,
          operationId: randomUUID(),
          signal: new AbortController().signal,
          concurrency: 2,
          root: commitRoot,
        });
        await externalLockWriter;
        assert.deepEqual(
          lockScopeBatch.map((result: any) => result.extractionStatus),
          ["succeeded", "succeeded"],
          JSON.stringify(lockScopeBatch.map((result: any) => result.error)),
        );
        assert.deepEqual(
          lockOrder,
          ["item-two-commit", "external-writer"],
          "the ordered commit loop must hold one vault lock across items",
        );
      } finally {
        LongTermMemoryDraftStore.prototype.createDraft = originalCreateDraftForLockScope;
      }

      const originalListNotesForFailure = LongTermMemoryStorage.prototype.listNotes;
      let snapshotFailureArmed = false;
      LongTermMemoryStorage.prototype.listNotes = async function () {
        if (snapshotFailureArmed) throw new Error("snapshot unavailable");
        return originalListNotesForFailure.call(this);
      };
      try {
        options.languageModel.chatComplete = async () => {
          snapshotFailureArmed = true;
          return { content: validContent, finishReason: "stop" };
        };
        const snapshotFailureBatch = await processLongTermMemorySourceBatch({
          items: [
            {
              sourceId: committedSource.id,
              title: committedSource.title!,
              note: committedSource,
              created: false,
              extractionMode: "roleplay",
            },
            {
              sourceId: deterministicSource.id,
              title: deterministicSource.title!,
              note: deterministicSource,
              created: false,
              extractionMode: "game",
              deterministicSourceText: "## world_fact\nVault: The moon vault is sealed.",
            },
          ],
          languageModel: options.languageModel,
          operationId: randomUUID(),
          signal: new AbortController().signal,
          concurrency: 1,
          root: commitRoot,
          directGameMode: true,
        });
        assert.equal(snapshotFailureBatch[0]?.extractionStatus, "succeeded", JSON.stringify(snapshotFailureBatch[0]));
        assert.equal(snapshotFailureBatch[1]?.extractionStatus, "failed");
        assert.equal(snapshotFailureBatch[1]?.error?.code, "extract_failed");
      } finally {
        LongTermMemoryStorage.prototype.listNotes = originalListNotesForFailure;
      }

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

        // A truncated recovery must create a partial draft but never mark the source note current.
        const truncSource = await storage.createNote({
          id: "source_context_trunc_commit",
          title: "Truncated commit source",
          type: "source",
          status: "active",
          modes: ["roleplay"],
          scope: { chatId: "chat-a", chatIds: ["chat-a"] },
          tags: ["source_summary"],
          keywords: [],
          links: [],
          provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-trunc-commit" },
          sections: { source: { text: "Mara sealed the observatory gate at dusk.", updatedAt: timestamp } },
        });
        const truncUnit = {
          ...validUnit,
          evidence: [`source_note:${truncSource.id}`],
          links: [{ target: truncSource.id, relation: "extracted_from" }],
        };
        options.languageModel.chatComplete = async () => ({
          content:
            '{"summary":"Recovered partially.","units":[' +
            JSON.stringify(truncUnit) +
            ',{"bucket":"timeline_event","subjectId":"partial_event',
          finishReason: "length",
        });
        const truncResult = await processLongTermMemorySource({
          sourceNote: truncSource,
          languageModel: options.languageModel,
          scope: { chatId: "chat-a", chatIds: ["chat-a"] },
          modes: ["roleplay"],
          mode: "roleplay",
          extractionMode: "roleplay",
          operationId: randomUUID(),
          root: commitRoot,
        });
        assert.equal(truncResult.outcome.incomplete, true);
        assert.equal(truncResult.outcome.keptUnits, 1);
        const truncNoteAfter = await storage.getNote(truncSource.id);
        assert.equal(
          Boolean(truncNoteAfter?.extractionFingerprint),
          false,
          "truncated recovery must not persist extraction fingerprint",
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
