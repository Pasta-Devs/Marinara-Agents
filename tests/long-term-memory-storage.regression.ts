import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

async function main() {
  const source =
    "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { configurePackageRuntime } = await import(
    `${source}/package-runtime.ts`
  );
  const { getLongTermMemoryDirectories, getLongTermMemoryRoot, notePathForId } =
    await import(`${source}/paths.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
  const { LongTermMemoryDraftStore } = await import(`${source}/draft-store.ts`);
  const { applyLongTermMemoryDraft } = await import(`${source}/reconciliation.ts`);
  const { projectLongTermMemoryDraftReview } = await import(`${source}/draft-review.ts`);
  const { activateLongTermMemoryStorage } = await import(
    `${source}/runtime.ts`
  );
  const { ltmSettingsPath } = await import(`${source}/settings.ts`);
  const { ltmMutationTransactionSchema, recoverLtmMutations } = await import(
    `${source}/mutation-transaction.ts`
  );
  const { runLongTermMemoryRetention } = await import(`${source}/retention.ts`);
  const {
    exportLongTermMemoryData,
    replaceLongTermMemoryData,
    deleteAllLongTermMemoryData,
    resetLongTermMemorySettings,
  } = await import(`${source}/backup-restore.ts`);

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-storage-"));
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const releaseHost = configurePackageRuntime({ dataDir, logger });
  const root = join(dataDir, "long-term-memory");
  const timestamp = "2026-07-17T00:00:00.000Z";
  const noteInput = {
    id: "world_restart_proof",
    title: "Restart proof",
    type: "world",
    modes: ["roleplay"],
    scope: {},
    tags: [],
    keywords: ["restart"],
    links: [],
    sections: {
      facts: {
        text: "This note survives runtime restart.",
        updatedAt: timestamp,
      },
    },
  };

  try {
    assert.equal(
      getLongTermMemoryRoot(),
      root,
      "default root must remain join(dataDir, 'long-term-memory')",
    );
    const first = await activateLongTermMemoryStorage(root);
    await first.storage.createNote(noteInput);
    await first.cleanup();
    const restarted = await activateLongTermMemoryStorage(root);
    assert.equal(
      (await restarted.storage.getNote(noteInput.id))?.sections.facts?.text,
      "This note survives runtime restart.",
    );

    const interruptedId = randomUUID();
    const interruptedPath = notePathForId("world_interrupted", "world", root);
    const interruptedNote = {
      ...noteInput,
      id: "world_interrupted",
      title: "Interrupted",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    const transaction = ltmMutationTransactionSchema.parse({
      version: 1,
      id: interruptedId,
      createdAt: timestamp,
      status: "committed",
      files: [
        {
          path: "vault/world/world_interrupted.json",
          before: null,
          after: interruptedNote,
        },
      ],
      events: [],
    });
    await writeFile(
      join(
        getLongTermMemoryDirectories(root).transactions,
        `${interruptedId}.json`,
      ),
      `${JSON.stringify(transaction)}\n`,
    );
    await recoverLtmMutations(root);
    assert.equal(
      JSON.parse(await readFile(interruptedPath, "utf8")).id,
      "world_interrupted",
    );
    await assert.rejects(
      stat(
        join(
          getLongTermMemoryDirectories(root).transactions,
          `${interruptedId}.json`,
        ),
      ),
    );

    await writeFile(ltmSettingsPath(root), '{"version":1,"unknown":true}\n');
    await restarted.cleanup();
    await assert.rejects(
      activateLongTermMemoryStorage(root),
      /unrecognized|unknown/i,
      "self-check must reject malformed settings",
    );
    await writeFile(ltmSettingsPath(root), '{"version":1}\n');

    const quarantine = join(root, "quarantine", "expired");
    await mkdir(quarantine, { recursive: true });
    await writeFile(join(quarantine, "artifact.json"), "{}\n");
    await utimes(quarantine, new Date(0), new Date(0));
    const cleanup = await runLongTermMemoryRetention({
      root,
      now: new Date("2026-07-17T00:00:00Z"),
      force: true,
    });
    assert.equal(cleanup.quarantineArtifacts, 1);
    await assert.rejects(stat(quarantine));
    assert.equal(
      (await new LongTermMemoryStorage(root).getNote(noteInput.id))?.id,
      noteInput.id,
      "cleanup must preserve canonical notes",
    );

    const exported = await exportLongTermMemoryData(root);
    assert.equal(exported.format, "marinara-long-term-memory");
    assert.equal(exported.notes.some((note) => note.id === noteInput.id), true);
    assert.equal("indexes" in exported, false);
    const importedNote = exported.notes.find((note) => note.id === noteInput.id)!;
    await replaceLongTermMemoryData({
      ...exported,
      notes: [
        {
          ...importedNote,
          id: "world_imported_backup",
          title: "Imported backup",
        },
      ],
      drafts: [],
    }, root);
    assert.equal(await new LongTermMemoryStorage(root).getNote(noteInput.id), null);
    assert.equal(
      (await new LongTermMemoryStorage(root).getNote("world_imported_backup"))?.title,
      "Imported backup",
    );
    await resetLongTermMemorySettings(root);
    assert.equal((await exportLongTermMemoryData(root)).notes.length, 1);
    await deleteAllLongTermMemoryData(root);
    assert.equal((await new LongTermMemoryStorage(root).listNotes()).length, 0);
    assert.equal((await exportLongTermMemoryData(root)).settings.global.version, 1);

    const storage = new LongTermMemoryStorage(root);
    const legacySource = await storage.createNote({
      id: "source_import_chat_legacy_draft",
      title: "Legacy draft source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary", "imported_chat"],
      keywords: [],
      links: [],
      sections: { source: { text: "Legacy evidence.", updatedAt: timestamp } },
    });
    await storage.createNote({ ...noteInput, id: "world_legacy_target", title: "Legacy target", scope: { chatId: "chat-a", chatIds: ["chat-a"] }, links: [] });
    const draftStore = new LongTermMemoryDraftStore(root);
    const mutationId = randomUUID();
    const pending = await draftStore.createDraft({
      source: { sourceNoteId: legacySource.id, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "Link the target to imported evidence.",
        mutations: [{ id: mutationId, kind: "add_link", risk: "low", confidence: 0.9, summary: "Link evidence", evidence: ["Legacy evidence."], noteId: "world_legacy_target", link: { target: legacySource.id, relation: "evidenced_by" } }],
      },
    });
    const canonicalSourceId = "source_chat_summary_1234567890abcdef";
    await storage.renameNoteId(legacySource.id, canonicalSourceId);
    const rewrittenDraft = await draftStore.getDraft(pending.id);
    assert.equal(rewrittenDraft?.source.sourceNoteId, canonicalSourceId);
    assert.equal(rewrittenDraft?.source.extractionFingerprint?.sourceHash, rewrittenDraft?.source.sourceHash);
    assert.equal((rewrittenDraft?.mutations[0] as any).link.target, canonicalSourceId);
    const review = await projectLongTermMemoryDraftReview({ root, sourceNoteId: canonicalSourceId });
    assert.equal(review.counts.drafts, 1);
    const applied = await applyLongTermMemoryDraft(pending.id, { root, mutationIds: [mutationId] });
    assert.deepEqual(applied.appliedMutationIds, [mutationId]);
    assert.equal((await storage.getNote("world_legacy_target"))?.links[0]?.target, canonicalSourceId);

    const bulkSource = await storage.createNote({
      ...noteInput,
      id: "source_bulk_fixture",
      title: "Bulk source",
      type: "source",
      status: "active",
      links: [],
      sections: { source: { text: "Bulk source evidence.", updatedAt: timestamp } },
    });
    await storage.createNote({
      ...noteInput,
      id: "world_bulk_derived",
      title: "Bulk derived",
      links: [{ target: bulkSource.id, relation: "extracted_from" }],
    });
    const batch = await storage.bulkMutateNotes({
      noteIds: [bulkSource.id, "world_bulk_missing"],
      archive: "with_derived",
      addTags: ["bulk_archived"],
    });
    assert.equal(batch.status, "partial");
    assert.deepEqual(batch.updatedNoteIds, [bulkSource.id]);
    assert.deepEqual(batch.affectedNoteIds, [bulkSource.id, "world_bulk_derived"]);
    assert.deepEqual(batch.failedNoteIds, ["world_bulk_missing"]);
    assert.equal((await storage.getNote(bulkSource.id))?.status, "archived");
    assert.equal((await storage.getNote(bulkSource.id))?.tags.includes("bulk_archived"), true);
    assert.equal((await storage.getNote("world_bulk_derived"))?.status, "archived");
    const bulkEvents = (await readFile(getLongTermMemoryDirectories(root).eventLog, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((event) => event.type.endsWith(".bulk_updated"));
    assert.deepEqual(bulkEvents.map((event) => event.target), [bulkSource.id, "world_bulk_derived"]);
    const noChanges = await storage.bulkMutateNotes({ noteIds: [bulkSource.id], archive: "with_derived" });
    assert.equal(noChanges.status, "no_changes");
    assert.deepEqual(noChanges.skippedNoteIds, [bulkSource.id]);

    process.stdout.write(
      "Long-Term Memory storage regression: restart, recovery, self-check, cleanup, stable root ok\n",
    );
  } finally {
    releaseHost();
    await rm(dataDir, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
