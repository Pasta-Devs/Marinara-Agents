// ──────────────────────────────────────────────
// Big Cheese: term reviews, the award and the facts of a yearbook page (modules.md 4, README Core loop step 5)
// ──────────────────────────────────────────────
// At term end the key people get a review: praise, a raise, a new role or a warning. Peers compare what they got.
// One award has a winner. The code decides every number; the model only writes the yearbook page from `termFacts`.
import { WEEKS } from "./clock.js";
import { goalById } from "./goals.js";
import { termWeeks } from "./mutators.js";
import { addTrust, applyDelta, clamp } from "./run.js";
import type { PlaceKit } from "./kits/types.js";
import { DIFFICULTY_FACTOR, METERS } from "./types.js";
import type { Run } from "./types.js";

export const REVIEW_PICKS = ["praise", "raise", "role", "warning"] as const;
export type ReviewPick = (typeof REVIEW_PICKS)[number];
const KEY_PEOPLE = 4;
export const PEER_GAP = 3; // an equal peer who got less loses this much trust
export const AWARD_WIN = 8;
export const AWARD_LOSE = 2;
const RANK: Record<ReviewPick, number> = { warning: 0, praise: 1, role: 2, raise: 3 };
const EFFECT: Record<ReviewPick, { trust: number; stress?: number; ambition?: number; money?: number }> = {
  praise: { trust: 4 },
  raise: { trust: 8, money: -2 },
  role: { trust: 5, ambition: 10 },
  warning: { trust: -5, stress: 6 },
};

/** The inner circle first, then the deputy, then people who are stressed or driven. Fixed order, no dice. */
function keyPeople(s: Run): string[] {
  const score = (id: string) =>
    (s.advisors?.includes(id) ? 2 : 0) +
    (s.deputy === id ? 2 : 0) +
    (s.people[id]!.stress >= 60 ? 1 : 0) +
    s.people[id]!.ambition / 100;
  return Object.keys(s.people)
    .filter((id) => (s.people[id]!.status ?? "active") === "active")
    .sort((a, b) => score(b) - score(a) || a.localeCompare(b))
    .slice(0, KEY_PEOPLE);
}

/** T10 line of endTerm: opens the review. The last term has no review, the run is over. */
export function startReview(s: Run, _kit?: PlaceKit) {
  s.pendingTerm = {
    term: s.lastTerm,
    review: s.clock.week >= WEEKS ? [] : keyPeople(s),
    done: [],
    from: s.pendingTerm?.closed ?? 0,
    closed: s.closed.length,
  };
}

const roleOf = (kit: PlaceKit | undefined, id: string) => kit?.people.find((x) => x.id === id)?.role;

export function reviewPerson(s: Run, kit: PlaceKit | undefined, who: string, pick: string) {
  const p = s.pendingTerm;
  if (!p || !p.review.includes(who)) throw new Error("This person is not up for a review.");
  if (!Object.hasOwn(RANK, pick)) throw new Error("There is no such review.");
  const k = pick as ReviewPick;
  const role = roleOf(kit, who);
  for (const d of p.done ?? []) {
    if (!role || roleOf(kit, d.who) !== role) continue; // only an equal peer compares
    const other = RANK[d.pick as ReviewPick] ?? 0;
    if (RANK[k] > other) addTrust(s, d.who, -PEER_GAP);
    else if (other > RANK[k]) addTrust(s, who, -PEER_GAP);
  }
  const e = EFFECT[k];
  const person = s.people[who]!;
  person.trust = clamp(person.trust + e.trust);
  if (e.stress) person.stress = clamp(person.stress + e.stress);
  if (e.ambition) person.ambition = clamp(person.ambition + e.ambition);
  if (e.money) s.meters = applyDelta(s.meters, { money: e.money }, DIFFICULTY_FACTOR[s.difficulty]);
  p.review = p.review.filter((id) => id !== who);
  (p.done ??= []).push({ who, pick: k });
  s.tally.reviews = (s.tally.reviews ?? 0) + 1;
}

/** One winner among the people of this term's review. The others lose a little. */
export function giveAward(s: Run, who: string) {
  const p = s.pendingTerm;
  if (!p || p.award) throw new Error("There is no award to give.");
  const all = [...p.review, ...(p.done ?? []).map((d) => d.who)];
  if (!all.includes(who)) throw new Error("This person is not up for the award.");
  for (const id of all) addTrust(s, id, id === who ? AWARD_WIN : -AWARD_LOSE);
  p.award = who;
  s.tally.awards = (s.tally.awards ?? 0) + 1;
}

export interface TermFacts {
  term: number;
  closed: { title: string; state: string }[];
  goals: { about: string; met: boolean }[]; // no goal text: it holds numbers, and a page has none
  reviews: { person: string; pick: string }[];
  award: string | null;
  moved: { meter: string; dir: "rose" | "fell" | "held" }[];
}

/** What the page may say. Adult threads and secrets stay out unless the player chose adult text. */
export function termFacts(s: Run, kit: PlaceKit, withAdult = false): TermFacts {
  const p = s.pendingTerm;
  if (!p) throw new Error("There is no term to write up.");
  const name = (id: string) => kit.people.find((x) => x.id === id)?.name ?? s.people[id]?.name ?? id;
  const g = s.goals.find((x) => x.term === p.term);
  const tw = termWeeks(s);
  const hist = s.meterHistory.filter((h) => h.week > (p.term - 1) * tw && h.week <= p.term * tw);
  const first = hist[0];
  const last = hist[hist.length - 1];
  return {
    term: p.term,
    closed: s.closed
      .slice(p.from ?? 0, p.closed ?? s.closed.length)
      .filter((t) => !t.secret && (withAdult || t.layer !== "adult"))
      .map((t) => ({ title: t.title ?? t.id, state: t.state })),
    goals: (g?.picked ?? []).map((id) => {
      const m = goalById(id, kit)?.meter;
      return { about: (m && kit.meters[m]?.label) || "the place", met: g!.met.includes(id) };
    }),
    reviews: (p.done ?? []).map((d) => ({ person: name(d.who), pick: d.pick })),
    award: p.award ? name(p.award) : null,
    moved:
      first && last
        ? METERS.map((m) => ({
            meter: kit.meters[m]?.label ?? m,
            dir: last[m] > first[m] ? "rose" : last[m] < first[m] ? "fell" : "held",
          }))
        : [],
  };
}
