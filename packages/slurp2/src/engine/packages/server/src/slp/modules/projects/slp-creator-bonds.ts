/**
 * Bonds: friends, roommates, coworkers and exes between Creators (Drama, `docs/DRAMA.md`).
 *
 * Pure and deterministic, like couples and collabs beside it. Nothing here calls a model: who is
 * whose friend, how close, and how warm it is right now are decided by code on the world clock.
 *
 * ## The rules
 *
 * - **Friends grow, and drift.** The world starts an acquaintance between two Creators who share a
 *   niche or just made a collab. It grows one level at a time (acquaintance → friend → close → best)
 *   while they still have something in common, and drifts back down when they do not.
 * - **Roommates and coworkers are facts of life.** Only a card or the player makes them; the world
 *   never invents a flatmate.
 * - **Exes come from breakups.** A couple that broke up leaves an ex bond; getting back together ends it.
 * - **Cards first.** A person the card names (canon anchors) who is another Creator on Slurp becomes
 *   that bond. Only a Creator Slurp writes for seeds from its card: a persona's text is the player's.
 * - **Temperature.** A running rivalry makes a bond tense; it warms up again some days after.
 * - **The player steers.** A bond the player set is locked: the world never moves or ends it.
 * - **Caps.** At most `SLURP_MAX_FRIENDS` friends and `SLURP_MAX_BEST_FRIENDS` best friends each.
 * - **Transparent.** Every change leaves a short note with a reason code, for the People map.
 */
import { DAY_MS, clampText, hash } from "./slp-project.js";
import { slurpPairKey, slurpSharedNiche, type SlurpTieCreator } from "./slp-creator-ties.js";
import { slurpCoupleOf, type SlurpCouple } from "./slp-creator-couples.js";

export const SLURP_BOND_KINDS = ["friend", "roommate", "coworker", "ex"] as const;
export type SlurpBondKind = (typeof SLURP_BOND_KINDS)[number];
export const SLURP_BOND_TEMPERATURES = ["warm", "tense", "cold"] as const;
export type SlurpBondTemperature = (typeof SLURP_BOND_TEMPERATURES)[number];
/** Friend levels: 0 acquaintance, 1 friend, 2 close, 3 best. Other kinds stay at 1. */
export const SLURP_BOND_MAX_LEVEL = 3;
export const SLURP_MAX_FRIENDS = 8;
export const SLURP_MAX_BEST_FRIENDS = 2;

export const SLURP_BOND_NOTE_CODES = [
  "card",
  "met",
  "collab",
  "breakup",
  "player",
  "closer",
  "drifted",
  "tense",
  "warm",
  "together",
  "left",
  "ended",
  "forget",
  "drama",
] as const;
export type SlurpBondNoteCode = (typeof SLURP_BOND_NOTE_CODES)[number];
/** One change, for the People map: a reason code and an optional plain detail ("best friend", a cause). */
export type SlurpBondNote = { at: string; code: SlurpBondNoteCode; detail?: string };

export type SlurpBond = {
  id: string;
  kind: SlurpBondKind;
  aId: string;
  bId: string;
  level: number;
  temperature: SlurpBondTemperature;
  origin: "card" | "world" | "player" | "couple" | "drama";
  since: string;
  changedAt: string;
  endedAt: string | null;
  ending: "drifted" | "left" | "player" | "together" | null;
  /** The player set it: the world never moves or ends it. */
  locked?: boolean;
  notes: SlurpBondNote[];
};

const KEEP_NOTES = 8;
const KEEP_ENDED = 40;
/** Days on a level before the next step up; best friends take a while. */
const GROW_DAYS = [3, 7, 14] as const;
/** An acquaintance that never became more is let go after this long. */
const ACQUAINTANCE_DAYS = 30;
/** A tense bond warms up this long after the rivalry that made it tense is over. */
const TENSE_DAYS = 5;
/** Per look (every six hours), in percent, scaled by world activity. */
export const SLURP_BOND_MEET_CHANCE = 45;
const GROW_CHANCE = 30;
const DRIFT_CHANCE = 15;

export const slurpBondActive = (bond: SlurpBond) => bond.endedAt === null;
export const slurpBondOther = (bond: SlurpBond, id: string) =>
  bond.aId === id ? bond.bId : bond.bId === id ? bond.aId : null;
/** Active bonds of this Creator, newest first. */
export const slurpBondsFor = (bonds: readonly SlurpBond[], creatorId: string) =>
  bonds.filter((bond) => slurpBondActive(bond) && slurpBondOther(bond, creatorId)).reverse();

// ─── Cards ──────────────────────────────────────────────────────────────────────────────────────

const EX = /\b(ex|ex-\w+|former (partner|girlfriend|boyfriend|wife|husband|lover))\b/iu;
const BEST = /\b(best ?friends?|bff|bestie|beste freundin|bester freund)\b/iu;
const ROOMMATE = /\b(room ?mates?|flat ?mates?|house ?mates?|lives with|mitbewohner(in)?)\b/iu;
const COWORKER = /\b(co-?workers?|colleagues?|works? with|boss|employee|kolleg(e|in))\b/iu;
const FRIEND = /\b(friends?|buddy|pal|kumpel|childhood friend)\b/iu;

/** What a card relation line means as a bond, or null (a partner is a couple, not a bond). */
export function slurpBondFromRelation(relation: string): { kind: SlurpBondKind; level: number; detail: string } | null {
  const detail = clampText(relation, 60);
  if (EX.test(relation)) return { kind: "ex", level: 1, detail };
  if (BEST.test(relation)) return { kind: "friend", level: 3, detail };
  if (ROOMMATE.test(relation)) return { kind: "roommate", level: 1, detail };
  if (COWORKER.test(relation)) return { kind: "coworker", level: 1, detail };
  if (FRIEND.test(relation)) return { kind: "friend", level: 1, detail };
  return null;
}

/** The Creator a card's person means: the full name, else a first name only one Creator has. */
function creatorNamed(name: string, creators: readonly SlurpTieCreator[], selfId: string): SlurpTieCreator | null {
  const wanted = name.trim().toLocaleLowerCase();
  if (!wanted) return null;
  const others = creators.filter((creator) => creator.id !== selfId);
  const full = others.find((creator) => creator.name.trim().toLocaleLowerCase() === wanted);
  if (full) return full;
  const first = others.filter((creator) => creator.name.trim().split(/\s+/u)[0]!.toLocaleLowerCase() === wanted);
  return first.length === 1 ? first[0]! : null;
}

// ─── Storage shape ──────────────────────────────────────────────────────────────────────────────

const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const date = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);
const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.find((entry) => entry === value) ?? fallback;

/** Lenient: a bad bond is dropped, a bad note is dropped, the rest reads back. */
export function readSlurpBonds(raw: unknown): SlurpBond[] {
  return (Array.isArray(raw) ? raw : []).flatMap((entry): SlurpBond[] => {
    const item = record(entry);
    const id = clampText(item?.id, 64);
    const aId = clampText(item?.aId, 128);
    const bId = clampText(item?.bId, 128);
    const since = date(item?.since);
    if (!item || !id || !aId || !bId || aId === bId || !since) return [];
    const kind = pick(SLURP_BOND_KINDS, item.kind, "friend");
    const level = Math.round(Number(item.level));
    return [
      {
        id,
        kind,
        aId,
        bId,
        level: kind === "friend" && Number.isFinite(level) ? Math.min(SLURP_BOND_MAX_LEVEL, Math.max(0, level)) : 1,
        temperature: pick(SLURP_BOND_TEMPERATURES, item.temperature, "warm"),
        origin: pick(["card", "world", "player", "couple", "drama"] as const, item.origin, "world"),
        since,
        changedAt: date(item.changedAt) ?? since,
        endedAt: date(item.endedAt),
        ending: date(item.endedAt)
          ? pick(["drifted", "left", "player", "together"] as const, item.ending, "drifted")
          : null,
        ...(item.locked === true ? { locked: true } : {}),
        notes: (Array.isArray(item.notes) ? item.notes : []).flatMap((raw): SlurpBondNote[] => {
          const note = record(raw);
          const at = date(note?.at);
          const code = SLURP_BOND_NOTE_CODES.find((entry) => entry === note?.code);
          if (!at || !code) return [];
          const detail = clampText(note?.detail, 80);
          return [{ at, code, ...(detail ? { detail } : {}) }];
        }),
      },
    ];
  });
}

// ─── Changes ────────────────────────────────────────────────────────────────────────────────────

const note = (bond: SlurpBond, entry: SlurpBondNote): SlurpBond => ({
  ...bond,
  changedAt: entry.at,
  notes: [...bond.notes, entry].slice(-KEEP_NOTES),
});

const end = (bond: SlurpBond, at: string, ending: NonNullable<SlurpBond["ending"]>, code: SlurpBondNoteCode) =>
  note({ ...bond, endedAt: at, ending }, { at, code });

function newBond(
  id: string,
  kind: SlurpBondKind,
  a: string,
  b: string,
  input: { level: number; origin: SlurpBond["origin"]; at: string; code: SlurpBondNoteCode; detail?: string },
): SlurpBond {
  const [aId, bId] = [a, b].sort() as [string, string];
  return {
    id,
    kind,
    aId,
    bId,
    level: kind === "friend" ? input.level : 1,
    temperature: kind === "ex" ? "cold" : "warm",
    origin: input.origin,
    since: input.at,
    changedAt: input.at,
    endedAt: null,
    ending: null,
    ...(input.origin === "player" ? { locked: true } : {}),
    notes: [{ at: input.at, code: input.code, ...(input.detail ? { detail: input.detail } : {}) }],
  };
}

const activeOf = (bonds: readonly SlurpBond[], a: string, b: string, kind?: SlurpBondKind) =>
  bonds.find(
    (bond) =>
      slurpBondActive(bond) && slurpPairKey(bond.aId, bond.bId) === slurpPairKey(a, b) && (!kind || bond.kind === kind),
  ) ?? null;

const everOf = (bonds: readonly SlurpBond[], a: string, b: string, kind: SlurpBondKind) =>
  bonds.some((bond) => bond.kind === kind && slurpPairKey(bond.aId, bond.bId) === slurpPairKey(a, b));

function friendCounts(bonds: readonly SlurpBond[]) {
  const friends = new Map<string, number>();
  const best = new Map<string, number>();
  for (const bond of bonds)
    if (slurpBondActive(bond) && bond.kind === "friend" && bond.level >= 1)
      for (const id of [bond.aId, bond.bId]) {
        friends.set(id, (friends.get(id) ?? 0) + 1);
        if (bond.level >= SLURP_BOND_MAX_LEVEL) best.set(id, (best.get(id) ?? 0) + 1);
      }
  return { friends, best };
}

/** Whether a friend bond may step up to `level` without passing either Creator's caps. */
function roomFor(bonds: readonly SlurpBond[], bond: SlurpBond, level: number): boolean {
  // Counted without this bond, so a new bond, a jump from 0 to 2-3 and a step up are judged alike.
  const { friends, best } = friendCounts(bonds.filter((entry) => entry.id !== bond.id));
  return [bond.aId, bond.bId].every(
    (id) =>
      (level < 1 || (friends.get(id) ?? 0) < SLURP_MAX_FRIENDS) &&
      (level < SLURP_BOND_MAX_LEVEL || (best.get(id) ?? 0) < SLURP_MAX_BEST_FRIENDS),
  );
}

export type SlurpBondsInput = {
  creators: readonly SlurpTieCreator[];
  couples: readonly SlurpCouple[];
  at: Date;
  /** World activity × rhythm; 0 starts and grows nothing (leaving, exes and temperature still move). */
  activity: number;
  /** Pairs with a running rivalry (`slurpPairKey`). */
  rivals: ReadonlySet<string>;
  /** Who made a collab with whom lately. */
  collabbedWith: ReadonlyMap<string, string>;
  newId: () => string;
};

/**
 * One look at the bonds, on the ties clock (the caller runs it only when the ties advance). Order:
 * leaving, exes, cards, temperature, growing and drifting, then now and then a new acquaintance.
 */
export function slurpAdvanceBonds(bonds: readonly SlurpBond[], input: SlurpBondsInput): SlurpBond[] {
  const { at } = input;
  const stamp = at.toISOString();
  const window = Math.floor(at.getTime() / (6 * 60 * 60 * 1000));
  const byId = new Map(input.creators.map((creator) => [creator.id, creator]));
  const daysSince = (from: string) => (at.getTime() - Date.parse(from)) / DAY_MS;
  const chance = (label: string, percent: number) =>
    hash(`${window}:${label}`) % 100 < Math.round(percent * Math.max(0, input.activity));

  // Somebody left Slurp: every bond they had ends, locked or not.
  let next = slurpSyncExBonds(bonds, input.couples, at).map((bond) =>
    slurpBondActive(bond) && (!byId.has(bond.aId) || !byId.has(bond.bId)) ? end(bond, stamp, "left", "left") : bond,
  );

  // Exes: a breakup leaves one; getting back together ends it, and so does forgetting (#1293): a
  // forgotten ex is not fed to drama casting or the People map as one anymore. Ended, not deleted, so
  // a card or another breakup never remakes it (`made` below counts an ended bond too).
  for (const couple of input.couples) {
    // All of this pair's active ex bonds, not just one: a stray extra never survives a reunion or a forget.
    const exes = next.filter(
      (bond) =>
        bond.kind === "ex" &&
        slurpBondActive(bond) &&
        slurpPairKey(bond.aId, bond.bId) === slurpPairKey(couple.aId, couple.bId),
    );
    if (exes.length && couple.stage !== "split")
      next = next.map((bond) => (exes.includes(bond) ? end(bond, stamp, "together", "together") : bond));
    // One ex bond per breakup: once it ended (the player, or they left), this breakup made its bond.
    const made = next.some(
      (bond) =>
        bond.kind === "ex" &&
        slurpPairKey(bond.aId, bond.bId) === slurpPairKey(couple.aId, couple.bId) &&
        Date.parse(bond.since) >= Date.parse(couple.stageAt),
    );
    if (
      couple.stage === "split" &&
      couple.ending === "breakup" &&
      couple.aftermath !== "forget" &&
      !made &&
      byId.has(couple.aId) &&
      byId.has(couple.bId)
    )
      next = [
        ...next,
        newBond(input.newId(), "ex", couple.aId, couple.bId, {
          level: 1,
          origin: "couple",
          at: couple.stageAt,
          code: "breakup",
        }),
      ];
  }

  // Cards: people the card names who are Creators here. Only cards Slurp writes for.
  for (const creator of input.creators) {
    if (!creator.automatic) continue;
    for (const person of creator.cardPeople ?? []) {
      const meant = slurpBondFromRelation(person.relation);
      const other = meant && creatorNamed(person.name, input.creators, creator.id);
      // Seeded once: a card bond that ended (drifted, or the player ended it) does not come back.
      if (!meant || !other || everOf(next, creator.id, other.id, meant.kind)) continue;
      // A card ex while they are a couple again is old news; the couple wins. A forgotten ex stays
      // forgotten: the card does not hand it straight back as a fresh bond.
      if (
        meant.kind === "ex" &&
        (slurpCoupleOf(input.couples, creator.id, other.id)?.aftermath === "forget" ||
          input.couples.some(
            (couple) =>
              couple.stage !== "split" && slurpPairKey(couple.aId, couple.bId) === slurpPairKey(creator.id, other.id),
          ))
      )
        continue;
      next = [
        ...next,
        newBond(input.newId(), meant.kind, creator.id, other.id, {
          level: meant.level,
          origin: "card",
          at: stamp,
          code: "card",
          detail: meant.detail,
        }),
      ];
    }
  }

  next = next.map((bond) => {
    if (!slurpBondActive(bond) || bond.locked) return bond;
    const key = slurpPairKey(bond.aId, bond.bId);
    // A rivalry makes it tense; some days after it is over it warms up again.
    if (input.rivals.has(key))
      return bond.temperature === "tense"
        ? bond
        : note({ ...bond, temperature: "tense" }, { at: stamp, code: "tense" });
    if (bond.temperature === "tense" && daysSince(bond.changedAt) >= TENSE_DAYS)
      return note({ ...bond, temperature: "warm" }, { at: stamp, code: "warm" });
    if (bond.kind !== "friend") return bond;
    const a = byId.get(bond.aId)!;
    const b = byId.get(bond.bId)!;
    const niche = slurpSharedNiche(a, b);
    const common = niche.tags.length + niche.interests.length > 0 || input.collabbedWith.get(a.id) === b.id;
    const roll = hash(`${window}:${bond.id}`) % 100;
    const rate = Math.max(0, input.activity);
    if (common && bond.level < SLURP_BOND_MAX_LEVEL && daysSince(bond.changedAt) >= GROW_DAYS[bond.level]!)
      return roll < GROW_CHANCE * rate && roomFor(next, bond, bond.level + 1)
        ? note({ ...bond, level: bond.level + 1, temperature: "warm" }, { at: stamp, code: "closer" })
        : bond;
    if (!common && roll < DRIFT_CHANCE * rate && daysSince(bond.changedAt) >= GROW_DAYS[0])
      return bond.level === 0
        ? end(bond, stamp, "drifted", "drifted")
        : note(
            { ...bond, level: bond.level - 1, temperature: bond.level === 1 ? "cold" : bond.temperature },
            { at: stamp, code: "drifted" },
          );
    return bond.level === 0 && daysSince(bond.since) >= ACQUAINTANCE_DAYS
      ? end(bond, stamp, "drifted", "drifted")
      : bond;
  });

  // Now and then two Creators Slurp writes for meet: a collab they just made, else a shared niche.
  // ponytail: every pair is scored (n² over Creators), like collabs; index by niche past a few hundred.
  if (chance("bond-meet", SLURP_BOND_MEET_CHANCE)) {
    const automatic = input.creators.filter((creator) => creator.automatic);
    const options = automatic
      .flatMap((a, index) => automatic.slice(index + 1).map((b) => [a, b] as const))
      .filter(([a, b]) => !activeOf(next, a.id, b.id) && !input.rivals.has(slurpPairKey(a.id, b.id)))
      .map(([a, b]) => {
        const niche = slurpSharedNiche(a, b);
        const collab = input.collabbedWith.get(a.id) === b.id;
        return { a, b, collab, score: (collab ? 4 : 0) + niche.tags.length * 2 + niche.interests.length };
      })
      .filter((option) => option.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          hash(`${window}:${slurpPairKey(left.a.id, left.b.id)}`) -
            hash(`${window}:${slurpPairKey(right.a.id, right.b.id)}`),
      );
    const met = options[0];
    if (met)
      next = [
        ...next,
        newBond(input.newId(), "friend", met.a.id, met.b.id, {
          level: 0,
          origin: "world",
          at: stamp,
          code: met.collab ? "collab" : "met",
        }),
      ];
  }

  return trim(next);
}

/** Keeps every active bond and the newest ended ones. */
function trim(bonds: SlurpBond[]): SlurpBond[] {
  // Ended exes stay: they are how a breakup knows it already made its ex bond (few, one per breakup).
  // Ended card bonds stay too: they are how a card knows it already made its bond (bounded by the card).
  const ended = bonds.filter((bond) => !slurpBondActive(bond) && bond.kind !== "ex" && bond.origin !== "card");
  const drop = new Set(ended.slice(0, Math.max(0, ended.length - KEEP_ENDED)));
  return bonds.filter((bond) => !drop.has(bond));
}

// ─── The player ─────────────────────────────────────────────────────────────────────────────────

export type SlurpBondError = "same" | "unknown" | "full" | "couple";

/**
 * The player sets a bond: creates it, or changes the kind's level. A bond the player set is locked,
 * so the world leaves it alone. `level` only matters for friends (0-3).
 */
export function slurpSetBond(
  bonds: readonly SlurpBond[],
  input: { aId: string; bId: string; kind: SlurpBondKind; level?: number; couples?: readonly SlurpCouple[] },
  options: { at: Date; id: string; origin?: "player" | "drama" },
): SlurpBond[] | SlurpBondError {
  if (input.aId === input.bId) return "same";
  const stamp = options.at.toISOString();
  const level = input.kind === "friend" ? Math.min(SLURP_BOND_MAX_LEVEL, Math.max(0, Math.round(input.level ?? 1))) : 1;
  if (
    input.kind === "ex" &&
    input.couples?.some(
      (couple) =>
        couple.stage !== "split" && slurpPairKey(couple.aId, couple.bId) === slurpPairKey(input.aId, input.bId),
    )
  )
    return "couple";
  const origin = options.origin ?? "player";
  const code = origin === "player" ? ("player" as const) : ("drama" as const);
  const existing = activeOf(bonds, input.aId, input.bId, input.kind);
  // A drama never moves a bond the player set.
  if (existing?.locked && origin === "drama") return [...bonds];
  if (existing) {
    const changed = { ...existing, level, ...(origin === "player" ? { locked: true } : {}) };
    if (
      level > existing.level &&
      !roomFor(
        bonds.filter((bond) => bond !== existing),
        changed,
        level,
      )
    )
      return "full";
    return bonds.map((bond) => (bond === existing ? note(changed, { at: stamp, code }) : bond));
  }
  const created = newBond(options.id, input.kind, input.aId, input.bId, {
    level,
    origin,
    at: stamp,
    code,
  });
  if (input.kind === "friend" && level >= 1 && !roomFor(bonds, created, level)) return "full";
  return [...bonds, created];
}

/** The player ends a bond. */
export function slurpEndBond(bonds: readonly SlurpBond[], id: string, at: Date): SlurpBond[] | SlurpBondError {
  const bond = bonds.find((entry) => entry.id === id && slurpBondActive(entry));
  if (!bond) return "unknown";
  return bonds.map((entry) => (entry === bond ? end(entry, at.toISOString(), "player", "ended") : entry));
}

/** Apply the newest couple's memory choice to ex bonds immediately, including every group pair.
 * The distinct end reason lets Undo or moveOn restore only bonds ended by forgetting. */
export function slurpSyncExBonds(bonds: readonly SlurpBond[], couples: readonly SlurpCouple[], at: Date): SlurpBond[] {
  const stamp = at.toISOString();
  return bonds.map((bond) => {
    if (bond.kind !== "ex") return bond;
    const couple = slurpCoupleOf(couples, bond.aId, bond.bId);
    if (!couple) return bond;
    if (couple.stage !== "split")
      return slurpBondActive(bond) || bond.notes.at(-1)?.code === "forget"
        ? end(bond, stamp, "together", "together")
        : bond;
    if (couple.aftermath === "forget") return slurpBondActive(bond) ? end(bond, stamp, "player", "forget") : bond;
    if (
      !slurpBondActive(bond) &&
      bond.notes.at(-1)?.code === "forget" &&
      Date.parse(bond.notes.at(-1)!.at) >= Date.parse(couple.stageAt)
    )
      return note({ ...bond, endedAt: null, ending: null }, { at: stamp, code: "player" });
    return bond;
  });
}
