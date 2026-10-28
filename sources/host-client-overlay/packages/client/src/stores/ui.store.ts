// ──────────────────────────────────────────────
// The Engine's UI store, as package clients see it (Pasta-Devs/Marinara-Agents#1478)
// ──────────────────────────────────────────────
// Package clients reach the Engine's UI store through the Engine hooks they bundle. The Engine owns that store and
// the settings it saves. The copy these packages used to bundle wrote its older shape over the Engine's
// "marinara-engine-ui" key on every load, and the Engine then reset each setting it keeps only in the browser.
// The feature build stacks this file over that module, so every import of it lands on the Engine's live store
// (`__MARINARA_HOST__.stores.ui`) and no package carries a store of its own.
import { create } from "zustand";
import { hostStore, type BoundStore } from "../lib/marinara-host-bridge";

/** The Engine saves its UI settings under this key. Packages read it and never write or remove it. */
const ENGINE_SETTINGS_KEY = "marinara-engine-ui";

export type UserStatus = "active" | "idle" | "dnd" | "invisible";
export type MusicPlayerSource = "spotify" | "youtube" | "custom";

// Saved settings package code reads, with the Engine's defaults.
const settingDefaults = {
  debugMode: false,
  enableStreaming: true,
  includeReasoningInExports: false,
  achievementsEnabled: true,
  musicPlayerEnabled: true,
  musicPlayerSource: "youtube" as MusicPlayerSource,
  userStatus: "active" as UserStatus,
  enterToSendConvo: true,
  conversationCallVoiceVolume: 100,
  conversationCallVoiceMuted: false,
  sidebarOpen: true,
  chatBackground: null as string | null,
};

const closedDetails = {
  characterDetailId: null as string | null,
  lorebookDetailId: null as string | null,
  presetDetailId: null as string | null,
  connectionDetailId: null as string | null,
  agentDetailId: null as string | null,
  toolDetailId: null as string | null,
  personaDetailId: null as string | null,
  regexDetailId: null as string | null,
  characterLibraryOpen: false,
  botBrowserOpen: false,
  gameAssetsBrowserOpen: false,
};

/** What package code reads from the Engine's UI store. The Engine's store holds this and much more. */
export type UIState = typeof settingDefaults &
  typeof closedDetails & {
    modal: { type: string; props?: Record<string, unknown> } | null;
    rightPanelOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    setChatBackground: (url: string | null) => void;
    setConversationCallVoiceVolume: (volume: number) => void;
    setConversationCallVoiceMuted: (muted: boolean) => void;
    closeModal: () => void;
    closeRightPanel: () => void;
    closeBotBrowser: () => void;
    closeAllDetails: () => void;
  };

function savedSettings(): Partial<typeof settingDefaults> {
  try {
    const saved: unknown = JSON.parse(globalThis.localStorage?.getItem(ENGINE_SETTINGS_KEY) ?? "null")?.state;
    if (!saved || typeof saved !== "object") return {};
    return Object.fromEntries(
      Object.keys(settingDefaults)
        .filter((key) => key in saved)
        .map((key) => [key, (saved as Record<string, unknown>)[key]]),
    );
  } catch {
    // Blocked storage or a value that is not JSON: the Engine's defaults stand.
    return {};
  }
}

// An Engine without the namespace still saves its settings, so this copy starts from them and keeps later changes to
// itself. It has no persist middleware: nothing here writes or removes the Engine's key.
// ponytail: it holds only what package code reads today. Reading anything else fails `npm run typecheck:packages`
// (TS2339 on UIState); add it to UIState and here.
function readOnlyCopy(): BoundStore<UIState> {
  return create<UIState>()((set) => ({
    ...settingDefaults,
    ...savedSettings(),
    ...closedDetails,
    modal: null,
    rightPanelOpen: false,
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    setChatBackground: (chatBackground) => set({ chatBackground }),
    setConversationCallVoiceVolume: (volume) =>
      set({ conversationCallVoiceVolume: Math.max(0, Math.min(100, Math.round(volume))) }),
    setConversationCallVoiceMuted: (conversationCallVoiceMuted) => set({ conversationCallVoiceMuted }),
    closeModal: () => set({ modal: null }),
    closeRightPanel: () => set({ rightPanelOpen: false }),
    closeBotBrowser: () => set({ botBrowserOpen: false }),
    closeAllDetails: () => set(closedDetails),
  })) as BoundStore<UIState>;
}

export const useUIStore: BoundStore<UIState> = hostStore<UIState>("ui") ?? readOnlyCopy();
