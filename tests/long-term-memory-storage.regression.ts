import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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
  const { applyLongTermMemoryDraft } = await import(
    `${source}/reconciliation.ts`
  );
  const { compileEvidenceUnitExtraction } = await import(
    `${source}/evidence-unit-extraction.ts`
  );
  const { sourceHashForLtmSourceNote } = await import(
    `${source}/source-hash.ts`
  );
  const { projectLongTermMemoryDraftReview } = await import(
    `${source}/draft-review.ts`
  );
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
    const sourceDirectory = join(root, "vault", "sources");
    await mkdir(sourceDirectory, { recursive: true });
    await writeFile(
      join(sourceDirectory, "source_turn_legacy.json"),
      `${JSON.stringify({
        id: "source_turn_legacy",
        title: "Captured turn",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: {},
        tags: ["captured_turn"],
        keywords: [],
        links: [],
        sections: {
          source: { text: "Legacy raw turn.", updatedAt: timestamp },
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      })}\n`,
    );
    await writeFile(
      join(sourceDirectory, "source_valid_import.json"),
      `${JSON.stringify({
        id: "source_valid_import",
        title: "Valid imported summary",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: {},
        tags: ["imported_chat"],
        keywords: [],
        links: [],
        provenance: {
          kind: "chat_summary",
          sourceId: "chat-a",
          entryId: "summary-a",
        },
        sections: { source: { text: "Valid summary.", updatedAt: timestamp } },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      })}\n`,
    );
    const first = await activateLongTermMemoryStorage(root);
    assert.equal(await first.storage.getNote("source_turn_legacy"), null);
    assert.equal(
      (await first.storage.getNote("source_valid_import"))?.id,
      "source_valid_import",
    );
    const quarantineEntries = await readdir(join(root, "quarantine"));
    const capturedTurnQuarantine = quarantineEntries.find((entry) =>
      entry.startsWith("legacy-captured-turns-"),
    );
    assert.ok(capturedTurnQuarantine);
    assert.deepEqual(
      await readdir(join(root, "quarantine", capturedTurnQuarantine)),
      ["source_turn_legacy.json"],
    );
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
    assert.equal(
      exported.notes.some((note) => note.id === noteInput.id),
      true,
    );
    assert.equal("indexes" in exported, false);
    const importedNote = exported.notes.find(
      (note) => note.id === noteInput.id,
    )!;
    await replaceLongTermMemoryData(
      {
        ...exported,
        notes: [
          {
            ...importedNote,
            id: "world_imported_backup",
            title: "Imported backup",
          },
        ],
        drafts: [],
      },
      root,
    );
    assert.equal(
      await new LongTermMemoryStorage(root).getNote(noteInput.id),
      null,
    );
    assert.equal(
      (await new LongTermMemoryStorage(root).getNote("world_imported_backup"))
        ?.title,
      "Imported backup",
    );
    await resetLongTermMemorySettings(root);
    assert.equal((await exportLongTermMemoryData(root)).notes.length, 1);
    await deleteAllLongTermMemoryData(root);
    assert.equal((await new LongTermMemoryStorage(root).listNotes()).length, 0);
    assert.equal(
      (await exportLongTermMemoryData(root)).settings.global.version,
      1,
    );

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
      provenance: {
        kind: "chat_summary",
        sourceId: "chat-a",
        entryId: "legacy-draft",
      },
      sections: { source: { text: "Legacy evidence.", updatedAt: timestamp } },
    });
    await storage.createNote({
      ...noteInput,
      id: "world_legacy_target",
      title: "Legacy target",
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      links: [],
    });
    const draftStore = new LongTermMemoryDraftStore(root);
    const suggestionDraft = await draftStore.createDraft({
      source: { sourceNoteId: legacySource.id, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "A pending suggestion.",
        mutations: [
          {
            id: randomUUID(),
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create superseded memory",
            evidence: [`source_note:${legacySource.id}`],
            note: {
              id: "world_superseded_suggestion",
              title: "Superseded suggestion",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: legacySource.scope,
              tags: [],
              keywords: [],
              links: [{ target: legacySource.id, relation: "extracted_from" }],
              sections: {
                facts: {
                  text: "An obsolete suggestion.",
                  updatedAt: timestamp,
                },
              },
            },
          },
        ],
      },
    });
    const zeroSuggestionDraft = await draftStore.createDraft({
      source: { sourceNoteId: legacySource.id, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: { summary: "No durable suggestions found.", mutations: [] },
      outcome: {
        state: "no_suggestions_created",
        totalCandidates: 0,
        keptUnits: 0,
        droppedUnits: 0,
        droppedCandidates: [],
      },
      accounting: {
        providerCandidates: 0,
        normalizedAdditions: 0,
        parserRejections: 0,
        validationRejections: 0,
        deduplications: 0,
        keptUnits: 0,
      },
    });
    assert.equal(
      (await draftStore.getDraft(suggestionDraft.id))?.status,
      "superseded",
    );
    assert.equal(
      (await draftStore.getDraft(suggestionDraft.id))?.supersededByDraftId,
      zeroSuggestionDraft.id,
    );
    assert.deepEqual(
      (await draftStore.listDrafts({ status: "pending" })).map(
        (draft) => draft.id,
      ),
      [zeroSuggestionDraft.id],
    );
    const mutationId = randomUUID();
    const eventMutationId = randomUUID();
    const pending = await draftStore.createDraft({
      source: { sourceNoteId: legacySource.id, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "Link the target to imported evidence.",
        mutations: [
          {
            id: eventMutationId,
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create source event",
            evidence: [`source_note:${legacySource.id}`],
            note: {
              id: "timeline_legacy_evidence",
              title: "Legacy evidence",
              type: "timeline_event",
              status: "active",
              modes: ["roleplay"],
              scope: legacySource.scope,
              tags: ["typed_memory", "timeline_event"],
              keywords: [],
              links: [{ target: legacySource.id, relation: "extracted_from" }],
              sections: {
                event: {
                  text: "Legacy evidence was recorded.",
                  updatedAt: timestamp,
                },
              },
            },
          },
          {
            id: mutationId,
            kind: "add_link",
            risk: "low",
            confidence: 0.9,
            summary: "Link evidence",
            evidence: [`source_note:${legacySource.id}`],
            noteId: "world_legacy_target",
            link: {
              target: "timeline_legacy_evidence",
              relation: "evidenced_by",
            },
          },
        ],
      },
    });
    const canonicalSourceId = "source_chat_summary_1234567890abcdef";
    await storage.renameNoteId(legacySource.id, canonicalSourceId);
    const rewrittenDraft = await draftStore.getDraft(pending.id);
    assert.equal(rewrittenDraft?.source.sourceNoteId, canonicalSourceId);
    assert.equal(
      rewrittenDraft?.source.extractionFingerprint?.sourceHash,
      rewrittenDraft?.source.sourceHash,
    );
    assert.equal(
      (rewrittenDraft?.mutations[0] as any).note.links[0].target,
      canonicalSourceId,
    );
    const review = await projectLongTermMemoryDraftReview({
      root,
      sourceNoteId: canonicalSourceId,
    });
    assert.equal(review.counts.drafts, 1);
    const rewrittenEventMutation = rewrittenDraft?.mutations.find(
      (mutation) => mutation.id === eventMutationId,
    );
    assert.equal(rewrittenEventMutation?.kind, "create_note");
    assert.equal(rewrittenEventMutation?.claimKind, "change");
    const editedEventMutation = {
      ...rewrittenEventMutation!,
      note: {
        ...(
          rewrittenEventMutation as Extract<
            (typeof pending.mutations)[number],
            { kind: "create_note" }
          >
        ).note,
        title: "Edited dependency",
      },
    };
    const applied = await applyLongTermMemoryDraft(pending.id, {
      root,
      mutationIds: [mutationId],
      editedMutations: [editedEventMutation],
    });
    assert.deepEqual(
      new Set(applied.appliedMutationIds),
      new Set([eventMutationId, mutationId]),
    );
    assert.equal(
      (await storage.getNote("timeline_legacy_evidence"))?.title,
      "Edited dependency",
    );
    assert.deepEqual(
      (await storage.getNote("timeline_legacy_evidence"))?.sections.event.evidence,
      [`source_note:${canonicalSourceId}`],
    );
    assert.equal(
      (await storage.getNote("world_legacy_target"))?.links[0]?.target,
      "timeline_legacy_evidence",
    );

    await storage.createNote({
      ...noteInput,
      id: "timeline_existing_evidence",
      title: "Existing evidence",
      type: "timeline_event",
      scope: legacySource.scope,
      links: [{ target: canonicalSourceId, relation: "extracted_from" }],
      sections: {
        event: {
          text: "Existing evidence was recorded.",
          updatedAt: timestamp,
        },
      },
    });
    const obsoleteEventMutationId = randomUUID();
    const editableNoteMutationId = randomUUID();
    const editedDependencyDraft = await draftStore.createDraft({
      source: { sourceNoteId: canonicalSourceId, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "Replace a generated dependency with existing evidence.",
        mutations: [
          {
            id: obsoleteEventMutationId,
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create obsolete evidence",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              id: "timeline_obsolete_evidence",
              title: "Obsolete evidence",
              type: "timeline_event",
              status: "active",
              modes: ["roleplay"],
              scope: legacySource.scope,
              tags: ["typed_memory", "timeline_event"],
              keywords: [],
              links: [
                { target: canonicalSourceId, relation: "extracted_from" },
              ],
              sections: {
                event: { text: "Obsolete evidence.", updatedAt: timestamp },
              },
            },
          },
          {
            id: editableNoteMutationId,
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create linked memory",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              ...noteInput,
              id: "world_edited_dependency",
              title: "Edited dependency target",
              scope: legacySource.scope,
              links: [
                {
                  target: "timeline_obsolete_evidence",
                  relation: "evidenced_by",
                },
              ],
            },
          },
        ],
      },
    });
    const editableNoteMutation = editedDependencyDraft.mutations.find(
      (mutation) => mutation.id === editableNoteMutationId,
    ) as Extract<
      (typeof editedDependencyDraft.mutations)[number],
      { kind: "create_note" }
    >;
    const editedDependencyResult = await applyLongTermMemoryDraft(
      editedDependencyDraft.id,
      {
        root,
        mutationIds: [editableNoteMutationId],
        editedMutations: [
          {
            ...editableNoteMutation,
            note: {
              ...editableNoteMutation.note,
              links: [
                {
                  target: "timeline_existing_evidence",
                  relation: "evidenced_by",
                },
              ],
            },
          },
        ],
      },
    );
    assert.deepEqual(editedDependencyResult.appliedMutationIds, [
      editableNoteMutationId,
    ]);
    assert.deepEqual(editedDependencyResult.autoIncludedMutationIds, []);
    assert.equal(await storage.getNote("timeline_obsolete_evidence"), null);
    assert.equal(
      (await storage.getNote("world_edited_dependency"))?.links[0]?.target,
      "timeline_existing_evidence",
    );

    const staticMutationId = randomUUID();
    const staticDraft = await draftStore.createDraft({
      source: { sourceNoteId: canonicalSourceId, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "Create a directly grounded static fact.",
        mutations: [
          {
            id: staticMutationId,
            claimKind: "static",
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create static fact",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              ...noteInput,
              id: "world_static_evidence",
              title: "Static evidence",
              scope: legacySource.scope,
              links: [],
            },
          },
        ],
      },
    });
    const staticApplied = await applyLongTermMemoryDraft(staticDraft.id, {
      root,
      rebuildIndexes: false,
    });
    assert.deepEqual(staticApplied.appliedMutationIds, [staticMutationId]);

    const unlinkedChangeMutationId = randomUUID();
    const unlinkedChangeDraft = await draftStore.createDraft({
      source: { sourceNoteId: canonicalSourceId, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "Reject an unlinked change.",
        mutations: [
          {
            id: unlinkedChangeMutationId,
            claimKind: "change",
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create unlinked change",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              ...noteInput,
              id: "world_unlinked_change",
              title: "Unlinked change",
              scope: legacySource.scope,
              links: [],
            },
          },
        ],
      },
    });
    await assert.rejects(
      applyLongTermMemoryDraft(unlinkedChangeDraft.id, {
        root,
        editedMutations: [
          { id: unlinkedChangeMutationId, claimKind: "static" },
        ],
      }),
      /cannot change claimKind/,
    );
    await assert.rejects(
      applyLongTermMemoryDraft(unlinkedChangeDraft.id, {
        root,
        rebuildIndexes: false,
      }),
      /must link to a timeline event/,
    );

    const secondTargetId = "world_legacy_target_second";
    await storage.createNote({
      ...noteInput,
      id: secondTargetId,
      title: "Second legacy target",
      scope: legacySource.scope,
      links: [],
    });
    const firstLinkId = randomUUID();
    const secondLinkId = randomUUID();
    const partialEventId = randomUUID();
    const partial = await draftStore.createDraft({
      source: { sourceNoteId: canonicalSourceId, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "Link two targets through one source event.",
        mutations: [
          {
            id: partialEventId,
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create shared event",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              id: "timeline_partial_evidence",
              title: "Partial evidence",
              type: "timeline_event",
              status: "active",
              modes: ["roleplay"],
              scope: legacySource.scope,
              tags: ["typed_memory", "timeline_event"],
              keywords: [],
              links: [
                { target: canonicalSourceId, relation: "extracted_from" },
              ],
              sections: {
                event: {
                  text: "Partial evidence was recorded.",
                  updatedAt: timestamp,
                },
              },
            },
          },
          {
            id: firstLinkId,
            kind: "add_link",
            risk: "low",
            confidence: 0.9,
            summary: "Link first target",
            evidence: [`source_note:${canonicalSourceId}`],
            noteId: "world_legacy_target",
            link: {
              target: "timeline_partial_evidence",
              relation: "evidenced_by",
            },
          },
          {
            id: secondLinkId,
            kind: "add_link",
            risk: "low",
            confidence: 0.9,
            summary: "Link second target",
            evidence: [`source_note:${canonicalSourceId}`],
            noteId: secondTargetId,
            link: {
              target: "timeline_partial_evidence",
              relation: "evidenced_by",
            },
          },
        ],
      },
    });
    const firstPartial = await applyLongTermMemoryDraft(partial.id, {
      root,
      mutationIds: [firstLinkId],
    });
    assert.equal(firstPartial.draft.status, "pending");
    assert.deepEqual(
      new Set(firstPartial.appliedMutationIds),
      new Set([partialEventId, firstLinkId]),
    );
    const secondPartial = await applyLongTermMemoryDraft(partial.id, {
      root,
      mutationIds: [secondLinkId],
    });
    assert.equal(secondPartial.draft.status, "accepted");
    assert.equal(
      (await storage.getNote(secondTargetId))?.links[0]?.target,
      "timeline_partial_evidence",
    );

    const skipEventId = randomUUID();
    const skipDependentId = randomUUID();
    const skipSiblingId = randomUUID();
    const keepEventId = randomUUID();
    const keepDependentId = randomUUID();
    const skippedDraft = await draftStore.createDraft({
      source: { sourceNoteId: canonicalSourceId, chatId: "chat-a" },
      scope: legacySource.scope,
      modes: legacySource.modes,
      response: {
        summary: "Skip one event group.",
        mutations: [
          {
            id: skipEventId,
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create skipped event",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              id: "timeline_skip_evidence",
              title: "Skip evidence",
              type: "timeline_event",
              status: "active",
              modes: ["roleplay"],
              scope: legacySource.scope,
              tags: ["typed_memory", "timeline_event"],
              keywords: [],
              links: [
                { target: canonicalSourceId, relation: "extracted_from" },
              ],
              sections: {
                event: {
                  text: "Skipped evidence was recorded.",
                  updatedAt: timestamp,
                },
              },
            },
          },
          {
            id: skipDependentId,
            kind: "add_link",
            risk: "low",
            confidence: 0.9,
            summary: "Link skipped dependent",
            evidence: [`source_note:${canonicalSourceId}`],
            noteId: secondTargetId,
            link: {
              target: "timeline_skip_evidence",
              relation: "evidenced_by",
            },
          },
          {
            id: skipSiblingId,
            claimKind: "static",
            kind: "update_section",
            risk: "low",
            confidence: 0.9,
            summary: "Update skipped dependent",
            evidence: [`source_note:${canonicalSourceId}`],
            noteId: secondTargetId,
            sectionKey: "facts",
            section: {
              text: "Skipped evidence remains available.",
              updatedAt: timestamp,
            },
          },
          {
            id: keepEventId,
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create kept event",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              id: "timeline_keep_evidence",
              title: "Keep evidence",
              type: "timeline_event",
              status: "active",
              modes: ["roleplay"],
              scope: legacySource.scope,
              tags: ["typed_memory", "timeline_event"],
              keywords: [],
              links: [
                { target: canonicalSourceId, relation: "extracted_from" },
              ],
              sections: {
                event: {
                  text: "Kept evidence was recorded.",
                  updatedAt: timestamp,
                },
              },
            },
          },
          {
            id: keepDependentId,
            kind: "create_note",
            risk: "low",
            confidence: 0.9,
            summary: "Create kept dependent",
            evidence: [`source_note:${canonicalSourceId}`],
            note: {
              id: "world_keep_evidence",
              title: "Kept dependent",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: legacySource.scope,
              tags: [],
              keywords: [],
              links: [
                { target: "timeline_keep_evidence", relation: "evidenced_by" },
              ],
              sections: {
                facts: {
                  text: "Kept evidence remains available.",
                  updatedAt: timestamp,
                },
              },
            },
          },
        ],
      },
    });
    const skipped = await draftStore.deleteDraftMutations(skippedDraft.id, [
      skipEventId,
    ]);
    assert.deepEqual(
      new Set(skipped.mutationIds),
      new Set([skipEventId, skipDependentId]),
    );
    assert.equal(
      skipped.mutationIds.length,
      2,
      "cascade response must include every removed mutation id",
    );
    assert.deepEqual(
      new Set(skipped.draft?.mutations.map((mutation) => mutation.id)),
      new Set([skipSiblingId, keepEventId, keepDependentId]),
    );

    const loreSource = await storage.createNote({
      id: "source_lorebook_accounting",
      title: "Lore accounting",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: {},
      tags: ["source_summary", "imported_lorebook"],
      keywords: [],
      links: [],
      provenance: {
        kind: "lorebook",
        sourceId: "lorebook-a",
        entryId: "entry-a",
      },
      sections: {
        source: {
          text: "The cobalt gate was forged and later sealed.",
          updatedAt: timestamp,
        },
      },
    });
    const loreHash = sourceHashForLtmSourceNote(loreSource);
    const unit = (id: string, subjectId: string, text: string) => ({
      id,
      bucket: "timeline_event" as const,
      subjectId,
      sectionKey: "event",
      text,
      importance: "major" as const,
      keywords: [],
      evidence: [`source_note:${loreSource.id}`],
      confidence: 0.9,
      salience: 0.8,
      status: "active" as const,
      links: [],
      sourceHash: loreHash,
    });
    const compiledLore = compileEvidenceUnitExtraction({
      unitResponse: {
        summary: "Gate lore",
        units: [
          unit(randomUUID(), "gate_forged", "The cobalt gate was forged."),
          unit(randomUUID(), "gate_sealed", "The cobalt gate was sealed."),
          {
            ...unit(randomUUID(), "gate", "The cobalt gate is sealed."),
            bucket: "world_fact" as const,
            sectionKey: "facts",
            links: [
              {
                target: "timeline_gate_forged",
                relation: "evidenced_by" as const,
              },
            ],
          },
        ],
      },
      providerCandidates: 3,
      sourceText: loreSource.sections.source.text,
      sourceNote: loreSource,
      existingNotes: [],
      scope: {},
      modes: ["roleplay"],
      mode: "roleplay",
      sourceHash: loreHash,
      skipStructuredBackfill: true,
    });
    assert.equal(compiledLore.accounting.deduplications, 0);
    assert.equal(compiledLore.accounting.keptUnits, 3);
    const loreMutations = compiledLore.compiledResponse.mutations.filter(
      (mutation) => mutation.kind === "create_note",
    );
    assert.equal(
      loreMutations.filter(
        (mutation) => mutation.note.type === "timeline_event",
      ).length,
      2,
    );
    assert.equal(
      loreMutations.find((mutation) => mutation.note.type === "world")?.note
        .links[0]?.target,
      "timeline_gate_forged",
    );
    assert.equal(
      loreMutations
        .filter((mutation) => mutation.note.type === "timeline_event")
        .every((mutation) =>
          mutation.note.links.some(
            (link) =>
              link.relation === "extracted_from" && link.target === loreSource.id,
          ),
        ),
      true,
    );

    const bulkSource = await storage.createNote({
      ...noteInput,
      id: "source_bulk_fixture",
      title: "Bulk source",
      type: "source",
      status: "active",
      links: [],
      provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "bulk" },
      sections: {
        source: { text: "Bulk source evidence.", updatedAt: timestamp },
      },
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
    assert.deepEqual(batch.affectedNoteIds, [
      bulkSource.id,
      "world_bulk_derived",
    ]);
    assert.deepEqual(batch.failedNoteIds, ["world_bulk_missing"]);
    assert.equal((await storage.getNote(bulkSource.id))?.status, "archived");
    assert.equal(
      (await storage.getNote(bulkSource.id))?.tags.includes("bulk_archived"),
      true,
    );
    assert.equal(
      (await storage.getNote("world_bulk_derived"))?.status,
      "archived",
    );
    const bulkEvents = (
      await readFile(getLongTermMemoryDirectories(root).eventLog, "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((event) => event.type.endsWith(".bulk_updated"));
    assert.deepEqual(
      bulkEvents.map((event) => event.target),
      [bulkSource.id, "world_bulk_derived"],
    );
    const noChanges = await storage.bulkMutateNotes({
      noteIds: [bulkSource.id],
      archive: "with_derived",
    });
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
