// ──────────────────────────────────────────────
// Tactical Combat — public API
// ──────────────────────────────────────────────
// Curated surface consumed by the server endpoints (Phase B) and the client
// TacticalCombatUI (Phase C). Internal helpers used only by ai.ts stay in
// engine.ts and are intentionally not re-exported here.
export * from "./types.js";
export { createTacticalCombat, getUnit, getMovementRange, getTargetsInRange, forecastAttack, applyAction, isTerminal, buildTacticalSummary, } from "./engine.js";
export { runEnemyPhase } from "./ai.js";
export { TERRAIN_DATA } from "./types.js";
export { deriveMovement, elementMultiplier, DIFFICULTY_DAMAGE_MULT } from "./math.js";
export { CLASS_PROFILES, deriveClass, normalizeClass } from "./classes.js";
export { gridDimensions } from "./grid-gen.js";
//# sourceMappingURL=index.js.map