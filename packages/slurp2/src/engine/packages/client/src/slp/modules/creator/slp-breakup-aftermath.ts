import type { SlpBreakupAftermath } from "../../../../../shared/src/slp/slp-actions.js";

/** A breakup's three ways it can go; an ex switches to the way it is not on yet (#1293). */
export function slpAftermathChoices(couple: {
  stage: string;
  aftermath?: SlpBreakupAftermath | null;
}): SlpBreakupAftermath[] {
  return couple.stage === "split"
    ? (["moveOn", "forget"] as const).filter((choice) => choice !== couple.aftermath)
    : ["keep", "moveOn", "forget"];
}
