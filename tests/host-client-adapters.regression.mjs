// Package clients use the Engine's stores, services and components through sources/host-client-overlay
// (Pasta-Devs/Marinara-Agents#1478, #1487). With `globalThis.__MARINARA_HOST__` (version 1) every adapter hands package
// code the Engine's live object. Without a member, the ui and chat stores are read-only copies that never write, the
// other stores are inert, dialogs resolve as cancelled with a notice, voice playback reports it is unavailable, and the
// API client, emoji catalog and Modal fail the package load: never a bundled copy.
//
// Each adapter is bundled by esbuild exactly as the feature build resolves it, with small stand-ins for react, zustand
// and sonner, then evaluated against a host namespace (or none).
// Run: node tests/host-client-adapters.regression.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const overlay = join(repoRoot, "sources/host-client-overlay/packages/client/src");
// esbuild arrives with tsx (a locked dev dependency).
const esbuild = createRequire(join(repoRoot, "package.json"))("esbuild");

const standIns = {
  react: `
const values = new Map();
export function createContext(defaultValue) {
  const context = { defaultValue };
  context.Provider = { context };
  contexts.push(context);
  return context;
}
export function createElement(type, props, ...children) {
  return { type, props: { ...props, children: children.length > 1 ? children : children[0] } };
}
export function useContext(context) { return values.has(context) ? values.get(context) : context.defaultValue; }
export const useState = (initial) => [typeof initial === "function" ? initial() : initial, () => undefined];
export const useLayoutEffect = () => undefined;
export const useMemo = (factory) => factory();
export const useCallback = (callback) => callback;
export const useId = () => ":r1:";
export const useSyncExternalStore = (_subscribe, snapshot) => snapshot();
const contexts = [];
const createContextImpl = createContext;
globalThis.__standInReact = {
  inside(element, read) {
    values.set(element.type.context, element.props.value);
    try { return read(); } finally { values.delete(element.type.context); }
  },
  /** Runs read() with the react-i18next context (the one created with an undefined default) set to value. */
  insideContext(value, read) {
    const context = contexts.find((candidate) => candidate.defaultValue === undefined);
    values.set(context, value);
    try { return read(); } finally { values.delete(context); }
  },
};`,
  "react-i18next": `
import { createContext } from "react";
export const I18nContext = createContext(undefined);
export const I18nextProvider = function I18nextProvider() {};
export const getI18n = () => globalThis.__engineI18n;`,
  "react/jsx-runtime": `
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;
export const Fragment = Symbol.for("fragment");`,
  zustand: `
function createStoreImpl(createState) {
  let state;
  const listeners = new Set();
  const setState = (partial, replace) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    if (Object.is(next, state)) return;
    const previous = state;
    state = replace ?? (typeof next !== "object" || next === null) ? next : Object.assign({}, state, next);
    listeners.forEach((listener) => listener(state, previous));
  };
  const getState = () => state;
  const subscribe = (listener) => (listeners.add(listener), () => listeners.delete(listener));
  const api = { setState, getState, getInitialState: () => initial, subscribe };
  const initial = (state = createState(setState, getState, api));
  return api;
}
const createImpl = (createState) => {
  const api = createStoreImpl(createState);
  return Object.assign((selector = (state) => state) => selector(api.getState()), api);
};
export const createStore = (createState) => (createState ? createStoreImpl(createState) : createStoreImpl);
export const create = (createState) => (createState ? createImpl(createState) : createImpl);`,
  clsx: `export const clsx = (...values) => values.flat().filter(Boolean).join(" ");`,
  "tailwind-merge": `export const twMerge = (value) => value;`,
  sonner: `
export const toast = Object.assign((message) => globalThis.__toasts.push(["toast", message]), {
  error: (message) => globalThis.__toasts.push(["error", message]),
});`,
};

const temporary = await mkdtemp(join(tmpdir(), "host-client-adapters-"));
let builds = 0;
/** One adapter, bundled the way a package build bundles it. */
async function bundle(relativePath, sourceRoot = overlay) {
  const outfile = join(temporary, `${++builds}.mjs`);
  await esbuild.build({
    entryPoints: [join(sourceRoot, relativePath)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    jsx: "automatic",
    logLevel: "silent",
    outfile,
    plugins: [
      {
        name: "stand-ins",
        setup(build) {
          build.onResolve(
            { filter: /^(react|react\/jsx-runtime|react-i18next|zustand|sonner|clsx|tailwind-merge)$/ },
            (args) => ({
              path: args.path,
              namespace: "stand-in",
            }),
          );
          build.onResolve({ filter: /^@marinara-engine\/shared$/ }, () => ({ path: "shared", namespace: "stand-in" }));
          build.onLoad({ filter: /.*/, namespace: "stand-in" }, (args) => ({
            contents: standIns[args.path] ?? "export {};",
            loader: "js",
          }));
        },
      },
    ],
  });
  return outfile;
}

const bundles = {};
for (const path of [
  "stores/ui.store.ts",
  "stores/chat.store.ts",
  "stores/agent.store.ts",
  "stores/sidecar.store.ts",
  "stores/dialog.store.ts",
  "stores/gallery.store.ts",
  "stores/encounter.store.ts",
  "stores/game-state.store.ts",
  "stores/backfill.store.ts",
  "lib/app-dialogs.ts",
  "lib/tts-service.ts",
  "lib/api-client.ts",
  "lib/emoji-catalog.generated.ts",
  "components/ui/Modal.tsx",
]) {
  bundles[path] = await bundle(path);
}
// World Maps reads and changes pending moves through the Engine's chat store (package-owned, not an overlay).
const mapsTransitions = "features/spatial-context/pending-spatial-transitions.ts";
bundles[mapsTransitions] = await bundle(
  mapsTransitions,
  join(repoRoot, "packages/hierarchical-maps/src/engine/packages/client/src"),
);

let loads = 0;
/** Evaluates one adapter as a package client does, after the Engine set (or did not set) the namespace. */
async function load(path, { host, storage = {} } = {}) {
  const touched = [];
  globalThis.__toasts = [];
  globalThis.localStorage = {
    getItem(key) {
      touched.push(["getItem", key]);
      if (typeof storage === "function") return storage(key);
      return storage[key] ?? null;
    },
    setItem: (key) => touched.push(["setItem", key]),
    removeItem: (key) => touched.push(["removeItem", key]),
  };
  if (host === undefined) delete globalThis.__MARINARA_HOST__;
  else globalThis.__MARINARA_HOST__ = host;
  const module = await import(`${pathToFileURL(bundles[path]).href}?load=${++loads}`);
  return { module, touched, toasts: globalThis.__toasts };
}

const { create } = await import(`data:text/javascript,${encodeURIComponent(standIns.zustand)}`);
const hostWith = (members) => ({ version: 1, ...members });
const writes = (touched) => touched.filter(([method]) => method !== "getItem");

// ── Every store: the Engine's live hook itself ───────────────────────────────────────────────────────────────────
const storeExports = {
  ui: ["stores/ui.store.ts", "useUIStore"],
  chat: ["stores/chat.store.ts", "useChatStore"],
  agent: ["stores/agent.store.ts", "useAgentStore"],
  sidecar: ["stores/sidecar.store.ts", "useSidecarStore"],
  dialog: ["stores/dialog.store.ts", "useDialogStore"],
  gallery: ["stores/gallery.store.ts", "useGalleryStore"],
  encounter: ["stores/encounter.store.ts", "useEncounterStore"],
  gameState: ["stores/game-state.store.ts", "useGameStateStore"],
  backfill: ["stores/backfill.store.ts", "useRollingBackfillStore"],
};
for (const [name, [path, exportName]] of Object.entries(storeExports)) {
  const live = create(() => ({ activeChatId: "engine-chat", marker: name }));
  const { module, touched } = await load(path, {
    host: hostWith({ stores: { [name]: live } }),
    storage: () => assert.fail(`${name}: the adapter read browser storage although the Engine shares its store`),
  });
  if (name === "chat") {
    // The chat adapter wraps the hook for PackageChatScope; the store underneath is the Engine's.
    assert.equal(module.useChatStore.getState(), live.getState());
    assert.equal(module.useChatStore.subscribe, live.subscribe);
    module.useChatStore.setState({ marker: "changed by the package" });
    assert.equal(live.getState().marker, "changed by the package", "a package change reaches the Engine's store");
  } else {
    assert.equal(module[exportName], live, `${name}: the package uses the Engine's own hook`);
  }
  assert.deepEqual(touched, [], `${name}: nothing read or written in browser storage`);
}

// ── ui: without the namespace, a copy seeded from the saved settings that never writes ─────────────────────────────
{
  const stored = JSON.stringify({
    state: { debugMode: true, conversationCallVoiceVolume: 40, enterToSendConvo: false, closeModal: "not an action" },
    version: 103,
  });
  const { module, touched } = await load("stores/ui.store.ts", { storage: { "marinara-engine-ui": stored } });
  const state = module.useUIStore.getState();
  assert.equal(state.debugMode, true);
  assert.equal(state.conversationCallVoiceVolume, 40);
  assert.equal(state.enterToSendConvo, false);
  assert.equal(state.enableStreaming, true, "a setting the Engine has not saved keeps the Engine's default");
  assert.equal(typeof state.closeModal, "function", "a saved value never replaces an action");
  state.setConversationCallVoiceVolume(250);
  state.closeAllDetails();
  assert.equal(
    module.useUIStore((current) => current.conversationCallVoiceVolume),
    100,
  );
  assert.deepEqual(touched, [["getItem", "marinara-engine-ui"]], "the copy read the key once and never wrote it");
}
for (const [label, options] of [
  ["a newer namespace", { host: { version: 2, stores: { ui: create(() => ({ debugMode: true })) } } }],
  ["blocked storage", { storage: () => assert.fail("unreachable") && null }],
  ["settings that are not JSON", { storage: { "marinara-engine-ui": "{" } }],
]) {
  const blocked =
    label === "blocked storage"
      ? () => {
          throw new Error("SecurityError");
        }
      : options.storage;
  const { module, touched } = await load("stores/ui.store.ts", { ...options, storage: blocked });
  assert.equal(module.useUIStore.getState().debugMode, false, `${label}: the Engine's defaults stand`);
  assert.deepEqual(writes(touched), [], `${label}: nothing was written`);
}

// ── chat: PackageChatScope shows a call's chat to the Engine components inside it ─────────────────────────────────
{
  const live = create(() => ({ activeChatId: "chat-b", isStreaming: true, streamingChatId: "chat-b" }));
  const { module } = await load("stores/chat.store.ts", { host: hostWith({ stores: { chat: live } }) });
  const { PackageChatScope, useChatStore } = module;
  assert.equal(
    useChatStore((state) => state.activeChatId),
    "chat-b",
  );
  const scope = PackageChatScope({ chatId: "call-chat-a", children: null });
  const scoped = globalThis.__standInReact.inside(scope, () => ({
    activeChatId: useChatStore((state) => state.activeChatId),
    streamingChatId: useChatStore((state) => state.streamingChatId),
    whole: useChatStore(),
    again: useChatStore(),
  }));
  assert.equal(scoped.activeChatId, "call-chat-a", "inside the scope the call's chat is the open chat");
  assert.equal(scoped.streamingChatId, "chat-b", "only the open chat is scoped");
  assert.equal(scoped.whole, scoped.again, "a whole-state selector stays referentially stable");
  assert.equal(useChatStore.getState().activeChatId, "chat-b", "getState() is never scoped");
}

// ── chat: without the namespace, nothing open or streaming; saved map moves read-only; no writer writes ──────────
{
  const move = {
    transition: { commandId: "command-1", destinationId: "kitchen" },
    destinationName: "Kitchen",
    relation: "child",
    status: "ready",
  };
  const { module, touched } = await load("stores/chat.store.ts", {
    storage: {
      "marinara-pending-spatial-transitions": JSON.stringify([
        ["chat-1", move],
        ["bad", null],
      ]),
    },
  });
  const state = module.useChatStore.getState();
  assert.equal(state.activeChatId, null);
  assert.equal(state.isStreaming, false);
  assert.equal(state.streamingChatId, null);
  assert.deepEqual([...state.pendingSpatialTransitions.keys()], ["chat-1"]);
  state.setPendingSpatialTransition("chat-2", move);
  state.clearPendingSpatialTransition("chat-1");
  state.setActiveChat({ id: "chat-9" });
  state.reset();
  module.useChatStore.setState({ activeChatId: "chat-9" });
  assert.equal(module.useChatStore.getState().activeChatId, null, "setState is a no-op");
  assert.deepEqual([...module.useChatStore.getState().pendingSpatialTransitions.keys()], ["chat-1"]);
  assert.deepEqual(writes(touched), [], "never writes the active chat, drafts or map moves");
}

// ── the other stores without the namespace: inert, and the [youtube] gate knows ────────────────────────────────────
{
  const { module: agent, touched } = await load("stores/agent.store.ts");
  assert.equal(agent.hostAgentStoreAvailable, false);
  agent.useAgentStore.getState().setYoutubePlay({ searchQuery: "song", mood: "call" });
  const { module: liveAgent } = await load("stores/agent.store.ts", {
    host: hostWith({ stores: { agent: create(() => ({})) } }),
  });
  assert.equal(liveAgent.hostAgentStoreAvailable, true);
  const { module: sidecar } = await load("stores/sidecar.store.ts");
  assert.equal(sidecar.useSidecarStore.getState().modelDownloaded, false, "Local Model is not offered");
  await sidecar.useSidecarStore.getState().fetchStatus();
  const { module: gameState } = await load("stores/game-state.store.ts");
  gameState.useGameStateStore.getState().setGameState({ id: "state" });
  assert.equal(gameState.useGameStateStore.getState().current, null);
  assert.deepEqual(writes(touched), []);
}

// ── dialogs: the Engine's module, or an at-once cancel with a notice ─────────────────────────────────────────────
{
  const calls = [];
  const dialogs = {
    showAlertDialog: async (options) => calls.push(["alert", options]),
    showConfirmDialog: async (options) => (calls.push(["confirm", options]), true),
    showPromptDialog: async () => "typed",
    showChoiceDialog: async () => "picked",
  };
  const { module } = await load("lib/app-dialogs.ts", { host: hostWith({ services: { dialogs } }) });
  assert.equal(module.showConfirmDialog, dialogs.showConfirmDialog);
  assert.equal(await module.showConfirmDialog({ message: "Delete?" }), true);
  assert.equal(await module.showPromptDialog({ message: "Name?" }), "typed");

  const missing = await load("lib/app-dialogs.ts");
  assert.equal(await missing.module.showConfirmDialog({ message: "Delete?" }), false);
  assert.equal(await missing.module.showPromptDialog({ message: "Name?" }), null);
  assert.equal(await missing.module.showChoiceDialog({ message: "Pick", choices: [] }), null);
  assert.equal(await missing.module.showAlertDialog({ message: "Hi" }), undefined);
  assert.deepEqual(missing.toasts[0], ["error", "This dialog needs a newer Marinara Engine."]);
}

// ── voice playback: the Engine's service, or a clear refusal ────────────────────────────────────────────────────
{
  const ttsService = { speak: async () => undefined, speakSequence: async () => undefined, stop() {} };
  const { module } = await load("lib/tts-service.ts", { host: hostWith({ services: { tts: { ttsService } } }) });
  assert.equal(module.ttsService, ttsService);
  assert.equal(module.ttsUnavailableReason, null);
  const missing = await load("lib/tts-service.ts");
  await assert.rejects(missing.module.ttsService.speakSequence([]), /Voice playback needs a newer Marinara Engine/u);
  assert.equal(missing.module.ttsService.getState(), "error");
  missing.module.ttsService.stop();
  assert.match(missing.module.ttsUnavailableReason, /capability API 1\.341/u);
}

// ── API client, emoji catalog and Modal: the Engine's, or the package does not load ───────────────────────────────
{
  class ApiError extends Error {}
  const apiModule = { api: { get: async () => "data" }, ApiError, getApiErrorMessage: () => "m", isJsonRepairApiError };
  function isJsonRepairApiError() {
    return false;
  }
  const { module: api } = await load("lib/api-client.ts", { host: hostWith({ api: apiModule }) });
  assert.equal(api.api, apiModule.api);
  assert.equal(api.ApiError, ApiError, "one ApiError class on both sides of instanceof");
  assert.equal(api.isJsonRepairApiError, isJsonRepairApiError);
  await assert.rejects(load("lib/api-client.ts"), /does not provide the API client; .*capability API 1\.341/u);

  const emojiCatalog = { EMOJI_CATEGORIES: [{ label: "Smileys", icon: "😀", emojis: ["😀"] }], EMOJI_SEARCH_NAMES: {} };
  const { module: emoji } = await load("lib/emoji-catalog.generated.ts", {
    host: hostWith({ data: { emojiCatalog } }),
  });
  assert.equal(emoji.EMOJI_CATEGORIES, emojiCatalog.EMOJI_CATEGORIES);
  await assert.rejects(load("lib/emoji-catalog.generated.ts"), /does not provide the emoji catalog/u);
  await assert.rejects(
    load("lib/emoji-catalog.generated.ts", { host: hostWith({ data: {} }) }),
    /does not provide the emoji catalog/u,
  );

  function HostModal() {}
  globalThis.CSS = { escape: (value) => value.replace(/[\\:]/gu, "\\$&") };
  const { module: modal } = await load("components/ui/Modal.tsx", {
    host: hostWith({ components: { Modal: HostModal } }),
  });
  const plain = modal.Modal({ open: true, onClose() {}, title: "Setup", children: "board", width: "max-w-lg" });
  assert.equal(plain.type, HostModal, "a game's dialog is the Engine's Modal");
  assert.equal(plain.props.width, "max-w-lg");
  assert.equal(plain.props.children, "board");

  // Inside Slurp's portal the content keeps Slurp's scope and the variables the dialog panel does not set itself.
  const portal = {
    tagName: "DIV",
    getAttribute: (name) =>
      ({ "data-marinara-capability-scope": "slurp2", class: "mari-chrome-token-scope" })[name] ?? null,
    style: Object.assign(["--noodle-accent", "--background"], {
      item(index) {
        return this[index];
      },
      getPropertyValue: (name) => ({ "--noodle-accent": "#ff7ec1", "--background": "#17121b" })[name],
    }),
  };
  const portalScope = modal.ModalPortalContext.Provider;
  const scoped = globalThis.__standInReact.inside({ type: portalScope, props: { value: portal } }, () =>
    modal.Modal({ open: true, onClose() {}, title: "Share", children: "post" }),
  );
  assert.equal(scoped.type, HostModal);
  assert.equal(scoped.props.focusScopePortalSelector, '[data-marinara-package-modal-layer="\\:r1\\:"]');
  const wrapper = scoped.props.children;
  assert.equal(wrapper.props["data-marinara-capability-scope"], "slurp2");
  assert.deepEqual(wrapper.props.style, { "--noodle-accent": "#ff7ec1", display: "contents" });
  assert.equal(wrapper.props.children.props.value, portal, "until the dialog's layer exists, portals use Slurp's");
  // Inside a package's own i18n instance, the Engine's Modal translates with the Engine's and the content with the package's.
  globalThis.__engineI18n = { name: "engine" };
  const { module: translated } = await load("components/ui/Modal.tsx", {
    host: hostWith({ components: { Modal: HostModal } }),
  });
  const packageTranslation = { i18n: { name: "noodle" } };
  const modalWithI18n = globalThis.__standInReact.insideContext(packageTranslation, () =>
    translated.Modal({ open: true, onClose() {}, title: "Intro", children: "hello" }),
  );
  assert.match(modalWithI18n.type.name, /^I18nextProvider/u, "the Engine's Modal renders with the Engine's i18n");
  assert.equal(modalWithI18n.props.i18n, globalThis.__engineI18n);
  assert.equal(modalWithI18n.props.children.type, HostModal);
  const packageProvider = modalWithI18n.props.children.props.children;
  assert.equal(packageProvider.props.value, packageTranslation, "its content keeps the package's own i18n");
  assert.equal(packageProvider.props.children, "hello");
  delete globalThis.__engineI18n;
  await assert.rejects(load("components/ui/Modal.tsx"), /does not provide the Modal component/u);
}

// ── World Maps: pending moves live in the Engine's chat store; the package never writes their key ─────────────────
{
  const draft = {
    transition: { commandId: "command-1", destinationId: "kitchen", travelMode: "direct" },
    destinationName: "Kitchen",
    relation: "child",
    status: "ready",
  };
  const calls = [];
  // The Engine's spatial slice, as chat.store.ts implements it (the status setter has no review note).
  const chat = create((set) => ({
    pendingSpatialTransitions: new Map(),
    setPendingSpatialTransition: (chatId, next) => {
      calls.push(["set", chatId, next]);
      set((state) => ({ pendingSpatialTransitions: new Map(state.pendingSpatialTransitions).set(chatId, next) }));
    },
    clearPendingSpatialTransition: (chatId, commandId) => {
      calls.push(["clear", chatId, commandId]);
      set((state) => {
        const map = new Map(state.pendingSpatialTransitions);
        if (!commandId || map.get(chatId)?.transition.commandId === commandId) map.delete(chatId);
        return { pendingSpatialTransitions: map };
      });
    },
  }));
  const { module: maps, touched } = await load(mapsTransitions, { host: hostWith({ stores: { chat } }) });
  maps.setPendingSpatialTransition("chat-1", draft);
  assert.equal(chat.getState().pendingSpatialTransitions.get("chat-1"), draft, "the move lands in the Engine's store");
  maps.setPendingSpatialTransition("chat-1", draft);
  assert.equal(calls.length, 1, "the Engine's own draft handed back as a prop is not saved again");
  assert.equal(maps.getPendingSpatialTransition("chat-1"), draft);
  assert.equal(maps.usePendingSpatialTransition("chat-1"), draft);
  maps.setPendingSpatialTransitionStatus("chat-1", "needs_review", " The route changed. ");
  assert.deepEqual(calls.at(-1)[2], { ...draft, status: "needs_review", reviewMessage: "The route changed." });
  maps.setPendingSpatialTransitionStatus("chat-1", "ready");
  assert.equal("reviewMessage" in maps.getPendingSpatialTransition("chat-1"), false, "ready clears the review note");
  maps.clearPendingSpatialTransition("chat-1", "another-command");
  assert.ok(maps.getPendingSpatialTransition("chat-1"), "a different command keeps the move");
  maps.clearPendingSpatialTransition("chat-1", "command-1");
  assert.equal(maps.getPendingSpatialTransition("chat-1"), null, "a cleared move stays cleared");
  assert.deepEqual(touched, [], "World Maps never reads or writes the Engine's key itself");

  const saved = JSON.stringify([["chat-2", draft]]);
  const missing = await load(mapsTransitions, { storage: { "marinara-pending-spatial-transitions": saved } });
  assert.deepEqual(missing.module.getPendingSpatialTransition("chat-2"), draft, "an older Engine's saved moves show");
  missing.module.setPendingSpatialTransition("chat-3", draft);
  missing.module.clearPendingSpatialTransition("chat-2");
  assert.deepEqual(missing.module.getPendingSpatialTransition("chat-2"), draft);
  assert.deepEqual(writes(missing.touched), [], "and nothing is written");
}

delete globalThis.localStorage;
delete globalThis.__MARINARA_HOST__;
delete globalThis.__standInReact;
delete globalThis.__toasts;
delete globalThis.CSS;
await rm(temporary, { recursive: true, force: true });
console.log("host client adapters: ok");
