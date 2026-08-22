import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function main() {
  const engineRoot =
    process.env.MARINARA_ENGINE_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../../Marinara-Engine");
  const Fastify = (
    await import(pathToFileURL(join(engineRoot, "packages/server/node_modules/fastify/fastify.js")).href)
  ).default;
  const { registerCapabilityPrivilegedRoutes } = await import(
    pathToFileURL(
      join(engineRoot, "packages/server/src/services/capability-packages/capability-route-registration.service.ts"),
    ).href
  );
  const { activate } =
    await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/server-entry.ts");
  const { ltmDraftPreflightResponseSchema, ltmExtractionSettingsPatchSchema, ltmExtractionSettingsSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");
  const { addRejectedSuggestions } =
    await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/rejected-suggestions.ts");
  const { longTermMemoryInjectionReceiptPath, recordLongTermMemoryZeroMatch } =
    await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/usage.ts");
  const { prepareGenerationLongTermMemory } =
    await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/generation-injection.ts");
  const app = Fastify();
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-routes-"));
  const packageManifest = JSON.parse(
    await readFile(join(dirname(fileURLToPath(import.meta.url)), "../packages/long-term-memory/manifest.json"), "utf8"),
  );
  const installed = {
    id: "long-term-memory",
    version: packageManifest.version,
    installedAt: "2026-07-17T00:00:00.000Z",
    status: "active",
    error: null,
    readiness: "pending",
    readinessError: null,
    legacy: false,
    manifest: packageManifest,
  };
  const previousSecret = process.env.ADMIN_SECRET;
  const previousRequireSecret = process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK;
  process.env.ADMIN_SECRET = "ltm-route-secret";
  process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK = "true";
  let cleanup: (() => void | Promise<void>) | undefined;
  let releaseRuntimeOverride: (() => void) | undefined;
  let storageService: any;
  let modelCalls = 0;
  const modelRequests: any[] = [];
  const completionOptions: any[] = [];
  const completionMessages: any[] = [];
  const debugOverrides: any[] = [];
  let failGameRefine = false;
  let emptyModelResponse = false;
  let failGrammarOnce = false;
  let grammarErrorMessage = "";
  let fitContextMode: "normal" | "reduced" | "trimmed" = "normal";
  let abortInFlight = false;
  let abortReachedChatComplete = false;
  let notifyAbortChatComplete: (() => void) | undefined;
  const refineWarnings: any[] = [];
  const largeLoreEntry = `${"A".repeat(13_000)} ${"B".repeat(13_000)}`;
  try {
    assert.deepEqual(installed.manifest.permissions, [
      "agent-runtime",
      "chat-read",
      "chat-write",
      "routes",
      "storage",
      "ui",
    ]);
    assert.equal(installed.manifest.permissions.includes("network"), false);
    await assert.rejects(
      registerCapabilityPrivilegedRoutes(
        app,
        {
          ...installed,
          manifest: {
            ...installed.manifest,
            permissions: installed.manifest.permissions.filter((permission) => permission !== "routes"),
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
    chats.push(
      {
        ...chats[0],
        id: "chat-persona-a",
        name: "Persona A",
        groupId: null,
        personaId: "persona-a",
      },
      {
        ...chats[1],
        id: "chat-persona-b",
        name: "Persona B",
        personaId: "persona-b",
      },
      {
        ...chats[0],
        id: "chat-professor-mari",
        name: "Professor Mari",
        characterIds: ["__professor_mari__"],
        groupId: "professor-mari-only",
        metadata: {
          summaryEntries: [
            {
              id: "summary-mari",
              content: "Professor Mari must stay out of Long-Term Memory.",
              enabled: true,
            },
          ],
        },
      },
    );
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
        gamePreviousSessionSummaries: [
          {
            sessionNumber: 1,
            summary: "The party discovered the Moon Vault.",
            resumePoint: "Outside the cobalt seal.",
            partyDynamics: "Mara trusts the party more.",
            partyState: "The party holds the cobalt key.",
            keyDiscoveries: ["The Moon Vault lies beneath the observatory."],
            characterMoments: [],
            littleDetails: [],
            npcUpdates: [],
          },
        ],
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
                throw new Error("Language model connection not found: connection-a");
              return {
                name: "FixtureModel",
                connectionId: request.connectionId ?? "connection-a",
                model: request.model ?? "fixture-model",
                maxContext: 32_000,
                maxOutputTokens: 4_000,
                async chatComplete(_messages: any[], options: any) {
                  modelCalls += 1;
                  completionMessages.push(_messages);
                  completionOptions.push(options);
                  if (failGrammarOnce && options.responseFormat) {
                    failGrammarOnce = false;
                    throw new Error(`Custom OpenAIcompatible endpoint error 400: ${grammarErrorMessage}`);
                  }
                  if (abortInFlight) {
                    abortReachedChatComplete = true;
                    notifyAbortChatComplete?.();
                    return new Promise((_resolve, reject) => {
                      if (options.signal?.aborted) {
                        reject(new Error("aborted"));
                        return;
                      }
                      options.signal?.addEventListener(
                        "abort",
                        () => {
                          reject(new Error("aborted"));
                        },
                        { once: true },
                      );
                    });
                  }
                  return {
                    content: emptyModelResponse
                      ? ""
                      : JSON.stringify({
                          summary: "Extracted observatory facts.",
                          units: [
                            {
                              bucket: "timeline_event",
                              subjectId: "observatory_gate_sealed",
                              sectionKey: "event",
                              text: "Mara sealed the observatory gate at dusk.",
                              importance: "major",
                              evidence: ["source_note:source_route_extract"],
                              confidence: 0.95,
                              salience: 0.9,
                              status: "active",
                              links: [],
                              sourceHash: "replaced-by-package",
                            },
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
                              links: [
                                {
                                  relation: "evidenced_by",
                                  target: "timeline_observatory_gate_sealed",
                                },
                              ],
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
                              links: [
                                {
                                  relation: "evidenced_by",
                                  target: "timeline_observatory_gate_sealed",
                                },
                              ],
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
                    maxTokens: fitContextMode === "reduced" ? 123 : options.maxTokens,
                    estimatedTokensBefore: 100,
                    estimatedTokensAfter: 100,
                    trimmed: fitContextMode === "trimmed",
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
                  data: JSON.stringify({
                    name: "Mara",
                    description: "Mara keeps the observatory gate secure.",
                  }),
                  comment: "",
                },
                { id: "character-nyra", data: { name: "Nyra" }, comment: "" },
                {
                  id: "__professor_mari__",
                  data: { name: "Professor Mari" },
                  comment: "",
                },
              ];
            },
            async listPersonas() {
              return [
                {
                  id: "persona-a",
                  data: { name: "Kira Luna", comment: "Space explorer" },
                },
                {
                  id: "persona-b",
                  data: { name: "Kira Luna", comment: "Private detective" },
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
        },
        registerService(name: string, service: unknown) {
          if (name === "long-term-memory:storage") storageService = service;
          return () => void service || void name;
        },
        registerPrivilegedRoutes: (routes: any, options: { prefix: string }) =>
          registerCapabilityPrivilegedRoutes(app, installed as any, routes, options),
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
    const status = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/status",
      headers,
    });
    assert.equal(status.statusCode, 200, status.body);
    assert.deepEqual(Object.keys(status.json().notes).sort(), [
      "byStatus",
      "byType",
      "pendingDrafts",
      "savedMemories",
      "sourceNotes",
      "total",
    ]);
    assert.deepEqual(
      {
        total: status.json().notes.total,
        sourceNotes: status.json().notes.sourceNotes,
        savedMemories: status.json().notes.savedMemories,
        pendingDrafts: status.json().notes.pendingDrafts,
      },
      { total: 0, sourceNotes: 0, savedMemories: 0, pendingDrafts: 0 },
    );
    const missingInjection = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/last-injection/no-recorded-recall",
      headers,
    });
    assert.deepEqual(missingInjection.json(), {
      memoryCount: 0,
      tokenCount: 0,
      memories: [],
      state: "not_recorded",
      dispatchedAt: null,
    });
    const zeroMatchReceipt = await recordLongTermMemoryZeroMatch("zero-match-chat", storageService.root);
    assert.ok(zeroMatchReceipt);
    assert.equal(Array.isArray(zeroMatchReceipt.chunks), true);
    assert.equal(zeroMatchReceipt.chunks.length, 0);
    const zeroMatchInjection = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/last-injection/zero-match-chat",
      headers,
    });
    assert.equal(zeroMatchInjection.statusCode, 200, zeroMatchInjection.body);
    assert.deepEqual(
      {
        memoryCount: zeroMatchInjection.json().memoryCount,
        tokenCount: zeroMatchInjection.json().tokenCount,
        memories: zeroMatchInjection.json().memories,
        state: zeroMatchInjection.json().state,
      },
      { memoryCount: 0, tokenCount: 0, memories: [], state: "no_matches" },
    );
    assert.ok(
      typeof zeroMatchInjection.json().dispatchedAt === "string" &&
        Number.isFinite(Date.parse(zeroMatchInjection.json().dispatchedAt)),
      "a zero-match recall must carry a parseable dispatchedAt timestamp",
    );
    const recallZeroMatch = await prepareGenerationLongTermMemory({
      root: storageService.root,
      chatId: "game-empty",
      chatMode: "game",
      characterIds: [],
      messages: [{ role: "user", content: "A query that matches no saved memory." }],
    });
    assert.equal(recallZeroMatch, null, "a zero-match recall injects nothing");
    const recalledZeroMatch = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/last-injection/game-empty",
      headers,
    });
    assert.equal(recalledZeroMatch.json().state, "no_matches");
    assert.equal(recalledZeroMatch.json().memoryCount, 0);
    const missingDraft = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/drafts/10000000-0000-4000-8000-000000000099/accept",
      headers,
      payload: {},
    });
    assert.equal(missingDraft.statusCode, 404, missingDraft.body);
    assert.equal(missingDraft.json().code, "ltm_draft_not_found");
    assert.deepEqual(Object.keys(status.json().indexes).sort(), [
      "chunkCount",
      "chunkFormatVersion",
      "dirty",
      "embeddedChunkCount",
      "embeddingsAvailable",
      "errors",
      "generatedAt",
      "health",
      "noteCount",
      "rebuildState",
      "sourceHash",
      "warnings",
    ]);
    assert.equal("generationId" in status.json().indexes, false);
    assert.equal("manifestAvailable" in status.json().indexes, false);
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
          history: {
            text: "The observatory was sealed after the eclipse.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(created.statusCode, 201, created.body);
    const secondCreated = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        ...created.json().note,
        id: "world_route_second",
        title: "Second route fixture",
        scope: { chatId: "chat-z", chatIds: ["chat-z"] },
      },
    });
    assert.equal(secondCreated.statusCode, 201, secondCreated.body);
    const unfiltered = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes",
      headers,
    });
    assert.equal(unfiltered.statusCode, 200, unfiltered.body);
    assert.equal(
      unfiltered.json().some((note: any) => note.id === "world_route_fixture"),
      true,
    );
    const byIds = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?ids=world_route_second,world_route_fixture,world_route_second,world_missing_route",
      headers,
    });
    assert.equal(byIds.statusCode, 200, byIds.body);
    assert.deepEqual(
      byIds.json().map((note: any) => note.id),
      ["world_route_second", "world_route_fixture"],
    );
    assert.equal(byIds.headers["x-ltm-has-more"], undefined);
    assert.equal(byIds.headers["x-ltm-next-offset"], undefined);
    for (const [key, value] of [
      ["type", "world"],
      ["status", "active"],
      ["tag", "route_fixture"],
      ["scopeChatIds", "chat-a"],
      ["scopeGroupId", "group-a"],
      ["scopeGroupIds", "group-a"],
      ["scopeCharacterIds", "character-a"],
      ["scopePersonaId", "persona-a"],
      ["scopePersonaIds", "persona-a"],
      ["includeGlobal", "false"],
      ["offset", "0"],
      ["limit", "1"],
    ]) {
      const incompatible = await app.inject({
        method: "GET",
        url: `/api/long-term-memory/notes?ids=world_route_fixture&${key}=${value}`,
        headers,
      });
      assert.equal(incompatible.statusCode, 400, `${key}: ${incompatible.body}`);
    }
    const emptyIds = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?ids=",
      headers,
    });
    assert.equal(emptyIds.statusCode, 400, emptyIds.body);
    const malformedIds = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?ids=INVALID-ID",
      headers,
    });
    assert.equal(malformedIds.statusCode, 400, malformedIds.body);
    const overflowIds = await app.inject({
      method: "GET",
      url: `/api/long-term-memory/notes?ids=${Array.from({ length: 101 }, (_, index) => `world_route_overflow_${index}`).join(",")}`,
      headers,
    });
    assert.equal(overflowIds.statusCode, 400, overflowIds.body);
    const conflictingScope = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        ...created.json().note,
        id: "world_route_scope_conflict",
        scope: { chatId: "chat-a", chatIds: ["chat-b"] },
      },
    });
    assert.equal(conflictingScope.statusCode, 400, conflictingScope.body);
    const recentEvents = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/events?noteId=world_route_fixture&limit=5",
      headers,
    });
    assert.equal(recentEvents.statusCode, 200, recentEvents.body);
    assert.equal(recentEvents.json().events[0]?.target, "world_route_fixture");
    const globalScopeRejected = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: { ...created.json().note, id: "world_route_global_rejected", title: "Global rejected", scope: {} },
    });
    assert.equal(globalScopeRejected.statusCode, 400, globalScopeRejected.body);
    assert.match(globalScopeRejected.json().error, /place where this memory is available/u);
    const missingTitle = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: { ...created.json().note, id: "world_missing_route_title", title: undefined },
    });
    assert.equal(missingTitle.statusCode, 400, missingTitle.body);
    const missingCharacterSubject = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: { ...created.json().note, id: "char_missing_route_subject", type: "character" },
    });
    assert.equal(missingCharacterSubject.statusCode, 400, missingCharacterSubject.body);
    const validCharacter = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        ...created.json().note,
        id: "char_route_subject",
        type: "character",
        scope: { chatId: "chat-validation", chatIds: ["chat-validation"] },
        subjects: [{ key: "character:character-mara", ref: { kind: "character", id: "character-mara" } }],
      },
    });
    assert.equal(validCharacter.statusCode, 201, validCharacter.body);
    const invalidCharacterPatch = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/char_route_subject",
      headers,
      payload: { subjects: [] },
    });
    assert.equal(invalidCharacterPatch.statusCode, 400, invalidCharacterPatch.body);
    await storageService.storage.createNote({
      ...created.json().note,
      id: "char_legacy_route_correction",
      title: "Legacy character",
      type: "character",
      scope: { chatId: "chat-validation", chatIds: ["chat-validation"] },
    });
    const legacySubjectCorrection = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/char_legacy_route_correction",
      headers,
      payload: { subjects: [{ key: "character:character-mara", ref: { kind: "character", id: "character-mara" } }] },
    });
    assert.equal(legacySubjectCorrection.statusCode, 200, legacySubjectCorrection.body);
    await storageService.storage.createNote({
      ...created.json().note,
      id: "world_legacy_route_correction",
      title: undefined,
      scope: { chatId: "chat-validation", chatIds: ["chat-validation"] },
    });
    const legacyCorrection = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/world_legacy_route_correction",
      headers,
      payload: { title: "Corrected legacy title" },
    });
    assert.equal(legacyCorrection.statusCode, 200, legacyCorrection.body);
    const renamePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/world_route_fixture/sections/rename-preview",
      headers,
      payload: { fromSectionKey: "facts", toSectionKey: "details" },
    });
    assert.equal(renamePreview.statusCode, 200, renamePreview.body);
    assert.deepEqual(renamePreview.json(), {
      fromSectionKey: "facts",
      toSectionKey: "details",
      rewrittenDraftCount: 0,
      rewrittenDraftIds: [],
    });
    const renamed = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/world_route_fixture/sections/rename",
      headers,
      payload: { fromSectionKey: "facts", toSectionKey: "details" },
    });
    assert.equal(renamed.statusCode, 200, renamed.body);
    assert.deepEqual(Object.keys(renamed.json().note.sections), ["details", "history"]);
    assert.equal(renamed.json().note.sections.details.text, "The cobalt key is beneath the observatory.");
    assert.equal(renamed.json().rebuild.status, "complete");
    const rebuildPath = join(dataDir, "long-term-memory", "indexes", "recall.json");
    await rm(rebuildPath, { force: true });
    await mkdir(rebuildPath);
    const savedWithStaleRecall = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/world_route_fixture",
      headers,
      payload: { title: "Route fixture saved while recall is stale" },
    });
    assert.equal(savedWithStaleRecall.statusCode, 200, savedWithStaleRecall.body);
    assert.equal(savedWithStaleRecall.json().rebuild.status, "deferred");
    assert.equal(
      (await storageService.storage.getNote("world_route_fixture"))?.title,
      "Route fixture saved while recall is stale",
      "ordinary edits persist even when their required recall rebuild fails",
    );
    await rm(rebuildPath, { recursive: true, force: true });
    const rebuiltAfterFailure = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/rebuild",
      headers,
    });
    assert.equal(rebuiltAfterFailure.statusCode, 200, rebuiltAfterFailure.body);
    const renameSectionCollision = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/world_route_fixture/sections/rename",
      headers,
      payload: { fromSectionKey: "details", toSectionKey: "history" },
    });
    assert.equal(renameSectionCollision.statusCode, 409, renameSectionCollision.body);
    assert.equal(renameSectionCollision.json().code, "ltm_section_already_exists");
    const rebuiltStatus = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/status",
      headers,
    });
    assert.equal(rebuiltStatus.json().indexes.chunkFormatVersion, 4);
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
    assert.deepEqual((await storageService.storage.getNote("world_route_fixture")).modes, ["roleplay", "game"]);
    assert.equal((await storageService.storage.getNote("world_route_fixture")).tags.includes("batch_fixture"), true);
    const tooManyBatchIds = Array.from({ length: 101 }, (_, index) => `world_batch_${index}`);
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
            title: "Concurrent fixture",
            type: "world",
            status: "active",
            modes: ["roleplay"],
            scope: { chatId: "chat-concurrent", chatIds: ["chat-concurrent"] },
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
    assert.deepEqual(concurrent.map((response) => response.statusCode).sort(), [201, 409]);
    const globalCreate = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "world_global_create_fixture",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: {},
        tags: [],
        keywords: [],
        links: [],
        sections: {
          facts: {
            text: "New memories require an explicit place.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(globalCreate.statusCode, 400, globalCreate.body);
    const listed = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=chat-a&includeGlobal=false",
      headers,
    });
    assert.equal(
      listed.json().some((note: any) => note.id === "world_route_fixture"),
      true,
    );
    const personaScoped = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "world_persona_scoped",
        title: "Persona-scoped fixture",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: {
          chatId: "chat-a",
          chatIds: ["chat-a"],
          personaId: "persona-fixture",
          personaIds: ["persona-fixture"],
        },
        tags: ["route_fixture"],
        keywords: [],
        links: [],
        sections: {
          facts: {
            text: "Only the matching persona may see this fixture.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(personaScoped.statusCode, 201, personaScoped.body);
    const globalizePersonaScoped = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/world_persona_scoped",
      headers,
      payload: { scope: {} },
    });
    assert.equal(globalizePersonaScoped.statusCode, 400, globalizePersonaScoped.body);
    assert.match(globalizePersonaScoped.json().error, /scope-removal action/);
    assert.deepEqual((await storageService.storage.getNote("world_persona_scoped"))?.scope, {
      chatId: "chat-a",
      chatIds: ["chat-a"],
      personaId: "persona-fixture",
      personaIds: ["persona-fixture"],
    });
    const missingPersonaScope = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=chat-a&includeGlobal=false",
      headers,
    });
    assert.equal(
      missingPersonaScope.json().some((note: any) => note.id === "world_persona_scoped"),
      true,
    );
    const matchingPersonaScope = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=chat-a&scopePersonaId=persona-fixture&includeGlobal=false",
      headers,
    });
    assert.equal(
      matchingPersonaScope.json().some((note: any) => note.id === "world_persona_scoped"),
      true,
    );
    const removePersonaChatScope = await app.inject({
      method: "DELETE",
      url: "/api/long-term-memory/notes/world_persona_scoped/scope/current-chat",
      headers,
      payload: { chatId: "chat-a" },
    });
    assert.equal(removePersonaChatScope.statusCode, 200, removePersonaChatScope.body);
    assert.equal(removePersonaChatScope.json().deleted, false);
    assert.deepEqual((await storageService.storage.getNote("world_persona_scoped"))?.scope, {
      personaId: "persona-fixture",
      personaIds: ["persona-fixture"],
    });
    const chatOnly = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "world_chat_only_scope",
        title: "Chat-only fixture",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: [],
        links: [],
        sections: {
          facts: {
            text: "This fixture has no remaining explicit scope.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    });
    assert.equal(chatOnly.statusCode, 201, chatOnly.body);
    const removeFinalChatScope = await app.inject({
      method: "DELETE",
      url: "/api/long-term-memory/notes/world_chat_only_scope/scope/current-chat",
      headers,
      payload: { chatId: "chat-a" },
    });
    assert.equal(removeFinalChatScope.statusCode, 200, removeFinalChatScope.body);
    assert.equal(removeFinalChatScope.json().deleted, true);
    assert.equal(await storageService.storage.getNote("world_chat_only_scope"), null);
    await storageService.storage.createNote({
      id: "world_concurrent_scope_removal",
      title: "Concurrent scope removal fixture",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: {
        chatId: "chat-a",
        chatIds: ["chat-a", "chat-b"],
        personaId: "persona-fixture",
      },
      tags: [],
      keywords: [],
      links: [],
      sections: {
        facts: {
          text: "Concurrent removals must not restore a removed scope.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    await Promise.all([
      storageService.storage.removeNoteFromScope("world_concurrent_scope_removal", { chatIds: ["chat-a"] }),
      storageService.storage.removeNoteFromScope("world_concurrent_scope_removal", { chatIds: ["chat-b"] }),
    ]);
    assert.deepEqual((await storageService.storage.getNote("world_concurrent_scope_removal"))?.scope, {
      personaId: "persona-fixture",
      personaIds: ["persona-fixture"],
    });
    await storageService.storage.createNote({
      id: "world_professor_mari_group",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { groupId: "professor-mari-only" },
      tags: [],
      keywords: [],
      links: [],
      sections: {
        facts: {
          text: "Professor Mari's group must not be a scope target.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
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
      ["chat-a"],
    );
    assert.equal(
      scopeTargets.json().groups.some((group: any) => group.id === "professor-mari-only"),
      false,
    );
    assert.equal(
      scopeTargets.json().chats.some((chat: any) => chat.id === "game-empty"),
      false,
    );
    assert.equal(
      scopeTargets
        .json()
        .characters.some((character: any) => character.id === "character-mara" && character.label === "Mara"),
      true,
      JSON.stringify(scopeTargets.json().characters),
    );
    assert.equal(
      scopeTargets.json().characters.some((character: any) => character.id === "character-nyra"),
      false,
    );
    const allScopeTargets = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/scope-targets?chatId=chat-a&includeAllChats=true",
      headers,
    });
    assert.equal(allScopeTargets.statusCode, 200, allScopeTargets.body);
    assert.equal(
      allScopeTargets.json().chats.some((chat: any) => chat.id === "game-empty"),
      true,
    );
    assert.deepEqual(allScopeTargets.json().personas, [
      { id: "persona-a", label: "Kira Luna", comment: "Space explorer" },
      { id: "persona-b", label: "Kira Luna", comment: "Private detective" },
    ]);
    assert.equal(
      allScopeTargets.json().chats.some((chat: any) => chat.id === "chat-professor-mari"),
      false,
    );
    assert.equal(
      allScopeTargets.json().characters.some((character: any) => character.id === "__professor_mari__"),
      false,
    );
    assert.equal(
      allScopeTargets
        .json()
        .characters.some((character: any) => character.id === "character-nyra" && character.label === "Nyra"),
      true,
    );
    assert.deepEqual(
      allScopeTargets.json().groups.find((group: any) => group.id === "observatory-branches"),
      {
        id: "observatory-branches",
        label: "Observatory",
        chatIds: ["chat-a", "game-a"],
      },
    );
    assert.equal(
      allScopeTargets.json().groups.some((group: any) => group.id === "professor-mari-only"),
      false,
    );
    const professorMariCharacterPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "characters", limit: 10 },
    });
    assert.equal(professorMariCharacterPreview.statusCode, 200);
    assert.equal(
      professorMariCharacterPreview.json().samples.some((sample: any) => sample.sourceId === "__professor_mari__"),
      false,
    );
    assert.equal(
      professorMariCharacterPreview.json().samples.some((sample: any) => sample.sourceId === "character-mara"),
      true,
    );
    const professorMariCharacterImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "characters",
        sourceIds: ["__professor_mari__"],
        extract: false,
      },
    });
    assert.equal(professorMariCharacterImport.statusCode, 200);
    assert.deepEqual(professorMariCharacterImport.json().missingSourceIds, ["__professor_mari__"]);
    assert.equal(professorMariCharacterImport.json().imported.length, 0);
    assert.equal(
      (await storageService.storage.listNotes({ type: "source" })).some(
        (note: any) => note.provenance?.sourceId === "__professor_mari__",
      ),
      false,
    );
    const professorMariChatPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 10 },
    });
    assert.equal(professorMariChatPreview.statusCode, 200);
    assert.equal(
      professorMariChatPreview
        .json()
        .samples.some((sample: any) => sample.sourceId === "chat-professor-mari:summary-mari"),
      false,
    );
    assert.equal(
      professorMariChatPreview.json().samples.some((sample: any) => sample.sourceId === "chat-a:summary-a"),
      true,
    );
    const professorMariChatImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: ["chat-professor-mari:summary-mari"],
        extract: false,
      },
    });
    assert.equal(professorMariChatImport.statusCode, 200);
    assert.deepEqual(professorMariChatImport.json().missingSourceIds, ["chat-professor-mari:summary-mari"]);
    assert.equal(professorMariChatImport.json().imported.length, 0);
    for (const note of [
      {
        id: "world_scope_character",
        scope: { characterIds: ["character-mara"] },
      },
      {
        id: "world_scope_chat",
        scope: {
          chatId: "chat-b",
          chatIds: ["chat-b"],
        },
      },
      {
        id: "world_scope_group",
        scope: {
          groupId: "observatory-branches",
          chatId: "chat-a",
          chatIds: ["chat-a", "game-a"],
          characterIds: ["character-mara"],
        },
      },
      {
        id: "world_scope_branch",
        scope: {
          chatId: "game-a",
          chatIds: ["game-a"],
          characterIds: ["character-mara"],
        },
      },
      {
        id: "world_scope_other_character",
        scope: {
          chatId: "chat-a",
          chatIds: ["chat-a"],
          characterIds: ["character-nyra"],
        },
      },
    ]) {
      await storageService.storage.createNote({
        ...note,
        type: "world",
        status: "active",
        modes: ["roleplay"],
        tags: [],
        keywords: [],
        links: [],
        sections: { facts: { text: note.id, updatedAt: "2026-07-17T00:00:00.000Z" } },
      });
    }
    const characterAllChats = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=chat-a,game-a,chat-b&scopeCharacterIds=character-mara&includeGlobal=false",
      headers,
    });
    assert.deepEqual(
      characterAllChats
        .json()
        .map((note: any) => note.id)
        .sort(),
      [
        "world_route_fixture",
        "world_scope_branch",
        "world_scope_character",
        "world_scope_chat",
        "world_scope_group",
        "world_scope_other_character",
      ].sort(),
    );
    await storageService.storage.createNote({
      id: "world_character_persona_scoped",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: {
        chatId: "chat-a",
        chatIds: ["chat-a"],
        characterIds: ["character-mara"],
        personaId: "persona-fixture",
      },
      tags: [],
      keywords: [],
      links: [],
      sections: {
        facts: {
          text: "Character filtering does not require a selected persona.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const characterWithoutPersona = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=chat-a&scopeCharacterIds=character-mara&includeGlobal=false",
      headers,
    });
    assert.equal(
      characterWithoutPersona.json().some((note: any) => note.id === "world_character_persona_scoped"),
      true,
    );
    assert.equal(new Set(characterAllChats.json().map((note: any) => note.id)).size, characterAllChats.json().length);
    await storageService.storage.createNote({
      id: "char_mara",
      type: "character",
      status: "active",
      modes: ["roleplay"],
      scope: { characterIds: ["character-mara"] },
      tags: [],
      keywords: [],
      links: [],
      sections: {
        persona: {
          text: "Mara's unscoped character memory is selected by character ID.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const characterMemory = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeCharacterIds=character-mara&includeGlobal=false",
      headers,
    });
    assert.equal(
      characterMemory.json().some((note: any) => note.id === "char_mara"),
      true,
    );
    const characterAllBranches = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=chat-a,game-a&scopeGroupId=observatory-branches&scopeCharacterIds=character-mara&includeGlobal=false",
      headers,
    });
    assert.deepEqual(
      characterAllBranches
        .json()
        .map((note: any) => note.id)
        .sort(),
      [
        "char_mara",
        "world_character_persona_scoped",
        "world_route_fixture",
        "world_scope_branch",
        "world_scope_character",
        "world_scope_group",
        "world_scope_other_character",
      ].sort(),
    );
    const selectedBranch = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes?scopeChatIds=game-a&scopeGroupId=observatory-branches&scopeCharacterIds=character-mara&includeGlobal=false",
      headers,
    });
    assert.deepEqual(
      selectedBranch
        .json()
        .map((note: any) => note.id)
        .sort(),
      [
        "char_mara",
        "world_character_persona_scoped",
        "world_scope_branch",
        "world_scope_character",
        "world_scope_group",
      ].sort(),
    );
    await storageService.storage.deleteNotesPermanently(["char_mara"]);
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
    assert.equal(searched.json().chunks[0]?.chunk.noteId, "world_route_fixture");
    const transferPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer-preview",
      headers,
      payload: {
        noteIds: ["world_route_fixture"],
        mode: "copy",
        destinationChatId: "chat-b",
      },
    });
    assert.equal(transferPreview.statusCode, 200, transferPreview.body);
    assert.deepEqual(transferPreview.json().buckets.ready, ["world_route_fixture"]);
    await storageService.storage.createNote({
      id: "world_transfer_destination_conflict",
      title: "Destination conflict",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-b", chatIds: ["chat-b"] },
      tags: [],
      keywords: [],
      links: [],
      sections: {
        facts: {
          text: "The cobalt key is beneath the observatory.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const staleTransfer = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer",
      headers,
      payload: {
        requestedNoteIds: ["world_route_fixture"],
        derivedNoteIds: [],
        applyNoteIds: ["world_route_fixture"],
        mode: "copy",
        destinationChatId: "chat-b",
      },
    });
    assert.equal(staleTransfer.statusCode, 409, staleTransfer.body);
    assert.match(staleTransfer.json().error, /Refresh the preview/);
    assert.deepEqual((await storageService.storage.getNote("world_route_fixture")).scope, {
      chatId: "chat-a",
      chatIds: ["chat-a"],
    });
    await storageService.storage.deleteNotesPermanently(["world_transfer_destination_conflict"]);
    const transfer = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer",
      headers,
      payload: {
        requestedNoteIds: ["world_route_fixture"],
        derivedNoteIds: [],
        applyNoteIds: ["world_route_fixture"],
        mode: "copy",
        destinationChatId: "chat-b",
      },
    });
    assert.equal(transfer.statusCode, 200, transfer.body);
    assert.deepEqual(transfer.json().updatedNoteIds, ["world_route_fixture"]);
    assert.deepEqual(Object.keys(transfer.json().rebuild).sort(), [
      "chunkCount",
      "embeddedChunkCount",
      "embeddingsAvailable",
      "generatedAt",
      "noteCount",
    ]);
    assert.equal("manifest" in transfer.json().rebuild, false);
    assert.equal("sourceChunkCount" in transfer.json().rebuild, false);
    await storageService.storage.createNote({
      id: "world_persona_transfer",
      title: "Persona transfer fixture",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: {
        chatId: "chat-persona-a",
        chatIds: ["chat-persona-a"],
        personaId: "persona-a",
      },
      tags: [],
      keywords: [],
      links: [],
      sections: {
        facts: {
          text: "This memory belongs to persona A.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const personaTransfer = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer",
      headers,
      payload: {
        requestedNoteIds: ["world_persona_transfer"],
        derivedNoteIds: [],
        applyNoteIds: ["world_persona_transfer"],
        mode: "copy",
        destinationChatId: "chat-persona-b",
      },
    });
    assert.equal(personaTransfer.statusCode, 200, personaTransfer.body);
    assert.deepEqual((await storageService.storage.getNote("world_persona_transfer")).scope, {
      chatId: "chat-persona-a",
      chatIds: ["chat-persona-a", "chat-persona-b"],
      characterIds: ["character-mara"],
      personaId: "persona-a",
      personaIds: ["persona-a", "persona-b"],
    });
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
    assert.equal(extractSource.statusCode, 400, extractSource.body);
    await storageService.storage.createNote({
      id: "source_route_extract",
      title: "Observatory report",
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
        entryId: "route-extract",
      },
      sections: {
        source: {
          text: "Mara seals the observatory gate at dusk.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const sourceMetadataUpdate = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/source_route_extract",
      headers,
      payload: { title: "Updated observatory report" },
    });
    assert.equal(sourceMetadataUpdate.statusCode, 200, sourceMetadataUpdate.body);
    assert.equal(sourceMetadataUpdate.json().note.title, "Updated observatory report");
    const sourceContentUpdate = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/source_route_extract",
      headers,
      payload: {
        sections: {
          source: {
            text: "Replaced source text.",
            updatedAt: "2026-07-17T01:00:00.000Z",
          },
        },
      },
    });
    assert.equal(sourceContentUpdate.statusCode, 400, sourceContentUpdate.body);
    assert.equal(
      (await storageService.storage.getNote("source_route_extract")).sections.source.text,
      "Mara seals the observatory gate at dusk.",
    );
    const inferredChatExtraction = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: {},
    });
    assert.equal(inferredChatExtraction.statusCode, 200, inferredChatExtraction.body);
    assert.equal(modelRequests.at(-1)?.chatConnectionId, "connection-a");
    await storageService.storage.createNote({
      id: "source_route_extract_unknown_chat",
      title: "Unknown source chat fixture",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: {
        kind: "chat_summary",
        sourceId: "missing-chat",
        entryId: "route-extract-unknown",
      },
      sections: {
        source: {
          text: "This source keeps its existing scope.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const unknownInferredChatExtraction = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract_unknown_chat/extract",
      headers,
      payload: {},
    });
    assert.equal(unknownInferredChatExtraction.statusCode, 200, unknownInferredChatExtraction.body);
    assert.equal(modelRequests.at(-1)?.chatConnectionId, null);
    await storageService.storage.createNote({
      id: "source_delete_keep",
      title: "Keep source fixture",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: {
        kind: "chat_summary",
        sourceId: "chat-a",
        entryId: "delete-keep",
      },
      sections: {
        source: {
          text: "Keep this extracted memory.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    await storageService.storage.createNote({
      id: "world_delete_keep",
      title: "Kept extracted memory",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: [],
      keywords: [],
      links: [{ relation: "extracted_from", target: "source_delete_keep" }],
      sections: {
        facts: {
          text: "This memory remains.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const keepSource = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/permanent-delete",
      headers,
      payload: { ids: ["source_delete_keep"], retractExtracted: false },
    });
    assert.equal(keepSource.statusCode, 400, keepSource.body);
    assert.equal(keepSource.json().code, "ltm_source_lineage_preview_required");
    assert.ok(await storageService.storage.getNote("source_delete_keep"));
    assert.ok(await storageService.storage.getNote("world_delete_keep"));
    await storageService.storage.createNote({
      id: "source_delete_stale",
      title: "Stale source fixture",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "stale" },
      sections: { source: { text: "Stale source.", updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    await storageService.storage.createNote({
      ...created.json().note,
      id: "world_delete_stale_a",
      links: [{ relation: "extracted_from", target: "source_delete_stale" }],
    });
    await storageService.storage.createNote({
      ...created.json().note,
      id: "world_delete_stale_b",
      links: [{ relation: "extracted_from", target: "source_delete_stale" }],
    });
    const staleDelete = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/permanent-delete",
      headers,
      payload: {
        ids: ["source_delete_stale", "world_delete_stale_a"],
        retractExtracted: true,
        excludedNoteIds: [],
        lineageSourceNoteId: "source_delete_stale",
        expectedLineageNoteIds: ["source_delete_stale", "world_delete_stale_a"],
      },
    });
    assert.equal(staleDelete.statusCode, 409, staleDelete.body);
    assert.ok(await storageService.storage.getNote("world_delete_stale_b"));
    await storageService.storage.createNote({
      id: "source_delete_retract",
      title: "Retract source fixture",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: {
        kind: "chat_summary",
        sourceId: "chat-a",
        entryId: "delete-retract",
      },
      sections: {
        source: {
          text: "Retract this extracted memory.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    await storageService.storage.createNote({
      id: "world_delete_retract",
      title: "Retracted extracted memory",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: [],
      keywords: [],
      links: [{ relation: "extracted_from", target: "source_delete_retract" }],
      sections: {
        facts: {
          text: "This memory is retracted.",
          updatedAt: "2026-07-17T00:00:00.000Z",
          contributions: [
            {
              owner: "source",
              sourceNoteId: "source_delete_retract",
              sourceHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              text: "This memory is retracted.",
              updatedAt: "2026-07-17T00:00:00.000Z",
              evidence: ["source_note:source_delete_retract"],
            },
          ],
        },
      },
    });
    await storageService.storage.projectNote("world_delete_retract", "world", (current: any) => ({
      ...current,
      sections: {
        facts: {
          ...current.sections.facts,
          contributions: [
            {
              owner: "source",
              sourceNoteId: "source_delete_retract",
              sourceHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              text: "This memory is retracted.",
              updatedAt: "2026-07-17T00:00:00.000Z",
              evidence: ["source_note:source_delete_retract"],
            },
          ],
        },
      },
    }));
    const oversizedLineage = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/permanent-delete",
      headers,
      payload: {
        ids: ["source_delete_retract"],
        retractExtracted: true,
        excludedNoteIds: ["world_delete_retract"],
        lineageSourceNoteId: "source_delete_retract",
        expectedLineageNoteIds: [
          "source_delete_retract",
          "world_delete_retract",
          ...Array.from({ length: 998 }, (_, index) => `world_lineage_${index}`),
        ],
      },
    });
    assert.equal(
      oversizedLineage.statusCode,
      409,
      "a 1,000-ID lineage must pass request validation before stale-lineage detection",
    );
    const retractSource = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/permanent-delete",
      headers,
      payload: {
        ids: ["source_delete_retract"],
        retractExtracted: true,
        excludedNoteIds: ["world_delete_retract"],
        lineageSourceNoteId: "source_delete_retract",
        expectedLineageNoteIds: ["source_delete_retract", "world_delete_retract"],
      },
    });
    assert.equal(retractSource.statusCode, 200, retractSource.body);
    assert.deepEqual(retractSource.json().detachedNoteIds, ["world_delete_retract"]);
    assert.equal(await storageService.storage.getNote("source_delete_retract"), null);
    assert.deepEqual((await storageService.storage.getNote("world_delete_retract"))?.sections.facts.contributions, [
      {
        owner: "manual",
        text: "This memory is retracted.",
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
    ]);
    const derivedResponse = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes/source_delete_retract/derived",
      headers,
    });
    assert.equal(derivedResponse.statusCode, 404);
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
    assert.equal(missingModel.json().code, "ltm_model_configuration");
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
      ["char_mara", "timeline_observatory_gate_sealed_1bbd9d3c48", "world_observatory_gate"],
    );
    assert.deepEqual(
      extracted.json().draft?.mutations.find((mutation: any) => mutation.note?.id === "char_mara")?.note.subjects,
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
    assert.equal("model" in completionOptions.at(-1), false);
    assert.equal("stream" in completionOptions.at(-1), false);
    assert.equal(
      completionMessages
        .at(-1)
        .some((message: any) => message.content.includes("Mara seals the observatory gate at dusk.")),
      true,
    );
    assert.deepEqual(
      completionOptions.at(-1)?.responseFormat?.json_schema?.schema?.properties?.units?.items?.properties?.claimKind
        ?.enum,
      ["static", "change"],
    );
    assert.equal(
      completionOptions
        .at(-1)
        ?.responseFormat?.json_schema?.schema?.properties?.units?.items?.required?.includes("claimKind"),
      true,
    );
    const grammarErrors = [
      "Failed to initialize samplers: failed to parse grammar",
      "Failed to parse grammar",
      "Error parsing grammar",
    ];
    for (const errorMessage of grammarErrors) {
      grammarErrorMessage = errorMessage;
      failGrammarOnce = true;
      const grammarFallback = await app.inject({
        method: "POST",
        url: "/api/long-term-memory/notes/source_route_extract/extract",
        headers,
        payload: { chatId: "chat-a" },
      });
      assert.equal(grammarFallback.statusCode, 200, grammarFallback.body);
      assert.deepEqual(
        grammarFallback
          .json()
          .draft?.mutations.map((mutation: any) => mutation.note?.id)
          .sort(),
        ["char_mara", "timeline_observatory_gate_sealed_1bbd9d3c48", "world_observatory_gate"],
      );
      assert.equal(completionOptions.at(-2)?.responseFormat?.type, "json_schema");
      assert.equal("responseFormat" in completionOptions.at(-1), false);
    }
    fitContextMode = "reduced";
    const reducedBudget = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a" },
    });
    assert.equal(reducedBudget.statusCode, 200, reducedBudget.body);
    assert.equal(completionOptions.at(-1)?.maxTokens, 123);
    fitContextMode = "trimmed";
    const trimmedContext = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a" },
    });
    assert.equal(trimmedContext.statusCode, 400, trimmedContext.body);
    assert.equal(trimmedContext.json().code, "ltm_model_context_capacity");
    assert.match(trimmedContext.json().error, /source is too large/);
    fitContextMode = "normal";
    assert.equal(
      debugOverrides.some((entry) => entry.enabled && entry.message.includes("extraction prompt")),
      true,
    );
    await storageService.storage.createNote({
      id: "world_cross_scope_derived",
      title: "Cross-scope derived memory",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-b", chatIds: ["chat-b"] },
      tags: [],
      keywords: [],
      links: [{ target: "source_route_extract", relation: "extracted_from" }],
      sections: {
        facts: {
          text: "A memory derived in another chat.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const crossScopeDerived = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/notes/source_route_extract/derived",
      headers,
    });
    assert.equal(crossScopeDerived.statusCode, 200, crossScopeDerived.body);
    assert.equal(
      crossScopeDerived
        .json()
        .memories.some(
          (note: any) =>
            note.id === "world_cross_scope_derived" &&
            note.scope.chatId === "chat-b" &&
            note.sections === undefined &&
            note.previewText === "A memory derived in another chat." &&
            typeof note.incomingLinkCount === "number" &&
            typeof note.outgoingLinkCount === "number",
        ),
      true,
    );
    assert.equal(typeof crossScopeDerived.json().sourceIncomingLinkCount, "number");
    await storageService.storage.createNote({
      id: "source_transfer_second_parent",
      title: "Second transfer parent",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "second-parent" },
      sections: { source: { text: "Second parent.", updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    await storageService.storage.createNote({
      ...created.json().note,
      id: "world_transfer_multi_source",
      links: [
        { target: "source_route_extract", relation: "extracted_from" },
        { target: "source_transfer_second_parent", relation: "extracted_from" },
      ],
    });
    await storageService.storage.createNote({
      ...created.json().note,
      id: "world_transfer_multi_descendant",
      links: [{ target: "world_transfer_multi_source", relation: "extracted_from" }],
    });
    const transferWithDerived = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer-preview",
      headers,
      payload: {
        noteIds: ["source_route_extract"],
        mode: "copy",
        destinationChatId: "chat-b",
        includeDerived: true,
      },
    });
    assert.equal(transferWithDerived.statusCode, 200, transferWithDerived.body);
    assert.equal(transferWithDerived.json().selection.derivedNoteIds.includes("world_cross_scope_derived"), true);
    assert.equal(
      transferWithDerived.json().selection.derivedNoteIds.includes("world_transfer_multi_descendant"),
      true,
      "transfer must retain descendants through every extracted_from parent",
    );
    assert.deepEqual(
      transferWithDerived.json().items.find((item: any) => item.noteId === "world_transfer_multi_source")
        ?.sourceNoteIds,
      ["source_route_extract", "source_transfer_second_parent"],
    );
    const transferWithoutDerived = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer-preview",
      headers,
      payload: {
        noteIds: ["source_route_extract"],
        mode: "copy",
        destinationChatId: "chat-b",
        includeDerived: false,
      },
    });
    assert.equal(transferWithoutDerived.statusCode, 200, transferWithoutDerived.body);
    assert.equal(transferWithoutDerived.json().selection.includedDerivedCount, 0);
    const transferWithSelectedDerived = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer-preview",
      headers,
      payload: {
        noteIds: ["source_route_extract"],
        derivedNoteIds: ["world_cross_scope_derived"],
        mode: "copy",
        destinationChatId: "chat-b",
      },
    });
    assert.equal(transferWithSelectedDerived.statusCode, 200, transferWithSelectedDerived.body);
    assert.deepEqual(transferWithSelectedDerived.json().selection.derivedNoteIds, ["world_cross_scope_derived"]);
    await storageService.storage.createNote({
      id: "source_transfer_noop_root",
      title: "No-op transfer root",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-b", chatIds: ["chat-b"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      provenance: {
        kind: "lorebook",
        sourceId: "transfer-fixture",
        entryId: "root",
      },
      sections: {
        source: {
          text: "Transfer root",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    await storageService.storage.createNote({
      id: "world_transfer_ready_derived",
      title: "Ready derived transfer",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: [],
      keywords: [],
      links: [{ target: "source_transfer_noop_root", relation: "extracted_from" }],
      sections: {
        facts: {
          text: "Ready derived transfer",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const derivedOnlyPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer-preview",
      headers,
      payload: {
        noteIds: ["source_transfer_noop_root"],
        mode: "copy",
        destinationChatId: "chat-b",
        includeDerived: true,
      },
    });
    assert.equal(derivedOnlyPreview.statusCode, 200, derivedOnlyPreview.body);
    assert.deepEqual(derivedOnlyPreview.json().buckets.noOp, ["source_transfer_noop_root"]);
    assert.deepEqual(derivedOnlyPreview.json().buckets.ready, ["world_transfer_ready_derived"]);
    const derivedOnlyApply = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/transfer",
      headers,
      payload: {
        requestedNoteIds: ["source_transfer_noop_root"],
        derivedNoteIds: ["world_transfer_ready_derived"],
        applyNoteIds: ["world_transfer_ready_derived"],
        mode: "copy",
        destinationChatId: "chat-b",
      },
    });
    assert.equal(derivedOnlyApply.statusCode, 200, derivedOnlyApply.body);
    assert.deepEqual(derivedOnlyApply.json().updatedNoteIds, ["world_transfer_ready_derived"]);
    const extractionActivity = (
      await app.inject({
        method: "GET",
        url: "/api/long-term-memory/debug-log?sourceNoteId=source_route_extract",
        headers,
      })
    ).json().events as any[];
    const extractionOperationId = extracted.json().operationId;
    assert.equal(
      extractionActivity.some(
        (event) =>
          event.operationId === extractionOperationId &&
          event.action === "extract_source_note" &&
          event.status === "ok",
      ),
      true,
    );
    const requestActivity = extractionActivity.find(
      (event) =>
        event.operationId === extractionOperationId &&
        event.action === "evidence_unit_request" &&
        event.status === "started",
    );
    assert.equal(requestActivity?.model, "request-model");
    assert.equal(requestActivity?.counts?.sourceChars, 40);
    assert.equal(requestActivity?.details?.reasoningEffort, "low");
    const extractionPhaseActivity = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/debug-log?phase=extraction",
      headers,
    });
    assert.equal(extractionPhaseActivity.statusCode, 200, extractionPhaseActivity.body);
    assert.equal(
      extractionPhaseActivity.json().events.length > 0 &&
        extractionPhaseActivity.json().events.every((event: any) => event.phase === "extraction"),
      true,
    );
    const errorActivity = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/debug-log?status=error",
      headers,
    });
    assert.equal(errorActivity.statusCode, 200, errorActivity.body);
    assert.equal(errorActivity.json().events.length > 0, true);
    assert.equal(
      errorActivity.json().events.every((event: any) => event.status === "error"),
      true,
    );
    for (const query of ["phase=invalid", "status=invalid"]) {
      const invalidDebugFilter = await app.inject({
        method: "GET",
        url: `/api/long-term-memory/debug-log?${query}`,
        headers,
      });
      assert.equal(invalidDebugFilter.statusCode, 400, invalidDebugFilter.body);
    }
    const chatDrafts = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/drafts?chatId=chat-a",
      headers,
    });
    assert.equal(chatDrafts.statusCode, 200, chatDrafts.body);
    assert.equal(
      chatDrafts.json().some((draft: any) => draft.id === extracted.json().draft.id),
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
    assert.equal(modelCalls > 1, true);
    const autoApplied = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a", applyLowRisk: true },
    });
    assert.equal(autoApplied.statusCode, 200, autoApplied.body);
    assert.equal(autoApplied.json().appliedMutationIds.length > 0, true);
    assert.equal(autoApplied.json().draft.indexRebuildStatus, "not_requested");
    assert.equal(modelCalls > 2, true);
    for (const [id, createdAt, text] of [
      ["char_mara_legacy_a", "2026-07-15T00:00:00.000Z", "Mara guards the eastern gate."],
      ["char_mara_legacy_b", "2026-07-16T00:00:00.000Z", "Mara seals the western gate."],
    ] as const) {
      await storageService.storage.createNote({
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
      });
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
      .candidates.find((candidate: any) => candidate.duplicateNoteIds.includes("char_mara_legacy_b"));
    assert.equal(identityCandidate.canonicalNoteId, "char_mara_legacy_a");
    const noOpIdentityApply = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/apply",
      headers,
      payload: {
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        repairs: [
          {
            candidateId: identityCandidate.id,
            canonicalNoteId: identityCandidate.canonicalNoteId,
            excludedNoteIds: identityCandidate.duplicateNoteIds,
            sectionChoices: [],
          },
        ],
      },
    });
    assert.equal(noOpIdentityApply.statusCode, 400, noOpIdentityApply.body);
    assert.equal(noOpIdentityApply.json().code, "identity_repair_noop");
    const swappedIdentityPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/preview",
      headers,
      payload: {
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        canonicalNoteIds: {
          [identityCandidate.id]: "char_mara_legacy_b",
        },
      },
    });
    assert.equal(swappedIdentityPreview.statusCode, 200, swappedIdentityPreview.body);
    const swappedIdentityCandidate = swappedIdentityPreview
      .json()
      .candidates.find((candidate: any) => candidate.id === identityCandidate.id);
    assert.equal(swappedIdentityCandidate.canonicalNoteId, "char_mara_legacy_b");
    assert.equal(
      swappedIdentityCandidate.additiveContent.some((content: any) =>
        content.addedLines.some((line: string) => line.includes("eastern gate")),
      ),
      true,
    );
    const staleCanonicalPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/preview",
      headers,
      payload: {
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        canonicalNoteIds: {
          [identityCandidate.id]: "char_missing_canonical",
        },
      },
    });
    assert.equal(staleCanonicalPreview.statusCode, 409, staleCanonicalPreview.body);
    assert.equal(staleCanonicalPreview.json().code, "identity_repair_stale");
    const identityApply = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/apply",
      headers,
      payload: {
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        repairs: [
          {
            candidateId: identityCandidate.id,
            canonicalNoteId: swappedIdentityCandidate.canonicalNoteId,
            excludedNoteIds: ["char_mara"],
            sectionChoices: [],
          },
        ],
      },
    });
    assert.equal(identityApply.statusCode, 200, identityApply.body);
    assert.deepEqual(Object.keys(identityApply.json().rebuild).sort(), [
      "chunkCount",
      "embeddedChunkCount",
      "embeddingsAvailable",
      "generatedAt",
      "noteCount",
    ]);
    assert.equal("manifest" in identityApply.json().rebuild, false);
    assert.equal("sourceChunkCount" in identityApply.json().rebuild, false);
    assert.deepEqual(identityApply.json().repairs[0].archivedNoteIds, ["char_mara_legacy_a"]);
    assert.deepEqual((await storageService.storage.getNote("char_mara_legacy_b")).subjects, [
      {
        key: "character:character-mara",
        ref: { kind: "character", id: "character-mara" },
      },
    ]);
    assert.match((await storageService.storage.getNote("char_mara_legacy_b")).sections.facts.text, /eastern gate/);
    assert.equal((await storageService.storage.getNote("char_mara_legacy_a")).status, "archived");
    assert.equal((await storageService.storage.getNote("world_route_fixture")).links[0].target, "char_mara_legacy_b");
    assert.equal(identityApply.json().integrity.ok, true);
    for (const [id, createdAt, text] of [
      ["char_nyra_persona_a", "2026-07-17T00:00:00.000Z", "Nyra charts the northern passage."],
      ["char_nyra_persona_b", "2026-07-18T00:00:00.000Z", "Nyra marks the southern passage."],
    ] as const) {
      await storageService.storage.createNote({
        id,
        title: "Nyra",
        type: "character",
        status: "active",
        modes: ["roleplay"],
        scope: { personaId: "persona-fixture" },
        tags: [],
        keywords: [],
        createdAt,
        updatedAt: createdAt,
        links: [],
        sections: { facts: { text, updatedAt: createdAt } },
      });
    }
    const personaIdentityPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/preview",
      headers,
      payload: { scope: { personaId: "persona-fixture" } },
    });
    assert.equal(personaIdentityPreview.statusCode, 200, personaIdentityPreview.body);
    const personaIdentityCandidate = personaIdentityPreview
      .json()
      .candidates.find((candidate: any) => candidate.duplicateNoteIds.includes("char_nyra_persona_b"));
    assert.ok(personaIdentityCandidate);
    const personaIdentityApply = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/identity-repair/apply",
      headers,
      payload: {
        scope: { personaId: "persona-fixture" },
        repairs: [
          {
            candidateId: personaIdentityCandidate.id,
            canonicalNoteId: personaIdentityCandidate.canonicalNoteId,
            excludedNoteIds: [],
            sectionChoices: [],
          },
        ],
      },
    });
    assert.equal(personaIdentityApply.statusCode, 200, personaIdentityApply.body);
    assert.deepEqual((await storageService.storage.getNote(personaIdentityCandidate.canonicalNoteId)).scope, {
      personaId: "persona-fixture",
      personaIds: ["persona-fixture"],
    });
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
        .samples.some((sample: any) => sample.sourceId === "chat-a:summary-a" && sample.freshness === "new"),
      true,
    );
    assert.equal(
      preview.json().samples.some((sample: any) => sample.sourceId === "game-a:game-session-1"),
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
        .samples.some((sample: any) => sample.sourceId.startsWith("chat-a:") || sample.sourceId.startsWith("game-a:")),
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
      branchPreview.json().samples.some((sample: any) => sample.sourceId === "chat-a:summary-a"),
      true,
    );
    assert.equal(
      branchPreview.json().samples.some((sample: any) => sample.sourceId === "game-a:game-session-1"),
      true,
    );
    const branchSourceId = branchPreview
      .json()
      .samples.find((sample: any) => sample.sourceId === "game-a:game-session-1").sourceId;
    const currentChatOnlyImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: [branchSourceId],
        chatId: "chat-a",
        extract: false,
      },
    });
    assert.equal(currentChatOnlyImport.statusCode, 200, currentChatOnlyImport.body);
    assert.deepEqual(currentChatOnlyImport.json().missingSourceIds, [branchSourceId]);
    const scopedBranchImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: [branchSourceId],
        chatId: "chat-a",
        scope: { groupId: "observatory-branches" },
        extract: false,
      },
    });
    assert.equal(scopedBranchImport.statusCode, 200, scopedBranchImport.body);
    assert.deepEqual(
      scopedBranchImport.json().imported.map((item: any) => item.sourceId),
      [branchSourceId],
    );
    const gamePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 10, mode: "game" },
    });
    assert.equal(
      gamePreview.json().samples.every((sample: any) => sample.sourceId === "game-a:game-session-1"),
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
    assert.equal(failedProvider.json().code, "ltm_model_configuration");
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
    assert.equal(completionOptions.at(-1)?.maxTokens, 4_000);
    assert.equal(completionOptions.at(-1)?.temperature, 0);
    assert.equal(completionOptions.at(-1)?.reasoningEffort, "low");
    assert.equal(completionOptions.at(-1)?.verbosity, "low");
    assert.equal(completionOptions.at(-1)?.responseFormat?.type, "json_schema");
    assert.equal("model" in completionOptions.at(-1), false);
    assert.equal("stream" in completionOptions.at(-1), false);
    assert.equal(
      completionMessages
        .at(-1)
        .some((message: any) => message.content.includes("Mara seals the observatory gate at dusk.")),
      true,
    );
    const importedChatNote = importedChat.json().imported[0].note;
    const currentChatPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 100 },
    });
    const currentChatSample = currentChatPreview
      .json()
      .samples.find((sample: any) => sample.sourceId === "chat-a:summary-a");
    assert.equal(currentChatSample.status, "imported");
    assert.equal(currentChatSample.freshness, "extraction_incomplete");
    assert.equal(currentChatSample.existingNoteId, importedChatNote.id);
    chats[0].metadata.summaryEntries.push({
      id: "summary-provenance-fallback",
      content: "A provenance fallback source remains imported.",
      enabled: true,
    });
    await storageService.storage.createNote({
      id: "source_provenance_fallback",
      title: "Fallback source",
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
        entryId: "summary-provenance-fallback",
      },
      sections: {
        source: {
          text: "Previously imported fallback text.",
          updatedAt: "2026-07-17T00:00:00.000Z",
          evidence: ["chat:chat-a", "summary_entry:summary-provenance-fallback"],
        },
      },
    });
    await storageService.storage.createNote({
      id: "source_duplicate_provenance",
      title: "Duplicate source",
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
        entryId: "summary-a",
      },
      sections: {
        source: {
          text: "Duplicate provenance must not beat the canonical ID.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const provenancePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 100 },
    });
    const fallbackSample = provenancePreview
      .json()
      .samples.find((sample: any) => sample.sourceId === "chat-a:summary-provenance-fallback");
    assert.equal(fallbackSample.status, "imported");
    assert.equal(fallbackSample.freshness, "extraction_incomplete");
    assert.equal(fallbackSample.existingNoteId, "source_provenance_fallback");
    assert.equal(
      provenancePreview.json().samples.find((sample: any) => sample.sourceId === "chat-a:summary-a").existingNoteId,
      importedChatNote.id,
    );
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
      payload: {
        source: "chats",
        sourceIds: ["chat-a:summary-a"],
        extract: false,
      },
    });
    assert.equal(refreshedChat.statusCode, 200, refreshedChat.body);
    assert.equal(refreshedChat.json().imported[0].extractionStatus, "not_started");
    assert.equal(refreshedChat.json().imported[0].outcome.state, "no_suggestions_created");
    assert.equal(refreshedChat.json().imported[0].draft, null);
    assert.equal(modelCalls, importCalls + 1);
    const refreshedNote = refreshedChat.json().imported[0].note;
    assert.equal(refreshedNote.tags.includes("user_tag"), true);
    assert.deepEqual(refreshedNote.keywords, ["preserve-me"]);
    assert.deepEqual(refreshedNote.links, [{ target: "world_route_fixture", relation: "evidenced_by" }]);
    assert.equal(refreshedNote.sections.notes.text, "User-owned section.");
    chats[0].metadata.summaryEntries.push({
      id: "summary-empty-response",
      content: "An empty provider response must remain retryable.",
      enabled: true,
    });
    emptyModelResponse = true;
    const emptyResponseImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["chat-a:summary-empty-response"] },
    });
    emptyModelResponse = false;
    assert.equal(emptyResponseImport.statusCode, 200, emptyResponseImport.body);
    assert.equal(emptyResponseImport.json().imported[0].extractionStatus, "failed");
    assert.equal(emptyResponseImport.json().imported[0].error.code, "extract_failed");
    assert.match(emptyResponseImport.json().imported[0].error.message, /empty_output/u);
    assert.equal(emptyResponseImport.json().imported[0].retryable, true);
    assert.equal(emptyResponseImport.json().imported[0].draft, null);
    assert.equal(emptyResponseImport.json().counts.sourceNotesWritten, 1);
    const emptyResponsePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 100 },
    });
    const emptyResponseSample = emptyResponsePreview
      .json()
      .samples.find((sample: any) => sample.sourceId === "chat-a:summary-empty-response");
    assert.equal(emptyResponseSample.freshness, "extraction_incomplete");
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
      provenance: {
        kind: "chat_summary",
        sourceId: "chat-a",
        entryId: "summary-legacy",
      },
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
    assert.equal(migrated.json().imported[0].note.tags.includes("legacy_tag"), true);
    const gameCalls = modelCalls;
    const gameResolutions = modelRequests.length;
    const importedGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "chats",
        sourceIds: ["game-a:game-session-1"],
        applyLowRisk: true,
      },
    });
    assert.equal(importedGame.statusCode, 200, importedGame.body);
    assert.equal(importedGame.json().imported[0]?.extractionMethod, "deterministic");
    assert.equal(importedGame.json().imported[0]?.extractionStatus, "succeeded");
    assert.equal(modelCalls, gameCalls);
    assert.equal(modelRequests.length, gameResolutions);
    assert.match(
      importedGame.json().imported[0].note.sections.source.text,
      /Summary:\nThe party discovered the Moon Vault\./,
    );
    assert.match(
      importedGame.json().imported[0].note.sections.source.text,
      /Party state:\nThe party holds the cobalt key\./,
    );
    assert.equal(importedGame.json().imported[0].draft.mutations.length > 0, true);
    const { configurePackageRuntime } =
      await import("../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/package-runtime.ts");
    releaseRuntimeOverride = configurePackageRuntime({
      dataDir,
      logger: {
        debug() {},
        info() {},
        warn(...args: any[]) {
          refineWarnings.push(args.map((value) => (value instanceof Error ? value.message : value)));
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
            connectionId: request.connectionId ?? request.chatConnectionId ?? "connection-a",
            model: request.model ?? "refine-model",
            maxContext: 32_000,
            maxOutputTokens: 4_000,
            async chatComplete(messages: any[], options: any) {
              modelCalls += 1;
              completionOptions.push(options);
              if (failGameRefine) throw new Error("Fixture refine failure");
              return {
                content: JSON.stringify({
                  summary: "Extracted Moon Vault discovery.",
                  units: [],
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
                alternate_greetings: JSON.stringify(["Welcome to the observatory."]),
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
                description: "A scoped lorebook description.",
                category: "npc",
                chatId: "chat-a",
                characterIds: ["character-mara"],
                tags: ["Cobalt Lore", "T".repeat(140)],
              },
              entries: [
                {
                  id: "entry-a",
                  name: "Gate",
                  content: "The cobalt gate opens only at dusk.",
                },
                {
                  id: "entry-large",
                  name: "Gate",
                  content: largeLoreEntry,
                },
                {
                  id: "description",
                  name: "Recorded Description",
                  content: "A real entry may use the synthetic description ID.",
                },
              ],
            },
            {
              id: "lorebook-empty",
              data: {
                name: "Scoped Lore",
                category: "empty",
                tags: [],
              },
              entries: [],
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
    const groupedLorePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/lorebooks/preview",
      headers,
      payload: {},
    });
    assert.equal(groupedLorePreview.statusCode, 200, groupedLorePreview.body);
    assert.equal(groupedLorePreview.json().counts.books, 2);
    assert.equal(groupedLorePreview.json().counts.entries, 4);
    assert.equal(groupedLorePreview.json().counts.candidates, 5);
    const groupedScopedLore = groupedLorePreview.json().books.find((book: any) => book.id === "lorebook-a");
    const groupedEmptyLore = groupedLorePreview.json().books.find((book: any) => book.id === "lorebook-empty");
    assert.equal(groupedScopedLore.name, groupedEmptyLore.name);
    assert.notEqual(groupedScopedLore.id, groupedEmptyLore.id);
    assert.equal(groupedScopedLore.tags[1].length, 120);
    assert.equal(
      new Set(groupedScopedLore.entries.map((entry: any) => entry.id)).size,
      groupedScopedLore.entries.length,
    );
    assert.deepEqual(groupedEmptyLore.entries, []);
    assert.deepEqual(groupedEmptyLore.counts, {
      entries: 0,
      candidates: 0,
      pending: 0,
      imported: 0,
    });
    const groupedLargeEntry = groupedScopedLore.entries.find((entry: any) => entry.id === "entry-large");
    assert.equal(groupedLargeEntry.name, "Gate");
    assert.equal(groupedLargeEntry.candidateCount, 2);
    assert.equal(
      groupedLargeEntry.candidates.every((candidate: any) => candidate.snippet.length <= 203),
      true,
    );
    const groupedImportSourceId = groupedScopedLore.entries.find((entry: any) => entry.id === "entry-a").candidates[0]
      .sourceId;
    const loreImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: {
        source: "lorebooks",
        sourceIds: [groupedImportSourceId],
      },
    });
    assert.equal(loreImport.statusCode, 200, loreImport.body);
    assert.deepEqual(loreImport.json().imported[0].note.scope, {
      chatId: "chat-a",
      chatIds: ["chat-a"],
      characterIds: ["character-mara"],
    });
    assert.equal(loreImport.json().imported[0].note.tags.includes("cobalt_lore"), true);
    const groupedAfterImport = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/lorebooks/preview",
      headers,
      payload: {},
    });
    const importedGroupedCandidate = groupedAfterImport
      .json()
      .books.find((book: any) => book.id === "lorebook-a")
      .entries.find((entry: any) => entry.id === "entry-a").candidates[0];
    assert.equal(importedGroupedCandidate.status, "imported");
    assert.equal(importedGroupedCandidate.freshness, "current");
    const characterPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "characters", limit: 10 },
    });
    assert.match(characterPreview.json().samples[0].snippet, /Welcome to the observatory/);
    const firstGameNote = importedGame.json().imported[0].note;
    const firstGameFingerprint = firstGameNote.extractionFingerprint;
    const currentGamePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 100 },
    });
    const currentGameSample = currentGamePreview
      .json()
      .samples.find((sample: any) => sample.sourceId === "game-a:game-session-1");
    assert.equal(currentGameSample.status, "imported");
    assert.equal(currentGameSample.freshness, "current");
    const contextGamePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: {
        source: "chats",
        limit: 100,
        scope: {
          chatIds: ["game-a", "chat-a"],
          groupId: "observatory-branches",
        },
      },
    });
    const contextGameSample = contextGamePreview
      .json()
      .samples.find((sample: any) => sample.sourceId === "game-a:game-session-1");
    assert.equal(contextGameSample.status, "imported");
    assert.equal(contextGameSample.freshness, "context_updated");
    const changedGameCalls = modelCalls;
    chats.find((chat) => chat.id === "game-a").metadata.gamePreviousSessionSummaries[0].summary =
      "The party discovered the changed Moon Vault beneath the observatory.";
    const changedGamePreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 100 },
    });
    const changedGameSample = changedGamePreview
      .json()
      .samples.find((sample: any) => sample.sourceId === "game-a:game-session-1");
    assert.equal(changedGameSample.status, "imported");
    assert.equal(changedGameSample.freshness, "source_updated");
    const changedGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["game-a:game-session-1"] },
    });
    assert.equal(changedGame.statusCode, 200, changedGame.body);
    assert.match(changedGame.json().imported[0].note.sections.source.text, /changed Moon Vault/);
    assert.notDeepEqual(changedGame.json().imported[0].note.extractionFingerprint, firstGameFingerprint);
    assert.equal(modelCalls, changedGameCalls);
    const enabledRefine = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { version: 1, useExtractionAgentOnGameMode: true },
    });
    assert.equal(enabledRefine.statusCode, 200, enabledRefine.body);
    assert.equal(enabledRefine.json().useExtractionAgentOnGameMode, true);
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
    const savedConnection = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { connectionId: "saved-extraction-connection" },
    });
    assert.equal(savedConnection.statusCode, 200, savedConnection.body);
    assert.equal(savedConnection.json().connectionId, "saved-extraction-connection");
    assert.equal(extractionPatch.json().useExtractionAgentOnGameMode, true);
    assert.deepEqual(extractionPatch.json().promptTemplates, extractionTemplates.json().promptTemplates);
    const savedConnectionRun = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a" },
    });
    assert.equal(savedConnectionRun.statusCode, 200, savedConnectionRun.body);
    assert.equal(modelRequests.at(-1)?.connectionId, "saved-extraction-connection");
    const resetSavedConnection = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { connectionId: null },
    });
    assert.equal(resetSavedConnection.statusCode, 200, resetSavedConnection.body);
    assert.equal(resetSavedConnection.json().connectionId, null);
    assert.equal(
      ltmExtractionSettingsSchema.parse(extractionPatch.json()).temperature,
      extractionPatch.json().temperature,
    );
    assert.equal(
      ltmExtractionSettingsPatchSchema.parse({
        activePromptTemplateIdsByMode: { game: "stored_elsewhere" },
      }).activePromptTemplateIdsByMode?.game,
      "stored_elsewhere",
    );
    const disabledExtraction = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { reasoningEffort: "none", verbosity: "none" },
    });
    assert.equal(disabledExtraction.statusCode, 200, disabledExtraction.body);
    assert.equal(disabledExtraction.json().reasoningEffort, "none");
    assert.equal(disabledExtraction.json().verbosity, "none");
    const disabledExtractionRun = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes/source_route_extract/extract",
      headers,
      payload: { chatId: "chat-a" },
    });
    assert.equal(disabledExtractionRun.statusCode, 200, disabledExtractionRun.body);
    assert.equal("reasoningEffort" in completionOptions.at(-1), false);
    assert.equal("verbosity" in completionOptions.at(-1), false);
    const restoredExtraction = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { reasoningEffort: "low", verbosity: "low" },
    });
    assert.equal(restoredExtraction.statusCode, 200, restoredExtraction.body);
    for (const schema of [ltmExtractionSettingsSchema, ltmExtractionSettingsPatchSchema]) {
      assert.throws(() => schema.parse({ unknownExtractionField: true }));
      assert.throws(() => schema.parse({ maxOutputTokens: 511 }));
    }
    const invalidExtractionTemplate = await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { activePromptTemplateIdsByMode: { game: "missing_template" } },
    });
    assert.equal(invalidExtractionTemplate.statusCode, 400, invalidExtractionTemplate.body);
    chats.find((chat) => chat.id === "game-a").metadata.gameJournal.quests[0].description =
      "Break the Seal remains open until the party finds the cobalt key and opens the observatory seal.";
    await storageService.storage.deleteNotesPermanently(["world_location_moon_vault", "thread_quest_seal"]);
    const refineCalls = modelCalls;
    const refineResolutions = modelRequests.length;
    const refinedGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["game-a:game-session-1"] },
    });
    assert.equal(refinedGame.statusCode, 200, refinedGame.body);
    assert.equal(refinedGame.json().imported[0]?.extractionStatus, "succeeded", refinedGame.body);
    assert.equal(modelRequests.length, refineResolutions + 1);
    assert.equal(modelCalls, refineCalls + 1, JSON.stringify(refineWarnings));
    assert.equal(refinedGame.json().imported[0].draft.summary, "Extracted Moon Vault discovery.", refinedGame.body);
    failGameRefine = true;
    const fallbackGame = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/source-notes",
      headers,
      payload: { source: "chats", sourceIds: ["game-a:game-session-1"] },
    });
    assert.equal(fallbackGame.statusCode, 200, fallbackGame.body);
    assert.equal(fallbackGame.json().imported[0].extractionStatus, "failed");
    assert.equal(fallbackGame.json().imported[0].retryable, true);
    failGameRefine = false;
    await app.inject({
      method: "PUT",
      url: "/api/long-term-memory/extraction-settings",
      headers,
      payload: { version: 1, useExtractionAgentOnGameMode: false },
    });
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
    chats[0].metadata.summaryEntries.push({
      id: "summary-aborted-in-flight",
      content: "This source reaches the model before cancellation.",
      enabled: true,
    });
    abortInFlight = true;
    const chatCompleteEntered = new Promise<void>((resolve) => {
      notifyAbortChatComplete = resolve;
    });
    const inFlightController = new AbortController();
    const inFlightImport = importPackageInterop(
      {
        source: "chats",
        sourceIds: ["chat-a:summary-aborted-in-flight"],
        limit: 100,
        importConcurrency: 1,
      },
      storageService.root,
      inFlightController.signal,
    );
    await chatCompleteEntered;
    inFlightController.abort();
    const inFlightResult = await inFlightImport;
    abortInFlight = false;
    notifyAbortChatComplete = undefined;
    assert.equal(abortReachedChatComplete, true);
    assert.equal(inFlightResult.counts.cancelled, 1);
    const currentPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/import/preview",
      headers,
      payload: { source: "chats", limit: 10 },
    });
    assert.equal(
      currentPreview
        .json()
        .samples.some((sample: any) => sample.sourceId === "game-a:game-session-1" && sample.freshness === "current"),
      true,
    );
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
    assert.equal(source.statusCode, 400, source.body);
    await storageService.storage.createNote({
      id: "source_route_review",
      title: "Draft source",
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
        entryId: "route-review",
      },
      sections: {
        source: {
          text: "The eastern gate is sealed at dusk.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    await writeFile(join(storageService.root, "drafts", "malformed.json"), "{not-json", "utf8");
    const mutationId = "10000000-0000-4000-8000-000000000001";
    const eventMutationId = "10000000-0000-4000-8000-000000000002";
    const eventMutation = {
      id: eventMutationId,
      claimKind: "change",
      kind: "create_note",
      risk: "low",
      confidence: 0.9,
      summary: "Create gate event",
      evidence: ["source_note:source_route_review"],
      note: {
        id: "timeline_eastern_gate_sealed",
        title: "Eastern gate sealed",
        type: "timeline_event",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: ["typed_memory", "timeline_event"],
        keywords: ["gate", "dusk"],
        links: [{ target: "source_route_review", relation: "extracted_from" }],
        sections: {
          event: {
            text: "The eastern gate was sealed at dusk.",
            updatedAt: "2026-07-17T00:00:00.000Z",
          },
        },
      },
    };
    const mutation = {
      id: mutationId,
      claimKind: "change",
      kind: "create_note",
      risk: "low",
      confidence: 0.9,
      summary: "Create gate fact",
      evidence: ["source_note:source_route_review"],
      note: {
        id: "world_eastern_gate",
        title: "Eastern gate",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: ["gate", "dusk"],
        links: [{ target: "timeline_eastern_gate_sealed", relation: "evidenced_by" }],
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
        mutations: [eventMutation, mutation],
      },
    });
    await addRejectedSuggestions(
      {
        ...draft,
        extractionOutcome: {
          state: "partial_success",
          totalCandidates: 3,
          keptUnits: 2,
          droppedUnits: 1,
          droppedCandidates: [
            {
              index: 2,
              reason: "invalid_format",
              message: "Candidate was not valid memory data.",
              snippet: "A rejected gate detail.",
            },
          ],
          droppedCandidateDetailsTruncated: false,
        },
      } as any,
      storageService.root,
    );
    const rejected = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/rejected-suggestions?sourceNoteId=source_route_review&chatId=chat-a",
      headers,
    });
    assert.equal(rejected.statusCode, 200, rejected.body);
    assert.equal(rejected.json().total, 1);
    const rejectedId = rejected.json().suggestions[0].id;
    const deletedRejected = await app.inject({
      method: "DELETE",
      url: `/api/long-term-memory/rejected-suggestions/${rejectedId}`,
      headers,
    });
    assert.deepEqual(deletedRejected.json(), { deleted: true, id: rejectedId });
    const repeatedRejectedDelete = await app.inject({
      method: "DELETE",
      url: `/api/long-term-memory/rejected-suggestions/${rejectedId}`,
      headers,
    });
    assert.deepEqual(repeatedRejectedDelete.json(), { deleted: false, id: rejectedId });
    await addRejectedSuggestions(
      {
        ...draft,
        extractionOutcome: {
          state: "partial_success",
          totalCandidates: 3,
          keptUnits: 2,
          droppedUnits: 1,
          droppedCandidates: [
            {
              index: 2,
              reason: "invalid_format",
              message: "Candidate was not valid memory data.",
              snippet: "A rejected gate detail.",
            },
          ],
          droppedCandidateDetailsTruncated: false,
        },
      } as any,
      storageService.root,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/rejected-suggestions?chatId=chat-b",
          headers,
        })
      ).json().total,
      0,
    );
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/long-term-memory/rejected-suggestions/not-a-uuid",
          headers,
        })
      ).statusCode,
      400,
    );
    const review = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/drafts/review?sourceNoteId=source_route_review",
      headers,
    });
    assert.equal(review.statusCode, 200, review.body);
    assert.equal(review.json().counts.drafts, 1);
    assert.equal(review.json().sources[0]?.drafts[0]?.freshness, "fresh");
    assert.equal(
      review.json().sources[0]?.targets.some((target: any) => target.noteId === "world_eastern_gate"),
      true,
    );
    const preflight = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${draft.id}/preflight`,
      headers,
      payload: { mutationIds: [mutationId], bulk: false },
    });
    assert.equal(preflight.statusCode, 200, preflight.body);
    assert.deepEqual(preflight.json().blockedMutationIds, []);
    assert.deepEqual(preflight.json().readyMutationIds, [eventMutationId, mutationId]);
    assert.equal(preflight.json().rows.find((row: any) => row.mutationId === mutationId).status, "ready");
    const invalidPreflight = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${draft.id}/preflight`,
      headers,
      payload: { mutationIds: ["10000000-0000-4000-8000-000000000099"] },
    });
    assert.equal(invalidPreflight.statusCode, 409, invalidPreflight.body);
    assert.equal(invalidPreflight.json().code, "ltm_draft_mutation_missing");
    const blockedMutationId = "10000000-0000-4000-8000-000000000003";
    await storageService.storage.createNote({
      id: "source_route_blocked",
      title: "Blocked preflight source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      sections: {
        source: {
          text: "A separate source for blocked preflight.",
          updatedAt: "2026-07-17T00:00:00.000Z",
        },
      },
    });
    const blockedDraft = await storageService.drafts.createDraft({
      source: { sourceNoteId: "source_route_blocked", chatId: "chat-a" },
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      modes: ["roleplay"],
      response: {
        summary: "Missing target preflight",
        mutations: [
          {
            id: blockedMutationId,
            claimKind: "change",
            kind: "add_link",
            risk: "medium",
            confidence: 0.8,
            summary: "Link to missing memory",
            evidence: ["source_note:source_route_blocked"],
            noteId: "world_eastern_gate",
            link: { target: "world_missing_target", relation: "evidenced_by" },
          },
        ],
      },
    });
    const blockedPreflight = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${blockedDraft.id}/preflight`,
      headers,
      payload: { mutationIds: [blockedMutationId] },
    });
    assert.equal(blockedPreflight.statusCode, 200, blockedPreflight.body);
    assert.deepEqual(blockedPreflight.json().blockedMutationIds, [blockedMutationId]);
    assert.equal(blockedPreflight.json().rows[0].status, "blocked");
    assert.match(blockedPreflight.json().rows[0].blockers[0].message, /link target not found/u);
    const emptyDraft = await storageService.drafts.createDraft({
      source: { sourceNoteId: "source_route_blocked", chatId: "chat-a" },
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      modes: ["roleplay"],
      response: { summary: "Empty pending draft", mutations: [] },
    });
    const emptyDraftAccept = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${emptyDraft.id}/accept`,
      headers,
      payload: {},
    });
    assert.equal(emptyDraftAccept.statusCode, 409, emptyDraftAccept.body);
    assert.equal(emptyDraftAccept.json().code, "ltm_draft_no_pending_mutations");
    const conflictMutationId = "10000000-0000-4000-8000-000000000004";
    await storageService.storage.createNote({
      id: "world_existing_conflict",
      title: "Existing conflicted memory",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: [],
      keywords: ["gate"],
      links: [],
      conflicts: [
        {
          field: "facts",
          existing: "The gate is open.",
          proposed: "The gate is sealed.",
          resolution: "pending",
          policy: "manual_review",
        },
      ],
      sections: { facts: { text: "The gate is open.", updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    const conflictDraft = await storageService.drafts.createDraft({
      source: { sourceNoteId: "source_route_blocked", chatId: "chat-a" },
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      modes: ["roleplay"],
      response: {
        summary: "Pending conflict preflight",
        mutations: [
          {
            id: conflictMutationId,
            claimKind: "change",
            kind: "create_note",
            risk: "medium",
            confidence: 0.8,
            summary: "Create conflicted memory",
            evidence: ["source_note:source_route_blocked"],
            note: {
              id: "world_existing_conflict",
              title: "Eastern gate update",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: { chatId: "chat-a", chatIds: ["chat-a"] },
              tags: [],
              keywords: ["gate"],
              links: [],
              conflicts: [
                {
                  field: "facts",
                  existing: "The gate is open.",
                  proposed: "The gate is sealed.",
                  resolution: "pending",
                  policy: "manual_review",
                },
              ],
              sections: {
                facts: {
                  text: "The eastern gate is sealed.",
                  updatedAt: "2026-07-17T00:00:00.000Z",
                },
              },
            },
          },
        ],
      },
    });
    const conflictPreflight = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${conflictDraft.id}/preflight`,
      headers,
      payload: { mutationIds: [conflictMutationId] },
    });
    assert.equal(conflictPreflight.statusCode, 200, conflictPreflight.body);
    assert.equal(conflictPreflight.json().rows[0].status, "blocked");
    assert.equal(conflictPreflight.json().rows[0].blockers[0].code, "unresolved_conflict");
    const missingCreateConflictMutationId = "10000000-0000-4000-8000-000000000007";
    const missingCreateConflictDraft = await storageService.drafts.createDraft({
      source: { sourceNoteId: "source_route_blocked", chatId: "chat-a" },
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      modes: ["roleplay"],
      response: {
        summary: "Pending conflict on a new memory",
        mutations: [
          {
            id: missingCreateConflictMutationId,
            claimKind: "change",
            kind: "create_note",
            risk: "medium",
            confidence: 0.8,
            summary: "Create a new conflicted memory",
            evidence: ["source_note:source_route_blocked"],
            note: {
              id: "world_missing_create_conflict",
              title: "New conflicted memory",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: { chatId: "chat-a", chatIds: ["chat-a"] },
              tags: [],
              keywords: [],
              links: [],
              conflicts: [
                {
                  field: "facts",
                  existing: "An earlier claim.",
                  proposed: "A new claim.",
                  resolution: "pending",
                  policy: "manual_review",
                },
              ],
              sections: { facts: { text: "A new claim.", updatedAt: "2026-07-17T00:00:00.000Z" } },
            },
          },
        ],
      },
    });
    const missingCreateConflictPreflight = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${missingCreateConflictDraft.id}/preflight`,
      headers,
      payload: { mutationIds: [missingCreateConflictMutationId] },
    });
    assert.equal(missingCreateConflictPreflight.statusCode, 200, missingCreateConflictPreflight.body);
    assert.equal(missingCreateConflictPreflight.json().rows[0].targetId, "world_missing_create_conflict");
    assert.equal(missingCreateConflictPreflight.json().rows[0].blockers[0].code, "unresolved_conflict");
    const capSourceId = "source_route_cap";
    await storageService.storage.createNote({
      id: capSourceId,
      title: "Section cap source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      sections: { source: { text: "Section cap evidence.", updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    await storageService.storage.createNote({
      id: "world_section_cap",
      title: "Section cap target",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: [],
      keywords: ["cap"],
      links: [],
      sections: { facts: { text: "x".repeat(20_000), updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    const capMutationId = "10000000-0000-4000-8000-000000000005";
    const capDraft = await storageService.drafts.createDraft({
      source: { sourceNoteId: capSourceId, chatId: "chat-a" },
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      modes: ["roleplay"],
      response: {
        summary: "Section cap preflight",
        mutations: [
          {
            id: capMutationId,
            claimKind: "static",
            kind: "append_section",
            risk: "low",
            confidence: 0.8,
            summary: "Append beyond section cap",
            evidence: [`source_note:${capSourceId}`],
            noteId: "world_section_cap",
            sectionKey: "facts",
            text: "This addition exceeds the section limit.",
          },
        ],
      },
    });
    const capPreflight = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${capDraft.id}/preflight`,
      headers,
      payload: { mutationIds: [capMutationId] },
    });
    assert.equal(capPreflight.statusCode, 200, capPreflight.body);
    assert.equal(capPreflight.json().rows[0].status, "blocked");
    assert.equal(capPreflight.json().rows[0].blockers[0].code, "projection_limit_exceeded");
    const groundingSourceId = "source_route_grounding";
    await storageService.storage.createNote({
      id: groundingSourceId,
      title: "Grounding source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: ["source_summary"],
      keywords: [],
      links: [],
      sections: { source: { text: "Grounding evidence.", updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    const groundingMutationId = "10000000-0000-4000-8000-000000000006";
    const groundingDraft = await storageService.drafts.createDraft({
      source: { sourceNoteId: groundingSourceId, chatId: "chat-a" },
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      modes: ["roleplay"],
      response: {
        summary: "Timeline grounding preflight",
        mutations: [
          {
            id: groundingMutationId,
            claimKind: "change",
            kind: "create_note",
            risk: "medium",
            confidence: 0.8,
            summary: "Create an ungrounded world change",
            evidence: [`source_note:${groundingSourceId}`],
            note: {
              id: "world_ungrounded_change",
              title: "Ungrounded change",
              type: "world",
              status: "active",
              modes: ["roleplay"],
              scope: { chatId: "chat-a", chatIds: ["chat-a"] },
              tags: [],
              keywords: ["grounding"],
              links: [],
              sections: { facts: { text: "A changed fact without an event.", updatedAt: "2026-07-17T00:00:00.000Z" } },
            },
          },
        ],
      },
    });
    const groundingPreflight = await app.inject({
      method: "POST",
      url: `/api/long-term-memory/drafts/${groundingDraft.id}/preflight`,
      headers,
      payload: { mutationIds: [groundingMutationId] },
    });
    assert.equal(groundingPreflight.statusCode, 200, groundingPreflight.body);
    assert.equal(groundingPreflight.json().rows[0].status, "blocked");
    assert.equal(groundingPreflight.json().rows[0].blockers[0].code, "missing_timeline_grounding");
    assert.match(groundingPreflight.json().rows[0].blockers[0].message, /timeline event grounded/u);
    const expandedPreflightResponse = ltmDraftPreflightResponseSchema.parse({
      draftId: draft.id,
      selectedMutationIds: [mutationId],
      readyMutationIds: Array.from({ length: 1_001 }, () => mutationId),
      blockedMutationIds: [],
      autoIncludedMutationIds: [],
      rows: [],
    });
    assert.equal(expandedPreflightResponse.readyMutationIds.length, 1_001);
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
    assert.deepEqual(new Set(accepted.json().appliedMutationIds), new Set([eventMutationId, mutationId]));
    assert.equal(accepted.json().draft.status, "accepted");
    assert.equal(
      (await storageService.storage.getNote("world_eastern_gate"))?.sections.facts.text,
      "The eastern gate is sealed at dusk.",
    );
    assert.deepEqual(
      (await storageService.storage.getNote("world_eastern_gate"))?.links,
      [{ target: "timeline_eastern_gate_sealed", relation: "evidenced_by" }],
      "accepted memories preserve their evidenced_by timeline link",
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
    assert.equal(backup.json().rejectedSuggestions.length, 1);
    const backupPreview = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/backup/preview",
      headers,
      payload: backup.json(),
    });
    assert.equal(backupPreview.statusCode, 200, backupPreview.body);
    assert.equal(backupPreview.json().incoming.notes > 0, true);
    assert.equal(backupPreview.json().incoming.rejectedSuggestions, 1);
    assert.equal(backupPreview.json().current.rejectedSuggestions, 1);
    const replacement = backup.json();
    replacement.notes = replacement.notes.filter((note: any) => note.id === "world_route_fixture");
    const imported = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/backup/import",
      headers,
      payload: replacement,
    });
    assert.equal(imported.statusCode, 200, imported.body);
    assert.equal(
      (await storageService.storage.listNotes()).some((note: any) => note.id === "world_route_fixture"),
      true,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/rejected-suggestions",
          headers,
        })
      ).json().total,
      1,
    );
    const resetSettings = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/settings/reset",
      headers,
    });
    assert.equal(resetSettings.statusCode, 200, resetSettings.body);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/rejected-suggestions",
          headers,
        })
      ).json().total,
      1,
    );
    assert.equal((await storageService.storage.getNote("world_route_fixture"))?.id, "world_route_fixture");
    const deletionFixture = await app.inject({
      method: "POST",
      url: "/api/long-term-memory/notes",
      headers,
      payload: {
        id: "world_detail_route_fixture",
        title: "Detail route fixture",
        type: "world",
        status: "active",
        modes: ["roleplay"],
        scope: { chatId: "chat-a", chatIds: ["chat-a"] },
        tags: [],
        keywords: [],
        links: [],
        sections: {
          facts: { text: "A removable fact.", updatedAt: "2026-07-17T00:00:00.000Z" },
          history: { text: "A retained history.", updatedAt: "2026-07-17T00:00:00.000Z" },
        },
      },
    });
    assert.equal(deletionFixture.statusCode, 201, deletionFixture.body);
    const deletedDetail = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/world_detail_route_fixture",
      headers,
      payload: {
        sections: { history: deletionFixture.json().note.sections.history },
        removedSectionKeys: ["facts"],
      },
    });
    assert.equal(deletedDetail.statusCode, 200, deletedDetail.body);
    assert.deepEqual(Object.keys(deletedDetail.json().note.sections), ["history"]);
    const lastDetail = await app.inject({
      method: "PATCH",
      url: "/api/long-term-memory/notes/world_detail_route_fixture",
      headers,
      payload: { removedSectionKeys: ["history"] },
    });
    assert.equal(lastDetail.statusCode, 400, lastDetail.body);
    const unregisteredSectionRoute = await app.inject({
      method: "DELETE",
      url: "/api/long-term-memory/notes/world_detail_route_fixture/sections/history",
      headers,
    });
    assert.equal(unregisteredSectionRoute.statusCode, 404, unregisteredSectionRoute.body);
    const deletedAll = await app.inject({
      method: "DELETE",
      url: "/api/long-term-memory/data",
      headers,
    });
    assert.equal(deletedAll.statusCode, 200, deletedAll.body);
    assert.equal((await storageService.storage.listNotes()).length, 0);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/long-term-memory/rejected-suggestions",
          headers,
        })
      ).json().total,
      0,
    );
    await storageService.storage.createNote({
      id: "source_route_attribution",
      title: "Imported observatory source",
      type: "source",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: [],
      keywords: [],
      links: [],
      sections: { source: { text: "Imported source material.", updatedAt: "2026-07-17T00:00:00.000Z" } },
      provenance: { kind: "character", sourceId: "character-mara" },
    });
    await storageService.storage.createNote({
      id: "world_route_attribution",
      title: "Gate memory",
      type: "world",
      status: "active",
      modes: ["roleplay"],
      scope: { chatId: "chat-a", chatIds: ["chat-a"] },
      tags: [],
      keywords: [],
      links: [{ relation: "extracted_from", target: "source_route_attribution" }],
      sections: { facts: { text: "The gate is sealed.", updatedAt: "2026-07-17T00:00:00.000Z" } },
    });
    await writeFile(
      longTermMemoryInjectionReceiptPath("chat-attribution", join(dataDir, "long-term-memory")),
      JSON.stringify({
        version: 1,
        chatId: "chat-attribution",
        dispatchedAt: "2026-07-17T00:00:00.000Z",
        serializedTokenCount: 12,
        chunks: [
          {
            chunkId: "world_route_attribution::facts",
            noteId: "world_route_attribution",
            sectionKey: "facts",
            tokenCount: 12,
          },
        ],
      }),
    );
    const attributedInjection = await app.inject({
      method: "GET",
      url: "/api/long-term-memory/last-injection/chat-attribution",
      headers,
    });
    assert.equal(attributedInjection.statusCode, 200, attributedInjection.body);
    assert.deepEqual(attributedInjection.json().memories, [
      {
        noteId: "world_route_attribution",
        title: "Gate memory",
        tokenCount: 12,
        sectionKey: "facts",
        sourceNoteId: "source_route_attribution",
        sourceTitle: "Imported observatory source",
      },
    ]);
    assert.equal(attributedInjection.json().state, "injected");
    assert.equal(attributedInjection.json().dispatchedAt, "2026-07-17T00:00:00.000Z");
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
    if (previousRequireSecret === undefined) delete process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK;
    else process.env.MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK = previousRequireSecret;
  }
  process.stdout.write(
    "Long-Term Memory routes regression: permissions, malformed drafts, model/debug forwarding, chat draft visibility, client errors, extraction, cleanup ok\n",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
