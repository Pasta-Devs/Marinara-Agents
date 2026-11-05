import { METERS, type Meters } from "../types.js";
import { HAFENKAI, type Kit } from "../kit.js";
import type { PlaceKit } from "./types.js";
import { HAFENKAI_PLACE } from "./hafenkai.js";
import { HOLLOWMERE_PLACE } from "./hollowmere.js";
import { SALT_MAGPIE_PLACE } from "./salt-magpie.js";
import { ST_CORVINS_PLACE } from "./st-corvins.js";
import { VALMORA_PLACE } from "./valmora.js";
import { WARD7_PLACE } from "./ward7.js";

/** Built-in kits: the rules-core kit and the full place kit (words and people), by id. */
export const KITS = {
  hafenkai: { rules: { ...HAFENKAI, letters: HAFENKAI_PLACE.guidedLetters }, place: HAFENKAI_PLACE },
  hollowmere: { rules: rulesOf(HOLLOWMERE_PLACE), place: HOLLOWMERE_PLACE },
  ward7: { rules: rulesOf(WARD7_PLACE), place: WARD7_PLACE },
  "salt-magpie": { rules: rulesOf(SALT_MAGPIE_PLACE), place: SALT_MAGPIE_PLACE },
  "st-corvins": { rules: rulesOf(ST_CORVINS_PLACE), place: ST_CORVINS_PLACE },
  valmora: { rules: rulesOf(VALMORA_PLACE), place: VALMORA_PLACE },
} as const;
export { PLACES, placeKitOf } from "./places.js";

/** The rules-core kit for a place kit: used for saved and imported kits, which have no hand-written rules. */
export function rulesOf(k: PlaceKit): Kit {
  return {
    authority: k.authority,
    storyteller: k.storyteller,
    meters: Object.fromEntries(METERS.map((m) => [m, k.meters[m].start])) as Meters,
    people: k.people.map((p) => ({ id: p.id })),
    deputy: (k.people.find((p) => p.deputy) ?? k.people[0]!).id,
    extras: k.extras?.map(({ id, main, value }) => ({ id, main, value })),
    rooms: k.rooms.map((r) => ({ id: r.id, condition: r.condition })),
    relations: k.relations,
    letters: k.guidedLetters,
    hearing: { members: k.hearing.members.map((id) => ({ id, fit: 0, faction: 0 })), ending: k.hearing.ending },
  };
}
