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
const defaultTurnPromptTemplate = [
  "Current path: ${currentPath}",
  "Current location ID: ${currentLocationId}",
  "",
  "Visible location context:",
  "${visibleLocationContext}",
  "",
  "${privateModelContextBlock}Available destinations:",
  "${availableDestinations}",
  "",
  "${authorityInstruction}",
].join("\n");

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
    artifactFixture("1.1.1"),
    artifactFixture("1.1.3"),
    artifactFixture("1.1.4"),
    artifactFixture("1.1.5"),
    artifactFixture("1.1.6"),
    artifactFixture("1.1.7"),
  ].map((fixture) => [fixture.manifest.version, fixture]),
);
let catalogVersion = "1.1.7";
let catalogOnline = true;
let generationProviderRequestCount = 0;
const generationProviderRequests: Array<{
  messages?: Array<{ role?: string; content?: unknown }>;
}> = [];
let mapExpansionExistingTargetId: string | null = null;

const candidateFixture = fixtures.get("1.1.7");
assert.ok(candidateFixture);
assert.equal(candidateFixture.manifest.schemaVersion, 2);
assert.deepEqual(candidateFixture.manifest.capabilityApi, {
  major: 1,
  minor: 3,
});
assert.deepEqual(candidateFixture.manifest.builtAgainst, {
  engineVersion: "2.3.3",
  engineCommit: "858cfa431e07f6f558aa1e8826a2c9b024269ab7",
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
    const providerPrompt = capturedProviderPrompt(body);
    const responseContent = providerPrompt.includes("You design practical hierarchical world maps")
        ? JSON.stringify({
          worldName: "Route Test World",
          hierarchyName: "Harbor city",
          locationTypes: [
            { key: "world", label: "World", baseKind: "region" },
            { key: "city", label: "City Quarter", baseKind: "place" },
            { key: "type_city", label: "Typed City", baseKind: "settlement" },
          ],
          startingLocationKey: "route_world",
          locations: [
            {
              key: "route_world", parentKey: null, name: "Route Test World", typeKey: "world", kind: "region",
              description: "A compact world used to prove generated routes.",
              modelMemory: "The route graph must stay sparse and connected.",
              awarenessSummary: "Old Town, Market Square, and Harbor share practical roads.",
              icon: "🗺️", sourceKeys: [], origin: "added_by_ai", childPresentation: "map",
              placement: null, layerOrder: null, links: [],
            },
            {
              key: "old_town", parentKey: "route_world", name: "Old Town", typeKey: "type_city", kind: "place",
              description: "A walled neighborhood west of the market.",
              modelMemory: "The market road is the ordinary eastern exit.",
              awarenessSummary: "Market Street leads east.",
              icon: "🏘️", sourceKeys: [], origin: "added_by_ai", childPresentation: "list",
              placement: { x: 20, y: 50 }, layerOrder: null,
              links: [{ targetKey: "market_square", label: "Market Street", bidirectional: true, state: "available" }],
            },
            {
              key: "market_square", parentKey: "route_world", name: "Market Square", typeKey: "type_city", kind: "place",
              description: "The city market between Old Town and the harbor road.",
              modelMemory: "Merchants know every public route through the city.",
              awarenessSummary: "Old Town lies west and the harbor lies east.",
              icon: "🏪", sourceKeys: [], origin: "added_by_ai", childPresentation: "list",
              placement: { x: 50, y: 50 }, layerOrder: null, links: [],
            },
            {
              key: "harbor", parentKey: "route_world", name: "Harbor", typeKey: "type_city", kind: "place",
              description: "A working harbor east of the market.",
              modelMemory: "A canal bridge can support future expansion.",
              awarenessSummary: "The market road returns west.",
              icon: "⚓", sourceKeys: [], origin: "added_by_ai", childPresentation: "list",
              placement: { x: 80, y: 50 }, layerOrder: null, links: [],
            },
          ],
        })
      : providerPrompt.includes("You expand an existing hierarchical world map") && mapExpansionExistingTargetId
        ? JSON.stringify({
            locations: [
              {
                key: "canal_ward", parentKey: null, name: "Canal Ward", kind: "place",
                description: "A canal district reached from the existing harbor.",
                modelMemory: "The canal bridge is the ward's main approach.",
                awarenessSummary: "Canal Bridge returns to Harbor.",
                icon: "🌉", sourceKeys: [], origin: "added_by_ai", childPresentation: "list",
                placement: { x: 88, y: 72 }, layerOrder: null,
                links: [{ targetKey: mapExpansionExistingTargetId, label: "Canal Bridge", bidirectional: true, state: "available" }],
              },
              {
                key: "canal_house", parentKey: "canal_ward", name: "Canal House", kind: "building",
                description: "A ferryman's house beside the canal lock.",
                modelMemory: "The ferryman maintains the bridge winch.",
                awarenessSummary: "The front door opens onto Canal Ward.",
                icon: "🏠", sourceKeys: [], origin: "added_by_ai", childPresentation: "list",
                placement: null, layerOrder: null, links: [],
              },
            ],
          })
        : "GAME_HISTORY_PROVIDER_RESPONSE: The party surveys the wider Existing World.";
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
              content: responseContent,
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

type RouteGraphDefinition = {
  locations: Array<{
    id: string;
    parentId: string | null;
    name: string;
    links: Array<{ targetId: string; label?: string; bidirectional: boolean; state: string }>;
  }>;
};

function assertSiblingRouteGraphConnected(definition: RouteGraphDefinition, parentId: string, message: string) {
  const siblings = definition.locations.filter((location) => location.parentId === parentId);
  assert.ok(siblings.length >= 2, `${message}: expected sibling locations`);
  const siblingIds = new Set(siblings.map((location) => location.id));
  const visited = new Set([siblings[0]!.id]);
  const pending = [siblings[0]!.id];
  while (pending.length > 0) {
    const currentId = pending.shift()!;
    for (const location of siblings) {
      for (const link of location.links) {
        if (!siblingIds.has(link.targetId)) continue;
        const neighborId = location.id === currentId ? link.targetId : link.targetId === currentId ? location.id : null;
        if (!neighborId || visited.has(neighborId)) continue;
        visited.add(neighborId);
        pending.push(neighborId);
      }
    }
  }
  assert.equal(visited.size, siblings.length, message);
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
    const { capabilityPackageManager, findCompatibleCapabilityPackageUpdates } = await importEngine<{
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
      findCompatibleCapabilityPackageUpdates(
        installedPackages: unknown[],
        catalog: ReturnType<typeof catalogFixture>,
        engineVersion?: string,
      ): unknown[];
    }>(
      "packages/server/src/services/capability-packages/package-manager.service.ts",
    );
    const { buildApp } = await importEngine<{
      buildApp(): Promise<NonNullable<typeof app>>;
    }>("packages/server/src/app.ts");
    const {
      materializeAssistantSpatialState: materializeAssistantSpatialStateHost,
      resolveEffectiveSpatialState: resolveEffectiveSpatialStateHost,
    } = await importEngine<{
      materializeAssistantSpatialState(
        input: {
          chatId: string;
          messageId: string;
          swipeIndex: number;
          regenerate: boolean;
          continuation: boolean;
        },
        chatMetadata?: unknown,
      ): Promise<{ currentLocationId: string } | null>;
      resolveEffectiveSpatialState(
        chatId: string,
        options?: { exactAnchor?: { messageId: string; swipeIndex: number } },
        chatMetadata?: unknown,
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
    assert.equal(
      findCompatibleCapabilityPackageUpdates(installedProfile, catalogFixture("1.1.7"), "2.3.1").length,
      0,
    );
    assert.equal(
      findCompatibleCapabilityPackageUpdates(installedProfile, catalogFixture("1.1.7"), "2.3.2").length,
      0,
    );
    assert.equal(
      findCompatibleCapabilityPackageUpdates(installedProfile, catalogFixture("1.1.7"), "2.3.3").length,
      1,
    );
    assert.equal(
      findCompatibleCapabilityPackageUpdates(installedProfile, catalogFixture("1.1.7"), "3.0.0").length,
      0,
    );

    const installed117 =
      await capabilityPackageManager.install("hierarchical-maps");
    assert.equal(installed117.version, "1.1.7");
    assert.equal(installed117.previousVersion, "1.0.6");
    assert.ok(
      existsSync(
        join(
          dataDir,
          "capability-packages",
          "versions",
          "hierarchical-maps",
          "1.1.7",
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
    const getChatMetadata = async (chatId: string) => {
      assert.ok(app);
      const chat = (await expectJson(app, {
        method: "GET",
        url: `/api/chats/${chatId}`,
      })) as { metadata: unknown };
      return chat.metadata;
    };
    const materializeAssistantSpatialState = async (
      input: Parameters<typeof materializeAssistantSpatialStateHost>[0],
    ) =>
      materializeAssistantSpatialStateHost(
        input,
        await getChatMetadata(input.chatId),
      );
    const resolveEffectiveSpatialState = async (
      chatId: string,
      options: { exactAnchor?: { messageId: string; swipeIndex: number } } = {},
    ) =>
      resolveEffectiveSpatialStateHost(
        chatId,
        options,
        await getChatMetadata(chatId),
      );
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
      [{ version: "1.1.7", status: "active", readiness: "ready", ready: true }],
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

    const existingGameMapState = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${existingGame.id}/spatial-context`,
    })) as {
      generationPreferences: {
        version: 3;
        activeOptionId: string;
        options: Array<{
          id: string;
          name: string;
          description?: string;
          guidance: string;
          customVariables: Array<{ name: string; value: string }>;
          prompts: { draftSystem: string; draftUser: string; expansionSystem: string; expansionUser: string };
        }>;
      };
    };
    const existingGamePromptOption = existingGameMapState.generationPreferences.options.find(
      (option) => option.id === existingGameMapState.generationPreferences.activeOptionId,
    )!;
    assert.match(existingGamePromptOption.prompts.draftSystem, /AI game engine/u);
    const customizedGamePreferences = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${existingGame.id}/spatial-context/generation-preferences`,
      headers: csrfHeaders,
      payload: {
        ...existingGameMapState.generationPreferences,
        options: existingGameMapState.generationPreferences.options.map((option) =>
          option.id === existingGameMapState.generationPreferences.activeOptionId
            ? {
                ...option,
                name: "Tactical travel",
                guidance: "Keep Game travel choices tactically clear.",
                prompts: {
                  ...option.prompts,
                  expansionSystem: `${option.prompts.expansionSystem}\nGame expansion template customization proof.`,
                },
              }
            : option,
        ),
      },
    })) as typeof existingGameMapState.generationPreferences;
    assert.equal(customizedGamePreferences.options[0]?.name, "Tactical travel");
    const customizedGlobalTurnTemplates = {
      version: 1 as const,
      roleplay: `ROLEPLAY_CUSTOM_TURN_TEMPLATE\n${defaultTurnPromptTemplate}`,
      game: `GAME_CUSTOM_TURN_TEMPLATE\n${defaultTurnPromptTemplate}`,
    };
    const customizedGlobalGameLibrary = {
      version: 1 as const,
      options: customizedGamePreferences.options.map((option) => ({
        ...option,
        description:
          option.id === customizedGamePreferences.activeOptionId
            ? "Concurrent global generation library save proof."
            : option.description,
      })),
    };
    await Promise.all([
      expectJson(app, {
        method: "PUT",
        url: "/api/chats/spatial-context/global-generation-prompt-libraries/game",
        headers: csrfHeaders,
        payload: customizedGlobalGameLibrary,
      }),
      expectJson(app, {
        method: "PUT",
        url: "/api/chats/spatial-context/global-turn-prompt-templates",
        headers: csrfHeaders,
        payload: customizedGlobalTurnTemplates,
      }),
    ]);
    const agentsAfterConcurrentGlobalUpdates = (await expectJson(app, {
      method: "GET",
      url: "/api/agents",
    })) as Array<{ type: string; settings?: unknown }>;
    const updatedMapsAgentSettings = metadata(
      agentsAfterConcurrentGlobalUpdates.find((agent) => agent.type === "hierarchical-maps")?.settings,
    );
    assert.deepEqual(
      updatedMapsAgentSettings.spatialMapTurnPromptTemplates,
      customizedGlobalTurnTemplates,
      "Turn prompt templates must persist in the global Hierarchical Maps agent settings",
    );
    assert.deepEqual(
      metadata(updatedMapsAgentSettings.spatialMapGenerationPromptLibraries).game,
      customizedGlobalGameLibrary,
      "Concurrent global prompt saves must preserve both settings keys",
    );

    for (const malformedVariable of ["${ currentPath }", "${current-Path}"]) {
      const malformedTurnTemplateResponse = (await expectJson(
        app,
        {
          method: "PUT",
          url: "/api/chats/spatial-context/global-turn-prompt-templates",
          headers: csrfHeaders,
          payload: {
            ...customizedGlobalTurnTemplates,
            roleplay: `${customizedGlobalTurnTemplates.roleplay}\n${malformedVariable}`,
          },
        },
        400,
      )) as { error: string; code: string };
      assert.equal(malformedTurnTemplateResponse.code, "spatial_global_turn_prompt_templates_invalid");
      assert.match(malformedTurnTemplateResponse.error, /Invalid turn prompt variable/u);
    }

    const gamePromptPreviewRequestCount = generationProviderRequests.length;
    const gamePromptPreview = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${existingGame.id}/spatial-context/generation-prompt/preview`,
      headers: csrfHeaders,
      payload: {
        operation: "expand",
        targetLocationId: "existing_harbor",
        size: "small",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: gameGenerationConnection.id,
        debugMode: false,
      },
    })) as {
      ownerMode: string;
      operation: string;
      containsPrivateContext: boolean;
      system: string;
      user: string;
    };
    assert.equal(generationProviderRequests.length, gamePromptPreviewRequestCount);
    assert.equal(gamePromptPreview.ownerMode, "game");
    assert.equal(gamePromptPreview.operation, "expand");
    assert.equal(gamePromptPreview.containsPrivateContext, true);
    assert.match(gamePromptPreview.system, /AI game engine/u);
    assert.doesNotMatch(gamePromptPreview.system, /AI roleplay engine/u);
    assert.match(gamePromptPreview.system, /Game expansion template customization proof/u);
    assert.match(gamePromptPreview.user, /Keep Game travel choices tactically clear/u);
    assert.match(gamePromptPreview.user, /Existing Harbor/u);

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
    assert.match(gamePeekText, /GAME_CUSTOM_TURN_TEMPLATE/u);

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
      existingGame.id,
      {
        exactAnchor: { messageId: gameAssistantAtHarbor.id, swipeIndex: 0 },
      },
    );
    assert.equal(shiftedGameSwipeState.currentLocationId, "existing_harbor");
    const removedGameSwipeState = await resolveEffectiveSpatialState(
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

    const routeGraphChat = (await expectJson(app, {
      method: "POST",
      url: "/api/chats",
      headers: csrfHeaders,
      payload: { name: "AI route graph lifecycle fixture", mode: "roleplay", characterIds: [] },
    })) as { id: string };
    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${routeGraphChat.id}/metadata`,
      headers: csrfHeaders,
      payload: { enableAgents: true, activeAgentIds: ["hierarchical-maps"] },
    });
    await expectJson(app, {
      method: "POST",
      url: `/api/chats/${routeGraphChat.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "Old Town, Market Square, and Harbor define the test city." },
    });
    const routeMapDefaults = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${routeGraphChat.id}/spatial-context`,
    })) as {
      generationPreferences: {
        version: 3;
        activeOptionId: string;
        options: Array<{
          id: string;
          name: string;
          description?: string;
          guidance: string;
          customVariables: Array<{ name: string; value: string }>;
          prompts: { draftSystem: string; draftUser: string; expansionSystem: string; expansionUser: string };
        }>;
      };
    };
    const routeDefaultPromptOption = routeMapDefaults.generationPreferences.options.find(
      (option) => option.id === routeMapDefaults.generationPreferences.activeOptionId,
    )!;
    assert.match(routeDefaultPromptOption.prompts.draftSystem, /AI roleplay engine/u);
    const maritimePromptOption = {
      ...routeDefaultPromptOption,
      id: "maritime",
      name: "Maritime city",
      description: "Compact port cities with practical travel routes.",
      guidance: "Prefer concise maritime vocabulary and navigable public streets.",
      customVariables: [{ name: "harborMood", value: "Keep public waterfronts active and weather-beaten." }],
      prompts: {
        ...routeDefaultPromptOption.prompts,
        draftUser: `${routeDefaultPromptOption.prompts.draftUser}\n\n\${harborMood}`,
      },
    };
    const savedGenerationPreferences = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${routeGraphChat.id}/spatial-context/generation-preferences`,
      headers: csrfHeaders,
      payload: {
        ...routeMapDefaults.generationPreferences,
        activeOptionId: maritimePromptOption.id,
        options: [...routeMapDefaults.generationPreferences.options, maritimePromptOption],
      },
    })) as typeof routeMapDefaults.generationPreferences;
    assert.equal(savedGenerationPreferences.activeOptionId, "maritime");
    assert.equal(savedGenerationPreferences.options[1]?.name, "Maritime city");
    const unsavedGenerationPreferences = {
      ...savedGenerationPreferences,
      options: savedGenerationPreferences.options.map((option) =>
        option.id === savedGenerationPreferences.activeOptionId
          ? {
              ...option,
              prompts: {
                ...option.prompts,
                draftSystem: `${option.prompts.draftSystem}\nUNSAVED_SETTINGS_SYSTEM_PREVIEW\nKeep the route graph especially legible for this run.`,
                draftUser: `${option.prompts.draftUser}\nUNSAVED_SETTINGS_USER_PREVIEW\nOne-run override: favor short district names.`,
              },
            }
          : option,
      ),
    };

    const previewProviderRequestCount = generationProviderRequests.length;
    const routePromptPreview = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${routeGraphChat.id}/spatial-context/generation-prompt/preview`,
      headers: csrfHeaders,
      payload: {
        operation: "create",
        size: "small",
        instructions: "Create a compact city with practical streets.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: gameGenerationConnection.id,
        debugMode: false,
        hierarchyMode: "auto",
        generationPreferencesOverride: unsavedGenerationPreferences,
      },
    })) as {
      ownerMode: string;
      operation: string;
      containsPrivateContext: boolean;
      system: string;
      user: string;
    };
    assert.equal(generationProviderRequests.length, previewProviderRequestCount);
    assert.equal(routePromptPreview.ownerMode, "roleplay");
    assert.equal(routePromptPreview.operation, "create");
    assert.equal(routePromptPreview.containsPrivateContext, true);
    assert.match(routePromptPreview.system, /AI roleplay engine/u);
    assert.match(routePromptPreview.system, /UNSAVED_SETTINGS_SYSTEM_PREVIEW/u);
    assert.match(routePromptPreview.user, /Prefer concise maritime vocabulary and navigable public streets/u);
    assert.match(routePromptPreview.user, /Keep public waterfronts active and weather-beaten/u);
    assert.match(routePromptPreview.user, /Create a compact city with practical streets/u);
    assert.match(routePromptPreview.user, /UNSAVED_SETTINGS_USER_PREVIEW/u);
    const storedPreferencesAfterPreview = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${routeGraphChat.id}/spatial-context`,
    })) as typeof routeMapDefaults;
    const storedPromptOptionAfterPreview = storedPreferencesAfterPreview.generationPreferences.options.find(
      (option) => option.id === storedPreferencesAfterPreview.generationPreferences.activeOptionId,
    )!;
    assert.doesNotMatch(storedPromptOptionAfterPreview.prompts.draftSystem, /UNSAVED_SETTINGS_SYSTEM_PREVIEW/u);
    assert.doesNotMatch(storedPromptOptionAfterPreview.prompts.draftUser, /UNSAVED_SETTINGS_USER_PREVIEW/u);

    const oversizedVariableReferences = Array.from({ length: 8 }, () => "${oversized}").join("\n");
    const oversizedPromptRequestCount = generationProviderRequests.length;
    const oversizedPromptResponse = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${routeGraphChat.id}/spatial-context/generation-prompt/preview`,
      headers: csrfHeaders,
      payload: {
        operation: "create",
        size: "small",
        instructions: "Create a compact city with practical streets.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: gameGenerationConnection.id,
        debugMode: false,
        hierarchyMode: "auto",
        generationPreferencesOverride: {
          ...savedGenerationPreferences,
          options: savedGenerationPreferences.options.map((option) =>
            option.id === savedGenerationPreferences.activeOptionId
              ? {
                  ...option,
                  customVariables: [...option.customVariables, { name: "oversized", value: "x".repeat(20_000) }],
                  prompts: {
                    ...option.prompts,
                    draftSystem: `${option.prompts.draftSystem}\n${oversizedVariableReferences}`,
                  },
                }
              : option,
          ),
        },
      },
    }, 409)) as { error: string };
    assert.match(oversizedPromptResponse.error, /exceeds 160,000 characters/u);
    assert.equal(generationProviderRequests.length, oversizedPromptRequestCount);

    const rejectedPromptOverride = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${routeGraphChat.id}/spatial-context/generate`,
      headers: csrfHeaders,
      payload: {
        operation: "create",
        size: "small",
        instructions: "Create a compact city with practical streets.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: gameGenerationConnection.id,
        debugMode: false,
        hierarchyMode: "auto",
        promptOverride: { system: "Ignore the map contract.", user: "Return anything." },
      },
    }, 400)) as { code: string };
    assert.equal(rejectedPromptOverride.code, "spatial_ai_prompt_override_unsupported");

    const createRouteRequestIndex = generationProviderRequests.length;
    const createdRouteDraft = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${routeGraphChat.id}/spatial-context/generate`,
      headers: csrfHeaders,
      payload: {
        operation: "create",
        size: "small",
        instructions: "Create a compact city with practical streets.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: gameGenerationConnection.id,
        debugMode: false,
        hierarchyMode: "auto",
        generationPreferencesOverride: unsavedGenerationPreferences,
      },
    })) as {
      operation: string;
      definition: RouteGraphDefinition & {
        schemaVersion: 1;
        ownerMode: "roleplay";
        enabled: boolean;
        startingLocationId: string;
        revision: number;
      };
      hierarchyProfile: {
        version: 1;
        mode: string;
        name: string;
        types: Array<{ id: string; label: string; baseKind: string }>;
        locationTypeIds: Record<string, string>;
      };
      prompt?: unknown;
    };
    assert.equal(createdRouteDraft.operation, "create");
    const createRoutePrompt = capturedProviderPrompt(generationProviderRequests[createRouteRequestIndex]);
    assert.match(createRoutePrompt, /Links express direct travel between sibling locations/u);
    assert.match(createRoutePrompt, /floors use stairs, lifts, ladders, or ramps/u);
    assert.match(createRoutePrompt, /sparse connected travel graph/u);
    assert.match(createRoutePrompt, /Do not create an all-to-all graph/u);
    assert.match(createRoutePrompt, /Infer a concise location-type vocabulary/u);
    assert.match(createRoutePrompt, /Prefer concise maritime vocabulary and navigable public streets/u);
    assert.match(createRoutePrompt, /Keep the route graph especially legible for this run/u);
    assert.match(createRoutePrompt, /One-run override: favor short district names/u);
    assert.equal(createdRouteDraft.prompt, undefined);
    assert.ok(
      createdRouteDraft.hierarchyProfile.types.some((type) => type.label === "City Quarter" && type.baseKind === "place"),
      "AI-created hierarchy vocabulary must be returned as stable custom types",
    );
    assert.equal(
      createdRouteDraft.hierarchyProfile.locationTypeIds[
        createdRouteDraft.definition.locations.find((location) => location.name === "Old Town")!.id
      ],
      createdRouteDraft.hierarchyProfile.types.find((type) => type.label === "City Quarter")!.id,
    );

    const routeWorld = createdRouteDraft.definition.locations.find((location) => location.name === "Route Test World");
    assert.ok(routeWorld);
    assertSiblingRouteGraphConnected(
      createdRouteDraft.definition,
      routeWorld.id,
      "AI map creation must connect every generated city sibling",
    );
    const routeSiblings = createdRouteDraft.definition.locations.filter((location) => location.parentId === routeWorld.id);
    const routeSiblingIds = new Set(routeSiblings.map((location) => location.id));
    const routeEdges = new Set(
      routeSiblings.flatMap((location) =>
        location.links
          .filter((link) => routeSiblingIds.has(link.targetId))
          .map((link) => [location.id, link.targetId].sort().join("::")),
      ),
    );
    assert.equal(
      routeEdges.size,
      routeSiblings.length - 1,
      "The connectivity fallback must remain sparse instead of completing the graph",
    );
    assert.ok(
      routeSiblings.some((location) => location.links.some((link) => link.label === "Market Street")),
      "Model-authored semantic route labels must be preserved",
    );

    const savedRouteMap = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${routeGraphChat.id}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition: { ...createdRouteDraft.definition, enabled: true },
        hierarchyProfile: createdRouteDraft.hierarchyProfile,
      },
    })) as {
      definition: typeof createdRouteDraft.definition;
      hierarchyProfile: typeof createdRouteDraft.hierarchyProfile;
      generationPreferences: { activeOptionId: string; options: Array<{ id: string; guidance: string }> };
    };
    assert.equal(savedRouteMap.hierarchyProfile.name, "Harbor city");
    assert.equal(savedRouteMap.generationPreferences.activeOptionId, "maritime");
    const existingHarbor = savedRouteMap.definition.locations.find((location) => location.name === "Harbor");
    assert.ok(existingHarbor);
    mapExpansionExistingTargetId = existingHarbor.id;

    const expandRouteRequestIndex = generationProviderRequests.length;
    const expandedRouteDraft = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${routeGraphChat.id}/spatial-context/generate`,
      headers: csrfHeaders,
      payload: {
        operation: "expand",
        targetLocationId: routeWorld.id,
        size: "small",
        instructions: "Add a canal ward connected to the existing harbor.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: gameGenerationConnection.id,
        debugMode: false,
      },
    })) as { operation: string; definition: RouteGraphDefinition };
    mapExpansionExistingTargetId = null;
    assert.equal(expandedRouteDraft.operation, "expand");
    const expandRoutePrompt = capturedProviderPrompt(generationProviderRequests[expandRouteRequestIndex]);
    assert.ok(
      expandRoutePrompt.includes(`"key": "${existingHarbor.id}"`),
      "Expansion prompts must expose stable existing child keys to the model",
    );
    assert.match(expandRoutePrompt, /Connect at least one new direct child to the most plausible existing child/u);
    assert.match(expandRoutePrompt, /Location-type vocabulary/u);
    assert.match(expandRoutePrompt, /City Quarter/u);
    assert.deepEqual(
      expandedRouteDraft.definition.locations.slice(0, savedRouteMap.definition.locations.length),
      savedRouteMap.definition.locations,
      "AI expansion must not rewrite existing map locations",
    );
    const canalWard = expandedRouteDraft.definition.locations.find((location) => location.name === "Canal Ward");
    assert.ok(canalWard);
    assert.ok(
      canalWard.links.some(
        (link) =>
          link.targetId === existingHarbor.id &&
          link.label === "Canal Bridge" &&
          link.bidirectional &&
          link.state === "available",
      ),
      "AI expansion must preserve a semantic link into the existing sibling graph",
    );
    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/chats/${routeGraphChat.id}?force=true`,
        headers: csrfHeaders,
      },
      204,
    );

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
    assert.match(roleplayPeekText, /ROLEPLAY_CUSTOM_TURN_TEMPLATE/u);

    const oversizedResolvedRoleplayTemplates = {
      ...customizedGlobalTurnTemplates,
      roleplay: `${defaultTurnPromptTemplate}\n${Array.from(
        { length: 500 },
        () => "${privateModelContextBlock}",
      ).join("\n")}`,
    };
    await expectJson(app, {
      method: "PUT",
      url: "/api/chats/spatial-context/global-turn-prompt-templates",
      headers: csrfHeaders,
      payload: oversizedResolvedRoleplayTemplates,
    });
    const oversizedTemplatePeek = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${chatId}/peek-prompt`,
      headers: csrfHeaders,
      payload: {},
    })) as { messages: Array<{ content: string }> };
    const oversizedTemplatePeekText = oversizedTemplatePeek.messages
      .map((message) => message.content)
      .join("\n");
    assert.match(oversizedTemplatePeekText, /<spatial_context mode="roleplay" authority="application">/u);
    assert.equal(
      oversizedTemplatePeekText.match(/Private model context:/gu)?.length,
      1,
      "An oversized resolved custom template must fall back to the bounded built-in turn insert",
    );
    await expectJson(app, {
      method: "PUT",
      url: "/api/chats/spatial-context/global-turn-prompt-templates",
      headers: csrfHeaders,
      payload: customizedGlobalTurnTemplates,
    });
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
      {
        chatId,
        messageId: assistantAtHarbor.id,
        swipeIndex: regeneratedSwipe.index,
        regenerate: true,
        continuation: false,
      },
    );
    assert.equal(regeneratedSnapshot?.currentLocationId, "lifecycle_harbor");
    const exactRegeneratedState = await resolveEffectiveSpatialState(chatId, {
      exactAnchor: { messageId: assistantAtHarbor.id, swipeIndex: 1 },
    });
    assert.equal(exactRegeneratedState.currentLocationId, "lifecycle_harbor");

    await expectJson(app, {
      method: "DELETE",
      url: `/api/chats/${chatId}/messages/${assistantAtHarbor.id}/swipes/0`,
      headers: csrfHeaders,
    });
    const shiftedSwipeState = await resolveEffectiveSpatialState(chatId, {
      exactAnchor: { messageId: assistantAtHarbor.id, swipeIndex: 0 },
    });
    assert.equal(shiftedSwipeState.currentLocationId, "lifecycle_harbor");
    const removedSwipeState = await resolveEffectiveSpatialState(chatId, {
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
    assert.equal(reinstalled.version, "1.1.7");
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
      [{ version: "1.1.7", status: "active", readiness: "ready" }],
    );

    console.info(
      "Hierarchical Maps exact-artifact lifecycle regression passed: update, AI-created connected route graphs, AI expansion links to existing siblings, owner-turn persistence, live prompt parity, Roleplay/Game swipe/regeneration/continuation history, branch/delete/import/export/checkpoint preservation, reviewed Game reconciliation, offline restart, remove, reinstall, backup, and restore.",
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
