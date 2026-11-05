import { ageCards } from "./cards.js";
import { weeklyAuthority } from "./authority.js";
import { weeklyCulture } from "./culture.js";
import { WEEKS, dayIndex, isFriday, nextDay, term } from "./clock.js";
import { callHearing, holdHearing } from "./hearing.js";
import { termWeeks } from "./mutators.js";
import { dayTurn } from "./people.js";
import { applyDelta, clamp, pure } from "./run.js";
import { checkRevolt } from "./storyteller.js";
import { sulkAdvisors } from "./advisors.js";
import { bossWeek } from "./boss.js";
import { eyesWeek } from "./eyes.js";
import { delegateDay } from "./delegation.js"; // T11
import { perkWear } from "./perks.js";
import { endTerm } from "./term.js";
import { checkPromises } from "./threads.js";
import { METERS, WISH_POINTS_PER_TERM } from "./types.js";
import { weekThings } from "./things.js";
import type { PlaceKit } from "./kits/types.js";
import type { Run } from "./types.js";

// Sim numbers (content.md 1.5): income 2 + (O-50)/5, drift 10% toward 50, wear 2.
const BASE = 2;
const INCOME = 0.2;
const DRIFT = 0.1;
const WEAR = 2;

// Friday settle, in order: income, drift + wear, extra meters, loss check.
export function settleWeek(s: Run, before = { ...s.meters }, kit?: PlaceKit) {
  const income = BASE + Math.round((s.meters.output - 50) * INCOME);
  s.meters = applyDelta(s.meters, { money: income });
  for (const k of METERS)
    s.meters[k] = clamp(Math.round(s.meters[k] + (50 - s.meters[k]) * DRIFT - WEAR * perkWear(s)));
  for (const e of s.extras) if (e.value < 20) s.meters[e.main] = clamp(s.meters[e.main] - 2);
  weeklyCulture(s);
  if (kit) weeklyAuthority(s, kit); // T7: house rules, the absolute rule
  if (kit) eyesWeek(s, kit); // T13: informants and rumours
  bossWeek(s);
  s.report = { week: s.clock.week, income, before, after: { ...s.meters } };
  s.meterHistory.push({ week: s.clock.week, ...s.meters });
  for (const k of METERS) s.low[k] = s.meters[k] < 10 ? s.low[k] + 1 : 0;
  const bad = METERS.find((k) => s.low[k] >= 2);
  if (bad) callHearing(s, bad);
  checkRevolt(s);
  weekThings(s, kit); // T2: wear, secrets
  sulkAdvisors(s); // T11
}

// End of day: promises due, waiting cards age, a pending hearing is held on its day, Friday
// settles, then the clock moves on. The run is complete after Friday of week 24.
export function endDay(s: Run, kit: PlaceKit) {
  if (s.status !== "playing") return;
  // The report's "before" is what the Office showed when the player ended the day,
  // so cards ignored until Friday show up in the change, not in the starting value.
  const before = { ...s.meters };
  checkPromises(s);
  delegateDay(s, kit); // T11: delegates answer their areas first
  ageCards(s);
  if (s.hearing && dayIndex(s.clock) >= dayIndex(s.hearing)) holdHearing(s);
  if (isFriday(s.clock)) {
    settleWeek(s, before, kit);
    const n = term(s.clock, termWeeks(s));
    // lastTerm keeps a mid-run speed_run switch from ending a term twice
    if (s.status === "playing" && s.clock.week % termWeeks(s) === 0 && n > s.lastTerm) {
      s.lastTerm = n;
      endTerm(s, kit);
    }
  }
  if (s.status !== "playing") return;
  if (s.clock.week >= WEEKS && isFriday(s.clock)) {
    // A hearing still pending at year end is held at once, so a lost meter cannot slip past it.
    if (s.hearing) holdHearing(s);
    if (s.status === "playing") s.status = "complete";
  } else {
    s.clock = nextDay(s.clock);
    // A new term refills the in-run wish points (design.md 3.7).
    const termNow = term(s.clock, termWeeks(s));
    if (termNow !== s.wishPoints.term) s.wishPoints = { term: termNow, left: WISH_POINTS_PER_TERM };
    dayTurn(s, kit);
  }
}

export const pureSettleWeek = pure(settleWeek);
export const pureEndDay = pure(endDay);
