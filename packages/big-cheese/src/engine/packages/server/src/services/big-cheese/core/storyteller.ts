// The storyteller (design.md section 5): tension, card budget, decks and the target number of open threads.
// It runs once each morning from cards.seedDay and only plans; the model writes words.
import { dayIndex } from "./clock.js";
import { pick, roll } from "./rng.js";
import { K } from "./stances.js";
import { closeThread, openStory, openThread } from "./threads.js";
import { applyDelta, newId } from "./run.js";
import { METERS } from "./types.js";
import type { Meter, Meters, Run, Severity, Thread } from "./types.js";

// Cards per day (min, max), open threads to keep, crisis chance per week (design.md 5.2).
export const PRESETS = {
  calm: { cards: [2, 2], open: 5, crisis: 0.05 },
  classic: { cards: [3, 3], open: 6, crisis: 0.15 },
  chaos: { cards: [2, 5], open: 8, crisis: 0.35 },
} as const;

// Tension, meter part only (design.md 5.1). The balance sim models only this part.
export const meterTension = (m: Meters) => METERS.reduce((a, k) => a + Math.max(0, 50 - m[k]), 0) / 4;

export function tension(s: Run) {
  const open = Object.values(s.threads);
  const due = open.filter((t) => t.clock.dueWeek === s.clock.week).length;
  const stressed = Object.values(s.people).filter((p) => p.stress > 70).length;
  const crises = open.filter((t) => t.kind === "crisis").length;
  return Math.min(100, meterTension(s.meters) + 8 * due + 5 * stressed + 10 * crises);
}

// The target tension for today. Calm: at most 35. Classic: a wave from 20 to 60 over 3 weeks, then a quiet week. Chaos: a random value each day.
function target(s: Run) {
  if (s.storyteller === "calm") return 35;
  const w = (s.clock.week - 1) % 4;
  if (s.storyteller === "chaos") return Math.round(10 + roll(s) * 80);
  return w === 3 ? 25 : 20 + (40 * (w * 5 + s.clock.day)) / 14;
}

// Severity mix as cumulative cuts for 1 / 2 / 3 (design.md 5.2). A calm place gets harder cards; above the target tension cards are small.
export function severityCuts(s: Run): [number, number] {
  if (s.storyteller !== "calm" && meterTension(s.meters) < 20) return [0.25, 0.7];
  if (tension(s) > s.story.wave) return [0.7, 0.95];
  return s.storyteller === "calm" ? [0.6, 0.95] : s.storyteller === "chaos" ? [0.33, 0.66] : [0.45, 0.85];
}

// Generic decks (design.md 5.3). The run Kit has no decks of its own yet, so these are plain and fit any place.
interface Item {
  title: string;
  need: Meter;
  card?: boolean;
}
const CRISES: Item[] = [
  { title: "The power goes out", need: "output" },
  { title: "A big client walks away", need: "money" },
  { title: "Many people fall sick", need: "people" },
  { title: "A surprise inspection", need: "standing" },
];
const SURPRISES: Item[] = [
  { title: "A rival makes a move", need: "standing", card: true },
  { title: "Someone hands in a notice", need: "people", card: true },
  { title: "A visitor arrives without warning", need: "standing" },
  { title: "A piece of good luck", need: "money" },
];
const ARCS: Item[] = [
  { title: "A person's hope", need: "people" },
  { title: "Something is not right", need: "standing" },
  { title: "A secret in the place", need: "standing" },
];
const ARC_KIND = ["personal_arc", "mystery", "cover_up"] as const;

// The same topic must not return within 2 weeks.
// shortcut: closed threads carry no week, so the last 6 closed titles stand in for 2 weeks; replace once `closed` has a week.
function draw(s: Run, deck: Item[]) {
  const recent = new Set([...Object.values(s.threads), ...s.closed.slice(-6)].map((t) => t.title));
  const fresh = deck.filter((i) => !recent.has(i.title));
  return pick(s, fresh.length ? fresh : deck);
}

const someone = (s: Run) => pick(s, Object.keys(s.people));
const tomorrow = (s: Run) => ({ week: s.clock.week + (s.clock.day === 4 ? 1 : 0), day: (s.clock.day + 1) % 5 });

// A thread past its due week ends by kind. Cards, promises, letters and hearings close themselves; a revolt closes on Friday (checkRevolt).
const EXPIRES: Partial<Record<Thread["kind"], "won" | "lost" | "dropped">> = {
  cover_up: "won",
  wish: "won",
  mystery: "dropped",
  project: "lost",
};

function clocks(s: Run) {
  for (const t of Object.values(s.threads)) {
    const due = t.clock.dueWeek;
    if (due === "open") continue;
    if (due === s.clock.week) t.clock.pressure = "due";
    else if (due === s.clock.week + 1 && t.clock.pressure === "quiet") t.clock.pressure = "building";
    if (due >= s.clock.week) continue;
    const end =
      t.kind === "personal_arc"
        ? (s.people[t.people[0] ?? ""]?.ambition ?? 0) >= 100
          ? "won"
          : "dropped"
        : EXPIRES[t.kind];
    if (!end) continue;
    if (end === "lost" && t.need) s.meters = applyDelta(s.meters, { [t.need]: -K[t.severity ?? 2] });
    closeThread(s, t.id, end);
  }
}

// Monday: maybe a crisis, 25% at the classic peak (design.md 5.2).
function weekly(s: Run) {
  const peak = s.storyteller === "classic" && (s.clock.week - 1) % 4 === 2;
  if (
    Object.values(s.threads).some((t) => t.kind === "crisis") ||
    roll(s) >= (peak ? 0.25 : PRESETS[s.storyteller].crisis)
  )
    return;
  const item = draw(s, CRISES);
  openStory(s, "crisis", { title: item.title, need: item.need, people: [someone(s)], severity: 3, origin: "deck" });
}

// At least 1 surprise a week: a 15% chance on Mon-Wed, and Thursday makes one if the week had none.
function surprise(s: Run) {
  if (s.story.lastSurprise?.week === s.clock.week || s.clock.day > 3 || (s.clock.day < 3 && roll(s) >= 0.15)) return;
  const item = draw(s, SURPRISES);
  const t = openThread(s, {
    kind: "follow_up",
    title: item.title,
    need: item.need,
    severity: 2,
    people: [someone(s)],
    origin: "deck",
  });
  t.beats.push({
    id: newId(s, "b"),
    type: item.card ? "card" : "check",
    planned: tomorrow(s),
    ...(item.card && { seed: { need: item.need, severity: 2 as Severity } }),
  });
  s.story.lastSurprise = { week: s.clock.week, day: s.clock.day };
}

// Fewer open threads (with a beat still to come) than the target: open an arc, a mystery or a cover-up. Player-made threads are never blocked, they only count.
function fill(s: Run) {
  const today = dayIndex(s.clock);
  const live = Object.values(s.threads).filter((t) =>
    t.beats.some((b) => b.planned && dayIndex(b.planned) >= today),
  ).length;
  if (live >= PRESETS[s.storyteller].open) return;
  const i = Math.floor(roll(s) * ARCS.length);
  const arcs = Object.values(s.threads).filter((t) => t.kind === ARC_KIND[i]);
  const p = someone(s);
  // one arc per person at a time, one thread per other kind
  if (ARC_KIND[i] === "personal_arc" ? arcs.some((t) => t.people[0] === p) : arcs.length) return;
  openStory(s, ARC_KIND[i]!, {
    title: ARCS[i]!.title,
    need: ARCS[i]!.need,
    people: [p],
    severity: (1 + Math.floor(roll(s) * 2)) as Severity,
    origin: "arc",
  });
}

/** The morning pass (design.md 3.3): tension, clocks, weekly crisis, surprise, thread target. Returns today's request-card budget. */
export function morning(s: Run): number {
  s.story.wave = target(s);
  s.story.tension = tension(s);
  clocks(s);
  if (s.clock.day === 0) weekly(s);
  surprise(s);
  fill(s);
  const [lo, hi] = PRESETS[s.storyteller].cards;
  return lo + Math.floor(roll(s) * (hi - lo + 1));
}

/** Friday: Legitimacy 0 opens a revolt, 25 or more wins it, and a revolt that runs out of time ends the reign (design.md 9). */
export function checkRevolt(s: Run) {
  const legitimacy = s.extras.find((e) => e.id === "legitimacy")?.value;
  if (legitimacy === undefined) return;
  const revolt = Object.values(s.threads).find((t) => t.kind === "revolt");
  if (!revolt) {
    if (legitimacy <= 0)
      openStory(s, "revolt", {
        title: "The people rise",
        need: "standing",
        people: Object.keys(s.people).slice(0, 1),
        origin: "arc",
      });
  } else if (legitimacy >= 25) closeThread(s, revolt.id, "won");
  else if (revolt.clock.dueWeek === s.clock.week) {
    closeThread(s, revolt.id, "lost");
    s.status = "ended";
    s.ending = "Overthrown";
  }
}
