/**
 * Friends, roommates and coworkers in ordinary posts (Drama, bonds): now and then a Creator's post is
 * a moment with one of their people in it, so their look reaches the picture and the page feels lived
 * in. Pure and deterministic; it rides the ordinary post call and changes nothing lasting.
 *
 * Pace: about one ordinary slot in five for a Creator who has someone close. Best friends and
 * roommates come up most, coworkers seldom, acquaintances and exes never (an ex has the couple's own
 * "moving on" beat).
 */
import { hash } from "../projects/slp-project.js";
import { slurpBondsFor, type SlurpBond } from "../projects/slp-creator-bonds.js";
import type { SlurpBeat } from "./slp-post-beat.js";

/** Percent of ordinary slots that become a moment with someone close. */
export const SLURP_BOND_BEAT_PERCENT = 20;

const MOMENTS: Record<"friend" | "roommate" | "coworker", readonly string[]> = {
  friend: [
    "getting ready together before a night out",
    "a lazy afternoon at your place, doing nothing in particular",
    "a spontaneous little shoot together, just for fun",
    "trying on outfits and judging each other's picks",
    "a late-night talk that turned into a photo session",
    "a day trip you two finally took",
  ],
  roommate: [
    "a chaotic morning in the flat you share",
    "a movie night on the couch at home",
    "both getting ready in the same mirror",
    "the kitchen at midnight, raiding the fridge",
  ],
  coworker: ["a slow shift together at work", "a break at work that got silly"],
};
const WEIGHT: Record<"friend" | "roommate" | "coworker", number> = { friend: 3, roommate: 3, coworker: 1 };
const RELATION = (bond: SlurpBond) =>
  bond.kind === "friend"
    ? bond.level >= 3
      ? "your best friend"
      : bond.level === 2
        ? "a close friend"
        : "a friend"
    : bond.kind === "roommate"
      ? "your roommate"
      : "someone you work with";

/** A moment with someone close for this ordinary slot, or null. */
export function slurpBondBeat(input: {
  creatorId: string;
  bonds: readonly SlurpBond[];
  names: ReadonlyMap<string, string>;
  sequence: number;
}): SlurpBeat | null {
  if (hash(`bond:${input.creatorId}:${input.sequence}`) % 100 >= SLURP_BOND_BEAT_PERCENT) return null;
  const close = slurpBondsFor(input.bonds, input.creatorId).filter(
    (bond) =>
      bond.temperature !== "cold" &&
      ((bond.kind === "friend" && bond.level >= 1) || bond.kind === "roommate" || bond.kind === "coworker"),
  );
  // Closer people come up more: best friends and roommates most.
  const pool = close.flatMap((bond) => {
    const kind = bond.kind as "friend" | "roommate" | "coworker";
    const weight = WEIGHT[kind] + (bond.kind === "friend" ? bond.level - 1 : 0);
    return Array.from({ length: Math.max(1, weight) }, () => bond);
  });
  if (!pool.length) return null;
  const bond = pool[hash(`bond-pick:${input.creatorId}:${input.sequence}`) % pool.length]!;
  const otherId = bond.aId === input.creatorId ? bond.bId : bond.aId;
  const name = input.names.get(otherId);
  if (!name) return null;
  const kind = bond.kind as "friend" | "roommate" | "coworker";
  const moment = MOMENTS[kind][hash(`bond-moment:${bond.id}:${input.sequence}`) % MOMENTS[kind].length]!;
  const tense =
    bond.temperature === "tense" ? " Things have been a little tense between you lately; it shows, lightly." : "";
  return {
    type: "social_moment",
    anchorKind: "people",
    anchor: name,
    line: `You and ${name}, ${RELATION(bond)}: ${moment}. They are in the post with you; tag them.${tense}`,
    cast: [name],
    castIds: [otherId],
    place: null,
  };
}
