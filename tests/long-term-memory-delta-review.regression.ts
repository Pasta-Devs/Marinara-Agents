import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";
import type {
  LtmMode,
  LtmScope,
  LtmSectionContribution,
} from "../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
  const { previewLtmNoteForkRepair, applyLtmNoteForkRepair } = await import(`${source}/note-fork-repair.ts`);
  const { renderSectionContributions } = await import(`${source}/section-contributions.ts`);
  const { canUpdateLtmScopedTarget } = await import(`${source}/scoped-targets.ts`);

  const timestamp = "2026-09-20T00:00:00.000Z";
  const sourceHash = "a".repeat(64);
  const sourceNoteId = "source_delta_review";
  const manual = (text: string, updatedAt = timestamp) => ({ owner: "manual" as const, text, updatedAt });
  const backed = (text: string, textSourceNoteId = sourceNoteId) => ({
    owner: "source" as const,
    sourceNoteId: textSourceNoteId,
    sourceHash,
    text,
    updatedAt: timestamp,
  });
  const section = (text: string, contributions?: LtmSectionContribution[]) => ({
    text,
    updatedAt: timestamp,
    ...(contributions ? { contributions } : {}),
  });

  const manualForward = renderSectionContributions([manual("Manual fact A"), manual("Manual fact B")], true)!;
  const manualReverse = renderSectionContributions([manual("Manual fact B"), manual("Manual fact A")], true)!;
  for (const rendered of [manualForward, manualReverse]) {
    assert.match(rendered.text, /Manual fact A/u);
    assert.match(rendered.text, /Manual fact B/u);
    assert.equal(rendered.contributions?.filter((item) => item.owner === "manual").length, 2);
  }
  const deduped = renderSectionContributions(
    [backed("Source fact"), backed("Source fact"), manual("Manual fact")],
    true,
  )!;
  assert.equal(deduped.contributions?.length, 2, "identical source and manual contributions are deduplicated");

  assert.equal(
    canUpdateLtmScopedTarget({ chatIds: ["same-id"] }, { characterIds: ["same-id"] }),
    false,
    "scope namespaces must not collide",
  );

  const createRoot = async (label: string) => {
    const dataDir = await mkdtemp(join(tmpdir(), `marinara-ltm-delta-${label}-`));
    const release = configurePackageRuntime({ dataDir, logger: { debug() {}, info() {}, warn() {}, error() {} } });
    const root = join(dataDir, "long-term-memory");
    const storage = new LongTermMemoryStorage(root);
    await storage.initializeLtmStore();
    return { dataDir, release, root, storage };
  };
  const noteInput = (
    id: string,
    type: "world" | "thread",
    createdAt: string,
    tags: string[] = [],
    scope: LtmScope = { chatId: "chat-a" },
    modes: LtmMode[] = ["roleplay"],
  ) => ({
    id,
    title: id,
    type,
    status: "active" as const,
    modes,
    scope,
    tags,
    keywords: ["shared"],
    links: [] as Array<{ target: string; relation: "extracted_from" }>,
    sections: { facts: section("Shared durable fact") },
    createdAt,
    updatedAt: createdAt,
    version: 1,
  });

  const fork = await createRoot("provenance");
  try {
    await fork.storage.createNote({
      id: sourceNoteId,
      title: "Source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: {},
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "entry-a" },
      sections: { source: section("Source material") },
    });
    const canonicalInput = noteInput("world_delta_canonical", "world", "2026-01-01T00:00:00.000Z");
    const duplicateInput = noteInput("world_delta_duplicate", "world", "2026-01-02T00:00:00.000Z");
    canonicalInput.links = [{ target: sourceNoteId, relation: "extracted_from" }];
    duplicateInput.links = [{ target: sourceNoteId, relation: "extracted_from" }];
    await fork.storage.createNote(canonicalInput);
    await fork.storage.createNote(duplicateInput);
    for (const [id, texts] of [
      ["world_delta_canonical", [backed("Shared durable fact"), manual("Manual fact A")]],
      ["world_delta_duplicate", [backed("Shared durable fact"), manual("Manual fact B")]],
    ] as const)
      await fork.storage.projectNote(id, "world", (current) => ({
        ...current!,
        sections: { facts: section("Shared durable fact", [...texts]) },
      }));

    const preview = await previewLtmNoteForkRepair(
      { noteIds: ["world_delta_duplicate", "world_delta_canonical"] },
      { root: fork.root },
    );
    assert.deepEqual(preview.candidates[0]?.noteIds, ["world_delta_canonical", "world_delta_duplicate"]);
    assert.equal(preview.candidates[0]?.canonicalNoteId, "world_delta_canonical");
    await applyLtmNoteForkRepair(
      {
        noteIds: preview.candidates[0]!.noteIds,
        canonicalNoteId: preview.candidates[0]!.canonicalNoteId,
        contentHash: preview.candidates[0]!.contentHash,
      },
      { root: fork.root },
    );
    const merged = await fork.storage.getNote("world_delta_canonical");
    assert.deepEqual(
      merged?.sections.facts.contributions?.map((item) => item.owner),
      ["source", "manual", "manual"],
      "fork repair persists source provenance and both manual facts",
    );
    assert.equal(merged?.sections.facts.text.includes("Manual fact A"), true);
    assert.equal(merged?.sections.facts.text.includes("Manual fact B"), true);

    const lineage = await fork.storage.deleteNotesPermanently([sourceNoteId], {
      retractExtracted: true,
      excludedNoteIds: ["world_delta_canonical", "world_delta_duplicate"],
      lineageSourceNoteId: sourceNoteId,
      expectedLineageNoteIds: [sourceNoteId, "world_delta_canonical", "world_delta_duplicate"],
    });
    assert.deepEqual(lineage.deletedIds, [sourceNoteId]);
    const retractedCanonical = await fork.storage.getNote("world_delta_canonical");
    assert.deepEqual(
      retractedCanonical?.sections.facts.contributions?.map((item) => item.owner),
      ["manual", "manual"],
      "deleting the source retracts merged source contributions while retaining both manual facts",
    );
    const detached = await fork.storage.getNote("world_delta_duplicate");
    assert.deepEqual(
      detached?.sections.facts.contributions?.map((item) => item.owner),
      ["manual"],
      "deleting the source retracts persisted source contributions while retaining manual facts",
    );
  } finally {
    fork.release();
    await rm(fork.dataDir, { recursive: true, force: true });
  }

  const mismatch = await createRoot("mismatch");
  try {
    await mismatch.storage.createNote(noteInput("world_scope_one", "world", "2026-01-01T00:00:00.000Z"));
    await mismatch.storage.createNote(
      noteInput("world_scope_two", "world", "2026-01-02T00:00:00.000Z", [], { chatIds: ["chat-a", "chat-b"] }),
    );
    await mismatch.storage.createNote(noteInput("world_scope_three", "world", "2026-01-03T00:00:00.000Z"));
    await assert.rejects(
      previewLtmNoteForkRepair(
        { noteIds: ["world_scope_three", "world_scope_two", "world_scope_one"] },
        { root: mismatch.root },
      ),
      /equivalent availability scopes/u,
    );
    await mismatch.storage.updateNote("world_scope_two", { scope: { chatId: "chat-a" } });
    await mismatch.storage.updateNote("world_scope_three", { modes: ["conversation"] });
    await assert.rejects(
      previewLtmNoteForkRepair(
        { noteIds: ["world_scope_one", "world_scope_two", "world_scope_three"] },
        { root: mismatch.root },
      ),
      /compatible chat modes/u,
    );
  } finally {
    mismatch.release();
    await rm(mismatch.dataDir, { recursive: true, force: true });
  }

  const lifecycle = await createRoot("lifecycle");
  try {
    await lifecycle.storage.createNote(
      noteInput("world_anchor_first", "world", "2026-01-01T00:00:00.000Z", ["anchor"]),
    );
    await lifecycle.storage.createNote(noteInput("world_anchor_second", "world", "2026-01-02T00:00:00.000Z"));
    assert.deepEqual((await lifecycle.storage.getNote("world_anchor_first"))!.tags, ["anchor"]);
    for (const noteIds of [
      ["world_anchor_first", "world_anchor_second"],
      ["world_anchor_second", "world_anchor_first"],
    ]) {
      const preview = await previewLtmNoteForkRepair({ noteIds }, { root: lifecycle.root });
      assert.match(preview.candidates[0]!.blockingReasons.join(" "), /lifecycles require/u);
    }
  } finally {
    lifecycle.release();
    await rm(lifecycle.dataDir, { recursive: true, force: true });
  }

  const stale = await createRoot("stale");
  try {
    await stale.storage.createNote(noteInput("world_stale_one", "world", "2026-01-01T00:00:00.000Z"));
    await stale.storage.createNote(noteInput("world_stale_two", "world", "2026-01-02T00:00:00.000Z"));
    const preview = await previewLtmNoteForkRepair(
      { noteIds: ["world_stale_one", "world_stale_two"] },
      { root: stale.root },
    );
    await stale.storage.updateNote("world_stale_one", { title: "Changed after preview" });
    await assert.rejects(
      applyLtmNoteForkRepair(
        {
          noteIds: preview.candidates[0]!.noteIds,
          canonicalNoteId: preview.candidates[0]!.canonicalNoteId,
          contentHash: preview.candidates[0]!.contentHash,
        },
        { root: stale.root },
      ),
      /stale/u,
    );
  } finally {
    stale.release();
    await rm(stale.dataDir, { recursive: true, force: true });
  }

  const rollback = await createRoot("rollback");
  try {
    await rollback.storage.createNote(noteInput("world_rollback_one", "world", "2026-01-01T00:00:00.000Z"));
    await rollback.storage.createNote(noteInput("world_rollback_two", "world", "2026-01-02T00:00:00.000Z"));
    const preview = await previewLtmNoteForkRepair(
      { noteIds: ["world_rollback_one", "world_rollback_two"] },
      { root: rollback.root },
    );
    const canonicalBefore = await rollback.storage.getNote("world_rollback_one");
    const duplicateBefore = await rollback.storage.getNote("world_rollback_two");
    const originalRedirect = LongTermMemoryStorage.prototype.redirectReferences;
    LongTermMemoryStorage.prototype.redirectReferences = async () => {
      throw new Error("forced fork rollback");
    };
    try {
      await assert.rejects(
        applyLtmNoteForkRepair(
          {
            noteIds: preview.candidates[0]!.noteIds,
            canonicalNoteId: preview.candidates[0]!.canonicalNoteId,
            contentHash: preview.candidates[0]!.contentHash,
          },
          { root: rollback.root },
        ),
        /forced fork rollback/u,
      );
    } finally {
      LongTermMemoryStorage.prototype.redirectReferences = originalRedirect;
    }
    const canonicalAfter = await rollback.storage.getNote("world_rollback_one");
    const duplicateAfter = await rollback.storage.getNote("world_rollback_two");
    assert.deepEqual(canonicalAfter?.sections, canonicalBefore?.sections);
    assert.deepEqual(canonicalAfter?.links, canonicalBefore?.links);
    assert.equal(canonicalAfter?.version, canonicalBefore?.version);
    assert.equal(duplicateAfter?.status, duplicateBefore?.status);
  } finally {
    rollback.release();
    await rm(rollback.dataDir, { recursive: true, force: true });
  }

  console.log(
    "Long-Term Memory delta review regression: provenance, scopes, lifecycles, namespaces, stale, and rollback ok",
  );
}

export const completion = runRegressionToCompletion("long-term-memory-delta-review", main);
void completion.catch((error) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
