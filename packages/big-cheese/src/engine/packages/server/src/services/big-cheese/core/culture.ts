// ──────────────────────────────────────────────
// Big Cheese: culture tags and traditions (content.md 7.1, 7.2)
// ──────────────────────────────────────────────
// Pure code over `run.culture`, `run.cultureLog` and `run.traditions`.
import { applyDelta, pure, spendHour } from "./run.js";
import { openStory } from "./threads.js";
import { DIFFICULTY_FACTOR } from "./types.js";
import type { Meters, Run } from "./types.js";

/** `from`: the stances that grow the tag. `opp`: the opposite tag (Open question 1). Festive grows from traditions. */
export const TAGS: Record<string, { from: string[]; opp: string; weekly?: Partial<Meters> }> = {
  family: { from: ["invest", "reward", "pardon"], opp: "cutthroat" },
  cutthroat: { from: ["punish", "refuse", "banish"], opp: "family", weekly: { output: 2, people: -1 } },
  chaotic: { from: ["delay", "cheap_fix", "delegate"], opp: "scholarly" },
  scholarly: { from: ["invest", "ask_others"], opp: "chaotic" },
  strict: { from: ["decree", "punish"], opp: "free" },
  free: { from: ["ask_others"], opp: "strict", weekly: { people: 1 } },
  festive: { from: [], opp: "frugal", weekly: { standing: 1, money: -1 } },
  frugal: { from: ["cheap_fix", "refuse"], opp: "festive", weekly: { money: 1 } },
  secretive: { from: ["delay"], opp: "honour_bound" },
  honour_bound: { from: ["pardon", "reward"], opp: "secretive" },
};

const ACTIVE_AT = 3;
const MAX_ACTIVE = 3;
const LOG_WEEKS = 8;
const LOG_MAX = 60; // shortcut: a hard cap keeps the save small, lower it if snapshots grow

const known = (t: string) => Object.hasOwn(TAGS, t);

/** The tags at 3+ points: the top 3, with a tag dropped when its opposite is in the list too. */
export function activeTags(culture: Record<string, number> | undefined): string[] {
  const top = Object.entries(culture ?? {})
    .filter(([t, p]) => known(t) && p >= ACTIVE_AT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ACTIVE)
    .map(([t]) => t);
  return top.filter((t) => !top.includes(TAGS[t]!.opp));
}

/** Logs an answer. A repeat (3 in a row, or 5 in the last 8 weeks) gives the tags that grow from it a point. */
export function logStance(s: Run, stance: string) {
  const week = s.clock.week;
  const log = [...s.cultureLog, { stance, week }].filter((e) => e.week > week - LOG_WEEKS).slice(-LOG_MAX);
  s.cultureLog = log;
  let run = 0;
  for (let i = log.length - 1; i >= 0 && log[i]!.stance === stance; i--) run++;
  const seen = log.filter((e) => e.stance === stance).length;
  if (run % 3 && seen % 5) return;
  for (const [tag, def] of Object.entries(TAGS))
    if (def.from.includes(stance)) s.culture = { ...s.culture, [tag]: (s.culture[tag] ?? 0) + 1 };
}

/** The Friday effects of the active tags. */
export function weeklyCulture(s: Run) {
  for (const t of activeTags(s.culture)) {
    const d = TAGS[t]!.weekly;
    if (d) s.meters = applyDelta(s.meters, d, DIFFICULTY_FACTOR[s.difficulty]);
  }
}

/** Weight of a stance in the offer: Strict makes decrees and punishments 1.5 times as likely. */
export const stanceWeight = (culture: Record<string, number> | undefined, stance: string) =>
  activeTags(culture).includes("strict") && (stance === "decree" || stance === "punish") ? 1.5 : 1;

/** Family: firing a person costs more trust. */
export const trustWeight = (culture: Record<string, number> | undefined, stance: string) =>
  activeTags(culture).includes("family") && stance === "banish" ? 1.5 : 1;

/** An event (ritual, Big event, kit ritual) happened. The third time it becomes a tradition. */
export function countEvent(s: Run, id: string, text: string) {
  let t = s.traditions.find((x) => x.id === id);
  if (!t) s.traditions.push((t = { id, text, count: 0, active: false }));
  if (t.active) return;
  t.count++;
  if (t.count >= 3) {
    t.active = true;
    s.culture = { ...s.culture, festive: (s.culture.festive ?? 0) + 1 };
  }
}

/** Stops a tradition: 1 hour, People -6, and a protest thread. */
export function stopTradition(s: Run, id: string) {
  const t = s.traditions.find((x) => x.id === id);
  if (!t?.active) throw new Error(`Tradition ${id} is not active`);
  spendHour(s);
  t.active = false;
  t.count = 0;
  s.meters = applyDelta(s.meters, { people: -6 }, DIFFICULTY_FACTOR[s.difficulty]);
  openStory(s, "crisis", {
    title: `Protest: ${t.text}`,
    origin: "action",
    people: s.deputy ? [s.deputy] : [],
    need: "people",
    severity: 2,
  });
}

export const pureStopTradition = pure(stopTradition);
