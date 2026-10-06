/**
 * Who works with whom, and who does not get along: collab requests between Creators and rivalries.
 *
 * Pure and deterministic, like the arc and life-moment rules. Nothing here calls a model: requests,
 * answers and rivalry stages are decided by code on the world clock, and what they mean for a post
 * becomes a beat that rides the Creator's ordinary post call (see `slp-tie-beats.ts`).
 *
 * ## The rules
 *
 * - **Only where it fits.** Two Creators pair up when their cards share a niche (a tag or an
 *   interest), or when the player paired them in Creator settings. A card that says they never do
 *   collabs is never asked. Rivalries need a shared niche and a card with some fire in it (the same
 *   personality words life moments use for drama); calm Creators are never dragged into one.
 * - **In character.** The Creator who is asked answers by fit: yes when it suits them, no with a
 *   reason of their own. A request to a page the player runs waits for the player.
 * - **Slurp writes the post.** The host of a collab is always a Creator Slurp posts for, so the joint
 *   post is written in that Creator's voice and shows on both pages.
 * - **Money.** A collab post's income is split 50/50 unless the two agreed otherwise in-story (a DM
 *   between the two pages can set `hostShare`).
 * - **Work, not life (U).** A collab is announced before it drops, tagged both ways and brings fans
 *   across (`slp-collab-work.ts`). A couple may also make a real collab; it is still work.
 * - **The player steers.** Push a request through, block a pair for good, suggest a pairing, or cool
 *   a rivalry down. Blocked pairs are never asked again until unblocked.
 *
 * Couples have their own rules in `slp-creator-couples.ts` and their own list in the same document.
 */
import type { SlpCreatorRomance } from "../../../../../shared/src/slp/slp-creator-steering.js";
import { SLURP_DRAMATIC, SLURP_NEVER_PATTERN } from "../feed/slp-life-moments.js";
import { DAY_MS, clampText, hash } from "./slp-project.js";
import { readSlurpTieStamp, slurpClampShare, SLURP_COLLAB_DEFAULT_SHARE } from "./slp-tie-stamp.js";
import { SLURP_COLLAB_INTERESTS } from "./slp-collab-work.js";

const HOUR_MS = 60 * 60 * 1000;
/** The world looks at ties at most this often; everything below is per look. */
export const SLURP_TIES_ADVANCE_MS = 6 * HOUR_MS;
/** A Creator thinks a request over before answering. */
const ANSWER_AFTER_MS = 3 * HOUR_MS;
/** A request to the player's own page expires unanswered. */
const PLAYER_ANSWER_DAYS = 4;
/** A planned collab whose post never went up is free to plan again. */
// ponytail: time-based. A prepared post that publishes after this can post the collab twice; the
// second one is only a second post, the partner page keeps the first. Link plans to slots if seen.
export const SLURP_TIE_PLAN_STALE_DAYS = 5;
const MAX_OPEN_COLLABS = 3;
const MAX_ACTIVE_RIVALRIES = 2;
// Pace (slice I, user: ties ≈ 4 % of posts, was 1.5 %): a pair rests a week between collabs, and
// a rivalry pair ten days; the world looks for a collab / a rivalry in about half / a quarter of its windows.
const COLLAB_REST_DAYS = 7;
const RIVAL_REST_DAYS = 10;
export const SLURP_COLLAB_CHANCE = 80;
export const SLURP_RIVAL_CHANCE = 35;
const KEEP_FINISHED = 40;

/** A Creator as far as ties go. `text` is the card + anchors + tags fit text (`readSlurpCreatorFitText`). */
export type SlurpTieCreator = {
  id: string;
  name: string;
  text: string;
  tags: readonly string[];
  /** Slurp writes this Creator's posts. False for a page the player runs. */
  automatic: boolean;
  followers: number;
  /** For couples (`slp-creator-couples.ts`): the stage profile's gender, when set. */
  gender?: "male" | "female" | "other" | null;
  /** For couples: partners the card itself names (anchor people with a partner relation). */
  cardPartners?: readonly string[];
  /** For bonds (`slp-creator-bonds.ts`): everyone the card names, with how they relate (canon anchors). */
  cardPeople?: readonly { name: string; relation: string }[];
  /** Polyamory (0.3.5): their steering's relationship style, else poly words on their card. */
  poly?: boolean;
  /** The player's romance setting for them (0.3.17): never, or only with some Creators. */
  romance?: SlpCreatorRomance;
};

export type SlurpCollabStatus = "asked" | "agreed" | "planned" | "posted" | "declined" | "blocked";
export type SlurpCollabDecline = "busy" | "offBrand" | "noCollabs" | "noAnswer" | "player";

export type SlurpCollab = {
  id: string;
  /** Writes the joint post. Always a Creator Slurp posts for. */
  hostId: string;
  partnerId: string;
  /** What they make together, one plain line. */
  idea: string;
  /** The host's share of what the post earns, in percent. The partner gets the rest. */
  hostShare: number;
  status: SlurpCollabStatus;
  origin: "world" | "player" | "rivalry" | "dm";
  askedAt: string;
  answeredAt: string | null;
  plannedAt: string | null;
  postId: string | null;
  postedAt: string | null;
  decline: SlurpCollabDecline | null;
  /** The partner posted their own side of it (slice I: both pages post about a collab, like real people). */
  echoed?: boolean;
  /** The host announced it (U: a collab is announced, then drops); the joint post waits for `dropAt`. */
  announcedAt?: string | null;
  dropAt?: string | null;
  /** Planned in their DMs as a spicy shoot together (U): the joint post is that shoot. */
  shoot?: boolean;
  /** Fans who came across once it was up: to the host, to the partner (U). */
  crossover?: { host: number; partner: number };
};

export type SlurpRivalryStage = "shade" | "feud" | "cooling" | "over";

export type SlurpRivalry = {
  id: string;
  /** Who started it. Always a Creator Slurp posts for. */
  fromId: string;
  toId: string;
  cause: string;
  stage: SlurpRivalryStage;
  startedAt: string;
  stageAt: string;
  /** How it ended: they made up (and maybe collab next), it fizzled out, or the player calmed it. */
  ending: "made_up" | "fizzled" | "calmed" | null;
  /** `<creatorId>:<stage>` once that Creator posted about this stage: one post per stage each. */
  told: string[];
};

export type SlurpCreatorTies = {
  collabs: SlurpCollab[];
  rivalries: SlurpRivalry[];
  /** Pair keys the player blocked from collabs. */
  blocked: string[];
  advancedAt: string | null;
};

export const SLURP_NO_TIES: SlurpCreatorTies = { collabs: [], rivalries: [], blocked: [], advancedAt: null };

export const slurpPairKey = (a: string, b: string) => [a, b].sort().join("|");

// ─── Fit ────────────────────────────────────────────────────────────────────────────────────────

/** A card that rules collabs out: "never shares the spotlight", "does not do collabs". */
const COLLAB_TOPIC =
  /\b(collab\w*|team(s|ing)? up|work(s|ing)? with (others|other creators)|spotlight|partners?hip)\b/iu;
/** A card that rules fights out: "hates drama", "never starts beef". */
const DRAMA_TOPIC = /\b(drama|beef|fights?|feuds?|arguments?|conflict)\b/iu;

const never = (text: string) =>
  text.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => SLURP_NEVER_PATTERN.test(sentence));

export function slurpCreatorInterests(creator: Pick<SlurpTieCreator, "text" | "tags">): string[] {
  const text = [creator.text, ...creator.tags].join("\n");
  return SLURP_COLLAB_INTERESTS.filter((interest) => interest.words.test(text)).map((interest) => interest.id);
}

/** What two Creators share: tags and interests. */
export function slurpSharedNiche(a: SlurpTieCreator, b: SlurpTieCreator): { tags: string[]; interests: string[] } {
  const tagsA = new Set(a.tags.map((tag) => tag.toLocaleLowerCase()));
  const interestsB = new Set(slurpCreatorInterests(b));
  return {
    tags: [...new Set(b.tags.map((tag) => tag.toLocaleLowerCase()))].filter((tag) => tagsA.has(tag)).sort(),
    interests: slurpCreatorInterests(a).filter((interest) => interestsB.has(interest)),
  };
}

export type SlurpCollabFit = {
  fits: boolean;
  score: number;
  decline: SlurpCollabDecline | null;
  idea: string;
  /** What they could make together; a pair that collabs again picks one they have not done. */
  ideas: readonly string[];
};

/**
 * Whether these two would plausibly make something together, judged from both cards. `paired`: the
 * player listed them as collab partners in Creator settings. `boost`: the player suggested it.
 */
export function slurpCollabFit(
  a: SlurpTieCreator,
  b: SlurpTieCreator,
  options: { paired?: boolean; boost?: number } = {},
): SlurpCollabFit {
  const niche = slurpSharedNiche(a, b);
  const shared = SLURP_COLLAB_INTERESTS.find((interest) => niche.interests.includes(interest.id));
  const ideas = shared?.ideas ?? ["one shoot that mixes both your styles", "a day swapping your usual routines"];
  const idea = ideas[0]!;
  if ([a, b].some((creator) => never(creator.text).some((sentence) => COLLAB_TOPIC.test(sentence))))
    return { fits: false, score: 0, decline: "noCollabs", idea, ideas };
  const score = niche.tags.length * 2 + niche.interests.length + (options.paired ? 4 : 0) + (options.boost ?? 0);
  // One shared niche is enough: two bakers, two climbers. A shared tag counts double in the ranking.
  return { fits: score >= 1, score, decline: score >= 1 ? null : "offBrand", idea, ideas };
}

/** Whether a rivalry between these two fits: a shared niche, and fire in the one who starts it. */
export function slurpRivalryFits(from: SlurpTieCreator, to: SlurpTieCreator): boolean {
  if (!from.automatic || from.id === to.id) return false;
  if (!SLURP_DRAMATIC.test([from.text, ...from.tags].join("\n"))) return false;
  if ([from, to].some((creator) => never(creator.text).some((sentence) => DRAMA_TOPIC.test(sentence)))) return false;
  const niche = slurpSharedNiche(from, to);
  return niche.tags.length + niche.interests.length > 0;
}

// ─── Money ──────────────────────────────────────────────────────────────────────────────────────

/** What a collab post earns, split: the partner gets their share rounded down, the host the rest. */
export function slurpCollabIncomeParts(amount: number, hostShare: number): { host: number; partner: number } {
  const whole = Math.max(0, Math.floor(amount));
  const partner = Math.floor((whole * (100 - slurpClampShare(hostShare))) / 100);
  return { host: whole - partner, partner };
}

// ─── Storage shape ──────────────────────────────────────────────────────────────────────────────

const COLLAB_STATUSES: readonly SlurpCollabStatus[] = ["asked", "agreed", "planned", "posted", "declined", "blocked"];
const DECLINES: readonly SlurpCollabDecline[] = ["busy", "offBrand", "noCollabs", "noAnswer", "player"];
const STAGES: readonly SlurpRivalryStage[] = ["shade", "feud", "cooling", "over"];
const record = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const date = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);

export function readSlurpCreatorTies(raw: unknown): SlurpCreatorTies {
  const value = record(raw);
  if (!value) return { ...SLURP_NO_TIES, collabs: [], rivalries: [], blocked: [] };
  const collabs = (Array.isArray(value.collabs) ? value.collabs : []).flatMap((entry): SlurpCollab[] => {
    const item = record(entry);
    const id = clampText(item?.id, 64);
    const hostId = clampText(item?.hostId, 128);
    const partnerId = clampText(item?.partnerId, 128);
    const askedAt = date(item?.askedAt);
    if (!item || !id || !hostId || !partnerId || hostId === partnerId || !askedAt) return [];
    return [
      {
        id,
        hostId,
        partnerId,
        idea: clampText(item.idea, 200),
        hostShare: slurpClampShare(item.hostShare),
        status: COLLAB_STATUSES.includes(item.status as SlurpCollabStatus)
          ? (item.status as SlurpCollabStatus)
          : "asked",
        origin: (["world", "player", "rivalry", "dm"] as const).find((origin) => origin === item.origin) ?? "world",
        askedAt,
        answeredAt: date(item.answeredAt),
        plannedAt: date(item.plannedAt),
        postId: clampText(item.postId, 128) || null,
        postedAt: date(item.postedAt),
        decline: DECLINES.includes(item.decline as SlurpCollabDecline) ? (item.decline as SlurpCollabDecline) : null,
        ...(item.echoed === true ? { echoed: true } : {}),
        // U: collabs agreed before announcements existed have neither and announce first.
        ...(date(item.announcedAt) ? { announcedAt: date(item.announcedAt), dropAt: date(item.dropAt) } : {}),
        ...(item.shoot === true ? { shoot: true } : {}),
        ...(() => {
          const crossover = record(item.crossover);
          const count = (value: unknown) =>
            typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
          return crossover ? { crossover: { host: count(crossover.host), partner: count(crossover.partner) } } : {};
        })(),
      },
    ];
  });
  const rivalries = (Array.isArray(value.rivalries) ? value.rivalries : []).flatMap((entry): SlurpRivalry[] => {
    const item = record(entry);
    const id = clampText(item?.id, 64);
    const fromId = clampText(item?.fromId, 128);
    const toId = clampText(item?.toId, 128);
    const startedAt = date(item?.startedAt);
    if (!item || !id || !fromId || !toId || fromId === toId || !startedAt) return [];
    return [
      {
        id,
        fromId,
        toId,
        cause: clampText(item.cause, 200),
        stage: STAGES.includes(item.stage as SlurpRivalryStage) ? (item.stage as SlurpRivalryStage) : "over",
        startedAt,
        stageAt: date(item.stageAt) ?? startedAt,
        ending: (["made_up", "fizzled", "calmed"] as const).find((ending) => ending === item.ending) ?? null,
        told: (Array.isArray(item.told) ? item.told : [])
          .filter((key): key is string => typeof key === "string")
          .slice(-12),
      },
    ];
  });
  return {
    collabs,
    rivalries,
    blocked: [...new Set((Array.isArray(value.blocked) ? value.blocked : []).filter((key) => typeof key === "string"))],
    advancedAt: date(value.advancedAt),
  };
}

const OPEN: readonly SlurpCollabStatus[] = ["asked", "agreed", "planned"];
export const slurpCollabOpen = (collab: SlurpCollab) => OPEN.includes(collab.status);
export const slurpRivalryActive = (rivalry: SlurpRivalry) => rivalry.stage !== "over";

/**
 * Creators this one works with, for a partner scene (spice): the pages paired in Creator settings plus
 * every collab they agreed or made together. A blocked pair or an open rivalry is nobody's partner.
 */
export function slurpWorkingPartnerIds(ties: SlurpCreatorTies, creatorId: string, paired: readonly string[]): string[] {
  const other = (a: string, b: string) => (a === creatorId ? b : b === creatorId ? a : null);
  const made = ties.collabs
    .filter((collab) => ["agreed", "planned", "posted"].includes(collab.status))
    .map((collab) => other(collab.hostId, collab.partnerId));
  const rivals = new Set(
    ties.rivalries.filter(slurpRivalryActive).map((rivalry) => other(rivalry.fromId, rivalry.toId)),
  );
  const blocked = new Set(ties.blocked);
  return [...new Set([...paired, ...made])].filter(
    (id): id is string =>
      Boolean(id) && id !== creatorId && !rivals.has(id) && !blocked.has(slurpPairKey(creatorId, id!)),
  );
}

/** Open and active first, then the newest finished ones, capped. */
function trim(ties: SlurpCreatorTies): SlurpCreatorTies {
  const finishedCollabs = ties.collabs
    .filter((collab) => !slurpCollabOpen(collab))
    .sort((left, right) => (right.answeredAt ?? right.askedAt).localeCompare(left.answeredAt ?? left.askedAt))
    .slice(0, KEEP_FINISHED);
  const finishedRivalries = ties.rivalries
    .filter((rivalry) => !slurpRivalryActive(rivalry))
    .sort((left, right) => right.stageAt.localeCompare(left.stageAt))
    .slice(0, KEEP_FINISHED);
  return {
    ...ties,
    collabs: [...ties.collabs.filter(slurpCollabOpen), ...finishedCollabs],
    rivalries: [...ties.rivalries.filter(slurpRivalryActive), ...finishedRivalries],
  };
}

// ─── The world clock ────────────────────────────────────────────────────────────────────────────

const RIVAL_CAUSES = [
  "posted the same idea a day after you did",
  "wore a look that is very clearly yours",
  "left a comment under your post that read like shade",
  "told a fan your content is all filters",
  "jumped on the trend you started and got the credit",
  "unfollowed you out of nowhere",
] as const;

const hoursSince = (from: string, at: Date) => (at.getTime() - Date.parse(from)) / HOUR_MS;
const daysSince = (from: string, at: Date) => (at.getTime() - Date.parse(from)) / DAY_MS;

/** Days a rivalry stays on a stage. Seeded per rivalry, so the same world moves the same way. */
function stageDays(rivalry: SlurpRivalry): number {
  const roll = hash(`${rivalry.id}:${rivalry.stage}`);
  return rivalry.stage === "shade" ? 2 + (roll % 2) : rivalry.stage === "feud" ? 3 + (roll % 3) : 2 + (roll % 2);
}

export type SlurpTiesInput = {
  creators: readonly SlurpTieCreator[];
  at: Date;
  /** World activity × rhythm; 0 starts nothing new (answers and stages still move). */
  activity: number;
  /** Pairs the player listed as collab partners in Creator settings. */
  paired: readonly (readonly [string, string])[];
  newId: () => string;
};

/**
 * One look at the ties: answers due requests, moves rivalries along, and now and then starts a new
 * request or rivalry. Only when `SLURP_TIES_ADVANCE_MS` passed since the last look.
 */
export function slurpAdvanceCreatorTies(ties: SlurpCreatorTies, input: SlurpTiesInput): SlurpCreatorTies {
  const { at } = input;
  if (ties.advancedAt && at.getTime() - Date.parse(ties.advancedAt) < SLURP_TIES_ADVANCE_MS) return ties;
  const byId = new Map(input.creators.map((creator) => [creator.id, creator]));
  const paired = new Set(input.paired.map(([a, b]) => slurpPairKey(a, b)));
  const stamp = at.toISOString();
  const window = Math.floor(at.getTime() / SLURP_TIES_ADVANCE_MS);

  // A Creator that no longer exists leaves every open tie.
  let collabs = ties.collabs.map((collab) =>
    slurpCollabOpen(collab) && (!byId.has(collab.hostId) || !byId.has(collab.partnerId))
      ? { ...collab, status: "declined" as const, decline: "noAnswer" as const, answeredAt: stamp }
      : collab,
  );
  let rivalries = ties.rivalries.map((rivalry) =>
    slurpRivalryActive(rivalry) && (!byId.has(rivalry.fromId) || !byId.has(rivalry.toId))
      ? { ...rivalry, stage: "over" as const, stageAt: stamp, ending: "fizzled" as const }
      : rivalry,
  );

  // Answers, in character. A page the player runs waits for the player, then lets it lapse.
  collabs = collabs.map((collab) => {
    if (collab.status === "planned" && collab.plannedAt && daysSince(collab.plannedAt, at) >= SLURP_TIE_PLAN_STALE_DAYS)
      return { ...collab, status: "agreed", plannedAt: null };
    if (collab.status !== "asked") return collab;
    const host = byId.get(collab.hostId)!;
    const partner = byId.get(collab.partnerId)!;
    if (!partner.automatic)
      return daysSince(collab.askedAt, at) >= PLAYER_ANSWER_DAYS
        ? { ...collab, status: "declined", decline: "noAnswer", answeredAt: stamp }
        : collab;
    if (hoursSince(collab.askedAt, at) < ANSWER_AFTER_MS / HOUR_MS) return collab;
    const fit = slurpCollabFit(host, partner, {
      paired: paired.has(slurpPairKey(host.id, partner.id)),
      // A suggestion is asked like any request: the Creator still needs something in common. Two who
      // made up after a spat already know each other.
      boost: collab.origin === "rivalry" ? 1 : 0,
    });
    // Even a good fit is sometimes a "not right now": real people are busy.
    const busy = fit.fits && hash(`${collab.id}:busy`) % 5 === 0 && collab.origin === "world";
    return fit.fits && !busy
      ? { ...collab, status: "agreed", answeredAt: stamp }
      : { ...collab, status: "declined", decline: busy ? "busy" : fit.decline, answeredAt: stamp };
  });

  // Rivalries move along on their own clock.
  rivalries = rivalries.map((rivalry) => {
    if (!slurpRivalryActive(rivalry) || daysSince(rivalry.stageAt, at) < stageDays(rivalry)) return rivalry;
    const roll = hash(`${rivalry.id}:next`);
    if (rivalry.stage === "shade") {
      const to = byId.get(rivalry.toId);
      const bites = Boolean(to && SLURP_DRAMATIC.test([to.text, ...to.tags].join("\n"))) || roll % 2 === 0;
      return { ...rivalry, stage: bites ? "feud" : "cooling", stageAt: stamp };
    }
    if (rivalry.stage === "feud") return { ...rivalry, stage: "cooling", stageAt: stamp };
    const from = byId.get(rivalry.fromId)!;
    const to = byId.get(rivalry.toId)!;
    const madeUp = roll % 3 === 0 && slurpCollabFit(from, to, { boost: 2 }).fits;
    if (madeUp) {
      const host = from.automatic ? from : to;
      const partner = host === from ? to : from;
      collabs = [...collabs, newCollab(input.newId(), host, partner, "rivalry", stamp, undefined, collabs)];
    }
    return { ...rivalry, stage: "over", stageAt: stamp, ending: madeUp ? "made_up" : "fizzled" };
  });

  const blocked = new Set(ties.blocked);
  const busyIds = new Set(collabs.filter(slurpCollabOpen).flatMap((collab) => [collab.hostId, collab.partnerId]));
  const recent = (a: string, b: string, days: number, list: readonly { key: string; at: string }[]) =>
    list.some((entry) => entry.key === slurpPairKey(a, b) && daysSince(entry.at, at) < days);
  const collabHistory = collabs.map((collab) => ({
    key: slurpPairKey(collab.hostId, collab.partnerId),
    at: collab.askedAt,
  }));
  const rivalHistory = rivalries.map((rivalry) => ({
    key: slurpPairKey(rivalry.fromId, rivalry.toId),
    at: rivalry.stageAt,
  }));
  const rivals = new Set(rivalries.filter(slurpRivalryActive).flatMap((rivalry) => [rivalry.fromId, rivalry.toId]));
  const chance = (label: string, percent: number) =>
    hash(`${window}:${label}`) % 100 < Math.round(percent * Math.max(0, input.activity));

  // Now and then somebody reaches out. The smaller Creator asks the bigger one, like on a real app.
  // ponytail: every pair is scored (n² over Creators); fine for dozens, index by niche past a few hundred.
  if (collabs.filter(slurpCollabOpen).length < MAX_OPEN_COLLABS && chance("collab", SLURP_COLLAB_CHANCE)) {
    const options = pairs(input.creators)
      .filter(([a, b]) => (a.automatic || b.automatic) && !busyIds.has(a.id) && !busyIds.has(b.id))
      .filter(([a, b]) => !blocked.has(slurpPairKey(a.id, b.id)) && !rivals.has(a.id) && !rivals.has(b.id))
      .filter(([a, b]) => !recent(a.id, b.id, COLLAB_REST_DAYS, collabHistory))
      .map(([a, b]) => ({ a, b, fit: slurpCollabFit(a, b, { paired: paired.has(slurpPairKey(a.id, b.id)) }) }))
      .filter((option) => option.fit.fits)
      .sort(
        (left, right) =>
          right.fit.score - left.fit.score ||
          hash(`${window}:${slurpPairKey(left.a.id, left.b.id)}`) -
            hash(`${window}:${slurpPairKey(right.a.id, right.b.id)}`),
      );
    const pick = options[0];
    if (pick) {
      const [host, partner] = slurpCollabRoles(pick.a, pick.b);
      collabs = [...collabs, newCollab(input.newId(), host, partner, "world", stamp, undefined, collabs)];
    }
  }

  // Rarely, somebody throws shade. Only where the cards say it would happen.
  if (rivalries.filter(slurpRivalryActive).length < MAX_ACTIVE_RIVALRIES && chance("rival", SLURP_RIVAL_CHANCE)) {
    const options = pairs(input.creators)
      .flatMap(([a, b]) => [
        [a, b],
        [b, a],
      ])
      .filter(([from, to]) => slurpRivalryFits(from!, to!))
      .filter(([from, to]) => !rivals.has(from!.id) && !rivals.has(to!.id))
      .filter(([from, to]) => !busyIds.has(from!.id) || !busyIds.has(to!.id))
      .filter(([from, to]) => !recent(from!.id, to!.id, RIVAL_REST_DAYS, rivalHistory))
      .sort(([a1, b1], [a2, b2]) => hash(`${window}:${a1!.id}>${b1!.id}`) - hash(`${window}:${a2!.id}>${b2!.id}`));
    const pick = options[0];
    if (pick) {
      const id = input.newId();
      rivalries = [
        ...rivalries,
        {
          id,
          fromId: pick[0]!.id,
          toId: pick[1]!.id,
          cause: RIVAL_CAUSES[hash(`${id}:cause`) % RIVAL_CAUSES.length]!,
          stage: "shade",
          startedAt: stamp,
          stageAt: stamp,
          ending: null,
          told: [],
        },
      ];
    }
  }

  return trim({ ...ties, collabs, rivalries, advancedAt: stamp });
}

function pairs<T>(list: readonly T[]): [T, T][] {
  return list.flatMap((a, index) => list.slice(index + 1).map((b) => [a, b] as [T, T]));
}

/** Who hosts: a Creator Slurp posts for; of two, the smaller one reaches out and hosts. */
export function slurpCollabRoles(a: SlurpTieCreator, b: SlurpTieCreator): [SlurpTieCreator, SlurpTieCreator] {
  if (a.automatic !== b.automatic) return a.automatic ? [a, b] : [b, a];
  return a.followers < b.followers || (a.followers === b.followers && a.id < b.id) ? [a, b] : [b, a];
}

function newCollab(
  id: string,
  host: SlurpTieCreator,
  partner: SlurpTieCreator,
  origin: SlurpCollab["origin"],
  stamp: string,
  hostShare = SLURP_COLLAB_DEFAULT_SHARE,
  earlier: readonly SlurpCollab[] = [],
): SlurpCollab {
  const { ideas } = slurpCollabFit(host, partner);
  const done = new Set(
    earlier
      .filter((collab) => slurpPairKey(collab.hostId, collab.partnerId) === slurpPairKey(host.id, partner.id))
      .map((collab) => collab.idea),
  );
  const start = hash(`${id}:idea`) % ideas.length;
  const rotated = [...ideas.slice(start), ...ideas.slice(0, start)];
  return {
    id,
    hostId: host.id,
    partnerId: partner.id,
    idea: rotated.find((idea) => !done.has(idea)) ?? rotated[0]!,
    hostShare,
    status: "asked",
    origin,
    askedAt: stamp,
    answeredAt: null,
    plannedAt: null,
    postId: null,
    postedAt: null,
    decline: null,
  };
}

// ─── The player's steering ──────────────────────────────────────────────────────────────────────

export type SlurpTieError = "notFound" | "notOpen" | "sameCreator" | "noHost" | "busy";

/** Push a request through: the two agree now. Also answers "yes" for a page the player runs. */
export function slurpPushCollab(ties: SlurpCreatorTies, id: string, at: Date): SlurpCreatorTies | SlurpTieError {
  const collab = ties.collabs.find((entry) => entry.id === id);
  if (!collab) return "notFound";
  if (collab.status !== "asked" && collab.status !== "declined") return "notOpen";
  return update(ties, id, { status: "agreed", decline: null, answeredAt: at.toISOString() });
}

/** "No" for a request to a page the player runs. */
export function slurpDeclineCollab(ties: SlurpCreatorTies, id: string, at: Date): SlurpCreatorTies | SlurpTieError {
  const collab = ties.collabs.find((entry) => entry.id === id);
  if (!collab) return "notFound";
  if (collab.status !== "asked") return "notOpen";
  return update(ties, id, { status: "declined", decline: "player", answeredAt: at.toISOString() });
}

/** Call an open collab off without blocking the pair: it is over, and they may team up again later. */
export function slurpDropCollab(ties: SlurpCreatorTies, id: string, at: Date): SlurpCreatorTies | SlurpTieError {
  const collab = ties.collabs.find((entry) => entry.id === id);
  if (!collab) return "notFound";
  if (!slurpCollabOpen(collab)) return "notOpen";
  return update(ties, id, { status: "declined", decline: "player", answeredAt: at.toISOString() });
}

/**
 * An agreed collab is due now: announced if it never was, and its drop is this moment, so the host's
 * next post is the joint one. A host who never posted left it "agreed" with a past date for good.
 */
export function slurpCollabDueNow(ties: SlurpCreatorTies, id: string, at: Date): SlurpCreatorTies | SlurpTieError {
  const collab = ties.collabs.find((entry) => entry.id === id);
  if (!collab) return "notFound";
  // "planned" already has a post on the way: only an agreed collab can be pushed, or it posts twice.
  if (collab.status !== "agreed") return "notOpen";
  return update(ties, id, {
    announcedAt: collab.announcedAt ?? at.toISOString(),
    dropAt: at.toISOString(),
  });
}

/** Never pair these two: the request ends and the pair is not asked again until unblocked. */
export function slurpBlockCollab(ties: SlurpCreatorTies, id: string, at: Date): SlurpCreatorTies | SlurpTieError {
  const collab = ties.collabs.find((entry) => entry.id === id);
  if (!collab) return "notFound";
  const next = slurpCollabOpen(collab) ? update(ties, id, { status: "blocked", answeredAt: at.toISOString() }) : ties;
  return { ...next, blocked: [...new Set([...next.blocked, slurpPairKey(collab.hostId, collab.partnerId)])] };
}

export function slurpUnblockPair(ties: SlurpCreatorTies, key: string): SlurpCreatorTies {
  return { ...ties, blocked: ties.blocked.filter((entry) => entry !== key) };
}

/**
 * The player suggests a pairing. The asked Creator still answers in character at the next look (a
 * suggestion counts in its favour); a page the player runs has said yes by suggesting it.
 */
export function slurpSuggestCollab(
  ties: SlurpCreatorTies,
  a: SlurpTieCreator,
  b: SlurpTieCreator,
  input: { at: Date; id: string },
): SlurpCreatorTies | SlurpTieError {
  if (a.id === b.id) return "sameCreator";
  if (!a.automatic && !b.automatic) return "noHost";
  if (
    ties.collabs.some(
      (collab) => slurpCollabOpen(collab) && slurpPairKey(collab.hostId, collab.partnerId) === slurpPairKey(a.id, b.id),
    )
  )
    return "busy";
  const [host, partner] = slurpCollabRoles(a, b);
  const collab = newCollab(input.id, host, partner, "player", input.at.toISOString(), undefined, ties.collabs);
  return {
    ...ties,
    blocked: ties.blocked.filter((key) => key !== slurpPairKey(a.id, b.id)),
    collabs: [
      ...ties.collabs,
      partner.automatic ? collab : { ...collab, status: "agreed", answeredAt: input.at.toISOString() },
    ],
  };
}

/**
 * Two pages agreed on a collab in their own DM (the model said so in the reply). The DM is the
 * in-story agreement, so the split they named stands.
 */
export function slurpAgreeCollabInDm(
  ties: SlurpCreatorTies,
  host: SlurpTieCreator,
  partner: SlurpTieCreator,
  input: { at: Date; id: string; idea: string; hostShare: number | null; shoot?: boolean },
): SlurpCreatorTies {
  const key = slurpPairKey(host.id, partner.id);
  const open = ties.collabs.find(
    (collab) => slurpCollabOpen(collab) && slurpPairKey(collab.hostId, collab.partnerId) === key,
  );
  const share = input.hostShare === null ? SLURP_COLLAB_DEFAULT_SHARE : slurpClampShare(input.hostShare);
  const idea = clampText(input.idea, 200);
  const stamp = input.at.toISOString();
  const shoot = input.shoot ? { shoot: true } : {};
  if (open)
    return open.status === "planned"
      ? ties
      : update(ties, open.id, {
          status: "agreed",
          answeredAt: stamp,
          hostShare: share,
          ...(idea ? { idea } : {}),
          ...shoot,
        });
  const collab = newCollab(input.id, host, partner, "dm", stamp, share, ties.collabs);
  return {
    ...ties,
    blocked: ties.blocked.filter((entry) => entry !== key),
    collabs: [...ties.collabs, { ...collab, ...(idea ? { idea } : {}), ...shoot, status: "agreed", answeredAt: stamp }],
  };
}

/** Calm a rivalry down: it goes to "cooling" now and ends from there. */
export function slurpCoolRivalry(ties: SlurpCreatorTies, id: string, at: Date): SlurpCreatorTies | SlurpTieError {
  const rivalry = ties.rivalries.find((entry) => entry.id === id);
  if (!rivalry) return "notFound";
  if (!slurpRivalryActive(rivalry) || rivalry.stage === "cooling") return "notOpen";
  return {
    ...ties,
    rivalries: ties.rivalries.map((entry) =>
      entry.id === id ? { ...entry, stage: "cooling", stageAt: at.toISOString(), ending: "calmed" } : entry,
    ),
  };
}

/**
 * The player starts a rivalry (Stir, W): drama always happens, the cards only colour it (a Creator
 * with no fire in them keeps it petty). The one who starts it must be a Creator Slurp posts for, so
 * someone writes the shade; a pair already at it is refused.
 */
export function slurpStartRivalry(
  ties: SlurpCreatorTies,
  from: Pick<SlurpTieCreator, "id" | "automatic">,
  to: Pick<SlurpTieCreator, "id">,
  input: { at: Date; id: string; cause?: string },
): SlurpCreatorTies | SlurpTieError {
  if (from.id === to.id) return "sameCreator";
  if (!from.automatic) return "noHost";
  const pair = slurpPairKey(from.id, to.id);
  if (ties.rivalries.some((entry) => slurpRivalryActive(entry) && slurpPairKey(entry.fromId, entry.toId) === pair))
    return "busy";
  const stamp = input.at.toISOString();
  const cause = input.cause
    ? clampText(input.cause, 200)
    : RIVAL_CAUSES[hash(`${input.id}:cause`) % RIVAL_CAUSES.length]!;
  return {
    ...ties,
    rivalries: [
      ...ties.rivalries,
      {
        id: input.id,
        fromId: from.id,
        toId: to.id,
        cause,
        stage: "shade",
        startedAt: stamp,
        stageAt: stamp,
        ending: null,
        told: [],
      },
    ],
  };
}

/** This Creator posted about the rivalry's current stage; the next post about it waits for a new stage. */
export function slurpTellRivalry(ties: SlurpCreatorTies, id: string, creatorId: string): SlurpCreatorTies {
  return {
    ...ties,
    rivalries: ties.rivalries.map((entry) =>
      entry.id === id ? { ...entry, told: [...entry.told, `${creatorId}:${entry.stage}`].slice(-12) } : entry,
    ),
  };
}

function update(ties: SlurpCreatorTies, id: string, patch: Partial<SlurpCollab>): SlurpCreatorTies {
  return { ...ties, collabs: ties.collabs.map((collab) => (collab.id === id ? { ...collab, ...patch } : collab)) };
}

// ─── Posts ──────────────────────────────────────────────────────────────────────────────────────

/** The host's next ordinary slot took the collab. */
export function slurpPlanCollab(ties: SlurpCreatorTies, id: string, at: Date): SlurpCreatorTies {
  return update(ties, id, { status: "planned", plannedAt: at.toISOString() });
}

/** The partner's own post about the collab is planned: once is enough. */
export function slurpEchoCollab(ties: SlurpCreatorTies, id: string): SlurpCreatorTies {
  return update(ties, id, { echoed: true });
}

/** The joint post went up: it now shows on the partner's page too. */
export function slurpSettleCollab(ties: SlurpCreatorTies, id: string, post: { id: string; createdAt: string }) {
  const collab = ties.collabs.find((entry) => entry.id === id);
  if (!collab || collab.postId) return ties;
  return update(ties, id, { status: "posted", postId: post.id, postedAt: post.createdAt });
}

/** The joint posts that show on this Creator's page although someone else wrote them. */
export function slurpCollabPostIdsFor(ties: SlurpCreatorTies, creatorId: string): string[] {
  return ties.collabs.flatMap((collab) => (collab.partnerId === creatorId && collab.postId ? [collab.postId] : []));
}

/**
 * Who gets what a post earned. A collab post splits it with the partner; any other post pays its
 * author alone.
 */
export function slurpPostIncomeParts(
  post: { authorAccountId: string; metadata: Record<string, unknown> | null | undefined },
  amount: number,
): { creatorId: string; amount: number }[] {
  const stamp = readSlurpTieStamp(post.metadata);
  // The joint collab post splits. A couple keeps separate incomes (U, user: collab = work, couple =
  // life): new couple posts are never joint; an old joint couple post (before U) keeps its split, so
  // nothing changes for posts already up. A shared page pays that page, whose earnings go half to each
  // (`slurpCouplePageSplit`). The partner's own side (`echo`) and the announcement are one page's.
  const joint =
    (stamp?.kind === "collab" && !stamp.echo && !stamp.announce) ||
    (stamp?.kind === "couple" && stamp.joint === true && !stamp.pageId);
  if (!joint || !stamp.partnerId || stamp.partnerId === post.authorAccountId)
    return [{ creatorId: post.authorAccountId, amount }];
  const parts = slurpCollabIncomeParts(amount, stamp.hostShare ?? SLURP_COLLAB_DEFAULT_SHARE);
  return [
    { creatorId: post.authorAccountId, amount: parts.host },
    { creatorId: stamp.partnerId, amount: parts.partner },
  ];
}
