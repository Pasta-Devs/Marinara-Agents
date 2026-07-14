// ──────────────────────────────────────────────
// Tactical Combat — shared types
// ──────────────────────────────────────────────
// A Fire Emblem / Final Fantasy Tactics style grid battle that runs entirely
// off the existing `Combatant` model (stats + skills). The engine (engine.ts)
// is a set of pure functions; the client renders and animates, the LLM only
// narrates the aftermath from `buildTacticalSummary`.
export const TERRAIN_DATA = {
    plains: { moveCost: 1, defenseBonus: 0, avoidBonus: 0, label: "Plains" },
    forest: { moveCost: 2, defenseBonus: 1, avoidBonus: 15, label: "Forest" },
    mountain: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, impassable: true, label: "Mountain" },
    ruin: { moveCost: 1, defenseBonus: 1, avoidBonus: 10, label: "Ruins" },
    water: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, impassable: true, label: "Water" },
    wall: { moveCost: 99, defenseBonus: 0, avoidBonus: 0, impassable: true, label: "Wall" },
};
//# sourceMappingURL=types.js.map