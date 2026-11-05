// Big Cheese M4 T2: the drawer, evidence, equipment wear and hidden rooms (design.md 14, content.md 6.2).
import type { PlaceKit } from "./kits/types.js";
import { clamp, pure } from "./run.js";
import { openStory, openThread } from "./threads.js";
import type { Run } from "./types.js";

type Thing = Run["things"]["drawer"][number];
const SECRET_AT = 60; // trust, or Love in an absolute kit
const WEAR = 2; // equipment condition lost each Friday
const BROKEN_BELOW = 20;

export function addThing(s: Run, t: Thing) {
  if (!s.things.drawer.some((x) => x.id === t.id)) s.things.drawer.push(t);
}

export function removeThing(s: Run, id: string) {
  s.things.drawer = s.things.drawer.filter((x) => x.id !== id);
}

/** A secret learned at trust 60 (Love 60 in absolute kits) becomes a cover-up thread plus one evidence item. */
export function learnSecret(s: Run, kit: PlaceKit, person: string) {
  const p = s.people[person];
  const text = kit.people.find((x) => x.id === person)?.secret;
  const level = s.authority === "absolute" ? s.power.love : p?.trust;
  if (!p || !text || p.status !== "active" || level < SECRET_AT) return;
  // A thread with this text, open or closed, means the secret is already known.
  if (Object.values(s.threads).some((t) => t.title === text) || s.closed.some((c) => c.title === text)) return;
  const t = openThread(s, { kind: "cover_up", title: text, people: [person], origin: "board" });
  addThing(s, {
    id: `secret-${person}`,
    kind: "evidence",
    name: `${p.name ?? person}: ${text}`,
    about: person,
    thread: t.id,
  });
}

/** Friday: equipment wears 2 and a machine that drops below 20 opens an equipment crisis; secrets are learned. */
export function weekThings(s: Run, kit?: PlaceKit) {
  for (const e of s.things.equipment) {
    const was = e.condition;
    e.condition = clamp(was - WEAR);
    if (was >= BROKEN_BELOW && e.condition < BROKEN_BELOW)
      openStory(s, "crisis", {
        title: `${e.name} is failing`,
        need: "output",
        severity: 2,
        origin: "action",
        stakes: "Work stops until it is fixed.",
      });
  }
  if (kit) for (const id of Object.keys(s.people)) learnSecret(s, kit, id);
}

/** A hidden room opens with its key from the drawer (a key item whose `about` is the room), or by force (a thread or a Board play). */
export function openRoom(s: Run, kit: PlaceKit, room: string, force = false) {
  if (kit.rooms.find((r) => r.id === room)?.kind !== "hidden") throw new Error("That is not a hidden room.");
  if (s.openedRooms.includes(room)) throw new Error("That room is already open.");
  if (!force && !s.things.drawer.some((t) => t.kind === "key" && t.about === room))
    throw new Error("The drawer holds no key for this room.");
  s.openedRooms.push(room);
}

export const isLocked = (s: Run, kit: PlaceKit, room: string) =>
  kit.rooms.find((r) => r.id === room)?.kind === "hidden" && !s.openedRooms.includes(room);

export const pureAddThing = pure(addThing);
export const pureRemoveThing = pure(removeThing);
export const pureLearnSecret = pure(learnSecret);
export const pureOpenRoom = pure(openRoom);
export const pureWeekThings = pure(weekThings);
