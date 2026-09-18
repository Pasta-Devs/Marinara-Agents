import { resolvePersonaAccount } from "../../data/creators/slp-creator-accounts.js";
import type { NoodleAccount, NoodlerPostView, NoodlerManagedPost } from "@marinara-engine/shared";
import { projectNoodlerAudienceProfile } from "../../modules/creators/slp-disclosure.js";
import { isSlurpViewerActorAccount } from "../../modules/settings/slp-settings.js";
import { isNoodlerHiddenFromViewer, canViewNoodlerPost } from "../../base/identity/slp-access.js";
import { slurpGoalProgress } from "../../modules/projects/slp-goal.js";
import { NOODLER_SUBSCRIPTION_COST, noodlerUnlockPriceFromMetadata } from "../../modules/economy/slp-prices.js";
import { slurpPlatformScaleMultiplier } from "../../modules/audience/slp-scale.js";
import {
  slurpCreatorReach,
  slurpPostLikeCount,
  slurpPostReplyCount,
  slurpPostUnlockCount,
} from "../../modules/audience/slp-reach.js";
import { NOODLER_FAN_IDENTITY_PREFIX } from "../../modules/audience/slp-fan-identity-provider.js";
import { NOODLER_MEDIA_URL_PREFIX, noodlerPostMediaUrlForPersona } from "../../base/media/slp-media.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteHost } from "./slp-route-host.js";

/** Viewer projection: which persona is looking, what it may see, and how posts are priced for it. */
export function createSlpViewerContext(
  app: FastifyInstance,
  host: SlpRouteHost,
  countFollowersForCreators: (creatorAccountIds: readonly string[]) => Promise<Map<string, number>>,
) {
  const { characters, noodle } = host;
  async function resolveViewerPersona(personaId: string) {
    return noodle.getViewer(personaId);
  }

  async function resolveViewerIdentity(personaId: string) {
    const viewer = await resolveViewerPersona(personaId);
    if (!viewer) return null;
    // The persona's own Slurp profile is normally provisioned at bootstrap, but it can be
    // absent right after account deletion/cleanup — provision it here so interactions never
    // 404 for a still-live persona (review finding).
    const resolvedActor =
      (await noodle.getSlurpAccountForEntity("persona", personaId, "viewer")) ??
      (await resolvePersonaAccount(noodle, characters, personaId));
    const actor = resolvedActor?.kind === "persona" && resolvedActor.entityId === personaId ? resolvedActor : null;
    return { personaId, viewer, actor };
  }

  function creatorBelongsToViewer(
    account: Awaited<ReturnType<typeof noodle.getNoodlerAccountById>>,
    viewer: NoodleAccount,
  ) {
    return Boolean(account && account.sourceKind === "persona" && account.sourceEntityId === viewer.entityId);
  }

  async function buildViewerContext(viewer: NonNullable<Awaited<ReturnType<typeof resolveViewerPersona>>>) {
    const [accounts, profiles, subscriptions, unlocks] = await Promise.all([
      noodle.listNoodlerAccounts(),
      noodle.listNoodlerStageProfiles(),
      noodle.listSubscriptionsForViewer(viewer.id),
      noodle.listPostUnlocksForViewer(viewer.id),
    ]);
    const subscribedIds = new Set(subscriptions.map((item) => item.creatorAccountId));
    // A subscriber always follows: the Following feed and every `followed` flag read this one set.
    const followedIds = new Set([...(viewer.settings.social.followingAccountIds ?? []), ...subscribedIds]);
    const unlockedIds = new Set(unlocks.map((item) => item.postId));
    const profileById = new Map(profiles.map((profile) => [profile.id, projectNoodlerAudienceProfile(profile)]));
    const visibleAccounts = accounts.filter(
      (account) =>
        !isSlurpViewerActorAccount(account) &&
        (creatorBelongsToViewer(account, viewer) || !isNoodlerHiddenFromViewer(account, viewer.id)),
    );
    // A tip goal exists to give a fan a reason to tip, and it was only ever visible to the Creator
    // who set it. It belongs on the profile the fan is looking at.
    const goalByAccountId = new Map(
      await Promise.all(
        visibleAccounts.map(async (account) => {
          const goal = await noodle.getGoal(account.id);
          if (!goal) return [account.id, null] as const;
          const earnings = await noodle.getEarnings(account.id);
          return [account.id, slurpGoalProgress(goal, earnings.lifetime)] as const;
        }),
      ),
    );
    // Prices for the visible creators only, so a large roster costs one lookup per shown row.
    const subscriptionPrices = Object.fromEntries(
      await Promise.all(
        visibleAccounts.map(
          async (account) => [account.id, await noodle.getCreatorSubscriptionPrice(account.id)] as const,
        ),
      ),
    );
    return {
      viewer,
      visibleAccounts,
      goalByAccountId,
      subscriptionPrices,
      accountById: new Map(visibleAccounts.map((account) => [account.id, account])),
      profileById,
      subscribedIds,
      followedIds,
      unlockedIds,
    };
  }

  type ViewerContext = Awaited<ReturnType<typeof buildViewerContext>>;

  function buildViewerShell(context: ViewerContext) {
    return {
      viewer: context.viewer,
      creators: context.visibleAccounts.map((account) => ({
        profile: context.profileById.get(account.id)!,
        subscribed: context.subscribedIds.has(account.id),
        followed: context.followedIds.has(account.id),
        // The creator's own weekly price when it has set one, else the Slurp-wide default.
        subscriptionPrice: context.subscriptionPrices[account.id] ?? NOODLER_SUBSCRIPTION_COST,
        goal: context.goalByAccountId.get(account.id) ?? null,
        // Feed posts live in a separate keyset-paged query. Keeping this field preserves the
        // shared Engine contract for older consumers without hydrating any post history here.
        posts: [] as NoodlerPostView[],
      })),
    };
  }

  /**
   * The shared Engine view type has no price field, and adding one there would force an
   * engine.min bump for a presentation detail. The package widens it locally instead.
   */
  type NoodlerPricedPostView = NoodlerPostView & {
    unlockPrice: number | null;
    /** Social proof on the paywall. Null for a post the viewer can already read. */
    unlockCount: number | null;
    story: boolean;
    linkedPostId: string | null;
  };

  async function projectViewerPosts(
    context: ViewerContext,
    posts: NoodlerManagedPost[],
  ): Promise<Map<string, NoodlerPricedPostView>> {
    const viewablePostIds = new Set(
      posts
        .filter((post) => {
          const account = context.accountById.get(post.authorAccountId);
          return Boolean(
            account &&
            (creatorBelongsToViewer(account, context.viewer) ||
              canViewNoodlerPost({
                post,
                subscribed: context.subscribedIds.has(account.id),
                unlockedPostIds: context.unlockedIds,
              })),
          );
        })
        .map((post) => post.id),
    );
    const interactionsByPostId = new Map<string, NoodlerPostView["interactions"]>();
    const interactions = posts.length > 0 ? await noodle.listNoodlerInteractions(posts.map((post) => post.id)) : [];
    for (const interaction of interactions) {
      const existing = interactionsByPostId.get(interaction.postId) ?? [];
      existing.push(interaction);
      interactionsByPostId.set(interaction.postId, existing);
    }
    // One clock for the whole projection, so every post in a page is measured against the same
    // instant and two posts made together never disagree about how old they are.
    const projectedAt = new Date();
    const authorIds = [...new Set(posts.map((post) => post.authorAccountId))];
    const projectionFunnel = await countFollowersForCreators(authorIds);
    const projectionScaleSettings = await noodle.getSettings();
    const projectionScale = slurpPlatformScaleMultiplier(projectionScaleSettings.platformScale);
    const reachByAccountId = new Map(
      authorIds.map((accountId) => {
        const account = context.accountById.get(accountId);
        return [
          accountId,
          account
            ? slurpCreatorReach(
                {
                  accountId,
                  createdAt: account.createdAt,
                  realFollowers: projectionFunnel.get(accountId) ?? 0,
                  scale: projectionScale,
                },
                projectedAt,
                projectionScaleSettings.simulationTuning.reach,
              )
            : 0,
        ] as const;
      }),
    );
    return new Map(
      posts.map((post): [string, NoodlerPricedPostView] => {
        const locked = !viewablePostIds.has(post.id);
        const allInteractions = (interactionsByPostId.get(post.id) ?? []).filter(
          (interaction) => interaction.type !== "story_view",
        );
        const visibleInteractions = allInteractions.filter(
          (interaction) => !locked || !interaction.actorAccountId.startsWith(NOODLER_FAN_IDENTITY_PREFIX),
        );
        return [
          post.id,
          {
            id: post.id,
            authorAccountId: post.authorAccountId,
            access: post.access,
            locked,
            title: post.title,
            content: locked ? null : post.content,
            hasImage: post.imageUrl !== null,
            imageUrl:
              locked && !post.imageUrl?.startsWith(NOODLER_MEDIA_URL_PREFIX)
                ? null
                : noodlerPostMediaUrlForPersona(
                    post.imageUrl,
                    context.viewer.entityId,
                    locked ? "locked" : "original",
                    post.updatedAt,
                  ),
            imagePrompt: locked ? null : post.imagePrompt,
            metadata: locked ? null : post.metadata,
            // A locked post withholds its metadata, so the price travels as its own field. It is
            // The post's own price, which the unlock route charges when the wallet is enabled.
            unlockPrice: locked ? noodlerUnlockPriceFromMetadata(post.metadata) : null,
            story: post.metadata.noodlerPostType === "story",
            linkedPostId:
              post.metadata.noodlerPostType === "story" && typeof post.metadata.noodlerLinkedPostId === "string"
                ? post.metadata.noodlerLinkedPostId
                : null,
            createdAt: post.createdAt,
            interactions: locked ? [] : visibleInteractions,
            // Real interactions are never replaced: expanding the list still shows exactly the
            // accounts that acted. The counts add the silent crowd nobody can click.
            likeCount: slurpPostLikeCount(
              {
                postId: post.id,
                createdAt: post.createdAt,
                creatorReach: reachByAccountId.get(post.authorAccountId) ?? 0,
                accountId: post.authorAccountId,
                realLikes: allInteractions.filter((item) => item.type === "like").length,
              },
              projectedAt,
            ),
            replyCount: slurpPostReplyCount(
              {
                postId: post.id,
                createdAt: post.createdAt,
                creatorReach: reachByAccountId.get(post.authorAccountId) ?? 0,
                accountId: post.authorAccountId,
                realReplies: allInteractions.filter((item) => item.type === "reply").length,
              },
              projectedAt,
            ),
            unlockCount: locked
              ? slurpPostUnlockCount(
                  {
                    postId: post.id,
                    createdAt: post.createdAt,
                    creatorReach: reachByAccountId.get(post.authorAccountId) ?? 0,
                    accountId: post.authorAccountId,
                  },
                  projectedAt,
                )
              : null,
          },
        ];
      }),
    );
  }

  return {
    resolveViewerPersona,
    resolveViewerIdentity,
    creatorBelongsToViewer,
    buildViewerContext,
    buildViewerShell,
    projectViewerPosts,
  };
}

export type SlpViewerContext = ReturnType<typeof createSlpViewerContext>;

/** Everything a Slurp route module receives from the server entry. */
export type SlpRouteDeps = SlpRouteHost & SlpViewerContext;
