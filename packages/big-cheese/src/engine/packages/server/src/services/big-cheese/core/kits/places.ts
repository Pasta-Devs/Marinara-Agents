// The place table lives here, apart from core/kits/index.ts, so core/people.ts can read it without an import cycle (index -> kit -> people).
import type { PlaceKit } from "./types.js";
import { HAFENKAI_PLACE } from "./hafenkai.js";
import { HOLLOWMERE_PLACE } from "./hollowmere.js";
import { SALT_MAGPIE_PLACE } from "./salt-magpie.js";
import { ST_CORVINS_PLACE } from "./st-corvins.js";
import { VALMORA_PLACE } from "./valmora.js";
import { WARD7_PLACE } from "./ward7.js";

/** Built-in place kits by id. A new built-in kit adds one line here and one in KITS (index.ts). */
export const PLACES = {
  hafenkai: HAFENKAI_PLACE,
  hollowmere: HOLLOWMERE_PLACE,
  ward7: WARD7_PLACE,
  "salt-magpie": SALT_MAGPIE_PLACE,
  "st-corvins": ST_CORVINS_PLACE,
  valmora: VALMORA_PLACE,
} as const;

/** The kit a run plays on: its frozen custom kit, else the built-in one. */
export const placeKitOf = (run: { kitId: string; kit?: PlaceKit }): PlaceKit => {
  const kit = run.kit ?? (Object.hasOwn(PLACES, run.kitId) ? PLACES[run.kitId as keyof typeof PLACES] : undefined);
  if (!kit) throw new Error("Unknown place.");
  return kit;
};
