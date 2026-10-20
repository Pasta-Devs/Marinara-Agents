/**
 * Trends (`docs/TRENDS.md`): finds a post that took off, starts trends from the four starters, and lets a
 * Creator join one when they plan an ordinary post. No model call of its own; any failure here costs the
 * trend, never the post or the world tick.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { newId } from "../../../utils/id-generator.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { mutateSlurpTrends, readSlurpTrendList } from "../../data/discovery/slp-trends-storage.js";
import { readSlurpTrendPosts } from "../../data/discovery/slp-trends-signals.js";
import { slurpCreatorReach } from "../../../../../shared/src/slp/slp-reach.js";
import { slurpPlatformScaleMultiplier } from "../../../../../shared/src/slp/slp-scale.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import { slurpBeatIntents, type SlurpBeat } from "../../modules/feed/slp-post-beat.js";
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import { SLP_TREND_LEAN_MAX as SLURP_TREND_LEAN_MAX } from "../../../../../shared/src/slp/slp-trend-actions.js";
import {
  slurpTrendClean,
  SLURP_TREND_FOLLOW_CAP,
  slurpAddAdopter,
  slurpLiveTrends,
  slurpPickTrendJoin,
  slurpTrendLabel,
  slurpTrendLine,
  slurpTrendMayStart,
  slurpTrendOrigin,
  slurpTrendScore,
  slurpTrendStage,
  type SlurpTrend,
  type SlurpTrendPost,
  type SlurpTrendSource,
} from "../../modules/discovery/slp-trends.js";
import { slurpIsCouplePage } from "../../modules/projects/slp-creator-couples.js";
import type { SlurpTieCreator } from "../../modules/projects/slp-creator-ties.js";

/** The world tick runs often; the posts are read at most this often. */
const SCAN_EVERY_MS = 30 * 60_000;
let lastScanAt = 0;

const isPlayerPersona = (account: { kind: string; sourceKind?: string | null }) =>
  account.kind === "persona" && account.sourceKind === "persona";

export type SlurpTrendStart = {
  label: string;
  source: SlurpTrendSource;
  starterId?: string | null;
  originPostId?: string | null;
  line?: string | null;
  spicy?: boolean;
  lean?: string | null;
};

/** Start a trend unless three are live or the label already runs. Returns it, or null. */
export async function startSlurpTrend(db: DB, input: SlurpTrendStart, at: Date): Promise<SlurpTrend | null> {
  const label = slurpTrendLabel(input.label);
  if (!label) return null;
  return mutateSlurpTrends(db, at, (trends) => {
    if (!slurpTrendMayStart(trends, label, at)) return null;
    const trend: SlurpTrend = {
      id: newId(),
      label,
      source: input.source,
      starterId: input.starterId ?? null,
      originPostId: input.originPostId ?? null,
      line: input.line ?? null,
      lean: slurpTrendClean(input.lean, SLURP_TREND_LEAN_MAX) || null,
      spicy: input.spicy === true,
      startedAt: at.toISOString(),
      adopters: [],
    };
    return { trends: [trend, ...trends], result: trend };
  });
}

/**
 * On the world tick: the best post that took off becomes a trend, at most one per scan. A Creator's
 * post and a player-run page's post are read the same way; only the starter's label differs.
 */
export async function advanceSlurpTrends(db: DB, at = new Date()): Promise<void> {
  if (at.getTime() - lastScanAt < SCAN_EVERY_MS) return;
  lastScanAt = at.getTime();
  try {
    const before = await readSlurpTrendList(db);
    if (!slurpTrendMayStart(before, "", at)) return;
    const accounts = (await createSlurpStorage(db).listNoodlerAccounts()).filter(
      (account) => account.kind !== "random_user",
    );
    const playerIds = new Set(accounts.filter(isPlayerPersona).map((account) => account.id));
    const [followers, settings] = await Promise.all([
      createSlurpPopulationStorage(db).countFollowersForCreators(accounts.map((account) => account.id)),
      createSlurpStorage(db).getSettings(),
    ]);
    const scale = slurpPlatformScaleMultiplier(settings.platformScale);
    const taken = new Set(before.map((trend) => trend.originPostId));
    let best: { account: (typeof accounts)[number]; post: SlurpTrendPost } | null = null;
    for (const account of accounts) {
      const origin = slurpTrendOrigin(
        await readSlurpTrendPosts(
          db,
          account.id,
          playerIds,
          at,
          slurpCreatorReach(
            {
              accountId: account.id,
              createdAt: account.createdAt,
              realFollowers: followers.get(account.id) ?? 0,
              scale,
            },
            at,
            settings.simulationTuning.reach,
          ),
        ),
        at,
      );
      if (!origin || taken.has(origin.id)) continue;
      if (!best || slurpTrendScore(origin) > slurpTrendScore(best.post)) best = { account, post: origin };
    }
    if (!best) return;
    await startSlurpTrend(
      db,
      {
        label: best.post.title ?? "",
        // The player's own page starts a "player" trend; a Creator Slurp writes for, a "creator" one.
        source: isPlayerPersona(best.account) ? "player" : "creator",
        starterId: best.account.id,
        originPostId: best.post.id,
        spicy: best.post.spicy,
      },
      at,
    );
  } catch (error) {
    logger.warn(error, "[slurp] Could not look for a trend; the world goes on");
  }
}

/** Every adopter brings the starter one new follower, up to a cap per trend. A failed follow costs nothing. */
async function followStarter(db: DB, trend: SlurpTrend, creatorId: string, at: Date): Promise<void> {
  if (!trend.starterId || trend.adopters.length >= SLURP_TREND_FOLLOW_CAP) return;
  try {
    const population = createSlurpPopulationStorage(db);
    const fan = await population.ensure(`trend:${trend.id}:${creatorId}`, at);
    await population.advanceTie(fan.id, trend.starterId, { stage: "follower", interactions: 1 });
  } catch (error) {
    logger.warn(error, "[slurp] Could not give a trend starter a follower");
  }
}

/** The ids this Creator has a live tie with: collabs, rivalries, bonds and couples. */
async function tiedIdsOf(db: DB, creatorId: string): Promise<Set<string>> {
  const { ties, bonds, couples } = await readSlurpCreatorTiesDocument(db);
  const ids = new Set<string>();
  const link = (a: string, b: string) => {
    if (a === creatorId) ids.add(b);
    if (b === creatorId) ids.add(a);
  };
  for (const collab of ties.collabs)
    if (collab.status !== "declined" && collab.status !== "blocked") link(collab.hostId, collab.partnerId);
  for (const rivalry of ties.rivalries) if (rivalry.stage !== "over") link(rivalry.fromId, rivalry.toId);
  for (const bond of bonds) if (!bond.endedAt) link(bond.aId, bond.bId);
  for (const couple of couples)
    if (couple.stage !== "split") for (const id of [couple.bId, ...(couple.moreIds ?? [])]) link(couple.aId, id);
  return ids;
}

/**
 * The trend this Creator joins with their next ordinary post, or null. Marks them an adopter unless
 * previewing. The origin post is quoted while it is still there.
 */
export async function planSlurpTrendBeat(
  db: DB,
  input: {
    creatorId: string;
    creatorText: string;
    tags: readonly string[];
    sequence: number;
    intents: readonly SlurpContentIntent[];
    avoid: readonly string[];
    at: Date;
    previewOnly?: boolean;
  },
): Promise<SlurpBeat | null> {
  try {
    const trends = await readSlurpTrendList(db);
    if (!slurpLiveTrends(trends, input.at).length) return null;
    const storage = createSlurpStorage(db);
    const accounts = await storage.listNoodlerAccounts();
    const creator: SlurpTieCreator = {
      id: input.creatorId,
      name: "",
      text: input.creatorText,
      tags: input.tags,
      automatic: true,
      followers: 0,
    };
    const tiedIds = await tiedIdsOf(db, input.creatorId);
    const starters = new Map<string, SlurpTieCreator>();
    for (const trend of slurpLiveTrends(trends, input.at)) {
      const starter = trend.starterId ? accounts.find((account) => account.id === trend.starterId) : null;
      if (starter)
        starters.set(starter.id, {
          id: starter.id,
          name: starter.displayName,
          text: starter.bio ?? "",
          tags: starter.settings.profile.tags ?? [],
          automatic: true,
          followers: 0,
        });
    }
    const pick = (current: SlurpTrend[]) =>
      slurpPickTrendJoin({
        creator,
        sequence: input.sequence,
        trends: current,
        at: input.at,
        automaticCount: accounts.filter((account) => account.kind !== "random_user" && !isPlayerPersona(account))
          .length,
        creators: starters,
        tiedIds,
        avoid: input.avoid,
      });
    const typeOf = (role: string) => (role === "contrarian" ? "opinion" : "audience_game");
    const fits = (role: string) => slurpBeatIntents(typeOf(role)).some((intent) => input.intents.includes(intent));
    // The pick and the adopter write are one serialized change, so two posts planned at once cannot both
    // take the last place under a quota. ponytail: the Creator counts as joined when planned, not when the
    // post is written; record it from the publish path (with the post id) if a failed post shows up.
    const join = input.previewOnly
      ? pick(trends)
      : await mutateSlurpTrends(db, input.at, (current) => {
          const picked = pick(current);
          if (!picked || !fits(picked.role)) return null;
          return {
            trends: slurpAddAdopter(current, picked.trend.id, {
              id: input.creatorId,
              at: input.at.toISOString(),
              role: picked.role,
              postId: null,
            }),
            result: picked,
          };
        });
    if (!join || !fits(join.role)) return null;
    // The follow is awarded after the write, and only while the starter has room for more.
    if (!input.previewOnly) await followStarter(db, join.trend, input.creatorId, input.at);
    const starterName = starters.get(join.trend.starterId ?? "")?.name ?? null;
    return {
      type: typeOf(join.role),
      anchorKind: "trend",
      anchor: join.trend.label,
      line: slurpTrendLine(join, starterName).replace("{a}", "something from your own life"),
      cast: [],
      place: null,
      trend: {
        id: join.trend.id,
        label: join.trend.label,
        originPostId: join.trend.originPostId,
        ...(join.trend.starterId ? { starterId: join.trend.starterId } : {}),
      },
    };
  } catch (error) {
    logger.warn(error, "[slurp] Could not plan a trend post; this one is ordinary");
    return null;
  }
}

export type SlurpTrendView = {
  id: string;
  label: string;
  stage: "rising" | "peak" | "tired";
  source: SlurpTrendSource;
  starter: { id: string; name: string; avatarUrl: string | null } | null;
  originPostId: string | null;
  lean: string | null;
  joined: number;
};

/** The live trends for Discover. */
export async function listSlurpTrendViews(db: DB, at = new Date()): Promise<SlurpTrendView[]> {
  const live = slurpLiveTrends(await readSlurpTrendList(db), at);
  const storage = createSlurpStorage(db);
  return Promise.all(
    live.map(async (trend) => {
      const starter = trend.starterId ? await storage.getNoodlerAccountById(trend.starterId) : null;
      return {
        id: trend.id,
        label: trend.label,
        stage: slurpTrendStage(trend, at) as SlurpTrendView["stage"],
        source: trend.source,
        starter: starter ? { id: starter.id, name: starter.displayName, avatarUrl: starter.avatarUrl ?? null } : null,
        originPostId: trend.originPostId,
        lean: trend.lean,
        joined: trend.adopters.length,
      };
    }),
  );
}

/** Take a started trend away again, while nobody has joined it. */
export async function undoSlurpTrend(db: DB, id: string, at = new Date()): Promise<boolean> {
  return Boolean(
    await mutateSlurpTrends(db, at, (trends) => {
      const trend = trends.find((entry) => entry.id === id);
      return trend && !trend.adopters.length
        ? { trends: trends.filter((entry) => entry.id !== id), result: true }
        : null;
    }),
  );
}

/** Set what a live trend leans into; returns the one before (null for none), or undefined when no such live trend. */
export async function steerSlurpTrend(
  db: DB,
  id: string,
  rawLean: string | null,
  at = new Date(),
): Promise<{ before: string | null } | undefined> {
  const lean = slurpTrendClean(rawLean, SLURP_TREND_LEAN_MAX) || null;
  const done = await mutateSlurpTrends(db, at, (trends) => {
    const trend = trends.find((entry) => entry.id === id);
    if (!trend || slurpTrendStage(trend, at) === "dead") return null;
    return {
      trends: trends.map((entry) => (entry.id === id ? { ...entry, lean } : entry)),
      result: { before: trend.lean },
    };
  });
  return done ?? undefined;
}

/** Who may start a trend: a Creator or a page of the player's, never a couple's shared page or a fan. */
export async function slurpMayStartTrend(db: DB, accountId: string): Promise<boolean> {
  const account = await createSlurpStorage(db).getNoodlerAccountById(accountId);
  return Boolean(account && account.kind !== "random_user" && !slurpIsCouplePage(account));
}
