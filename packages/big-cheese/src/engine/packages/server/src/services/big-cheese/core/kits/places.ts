// The place table lives here, apart from core/kits/index.ts, so core/people.ts can read it without an import cycle (index -> kit -> people).
import type { PlaceKit } from "./types.js";
import { HAFENKAI_PLACE } from "./hafenkai.js";

/** Built-in place kits by id. A new built-in kit adds one line here and one in KITS (index.ts). */
export const PLACES = { hafenkai: HAFENKAI_PLACE } as const;

/** The kit a run plays on: its frozen custom kit, else the built-in one. */
export const placeKitOf = (run: { kitId: string; kit?: PlaceKit }): PlaceKit => {
  const kit = run.kit ?? (Object.hasOwn(PLACES, run.kitId) ? PLACES[run.kitId as keyof typeof PLACES] : undefined);
  if (!kit) throw new Error("Unknown place.");
  return kit;
};
