// Big Cheese: viewer mode and skip ahead (design.md sections 11 and 12).
// Pure core: who answers a card, which events stop the timer, and how many slots one batch runs.
// An AI boss needs no model call: it picks from the 3 offered stances by a weighted table.
import { answerCard } from "./cards.js";
import { dayIndex, spendHours } from "./clock.js";
import { roll } from "./rng.js";
import { endDay } from "./settle.js";
import { METERS } from "./types.js";
import type { Card, Run } from "./types.js";

export const POLICIES = ["nobody", "deputy", "kind", "strict", "greedy", "chaotic"] as const;
export type Policy = (typeof POLICIES)[number];

// Weight of each stance by boss style. Weights are tuned here and nowhere else.
const WEIGHTS: Record<string, Record<string, number>> = {
  kind: { invest: 5, delegate: 3, ask_others: 2, cheap_fix: 1, delay: 1, refuse: 0 },
  strict: { refuse: 4, cheap_fix: 3, delay: 2, delegate: 2, ask_others: 1, invest: 1 },
  greedy: { cheap_fix: 5, refuse: 3, delay: 2, delegate: 1, ask_others: 1, invest: 0 },
  chaotic: {},
};
const CARELESS = new Set(["refuse", "delay"]);
const CLOSE = new Set(["friend", "mentor", "couple", "family"]);

/** The style that decides: the deputy's own ambition, stress and friendships pick one. */
function styleOf(s: Run, card: Card, policy: Policy) {
  if (policy !== "deputy") return policy;
  const d = s.people[s.deputy];
  const friend = s.relations.some(
    (r) => CLOSE.has(r.kind) && [r.a, r.b].includes(s.deputy) && [r.a, r.b].includes(card.asker),
  );
  if (d && d.ambition >= 60) return friend ? "kind" : "greedy"; // an ambitious deputy favours their friends
  return d && d.stress >= 60 ? "strict" : "kind";
}

/** One of the stances the card offers, weighted by style and severity. */
export function pickStance(s: Run, card: Card, policy: Policy) {
  const table = WEIGHTS[styleOf(s, card, policy)] ?? {};
  const w = card.answers.map(({ stance }) => {
    let x = table[stance] ?? 1;
    if (CARELESS.has(stance) && card.severity === 3) x /= 2;
    if (stance === "invest") x *= card.severity / 2;
    return x;
  });
  let r = roll(s) * w.reduce((a, b) => a + b, 0);
  const i = w.findIndex((x) => (r -= x) < 0);
  return card.answers[i < 0 ? 0 : i]!.stance;
}

/** What the place looked like when the batch began; a pause is a change from this. */
export const watch = (s: Run) => ({
  open: new Set(
    Object.values(s.threads)
      .filter((t) => t.state === "open")
      .map((t) => t.id),
  ),
  secret: new Set(
    Object.values(s.threads)
      .filter((t) => t.secret)
      .map((t) => t.id),
  ),
  quit: new Set(Object.keys(s.people).filter((p) => s.people[p]!.status === "quit")),
  couples: new Set(s.relations.filter((r) => r.kind === "couple").map((r) => `${r.a}|${r.b}`)),
  hearing: !!s.hearing,
  low: new Set(METERS.filter((m) => s.meters[m] < 15)),
});
export type Watch = ReturnType<typeof watch>;

const PLOTS = new Set(["cover_up", "mystery", "revolt"]);

/** The reason the timer stops (design.md section 11), or null. `follow` are the people the viewer watches. */
export function drama(w: Watch, s: Run, follow: string[] = []) {
  const fresh = Object.values(s.threads).filter((t) => t.state === "open" && !w.open.has(t.id));
  if (fresh.some((t) => t.kind === "crisis")) return "crisis";
  if (s.hearing && !w.hearing) return "hearing";
  if (Object.keys(s.people).some((p) => s.people[p]!.status === "quit" && !w.quit.has(p))) return "quit";
  if (
    s.relations.some(
      (r) => r.kind === "couple" && !w.couples.has(`${r.a}|${r.b}`) && (follow.includes(r.a) || follow.includes(r.b)),
    )
  )
    return "couple";
  if (fresh.some((t) => PLOTS.has(t.kind))) return "plot";
  if (METERS.some((m) => s.meters[m] < 15 && !w.low.has(m))) return "low";
  if (Object.values(s.threads).some((t) => w.secret.has(t.id) && !t.secret)) return "secret";
  return null;
}

/** A hearing that is due today needs the boss; nothing may run past it. */
export const hearingDue = (s: Run) => !!s.hearing && dayIndex(s.clock) >= dayIndex(s.hearing);

export interface Opts {
  policy: Policy;
  skip: boolean;
  follow: string[];
}

/**
 * Runs up to `n` slots (one hour each) on a run you own. Stops early on a pause, at the end of the run, or
 * when a day ends: the caller then starts the next day. A skip answers no card and ends days with the
 * inbox set aside in the saved `away` list, so cards wait unaged until Start the day puts them back.
 */
export function runSlots(s: Run, n: number, o: Opts, w: Watch) {
  const out = { used: 0, rolled: false, paused: null as string | null };
  while (out.used < n && s.status === "playing") {
    if (hearingDue(s)) return { ...out, paused: "hearing" };
    const card = o.skip || o.policy === "nobody" ? undefined : [...s.inbox].sort((a, b) => b.age - a.age)[0];
    if (card) answerCard(s, card.id, pickStance(s, card, o.policy));
    else s.clock = spendHours(s.clock, 1);
    out.used++;
    if (s.clock.hoursLeft === 0) {
      if (o.skip) s.away = [...(s.away ?? []), ...s.inbox.splice(0)];
      endDay(s);
      out.rolled = s.status === "playing";
      break;
    }
    if (!o.skip && (out.paused = drama(w, s, o.follow))) break;
  }
  if (!out.paused && !o.skip) out.paused = drama(w, s, o.follow);
  return out;
}

/** Short facts for the away digest: what moved between two states of the same run. */
export function digestFacts(before: Run, after: Run, label: (m: string) => string) {
  const facts: string[] = [];
  for (const m of METERS) {
    const d = after.meters[m] - before.meters[m];
    if (Math.abs(d) >= 3) facts.push(`${label(m)} ${d > 0 ? "rose" : "fell"}.`);
  }
  const seen = new Set(Object.keys(before.threads));
  for (const t of Object.values(after.threads))
    if (!seen.has(t.id) && t.state === "open") facts.push(`A new story began: ${t.title}.`);
  const closed = new Set(before.closed.map((c) => c.id));
  for (const c of after.closed) if (!closed.has(c.id) && c.title) facts.push(`${c.title} ended (${c.state}).`);
  for (const [id, p] of Object.entries(after.people))
    if (p.status !== before.people[id]?.status && p.status !== "active")
      facts.push(`${p.name ?? id} is now ${p.status}.`);
  return facts.slice(0, 8);
}
