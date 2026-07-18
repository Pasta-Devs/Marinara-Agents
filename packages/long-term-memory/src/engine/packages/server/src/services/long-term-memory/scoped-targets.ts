import type { LtmScope } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { isGlobalLtmScope, ltmScopesOverlap } from "../../../../shared/src/features/agents/long-term-memory/scope.js";

export function canUpdateLtmScopedTarget(existingScope: LtmScope, incomingScope: LtmScope) {
  const existingGlobal = isGlobalLtmScope(existingScope);
  const incomingGlobal = isGlobalLtmScope(incomingScope);
  if (existingGlobal || incomingGlobal) return existingGlobal && incomingGlobal;
  return ltmScopesOverlap(existingScope, incomingScope, { includeGlobal: false });
}
