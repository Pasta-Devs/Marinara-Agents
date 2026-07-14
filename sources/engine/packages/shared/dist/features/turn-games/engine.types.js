// ──────────────────────────────────────────────
// Turn-Game Framework — Engine Contract
// ──────────────────────────────────────────────
// A registry-driven abstraction for deterministic, turn-based games played
// inside a conversation-mode chat (UNO is the first implementation). Each game
// implements `TurnGameEngine` as a set of PURE functions over its own state.
// The engine is the single source of truth for legality, turn order, and win
// conditions; the LLM only proposes moves (validated here) and narrates the
// engine-confirmed outcome. See packages/shared/src/features/turn-games/uno.
//
// Adding a new game = one folder under turn-games/<gameType>/ exporting an
// engine that satisfies this contract, then `pnpm build:shared` regenerates
// the registry. No server route, SSE channel, or DB table changes are needed —
// the runner and persistence layer are game-agnostic.
export {};
//# sourceMappingURL=engine.types.js.map