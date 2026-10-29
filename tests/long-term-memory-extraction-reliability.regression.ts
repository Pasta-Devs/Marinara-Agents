import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { compileEvidenceUnitExtraction, parseEvidenceUnitPayload, runLongTermMemoryEvidenceUnitExtraction } =
    await import(`${source}/extraction/evidence-unit-extraction.ts`);
  const { readLtmDebugLog } = await import(`${source}/maintenance/debug-log.ts`);
  const { sourceHashForLtmSourceNote } = await import(`${source}/extraction/source-hash.ts`);
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
  const loggedErrors: unknown[] = [];
  let response: any = { content: validContent, finishReason: "stop" };
  const release = configurePackageRuntime({
    isDebugAgentsEnabled: () => false,
    logger: {
      debug() {},
      info() {},
      warn() {},
      error(error: unknown) {
        loggedErrors.push(error);
      },
    },
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
      for (const finishCutOffAnswers of [false, true]) {
        calls.length = 0;
        response = testCase.response;
        await assert.rejects(
          () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID(), finishCutOffAnswers }),
          (error: any) =>
            error.code === testCase.expectedCode &&
            (!testCase.matchMessage || testCase.matchMessage.test(error.message)),
        );
        assert.equal(calls.length, 1, testCase.message);
      }
    }

    // A quoted score is read as its number; anything that is not a finite 0..1 number still fails.
    const quoted = parseEvidenceUnitPayload(
      { summary: "Quoted.", units: [{ ...validUnit, salience: "0.5", confidence: " 0.8 " }] },
      sourceHash,
    );
    assert.equal(quoted.response.units.length, 1);
    assert.equal(quoted.response.units[0]?.salience, 0.5);
    assert.equal(quoted.response.units[0]?.confidence, 0.8);
    for (const score of ["high", "", "1.5", null]) {
      const rejected = parseEvidenceUnitPayload(
        {
          summary: "Bad.",
          units: [
            { ...validUnit, salience: score },
            { ...validUnit, confidence: score },
          ],
        },
        sourceHash,
      );
      assert.equal(rejected.response.units.length, 0, `score ${JSON.stringify(score)} must stay invalid`);
      assert.equal(rejected.droppedCandidates[0]?.reason, "invalid_format");
    }

    // A complete answer whose candidates are all malformed fails the piece; empty and partly valid answers do not.
    const malformedUnit = { ...validUnit, salience: "high" };
    calls.length = 0;
    response = {
      content: JSON.stringify({ summary: "All bad.", units: [malformedUnit, malformedUnit] }),
      finishReason: "stop",
    };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) =>
        error.code === "ltm_model_output_unusable" && /every extraction candidate was malformed/.test(error.message),
    );
    assert.equal(calls.length, 1, "all-malformed output must not trigger a repair call");
    response = { content: JSON.stringify({ summary: "Nothing durable.", units: [] }), finishReason: "stop" };
    const emptyRun = await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() });
    assert.equal(emptyRun.response.units.length, 0);
    response = {
      content: JSON.stringify({ summary: "Mixed.", units: [validUnit, malformedUnit] }),
      finishReason: "stop",
    };
    const mixedRun = await runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() });
    assert.equal(mixedRun.response.units.length, 1);
    assert.equal(mixedRun.parserRejections, 1);

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

    const incompleteWarning = (unitResponse: any, finishCutOffAnswers: boolean) =>
      compileEvidenceUnitExtraction({
        unitResponse,
        sourceText: sourceNote.sections.source.text,
        sourceNote,
        existingNotes: [],
        scope: {},
        modes: ["roleplay"],
        mode: "roleplay",
        sourceHash,
        allowedBuckets: ["timeline_event"],
        finishCutOffAnswers,
      }).diagnostics.find((diagnostic: any) => diagnostic.code === "ltm_model_output_incomplete")?.message;
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
      assert.equal(
        incompleteWarning(recoveredRun.response, false),
        "The answer stopped at the output limit, so Retry will stop at the same place. Turn on 'Finish cut-off answers' in Memory Settings to fetch the rest.",
      );
    }

    // "Finish cut-off answers" asks for the rest of a cut answer, at most 3 rounds, and keeps what it holds on failure.
    const cutContent = (unit: any) =>
      '{"summary":"Cut.","units":[' +
      JSON.stringify(unit) +
      ',{"bucket":"timeline_event","subjectId":"partial_event","sectionKey":"event","text":"Mara was interrup';
    const laterUnit = (subjectId: string) => ({ ...validUnit, subjectId, text: `Mara reached ${subjectId}.` });
    const continuationRun = async (answers: any[], signal?: AbortSignal, model: any = {}) => {
      const requests: any[] = [];
      const operationId = randomUUID();
      const run = await runLongTermMemoryEvidenceUnitExtraction({
        ...options,
        operationId,
        finishCutOffAnswers: true,
        signal,
        languageModel: {
          ...options.languageModel,
          ...model,
          async chatComplete(messages: any[], chatOptions: any) {
            const user = JSON.parse(messages.find((message) => message.role === "user").content);
            requests.push({ user, chatOptions });
            const answer = answers.shift();
            if (typeof answer === "function") return answer();
            if (answer instanceof Error) throw answer;
            return answer;
          },
        },
      });
      const rounds = (await readLtmDebugLog({ operationId }, root)).filter(
        (event) => event.action === "evidence_unit_continuation",
      );
      return { run, requests, rounds };
    };

    const completed = await continuationRun([
      { content: cutContent(validUnit), finishReason: "length" },
      {
        content: JSON.stringify({ summary: "Rest.", units: [validUnit, laterUnit("observatory_lamp_lit")] }),
        finishReason: "stop",
      },
    ]);
    assert.equal(completed.requests.length, 2);
    assert.equal(completed.requests[0].user.continuation, undefined);
    assert.deepEqual(completed.requests[1].user.continuation.alreadyExtracted, [
      { bucket: "timeline_event", subjectId: "observatory_gate_sealed", sectionKey: "event", text: validUnit.text },
    ]);
    assert.equal(completed.requests[1].user.sourceText, completed.requests[0].user.sourceText);
    assert.equal(completed.requests[1].chatOptions.maxTokens, completed.requests[0].chatOptions.maxTokens);
    assert.deepEqual(
      completed.requests[1].chatOptions.responseFormat,
      completed.requests[0].chatOptions.responseFormat,
    );
    assert.deepEqual(
      completed.run.response.units.map((unit: any) => unit.subjectId),
      ["observatory_gate_sealed", "observatory_lamp_lit"],
      "the continuation's units are appended and an exact repeat is dropped",
    );
    assert.equal(completed.run.response.incomplete, false);
    assert.equal(
      completed.run.totalCandidates - completed.run.parserRejections,
      completed.run.response.units.length,
      "a dropped repeat is not counted as a candidate",
    );
    assert.deepEqual(
      completed.rounds.map((event) => [event.counts!.round, event.counts!.addedUnits]),
      [[1, 1]],
    );

    // The longer continuation prompt gets its output budget fitted to a known model context, like the first request.
    const fitted = await continuationRun(
      [
        { content: cutContent(validUnit), finishReason: "length" },
        {
          content: JSON.stringify({ summary: "Rest.", units: [laterUnit("observatory_lamp_lit")] }),
          finishReason: "stop",
        },
      ],
      undefined,
      {
        maxContext: 16_000,
        fitContext: (messages: any[], fitOptions: any) => ({
          messages,
          maxTokens: messages.some((message) => message.role === "user" && message.content.includes('"continuation":'))
            ? 2_000
            : fitOptions.maxTokens,
          estimatedTokensBefore: 20,
          estimatedTokensAfter: 20,
          trimmed: false,
        }),
      },
    );
    assert.equal(fitted.requests.length, 2);
    assert.notEqual(fitted.requests[0].chatOptions.maxTokens, 2_000);
    assert.equal(fitted.requests[1].chatOptions.maxTokens, 2_000);
    assert.equal(fitted.run.response.incomplete, false);

    const roundLimit = await continuationRun([
      { content: cutContent(validUnit), finishReason: "length" },
      ...[1, 2, 3].map((round) => ({
        content: cutContent(laterUnit(`round_${round}_event`)),
        finishReason: "max_tokens",
      })),
    ]);
    assert.equal(roundLimit.requests.length, 4, "the continuation stops after 3 rounds");
    assert.equal(roundLimit.run.response.units.length, 4);
    assert.equal(roundLimit.run.response.incomplete, true);
    assert.deepEqual(
      roundLimit.rounds.map((event) => [event.counts!.round, event.counts!.addedUnits]),
      [
        [1, 1],
        [2, 1],
        [3, 1],
      ],
    );
    assert.equal(
      incompleteWarning(roundLimit.run.response, true),
      "Extraction output was cut off by the model limit; the source remains retryable.",
    );

    for (const failedContinuation of [
      { content: JSON.stringify({ summary: "Nothing new.", units: [validUnit] }), finishReason: "stop" },
      new Error("503 provider overloaded"),
    ]) {
      const kept = await continuationRun([
        { content: cutContent(validUnit), finishReason: "length" },
        failedContinuation,
      ]);
      assert.equal(kept.requests.length, 2);
      assert.deepEqual(
        kept.run.response.units.map((unit: any) => unit.subjectId),
        ["observatory_gate_sealed"],
      );
      assert.equal(kept.run.response.incomplete, true);
      assert.equal(kept.rounds[0]?.status, failedContinuation instanceof Error ? "error" : "warning");
    }

    // A cancel during a continuation still cancels the extraction instead of keeping the salvaged units.
    const controller = new AbortController();
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    await assert.rejects(
      continuationRun(
        [
          { content: cutContent(validUnit), finishReason: "length" },
          () => {
            controller.abort();
            throw abortError;
          },
        ],
        controller.signal,
      ),
      (error) => error === abortError,
    );

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

    const { validateLtmEvidenceUnits } = await import(`${source}/extraction/evidence-unit-validation.ts`);
    const longSourceText = `${Array.from({ length: 600 }, (_, index) => `filler${index}`).join(" ")} ${sourceNote.sections.source.text}`;
    const keptUnit = { ...validUnit, id: randomUUID() };
    const unknownLinkUnit = {
      ...validUnit,
      id: randomUUID(),
      subjectId: "brass_lamp_lit",
      text: "Quentin lit the brass lamp.",
      links: [...validUnit.links, { target: "char_missing_ally", relation: "involves" }],
    };
    const unrelatedUnit = {
      ...validUnit,
      id: randomUUID(),
      subjectId: "harbor_bell_rang",
      text: "The harbor bell rang twice.",
    };
    const lexical = validateLtmEvidenceUnits({
      units: [keptUnit, unknownLinkUnit, unrelatedUnit],
      sourceText: longSourceText,
      sourceNote,
      existingNotes: [],
      expectedSourceHash: sourceHash,
      allowedBuckets: ["timeline_event"],
    });
    assert.deepEqual(
      lexical.keptUnits.map((unit: any) => unit.subjectId),
      ["observatory_gate_sealed", "harbor_bell_rang"],
    );
    assert.equal(lexical.droppedCandidates.length, 1);
    assert.match(lexical.droppedCandidates[0]!.message, /linked to a memory this extraction could not find/u);
    assert.doesNotMatch(lexical.droppedCandidates[0]!.message, /wrong memory stream|char_missing_ally/u);
    assert.deepEqual(
      lexical.diagnostics
        .filter((diagnostic: any) => diagnostic.code === "low_lexical_evidence")
        .map((diagnostic: any) => diagnostic.candidateIndex),
      [2],
      "past the 500th source token still overlaps, and a dropped unit carries no warning",
    );
    const { processLongTermMemorySource, processLongTermMemorySourceBatch } = await import(
      `${source}/extraction/source-processing.ts`
    );
    const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
    const { LongTermMemoryDraftStore } = await import(`${source}/drafts/draft-store.ts`);
    const { withLtmVaultLock } = await import(`${source}/persistence/vault-lock.ts`);
    const { invalidateLtmVaultSnapshot } = await import(`${source}/persistence/vault-snapshot.ts`);
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
          1,
          "deterministic batches must use one preparation snapshot and no rebuild scan when nothing was applied",
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

      // The ordered commit loop lists the committed vault once per batch, then re-reads only the
      // notes a later write reported, so a large vault is not parsed again for every item while the batch
      // holds the vault lock. Writes the batch did not make still reach later items: a note created after
      // the first item is reused, and a deleted one is no longer a candidate. A write that names no files
      // makes the next item list the whole vault again.
      const listingSources = [];
      for (const name of ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"])
        listingSources.push(
          await storage.createNote({
            id: `source_batch_listing_${name}`,
            title: `Batch listing ${name}`,
            type: "source",
            status: "active",
            modes: ["roleplay"],
            scope: { chatId: "chat-a", chatIds: ["chat-a"] },
            tags: ["source_summary"],
            keywords: [],
            links: [],
            provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: `summary-batch-listing-${name}` },
            sections: {
              source: { text: `The ${name} beacon ledger records the harbor survey.`, updatedAt: timestamp },
            },
          }),
        );
      options.languageModel.chatComplete = async (messages: any[], chatOptions: any) => {
        calls.push(chatOptions);
        const source = listingSources.find((note) => JSON.stringify(messages).includes(note.sections.source!.text))!;
        const name = source.id.replace("source_batch_listing_", "");
        const unit = {
          ...worldUnitFor(source, `${name}_beacon`, source.sections.source!.text),
          title: `${name} beacon`,
        };
        return { content: JSON.stringify({ summary: "Beacon fact.", units: [unit] }), finishReason: "stop" };
      };
      const beaconNote = (id: string, title: string) => ({
        id,
        title,
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: [],
        links: [],
        sections: { facts: { text: `${title} stands over the harbor.`, updatedAt: timestamp } },
      });
      // Frozen so an in-place change to the note copies the batch shares between items fails here.
      const deepFreeze = (value: any): any => {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
          Object.freeze(value);
          for (const child of Object.values(value)) deepFreeze(child);
        }
        return value;
      };
      const runListingBatch = async (
        sources: typeof listingSources,
        onFirstDraft: () => Promise<unknown>,
        duringNextReRead?: () => void,
      ) => {
        const originalListNotes = LongTermMemoryStorage.prototype.listNotes;
        const originalGetNotesByIds = LongTermMemoryStorage.prototype.getNotesByIds;
        const originalCreateDraft = LongTermMemoryDraftStore.prototype.createDraft;
        let drafted = false;
        let hookRunning = false;
        let listings = 0;
        LongTermMemoryStorage.prototype.listNotes = async function (...args: any[]) {
          // Count only the batch's own unfiltered vault listings, the kind commit-time reconciliation makes.
          if (drafted && !hookRunning && Object.keys(args[0] ?? {}).length === 0) listings += 1;
          return deepFreeze(await originalListNotes.apply(this, args));
        };
        LongTermMemoryStorage.prototype.getNotesByIds = async function (...args: any[]) {
          const notes = await originalGetNotesByIds.apply(this, args);
          if (drafted && !hookRunning) duringNextReRead?.();
          duringNextReRead = drafted && !hookRunning ? undefined : duringNextReRead;
          for (const note of notes.values()) deepFreeze(note);
          return notes;
        };
        LongTermMemoryDraftStore.prototype.createDraft = async function (input: any) {
          const draft = await originalCreateDraft.call(this, input);
          if (!drafted) {
            drafted = true;
            hookRunning = true;
            try {
              await onFirstDraft();
            } finally {
              hookRunning = false;
            }
          }
          return draft;
        };
        try {
          const batch = await processLongTermMemorySourceBatch({
            items: sources.map((note) => ({
              sourceId: note.id,
              title: note.title!,
              note,
              created: false,
              extractionMode: "roleplay",
            })),
            languageModel: options.languageModel,
            operationId: randomUUID(),
            signal: new AbortController().signal,
            concurrency: 3,
            root: commitRoot,
          });
          assert.deepEqual(
            batch.map((result: any) => result.extractionStatus),
            sources.map(() => "succeeded"),
            JSON.stringify(batch.map((result: any) => result.error)),
          );
          return { batch, listings };
        } finally {
          LongTermMemoryStorage.prototype.listNotes = originalListNotes;
          LongTermMemoryStorage.prototype.getNotesByIds = originalGetNotesByIds;
          LongTermMemoryDraftStore.prototype.createDraft = originalCreateDraft;
        }
      };
      await storage.createNote(beaconNote("world_gamma_lighthouse", "gamma beacon"));
      const reused = await runListingBatch(listingSources.slice(0, 3), async () => {
        await storage.createNote(beaconNote("world_beta_lighthouse", "beta beacon"));
        await storage.deleteNotesPermanently(["world_gamma_lighthouse"]);
      });
      assert.equal(
        reused.listings,
        0,
        "later batch items must reuse the batch's vault listing instead of listing the vault again",
      );
      assert.deepEqual(
        [...new Set(mutationTargetNoteIds(reused.batch[1]))],
        ["world_beta_lighthouse"],
        "a note created after the batch listed the vault must still be reused by a later item",
      );
      assert.deepEqual(
        [...new Set(mutationTargetNoteIds(reused.batch[2]))],
        ["world_gamma_beacon"],
        "a note deleted after the batch listed the vault must no longer be a candidate for a later item",
      );
      const relisted = await runListingBatch(listingSources.slice(3, 6), async () =>
        invalidateLtmVaultSnapshot(commitRoot),
      );
      assert.equal(
        relisted.listings,
        1,
        "a vault write that names no files must make the next item list the vault again, and only that item",
      );
      // Two items, so the relist cannot move to a later item: the second item's re-read is the last chance.
      const racedReRead = await runListingBatch(
        listingSources.slice(6),
        async () => {},
        () => invalidateLtmVaultSnapshot(commitRoot),
      );
      assert.equal(
        racedReRead.listings,
        1,
        "a write that names no files while an item re-reads changed notes must make that item list the vault again",
      );

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
        // An internal failure is logged; the source's result points to the server log instead of carrying it.
        assert.deepEqual(snapshotFailureBatch[1]?.error, {
          code: "extract_failed",
          message: "Failed to extract imported source. Details are in the server log.",
        });
        assert.equal(
          loggedErrors.some((error) => error instanceof Error && error.message === "snapshot unavailable"),
          true,
        );
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
        assert.match(
          truncResult.diagnostics.find((diagnostic: any) => diagnostic.code === "ltm_model_output_incomplete")?.message,
          /Turn on 'Finish cut-off answers'/,
          "the extraction setting is off by default, so the warning names it",
        );
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
