// ──────────────────────────────────────────────
// Big Cheese: Layer Horror (modules.md section 2)
// ──────────────────────────────────────────────
// A dark secret, things at night, a missing person, a sealed room and a final night. Each thread is a
// personal_arc with layer "horror"; `stakes` holds "horror:<kind>[:<id>]" so the close hook knows what to do.
import { bookBigScene } from "./bigscenes.js";
import { WEEKS, dayIndex } from "./clock.js";
import { placeKitOf } from "./kits/places.js";
import { pick, roll } from "./rng.js";
import { newId } from "./run.js";
import { addThing, openRoom } from "./things.js";
import { openThread } from "./threads.js";
import type { PlaceKit } from "./kits/types.js";
import type { Run, Thread } from "./types.js";

const dialOf = (s: Run) => s.layers?.horror ?? 0; // opt-in layer: no dial, no horror
const CHANCE = 0.5; // weekly chance at dial 100
const FINAL = "horror:final";
const NIGHTS = [
  "A light moves in the empty hall",
  "Steps cross the roof at night",
  "The lamps go out one by one",
  "A door that was shut stands open",
];

// The saved game carries kitId (and a custom kit); a bare core run has neither, so it has no sealed rooms.
export const kitOf = (s: Run) => {
  const r = s as Run & { kitId?: string; kit?: PlaceKit };
  return r.kitId ? placeKitOf({ kitId: r.kitId, kit: r.kit }) : undefined;
};
const nameOf = (s: Run, id: string) => s.people[id]?.name ?? id;

/** Opens a horror thread with one card beat tomorrow. `who` is the person who brings it to the boss. */
function start(s: Run, title: string, stakes: string, who: string) {
  const t = openThread(s, {
    kind: "personal_arc",
    title,
    origin: "arc",
    people: [who],
    need: "people",
    severity: 2,
    stakes,
  });
  t.layer = "horror";
  t.beats.push({
    id: newId(s, "b"),
    type: "card",
    planned: { week: s.clock.week, day: s.clock.day + 1 },
    seed: { need: "people", severity: 1 },
  });
}

/** The last two weeks: the final night is booked once, on the last week of the year. */
function finalNight(s: Run) {
  if (s.clock.week < WEEKS - 1 || s.closed.some((c) => c.title === "The final night")) return;
  let t = Object.values(s.threads).find((x) => x.stakes === FINAL);
  if (!t) {
    t = openThread(s, {
      kind: "follow_up",
      title: "The final night",
      origin: "arc",
      people: [],
      need: "people",
      severity: 3,
      stakes: FINAL,
      dueWeek: WEEKS,
    });
    t.layer = "horror";
  }
  // ponytail: if the last week has no free big-scene slot, the night is never booked; add a forced slot when it matters.
  if (!t.beats.some((b) => b.type === "big_scene"))
    bookBigScene(s, t, "final_night", dayIndex({ week: WEEKS, day: 0 }));
}

/** Monday: a dial above 0 may open one horror thread (one at a time), and the final night comes. */
export function horrorSeeds(s: Run) {
  const d = dialOf(s);
  if (!d) return;
  finalNight(s);
  if (Object.values(s.threads).some((t) => t.layer === "horror" && t.stakes !== FINAL)) return;
  if (roll(s) >= (d / 100) * CHANCE) return;
  const live = Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
  if (live.length < 3) return;
  const who = pick(s, live);
  const kind = pick(s, ["secret", "night", "missing", "sealed"]);
  if (kind === "missing") {
    const gone = pick(
      s,
      live.filter((id) => id !== s.deputy && id !== who),
    );
    s.people[gone]!.status = "missing";
    return start(s, `${nameOf(s, gone)} did not come in`, `horror:missing:${gone}`, who);
  }
  const room = kitOf(s)?.rooms.find(
    (r) =>
      r.kind === "hidden" &&
      !s.openedRooms.includes(r.id) &&
      !Object.values(s.threads).some((t) => t.stakes === `horror:sealed:${r.id}`),
  );
  if (kind === "sealed" && room) return start(s, `Nobody can open ${room.name}`, `horror:sealed:${room.id}`, who);
  if (kind === "secret") return start(s, "Someone hides a dark secret", `horror:secret:${who}`, who);
  start(s, pick(s, NIGHTS), "horror:night", who);
}

/** A horror thread has ended: the missing person is back (won) or gone (lost), a sealed room opens, a secret is found. */
export function horrorClosed(s: Run, t: Thread, state: Thread["state"]) {
  const [, kind, id] = (t.stakes ?? "").split(":");
  if (!t.stakes?.startsWith("horror:") || !id) return;
  if (kind === "missing" && s.people[id]) s.people[id].status = state === "won" ? "active" : "quit";
  if (kind === "sealed" && state === "won" && kitOf(s) && !s.openedRooms.includes(id)) openRoom(s, kitOf(s)!, id, true);
  if (kind === "secret" && state === "won")
    addThing(s, { id: `horror-${t.id}`, kind: "evidence", name: t.title, about: id, thread: t.id });
}
