// Compatibility surface owned by Marinara-Agents. The base Engine intentionally
// no longer exports individual game APIs, while package client sources still
// consume their package-owned defaults and public-state types by name.
export * from "./engine/packages/shared/dist/index.js";
export * from "./engine/packages/shared/dist/features/turn-games/uno/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/chess/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/poker/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/eightball/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/tic-tac-toe/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/rock-paper-scissors/types.js";
