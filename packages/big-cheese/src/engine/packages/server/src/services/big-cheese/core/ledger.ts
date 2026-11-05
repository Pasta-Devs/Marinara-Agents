// ──────────────────────────────────────────────
// Big Cheese M4 T15: detailed money (modules.md section 1 depth options, section 4 budget sliders)
// ──────────────────────────────────────────────
// With `depth.money` on, the Friday income line comes from here: revenue from Output, minus
// salaries, minus loan payments. A loan adds Money now and falls due in 4 or 8 weeks. Every 12 weeks
// a new quarter starts: the player splits 100 budget points over the 4 meters' upkeep. One audit
// falls on a hidden week of each quarter; a missed loan or a low score opens an audit thread.
import { roll } from "./rng.js";
import { applyDelta, clamp, newId } from "./run.js";
import { closeThread, openThread } from "./threads.js";
import { DIFFICULTY_FACTOR, METERS, type Meter, type Run } from "./types.js";
import { WEEKS } from "./clock.js";

export const QUARTER = 12;
export const LOAN_AMOUNTS = [10, 20, 30];
export const LOAN_WEEKS = [4, 8];
export const MAX_OPEN_LOANS = 2;
export const AUDIT_PASS = 50;
// Sim numbers: the revenue at Output 50 less 12 people's pay is the +2 of the plain income line.
const REVENUE = 4;
const REVENUE_RATE = 0.25;
const PAY_PER_HEAD = 0.2;
const INTEREST = 0.2;

export const EVEN = Object.fromEntries(METERS.map((m) => [m, 100 / METERS.length])) as Record<Meter, number>;
export const quarterOf = (week: number) => Math.ceil(week / QUARTER);
export const owed = (l: { amount: number }) => l.amount + Math.ceil(l.amount * INTEREST);
export const budgetOf = (s: Run) => s.ledger.budget ?? EVEN;
const active = (s: Run) => Object.values(s.people).filter((p) => (p.status ?? "active") === "active").length;
/** Budget upkeep: 25 points is neutral, each 25 points more or less moves the meter 1 a week. */
const upkeep = (s: Run, k: Meter) => Math.round((budgetOf(s)[k] - EVEN[k]) / 25);

/** The three lines of the coming Friday, before loans. */
export function ledgerLines(s: Run) {
  const revenue = REVENUE + Math.round((s.meters.output - 50) * REVENUE_RATE);
  return { revenue, salaries: Math.round(active(s) * PAY_PER_HEAD), upkeep: upkeep(s, "money") };
}

export const openLoans = (s: Run) => s.ledger.loans.filter((l) => !l.repaid);

export function takeLoan(s: Run, amount: number, weeks: number) {
  if (!s.depth?.money) throw new Error("Detailed money is off.");
  if (!LOAN_AMOUNTS.includes(amount) || !LOAN_WEEKS.includes(weeks)) throw new Error("This loan is not offered.");
  if (openLoans(s).length >= MAX_OPEN_LOANS) throw new Error("Repay a loan first.");
  const due = s.clock.week + weeks;
  if (due > WEEKS) throw new Error("This loan would fall due after the year ends.");
  s.ledger.loans.push({ id: newId(s, "l"), amount, due, repaid: false });
  s.meters = applyDelta(s.meters, { money: amount });
}

/** The 4 shares must be whole numbers from 0 to 100 that add up to 100. */
export function setBudget(s: Run, b: Record<string, number>) {
  if (!s.depth?.money) throw new Error("Detailed money is off.");
  const next = Object.fromEntries(METERS.map((k) => [k, b[k]])) as Record<Meter, number>;
  const sum = METERS.reduce((a, k) => a + next[k], 0);
  if (METERS.some((k) => !Number.isInteger(next[k]) || next[k] < 0 || next[k] > 100) || sum !== 100)
    throw new Error("The budget must add up to 100 points.");
  s.ledger.budget = next;
}

function auditThread(s: Run) {
  if (Object.values(s.threads).some((t) => t.kind === "audit")) return;
  openThread(s, {
    kind: "audit",
    title: "Audit risk",
    origin: "board",
    need: "money",
    severity: 2,
    stakes: "The books look bad. The next audit may go badly.",
  });
}

const pickAuditWeek = (s: Run, q: number) => (q - 1) * QUARTER + 1 + Math.floor(roll(s) * QUARTER);

/** The Friday income. Replaces step 1 of `settleWeek`; changes the other meters by the budget itself. */
export function ledgerIncome(s: Run): number {
  const L = s.ledger;
  const week = s.clock.week;
  if (!L.quarter) {
    L.quarter = quarterOf(week);
    L.auditWeek = pickAuditWeek(s, L.quarter);
  }
  const lines = ledgerLines(s);
  L.salaries = lines.salaries;
  let income = lines.revenue - lines.salaries + lines.upkeep;
  for (const l of L.loans) {
    if (l.repaid || l.due > week) continue;
    if (s.meters.money + income >= owed(l)) {
      income -= owed(l);
      l.repaid = true;
    } else if (!l.missed) {
      l.missed = true;
      auditThread(s);
    }
  }
  for (const k of METERS) if (k !== "money") s.meters[k] = clamp(s.meters[k] + upkeep(s, k));
  if (week === L.auditWeek) {
    const late = L.loans.filter((l) => !l.repaid && l.due <= week).length;
    L.audit = clamp(Math.round(clamp(s.meters.money + income) * 0.9 + 15 - 25 * late));
    if (L.audit < AUDIT_PASS) {
      auditThread(s);
      s.meters = applyDelta(s.meters, { standing: -5 }, DIFFICULTY_FACTOR[s.difficulty]);
    } else {
      for (const t of Object.values(s.threads)) if (t.kind === "audit") closeThread(s, t.id, "won");
    }
  }
  if (week % QUARTER === 0) {
    L.quarter = quarterOf(week) + 1;
    delete L.budget;
    L.auditWeek = pickAuditWeek(s, L.quarter);
  }
  return income;
}
