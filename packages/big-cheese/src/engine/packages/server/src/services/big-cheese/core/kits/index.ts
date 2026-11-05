import { METERS, type Meters } from "../types.js";
import { HAFENKAI, type Kit } from "../kit.js";
import type { PlaceKit } from "./types.js";
import { HAFENKAI_PLACE } from "./hafenkai.js";

/** Built-in kits: the rules-core kit and the full place kit (words and people), by id. */
export const KITS = {
  hafenkai: { rules: { ...HAFENKAI, letters: HAFENKAI_PLACE.guidedLetters }, place: HAFENKAI_PLACE },
} as const;
export { PLACES, placeKitOf } from "./places.js";

/** The rules-core kit for a place kit: used for saved and imported kits, which have no hand-written rules. */
export const rulesOf = (k: PlaceKit): Kit => ({
  authority: k.authority,
  storyteller: k.storyteller,
  meters: Object.fromEntries(METERS.map((m) => [m, k.meters[m].start])) as Meters,
  people: k.people.map((p) => ({ id: p.id })),
  deputy: (k.people.find((p) => p.deputy) ?? k.people[0]!).id,
  rooms: k.rooms.map((r) => ({ id: r.id, condition: r.condition })),
  relations: k.relations,
  letters: k.guidedLetters,
  hearing: { members: k.hearing.members.map((id) => ({ id, fit: 0, faction: 0 })), ending: k.hearing.ending },
});
