import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(
  process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"),
);
const dataDir = mkdtempSync(join(tmpdir(), "marinara-maps-lifecycle-"));
const catalogUrl = "https://1.1.1.1/catalog/catalog.json";
const generationProviderBaseUrl = "http://127.0.0.1:9/v1";
const csrfHeaders = { "x-marinara-csrf": "1" };
const originalFetch = globalThis.fetch;

process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";
process.env.DATA_DIR = dataDir;
process.env.LOG_DISABLE_REQUEST_LOGGING = "true";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_AGENT_CATALOG_URL = catalogUrl;
process.env.MARINARA_ENV_FILE = join(dataDir, ".env");
process.env.MARINARA_LITE = "true";
process.env.NODE_ENV = "test";

type Manifest = {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  capabilityApi?: { major: number; minor: number };
  builtAgainst?: { engineVersion: string; engineCommit: string };
  contributions?: { agentDetail?: { agentIds?: string[] } };
  [key: string]: unknown;
};

type ArtifactFixture = {
  bytes: Buffer;
  manifest: Manifest;
  path: string;
  url: string;
};

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function artifactFixture(version: string): ArtifactFixture {
  const path = join(repoRoot, "artifacts", `hierarchical-maps-${version}.zip`);
  assert.ok(
    existsSync(path),
    `Missing exact Maps ${version} artifact at ${path}`,
  );
  const bytes = readFileSync(path);
  const manifest = JSON.parse(
    execFileSync("unzip", ["-p", path, "manifest.json"], { encoding: "utf8" }),
  ) as Manifest;
  assert.equal(manifest.id, "hierarchical-maps");
  assert.equal(manifest.version, version);
  return {
    bytes,
    manifest,
    path,
    url: `https://1.1.1.1/artifacts/hierarchical-maps-${version}.zip`,
  };
}

const fixtures = new Map(
  [
    artifactFixture("1.0.6"),
    artifactFixture("1.1.0"),
  ].map((fixture) => [fixture.manifest.version, fixture]),
);
let catalogVersion = "1.1.0";
let catalogOnline = true;
let generationProviderRequestCount = 0;
const generationProviderRequests: Array<{
  messages?: Array<{ role?: string; content?: unknown }>;
}> = [];

const candidateFixture = fixtures.get("1.1.0");
assert.ok(candidateFixture);
assert.equal(candidateFixture.manifest.schemaVersion, 2);
assert.deepEqual(candidateFixture.manifest.capabilityApi, {
  major: 1,
  minor: 3,
});
assert.deepEqual(candidateFixture.manifest.builtAgainst, {
  engineVersion: "3.2.2",
  engineCommit: "7d5c09975abfd28e7e5e6645ff3b0bdeef86e1d7",
});
assert.deepEqual(candidateFixture.manifest.contributions?.agentDetail?.agentIds, ["hierarchical-maps"]);

function seedInstalledProfile(version: string) {
  const fixture = fixtures.get(version);
  assert.ok(fixture, `Missing installed-profile fixture for Maps ${version}`);
  const packageRoot = join(
    dataDir,
    "capability-packages",
    "versions",
    fixture.manifest.id,
    fixture.manifest.version,
  );
  mkdirSync(packageRoot, { recursive: true });
  execFileSync("unzip", ["-q", fixture.path, "-d", packageRoot]);
  const registryPath = join(dataDir, "capability-packages", "installed.json");
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(
    registryPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        packages: [
          {
            id: fixture.manifest.id,
            version: fixture.manifest.version,
            manifest: fixture.manifest,
            installedAt: "2026-07-15T00:00:00.000Z",
            status: "active",
            error: null,
            readiness: "ready",
            readinessError: null,
            legacy: false,
          },
        ],
      },
      null,
      2,
    ),
  );
}

function catalogFixture(version: string) {
  const fixture = fixtures.get(version);
  assert.ok(fixture, `Missing catalog fixture for Maps ${version}`);
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-15T00:00:00.000Z",
    packages: [
      {
        manifest: fixture.manifest,
        category: "tracker",
        artifact: {
          url: fixture.url,
          sha256: sha256(fixture.bytes),
          bytes: fixture.bytes.byteLength,
        },
        documentationUrl:
          "https://github.com/Pasta-Devs/Marinara-Agents#hierarchical-maps",
      },
    ],
  };
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url === `${generationProviderBaseUrl}/chat/completions`) {
    generationProviderRequestCount += 1;
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as { messages?: Array<{ role?: string; content?: unknown }> })
        : input instanceof Request
          ? ((await input.clone().json()) as { messages?: Array<{ role?: string; content?: unknown }> })
          : {};
    generationProviderRequests.push(body);
    return new Response(
      JSON.stringify({
        id: `chatcmpl-maps-lifecycle-${generationProviderRequestCount}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1_000),
        model: "maps-lifecycle-e2e",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content:
                "GAME_HISTORY_PROVIDER_RESPONSE: The party surveys the wider Existing World.",
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 8, total_tokens: 16 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  if (!catalogOnline) throw new Error("Lifecycle fixture is offline");
  if (url === catalogUrl) {
    return new Response(JSON.stringify(catalogFixture(catalogVersion)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  const fixture = [...fixtures.values()].find(
    (candidate) => candidate.url === url,
  );
  if (fixture) {
    return new Response(fixture.bytes, {
      status: 200,
      headers: { "content-type": "application/zip" },
    });
  }
  throw new Error(`Unexpected lifecycle fetch: ${url}`);
}) as typeof fetch;

function capturedProviderPrompt(request: (typeof generationProviderRequests)[number] | undefined): string {
  return (request?.messages ?? [])
    .map((message) =>
      typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    )
    .join("\n\n");
}

async function importEngine<T>(relativePath: string): Promise<T> {
  const url = pathToFileURL(resolve(engineRoot, relativePath)).href;
  return import(url) as Promise<T>;
}

async function expectJson(
  app: {
    inject(
      options: Record<string, unknown>,
    ): Promise<{ statusCode: number; body: string }>;
  },
  options: Record<string, unknown>,
  statusCode = 200,
) {
  const response = await app.inject(options);
  assert.equal(response.statusCode, statusCode, response.body);
  return response.body ? (JSON.parse(response.body) as unknown) : null;
}

function metadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const definition = {
  schemaVersion: 1,
  ownerMode: "roleplay",
  enabled: true,
  revision: 0,
  startingLocationId: "lifecycle_world",
  locations: [
    {
      id: "lifecycle_world",
      parentId: null,
      name: "Lifecycle World",
      kind: "region",
      description: "A world used to prove package lifecycle preservation.",
      modelMemory: "The package lifecycle must not erase this location.",
      icon: "🌍",
      childPresentation: "list",
      links: [],
      status: "active",
      sortOrder: 0,
    },
    {
      id: "lifecycle_harbor",
      parentId: "lifecycle_world",
      name: "Lifecycle Harbor",
      kind: "settlement",
      description: "A destination retained across package changes.",
      modelMemory: "The harbor proves restored definitions retain stable IDs.",
      icon: "⚓",
      childPresentation: "list",
      links: [],
      lorebookEntryIds: ["missing-lifecycle-lore-entry"],
      status: "active",
      sortOrder: 0,
    },
  ],
};

async function main() {
  let app: Awaited<
    ReturnType<
      (typeof import("../../Marinara-Engine/packages/server/src/app.js"))["buildApp"]
    >
  > | null = null;

  try {
    const { capabilityPackageManager } = await importEngine<{
      capabilityPackageManager: {
        install(id: string): Promise<{
          version: string;
          status: string;
          previousVersion?: string;
        }>;
        installed(): Promise<
          Array<{
            id: string;
            version: string;
            status: string;
            readiness: string;
          }>
        >;
      };
    }>(
      "packages/server/src/services/capability-packages/package-manager.service.ts",
    );
    const { buildApp } = await importEngine<{
      buildApp(): Promise<NonNullable<typeof app>>;
    }>("packages/server/src/app.ts");
    const { materializeAssistantSpatialState, resolveEffectiveSpatialState } =
      await importEngine<{
        materializeAssistantSpatialState(
          db: unknown,
          input: {
            chatId: string;
            messageId: string;
            swipeIndex: number;
            regenerate: boolean;
            continuation: boolean;
          },
        ): Promise<{ currentLocationId: string } | null>;
        resolveEffectiveSpatialState(
          db: unknown,
          chatId: string,
          options?: { exactAnchor?: { messageId: string; swipeIndex: number } },
        ): Promise<{
          currentLocationId: string | null;
          snapshot: { currentLocationId: string } | null;
        }>;
      }>("packages/server/src/services/spatial-context/state-resolution.ts");
    const { createGameStateStorage } = await importEngine<{
      createGameStateStorage(db: unknown): {
        create(
          state: {
            chatId: string;
            messageId: string;
            swipeIndex: number;
            date: string | null;
            time: string | null;
            location: string | null;
            weather: string | null;
            temperature: string | null;
            worldCustomFields: unknown[];
            presentCharacters: unknown[];
            recentEvents: unknown[];
            playerStats: unknown;
            personaStats: unknown;
            fieldLocks: Record<string, boolean> | null;
            hiddenTrackerFields: Record<string, boolean> | null;
            committed: boolean;
          },
          manualOverrides?: Record<string, string> | null,
        ): Promise<string>;
      };
    }>("packages/server/src/services/storage/game-state.storage.ts");

    seedInstalledProfile("1.0.6");
    const installedProfile = await capabilityPackageManager.installed();
    assert.equal(installedProfile.length, 1);
    assert.equal(installedProfile[0]?.version, "1.0.6");
    assert.equal(installedProfile[0]?.status, "active");

    const installed110 =
      await capabilityPackageManager.install("hierarchical-maps");
    assert.equal(installed110.version, "1.1.0");
    assert.equal(installed110.previousVersion, "1.0.6");
    assert.ok(
      existsSync(
        join(
          dataDir,
          "capability-packages",
          "versions",
          "hierarchical-maps",
          "1.1.0",
        ),
      ),
    );
    assert.ok(
      existsSync(
        join(
          dataDir,
          "capability-packages",
          "versions",
          "hierarchical-maps",
          "1.0.6",
        ),
      ),
    );

    catalogOnline = false;
    app = await buildApp();
    const firstHealth = (await expectJson(app, {
      method: "GET",
      url: "/api/health",
    })) as {
      capabilityPackages: {
        status: string;
        packages: Array<{
          id: string;
          version: string;
          status: string;
          readiness: string;
          ready: boolean;
        }>;
      };
    };
    assert.equal(firstHealth.capabilityPackages.status, "ok");
    assert.deepEqual(
      firstHealth.capabilityPackages.packages
        .filter((entry) => entry.id === "hierarchical-maps")
        .map((entry) => ({
          version: entry.version,
          status: entry.status,
          readiness: entry.readiness,
          ready: entry.ready,
        })),
      [{ version: "1.1.0", status: "active", readiness: "ready", ready: true }],
    );

    const locationLorebook = (await expectJson(app, {
      method: "POST",
      url: "/api/lorebooks",
      headers: csrfHeaders,
      payload: {
        name: "Hierarchical Maps location-lore fixture",
        description:
          "Proves exact-location lore reaches every prompt preview path.",
        category: "world",
        enabled: true,
      },
    })) as { id: string };
    const locationLoreEntry = (await expectJson(app, {
      method: "POST",
      url: `/api/lorebooks/${locationLorebook.id}/entries`,
      headers: csrfHeaders,
      payload: {
        name: "Lifecycle Harbor location truth",
        content:
          "LOCATION_LORE_PARITY: Lifecycle Harbor smells of salt and cedar.",
      },
    })) as { id: string };
    const gameGenerationConnection = (await expectJson(app, {
      method: "POST",
      url: "/api/connections",
      headers: csrfHeaders,
      payload: {
        name: "Hierarchical Maps lifecycle Game provider",
        provider: "custom",
        baseUrl: generationProviderBaseUrl,
        model: "maps-lifecycle-e2e",
        apiKey: "maps-lifecycle-e2e",
        treatAsLocalEndpoint: true,
      },
    })) as { id: string };

    const existingGameMap = {
      id: "existing-campaign-map",
      type: "node",
      name: "Existing World",
      description:
        "A legacy world map that must remain intact during reconciliation.",
      nodes: [
        {
          id: "existing-harbor",
          emoji: "⚓",
          label: "Existing Harbor",
          x: 20,
          y: 30,
          discovered: true,
        },
        {
          id: "ambiguous-crossroads",
          emoji: "↔️",
          label: "Crossroads",
          x: 50,
          y: 50,
          discovered: true,
        },
        {
          id: "unknown-ruin",
          emoji: "🏚️",
          label: "Unknown Ruin",
          x: 80,
          y: 70,
          discovered: true,
        },
      ],
      edges: [],
      partyPosition: "existing-harbor",
    };
    const existingGame = (await expectJson(app, {
      method: "POST",
      url: "/api/chats",
      headers: csrfHeaders,
      payload: {
        name: "Existing Game reconciliation fixture",
        mode: "game",
        characterIds: [],
        connectionId: gameGenerationConnection.id,
      },
    })) as { id: string };
    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${existingGame.id}/metadata`,
      headers: csrfHeaders,
      payload: {
        enableAgents: true,
        activeAgentIds: ["hierarchical-maps", "world-state"],
        gameSessionStatus: "active",
        gameMaps: [existingGameMap],
        gameMap: existingGameMap,
        activeGameMapId: existingGameMap.id,
      },
    });
    const existingGameDefinition = {
      ...definition,
      ownerMode: "game",
      startingLocationId: "existing_harbor",
      locations: [
        {
          ...definition.locations[0],
          id: "existing_world",
          name: "Existing World",
        },
        {
          ...definition.locations[1],
          id: "existing_harbor",
          parentId: "existing_world",
          name: "Existing Harbor",
          lorebookEntryIds: [locationLoreEntry.id],
        },
        {
          ...definition.locations[1],
          id: "east_crossroads",
          parentId: "existing_world",
          name: "Crossroads",
        },
        {
          ...definition.locations[1],
          id: "west_crossroads",
          parentId: "existing_world",
          name: "Crossroads",
        },
      ],
    };
    const existingGameSpatial = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${existingGame.id}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: existingGameDefinition,
      },
    })) as { currentLocationId: string; definition: { revision: number } };
    assert.equal(existingGameSpatial.currentLocationId, "existing_harbor");
    assert.equal(existingGameSpatial.definition.revision, 1);

    const beforeReconciliation = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}`,
    })) as { metadata: unknown };
    const beforeMetadata = metadata(beforeReconciliation.metadata) as {
      gameMap: {
        spatialLocationId?: string;
        nodes: Array<{ spatialLocationId?: string }>;
      };
    };
    assert.equal(beforeMetadata.gameMap.spatialLocationId, undefined);
    assert.ok(
      beforeMetadata.gameMap.nodes.every((node) => !node.spatialLocationId),
    );

    type ReconciliationTarget =
      | { target: "map"; mapId: string; mapName: string; targetName: string }
      | {
          target: "node";
          mapId: string;
          nodeId: string;
          mapName: string;
          targetName: string;
        }
      | {
          target: "cell";
          mapId: string;
          x: number;
          y: number;
          mapName: string;
          targetName: string;
        };
    type ReconciliationPreview = {
      suggestions: Array<{
        target: ReconciliationTarget;
        sourceName: string;
        spatialLocationId: string;
      }>;
      conflicts: Array<{
        sourceName: string;
        candidateLocations: Array<{ id: string }>;
      }>;
      unmatched: Array<{ sourceName: string }>;
      bindingCount?: number;
    };
    const preview = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}/spatial-context/game-map-bindings/reconciliation`,
    })) as ReconciliationPreview;
    assert.deepEqual(
      preview.suggestions.map((suggestion) => [
        suggestion.sourceName,
        suggestion.spatialLocationId,
      ]),
      [
        ["Existing World", "existing_world"],
        ["Existing Harbor", "existing_harbor"],
      ],
    );
    assert.deepEqual(
      preview.conflicts.map((conflict) => conflict.sourceName),
      ["Crossroads"],
    );
    assert.deepEqual(
      preview.conflicts[0]?.candidateLocations.map((location) => location.id),
      ["east_crossroads", "west_crossroads"],
    );
    assert.deepEqual(
      preview.unmatched.map((target) => target.sourceName),
      ["Unknown Ruin"],
    );

    const reviewedBindings = preview.suggestions.map((suggestion) => {
      const target = suggestion.target;
      if (target.target === "node") {
        return {
          target: {
            target: "node" as const,
            mapId: target.mapId,
            nodeId: target.nodeId,
          },
          spatialLocationId: suggestion.spatialLocationId,
        };
      }
      if (target.target === "cell") {
        return {
          target: {
            target: "cell" as const,
            mapId: target.mapId,
            x: target.x,
            y: target.y,
          },
          spatialLocationId: suggestion.spatialLocationId,
        };
      }
      return {
        target: { target: "map" as const, mapId: target.mapId },
        spatialLocationId: suggestion.spatialLocationId,
      };
    });
    assert.equal(reviewedBindings.length, 2);
    await expectJson(
      app,
      {
        method: "POST",
        url: `/api/chats/${existingGame.id}/spatial-context/game-map-bindings/reconciliation`,
        headers: csrfHeaders,
        payload: {
          expectedDefinitionRevision: 1,
          bindings: [
            reviewedBindings[0]!,
            { ...reviewedBindings[1]!, spatialLocationId: "east_crossroads" },
          ],
        },
      },
      409,
    );
    const afterRejectedReconciliation = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}`,
    })) as { metadata: unknown };
    const rejectedMetadata = metadata(afterRejectedReconciliation.metadata) as {
      gameMap: {
        spatialLocationId?: string;
        nodes: Array<{ spatialLocationId?: string }>;
      };
    };
    assert.equal(rejectedMetadata.gameMap.spatialLocationId, undefined);
    assert.ok(
      rejectedMetadata.gameMap.nodes.every((node) => !node.spatialLocationId),
    );

    const applied = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/spatial-context/game-map-bindings/reconciliation`,
      headers: csrfHeaders,
      payload: {
        expectedDefinitionRevision: 1,
        bindings: reviewedBindings,
      },
    })) as ReconciliationPreview;
    assert.equal(applied.bindingCount, 2);
    const retried = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/spatial-context/game-map-bindings/reconciliation`,
      headers: csrfHeaders,
      payload: {
        expectedDefinitionRevision: 1,
        bindings: reviewedBindings,
      },
    })) as ReconciliationPreview;
    assert.equal(retried.bindingCount, 0);

    const reconciledGame = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}`,
    })) as { metadata: unknown };
    const reconciledMetadata = metadata(reconciledGame.metadata) as {
      gameMap: {
        spatialLocationId?: string;
        nodes: Array<{ id: string; spatialLocationId?: string }>;
      };
      gameMaps: Array<{
        spatialLocationId?: string;
        nodes: Array<{ id: string; spatialLocationId?: string }>;
      }>;
    };
    assert.equal(
      reconciledMetadata.gameMap.spatialLocationId,
      "existing_world",
    );
    assert.equal(
      reconciledMetadata.gameMaps[0]?.spatialLocationId,
      "existing_world",
    );
    assert.deepEqual(
      Object.fromEntries(
        reconciledMetadata.gameMap.nodes.map((node) => [
          node.id,
          node.spatialLocationId,
        ]),
      ),
      {
        "existing-harbor": "existing_harbor",
        "ambiguous-crossroads": undefined,
        "unknown-ruin": undefined,
      },
    );
    const gameStateStore = createGameStateStorage(app.db);
    await gameStateStore.create({
      chatId: existingGame.id,
      messageId: "",
      swipeIndex: 0,
      date: null,
      time: null,
      location: "Existing World > Existing Harbor",
      weather: "HARBOR_HISTORY_GAME_STATE",
      temperature: null,
      worldCustomFields: [],
      presentCharacters: [],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
      fieldLocks: null,
      hiddenTrackerFields: null,
      committed: true,
    });
    const gamePeek = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/peek-prompt`,
      headers: csrfHeaders,
      payload: {},
    })) as {
      source: string;
      exact: boolean;
      messages: Array<{ content: string }>;
    };
    assert.equal(gamePeek.source, "live_preview");
    assert.equal(gamePeek.exact, false);
    const gamePeekText = gamePeek.messages
      .map((message) => message.content)
      .join("\n");
    assert.match(
      gamePeekText,
      /LOCATION_LORE_PARITY: Lifecycle Harbor smells of salt and cedar\./u,
    );
    assert.match(gamePeekText, /Existing Harbor/u);

    const gameAssistantAtHarbor = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/messages`,
      headers: csrfHeaders,
      payload: {
        role: "assistant",
        content: "The existing harbor watch records the party's arrival.",
      },
    })) as { id: string; activeSwipeIndex: number };
    const normalGameAssistantSnapshot = await materializeAssistantSpatialState(
      app.db,
      {
        chatId: existingGame.id,
        messageId: gameAssistantAtHarbor.id,
        swipeIndex: 0,
        regenerate: false,
        continuation: false,
      },
    );
    assert.equal(
      normalGameAssistantSnapshot?.currentLocationId,
      "existing_harbor",
    );

    const gameWorldGenerationRequestIndex = generationProviderRequests.length;
    const gameGeneration = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: existingGame.id,
        connectionId: gameGenerationConnection.id,
        userMessage: "The party returns to the Existing World overview.",
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
        pendingSpatialTransition: {
          destinationId: "existing_world",
          expectedDefinitionRevision: existingGameSpatial.definition.revision,
          expectedCurrentLocationId: "existing_harbor",
          commandId: "existing-game-return-to-world",
        },
      },
    });
    assert.equal(gameGeneration.statusCode, 200, gameGeneration.body);
    assert.match(gameGeneration.body, /spatial_transition_committed/u);
    assert.match(gameGeneration.body, /message_saved/u);
    assert.ok(generationProviderRequestCount >= 1);
    const gameWorldGenerationPrompt = capturedProviderPrompt(
      generationProviderRequests[gameWorldGenerationRequestIndex],
    );
    assert.match(gameWorldGenerationPrompt, /Current location ID: existing_world/u);
    assert.match(gameWorldGenerationPrompt, /HARBOR_HISTORY_GAME_STATE/u);
    const gameMessages = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}/messages`,
    })) as Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
    const gameWorldTurn = gameMessages.find(
      (message) =>
        message.role === "user" &&
        message.content ===
          "The party returns to the Existing World overview.",
    );
    const gameAssistantAtWorld = gameMessages.find(
      (message) =>
        message.role === "assistant" &&
        message.content.includes("GAME_HISTORY_PROVIDER_RESPONSE"),
    );
    assert.ok(gameWorldTurn);
    assert.ok(gameAssistantAtWorld);
    assert.ok(
      gameAssistantAtWorld.createdAt > gameWorldTurn.createdAt,
      "Live Game assistant messages must sort after the owner turn they answer",
    );
    await gameStateStore.create({
      chatId: existingGame.id,
      messageId: gameAssistantAtWorld.id,
      swipeIndex: 0,
      date: null,
      time: null,
      location: "Existing World",
      weather: "WORLD_CURRENT_GAME_STATE",
      temperature: null,
      worldCustomFields: [],
      presentCharacters: [],
      recentEvents: [],
      playerStats: null,
      personaStats: null,
      fieldLocks: null,
      hiddenTrackerFields: null,
      committed: true,
    });

    const gameRetryRequestIndex = generationProviderRequests.length;
    const gameRetry = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: existingGame.id,
        connectionId: gameGenerationConnection.id,
        regenerateMessageId: gameAssistantAtHarbor.id,
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
      },
    });
    assert.equal(gameRetry.statusCode, 200, gameRetry.body);
    assert.match(gameRetry.body, /message_saved/u);
    const gameRetryPrompt = capturedProviderPrompt(
      generationProviderRequests[gameRetryRequestIndex],
    );
    assert.match(gameRetryPrompt, /Current location ID: existing_harbor/u);
    assert.doesNotMatch(gameRetryPrompt, /Current location ID: existing_world/u);
    assert.match(gameRetryPrompt, /HARBOR_HISTORY_GAME_STATE/u);
    assert.doesNotMatch(gameRetryPrompt, /WORLD_CURRENT_GAME_STATE/u);
    assert.equal(
      gameRetryPrompt.match(/LOCATION_LORE_PARITY: Lifecycle Harbor smells of salt and cedar\./gu)?.length,
      1,
    );
    const gameMessagesAfterRetry = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}/messages`,
    })) as Array<{ id: string; activeSwipeIndex: number }>;
    const retriedGameMessage = gameMessagesAfterRetry.find(
      (message) => message.id === gameAssistantAtHarbor.id,
    );
    assert.equal(retriedGameMessage?.activeSwipeIndex, 1);
    const gameRetryCached = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/peek-prompt`,
      headers: csrfHeaders,
      payload: { messageId: gameAssistantAtHarbor.id },
    })) as {
      source: string;
      exact: boolean;
      messages: Array<{ content: string }>;
    };
    assert.equal(gameRetryCached.source, "cached");
    assert.equal(gameRetryCached.exact, true);
    assert.equal(
      gameRetryCached.messages.map((message) => message.content).join("\n\n"),
      gameRetryPrompt,
    );

    const gameContinuationRequestIndex = generationProviderRequests.length;
    const gameContinuation = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: existingGame.id,
        connectionId: gameGenerationConnection.id,
        continueMessageId: gameAssistantAtWorld.id,
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
      },
    });
    assert.equal(gameContinuation.statusCode, 200, gameContinuation.body);
    assert.match(gameContinuation.body, /message_saved/u);
    const gameContinuationPrompt = capturedProviderPrompt(
      generationProviderRequests[gameContinuationRequestIndex],
    );
    assert.match(gameContinuationPrompt, /Current location ID: existing_world/u);
    assert.doesNotMatch(gameContinuationPrompt, /Current location ID: existing_harbor/u);
    assert.match(gameContinuationPrompt, /WORLD_CURRENT_GAME_STATE/u);
    assert.doesNotMatch(gameContinuationPrompt, /HARBOR_HISTORY_GAME_STATE/u);
    assert.doesNotMatch(
      gameContinuationPrompt,
      /LOCATION_LORE_PARITY: Lifecycle Harbor smells of salt and cedar\./u,
    );
    const gameContinuationCached = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/peek-prompt`,
      headers: csrfHeaders,
      payload: { messageId: gameAssistantAtWorld.id },
    })) as {
      source: string;
      exact: boolean;
      messages: Array<{ content: string }>;
    };
    assert.equal(gameContinuationCached.source, "cached");
    assert.equal(gameContinuationCached.exact, true);
    assert.equal(
      gameContinuationCached.messages.map((message) => message.content).join("\n\n"),
      gameContinuationPrompt,
    );

    const exactRegeneratedGameState = await resolveEffectiveSpatialState(
      app.db,
      existingGame.id,
      {
        exactAnchor: { messageId: gameAssistantAtHarbor.id, swipeIndex: 1 },
      },
    );
    assert.equal(
      exactRegeneratedGameState.currentLocationId,
      "existing_harbor",
    );

    await expectJson(app, {
      method: "DELETE",
      url: `/api/chats/${existingGame.id}/messages/${gameAssistantAtHarbor.id}/swipes/0`,
      headers: csrfHeaders,
    });
    const shiftedGameSwipeState = await resolveEffectiveSpatialState(
      app.db,
      existingGame.id,
      {
        exactAnchor: { messageId: gameAssistantAtHarbor.id, swipeIndex: 0 },
      },
    );
    assert.equal(shiftedGameSwipeState.currentLocationId, "existing_harbor");
    const removedGameSwipeState = await resolveEffectiveSpatialState(
      app.db,
      existingGame.id,
      {
        exactAnchor: { messageId: gameAssistantAtHarbor.id, swipeIndex: 1 },
      },
    );
    assert.equal(removedGameSwipeState.snapshot, null);

    const gameBranch = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/branch`,
      headers: csrfHeaders,
      payload: { upToMessageId: gameAssistantAtWorld.id },
    })) as { id: string };
    const gameBranchSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${gameBranch.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(gameBranchSpatial.currentLocationId, "existing_world");

    const exportedGameBranch = await app.inject({
      method: "GET",
      url: `/api/chats/${gameBranch.id}/export?format=jsonl`,
    });
    assert.equal(
      exportedGameBranch.statusCode,
      200,
      exportedGameBranch.body,
    );
    const gameExportHeader = JSON.parse(
      exportedGameBranch.body.split("\n")[0]!,
    ) as {
      chat_metadata: {
        marinara_metadata: {
          spatialContextHistory: Array<{ currentLocationId: string }>;
        };
      };
    };
    assert.ok(
      gameExportHeader.chat_metadata.marinara_metadata.spatialContextHistory.some(
        (snapshot) => snapshot.currentLocationId === "existing_world",
      ),
    );

    const gameImportBoundary = `marinara-maps-game-history-${Date.now()}`;
    const gameImportBody = Buffer.concat([
      Buffer.from(
        `--${gameImportBoundary}\r\nContent-Disposition: form-data; name="file"; filename="maps-game-history.jsonl"\r\nContent-Type: application/jsonl\r\n\r\n`,
      ),
      Buffer.from(exportedGameBranch.body, "utf8"),
      Buffer.from(`\r\n--${gameImportBoundary}--\r\n`),
    ]);
    const importedGameResponse = await app.inject({
      method: "POST",
      url: "/api/import/st-chat",
      headers: {
        ...csrfHeaders,
        "content-type": `multipart/form-data; boundary=${gameImportBoundary}`,
        "content-length": String(gameImportBody.byteLength),
      },
      payload: gameImportBody,
    });
    assert.equal(
      importedGameResponse.statusCode,
      200,
      importedGameResponse.body,
    );
    const importedGame = JSON.parse(importedGameResponse.body) as {
      success: boolean;
      chatId: string;
    };
    assert.equal(importedGame.success, true);
    const importedGameSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${importedGame.chatId}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(importedGameSpatial.currentLocationId, "existing_world");

    await expectJson(
      app,
      {
        method: "POST",
        url: `/api/chats/${existingGame.id}/messages/bulk-delete`,
        headers: csrfHeaders,
        payload: {
          messageIds: [gameWorldTurn.id, gameAssistantAtWorld.id],
        },
      },
      204,
    );
    const rewoundGameSource = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(rewoundGameSource.currentLocationId, "existing_harbor");
    const unchangedGameBranch = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${gameBranch.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(unchangedGameBranch.currentLocationId, "existing_world");
    for (const disposableGameChatId of [gameBranch.id, importedGame.chatId]) {
      await expectJson(
        app,
        {
          method: "DELETE",
          url: `/api/chats/${disposableGameChatId}?force=true`,
          headers: csrfHeaders,
        },
        204,
      );
    }

    const checkpointGameState = (await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${existingGame.id}/game-state`,
      headers: csrfHeaders,
      payload: { manual: true, weather: "Harbor calm" },
    })) as { weather: string; location: string };
    assert.equal(checkpointGameState.weather, "Harbor calm");
    assert.match(checkpointGameState.location, /Existing Harbor/u);
    const checkpoint = (await expectJson(app, {
      method: "POST",
      url: "/api/game/checkpoint",
      headers: csrfHeaders,
      payload: {
        chatId: existingGame.id,
        label: "Existing Harbor checkpoint",
        triggerType: "manual",
      },
    })) as { id: string };
    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${existingGame.id}/game-state`,
      headers: csrfHeaders,
      payload: { manual: true, weather: "Harbor storm" },
    });
    await expectJson(app, {
      method: "POST",
      url: "/api/game/checkpoint/load",
      headers: csrfHeaders,
      payload: { chatId: existingGame.id, checkpointId: checkpoint.id },
    });
    const restoredCheckpointState = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}/game-state`,
    })) as { weather: string; location: string };
    assert.equal(restoredCheckpointState.weather, "Harbor calm");
    assert.match(restoredCheckpointState.location, /Existing Harbor/u);
    const restoredCheckpointSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(restoredCheckpointSpatial.currentLocationId, "existing_harbor");
    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/chats/${existingGame.id}?force=true`,
        headers: csrfHeaders,
      },
      204,
    );
    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/connections/${gameGenerationConnection.id}`,
        headers: csrfHeaders,
      },
      204,
    );

    const created = (await expectJson(app, {
      method: "POST",
      url: "/api/chats",
      headers: csrfHeaders,
      payload: {
        name: "Hierarchical Maps lifecycle fixture",
        mode: "roleplay",
        characterIds: [],
      },
    })) as { id: string };
    const chatId = created.id;

    const definitionWithLocationLore = {
      ...definition,
      locations: definition.locations.map((location) =>
        location.id === "lifecycle_harbor"
          ? {
              ...location,
              lorebookEntryIds: [
                ...(location.lorebookEntryIds ?? []),
                locationLoreEntry.id,
              ],
            }
          : location,
      ),
    };

    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${chatId}/metadata`,
      headers: csrfHeaders,
      payload: { enableAgents: true, activeAgentIds: ["hierarchical-maps"] },
    });
    const missingConnectionDraft = (await expectJson(
      app,
      {
        method: "POST",
        url: `/api/chats/${chatId}/spatial-context/generate`,
        headers: csrfHeaders,
        payload: {},
      },
      400,
    )) as { code: string };
    assert.equal(
      missingConnectionDraft.code,
      "spatial_ai_connection_invalid",
      "The exact artifact must resolve map-draft connections through the host language-model facade",
    );
    await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/messages`,
      headers: csrfHeaders,
      payload: {
        role: "assistant",
        content: "The lifecycle begins in a persistent world.",
      },
    });
    const saved = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${chatId}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: definitionWithLocationLore,
      },
    })) as {
      currentLocationId: string;
      hasCommittedSpatialHistory: boolean;
      definition: { revision: number };
      warnings: Array<{ code: string; locationId?: string }>;
    };
    assert.equal(saved.currentLocationId, "lifecycle_world");
    assert.equal(saved.hasCommittedSpatialHistory, true);
    assert.ok(
      saved.warnings.some(
        (warning) =>
          warning.code === "lorebook_entry_missing" &&
          warning.locationId === "lifecycle_harbor",
      ),
      "Definition reads must report missing lore links through the host persistence facade",
    );

    const ownerTurn = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/spatial-context/turn`,
      headers: csrfHeaders,
      payload: {
        content: "I follow the road into Lifecycle Harbor.",
        transition: {
          destinationId: "lifecycle_harbor",
          expectedDefinitionRevision: saved.definition.revision,
          expectedCurrentLocationId: "lifecycle_world",
          commandId: "lifecycle-owner-turn",
        },
      },
    })) as {
      message: { chatId: string; role: string; content: string };
      spatial: { currentLocationId: string };
    };
    assert.equal(ownerTurn.message.chatId, chatId);
    assert.equal(ownerTurn.message.role, "user");
    assert.equal(
      ownerTurn.message.content,
      "I follow the road into Lifecycle Harbor.",
    );
    assert.equal(ownerTurn.spatial.currentLocationId, "lifecycle_harbor");
    const roleplayPeek = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/peek-prompt`,
      headers: csrfHeaders,
      payload: {},
    })) as {
      source: string;
      exact: boolean;
      messages: Array<{ content: string }>;
    };
    assert.equal(roleplayPeek.source, "live_preview");
    assert.equal(roleplayPeek.exact, false);
    const roleplayPeekText = roleplayPeek.messages
      .map((message) => message.content)
      .join("\n");
    assert.match(
      roleplayPeekText,
      /LOCATION_LORE_PARITY: Lifecycle Harbor smells of salt and cedar\./u,
    );
    assert.match(roleplayPeekText, /Lifecycle Harbor/u);
    const duplicateOwnerTurn = (await expectJson(
      app,
      {
        method: "POST",
        url: `/api/chats/${chatId}/spatial-context/turn`,
        headers: csrfHeaders,
        payload: {
          content: "I follow the road into Lifecycle Harbor.",
          transition: {
            destinationId: "lifecycle_harbor",
            expectedDefinitionRevision: saved.definition.revision,
            expectedCurrentLocationId: "lifecycle_world",
            commandId: "lifecycle-owner-turn",
          },
        },
      },
      409,
    )) as { code: string };
    assert.equal(duplicateOwnerTurn.code, "spatial_transition_already_applied");

    const assistantAtHarbor = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/messages`,
      headers: csrfHeaders,
      payload: {
        role: "assistant",
        content: "The harbor bells answer across the water.",
      },
    })) as { id: string; activeSwipeIndex: number };
    const normalAssistantSnapshot = await materializeAssistantSpatialState(
      app.db,
      {
        chatId,
        messageId: assistantAtHarbor.id,
        swipeIndex: 0,
        regenerate: false,
        continuation: false,
      },
    );
    assert.equal(normalAssistantSnapshot?.currentLocationId, "lifecycle_harbor");

    const worldTurn = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/spatial-context/turn`,
      headers: csrfHeaders,
      payload: {
        content: "I return to Lifecycle World.",
        transition: {
          destinationId: "lifecycle_world",
          expectedDefinitionRevision: saved.definition.revision,
          expectedCurrentLocationId: "lifecycle_harbor",
          commandId: "lifecycle-return-to-world",
        },
      },
    })) as { message: { id: string; createdAt: string } };
    const assistantAtWorld = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/messages`,
      headers: csrfHeaders,
      payload: {
        role: "assistant",
        content: "The wider world opens beyond the harbor road.",
      },
    })) as { id: string; createdAt: string };
    assert.ok(
      assistantAtWorld.createdAt > worldTurn.message.createdAt,
      "Live assistant messages must sort after the owner turn they answer",
    );
    const continuationSnapshot = await materializeAssistantSpatialState(
      app.db,
      {
        chatId,
        messageId: assistantAtWorld.id,
        swipeIndex: 0,
        regenerate: false,
        continuation: true,
      },
    );
    assert.equal(continuationSnapshot?.currentLocationId, "lifecycle_world");

    const regeneratedSwipe = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/messages/${assistantAtHarbor.id}/swipes`,
      headers: csrfHeaders,
      payload: { content: "A second harbor answer rolls in with the tide." },
    })) as { index: number };
    assert.equal(regeneratedSwipe.index, 1);
    const regeneratedSnapshot = await materializeAssistantSpatialState(
      app.db,
      {
        chatId,
        messageId: assistantAtHarbor.id,
        swipeIndex: regeneratedSwipe.index,
        regenerate: true,
        continuation: false,
      },
    );
    assert.equal(regeneratedSnapshot?.currentLocationId, "lifecycle_harbor");
    const exactRegeneratedState = await resolveEffectiveSpatialState(app.db, chatId, {
      exactAnchor: { messageId: assistantAtHarbor.id, swipeIndex: 1 },
    });
    assert.equal(exactRegeneratedState.currentLocationId, "lifecycle_harbor");

    await expectJson(app, {
      method: "DELETE",
      url: `/api/chats/${chatId}/messages/${assistantAtHarbor.id}/swipes/0`,
      headers: csrfHeaders,
    });
    const shiftedSwipeState = await resolveEffectiveSpatialState(app.db, chatId, {
      exactAnchor: { messageId: assistantAtHarbor.id, swipeIndex: 0 },
    });
    assert.equal(shiftedSwipeState.currentLocationId, "lifecycle_harbor");
    const removedSwipeState = await resolveEffectiveSpatialState(app.db, chatId, {
      exactAnchor: { messageId: assistantAtHarbor.id, swipeIndex: 1 },
    });
    assert.equal(removedSwipeState.snapshot, null);

    const branch = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/branch`,
      headers: csrfHeaders,
      payload: { upToMessageId: assistantAtWorld.id },
    })) as { id: string };
    const branchSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${branch.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(branchSpatial.currentLocationId, "lifecycle_world");

    const exportedBranch = await app.inject({
      method: "GET",
      url: `/api/chats/${branch.id}/export?format=jsonl`,
    });
    assert.equal(exportedBranch.statusCode, 200, exportedBranch.body);
    const exportHeader = JSON.parse(exportedBranch.body.split("\n")[0]!) as {
      chat_metadata: {
        marinara_metadata: {
          spatialContextHistory: Array<{ currentLocationId: string }>;
        };
      };
    };
    assert.ok(
      exportHeader.chat_metadata.marinara_metadata.spatialContextHistory.some(
        (snapshot) => snapshot.currentLocationId === "lifecycle_world",
      ),
    );

    const importBoundary = `marinara-maps-history-${Date.now()}`;
    const importBody = Buffer.concat([
      Buffer.from(
        `--${importBoundary}\r\nContent-Disposition: form-data; name="file"; filename="maps-history.jsonl"\r\nContent-Type: application/jsonl\r\n\r\n`,
      ),
      Buffer.from(exportedBranch.body, "utf8"),
      Buffer.from(`\r\n--${importBoundary}--\r\n`),
    ]);
    const importedResponse = await app.inject({
      method: "POST",
      url: "/api/import/st-chat",
      headers: {
        ...csrfHeaders,
        "content-type": `multipart/form-data; boundary=${importBoundary}`,
        "content-length": String(importBody.byteLength),
      },
      payload: importBody,
    });
    assert.equal(importedResponse.statusCode, 200, importedResponse.body);
    const imported = JSON.parse(importedResponse.body) as { success: boolean; chatId: string };
    assert.equal(imported.success, true);
    const importedSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${imported.chatId}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(importedSpatial.currentLocationId, "lifecycle_world");

    await expectJson(
      app,
      {
        method: "POST",
        url: `/api/chats/${chatId}/messages/bulk-delete`,
        headers: csrfHeaders,
        payload: { messageIds: [worldTurn.message.id, assistantAtWorld.id] },
      },
      204,
    );
    const rewoundSource = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(rewoundSource.currentLocationId, "lifecycle_harbor");
    const unchangedBranch = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${branch.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(unchangedBranch.currentLocationId, "lifecycle_world");
    for (const disposableChatId of [branch.id, imported.chatId]) {
      await expectJson(
        app,
        {
          method: "DELETE",
          url: `/api/chats/${disposableChatId}?force=true`,
          headers: csrfHeaders,
        },
        204,
      );
    }

    await app.close();
    app = null;

    // Restart with every catalog/artifact fetch rejected. The installed package must
    // activate from disk and retain both its definition and spatial snapshot.
    app = await buildApp();
    const restarted = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/spatial-context`,
    })) as {
      currentLocationId: string;
      definition: { locations: Array<{ id: string }> };
    };
    assert.equal(restarted.currentLocationId, "lifecycle_harbor");
    assert.ok(
      restarted.definition.locations.some(
        (location) => location.id === "lifecycle_harbor",
      ),
    );

    const backupResponse = await app.inject({
      method: "POST",
      url: "/api/backup/download",
      headers: csrfHeaders,
    });
    assert.equal(backupResponse.statusCode, 200, backupResponse.body);
    const backupPath = join(dataDir, "hierarchical-maps-lifecycle-backup.zip");
    writeFileSync(backupPath, backupResponse.rawPayload);
    const backupEntries = execFileSync("unzip", ["-Z1", backupPath], {
      encoding: "utf8",
    });
    assert.match(backupEntries, /\/marinara-profile\.json$/mu);
    assert.match(backupEntries, /\/storage\//mu);

    await expectJson(app, {
      method: "DELETE",
      url: "/api/capability-packages/hierarchical-maps",
      headers: csrfHeaders,
    });
    const chatAfterRemoval = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}`,
    })) as {
      metadata: unknown;
    };
    const retainedMetadata = metadata(chatAfterRemoval.metadata);
    assert.ok(
      retainedMetadata.spatialContext,
      "Uninstall must retain the spatial definition in chat metadata",
    );
    assert.deepEqual(
      retainedMetadata.activeAgentIds,
      [],
      "Uninstall should detach the package without deleting map data",
    );

    await app.close();
    app = null;
    app = await buildApp();
    await expectJson(
      app,
      { method: "GET", url: `/api/chats/${chatId}/spatial-context` },
      404,
    );
    const unavailableChat = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}`,
    })) as {
      metadata: unknown;
    };
    assert.ok(metadata(unavailableChat.metadata).spatialContext);
    await app.close();
    app = null;

    catalogOnline = true;
    const reinstalled =
      await capabilityPackageManager.install("hierarchical-maps");
    assert.equal(reinstalled.version, "1.1.0");
    assert.equal(reinstalled.status, "restart-required");
    catalogOnline = false;
    app = await buildApp();
    const stateAfterReinstall = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(stateAfterReinstall.currentLocationId, "lifecycle_harbor");

    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/chats/${chatId}?force=true`,
        headers: csrfHeaders,
      },
      204,
    );
    await expectJson(app, { method: "GET", url: `/api/chats/${chatId}` }, 404);

    const boundary = `marinara-maps-lifecycle-${Date.now()}`;
    const multipartPrefix = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="maps-backup.zip"\r\nContent-Type: application/zip\r\n\r\n`,
    );
    const multipartSuffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const backupBytes = readFileSync(backupPath);
    const multipartBody = Buffer.concat([
      multipartPrefix,
      backupBytes,
      multipartSuffix,
    ]);
    const restored = (await expectJson(app, {
      method: "POST",
      url: "/api/backup/import-profile",
      headers: {
        ...csrfHeaders,
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(multipartBody.byteLength),
      },
      payload: multipartBody,
    })) as { success: boolean };
    assert.equal(restored.success, true);

    const chats = (await expectJson(app, {
      method: "GET",
      url: "/api/chats",
    })) as Array<{
      id: string;
      name: string;
    }>;
    const restoredChat = chats.find(
      (chat) => chat.name === "Hierarchical Maps lifecycle fixture",
    );
    assert.ok(restoredChat, "Full backup restore must recreate the Maps chat");
    const restoredState = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${restoredChat.id}/spatial-context`,
    })) as {
      currentLocationId: string;
      definition: { locations: Array<{ id: string }> };
    };
    assert.equal(restoredState.currentLocationId, "lifecycle_harbor");
    assert.ok(
      restoredState.definition.locations.some(
        (location) => location.id === "lifecycle_harbor",
      ),
    );

    const finalInstalled = await capabilityPackageManager.installed();
    assert.deepEqual(
      finalInstalled
        .filter((entry) => entry.id === "hierarchical-maps")
        .map((entry) => ({
          version: entry.version,
          status: entry.status,
          readiness: entry.readiness,
        })),
      [{ version: "1.1.0", status: "active", readiness: "ready" }],
    );

    console.info(
      "Hierarchical Maps exact-artifact lifecycle regression passed: update, owner-turn persistence, live prompt parity, Roleplay/Game swipe/regeneration/continuation history, branch/delete/import/export/checkpoint preservation, reviewed Game reconciliation, offline restart, remove, reinstall, backup, and restore.",
    );
  } finally {
    if (app) await app.close().catch(() => undefined);
    globalThis.fetch = originalFetch;
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
