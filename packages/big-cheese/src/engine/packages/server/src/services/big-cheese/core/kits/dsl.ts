// Short builders for the hand-written place kits. They return plain kit data and add no logic.
import type { Meter, Slot } from "../types.js";
import type { CardTemplate, KitPerson, KitRoom } from "./types.js";

const FEED: Record<string, Meter | null> = { S: "standing", O: "output", P: "people", M: "money", "": null };

/** feeds is one letter: S standing, O output, P people, M money, or "" for none. */
export const room = (
  id: string,
  name: string,
  kind: KitRoom["kind"],
  condition: number,
  feeds: string,
  text: string,
): KitRoom => ({
  id,
  name,
  kind,
  condition,
  feeds: FEED[feeds]!,
  text,
});

/** routine lists the five slots (morning to night) as room ids, "home" when away. */
export const person = (
  id: string,
  name: string,
  role: string,
  colour: string,
  traits: string,
  ambition: string,
  secret: string,
  routine: string,
  style: string,
  phrases: string[],
  deputy?: boolean,
): KitPerson => {
  const r = routine.split(" ");
  return {
    id,
    name,
    role,
    colour,
    ...(deputy ? { deputy } : {}),
    traits: traits.split(", "),
    ambition,
    secret,
    routine: Object.fromEntries(
      ["morning", "midday", "afternoon", "evening", "night"].map((s, i) => [s, r[i]!]),
    ) as Record<Slot, string>,
    voice: { style, phrases },
  };
};

export const card = (ask: string, strong: string, middle: string, weak: string): CardTemplate => ({
  ask,
  strong,
  middle,
  weak,
});
