// ──────────────────────────────────────────────
// Zustand Store: Blackjack Table
// ──────────────────────────────────────────────
// Holds the live, per-viewer blackjack snapshot of each chat, fetched from the
// game-agnostic /turn-games state resource. Keyed by chatId, so a response for
// a chat the player has left can never replace the visible table. Synchronous
// only — all async lives in use-blackjack.ts.
import { create } from "zustand";
import type { BlackjackPublicView } from "../../../shared/src/features/turn-games/blackjack/types";

interface BlackjackGameStore {
  byChat: Record<string, BlackjackPublicView>;
  /** Replace a chat's table with a fresh server snapshot. */
  setBlackjack: (view: BlackjackPublicView, chatId: string) => void;
  /** Clear a chat's table. */
  clearBlackjack: (chatId: string) => void;
}

export const useBlackjackGameStore = create<BlackjackGameStore>((set) => ({
  byChat: {},
  setBlackjack: (view, chatId) => set((state) => ({ byChat: { ...state.byChat, [chatId]: view } })),
  clearBlackjack: (chatId) =>
    set((state) => {
      if (!(chatId in state.byChat)) return {};
      const byChat = { ...state.byChat };
      delete byChat[chatId];
      return { byChat };
    }),
}));
