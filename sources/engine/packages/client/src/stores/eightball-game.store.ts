// ──────────────────────────────────────────────
// Zustand Store: 8-Ball Pool Table (turn-game #4)
// ──────────────────────────────────────────────
// Holds the live, per-viewer 8-ball snapshot pushed by the server
// (turn_game_state_patch SSE, dispatched by gameType) or fetched on mount.
// chatId-guarded so a background chat's game can never paint over the visible
// table. Synchronous only — all async lives in use-eightball.ts.
import { create } from "zustand";
import type { EightBallPublicView } from "@marinara-engine/shared";

export type EightBallBoardSnapshot = EightBallPublicView & { chatId: string };

interface EightBallGameStore {
  current: EightBallBoardSnapshot | null;
  /** Chat whose setup modal is open (null = closed). Driven by the /8ball command. */
  setupChatId: string | null;
  /**
   * The `shotCounter` of the last shot the board finished (or skipped)
   * animating. Lives HERE — not in board React state — so a board
   * remount/chat-tab flicker can't replay an already-seen animation.
   * `setEightBall` fast-forwards it on chat switch and on lastShot-less
   * snapshots (fresh game / hydration) so a historical shot is never animated
   * on mount; the board only animates when `view.shotCounter` differs.
   */
  lastAnimatedShotCounter: number;
  /** Replace the table with a fresh server snapshot for a chat. */
  setEightBall: (view: EightBallPublicView, chatId: string) => void;
  /** Record that the board has animated (or deliberately skipped) the shot
   * identified by `shotCounter`. */
  markShotAnimated: (shotCounter: number) => void;
  /** Clear the table (optionally only if it belongs to a given chat). */
  clearEightBall: (chatId?: string) => void;
  /** Open the game-setup modal for a chat. */
  openSetup: (chatId: string) => void;
  closeSetup: () => void;
  reset: () => void;
}

export const useEightBallGameStore = create<EightBallGameStore>((set) => ({
  current: null,
  setupChatId: null,
  lastAnimatedShotCounter: 0,
  setEightBall: (view, chatId) =>
    set((state) => {
      // Don't animate a shot the viewer didn't just witness: hydrating a
      // different chat's table (or any snapshot that carries no lastShot —
      // fresh game, next_rack reset) marks the current counter as already
      // animated. Same-chat snapshots WITH a lastShot leave the marker alone
      // so the board can compare and animate genuinely new shots.
      const skipTo =
        state.current?.chatId !== chatId || view.lastShot === null
          ? { lastAnimatedShotCounter: view.shotCounter }
          : {};
      return { current: { ...view, chatId }, ...skipTo };
    }),
  markShotAnimated: (shotCounter) => set({ lastAnimatedShotCounter: shotCounter }),
  clearEightBall: (chatId) =>
    set((state) => (!chatId || state.current?.chatId === chatId ? { current: null } : {})),
  openSetup: (chatId) => set({ setupChatId: chatId }),
  closeSetup: () => set({ setupChatId: null }),
  reset: () => set({ current: null, setupChatId: null, lastAnimatedShotCounter: 0 }),
}));
