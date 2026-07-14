// ──────────────────────────────────────────────
// Zustand Store: Rock-Paper-Scissors Match (turn-game)
// ──────────────────────────────────────────────
// Holds the live, per-viewer rock-paper-scissors snapshot pushed by the
// server (turn_game_state_patch SSE, dispatched by gameType) or fetched on
// mount. chatId-guarded so a background chat's match can never paint over the
// visible board. Synchronous only — all async lives in use-rock-paper-scissors.ts.
import { create } from "zustand";
import type { RockPaperScissorsPublicView } from "@marinara-engine/shared";

export type RockPaperScissorsSnapshot = RockPaperScissorsPublicView & { chatId: string };

interface RockPaperScissorsGameStore {
  current: RockPaperScissorsSnapshot | null;
  /** Chat whose setup modal is open (null = closed). Driven by the /rps command. */
  setupChatId: string | null;
  /** Replace the match with a fresh server snapshot for a chat. */
  setRockPaperScissors: (view: RockPaperScissorsPublicView, chatId: string) => void;
  /** Clear the match (optionally only if it belongs to a given chat). */
  clearRockPaperScissors: (chatId?: string) => void;
  /** Open the game-setup modal for a chat. */
  openSetup: (chatId: string) => void;
  closeSetup: () => void;
  reset: () => void;
}

export const useRockPaperScissorsGameStore = create<RockPaperScissorsGameStore>((set) => ({
  current: null,
  setupChatId: null,
  setRockPaperScissors: (view, chatId) => set({ current: { ...view, chatId } }),
  clearRockPaperScissors: (chatId) =>
    set((state) => (!chatId || state.current?.chatId === chatId ? { current: null } : {})),
  openSetup: (chatId) => set({ setupChatId: chatId }),
  closeSetup: () => set({ setupChatId: null }),
  reset: () => set({ current: null, setupChatId: null }),
}));
