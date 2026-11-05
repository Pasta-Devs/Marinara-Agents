// ──────────────────────────────────────────────
// Big Cheese: house rules, decrees and the absolute rule (design.md section 9)
// ──────────────────────────────────────────────
// Pure code. Fear and Love live in `run.power`; Legitimacy is the extra meter `legitimacy`.
// Numbers: content.md section 1.2 (stances), section 2.3-2.4 (decrees), section 11 (rules).
import { clamp, pure, spendHour } from "./run.js";
import { pick, roll } from "./rng.js";
import { closeThread, openStory, openThread, planCardBeat } from "./threads.js";
import { DIFFICULTY_FACTOR, METERS } from "./types.js";
import type { PlaceKit } from "./kits/types.js";
import type { Meter, Run, Severity } from "./types.js";

// [fear, love, legitimacy] for severity 2 (content.md section 1.2).
const POWER: Record<string, [number, number, number]> = {
  invest: [0, 5, 1],
  cheap_fix: [0, -1, 0],
  delay: [1, -2, 0],
  delegate: [0, -1, 0],
  refuse: [3, -4, -1],
  ask_others: [0, 1, 0],
  decree: [6, -3, -1],
  punish: [8, -6, -1],
  pardon: [-4, 8, 1],
  reward: [-1, 7, 0],
  banish: [10, -8, -3],
  appoint: [0, 6, 1],
};

const legitimacy = (s: Run) => s.extras.find((e) => e.id === "legitimacy");
const addLegitimacy = (s: Run, d: number) => {
  const e = legitimacy(s);
  if (e) e.value = clamp(e.value + d);
};
const addPower = (s: Run, fear: number, love: number, legit: number) => {
  const hard = DIFFICULTY_FACTOR[s.difficulty];
  const neg = (d: number) => (d < 0 ? Math.round(d * hard) : d); // difficulty scales losses only
  s.power = { fear: clamp(s.power.fear + fear), love: clamp(s.power.love + neg(love)) };
  addLegitimacy(s, neg(legit));
};

/** A new run in an absolute place starts with the kit's Fear, Love and Legitimacy. */
export function startAuthority(s: Run, place: PlaceKit) {
  const a = place.authorityStart;
  if (!a) return;
  s.power = { fear: a.fear, love: a.love };
  if (!legitimacy(s)) s.extras.push({ id: "legitimacy", main: "standing", value: a.legitimacy });
}

/** A stance answered in an absolute place moves Fear, Love and Legitimacy (content.md 1.2). */
export function stancePower(s: Run, stance: string, severity: Severity) {
  const row = POWER[stance];
  if (s.authority !== "absolute" || !row) return;
  const k = [0.5, 1, 1.5][severity - 1]!;
  // ponytail: the court-kit Fear scale of 1.25 (content.md 1.4) is missing; answerCard has no kit. Pass the kit in to add it.
  addPower(s, Math.round(row[0] * k), Math.round(row[1] * k), Math.round(row[2] * k));
}

/** Percent per week that a secret plot starts (design.md section 9). */
export const plotChance = (p: { fear: number; love: number }) => Math.max(0, p.fear - p.love - 20) / 2;

/** An enforcer is a kit person whose role says so. Their trust decides whether they enforce. */
export const enforcerIn = (s: Run, kit: PlaceKit, room?: string) =>
  kit.people.some((k) => {
    const p = s.people[k.id];
    return /enforcer/.test(k.role) && p?.status === "active" && p.trust >= 40 && (!room || p.room === room);
  });

// ── House rules ──────────────────────────────

export type Rule = PlaceKit["houseRules"][number];
const startIndex = (r: Rule) => (r.options.length - 1) >> 1; // the middle option is the start
export const ruleOption = (s: Run, r: Rule) =>
  (Object.hasOwn(s.houseRules, r.id) ? s.houseRules[r.id] : undefined) ?? r.options[startIndex(r)]!;
const step = (s: Run, r: Rule, option = ruleOption(s, r)) => r.options.indexOf(option) - startIndex(r);

// Weekly meter signs per step up, in the order of the rule's `touches`.
// ponytail: only the Hafenkai rules are listed; other rules push Output up and People down per step.
// Add a row when a kit adds a rule.
const SIGNS: Record<string, number[]> = { "night-bonus": [-1, 1, 1], phones: [-1, 1, 0], overtime: [0, 1, -1] };
const sign = (r: Rule, i: number) =>
  (Object.hasOwn(SIGNS, r.id) ? SIGNS[r.id][i] : undefined) ??
  (r.touches[i] === "output" ? 1 : r.touches[i] === "people" ? -1 : 0);

// Fear, Love and Legitimacy a decree costs at its harshest (last) option. content.md 2.3-2.4.
const HARSH: Record<string, [number, number, number]> = {
  curfew: [4, -3, 0],
  phones: [3, -4, -1],
  "dorm-inspections": [5, -5, -2],
  "grain-tax": [3, -4, 0],
  "hunting-rights": [0, -5, 0],
  "petition-day": [0, -6, -3],
};
/** What a decree option costs in Fear, Love and Legitimacy. Only the harshest option costs. */
export const decreeCost = (r: Rule, option: string): [number, number, number] =>
  option === r.options.at(-1) ? (Object.hasOwn(HARSH, r.id) ? HARSH[r.id] : [3, -3, 0]) : [0, 0, 0];

const find = (kit: PlaceKit, id: string) => {
  const r = kit.houseRules.find((x) => x.id === id);
  if (!r) throw new Error("No such rule");
  return r;
};
const needOf = (r: Rule): Meter => r.touches.find((m): m is Meter => METERS.includes(m as Meter)) ?? "standing";

const apply = (s: Run, r: Rule, option: string, free: boolean) => {
  const old = ruleOption(s, r);
  s.houseRules[r.id] = option;
  if (!r.decree || free) return;
  const [a, b, c] = decreeCost(r, option);
  const [x, y, z] = decreeCost(r, old);
  addPower(s, a - x, b - y, c - z); // moving back to a mild option takes the cost back
};

/**
 * The boss changes a rule. Costs 1 hour. A Manager proposes it: it waits for the next meeting
 * and a vote. A Strong leader sets it at once and people push back. An absolute ruler decrees it
 * at once and pays Fear, Love or Legitimacy. `free` is the Cheese Board's no-cost decree.
 */
export function setRule(s: Run, kit: PlaceKit, id: string, option: string, free = false) {
  const r = find(kit, id);
  if (!r.options.includes(option)) throw new Error("No such option");
  if (ruleOption(s, r) === option) throw new Error("The rule already has that option");
  if (s.authority === "manager" && !free) {
    if (Object.values(s.threads).some((t) => t.rule?.id === id && t.rule.option === option))
      throw new Error("That proposal is already made");
    spendHour(s);
    openThread(s, {
      kind: "follow_up",
      title: `${r.text}: ${option}`,
      origin: "action",
      people: [s.deputy],
      need: needOf(r),
      severity: 2,
    }).rule = { id, option };
    return;
  }
  spendHour(s);
  apply(s, r, option, free);
  if (s.authority === "strong_leader" && !free) {
    const t = openThread(s, {
      kind: "follow_up",
      title: `Push back on ${r.text}`,
      origin: "action",
      people: [s.deputy],
      need: needOf(r),
      severity: 1,
    });
    planCardBeat(s, t, { need: t.need!, severity: 1 }, 1);
  }
}

/** A meeting item that came from a proposal: when the vote passes the rule is set, then it closes. */
export function proposalVote(s: Run, kit: PlaceKit, threadId: string | undefined, passed: boolean) {
  const t = threadId ? s.threads[threadId] : undefined;
  if (!t?.rule) return;
  if (passed) apply(s, find(kit, t.rule.id), t.rule.option, false);
  closeThread(s, t.id, passed ? "won" : "lost");
}

/** Friday: rules move meters, a low meter costs Legitimacy, a plot may start. One call from settleWeek. */
export function weeklyAuthority(s: Run, kit: PlaceKit) {
  for (const r of kit.houseRules) {
    const d = step(s, r);
    // A decree only works where an enforcer stands.
    if (!d || (r.decree && !enforcerIn(s, kit))) continue;
    r.touches.forEach((m, i) => {
      if (METERS.includes(m as Meter)) s.meters[m as Meter] = clamp(s.meters[m as Meter] + sign(r, i) * d);
    });
  }
  if (s.authority !== "absolute") return;
  // No hearing for an absolute ruler: a meter that stays under 10 costs Legitimacy.
  if (METERS.some((k) => s.meters[k] < 10 && s.low[k] >= 1)) addLegitimacy(s, -10);
  const live = Object.keys(s.people).filter((id) => s.people[id]!.status === "active");
  const plotting = Object.values(s.threads).some((t) => t.kind === "cover_up" && t.secret);
  if (!plotting && live.length > 1 && roll(s) * 100 < plotChance(s.power)) {
    const who = pick(s, live);
    const t = openStory(s, "cover_up", {
      title: "Whispers behind the throne",
      need: "standing",
      people: [who, live.find((id) => id !== who)!],
      severity: 2,
      origin: "arc",
    });
    t.secret = true; // the boss sees only clues
  }
}

export const pureSetRule = pure(setRule);
export const pureProposalVote = pure(proposalVote);
