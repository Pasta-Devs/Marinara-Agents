import { addTrust, applyDelta, pure, spendHour } from "./run.js";
import { closeThread, openThread } from "./threads.js";
import type { Meter, Run } from "./types.js";

// Board hearing (design.md 7.4). A meter below 10 on a second Friday calls it; it sits on the
// second working day of next week. Prep hours go to witnesses, evidence and talks with members.
export function callHearing(s: Run, meter: Meter) {
  if (s.lastWarning) return endRun(s); // second trigger in the run: no hearing
  const t = openThread(s, { kind: "hearing", title: "Board hearing", origin: "board", dueWeek: s.clock.week + 1 });
  s.hearing = { meter, thread: t.id, week: s.clock.week + 1, day: 1, witnesses: [], evidence: [] };
}

function endRun(s: Run) {
  s.status = "ended";
  s.ending = s.endingName;
}

function need(s: Run) {
  if (!s.hearing) throw new Error("No hearing is pending");
  return s.hearing;
}

export function addWitness(s: Run, id: string) {
  const h = need(s);
  if (!Object.hasOwn(s.people, id) || h.witnesses.includes(id) || h.witnesses.length >= 2)
    throw new Error("Cannot call this witness");
  spendHour(s);
  h.witnesses.push(id);
}

// ponytail: only won threads count as evidence; known secrets and fixed meters (design.md §7.4) come with M2.
export function addEvidence(s: Run, threadId: string) {
  const h = need(s);
  if (!s.closed.some((c) => c.id === threadId && c.state === "won")) throw new Error("Not a won thread");
  if (h.evidence.includes(threadId) || h.evidence.length >= 2) throw new Error("Cannot use this evidence");
  spendHour(s);
  h.evidence.push(threadId);
}

export function talkToMember(s: Run, id: string) {
  need(s);
  if (!s.hearingBody.some((m) => m.id === id)) throw new Error("Not a hearing member");
  spendHour(s);
  addTrust(s, id, 2);
}

// Three items (charge, defence, last word). Score per member and item:
// (trust-50)/5 + fit + faction, plus witnesses and 3 per evidence card in the defence.
// A member backs the boss when the total is above 0; more than half backing wins.
export function holdHearing(s: Run) {
  const h = need(s);
  const witness = h.witnesses.reduce((a, id) => {
    const tr = s.people[id]?.trust ?? 50;
    return a + (tr >= 60 ? 1 : tr < 40 ? -1 : 0);
  }, 0);
  const backing = s.hearingBody.filter((m) => {
    const item = (s.people[m.id]?.trust ?? 50) / 5 - 10 + m.fit + m.faction;
    return item * 3 + witness + 3 * h.evidence.length > 0;
  }).length;
  const won = backing > s.hearingBody.length / 2;
  s.lastHearing = { won, backing, of: s.hearingBody.length };
  closeThread(s, h.thread, won ? "won" : "lost");
  s.hearing = null;
  if (!won) return endRun(s);
  s.meters = applyDelta(s.meters, { [h.meter]: 20 - s.meters[h.meter] });
  s.low[h.meter] = 0;
  s.lastWarning = true; // whole run
}

export const pureAddWitness = pure(addWitness);
export const pureAddEvidence = pure(addEvidence);
export const pureTalkToMember = pure(talkToMember);
export const pureHoldHearing = pure(holdHearing);
