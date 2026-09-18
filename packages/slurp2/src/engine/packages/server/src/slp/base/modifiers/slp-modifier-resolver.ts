/**
 * Applying modifiers to one number.
 *
 * Deterministic by construction: the modifiers are sorted by source before anything is applied, all
 * multiplies go first, then all adds. Two events that overlap therefore give the same answer in
 * either save order, and the same answer again after a restart.
 *
 * The resolver deliberately does not round or clamp. The consumer owns the range of its own number,
 * and rounding once at the end keeps two modifiers from compounding two rounding errors.
 */
import type { SlpModifier, SlpModifierTarget } from "./slp-modifier.types.js";

/** Stable order: source kind, then source id, then operation, then value. */
function compareModifiers(a: SlpModifier, b: SlpModifier): number {
  return (
    a.source.kind.localeCompare(b.source.kind) ||
    a.source.id.localeCompare(b.source.id) ||
    a.operation.localeCompare(b.operation) ||
    a.value - b.value
  );
}

export function slpModifiersForTarget(modifiers: readonly SlpModifier[], target: SlpModifierTarget): SlpModifier[] {
  return modifiers.filter((item) => item.target === target).sort(compareModifiers);
}

/**
 * `base`, with every modifier for `target` applied. Returns an exact, unrounded, unclamped number;
 * `base` itself is returned untouched when nothing applies.
 */
export function slpApplyModifiers(base: number, modifiers: readonly SlpModifier[], target: SlpModifierTarget): number {
  const selected = slpModifiersForTarget(modifiers, target);
  if (selected.length === 0) return base;
  let value = base;
  for (const item of selected) if (item.operation === "multiply") value *= item.value;
  for (const item of selected) if (item.operation === "add") value += item.value;
  return value;
}
