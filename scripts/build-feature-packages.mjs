import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const artifactsDir = join(repoRoot, "artifacts");
const packagesDir = join(repoRoot, "packages");
const sourcesRoot = join(repoRoot, "sources/engine");
const sourceRoot = existsSync(sourcesRoot) ? sourcesRoot : engineRoot;
const packageSharedEntry = join(repoRoot, "sources/package-shared.ts");
const catalogPath = join(repoRoot, "catalog/catalog.json");
const MIN_ENGINE_VERSION = "2.3.0";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const featureSource = (relativePath) => {
  const packaged = resolve(sourceRoot, relativePath);
  return existsSync(packaged) ? packaged : resolve(engineRoot, relativePath);
};

async function captureEngineSources(metafilePath) {
  const metafile = JSON.parse(await readFile(metafilePath, "utf8"));
  for (const input of Object.keys(metafile.inputs || {})) {
    const absolute = resolve(engineRoot, input);
    if (!absolute.startsWith(`${engineRoot}/`) || absolute.includes("/node_modules/")) continue;
    const relative = absolute.slice(engineRoot.length + 1);
    const destination = join(sourcesRoot, relative);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(absolute, destination);
  }
}

const features = [
  {
    id: "hierarchical-maps",
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
    name: "Conversation Calls",
    version: "1.0.1",
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
    ["tic-tac-toe", "Tic-Tac-Toe", "Play Tic-Tac-Toe with a Conversation character.", "TicTacToe", "/tictactoe", ["tic-tac-toe", "tic tac toe", "noughts and crosses"], "1v1 strategy"],
    ["rock-paper-scissors", "Rock-Paper-Scissors", "Play Rock-Paper-Scissors with a Conversation character.", "RockPaperScissors", "/rps", ["rock paper scissors", "rock-paper-scissors", "rps"], "1v1 quick game"],
  ].map(([id, name, description, clientName, command, aliases, playerLabel]) => ({
    id,
    name,
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

async function bundleServer(feature, output) {
  const temporary = await mkdtemp(join(tmpdir(), `marinara-feature-entry-${feature.id}-`));
  try {
    const target = resolve(sourceRoot, feature.serverImport || feature.engineImport);
    const source = feature.id === "hierarchical-maps"
      ? `import { ${feature.serverExport} as register } from ${JSON.stringify(target)};
import * as projection from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/spatial-context/projection.ts"))};
import * as stateResolution from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/spatial-context/state-resolution.ts"))};
import * as ownerTurn from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/spatial-context/owner-turn.ts"))};
import * as gameMapBinding from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/spatial-context/game-map-binding.ts"))};
import { createSpatialContextStorage } from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/storage/spatial-context.storage.ts"))};
export async function activate({ app, api }) {
  await app.register(register, { prefix: ${JSON.stringify(feature.prefix)} });
  const cleanups = [
    api.registerService("hierarchical-maps:projection", projection),
    api.registerService("hierarchical-maps:state-resolution", stateResolution),
    api.registerService("hierarchical-maps:owner-turn", ownerTurn),
    api.registerService("hierarchical-maps:game-map-binding", gameMapBinding),
    api.registerService("hierarchical-maps:storage", { create: createSpatialContextStorage }),
  ];
  return () => { for (const cleanup of cleanups.reverse()) cleanup(); };
}\n`
      : feature.id === "conversation-calls"
      ? `import { ${feature.serverExport} as register } from ${JSON.stringify(target)};
import * as commandRuntime from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/generation/conversation-call-command-runtime.ts"))};
import * as characterVideos from ${JSON.stringify(resolve(sourceRoot, "packages/server/src/services/conversation/call-character-videos.service.ts"))};
export async function activate({ app, api }) {
  await app.register(register, { prefix: ${JSON.stringify(feature.prefix)} });
  const cleanups = [
    api.registerService("conversation-calls:command", commandRuntime),
    api.registerService("conversation-calls:character-videos", characterVideos),
  ];
  return () => { for (const cleanup of cleanups.reverse()) cleanup(); };
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
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `esbuild failed for ${feature.id}`);
    await captureEngineSources(metafile);
  } finally {
    await rm(temporary, { recursive: true, force: true });
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
  try {
    let source = "";
    const tag = `marinara-capability-${feature.id}`;
    if (feature.id === "hierarchical-maps") {
      const settings = resolve(sourceRoot, "packages/client/src/features/spatial-context/SpatialContextSettingsSection.tsx");
      const workspace = resolve(sourceRoot, "packages/client/src/features/spatial-context/SpatialMapWorkspace.tsx");
      const runtimeBar = featureSource("packages/client/src/features/spatial-context/components/SpatialContextRuntimeBar.tsx");
      const worldMap = featureSource("packages/client/src/components/game/GameWorldMap.tsx");
      const spatialHooks = featureSource("packages/client/src/hooks/use-spatial-context.ts");
      const chatStore = featureSource("packages/client/src/stores/chat.store.ts");
      const uiStore = featureSource("packages/client/src/stores/ui.store.ts");
      source = `
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { SpatialContextSettingsSection } from ${JSON.stringify(settings)};
import { SpatialMapWorkspace } from ${JSON.stringify(workspace)};
import { SpatialContextRuntimeBar } from ${JSON.stringify(runtimeBar)};
import { GameWorldMap } from ${JSON.stringify(worldMap)};
import { useSpatialContext } from ${JSON.stringify(spatialHooks)};
import { useChatStore } from ${JSON.stringify(chatStore)};
import { useUIStore } from ${JSON.stringify(uiStore)};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
window.addEventListener("marinara-capability-server-event", (event) => { if (event.detail?.packageId === "hierarchical-maps") void client.invalidateQueries({ queryKey: ["spatial-context"] }); });
function PendingBridge({ chatId, onChange }) { const pending = useChatStore((state) => state.pendingSpatialTransitions.get(chatId) || null); useEffect(() => { if (typeof onChange === "function") onChange(pending); }, [onChange, pending]); return null; }
function WorldMapView({ props, chatId }) { const spatial = useSpatialContext(chatId); if (spatial.isLoading) return <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">Loading world map…</div>; if (!spatial.data?.definition?.enabled) return <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">No hierarchical map yet</div>; return <><GameWorldMap chatId={chatId} spatial={spatial.data} disabled={props.disabled === true} /><PendingBridge chatId={chatId} onChange={props.onPendingTransitionChange} /></>; }
function Root({ element }) { const [, redraw] = useState(0); const [workspaceOpen, setWorkspaceOpen] = useState(false); useEffect(() => { const update = () => redraw((v) => v + 1); element.addEventListener("marinara-capability-props", update); return () => element.removeEventListener("marinara-capability-props", update); }, [element]); const props = element.capabilityProps || {}; const chatId = typeof props.chatId === "string" ? props.chatId : ""; const view = element.getAttribute("view"); useEffect(() => { if (props.pendingDraftReview && typeof props.pendingDraftReview === "object") useUIStore.getState().openSpatialMapDraftReview(props.pendingDraftReview); }, [props.pendingDraftReview]); if (!chatId) return null; if (view === "runtime") return <><SpatialContextRuntimeBar chatId={chatId} disabled={props.disabled === true} /><PendingBridge chatId={chatId} onChange={props.onPendingTransitionChange} /></>; if (view === "world-map") return <WorldMapView props={props} chatId={chatId} />; if (view === "workspace" || workspaceOpen) return <div className="fixed inset-0 z-[10020] bg-[var(--background)]"><SpatialMapWorkspace chatId={chatId} onClose={() => { useUIStore.getState().clearPendingSpatialMapDraftReview(); setWorkspaceOpen(false); props.onClose?.(); }} /><Toaster richColors /></div>; return <><SpatialContextSettingsSection chatId={chatId} style={props.style} onOpenEditor={() => setWorkspaceOpen(true)} /><Toaster richColors /></>; }
class Element extends HTMLElement { connectedCallback() { if (!this.__root) this.__root = createRoot(this); this.__root.render(<QueryClientProvider client={client}><Root element={this} /></QueryClientProvider>); } disconnectedCallback() { queueMicrotask(() => { if (!this.isConnected && this.__root) { this.__root.unmount(); this.__root = null; } }); } }
if (!customElements.get(${JSON.stringify(tag)})) customElements.define(${JSON.stringify(tag)}, Element);`;
    } else if (feature.id === "conversation-calls") {
      const surface = resolve(sourceRoot, "packages/client/src/components/chat/ConversationCallSurface.tsx");
      const hooks = resolve(sourceRoot, "packages/client/src/hooks/use-conversation-calls.ts");
      const ttsHooks = resolve(sourceRoot, "packages/client/src/hooks/use-tts.ts");
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
        <span className="block text-xs font-medium text-[var(--foreground)]">Conversation Calls</span>
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
    const result = spawnSync("pnpm", ["exec", "esbuild", entry, "--bundle", "--platform=browser", "--format=esm", "--target=es2020", "--minify", "--define:process.env.NODE_ENV=\"production\"", "--define:import.meta.env.DEV=false", "--define:import.meta.env.PROD=true", "--define:import.meta.env.MODE=\"production\"", `--alias:@marinara-engine/shared=${packageSharedEntry}`, `--metafile=${metafile}`, `--outfile=${output}`], { cwd: engineRoot, encoding: "utf8", env: { ...process.env, NODE_PATH: join(engineRoot, "node_modules") } });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `client esbuild failed for ${feature.id}`);
    await captureEngineSources(metafile);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const featureIds = new Set(selectedFeatures.map((feature) => feature.id));
const nonDownloadableCoreFeatures = new Set(["about-me-keeper"]);
catalog.packages = catalog.packages.filter(
  (entry) => !featureIds.has(entry.manifest.id) && !nonDownloadableCoreFeatures.has(entry.manifest.id),
);

for (const feature of selectedFeatures) {
  const version = feature.version ?? "1.0.0";
  const sourceDir = join(packagesDir, feature.id);
  await mkdir(sourceDir, { recursive: true });
  const agentDefinition = {
    id: feature.id,
    name: feature.name,
    description: feature.description,
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
  const serverSource = resolve(sourceRoot, feature.serverImport || feature.engineImport);
  if (existsSync(serverSource)) {
    await bundleServer(feature, serverPath);
  } else if (!existsSync(serverPath)) {
    throw new Error(`Missing package-owned server source for ${feature.id}`);
  }
  const serverBuffer = await readFile(serverPath);
  const hasClient = Boolean(feature.clientName || feature.id === "hierarchical-maps" || feature.id === "conversation-calls");
  const clientPath = hasClient ? join(sourceDir, "client.js") : null;
  if (clientPath) {
    if (feature.clientName) await bundleGameClient(feature, clientPath);
    else await bundleSpecialClient(feature, clientPath);
  }
  const clientBuffer = clientPath ? await readFile(clientPath) : null;
  await writeFile(join(sourceDir, "agents.json"), agentsBuffer);
  const manifest = {
    schemaVersion: 1,
    id: feature.id,
    name: feature.name,
    version,
    description: feature.description,
    engine: { min: MIN_ENGINE_VERSION, maxExclusive: "3.0.0" },
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
      contributions: { slots: ["chat-settings", "spatial-workspace", "chat-runtime", "game-world-map"] },
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
    const artifactName = `${feature.id}-${version}.zip`;
    const artifactPath = join(artifactsDir, artifactName);
    await rm(artifactPath, { force: true });
    const zipped = spawnSync(
      "zip",
      ["-X", "-q", artifactPath, "manifest.json", "agents.json", "server.mjs", ...(clientBuffer ? ["client.js"] : [])],
      { cwd: temporary },
    );
    if (zipped.status !== 0) throw new Error(`zip failed for ${feature.id}`);
    const artifact = await readFile(artifactPath);
    catalog.packages.push({
      manifest,
      category: feature.category ?? "misc",
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
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
