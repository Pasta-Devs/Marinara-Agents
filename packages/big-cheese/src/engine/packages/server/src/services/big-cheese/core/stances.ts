import { pick } from "./rng.js";
import type { Answer, Authority, Meter, Meters, Severity, Tier } from "./types.js";

// Numbers from content.md section 1 and sim/stance-sim.mjs. Change a number, run the balance test.
export const K: Record<Severity, number> = { 1: 3, 2: 6, 3: 10 };
export const STANCES = ["invest", "cheap_fix", "delay", "delegate", "refuse", "ask_others"] as const;
export type Stance = (typeof STANCES)[number];

const half = (k: number) => Math.round(k / 2);
const quarter = (k: number) => Math.round(k / 4);

interface Raw {
  need?: number; // change to the need meter
  cost?: number; // change to the cost meter
  via?: Meter; // cost meter (money unless set; people when the need is the cost meter)
  standing?: number;
  output?: number;
}
const D: Record<string, (k: number) => Raw> = {
  invest: (k) => ({ need: k, cost: -k }),
  cheap_fix: (k) => ({ need: half(k), cost: -quarter(k), via: "output" }),
  delay: () => ({}),
  delegate: (k) => ({ need: half(k), standing: k > 3 ? -1 : 0 }),
  refuse: (k) => ({ need: -half(k), cost: quarter(k) }),
  ask_others: (k) => ({ output: k > 3 ? -1 : 0 }),
  // Stances of Strong leader and absolute kits (content.md 1.1). First values, see the note in the content table.
  decree: (k) => ({ need: half(k), cost: -quarter(k), via: "people" }),
  punish: (k) => ({ need: quarter(k), cost: -quarter(k), via: "people" }),
  pardon: (k) => ({ need: -quarter(k), cost: quarter(k), via: "people" }),
  reward: (k) => ({ need: half(k), cost: -half(k) }),
  banish: (k) => ({ need: half(k), cost: -half(k), via: "people", standing: -1 }),
  appoint: (k) => ({ need: half(k), cost: -quarter(k), via: "output" }),
};

// Meter deltas of one answer, before clamping.
export function effect(card: { need: Meter; severity: Severity }, stance: string): Partial<Meters> {
  const fn = D[stance as Stance];
  if (!fn) throw new Error(`Unknown stance: ${stance}`);
  const e = fn(K[card.severity]);
  const out: Partial<Meters> = {};
  const add = (m: Meter, v?: number) => {
    if (v) out[m] = (out[m] ?? 0) + v;
  };
  const via = e.via ?? "money";
  add(card.need, e.need);
  add(card.need === via ? "people" : via, e.cost);
  add("standing", e.standing);
  add("output", e.output);
  return out;
}

// Trust change for the asker at severity 2 (Manager kits); sev 1 is half, sev 3 one and a half.
const TRUST: Record<string, number> = {
  invest: 8,
  cheap_fix: -2,
  delay: -3,
  delegate: -2,
  refuse: -7,
  ask_others: 2,
  decree: -2,
  punish: -5,
  pardon: 5,
  reward: 6,
  banish: -9,
  appoint: 8,
};
export const trustChange = (stance: string, severity: Severity) =>
  Math.round((TRUST[stance as Stance] ?? 0) * ([0.5, 1, 1.5] as const)[severity - 1]!);

// Follow-up chance in % by severity, and the severity bump when it comes back (content.md 1.3).
export const FOLLOW: Record<string, { chance: [number, number, number]; worse: 0 | 1 }> = {
  invest: { chance: [0, 0, 0], worse: 0 },
  cheap_fix: { chance: [30, 45, 60], worse: 1 },
  delay: { chance: [50, 65, 80], worse: 1 },
  delegate: { chance: [30, 40, 50], worse: 0 },
  refuse: { chance: [25, 35, 45], worse: 0 },
  ask_others: { chance: [40, 40, 40], worse: 0 },
  decree: { chance: [20, 30, 40], worse: 0 },
  punish: { chance: [30, 40, 55], worse: 0 },
  pardon: { chance: [25, 25, 25], worse: 0 },
  reward: { chance: [15, 20, 25], worse: 0 },
  banish: { chance: [35, 45, 55], worse: 0 },
  appoint: { chance: [30, 30, 30], worse: 0 },
};

// Tiers per authority (content.md 1.6). Only the Manager row is played in M1; the rest is data
// (its stances are not in the table above yet).
export const TIERS: Record<Authority, Record<Tier, readonly string[]>> = {
  manager: { strong: ["invest"], middle: ["cheap_fix", "delegate"], weak: ["delay", "refuse", "ask_others"] },
  strong_leader: {
    strong: ["invest", "reward"],
    middle: ["cheap_fix", "delegate"],
    weak: ["delay", "refuse", "ask_others", "punish"],
  },
  absolute: {
    strong: ["reward", "invest"],
    middle: ["decree", "appoint", "banish", "cheap_fix", "delegate"],
    weak: ["delay", "refuse", "ask_others", "punish", "pardon"],
  },
};

// One strong, one middle, one weak answer. Uniform inside a tier (weights are not in M1).
export const offer = (h: { rng: number }, authority: Authority): Answer[] =>
  (["strong", "middle", "weak"] as const).map((tier) => ({ tier, stance: pick(h, TIERS[authority][tier]) }));
