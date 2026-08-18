import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { runWithSafeCleanup } from "./regression-helpers.ts";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { requestAllNotes } =
    await import("../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/api.ts");
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const requestedOffsets: string[] = [];
  const requestedHeaders: Headers[] = [];
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: () => "  ltm-secret  " } },
    });
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
        "http://localhost",
      );
      requestedHeaders.push(new Headers(init?.headers));
      requestedOffsets.push(url.searchParams.get("offset") ?? "");
      const offset = Number(url.searchParams.get("offset"));
      return new Response(JSON.stringify(offset === 0 ? Array.from({ length: 500 }, (_, id) => id) : [500]));
    }) as typeof fetch;
    assert.equal((await requestAllNotes<number>("/notes?includeGlobal=true")).length, 501);
    assert.deepEqual(requestedOffsets, ["0", "500"]);
    assert.equal(requestedHeaders[0].get("X-Admin-Secret"), "ltm-secret");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
    else globalThis.window = originalWindow;
  }
  requestedOffsets.length = 0;
  requestedHeaders.length = 0;
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: () => null } },
    });
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
        "http://localhost",
      );
      requestedHeaders.push(new Headers(init?.headers));
      requestedOffsets.push(url.searchParams.get("offset") ?? "");
      return new Response(JSON.stringify(Array.from({ length: 500 }, (_, id) => id)));
    }) as typeof fetch;
    await assert.rejects(requestAllNotes<number>("/notes"), {
      message: "Long-Term Memory note limit exceeded (100,000 notes)",
    });
    assert.equal(requestedOffsets.length, 201);
    assert.equal(requestedOffsets.at(-1), "100000");
    assert.equal(requestedHeaders[0].has("X-Admin-Secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
    else globalThis.window = originalWindow;
  }
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { getLongTermMemoryDirectories, getLongTermMemoryRoot, ltmRejectedSuggestionsPath, notePathForId } =
    await import(`${source}/paths.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
  const { LongTermMemoryDraftStore } = await import(`${source}/draft-store.ts`);
  const { applyLongTermMemoryDraft } = await import(`${source}/reconciliation.ts`);
  const { compileEvidenceUnitExtraction } = await import(`${source}/evidence-unit-extraction.ts`);
  const { extractionFingerprintForLtmSourceNote, isLtmSourceExtractionFingerprintCurrent, sourceHashForLtmSourceNote } =
    await import(`${source}/source-hash.ts`);
  const { projectLongTermMemoryDraftReview } = await import(`${source}/draft-review.ts`);
  const { activateLongTermMemoryStorage } = await import(`${source}/runtime.ts`);
  const { ltmSettingsPath } = await import(`${source}/settings.ts`);
  const { ltmMutationTransactionSchema, recoverLtmMutations } = await import(`${source}/mutation-transaction.ts`);
  const { readLtmNoteSummary, writeLtmNoteSummary } = await import(`${source}/index-state.ts`);
  const { runLongTermMemoryRetention } = await import(`${source}/retention.ts`);
  const { rebuildLtmActivityIndex, readLtmActivityEvents } = await import(`${source}/activity-index.ts`);
  const { renderSectionContributions } = await import(`${source}/section-contributions.ts`);
  const { extractNoteKeywords } = await import(`${source}/keyword-extract.ts`);
  const { mergeKeywords } = await import(`${source}/keyword-extract.ts`);
  const { getLtmActiveKeywords, ltmKeywordKey, normalizeLtmKeywordIntent } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/keywords.ts");
  const { ltmScopesOverlap, validateLtmExplicitAvailability } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/scope.ts");
  const { normalizeDetailName } =
    await import("../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/detail-name.ts");
  const {
    exportLongTermMemoryData,
    replaceLongTermMemoryData,
    deleteAllLongTermMemoryData,
    resetLongTermMemorySettings,
    parseLongTermMemoryBackup,
  } = await import(`${source}/backup-restore.ts`);
  const { addRejectedSuggestions, deleteRejectedSuggestion, listRejectedSuggestions } = await import(
    `${source}/rejected-suggestions.ts`
  );

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-storage-"));
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const releaseHost = configurePackageRuntime({ dataDir, logger });
  const root = join(dataDir, "long-term-memory");
  const freshRoot = join(dataDir, "fresh-long-term-memory");
  const timestamp = "2026-07-17T00:00:00.000Z";
  const noteInput = {
    id: "world_restart_proof",
    title: "Restart proof",
    type: "world",
    modes: ["roleplay"],
    scope: { chatId: "chat-a", chatIds: ["chat-a"] },
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

  let first: Awaited<ReturnType<typeof activateLongTermMemoryStorage>> | null = null;
  let restarted: Awaited<ReturnType<typeof activateLongTermMemoryStorage>> | null = null;
  await runWithSafeCleanup(
    "LTM storage",
    async () => {
      const freshStorage = new LongTermMemoryStorage(freshRoot);
      await freshStorage.initializeLtmStore();
      for (const name of ["policies.json", "retrieval.json"]) {
        await assert.rejects(
          stat(join(freshRoot, "config", name)),
          { code: "ENOENT" },
          `fresh stores must omit inert ${name}`,
        );
      }

      assert.equal(getLongTermMemoryRoot(), root, "default root must remain join(dataDir, 'long-term-memory')");
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
      first = await activateLongTermMemoryStorage(root);
      assert.equal(await first.storage.getNote("source_turn_legacy"), null);
      assert.equal((await first.storage.getNote("source_valid_import"))?.id, "source_valid_import");
      const quarantineEntries = await readdir(join(root, "quarantine"));
      const capturedTurnQuarantine = quarantineEntries.find((entry) => entry.startsWith("legacy-captured-turns-"));
      assert.ok(capturedTurnQuarantine);
      assert.deepEqual(await readdir(join(root, "quarantine", capturedTurnQuarantine)), ["source_turn_legacy.json"]);
      await first.storage.createNote(noteInput);
      await first.cleanup();
      first = null;
      restarted = await activateLongTermMemoryStorage(root);
      assert.equal(
        (await restarted.storage.getNote(noteInput.id))?.sections.facts?.text,
        "This note survives runtime restart.",
      );

      const interruptedNotes = ["world_interrupted_a", "world_interrupted_b"].map((id, index) => ({
        ...noteInput,
        id,
        title: `Interrupted ${index + 1}`,
        status: "active" as const,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }));
      const interruptedIds = interruptedNotes.map(() => randomUUID());
      for (const [index, interruptedNote] of interruptedNotes.entries()) {
        const transaction = ltmMutationTransactionSchema.parse({
          version: 1,
          id: interruptedIds[index],
          createdAt: new Date(Date.parse(timestamp) + index).toISOString(),
          status: "committed",
          files: [
            {
              path: `vault/world/${interruptedNote.id}.json`,
              before: null,
              after: interruptedNote,
            },
          ],
          events: [],
        });
        await writeFile(notePathForId(interruptedNote.id, "world", root), `${JSON.stringify(interruptedNote)}\n`);
        await writeFile(
          join(getLongTermMemoryDirectories(root).transactions, `${transaction.id}.json`),
          `${JSON.stringify(transaction)}\n`,
        );
      }
      const malformedJournal = join(getLongTermMemoryDirectories(root).transactions, "malformed.json");
      await writeFile(malformedJournal, "{not-json\n");
      const notesBeforeRecovery = await restarted.storage.listNotes();
      await writeLtmNoteSummary(root, notesBeforeRecovery);
      await recoverLtmMutations(root);
      assert.equal((await readLtmNoteSummary(root)).total, notesBeforeRecovery.length);
      for (const [index, interruptedNote] of interruptedNotes.entries()) {
        assert.equal(
          JSON.parse(await readFile(notePathForId(interruptedNote.id, "world", root), "utf8")).id,
          interruptedNote.id,
        );
        await assert.rejects(
          stat(join(getLongTermMemoryDirectories(root).transactions, `${interruptedIds[index]}.json`)),
        );
      }
      await assert.rejects(stat(malformedJournal));
      const transactionQuarantine = join(root, "quarantine", "transactions");
      const quarantinedTransactions = await readdir(transactionQuarantine);
      assert.equal(quarantinedTransactions.length, 1);
      assert.equal(
        await readFile(join(transactionQuarantine, quarantinedTransactions[0]!, "malformed.json"), "utf8"),
        "{not-json\n",
      );

      await writeFile(ltmSettingsPath(root), '{"version":1,"unknown":true}\n');
      await restarted.cleanup();
      restarted = null;
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
      const dirs = getLongTermMemoryDirectories(root);
      await writeFile(join(dirs.receipts, "malformed.json"), "{bad\n");
      await writeFile(
        join(dirs.receipts, "expired.json"),
        JSON.stringify({ dispatchedAt: "2020-01-01T00:00:00.000Z" }),
      );
      await writeFile(
        dirs.eventLog,
        [
          JSON.stringify({ ts: "2020-01-01T00:00:00.000Z", type: "old.event" }),
          "malformed event",
          JSON.stringify({ ts: "2026-07-17T00:00:00.000Z", type: "new.event" }),
          "",
        ].join("\n"),
      );
      const retained = await runLongTermMemoryRetention({
        root,
        now: new Date("2026-07-18T00:00:00Z"),
        force: true,
      });
      assert.equal(retained.receiptsRemoved, 1);
      assert.equal(retained.eventsRemoved, 1);
      assert.equal(await readFile(join(dirs.receipts, "malformed.json"), "utf8"), "{bad\n");
      await assert.rejects(stat(join(dirs.receipts, "expired.json")));
      assert.equal(
        await readFile(dirs.eventLog, "utf8"),
        `malformed event\n${JSON.stringify({ ts: "2026-07-17T00:00:00.000Z", type: "new.event" })}\n`,
      );

      const exported = await exportLongTermMemoryData(root);
      assert.equal(exported.format, "marinara-long-term-memory");
      assert.equal(
        exported.notes.some((note) => note.id === noteInput.id),
        true,
      );
      assert.equal("indexes" in exported, false);
      assert.equal("policies" in exported.settings, false);
      assert.equal("retrieval" in exported.settings, false);
      const rejectionDraft = {
        id: randomUUID(),
        status: "pending",
        applyState: "not_started",
        indexRebuildStatus: "not_requested",
        createdAt: timestamp,
        updatedAt: timestamp,
        source: { sourceNoteId: "source_valid_import", chatId: "chat-a" },
        scope: { chatId: "chat-a" },
        modes: ["roleplay"],
        summary: "",
        mutations: [],
        extractionOutcome: {
          state: "no_suggestions_created",
          totalCandidates: 1,
          keptUnits: 0,
          droppedUnits: 1,
          droppedCandidates: [
            { index: 0, reason: "invalid_format", message: "Rejected candidate.", snippet: "candidate" },
          ],
          droppedCandidateDetailsTruncated: false,
        },
      } as any;
      const secondRejectionDraft = {
        ...rejectionDraft,
        source: { sourceNoteId: "source_second_import", chatId: "chat-a" },
      };
      const [firstRejections, secondRejections] = await Promise.all([
        addRejectedSuggestions(rejectionDraft, root),
        addRejectedSuggestions(secondRejectionDraft, root),
      ]);
      assert.equal(firstRejections.length, 1);
      assert.equal(secondRejections.length, 1);
      assert.equal((await listRejectedSuggestions({ chatId: "chat-a" }, root)).length, 2);
      assert.equal((await exportLongTermMemoryData(root)).rejectedSuggestions.length, 2);
      await addRejectedSuggestions(rejectionDraft, root);
      await addRejectedSuggestions(rejectionDraft, root);
      assert.equal((await listRejectedSuggestions({ chatId: "chat-a" }, root)).length, 2);
      const rejectionId = firstRejections[0]!.id;
      assert.deepEqual(await deleteRejectedSuggestion(rejectionId, root), { deleted: true, id: rejectionId });
      assert.deepEqual(await deleteRejectedSuggestion(rejectionId, root), { deleted: false, id: rejectionId });
      await writeFile(ltmRejectedSuggestionsPath(root), JSON.stringify([{ malformed: true }]));
      await assert.rejects(() => listRejectedSuggestions({}, root), /invalid|expected|required|malformed/i);
      await rm(ltmRejectedSuggestionsPath(root), { force: true });
      const legacyBackup = parseLongTermMemoryBackup({
        ...exported,
        settings: {
          ...exported.settings,
          policies: { version: 1, policies: [] },
          retrieval: {
            version: 1,
            maxChunks: 12,
            maxTokens: 2048,
            semanticWeight: 0.6,
            lexicalWeight: 0.3,
            graphWeight: 0.1,
            keywordWeight: 0.2,
            maxMetadataCandidates: 256,
            maxDirectCandidates: 128,
            maxLexicalCandidates: 128,
            maxKeywordCandidates: 128,
            maxVectorCandidates: 256,
            maxGraphCandidates: 128,
            maxMandatoryCandidates: 128,
          },
        },
      });
      assert.throws(
        () =>
          parseLongTermMemoryBackup({
            ...exported,
            notes: [
              {
                ...exported.notes[0]!,
                scope: { chatId: "chat-a", chatIds: ["chat-b"] },
              },
            ],
          }),
        /same scope/u,
        "backups must reject contradictory scalar and array scope aliases",
      );
      await replaceLongTermMemoryData(legacyBackup, freshRoot);
      const reexportedLegacy = await exportLongTermMemoryData(freshRoot);
      assert.equal("policies" in reexportedLegacy.settings, false);
      assert.equal("retrieval" in reexportedLegacy.settings, false);
      for (const [key, value] of [
        ["policies", { version: 1, policies: [{ type: "world", bad: true }] }],
        ["retrieval", { version: 1, maxChunks: 0 }],
      ] as const) {
        assert.throws(
          () =>
            parseLongTermMemoryBackup({
              ...exported,
              settings: { ...exported.settings, [key]: value },
            }),
          /unrecognized|unknown|greater than or equal/i,
          `malformed legacy ${key} fields must remain rejected`,
        );
      }
      const importedNote = exported.notes.find((note) => note.id === noteInput.id)!;
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
      assert.equal(await new LongTermMemoryStorage(root).getNote(noteInput.id), null);
      assert.equal((await new LongTermMemoryStorage(root).getNote("world_imported_backup"))?.title, "Imported backup");
      await resetLongTermMemorySettings(root);
      assert.equal((await exportLongTermMemoryData(root)).notes.length, 1);
      await deleteAllLongTermMemoryData(root);
      assert.equal((await new LongTermMemoryStorage(root).listNotes()).length, 0);
      assert.equal((await exportLongTermMemoryData(root)).settings.global.version, 1);

      const storage = new LongTermMemoryStorage(root);
      assert.deepEqual(
        normalizeLtmKeywordIntent({ keywords: ["Legacy keyword"] }),
        {
          keywords: [],
          manualKeywords: ["Legacy keyword"],
          suppressedKeywords: [],
        },
        "legacy keywords must remain editable after lazy migration",
      );
      assert.equal(
        validateLtmExplicitAvailability({}, ["roleplay"]),
        "Choose at least one place where this memory is available.",
      );
      assert.equal(validateLtmExplicitAvailability({ chatId: "chat-a" }, []), "Choose at least one chat mode.");
      assert.equal(validateLtmExplicitAvailability({ chatId: "chat-a" }, ["roleplay"]), null);
      assert.equal(normalizeDetailName("Current state"), "current_state");
      assert.equal(normalizeDetailName(" Important facts! "), "important_facts");
      assert.equal(ltmKeywordKey(" I "), "i");
      assert.deepEqual(mergeKeywords(["Cobalt-Moon"], ["cobalt moon"], 30), ["cobalt moon"]);
      assert.equal(
        ltmScopesOverlap(
          { characterIds: ["character-a"] },
          {},
          { characterIds: ["character-b"], includeGlobal: false },
        ),
        false,
      );
      assert.equal(
        ltmScopesOverlap({ personaIds: ["persona-a"] }, {}, { personaIds: ["persona-b"], includeGlobal: false }),
        false,
      );
      await assert.rejects(
        storage.createNote({ ...noteInput, id: "world_storage_global_rejected", scope: {} }),
        (error: any) => error.code === "ltm_explicit_availability_required",
        "storage must reject new non-source global memories even when callers bypass routes",
      );
      for (const scope of [
        { chatId: "chat-a", chatIds: ["chat-b"] },
        { groupId: "group-a", groupIds: ["group-b"] },
        { personaId: "persona-a", personaIds: ["persona-b"] },
      ]) {
        await assert.rejects(
          storage.createNote({
            ...noteInput,
            id: `world_scope_conflict_${Object.keys(scope)[0]}`,
            scope,
          }),
          /same scope/u,
        );
      }
      const projectScopeTarget = await storage.createNote({
        ...noteInput,
        id: "world_scope_update_target",
      });
      await assert.rejects(
        storage.updateNote(projectScopeTarget.id, {
          scope: { chatId: "chat-a", chatIds: ["chat-b"] },
        }),
        (error: any) => error.code === "ltm_scope_alias_conflict",
      );
      await assert.rejects(
        storage.bulkMutateNotes({
          noteIds: [projectScopeTarget.id],
          addScope: { groupId: "group-a", groupIds: ["group-b"] },
        }),
        /same scope/u,
      );
      await assert.rejects(
        storage.createNote({ ...noteInput, id: "world_empty_storage", sections: {} }),
        (error: any) => error.code === "ltm_empty_sections",
      );
      await assert.rejects(
        storage.projectNote("world_empty_project", "world", () => ({
          ...noteInput,
          id: "world_empty_project",
          sections: {},
        })),
        (error: any) => error.code === "ltm_empty_sections",
      );
      assert.equal(await storage.getNote("world_empty_project"), null);
      const keywordIntent = await storage.createNote({
        ...noteInput,
        id: "world_keyword_intent",
        keywords: ["Cobalt", "cobalt"],
        sections: {
          facts: { text: "Cobalt appears in this memory.", updatedAt: timestamp },
        },
      });
      assert.deepEqual(keywordIntent.keywords, ["Cobalt"]);
      assert.deepEqual(keywordIntent.manualKeywords, []);
      const suppressedKeyword = await storage.updateNote(keywordIntent.id, {
        manualKeywords: ["Manual", "manual"],
        suppressedKeywords: ["cobalt"],
      });
      assert.deepEqual(getLtmActiveKeywords(suppressedKeyword), ["Manual"]);
      assert.equal(
        extractNoteKeywords(suppressedKeyword).some((keyword) => keyword.toLowerCase() === "cobalt"),
        false,
        "suppressed generated and text-derived keywords must stay out of recall indexing",
      );
      const restoredKeyword = await storage.updateNote(keywordIntent.id, {
        manualKeywords: ["Manual", "Cobalt"],
        suppressedKeywords: [],
      });
      assert.deepEqual(getLtmActiveKeywords(restoredKeyword), ["Cobalt", "Manual"]);
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
      const scopedFingerprintSource = {
        ...legacySource,
        scope: {
          chatId: "chat-a",
          chatIds: ["chat-a"],
          groupId: "group-a",
          groupIds: ["group-a"],
          personaId: "persona-a",
          personaIds: ["persona-a"],
        },
      };
      const currentFingerprint = extractionFingerprintForLtmSourceNote(scopedFingerprintSource);
      assert.equal(currentFingerprint.version, 3);
      assert.equal(
        isLtmSourceExtractionFingerprintCurrent(scopedFingerprintSource, {
          ...currentFingerprint,
          version: 2,
          scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        }),
        false,
        "legacy scoped fingerprints must require re-extraction",
      );
      await storage.createNote({
        ...noteInput,
        id: "world_legacy_target",
        title: "Legacy target",
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        links: [],
        sections: {
          facts: noteInput.sections.facts,
          links: { text: "Existing links detail.", updatedAt: timestamp },
        },
      });
      const draftStore = new LongTermMemoryDraftStore(root);
      let afterWriteRan = false;
      let afterWriteDraftId = "";
      await assert.rejects(
        draftStore.createDraft({
          source: { sourceNoteId: legacySource.id, chatId: "chat-a" },
          scope: legacySource.scope,
          modes: ["roleplay"],
          response: { summary: "After-write failure proof.", mutations: [] },
          afterWrite: async (draft) => {
            afterWriteRan = true;
            afterWriteDraftId = draft.id;
            throw new Error("after-write fixture failure");
          },
        }),
        /after-write fixture failure/u,
      );
      assert.equal(afterWriteRan, true);
      assert.ok(afterWriteDraftId);
      assert.ok(await draftStore.getDraft(afterWriteDraftId), "afterWrite failure must not roll back the draft");
      await draftStore.deleteDraft(afterWriteDraftId);
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
      assert.equal((await draftStore.getDraft(suggestionDraft.id))?.status, "superseded");
      assert.equal((await draftStore.getDraft(suggestionDraft.id))?.supersededByDraftId, zeroSuggestionDraft.id);
      assert.deepEqual(
        (await draftStore.listDrafts({ status: "pending" })).map((draft) => draft.id),
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
            {
              id: randomUUID(),
              kind: "update_section",
              risk: "low",
              confidence: 0.9,
              summary: "Keep the renamed section target current.",
              evidence: [`source_note:${legacySource.id}`],
              noteId: "world_legacy_target",
              sectionKey: "facts",
              section: {
                text: "A pending section update.",
                updatedAt: timestamp,
              },
            },
          ],
        },
      });
      const beforeRename = await storage.getNote("world_legacy_target");
      await assert.rejects(
        storage.renameNoteSection("world_legacy_target", "facts", "links"),
        (error: any) => error.code === "ltm_section_already_exists",
      );
      await addRejectedSuggestions(
        {
          ...rejectionDraft,
          source: { sourceNoteId: legacySource.id, chatId: "chat-a" },
          extractionOutcome: {
            ...rejectionDraft.extractionOutcome,
            droppedCandidates: [
              {
                index: 0,
                reason: "invalid_format",
                message: "Renamed recovery.",
                recovery: { noteId: "world_legacy_target", sectionKey: "facts" },
              },
            ],
          },
        },
        root,
      );
      assert.deepEqual(
        Object.keys((await storage.getNote("world_legacy_target"))!.sections),
        Object.keys(beforeRename!.sections),
      );
      const renamePreview = await storage.previewNoteSectionRename("world_legacy_target", "facts", "details");
      assert.deepEqual(renamePreview, {
        fromSectionKey: "facts",
        toSectionKey: "details",
        rewrittenDraftCount: 1,
        rewrittenDraftIds: [pending.id],
      });
      const renamedSection = await storage.renameNoteSection("world_legacy_target", "facts", "details");
      assert.deepEqual(Object.keys(renamedSection.note.sections), ["details", "links"]);
      assert.equal(renamedSection.note.sections.details?.text, beforeRename?.sections.facts?.text);
      assert.equal(renamedSection.rewrittenDraftCount, 1);
      assert.equal(
        (await listRejectedSuggestions({}, root)).some(
          (suggestion) =>
            suggestion.candidate.recovery?.noteId === "world_legacy_target" &&
            suggestion.candidate.recovery?.sectionKey === "details",
        ),
        true,
        "section rename must atomically preserve rejected-suggestion recovery targets",
      );
      const sectionRenamedDraft = await draftStore.getDraft(pending.id);
      assert.equal(
        (
          sectionRenamedDraft?.mutations.find(
            (mutation) => mutation.kind === "update_section" && mutation.noteId === "world_legacy_target",
          ) as any
        ).sectionKey,
        "details",
      );
      const sectionRenameEvents = (await readFile(getLongTermMemoryDirectories(root).eventLog, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const sectionRenameEvent = sectionRenameEvents.find(
        (event) => event.type === "world.section_renamed" && event.target === "world_legacy_target",
      );
      assert.deepEqual(sectionRenameEvent?.payload, {
        note: renamedSection.note,
        fromSectionKey: "facts",
        toSectionKey: "details",
      });
      const canonicalSourceId = "source_chat_summary_1234567890abcdef";
      await storage.renameNoteId(legacySource.id, canonicalSourceId);
      const rewrittenDraft = await draftStore.getDraft(pending.id);
      assert.equal(rewrittenDraft?.source.sourceNoteId, canonicalSourceId);
      assert.equal(rewrittenDraft?.source.extractionFingerprint?.sourceHash, rewrittenDraft?.source.sourceHash);
      assert.equal((rewrittenDraft?.mutations[0] as any).note.links[0].target, canonicalSourceId);
      const review = await projectLongTermMemoryDraftReview({
        root,
        sourceNoteId: canonicalSourceId,
      });
      assert.equal(review.counts.drafts, 1);
      const rewrittenEventMutation = rewrittenDraft?.mutations.find((mutation) => mutation.id === eventMutationId);
      assert.equal(rewrittenEventMutation?.kind, "create_note");
      assert.equal(rewrittenEventMutation?.claimKind, "change");
      const editedEventMutation = {
        ...rewrittenEventMutation!,
        note: {
          ...(rewrittenEventMutation as Extract<(typeof pending.mutations)[number], { kind: "create_note" }>).note,
          title: "Edited dependency",
        },
      };
      const applied = await applyLongTermMemoryDraft(pending.id, {
        root,
        mutationIds: [mutationId],
        editedMutations: [editedEventMutation],
      });
      assert.deepEqual(new Set(applied.appliedMutationIds), new Set([eventMutationId, mutationId]));
      assert.equal((await storage.getNote("timeline_legacy_evidence"))?.title, "Edited dependency");
      assert.deepEqual((await storage.getNote("timeline_legacy_evidence"))?.sections.event.evidence, [
        `source_note:${canonicalSourceId}`,
      ]);
      assert.equal((await storage.getNote("world_legacy_target"))?.links[0]?.target, "timeline_legacy_evidence");

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
                links: [{ target: canonicalSourceId, relation: "extracted_from" }],
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
      ) as Extract<(typeof editedDependencyDraft.mutations)[number], { kind: "create_note" }>;
      const editedDependencyResult = await applyLongTermMemoryDraft(editedDependencyDraft.id, {
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
      });
      assert.deepEqual(editedDependencyResult.appliedMutationIds, [editableNoteMutationId]);
      assert.deepEqual(editedDependencyResult.autoIncludedMutationIds, []);
      assert.equal(await storage.getNote("timeline_obsolete_evidence"), null);
      assert.equal((await storage.getNote("world_edited_dependency"))?.links[0]?.target, "timeline_existing_evidence");

      await storage.createNote({
        id: "timeline_existing_unbound",
        title: "Existing unbound event",
        type: "timeline_event",
        status: "active",
        modes: ["roleplay"],
        scope: legacySource.scope,
        tags: ["typed_memory", "timeline_event"],
        keywords: [],
        links: [],
        sections: {
          event: {
            text: "An event awaiting source grounding.",
            updatedAt: timestamp,
          },
        },
      });
      await storage.createNote({
        id: "rel_existing_unbound",
        title: "Existing unbound relationship",
        type: "relationship",
        status: "active",
        modes: ["roleplay"],
        scope: legacySource.scope,
        tags: ["typed_memory", "relationship"],
        keywords: [],
        links: [{ target: "timeline_existing_unbound", relation: "caused_by" }],
        sections: {
          state: { text: "Their trust is changing.", updatedAt: timestamp },
        },
      });
      const groundEventMutationId = randomUUID();
      const updateRelationshipMutationId = randomUUID();
      const existingEventDependencyDraft = await draftStore.createDraft({
        source: { sourceNoteId: canonicalSourceId, chatId: "chat-a" },
        scope: legacySource.scope,
        modes: legacySource.modes,
        response: {
          summary: "Ground an existing event before applying a relationship change.",
          mutations: [
            {
              id: groundEventMutationId,
              kind: "add_link",
              risk: "low",
              confidence: 0.9,
              summary: "Ground existing event",
              evidence: [`source_note:${canonicalSourceId}`],
              noteId: "timeline_existing_unbound",
              link: { target: canonicalSourceId, relation: "extracted_from" },
            },
            {
              id: updateRelationshipMutationId,
              claimKind: "change",
              kind: "update_section",
              risk: "low",
              confidence: 0.9,
              summary: "Update existing relationship",
              evidence: [`source_note:${canonicalSourceId}`],
              noteId: "rel_existing_unbound",
              sectionKey: "state",
              section: {
                text: "Their trust became strained.",
                updatedAt: timestamp,
              },
            },
          ],
        },
      });
      const existingEventDependencyResult = await applyLongTermMemoryDraft(existingEventDependencyDraft.id, {
        root,
        mutationIds: [updateRelationshipMutationId],
        rebuildIndexes: false,
      });
      assert.deepEqual(
        new Set(existingEventDependencyResult.appliedMutationIds),
        new Set([groundEventMutationId, updateRelationshipMutationId]),
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
          editedMutations: [{ id: unlinkedChangeMutationId, claimKind: "static" }],
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
                links: [{ target: canonicalSourceId, relation: "extracted_from" }],
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
      assert.deepEqual(new Set(firstPartial.appliedMutationIds), new Set([partialEventId, firstLinkId]));
      const secondPartial = await applyLongTermMemoryDraft(partial.id, {
        root,
        mutationIds: [secondLinkId],
      });
      assert.equal(secondPartial.draft.status, "accepted");
      assert.equal((await storage.getNote(secondTargetId))?.links[0]?.target, "timeline_partial_evidence");

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
                links: [{ target: canonicalSourceId, relation: "extracted_from" }],
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
                links: [{ target: canonicalSourceId, relation: "extracted_from" }],
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
                links: [{ target: "timeline_keep_evidence", relation: "evidenced_by" }],
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
      const skipped = await draftStore.deleteDraftMutations(skippedDraft.id, [skipEventId]);
      assert.deepEqual(new Set(skipped.mutationIds), new Set([skipEventId, skipDependentId]));
      assert.equal(skipped.mutationIds.length, 2, "cascade response must include every removed mutation id");
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
      assert.equal(loreMutations.filter((mutation) => mutation.note.type === "timeline_event").length, 2);
      assert.equal(
        loreMutations.find((mutation) => mutation.note.type === "world")?.note.links[0]?.target,
        "timeline_gate_forged",
      );
      assert.equal(
        loreMutations
          .filter((mutation) => mutation.note.type === "timeline_event")
          .every((mutation) =>
            mutation.note.links.some((link) => link.relation === "extracted_from" && link.target === loreSource.id),
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

      const availabilityNote = await storage.createNote({
        ...noteInput,
        id: "world_availability_fixture",
        title: "Availability fixture",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      });
      const legacyGlobal = (
        await storage.projectNote("world_availability_global", "world", () => ({
          ...noteInput,
          id: "world_availability_global",
          title: "Legacy global availability",
          modes: ["conversation"],
          scope: {},
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
        }))
      ).note!;
      const availabilityAdded = await storage.bulkMutateNotes({
        noteIds: [availabilityNote.id, legacyGlobal.id],
        addScope: { characterIds: ["character-a"] },
        enableModes: ["game"],
      });
      assert.equal(availabilityAdded.status, "complete");
      await assert.rejects(
        storage.bulkMutateNotes({
          noteIds: [availabilityNote.id],
          addScope: { chatIds: ["chat-a"] },
          removeScope: { chatId: "chat-a" },
        }),
        /cannot be added and removed/u,
      );
      assert.deepEqual((await storage.getNote(availabilityNote.id))?.scope, {
        chatId: "chat-a",
        chatIds: ["chat-a"],
        characterIds: ["character-a"],
      });
      assert.deepEqual((await storage.getNote(availabilityNote.id))?.modes, ["roleplay", "game"]);
      assert.deepEqual((await storage.getNote(legacyGlobal.id))?.scope, { characterIds: ["character-a"] });
      const availabilityRemoved = await storage.bulkMutateNotes({
        noteIds: [availabilityNote.id],
        removeScope: { characterIds: ["character-a"] },
        disableModes: ["game"],
      });
      assert.equal(availabilityRemoved.status, "complete");
      assert.deepEqual((await storage.getNote(availabilityNote.id))?.modes, ["roleplay"]);
      const multipleAvailabilityAdded = await storage.bulkMutateNotes({
        noteIds: [availabilityNote.id],
        addScope: {
          chatIds: ["chat-b"],
          groupIds: ["group-a"],
          characterIds: ["character-b"],
          personaIds: ["persona-a"],
        },
      });
      assert.equal(multipleAvailabilityAdded.status, "complete");
      assert.deepEqual((await storage.getNote(availabilityNote.id))?.scope, {
        chatId: "chat-a",
        chatIds: ["chat-a", "chat-b"],
        groupId: "group-a",
        groupIds: ["group-a"],
        characterIds: ["character-b"],
        personaId: "persona-a",
        personaIds: ["persona-a"],
      });
      const multipleAvailabilityRemoved = await storage.bulkMutateNotes({
        noteIds: [availabilityNote.id],
        removeScope: {
          chatIds: ["chat-b"],
          groupIds: ["group-a"],
          characterIds: ["character-b"],
          personaIds: ["persona-a"],
        },
      });
      assert.equal(multipleAvailabilityRemoved.status, "complete");
      assert.deepEqual((await storage.getNote(availabilityNote.id))?.scope, {
        chatId: "chat-a",
        chatIds: ["chat-a"],
      });
      const finalAvailability = await storage.bulkMutateNotes({
        noteIds: [availabilityNote.id],
        removeScope: { chatIds: ["chat-a"] },
        disableModes: ["roleplay"],
      });
      assert.equal(finalAvailability.status, "no_changes");
      assert.deepEqual(finalAvailability.skippedNoteIds, [availabilityNote.id]);
      await assert.rejects(
        storage.bulkMutateNotes({
          noteIds: [availabilityNote.id],
          modes: ["roleplay"],
          enableModes: ["game"],
        }),
        /Modes cannot be combined/u,
      );

      const retractSourceA = await storage.createNote({
        ...noteInput,
        id: "source_retract_a",
        title: "Retraction source A",
        type: "source",
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "a" },
        sections: { source: { text: "Evidence A.", updatedAt: timestamp } },
      });
      const retractSourceB = await storage.createNote({
        ...noteInput,
        id: "source_retract_b",
        title: "Retraction source B",
        type: "source",
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "b" },
        sections: { source: { text: "Evidence B.", updatedAt: timestamp } },
      });
      const hashA = sourceHashForLtmSourceNote(retractSourceA);
      const hashB = sourceHashForLtmSourceNote(retractSourceB);
      const sourceContribution = (sourceNoteId: string, sourceHash: string, text: string) => ({
        owner: "source" as const,
        sourceNoteId,
        sourceHash,
        text,
        updatedAt: timestamp,
        evidence: [`source_note:${sourceNoteId}`],
      });
      const nonSourceRoot = await storage.createNote({
        ...noteInput,
        id: "world_retract_non_source_root",
        title: "Non-source retraction root",
        sections: { facts: { text: "Root fact.", updatedAt: timestamp } },
      });
      const nonSourceChild = await storage.projectNote("world_retract_non_source_child", "world", () => ({
        ...noteInput,
        id: "world_retract_non_source_child",
        title: "Non-source child",
        status: "active",
        links: [{ target: nonSourceRoot.id, relation: "extracted_from" }],
        sections: {
          facts: renderSectionContributions(
            [sourceContribution(nonSourceRoot.id, "0".repeat(64), "Child fact.")],
            true,
          )!,
        },
      }));
      const nonSourceDelete = await storage.deleteNotesPermanently([nonSourceRoot.id], { retractExtracted: true });
      assert.deepEqual(nonSourceDelete.deletedIds, [nonSourceRoot.id]);
      assert.equal(
        (await storage.getNote(nonSourceChild.note!.id))?.sections.facts.text,
        "Child fact.",
        "non-source deletion must not retract descendant content",
      );
      assert.deepEqual(
        (await storage.getNote(nonSourceChild.note!.id))?.links,
        [],
        "deletion may detach the missing parent link without retracting content",
      );
      const sharedFacts = renderSectionContributions(
        [
          sourceContribution(retractSourceA.id, hashA, "Shared durable fact."),
          sourceContribution(retractSourceB.id, hashB, "Shared durable fact."),
          sourceContribution(retractSourceB.id, hashB, "B-only durable fact."),
        ],
        true,
      );
      await storage.projectNote("world_retract_shared", "world", () => ({
        ...noteInput,
        id: "world_retract_shared",
        title: "Shared extracted memory",
        status: "active",
        links: [
          { target: retractSourceA.id, relation: "extracted_from" },
          { target: retractSourceB.id, relation: "extracted_from" },
        ],
        sections: { facts: sharedFacts! },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }));
      await storage.projectNote("world_retract_empty", "world", () => ({
        ...noteInput,
        id: "world_retract_empty",
        title: "A-only extracted memory",
        status: "active",
        links: [{ target: retractSourceA.id, relation: "extracted_from" }],
        sections: {
          facts: renderSectionContributions([sourceContribution(retractSourceA.id, hashA, "A-only fact.")], true)!,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }));
      await storage.projectNote("world_retract_manual", "world", () => ({
        ...noteInput,
        id: "world_retract_manual",
        title: "Manually edited memory",
        status: "active",
        links: [{ target: retractSourceA.id, relation: "extracted_from" }],
        sections: {
          facts: renderSectionContributions([sourceContribution(retractSourceA.id, hashA, "Extracted fact.")], true)!,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }));
      const manual = await storage.updateNote("world_retract_manual", {
        sections: {
          facts: { text: "Manually preserved fact.", updatedAt: timestamp },
        },
      });
      assert.deepEqual(
        manual.sections.facts.contributions?.map((item) => item.owner),
        ["source", "manual"],
      );
      assert.equal(manual.sections.facts.text, "Extracted fact.\n\nManually preserved fact.");
      assert.deepEqual(manual.sections.facts.evidence, [`source_note:${retractSourceA.id}`]);

      await storage.projectNote("rel_retract_fallback", "relationship", () => ({
        ...noteInput,
        id: "rel_retract_fallback",
        title: "Superseding fallback",
        type: "relationship",
        status: "active",
        links: [
          { target: retractSourceA.id, relation: "extracted_from" },
          { target: retractSourceB.id, relation: "extracted_from" },
        ],
        sections: {
          state: renderSectionContributions(
            [
              sourceContribution(retractSourceB.id, hashB, "Earlier B state."),
              sourceContribution(retractSourceA.id, hashA, "Latest A state."),
            ],
            false,
          )!,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }));

      const uncheckedSource = await storage.createNote({
        ...noteInput,
        id: "source_retract_unchecked",
        title: "Unchecked source",
        type: "source",
        provenance: {
          kind: "chat_summary",
          sourceId: "chat-a",
          entryId: "unchecked",
        },
        sections: {
          source: { text: "Unchecked evidence.", updatedAt: timestamp },
        },
      });
      await storage.projectNote("world_retract_unchecked", "world", () => ({
        ...noteInput,
        id: "world_retract_unchecked",
        title: "Unchecked extracted memory",
        status: "active",
        links: [{ target: uncheckedSource.id, relation: "extracted_from" }],
        sections: {
          facts: renderSectionContributions(
            [sourceContribution(uncheckedSource.id, sourceHashForLtmSourceNote(uncheckedSource), "Unchecked fact.")],
            true,
          )!,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }));
      await assert.rejects(
        storage.deleteNotesPermanently([uncheckedSource.id]),
        (error: any) => error.code === "ltm_source_lineage_preview_required",
      );
      const uncheckedMemory = await storage.getNote("world_retract_unchecked");
      assert.equal(uncheckedMemory?.sections.facts.text, "Unchecked fact.");
      assert.deepEqual(uncheckedMemory?.links, [{ target: uncheckedSource.id, relation: "extracted_from" }]);

      const retracted = await storage.deleteNotesPermanently([retractSourceA.id, "world_retract_empty"], {
        retractExtracted: true,
        excludedNoteIds: ["world_retract_shared", "world_retract_manual", "rel_retract_fallback"],
        lineageSourceNoteId: retractSourceA.id,
        expectedLineageNoteIds: [
          retractSourceA.id,
          "world_retract_shared",
          "world_retract_empty",
          "world_retract_manual",
          "rel_retract_fallback",
        ],
      });
      assert.deepEqual(retracted.deletedIds.sort(), [retractSourceA.id, "world_retract_empty"]);
      const retainedShared = await storage.getNote("world_retract_shared");
      assert.equal(retainedShared?.sections.facts.text, "Shared durable fact.\n\nB-only durable fact.");
      assert.deepEqual(retainedShared?.sections.facts.evidence, [`source_note:${retractSourceB.id}`]);
      assert.deepEqual(retainedShared?.links, [{ target: retractSourceB.id, relation: "extracted_from" }]);
      assert.equal((await storage.getNote("rel_retract_fallback"))?.sections.state.text, "Latest A state.");
      assert.equal((await storage.getNote("world_retract_manual"))?.sections.facts.text, "Manually preserved fact.");
      assert.equal((await storage.getNote("world_retract_manual"))?.sections.facts.evidence, undefined);
      assert.deepEqual((await storage.getNote("world_retract_manual"))?.links, []);

      const excludedSource = await storage.createNote({
        ...noteInput,
        id: "source_retract_excluded",
        title: "Excluded source",
        type: "source",
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "excluded" },
        sections: { source: { text: "Excluded source evidence.", updatedAt: timestamp } },
      });
      const excludedChild = await storage.projectNote("world_retract_excluded", "world", () => ({
        ...noteInput,
        id: "world_retract_excluded",
        title: "Excluded child",
        status: "active",
        links: [{ target: excludedSource.id, relation: "extracted_from" }],
        sections: {
          facts: renderSectionContributions(
            [
              {
                owner: "source" as const,
                sourceNoteId: excludedSource.id,
                sourceHash: sourceHashForLtmSourceNote(excludedSource),
                text: "Excluded content survives source deletion.",
                updatedAt: timestamp,
                evidence: [`source_note:${excludedSource.id}`],
              },
            ],
            true,
          )!,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }));
      const excludedDelete = await storage.deleteNotesPermanently([excludedSource.id], {
        retractExtracted: true,
        excludedNoteIds: [excludedChild.note!.id],
        lineageSourceNoteId: excludedSource.id,
        expectedLineageNoteIds: [excludedSource.id, excludedChild.note!.id],
      });
      assert.deepEqual(excludedDelete.deletedIds, [excludedSource.id]);
      assert.equal(await storage.getNote(excludedSource.id), null);
      const detachedChild = await storage.getNote(excludedChild.note!.id);
      assert.equal(detachedChild?.sections.facts.text, "Excluded content survives source deletion.");
      assert.deepEqual(detachedChild?.sections.facts.contributions, [
        {
          owner: "manual",
          text: "Excluded content survives source deletion.",
          updatedAt: timestamp,
          evidence: [],
        },
      ]);
      assert.equal(detachedChild?.sections.facts.evidence, undefined);
      assert.deepEqual(detachedChild?.links, []);
      const deletionEvents = (await readFile(getLongTermMemoryDirectories(root).eventLog, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((event) => event.target === excludedChild.note!.id);
      assert.deepEqual(deletionEvents.at(-1)?.payload.detachedFrom, [excludedSource.id]);
      assert.equal(
        deletionEvents.at(-1)?.payload.previousNote.sections.facts.text,
        "Excluded content survives source deletion.",
      );

      const deletionTarget = await storage.createNote({
        ...noteInput,
        id: "world_detail_deletion",
        title: "Detail deletion target",
        sections: {
          facts: { text: "A removable fact.", updatedAt: timestamp },
          history: { text: "A retained history.", updatedAt: timestamp },
        },
      });
      const deletionDraft = await draftStore.createDraft({
        source: { sourceNoteId: canonicalSourceId, chatId: "chat-a" },
        scope: deletionTarget.scope,
        modes: deletionTarget.modes,
        response: {
          summary: "Update the removable fact.",
          mutations: [
            {
              id: randomUUID(),
              kind: "update_section",
              risk: "low",
              confidence: 0.9,
              summary: "Update the removable fact.",
              evidence: [`source_note:${canonicalSourceId}`],
              noteId: deletionTarget.id,
              sectionKey: "facts",
              section: { text: "A pending fact update.", updatedAt: timestamp },
            },
          ],
        },
      });
      const deletedDetail = await storage.updateNote(deletionTarget.id, {
        sections: deletionTarget.sections,
        removedSectionKeys: ["facts"],
      });
      assert.deepEqual(Object.keys(deletedDetail.sections), ["history"]);

      const partialSectionUpdate = await storage.createNote({
        ...noteInput,
        id: "world_partial_section_update",
        title: "Partial section update target",
        sections: {
          facts: { text: "An old fact.", updatedAt: timestamp },
          history: { text: "A retained history.", updatedAt: timestamp },
        },
      });
      const updatedPartialSection = await storage.updateNote(partialSectionUpdate.id, {
        sections: { facts: { text: "A new fact.", updatedAt: timestamp } },
      });
      assert.deepEqual(Object.keys(updatedPartialSection.sections), ["facts", "history"]);
      assert.equal(updatedPartialSection.sections.history.text, "A retained history.");

      const partialSourceUpdate = await storage.createNote({
        ...noteInput,
        id: "source_partial_section_update",
        type: "source",
        title: "Partial source update target",
        provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "partial" },
        sections: {
          source: { text: "Source text.", updatedAt: timestamp },
          metadata: { text: "Retained metadata.", updatedAt: timestamp },
        },
      });
      const updatedPartialSource = await storage.updateNote(partialSourceUpdate.id, {
        sections: { source: { text: "Refreshed source text.", updatedAt: timestamp } },
      });
      assert.deepEqual(Object.keys(updatedPartialSource.sections), ["source", "metadata"]);
      assert.equal(updatedPartialSource.sections.metadata.text, "Retained metadata.");
      const invalidatedDraft = await draftStore.getDraft(deletionDraft.id);
      assert.equal(invalidatedDraft?.status, "invalidated");
      assert.match(invalidatedDraft?.invalidationReason ?? "", /targeted detail was removed/);
      const invalidatedReview = await projectLongTermMemoryDraftReview({
        root,
        includeInvalidated: true,
      });
      assert.equal(
        invalidatedReview.sources.some((source) =>
          source.drafts.some(
            (draft) =>
              draft.draft.id === deletionDraft.id &&
              draft.freshness === "invalidated" &&
              draft.blockReasons.some((reason) => reason.code === "draft_invalidated"),
          ),
        ),
        true,
        "invalidated proposals must remain visible with their explicit blocking reason",
      );
      assert.equal(invalidatedReview.counts.mutations, 0, "invalidated drafts must not contribute pending mutations");
      await assert.rejects(
        storage.updateNote(deletionTarget.id, { removedSectionKeys: ["history"] }),
        (error: any) => error.code === "ltm_last_section",
      );
      await assert.rejects(
        storage.updateNote(deletionTarget.id, { sections: {} }),
        (error: any) => error.code === "ltm_empty_sections",
      );
      assert.deepEqual(Object.keys((await storage.getNote(deletionTarget.id))!.sections), ["history"]);

      const activityRoot = join(dataDir, "activity-index");
      const activityDirectories = getLongTermMemoryDirectories(activityRoot);
      await mkdir(activityDirectories.events, { recursive: true });
      const activityEvents = Array.from({ length: 150 }, (_, index) => ({
        id: randomUUID(),
        ts: new Date(Date.parse(timestamp) + index).toISOString(),
        type: "world.updated",
        target: "world_activity_target",
        payload: { index },
      }));
      await writeFile(
        activityDirectories.eventLog,
        activityEvents.map((event) => JSON.stringify(event)).join("\n") + "\n",
      );
      await rebuildLtmActivityIndex(activityRoot);
      const recentActivity = await readLtmActivityEvents(activityRoot, "world_activity_target", 101);
      assert.deepEqual(
        recentActivity.map((event) => event.payload.index),
        Array.from({ length: 100 }, (_, index) => 149 - index),
        "activity index must retain the newest events in newest-first order",
      );
      await rm(activityDirectories.eventLog, { force: true });
      assert.equal(
        (await readLtmActivityEvents(activityRoot, "world_activity_target", 1))[0]?.payload.index,
        149,
        "activity reads must not depend on rescanning the full event log",
      );

      process.stdout.write(
        "Long-Term Memory storage regression: restart, recovery, self-check, cleanup, stable root ok\n",
      );
    },
    [
      () => restarted?.cleanup(),
      () => first?.cleanup(),
      () => releaseHost(),
      () => rm(dataDir, { recursive: true, force: true }),
    ],
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
