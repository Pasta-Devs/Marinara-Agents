// D12 gate: plays the 24-week Hafenkai year through the core with the sim's bots.
// A careful bot is never fired; a random bot is fired in 20%-60% of runs. "Fired" = a hearing
// is called (the sim's loss check), the run stops there.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";

import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
const RUNS = 200;
type Bot = (card: core.Card, m: core.Meters, h: { rng: number }) => string;

const stances = (c: core.Card) => c.answers.map((a) => a.stance);
const random: Bot = (c, _m, h) => core.pick(h, stances(c));
// keep the lowest meter highest, then the highest total
const careful: Bot = (c, m) => {
  const score = (s: string) => {
    const n = core.applyDelta(m, core.effect(c, s));
    return Math.min(...core.METERS.map((k) => n[k])) * 1000 + core.METERS.reduce((a, k) => a + n[k], 0);
  };
  return stances(c).reduce((a, b) => (score(b) > score(a) ? b : a));
};
const always =
  (s: string): Bot =>
  (c, m, h) =>
    stances(c).includes(s) ? s : random(c, m, h);

const bots: Record<string, Bot> = {
  careful,
  random,
  "careful+steady_hand": careful, // M4 T8: one perk row, the number is in the test log
};
for (const s of core.STANCES) bots[`always:${s}`] = always(s);

function play(bot: Bot, seed: number, perk?: string) {
  const s = core.newRun(core.HAFENKAI, seed);
  if (perk) s.perks = [perk]; // one copy, then in-place steps (the pure API clones every call)
  const h = { rng: seed * 7919 + 13 };
  while (s.status === "playing") {
    core.draft.seedDay(s);
    while (s.inbox.length && s.clock.hoursLeft > 0) {
      const c = s.inbox[0]!;
      core.draft.answerCard(s, c.id, bot(c, s.meters, h));
    }
    core.draft.endDay(s, HAFENKAI_PLACE);
    if (s.hearing) return { fired: true, week: s.clock.week, killer: s.hearing.meter, meters: s.meters };
  }
  return { fired: false, week: core.WEEKS, killer: null, meters: s.meters };
}

test("balance: Hafenkai year, 200 runs per bot (D12 gate)", () => {
  const rate: Record<string, number> = {};
  console.log("bot".padEnd(22) + "fired".padEnd(8) + "avgWeek".padEnd(9) + "killers".padEnd(26) + "M/O/P/S");
  for (const [name, bot] of Object.entries(bots)) {
    const res = Array.from({ length: RUNS }, (_, i) => play(bot, i + 1, name.split("+")[1]));
    const fired = res.filter((r) => r.fired);
    const killers: Record<string, number> = {};
    for (const r of fired) killers[r.killer!] = (killers[r.killer!] ?? 0) + 1;
    rate[name] = fired.length / RUNS;
    const avg = (k: core.Meter) => Math.round(res.reduce((a, r) => a + r.meters[k], 0) / RUNS);
    console.log(
      name.padEnd(22) +
        `${Math.round(rate[name]! * 100)}%`.padEnd(8) +
        (fired.length ? String(Math.round(fired.reduce((a, r) => a + r.week, 0) / fired.length)) : "-").padEnd(9) +
        (
          Object.entries(killers)
            .map(([k, n]) => `${k[0]}:${n}`)
            .join(" ") || "-"
        ).padEnd(26) +
        core.METERS.map(avg).join("/"),
    );
  }
  assert.equal(rate.careful, 0, "careful bot must never be fired");
  assert.equal(rate["careful+steady_hand"], 0, "steady hand must not get a careful bot fired");
  assert.ok(rate.random! >= 0.2 && rate.random! <= 0.6, `random bot fired in ${rate.random! * 100}% of runs`);
});
