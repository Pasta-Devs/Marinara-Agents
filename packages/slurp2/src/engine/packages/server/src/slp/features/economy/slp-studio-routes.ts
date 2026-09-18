import { noodlerViewerPersonaSchema } from "@marinara-engine/shared";
import { createSlurpPopulationStorage } from "../audience/slp-audience-contract.js";
import { slurpPlatformScaleMultiplier } from "../../../services/slurp/slurp-scale.js";
import { readSlurpStudioSnapshot, writeSlurpStudioSnapshot } from "../../../services/slurp/slurp-studio-snapshot.js";
import {
  slurpCreatorReach,
  slurpPostImpressions,
  slurpPostLikeCount,
  slurpPostReplyCount,
  slurpPostUnlockCount,
} from "../../../services/slurp/slurp-reach.js";
import { slurpFollowerMilestone, slurpMilestonesCrossed } from "../../../services/slurp/slurp-milestones.js";
import { slurpGoalProgress } from "../../../services/slurp/slurp-goal.js";
import { slurpPayoutAllowance } from "../../../services/slurp/slurp-earnings.js";
import { isSlurpViewerActorAccount } from "../../base/settings/slp-settings.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../../base/host/slp-viewer-context.js";

export async function slpStudioRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { creatorBelongsToViewer, noodle, resolveViewerPersona } = deps;
  app.get("/noodler/studio", async (req, reply) => {
    const parsed = noodlerViewerPersonaSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });

    const accounts = await noodle.listNoodlerAccounts();
    const operated = accounts.filter((account) => creatorBelongsToViewer(account, viewer));
    const population = createSlurpPopulationStorage(app.db);
    const studioFunnel = await population.countFollowersForCreators(operated.map((account) => account.id));
    const studioScaleSettings = await noodle.getSettings();
    const studioScale = slurpPlatformScaleMultiplier(studioScaleSettings.platformScale);
    const at = new Date();
    const snapshot = await readSlurpStudioSnapshot(app.db, viewer.id);

    const postsByAccount = await noodle.listNoodlerPostsByAccounts(
      operated.map((account) => account.id),
      6,
    );
    const allPostIds = [...postsByAccount.values()].flat().map((post) => post.id);
    const interactions = allPostIds.length > 0 ? await noodle.listNoodlerInteractions(allPostIds) : [];
    const interactionsByPostId = new Map<string, typeof interactions>();
    for (const interaction of interactions) {
      const existing = interactionsByPostId.get(interaction.postId) ?? [];
      existing.push(interaction);
      interactionsByPostId.set(interaction.postId, existing);
    }

    const creators = await Promise.all(
      operated.map(async (account) => {
        const followers = slurpCreatorReach(
          {
            accountId: account.id,
            createdAt: account.createdAt,
            realFollowers: studioFunnel.get(account.id) ?? 0,
            scale: studioScale,
          },
          at,
          studioScaleSettings.simulationTuning.reach,
        );
        const earnings = await noodle.getEarnings(account.id);
        const goal = await noodle.getGoal(account.id);
        const previous = snapshot?.creators[account.id] ?? null;
        const posts = (postsByAccount.get(account.id) ?? []).map((post) => {
          const postInteractions = interactionsByPostId.get(post.id) ?? [];
          const input = { postId: post.id, createdAt: post.createdAt, creatorReach: followers, accountId: account.id };
          return {
            id: post.id,
            title: post.title,
            createdAt: post.createdAt,
            locked: post.access === "locked",
            hasImage: post.imageUrl !== null,
            reach: slurpPostImpressions(input, at),
            likeCount: slurpPostLikeCount(
              { ...input, realLikes: postInteractions.filter((item) => item.type === "like").length },
              at,
            ),
            replyCount: slurpPostReplyCount(
              { ...input, realReplies: postInteractions.filter((item) => item.type === "reply").length },
              at,
            ),
            unlockCount: post.access === "locked" ? slurpPostUnlockCount(input, at) : null,
          };
        });
        // The named cast: the payoff of the funnel. A name with no history is still wallpaper, so
        // each row carries what that person has actually done for this Creator.
        const cast = await Promise.all(
          (await population.listNamedCast(account.id, 8)).map(async (entry) => ({
            id: entry.tie.memberId,
            displayName:
              entry.member?.displayName ??
              (await noodle.getViewer(entry.tie.memberId).catch(() => null))?.displayName ??
              (await noodle.getNoodlerAccountById(entry.tie.memberId))?.displayName ??
              null,
            handle: entry.member?.handle ?? null,
            traits: entry.member?.traits ?? [],
            stage: entry.tie.stage,
            // The direction, not only the position. "Cooling" is a sentence about somebody; a
            // funnel stage on its own is a database row. The column existed and never reached the UI.
            audienceArc: entry.tie.audienceArc,
            spent: entry.tie.spent,
            interactions: entry.tie.interactions,
            firstSeenAt: entry.tie.firstSeenAt,
          })),
        );
        return {
          id: account.id,
          handle: account.handle,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          topFans: cast.filter((fan) => fan.displayName),
          followers,
          subscribers:
            (await noodle.listSubscriptionsForCreator(account.id)).length +
            ((await population.countSubscribersForCreators([account.id])).get(account.id) ?? 0),
          earnings,
          milestone: slurpFollowerMilestone(followers),
          goal: goal ? slurpGoalProgress(goal, earnings.lifetime) : null,
          payoutAllowance: slurpPayoutAllowance(earnings, at),
          // Null rather than zero on a first read: "no change yet" and "measured no change" are
          // different, and the client renders them differently.
          followersDelta:
            previous && (snapshot?.platformScale === undefined || snapshot.platformScale === studioScale)
              ? followers - previous.followers
              : null,
          earningsDelta: previous ? earnings.lifetime - previous.lifetimeEarnings : null,
          milestonesCrossed: previous ? slurpMilestonesCrossed(previous.followers, followers) : [],
          posts,
        };
      }),
    );

    // Passing a milestone is the most notable thing that can happen to a Creator, and it was
    // computed here, rendered here, and never reported anywhere. Record it so it reaches the
    // notification stream like every other event.
    for (const creator of creators) {
      for (const target of creator.milestonesCrossed) {
        await noodle.recordCreatorEvent(creator.id, "milestone", { amount: target });
      }
    }

    await writeSlurpStudioSnapshot(app.db, viewer.id, {
      at: at.toISOString(),
      platformScale: studioScale,
      creators: Object.fromEntries(
        creators.map((creator) => [
          creator.id,
          { followers: creator.followers, lifetimeEarnings: creator.earnings.lifetime },
        ]),
      ),
    });

    return { since: snapshot?.at ?? null, creators };
  });

  /**
   * Metrics for every Creator, for the Backstage Creators list.
   *
   * Read-only on purpose. `/noodler/studio` rewrites its snapshot on every read, so the Creator
   * home deltas would reset whenever Settings was opened. Likes and replies are the displayed
   * counts over the newest posts, the same numbers a post card shows.
   */
  app.get("/noodler/creator-metrics", async () => {
    const accounts = (await noodle.listNoodlerAccounts()).filter((account) => !isSlurpViewerActorAccount(account));
    const ids = accounts.map((account) => account.id);
    const settings = await noodle.getSettings();
    const scale = slurpPlatformScaleMultiplier(settings.platformScale);
    const population = createSlurpPopulationStorage(app.db);
    const [funnel, fanSubscribers, threads, postsByAccount] = await Promise.all([
      population.countFollowersForCreators(ids),
      population.countSubscribersForCreators(ids),
      deps.messages.listThreadsForCreators(ids).catch(() => []),
      // ponytail: newest 100 posts per Creator; add a count query if totals past that matter.
      noodle.listNoodlerPostsByAccounts(ids, 100),
    ]);
    const postIds = [...postsByAccount.values()].flat().map((post) => post.id);
    const interactions = postIds.length > 0 ? await noodle.listNoodlerInteractions(postIds) : [];
    const realCounts = new Map<string, { likes: number; replies: number }>();
    for (const interaction of interactions) {
      const entry = realCounts.get(interaction.postId) ?? { likes: 0, replies: 0 };
      if (interaction.type === "like") entry.likes += 1;
      if (interaction.type === "reply") entry.replies += 1;
      realCounts.set(interaction.postId, entry);
    }
    const at = new Date();
    const creators = await Promise.all(
      accounts.map(async (account) => {
        const followers = slurpCreatorReach(
          {
            accountId: account.id,
            createdAt: account.createdAt,
            realFollowers: funnel.get(account.id) ?? 0,
            scale,
          },
          at,
          settings.simulationTuning.reach,
        );
        let likes = 0;
        let replies = 0;
        for (const post of postsByAccount.get(account.id) ?? []) {
          const input = { postId: post.id, createdAt: post.createdAt, creatorReach: followers, accountId: account.id };
          const real = realCounts.get(post.id) ?? { likes: 0, replies: 0 };
          likes += slurpPostLikeCount({ ...input, realLikes: real.likes }, at);
          replies += slurpPostReplyCount({ ...input, realReplies: real.replies }, at);
        }
        const [postCount, subscriptions, earnings, arcs] = await Promise.all([
          noodle.countNoodlerPostsByAccount(account.id),
          noodle.listSubscriptionsForCreator(account.id),
          noodle.getEarnings(account.id),
          noodle.listActiveProjects(account.id).catch(() => []),
        ]);
        return {
          id: account.id,
          posts: postCount,
          followers,
          likes,
          replies,
          subscribers: subscriptions.length + (fanSubscribers.get(account.id) ?? 0),
          earnings: earnings.lifetime,
          unread: threads
            .filter((thread) => thread.creatorAccountId === account.id)
            .reduce((sum, thread) => sum + thread.creatorUnread, 0),
          arcs: arcs.length,
        };
      }),
    );
    return { creators };
  });
}
