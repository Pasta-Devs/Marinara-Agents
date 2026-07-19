import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function main() {
  const engineRoot =
    process.env.MARINARA_ENGINE_ROOT ??
    join(dirname(fileURLToPath(import.meta.url)), "../../Marinara-Engine");
  const Fastify = (
    await import(
      pathToFileURL(
        join(engineRoot, "packages/server/node_modules/fastify/fastify.js"),
      ).href
    )
  ).default;
  const { registerCapabilityPrivilegedRoutes } = await import(
    pathToFileURL(
      join(
        engineRoot,
        "packages/server/src/services/capability-packages/capability-route-registration.service.ts",
      ),
    ).href
  );
  const { activate } =
    await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/server-entry.ts");
  const app = Fastify();
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-routes-"));
  const installed = {
    id: "long-term-memory",
    version: "1.0.0",
    installedAt: "2026-07-17T00:00:00.000Z",
    status: "active",
    error: null,
    readiness: "pending",
    readinessError: null,
    legacy: false,
    manifest: {
      schemaVersion: 2,
      capabilityApi: { major: 1, minor: 4 },
      builtAgainst: { engineVersion: "2.3.2", engineCommit: "a".repeat(40) },
      id: "long-term-memory",
      name: "Long-Term Memory",
      version: "1.0.0",
      description: "fixture",
      engine: { min: "2.3.2", maxExclusive: "2.4.0" },
      kind: ["agent"],
      entrypoints: { server: "server.mjs", agents: "agents.json" },
      files: [{ path: "server.mjs", sha256: "0".repeat(64), bytes: 1 }],
      permissions: ["agent-runtime", "chat-read", "routes", "storage"],
      restartRequired: true,
    },
  };
  const previousSecret = process.env.ADMIN_SECRET;
  const previousRequireSecret =
    process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK;
  process.env.ADMIN_SECRET = "ltm-route-secret";
  process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK = "true";
  let cleanup: (() => void | Promise<void>) | undefined;
  let releaseRuntimeOverride: (() => void) | undefined;
  let storageService: any;
  let modelCalls = 0;
  const modelRequests: any[] = [];
  const completionOptions: any[] = [];
  const debugOverrides: any[] = [];
  let failGameRefine = false;
  const refineWarnings: any[] = [];
  try {
    assert.deepEqual(installed.manifest.permissions, [
      "agent-runtime",
      "chat-read",
      "routes",
      "storage",
    ]);
    assert.equal(installed.manifest.permissions.includes("network"), false);
    await assert.rejects(
      registerCapabilityPrivilegedRoutes(
        app,
        {
          ...installed,
          manifest: {
            ...installed.manifest,
            permissions: installed.manifest.permissions.filter(
              (permission) => permission !== "routes",
            ),
          },
        } as any,
        async () => {},
        { prefix: "/api/permission-fixture" },
      ),
      /must declare the routes permission/,
    );
    const chats: any[] = ["chat-a", "chat-b"].map((id) => ({
      id,
      name: id === "chat-a" ? "Observatory" : "Archive",
      mode: "roleplay",
      characterIds: ["character-mara"],
      groupId: id === "chat-a" ? "observatory-branches" : null,
      personaId: null,
      connectionId: "connection-a",
      metadata: {},
      lastMessageAt: null,
      updatedAt: "2026-07-17T00:00:00.000Z",
    }));
    chats[0].metadata = {
      summaryEntries: [
        {
          id: "summary-a",
          content: "Mara seals the observatory gate at dusk.",
          enabled: true,
          rangeStartIndex: 1,
          rangeEndIndex: 12,
        },
      ],
    };
    chats.push({
      id: "game-a",
      name: "Cobalt Campaign",
      mode: "game",
      characterIds: ["character-mara"],
      groupId: "observatory-branches",
      personaId: null,
      connectionId: "connection-a",
      metadata: {
        gameJournal: {
          entries: [
            {
              type: "location",
              title: "Moon Vault",
              content: "The party discovered the Moon Vault.",
              timestamp: "2026-07-17T01:00:00.000Z",
            },
          ],
          quests: [
            {
              id: "seal",
              name: "Break the Seal",
              description: "Open the observatory seal.",
              objectives: ["Find the cobalt key"],
              status: "active",
            },
          ],
          locations: ["Moon Vault"],
          npcLog: [],
          inventoryLog: [],
        },
        gamePreviousSessionSummaries: [],
      },
      lastMessageAt: null,
      updatedAt: "2026-07-17T01:00:00.000Z",
    });
    chats.push({
      id: "game-empty",
      name: "Empty Campaign",
      mode: "game",
      characterIds: [],
      groupId: null,
      personaId: null,
      connectionId: "connection-a",
      metadata: {},
      lastMessageAt: null,
      updatedAt: "2026-07-17T01:00:00.000Z",
    });
    cleanup = await activate({
      dataDir,
      api: {
        runtime: {
          isDebugAgentsEnabled() {
            return true;
          },
          logger: {
            debug() {},
            info() {},
            warn() {},
            error() {},
            debugOverride(enabled: boolean, message: string, ...args: any[]) {
              debugOverrides.push({ enabled, message, args });
            },
          },
          languageModels: {
            async resolveForRequest(request: any) {
              modelRequests.push(request);
              if (request.model === "missing-model")
                throw new Error(
                  "Language model connection not found: connection-a",
                );
              return {
                name: "FixtureModel",
                connectionId: request.connectionId ?? "connection-a",
                model: request.model ?? "fixture-model",
                maxContext: 32_000,
                maxOutputTokens: 4_000,
                async chatComplete(_messages: any[], options: any) {
                  modelCalls += 1;
                  completionOptions.push(options);
                  return {
                    content: JSON.stringify({
                      summary: "Extracted observatory facts.",
                      units: [
                        {
                          bucket: "world_fact",
                          subjectId: "observatory_gate",
                          sectionKey: "facts",
                          text: "The observatory gate is sealed at dusk.",
                          importance: "major",
                          evidence: ["source_note:source_route_extract"],
                          confidence: 0.95,
                          salience: 0.9,
                          status: "active",
                          links: [],
                          sourceHash: "replaced-by-package",
                        },
                        {
                          bucket: "character_fact",
                          subjectId: "mara",
                          subjectNames: ["Mara"],
                          sectionKey: "role",
                          text: "Mara seals the observatory gate at dusk.",
                          importance: "major",
                          evidence: ["source_note:source_route_extract"],
                          confidence: 0.95,
                          salience: 0.9,
                          status: "active",
                          links: [],
                          sourceHash: "replaced-by-package",
                        },
                      ],
                    }),
                    finishReason: "stop",
                    usage: {
                      promptTokens: 100,
                      completionTokens: 50,
                      totalTokens: 150,
                    },
                  };
                },
                fitContext(messages: any[], options: any) {
                  return {
                    messages,
                    maxTokens: options.maxTokens,
                    estimatedTokensBefore: 100,
                    estimatedTokensAfter: 100,
                    trimmed: false,
                  };
                },
              };
            },
          },
          resources: {
            async listCharacters() {
              return [
                { id: "character-mara", data: { name: "Mara" }, comment: "" },
              ];
            },
            async listPersonas() {
              return [];
            },
          },
          persistence: {
            async getChat(chatId: string) {
              return chats.find((chat) => chat.id === chatId) ?? null;
            },
            async listChats() {
              return chats;
            },
          },
        },
        registerService(name: string, service: unknown) {
          if (name === "long-term-memory:storage") storageService = service;
          return () => void service || void name;
        },
        registerPrivilegedRoutes: (routes: any, options: { prefix: string }) =>
          registerCapabilityPrivilegedRoutes(
            app,
            installed as any,
            routes,
            options,
          ),
      },
    });
    await app.ready();
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/settings",
        })
      ).statusCode,
      403,
    );
    const headers = { "x-admin-secret": "ltm-route-secret" };
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/settings",
          headers,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/status",
          headers,
        })
      ).statusCode,
      200,
    );
    const created = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "world_route_fixture",
        title: "Route fixture",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["route_fixture"],
        keywords: ["cobalt"],
        links: [],
        sections: {
          facts: {
            text: "The cobalt key is beneath the observatory.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(created.statusCode, 201, created.body);
    const batch = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/batch",
      headers,
      payload: {
        noteIds: ["world_route_fixture", "world_route_missing"],
        modes: ["roleplay", "game"],
        addTags: ["batch_fixture"],
      },
    });
    assert.equal(batch.statusCode, 200, batch.body);
    assert.equal(batch.json().status, "partial");
    assert.deepEqual(batch.json().updatedNoteIds, ["world_route_fixture"]);
    assert.deepEqual(batch.json().failedNoteIds, ["world_route_missing"]);
    assert.deepEqual(
      (await storageService.storage.getNote("world_route_fixture")).modes,
      ["roleplay", "game"],
    );
    assert.equal(
      (
        await storageService.storage.getNote("world_route_fixture")
      ).tags.includes("batch_fixture"),
      true,
    );
    const tooManyBatchIds = Array.from(
      { length: 101 },
      (_, index) => `world_batch_${index}`,
    );
    const invalidBatch = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/batch",
      headers,
      payload: { noteIds: tooManyBatchIds, status: "archived" },
    });
    assert.equal(invalidBatch.statusCode, 400, invalidBatch.body);
    const notSource = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/world_route_fixture/extract",
      headers,
      payload: {},
    });
    assert.equal(notSource.statusCode, 400, notSource.body);
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: "POST",
          url: "/api/long-term-memory/notes",
          headers,
          payload: {
            id: "world_concurrent_fixture",
            type: "world",
            status: "active",
            modes: ["roleplay"],
            scope: {},
            tags: [],
            keywords: [],
            links: [],
            sections: {
              facts: {
                text: "Only one create may commit.",
                updatedAt: "2026-07-17T00:00:00.000Z",
              },
            },
          },
        }),
      ),
    );
    assert.deepEqual(
      concurrent.map((response) => response.statusCode).sort(),
      [201, 409],
    );
    const listed = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=chat-a&includeGlobal=false",
      headers,
    });
    assert.deepEqual(
      listed.json().map((note: any) => note.id),
      ["world_route_fixture"],
    );
    const scopeTargets = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/scope-targets?chatId=chat-a",
      headers,
    });
    assert.equal(scopeTargets.statusCode, 200, scopeTargets.body);
    assert.deepEqual(scopeTargets.json().currentScope.chatIds, ["chat-a"]);
    assert.equal(
      scopeTargets.json().chats.some((chat: any) => chat.id === "chat-a"),
      true,
    );
    assert.deepEqual(
      scopeTargets
        .json()
        .groups.find((group: any) => group.id === "observatory-branches")
        ?.chatIds.sort(),
      ["chat-a", "game-a"],
    );
    const searched = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/search",
      headers,
      payload: {
        queryText: "cobalt observatory",
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      },
    });
    assert.equal(searched.statusCode, 200, searched.body);
    assert.equal(
      searched.json().chunks[0]?.chunk.noteId,
      "world_route_fixture",
    );
    const transfer = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer",
      headers,
      payload: {
        noteIds: ["world_route_fixture"],
        mode: "copy",
        destinationChatId: "chat-b",
      },
    });
    assert.equal(transfer.statusCode, 200, transfer.body);
    assert.deepEqual(transfer.json().updatedNoteIds, ["world_route_fixture"]);
    const extractSource = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "source_route_extract",
        title: "Observatory report",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        sections: {
          source: {
            text: "Mara seals the observatory gate at dusk.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(extractSource.statusCode, 201, extractSource.body);
    const invalidMode = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a", mode: "conversation" },
    });
    assert.equal(invalidMode.statusCode, 400, invalidMode.body);
    assert.match(invalidMode.json().error, /mode is not enabled/);
    const missingModel = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a", model: "missing-model" },
    });
    assert.equal(missingModel.statusCode, 400, missingModel.body);
    const extracted = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: {
        chatId: "chat-a",
        connectionId: "request-connection",
        model: "request-model",
      },
    });
    assert.equal(extracted.statusCode, 200, extracted.body);
    assert.deepEqual(
      extracted
        .json()
        .draft?.mutations.map((mutation: any) => mutation.note?.id)
        .sort(),
      ["char_mara", "world_observatory_gate"],
    );
    assert.deepEqual(
      extracted
        .json()
        .draft?.mutations.find(
          (mutation: any) => mutation.note?.id === "char_mara",
        )?.note.subjects,
      [
        {
          key: "character:character-mara",
          ref: { kind: "character", id: "character-mara" },
        },
      ],
    );
    assert.deepEqual(modelRequests.at(-1), {
      connectionId: "request-connection",
      chatConnectionId: "connection-a",
      model: "request-model",
    });
    assert.equal(completionOptions.at(-1)?.debugMode, true);
    assert.equal(completionOptions.at(-1)?.maxTokens, 4_000);
    assert.equal(completionOptions.at(-1)?.temperature, 0);
    assert.equal(completionOptions.at(-1)?.reasoningEffort, "low");
    assert.equal(completionOptions.at(-1)?.verbosity, "low");
    assert.equal(completionOptions.at(-1)?.responseFormat?.type, "json_schema");
    assert.equal(
      debugOverrides.some(
        (entry) => entry.enabled && entry.message.includes("extraction prompt"),
      ),
      true,
    );
    const chatDrafts = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/drafts?chatId=chat-a",
      headers,
    });
    assert.equal(chatDrafts.statusCode, 200, chatDrafts.body);
    assert.equal(
      chatDrafts
        .json()
        .some((draft: any) => draft.id === extracted.json().draft.id),
      true,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/drafts/pending-count?chatId=chat-a",
          headers,
        })
      ).json().count,
      1,
    );
    assert.equal(modelCalls, 1);
    const autoApplied = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a", applyLowRisk: true },
    });
    assert.equal(autoApplied.statusCode, 200, autoApplied.body);
    assert.equal(autoApplied.json().appliedMutationIds.length > 0, true);
    assert.equal(autoApplied.json().draft.indexRebuildStatus, "not_requested");
    assert.equal(modelCalls, 2);
    for (const [id, createdAt, text] of [
      [
        "char_mara_legacy_a",
        "2026-07-15T00:00:00.000Z",
        "Mara guards the eastern gate.",
      ],
      [
        "char_mara_legacy_b",
        "2026-07-16T00:00:00.000Z",
        "Mara seals the western gate.",
      ],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/api/long-term-memory/notes",
        headers,
        payload: {
          id,
          title: "Mara",
          type: "character",
          status: "active",
          modes: ["roleplay"],
          scope: { chatId: "chat-a", chatIds: ["chat-a"] },
          tags: [],
          keywords: [],
          createdAt,
          updatedAt: createdAt,
          links: [],
          sections: { facts: { text, updatedAt: createdAt } },
        },
      });
      assert.equal(response.statusCode, 201, response.body);
    }
    await storageService.storage.updateNote("world_route_fixture", {
      links: [{ target: "char_mara_legacy_b", relation: "affects_character" }],
    });
    const identityPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/preview",
      headers,
      payload: { scope: { chatId: "chat-a", chatIds: ["chat-a"] } },
    });
    assert.equal(identityPreview.statusCode, 200, identityPreview.body);
    const identityCandidate = identityPreview
      .json()
      .candidates.find((candidate: any) =>
        candidate.duplicateNoteIds.includes("char_mara_legacy_b"),
      );
    assert.equal(identityCandidate.canonicalNoteId, "char_mara_legacy_a");
    const identityApply = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/apply",
      headers,
      payload: {
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        repairs: [
          {
            candidateId: identityCandidate.id,
            canonicalNoteId: identityCandidate.canonicalNoteId,
            excludedNoteIds: ["char_mara"],
            sectionChoices: [],
          },
        ],
      },
    });
    assert.equal(identityApply.statusCode, 200, identityApply.body);
    assert.deepEqual(identityApply.json().repairs[0].archivedNoteIds, [
      "char_mara_legacy_b",
    ]);
    assert.deepEqual(
      (await storageService.storage.getNote("char_mara_legacy_a")).subjects,
      [
        {
          key: "character:character-mara",
          ref: { kind: "character", id: "character-mara" },
        },
      ],
    );
    assert.match(
      (await storageService.storage.getNote("char_mara_legacy_a")).sections
        .facts.text,
      /western gate/,
    );
    assert.equal(
      (await storageService.storage.getNote("char_mara_legacy_b")).status,
      "archived",
    );
    assert.equal(
      (await storageService.storage.getNote("world_route_fixture")).links[0]
        .target,
      "char_mara_legacy_a",
    );
    assert.equal(identityApply.json().integrity.ok, true);
    const preview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 10 },
    });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(
      preview
        .json()
        .samples.some(
          (sample: any) =>
            sample.sourceId === "chat-a:summary-a" &&
            sample.freshness === "new",
        ),
      true,
    );
    assert.equal(
      preview
        .json()
        .samples.some(
          (sample: any) => sample.sourceId === "game-a:game_journal",
        ),
      true,
    );
    const excludedByChatIds = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 10, scope: { chatIds: ["chat-b"] } },
    });
    assert.equal(
      excludedByChatIds
        .json()
        .samples.some(
          (sample: any) =>
            sample.sourceId.startsWith("chat-a:") ||
            sample.sourceId.startsWith("game-a:"),
        ),
      false,
    );
    const excludedByGroup = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: {
        source: "chats",
        limit: 10,
        scope: { groupId: "other-group" },
      },
    });
    assert.equal(excludedByGroup.json().samples.length, 0);
    const branchPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: {
        source: "chats",
        limit: 10,
        scope: { chatIds: ["chat-a"], groupId: "observatory-branches" },
      },
    });
    assert.equal(
      branchPreview
        .json()
        .samples.some((sample: any) => sample.sourceId === "chat-a:summary-a"),
      true,
    );
    assert.equal(
      branchPreview
        .json()
        .samples.some(
          (sample: any) => sample.sourceId === "game-a:game_journal",
        ),
      true,
    );
    const gamePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 10, mode: "game" },
    });
    assert.equal(
      gamePreview
        .json()
        .samples.every((sample: any) =>
          sample.sourceId.endsWith(":game_journal"),
        ),
      true,
    );
    chats[0].metadata.summaryEntries.push({
      id: "summary-provider-fail",
      content: "A provider preflight must fail before this source is written.",
      enabled: true,
    });
    const failedProvider = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: ["chat-a:summary-provider-fail"],
        model: "missing-model",
      },
    });
    assert.equal(failedProvider.statusCode, 400, failedProvider.body);
    assert.equal(
      (await storageService.storage.listNotes({ type: "source" })).some(
        (note: any) => note.provenance?.entryId === "summary-provider-fail",
      ),
      false,
    );
    const importCalls = modelCalls;
    const importedChat = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: ["chat-a:summary-a", "missing:summary"],
        importConcurrency: 2,
      },
    });
    assert.equal(importedChat.statusCode, 200, importedChat.body);
    assert.equal(importedChat.json().batchStatus, "partial_success");
    assert.deepEqual(importedChat.json().missingSourceIds, ["missing:summary"]);
    assert.equal(importedChat.json().imported[0]?.extractionMethod, "llm");
    assert.equal(modelCalls, importCalls + 1);
    const importedChatNote = importedChat.json().imported[0].note;
    await storageService.storage.updateNote(importedChatNote.id, {
      tags: [...importedChatNote.tags, "user_tag"],
      keywords: ["preserve-me"],
      links: [{ target: "world_route_fixture", relation: "evidenced_by" }],
      sections: {
        ...importedChatNote.sections,
        notes: {
          text: "User-owned section.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const refreshedChat = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["chat-a:summary-a"] },
    });
    assert.equal(refreshedChat.statusCode, 200, refreshedChat.body);
    const refreshedNote = refreshedChat.json().imported[0].note;
    assert.equal(refreshedNote.tags.includes("user_tag"), true);
    assert.deepEqual(refreshedNote.keywords, ["preserve-me"]);
    assert.deepEqual(refreshedNote.links, [
      { target: "world_route_fixture", relation: "evidenced_by" },
    ]);
    assert.equal(refreshedNote.sections.notes.text, "User-owned section.");
    chats[0].metadata.summaryEntries.push({
      id: "summary-legacy",
      content: "Legacy identity should migrate to canonical provenance.",
      enabled: true,
    });
    const legacyId = `source_import_chat_observatory_${createHash("sha256").update("chat-a:summary-legacy").digest("hex").slice(0, 10)}`;
    await storageService.storage.createNote({
      id: legacyId,
      title: "Legacy chat",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary", "imported_chat", "legacy_tag"],
      keywords: ["legacy"],
      links: [],
      sections: {
        source: { text: "Old text.", updatedAt: "2026-07-17T00:00:00.000Z" },
      },
    });
    const migrated = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["chat-a:summary-legacy"] },
    });
    assert.equal(migrated.statusCode, 200, migrated.body);
    assert.notEqual(migrated.json().imported[0].note.id, legacyId);
    assert.equal(await storageService.storage.getNote(legacyId), null);
    assert.equal(
      migrated.json().imported[0].note.tags.includes("legacy_tag"),
      true,
    );
    const gameCalls = modelCalls;
    const importedGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: ["game-a:game_journal"],
        applyLowRisk: true,
      },
    });
    assert.equal(importedGame.statusCode, 200, importedGame.body);
    assert.equal(
      importedGame.json().imported[0]?.extractionMethod,
      "direct_ingest",
    );
    assert.equal(
      importedGame.json().imported[0]?.extractionStatus,
      "succeeded",
    );
    assert.equal(modelCalls, gameCalls);
    const { configurePackageRuntime } =
      await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts");
    releaseRuntimeOverride = configurePackageRuntime({
      dataDir,
      logger: {
        debug() {},
        info() {},
        warn(...args: any[]) {
          refineWarnings.push(
            args.map((value) =>
              value instanceof Error ? value.message : value,
            ),
          );
        },
        error() {},
        debugOverride() {},
      },
      isDebugAgentsEnabled() {
        return true;
      },
      languageModels: {
        async resolveForRequest(request: any) {
          modelRequests.push(request);
          return {
            name: "RefineFixture",
            connectionId:
              request.connectionId ??
              request.chatConnectionId ??
              "connection-a",
            model: request.model ?? "refine-model",
            maxContext: 32_000,
            maxOutputTokens: 4_000,
            async chatComplete(messages: any[], options: any) {
              modelCalls += 1;
              completionOptions.push(options);
              if (failGameRefine) throw new Error("Fixture refine failure");
              const payload = JSON.parse(messages.at(-1).content);
              return {
                content: JSON.stringify({
                  summary: "Refined Moon Vault discovery.",
                  units: payload.candidateUnits,
                }),
                finishReason: "stop",
              };
            },
            fitContext(messages: any[], options: any) {
              return {
                messages,
                maxTokens: options.maxTokens,
                estimatedTokensBefore: 100,
                estimatedTokensAfter: 100,
                trimmed: false,
              };
            },
          };
        },
      },
      resources: {
        async listCharacters() {
          return [
            {
              id: "character-mara",
              data: {
                name: "Mara",
                alternate_greetings: JSON.stringify([
                  "Welcome to the observatory.",
                ]),
              },
              comment: "",
            },
          ];
        },
        async listPersonas() {
          return [];
        },
        async listLorebooks() {
          return [
            {
              id: "lorebook-a",
              data: {
                name: "Scoped Lore",
                category: "npc",
                chatId: "chat-a",
                characterIds: ["character-mara"],
                tags: ["Cobalt Lore"],
              },
              entries: [
                {
                  id: "entry-a",
                  name: "Gate",
                  content: "The cobalt gate opens only at dusk.",
                },
              ],
            },
          ];
        },
      },
      persistence: {
        async getChat(chatId: string) {
          return chats.find((chat) => chat.id === chatId) ?? null;
        },
        async listChats() {
          return chats;
        },
      },
    });
    const lorePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "lorebooks", limit: 10 },
    });
    assert.equal(lorePreview.statusCode, 200, lorePreview.body);
    const loreImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "lorebooks",
        sourceIds: [lorePreview.json().samples[0].sourceId],
      },
    });
    assert.equal(loreImport.statusCode, 200, loreImport.body);
    assert.deepEqual(loreImport.json().imported[0].note.scope, {
      chatId: "chat-a",
      chatIds: ["chat-a"],
      characterIds: ["character-mara"],
    });
    assert.equal(
      loreImport.json().imported[0].note.tags.includes("cobalt_lore"),
      true,
    );
    const characterPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "characters", limit: 10 },
    });
    assert.match(
      characterPreview.json().samples[0].snippet,
      /Welcome to the observatory/,
    );
    const firstGameNote = importedGame.json().imported[0].note;
    const firstGameFingerprint = firstGameNote.extractionFingerprint;
    const changedGameCalls = modelCalls;
    chats.find(
      (chat) => chat.id === "game-a",
    ).metadata.gameJournal.entries[0].content =
      "The party discovered the changed Moon Vault beneath the observatory.";
    const changedGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["game-a:game_journal"] },
    });
    assert.equal(changedGame.statusCode, 200, changedGame.body);
    assert.match(
      changedGame.json().imported[0].note.sections.source.text,
      /changed Moon Vault/,
    );
    assert.notDeepEqual(
      changedGame.json().imported[0].note.extractionFingerprint,
      firstGameFingerprint,
    );
    assert.equal(modelCalls, changedGameCalls);
    const enabledRefine = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { version: 1, refinePass: true },
    });
    assert.equal(enabledRefine.statusCode, 200, enabledRefine.body);
    assert.equal(enabledRefine.json().refinePass, true);
    const extractionTemplates = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: {
        promptTemplates: [
          {
            id: "roleplay_custom",
            name: "Roleplay custom",
            prompt: "Use only verified facts.",
          },
        ],
        activePromptTemplateIdsByMode: { roleplay: "roleplay_custom" },
      },
    });
    assert.equal(extractionTemplates.statusCode, 200, extractionTemplates.body);
    const extractionPatch = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { temperature: 0.4 },
    });
    assert.equal(extractionPatch.statusCode, 200, extractionPatch.body);
    assert.equal(extractionPatch.json().refinePass, true);
    assert.deepEqual(
      extractionPatch.json().promptTemplates,
      extractionTemplates.json().promptTemplates,
    );
    const invalidExtractionTemplate = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { activePromptTemplateIdsByMode: { game: "missing_template" } },
    });
    assert.equal(
      invalidExtractionTemplate.statusCode,
      400,
      invalidExtractionTemplate.body,
    );
    chats.find(
      (chat) => chat.id === "game-a",
    ).metadata.gameJournal.quests[0].description =
      "Break the Seal remains open until the party finds the cobalt key and opens the observatory seal.";
    await storageService.storage.deleteNotesPermanently([
      "world_location_moon_vault",
      "thread_quest_seal",
    ]);
    const refineCalls = modelCalls;
    const refineResolutions = modelRequests.length;
    const refinedGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["game-a:game_journal"] },
    });
    assert.equal(refinedGame.statusCode, 200, refinedGame.body);
    assert.equal(
      refinedGame.json().imported[0]?.extractionStatus,
      "succeeded",
      refinedGame.body,
    );
    assert.equal(modelRequests.length, refineResolutions + 1);
    assert.equal(modelCalls, refineCalls + 1, JSON.stringify(refineWarnings));
    assert.equal(
      refinedGame.json().imported[0].draft.summary,
      "Refined Moon Vault discovery.",
      refinedGame.body,
    );
    failGameRefine = true;
    const fallbackGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["game-a:game_journal"] },
    });
    assert.equal(fallbackGame.statusCode, 200, fallbackGame.body);
    assert.equal(fallbackGame.json().imported[0].extractionStatus, "succeeded");
    assert.match(
      fallbackGame.json().imported[0].draft.summary,
      /Direct ingestion/,
    );
    failGameRefine = false;
    await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { version: 1, refinePass: false },
    });
    const emptyGameSource = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "source_route_empty_game",
        title: "Empty game",
        type: "source",
        status: "active",
        modes: ["game"],
        scope: { chatId: "game-empty", chatIds: ["game-empty"] },
        tags: ["source_summary", "imported_game_journal"],
        keywords: [],
        links: [],
        sections: {
          source: {
            text: "Unchanged empty source.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(emptyGameSource.statusCode, 201, emptyGameSource.body);
    const emptyGameExtract = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_empty_game/extract",
      headers,
      payload: {},
    });
    assert.equal(emptyGameExtract.statusCode, 200, emptyGameExtract.body);
    assert.equal(emptyGameExtract.json().draft, null);
    const unchangedEmpty = await storageService.storage.getNote(
      "source_route_empty_game",
    );
    assert.equal(
      unchangedEmpty.sections.source.text,
      "Unchanged empty source.",
    );
    assert.equal(unchangedEmpty.extractionFingerprint, undefined);
    const missingGameSource = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "source_route_missing_game",
        title: "Missing game",
        type: "source",
        status: "active",
        modes: ["game"],
        scope: { chatId: "missing-game", chatIds: ["missing-game"] },
        tags: ["source_summary", "imported_game_journal"],
        keywords: [],
        links: [],
        sections: {
          source: { text: "Missing.", updatedAt: "2026-07-17T00:00:00.000Z" },
        },
      },
    });
    assert.equal(missingGameSource.statusCode, 201, missingGameSource.body);
    const missingGameExtract = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_missing_game/extract",
      headers,
      payload: {},
    });
    assert.equal(missingGameExtract.statusCode, 502, missingGameExtract.body);
    chats[0].metadata.summaryEntries.push(
      {
        id: "summary-order-a",
        content: "The eastern annex contains an amber mechanism.",
        enabled: true,
      },
      {
        id: "summary-order-b",
        content: "The western annex contains an amber mechanism.",
        enabled: true,
      },
    );
    const ordered = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: ["chat-a:summary-order-b", "chat-a:summary-order-a"],
        importConcurrency: 2,
      },
    });
    assert.equal(ordered.statusCode, 200, ordered.body);
    assert.deepEqual(
      ordered.json().imported.map((item: any) => item.sourceId),
      ["chat-a:summary-order-b", "chat-a:summary-order-a"],
    );
    const { importPackageInterop } =
      await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/interop.ts");
    chats[0].metadata.summaryEntries.push({
      id: "summary-aborted-new",
      content: "This source must never be persisted.",
      enabled: true,
    });
    const cancelledController = new AbortController();
    cancelledController.abort();
    await assert.rejects(
      importPackageInterop(
        {
          source: "chats",
          sourceIds: ["chat-a:summary-aborted-new"],
          limit: 100,
          importConcurrency: 1,
        },
        storageService.root,
        cancelledController.signal,
      ),
      /cancelled/i,
    );
    assert.equal(
      (await storageService.storage.listNotes({ type: "source" })).some(
        (note: any) => note.provenance?.entryId === "summary-aborted-new",
      ),
      false,
    );
    const currentPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 10 },
    });
    assert.equal(
      currentPreview
        .json()
        .samples.some(
          (sample: any) =>
            sample.sourceId === "game-a:game_journal" &&
            sample.freshness === "current",
        ),
      true,
    );
    const gameSource = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "source_route_game",
        title: "Game journal",
        type: "source",
        status: "active",
        modes: ["game"],
        scope: { chatId: "game-a", chatIds: ["game-a"] },
        tags: ["source_summary", "imported_game_journal"],
        keywords: [],
        links: [],
        sections: {
          source: {
            text: "A game journal entry.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(gameSource.statusCode, 201, gameSource.body);
    const singleGameCalls = modelCalls;
    const gameExtract = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_game/extract",
      headers,
      payload: {},
    });
    assert.equal(gameExtract.statusCode, 200, gameExtract.body);
    assert.equal(gameExtract.json().draft?.mutations.length > 0, true);
    assert.equal(modelCalls, singleGameCalls);
    const source = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "source_route_review",
        title: "Draft source",
        type: "source",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["source_summary"],
        keywords: [],
        links: [],
        sections: {
          source: {
            text: "The eastern gate is sealed at dusk.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(source.statusCode, 201, source.body);
    await writeFile(
      join(storageService.root, "drafts", "malformed.json"),
      "{not-json",
      "utf8",
    );
    const mutationId = "10000000-0000-4000-8000-000000000001";
    const mutation = {
      id: mutationId,
      kind: "create_note",
      risk: "low",
      confidence: 0.9,
      summary: "Create gate fact",
      evidence: ["The eastern gate is sealed at dusk."],
      note: {
        id: "world_eastern_gate",
        title: "Eastern gate",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: ["gate", "dusk"],
        links: [],
        sections: {
          facts: {
            text: "The eastern gate is sealed at dusk.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    };
    const draft = await storageService.drafts.createDraft({
      source: { sourceNoteId: "source_route_review", chatId: "chat-a" },
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      modes: ["roleplay"],
      summary: "Remember the gate schedule.",
      response: {
        summary: "Remember the gate schedule.",
        mutations: [mutation],
      },
    });
    const review = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/drafts/review?sourceNoteId=source_route_review",
      headers,
    });
    assert.equal(review.statusCode, 200, review.body);
    assert.equal(review.json().counts.drafts, 1);
    assert.equal(review.json().sources[0]?.drafts[0]?.freshness, "fresh");
    assert.equal(
      review.json().sources[0]?.targets[0]?.noteId,
      "world_eastern_gate",
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/drafts",
          headers,
        })
      ).statusCode,
      200,
    );
    const accepted = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${draft.id}/accept`,
      headers,
      payload: { mutationIds: [mutationId] },
    });
    assert.equal(accepted.statusCode, 200, accepted.body);
    assert.deepEqual(accepted.json().appliedMutationIds, [mutationId]);
    assert.equal(accepted.json().draft.status, "accepted");
    assert.equal(
      (await storageService.storage.getNote("world_eastern_gate"))?.sections
        .facts.text,
      "The eastern gate is sealed at dusk.",
    );
    const integrity = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/integrity",
      headers,
    });
    assert.equal(integrity.statusCode, 200, integrity.body);
    assert.equal(integrity.json().ok, true);
    const backup = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/backup/export",
      headers,
    });
    assert.equal(backup.statusCode, 200, backup.body);
    assert.equal(backup.json().format, "marinara-long-term-memory");
    const backupPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/backup/preview",
      headers,
      payload: backup.json(),
    });
    assert.equal(backupPreview.statusCode, 200, backupPreview.body);
    assert.equal(backupPreview.json().incoming.notes > 0, true);
    const replacement = backup.json();
    replacement.notes = replacement.notes.filter((note: any) => note.id === "world_route_fixture");
    const imported = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/backup/import",
      headers,
      payload: replacement,
    });
    assert.equal(imported.statusCode, 200, imported.body);
    assert.equal((await storageService.storage.listNotes()).some((note: any) => note.id === "world_route_fixture"), true);
    const resetSettings = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/settings/reset",
      headers,
    });
    assert.equal(resetSettings.statusCode, 200, resetSettings.body);
    assert.equal((await storageService.storage.getNote("world_route_fixture"))?.id, "world_route_fixture");
    const deletedAll = await app.inject({
      method: "DELETE",
      url: "/api/long-term-memory/data",
      headers,
    });
    assert.equal(deletedAll.statusCode, 200, deletedAll.body);
    assert.equal((await storageService.storage.listNotes()).length, 0);
    await cleanup();
    cleanup = undefined;
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/settings",
          headers,
        })
      ).statusCode,
      404,
    );
  } finally {
    releaseRuntimeOverride?.();
    await cleanup?.();
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
    if (previousSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousSecret;
    if (previousRequireSecret === undefined)
      delete process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK;
    else
      process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK =
        previousRequireSecret;
  }
  process.stdout.write(
    "Long-Term Memory routes regression: permissions, malformed drafts, model/debug forwarding, chat draft visibility, client errors, extraction, cleanup ok\n",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
