import { HAFENKAI } from "../kit.js";
import type { PlaceKit } from "./types.js";
import { HAFENKAI_PLACE } from "./hafenkai.js";

/** Built-in kits: the rules-core kit and the full place kit (words and people), by id. */
export const KITS = {
  hafenkai: { rules: { ...HAFENKAI, letters: HAFENKAI_PLACE.guidedLetters }, place: HAFENKAI_PLACE },
} as const;
export const PLACES = { hafenkai: HAFENKAI_PLACE } as const;

/** The kit a run plays on: its frozen custom kit, else the built-in one. */
export const placeKitOf = (run: { kitId: string; kit?: PlaceKit }): PlaceKit => {
  const kit = run.kit ?? (Object.hasOwn(PLACES, run.kitId) ? PLACES[run.kitId as keyof typeof PLACES] : undefined);
  if (!kit) throw new Error("Unknown place.");
  return kit;
};
