/**
 * What a finished drama stage does to the ties (`docs/DRAMA.md`): start or end a bond, a rivalry or
 * a couple, or change how a bond feels. Pure, and always through the ties' own rules, so a drama can
 * never make a tie those rules refuse (a busy pair, a monogamous partner, a full friend list): then
 * the outcome simply does not happen.
 */
import { slpRomanceAllows } from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlpDramaOutcome } from "../../../../../shared/src/slp/slp-drama.js";
import {
  slurpBondActive,
  slurpEndBond,
  slurpSetBond,
  type SlurpBond,
  type SlurpBondKind,
} from "./slp-creator-bonds.js";
import {
  slurpCoolRivalry,
  slurpPairKey,
  slurpRivalryActive,
  slurpStartRivalry,
  type SlurpCreatorTies,
  type SlurpTieCreator,
} from "./slp-creator-ties.js";
import { slurpBreakUp, slurpSetUpCouple, type SlurpCouple } from "./slp-creator-couples.js";

export type SlurpDramaTieDocument = { ties: SlurpCreatorTies; couples: SlurpCouple[]; bonds: SlurpBond[] };

const BOND_KINDS: readonly string[] = ["friend", "roommate", "coworker", "ex"];
const same = (a: string, b: string) => (entry: { aId: string; bId: string }) =>
  slurpPairKey(entry.aId, entry.bId) === slurpPairKey(a, b);

export function slurpApplyDramaTie<T extends SlurpDramaTieDocument>(
  document: T,
  outcome: SlpDramaOutcome,
  ids: readonly [string, string],
  input: { at: Date; newId: () => string; creators: readonly SlurpTieCreator[]; polyamory: boolean },
): T {
  const [a, b] = ids;
  const creator = (id: string) => input.creators.find((entry) => entry.id === id);
  if (outcome.kind === "temperature") {
    const bond = document.bonds.find((entry) => slurpBondActive(entry) && same(a, b)(entry));
    if (!bond || bond.locked) return document;
    const note = {
      at: input.at.toISOString(),
      code: outcome.value === "warm" ? ("warm" as const) : ("tense" as const),
    };
    return {
      ...document,
      bonds: document.bonds.map((entry) =>
        entry === bond
          ? { ...entry, temperature: outcome.value, changedAt: note.at, notes: [...entry.notes, note].slice(-8) }
          : entry,
      ),
    };
  }
  if (outcome.kind === "end-tie") {
    if (BOND_KINDS.includes(outcome.tie)) {
      const bond = document.bonds.find(
        (entry) => slurpBondActive(entry) && entry.kind === outcome.tie && same(a, b)(entry),
      );
      const next = bond && !bond.locked ? slurpEndBond(document.bonds, bond.id, input.at) : null;
      return Array.isArray(next) ? { ...document, bonds: next } : document;
    }
    if (outcome.tie === "rival") {
      const rivalry = document.ties.rivalries.find(
        (entry) => slurpRivalryActive(entry) && slurpPairKey(entry.fromId, entry.toId) === slurpPairKey(a, b),
      );
      const next = rivalry ? slurpCoolRivalry(document.ties, rivalry.id, input.at) : null;
      return next && typeof next !== "string" ? { ...document, ties: next } : document;
    }
    const couple = document.couples.find((entry) => entry.stage !== "split" && same(a, b)(entry));
    return couple
      ? {
          ...document,
          couples: document.couples.map((entry) => (entry === couple ? slurpBreakUp(entry, input.at) : entry)),
        }
      : document;
  }
  if (BOND_KINDS.includes(outcome.tie)) {
    const next = slurpSetBond(
      document.bonds,
      { aId: a, bId: b, kind: outcome.tie as SlurpBondKind, level: outcome.level, couples: document.couples },
      { at: input.at, id: input.newId(), origin: "drama" },
    );
    return Array.isArray(next) ? { ...document, bonds: next } : document;
  }
  const [from, to] = [creator(a), creator(b)];
  if (!from || !to) return document;
  if (outcome.tie === "rival") {
    const next = slurpStartRivalry(document.ties, from.automatic ? from : to, from.automatic ? to : from, {
      at: input.at,
      id: input.newId(),
    });
    return typeof next === "string" ? document : { ...document, ties: next };
  }
  // The player's romance setting (0.3.17) holds against a drama too: no couple, the story still ends.
  if (from.automatic && to.automatic && !slpRomanceAllows(from, to)) return document;
  const next = slurpSetUpCouple(document.couples, from, to, {
    at: input.at,
    id: input.newId(),
    polyamory: input.polyamory,
  });
  return typeof next === "string" ? document : { ...document, couples: next };
}
