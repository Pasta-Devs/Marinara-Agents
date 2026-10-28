/**
 * Life moments: the day-to-day things that happen to a Creator between the big stories. A workout,
 * a bad day at work, something new to wear, a quiet week, a follower milestone, a post that took
 * off, a fan's tip, a heated comment section.
 *
 * Pure and deterministic, like the beats planner it feeds. See `slp-post-beat.ts`.
 *
 * ## The rules (from the player)
 *
 * - **Same people.** A moment is only used when it fits this Creator: a gym session needs a Creator
 *   whose card or life has sport in it, a work moment needs their work, drama needs a personality
 *   that would start or answer it. A card sentence that says they never or hate doing it rules it
 *   out. A moment that does not fit is dropped, never softened to fit.
 * - **Realism over drama.** Ordinary days are most of life. Drama is rare and only for Creators
 *   who are like that. Milestones, viral posts, gifts and comment fights only happen when the data
 *   says so: nobody celebrates a thousand followers they do not have.
 * - **No sameness.** A moment is not repeated within a Creator's recent posts, one moment reaches at
 *   most two Creators a day, and the kind of moment changes from one to the next.
 *
 * Two sources: moments written around the Creator's own anchors (their work, habits, places and
 * people, read from their card) and a shared pool. Both are only a "what happens"; the flavour
 * brief makes each Creator tell it their own way, in the same post call (no extra AI call).
 */

import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import {
  slurpAnchorFitsActivity,
  slurpBeatIntents,
  type SlurpAnchorKind,
  type SlurpBeat,
  type SlurpBeatHistory,
  type SlurpBeatType,
  type SlurpCanonAnchors,
} from "./slp-post-beat.js";
import { SLURP_SHARED_IDEA_DAILY_CAP } from "./slp-shared-preseed.js";
import { slurpWeightedPick } from "./slp-weighted.js";

/** Card sentences that rule something out. Shared with the flavour brief. */
export const SLURP_NEVER_PATTERN =
  /\b(never|won'?t|refuses?|hates?|can'?t stand|avoids?|dislikes?|nie|niemals|hasst)\b/iu;

/** What really happened lately, read from their posts, followers and earnings. */
export type SlurpLifeSignals = {
  /** Whole days since their last post; 0 when they posted today or never. */
  quietDays: number;
  /** A follower milestone they passed recently and have not posted about. */
  milestone: number | null;
  /** A recent post of theirs that did far better than usual, and has not been posted about. */
  viral: { id: string; label: string } | null;
  /** A fan tipped them in the last few days. */
  gift: boolean;
  /** A recent post of theirs with a busy comment section. */
  busyComments: boolean;
};

export const SLURP_NO_LIFE_SIGNALS: SlurpLifeSignals = {
  quietDays: 0,
  milestone: null,
  viral: null,
  gift: false,
  busyComments: false,
};

/** Who the Creator is, as far as "does this fit" goes: their card text, tags, and anchors. */
export type SlurpLifeCreator = {
  text: string;
  anchors: SlurpCanonAnchors;
  /** Topics the player wants left out for now (steering). A moment about one is not used. */
  avoid?: readonly string[];
};

type LifeKind = "body" | "day" | "work" | "style" | "home" | "social" | "platform" | "drama";

type LifeMoment = {
  id: string;
  kind: LifeKind;
  type: SlurpBeatType;
  /** What happens, second person. `{a}` is filled from `slot`; `{n}` and `{post}` from the signals. */
  line: string;
  /** The anchor kind that fills `{a}`: the moment is written around their own life. */
  slot?: SlurpAnchorKind;
  /** Only fits a Creator whose card, tags, or anchors say this. */
  needs?: RegExp;
  /** A card sentence that says they never or hate this and mentions it rules the moment out. */
  topic?: RegExp;
  /** Only when this really happened. */
  signal?: "quiet" | "milestone" | "viral" | "gift" | "comments";
  weight?: number;
  /**
   * Says what the Creator is doing right now (working, stuck somewhere, at the gym, cooking). The
   * schedule or the card's routine gives the main beat, so with one such a moment is only used when
   * it is about the same thing; the other moments colour whatever they are doing.
   */
  doing?: true;
};

// ponytail: word lists decide "fits"; a card that only mentions a word in passing ("chalk on her
// clothes") can still read as a match. Upgrade to the canon-anchor extraction naming interests if
// the evaluation shows misfits.
const SPORT =
  /\b(gym|work ?outs?|training|trains?|fitness|lift(s|ing)?|runn(ing|er)|jog|yoga|pilates|climb\w*|box(ing|er)|sports?|athlet\w*|dance[rs]?|dancing|swim\w*|cardio|muscles?|marathon|cycling|surf\w*|martial|bouldering|hik(e|ing)|Fitnessstudio|Sport)\b/iu;
const STYLE =
  /\b(fashion\w*|style|stylish|outfits?|dress(es)?|wardrobe|model(ing|s)?|cosplay\w*|lingerie|shopping|thrift\w*|aesthetic|make-?up|nails|vintage|streetwear|Mode|Klamotten)\b/iu;
const COOKING = /\b(cook\w*|bak(e|es|er|ing)|chef|kitchen|recipes?|food|foodie|Küche|kochen|backen|Backstube)\b/iu;
const HOME = /\b(home|flat|apartment|room|house|plants?|cat|dog|pet|Wohnung|Zuhause)\b/iu;
/** A personality that starts or answers drama. Everyone else never gets a drama moment. */
export const SLURP_DRAMATIC =
  /\b(drama\w*|sassy|sass|petty|fiery|hot-?headed|temper\w*|confrontational|jealous|bratty|brat|feisty|outspoken|diva|messy|provocative|savage|shady|bitchy|zickig|frech)\b/iu;

/**
 * The pool. Ordinary first: most of life is ordinary. Lines say what happens, never how it is told.
 * Moments with `slot` are written around the Creator's own anchors; the rest are the shared pool.
 */
const POOL: readonly LifeMoment[] = [
  // Their own work, places, habits and people (the card decides what these are).
  {
    id: "work-long-day",
    doing: true,
    kind: "work",
    type: "sensory_mood",
    slot: "work",
    line: "Work on {a} runs long today, and you end the day completely wiped out.",
    topic: /\bwork\w*/iu,
  },
  {
    id: "work-bad-day",
    doing: true,
    kind: "work",
    type: "mishap",
    slot: "work",
    line: "Today everything about {a} goes wrong, one thing after another, and you need to let off a little steam.",
    topic: /\b(work\w*|complain\w*)/iu,
  },
  {
    id: "work-good-news",
    kind: "work",
    type: "achievement",
    slot: "work",
    line: "Something about {a} finally goes your way today.",
    topic: /\bwork\w*/iu,
  },
  {
    id: "habit-skipped",
    kind: "day",
    type: "routine_twist",
    slot: "habits",
    line: "Life got in the way of {a} today, and you feel a bit off without it.",
  },
  {
    id: "place-stuck",
    doing: true,
    kind: "day",
    type: "mishap",
    slot: "places",
    line: "You are stuck at {a} much longer than you planned.",
  },
  {
    id: "people-plans",
    kind: "social",
    type: "social_moment",
    slot: "people",
    line: "{a} cancels your plans at the last minute, so the evening is suddenly yours.",
  },
  {
    id: "people-checkin",
    kind: "social",
    type: "relationship_moment",
    slot: "people",
    line: "{a} checks in on you on a day you needed it.",
  },
  // The shared pool: things that happen to many people, each only where it fits.
  {
    id: "workout",
    doing: true,
    kind: "body",
    type: "achievement",
    needs: SPORT,
    line: "You get a proper workout in today, and you feel it.",
    topic: /\b(gym|work ?outs?|exercis\w*|sports?|training|fitness)\b/iu,
  },
  {
    id: "workout-sore",
    kind: "body",
    type: "sensory_mood",
    needs: SPORT,
    line: "You are sore from the last workout and every stair is a negotiation.",
    topic: /\b(gym|work ?outs?|exercis\w*|sports?|training|fitness)\b/iu,
  },
  {
    id: "tired",
    kind: "body",
    type: "sensory_mood",
    line: "You slept badly and you are running on almost nothing today.",
    topic: /\bsleep\w*/iu,
    weight: 0.7,
  },
  {
    id: "cold",
    doing: true,
    kind: "body",
    type: "mishap",
    line: "You caught a cold and you are stuck at home feeling a bit sorry for yourself.",
    topic: /\bsick\w*/iu,
    weight: 0.4,
  },
  {
    id: "bad-day",
    kind: "day",
    type: "mishap",
    line: "It is just a bad day: nothing big, one small thing after another.",
    topic: /\b(complain\w*|negativ\w*|whin\w*)/iu,
  },
  {
    id: "small-win",
    kind: "day",
    type: "achievement",
    line: "A small personal win today that nobody else would notice, and you are quietly proud of it.",
  },
  {
    id: "errands",
    doing: true,
    kind: "day",
    type: "routine_twist",
    line: "A whole day of boring errands, with one small good thing in the middle of it.",
    topic: /\berrands?\b/iu,
    weight: 0.8,
  },
  {
    id: "self-care",
    doing: true,
    kind: "body",
    type: "sensory_mood",
    line: "You take an evening just for yourself, phone mostly down.",
    topic: /\bself-?care\b/iu,
  },
  {
    id: "new-outfit",
    kind: "style",
    type: "showcase",
    needs: STYLE,
    line: "You got something new to wear and you try it out today.",
    topic: /\b(shopping|fashion|clothes|outfits?)\b/iu,
  },
  {
    id: "new-look",
    kind: "style",
    type: "tease_flirt",
    line: "You changed one small thing about your look and wait to see who notices.",
    topic: /\b(hair\w*|look)\b/iu,
    weight: 0.6,
  },
  {
    id: "cooking",
    doing: true,
    kind: "home",
    type: "showcase",
    needs: COOKING,
    line: "You cook something today, and it turns out better or worse than planned.",
    topic: /\b(cook\w*|kitchen)\b/iu,
  },
  {
    id: "home-reset",
    doing: true,
    kind: "home",
    type: "routine_twist",
    needs: HOME,
    line: "You finally tidy up the place, and it feels like a fresh start.",
    topic: /\b(clean\w*|tidy\w*)\b/iu,
    weight: 0.7,
  },
  {
    id: "going-quiet",
    kind: "day",
    type: "sensory_mood",
    line: "You have not felt like posting much lately; this one is short and low-key.",
    topic: /\bpost\w*/iu,
    weight: 0.5,
  },
  // No invented trend here: a real one is joined through `planSlurpTrendBeat` (docs/TRENDS.md).
  // Only when it really happened.
  {
    id: "back-after-quiet",
    kind: "day",
    type: "social_moment",
    signal: "quiet",
    line: "You have been quiet for a few days, and this is you coming back, no big announcement.",
  },
  {
    id: "milestone",
    kind: "platform",
    type: "achievement",
    signal: "milestone",
    line: "You just passed {n} followers on Slurp, and you mark it your way.",
  },
  {
    id: "viral",
    kind: "platform",
    type: "achievement",
    signal: "viral",
    line: "Your post {post} took off far beyond your usual crowd, and you react to it.",
  },
  {
    id: "fan-gift",
    kind: "social",
    type: "social_moment",
    signal: "gift",
    line: "A fan sent you a tip that made your day, and you thank them without naming anyone.",
  },
  {
    id: "comment-fight",
    kind: "platform",
    type: "opinion",
    signal: "comments",
    line: "Two people in the comments under one of your recent posts got into it, and you step in your own way.",
    topic: /\b(argu\w*|fight\w*|conflict)\b/iu,
  },
  // Drama: rare, and only for Creators who are like that.
  {
    id: "copycat",
    kind: "drama",
    type: "opinion",
    needs: SLURP_DRAMATIC,
    line: "Someone on Slurp is very clearly copying your style, and you have thoughts about it.",
    topic: /\bdrama\b/iu,
    weight: 0.5,
  },
  {
    id: "shade",
    kind: "drama",
    type: "opinion",
    needs: SLURP_DRAMATIC,
    line: "Another creator threw a little shade your way, and you answer in your own style.",
    topic: /\bdrama\b/iu,
    weight: 0.5,
  },
  {
    id: "misread",
    kind: "drama",
    type: "opinion",
    needs: SLURP_DRAMATIC,
    line: "People misread something you posted, and you set it straight.",
    topic: /\bdrama\b/iu,
    weight: 0.5,
  },
];

const SIGNAL_OF: Record<NonNullable<LifeMoment["signal"]>, (signals: SlurpLifeSignals) => boolean> = {
  quiet: (signals) => signals.quietDays >= 3,
  milestone: (signals) => signals.milestone !== null,
  viral: (signals) => signals.viral !== null,
  gift: (signals) => signals.gift,
  comments: (signals) => signals.busyComments,
};

/** What "fits" is judged on: the card text, and everything the anchors hold. */
function fitText(creator: SlurpLifeCreator): string {
  const { anchors } = creator;
  return [
    creator.text,
    ...anchors.people.map((person) => `${person.name} ${person.relation}`),
    ...anchors.places,
    ...anchors.work,
    ...anchors.objects,
    ...anchors.habits,
    ...anchors.runningJokes,
  ].join("\n");
}

/** The card's own "never" sentences. */
export function slurpNeverSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => SLURP_NEVER_PATTERN.test(sentence));
}

/**
 * Whether a life thing fits this Creator: what it needs is in their card or life, and no card
 * sentence rules it out. Shared by life moments and automatic storylines.
 */
export function slurpLifeFits(
  rule: { needs?: RegExp; topic?: RegExp },
  creator: { text: string; never: readonly string[] },
): boolean {
  if (rule.needs && !rule.needs.test(creator.text)) return false;
  return !rule.topic || !creator.never.some((sentence) => rule.topic!.test(sentence));
}

function anchorValues(anchors: SlurpCanonAnchors, kind: SlurpAnchorKind): string[] {
  return kind === "people" ? anchors.people.map((person) => person.name) : anchors[kind];
}

/** The life moments this Creator could have right now, before variety and the draw. */
export function slurpFittingLifeMoments(creator: SlurpLifeCreator, signals: SlurpLifeSignals): LifeMoment[] {
  const text = fitText(creator);
  const judged = { text, never: slurpNeverSentences(creator.text) };
  return POOL.filter(
    (moment) =>
      (!moment.slot || anchorValues(creator.anchors, moment.slot).length > 0) &&
      (!moment.signal || SIGNAL_OF[moment.signal](signals)) &&
      slurpLifeFits(moment, judged) &&
      !(creator.avoid ?? []).some(
        (topic) => moment.line.toLocaleLowerCase().includes(topic.toLocaleLowerCase()) || moment.topic?.test(topic),
      ),
  );
}

/** The key a used moment is stored under; a milestone or a viral post is used once for good. */
function lifeKey(moment: LifeMoment, signals: SlurpLifeSignals): string {
  if (moment.signal === "milestone") return `life:milestone:${signals.milestone}`;
  if (moment.signal === "viral") return `life:viral:${signals.viral?.id ?? ""}`;
  return `life:${moment.id}`;
}

/** Own life moments this recent are not repeated; the kind of the last one steps back. */
const RECENT_LIFE = 6;

/** The player's "Daily life" setting. */
export type SlurpLifeMomentRate = "rarely" | "sometimes" | "often";
/** Weight of "no life moment" against 1 for "life moment": about 1 in 7, 1 in 3, 1 in 2. */
const SKIP_WEIGHT: Record<SlurpLifeMomentRate, number> = { rarely: 6, sometimes: 2, often: 1 };

/**
 * Whether a moment can sit beside what the schedule (or the card's routine) has the Creator doing
 * now. That activity is the main beat: a moment that says they are doing something else (at the gym
 * while the schedule has them at work) would replace it, so it is dropped.
 */
function fitsActivity(moment: LifeMoment, anchors: SlurpCanonAnchors, activity: string | null): boolean {
  if (!activity || !moment.doing) return true;
  if (moment.slot) return anchorValues(anchors, moment.slot).some((value) => slurpAnchorFitsActivity(value, activity));
  return Boolean(moment.needs?.test(activity) || moment.topic?.test(activity));
}

/**
 * Whether this ordinary slot is a life moment, and which. About one ordinary post in three (the
 * "Daily life" setting: `rate`), more when something real just happened (a milestone, a post that
 * took off); never on a teaser slot. The schedule's current activity stays the main beat.
 *
 * `usedLife` is this Creator's used life keys, newest first (up to their last forty plans), so a
 * milestone or viral post is only posted about once. `history.sharedToday` counts every Creator's
 * moments today, so one moment reaches at most two Creators a day.
 */
export function slurpLifeBeat(
  creatorAccountId: string,
  sequence: number,
  creator: SlurpLifeCreator,
  signals: SlurpLifeSignals,
  history: Pick<SlurpBeatHistory, "recentAnchors" | "sharedToday">,
  usedLife: readonly string[],
  intents: readonly SlurpContentIntent[],
  /** What the schedule or the card's routine has them doing now (`SlurpDayMoment.current`). */
  activity: string | null = null,
  rate: SlurpLifeMomentRate = "sometimes",
): SlurpBeat | null {
  if (!intents.includes("casual")) return null;
  // A key is `life:<moment>` or `life:<moment>:<which>` (a milestone, a viral post).
  const idOf = (key: string) => key.split(":")[1] ?? "";
  const recent = new Set(usedLife.slice(0, RECENT_LIFE).map(idOf));
  const ever = new Set(usedLife);
  const lastKind = POOL.find((moment) => moment.id === idOf(usedLife[0] ?? ""))?.kind ?? null;
  const candidates = slurpFittingLifeMoments(creator, signals).filter((moment) => {
    const key = lifeKey(moment, signals);
    return (
      !recent.has(moment.id) &&
      !(moment.signal === "milestone" || moment.signal === "viral" ? ever.has(key) : false) &&
      (history.sharedToday?.[key] ?? 0) < SLURP_SHARED_IDEA_DAILY_CAP &&
      fitsActivity(moment, creator.anchors, activity) &&
      slurpBeatIntents(moment.type).some((intent) => intents.includes(intent))
    );
  });
  if (!candidates.length) return null;
  const real = candidates.some((moment) => moment.signal === "milestone" || moment.signal === "viral");
  const take = slurpWeightedPick("life", creatorAccountId, sequence, [
    { value: true, weight: real ? 8 : 1 },
    { value: false, weight: SKIP_WEIGHT[rate] },
  ]);
  if (!take) return null;
  const moment = slurpWeightedPick(
    "lifeMoment",
    creatorAccountId,
    sequence,
    candidates.map((entry) => ({
      value: entry,
      weight:
        (entry.weight ?? 1) *
        // Their own life first; something real that just happened comes before the pool, and a
        // milestone or a post that took off is what a real person posts about next.
        (entry.slot ? 1.5 : 1) *
        (entry.signal === "milestone" || entry.signal === "viral" ? 30 : entry.signal ? 3 : 1) *
        (entry.kind === lastKind ? 0.3 : 1),
    })),
  );
  // A moment about what they are doing now is about the anchor the activity is about.
  const values = (moment.slot ? anchorValues(creator.anchors, moment.slot) : []).filter(
    (value) => !activity || !moment.doing || slurpAnchorFitsActivity(value, activity),
  );
  const anchor = values.length
    ? slurpWeightedPick(
        "lifeAnchor",
        creatorAccountId,
        sequence,
        values.map((value, index) => ({
          value,
          weight: (values.length - index) * (history.recentAnchors.slice(0, 6).includes(value) ? 0.25 : 1),
        })),
      )
    : null;
  const person = moment.slot === "people" ? creator.anchors.people.find((entry) => entry.name === anchor) : undefined;
  const line = moment.line
    .replace("{a}", anchor ?? "")
    .replace("{n}", signals.milestone?.toLocaleString("en") ?? "")
    .replace("{post}", signals.viral ? `“${signals.viral.label}”` : "")
    .replace(/^\p{Ll}/u, (first) => first.toLocaleUpperCase());
  return {
    type: moment.type,
    anchorKind: "life",
    anchor: anchor ?? moment.id.replace(/-/gu, " "),
    line,
    cast: person ? [person.relation ? `${person.name} (${person.relation})` : person.name] : [],
    place: moment.slot === "places" ? anchor : null,
    sharedId: lifeKey(moment, signals),
    heatFloor: creator.anchors.heat.min,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Something from the last few days is still news; older is not. */
const SIGNAL_DAYS = 3;
/** Passed a milestone "recently": still within a few percent of it, so the post is not late. */
const MILESTONE_WINDOW = 1.15;
const VIRAL_MIN_LIKES = 20;
const VIRAL_FACTOR = 3;
const BUSY_REPLIES = 6;
const BUSY_REPLIERS = 3;

/**
 * The signals from what really happened: their posts (newest first) with likes and replies, the
 * follower count their profile shows, and when they were last tipped.
 */
export function slurpLifeSignalsFrom(input: {
  at: Date;
  posts: readonly {
    id: string;
    createdAt: string;
    access: string;
    title: string | null;
    content: string;
    likes: number;
    /** Reply authors, one entry per reply, the Creator's own left out. */
    repliers: readonly string[];
  }[];
  followers: number;
  milestoneReached: number | null;
  tipTimes: readonly string[];
}): SlurpLifeSignals {
  const now = input.at.getTime();
  const fresh = (value: string) => now - Date.parse(value) <= SIGNAL_DAYS * DAY_MS;
  const newest = input.posts[0] ? Date.parse(input.posts[0].createdAt) : Number.NaN;
  const likes = input.posts.map((post) => post.likes).sort((left, right) => left - right);
  const median = likes.length ? likes[Math.floor(likes.length / 2)]! : 0;
  // Public only: a paid post's subject stays behind its lock.
  const viral = input.posts.find(
    (post) =>
      fresh(post.createdAt) &&
      post.access === "public" &&
      post.likes >= Math.max(VIRAL_MIN_LIKES, VIRAL_FACTOR * median) &&
      input.posts.length >= 4,
  );
  const label = (post: { title: string | null; content: string }) => {
    const text = (post.title?.trim() || post.content).replace(/\s+/gu, " ").trim();
    const words = text.split(" ");
    return words.length > 8 ? `${words.slice(0, 8).join(" ")}…` : text;
  };
  const reached = input.milestoneReached;
  return {
    quietDays: Number.isFinite(newest) ? Math.max(0, Math.floor((now - newest) / DAY_MS)) : 0,
    milestone: reached !== null && reached >= 100 && input.followers < reached * MILESTONE_WINDOW ? reached : null,
    viral: viral ? { id: viral.id, label: label(viral) } : null,
    gift: input.tipTimes.some(fresh),
    busyComments: input.posts.some(
      (post) =>
        fresh(post.createdAt) && post.repliers.length >= BUSY_REPLIES && new Set(post.repliers).size >= BUSY_REPLIERS,
    ),
  };
}
