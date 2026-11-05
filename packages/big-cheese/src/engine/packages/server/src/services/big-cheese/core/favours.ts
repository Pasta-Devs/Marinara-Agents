// Big Cheese M4 T12: favours and leverage (modules.md section 4, design.md 7.2 and 7.4).
// A favour is owed to the boss after a reward or a pardon. Leverage is a secret the boss
// has learned. Both swing one person, at most once per meeting item.
import { addTrust, pure, spendHour } from "./run.js";
import { roll } from "./rng.js";
import { closeThread } from "./threads.js";
import type { Card, Hearing, MeetingItem, Run } from "./types.js";

const SWING = 3; // the +3 an extra gives in the support formula (design.md 7.2)
export const FOUND_CHANCE = 0.2; // each week, for each used leverage
export const FOUND_TRUST = -20; // with the person
export const FOUND_FRIENDS = -5; // with their friends
const KEEP = 30; // the run document stays small

/** A reward or a pardon at severity 2+ makes the asker owe a favour. A delegate answer makes the boss owe the deputy one. */
export function earnFavour(s: Run, c: Card, stance: string) {
  const why = s.threads[c.thread]?.title ?? c.need;
  if ((stance === "reward" || stance === "pardon") && c.severity >= 2) {
    s.favours.push({ from: c.asker, why, week: s.clock.week, used: false });
  } else if (stance === "delegate" && s.deputy && Object.hasOwn(s.people, s.deputy)) {
    s.favours.push({ from: "boss", to: s.deputy, why, week: s.clock.week, used: false });
  } else return;
  if (s.favours.length > KEEP) s.favours.shift();
}

/** Swing one attendee of the open meeting item. One swing per item. */
function swing(s: Run, person: string) {
  const m = s.meeting;
  const item = m && !m.done ? m.items.find((i) => i.chosen === undefined) : undefined;
  if (!m || !item) throw new Error("No meeting item is waiting.");
  if (!m.people.includes(person)) throw new Error("They are not at this meeting.");
  if (item.swing?.length) throw new Error("You can swing one person per item.");
  item.swing = [person];
  item.base[person] = Math.max(item.base[person] ?? 0, 0) + SWING;
}

/** Applied when the boss answers an item: a swung person ends on the boss's side. */
export function swingScores(item: MeetingItem) {
  for (const p of item.swing ?? []) {
    if (item.scores && Object.hasOwn(item.scores, p)) item.scores[p] = Math.max(item.scores[p]!, 0) + SWING;
  }
}

/** A favour spoken for the boss counts as one witness in the hearing. */
export const favourWitness = (h: Hearing) => (h.favour ? 1 : 0);

function who(s: Run, person: string) {
  if (!Object.hasOwn(s.people, person) || s.people[person]!.status !== "active")
    throw new Error("Nobody by that name.");
}

/** Call in a favour: swing one attendee in an open meeting, or speak as a witness at the hearing. */
export function spendFavour(s: Run, person: string) {
  who(s, person);
  const f = s.favours.find((x) => !x.used && x.from === person && !x.to);
  if (!f) throw new Error("They owe you nothing.");
  if (s.meeting && !s.meeting.done) swing(s, person);
  else if (s.hearing) {
    if (s.hearing.favour) throw new Error("One favour per hearing.");
    s.hearing.favour = person;
  } else throw new Error("Nothing to call a favour in.");
  f.used = true;
}

/** The secrets the boss knows: drawer evidence from learnSecret (core/things.ts). */
export const knownSecrets = (s: Run) =>
  s.things.drawer
    .filter((t) => t.kind === "evidence" && t.id.startsWith("secret-") && t.about)
    .map((t) => ({
      about: t.about!,
      name: t.name,
      ...(s.leverage.find((l) => l.about === t.about) ?? { used: false, found: false }),
    }));

/** Use what you know. With a card: it closes as won. Without: the person is swung in the open meeting. */
export function useLeverage(s: Run, person: string, cardId?: string) {
  who(s, person);
  if (!knownSecrets(s).some((k) => k.about === person)) throw new Error("You know no secret about them.");
  if (s.leverage.some((l) => l.about === person)) throw new Error("You used that secret already.");
  let thread: string | undefined;
  if (cardId !== undefined) {
    const i = s.inbox.findIndex((c) => c.id === cardId);
    const c = s.inbox[i];
    if (!c || c.asker !== person) throw new Error("That card is not from them.");
    spendHour(s);
    s.inbox.splice(i, 1);
    closeThread(s, c.thread, "won");
    thread = c.thread;
  } else swing(s, person);
  s.leverage.push({ about: person, ...(thread ? { thread } : {}), used: true, found: false });
}

/** Friday: a used leverage may be found out. The person and their friends trust the boss less. */
export function weekLeverage(s: Run) {
  for (const l of s.leverage) {
    if (!l.used || l.found || roll(s) >= FOUND_CHANCE) continue;
    l.found = true;
    addTrust(s, l.about, FOUND_TRUST);
    for (const r of s.relations) {
      if (r.kind === "friend" && (r.a === l.about || r.b === l.about))
        addTrust(s, r.a === l.about ? r.b : r.a, FOUND_FRIENDS);
    }
  }
}

export const pureEarnFavour = pure(earnFavour);
export const pureSpendFavour = pure(spendFavour);
export const pureUseLeverage = pure(useLeverage);
export const pureWeekLeverage = pure(weekLeverage);
