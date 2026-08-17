import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    response = { content: "  ", finishReason: "stop" };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) => error.code === "ltm_model_output_empty",
    );
    assert.equal(calls.length, 1, "empty output must not trigger a repair call");

    calls.length = 0;
    response = { content: "{}", finishReason: "stop" };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) => error.code === "ltm_model_output_unusable",
    );
    assert.equal(calls.length, 1, "unusable output must not trigger a repair call");

    calls.length = 0;
    response = { content: "{malformed", finishReason: "stop" };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) => error.code === "ltm_model_output_unusable",
    );
    assert.equal(calls.length, 1, "malformed output must not trigger a repair call");

    calls.length = 0;
    response = {
      content: JSON.stringify({ units: Array.from({ length: 1_000 }, () => validUnit) }),
      finishReason: "stop",
    };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) => error.code === "ltm_model_output_unusable" && /maximum is/u.test(error.message),
    );
    assert.equal(calls.length, 1, "oversized output must not trigger a repair call");

    calls.length = 0;
    response = { content: '{"summary":"unfinished', finishReason: "length" };
    await assert.rejects(
      () => runLongTermMemoryEvidenceUnitExtraction({ ...options, operationId: randomUUID() }),
      (error: any) => error.code === "ltm_model_output_truncated",
    );
    assert.equal(calls.length, 1, "truncated output must not trigger a repair call");

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
  } finally {
    release();
    await rm(root, { recursive: true, force: true });
  }
  process.stdout.write(
    "Long-Term Memory extraction reliability regression: terminal responses, bounded fallback, usage, and candidate isolation ok\n",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
