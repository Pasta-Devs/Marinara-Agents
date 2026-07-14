// ──────────────────────────────────────────────
// Turn-Game Runtime Registry
// ──────────────────────────────────────────────
import type { AnyTurnGameEngine } from "./engine.types.js";
import { TURN_GAME_ENGINES as GENERATED_TURN_GAME_ENGINES } from "./registry.generated.js";

/** Compatibility source for upgrades and deterministic tests. Fresh installs do not activate it. */
export const BUNDLED_TURN_GAME_ENGINES: readonly AnyTurnGameEngine[] = GENERATED_TURN_GAME_ENGINES;
const activeEngines = new Map<string, AnyTurnGameEngine>();

export function registerTurnGameEngine(engine: AnyTurnGameEngine): () => void {
  if (activeEngines.has(engine.gameType)) throw new Error(`Turn-game engine ${engine.gameType} is already registered`);
  activeEngines.set(engine.gameType, engine);
  return () => {
    if (activeEngines.get(engine.gameType) === engine) activeEngines.delete(engine.gameType);
  };
}

export function resetTurnGameRegistry(includeBundled = false): void {
  activeEngines.clear();
  if (includeBundled) {
    for (const engine of BUNDLED_TURN_GAME_ENGINES) activeEngines.set(engine.gameType, engine);
  }
}

export function getTurnGameEngine(gameType: string): AnyTurnGameEngine | null {
  return activeEngines.get(gameType) ?? null;
}

export interface TurnGameSummary {
  gameType: string;
  label: string;
  minPlayers: number;
  maxPlayers: number;
}

export function listTurnGames(): TurnGameSummary[] {
  return [...activeEngines.values()].map((engine) => ({
    gameType: engine.gameType,
    label: engine.label,
    minPlayers: engine.minPlayers,
    maxPlayers: engine.maxPlayers,
  }));
}

export function listTurnGameTypes(): string[] {
  return [...activeEngines.keys()];
}
