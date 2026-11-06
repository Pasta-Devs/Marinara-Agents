// ──────────────────────────────────────────────
// Big Cheese: advisors and office hours (modules.md section 4, design.md section 4.2)
// ──────────────────────────────────────────────
// The code picks which answer each advisor leans to; the model only words the advice. Following
// the advice raises influence, a week of ignored advice makes the advisor sulk. Pure and rng-free.

import { HOURS } from "./clock.js";
import { visitBonus } from "./building.js"; // M4 T16
import { addTrust, clamp, pure, spendHour } from "./run.js";
import { OFFICE_HOURS_CAP } from "./types.js";
import type { PlaceKit } from "./kits/types.js";
import type { Answer, Run } from "./types.js";

export const ADVISOR_CAP = 3;
const FOLLOW = 5; // influence gained when the boss takes the advice
const SULK = 10; // influence lost on a Friday after a week without a follow
const VISIT_TRUST = 2;

/** Stances each trait pushes toward (content.md section 1.6, asker traits). */
const TRAIT_STANCES: Record<string, readonly string[]> = {
  strict: ["decree", "punish", "refuse"],
  generous: ["reward", "invest"],
  sly: ["delegate"],
  cautious: ["delay"],
  honest: ["ask_others"],
  proud: ["reward", "appoint"],
};

/** The offered stance an advisor leans to: most trait hits wins, no hit means the middle answer. */
export function lean(kit: PlaceKit, id: string, offer: Pick<Answer, "stance">[]): string {
  const traits = kit.people.find((p) => p.id === id)?.traits ?? [];
  const score = (stance: string) =>
    traits.filter((t) => Object.hasOwn(TRAIT_STANCES, t) && TRAIT_STANCES[t].includes(stance)).length;
  return offer.reduce((best, a) => (score(a.stance) > score(best.stance) ? a : best), offer[1] ?? offer[0]!).stance;
}

/** One lean per advisor who is still around, for a card's offer. */
export const advisorLeans = (s: Run, kit: PlaceKit, offer: Pick<Answer, "stance">[]) =>
  s.advisors.filter((id) => s.people[id]?.status === "active").map((who) => ({ who, stance: lean(kit, who, offer) }));

/** Sets the inner circle: up to 3 active people. New advisors start at influence 50. */
export function setCircle(s: Run, ids: string[]) {
  if (new Set(ids).size !== ids.length || ids.length > ADVISOR_CAP)
    throw new Error(`Pick up to ${ADVISOR_CAP} different advisors`);
  for (const id of ids) {
    const p = Object.hasOwn(s.people, id) ? s.people[id] : undefined;
    if (p?.status !== "active") throw new Error(`Not a person who can advise: ${id}`);
    if (!s.advisors.includes(id)) {
      p.influence = 50;
      p.advisedWeek = s.clock.week; // a grace week before the first sulk
    }
  }
  s.advisors = ids;
}

/** An answer that matches an advisor's lean is a follow: influence up, the sulk clock resets. */
export function followAdvice(s: Run, advice: { who: string; stance: string }[] | undefined, stance: string) {
  for (const a of advice ?? []) {
    const p = Object.hasOwn(s.people, a.who) ? s.people[a.who] : undefined;
    if (!p || a.stance !== stance || !s.advisors.includes(a.who)) continue;
    p.influence = clamp((p.influence ?? 50) + FOLLOW);
    p.advisedWeek = s.clock.week;
  }
}

/** Friday: an advisor the boss did not follow this week sulks (influence and trust fall). */
export function sulkAdvisors(s: Run) {
  for (const id of s.advisors) {
    const p = s.people[id];
    if (!p || (p.advisedWeek ?? s.clock.week) >= s.clock.week) continue;
    p.influence = clamp((p.influence ?? 50) - SULK);
    addTrust(s, id, -4);
  }
}

/** Books the visitors for the office hour (up to 4, one hour of the boss's day). */
export function bookHour(s: Run, visitors: string[]) {
  if (new Set(visitors).size !== visitors.length || visitors.length > OFFICE_HOURS_CAP)
    throw new Error(`Book up to ${OFFICE_HOURS_CAP} different visitors`);
  for (const id of visitors)
    if (!Object.hasOwn(s.people, id) || s.people[id]!.status !== "active") throw new Error(`Cannot book ${id}`);
  s.officeHours = { ...s.officeHours, visitors };
}

/** Holds the booked hour: costs 1 hour, every visitor gets a short talk (trust up, stress down). */
export function holdHour(s: Run) {
  const o = s.officeHours;
  if (s.clock.day !== o.day) throw new Error("Not office hours today");
  if (!o.visitors.length) throw new Error("No visitors are booked");
  if (s.clock.hoursLeft === HOURS && !s.inbox.some((c) => c.age === 0)) throw new Error("The day has not started");
  spendHour(s);
  for (const id of o.visitors) {
    const p = s.people[id];
    if (p?.status !== "active") continue;
    addTrust(s, id, VISIT_TRUST + visitBonus(s)); // M4 T16: decor
    p.stress = clamp(p.stress - 5);
  }
  o.visitors = [];
}

export const pureSetCircle = pure(setCircle);
export const pureFollowAdvice = pure(followAdvice);
export const pureBookHour = pure(bookHour);
export const pureHoldHour = pure(holdHour);
