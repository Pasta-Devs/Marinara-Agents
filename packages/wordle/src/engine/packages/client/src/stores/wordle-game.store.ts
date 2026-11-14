// ──────────────────────────────────────────────
// Zustand Store: Wordle Table
// ──────────────────────────────────────────────
// Holds the live, per-viewer Wordle snapshot of each chat, fetched from the
// game-agnostic /turn-games state resource. Keyed by chatId, so a response for
// a chat the player has left can never replace the visible table. Synchronous
// only — all async lives in use-wordle.ts.
import { create } from "zustand";
import type { WordlePublicView } from "../../../shared/src/features/turn-games/wordle/types";

interface WordleGameStore {
  byChat: Record<string, WordlePublicView>;
  /** Replace a chat's table with a fresh server snapshot. */
  setWordle: (view: WordlePublicView, chatId: string) => void;
  /** Clear a chat's table. */
  clearWordle: (chatId: string) => void;
}

export const useWordleGameStore = create<WordleGameStore>((set) => ({
  byChat: {},
  setWordle: (view, chatId) => set((state) => ({ byChat: { ...state.byChat, [chatId]: view } })),
  clearWordle: (chatId) =>
    set((state) => {
      if (!(chatId in state.byChat)) return {};
      const byChat = { ...state.byChat };
      delete byChat[chatId];
      return { byChat };
    }),
}));
