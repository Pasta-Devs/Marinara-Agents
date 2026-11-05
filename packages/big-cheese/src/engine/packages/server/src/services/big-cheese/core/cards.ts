import { pick, roll } from "./rng.js";
import { addTrust, applyDelta, newId, pure, spendHour } from "./run.js";
import { FOLLOW, K, effect, offer, trustChange } from "./stances.js";
import { severityCuts, morning } from "./storyteller.js";
import { closeThread, openPromise, planCardBeat, openThread, storyBeat } from "./threads.js";
import { METERS } from "./types.js";
import type { Meter, Run, Severity, Thread } from "./types.js";

export { meterTension } from "./storyteller.js";

export function addCard(s: Run, t: Thread, seed: { need: Meter; severity: Severity }) {
  const id = newId(s, "c");
  s.inbox.push({ id, thread: t.id, asker: t.people[0]!, ...seed, age: 0, answers: offer(s, s.authority) });
  return id;
}

// Morning: due follow-up beats land first, then the day's budget of new deck cards.
export function seedDay(s: Run) {
  for (const t of Object.values(s.threads)) {
    if (t.kind === "promise") continue; // its check beat belongs to checkPromises
    let landed = false;
    for (const b of t.beats) {
      const p = b.planned;
      if (!p || p.week !== s.clock.week || p.day !== s.clock.day) continue;
      if (b.type === "card" && b.seed && !b.card) b.card = addCard(s, t, b.seed);
      else if (b.type !== "check") continue;
      delete b.planned;
      landed = true;
    }
    // A wish or surprise with only code beats is won when its last beat lands.
    if (
      landed &&
      (t.kind === "wish" || t.kind === "follow_up") &&
      t.beats.every((b) => b.type !== "card" && !b.planned)
    )
      closeThread(s, t.id, "won");
  }
  const n = morning(s);
  const [s1, s2] = severityCuts(s);
  for (let i = 0; i < n; i++) {
    const x = roll(s);
    const need = pick(s, METERS);
    const asker = pick(s, Object.keys(s.people));
    const severity: Severity = x < s1 ? 1 : x < s2 ? 2 : 3;
    const t = openThread(s, {
      kind: "follow_up",
      title: `${need} request`,
      people: [asker],
      need,
      severity,
      origin: "deck",
    });
    t.beats.push({ id: newId(s, "b"), type: "card", card: addCard(s, t, { need, severity }) });
  }
}

// Answer a card: costs 1 hour, applies the stance, moves trust, rolls the follow-up.
export function answerCard(s: Run, id: string, stance: string, promises: Parameters<typeof openPromise>[1][] = []) {
  const i = s.inbox.findIndex((c) => c.id === id);
  const c = s.inbox[i];
  if (!c) throw new Error(`Card ${id} is not in the inbox`);
  if (!c.answers.some((a) => a.stance === stance)) throw new Error(`Stance ${stance} is not offered on ${id}`);
  spendHour(s);
  s.inbox.splice(i, 1);
  s.meters = applyDelta(s.meters, effect(c, stance));
  addTrust(s, c.asker, trustChange(stance, c.severity));
  const mem = s.people[c.asker]?.memories;
  mem?.push({ week: s.clock.week, about: c.id, thread: c.thread, stance, weight: 1 });
  if (mem && mem.length > 5) mem.shift();
  if (stance === "delegate") {
    addTrust(s, s.deputy, 3);
    s.deputyAmbition = Math.min(100, s.deputyAmbition + 15); // at 100 the challenge is an item at the next board meeting
  }
  promises.forEach((p) => openPromise(s, p));
  const t = s.threads[c.thread];
  if (!t) return;
  const beat = t.beats.find((b) => b.card === c.id);
  if (beat) beat.result = stance;
  if (t.kind !== "follow_up") return storyBeat(s, t, c.id, c.answers.find((a) => a.stance === stance)!.tier !== "weak");
  const f = FOLLOW[stance as keyof typeof FOLLOW];
  if (roll(s) * 100 >= f.chance[c.severity - 1]) return closeThread(s, t.id, "won");
  const severity = Math.min(3, c.severity + f.worse) as Severity;
  planCardBeat(s, t, { need: c.need, severity }, 1 + Math.floor(roll(s) * 3));
  t.clock.pressure = stance === "cheap_fix" ? "patched" : f.worse ? "worse" : "building";
}

// Evening: waiting cards age. On day 5 the problem happens: full -k, no follow-up, thread lost.
export function ageCards(s: Run) {
  for (const c of s.inbox) c.age++;
  for (const c of s.inbox.filter((c) => c.age >= 5)) {
    s.meters = applyDelta(s.meters, { [c.need]: -K[c.severity] });
    const t = s.threads[c.thread];
    if (t && t.kind !== "follow_up") storyBeat(s, t, c.id, false);
    else closeThread(s, c.thread, "lost");
  }
  s.inbox = s.inbox.filter((c) => c.age < 5);
}

export const pureSeedDay = pure(seedDay);
export const pureAnswerCard = pure(answerCard);
