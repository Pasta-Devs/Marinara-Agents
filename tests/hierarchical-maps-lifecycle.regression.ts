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
const artifactWorldMapsGuideUrl =
  "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/agents/hierarchical-maps.md";
const catalogWorldMapsGuideUrl =
  "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/agents/hierarchical-maps.md";
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
  if (
    version === "1.2.5" ||
    version === "1.2.6" ||
    version === "1.2.7" ||
    version === "1.2.8" ||
    version === "1.2.9" ||
    version === "1.3.0" ||
    version === "1.3.1" ||
    version === "1.3.2" ||
    version === "1.3.3" ||
    version === "1.3.4" ||
    version === "1.3.5" ||
    version === "1.3.6"
  ) {
    const clientSource = execFileSync("unzip", ["-p", path, "client.js"], { encoding: "utf8" });
    assert.ok(clientSource.includes(artifactWorldMapsGuideUrl));
    assert.match(clientSource, /Open World Maps movement help/u);
    assert.match(clientSource, /Open shared-world guide/u);
    if (
      version === "1.2.7" ||
      version === "1.2.8" ||
      version === "1.2.9" ||
      version === "1.3.0" ||
      version === "1.3.1" ||
      version === "1.3.2" ||
      version === "1.3.3" ||
      version === "1.3.4" ||
      version === "1.3.5" ||
      version === "1.3.6"
    ) {
      assert.match(
        clientSource,
        /\[data-marinara-maps-world-canvas\]\s*\{\s*aspect-ratio:\s*16\s*\/\s*9;\s*height:\s*auto;\s*width:\s*100%;\s*\}/u,
      );
    }
    if (
      version === "1.2.9" ||
      version === "1.3.0" ||
      version === "1.3.1" ||
      version === "1.3.2" ||
      version === "1.3.3" ||
      version === "1.3.4" ||
      version === "1.3.5" ||
      version === "1.3.6"
    ) {
      assert.match(
        clientSource,
        /\[data-marinara-maps-workspace-overlay\]\s+\[data-marinara-maps-editor-canvas\]\s*\{\s*aspect-ratio:\s*16\s*\/\s*9;\s*height:\s*auto;\s*width:\s*100%;\s*\}/u,
      );
    }
    if (
      version === "1.3.1" ||
      version === "1.3.2" ||
      version === "1.3.3" ||
      version === "1.3.4" ||
      version === "1.3.5" ||
      version === "1.3.6"
    ) {
      assert.match(clientSource, /spatial_transition_rejected/u);
      assert.match(clientSource, /spatial_transition_committed/u);
      assert.match(clientSource, /marinara-capability-server-event/u);
      assert.match(clientSource, /The current location changed\. Review the available destinations\./u);
      assert.match(clientSource, /new Map\(\[\["spatial_transition_stale_definition"/u);
    }
    if (
      version === "1.3.2" ||
      version === "1.3.3" ||
      version === "1.3.4" ||
      version === "1.3.5" ||
      version === "1.3.6"
    ) {
      assert.match(clientSource, /Incoming one-way/u);
      assert.match(clientSource, /data-marinara-direct-link-direction/u);
    }
    if (version === "1.3.3" || version === "1.3.4" || version === "1.3.5" || version === "1.3.6") {
      assert.match(clientSource, /Break breadcrumb continuity and start a new map/u);
      assert.match(clientSource, /breakHistoryContinuity/u);
      const serverSource = execFileSync("unzip", ["-p", path, "server.mjs"], { encoding: "utf8" });
      assert.match(serverSource, /spatial-context\/start-over/u);
      assert.match(serverSource, /spatial_start_over_confirmation_required/u);
    }
  }
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
    artifactFixture("1.2.0"),
    artifactFixture("1.2.1"),
    artifactFixture("1.2.2"),
    artifactFixture("1.2.3"),
    artifactFixture("1.2.4"),
    artifactFixture("1.2.5"),
    artifactFixture("1.2.6"),
    artifactFixture("1.2.7"),
    artifactFixture("1.2.8"),
    artifactFixture("1.2.9"),
    artifactFixture("1.3.0"),
    artifactFixture("1.3.1"),
    artifactFixture("1.3.2"),
    artifactFixture("1.3.3"),
    artifactFixture("1.3.4"),
    artifactFixture("1.3.5"),
    artifactFixture("1.3.6"),
  ].map((fixture) => [fixture.manifest.version, fixture]),
);
let catalogVersion = "1.1.7";
let catalogOnline = true;
let generationProviderRequestCount = 0;
let generationProviderFailure = false;
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

const currentFixture = fixtures.get("1.3.6");
assert.ok(currentFixture);
assert.deepEqual(currentFixture.manifest.builtAgainst, {
  engineVersion: "2.4.2",
  engineCommit: "00986ff5bfdcd5705d70c7fca8d8ade86665b217",
});

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
          version === "1.2.6" ||
          version === "1.2.7" ||
          version === "1.2.8" ||
          version === "1.2.9" ||
          version === "1.3.0" ||
          version === "1.3.1" ||
          version === "1.3.2" ||
          version === "1.3.3" ||
          version === "1.3.4" ||
          version === "1.3.5" ||
          version === "1.3.6"
            ? catalogWorldMapsGuideUrl
            : "https://github.com/Pasta-Devs/Marinara-Agents#hierarchical-maps",
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
    if (generationProviderFailure) {
      return new Response(JSON.stringify({ error: "Lifecycle provider failure" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
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
        : providerPrompt.includes("Repeat the already committed move into Lifecycle Harbor.")
          ? "RETRY_PROVIDER_RESPONSE_SHOULD_NOT_PERSIST"
          : providerPrompt.includes("Move into Lifecycle Harbor.")
            ? 'GAME_HISTORY_PROVIDER_RESPONSE: The party reaches Lifecycle Harbor.\n[spatial_move: destination_id="lifecycle_harbor"]'
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
    {
      id: "lifecycle_level_5",
      parentId: "lifecycle_world",
      name: "Level 5 — Prism Caverns",
      kind: "floor",
      description: "A known numbered level used to prevent duplicate discoveries.",
      childPresentation: "list",
      links: [],
      status: "active",
      sortOrder: 1,
    },
    {
      id: "lifecycle_deck",
      parentId: "lifecycle_world",
      name: "Deck",
      kind: "floor",
      description: "A bare deck name used to detect false location aliases.",
      childPresentation: "list",
      links: [],
      status: "active",
      sortOrder: 2,
    },
    {
      id: "lifecycle_deck_a",
      parentId: "lifecycle_world",
      name: "Deck A",
      kind: "floor",
      description: "A lettered deck that must retain its single-letter designator.",
      childPresentation: "list",
      links: [],
      status: "active",
      sortOrder: 3,
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
          directive?:
            | { type: "move"; destinationId: string }
            | { type: "discover"; name: string; relation: "enter" | "link"; description?: string }
            | null;
          locationGuidance?: string | null;
        },
        chatMetadata?: unknown,
      ): Promise<{
        currentLocationId: string;
        definitionRevision: number;
        transitionCommandId: string | null;
      } | null>;
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
    const { createGlobalGalleryStorage } = await importEngine<{
      createGlobalGalleryStorage(db: unknown): {
        createImage(input: { filePath: string }): Promise<{ id: string } | null>;
      };
    }>("packages/server/src/services/storage/global-gallery.storage.ts");

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
    const verifySharedWorldLifecycle = async () => {
      const sharedWorldArtwork = await createGlobalGalleryStorage(app.db).createImage({
        filePath: "global/lifecycle-shared-world-art.png",
      });
      assert.ok(sharedWorldArtwork);
      const sharedWorldArtworkReference = `global-gallery:${sharedWorldArtwork.id}`;
      const sharedWorldDefinition = {
        ...definition,
        locations: definition.locations.map((location, index) =>
          index === 0
            ? {
                ...location,
                referenceImageId: sharedWorldArtworkReference,
                useReferenceImage: true,
                mapBackgroundImageId: sharedWorldArtworkReference,
                mapBackgroundPosition: { x: 24, y: 76 },
              }
            : location,
        ),
      };
      const sharedWorldHierarchyProfile = {
        version: 1,
        mode: "custom",
        name: "Lifecycle shared-world types",
        types: [
          { id: "type_region", label: "Region", baseKind: "region" },
          {
            id: "type_settlement",
            label: "Settlement",
            baseKind: "settlement",
          },
          { id: "type_place", label: "Place", baseKind: "place" },
          { id: "type_building", label: "Building", baseKind: "building" },
          { id: "type_floor", label: "Floor", baseKind: "floor" },
          { id: "type_room", label: "Room", baseKind: "room" },
        ],
        locationTypeIds: Object.fromEntries(
          sharedWorldDefinition.locations.map((location) => [location.id, `type_${location.kind}`]),
        ),
      };
      const sharedWorld = (await expectJson(
        app,
        {
          method: "POST",
          url: "/api/chats/spatial-context/shared-worlds",
          headers: csrfHeaders,
          payload: {
            name: "Lifecycle durable world",
            description: "One canonical map shared by otherwise independent chats.",
            definition: sharedWorldDefinition,
            hierarchyProfile: sharedWorldHierarchyProfile,
          },
        },
        201,
      )) as {
        id: string;
        name: string;
        revision: number;
        linkedChatCount: number;
        data: { definition: typeof definition; hierarchyProfile: unknown };
      };
      assert.equal(sharedWorld.revision, 1);
      assert.equal(sharedWorld.linkedChatCount, 0);
      assert.equal(
        sharedWorld.data.definition.locations[0]?.referenceImageId,
        sharedWorldArtworkReference,
        "Shared worlds must retain reusable Global Gallery artwork references",
      );

      const concurrentSharedWorldPayload = {
        name: "Lifecycle concurrent world",
        description: "Only one request may claim this account-owned world name.",
        definition: sharedWorldDefinition,
        hierarchyProfile: sharedWorldHierarchyProfile,
      };
      const concurrentSharedWorldResponses = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/chats/spatial-context/shared-worlds",
          headers: csrfHeaders,
          payload: concurrentSharedWorldPayload,
        }),
        app.inject({
          method: "POST",
          url: "/api/chats/spatial-context/shared-worlds",
          headers: csrfHeaders,
          payload: concurrentSharedWorldPayload,
        }),
      ]);
      assert.deepEqual(
        concurrentSharedWorldResponses.map((response) => response.statusCode).sort((left, right) => left - right),
        [201, 409],
        "Concurrent shared-world creation must persist only one case-insensitive friendly name",
      );
      const concurrentNameConflict = concurrentSharedWorldResponses.find((response) => response.statusCode === 409);
      assert.ok(concurrentNameConflict);
      assert.equal(JSON.parse(concurrentNameConflict.body).code, "spatial_shared_world_name_conflict");
      const sharedWorldsAfterConcurrentCreate = (await expectJson(app, {
        method: "GET",
        url: "/api/chats/spatial-context/shared-worlds",
      })) as Array<{ name: string }>;
      assert.equal(
        sharedWorldsAfterConcurrentCreate.filter(
          (world) => world.name.toLocaleLowerCase() === concurrentSharedWorldPayload.name.toLocaleLowerCase(),
        ).length,
        1,
      );
      const conflictingRename = (await expectJson(
        app,
        {
          method: "PUT",
          url: `/api/chats/spatial-context/shared-worlds/${sharedWorld.id}`,
          headers: csrfHeaders,
          payload: {
            expectedRevision: sharedWorld.revision,
            name: concurrentSharedWorldPayload.name.toUpperCase(),
            description: "One canonical map shared by otherwise independent chats.",
            definition: sharedWorld.data.definition,
            hierarchyProfile: sharedWorld.data.hierarchyProfile,
          },
        },
        409,
      )) as { code: string };
      assert.equal(
        conflictingRename.code,
        "spatial_shared_world_name_conflict",
        "Shared-world renames must preserve the case-insensitive uniqueness policy",
      );

      const createSharedWorldChat = async (name: string, mode: "roleplay" | "game" = "roleplay") => {
        const chat = (await expectJson(app, {
          method: "POST",
          url: "/api/chats",
          headers: csrfHeaders,
          payload: { name, mode, characterIds: [] },
        })) as { id: string };
        await expectJson(app, {
          method: "PATCH",
          url: `/api/chats/${chat.id}/metadata`,
          headers: csrfHeaders,
          payload: {
            enableAgents: true,
            activeAgentIds: ["hierarchical-maps"],
          },
        });
        return chat;
      };
      const firstLinkedChat = await createSharedWorldChat("Lifecycle linked world A");
      const secondLinkedChat = await createSharedWorldChat("Lifecycle linked world B");
      const gameSetupLinkedChat = await createSharedWorldChat("Lifecycle linked Game setup world", "game");
      const staleSelectionChat = await createSharedWorldChat("Lifecycle stale setup selection", "game");
      const staleSelection = (await expectJson(
        app,
        {
          method: "POST",
          url: `/api/chats/${staleSelectionChat.id}/spatial-context/shared-world/link`,
          headers: csrfHeaders,
          payload: {
            worldId: sharedWorld.id,
            expectedWorldRevision: sharedWorld.revision + 1,
            expectedRevision: 0,
            expectedCurrentLocationId: null,
          },
        },
        409,
      )) as { code: string };
      assert.equal(staleSelection.code, "spatial_shared_world_selection_stale");
      const linkChat = async (chatId: string) =>
        expectJson(app, {
          method: "POST",
          url: `/api/chats/${chatId}/spatial-context/shared-world/link`,
          headers: csrfHeaders,
          payload: {
            worldId: sharedWorld.id,
            expectedWorldRevision: sharedWorld.revision,
            expectedRevision: 0,
            expectedCurrentLocationId: null,
          },
        }) as Promise<{
          definition: typeof definition & { revision: number };
          currentLocationId: string | null;
          hierarchyProfile: unknown;
          sharedWorld: {
            mode: "linked" | "independent";
            pendingChanges: boolean;
            conflict: boolean;
            linkedChatCount: number;
            worldRevision: number | null;
          };
        }>;
      const gameSetupLinked = await linkChat(gameSetupLinkedChat.id);
      assert.equal(gameSetupLinked.currentLocationId, "lifecycle_world");
      assert.equal(gameSetupLinked.sharedWorld.mode, "linked");
      assert.equal(gameSetupLinked.sharedWorld.worldRevision, sharedWorld.revision);
      const sharedWorldsAfterGameSetupLink = (await expectJson(app, {
        method: "GET",
        url: "/api/chats/spatial-context/shared-worlds",
      })) as Array<typeof sharedWorld>;
      const canonicalAfterGameSetupLink = sharedWorldsAfterGameSetupLink.find((world) => world.id === sharedWorld.id);
      assert.equal(canonicalAfterGameSetupLink?.revision, sharedWorld.revision);
      assert.deepEqual(
        canonicalAfterGameSetupLink?.data,
        sharedWorld.data,
        "Linking a shared world during Game setup must not mutate its canonical definition or artwork",
      );
      await expectJson(
        app,
        {
          method: "DELETE",
          url: `/api/chats/${gameSetupLinkedChat.id}?force=true`,
          headers: csrfHeaders,
        },
        204,
      );
      const firstLinked = await linkChat(firstLinkedChat.id);
      const secondLinked = await linkChat(secondLinkedChat.id);
      assert.equal(firstLinked.currentLocationId, "lifecycle_world");
      assert.equal(firstLinked.sharedWorld.mode, "linked");
      assert.equal(secondLinked.sharedWorld.linkedChatCount, 2);
      const sharedWorldsAfterSetupLinks = (await expectJson(app, {
        method: "GET",
        url: "/api/chats/spatial-context/shared-worlds",
      })) as Array<typeof sharedWorld>;
      const canonicalAfterSetupLinks = sharedWorldsAfterSetupLinks.find((world) => world.id === sharedWorld.id);
      assert.equal(canonicalAfterSetupLinks?.revision, sharedWorld.revision);
      assert.deepEqual(canonicalAfterSetupLinks?.data, sharedWorld.data);
      const firstLinkedMove = (await expectJson(app, {
        method: "POST",
        url: `/api/chats/${firstLinkedChat.id}/spatial-context/turn`,
        headers: csrfHeaders,
        payload: {
          content: "I walk from the shared world into Lifecycle Harbor.",
          transition: {
            destinationId: "lifecycle_harbor",
            expectedDefinitionRevision: firstLinked.definition.revision,
            expectedCurrentLocationId: firstLinked.currentLocationId,
            commandId: "shared-world-private-runtime-state",
          },
        },
      })) as { spatial: typeof firstLinked };
      assert.equal(firstLinkedMove.spatial.currentLocationId, "lifecycle_harbor");
      const secondAfterFirstMove = (await expectJson(app, {
        method: "GET",
        url: `/api/chats/${secondLinkedChat.id}/spatial-context`,
      })) as typeof secondLinked;
      assert.equal(
        secondAfterFirstMove.currentLocationId,
        "lifecycle_world",
        "Moving one linked chat must not change another linked chat's private runtime state",
      );

      const firstDraftDefinition = {
        ...firstLinked.definition,
        locations: firstLinked.definition.locations.map((location) =>
          location.id === "lifecycle_harbor"
            ? {
                ...location,
                description: "A harbor expanded in the first linked chat.",
              }
            : location,
        ),
      };
      const firstDraft = (await expectJson(app, {
        method: "PUT",
        url: `/api/chats/${firstLinkedChat.id}/spatial-context`,
        headers: csrfHeaders,
        payload: {
          expectedRevision: firstLinked.definition.revision,
          expectedCurrentLocationId: firstLinkedMove.spatial.currentLocationId,
          definition: firstDraftDefinition,
          hierarchyProfile: firstLinked.hierarchyProfile,
        },
      })) as typeof firstLinked;
      assert.equal(firstDraft.sharedWorld.pendingChanges, true);
      const blockedRelink = (await expectJson(
        app,
        {
          method: "POST",
          url: `/api/chats/${firstLinkedChat.id}/spatial-context/shared-world/link`,
          headers: csrfHeaders,
          payload: {
            worldId: sharedWorld.id,
            expectedWorldRevision: sharedWorld.revision,
            expectedRevision: firstDraft.definition.revision,
            expectedCurrentLocationId: firstDraft.currentLocationId,
          },
        },
        409,
      )) as { code: string };
      assert.equal(blockedRelink.code, "spatial_shared_world_pending_changes");
      const untouchedSecond = (await expectJson(app, {
        method: "GET",
        url: `/api/chats/${secondLinkedChat.id}/spatial-context`,
      })) as typeof secondLinked;
      assert.notEqual(
        untouchedSecond.definition.locations.find((location) => location.id === "lifecycle_harbor")?.description,
        "A harbor expanded in the first linked chat.",
        "Linked-chat map edits must remain private until explicitly published",
      );

      const published = (await expectJson(app, {
        method: "POST",
        url: `/api/chats/${firstLinkedChat.id}/spatial-context/shared-world/publish`,
        headers: csrfHeaders,
        payload: {
          expectedWorldRevision: sharedWorld.revision,
          definition: firstDraft.definition,
          hierarchyProfile: firstDraft.hierarchyProfile,
        },
      })) as {
        world: typeof sharedWorld;
        spatial: typeof firstLinked;
      };
      assert.equal(published.world.revision, 2);
      assert.equal(published.spatial.sharedWorld.pendingChanges, false);
      const updatedSecond = (await expectJson(app, {
        method: "GET",
        url: `/api/chats/${secondLinkedChat.id}/spatial-context`,
      })) as typeof secondLinked;
      assert.equal(
        updatedSecond.definition.locations.find((location) => location.id === "lifecycle_harbor")?.description,
        "A harbor expanded in the first linked chat.",
        "Publishing must update the canonical definition read by every linked chat",
      );
      assert.equal(
        updatedSecond.currentLocationId,
        "lifecycle_world",
        "Publishing a shared definition must preserve each linked chat's private runtime state",
      );

      const conflictingDraftDefinition = {
        ...published.spatial.definition,
        locations: published.spatial.definition.locations.map((location) =>
          location.id === "lifecycle_harbor" ? { ...location, modelMemory: "An unpublished local secret." } : location,
        ),
      };
      const conflictingDraft = (await expectJson(app, {
        method: "PUT",
        url: `/api/chats/${firstLinkedChat.id}/spatial-context`,
        headers: csrfHeaders,
        payload: {
          expectedRevision: published.spatial.definition.revision,
          expectedCurrentLocationId: published.spatial.currentLocationId,
          definition: conflictingDraftDefinition,
          hierarchyProfile: published.spatial.hierarchyProfile,
        },
      })) as typeof firstLinked;
      const canonicalUpdate = (await expectJson(app, {
        method: "PUT",
        url: `/api/chats/spatial-context/shared-worlds/${sharedWorld.id}`,
        headers: csrfHeaders,
        payload: {
          expectedRevision: published.world.revision,
          name: published.world.name,
          description: "Canonical edit made while a linked chat has a draft.",
          definition: published.world.data.definition,
          hierarchyProfile: published.world.data.hierarchyProfile,
        },
      })) as typeof sharedWorld;
      assert.equal(canonicalUpdate.revision, 3);
      const conflicted = (await expectJson(app, {
        method: "GET",
        url: `/api/chats/${firstLinkedChat.id}/spatial-context`,
      })) as typeof firstLinked;
      assert.equal(conflicted.sharedWorld.conflict, true);
      const rejectedPublish = (await expectJson(
        app,
        {
          method: "POST",
          url: `/api/chats/${firstLinkedChat.id}/spatial-context/shared-world/publish`,
          headers: csrfHeaders,
          payload: {
            expectedWorldRevision: canonicalUpdate.revision,
            definition: conflictingDraft.definition,
            hierarchyProfile: conflictingDraft.hierarchyProfile,
          },
        },
        409,
      )) as { code: string };
      assert.equal(rejectedPublish.code, "spatial_shared_world_conflict");

      const forked = (await expectJson(app, {
        method: "POST",
        url: `/api/chats/${firstLinkedChat.id}/spatial-context/shared-world/fork`,
        headers: csrfHeaders,
        payload: {
          expectedRevision: conflictingDraft.definition.revision,
          expectedCurrentLocationId: conflictingDraft.currentLocationId,
        },
      })) as typeof firstLinked;
      assert.equal(forked.sharedWorld.mode, "independent");
      assert.equal(forked.currentLocationId, "lifecycle_harbor");
      assert.equal(
        forked.definition.locations.find((location) => location.id === "lifecycle_harbor")?.modelMemory,
        "An unpublished local secret.",
      );
      const secondAfterFirstFork = (await expectJson(app, {
        method: "GET",
        url: `/api/chats/${secondLinkedChat.id}/spatial-context`,
      })) as typeof secondLinked;
      assert.equal(
        secondAfterFirstFork.currentLocationId,
        "lifecycle_world",
        "Forking one linked chat must not change another linked chat's private runtime state",
      );

      const inUseDelete = (await expectJson(
        app,
        {
          method: "DELETE",
          url: `/api/chats/spatial-context/shared-worlds/${sharedWorld.id}`,
          headers: csrfHeaders,
          payload: { expectedRevision: canonicalUpdate.revision },
        },
        409,
      )) as { code: string; linkedChatCount: number };
      assert.equal(inUseDelete.code, "spatial_shared_world_in_use");
      assert.equal(inUseDelete.linkedChatCount, 1);

      const independentSecond = (await expectJson(app, {
        method: "POST",
        url: `/api/chats/${secondLinkedChat.id}/spatial-context/shared-world/independent-copy`,
        headers: csrfHeaders,
        payload: {
          expectedRevision: canonicalUpdate.revision,
          expectedCurrentLocationId: updatedSecond.currentLocationId,
          definition: updatedSecond.definition,
          hierarchyProfile: updatedSecond.hierarchyProfile,
        },
      })) as typeof secondLinked;
      assert.equal(independentSecond.sharedWorld.mode, "independent");
      await expectJson(
        app,
        {
          method: "DELETE",
          url: `/api/chats/spatial-context/shared-worlds/${sharedWorld.id}`,
          headers: csrfHeaders,
          payload: { expectedRevision: canonicalUpdate.revision },
        },
        204,
      );
    };
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
      locations: [
        ...definition.locations.map((location) =>
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
        {
          id: "lifecycle_archived_region",
          parentId: null,
          name: "Lifecycle Archived Region",
          kind: "region",
          description: "A retired region retained only for campaign history.",
          childPresentation: "list",
          links: [],
          lorebookEntryIds: ["missing-archived-lifecycle-lore-entry"],
          status: "archived",
          sortOrder: 1,
        },
      ],
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
    assert.ok(
      saved.warnings.some(
        (warning) =>
          warning.code === "lorebook_entry_missing" &&
          warning.locationId === "lifecycle_archived_region",
      ),
      "The prior artifact must reproduce archived-location lore warnings before update",
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
    })) as {
      currentLocationId: string;
      definition: { revision: number; locations: Array<{ id: string }> };
    };
    assert.equal(rewoundSource.currentLocationId, "lifecycle_harbor");
    const unchangedBranch = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${branch.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(unchangedBranch.currentLocationId, "lifecycle_world");

    catalogVersion = "1.3.6";
    catalogOnline = true;
    const upgraded136 = await capabilityPackageManager.install("hierarchical-maps");
    assert.equal(upgraded136.version, "1.3.6");
    assert.equal(upgraded136.previousVersion, "1.1.7");
    catalogOnline = false;
    await app.close();
    app = await buildApp();

    const impersonateConnection = (await expectJson(app, {
      method: "POST",
      url: "/api/connections",
      headers: csrfHeaders,
      payload: {
        name: "Hierarchical Maps impersonate movement provider",
        provider: "custom",
        baseUrl: generationProviderBaseUrl,
        model: "maps-lifecycle-e2e",
        apiKey: "maps-lifecycle-e2e",
        treatAsLocalEndpoint: true,
      },
    })) as { id: string };
    const impersonateChat = (await expectJson(app, {
      method: "POST",
      url: "/api/chats",
      headers: csrfHeaders,
      payload: {
        name: "Roleplay impersonate movement fixture",
        mode: "roleplay",
        characterIds: [],
        connectionId: impersonateConnection.id,
      },
    })) as { id: string };
    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${impersonateChat.id}/metadata`,
      headers: csrfHeaders,
      payload: { enableAgents: true, activeAgentIds: ["hierarchical-maps"] },
    });
    const impersonateSpatial = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${impersonateChat.id}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition,
      },
    })) as { currentLocationId: string; definition: { revision: number } };
    assert.equal(impersonateSpatial.currentLocationId, "lifecycle_world");

    const customCreateChat = (await expectJson(app, {
      method: "POST",
      url: "/api/chats",
      headers: csrfHeaders,
      payload: {
        name: "Custom create target lifecycle fixture",
        mode: "roleplay",
        characterIds: [],
        connectionId: impersonateConnection.id,
      },
    })) as { id: string };
    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${customCreateChat.id}/metadata`,
      headers: csrfHeaders,
      payload: { enableAgents: true, activeAgentIds: ["hierarchical-maps"] },
    });
    const customCreatePreviewRequestCount = generationProviderRequests.length;
    const customCreatePreview = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${customCreateChat.id}/spatial-context/generation-prompt/preview`,
      headers: csrfHeaders,
      payload: {
        operation: "create",
        size: "small",
        targetLocationCount: 10,
        instructions: "Create a compact city with practical streets.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: impersonateConnection.id,
        debugMode: false,
        hierarchyMode: "auto",
      },
    })) as { operation: string; system: string; user: string };
    assert.equal(generationProviderRequests.length, customCreatePreviewRequestCount);
    assert.equal(customCreatePreview.operation, "create");
    assert.match(customCreatePreview.system, /Create about 10 locations/u);
    const customCreateRequestIndex = generationProviderRequests.length;
    const customCreate = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${customCreateChat.id}/spatial-context/generate`,
      headers: csrfHeaders,
      payload: {
        operation: "create",
        size: "small",
        targetLocationCount: 10,
        instructions: "Create a compact city with practical streets.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: impersonateConnection.id,
        debugMode: false,
        hierarchyMode: "auto",
      },
    })) as { operation: string };
    assert.equal(customCreate.operation, "create");
    assert.match(
      capturedProviderPrompt(generationProviderRequests[customCreateRequestIndex]),
      /Create about 10 locations/u,
      "Custom create targets must reach the provider prompt.",
    );
    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/chats/${customCreateChat.id}?force=true`,
        headers: csrfHeaders,
      },
      204,
    );

    mapExpansionExistingTargetId = "lifecycle_harbor";
    const customExpansionPreviewRequestCount = generationProviderRequests.length;
    const customExpansionPreview = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${impersonateChat.id}/spatial-context/generation-prompt/preview`,
      headers: csrfHeaders,
      payload: {
        operation: "expand",
        targetLocationId: "lifecycle_world",
        size: "small",
        targetLocationCount: 10,
        instructions: "Add a canal ward connected to the existing harbor.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: impersonateConnection.id,
        debugMode: false,
      },
    })) as { operation: string; system: string; user: string };
    assert.equal(generationProviderRequests.length, customExpansionPreviewRequestCount);
    assert.equal(customExpansionPreview.operation, "expand");
    assert.match(customExpansionPreview.system, /Create about 10 new locations/u);
    const customExpansionRequestIndex = generationProviderRequests.length;
    const customExpansion = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${impersonateChat.id}/spatial-context/generate`,
      headers: csrfHeaders,
      payload: {
        operation: "expand",
        targetLocationId: "lifecycle_world",
        size: "small",
        targetLocationCount: 10,
        instructions: "Add a canal ward connected to the existing harbor.",
        groundingMode: "setup",
        sourceLorebookIds: [],
        connectionId: impersonateConnection.id,
        debugMode: false,
      },
    })) as { operation: string; definition: { locations: Array<{ id: string }> } };
    mapExpansionExistingTargetId = null;
    assert.equal(customExpansion.operation, "expand");
    assert.match(
      capturedProviderPrompt(generationProviderRequests[customExpansionRequestIndex]),
      /Create about 10 new locations/u,
      "Custom expansion targets must reach the provider prompt.",
    );

    const guidedGeneration = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: impersonateChat.id,
        connectionId: impersonateConnection.id,
        generationGuide: "Keep the scene at Lifecycle World while the NPC waits.",
        generationGuideSource: "narrator",
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
      },
    });
    assert.equal(guidedGeneration.statusCode, 200, guidedGeneration.body);
    assert.doesNotMatch(guidedGeneration.body, /spatial_transition_(?:committed|rejected)/u);
    const afterGuidedSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(afterGuidedSpatial.currentLocationId, "lifecycle_world");
    // The queued transition is browser-local rather than part of the chat API.
    // Its ready-state preservation across /guided is covered by spatial-context.e2e.ts.

    const providerRequestsBeforeGuidedMove = generationProviderRequestCount;
    const guidedMoveGeneration = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: impersonateChat.id,
        connectionId: impersonateConnection.id,
        generationGuide: "Move the NPC into Lifecycle Harbor.",
        generationGuideSource: "guide",
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
        pendingSpatialTransition: {
          destinationId: "lifecycle_harbor",
          expectedDefinitionRevision: impersonateSpatial.definition.revision,
          expectedCurrentLocationId: "lifecycle_world",
          commandId: "guided-must-not-consume-owner-move",
        },
      },
    });
    assert.equal(guidedMoveGeneration.statusCode, 400, guidedMoveGeneration.body);
    assert.match(guidedMoveGeneration.body, /spatial_transition_requires_new_turn/u);
    assert.equal(generationProviderRequestCount, providerRequestsBeforeGuidedMove);
    const afterGuidedMoveSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(afterGuidedMoveSpatial.currentLocationId, "lifecycle_world");

    const impersonateGeneration = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: impersonateChat.id,
        connectionId: impersonateConnection.id,
        impersonate: true,
        userMessage: "Move into Lifecycle Harbor.",
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
        pendingSpatialTransition: {
          destinationId: "lifecycle_harbor",
          expectedDefinitionRevision: impersonateSpatial.definition.revision,
          expectedCurrentLocationId: "lifecycle_world",
          commandId: "roleplay-impersonate-to-harbor",
        },
      },
    });
    assert.equal(impersonateGeneration.statusCode, 200, impersonateGeneration.body);
    assert.match(impersonateGeneration.body, /spatial_transition_committed/u);
    assert.doesNotMatch(impersonateGeneration.body, /spatial_transition_rejected/u);
    const movedImpersonateSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(movedImpersonateSpatial.currentLocationId, "lifecycle_harbor");
    const impersonateMessages = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/messages`,
    })) as Array<{ id: string; role: string; content: string; extra: unknown }>;
    assert.equal(impersonateMessages.length, 2);
    const impersonatedUserMessage = impersonateMessages.find((message) => message.role === "user");
    assert.ok(impersonatedUserMessage);
    assert.match(impersonatedUserMessage.content, /GAME_HISTORY_PROVIDER_RESPONSE/u);
    assert.doesNotMatch(
      impersonatedUserMessage.content,
      /\[spatial_(?:move|discover):/u,
      "Impersonated owner turns must not persist package-owned spatial directives in visible user text",
    );

    const providerRequestsBeforeRepeatedImpersonate = generationProviderRequestCount;
    const repeatedImpersonateGeneration = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: impersonateChat.id,
        connectionId: impersonateConnection.id,
        impersonate: true,
        userMessage: "Repeat the already committed move into Lifecycle Harbor.",
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
        pendingSpatialTransition: {
          destinationId: "lifecycle_harbor",
          expectedDefinitionRevision: impersonateSpatial.definition.revision,
          expectedCurrentLocationId: "lifecycle_world",
          commandId: "roleplay-impersonate-to-harbor",
        },
      },
    });
    assert.equal(repeatedImpersonateGeneration.statusCode, 200, repeatedImpersonateGeneration.body);
    assert.match(repeatedImpersonateGeneration.body, /spatial_transition_committed/u);
    assert.match(repeatedImpersonateGeneration.body, /message_saved/u);
    assert.match(repeatedImpersonateGeneration.body, /content_replace/u);
    assert.doesNotMatch(repeatedImpersonateGeneration.body, /spatial_transition_rejected/u);
    assert.doesNotMatch(repeatedImpersonateGeneration.body, /"type":"error"/u);
    assert.equal(generationProviderRequestCount, providerRequestsBeforeRepeatedImpersonate);
    const repeatedImpersonateEvents = repeatedImpersonateGeneration.body
      .split("\n\n")
      .filter((event) => event.startsWith("data: "))
      .map((event) => JSON.parse(event.slice("data: ".length)) as { type: string; data: unknown });
    const authoritativeReplacement = repeatedImpersonateEvents.find((event) => event.type === "content_replace");
    assert.equal(authoritativeReplacement?.data, impersonatedUserMessage.content);
    const afterRepeatedImpersonateMessages = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/messages`,
    })) as Array<{ id: string; role: string; content: string; extra: unknown }>;
    assert.equal(afterRepeatedImpersonateMessages.length, impersonateMessages.length);
    const recoveredUserMessage = afterRepeatedImpersonateMessages.find(
      (message) => message.id === impersonatedUserMessage.id,
    );
    assert.ok(recoveredUserMessage);
    assert.equal(recoveredUserMessage.content, impersonatedUserMessage.content);
    assert.doesNotMatch(recoveredUserMessage.content, /RETRY_PROVIDER_RESPONSE_SHOULD_NOT_PERSIST/u);
    assert.deepEqual(recoveredUserMessage.extra, impersonatedUserMessage.extra);

    generationProviderFailure = true;
    let failedImpersonateGeneration: Awaited<ReturnType<NonNullable<typeof app>["inject"]>>;
    try {
      failedImpersonateGeneration = await app.inject({
        method: "POST",
        url: "/api/generate",
        headers: csrfHeaders,
        payload: {
          chatId: impersonateChat.id,
          connectionId: impersonateConnection.id,
          impersonate: true,
          userMessage: "Try to return to Lifecycle World.",
          streaming: false,
          skipPresenceDelay: true,
          musicPlayerEnabled: false,
          pendingSpatialTransition: {
            destinationId: "lifecycle_world",
            expectedDefinitionRevision: impersonateSpatial.definition.revision,
            expectedCurrentLocationId: "lifecycle_harbor",
            commandId: "failed-roleplay-impersonate-to-world",
          },
        },
      });
    } finally {
      generationProviderFailure = false;
    }
    assert.equal(failedImpersonateGeneration.statusCode, 200, failedImpersonateGeneration.body);
    assert.doesNotMatch(failedImpersonateGeneration.body, /spatial_transition_committed/u);
    assert.doesNotMatch(failedImpersonateGeneration.body, /spatial_transition_rejected/u);
    const afterFailedImpersonateMessages = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/messages`,
    })) as Array<{ id: string }>;
    assert.equal(afterFailedImpersonateMessages.length, impersonateMessages.length);
    const afterFailedImpersonateSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(afterFailedImpersonateSpatial.currentLocationId, "lifecycle_harbor");

    const staleImpersonateGeneration = await app.inject({
      method: "POST",
      url: "/api/generate",
      headers: csrfHeaders,
      payload: {
        chatId: impersonateChat.id,
        connectionId: impersonateConnection.id,
        impersonate: true,
        userMessage: "Attempt a stale move.",
        streaming: false,
        skipPresenceDelay: true,
        musicPlayerEnabled: false,
        pendingSpatialTransition: {
          destinationId: "lifecycle_world",
          expectedDefinitionRevision: impersonateSpatial.definition.revision,
          expectedCurrentLocationId: "lifecycle_world",
          commandId: "stale-roleplay-impersonate-to-world",
        },
      },
    });
    assert.equal(staleImpersonateGeneration.statusCode, 200, staleImpersonateGeneration.body);
    assert.match(staleImpersonateGeneration.body, /spatial_transition_rejected/u);
    assert.match(staleImpersonateGeneration.body, /spatial_transition_stale_location/u);
    const afterStaleImpersonateMessages = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${impersonateChat.id}/messages`,
    })) as Array<{ id: string }>;
    assert.equal(afterStaleImpersonateMessages.length, impersonateMessages.length);

    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/chats/${impersonateChat.id}?force=true`,
        headers: csrfHeaders,
      },
      204,
    );
    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/connections/${impersonateConnection.id}`,
        headers: csrfHeaders,
      },
      204,
    );

    const upgradedBranchSpatial = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${branch.id}/spatial-context`,
    })) as {
      currentLocationId: string;
      definition: {
        revision: number;
        locations: Array<{
          id: string;
          links: Array<{ targetId: string; label?: string; bidirectional: boolean; state: string }>;
        }>;
      };
      hierarchyProfile: {
        showConnections: boolean;
        linkPresentations: Record<string, { color?: string; lineStyle?: "solid" | "dashed" | "dotted" }>;
      };
      locationDeletionProtections: Array<{
        locationId: string;
        historySnapshotCount: number;
        gameMapBindingCount: number;
      }>;
      warnings: Array<{ code: string; message: string; locationId?: string }>;
    };
    assert.ok(
      upgradedBranchSpatial.warnings.some(
        (warning) =>
          warning.code === "lorebook_entry_missing" &&
          warning.locationId === "lifecycle_harbor" &&
          warning.message ===
            "“Lifecycle Harbor” links to a lore entry that was deleted or is unavailable. Open Linked lore for this location and detach the missing entry, or restore/import its lorebook.",
      ),
      "The updated artifact must identify the active location without exposing its opaque missing lore ID",
    );
    assert.equal(
      upgradedBranchSpatial.warnings.some(
        (warning) =>
          warning.code === "lorebook_entry_missing" &&
          warning.locationId === "lifecycle_archived_region",
      ),
      false,
      "The updated artifact must ignore missing lore links retained only on archived locations",
    );

    const temporaryArchivedLocation = {
      id: "lifecycle_temporary_archive",
      parentId: null,
      name: "Temporary Archived Location",
      kind: "place",
      description: "An accidental location that has never appeared in message history.",
      childPresentation: "list",
      links: [],
      lorebookEntryIds: [],
      status: "archived",
      sortOrder: 99,
    };
    const branchWithTemporaryArchive = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${branch.id}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: upgradedBranchSpatial.definition.revision,
        expectedCurrentLocationId: upgradedBranchSpatial.currentLocationId,
        definition: {
          ...upgradedBranchSpatial.definition,
          locations: [...upgradedBranchSpatial.definition.locations, temporaryArchivedLocation],
        },
        hierarchyProfile: upgradedBranchSpatial.hierarchyProfile,
      },
    })) as typeof upgradedBranchSpatial;
    assert.ok(
      branchWithTemporaryArchive.locationDeletionProtections.some(
        (protection: { locationId: string; historySnapshotCount: number }) =>
          protection.locationId === "lifecycle_world" && protection.historySnapshotCount > 0,
      ),
      "The editor must receive per-location history protections",
    );

    const branchAfterSafeDeletion = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${branch.id}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: branchWithTemporaryArchive.definition.revision,
        expectedCurrentLocationId: branchWithTemporaryArchive.currentLocationId,
        definition: {
          ...branchWithTemporaryArchive.definition,
          locations: branchWithTemporaryArchive.definition.locations.filter(
            (location) => location.id !== temporaryArchivedLocation.id,
          ),
        },
        hierarchyProfile: branchWithTemporaryArchive.hierarchyProfile,
      },
    })) as typeof upgradedBranchSpatial;
    assert.equal(
      branchAfterSafeDeletion.definition.locations.some((location) => location.id === temporaryArchivedLocation.id),
      false,
      "An archived location with no history or bindings must be permanently removable",
    );

    const protectedHistoryRemoval = (await expectJson(
      app,
      {
        method: "PUT",
        url: `/api/chats/${branch.id}/spatial-context`,
        headers: csrfHeaders,
        payload: {
          expectedRevision: branchAfterSafeDeletion.definition.revision,
          expectedCurrentLocationId: branchAfterSafeDeletion.currentLocationId,
          definition: {
            ...branchAfterSafeDeletion.definition,
            locations: branchAfterSafeDeletion.definition.locations
              .filter((location) => location.id !== "lifecycle_harbor")
              .map((location) => ({
                ...location,
                links: location.links.filter((link) => link.targetId !== "lifecycle_harbor"),
              })),
          },
          hierarchyProfile: branchAfterSafeDeletion.hierarchyProfile,
        },
      },
      409,
    )) as { code: string; error: string };
    assert.equal(protectedHistoryRemoval.code, "spatial_history_location_removal_forbidden");
    assert.match(protectedHistoryRemoval.error, /historical message/u);

    const presentationKey = "lifecycle_harbor|lifecycle_level_5";
    const styledBranch = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${branch.id}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: branchAfterSafeDeletion.definition.revision,
        expectedCurrentLocationId: branchAfterSafeDeletion.currentLocationId,
        definition: {
          ...branchAfterSafeDeletion.definition,
          locations: branchAfterSafeDeletion.definition.locations.map((location) =>
            location.id === "lifecycle_harbor"
              ? {
                  ...location,
                  links: [
                    ...location.links,
                    {
                      targetId: "lifecycle_level_5",
                      label: "Lantern walk",
                      bidirectional: true,
                      state: "available",
                    },
                  ],
                }
              : location,
          ),
        },
        hierarchyProfile: {
          ...branchAfterSafeDeletion.hierarchyProfile,
          showConnections: false,
          linkPresentations: {
            ...branchAfterSafeDeletion.hierarchyProfile.linkPresentations,
            [presentationKey]: { color: "#22C55E", lineStyle: "dotted" },
          },
        },
      },
    })) as {
      definition: { locations: Array<{ id: string; links: Array<{ targetId: string; label?: string }> }> };
      hierarchyProfile: {
        showConnections: boolean;
        linkPresentations: Record<string, { color?: string; lineStyle?: "solid" | "dashed" | "dotted" }>;
      };
    };
    assert.equal(
      styledBranch.definition.locations
        .find((location) => location.id === "lifecycle_harbor")
        ?.links.find((link) => link.targetId === "lifecycle_level_5")?.label,
      "Lantern walk",
    );
    assert.deepEqual(styledBranch.hierarchyProfile.linkPresentations[presentationKey], {
      color: "#22C55E",
      lineStyle: "dotted",
    });
    assert.equal(styledBranch.hierarchyProfile.showConnections, false);

    const upgradedSource = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/spatial-context`,
    })) as {
      currentLocationId: string;
      definition: {
        revision: number;
        locations: Array<{
          id: string;
          links: Array<{ targetId: string; label?: string; bidirectional: boolean; state: string }>;
        }>;
      };
      hierarchyProfile: {
        showConnections: boolean;
        linkPresentations: Record<string, { color?: string; lineStyle?: "solid" | "dashed" | "dotted" }>;
      };
    };
    const messagesBeforeCorrection = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/messages`,
    })) as Array<{ id: string; content: string }>;
    const assistantContentBeforeCorrection = messagesBeforeCorrection.find(
      (message) => message.id === assistantAtHarbor.id,
    )?.content;
    assert.ok(assistantContentBeforeCorrection);
    const stalePresentationKey = "lifecycle_harbor|missing-location";
    const correctedSource = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${chatId}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: upgradedSource.definition.revision,
        expectedCurrentLocationId: "lifecycle_harbor",
        replacementCurrentLocationId: "lifecycle_world",
        definition: {
          ...upgradedSource.definition,
          locations: upgradedSource.definition.locations.map((location) =>
            location.id === "lifecycle_harbor"
              ? {
                  ...location,
                  links: [
                    ...location.links,
                    {
                      targetId: "lifecycle_level_5",
                      label: "Lantern walk",
                      bidirectional: true,
                      state: "available",
                    },
                  ],
                }
              : location,
          ),
        },
        hierarchyProfile: {
          ...upgradedSource.hierarchyProfile,
          showConnections: false,
          linkPresentations: {
            ...upgradedSource.hierarchyProfile.linkPresentations,
            [presentationKey]: { color: "#22C55E", lineStyle: "dotted" },
            [stalePresentationKey]: { color: "#EF4444", lineStyle: "solid" },
          },
        },
      },
    })) as {
      currentLocationId: string;
      definition: { revision: number };
      hierarchyProfile: {
        showConnections: boolean;
        linkPresentations: Record<string, { color?: string; lineStyle?: "solid" | "dashed" | "dotted" }>;
      };
    };
    assert.equal(
      correctedSource.currentLocationId,
      "lifecycle_world",
      "A saved map edit must support an explicit administrative current-location correction",
    );
    assert.equal(correctedSource.definition.revision, upgradedSource.definition.revision + 1);
    assert.equal(correctedSource.hierarchyProfile.showConnections, false);
    assert.deepEqual(correctedSource.hierarchyProfile.linkPresentations[presentationKey], {
      color: "#22C55E",
      lineStyle: "dotted",
    });
    assert.equal(
      correctedSource.hierarchyProfile.linkPresentations[stalePresentationKey],
      undefined,
      "Profile normalization must discard presentation metadata for links with missing endpoints",
    );
    const correctedMessages = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/messages`,
    })) as Array<{ id: string; content: string }>;
    assert.equal(
      correctedMessages.find((message) => message.id === assistantAtHarbor.id)?.content,
      assistantContentBeforeCorrection,
      "Correcting the current visible state must not rewrite message prose",
    );
    const sharedArtwork = await createGlobalGalleryStorage(app.db).createImage({
      filePath: "global/lifecycle-shared-art.png",
    });
    assert.ok(sharedArtwork);
    const sharedArtworkReference = `global-gallery:${sharedArtwork.id}`;
    const templateWithArtwork = (await expectJson(
      app,
      {
        method: "POST",
        url: "/api/chats/spatial-context/templates",
        headers: csrfHeaders,
        payload: {
          name: "Lifecycle shared-art template",
          description: "Proves account-wide artwork survives reusable template storage.",
          definition: {
            ...definition,
            locations: definition.locations.map((location, index) =>
              index === 0
                ? {
                    ...location,
                    childPresentation: "map",
                    referenceImageId: sharedArtworkReference,
                    useReferenceImage: true,
                    mapBackgroundImageId: sharedArtworkReference,
                    mapBackgroundPosition: { x: 24, y: 76 },
                  }
                : index === 1
                  ? {
                      ...location,
                      referenceImageId: "chat-only-lifecycle-art",
                      useReferenceImage: true,
                      mapBackgroundImageId: "chat-only-lifecycle-art",
                      mapBackgroundPosition: { x: 50, y: 50 },
                    }
                  : location,
            ),
          },
          hierarchyProfile: createdRouteDraft.hierarchyProfile,
        },
      },
      201,
    )) as {
      id: string;
      revision: number;
      data: {
        definition: {
          locations: Array<{
            id: string;
            referenceImageId?: string;
            useReferenceImage?: boolean;
            mapBackgroundImageId?: string;
            mapBackgroundPosition?: { x: number; y: number };
          }>;
        };
      };
    };
    const sharedTemplateLocation = templateWithArtwork.data.definition.locations.find(
      (location) => location.id === "lifecycle_world",
    );
    assert.equal(sharedTemplateLocation?.referenceImageId, sharedArtworkReference);
    assert.equal(sharedTemplateLocation?.useReferenceImage, true);
    assert.equal(sharedTemplateLocation?.mapBackgroundImageId, sharedArtworkReference);
    assert.deepEqual(sharedTemplateLocation?.mapBackgroundPosition, { x: 24, y: 76 });
    const chatOnlyTemplateLocation = templateWithArtwork.data.definition.locations.find(
      (location) => location.id === "lifecycle_harbor",
    );
    assert.equal(chatOnlyTemplateLocation?.referenceImageId, undefined);
    assert.equal(chatOnlyTemplateLocation?.useReferenceImage, undefined);
    assert.equal(chatOnlyTemplateLocation?.mapBackgroundImageId, undefined);
    assert.equal(chatOnlyTemplateLocation?.mapBackgroundPosition, undefined);
    await expectJson(
      app,
      {
        method: "DELETE",
        url: `/api/chats/spatial-context/templates/${templateWithArtwork.id}`,
        headers: csrfHeaders,
        payload: { expectedRevision: templateWithArtwork.revision },
      },
      204,
    );
    await verifySharedWorldLifecycle();
    const narratedPrompt = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/peek-prompt`,
      headers: csrfHeaders,
      payload: {},
    })) as { messages: Array<{ content: string }> };
    const narratedPromptText = narratedPrompt.messages.map((message) => message.content).join("\n");
    assert.match(narratedPromptText, /\[spatial_move: destination_id=/u);
    assert.match(narratedPromptText, /Use the latest user message as the authority for map changes/u);
    assert.match(narratedPromptText, /We follow her into the outdoor section/u);
    assert.match(narratedPromptText, /We discover a hidden room/u);
    assert.match(narratedPromptText, /your own narration alone never authorizes either command/u);
    assert.match(narratedPromptText, /NPC-only movement/u);
    assert.match(
      narratedPromptText,
      /Lifecycle World > Level 5 — Prism Caverns \[lifecycle_level_5\]/u,
    );

    const narratedMoveMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "The story arrives at Lifecycle Harbor." },
    })) as { id: string };
    const narratedMoveSnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: narratedMoveMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      directive: { type: "move", destinationId: "lifecycle_harbor" },
    });
    assert.equal(narratedMoveSnapshot?.currentLocationId, "lifecycle_harbor");
    assert.match(narratedMoveSnapshot?.transitionCommandId ?? "", /^assistant:/u);

    const invalidMoveMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "The story only mentions an unreachable place." },
    })) as { id: string };
    const invalidMoveSnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: invalidMoveMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      directive: { type: "move", destinationId: "missing_location" },
    });
    assert.equal(invalidMoveSnapshot?.currentLocationId, "lifecycle_harbor");
    assert.equal(invalidMoveSnapshot?.transitionCommandId, null);

    const knownLevelMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "A secret route reaches Level 5 by another name." },
    })) as { id: string };
    const knownLevelSnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: knownLevelMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      directive: {
        type: "discover",
        name: "Level 5 — The Hollow Foundry",
        relation: "enter",
        description: "A second description for an already mapped level.",
      },
    });
    assert.equal(knownLevelSnapshot?.currentLocationId, "lifecycle_level_5");
    assert.match(knownLevelSnapshot?.transitionCommandId ?? "", /^assistant:/u);
    const routedKnownLevel = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${branch.id}/spatial-context`,
    })) as {
      definition: {
        revision: number;
        locations: Array<{
          id: string;
          name: string;
          links: Array<{ targetId: string; state: string }>;
        }>;
      };
    };
    assert.equal(
      routedKnownLevel.definition.locations.filter((location) => location.name.startsWith("Level 5")).length,
      1,
    );
    assert.ok(
      routedKnownLevel.definition.locations
        .find((location) => location.id === "lifecycle_harbor")
        ?.links.some((link) => link.targetId === "lifecycle_level_5" && link.state === "available"),
    );
    assert.equal(
      routedKnownLevel.definition.revision,
      knownLevelSnapshot?.definitionRevision,
      "Matching a reachable known location must move without editing topology",
    );

    const returnToHarborMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "The secret route returns to Lifecycle Harbor." },
    })) as { id: string };
    const returnToHarborSnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: returnToHarborMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      directive: { type: "move", destinationId: "lifecycle_harbor" },
    });
    assert.equal(returnToHarborSnapshot?.currentLocationId, "lifecycle_harbor");

    const deckAMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "The hidden lift arrives at Deck A." },
    })) as { id: string };
    const deckASnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: deckAMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      directive: {
        type: "discover",
        name: "Deck A",
        relation: "link",
        direction: "outgoing",
        description: "A lettered deck that is distinct from the generic Deck location.",
      },
    });
    assert.equal(deckASnapshot?.currentLocationId, "lifecycle_harbor");
    assert.equal(deckASnapshot?.transitionCommandId, null);
    const afterKnownDeckDiscovery = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${branch.id}/spatial-context`,
    })) as {
      definition: { locations: Array<{ id: string; links: Array<{ targetId: string }> }> };
    };
    assert.equal(
      afterKnownDeckDiscovery.definition.locations
        .find((location) => location.id === "lifecycle_harbor")
        ?.links.some((link) => link.targetId === "lifecycle_deck_a"),
      false,
      "Matching an unreachable known location must not synthesize a direct link",
    );

    const deckReturnMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "The lift returns to Lifecycle Harbor." },
    })) as { id: string };
    const deckReturnSnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: deckReturnMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      directive: { type: "move", destinationId: "lifecycle_harbor" },
    });
    assert.equal(deckReturnSnapshot?.currentLocationId, "lifecycle_harbor");

    const discoveryMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "A hidden chart room becomes a lasting destination." },
    })) as { id: string };
    const discoverySnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: discoveryMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      directive: {
        type: "discover",
        name: "Hidden Chart Room",
        relation: "enter",
        description: "A chart room concealed behind the harbor office.",
      },
    });
    assert.ok(discoverySnapshot?.currentLocationId?.startsWith("loc_"));
    const discoveredBranch = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${branch.id}/spatial-context`,
    })) as {
      currentLocationId: string;
      definition: { locations: Array<{ id: string; parentId: string | null; name: string }> };
    };
    assert.equal(discoveredBranch.currentLocationId, discoverySnapshot?.currentLocationId);
    const discoveredLocation = discoveredBranch.definition.locations.find(
      (location) => location.id === discoverySnapshot?.currentLocationId,
    );
    assert.equal(discoveredLocation?.parentId, "lifecycle_harbor");
    assert.equal(discoveredLocation?.name, "Hidden Chart Room");

    const guidanceMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${branch.id}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "The tracker identifies Lifecycle Harbor." },
    })) as { id: string };
    const guidanceSnapshot = await materializeAssistantSpatialState({
      chatId: branch.id,
      messageId: guidanceMessage.id,
      swipeIndex: 0,
      regenerate: false,
      continuation: false,
      locationGuidance: "Lifecycle Harbor",
    });
    assert.equal(guidanceSnapshot?.currentLocationId, "lifecycle_harbor");
    assert.match(guidanceSnapshot?.transitionCommandId ?? "", /^assistant:/u);

    const startOverChat = (await expectJson(app, {
      method: "POST",
      url: "/api/chats",
      headers: csrfHeaders,
      payload: {
        name: "Hierarchical Maps start-over lifecycle fixture",
        mode: "roleplay",
        characterIds: [],
      },
    })) as { id: string };
    const startOverChatId = startOverChat.id;
    await expectJson(app, {
      method: "PATCH",
      url: `/api/chats/${startOverChatId}/metadata`,
      headers: csrfHeaders,
      payload: { enableAgents: true, activeAgentIds: ["hierarchical-maps"] },
    });
    const startOverMessage = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${startOverChatId}/messages`,
      headers: csrfHeaders,
      payload: { role: "assistant", content: "The old breadcrumb remains in the transcript." },
    })) as { id: string };
    const startOverInitial = (await expectJson(app, {
      method: "PUT",
      url: `/api/chats/${startOverChatId}/spatial-context`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: 0,
        expectedCurrentLocationId: null,
        definition,
      },
    })) as { definition: { revision: number }; currentLocationId: string; hasCommittedSpatialHistory: boolean };
    assert.equal(startOverInitial.hasCommittedSpatialHistory, true);
    const startOverDefinition = {
      ...definition,
      startingLocationId: "fresh_world",
      locations: [
        {
          ...definition.locations[0],
          id: "fresh_world",
          name: "Fresh world",
          links: [],
        },
      ],
    };
    const missingStartOverConfirmation = (await expectJson(
      app,
      {
        method: "POST",
        url: `/api/chats/${startOverChatId}/spatial-context/start-over`,
        headers: csrfHeaders,
        payload: {
          expectedRevision: startOverInitial.definition.revision,
          expectedCurrentLocationId: startOverInitial.currentLocationId,
          replacementCurrentLocationId: "fresh_world",
          definition: startOverDefinition,
        },
      },
      400,
    )) as { code: string };
    assert.equal(missingStartOverConfirmation.code, "spatial_start_over_confirmation_required");
    const messagesBeforeStartOver = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${startOverChatId}/messages`,
    })) as Array<{ id: string }>;
    const startOverSaved = (await expectJson(app, {
      method: "POST",
      url: `/api/chats/${startOverChatId}/spatial-context/start-over`,
      headers: csrfHeaders,
      payload: {
        expectedRevision: startOverInitial.definition.revision,
        expectedCurrentLocationId: startOverInitial.currentLocationId,
        replacementCurrentLocationId: "fresh_world",
        breakHistoryContinuity: true,
        definition: startOverDefinition,
      },
    })) as {
      currentLocationId: string;
      hasCommittedSpatialHistory: boolean;
      definition: { startingLocationId: string; locations: Array<{ id: string; status: string }> };
    };
    assert.equal(startOverSaved.currentLocationId, "fresh_world");
    assert.equal(startOverSaved.definition.startingLocationId, "fresh_world");
    assert.deepEqual(
      startOverSaved.definition.locations.map(({ id, status }) => ({ id, status })),
      [{ id: "fresh_world", status: "active" }],
    );
    assert.equal(startOverSaved.hasCommittedSpatialHistory, true);
    const messagesAfterStartOver = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${startOverChatId}/messages`,
    })) as Array<{ id: string }>;
    assert.deepEqual(
      messagesAfterStartOver.map((message) => message.id),
      messagesBeforeStartOver.map((message) => message.id),
      "Starting over must retain old messages while breaking their map continuity",
    );
    assert.ok(messagesAfterStartOver.some((message) => message.id === startOverMessage.id));

    for (const disposableChatId of [branch.id, imported.chatId, startOverChatId]) {
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
    assert.equal(restarted.currentLocationId, "lifecycle_world");
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
    assert.equal(reinstalled.version, "1.3.6");
    assert.equal(reinstalled.status, "restart-required");
    catalogOnline = false;
    app = await buildApp();
    const stateAfterReinstall = (await expectJson(app, {
      method: "GET",
      url: `/api/chats/${chatId}/spatial-context`,
    })) as { currentLocationId: string };
    assert.equal(stateAfterReinstall.currentLocationId, "lifecycle_world");

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
      hierarchyProfile: {
        showConnections: boolean;
        linkPresentations: Record<string, { color?: string; lineStyle?: "solid" | "dashed" | "dotted" }>;
      };
    };
    assert.equal(restoredState.currentLocationId, "lifecycle_world");
    assert.ok(
      restoredState.definition.locations.some(
        (location) => location.id === "lifecycle_harbor",
      ),
    );
    assert.equal(restoredState.hierarchyProfile.showConnections, false);
    assert.deepEqual(restoredState.hierarchyProfile.linkPresentations[presentationKey], {
      color: "#22C55E",
      lineStyle: "dotted",
    });
    assert.equal(restoredState.hierarchyProfile.linkPresentations[stalePresentationKey], undefined);

    const finalInstalled = await capabilityPackageManager.installed();
    assert.deepEqual(
      finalInstalled
        .filter((entry) => entry.id === "hierarchical-maps")
        .map((entry) => ({
          version: entry.version,
          status: entry.status,
          readiness: entry.readiness,
        })),
      [{ version: "1.3.6", status: "active", readiness: "ready" }],
    );

    console.info(
      "Hierarchical Maps exact-artifact lifecycle regression passed: update, shared template artwork, canonical shared worlds, private linked-chat drafts, publish/conflict/fork protection, AI-created connected route graphs, AI expansion links to existing siblings, owner-turn persistence, Roleplay /guided queue isolation and impersonate movement success/failure/stale rejection, live prompt parity, Roleplay/Game swipe/regeneration/continuation history, branch/delete/import/export/checkpoint preservation, reviewed Game reconciliation, offline restart, remove, reinstall, backup, and restore.",
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
