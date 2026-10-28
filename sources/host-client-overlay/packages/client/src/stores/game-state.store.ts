// ──────────────────────────────────────────────
// The Engine's game state store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Package code reaches it through the Engine's chat and game hooks. This file is stacked over the vendored module, so
// they read and update `__MARINARA_HOST__.stores.gameState` instead of a copy nobody reads.
import { create } from "zustand";
import type { GameState } from "@marinara-engine/shared";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

/** What package code reads from the Engine's game state store. */
export type GameStateStore = {
  current: GameState | null;
  setGameState: (state: GameState | null) => void;
  reset: () => void;
};

export const useGameStateStore: BoundStore<GameStateStore> =
  hostStore<GameStateStore>("gameState") ??
  readOnlyStore<GameStateStore>(create, { current: null, setGameState: () => undefined, reset: () => undefined });
