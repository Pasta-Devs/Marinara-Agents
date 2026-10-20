/**
 * Couples: two Creators with their own pages who get together, and sometimes apart.
 *
 * Pure and deterministic, like the collab and rivalry rules beside it. Nothing here calls a model:
 * who fits whom, how a couple moves from flirting to official to a fight or a breakup, and the
 * moments worth a post are decided by code on the world clock. What a moment means for a post is a
 * beat that rides the Creator's ordinary post call (`slp-tie-beats.ts`).
 *
 * ## The rules
 *
 * - **Only where both cards allow it (for the world).** A Creator whose card already has a partner is taken (unless
 *   that partner is the other Creator: then the cards made them a couple). A card that never dates,
 *   is aromantic or asexual, or whose stated orientation does not match the other one's gender is
 *   never paired by the world. The world only starts a couple with some chemistry (a shared niche,
 *   a romantic card); the player can set anyone up who is free, and chemistry decides whether it
 *   sticks. Against a card (slice I) it sticks anyway, and the card colors it (`slp-couple-words.ts`).
 * - **Realistic pace.** Sparks (flirting) → dating → together, with dates, anniversaries, jealousy,
 *   fights, making up, breakups and now and then getting back together. Seeded per couple, so the
 *   same world moves the same way.
 * - **One post per moment each.** A moment is news for a few days; each Creator posts it once, and
 *   the small ones only now and then. A couple is life, not work (U): each posts their own side, the
 *   partner shows up as a cameo, nothing is tagged or split; only their shared page is joint.
 * - **Crushes and exes (U).** Sparks is a crush; after a breakup each ex posts about moving on once,
 *   and the ex stays in their briefs and chats for a while (`slp-couple-lines.ts`).
 * - **A shared page** (opt-in from Studio) gets its own posts from both, and closes on a breakup
 *   with a goodbye post.
 */
import { DAY_MS, hash } from "./slp-project.js";
import type { SlpBreakupAftermath } from "../../../../../shared/src/slp/slp-actions.js";
import { slurpCollabFit, slurpPairKey, slurpSharedNiche, type SlurpTieCreator } from "./slp-creator-ties.js";
import { slurpCoupleFit, slurpCoupleMisfitOf, type SlurpCoupleFit, type SlurpCoupleMisfit } from "./slp-couple-fit.js";
import {
  SLURP_COUPLE_DATES as DATES,
  SLURP_COUPLE_FIGHTS as FIGHTS,
  SLURP_COUPLE_JEALOUSY as JEALOUSY,
} from "./slp-couple-words.js";

const HOUR_MS = 60 * 60 * 1000;
/** Couples active at once that the world started on its own; the player's and the cards' do not count. */
const MAX_WORLD_COUPLES = 2;
/** A pair that ended is not put together by the world again for this long. */
const REST_DAYS = 60;
/** A moment is news this long; a Creator who has not posted it by then lets it go. */
export const SLURP_COUPLE_MOMENT_DAYS = 4;
const MAX_REUNIONS = 2;
/** A crush on the player that nobody acts on in the chat fades after this many days. */
export const SLURP_PLAYER_CRUSH_DAYS = 12;
const KEEP_MOMENTS = 10;
const KEEP_ENDED = 20;

export type SlurpCoupleStage = "sparks" | "dating" | "together" | "rocky" | "split";
export type SlurpCoupleMomentKind =
  | "flirt"
  | "date"
  | "launch"
  | "anniversary"
  | "jealous"
  | "fight"
  | "makeup"
  | "breakup"
  | "reunion"
  | "pageOpen"
  | "pageClose"
  /** An ex posts about moving on, once, a week or so after the breakup (U: exes). */
  | "movingOn"
  /** Polyamory (0.3.5): someone joined the couple; `withId` is who. */
  | "joined";

export type SlurpCoupleMoment = {
  id: string;
  kind: SlurpCoupleMomentKind;
  at: string;
  /** The date, the cause of a fight, the anniversary's length. Plain words. */
  detail: string;
  /** Jealousy over somebody: that Creator's id (the name is filled in when the post is written). */
  withId?: string;
  /** Jealousy is felt by one of them: only they post it. */
  fromId?: string;
};

/** A shared couple page's source id: no card behind it, so nothing writes for it on its own. */
export const SLURP_COUPLE_PAGE_SOURCE = "slurp-couple:";

/** A shared couple page is not a person: nobody writes to it, tips it in a chat or takes a commission from it. */
export const slurpIsCouplePage = (account: { sourceEntityId?: string | null }) =>
  Boolean(account.sourceEntityId?.startsWith(SLURP_COUPLE_PAGE_SOURCE));

/** Shared pages that are closed now (a reopened page is open again). */
export const slurpClosedCouplePageIds = (couples: readonly SlurpCouple[]): Set<string> =>
  new Set(couples.flatMap((couple) => (couple.page?.closedAt ? [couple.page.accountId] : [])));

export type SlurpCouplePage = { accountId: string; openedAt: string; closedAt: string | null };

export type SlurpCouple = {
  id: string;
  aId: string;
  bId: string;
  /** Polyamory (0.3.5, `slp-couple-group.ts`): more partners, up to four people in all. */
  moreIds?: string[];
  origin: "card" | "world" | "player" | "storyline";
  stage: SlurpCoupleStage;
  /** How it ended: a breakup, or sparks that went nowhere. Null while it lasts. */
  ending: "breakup" | "fizzled" | null;
  startedAt: string;
  stageAt: string;
  /** When they became official; anniversaries count from here. */
  togetherAt: string | null;
  /** Fights and jealousy since they got together; each one makes the next one likelier to end it. */
  troubles: number;
  reunions: number;
  moments: SlurpCoupleMoment[];
  /** `<creatorId>:<momentId>` once that Creator posted the moment. */
  told: string[];
  /** Joint posts that show on both pages (`slp-tie-stamp.ts`, kind `couple`). */
  postIds: string[];
  page: SlurpCouplePage | null;
  /**
   * The player put them together against a card (slice I): what the card says, and whose card. The
   * couple happens, and the card colors how it goes (complicated, reluctant, awkward).
   */
  forced?: SlurpCoupleForced;
  /**
   * A couple with the player (Drama, "your relationship"): kept out of public. Her posts, captions and
   * the crowd do not name the player while it is set; she still knows, and says so in private.
   */
  secret?: boolean;
  /**
   * #1293: what an ex's breakup leaves behind; absent (or "keep") is the usual memory and fallout.
   * Only ever set while `stage` is "split"; a reunion (manual or automatic) clears it.
   */
  aftermath?: Exclude<SlpBreakupAftermath, "keep">;
};

export type SlurpCoupleForced = { misfit: Exclude<SlurpCoupleMisfit, "same" | "busy">; byId: string };

export const slurpCoupleActive = (couple: SlurpCouple) => couple.stage !== "split";
/** One other member, or null when `id` is not in it (a joined partner's "other" is the first of the pair). */
export const slurpCoupleOther = (couple: SlurpCouple, id: string) =>
  couple.aId === id ? couple.bId : couple.bId === id || couple.moreIds?.includes(id) ? couple.aId : null;
/** Together in public: dating, official, or rocky. Sparks are only flirting. */
export const slurpCoupleTaken = (couple: SlurpCouple) =>
  couple.stage === "dating" || couple.stage === "together" || couple.stage === "rocky";

/** The couple this Creator is in now, or null. */
export function slurpCoupleFor(couples: readonly SlurpCouple[], creatorId: string): SlurpCouple | null {
  return couples.find((couple) => slurpCoupleActive(couple) && slurpCoupleOther(couple, creatorId)) ?? null;
}

/** The newest couple of these two, active or over, or null. */
export function slurpCoupleOf(couples: readonly SlurpCouple[], a: string, b: string): SlurpCouple | null {
  if (a === b) return null;
  return (
    couples
      .filter((couple) => {
        const members = [couple.aId, couple.bId, ...(couple.moreIds ?? [])];
        return members.includes(a) && members.includes(b);
      })
      .sort(
        (left, right) =>
          Number(slurpCoupleActive(right)) - Number(slurpCoupleActive(left)) ||
          Date.parse(right.stageAt) - Date.parse(left.stageAt),
      )[0] ?? null
  );
}

// ─── The world clock ────────────────────────────────────────────────────────────────────────────

/** Days on a stage before it moves on. Seeded per couple and stage visit. */
function stageDays(couple: SlurpCouple): number {
  const roll = hash(`${couple.id}:${couple.stage}:${couple.stageAt}`);
  if (couple.stage === "sparks") return 2 + (roll % 3);
  if (couple.stage === "dating") return 5 + (roll % 5);
  if (couple.stage === "rocky") return 2 + (roll % 3);
  if (couple.stage === "split") return 7 + (roll % 15);
  // Together: how long until the next trouble.
  return 10 + (roll % 12);
}

export const slurpDaysSince = (from: string, at: Date) => (at.getTime() - Date.parse(from)) / DAY_MS;

export function slurpCoupleMoment(
  couple: SlurpCouple,
  kind: SlurpCoupleMomentKind,
  stamp: string,
  detail = "",
  withId?: string,
): SlurpCoupleMoment {
  // Unique inside the couple: the told keys are `<creatorId>:<momentId>` on this couple.
  const id = `${kind}:${Date.parse(stamp).toString(36)}:${couple.moments.length}`;
  return { id, kind, at: stamp, detail, ...(withId ? { withId } : {}) };
}

export function slurpWithMoment(couple: SlurpCouple, next: SlurpCoupleMoment): SlurpCouple {
  return { ...couple, moments: [...couple.moments, next].slice(-KEEP_MOMENTS) };
}

/** A date they have not had lately; a shared niche adds its own ideas. */
function pickDate(couple: SlurpCouple, byId: ReadonlyMap<string, SlurpTieCreator>, stamp: string): string {
  const a = byId.get(couple.aId);
  const b = byId.get(couple.bId);
  const shared = a && b && slurpSharedNiche(a, b).interests.length ? slurpCollabFit(a, b).ideas : [];
  const pool = [...shared, ...DATES];
  const recent = new Set(couple.moments.filter((entry) => entry.kind === "date").map((entry) => entry.detail));
  const start = hash(`${couple.id}:date:${stamp}`) % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  return rotated.find((idea) => !recent.has(idea)) ?? rotated[0]!;
}

/** A collab with someone else than the partner (a collab of the two of them is no reason to be jealous). */
const collabOther = (couple: SlurpCouple, id: string, collabbedWith: ReadonlyMap<string, string>) => {
  const other = collabbedWith.get(id);
  return other && other !== couple.aId && other !== couple.bId && !couple.moreIds?.includes(other) ? other : undefined;
};

/**
 * Trouble: jealousy over a recent collab with someone else when there is one, else a fight. Only a
 * Creator Slurp writes for is ever the jealous one: a jealous moment is posted by the one who feels
 * it, and the player's page posts nothing on its own (`players`: the pages the player runs).
 */
function trouble(
  couple: SlurpCouple,
  stamp: string,
  collabbedWith: ReadonlyMap<string, string>,
  players: ReadonlySet<string> = new Set(),
): SlurpCoupleMoment {
  const roll = hash(`${couple.id}:trouble:${stamp}`);
  // The one whose partner made the collab is the jealous one.
  const stung = (
    [
      [couple.bId, collabOther(couple, couple.aId, collabbedWith)],
      [couple.aId, collabOther(couple, couple.bId, collabbedWith)],
    ] as const
  ).find(([jealous, withId]) => withId && !players.has(jealous));
  if (stung && roll % 2 === 0)
    return { ...slurpCoupleMoment(couple, "jealous", stamp, "a collab with someone else", stung[1]), fromId: stung[0] };
  const feels = [couple.aId, couple.bId].filter((id) => !players.has(id));
  if (roll % 3 === 0 && feels.length)
    return {
      ...slurpCoupleMoment(couple, "jealous", stamp, JEALOUSY[roll % JEALOUSY.length]!),
      fromId: feels[roll % feels.length]!,
    };
  return slurpCoupleMoment(couple, "fight", stamp, FIGHTS[roll % FIGHTS.length]!);
}

/** The members of a couple who are pages the player runs. */
const playerIds = (couple: SlurpCouple, byId: ReadonlyMap<string, SlurpTieCreator>) =>
  new Set([couple.aId, couple.bId, ...(couple.moreIds ?? [])].filter((id) => byId.get(id)?.automatic === false));

export type SlurpCouplesInput = {
  creators: readonly SlurpTieCreator[];
  at: Date;
  /** World activity × rhythm; 0 starts nothing new (couples already going still move). */
  activity: number;
  /** Pairs in a live storyline about the two of them getting together. */
  storylines: readonly (readonly [string, string])[];
  /** Pairs in a live rivalry: no romance while that is on. */
  rivals: ReadonlySet<string>;
  /** Creator id → a third Creator they made a collab with lately (for jealousy). */
  collabbedWith: ReadonlyMap<string, string>;
  newId: () => string;
};

export function newSlurpCouple(
  id: string,
  a: string,
  b: string,
  origin: SlurpCouple["origin"],
  stamp: string,
  stage: SlurpCoupleStage = "sparks",
): SlurpCouple {
  const couple: SlurpCouple = {
    id,
    aId: a,
    bId: b,
    origin,
    stage,
    ending: null,
    startedAt: stamp,
    stageAt: stamp,
    togetherAt: stage === "together" ? stamp : null,
    troubles: 0,
    reunions: 0,
    moments: [],
    told: [],
    postIds: [],
    page: null,
  };
  return stage === "sparks" ? slurpWithMoment(couple, slurpCoupleMoment(couple, "flirt", stamp)) : couple;
}

const ANNIVERSARY_DAYS = [30, 90, 180, 365] as const;
const YEAR_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** Month marks the first year, then every full year. */
const anniversaryDays = (days: number) => [
  ...ANNIVERSARY_DAYS,
  ...Array.from({ length: Math.max(0, Math.floor(days / 365) - 1) }, (_, index) => 365 * (index + 2)),
];
const anniversaryLabel = (days: number) => {
  if (days === 30) return "one month";
  if (days === 90) return "three months";
  if (days === 180) return "half a year";
  const years = Math.round(days / 365);
  return `${YEAR_WORDS[years - 1] ?? years} year${years === 1 ? "" : "s"}`;
};

/** The next anniversary after `at`, counted from when they got together: when, and after how many days. */
export function slurpNextAnniversary(togetherAt: string, at: Date): { at: string; days: number } {
  const days = slurpDaysSince(togetherAt, at);
  const next = anniversaryDays(days + 400).find((mark) => mark > days)!;
  return { at: new Date(Date.parse(togetherAt) + next * DAY_MS).toISOString(), days: next };
}

/** One couple, one look: stage moves, dates and anniversaries. */
function advanceCouple(
  couple: SlurpCouple,
  input: SlurpCouplesInput,
  byId: ReadonlyMap<string, SlurpTieCreator>,
  /** Creators in another couple right now: nobody gets back together with someone who moved on. */
  taken: ReadonlySet<string>,
): SlurpCouple {
  const { at } = input;
  const stamp = at.toISOString();
  // A Creator who left Slurp ends it; a shared page closes like after any breakup.
  if (!byId.has(couple.aId) || !byId.has(couple.bId))
    return slurpCoupleActive(couple) ? slurpBreakUp(couple, at) : couple;
  const due = slurpDaysSince(couple.stageAt, at) >= stageDays(couple);
  const roll = hash(`${couple.id}:${couple.stage}:${couple.stageAt}:next`);
  const a = byId.get(couple.aId)!;
  const b = byId.get(couple.bId)!;

  if (couple.stage === "sparks") {
    // With the player the chat moves it (`slurpPlayerCoupleStep`); a crush nobody acts on fades.
    if (!a.automatic || !b.automatic)
      return slurpDaysSince(couple.stageAt, at) >= SLURP_PLAYER_CRUSH_DAYS
        ? { ...couple, stage: "split", stageAt: stamp, ending: "fizzled" }
        : couple;
    if (!due) return couple;
    // Chemistry decides whether flirting turns into dating: 45 % with nothing shared, up to 90 %.
    const chemistry = slurpCoupleFit(a, b).chemistry;
    const sticks =
      roll % 100 < Math.min(90, 45 + 15 * chemistry) || couple.origin === "storyline" || Boolean(couple.forced);
    return sticks
      ? slurpWithMoment(
          { ...couple, stage: "dating", stageAt: stamp },
          slurpCoupleMoment(couple, "date", stamp, pickDate(couple, byId, stamp)),
        )
      : { ...couple, stage: "split", stageAt: stamp, ending: "fizzled" };
  }

  // A collab with someone else stings now and then (U): one jealous post, decided once per collab
  // partner, without making it rocky. A collab of the two of them is work they share.
  let next = couple;
  for (const [selfId, otherId] of [
    [couple.aId, couple.bId],
    [couple.bId, couple.aId],
  ] as const) {
    const withId = collabOther(couple, selfId, input.collabbedWith);
    if (
      withId &&
      byId.get(otherId)?.automatic !== false &&
      slurpCoupleTaken(couple) &&
      hash(`${couple.id}:${selfId}:${withId}:sting`) % 3 === 0 &&
      !next.moments.some((entry) => entry.kind === "jealous" && entry.withId === withId && entry.fromId === otherId)
    )
      next = slurpWithMoment(next, {
        ...slurpCoupleMoment(next, "jealous", stamp, "a collab with someone else", withId),
        fromId: otherId,
      });
  }

  // A date every few days while dating or together (not while it is rocky).
  const lastDate = [...couple.moments].reverse().find((entry) => entry.kind === "date");
  const dateEvery = couple.stage === "dating" ? 3 : 5 + (hash(`${couple.id}:pace`) % 4);
  if (
    (couple.stage === "dating" || couple.stage === "together") &&
    (!lastDate || slurpDaysSince(lastDate.at, at) >= dateEvery)
  )
    next = slurpWithMoment(next, slurpCoupleMoment(next, "date", stamp, pickDate(next, byId, stamp)));

  if (couple.stage === "together" && couple.togetherAt) {
    const days = slurpDaysSince(couple.togetherAt, at);
    const reached = anniversaryDays(days).filter((entry) => days >= entry && days < entry + SLURP_COUPLE_MOMENT_DAYS);
    const label = reached.length ? anniversaryLabel(reached.at(-1)!) : null;
    if (label && !couple.moments.some((entry) => entry.kind === "anniversary" && entry.detail === label))
      next = slurpWithMoment(next, slurpCoupleMoment(next, "anniversary", stamp, label));
  }

  // Exes (U): a week or so after a breakup each posts about moving on, once. Not with a chosen
  // aftermath (#1293): moving on already happened quietly, and a forgotten ex never reaches a post.
  if (
    couple.ending === "breakup" &&
    !couple.aftermath &&
    slurpDaysSince(couple.stageAt, at) >= 5 + (hash(`${couple.id}:${couple.stageAt}:on`) % 5) &&
    !couple.moments.some((entry) => entry.kind === "movingOn" && entry.at >= couple.stageAt)
  )
    next = slurpWithMoment(next, slurpCoupleMoment(next, "movingOn", stamp));
  if (!due || !a.automatic || !b.automatic) return next;
  if (couple.stage === "dating")
    return slurpWithMoment(
      { ...next, stage: "together", stageAt: stamp, togetherAt: next.togetherAt ?? stamp },
      slurpCoupleMoment(next, "launch", stamp),
    );
  if (couple.stage === "together")
    return slurpWithMoment(
      { ...next, stage: "rocky", stageAt: stamp, troubles: next.troubles + 1 },
      trouble(next, stamp, input.collabbedWith, playerIds(next, byId)),
    );
  if (couple.stage === "rocky") {
    // Every trouble since they got together makes the next one likelier to end it.
    const ends = roll % 100 < 20 + 15 * Math.max(0, couple.troubles - 1);
    return ends
      ? slurpBreakUp(next, at)
      : slurpWithMoment({ ...next, stage: "together", stageAt: stamp }, slurpCoupleMoment(next, "makeup", stamp));
  }
  // Split: now and then they find their way back. Sparks that fizzled stay over. Not with a chosen
  // aftermath (#1293): moving on or forgetting only undoes by an explicit reunite, never the clock.
  if (
    couple.ending === "breakup" &&
    !couple.aftermath &&
    couple.reunions < MAX_REUNIONS &&
    roll % 4 === 0 &&
    !taken.has(a.id) &&
    !taken.has(b.id) &&
    slurpCoupleFit(a, b).fits
  )
    return slurpGetBackTogether(next, at);
  return next;
}

/**
 * One look at the couples: stages move, and now and then the world starts one (only with
 * chemistry, both free), or a storyline or the cards make one. Called on the ties' own clock.
 */
export function slurpAdvanceCouples(couples: readonly SlurpCouple[], input: SlurpCouplesInput): SlurpCouple[] {
  const byId = new Map(input.creators.map((creator) => [creator.id, creator]));
  const stamp = input.at.toISOString();
  let next = [...couples];
  for (const [index, couple] of next.entries()) {
    if (!slurpCoupleActive(couple) && slurpCoupleOf(next, couple.aId, couple.bId) !== couple) continue;
    const taken = new Set(
      next
        .filter((other) => other !== couple && slurpCoupleActive(other))
        .flatMap((other) => [other.aId, other.bId, ...(other.moreIds ?? [])]),
    );
    // A joined partner who left Slurp just leaves the couple (polyamory, `slp-couple-group.ts`).
    const staying = couple.moreIds?.filter((id) => byId.has(id));
    next[index] = advanceCouple(
      staying?.length === couple.moreIds?.length ? couple : { ...couple, moreIds: staying },
      input,
      byId,
      taken,
    );
  }
  const busy = () =>
    new Set(next.filter(slurpCoupleActive).flatMap((couple) => [couple.aId, couple.bId, ...(couple.moreIds ?? [])]));
  const rested = (a: string, b: string) =>
    !next.some(
      (couple) =>
        slurpPairKey(couple.aId, couple.bId) === slurpPairKey(a, b) &&
        (slurpCoupleActive(couple) || slurpDaysSince(couple.stageAt, input.at) < REST_DAYS),
    );

  // The cards say so: two Creators whose cards name each other are together from the start. Once
  // their story ended on Slurp, the story wins: they are not put back together on their own.
  const ever = new Set(next.map((couple) => slurpPairKey(couple.aId, couple.bId)));
  for (const [index, a] of input.creators.entries())
    for (const b of input.creators.slice(index + 1)) {
      const taken = busy();
      if (!a.automatic || !b.automatic || taken.has(a.id) || taken.has(b.id) || ever.has(slurpPairKey(a.id, b.id)))
        continue;
      const fit = slurpCoupleFit(a, b);
      if (fit.fits && fit.cards) next = [...next, newSlurpCouple(input.newId(), a.id, b.id, "card", stamp, "together")];
    }

  // A storyline about the two of them getting together starts it.
  for (const [aId, bId] of input.storylines) {
    const a = byId.get(aId);
    const b = byId.get(bId);
    const taken = busy();
    if (!a || !b || taken.has(aId) || taken.has(bId) || !rested(aId, bId)) continue;
    if (slurpCoupleFit(a, b).fits) next = [...next, newSlurpCouple(input.newId(), aId, bId, "storyline", stamp)];
  }

  // Rarely, two Creators Slurp posts for start flirting. Only with chemistry, never a rival.
  const window = Math.floor(input.at.getTime() / (6 * HOUR_MS));
  const worldLive = next.filter((couple) => slurpCoupleActive(couple) && couple.origin === "world").length;
  if (worldLive < MAX_WORLD_COUPLES && hash(`${window}:couple`) % 100 < Math.round(8 * Math.max(0, input.activity))) {
    const taken = busy();
    const options = slurpCoupleMatches(
      input.creators,
      taken,
      (a, b) => input.rivals.has(slurpPairKey(a, b)) || !rested(a, b),
    ).sort(
      (left, right) =>
        right.fit.chemistry - left.fit.chemistry ||
        hash(`${window}:${slurpPairKey(left.a.id, left.b.id)}`) -
          hash(`${window}:${slurpPairKey(right.a.id, right.b.id)}`),
    );
    const pick = options[0];
    if (pick) next = [...next, newSlurpCouple(input.newId(), pick.a.id, pick.b.id, "world", stamp)];
  }
  return trim(next);
}

/**
 * Two free Creators Slurp posts for, with chemistry and cards that allow it: the pairs the world may
 * start flirting, and Stir's "they would click" suggestion. Unsorted; `skip` rules a pair out.
 */
export function slurpCoupleMatches(
  creators: readonly SlurpTieCreator[],
  taken: ReadonlySet<string>,
  skip: (aId: string, bId: string) => boolean = () => false,
): { a: SlurpTieCreator; b: SlurpTieCreator; fit: SlurpCoupleFit }[] {
  const free = creators.filter((creator) => creator.automatic && !taken.has(creator.id));
  return free
    .flatMap((a, index) => free.slice(index + 1).map((b) => [a, b] as const))
    .filter(([a, b]) => !skip(a.id, b.id))
    .map(([a, b]) => ({ a, b, fit: slurpCoupleFit(a, b) }))
    .filter((option) => option.fit.fits && option.fit.chemistry >= 2);
}

function trim(couples: SlurpCouple[]): SlurpCouple[] {
  const ended = couples
    .filter((couple) => !slurpCoupleActive(couple))
    .sort((left, right) => right.stageAt.localeCompare(left.stageAt))
    .slice(0, KEEP_ENDED);
  return [...couples.filter(slurpCoupleActive), ...ended];
}

// ─── Story beats and the player's steering ──────────────────────────────────────────────────────

/** They break up: a breakup moment, and a shared page closes with a goodbye post. */
export function slurpBreakUp(couple: SlurpCouple, at: Date): SlurpCouple {
  const stamp = at.toISOString();
  const split = slurpWithMoment(
    { ...couple, stage: "split", stageAt: stamp, ending: "breakup" },
    slurpCoupleMoment(couple, "breakup", stamp),
  );
  return couple.page && !couple.page.closedAt
    ? slurpWithMoment(
        { ...split, page: { ...couple.page, closedAt: stamp } },
        slurpCoupleMoment(split, "pageClose", stamp),
      )
    : split;
}

/**
 * They get back together: dating again, or together at once (`official`) when it is the player's
 * own couple, since nothing on the clock would ever make that official again.
 */
export function slurpGetBackTogether(couple: SlurpCouple, at: Date, official = false): SlurpCouple {
  const stamp = at.toISOString();
  // #1293: getting back together clears a chosen aftermath; it was about the breakup that just ended.
  const { aftermath: _aftermath, ...was } = couple;
  return slurpWithMoment(
    {
      ...was,
      stage: official ? "together" : "dating",
      stageAt: stamp,
      ...(official ? { togetherAt: stamp } : {}),
      ending: null,
      troubles: 0,
      reunions: couple.reunions + 1,
    },
    slurpCoupleMoment(couple, "reunion", stamp),
  );
}

export type SlurpCoupleError = SlurpCoupleMisfit | "notFound" | "notOpen" | "noHost" | "pageOpen" | "mono";

/**
 * The player sets two Creators up: they start flirting now. Chemistry then decides whether it
 * becomes more; a pair the player forced against a card (`forced`) sticks, awkwardly. When a card already names the other as their partner, they
 * start together (their shared page can open at once). A page the player runs said yes by picking it.
 */
export function slurpSetUpCouple(
  couples: readonly SlurpCouple[],
  a: SlurpTieCreator,
  b: SlurpTieCreator,
  input: {
    at: Date;
    id: string;
    polyamory?: boolean;
    /** A crush on the player, for the chat to take on. */ crush?: boolean;
  },
): SlurpCouple[] | SlurpCoupleError {
  if (!a.automatic && !b.automatic) return "noHost";
  const fit = slurpCoupleFit(a, b);
  if (fit.misfit === "same") return "same";
  // Polyamory (0.3.5): someone already with somebody may start another couple only if they are poly.
  const paired = couples.some((c) => slurpCoupleActive(c) && slurpCoupleOther(c, a.id) && slurpCoupleOther(c, b.id));
  const blocked = (x: SlurpTieCreator) => Boolean(slurpCoupleFor(couples, x.id)) && !(input.polyamory && x.poly);
  if (paired || ((blocked(a) || blocked(b)) && !input.polyamory)) return "busy";
  if (blocked(a) || blocked(b)) return "mono";
  // Against a card (slice I, user): it happens anyway, and the card colors how it goes.
  const forced = fit.fits ? null : slurpCoupleMisfitOf(a, b);
  // Partners on their cards are together already, like the couples the cards make on their own:
  // starting them at "sparks" told both "nothing is official" and kept their shared page shut.
  const withPlayer = !a.automatic || !b.automatic;
  const stamp = input.at.toISOString();
  const couple = newSlurpCouple(
    input.id,
    a.id,
    b.id,
    "player",
    stamp,
    input.crush ? "sparks" : fit.cards || withPlayer ? "together" : "sparks",
  );
  // With the player, official from the start: she makes it public (a hard launch).
  const launched =
    withPlayer && couple.stage === "together"
      ? slurpWithMoment(couple, slurpCoupleMoment(couple, "launch", stamp))
      : couple;
  return [...couples, forced ? { ...launched, forced } : launched];
}

export type SlurpCoupleSteer =
  | "date"
  | "drama"
  | "patchUp"
  | "breakUp"
  | "reunite"
  /** Make it official now: sparks or dating become together, with a launch. */
  | "official"
  /** Keep a couple with the player out of public, or go public again. */
  | "secret"
  | "public"
  /** #1293, an existing ex only: switch what the breakup leaves behind. */
  | "moveOn"
  | "forget";

/** The player steers a couple's story: plan a date, stir some drama, patch it up, end it, or reunite. */
export function slurpSteerCouple(
  couples: readonly SlurpCouple[],
  id: string,
  steer: SlurpCoupleSteer,
  input: { at: Date; creators: readonly SlurpTieCreator[]; aftermath?: SlpBreakupAftermath },
): SlurpCouple[] | SlurpCoupleError {
  const couple = couples.find((entry) => entry.id === id);
  if (!couple) return "notFound";
  const aftermath = input.aftermath && input.aftermath !== "keep" ? input.aftermath : null;
  // Trust boundary (#1293): an aftermath only ever means anything on a breakup; anywhere else, a
  // caller that sent one anyway is refused rather than silently humoured.
  if (input.aftermath !== undefined && steer !== "breakUp") return "notOpen";
  const stamp = input.at.toISOString();
  const byId = new Map(input.creators.map((creator) => [creator.id, creator]));
  const replace = (next: SlurpCouple) => couples.map((entry) => (entry.id === id ? next : entry));
  // #1293, an existing ex: switch what the breakup already left behind. Never touches `stageAt`, so
  // "you broke up N days ago" still counts from the real breakup.
  if ((steer === "moveOn" || steer === "forget") && couple.stage === "split")
    return replace({ ...couple, aftermath: steer });
  const live = couple.stage === "dating" || couple.stage === "together" || couple.stage === "sparks";
  if (steer === "date" && live)
    return replace(slurpWithMoment(couple, slurpCoupleMoment(couple, "date", stamp, pickDate(couple, byId, stamp))));
  if (steer === "drama" && (couple.stage === "dating" || couple.stage === "together"))
    return replace(
      slurpWithMoment(
        { ...couple, stage: "rocky", stageAt: stamp, troubles: couple.troubles + 1 },
        trouble(couple, stamp, new Map(), playerIds(couple, byId)),
      ),
    );
  if (steer === "official" && (couple.stage === "sparks" || couple.stage === "dating"))
    return replace(slurpMakeOfficial(couple, input.at));
  if ((steer === "secret" || steer === "public") && slurpCoupleActive(couple) && playerIds(couple, byId).size)
    // An open shared page names them both: it closes before the couple can be a secret.
    return (steer === "secret") === Boolean(couple.secret) ||
      (steer === "secret" && couple.page && !couple.page.closedAt)
      ? "notOpen"
      : replace(steer === "secret" ? { ...couple, secret: true } : withoutSecret(couple, stamp));
  if (steer === "patchUp" && couple.stage === "rocky")
    return replace(
      slurpWithMoment({ ...couple, stage: "together", stageAt: stamp }, slurpCoupleMoment(couple, "makeup", stamp)),
    );
  if (steer === "breakUp" && slurpCoupleActive(couple)) {
    const split =
      couple.stage === "sparks"
        ? { ...couple, stage: "split" as const, stageAt: stamp, ending: "fizzled" as const }
        : slurpBreakUp(couple, input.at);
    // #1293: the choice travels with the breakup itself; absent (or "keep") is today's behaviour.
    return replace(aftermath ? { ...split, aftermath } : split);
  }
  if (steer === "reunite" && couple.stage === "split") {
    const a = byId.get(couple.aId);
    const b = byId.get(couple.bId);
    if (!a || !b) return "notFound";
    const fit = slurpCoupleFit(a, b);
    if (!fit.fits && !couple.forced) return fit.misfit ?? "notInto";
    if (
      couples.some(
        (entry) =>
          entry.id !== id &&
          slurpCoupleActive(entry) &&
          (slurpCoupleOther(entry, a.id) || slurpCoupleOther(entry, b.id)),
      )
    )
      return "busy";
    return replace(slurpGetBackTogether(couple, input.at, !a.automatic || !b.automatic));
  }
  return "notOpen";
}

/** Together now, with a launch post (she makes it public), from sparks or dating. */
export function slurpMakeOfficial(couple: SlurpCouple, at: Date): SlurpCouple {
  const stamp = at.toISOString();
  return slurpWithMoment(
    { ...couple, stage: "together", stageAt: stamp, togetherAt: couple.togetherAt ?? stamp },
    slurpCoupleMoment(couple, "launch", stamp),
  );
}

/** Going public after a secret: the launch she could not post before. */
function withoutSecret(couple: SlurpCouple, stamp: string): SlurpCouple {
  const { secret: _secret, ...open } = couple;
  return slurpCoupleTaken(open)
    ? slurpWithMoment(open, slurpCoupleMoment(open, "launch", stamp, "going public"))
    : open;
}

/** Whether this couple may open a shared page: together in public, and not already running one. */
export function slurpCouplePageOpenable(couple: SlurpCouple): boolean {
  // A secret couple has no public page: the page would name them both.
  return slurpCoupleTaken(couple) && !couple.secret && !(couple.page && !couple.page.closedAt);
}

/** The shared page is open (a new account, or their old one again): its first post says hi. */
export function slurpOpenCouplePage(couple: SlurpCouple, accountId: string, at: Date): SlurpCouple {
  const stamp = at.toISOString();
  return slurpWithMoment(
    { ...couple, page: { accountId, openedAt: stamp, closedAt: null } },
    slurpCoupleMoment(couple, "pageOpen", stamp),
  );
}

/** The couple closes their page (the player asked): a goodbye post, like after a breakup. */
export function slurpCloseCouplePage(couple: SlurpCouple, at: Date): SlurpCouple {
  if (!couple.page || couple.page.closedAt) return couple;
  const stamp = at.toISOString();
  return slurpWithMoment(
    { ...couple, page: { ...couple.page, closedAt: stamp } },
    slurpCoupleMoment(couple, "pageClose", stamp),
  );
}

export function slurpCoupleTold(couple: SlurpCouple, keys: readonly string[]): SlurpCouple {
  return { ...couple, told: [...new Set([...couple.told, ...keys])].slice(-40) };
}

/** A joint couple post went up: it shows on the partner's page too. */
export function slurpSettleCouplePost(couple: SlurpCouple, postId: string): SlurpCouple {
  return couple.postIds.includes(postId) ? couple : { ...couple, postIds: [...couple.postIds, postId].slice(-40) };
}

/** Joint couple posts that show on this Creator's page although the partner wrote them. */
export function slurpCouplePostIdsFor(couples: readonly SlurpCouple[], creatorId: string): string[] {
  return couples.flatMap((couple) => (slurpCoupleOther(couple, creatorId) ? couple.postIds : []));
}

/** The couple whose shared page this account is, or null. */
export function slurpCoupleOfPage(couples: readonly SlurpCouple[], accountId: string): SlurpCouple | null {
  return couples.find((couple) => couple.page?.accountId === accountId) ?? null;
}
