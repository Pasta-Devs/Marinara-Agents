/**
 * What a couple's story means for a Creator's next post: a beat, like a collab or a rivalry.
 *
 * Pure and deterministic. The beat says what happens (a date, the hard launch, a fight, the
 * breakup); the flavour brief makes the Creator tell it their own way in the same post call. Big
 * news (launch, anniversary, breakup, reunion, a shared page opening or closing) takes the next
 * ordinary slot; small moments only now and then, and each Creator posts a moment once.
 *
 * A couple is LIFE, a collab is WORK (U, user): a couple post is the Creator's own post with the
 * partner in it as a cameo (date night, their hoodie), no collab tag, no split, not on the partner's
 * page. Only their optional shared page is theirs together.
 */
import { hash } from "../projects/slp-project.js";
import {
  SLURP_COUPLE_MOMENT_DAYS,
  slurpCoupleOf,
  slurpCoupleOther,
  type SlurpCouple,
  type SlurpCoupleMoment,
  type SlurpCoupleMomentKind,
} from "../projects/slp-creator-couples.js";
import type { SlurpTieStamp } from "../projects/slp-tie-stamp.js";
import { slurpCouplePartners, slurpNameList } from "../projects/slp-couple-group.js";
import type { SlurpBeat } from "./slp-post-beat.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Moving on (U: exes) is posted once by each, so it always takes the slot like the other news.
const BIG: readonly SlurpCoupleMomentKind[] = [
  "joined",
  "launch",
  "anniversary",
  "breakup",
  "reunion",
  "pageOpen",
  "pageClose",
  "movingOn",
];
/** Made together: on their shared page when it is open; otherwise each posts their own. */
const JOINT: readonly SlurpCoupleMomentKind[] = ["launch", "anniversary", "reunion"];
/** The partner in an everyday post, like real couples show up in each other's lives (U). */
const CAMEOS = [
  "date night: a table for two and their hand across it",
  "you in their hoodie, way too big for you",
  "their coffee order next to yours in the morning",
  "them cooking in the background while you talk",
  "a slow morning, them still asleep behind you",
  "their shoes by the door next to yours",
  "the two of you on the couch, a movie half-watched",
  "a walk together, their shadow next to yours",
  "them holding the camera for you today",
  "a small thing they left for you to find",
] as const;
/** While dating it is not official yet: they show up, but only a little. */
const COY_CAMEOS = [
  "a second glass on the table and nothing else said",
  "a hand in the frame, no face",
  "a laugh off camera that is clearly not yours",
  "two tickets, and you are not saying who the other one is for",
] as const;
const PAGE_ONLY: readonly SlurpCoupleMomentKind[] = ["pageOpen", "pageClose"];
/** Who she is with, in public, while it is a secret. */
const SECRET_NAME = "someone special";
/** A secret couple with the player: no name and no face in public, and the fans may guess. */
const SECRET_LINE = " It is a secret: never name them, never show their face, and let your fans guess who it is.";

/**
 * With the player: a secret stays one, and a date or an anniversary is a picture the player took.
 * ponytail: said in the beat line only; wire the "partner" camera source if the picture ignores it.
 */
function playerExtra(kind: SlurpCoupleMomentKind, partner: string, secret: boolean): string {
  const shot = kind === "date" || kind === "anniversary" ? ` The picture is one ${partner} took of you.` : "";
  return `${secret ? SECRET_LINE : ""}${shot}`;
}

/** What goes up on a shared page on an ordinary day, like real couple accounts post. */
const PAGE_IDEAS = [
  "a morning side by side, before either of you is a person",
  "the grocery run you two always argue in",
  "a question round: fans ask, you both answer",
  "who is the messier one, settled once and for all",
  "the other one's worst habit, lovingly exposed",
  "a throwback to how you two met",
  "a lazy Sunday that did not leave the couch",
  "one of you trying the other's hobby, badly",
  "getting ready for a night out, together",
  "a small fight about something tiny, made up on camera",
  "the one thing you both agree on, and the ten you do not",
  "a recipe one of you swears by and the other doubts",
] as const;

function momentLine(moment: SlurpCoupleMoment, partner: string, couple: SlurpCouple, other: string | null): string {
  const dating = couple.stage === "dating" || couple.stage === "sparks";
  switch (moment.kind) {
    case "flirt":
      return `You and ${partner} have been flirting in each other's comments, and people are starting to notice. Hint at it your way, without saying anything official.`;
    case "date":
      return dating
        ? `You went on a date with ${partner}: ${moment.detail}. Share a bit of it your way; it is not official yet, so keep it a little coy.`
        : `A date with ${partner}: ${moment.detail}. Share it your way.`;
    case "launch":
      return `You and ${partner} are official now. Tell your fans your way: a proud hard launch, a shy one, or a joke.`;
    case "anniversary":
      return `${moment.detail[0]!.toUpperCase()}${moment.detail.slice(1)} with ${partner} today. Mark it your way.`;
    case "jealous":
      return other
        ? `${partner} made a collab with ${other}, and it got to you more than you want to admit. Let a bit of it show, your way, without airing everything.`
        : `Something with ${partner} is bugging you: ${moment.detail}. Let a bit of it show, your way, without airing everything.`;
    case "fight":
      return `You and ${partner} had a fight about ${moment.detail}. You are not over it yet. Say as much or as little as you would.`;
    case "makeup":
      return `You and ${partner} talked it out after the fight. Things are good again; show it your way.`;
    case "breakup":
      return `You and ${partner} broke up. Tell your fans your way: sad, relieved, messy or graceful, whatever is true for you.`;
    case "reunion":
      return `You and ${partner} are back together. Tell your fans your way.`;
    case "pageOpen":
      return `You and ${partner} just opened a page together. This is its first post: say hi to everyone as a couple, your way.`;
    case "pageClose":
      return `This is the last post on the page you shared with ${partner}. Say goodbye to the fans who followed you both, kindly and your way.`;
    case "joined":
      return other
        ? `${other} joined you and ${partner}: the relationship is three now (or more). Tell your fans your way.`
        : `You joined ${partner} as a partner. Tell your fans your way.`;
    case "movingOn":
      return `It has been a little while since you and ${partner} broke up. Post about moving on, your way: a glow-up, a quiet day for yourself, a kind word, or a small dig. Your ex is not the whole post.`;
  }
}

/**
 * The couple beat for this Creator's ordinary slot, or null. Newest untold moment first; while a
 * shared page is open, about one ordinary slot in four goes to that page.
 */
export function slurpCoupleBeat(input: {
  creatorId: string;
  sequence: number;
  couples: readonly SlurpCouple[];
  /** Public names by account id (Creators and shared pages). */
  names: ReadonlyMap<string, string>;
  /** Pages the player runs: a couple with one of them may be secret, and they take the pictures. */
  playerIds?: ReadonlySet<string>;
  at: Date;
}): (SlurpBeat & { tie: SlurpTieStamp }) | null {
  const { creatorId, at } = input;
  for (const couple of input.couples) {
    if (slurpCoupleOf(input.couples, couple.aId, couple.bId) !== couple) continue;
    // #1293: forgetting stops the relationship from reaching any future post, big moment or cameo.
    if (couple.aftermath === "forget") continue;
    const partnerId = slurpCoupleOther(couple, creatorId);
    // Polyamory (0.3.5): every partner is named; the stamp keeps the first one.
    const partnerIds = slurpCouplePartners(couple, creatorId).filter((id) => input.names.has(id));
    const withPlayer = partnerIds.some((id) => input.playerIds?.has(id));
    // A secret couple with the player (Drama, "your relationship"): never named in public.
    const secret = Boolean(couple.secret && withPlayer);
    const names = secret
      ? new Map([...input.names].map(([id, name]) => [id, partnerIds.includes(id) ? SECRET_NAME : name]))
      : input.names;
    const partnerNames = partnerIds.map((id) => names.get(id)!);
    const partner = slurpNameList(partnerNames);
    if (!partnerId || !partner) continue;
    const page = couple.page;
    const pageOpen = Boolean(page && !page.closedAt);
    const fresh = couple.moments
      .filter((moment) => !(couple.aftermath === "moveOn" && (moment.kind === "breakup" || moment.kind === "movingOn")))
      .filter((moment) => at.getTime() - Date.parse(moment.at) < SLURP_COUPLE_MOMENT_DAYS * DAY_MS)
      .filter((moment) => !couple.told.includes(`${creatorId}:${moment.id}`))
      // Jealousy is theirs to post, not the one it is about.
      .filter((moment) => !moment.fromId || moment.fromId === creatorId)
      .filter((moment) => !PAGE_ONLY.includes(moment.kind) || page)
      // A secret has no launch: she tells nobody.
      .filter((moment) => !(secret && moment.kind === "launch"))
      .reverse();
    const moment = fresh.find(
      (entry) => BIG.includes(entry.kind) || hash(`${entry.id}:${creatorId}:${input.sequence}`) % 2 === 0,
    );
    if (moment) {
      const joint =
        JOINT.includes(moment.kind) ||
        (moment.kind === "date" &&
          couple.stage !== "sparks" &&
          couple.stage !== "dating" &&
          hash(`${moment.id}:joint`) % 2 === 0);
      const onPage = page && (PAGE_ONLY.includes(moment.kind) || (joint && pageOpen));
      // The one who joined is "other" to the rest, and posts it as their own news.
      const other = moment.withId && moment.withId !== creatorId ? (names.get(moment.withId) ?? null) : null;
      const told =
        moment.kind === "joined" && other ? slurpNameList(partnerNames.filter((name) => name !== other)) : partner;
      // Not a collab (U): on their own page, each posts their side; the partner is in it, not tagged.
      const where = onPage
        ? ` It goes up on ${names.get(page.accountId) ?? "your shared page"}, the page you two share, not your own.`
        : joint
          ? ` This is your own post about your life, not a collab: ${partner} can be in it, but no collab tag and no announcement.`
          : "";
      return {
        type: moment.kind === "fight" || moment.kind === "jealous" ? "opinion" : "relationship_moment",
        anchorKind: "couple",
        anchor: partner,
        line: `${momentLine(moment, told, couple, other)}${where}${withPlayer ? playerExtra(moment.kind, partner, secret) : ""}`,
        cast: other ? [...partnerNames, other] : partnerNames,
        castIds: other && moment.withId ? [...new Set([...partnerIds, moment.withId])] : partnerIds,
        place: null,
        tie: {
          kind: "couple",
          id: couple.id,
          partnerId,
          ...(secret ? { secret: true } : {}),
          moment: moment.kind,
          momentId: moment.id,
          ...(onPage ? { pageId: page.accountId, hostId: creatorId } : {}),
        },
      };
    }
    if (pageOpen && hash(`${couple.id}:${creatorId}:${input.sequence}:page`) % 4 === 0) {
      // A different idea each time: a turn picks from the ideas by the page's own post count.
      const turn = hash(`${couple.id}:${creatorId}`) + input.sequence;
      const idea = PAGE_IDEAS[turn % PAGE_IDEAS.length]!;
      return {
        type: "relationship_moment",
        anchorKind: "couple",
        anchor: partner,
        line: `You post on ${names.get(page!.accountId) ?? "the page you share with " + partner}, the page you and ${partner} share: ${idea}. Your way; it goes up there, not on your own page.`,
        cast: partnerNames,
        castIds: partnerIds,
        place: null,
        tie: { kind: "couple", id: couple.id, partnerId, pageId: page!.accountId, hostId: creatorId },
      };
    }
    // Now and then the partner is just part of the day: a cameo, never a collab (U).
    if (
      (couple.stage === "dating" || couple.stage === "together") &&
      hash(`${couple.id}:${creatorId}:${input.sequence}:cameo`) % 5 === 0
    ) {
      const pool = couple.stage === "dating" ? COY_CAMEOS : CAMEOS;
      const cameo = pool[hash(`${couple.id}:${creatorId}:${input.sequence}:which`) % pool.length]!;
      return {
        type: "relationship_moment",
        anchorKind: "couple",
        anchor: partner,
        line:
          couple.stage === "dating"
            ? `${partner} is part of your day, but it is not official yet: ${cameo}. Keep it coy, your way; no tag, no names needed.`
            : `${partner} makes a cameo in today's post: ${cameo}. It is your everyday life, not a collab: no tag, no announcement, just the two of you being a couple in the background of your day.` +
              (secret ? SECRET_LINE : ""),
        cast: partnerNames,
        castIds: partnerIds,
        place: null,
        tie: { kind: "couple", id: couple.id, partnerId, moment: "cameo", ...(secret ? { secret: true } : {}) },
      };
    }
  }
  return null;
}
