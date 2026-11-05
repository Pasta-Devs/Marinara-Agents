// ──────────────────────────────────────────────
// Big Cheese: term goals (content.md 9, README Core loop step 5)
// ──────────────────────────────────────────────
// Each term the player gets 5 goals and picks 3. At term end each pick is checked. T9 judges "Win the year"
// (at least 2 of 3 goals met in every term). A goal is offered only when its system or layer is on in the run.
import { term, WEEKS } from "./clock.js";
import { dial } from "./layers.js";
import { termWeeks } from "./mutators.js";
import { offerPerks } from "./perks.js";
import { pick } from "./rng.js";
import type { PlaceKit } from "./kits/types.js";
import { METERS } from "./types.js";
import type { Authority, Meter, Run } from "./types.js";

/** What a check sees: the term's Friday log and how far the run moved since the goals were offered. */
interface Ctx {
  since: number; // the week the goals were offered
  hist: Run["meterHistory"];
  gain: (k: string) => number;
}
export interface Goal {
  id: string;
  text: string;
  meter: Meter;
  auth?: Authority[]; // missing = any authority
  needs?: (s: Run) => boolean;
  check: (s: Run, c: Ctx) => boolean;
}

const ABS: Authority[] = ["absolute"];
const BOSS: Authority[] = ["manager", "strong_leader"];
const STRONG: Authority[] = ["strong_leader", "absolute"];
const layerOn = (l: Parameters<typeof dial>[1]) => (s: Run) => dial(s, l) > 0;
const systemOn = (kind: string) => (s: Run) => Object.values(s.systems).some((x) => x.on && x.kind === kind);
const money = (s: Run) => !!s.depth?.money;
const legit = (s: Run) => s.extras.find((e) => e.id === "legitimacy")?.value ?? 0;
const active = (s: Run) => Object.values(s.people);

export const GOALS: Goal[] = [
  { id: "money_60", meter: "money", text: "Money at 60 or more at term end.", check: (s) => s.meters.money >= 60 },
  {
    id: "money_floor",
    meter: "money",
    auth: BOSS,
    text: "Never let Money drop below 20.",
    check: (_s, c) => c.hist.length > 0 && c.hist.every((h) => h.money >= 20),
  },
  {
    id: "repay_loan",
    meter: "money",
    needs: money,
    text: "Repay a loan on time.",
    check: (s, c) => {
      const due = (s.ledger?.loans ?? []).filter((l) => l.due > c.since && l.due <= s.clock.week);
      return due.length > 0 && due.every((l) => l.repaid && !l.missed);
    },
  },
  { id: "money_up", meter: "money", text: "Raise Money by 15 over the term.", check: (_s, c) => c.gain("money") >= 15 },
  {
    id: "black_6",
    meter: "money",
    auth: BOSS,
    text: "Keep Money at 40 or more for the last 6 weeks.",
    check: (_s, c) => c.hist.length >= 6 && c.hist.slice(-6).every((h) => h.money >= 40),
  },
  {
    id: "treasury",
    meter: "money",
    auth: ABS,
    text: "Fill the treasury: Money at 80 or more at term end.",
    check: (s) => s.meters.money >= 80,
  },
  { id: "output_65", meter: "output", text: "Output at 65 or more at term end.", check: (s) => s.meters.output >= 65 },
  {
    id: "output_up",
    meter: "output",
    text: "Raise Output by 15 over the term.",
    check: (_s, c) => c.gain("output") >= 15,
  },
  {
    id: "projects",
    meter: "output",
    needs: systemOn("project"),
    text: "Win 2 Output threads.",
    check: (_s, c) => c.gain("wonOutput") >= 2,
  },
  {
    id: "no_lost",
    meter: "output",
    auth: BOSS,
    text: "Lose no thread this term.",
    check: (_s, c) => c.gain("lost") === 0,
  },
  {
    id: "contest",
    meter: "output",
    auth: STRONG,
    needs: systemOn("season"),
    text: "Win a match of the season.",
    check: (s, c) =>
      Object.values(s.systems).some(
        (x) => x.on && x.kind === "season" && x.fixtures?.some((f) => f.won && f.week > c.since),
      ),
  },
  { id: "people_60", meter: "people", text: "People at 60 or more at term end.", check: (s) => s.meters.people >= 60 },
  {
    id: "calm",
    meter: "people",
    text: "No strike, walkout or revolt.",
    check: (s, c) => c.hist.every((h) => h.people >= 15) && !Object.values(s.threads).some((t) => t.kind === "revolt"),
  },
  {
    id: "keep_people",
    meter: "people",
    auth: BOSS,
    text: "Keep all key people for the whole term.",
    check: (_s, c) => c.gain("gone") === 0,
  },
  {
    id: "traditions_3",
    meter: "people",
    text: "Hold 3 traditions alive.",
    check: (s) => s.traditions.filter((t) => t.active).length >= 3,
  },
  {
    id: "healthy",
    meter: "people",
    text: "End the term with nobody sick or on leave.",
    check: (s) => active(s).every((p) => p.status !== "sick" && p.status !== "on_leave"),
  },
  {
    id: "love_fear",
    meter: "people",
    auth: ABS,
    text: "Keep Love at 50 and Fear below 60.",
    check: (s) => s.power.love >= 50 && s.power.fear < 60,
  },
  {
    id: "standing_65",
    meter: "standing",
    text: "Standing at 65 or more at term end.",
    check: (s) => s.meters.standing >= 65,
  },
  {
    id: "inspection",
    meter: "standing",
    auth: BOSS,
    needs: money,
    text: "Pass the next inspection with a high score.",
    check: (s) => (s.ledger?.audit ?? 0) >= 70,
  },
  {
    id: "press_3",
    meter: "standing",
    needs: layerOn("press"),
    text: "Win 3 press stories.",
    check: (_s, c) => c.gain("press") >= 3,
  },
  {
    id: "rival",
    meter: "standing",
    needs: layerOn("rivals"),
    text: "Beat the rival in a head-to-head.",
    check: (_s, c) => c.gain("rivals") >= 1,
  },
  {
    id: "legit_60",
    meter: "standing",
    auth: ABS,
    text: "Keep Legitimacy at 60 or more.",
    check: (s) => legit(s) >= 60,
  },
  {
    id: "no_cover_up",
    meter: "standing",
    needs: layerOn("crime"),
    text: "Finish with no cover-up coming back.",
    check: (s, c) => c.gain("crimeLost") === 0 && !Object.values(s.threads).some((t) => t.kind === "cover_up"),
  },
  {
    id: "trust_80",
    meter: "people",
    text: "Win one person's full trust: 80 or more.",
    check: (s) => active(s).some((p) => p.trust >= 80),
  },
  {
    id: "heir",
    meter: "standing",
    auth: STRONG,
    needs: layerOn("legacy"),
    text: "Name an heir or a successor.",
    check: (s) => !!s.legacy?.heir,
  },
];

/** A kit's own goal (kit.termGoals): meter minimums at term end, or on every Friday of the term. */
const kitGoal = (g: PlaceKit["termGoals"][number]): Goal => ({
  id: `kit:${g.id}`,
  text: g.text,
  meter: (Object.keys(g.min)[0] as Meter | undefined) ?? "standing",
  check: (s, c) => {
    const ok = (m: Partial<Record<Meter, number>>) => METERS.every((k) => (m[k] ?? 0) >= (g.min[k] ?? 0));
    return (
      (g.when === "end" ? ok(s.meters) : c.hist.length > 0 && c.hist.every(ok)) &&
      (!g.forbid || !Object.values(s.threads).some((t) => t.kind === g.forbid))
    );
  },
});

const pool = (kit?: PlaceKit) => [...GOALS, ...(kit?.termGoals ?? []).map(kitGoal)];
export const goalById = (id: string, kit?: PlaceKit) => pool(kit).find((g) => g.id === id);

const wonBy = (s: Run, f: (c: Run["closed"][number]) => boolean) =>
  s.closed.filter((c) => c.state === "won" && f(c)).length;
const lostBy = (s: Run, f: (c: Run["closed"][number]) => boolean) =>
  s.closed.filter((c) => c.state === "lost" && f(c)).length;
/** Counters the checks compare with the ones taken when the goals were offered. */
const snap = (s: Run): Record<string, number> => ({
  ...s.meters,
  week: s.clock.week,
  lost: lostBy(s, () => true),
  crimeLost: lostBy(s, (c) => c.layer === "crime"),
  wonOutput: wonBy(s, (c) => c.need === "output"),
  press: wonBy(s, (c) => c.layer === "press"),
  rivals: wonBy(s, (c) => c.layer === "rivals"),
  gone: active(s).filter((p) => !["active", "on_leave", "sick", "away"].includes(p.status ?? "active")).length,
});

const ctxOf = (s: Run): Ctx => {
  const base = (k: string) => s.tally[`goal.${k}`] ?? 0;
  const now = snap(s);
  return {
    since: base("week"),
    hist: s.meterHistory.filter((h) => h.week > base("week")),
    gain: (k) => (now[k] ?? 0) - base(k),
  };
};

export const checkGoal = (s: Run, id: string, kit?: PlaceKit) => !!goalById(id, kit)?.check(s, ctxOf(s));

/** Offers 5 goals for `t` (the run's authority and its systems and layers decide the pool) and takes the baseline. */
export function offerGoals(s: Run, kit?: PlaceKit, t = term(s.clock, termWeeks(s))) {
  const list = pool(kit).filter((g) => (!g.auth || g.auth.includes(s.authority)) && (g.needs?.(s) ?? true));
  const offered: string[] = [];
  while (offered.length < 5 && list.length)
    offered.push(...list.splice(list.indexOf(pick(s, list)), 1).map((g) => g.id));
  s.goals.push({ term: t, offered, picked: [], met: [] });
  for (const [k, v] of Object.entries(snap(s))) s.tally[`goal.${k}`] = v;
}

/** The goals of the current term. A term that has not been offered yet shows the offer the next pick would make. */
export function currentGoals(s: Run, kit?: PlaceKit) {
  const t = term(s.clock, termWeeks(s));
  const own = s.goals.find((g) => g.term === t);
  if (own) return own;
  const c = structuredClone(s);
  offerGoals(c, kit, t);
  return c.goals.at(-1)!;
}

/** The player picks 3 goals (or all of them when fewer are offered). */
export function pickGoals(s: Run, ids: string[], kit?: PlaceKit) {
  const t = term(s.clock, termWeeks(s));
  if (!s.goals.some((g) => g.term === t)) offerGoals(s, kit, t);
  const g = s.goals.find((x) => x.term === t)!;
  if (g.picked.length) throw new Error("This term's goals are already set");
  const want = Math.min(3, g.offered.length);
  if (new Set(ids).size !== want || ids.length !== want || ids.some((id) => !g.offered.includes(id)))
    throw new Error(`Pick ${want} of the offered goals`);
  g.picked = [...ids];
}

/** Term end (call from `endTerm`): checks the picks, then offers next term's goals and a perk. */
export function endTermGoals(s: Run, kit?: PlaceKit) {
  const g = s.goals.find((x) => x.term === s.lastTerm);
  if (g) g.met = g.picked.filter((id) => checkGoal(s, id, kit));
  if (s.clock.week >= WEEKS) return;
  offerGoals(s, kit, s.lastTerm + 1);
  offerPerks(s);
}
