// ──────────────────────────────────────────────
// Store: Game Assets
//
// Owns transient playback selections only. Server-backed
// manifests and mutations live in use-game-assets.ts.
// ──────────────────────────────────────────────
import { create } from "zustand";

interface GameAssetStore {
  /** Currently playing music tag */
  currentMusic: string | null;
  /** Currently playing ambient tag */
  currentAmbient: string | null;
  /** Current scene background tag */
  currentBackground: string | null;
  /** Audio muted */
  audioMuted: boolean;

  // Actions
  setCurrentMusic: (tag: string | null) => void;
  setCurrentAmbient: (tag: string | null) => void;
  setCurrentBackground: (tag: string | null) => void;
  setAudioMuted: (muted: boolean) => void;
  /** Reset playback state (music, ambient, background) — called on chat switch */
  resetPlaybackState: () => void;
}

export const useGameAssetStore = create<GameAssetStore>((set) => ({
  currentMusic: null,
  currentAmbient: null,
  currentBackground: null,
  audioMuted: localStorage.getItem("game-audio-muted") === "true",

  setCurrentMusic: (tag) => set({ currentMusic: tag }),
  setCurrentAmbient: (tag) => set({ currentAmbient: tag }),
  setCurrentBackground: (tag) => set({ currentBackground: tag }),
  setAudioMuted: (muted) => {
    localStorage.setItem("game-audio-muted", JSON.stringify(muted));
    set({ audioMuted: muted });
  },

  resetPlaybackState: () =>
    set({
      currentMusic: null,
      currentAmbient: null,
      currentBackground: null,
    }),
}));
