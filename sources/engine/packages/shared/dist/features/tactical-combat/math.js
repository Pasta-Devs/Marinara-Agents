// ──────────────────────────────────────────────
// Tactical Combat — pure combat math
// ──────────────────────────────────────────────
// Stateless helpers: distance, terrain lookups, stat-derived movement / range,
// the element multiplier table (mirrors the classic element wheel, simplified
// to strong 1.5x / weak 0.5x per the plan), and the hit / crit / damage
// formulas. Kept separate from engine.ts so both the resolver and the forecast
// compute from the exact same primitives (forecast MUST match applyAction
// statistically).
import { CLASS_PROFILES } from "./classes.js";
import { TERRAIN_DATA } from "./types.js";
export function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
}
export function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
export function inBounds(grid, x, y) {
    return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}
export function terrainAt(grid, x, y) {
    if (!inBounds(grid, x, y))
        return "wall";
    return grid.tiles[y][x];
}
export function terrainInfoAt(grid, x, y) {
    return TERRAIN_DATA[terrainAt(grid, x, y)];
}
export function isImpassable(grid, x, y) {
    return !!terrainInfoAt(grid, x, y).impassable;
}
/** Movement points per turn from speed (class moveBonus is applied at unit creation). */
export function deriveMovement(speed) {
    return clamp(3 + Math.floor(speed / 10), 3, 6);
}
// ── Difficulty ──
/** Classic combat difficulty multipliers (combat.service.ts). Applied to ENEMY damage in tactical. */
export const DIFFICULTY_DAMAGE_MULT = {
    casual: 0.6,
    normal: 1.0,
    hard: 1.3,
    brutal: 1.6,
};
// ── Elements ──
// Simplified wheel over the classic six elements. Fire/Ice/Lightning form a
// rock-paper-scissors trio; Holy and Shadow are mutually super-effective;
// Poison is neutral. strong = 1.5x, weak = 0.5x, otherwise 1.0x.
const STRONG_AGAINST = {
    fire: ["ice"],
    ice: ["lightning"],
    lightning: ["fire"],
    holy: ["shadow"],
    shadow: ["holy"],
    poison: [],
};
const WEAK_AGAINST = {
    fire: ["lightning"],
    ice: ["fire"],
    lightning: ["ice"],
    holy: [],
    shadow: [],
    poison: [],
};
export function elementMultiplier(attackElement, defenderElement) {
    if (!attackElement || !defenderElement)
        return 1;
    const a = attackElement.toLowerCase();
    const d = defenderElement.toLowerCase();
    if (a === d)
        return 1;
    if (STRONG_AGAINST[a]?.includes(d))
        return 1.5;
    if (WEAK_AGAINST[a]?.includes(d))
        return 0.5;
    return 1;
}
// ── Status-effect derived stats ──
export function activeEffects(unit) {
    return (unit.statusEffects ?? []).filter((e) => e.turnsLeft > 0);
}
function statModifier(unit, stat) {
    return activeEffects(unit)
        .filter((e) => e.stat === stat)
        .reduce((sum, e) => sum + e.modifier, 0);
}
export function effectiveAttack(unit) {
    return Math.max(1, unit.attack + statModifier(unit, "attack"));
}
export function effectiveDefense(unit) {
    return Math.max(0, unit.defense + statModifier(unit, "defense"));
}
export function effectiveSpeed(unit) {
    return Math.max(0, unit.speed + statModifier(unit, "speed"));
}
// ── Hit / crit / damage ──
export function terrainAvoid(grid, unit) {
    return terrainInfoAt(grid, unit.x, unit.y).avoidBonus;
}
/** 0–100 chance the attack lands. */
export function hitChance(grid, attacker, defender) {
    const raw = 80 +
        (effectiveSpeed(attacker) - effectiveSpeed(defender)) * 2 -
        terrainAvoid(grid, defender) -
        (defender.defending ? 10 : 0);
    return clamp(Math.round(raw), 30, 100);
}
/** 0–60 chance of a x2 critical. Adds the attacker's class crit bonus (absent class → fighter, +0). */
export function critChance(attacker, defender) {
    const critBonus = CLASS_PROFILES[attacker.unitClass ?? "fighter"].critBonus;
    return clamp(Math.round(5 + Math.max(0, effectiveSpeed(attacker) - effectiveSpeed(defender)) + critBonus), 0, 60);
}
/**
 * Damage for a single landed strike. Deterministic given inputs.
 * base = attack*power*roll, scaled by level difference (±50% cap), minus
 * defense*0.6 + terrainDef*2; then element, crit (x2), defending (halve), and
 * enemy-side difficulty multiplier. Floors to >= 1.
 */
export function computeDamage(inp) {
    const { grid, attacker, defender, roll, crit, difficulty } = inp;
    const power = inp.power ?? 1;
    const element = inp.element ?? attacker.element;
    const base = effectiveAttack(attacker) * power * roll;
    const levelScale = clamp(1 + (attacker.level - defender.level) * 0.05, 0.5, 1.5);
    const raw = base * levelScale;
    const defTile = terrainInfoAt(grid, defender.x, defender.y);
    const mitigation = effectiveDefense(defender) * 0.6 + defTile.defenseBonus * 2;
    let dmg = raw - mitigation;
    dmg *= elementMultiplier(element, defender.element);
    if (crit)
        dmg *= 2;
    if (defender.defending)
        dmg *= 0.5;
    if (attacker.side === "enemy")
        dmg *= DIFFICULTY_DAMAGE_MULT[difficulty];
    return Math.max(1, Math.floor(dmg));
}
/** Heal amount for a heal skill (mirrors classic resolveSkillAction heal math). */
export function computeHeal(caster, power) {
    return Math.max(1, Math.floor((effectiveAttack(caster) + caster.level * 2) * Math.max(power, 0.5)));
}
//# sourceMappingURL=math.js.map