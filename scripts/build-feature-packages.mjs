import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, copyFile, cp, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { catalogArtworkUrl } from "./catalog-artwork.mjs";
import { readCatalogFamily, writeCatalogFamily } from "./catalog-lanes.mjs";
import { assertHierarchicalMapsPrivateImportBoundary } from "./hierarchical-maps-boundary.mjs";
import { withPackageActivationGuidance } from "./catalog-package-guidance.mjs";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const artifactsDir = join(repoRoot, "artifacts");
const packagesDir = join(repoRoot, "packages");
const sourcesRoot = join(repoRoot, "sources/engine");
const hierarchicalMapsSourceRoot = join(packagesDir, "hierarchical-maps/src/engine");
const sourceRoot = process.env.MARINARA_ENGINE_SOURCE_ROOT
  ? resolve(process.env.MARINARA_ENGINE_SOURCE_ROOT)
  : existsSync(sourcesRoot)
    ? sourcesRoot
    : engineRoot;
const packageSharedEntry = join(repoRoot, "sources/package-shared.ts");
const MIN_ENGINE_VERSION = "2.3.0";
const ARTIFACT_MTIME = new Date("2000-01-01T00:00:00.000Z");
const hierarchicalMapsOwnedSourcePaths = [
  "packages/server/src/routes/spatial-context.routes.ts",
  "packages/server/src/services/spatial-context",
  "packages/server/src/services/storage/spatial-context.storage.ts",
  "packages/client/src/features/spatial-context",
  "packages/client/src/hooks/use-spatial-context.ts",
  "packages/client/src/components/game/GameWorldMap.tsx",
  "packages/maps-shared",
];
const reuseExistingRuntime = process.env.MARINARA_REUSE_FEATURE_RUNTIME === "1";
const rebuiltFeatureClients = new Set(
  String(process.env.MARINARA_REBUILD_FEATURE_CLIENTS || "").split(",").filter(Boolean),
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const featureSource = (relativePath, buildRoot = sourceRoot) => {
  const packaged = resolve(buildRoot, relativePath);
  return existsSync(packaged) ? packaged : resolve(engineRoot, relativePath);
};

async function prepareFeatureBuildRoot(feature) {
  if (feature.id !== "hierarchical-maps") {
    return { buildRoot: sourceRoot, cleanup: async () => {} };
  }
  if (!existsSync(hierarchicalMapsSourceRoot)) {
    throw new Error("Missing package-owned Hierarchical Maps source");
  }
  const buildRoot = await mkdtemp(join(tmpdir(), "marinara-hierarchical-maps-source-"));
  await cp(hierarchicalMapsSourceRoot, buildRoot, { recursive: true, force: true });
  return {
    buildRoot,
    cleanup: () => rm(buildRoot, { recursive: true, force: true }),
  };
}

async function captureEngineSources(metafilePath, buildRoot = sourceRoot, excludedPaths = []) {
  const metafile = JSON.parse(await readFile(metafilePath, "utf8"));
  const normalizedBuildRoot = resolve(buildRoot);
  for (const input of Object.keys(metafile.inputs || {})) {
    const absolute = resolve(engineRoot, input);
    if (!absolute.startsWith(`${normalizedBuildRoot}/`) || absolute.includes("/node_modules/")) continue;
    const relative = absolute.slice(normalizedBuildRoot.length + 1);
    if (excludedPaths.some((path) => relative === path || relative.startsWith(`${path}/`))) continue;
    const destination = join(sourcesRoot, relative);
    if (absolute === destination) continue;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(absolute, destination);
  }
}

const features = [
  {
    id: "hierarchical-maps",
    version: "1.1.7",
    minEngineVersion: "2.3.3",
    maxEngineExclusive: "3.0.0",
    name: "Hierarchical Maps",
    description: "Adds persistent hierarchical locations, spatial context, map authoring, and movement to Roleplay and Game.",
    category: "tracker",
    kind: ["agent", "maps"],
    modes: ["roleplay", "game"],
    permissions: ["agent-runtime", "chat-read", "chat-write", "network", "prompt-context", "routes", "storage", "ui"],
    serverImport: "packages/server/src/routes/spatial-context.routes.ts",
    serverExport: "spatialContextRoutes",
    prefix: "/api/chats",
  },
  {
    id: "conversation-calls",
    name: "Calls",
    version: "1.0.5",
    description: "Adds live audio and video calls with Conversation characters.",
    kind: ["agent", "conversation-calls"],
    modes: ["conversation"],
    permissions: ["agent-runtime", "chat-read", "chat-write", "network", "routes", "storage", "ui"],
    serverImport: "packages/server/src/routes/conversation-calls.routes.ts",
    serverExport: "conversationCallsRoutes",
    prefix: "/api/conversation-calls",
  },
  ...[
    ["uno", "UNO", "Play UNO with Conversation characters.", "Uno", "/uno", ["uno"], "Group card game"],
    ["chess", "Chess", "Play Chess with a Conversation character.", "Chess", "/chess", ["chess"], "1v1 strategy"],
    ["poker", "Poker", "Play Texas Hold’em Poker with Conversation characters.", "Poker", "/poker", ["poker", "hold'em", "texas hold'em"], "Table game"],
    ["eightball", "8-Ball Pool", "Play 8-Ball Pool with a Conversation character.", "EightBall", "/8ball", ["8-ball", "8 ball", "eightball", "pool", "billiards"], "1v1 table sport"],
    ["tic-tac-toe", "Tic-Tac-Toe", "Play Tic-Tac-Toe with a Conversation character.", "TicTacToe", "/tictactoe", ["tic-tac-toe", "tic tac toe", "noughts and crosses", "ttt"], "1v1 strategy"],
    ["rock-paper-scissors", "Rock-Paper-Scissors", "Play Rock-Paper-Scissors with a Conversation character.", "RockPaperScissors", "/rps", ["rock paper scissors", "rock-paper-scissors", "rps"], "1v1 quick game"],
  ].map(([id, name, description, clientName, command, aliases, playerLabel]) => ({
    id,
    name,
    version: "1.0.3",
    maxEngineExclusive: "4.0.0",
    description,
    kind: ["agent", "turn-game"],
    modes: ["conversation"],
    permissions: ["agent-runtime", "chat-read", "chat-write", "storage", "ui"],
    engineImport: `packages/shared/src/features/turn-games/${id}/engine.ts`,
    engineExport: id === "eightball" ? "eightBallEngine" : id === "tic-tac-toe" ? "ticTacToeEngine" : id === "rock-paper-scissors" ? "rockPaperScissorsEngine" : `${id}Engine`,
    clientName,
    command,
    aliases,
    playerLabel,
    commandType: id.replaceAll("-", "_"),
  })),
];

const requestedFeatureIds = new Set(process.argv.slice(2));
const selectedFeatures = requestedFeatureIds.size > 0
  ? features.filter((feature) => requestedFeatureIds.has(feature.id))
  : features;
if (selectedFeatures.length !== requestedFeatureIds.size && requestedFeatureIds.size > 0) {
  const knownIds = new Set(features.map((feature) => feature.id));
  const unknownIds = [...requestedFeatureIds].filter((id) => !knownIds.has(id));
  throw new Error(`Unknown feature package${unknownIds.length === 1 ? "" : "s"}: ${unknownIds.join(", ")}`);
}
const hierarchicalMapsBoundary = selectedFeatures.some((feature) => feature.id === "hierarchical-maps")
  ? await assertHierarchicalMapsPrivateImportBoundary()
  : null;

async function bundleServer(feature, output) {
  const temporary = await mkdtemp(join(tmpdir(), `marinara-feature-entry-${feature.id}-`));
  const prepared = await prepareFeatureBuildRoot(feature);
  try {
    const target = resolve(prepared.buildRoot, feature.serverImport || feature.engineImport);
    const source = feature.id === "hierarchical-maps"
      ? `import { ${feature.serverExport} as register } from ${JSON.stringify(target)};
import * as projection from ${JSON.stringify(resolve(prepared.buildRoot, "packages/server/src/services/spatial-context/projection.ts"))};
import * as stateResolution from ${JSON.stringify(resolve(prepared.buildRoot, "packages/server/src/services/spatial-context/state-resolution.ts"))};
import * as ownerTurn from ${JSON.stringify(resolve(prepared.buildRoot, "packages/server/src/services/spatial-context/owner-turn.ts"))};
import * as gameMapBinding from ${JSON.stringify(resolve(prepared.buildRoot, "packages/server/src/services/spatial-context/game-map-binding.ts"))};
import { configurePackageRuntime } from ${JSON.stringify(resolve(prepared.buildRoot, "packages/server/src/services/spatial-context/package-runtime.ts"))};
import { createSpatialContextStorage } from ${JSON.stringify(resolve(prepared.buildRoot, "packages/server/src/services/storage/spatial-context.storage.ts"))};
let readinessStorage = null;
export async function activate({ app, api }) {
  const cleanupRuntime = configurePackageRuntime(
    api.runtime,
    async (agentType) => {
      const response = await app.inject({ method: "GET", url: "/api/agents" });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error("Could not read global agent settings (" + response.statusCode + ")");
      }
      const configs = response.json();
      const config = Array.isArray(configs)
        ? configs.find((candidate) => candidate && typeof candidate === "object" && candidate.type === agentType)
        : null;
      return config?.settings ?? null;
    },
    async (agentType, settings) => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/agents/type/" + encodeURIComponent(agentType),
        headers: { "x-marinara-csrf": "1" },
        payload: { settings },
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error("Could not update global agent settings (" + response.statusCode + ")");
      }
      return response.json().settings ?? null;
    },
  );
  try {
    await app.register(register, { prefix: ${JSON.stringify(feature.prefix)} });
    readinessStorage = createSpatialContextStorage();
    const cleanups = [
      cleanupRuntime,
      api.registerService("hierarchical-maps:projection", projection),
      api.registerService("hierarchical-maps:state-resolution", stateResolution),
      api.registerService("hierarchical-maps:owner-turn", ownerTurn),
      api.registerService("hierarchical-maps:game-map-binding", gameMapBinding),
      api.registerService("hierarchical-maps:storage", { create: () => createSpatialContextStorage() }),
    ];
    return () => { readinessStorage = null; for (const cleanup of cleanups.reverse()) cleanup(); };
  } catch (error) {
    readinessStorage = null;
    cleanupRuntime();
    throw error;
  }
}
export async function selfCheck({ api }) {
  if (!readinessStorage) throw new Error("Hierarchical Maps storage did not initialize");
  if (typeof api.runtime.resources?.listCharacters !== "function") throw new Error("Hierarchical Maps character resources are unavailable");
  if (typeof api.runtime.resources?.listEligibleLorebookEntries !== "function") throw new Error("Hierarchical Maps lore resources are unavailable");
  if (typeof api.runtime.languageModels?.resolve !== "function") throw new Error("Hierarchical Maps language model host is unavailable");
  if (typeof api.runtime.json?.parseJsonish !== "function") throw new Error("Hierarchical Maps JSON parser is unavailable");
  await readinessStorage.listForChat("__marinara_capability_self_check__");
  await api.runtime.resources.listCharacters([]);
  await api.runtime.resources.listEligibleLorebookEntries({ lorebookIds: [], entryIds: [] });
  const parsed = api.runtime.json.parseJsonish('Preface\\n{"ready":true}');
  if (!parsed || typeof parsed !== "object" || parsed.ready !== true) throw new Error("Hierarchical Maps JSON parser self-check failed");
}\n`
      : feature.id === "conversation-calls"
      ? `import { ${feature.serverExport} as register } from ${JSON.stringify(target)};
import * as commandRuntime from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/generation/conversation-call-command-runtime.ts"))};
import * as characterVideos from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/conversation/call-character-videos.service.ts"))};
import { createConversationCallsStorage } from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/storage/conversation-calls.storage.ts"))};
let readinessStorage = null;
export async function activate({ app, api }) {
  await app.register(register, { prefix: ${JSON.stringify(feature.prefix)} });
  readinessStorage = createConversationCallsStorage(app.db);
  const cleanups = [
    api.registerService("conversation-calls:command", commandRuntime),
    api.registerService("conversation-calls:character-videos", characterVideos),
  ];
  return () => { readinessStorage = null; for (const cleanup of cleanups.reverse()) cleanup(); };
}
export async function selfCheck() {
  if (!readinessStorage) throw new Error("Conversation Calls storage did not initialize");
  await readinessStorage.getActiveForChat("__marinara_capability_self_check__");
}\n`
      : feature.serverImport
      ? `import { ${feature.serverExport} as register } from ${JSON.stringify(target)};\nexport async function activate({ app }) { await app.register(register, { prefix: ${JSON.stringify(feature.prefix)} }); }\n`
      : `import { ${feature.engineExport} as engine } from ${JSON.stringify(target)};\nexport async function activate({ api }) { const cleanups = [api.registerTurnGameEngine(engine), api.registerConversationCommand({ commandType: ${JSON.stringify(feature.commandType)}, tags: [${JSON.stringify(feature.commandType)}] })]; return () => { for (const cleanup of cleanups.reverse()) cleanup(); }; }\n`;
    const entry = join(temporary, "entry.mjs");
    const metafile = join(temporary, "meta.json");
    await writeFile(entry, source);
    const result = spawnSync("pnpm", [
      "exec", "esbuild", entry,
      "--bundle", "--platform=node", "--format=esm", "--target=node22", "--minify",
      "--banner:js=import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
      "--external:@huggingface/transformers", "--external:onnxruntime-node", "--external:onnxruntime-web", "--external:sharp",
      "--external:pino", "--external:pino-pretty",
      `--alias:@marinara-engine/shared=${packageSharedEntry}`,
      `--metafile=${metafile}`,
      `--outfile=${output}`,
    ], {
      cwd: engineRoot,
      encoding: "utf8",
      env: { ...process.env, NODE_PATH: join(engineRoot, "node_modules") },
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || result.error?.message || `esbuild failed for ${feature.id}`);
    }
    await captureEngineSources(
      metafile,
      prepared.buildRoot,
      feature.id === "hierarchical-maps" ? hierarchicalMapsOwnedSourcePaths : [],
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
    await prepared.cleanup();
  }
}

async function bundleGameClient(feature, output) {
  const temporary = await mkdtemp(join(tmpdir(), `marinara-feature-client-${feature.id}-`));
  try {
    const board = resolve(sourceRoot, `packages/client/src/components/chat/${feature.clientName}Board.tsx`);
    const setup = resolve(sourceRoot, `packages/client/src/components/chat/${feature.clientName}Setup.tsx`);
    const tag = `marinara-capability-${feature.id}`;
    const source = `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ${feature.clientName}Board as Board } from ${JSON.stringify(board)};
import { ${feature.clientName}Setup as Setup } from ${JSON.stringify(setup)};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
window.addEventListener("marinara-capability-server-event", (event) => { if (event.detail?.packageId === ${JSON.stringify(feature.id)}) void client.invalidateQueries({ queryKey: ["turn-games"] }); });

function PackageRoot({ element }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  const props = element.capabilityProps || {};
  const chatId = typeof props.chatId === "string" ? props.chatId : "";
  if (!chatId) return null;
  if (element.getAttribute("view") === "setup") {
    return <><Setup chatId={chatId} open={props.open !== false} onClose={() => props.onClose?.()} /><Toaster richColors /></>;
  }
  return <><Board chatId={chatId} /><Toaster richColors /></>;
}

class MarinaraCapabilityElement extends HTMLElement {
  connectedCallback() {
    if (!this.__root) {
      this.__root = createRoot(this);
    }
    this.__root.render(<QueryClientProvider client={client}><PackageRoot element={this} /></QueryClientProvider>);
  }
  disconnectedCallback() {
    queueMicrotask(() => { if (!this.isConnected && this.__root) { this.__root.unmount(); this.__root = null; } });
  }
}
if (!customElements.get(${JSON.stringify(tag)})) customElements.define(${JSON.stringify(tag)}, MarinaraCapabilityElement);
`;
    const entry = join(temporary, "entry.tsx");
    const metafile = join(temporary, "meta.json");
    await writeFile(entry, source);
    const result = spawnSync("pnpm", [
      "exec", "esbuild", entry,
      "--bundle", "--platform=browser", "--format=esm", "--target=es2020", "--minify",
      "--jsx=automatic",
      "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env.DEV=false",
      "--define:import.meta.env.PROD=true", "--define:import.meta.env.MODE=\"production\"",
      `--alias:@marinara-engine/shared=${packageSharedEntry}`,
      `--metafile=${metafile}`,
      `--outfile=${output}`,
    ], { cwd: engineRoot, encoding: "utf8", env: { ...process.env, NODE_PATH: join(engineRoot, "node_modules") } });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `client esbuild failed for ${feature.id}`);
    await captureEngineSources(metafile);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function bundleSpecialClient(feature, output) {
  const temporary = await mkdtemp(join(tmpdir(), `marinara-feature-client-${feature.id}-`));
  const prepared = await prepareFeatureBuildRoot(feature);
  try {
    let source = "";
    const tag = `marinara-capability-${feature.id}`;
    if (feature.id === "hierarchical-maps") {
      const settings = resolve(prepared.buildRoot, "packages/client/src/features/spatial-context/SpatialContextSettingsSection.tsx");
      const home = resolve(prepared.buildRoot, "packages/client/src/features/spatial-context/SpatialMapsHome.tsx");
      const workspace = resolve(prepared.buildRoot, "packages/client/src/features/spatial-context/SpatialMapWorkspace.tsx");
      const runtimeBar = resolve(prepared.buildRoot, "packages/client/src/features/spatial-context/components/SpatialContextRuntimeBar.tsx");
      const worldMap = resolve(prepared.buildRoot, "packages/client/src/components/game/GameWorldMap.tsx");
      const spatialHooks = resolve(prepared.buildRoot, "packages/client/src/hooks/use-spatial-context.ts");
      const packageApi = resolve(prepared.buildRoot, "packages/client/src/features/spatial-context/package-api.ts");
      const pendingTransitions = resolve(prepared.buildRoot, "packages/client/src/features/spatial-context/pending-spatial-transitions.ts");
      const routePlans = resolve(prepared.buildRoot, "packages/client/src/features/spatial-context/spatial-route-plans.ts");
      const workspaceStyles = `
[data-marinara-maps-workspace-overlay] {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

[data-marinara-maps-workspace-overlay] > .mari-editor-shell,
[data-marinara-maps-workspace-root] {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1 1 0%;
}

[data-marinara-maps-workspace-overlay] .mari-editor-action,
[data-marinara-maps-workspace-overlay] .mari-chrome-control {
  min-width: 2.75rem;
  min-height: 2.75rem;
}

@media (min-width: 64rem) {
  .mari-maps-workspace-grid {
    grid-template-columns: minmax(15rem, 18rem) minmax(20rem, 1fr) minmax(18rem, 22rem);
  }

  .mari-maps-ai-grid {
    grid-template-columns: minmax(20rem, 0.9fr) minmax(22rem, 1.1fr);
  }
}
`;
      const worldMapStyles = `
[data-marinara-maps-world-canvas] {
  height: 13rem;
}

[data-marinara-maps-world-canvas][data-compact="true"] {
  height: min(14rem, 32dvh);
}

[data-marinara-maps-world-overlay] [data-marinara-maps-world-canvas] {
  height: min(32rem, 55dvh);
  min-height: 18rem;
}
`;
      const runtimeStyles = `
@media (max-width: 39.999rem) {
  marinara-capability-hierarchical-maps[view="runtime"] {
    display: block;
  }

  [data-marinara-maps-runtime-root][data-runtime-layout="compact"] {
    width: 2.75rem;
    height: 2.75rem;
    margin-left: auto;
    overflow: visible;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  [data-marinara-maps-runtime-root][data-runtime-layout="compact"][data-runtime-mode="game"] {
    height: 0;
    margin-bottom: 0;
    transform: translateY(-2.75rem);
    pointer-events: none;
    z-index: 110;
  }

  [data-marinara-maps-runtime-root][data-runtime-layout="compact"][data-runtime-mode="game"] [data-marinara-maps-runtime-mobile] {
    pointer-events: auto;
  }

  [data-marinara-maps-runtime-root][data-runtime-layout="compact"][data-runtime-mode="game"] [data-marinara-maps-runtime-options] {
    pointer-events: auto;
  }

  [data-marinara-maps-runtime-desktop] {
    display: none !important;
  }

  [data-marinara-maps-runtime-mobile] {
    display: flex !important;
  }

  [data-marinara-maps-runtime-popover] {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.375rem);
    z-index: 100;
    width: min(22rem, calc(100vw - 1.5rem));
    max-height: min(70dvh, 36rem);
    background-color: var(--background) !important;
    background-image: linear-gradient(
      var(--marinara-chat-chrome-highlight-bg),
      var(--marinara-chat-chrome-highlight-bg)
    );
    backdrop-filter: none;
  }

  [data-marinara-maps-runtime-options] {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.375rem);
    z-index: 100;
    width: min(22rem, calc(100vw - 1.5rem));
    max-height: min(70dvh, 36rem);
    overflow-y: auto;
    border: 1px solid var(--marinara-chat-chrome-panel-border);
    border-radius: 0.75rem;
    background-color: var(--background);
    background-image: linear-gradient(
      var(--marinara-chat-chrome-highlight-bg),
      var(--marinara-chat-chrome-highlight-bg)
    );
    backdrop-filter: none;
    box-shadow: 0 1.5rem 3rem rgb(0 0 0 / 45%);
  }
}

@media (min-width: 40rem) {
  [data-marinara-maps-runtime-mobile] {
    display: none !important;
  }
}
`;
      source = `
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { SpatialContextSettingsSection } from ${JSON.stringify(settings)};
import { SpatialMapsHome } from ${JSON.stringify(home)};
import { SpatialMapWorkspace } from ${JSON.stringify(workspace)};
import { SpatialContextRuntimeBar } from ${JSON.stringify(runtimeBar)};
import { GameWorldMap } from ${JSON.stringify(worldMap)};
import { useSpatialContext } from ${JSON.stringify(spatialHooks)};
import { packageApi } from ${JSON.stringify(packageApi)};
import { clearPendingSpatialTransition, getPendingSpatialTransition, setPendingSpatialTransition, setPendingSpatialTransitionStatus, usePendingSpatialTransition } from ${JSON.stringify(pendingTransitions)};
import { getSpatialRoutePlan, reconcileSpatialRoutePlan } from ${JSON.stringify(routePlans)};
const workspaceStyles = ${JSON.stringify(workspaceStyles)};
const worldMapStyles = ${JSON.stringify(worldMapStyles)};
const runtimeStyles = ${JSON.stringify(runtimeStyles)};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
class CapabilityClientErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  componentDidCatch(error, info) {
    const message = error instanceof Error && error.message ? error.message : "Capability client runtime failed";
    this.props.element.capabilityRuntimeError = message;
    this.props.element.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }));
    console.error("Hierarchical Maps client capability stopped", error, info);
  }
  retry() {
    this.props.element.capabilityRuntimeError = null;
    this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div role="alert" className="m-3 flex items-start gap-3 rounded-lg border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 p-3"><span className="min-w-0 flex-1 text-xs text-[var(--foreground)]">Hierarchical Maps stopped.</span><button type="button" onClick={() => this.retry()} className="min-h-11 min-w-11 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)]">Try again</button></div>;
  }
  static getDerivedStateFromError(error) { return { error }; }
}
window.addEventListener("marinara-capability-server-event", (event) => { if (event.detail?.packageId === "hierarchical-maps") void client.invalidateQueries({ queryKey: ["spatial-context"] }); });
function PendingBridge({ chatId, onChange, disabled }) { const pending = usePendingSpatialTransition(chatId); const onChangeRef = useRef(onChange); const wasDisabledRef = useRef(disabled === true); useEffect(() => { onChangeRef.current = onChange; }, [onChange]); useEffect(() => { if (typeof onChangeRef.current === "function") onChangeRef.current(pending); }, [pending]); useEffect(() => { const turnFinished = wasDisabledRef.current && disabled !== true; wasDisabledRef.current = disabled === true; if (!turnFinished || !pending) return; let cancelled = false; void packageApi.get("/chats/" + encodeURIComponent(chatId) + "/spatial-context").then((spatial) => { const currentPending = getPendingSpatialTransition(chatId); if (cancelled || !spatial || currentPending?.transition.commandId !== pending.transition.commandId) return; client.setQueryData(["spatial-context", chatId], spatial); if (getSpatialRoutePlan(chatId)) reconcileSpatialRoutePlan(chatId, spatial); else if (spatial.currentLocationId === pending.transition.destinationId) clearPendingSpatialTransition(chatId, pending.transition.commandId); else setPendingSpatialTransitionStatus(chatId, "needs_review"); }).catch(() => { const currentPending = getPendingSpatialTransition(chatId); if (!cancelled && currentPending?.transition.commandId === pending.transition.commandId) setPendingSpatialTransitionStatus(chatId, "needs_review"); }); return () => { cancelled = true; }; }, [chatId, disabled, pending]); return null; }
function WorldMapView({ props, chatId, onOpenEditor, useParentScroll = false }) {
  const spatial = useSpatialContext(chatId);
  if (spatial.isLoading) return <div className="h-full min-h-32 space-y-2 rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] p-3" aria-label="Loading hierarchical world map"><span role="status" className="sr-only">Loading hierarchical world map</span><div className="h-3 w-28 animate-pulse rounded bg-[var(--muted)]" /><div className="h-24 animate-pulse rounded-lg bg-[var(--muted)]/55" /></div>;
  if (spatial.isError) return <div role="alert" className="flex min-h-32 items-center gap-3 rounded-lg border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 p-3 text-xs"><span className="min-w-0 flex-1">The hierarchical world map could not be loaded.</span><button type="button" onClick={() => void spatial.refetch()} className="min-h-11 rounded-lg px-3 font-semibold text-[var(--destructive)] hover:bg-[var(--destructive)]/10">Retry</button></div>;
  if (!spatial.data?.definition) return <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-[var(--marinara-chat-chrome-panel-border)] px-4 text-center text-xs text-[var(--marinara-chat-chrome-accent)]">No hierarchical map yet. Create one from Agents → Hierarchical Maps.</div>;
  if (!spatial.data.definition.enabled) return <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-[var(--marinara-chat-chrome-panel-border)] px-4 text-center text-xs text-[var(--marinara-chat-chrome-accent)]">Hierarchical map disabled. Its saved hierarchy and history are preserved.</div>;
  return <><style data-marinara-maps-world-styles>{worldMapStyles}</style><GameWorldMap chatId={chatId} spatial={spatial.data} disabled={props.disabled === true} compact={props.compact === true} useParentScroll={useParentScroll} onOpenEditor={onOpenEditor} /><PendingBridge chatId={chatId} onChange={props.onPendingTransitionChange} disabled={props.disabled === true} /></>;
}
function WorkspaceOverlay({ chatId, props, onClose }) { return createPortal(<div data-chat-floating-panel data-marinara-maps-workspace-overlay className="fixed inset-0 isolate flex min-h-0 flex-col overflow-hidden bg-[var(--background)]" style={{ zIndex: 10020, backgroundColor: "var(--background)" }}><style data-marinara-maps-workspace-styles>{workspaceStyles}</style><SpatialMapWorkspace chatId={chatId} debugMode={props.debugMode === true} pendingDraftReview={props.pendingDraftReview || null} onClearPendingDraftReview={() => props.onClearPendingDraftReview?.()} onDirtyChange={(dirty) => props.onDirtyChange?.(dirty)} onOpenLorebook={(lorebookId) => props.onOpenLorebook?.(lorebookId)} onClose={onClose} /><Toaster richColors /></div>, document.body); }
function WorldMapOverlay({ chatId, props, onClose, onOpenEditor }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return createPortal(<div data-chat-floating-panel data-marinara-maps-world-overlay className="fixed inset-0 isolate flex min-h-0 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]" style={{ zIndex: 10020, backgroundColor: "var(--background)" }}>
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-3 sm:px-5">
      <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold text-[var(--marinara-chat-chrome-accent)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Back to Hierarchical Maps">Back</button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold">World map</h1>
        <p className="truncate text-[0.625rem] text-[var(--marinara-chat-chrome-accent)]">{typeof props.chatName === "string" ? props.chatName : "Current story"}</p>
      </div>
      <button type="button" onClick={onOpenEditor} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 text-xs font-semibold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">Edit map</button>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-5xl">
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-[var(--marinara-chat-chrome-accent)]">Browse nested places and linked routes. Choose a nearby place to set the next destination, or plan a multi-step route to a farther location.</p>
        <WorldMapView props={props} chatId={chatId} useParentScroll />
      </div>
    </main>
    <Toaster richColors />
  </div>, document.body);
}
function Root({ element }) {
  const [, redraw] = useState(0);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [worldMapOpen, setWorldMapOpen] = useState(false);
  const previousPendingRef = useRef({ chatId: "", pending: null });
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  const props = element.capabilityProps || {};
  const chatId = typeof props.chatId === "string" ? props.chatId : "";
  const view = element.getAttribute("view");
  useEffect(() => {
    if (!chatId) return;
    const previous = previousPendingRef.current;
    const nextPending = props.pendingTransition && typeof props.pendingTransition === "object" ? props.pendingTransition : null;
    if (nextPending) setPendingSpatialTransition(chatId, nextPending);
    else {
      clearPendingSpatialTransition(chatId);
      if (previous.chatId === chatId && previous.pending) void client.invalidateQueries({ queryKey: ["spatial-context", chatId] });
    }
    previousPendingRef.current = { chatId, pending: nextPending };
  }, [chatId, props.pendingTransition]);
  const closeWorkspace = () => {
    props.onClearPendingDraftReview?.();
    setWorkspaceOpen(false);
    if (view !== "detail") props.onClose?.();
  };
  const editFromWorldMap = () => {
    setWorldMapOpen(false);
    setWorkspaceOpen(true);
  };
  if (workspaceOpen && chatId) return <WorkspaceOverlay chatId={chatId} props={props} onClose={closeWorkspace} />;
  if (worldMapOpen && chatId) return <WorldMapOverlay chatId={chatId} props={props} onClose={() => setWorldMapOpen(false)} onOpenEditor={editFromWorldMap} />;
  if (view === "detail") return <><SpatialMapsHome chatId={chatId || null} chatName={typeof props.chatName === "string" ? props.chatName : null} chatMode={typeof props.chatMode === "string" ? props.chatMode : null} enabledForChat={props.enabledForChat === true} packageInfo={props.package || null} onEnabledForChatChange={typeof props.onEnabledForChatChange === "function" ? props.onEnabledForChatChange : undefined} onOpenMap={() => setWorldMapOpen(true)} onOpenEditor={() => setWorkspaceOpen(true)} onManagePackage={typeof props.onManagePackage === "function" ? props.onManagePackage : undefined} onClose={typeof props.onClose === "function" ? props.onClose : undefined} /><Toaster richColors /></>;
  if (!chatId) return null;
  if (view === "runtime") return <><style data-marinara-maps-world-styles>{worldMapStyles}</style><style data-marinara-maps-runtime-styles>{runtimeStyles}</style><SpatialContextRuntimeBar chatId={chatId} disabled={props.disabled === true} onOpenEditor={() => setWorkspaceOpen(true)} /><PendingBridge chatId={chatId} onChange={props.onPendingTransitionChange} disabled={props.disabled === true} /></>;
  if (view === "world-map") return <WorldMapView props={props} chatId={chatId} onOpenEditor={() => setWorkspaceOpen(true)} />;
  if (view === "workspace") return <WorkspaceOverlay chatId={chatId} props={props} onClose={closeWorkspace} />;
  return <><SpatialContextSettingsSection chatId={chatId} style={props.style} enabledForChat={props.enabledForChat === true} onEnabledForChatChange={typeof props.onEnabledForChatChange === "function" ? props.onEnabledForChatChange : undefined} onOpenEditor={() => setWorkspaceOpen(true)} /><Toaster richColors /></>;
}
class Element extends HTMLElement { connectedCallback() { if (!this.__root) this.__root = createRoot(this); this.__root.render(<QueryClientProvider client={client}><CapabilityClientErrorBoundary element={this}><Root element={this} /></CapabilityClientErrorBoundary></QueryClientProvider>); } disconnectedCallback() { queueMicrotask(() => { if (!this.isConnected && this.__root) { this.__root.unmount(); this.__root = null; } }); } }
if (!customElements.get(${JSON.stringify(tag)})) customElements.define(${JSON.stringify(tag)}, Element);`;
    } else if (feature.id === "conversation-calls") {
      const surface = resolve(prepared.buildRoot, "packages/client/src/components/chat/ConversationCallSurface.tsx");
      const hooks = resolve(prepared.buildRoot, "packages/client/src/hooks/use-conversation-calls.ts");
      const ttsHooks = resolve(prepared.buildRoot, "packages/client/src/hooks/use-tts.ts");
      source = `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2, Phone, PhoneIncoming, PhoneOff } from "lucide-react";
import { Toaster, toast } from "sonner";
import { ConversationCallSurface } from ${JSON.stringify(surface)};
import { useAcceptConversationCall, useConversationCallStatus, useDeclineConversationCall, useStartConversationCall } from ${JSON.stringify(hooks)};
import { useTTSConfig, useUpdateTTSConfig } from ${JSON.stringify(ttsHooks)};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); window.addEventListener("marinara-capability-server-event", (event) => { if (event.detail?.packageId === "conversation-calls") void client.invalidateQueries({ queryKey: ["conversation-calls"] }); }); let expandedChatId = null; const listeners = new Set(); function setExpanded(chatId) { expandedChatId = chatId; for (const listener of listeners) listener(); } function useExpanded(chatId) { const [, redraw] = useState(0); useEffect(() => { const fn = () => redraw((v) => v + 1); listeners.add(fn); return () => listeners.delete(fn); }, []); return expandedChatId === chatId; }
function Toggle({ label, description, enabled, disabled, pending, compact, onClick }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={(compact ? "mari-chat-option-field " : "") + "flex w-full items-center justify-between gap-3 rounded-lg bg-[var(--background)]/35 px-2.5 py-2 text-left transition-all hover:bg-[var(--secondary)]/50" + (enabled && compact ? " mari-chat-option-field--active" : "") + (disabled ? " cursor-not-allowed opacity-60" : "")}>
    <span className="min-w-0 flex-1">
      <span className="block text-[0.6875rem] font-medium text-[var(--foreground)]">{label}</span>
      {description ? <span className="mt-0.5 block text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">{description}</span> : null}
    </span>
    <span className="flex shrink-0 items-center gap-2">
      {pending ? <Loader2 size="0.75rem" className="animate-spin" /> : null}
      <span className={"mari-chat-option-switch h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors" + (enabled ? " mari-chat-option-switch--active" : "")}>
        <span className={"block h-4 w-4 rounded-full bg-white shadow-sm transition-transform" + (enabled ? " translate-x-3.5" : "")} />
      </span>
    </span>
  </button>;
}
function Settings({ props }) {
  const metadata = props.metadata && typeof props.metadata === "object" ? props.metadata : {};
  const updateMetadata = typeof props.updateMetadata === "function" ? props.updateMetadata : () => {};
  const config = useTTSConfig();
  const updateConfig = useUpdateTTSConfig();
  const value = config.data;
  const disabled = !value || updateConfig.isPending;
  const patch = (next) => {
    if (!value) return toast.error("Conversation call settings are still loading.");
    updateConfig.mutate({ ...value, callSttConnectionId: "", callSttModel: "", ...next });
  };
  const callsEnabled = metadata.conversationCallsEnabled === true;
  const audio = value?.callAudioEnabled === true;
  const videoInput = value?.callVideoInputEnabled === true;
  const videoPresence = value?.callCharacterVideoEnabled === true;
  const automaticClips = videoPresence && value?.callAutomaticVideoClipsEnabled === true;
  const customClips = videoPresence && value?.callCustomVideoClipsEnabled === true;
  return <section style={props.style} className={"mari-chat-option-field space-y-3 rounded-lg px-3 py-2.5 transition-all" + (callsEnabled ? " mari-chat-option-field--active" : "")}>
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)]"><Phone size="0.875rem" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-[var(--foreground)]">Calls</span>
        <span className="text-[0.625rem] leading-snug text-[var(--muted-foreground)]">Per-chat call access, microphone handling, camera/screen input, and character video setup.</span>
      </span>
    </div>
    <Toggle label="Audio/Video Calls" description="Show the call button for you in this conversation." enabled={callsEnabled} onClick={() => updateMetadata({ conversationCallsEnabled: !callsEnabled })} />
    {callsEnabled ? <>
      <div className="space-y-1.5 border-t border-[var(--border)]/60 pt-3">
        <Toggle label="Generate voice cues in [tags]" description="Ask call models for cues like [whispering], [laughing], and [sighs] for TTS/video timing." enabled={metadata.conversationCallVoiceCues !== false} onClick={() => updateMetadata({ conversationCallVoiceCues: metadata.conversationCallVoiceCues === false })} />
        <Toggle label="Call Audio Pipeline" description="Request microphone access, listen while unmuted, and transcribe speech into the call." enabled={audio} disabled={disabled} pending={updateConfig.isPending} onClick={() => patch({ callAudioEnabled: !audio, ...(!audio ? { callAudioInputMode: "local_whisper" } : {}) })} />
      </div>
      {audio ? <div className="space-y-2 border-t border-[var(--border)]/60 pt-3">
        <label className="flex flex-col gap-1">
          <span className="text-[0.625rem] font-medium text-[var(--foreground)]">Audio input mode</span>
          <select value={value?.callAudioInputMode || "local_whisper"} disabled={disabled} onChange={(event) => patch({ callAudioInputMode: event.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"><option value="local_whisper">Mic recording + Local Whisper</option><option value="transcribe">Browser speech recognition</option><option value="system">Manual system dictation</option><option value="auto">Provider-native audio/video</option></select>
          <span className="text-[0.55rem] leading-snug text-[var(--muted-foreground)]">Local Whisper records mic audio while you are unmuted and transcribes speech locally. Browser speech uses Web Speech where supported. Manual system dictation focuses the call input. Provider-native mode sends media to the selected conversation model.</span>
        </label>
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          <Toggle compact label="Camera and screen input" enabled={videoInput} disabled={disabled} onClick={() => patch({ callVideoInputEnabled: !videoInput })} />
          <Toggle compact label="Character video presence" enabled={videoPresence} disabled={disabled} onClick={() => patch({ callCharacterVideoEnabled: !videoPresence, ...(!videoPresence ? {} : { callAutomaticVideoClipsEnabled: false, callCustomVideoClipsEnabled: false }) })} />
          {videoPresence ? <Toggle compact label="Automatic video clips generation" enabled={automaticClips} disabled={disabled} onClick={() => patch({ callAutomaticVideoClipsEnabled: !automaticClips })} /> : null}
          {videoPresence ? <Toggle compact label="Custom clips" enabled={customClips} disabled={disabled} onClick={() => patch({ callCustomVideoClipsEnabled: !customClips })} /> : null}
        </div>
        {videoPresence ? <p className="text-[0.55rem] leading-snug text-[var(--muted-foreground)]">Character video presence uses clips from Character Sprites. Automatic clips generate cached idle and talking clips from character avatars; Custom clips let characters sparsely create one-off requested clips.</p> : null}
      </div> : <p className="rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[0.59375rem] leading-snug text-[var(--muted-foreground)]">Turn on the call audio pipeline here to use local mic transcription, browser speech recognition, manual system dictation, optional provider-native audio/video input, and call controls.</p>}
    </> : null}
  </section>;
}
function Root({ element }) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const update = () => redraw((value) => value + 1);
    element.addEventListener("marinara-capability-props", update);
    return () => element.removeEventListener("marinara-capability-props", update);
  }, [element]);
  const props = element.capabilityProps || {};
  const chatId = typeof props.chatId === "string" ? props.chatId : "";
  const callsEnabled = props.metadata?.conversationCallsEnabled === true;
  const status = useConversationCallStatus(chatId, !!chatId);
  const start = useStartConversationCall(chatId);
  const accept = useAcceptConversationCall(chatId);
  const decline = useDeclineConversationCall(chatId);
  const expanded = useExpanded(chatId);
  const active = status.data?.activeCall || null;
  const ringing = status.data?.ringingCall || null;
  if (!chatId) return null;
  if (element.getAttribute("view") === "settings") return <Settings props={props} />;
  if (element.getAttribute("view") === "toolbar") {
    if (!callsEnabled && !active) return null;
    return <button type="button" className="mari-chrome-control flex h-9 w-9 items-center justify-center p-0" title={active ? "Open call" : "Start call"} onClick={async () => {
      if (active) return setExpanded(chatId);
      try {
        await start.mutateAsync();
        setExpanded(chatId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start the call.");
      }
    }}>{start.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : active ? <PhoneIncoming size="0.875rem" /> : <Phone size="0.875rem" />}</button>;
  }
  if (expanded && active) return <div className="absolute inset-0 z-40 flex min-h-0 bg-[var(--background)]"><ConversationCallSurface chatId={chatId} session={active} characterMap={props.characterMap || new Map()} chatCharIds={props.chatCharIds || []} personaInfo={props.personaInfo} onEnded={() => setExpanded(null)} embedded /><Toaster richColors /></div>;
  if (ringing && !active) return <div className="px-3 pb-2"><div className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--popover)] p-3 shadow-xl"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"><PhoneIncoming size="1rem" /></div><div className="min-w-0 flex-1 text-sm font-semibold">Incoming call</div><button type="button" className="mari-chrome-control h-9 w-9 p-0 text-[var(--destructive)]" onClick={() => void decline.mutateAsync(ringing.id)}><PhoneOff size="0.875rem" /></button><button type="button" className="mari-chrome-control h-9 w-9 p-0 text-emerald-400" onClick={async () => { await accept.mutateAsync(ringing.id); setExpanded(chatId); }}><Phone size="0.875rem" /></button></div><Toaster richColors /></div>;
  return null;
}
class Element extends HTMLElement { connectedCallback() { if (!this.__root) this.__root = createRoot(this); this.__root.render(<QueryClientProvider client={client}><Root element={this} /></QueryClientProvider>); } disconnectedCallback() { queueMicrotask(() => { if (!this.isConnected && this.__root) { this.__root.unmount(); this.__root = null; } }); } }
if (!customElements.get(${JSON.stringify(tag)})) customElements.define(${JSON.stringify(tag)}, Element);`;
    } else return;
    const entry = join(temporary, "entry.tsx"); const metafile = join(temporary, "meta.json"); await writeFile(entry, source);
    const result = spawnSync("pnpm", ["exec", "esbuild", entry, "--bundle", "--platform=browser", "--format=esm", "--target=es2020", "--minify", "--jsx=automatic", "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env.DEV=false", "--define:import.meta.env.PROD=true", "--define:import.meta.env.MODE=\"production\"", `--alias:@marinara-engine/shared=${packageSharedEntry}`, `--metafile=${metafile}`, `--outfile=${output}`], { cwd: engineRoot, encoding: "utf8", env: { ...process.env, NODE_PATH: join(engineRoot, "node_modules") } });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `client esbuild failed for ${feature.id}`);
    await captureEngineSources(
      metafile,
      prepared.buildRoot,
      feature.id === "hierarchical-maps" ? hierarchicalMapsOwnedSourcePaths : [],
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
    await prepared.cleanup();
  }
}

const { catalog } = await readCatalogFamily(repoRoot);
const featureIds = new Set(selectedFeatures.map((feature) => feature.id));
const nonDownloadableCoreFeatures = new Set(["about-me-keeper"]);
catalog.packages = catalog.packages.filter(
  (entry) => !featureIds.has(entry.manifest.id) && !nonDownloadableCoreFeatures.has(entry.manifest.id),
);

for (const feature of selectedFeatures) {
  const version = feature.version ?? "1.0.0";
  const description = withPackageActivationGuidance(feature.id, feature.description);
  const sourceDir = join(packagesDir, feature.id);
  await mkdir(sourceDir, { recursive: true });
  const agentDefinition = {
    id: feature.id,
    name: feature.name,
    description,
    author: "Pasta Devs",
    phase: "pre_generation",
    enabledByDefault: false,
    category: feature.category ?? "misc",
    runtimeDisabled: true,
    modeAllowlist: feature.modes,
    defaultTools: [],
    defaultSettings: {},
    defaultPromptTemplate: "",
    execution: "feature",
  };
  const agentsBuffer = Buffer.from(`${JSON.stringify([agentDefinition], null, 2)}\n`);
  const serverPath = join(sourceDir, "server.mjs");
  const serverSourceRoot = feature.id === "hierarchical-maps" ? hierarchicalMapsSourceRoot : sourceRoot;
  const serverSource = resolve(serverSourceRoot, feature.serverImport || feature.engineImport);
  if (!reuseExistingRuntime && existsSync(serverSource)) {
    await bundleServer(feature, serverPath);
  } else if (!existsSync(serverPath)) {
    throw new Error(`Missing package-owned server source for ${feature.id}`);
  }
  const serverBuffer = await readFile(serverPath);
  const hasClient = Boolean(feature.clientName || feature.id === "hierarchical-maps" || feature.id === "conversation-calls");
  const clientPath = hasClient ? join(sourceDir, "client.js") : null;
  if (clientPath && (!reuseExistingRuntime || rebuiltFeatureClients.has(feature.id))) {
    if (feature.clientName) await bundleGameClient(feature, clientPath);
    else await bundleSpecialClient(feature, clientPath);
  } else if (clientPath && !existsSync(clientPath)) {
    throw new Error(`Missing package-owned client source for ${feature.id}`);
  }
  const clientBuffer = clientPath ? await readFile(clientPath) : null;
  await writeFile(join(sourceDir, "agents.json"), agentsBuffer);
  const boundary = feature.id === "hierarchical-maps" ? hierarchicalMapsBoundary : null;
  const manifest = {
    schemaVersion: boundary ? 2 : 1,
    ...(boundary ? {
      capabilityApi: boundary.capabilityApi,
      builtAgainst: boundary.builtAgainst,
    } : {}),
    id: feature.id,
    name: feature.name,
    version,
    description,
    engine: {
      min: feature.minEngineVersion ?? MIN_ENGINE_VERSION,
      maxExclusive: feature.maxEngineExclusive ?? "3.0.0",
    },
    kind: feature.kind,
    entrypoints: {
      agents: "agents.json",
      server: "server.mjs",
      ...(clientBuffer ? { client: "client.js" } : {}),
    },
    ...(feature.clientName ? {
      contributions: {
        slots: ["conversation-surface"],
        conversationGame: {
          command: feature.command,
          aliases: feature.aliases,
          playerLabel: feature.playerLabel,
        },
      },
    } : feature.id === "hierarchical-maps" ? {
      contributions: {
        agentDetail: { agentIds: ["hierarchical-maps"] },
        slots: ["chat-settings", "spatial-workspace", "chat-runtime", "game-world-map"],
      },
    } : feature.id === "conversation-calls" ? {
      contributions: { slots: ["conversation-toolbar", "conversation-surface", "chat-settings"] },
    } : {}),
    files: [
      { path: "agents.json", sha256: sha256(agentsBuffer), bytes: agentsBuffer.byteLength },
      { path: "server.mjs", sha256: sha256(serverBuffer), bytes: serverBuffer.byteLength },
      ...(clientBuffer ? [{ path: "client.js", sha256: sha256(clientBuffer), bytes: clientBuffer.byteLength }] : []),
    ],
    permissions: feature.permissions,
    restartRequired: true,
  };
  await writeFile(join(sourceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const temporary = await mkdtemp(join(tmpdir(), `marinara-feature-${feature.id}-`));
  try {
    await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(temporary, "agents.json"), agentsBuffer);
    await writeFile(join(temporary, "server.mjs"), serverBuffer);
    if (clientBuffer) await writeFile(join(temporary, "client.js"), clientBuffer);
    const artifactFiles = ["manifest.json", "agents.json", "server.mjs", ...(clientBuffer ? ["client.js"] : [])];
    for (const artifactFile of artifactFiles) {
      const artifactSource = join(temporary, artifactFile);
      await chmod(artifactSource, 0o644);
      await utimes(artifactSource, ARTIFACT_MTIME, ARTIFACT_MTIME);
    }
    const artifactName = `${feature.id}-${version}.zip`;
    const artifactPath = join(artifactsDir, artifactName);
    await rm(artifactPath, { force: true });
    const zipped = spawnSync(
      "zip",
      ["-X", "-q", artifactPath, ...artifactFiles],
      { cwd: temporary, env: { ...process.env, TZ: "UTC" } },
    );
    if (zipped.status !== 0) throw new Error(`zip failed for ${feature.id}`);
    const artifact = await readFile(artifactPath);
    catalog.packages.push({
      manifest,
      category: feature.category ?? "misc",
      iconUrl: catalogArtworkUrl(feature.id),
      artifact: {
        url: `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/${basename(artifactPath)}`,
        sha256: sha256(artifact),
        bytes: artifact.byteLength,
      },
      documentationUrl: `https://github.com/Pasta-Devs/Marinara-Agents#${feature.id}`,
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

catalog.generatedAt = new Date().toISOString();
catalog.packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
await writeCatalogFamily(repoRoot, catalog);
