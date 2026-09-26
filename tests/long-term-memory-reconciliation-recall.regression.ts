import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";

// Issue #1085 proof: reconciliation recall must not depend on the prompt-sized
// `existingTypedNotes` window. This builds a vault larger than the default
// existing-note budget (12 chunks), proves the prompt window misses the matching
// notes, and proves per-candidate bounded retrieval still reconciles every one.
async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { reconcileEvidenceUnitCandidates } = await import(`${source}/candidate-reconciliation.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
  const { rebuildLongTermMemoryIndexes, loadOrRebuildLongTermMemoryIndexes } = await import(`${source}/rebuild.ts`);
  const { retrieveLongTermMemory } = await import(`${source}/retrieval.ts`);
  const { sourceHashForLtmSourceNote } = await import(`${source}/source-hash.ts`);
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { prepareLongTermMemorySource } = await import(`${source}/source-processing.ts`);

  const timestamp = "2026-07-21T00:00:00.000Z";
  const scope = { chatId: "chat-a", chatIds: ["chat-a"] };
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-reconcile-recall-"));
  const releaseHost = configurePackageRuntime({
    isDebugAgentsEnabled: () => false,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    dataDir,
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
  const root = join(dataDir, "long-term-memory");

  const noteInput = (input: {
    id: string;
    type: string;
    title: string;
    text: string;
    scope?: Record<string, unknown>;
    tags?: string[];
    sectionKey?: string;
    provenance?: { kind: string; sourceId: string; entryId: string };
  }) => ({
    id: input.id,
    title: input.title,
    type: input.type,
    status: "active",
    modes: ["roleplay"],
    scope: input.scope ?? scope,
    tags: input.tags ?? [],
    keywords: [],
    links: [],
    sections: { [input.sectionKey ?? "facts"]: { text: input.text, updatedAt: timestamp } },
    ...(input.provenance ? { provenance: input.provenance } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });

  try {
    const storage = new LongTermMemoryStorage(root);
    const sourceText = "The observatory archive ledger records the cobalt vault survey.";
    await storage.createNote(
      noteInput({
        id: "source_session_recall",
        type: "source",
        title: "Session recall",
        text: sourceText,
        tags: ["source_summary"],
        sectionKey: "source",
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "entry-1" },
      }) as never,
    );
    const sourceNote = (await storage.getNote("source_session_recall"))!;

    // 16 distractors share the source vocabulary, so the prompt-sized window is filled by them.
    // The 12 targets carry a unique marker that only their own candidate query reaches.
    for (let index = 0; index < 16; index += 1) {
      await storage.createNote(
        noteInput({
          id: `world_ledger_entry_${index + 1}`,
          type: "world",
          title: `Ledger Entry ${index + 1}`,
          text: `Observatory archive ledger entry ${index + 1} records a routine vault survey.`,
        }) as never,
      );
    }
    const targets = [
      "granite",
      "marble",
      "basalt",
      "quartzite",
      "feldspar",
      "amethyst",
      "topaz",
      "garnet",
      "jade",
      "onyx",
      "opal",
      "jasper",
    ].map((marker, index) => ({
      noteId: `world_marker_${index + 1}`,
      marker,
    }));
    const markerText = (marker: string) =>
      `The ${marker} sigil and ${marker} ward and ${marker} altar mark the ${marker} vault.`;
    for (const target of targets) {
      await storage.createNote(
        noteInput({
          id: target.noteId,
          type: "world",
          title: `Marker ${target.marker}`,
          text: markerText(target.marker),
        }) as never,
      );
    }
    // A same-subject note in another scope must never be selected.
    await storage.createNote(
      noteInput({
        id: "world_marker_1_other_chat",
        type: "world",
        title: "Marker granite",
        text: markerText("granite"),
        scope: { chatId: "chat-b", chatIds: ["chat-b"] },
      }) as never,
    );
    // Two same-title notes make a candidate genuinely ambiguous at extraction time.
    await storage.createNote(
      noteInput({
        id: "world_ambiguous_sigil_a",
        type: "world",
        title: "Ambiguous Sigil",
        text: "The ambiguous sigil first reading points north.",
      }) as never,
    );
    await storage.createNote(
      noteInput({
        id: "world_ambiguous_sigil_b",
        type: "world",
        title: "Ambiguous Sigil",
        text: "The ambiguous sigil second reading points south.",
      }) as never,
    );

    await rebuildLongTermMemoryIndexes({ root });
    const index = await loadOrRebuildLongTermMemoryIndexes(root);

    // The prompt-sized window misses every target.
    const promptWindow = await retrieveLongTermMemory({
      root,
      queryText: sourceText,
      scope,
      mode: "roleplay",
      maxChunks: 12,
      maxTokens: 4_096,
    });
    const promptNoteIds = new Set(promptWindow.chunks.map((chunk) => chunk.chunk.noteId));
    assert.equal(
      targets.some((target) => promptNoteIds.has(target.noteId)),
      false,
      "the fixture must exceed the prompt-sized existing-note window",
    );

    const unit = (target: (typeof targets)[number]) => ({
      id: randomUUID(),
      bucket: "world_fact",
      subjectId: `sealed_vault_${target.marker}`,
      sectionKey: "facts",
      text: markerText(target.marker),
      claimKind: "static",
      importance: "major",
      keywords: [],
      evidence: [`source_note:${sourceNote.id}`],
      confidence: 0.95,
      salience: 0.8,
      status: "active",
      links: [],
      sourceHash: sourceHashForLtmSourceNote(sourceNote as never),
    });

    const resolved = await Promise.all(
      targets.map(async (target) => {
        const result = await reconcileEvidenceUnitCandidates({
          units: [unit(target)] as never,
          root,
          scope,
          mode: "roleplay",
          storage,
          index,
          maxCandidatesPerUnit: 8,
        });
        return { target, result };
      }),
    );

    const recalled = resolved.filter(
      ({ target, result }) => result.remaps.get(`world_sealed_vault_${target.marker}`) === target.noteId,
    );
    assert.equal(recalled.length, targets.length, "every recorded candidate must meet the recall floor");
    assert.equal(
      resolved.some(({ result }) => [...result.remaps.values()].includes("world_marker_1_other_chat")),
      false,
      "scope-incompatible notes must never be reconciled",
    );
    assert.equal(
      resolved.every(({ result }) => result.diagnostics.length === 0),
      true,
      "an unambiguous candidate set must not warn",
    );

    // An ambiguous reconciliation must gate auto-apply on review.
    const ambiguousContent = JSON.stringify({
      summary: "One ambiguous claim.",
      units: [
        {
          bucket: "world_fact",
          subjectId: "ambiguous_sigil",
          sectionKey: "facts",
          title: "Ambiguous Sigil",
          text: "The ambiguous sigil points north and south.",
          claimKind: "static",
          importance: "major",
          evidence: [`source_note:${sourceNote.id}`],
          confidence: 0.95,
          salience: 0.8,
          status: "active",
          links: [],
          sourceHash: sourceHashForLtmSourceNote(sourceNote as never),
        },
      ],
    });
    const languageModel = {
      name: "FixtureModel",
      model: "fixture-model",
      maxContext: null,
      maxOutputTokens: null,
      fitContext(messages: unknown[], fitOptions: { maxTokens: number }) {
        return {
          messages,
          maxTokens: fitOptions.maxTokens,
          estimatedTokensBefore: 20,
          estimatedTokensAfter: 20,
          trimmed: false,
        };
      },
      async chatComplete() {
        return { content: ambiguousContent, finishReason: "stop" };
      },
    };
    const prepared = await prepareLongTermMemorySource({
      sourceNote: sourceNote as never,
      languageModel: languageModel as never,
      scope,
      modes: ["roleplay"],
      mode: "roleplay",
      extractionMode: "roleplay",
      operationId: randomUUID(),
      root,
    });
    assert.equal(prepared.reviewRequired, true, "an ambiguous reconciliation must require review");
    assert.ok(
      prepared.diagnostics.some((diagnostic) => diagnostic.code === "candidate_reconciliation_ambiguous"),
      "the ambiguity diagnostic must reach the draft",
    );

    process.stdout.write(
      `Long-Term Memory reconciliation recall regression: ${recalled.length}/${targets.length} beyond the prompt window, bounded, scope-safe, review-gated ok\n`,
    );
  } finally {
    releaseHost();
    await rm(dataDir, { recursive: true, force: true });
  }
}

void runRegressionToCompletion("long-term-memory-reconciliation-recall", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
