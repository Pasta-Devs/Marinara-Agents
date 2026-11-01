// ──────────────────────────────────────────────
// Otome Forge: reduced motion, asked for by the system or by the Engine
// ──────────────────────────────────────────────
// Motion stops under prefers-reduced-motion and under the Engine's "Reduce Ambient Animations & Effects", which marks
// <html data-marinara-reduced-effects="true">. The stylesheet writes each reduced rule once (reducedRules) and
// useReducedMotion (hooks/use-reader.ts) reads both (reducedFrom). Pure.
// ──────────────────────────────────────────────

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const REDUCED_EFFECTS_ATTRIBUTE = "data-marinara-reduced-effects";
/** <html> while the Engine's "Reduce Ambient Animations & Effects" is on. */
export const REDUCED_EFFECTS = `html[${REDUCED_EFFECTS_ATTRIBUTE}="true"]`;

/** `rules(root)` under the system's query on `.of-root`, then again on `.of-root` under the Engine's flag. */
export function reducedRules(rules: (root: string) => string): string {
  return `@media ${REDUCED_MOTION_QUERY} {${rules(".of-root")}\n}\n${rules(`${REDUCED_EFFECTS} .of-root`)}`;
}

/** True when the system asks for reduced motion or the Engine's flag is on <html> (its `dataset`). */
export function reducedFrom(systemReduces: boolean, dataset: DOMStringMap | undefined): boolean {
  return systemReduces || dataset?.marinaraReducedEffects === "true";
}
