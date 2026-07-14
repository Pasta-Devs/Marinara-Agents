// ──────────────────────────────────────────────
// Zustand Store: Turn-Game Board (UNO and future turn-based games)
// ──────────────────────────────────────────────
// Holds the live, per-viewer board snapshot pushed by the server (turn_game_state_patch
// SSE) or fetched on mount. chatId-guarded so a background chat's game can never
// paint over the visible board. Synchronous only — all async lives in use-uno.ts.
import { create } from "zustand";
import type { UnoPublicView } from "@marinara-engine/shared";

export type UnoBoardSnapshot = UnoPublicView & { chatId: string };

interface UnoGameStore {
  current: UnoBoardSnapshot | null;
  /** Chat whose setup modal is open (null = closed). Driven by the /uno command. */
  setupChatId: string | null;
  /** Replace the board with a fresh server snapshot for a chat. */
  setUno: (view: UnoPublicView, chatId: string) => void;
  /** Clear the board (optionally only if it belongs to a given chat). */
  clearUno: (chatId?: string) => void;
  /** Open the game-setup modal for a chat. */
  openSetup: (chatId: string) => void;
  closeSetup: () => void;
  reset: () => void;
}

export const useUnoGameStore = create<UnoGameStore>((set) => ({
  current: null,
  setupChatId: null,
  setUno: (view, chatId) => set({ current: { ...view, chatId } }),
  clearUno: (chatId) =>
    set((state) => (!chatId || state.current?.chatId === chatId ? { current: null } : {})),
  openSetup: (chatId) => set({ setupChatId: chatId }),
  closeSetup: () => set({ setupChatId: null }),
  reset: () => set({ current: null, setupChatId: null }),
}));
