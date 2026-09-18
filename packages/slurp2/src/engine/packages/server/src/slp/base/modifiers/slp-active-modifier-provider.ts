/**
 * The provider a consuming feature is handed.
 *
 * It is the whole seam: Economy depends on this interface, never on World. The provider owns no
 * clock and no registry — every source is passed in, and the evaluation time comes from the caller,
 * so the same call at the same timestamp always gives the same modifiers.
 */
import { slpModifiersForTarget } from "./slp-modifier-resolver.js";
import type {
  SlpActiveModifierProvider,
  SlpModifier,
  SlpModifierSource,
  SlpModifierTarget,
} from "./slp-modifier.types.js";

export function createSlpActiveModifierProvider(sources: readonly SlpModifierSource[]): SlpActiveModifierProvider {
  return {
    modifiersFor(target: SlpModifierTarget, at: Date): SlpModifier[] {
      const collected: SlpModifier[] = [];
      for (const source of sources) collected.push(...source(at));
      return slpModifiersForTarget(collected, target);
    },
  };
}

/** A provider with nothing running. Useful where a consumer has no sources wired yet. */
export const SLP_NO_ACTIVE_MODIFIERS: SlpActiveModifierProvider = { modifiersFor: () => [] };
