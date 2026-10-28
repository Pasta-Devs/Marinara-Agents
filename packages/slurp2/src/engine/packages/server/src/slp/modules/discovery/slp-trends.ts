/**
 * Trends (docs/TRENDS.md): something takes off, the right people join, it peaks, it tires, it dies.
 *
 * Pure. The feature layer reads the posts and the ties and stores the record; this decides what counts
 * as taking off, what stage a trend is in, who joins and what they are told. Nothing here calls a model.
 * The stage is computed from age, never stored, so a late tick cannot leave it wrong.
 */
import { slurpRotationHash } from "../feed/slp-post-variation.js";
import { SLURP_NEVER_PATTERN } from "../feed/slp-life-moments.js";
import { slurpSharedNiche, type SlurpTieCreator } from "../projects/slp-creator-ties.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SLURP_TREND_STAGE_HOURS = { rising: 36, peak: 72, tired: 120 } as const;
export const SLURP_TREND_MAX_LIVE = 3;
/** A trend ends its peak early once this share of the automatic Creators has joined. */
export const SLURP_TREND_PEAK_SHARE = 0.4;
/** Joins per day, as a share of the automatic Creators (at least one). */
export const SLURP_TREND_DAILY_SHARE = 0.15;
/** A Creator joins at most one trend in this time. */
export const SLURP_TREND_REST_MS = 3 * DAY_MS;
export const SLURP_TREND_KEEP_DEAD_MS = 7 * DAY_MS;
export const SLURP_TREND_LABEL_MAX = 60;
/** How many adopters give the starter a follow each. */
export const SLURP_TREND_FOLLOW_CAP = 20;
export const SLURP_TREND_MIN_SCORE = 30;
export const SLURP_TREND_MEDIAN_FACTOR = 3;
export const SLURP_TREND_MIN_POSTS = 4;
export const SLURP_TREND_ORIGIN_DAYS = 2;
/** What one thing on a post is worth. Player likes, unlocks and tips weigh most. */
export const SLURP_TREND_WEIGHT = { like: 1, reply: 1.5, playerLike: 4, unlock: 6, tip: 8 } as const;

export type SlurpTrendRole = "trendsetter" | "early" | "follower" | "contrarian" | "ignores";
export type SlurpTrendStage = "rising" | "peak" | "tired" | "dead";
export type SlurpTrendSource = "creator" | "player" | "stir" | "world";

export type SlurpTrend = {
  id: string;
  label: string;
  source: SlurpTrendSource;
  starterId: string | null;
  originPostId: string | null;
  /** World trends only: one sentence in the second person with exactly one `{a}`. */
  line: string | null;
  /** What the player says posts lean into (Stir); added to the line every Creator who joins gets. */
  lean: string | null;
  /** The origin was a spicy post. Adopters still use their own level and hard noes. */
  spicy: boolean;
  startedAt: string;
  adopters: { id: string; at: string; role: SlurpTrendRole; postId: string | null }[];
};

const ROLES: readonly SlurpTrendRole[] = ["trendsetter", "early", "follower", "contrarian", "ignores"];
const SOURCES: readonly SlurpTrendSource[] = ["creator", "player", "stir", "world"];

export const slurpTrendClean = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, max);

/** The stored document, repaired. Anything unreadable is dropped, never thrown. */
export function readSlurpTrends(raw: unknown): SlurpTrend[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.flatMap((entry): SlurpTrend[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = slurpTrendClean(item.id, 80);
    const label = slurpTrendClean(item.label, SLURP_TREND_LABEL_MAX);
    const startedAt = String(item.startedAt ?? "");
    if (!id || !label || !Number.isFinite(Date.parse(startedAt))) return [];
    const source = SOURCES.includes(item.source as SlurpTrendSource) ? (item.source as SlurpTrendSource) : "creator";
    const line = slurpTrendClean(item.line, 160);
    return [
      {
        id,
        label,
        source,
        starterId: slurpTrendClean(item.starterId, 80) || null,
        originPostId: slurpTrendClean(item.originPostId, 80) || null,
        line: line && line.split("{a}").length === 2 ? line : null,
        lean: slurpTrendClean(item.lean, 80) || null,
        spicy: item.spicy === true,
        startedAt,
        adopters: (Array.isArray(item.adopters) ? item.adopters : []).flatMap((adopter) => {
          const own = (adopter ?? {}) as Record<string, unknown>;
          const adopterId = slurpTrendClean(own.id, 80);
          const at = String(own.at ?? "");
          if (!adopterId || !Number.isFinite(Date.parse(at))) return [];
          const role = ROLES.includes(own.role as SlurpTrendRole) ? (own.role as SlurpTrendRole) : "follower";
          return [{ id: adopterId, at, role, postId: slurpTrendClean(own.postId, 80) || null }];
        }),
      },
    ];
  });
}

export function slurpTrendStage(trend: Pick<SlurpTrend, "startedAt">, at: Date): SlurpTrendStage {
  const hours = (at.getTime() - Date.parse(trend.startedAt)) / HOUR_MS;
  if (hours < SLURP_TREND_STAGE_HOURS.rising) return "rising";
  if (hours < SLURP_TREND_STAGE_HOURS.peak) return "peak";
  if (hours < SLURP_TREND_STAGE_HOURS.tired) return "tired";
  return "dead";
}

export const slurpLiveTrends = (trends: readonly SlurpTrend[], at: Date) =>
  trends.filter((trend) => slurpTrendStage(trend, at) !== "dead");

/** Dead trends go after a week; the newest are kept first. */
export function pruneSlurpTrends(trends: readonly SlurpTrend[], at: Date): SlurpTrend[] {
  return trends
    .filter(
      (trend) =>
        at.getTime() - Date.parse(trend.startedAt) < SLURP_TREND_STAGE_HOURS.tired * HOUR_MS + SLURP_TREND_KEEP_DEAD_MS,
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, 20);
}

/** Whether a new trend may start: fewer than three live, and the label is not already live. */
export function slurpTrendMayStart(trends: readonly SlurpTrend[], label: string, at: Date): boolean {
  const live = slurpLiveTrends(trends, at);
  return (
    live.length < SLURP_TREND_MAX_LIVE &&
    !live.some((trend) => trend.label.toLocaleLowerCase() === label.toLocaleLowerCase())
  );
}

/** A short public label from a post title: its first six words, no hash or quotes. */
export function slurpTrendLabel(title: string | null | undefined): string {
  const words = slurpTrendClean(title, 200)
    .replace(/[#"“”]/gu, "")
    .split(" ")
    .filter(Boolean);
  return words
    .slice(0, 6)
    .join(" ")
    .slice(0, SLURP_TREND_LABEL_MAX)
    .replace(/[.,;:!?…-]+$/u, "");
}

// ─── Taking off ─────────────────────────────────────────────────────────────────────────────────

export type SlurpTrendPost = {
  id: string;
  createdAt: string;
  access: string;
  title: string | null;
  likes: number;
  replies: number;
  /** Likes by the player's own persona. */
  playerLikes: number;
  unlocks: number;
  tips: number;
  spicy: boolean;
};

export const slurpTrendScore = (post: SlurpTrendPost) =>
  (post.likes - post.playerLikes) * SLURP_TREND_WEIGHT.like +
  post.replies * SLURP_TREND_WEIGHT.reply +
  post.playerLikes * SLURP_TREND_WEIGHT.playerLike +
  post.unlocks * SLURP_TREND_WEIGHT.unlock +
  post.tips * SLURP_TREND_WEIGHT.tip;

/**
 * The post of one Creator (newest first) that took off, or null: public, from the last two days, with
 * at least four posts of history, a label, and a score of at least thirty and three times their median.
 */
export function slurpTrendOrigin(posts: readonly SlurpTrendPost[], at: Date): SlurpTrendPost | null {
  if (posts.length < SLURP_TREND_MIN_POSTS) return null;
  const scores = posts.map(slurpTrendScore).sort((left, right) => left - right);
  const median = scores[Math.floor(scores.length / 2)]!;
  const bar = Math.max(SLURP_TREND_MIN_SCORE, SLURP_TREND_MEDIAN_FACTOR * median);
  return (
    posts
      .filter(
        (post) =>
          post.access === "public" &&
          at.getTime() - Date.parse(post.createdAt) <= SLURP_TREND_ORIGIN_DAYS * DAY_MS &&
          slurpTrendLabel(post.title) &&
          slurpTrendScore(post) >= bar,
      )
      .sort((left, right) => slurpTrendScore(right) - slurpTrendScore(left))[0] ?? null
  );
}

// ─── Roles and joining ──────────────────────────────────────────────────────────────────────────

/** The base mix, out of 100: trendsetter 8, early 20, follower 40, contrarian 12, ignores 20. */
const ROLE_CUTS: readonly [SlurpTrendRole, number][] = [
  ["trendsetter", 8],
  ["early", 28],
  ["follower", 68],
  ["contrarian", 80],
  ["ignores", 100],
];

/** A Creator's role is the same for every trend: it is who they are, not a roll. */
export function slurpTrendRole(creatorId: string): SlurpTrendRole {
  const roll = slurpRotationHash(`trend-role:${creatorId}`) % 100;
  return ROLE_CUTS.find(([, cut]) => roll < cut)![0];
}

/** The chance per planned post, by role and stage, before reach. */
export function slurpTrendBaseChance(role: SlurpTrendRole, stage: SlurpTrendStage, ageHours: number): number {
  if (stage === "dead" || role === "ignores") return 0;
  if (role === "trendsetter") return stage === "rising" ? 0.3 : 0;
  if (role === "early") return stage === "rising" ? 0.55 : stage === "peak" ? 0.2 : 0;
  if (role === "follower") {
    if (stage === "rising") return ageHours >= 18 ? 0.15 : 0;
    return stage === "peak" ? 0.35 : 0.1;
  }
  return stage === "rising" ? 0 : 0.3; // contrarian: after the crowd
}

/** x3 with a tie to the starter or an adopter, x2 with the starter's niche, x1 otherwise. */
export function slurpTrendReach(input: {
  creator: SlurpTieCreator;
  starter: SlurpTieCreator | null;
  tiedIds: ReadonlySet<string>;
  trend: SlurpTrend;
}): number {
  const { creator, starter, tiedIds, trend } = input;
  const circle = [trend.starterId, ...trend.adopters.map((adopter) => adopter.id)].filter(Boolean) as string[];
  if (circle.some((id) => tiedIds.has(id))) return 3;
  if (starter) {
    const niche = slurpSharedNiche(creator, starter);
    if (niche.tags.length || niche.interests.length) return 2;
  }
  return 1;
}

const STOP_WORDS = new Set(["the", "and", "for", "you", "your", "with", "that", "this", "are", "our"]);

/** A card or the player's steering that rules the trend out. Whole words, short ones too, no stop words. */
export function slurpTrendBlocked(text: string, avoid: readonly string[], label: string): boolean {
  const words = (value: string) => value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const wanted = words(label).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  if (!wanted.length) return false;
  const mentions = (value: string) => {
    const have = new Set(words(value));
    return wanted.some((word) => have.has(word));
  };
  if (avoid.some(mentions)) return true;
  return text.split(/(?<=[.!?])\s+|\n+/u).some((sentence) => SLURP_NEVER_PATTERN.test(sentence) && mentions(sentence));
}

export type SlurpTrendJoin = { trend: SlurpTrend; role: SlurpTrendRole; stage: SlurpTrendStage };

/**
 * The trend this Creator joins with this post, or null. The roll is seeded on the Creator, the trend
 * and the post count, so a retried slot repeats its choice. Caps: one trend per three days, a daily
 * limit on joins, and no more than 40% of the automatic Creators in all.
 */
export function slurpPickTrendJoin(input: {
  creator: SlurpTieCreator;
  sequence: number;
  trends: readonly SlurpTrend[];
  at: Date;
  automaticCount: number;
  creators: ReadonlyMap<string, SlurpTieCreator>;
  tiedIds: ReadonlySet<string>;
  avoid: readonly string[];
}): SlurpTrendJoin | null {
  const { creator, at } = input;
  const role = slurpTrendRole(creator.id);
  if (!creator.automatic || role === "ignores") return null;
  const joined = input.trends.flatMap((trend) => trend.adopters.filter((adopter) => adopter.id === creator.id));
  if (joined.some((adopter) => at.getTime() - Date.parse(adopter.at) < SLURP_TREND_REST_MS)) return null;
  const dailyLimit = Math.max(1, Math.ceil(SLURP_TREND_DAILY_SHARE * input.automaticCount));
  // The daily limit is for all trends together, not per trend.
  const joinedToday = input.trends
    .flatMap((trend) => trend.adopters)
    .filter((adopter) => at.getTime() - Date.parse(adopter.at) < DAY_MS).length;
  // The 40% is of everyone, across all live trends together.
  const peakLimit = Math.max(1, Math.floor(SLURP_TREND_PEAK_SHARE * input.automaticCount));
  const allJoined = new Set(
    slurpLiveTrends(input.trends, at).flatMap((trend) => trend.adopters.map((adopter) => adopter.id)),
  ).size;
  for (const trend of slurpLiveTrends(input.trends, at)) {
    if (
      (trend.starterId === creator.id && trend.originPostId) ||
      trend.adopters.some((adopter) => adopter.id === creator.id)
    )
      continue;
    const stage = slurpTrendStage(trend, at);
    if (joinedToday >= dailyLimit || allJoined >= peakLimit) continue;
    if (slurpTrendBlocked(creator.text, input.avoid, `${trend.label} ${trend.lean ?? ""}`)) continue;
    const ageHours = (at.getTime() - Date.parse(trend.startedAt)) / HOUR_MS;
    const reach = slurpTrendReach({
      creator,
      starter: trend.starterId ? (input.creators.get(trend.starterId) ?? null) : null,
      tiedIds: input.tiedIds,
      trend,
    });
    const chance = Math.min(0.9, slurpTrendBaseChance(role, stage, ageHours) * reach);
    const roll = (slurpRotationHash(`trend-join:${creator.id}:${trend.id}:${input.sequence}`) % 1000) / 1000;
    if (roll < chance) return { trend, role, stage };
  }
  return null;
}

/** What the post is told. A spicy origin says nothing about spice: the Creator's own level decides. */
export function slurpTrendLine(join: SlurpTrendJoin, starterName: string | null): string {
  const { trend, role, stage } = join;
  const lean = trend.lean ? ` Lean into: ${trend.lean}.` : "";
  if (trend.line) return trend.line + lean;
  const by = starterName ? `, started by ${starterName}` : "";
  const base = `A trend is going around Slurp: "${trend.label}"${by}.${lean}`;
  if (role === "contrarian")
    return `${base} You roast it, a bit late and in your own voice: poke at the trend, never at a person.`;
  if (role === "early" || role === "trendsetter")
    return `${base} You were one of the first to try it. Do your own take, in your own life.`;
  if (stage === "tired") return `${base} It is nearly over and you still do your own take, a little late.`;
  return `${base} Do your own take on it, in your own life, at your own comfort level.`;
}

/** One adopter recorded; the same Creator twice changes nothing. */
export function slurpAddAdopter(
  trends: readonly SlurpTrend[],
  trendId: string,
  adopter: SlurpTrend["adopters"][number],
): SlurpTrend[] {
  return trends.map((trend) =>
    trend.id === trendId && !trend.adopters.some((entry) => entry.id === adopter.id)
      ? { ...trend, adopters: [...trend.adopters, adopter] }
      : trend,
  );
}

/** The post a trend adoption quotes, read from the `slurpTrend` stamp in a post's metadata. */
export function slurpTrendQuoteOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const stamp = metadata?.slurpTrend;
  const id = stamp && typeof stamp === "object" ? (stamp as Record<string, unknown>).originPostId : null;
  return typeof id === "string" && id ? id : null;
}

/** The trend label a post carries in `metadata.slurpTrend`, for search. */
export function slurpTrendLabelOf(metadata: Record<string, unknown> | null | undefined): string {
  const stamp = metadata?.slurpTrend;
  const label = stamp && typeof stamp === "object" ? (stamp as Record<string, unknown>).label : "";
  return typeof label === "string" ? label : "";
}
