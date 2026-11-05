// ──────────────────────────────────────────────
// Big Cheese: perks (content.md 8)
// ──────────────────────────────────────────────
// The player picks 1 of 3 perks after each term. A perk is a flat effect plus a heavier weight for its stance
// in `offer`. `live: false` perks need a hook in a system that is not built yet: they are listed, never offered.
import { pick } from "./rng.js";
import { clamp } from "./run.js";
import { effect } from "./stances.js";
import { METERS } from "./types.js";
import type { Card, Meter, Meters, Run, Severity } from "./types.js";

export interface Perk {
  id: string;
  name: string;
  text: string;
  stance?: string;
  live: boolean;
}

export const PERKS: Perk[] = [
  { id: "negotiator", name: "Negotiator", text: "Meetings start with +1 support.", stance: "ask_others", live: false },
  {
    id: "penny_pincher",
    name: "Penny-pincher",
    text: "Cheap fixes cost 25% less Output.",
    stance: "cheap_fix",
    live: true,
  },
  {
    id: "good_listener",
    name: "Good listener",
    text: "Talk it through always adds a better answer.",
    stance: "ask_others",
    live: false,
  },
  { id: "iron_hand", name: "Iron hand", text: "A decree costs half the Love.", stance: "decree", live: true },
  { id: "silver_tongue", name: "Silver tongue", text: "A refusal costs half the Trust.", stance: "refuse", live: true },
  { id: "builder", name: "Builder", text: "Investing is 15% cheaper.", stance: "invest", live: true },
  {
    id: "trusted_deputy",
    name: "Trusted deputy",
    text: "A small request given away never comes back.",
    stance: "delegate",
    live: true,
  },
  { id: "fair_judge", name: "Fair judge", text: "Punishing costs no Legitimacy.", stance: "punish", live: true },
  { id: "open_heart", name: "Open heart", text: "A pardon gives +4 Love.", stance: "pardon", live: true },
  { id: "generous_host", name: "Generous host", text: "Rewards cost 20% less.", stance: "reward", live: true },
  {
    id: "eye_for_talent",
    name: "Eye for talent",
    text: "Your first appointment always works.",
    stance: "appoint",
    live: true,
  },
  {
    id: "long_breath",
    name: "Long breath",
    text: "Waiting brings back 15% fewer problems.",
    stance: "delay",
    live: true,
  },
  { id: "early_bird", name: "Early bird", text: "+1 hour on Monday.", live: false },
  { id: "thick_skin", name: "Thick skin", text: "Boss Stress rises 30% slower.", live: true },
  { id: "press_friend", name: "Press friend", text: "Press cards hit 25% softer.", stance: "refuse", live: true },
  { id: "lucky_streak", name: "Lucky streak", text: "One crisis per term starts one level lower.", live: false },
  { id: "master_of_ceremony", name: "Master of ceremony", text: "Rituals give +2 People.", live: false },
  { id: "spy_network", name: "Spy network", text: "One free secret reveal per term.", live: false },
  { id: "peacemaker", name: "Peacemaker", text: "Feuds fade twice as fast.", stance: "ask_others", live: false },
  { id: "steady_hand", name: "Steady hand", text: "Meters wear 15% slower on Friday.", live: true },
];

const has = (s: { perks?: string[] }, id: string) => !!s.perks?.includes(id);

/** Weight of a stance in `offer`: x1.5 for each owned perk that improves it. */
export const perkWeight = (perks: string[] | undefined, stance: string) =>
  PERKS.some((p) => p.stance === stance && perks?.includes(p.id)) ? 1.5 : 1;

/** Friday wear factor (the settle multiplies WEAR by it). */
export const perkWear = (s: Run) => (has(s, "steady_hand") ? 0.85 : 1);

/** Gives back `rate` of the cost an answer put on `via` (ceil, so a perk shows even on a small cost). */
function refund(s: Run, c: Card, stance: string, out: Partial<Meters>, via: Meter, rate: number) {
  const other = METERS.find((m) => m !== via)!;
  const cost = -(effect({ ...c, need: other }, stance)[via] ?? 0);
  if (cost > 0) out[via] = (out[via] ?? 0) + Math.ceil(cost * rate);
}

/** The meter change of one answer, with the perks that cut a cost or soften a card (applied before difficulty). */
export function perkEffect(s: Run, c: Card, stance: string, e: Partial<Meters>): Partial<Meters> {
  const out = { ...e };
  if (has(s, "penny_pincher") && stance === "cheap_fix") refund(s, c, stance, out, "output", 0.25);
  if (has(s, "builder") && stance === "invest") refund(s, c, stance, out, "money", 0.15);
  if (has(s, "generous_host") && stance === "reward") refund(s, c, stance, out, "money", 0.2);
  if (has(s, "press_friend") && s.threads[c.thread]?.layer === "press")
    for (const m of METERS) if ((out[m] ?? 0) < 0) out[m] = Math.round(out[m]! * 0.75);
  return out;
}

/** The Trust the asker gains or loses (perks halve a refusal's loss). */
export const perkTrust = (s: Run, stance: string, t: number) =>
  has(s, "silver_tongue") && stance === "refuse" && t < 0 ? Math.round(t / 2) : t;

/** The follow-up chance in percent (perks lower it). */
export function perkChance(s: Run, stance: string, severity: Severity, chance: number) {
  if (has(s, "long_breath") && stance === "delay") return chance - 15;
  if (has(s, "trusted_deputy") && stance === "delegate" && severity === 1) return 0;
  if (has(s, "eye_for_talent") && stance === "appoint" && !s.tally["perk.eye"]) {
    s.tally["perk.eye"] = 1;
    return 0;
  }
  return chance;
}

const legit = (s: Run) => s.extras.find((e) => e.id === "legitimacy");
/** Power before an answer, so `perkAfter` can see what `stancePower` took. */
export const perkPre = (s: Run) => ({ love: s.power.love, legit: legit(s)?.value ?? 0 });

/** Fear, Love and Legitimacy only move in absolute kits (authority.ts); the perks follow the same rule. */
export function perkAfter(s: Run, stance: string, pre: ReturnType<typeof perkPre>) {
  if (s.authority !== "absolute") return;
  if (has(s, "iron_hand") && stance === "decree" && s.power.love < pre.love)
    s.power.love += Math.ceil((pre.love - s.power.love) / 2);
  if (has(s, "open_heart") && stance === "pardon") s.power.love = clamp(s.power.love + 4);
  const l = legit(s);
  if (l && has(s, "fair_judge") && stance === "punish") l.value = Math.max(l.value, pre.legit);
}

/** After a term: offers 3 live perks the boss does not have yet (an old offer that was never taken is replaced). */
export function offerPerks(s: Run) {
  const pool = PERKS.filter((p) => p.live && !has(s, p.id));
  const ids: string[] = [];
  while (ids.length < 3 && pool.length) ids.push(...pool.splice(pool.indexOf(pick(s, pool)), 1).map((p) => p.id));
  s.perkOffer = ids.length ? ids : null;
}

/** Takes one offered perk. */
export function choosePerk(s: Run, id: string) {
  if (!s.perkOffer?.includes(id)) throw new Error("That perk is not offered");
  s.perks.push(id);
  s.perkOffer = null;
}
