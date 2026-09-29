import { resolvePersonaAccount } from "../../data/creators/slp-creator-accounts.js";
import type {
  SlpAccount,
  SlpCreatorManagedPost,
  SlpCreatorPostView,
  SlpPostPartnership,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { projectCreatorAudienceProfile } from "../../modules/creators/slp-disclosure.js";
import { isSlurpViewerActorAccount } from "../../modules/settings/slp-settings.js";
import { canViewCreatorPost } from "../../base/identity/slp-access.js";
import { readSlurpTieStamp } from "../../modules/projects/slp-tie-stamp.js";
import { slurpGoalProgress } from "../../modules/projects/slp-goal.js";
import { SLP_CREATOR_SUBSCRIPTION_COST, slpCreatorUnlockPriceFromMetadata } from "../../modules/economy/slp-prices.js";
import { slurpPlatformScaleMultiplier } from "../../../../../shared/src/slp/slp-scale.js";
import {
  slurpCreatorReach,
  slurpPostLikeCount,
  slurpPostReplyCount,
  slurpPostUnlockCount,
} from "../../../../../shared/src/slp/slp-reach.js";
import { NOODLER_FAN_IDENTITY_PREFIX } from "../../modules/audience/slp-fan-identity-provider.js";
import {
  NOODLER_MEDIA_URL_PREFIX,
  slpCreatorPostMediaUrlForPersona,
  slpStoredMediaSize,
} from "../../base/media/slp-media.js";
import { slurpLockedPostTeaser } from "../../modules/feed/slp-post-purpose.js";
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
    viewer: SlpAccount,
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
    const profileById = new Map(profiles.map((profile) => [profile.id, projectCreatorAudienceProfile(profile)]));
    // Only accounts with a stage profile are Creators. A character fan in the audience (0.3.0) is an
    // account without one; listed here it reached the client as a Creator with no `profile`, and the
    // feed query threw on `creator.profile.id` ("Viewer access could not be loaded").
    const visibleAccounts = accounts.filter(
      (account) => !isSlurpViewerActorAccount(account) && profileById.has(account.id),
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
          async (account) => [account.id, await noodle.getCreatorSubscriptionCharge(account.id)] as const,
        ),
      ),
    );
    // The persona's fan account: likes, comments and votes on other Creators' posts are stored
    // under it, so the client needs it to recognise them as the player's own (R1-020).
    const fanActor = await noodle.getSlurpAccountForEntity("persona", viewer.entityId, "viewer").catch(() => null);
    return {
      viewer,
      viewerActorAccountId: fanActor?.id ?? null,
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
      viewerActorAccountId: context.viewerActorAccountId,
      creators: context.visibleAccounts.map((account) => ({
        profile: context.profileById.get(account.id)!,
        subscribed: context.subscribedIds.has(account.id),
        followed: context.followedIds.has(account.id),
        // The persona's own Creator, without exposing the source id the disclosure strips (R1-021).
        ownedByViewer: creatorBelongsToViewer(account, context.viewer),
        // The creator's own weekly price when it has set one, else the Slurp-wide default.
        subscriptionPrice: context.subscriptionPrices[account.id] ?? SLP_CREATOR_SUBSCRIPTION_COST,
        goal: context.goalByAccountId.get(account.id) ?? null,
        // Feed posts live in a separate keyset-paged query. Keeping this field preserves the
        // shared Engine contract for older consumers without hydrating any post history here.
        posts: [] as SlpCreatorPostView[],
      })),
    };
  }

  /**
   * The shared Engine view type has no price field, and adding one there would force an
   * engine.min bump for a presentation detail. The package widens it locally instead.
   */
  type SlpCreatorPricedPostView = SlpCreatorPostView & {
    unlockPrice: number | null;
    /** Social proof on the paywall. Null for a post the viewer can already read. */
    unlockCount: number | null;
    story: boolean;
    /** This persona has watched the Story (the shelf ring means "not watched yet", R1-024). */
    watched: boolean;
    linkedPostId: string | null;
    /** The line under the lock (see `slurpLockedPostTeaser`). Null for a post the viewer can read. */
    teaser: string | null;
  };

  async function projectViewerPosts(
    context: ViewerContext,
    posts: SlpCreatorManagedPost[],
  ): Promise<Map<string, SlpCreatorPricedPostView>> {
    const viewablePostIds = new Set(
      posts
        .filter((post) => {
          const account = context.accountById.get(post.authorAccountId);
          return Boolean(
            account &&
            (creatorBelongsToViewer(account, context.viewer) ||
              canViewCreatorPost({
                post,
                subscribed: context.subscribedIds.has(account.id),
                unlockedPostIds: context.unlockedIds,
              })),
          );
        })
        .map((post) => post.id),
    );
    const interactionsByPostId = new Map<string, SlpCreatorPostView["interactions"]>();
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
      posts.map((post): [string, SlpCreatorPricedPostView] => {
        const locked = !viewablePostIds.has(post.id);
        const allInteractions = (interactionsByPostId.get(post.id) ?? []).filter(
          (interaction) => interaction.type !== "story_view",
        );
        const visibleInteractions = allInteractions.filter(
          (interaction) => !locked || !interaction.actorAccountId.startsWith(NOODLER_FAN_IDENTITY_PREFIX),
        );
        const images = post.images.flatMap((image) => {
          if (locked && !image.imageUrl.startsWith(NOODLER_MEDIA_URL_PREFIX)) return [];
          // The primary picture's size from its file (V), so the frame is reserved in its ratio.
          const size =
            image.position === 0 && image.width === undefined
              ? slpStoredMediaSize(post.metadata.noodlerMediaPath)
              : null;
          return [
            {
              ...image,
              ...size,
              imageUrl: slpCreatorPostMediaUrlForPersona(
                image.imageUrl,
                context.viewer.entityId,
                locked ? "locked" : "original",
                post.updatedAt,
              ),
              imagePrompt: locked ? null : image.imagePrompt,
            },
          ];
        });
        return [
          post.id,
          {
            id: post.id,
            authorAccountId: post.authorAccountId,
            access: post.access,
            locked,
            title: post.title,
            content: locked ? null : post.content,
            hasImage: post.images.length > 0,
            imageUrl:
              locked && !post.imageUrl?.startsWith(NOODLER_MEDIA_URL_PREFIX)
                ? null
                : slpCreatorPostMediaUrlForPersona(
                    post.imageUrl,
                    context.viewer.entityId,
                    locked ? "locked" : "original",
                    post.updatedAt,
                  ),
            imagePrompt: locked ? null : post.imagePrompt,
            images,
            metadata: locked ? null : post.metadata,
            // A locked post withholds its metadata, so the price travels as its own field. It is
            // The post's own price, which the unlock route charges when the wallet is enabled.
            unlockPrice: locked ? slpCreatorUnlockPriceFromMetadata(post.metadata) : null,
            teaser: locked ? slurpLockedPostTeaser(post) : null,
            story: post.metadata.noodlerPostType === "story",
            watched: (interactionsByPostId.get(post.id) ?? []).some(
              (interaction) =>
                interaction.type === "story_view" && interaction.actorAccountId === context.viewerActorAccountId,
            ),
            partnership: slurpPostPartnership(post, (id) => context.accountById.get(id)),
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
                // Post likes only; a heart on a comment is not a like of the post (R1-030).
                realLikes: allInteractions.filter((item) => item.type === "like" && !item.parentInteractionId).length,
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

/**
 * The public label of a joint or sponsored post. A rivalry post and a "turned it down" post carry
 * none; a partner the viewer cannot see is left out.
 */
function slurpPostPartnership(
  post: { authorAccountId: string; metadata: Record<string, unknown> },
  account: (id: string) => { id: string; displayName: string; handle: string; avatarUrl?: string | null } | undefined,
): SlpPostPartnership | null {
  const stamp = readSlurpTieStamp(post.metadata);
  if (!stamp || stamp.declined || stamp.kind === "rival") return null;
  // A couple's own post carries no tag (U: couple = life); an old joint one (before U) and their shared
  // page's posts still do (7b-couples).
  if (stamp.kind === "couple" && !stamp.joint && !stamp.pageId) return null;
  const author = account(stamp.pageId && stamp.hostId ? stamp.hostId : post.authorAccountId);
  const host = author
    ? { id: author.id, name: author.displayName, handle: author.handle, avatarUrl: author.avatarUrl ?? null }
    : null;
  if (stamp.kind === "sponsor")
    return stamp.brand ? { host, withAccountId: null, withName: null, withHandle: null, brand: stamp.brand } : null;
  const couple = stamp.kind === "couple" ? { couple: true } : stamp.announce ? { announce: true } : {};
  // On the shared page the page is the author: the label names who wrote it ("by @mira").
  if (stamp.pageId)
    return host ? { host, withAccountId: null, withName: null, withHandle: null, brand: null, ...couple } : null;
  const partner = stamp.partnerId ? account(stamp.partnerId) : undefined;
  return partner
    ? {
        host,
        withAccountId: partner.id,
        withName: partner.displayName,
        withHandle: partner.handle,
        brand: null,
        ...couple,
      }
    : null;
}
