import { useSetSlurpCreatorPrice } from "./slp-economy-hooks";

/** The per-creator price mutation the Backstage creator table drives. */
export function useSlpEconomyBackstageState() {
  return { setCreatorPrice: useSetSlurpCreatorPrice() };
}

export type SlpEconomyBackstageState = ReturnType<typeof useSlpEconomyBackstageState>;
