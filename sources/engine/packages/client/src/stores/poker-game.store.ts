// ──────────────────────────────────────────────
// Zustand Store: Poker Table (turn-game #3)
// ──────────────────────────────────────────────
// Holds the live, per-viewer poker snapshot pushed by the server
// (turn_game_state_patch SSE, dispatched by gameType) or fetched on mount.
// chatId-guarded so a background chat's game can never paint over the visible
// table. Synchronous only — all async lives in use-poker.ts.
import { create } from "zustand";
import type { PokerPublicView } from "@marinara-engine/shared";

export type PokerBoardSnapshot = PokerPublicView & { chatId: string };

interface PokerGameStore {
  current: PokerBoardSnapshot | null;
  /** Chat whose setup modal is open (null = closed). Driven by the /poker command. */
  setupChatId: string | null;
  /** Replace the table with a fresh server snapshot for a chat. */
  setPoker: (view: PokerPublicView, chatId: string) => void;
  /** Clear the table (optionally only if it belongs to a given chat). */
  clearPoker: (chatId?: string) => void;
  /** Open the game-setup modal for a chat. */
  openSetup: (chatId: string) => void;
  closeSetup: () => void;
  reset: () => void;
}

export const usePokerGameStore = create<PokerGameStore>((set) => ({
  current: null,
  setupChatId: null,
  setPoker: (view, chatId) => set({ current: { ...view, chatId } }),
  clearPoker: (chatId) =>
    set((state) => (!chatId || state.current?.chatId === chatId ? { current: null } : {})),
  openSetup: (chatId) => set({ setupChatId: chatId }),
  closeSetup: () => set({ setupChatId: null }),
  reset: () => set({ current: null, setupChatId: null }),
}));
