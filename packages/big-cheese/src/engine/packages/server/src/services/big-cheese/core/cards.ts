import { pick, roll } from "./rng.js";
import { addTrust, applyDelta, newId, pure, spendHour } from "./run.js";
import { FOLLOW, K, effect, offer, trustChange } from "./stances.js";
import { closeThread, openPromise, planCardBeat, openThread } from "./threads.js";
import { METERS } from "./types.js";
import type { Meter, Meters, Run, Severity, Thread } from "./types.js";

// Tension, meter part only (design.md 5.1): the average gap below 50 across the four meters.
export const meterTension = (m: Meters) => METERS.reduce((a, k) => a + Math.max(0, 50 - m[k]), 0) / 4;

// Severity mix as cumulative cut points. A calm place (tension below 20) gets harder cards.
function severityCuts(s: Run): [number, number] {
  if (s.storyteller === "calm") return [0.6, 0.95];
  if (meterTension(s.meters) < 20) return [0.25, 0.7];
  return s.storyteller === "chaos" ? [0.33, 0.66] : [0.45, 0.85];
}

function addCard(s: Run, t: Thread, seed: { need: Meter; severity: Severity }) {
  const id = newId(s, "c");
  s.inbox.push({ id, thread: t.id, asker: t.people[0]!, ...seed, age: 0, answers: offer(s, s.authority) });
  return id;
}

// Morning: due follow-up beats land first, then the day's budget of new deck cards.
export function seedDay(s: Run) {
  for (const t of Object.values(s.threads)) {
    for (const b of t.beats) {
      const p = b.planned;
      if (b.type === "card" && b.seed && !b.card && p?.week === s.clock.week && p.day === s.clock.day) {
        b.card = addCard(s, t, b.seed);
        delete b.planned;
      }
    }
  }
  const n = s.storyteller === "calm" ? 2 : s.storyteller === "classic" ? 3 : 2 + Math.floor(roll(s) * 4);
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
    if ((s.deputyAmbition += 15) >= 100) {
      s.deputyAmbition = 0; // the deputy challenges you at the board
      s.meters = applyDelta(s.meters, { standing: -10, people: -5 });
    }
  }
  promises.forEach((p) => openPromise(s, p));
  const t = s.threads[c.thread];
  if (!t) return;
  const beat = t.beats.find((b) => b.card === c.id);
  if (beat) beat.result = stance;
  const f = FOLLOW[stance as keyof typeof FOLLOW];
  if (roll(s) * 100 >= f.chance[c.severity - 1]) return closeThread(s, t.id, "won");
  const severity = Math.min(3, c.severity + f.worse) as Severity;
  planCardBeat(s, t, { need: c.need, severity }, 1 + Math.floor(roll(s) * 3));
}

// Evening: waiting cards age. On day 5 the problem happens: full -k, no follow-up, thread lost.
export function ageCards(s: Run) {
  for (const c of s.inbox) c.age++;
  for (const c of s.inbox.filter((c) => c.age >= 5)) {
    s.meters = applyDelta(s.meters, { [c.need]: -K[c.severity] });
    closeThread(s, c.thread, "lost");
  }
  s.inbox = s.inbox.filter((c) => c.age < 5);
}

export const pureSeedDay = pure(seedDay);
export const pureAnswerCard = pure(answerCard);
