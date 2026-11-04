// Big Cheese stance balance sim: plays one year with fixed-strategy bots.
// Model: each card threatens one meter (its "need"). The stance decides what happens to the need and
// what it costs. Sources: content.md §1 (stance table), design.md §5 (Classic budget), §4.5 (ignored cards).
// Run: node .github/plans/big-cheese/sim/stance-sim.mjs [runs]
// Experiments: SIM='{"cards":4,"drift":0}' node … overrides the tuning knobs in R.
import assert from "node:assert/strict";

const KEYS = ["M", "O", "P", "S"];
const START = { M: 55, O: 50, P: 60, S: 65 }; // Hafenkai, content.md §2.1; a year is 3 terms of 8 weeks
const DAYS = 5;
const R = {
  weeks: 24,
  hours: 5,
  cards: 3,
  drift: 0.1,
  base: 2,
  income: 0.2,
  k: [3, 6, 10],
  wear: 2,
  ambition: 15,
  calm: 20,
  ...JSON.parse(process.env.SIM ?? "{}"),
};

// need = the threatened meter, cost = Money (People when the need is Money). k = size for the severity.
const half = (k) => Math.round(k / 2),
  quarter = (k) => Math.round(k / 4);
// via = the cost meter of the stance (People when it equals the need)
const D = {
  invest: (k) => ({ need: k, cost: -k }),
  cheap_fix: (k) => ({ need: half(k), cost: -quarter(k), via: "O" }),
  delay: () => ({}),
  delegate: (k) => ({ need: half(k), S: k > 3 ? -1 : 0 }),
  refuse: (k) => ({ need: -half(k), cost: quarter(k) }),
  ask_others: (k) => ({ O: k > 3 ? -1 : 0 }),
};
// follow-up chance by severity, and the severity it comes back with (+1 = one step worse)
const FOLLOW = {
  invest: [[0, 0, 0], 0],
  cheap_fix: [[30, 45, 60], 1],
  delay: [[50, 65, 80], 1],
  delegate: [[30, 40, 50], 0],
  refuse: [[25, 35, 45], 0],
  ask_others: [[40, 40, 40], 0],
};
const STANCES = Object.keys(D);

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v) => Math.max(0, Math.min(100, v));
function effect(card, stance) {
  const e = D[stance](R.k[card.sev - 1]);
  const delta = {};
  const add = (key, v) => v && (delta[key] = (delta[key] ?? 0) + v);
  add(card.need, e.need);
  const via = e.via ?? "M";
  add(card.need === via ? "P" : via, e.cost);
  add("S", e.S);
  add("O", e.O);
  return delta;
}
const apply = (m, delta) => {
  for (const k of KEYS) m[k] = clamp(m[k] + (delta[k] ?? 0));
};

const bots = {
  random: (offer, _card, _m, r) => offer[Math.floor(r() * offer.length)],
  greedy: (offer, card, m) => {
    // keep the lowest meter highest, then the highest total
    const score = (s) => {
      const n = { ...m };
      apply(n, effect(card, s));
      return Math.min(...KEYS.map((k) => n[k])) * 1000 + KEYS.reduce((a, k) => a + n[k], 0);
    };
    return offer.reduce((a, b) => (score(b) > score(a) ? b : a));
  },
  ...Object.fromEntries(
    STANCES.map((s) => [
      `always:${s}`,
      (offer, _c, _m, r) => (offer.includes(s) ? s : offer[Math.floor(r() * offer.length)]),
    ]),
  ),
};

// code picks the answers (design.md §4.2): one strong, one middle, one weak
const TIERS = [["invest"], ["cheap_fix", "delegate"], ["delay", "refuse", "ask_others"]];
const pick = (list, r) => list[Math.floor(r() * list.length)];

function play(bot, seed, mode) {
  const r = rng(seed);
  const m = { ...START };
  const low = { M: 0, O: 0, P: 0, S: 0 };
  let inbox = [],
    later = [];
  let ambition = 0;
  const answer = (card, stance, day) => {
    apply(m, effect(card, stance));
    // delegate feeds the deputy's ambition; at 100 they challenge you at the board (content.md §1.4)
    if (stance === "delegate" && (ambition += R.ambition) >= 100) {
      ambition = 0;
      apply(m, { S: -10, P: -5 });
    }
    const [chance, worse] = FOLLOW[stance];
    if (r() * 100 >= chance[card.sev - 1]) return;
    later.push({ due: day + DAYS * (1 + Math.floor(r() * 3)), need: card.need, sev: Math.min(3, card.sev + worse) });
  };
  for (let day = 0; day < R.weeks * DAYS; day++) {
    for (const f of later.filter((f) => f.due === day)) inbox.push({ need: f.need, sev: f.sev, age: 0 });
    later = later.filter((f) => f.due !== day);
    // design.md §5 tension; a calm place gets harder cards (Classic 45/40/15, calm 25/45/30)
    const tension = KEYS.reduce((a, k) => a + Math.max(0, 50 - m[k]), 0) / 4;
    const [s1, s2] = tension < R.calm ? [0.25, 0.7] : [0.45, 0.85];
    for (let i = 0; i < R.cards; i++) {
      const x = r();
      inbox.push({ need: KEYS[Math.floor(r() * 4)], sev: x < s1 ? 1 : x < s2 ? 2 : 3, age: 0 });
    }
    for (const card of inbox.splice(0, R.hours)) {
      const offer =
        mode === "all"
          ? STANCES
          : mode === "triad"
            ? TIERS.map((t) => pick(t, r))
            : [...STANCES].sort(() => r() - 0.5).slice(0, 3);
      answer(card, bot(offer, card, m, r), day);
    }
    for (const card of inbox) card.age++;
    // a card that waits 5 days happens: the full hit on its need, no follow-up
    for (const card of inbox.filter((c) => c.age >= 5)) apply(m, { [card.need]: -R.k[card.sev - 1] });
    inbox = inbox.filter((c) => c.age < 5);
    if (day % DAYS === DAYS - 1) {
      // Friday settle: income from Output, then every meter drifts toward 50
      apply(m, { M: R.base + Math.round((m.O - 50) * R.income) });
      for (const k of KEYS) m[k] = clamp(Math.round(m[k] + (50 - m[k]) * R.drift) - R.wear);
      for (const k of KEYS) low[k] = m[k] < 10 ? low[k] + 1 : 0;
      const killer = KEYS.find((k) => low[k] >= 2);
      if (killer) return { fired: Math.floor(day / DAYS) + 1, killer, m };
    }
  }
  return { fired: 0, m };
}

// self-check: invest on a sev 2 roof card (need Standing) costs Money
assert.deepEqual(effect({ need: "S", sev: 2 }, "invest"), { S: R.k[1], M: -R.k[1] });
assert.deepEqual(effect({ need: "M", sev: 2 }, "refuse"), { M: -half(R.k[1]), P: quarter(R.k[1]) });

const runs = Number(process.argv[2] ?? 500);
for (const mode of (process.env.MODES ?? "triad,all").split(",")) {
  console.log(
    `\n${{ all: "All 6 stances on every card", triad: "Strong / middle / weak answer on each card", random: "3 random stances on each card" }[mode]} · ${runs} runs · ${R.weeks} weeks`,
  );
  console.log("bot".padEnd(18) + "fired%  avgWeek  killer          end M/O/P/S");
  for (const [name, bot] of Object.entries(bots)) {
    const res = Array.from({ length: runs }, (_, i) => play(bot, i + 1, mode));
    const fired = res.filter((x) => x.fired);
    const killers = {};
    for (const x of fired) killers[x.killer] = (killers[x.killer] ?? 0) + 1;
    const avg = (k) => Math.round(res.reduce((a, x) => a + x.m[k], 0) / runs);
    console.log(
      name.padEnd(18) +
        `${Math.round((fired.length / runs) * 100)}%`.padEnd(8) +
        `${fired.length ? Math.round(fired.reduce((a, x) => a + x.fired, 0) / fired.length) : "-"}`.padEnd(9) +
        (
          Object.entries(killers)
            .map(([k, n]) => `${k}:${n}`)
            .join(" ") || "-"
        ).padEnd(16) +
        KEYS.map(avg).join("/"),
    );
  }
}
