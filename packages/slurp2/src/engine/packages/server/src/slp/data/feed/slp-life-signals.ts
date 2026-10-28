/**
 * What really happened to a Creator lately, for life moments: their posts with likes and replies,
 * the follower count their profile shows, their tips, and the life moments they already posted.
 * Read-only. A failed read means no signals, never a failed post.
 */
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { slurpCreatorReach } from "../../../../../shared/src/slp/slp-reach.js";
import { slurpPlatformScaleMultiplier } from "../../../../../shared/src/slp/slp-scale.js";
import { slurpFollowerMilestone } from "../../modules/world/slp-milestones.js";
import {
  SLURP_NO_LIFE_SIGNALS,
  slurpLifeSignalsFrom,
  type SlurpLifeSignals,
} from "../../modules/feed/slp-life-moments.js";
import { createSlurpPopulationStorage } from "../audience/slp-audience-storage-funnel.js";
import { createSlurpStorage } from "../slp-storage.js";
import { listSlurpOpportunities } from "./slp-opportunity-storage.js";

export async function readSlurpLifeSignals(
  db: DB,
  account: Pick<SlpAccount, "id" | "createdAt">,
  at: Date,
): Promise<{ signals: SlurpLifeSignals; usedLife: string[] }> {
  try {
    const noodle = createSlurpStorage(db);
    const [posts, plans, funnel, settings, earnings] = await Promise.all([
      noodle.listNoodlerPostsByAccount(account.id, 20),
      listSlurpOpportunities(db, account.id, 40),
      createSlurpPopulationStorage(db).countFollowersForCreators([account.id]),
      noodle.getSettings(),
      noodle.getEarnings(account.id),
    ]);
    const interactions = posts.length ? await noodle.listNoodlerInteractions(posts.map((post) => post.id)) : [];
    const followers = slurpCreatorReach(
      {
        accountId: account.id,
        createdAt: account.createdAt,
        realFollowers: funnel.get(account.id) ?? 0,
        scale: slurpPlatformScaleMultiplier(settings.platformScale),
      },
      at,
      settings.simulationTuning.reach,
    );
    return {
      signals: slurpLifeSignalsFrom({
        at,
        posts: posts.map((post) => ({
          id: post.id,
          createdAt: post.createdAt,
          access: post.access,
          title: post.title,
          content: post.content,
          likes: interactions.filter((entry) => entry.postId === post.id && entry.type === "like").length,
          repliers: interactions
            .filter((entry) => entry.postId === post.id && entry.type === "reply")
            .map((entry) => entry.actorAccountId)
            .filter((actor) => actor !== account.id),
        })),
        followers,
        milestoneReached: slurpFollowerMilestone(followers).reached,
        tipTimes: earnings.ledger.filter((entry) => entry.kind === "tip").map((entry) => entry.at),
      }),
      usedLife: plans.flatMap((plan) => (plan.beat?.sharedId?.startsWith("life:") ? [plan.beat.sharedId] : [])),
    };
  } catch (error) {
    logger.warn(error, "[slurp] Could not read life signals; this post uses ordinary moments only");
    return { signals: SLURP_NO_LIFE_SIGNALS, usedLife: [] };
  }
}
