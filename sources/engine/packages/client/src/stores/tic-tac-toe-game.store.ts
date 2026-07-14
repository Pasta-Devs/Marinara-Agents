// ──────────────────────────────────────────────
// Zustand Store: Tic-Tac-Toe Board (turn-game)
// ──────────────────────────────────────────────
// Holds the live, per-viewer tic-tac-toe snapshot pushed by the server
// (turn_game_state_patch SSE, dispatched by gameType) or fetched on mount.
// chatId-guarded so a background chat's game can never paint over the visible
// board. Synchronous only — all async lives in use-tic-tac-toe.ts.
import { create } from "zustand";
import type { TicTacToePublicView } from "@marinara-engine/shared";

export type TicTacToeBoardSnapshot = TicTacToePublicView & { chatId: string };

interface TicTacToeGameStore {
  current: TicTacToeBoardSnapshot | null;
  /** Chat whose setup modal is open (null = closed). Driven by the /tictactoe command. */
  setupChatId: string | null;
  /** Replace the board with a fresh server snapshot for a chat. */
  setTicTacToe: (view: TicTacToePublicView, chatId: string) => void;
  /** Clear the board (optionally only if it belongs to a given chat). */
  clearTicTacToe: (chatId?: string) => void;
  /** Open the game-setup modal for a chat. */
  openSetup: (chatId: string) => void;
  closeSetup: () => void;
  reset: () => void;
}

export const useTicTacToeGameStore = create<TicTacToeGameStore>((set) => ({
  current: null,
  setupChatId: null,
  setTicTacToe: (view, chatId) => set({ current: { ...view, chatId } }),
  clearTicTacToe: (chatId) =>
    set((state) => (!chatId || state.current?.chatId === chatId ? { current: null } : {})),
  openSetup: (chatId) => set({ setupChatId: chatId }),
  closeSetup: () => set({ setupChatId: null }),
  reset: () => set({ current: null, setupChatId: null }),
}));
