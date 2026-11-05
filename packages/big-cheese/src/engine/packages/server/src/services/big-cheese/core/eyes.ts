// Big Cheese M4 T13: eyes and ears (modules.md section 4).
// Informants tell the boss one overheard line a week. A planted rumour spreads
// along relations for 3 days, and at 25% it comes back on its starter.
import { dayIndex } from "./clock.js";
import { isKnown, overheard, PAIR_FACTS } from "./people.js";
import { roll } from "./rng.js";
import { addTrust, applyDelta, newId, pure } from "./run.js";
import { DIFFICULTY_FACTOR } from "./types.js";
import type { PlaceKit } from "./kits/types.js";
import type { Run } from "./types.js";

export const FRIEND_TRUST = 60;
export const MAX_INFORMANTS = 3;
export const MAX_RUMOURS = 3;
const SPREAD_DAYS = 3;
const COME_BACK = 0.25;
const TRUST_HIT = -10;

const nameOf = (kit: PlaceKit, id: string) => kit.people.find((p) => p.id === id)?.name ?? id;

/** Ask a person to keep an eye on a room or group. A friend does it free, anyone else costs Money -1 a week. */
export function addInformant(s: Run, kit: PlaceKit, person: string, target: string, kind: "room" | "group") {
  const p = Object.hasOwn(s.people, person) ? s.people[person] : undefined;
  if (!p || p.status !== "active") throw new Error("Nobody by that name can do it.");
  const known = kind === "group" ? kit.groups.some((g) => g.id === target) : kit.rooms.some((r) => r.id === target);
  if (!known) throw new Error("No such place to watch.");
  const rest = s.informants.filter((i) => i.person !== person);
  if (rest.length >= MAX_INFORMANTS) throw new Error("Too many informants already.");
  s.informants = [...rest, { person, target, kind, paid: p.trust < FRIEND_TRUST }];
}

/** The boss plants a line about one person. The starter tells it, and the line spreads along relations. */
export function plantRumour(s: Run, kit: PlaceKit, starter: string, target: string, line: string) {
  const ok = (id: string) => Object.hasOwn(s.people, id) && s.people[id].status === "active";
  if (!ok(starter) || !Object.hasOwn(s.people, target) || starter === target)
    throw new Error("Pick two different people.");
  const text = line.trim().slice(0, 160);
  if (!text) throw new Error("Write the rumour first.");
  const live = s.rumours ?? [];
  if (live.length >= MAX_RUMOURS) throw new Error("Too many rumours are loose already.");
  let reached = [starter];
  for (let d = 0; d < SPREAD_DAYS; d++) {
    const next = new Set(reached);
    for (const r of s.relations) {
      if (reached.includes(r.a)) next.add(r.b);
      if (reached.includes(r.b)) next.add(r.a);
    }
    reached = [...next];
  }
  s.rumours = [...live, { id: newId(s, "u"), line: text, starter, target, day: dayIndex(s.clock), reached }];
}

/** One line from what the informant can hear, or null when there is nothing to hear. */
function heard(s: Run, kit: PlaceKit, i: Run["informants"][number]): string | null {
  if (i.kind === "group") {
    const g = kit.groups.find((x) => x.id === i.target);
    return g ? `${g.name}: ${g.text}` : null;
  }
  const h = overheard(s, i.target);
  const pair = h.pairs.find((r) => isKnown(r, []));
  const fact = pair && PAIR_FACTS[pair.kind];
  if (fact) return fact.replace("{a}", nameOf(kit, pair.a)).replace("{b}", nameOf(kit, pair.b));
  const id = h.people[0];
  return id
    ? `${nameOf(kit, id)} is ${s.people[id].mood} in the ${kit.rooms.find((r) => r.id === i.target)?.name ?? i.target}.`
    : null;
}

/** Friday: informants report and cost Money, old rumours come back or fade. */
export function eyesWeek(s: Run, kit: PlaceKit) {
  if (!s.informants?.length && !s.rumours?.length) return; // nothing planted: the run stays as it was
  const eyes = s.eyes ?? [];
  const hard = DIFFICULTY_FACTOR[s.difficulty ?? "normal"];
  const src = kit.court?.includes("spymaster") ? "A spy reports" : "A camera shows";
  for (const i of s.informants) {
    if (s.people[i.person]?.status !== "active") continue;
    if (i.paid) s.meters = applyDelta(s.meters, { money: -1 }, hard);
    const line = heard(s, kit, i);
    if (line)
      eyes.push({ week: s.clock.week, text: `${i.paid ? src : `${nameOf(kit, i.person)} tells you`}: ${line}` });
  }
  const h = { rng: s.rng };
  const today = dayIndex(s.clock);
  s.rumours = (s.rumours ?? []).filter((r) => {
    if (today - r.day < SPREAD_DAYS) return true;
    if (roll(h) < COME_BACK) {
      addTrust(s, r.target, Math.round(TRUST_HIT * hard));
      eyes.push({
        week: s.clock.week,
        text: `Your rumour about ${nameOf(kit, r.target)} came back. ${nameOf(kit, r.starter)} started it.`,
      });
    }
    return false;
  });
  s.rng = h.rng;
  s.eyes = eyes.slice(-8);
}

export const pureAddInformant = pure(addInformant);
export const purePlantRumour = pure(plantRumour);
export const pureEyesWeek = pure(eyesWeek);
