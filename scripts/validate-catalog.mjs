import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  CATALOG_ARTWORK_SIZE,
  catalogArtworkRelativePath,
  catalogArtworkUrl,
} from "./catalog-artwork.mjs";
import {
  LEGACY_CATALOG_MAJOR,
  assertManifestBuildProvenance,
  compareEngineVersions,
  createCatalogLanes,
  readCatalogFamily,
} from "./catalog-lanes.mjs";
import { assertHierarchicalMapsPrivateImportBoundary } from "./hierarchical-maps-boundary.mjs";
import { OFFICIAL_PACKAGE_GUIDANCE, withPackageActivationGuidance } from "./catalog-package-guidance.mjs";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const { catalog, catalogsByMajor, legacyCatalog } = await readCatalogFamily(repoRoot);
const MIN_ENGINE_VERSION = "2.3.0";
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.packages)) throw new Error("Invalid catalog envelope");
const expectedCatalogsByMajor = createCatalogLanes(catalog);
if (JSON.stringify([...catalogsByMajor.keys()].sort()) !== JSON.stringify([...expectedCatalogsByMajor.keys()].sort())) {
  throw new Error("Versioned catalog lane set does not match package Engine compatibility ranges");
}
for (const [major, expectedCatalog] of expectedCatalogsByMajor) {
  const actualCatalog = catalogsByMajor.get(major);
  if (JSON.stringify(actualCatalog) !== JSON.stringify(expectedCatalog)) {
    throw new Error(`catalog/v${major}/catalog.json does not match package Engine compatibility ranges`);
  }
}
if (JSON.stringify(legacyCatalog) !== JSON.stringify(catalogsByMajor.get(LEGACY_CATALOG_MAJOR))) {
  throw new Error(`catalog/catalog.json must remain an exact alias of catalog/v${LEGACY_CATALOG_MAJOR}/catalog.json`);
}
const hierarchicalMapsBoundary = await assertHierarchicalMapsPrivateImportBoundary();

const hierarchicalMapsOwnedSourcePaths = [
  "packages/server/src/routes/spatial-context.routes.ts",
  "packages/server/src/services/spatial-context",
  "packages/server/src/services/storage/spatial-context.storage.ts",
  "packages/client/src/features/spatial-context",
  "packages/client/src/hooks/use-spatial-context.ts",
  "packages/client/src/components/game/GameWorldMap.tsx",
];
for (const relativePath of hierarchicalMapsOwnedSourcePaths) {
  const packageOwnedPath = join(repoRoot, "packages/hierarchical-maps/src/engine", relativePath);
  const capturedEnginePath = join(repoRoot, "sources/engine", relativePath);
  if (!existsSync(packageOwnedPath)) {
    throw new Error(`Hierarchical Maps package source is missing: ${relativePath}`);
  }
  if (existsSync(capturedEnginePath)) {
    throw new Error(`Hierarchical Maps source must not be captured as generic Engine material: ${relativePath}`);
  }
}

const hierarchicalMapsClientSourceRoot = join(
  repoRoot,
  "packages/hierarchical-maps/src/engine/packages/client/src",
);
const forbiddenHierarchicalMapsPinkText =
  /text-(?:pink|rose|fuchsia)-|text-\[var\(--(?:primary|muted-foreground)\)\](?:\/\d+)?|#(?:d4acfb|d4adfc|7a64a0)\b/iu;
async function assertHierarchicalMapsUsesChromaText(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      await assertHierarchicalMapsUsesChromaText(entryPath);
      continue;
    }
    if (!entry.name.endsWith(".tsx")) continue;
    const contents = await readFile(entryPath, "utf8");
    if (forbiddenHierarchicalMapsPinkText.test(contents)) {
      throw new Error(
        `Hierarchical Maps text must use the configured chroma accent instead of pink theme defaults: ${entryPath}`,
      );
    }
  }
}
await assertHierarchicalMapsUsesChromaText(hierarchicalMapsClientSourceRoot);

const forbiddenAboutMeKeeperPaths = [
  "packages/about-me-keeper/manifest.json",
  "packages/about-me-keeper/agents.json",
  "artifacts/about-me-keeper-1.0.0.zip",
  "sources/engine/packages/shared/dist/features/agents/about-me-keeper/manifest.js",
];
for (const relativePath of forbiddenAboutMeKeeperPaths) {
  if (existsSync(join(repoRoot, relativePath))) {
    throw new Error(`About Me is a core Conversation feature and must not ship as an agent package: ${relativePath}`);
  }
}
const snapshotAgentRegistry = await readFile(
  join(repoRoot, "sources/engine/packages/shared/dist/features/agents/agent-registry.generated.js"),
  "utf8",
);
if (snapshotAgentRegistry.includes("about-me-keeper") || snapshotAgentRegistry.includes("aboutMeKeeper")) {
  throw new Error("The packaged agent registry must not reference the built-in About Me feature");
}

const aboutMeKeeperMarkers = ["about-me-keeper", "About Me Keeper", "aboutMeKeeper"];
const textExtensions = new Set([".js", ".json", ".md", ".mjs", ".ts", ".tsx"]);
async function assertNoAboutMeKeeperReferences(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      await assertNoAboutMeKeeperReferences(entryPath);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;
    const contents = await readFile(entryPath, "utf8");
    if (aboutMeKeeperMarkers.some((marker) => contents.includes(marker))) {
      throw new Error(`About Me is a core Conversation feature and must not be bundled as an agent: ${entryPath}`);
    }
  }
}
for (const relativePath of ["packages", "sources/engine", "catalog"]) {
  await assertNoAboutMeKeeperReferences(join(repoRoot, relativePath));
}
const readme = await readFile(join(repoRoot, "README.md"), "utf8");
if (aboutMeKeeperMarkers.some((marker) => readme.includes(marker))) {
  throw new Error("README.md must not describe About Me as an agent package");
}

const ids = new Set();
const agentDefinitionIds = new Set();
const expectedCategories = new Map([
  ["card-evolution-auditor", "writer"],
  ["hierarchical-maps", "tracker"],
]);

async function validateTurnGameRuntime(manifest, packageRoot) {
  const serverPath = join(packageRoot, manifest.entrypoints.server);
  const runtime = await import(`${pathToFileURL(serverPath).href}?validation=${Date.now()}`);
  if (typeof runtime.activate !== "function") {
    throw new Error(`${manifest.id} server runtime does not export activate()`);
  }

  const gameEngines = new Map();
  const conversationCommands = new Map();
  const unregister = (registry, key) => {
    if (registry.has(key)) throw new Error(`${manifest.id} registered duplicate runtime contribution: ${key}`);
    return () => registry.delete(key);
  };
  const api = {
    registerTurnGameEngine(engine) {
      if (!engine?.gameType) throw new Error(`${manifest.id} registered an invalid turn-game engine`);
      const cleanup = unregister(gameEngines, engine.gameType);
      gameEngines.set(engine.gameType, engine);
      return cleanup;
    },
    registerConversationCommand(command) {
      if (!command?.commandType) throw new Error(`${manifest.id} registered an invalid Conversation command`);
      const cleanup = unregister(conversationCommands, command.commandType);
      conversationCommands.set(command.commandType, command);
      return cleanup;
    },
  };

  const cleanup = await runtime.activate({ api });
  if (typeof cleanup !== "function") throw new Error(`${manifest.id} activate() did not return cleanup()`);

  const commandType = manifest.id.replaceAll("-", "_");
  const engine = gameEngines.get(manifest.id);
  const command = conversationCommands.get(commandType);
  if (gameEngines.size !== 1 || !engine) {
    throw new Error(`${manifest.id} did not register its turn-game engine`);
  }
  if (conversationCommands.size !== 1 || !command || !command.tags?.includes(commandType)) {
    throw new Error(`${manifest.id} did not register its Conversation command`);
  }

  const seats = [
    { seatId: "human", displayName: "Human", kind: "human" },
    { seatId: "character", displayName: "Character", kind: "character" },
  ];
  const state = engine.setup(engine.defaultConfig(), seats, 17);
  if (!state || typeof state !== "object") throw new Error(`${manifest.id} could not create initial game state`);
  const currentSeatId = engine.currentSeat(state);
  if (currentSeatId !== null && !seats.some((seat) => seat.seatId === currentSeatId)) {
    throw new Error(`${manifest.id} returned an unknown current seat`);
  }
  if (currentSeatId !== null && !Array.isArray(engine.legalMoves(state, currentSeatId))) {
    throw new Error(`${manifest.id} did not return legal moves for its opening state`);
  }
  if (!engine.publicView(state, "human") || !engine.spectatorSummary(state)) {
    throw new Error(`${manifest.id} could not render its opening state`);
  }

  await cleanup();
  if (gameEngines.size || conversationCommands.size) {
    throw new Error(`${manifest.id} cleanup left runtime contributions registered`);
  }
}

for (const entry of catalog.packages) {
  const { manifest, category, artifact, iconUrl, documentationUrl } = entry;
  if (!manifest?.id || ids.has(manifest.id)) throw new Error(`Duplicate or missing package id: ${manifest?.id}`);
  if (manifest.id === "about-me-keeper") {
    throw new Error("About Me is a core Conversation feature and must not appear in the agent catalog");
  }
  if (manifest.id === "hierarchical-maps") {
    if (manifest.schemaVersion !== 2) {
      throw new Error("Hierarchical Maps must use capability package manifest v2");
    }
    if (JSON.stringify(manifest.capabilityApi) !== JSON.stringify(hierarchicalMapsBoundary.capabilityApi)) {
      throw new Error("Hierarchical Maps capability API does not match engine-boundary.json");
    }
    if (JSON.stringify(manifest.builtAgainst) !== JSON.stringify(hierarchicalMapsBoundary.builtAgainst)) {
      throw new Error("Hierarchical Maps build provenance does not match engine-boundary.json");
    }
  }
  ids.add(manifest.id);
  const readmePackageLink = `](packages/${manifest.id}/manifest.json)`;
  if (!readme.includes(readmePackageLink)) {
    throw new Error(`README.md must list package ${manifest.id} in the official catalog`);
  }
  if (!manifest.engine?.min || !manifest.engine?.maxExclusive) {
    throw new Error(`${manifest.id} must declare an Engine compatibility range`);
  }
  if (compareEngineVersions(manifest.engine.min, MIN_ENGINE_VERSION) < 0) {
    throw new Error(`${manifest.id} cannot support Engine versions below ${MIN_ENGINE_VERSION}`);
  }
  if (compareEngineVersions(manifest.engine.maxExclusive, manifest.engine.min) <= 0) {
    throw new Error(`${manifest.id} Engine compatibility range must be increasing`);
  }
  assertManifestBuildProvenance(manifest);
  if (!OFFICIAL_PACKAGE_GUIDANCE[manifest.id]) {
    throw new Error(`Missing activation guidance and mode metadata for ${manifest.id}`);
  }
  if (manifest.description !== withPackageActivationGuidance(manifest.id, manifest.description)) {
    throw new Error(`Manifest description is missing activation guidance for ${manifest.id}`);
  }
  if (!["writer", "tracker", "misc"].includes(category)) {
    throw new Error(`Missing or invalid category for ${manifest.id}`);
  }
  const expectedCategory = expectedCategories.get(manifest.id);
  if (expectedCategory && category !== expectedCategory) {
    throw new Error(`Expected ${manifest.id} in ${expectedCategory}, found ${category}`);
  }
  if (!documentationUrl) throw new Error(`Missing documentation URL for ${manifest.id}`);
  if (iconUrl !== catalogArtworkUrl(manifest.id)) {
    throw new Error(`Missing or invalid catalog artwork URL for ${manifest.id}`);
  }
  const artworkPath = join(repoRoot, catalogArtworkRelativePath(manifest.id));
  const artwork = await readFile(artworkPath);
  const pngSignature = artwork.subarray(0, 8).toString("hex");
  if (pngSignature !== "89504e470d0a1a0a" || artwork.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`Catalog artwork for ${manifest.id} must be a valid PNG`);
  }
  const artworkWidth = artwork.readUInt32BE(16);
  const artworkHeight = artwork.readUInt32BE(20);
  if (artworkWidth !== CATALOG_ARTWORK_SIZE || artworkHeight !== CATALOG_ARTWORK_SIZE) {
    throw new Error(
      `Catalog artwork for ${manifest.id} must be ${CATALOG_ARTWORK_SIZE}x${CATALOG_ARTWORK_SIZE}, found ${artworkWidth}x${artworkHeight}`,
    );
  }
  const packageRoot = join(repoRoot, "packages", manifest.id);
  const sourceManifest = JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8"));
  if (JSON.stringify(sourceManifest) !== JSON.stringify(manifest)) {
    throw new Error(`Catalog manifest does not match packages/${manifest.id}/manifest.json`);
  }
  const artifactPath = join(repoRoot, "artifacts", basename(new URL(artifact.url).pathname));
  const archive = await readFile(artifactPath);
  if (archive.byteLength !== artifact.bytes) throw new Error(`Artifact size mismatch for ${manifest.id}`);
  if (createHash("sha256").update(archive).digest("hex") !== artifact.sha256) {
    throw new Error(`Artifact checksum mismatch for ${manifest.id}`);
  }
  const listed = spawnSync("unzip", ["-Z1", artifactPath], { encoding: "utf8" });
  if (listed.status !== 0) throw new Error(listed.stderr || `Could not inspect ${manifest.id}`);
  const actualFiles = listed.stdout.trim().split("\n").filter(Boolean).sort();
  const declaredFiles = ["manifest.json", ...manifest.files.map((file) => file.path)].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(declaredFiles)) {
    throw new Error(`Artifact file list mismatch for ${manifest.id}`);
  }

  const archivedManifest = spawnSync("unzip", ["-p", artifactPath, "manifest.json"], {
    maxBuffer: 120 * 1024 * 1024,
  });
  if (archivedManifest.status !== 0) {
    throw new Error(archivedManifest.stderr?.toString() || `Could not read archived manifest for ${manifest.id}`);
  }
  if (JSON.stringify(JSON.parse(archivedManifest.stdout.toString("utf8"))) !== JSON.stringify(manifest)) {
    throw new Error(`Archived manifest does not match the catalog for ${manifest.id}`);
  }

  const declaredPaths = new Set(manifest.files.map((file) => file.path));
  for (const entrypoint of Object.values(manifest.entrypoints)) {
    if (entrypoint && !declaredPaths.has(entrypoint)) {
      throw new Error(`Undeclared entrypoint ${entrypoint} for ${manifest.id}`);
    }
  }
  for (const declared of manifest.files) {
    const sourcePayload = await readFile(join(packageRoot, declared.path));
    const archivedPayload = spawnSync("unzip", ["-p", artifactPath, declared.path], {
      maxBuffer: 120 * 1024 * 1024,
    });
    if (archivedPayload.status !== 0) {
      throw new Error(archivedPayload.stderr?.toString() || `Could not read ${declared.path} from ${manifest.id}`);
    }
    for (const [location, payload] of [
      ["source", sourcePayload],
      ["artifact", archivedPayload.stdout],
    ]) {
      if (payload.byteLength !== declared.bytes) {
        throw new Error(`${manifest.id} ${declared.path} ${location} size does not match its manifest`);
      }
      if (createHash("sha256").update(payload).digest("hex") !== declared.sha256) {
        throw new Error(`${manifest.id} ${declared.path} ${location} hash does not match its manifest`);
      }
    }
    if (!sourcePayload.equals(archivedPayload.stdout)) {
      throw new Error(`${manifest.id} ${declared.path} differs between package source and artifact`);
    }
  }

  for (const entrypoint of [manifest.entrypoints.server, manifest.entrypoints.client].filter(Boolean)) {
    const syntax = spawnSync(process.execPath, ["--check", join(packageRoot, entrypoint)], { encoding: "utf8" });
    if (syntax.status !== 0) {
      throw new Error(syntax.stderr || syntax.stdout || `Invalid ${entrypoint} syntax for ${manifest.id}`);
    }
  }
  if (manifest.kind.includes("turn-game")) await validateTurnGameRuntime(manifest, packageRoot);

  if (!manifest.entrypoints.agents) throw new Error(`Missing agent definition entrypoint for ${manifest.id}`);
  const agentDefinitions = JSON.parse(
    await readFile(join(packageRoot, manifest.entrypoints.agents), "utf8"),
  );
  if (!Array.isArray(agentDefinitions) || agentDefinitions.length === 0) {
    throw new Error(`Missing agent definitions for ${manifest.id}`);
  }
  if (!agentDefinitions.some((definition) => definition.id === manifest.id)) {
    throw new Error(`Package ${manifest.id} does not define its matching agent id`);
  }
  const matchingDefinitions = agentDefinitions.filter((definition) => definition.id === manifest.id);
  if (matchingDefinitions.some((definition) => definition.description !== manifest.description)) {
    throw new Error(`Package ${manifest.id} agent description does not match its manifest description`);
  }
  for (const definition of agentDefinitions) {
    if (!definition?.id || agentDefinitionIds.has(definition.id)) {
      throw new Error(`Duplicate or missing agent definition id: ${definition?.id}`);
    }
    if (!["writer", "tracker", "misc"].includes(definition.category)) {
      throw new Error(`Invalid agent category for ${definition.id}`);
    }
    if (typeof definition.defaultPromptTemplate !== "string") {
      throw new Error(`Missing default prompt template for ${definition.id}`);
    }
    agentDefinitionIds.add(definition.id);
  }

  const hasServer = Boolean(manifest.entrypoints.server);
  const hasClient = Boolean(manifest.entrypoints.client);
  if (hasServer !== Boolean(manifest.restartRequired)) {
    throw new Error(`${manifest.id} restart requirement does not match its server runtime`);
  }
  if (hasClient && !manifest.permissions.includes("ui")) {
    throw new Error(`${manifest.id} client runtime is missing the ui permission`);
  }
  if (manifest.kind.includes("turn-game")) {
    if (!hasServer || !hasClient || !manifest.contributions?.conversationGame) {
      throw new Error(`${manifest.id} does not provide the complete Conversation game contract`);
    }
  }
  if (manifest.kind.includes("maps")) {
    if (!manifest.permissions.includes("routes")) throw new Error(`${manifest.id} is missing the routes permission`);
    const slots = new Set(manifest.contributions?.slots ?? []);
    for (const slot of ["chat-settings", "spatial-workspace", "chat-runtime", "game-world-map"]) {
      if (!slots.has(slot)) throw new Error(`${manifest.id} is missing the ${slot} contribution`);
    }
    const clientSource = await readFile(join(packageRoot, manifest.entrypoints.client), "utf8");
    if (forbiddenHierarchicalMapsPinkText.test(clientSource)) {
      throw new Error(`${manifest.id} generated client still contains pink-default text styling`);
    }
    if (/\bReact\.createElement\b/u.test(clientSource)) {
      throw new Error(`${manifest.id} client runtime references an undefined classic React JSX global`);
    }
    if (/\bcreatePortal\s*\(/u.test(clientSource)) {
      throw new Error(`${manifest.id} client runtime references an undefined createPortal global`);
    }
    if (!clientSource.includes("data-marinara-maps-workspace-overlay")) {
      throw new Error(`${manifest.id} client runtime is missing the viewport workspace overlay contract`);
    }
    if (!clientSource.includes("data-chat-floating-panel")) {
      throw new Error(`${manifest.id} client runtime is missing the chat floating panel contract`);
    }
    for (const marker of [
      "data-marinara-maps-workspace-styles",
      "data-marinara-maps-world-canvas",
      "data-marinara-maps-world-styles",
      "mari-maps-workspace-grid",
      "mari-maps-ai-grid",
    ]) {
      if (!clientSource.includes(marker)) {
        throw new Error(`${manifest.id} client runtime is missing the ${marker} layout contract`);
      }
    }
  }
  if (manifest.kind.includes("conversation-calls")) {
    if (!manifest.permissions.includes("routes")) throw new Error(`${manifest.id} is missing the routes permission`);
    const slots = new Set(manifest.contributions?.slots ?? []);
    for (const slot of ["conversation-toolbar", "conversation-surface", "chat-settings"]) {
      if (!slots.has(slot)) throw new Error(`${manifest.id} is missing the ${slot} contribution`);
    }
    if (manifest.entrypoints?.server) {
      const serverSource = await readFile(join(packageRoot, manifest.entrypoints.server), "utf8");
      if (serverSource.includes("I lost the thread for a second. Could you repeat that?")) {
        throw new Error(`${manifest.id} server runtime still contains the hardcoded generation fallback`);
      }
    }
    if (manifest.entrypoints?.client) {
      const clientSource = await readFile(join(packageRoot, manifest.entrypoints.client), "utf8");
      for (const marker of [
        "data-marinara-call-video-fit",
        "data-marinara-call-stage",
        "data-marinara-call-chat",
      ]) {
        if (!clientSource.includes(marker)) {
          throw new Error(`${manifest.id} client runtime is missing the ${marker} layout contract`);
        }
      }
    }
  }
}

const guidanceIds = Object.keys(OFFICIAL_PACKAGE_GUIDANCE).sort();
if (JSON.stringify(guidanceIds) !== JSON.stringify([...ids].sort())) {
  throw new Error("Official package activation guidance must cover exactly the downloadable catalog");
}

const agentOnly = catalog.packages.filter((entry) => !entry.manifest.entrypoints.server).length;
const features = catalog.packages.length - agentOnly;
if (catalog.packages.length !== 29 || agentOnly !== 21 || features !== 8) {
  throw new Error(`Expected 21 agents and 8 features, found ${agentOnly} and ${features}`);
}
console.log(`Catalog valid: ${catalog.packages.length} packages (${agentOnly} agents, ${features} features).`);
console.log(
  `Catalog lanes valid: ${[...catalogsByMajor.entries()]
    .map(([major, lane]) => `v${major}=${lane.packages.length}`)
    .join(", ")}; legacy=v${LEGACY_CATALOG_MAJOR}.`,
);
