import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlurpProfileMediaTile } from "./SlpScreenProfile";
import { useSlpDrawnCount } from "../../base/ui/slp-drawn-count";
import { Images, Loader2, PenLine, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useSlpStoryRings } from "../../modules/story/SlpStoryRing";
import { cn } from "../../../lib/utils";
import { isSlurpStory, SlurpAccessTransition, slurpSubscriptionPriceOf } from "./SlpHomeHelpers";
import { SlurpMomentShelfTile, SlurpMomentViewer } from "./SlpScreenMoments";
import { slpShowPostInPlace } from "../../modules/post/SlpPostPurposeNote";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SlurpFanCard } from "../../modules/audience/SlpFanCard";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { SlpLockedMediaTile } from "../../modules/post/SlpLockedMedia";
import { SlpPostCard } from "../../modules/post/SlpPostCard";
import { playSlpSpendMoment, SlpShimmer } from "../../modules/sparkle/SlpSparkle";
import type { StageProfileViewModel } from "./slp-profile-view-model";
import { useSlurpSettings } from "../../features/settings/slp-settings-hooks";
import { createSlpLightboxImage, SLP_CARD_STACK_CLASS } from "../../modules/post/SlpPostHelpers";

/** Stories younger than this still wear the ring on the profile's Story row. */
const STORY_LIVE_MS = 24 * 60 * 60 * 1000;

/** The profile's post list: the tab the viewer picked, rendered from the screen's model. */
export function SlpProfilePostCards({ model }: { model: StageProfileViewModel }) {
  const {
    activeTab,
    emptyTabTitle,
    followersQuery,
    followPending,
    i18n,
    isError,
    isLoading,
    localizeUi,
    lockedPosts,
    managedCreator,
    onRetry,
    onRetryViewer,
    onToggleFollow,
    onToggleSubscription,
    onUnlock,
    openComposer,
    postCardCtx,
    posts,
    profile,
    projectedPosts,
    showProfilePost,
    setOpenImagePostId,
    setRevealedManagedPostIds,
    storyMoments,
    subscriberTotal,
    subscribers,
    subscribersQuery,
    subscriptionPending,
    unlockPending,
    viewerAccount,
    viewerActorAccount,
    viewerCreator,
    viewerIsError,
    viewerIsLoading,
    viewingOwnCreator,
    visiblePosts,
  } = model;
  const drawnPostCount = useSlpDrawnCount(visiblePosts.length, `${profile.id}:${activeTab}`);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  // A ringed avatar asked for this Creator's Stories (the hero, or a tap elsewhere that led here).
  const { pending: pendingStories, taken: storiesTaken, startOf: storyStartOf } = useSlpStoryRings();
  useEffect(() => {
    if (!pendingStories || pendingStories !== profile.id) return;
    const start = storyStartOf?.(pendingStories);
    if (start && storyMoments.some((moment) => moment.post.id === start)) setActiveStoryId(start);
    // Taken either way: a Story that is not on this page any more must not open later by surprise.
    if (start ? storyMoments.length > 0 : true) storiesTaken?.();
  }, [pendingStories, profile.id, storyMoments, storyStartOf, storiesTaken]);
  // "Tap a preview to open the full post" (on by default); off, a tap shows the picture alone.
  const previewOpensPost = useSlurpSettings().data?.previewOpensPost !== false;
  const openPost = previewOpensPost ? showProfilePost : undefined;
  const activeStoryIndex = storyMoments.findIndex((moment) => moment.post.id === activeStoryId);
  const activeStory = storyMoments[activeStoryIndex] ?? null;
  // Media: every picture post in page order, open ones as pictures and locked ones as teasers.
  const mediaTiles = projectedPosts.flatMap((item) => {
    if (item.kind === "locked") {
      return !isSlurpStory(item.post) && typeof item.post.imageUrl === "string"
        ? [{ kind: "locked" as const, post: item.post }]
        : [];
    }
    if (item.kind === "card" || item.kind === "managed-reveal") {
      return !isSlurpStory(item.model) && typeof item.model.imageUrl === "string"
        ? [{ kind: "open" as const, post: { ...item.model, imageUrl: item.model.imageUrl } }]
        : [];
    }
    return [];
  });
  const showPaywall =
    activeTab === "posts" && !viewingOwnCreator && viewerCreator && !viewerCreator.subscribed && lockedPosts.length > 0;

  return (
    <>
      {activeTab === "subscribers" ? (
        <div>
          <div className="border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised,var(--background))] px-4 py-4 sm:px-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent-foreground)]">
              {localizeUi("ui.slurp.profile.managementData")}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.profile.managementDataDetail")}
            </p>
          </div>
          {subscribersQuery.isLoading ? (
            <SlpSkeleton label={localizeUi("ui.noodle.stageprofileview.loadingSubscribers")} />
          ) : subscribersQuery.isError ? (
            <SlpErrorState
              title={localizeUi("ui.noodle.stageprofileview.subscribersCouldNotBeLoaded")}
              onRetry={() => void subscribersQuery.refetch()}
            />
          ) : subscribers.length > 0 ? (
            <div>
              {subscribers.map((subscriber) => (
                <div
                  key={subscriber.id}
                  className="flex min-h-16 items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3"
                >
                  <Avatar account={subscriber} />
                  <div className="min-w-0 flex-1">
                    {subscriber.audience ? (
                      <SlurpFanCard memberId={subscriber.id} creatorAccountId={profile.id} className="block min-w-0">
                        <p className="truncate text-sm font-bold">{subscriber.displayName}</p>
                      </SlurpFanCard>
                    ) : (
                      <p className="truncate text-sm font-bold">{subscriber.displayName}</p>
                    )}
                    <p className="truncate text-xs text-[var(--muted-foreground)]">@{subscriber.handle}</p>
                  </div>
                  <time dateTime={subscriber.subscribedAt} className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {new Date(subscriber.subscribedAt).toLocaleDateString(i18n.language)}
                  </time>
                </div>
              ))}
              {subscribersQuery.hasNextPage && (
                <div className="flex justify-center p-4">
                  <button
                    type="button"
                    onClick={() => void subscribersQuery.fetchNextPage()}
                    disabled={subscribersQuery.isFetchingNextPage}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-4 text-sm font-bold hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    {subscribersQuery.isFetchingNextPage && <Loader2 size={14} className="animate-spin" />}
                    {localizeUi("ui.noodle.noodlehome.loadMore", {
                      visible: subscribers.length,
                      total: subscriberTotal,
                    })}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <SlpEmptyState
              title={localizeUi("ui.noodle.stageprofileview.noSubscribersYet")}
              detail={localizeUi("ui.noodle.stageprofileview.subscribersEmptyDetail")}
            />
          )}
        </div>
      ) : activeTab === "followers" ? (
        <div>
          {/* Followers were a number everywhere and a list nowhere. The funnel held the people all
            along; the named cast is capped, so the rest stays the count in the header. */}
          {followersQuery.isLoading ? (
            <SlpSkeleton />
          ) : followersQuery.isError && !followersQuery.data ? (
            <SlpErrorState
              title={localizeUi("ui.slurp.profile.followersCouldNotBeLoaded", {
                defaultValue: "Followers could not be loaded",
              })}
              onRetry={() => void followersQuery.refetch()}
            />
          ) : (followersQuery.data?.items.length ?? 0) > 0 ? (
            <div>
              {followersQuery.data!.items.map((follower) => (
                <div
                  key={follower.id}
                  className="flex min-h-16 items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3"
                >
                  <Avatar account={follower} />
                  <div className="min-w-0 flex-1">
                    <SlurpFanCard memberId={follower.id} creatorAccountId={profile.id} className="block min-w-0">
                      <p className="truncate text-sm font-bold">{follower.displayName}</p>
                    </SlurpFanCard>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {[
                        `@${follower.handle}`,
                        localizeUi(`ui.slurp.studio.stage.${follower.stage}`, { defaultValue: follower.stage }),
                        ...follower.traits,
                      ].join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
              <p className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.profile.followersRemainder", {
                  count: Math.max(0, (followersQuery.data?.total ?? 0) - followersQuery.data!.items.length),
                })}
              </p>
            </div>
          ) : (
            <SlpEmptyState title={localizeUi("ui.slurp.profile.followersEmpty")} />
          )}
        </div>
      ) : viewerIsLoading || isLoading ? (
        <SlpSkeleton shape={activeTab === "media" ? "grid" : "posts"} />
      ) : viewerIsError ? (
        <SlpErrorState
          title={localizeUi("ui.noodle.stageprofileview.viewerAccessCouldNotBeLoaded")}
          onRetry={onRetryViewer}
        />
      ) : isError ? (
        <SlpErrorState
          title={localizeUi("ui.noodle.stageprofileview.noodlerPostsCouldNotBeLoaded")}
          onRetry={onRetry}
        />
      ) : activeTab === "media" ? (
        mediaTiles.length > 0 ? (
          // 3 columns, hairline gaps, no ⋯ on tiles; locked pictures sell the subscription as teasers.
          <div className="mt-3 grid grid-cols-3 gap-0.5 overflow-hidden @min-[680px]:rounded-xl">
            {mediaTiles.map((tile) =>
              tile.kind === "open" ? (
                <SlurpProfileMediaTile
                  key={tile.post.id}
                  post={tile.post}
                  withMenu={false}
                  onOpenImage={(url, id) =>
                    previewOpensPost || !postCardCtx.setImageLightbox
                      ? setOpenImagePostId(id)
                      : postCardCtx.setImageLightbox(createSlpLightboxImage(id, url))
                  }
                />
              ) : (
                <SlpLockedMediaTile
                  key={tile.post.id}
                  imageUrl={tile.post.imageUrl ?? null}
                  unlockPrice={(tile.post as { unlockPrice?: number }).unlockPrice ?? null}
                  label={localizeUi("ui.slurp.profile.openLockedPost", { defaultValue: "Open locked post" })}
                  onOpen={() => showProfilePost(tile.post.id)}
                />
              ),
            )}
          </div>
        ) : (
          <SlpEmptyState title={emptyTabTitle} icon={Images} />
        )
      ) : activeTab === "stories" ? (
        storyMoments.length > 0 ? (
          // A highlights row: the Creator's Stories as tall tiles, played in the Story viewer.
          <div className="flex snap-x gap-2.5 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @min-[680px]:px-0">
            {storyMoments.map((moment) => (
              <SlurpMomentShelfTile
                key={moment.post.id}
                moment={moment}
                isNew={Date.now() - Date.parse(moment.post.createdAt) < STORY_LIVE_MS}
                onOpen={() => setActiveStoryId(moment.post.id)}
              />
            ))}
          </div>
        ) : (
          <SlpEmptyState
            title={emptyTabTitle}
            action={viewingOwnCreator ? localizeUi("ui.slurp.moments.add", { defaultValue: "Add Story" }) : undefined}
            onAction={() => openComposer("story")}
          />
        )
      ) : visiblePosts.length > 0 ? (
        // Raised cards with the shared gap, like the feed (locked posts were already cards here).
        <div className={cn(SLP_CARD_STACK_CLASS, "px-3 pt-4 @min-[680px]:px-0")}>
          {showPaywall && <SlpPaywallCard model={model} />}
          {visiblePosts.slice(0, drawnPostCount).map((item) => {
            const itemId = item.kind === "locked" || item.kind === "controller-locked" ? item.post.id : item.model.id;
            const locked = item.kind === "locked" || item.kind === "controller-locked";
            return (
              <SlurpAccessTransition
                key={itemId}
                postId={itemId}
                locked={locked}
                menuOpen={postCardCtx.postMenuId === itemId}
              >
                {item.kind === "locked" || item.kind === "controller-locked" ? (
                  <div>
                    <LockedSlurpPostCard
                      post={item.post}
                      profile={profile}
                      subscriptionPrice={viewerCreator?.subscriptionPrice}
                      postMenuOpen={postCardCtx.postMenuId === itemId}
                      setPostMenuOpen={(open) => postCardCtx.setPostMenuId(open ? itemId : null)}
                      controllerOnly={item.kind === "controller-locked"}
                      subscribed={viewerCreator?.subscribed ?? false}
                      unlockPending={unlockPending}
                      subscriptionPending={subscriptionPending}
                      onUnlock={onUnlock}
                      onGambleUnlock={postCardCtx.gambleUnlockPost}
                      unlockOffer={postCardCtx.unlockOffer}
                      subscriptionOffer={postCardCtx.subscriptionOffer}
                      onToggleSubscription={onToggleSubscription}
                      onManage={() => {
                        setRevealedManagedPostIds((current) => {
                          const next = new Set(current);
                          next.add(item.post.id);
                          return next;
                        });
                      }}
                      onGenerateImage={
                        item.post.imagePrompt
                          ? () =>
                              postCardCtx.generatePostImage?.({
                                id: item.post.id,
                                authorAccountId: item.post.authorAccountId,
                              })
                          : undefined
                      }
                      imageGenerationPending={postCardCtx.generatingPostImageIds?.includes(item.post.id) === true}
                    />
                  </div>
                ) : item.kind === "managed-reveal" ? (
                  <div>
                    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/5 px-4">
                      <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.noodle.stageprofileview.controllerViewHiddenFrom")}{" "}
                        {viewerAccount?.displayName ?? localizeUi("ui.noodle.stageprofileview.thisViewer")}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedManagedPostIds((current) => {
                            const next = new Set(current);
                            next.delete(item.model.id);
                            return next;
                          })
                        }
                        className="min-h-11 shrink-0 px-2 text-xs font-bold text-[var(--noodle-accent-foreground)]"
                      >
                        {localizeUi("ui.noodle.stageprofileview.hide")}
                      </button>
                    </div>
                    <SlpPostCard
                      surface="profile"
                      post={item.model}
                      ctx={{ ...postCardCtx, personaAccount: null, postManagement: managedCreator, openPost }}
                    />
                  </div>
                ) : (
                  <SlpPostCard
                    surface="profile"
                    post={item.model}
                    ctx={{
                      ...postCardCtx,
                      personaAccount: viewerActorAccount,
                      postManagement: managedCreator,
                      openPost,
                    }}
                  />
                )}
              </SlurpAccessTransition>
            );
          })}
          {drawnPostCount < visiblePosts.length && <SlpSkeleton shape="posts" count={1} />}
        </div>
      ) : activeTab === "posts" && posts.length === 0 ? (
        // Nobody has posted here yet: say who, and offer the one useful next step.
        viewingOwnCreator ? (
          <SlpEmptyState
            icon={PenLine}
            title={localizeUi("ui.slurp.profile.ownEmptyTitle", { defaultValue: "Your page is ready" })}
            detail={localizeUi("ui.slurp.profile.ownEmptyDetail", {
              defaultValue: "Post something and your followers see it in their feed.",
            })}
            action={localizeUi("ui.slurp.profile.createFirstPost", { defaultValue: "Create your first post" })}
            onAction={() => openComposer("post")}
          />
        ) : (
          <SlpEmptyState
            icon={UserPlus}
            title={localizeUi("ui.slurp.profile.emptyTitle", {
              defaultValue: "{{name}} hasn't posted yet",
              name: profile.displayName,
            })}
            detail={
              viewerCreator?.followed
                ? localizeUi("ui.slurp.profile.emptyFollowing", {
                    defaultValue: "You follow this page, so the first post shows up in your feed.",
                  })
                : localizeUi("ui.slurp.profile.emptyDetail", {
                    defaultValue: "Follow to see the first post in your feed.",
                  })
            }
            action={
              viewerCreator && !viewerCreator.followed && !viewerCreator.subscribed
                ? localizeUi("ui.slurp.profile.follow")
                : undefined
            }
            onAction={() => !followPending && onToggleFollow(profile.id, false)}
          />
        )
      ) : (
        <SlpEmptyState title={emptyTabTitle} />
      )}
      {activeStory && (
        <SlurpMomentViewer
          key={activeStory.post.id}
          moment={activeStory}
          personaId={viewerAccount?.entityId ?? null}
          isOwner={viewingOwnCreator}
          index={activeStoryIndex}
          total={storyMoments.length}
          unlockPending={unlockPending}
          subscriptionPending={subscriptionPending}
          onClose={() => setActiveStoryId(null)}
          onPrevious={
            activeStoryIndex > 0 ? () => setActiveStoryId(storyMoments[activeStoryIndex - 1]!.post.id) : undefined
          }
          onNext={
            activeStoryIndex < storyMoments.length - 1
              ? () => setActiveStoryId(storyMoments[activeStoryIndex + 1]!.post.id)
              : undefined
          }
          onUnlock={onUnlock}
          onToggleSubscription={onToggleSubscription}
          onOpenProfile={postCardCtx.openAuthorProfile}
          onOpenPost={(postId) => {
            setActiveStoryId(null);
            window.setTimeout(() => slpShowPostInPlace(postId), 80);
          }}
          ctx={postCardCtx}
        />
      )}
    </>
  );
}

/**
 * What a subscription opens, before the first locked card (03 §6): blurred thumbnails under the
 * Sparkle Veil in a hero-gradient frame, the count, and Subscribe with its weekly price.
 */
function SlpPaywallCard({ model }: { model: StageProfileViewModel }) {
  const { localizeUi, lockedPosts, lockedTeasers, onToggleSubscription, profile, subscriptionPending, viewerCreator } =
    model;
  if (!viewerCreator) return null;
  const thumbs = [0, 1, 2].map((index) => lockedTeasers[index] ?? null);
  return (
    <section
      data-slurp-paywall
      className="rounded-2xl bg-[image:var(--slurp-hero)] p-[1.5px] shadow-[0_18px_40px_-26px_var(--noodle-accent)]"
    >
      <div className="overflow-hidden rounded-[14.5px] bg-[var(--slurp-surface-raised)] p-3">
        <div className="relative grid grid-cols-3 gap-1.5">
          {/* Ambient sparkle over the pictures only, never over the text below. */}
          <span className="pointer-events-none absolute inset-0 isolate z-[5] mix-blend-screen" aria-hidden="true">
            <SlpShimmer />
          </span>
          {thumbs.map((teaser, index) => (
            <SlpLockedMediaTile
              key={teaser?.id ?? `empty-${index}`}
              imageUrl={teaser?.imageUrl ?? null}
              label=""
              className="rounded-xl"
            />
          ))}
        </div>
        <p className="mt-3 text-[15px] font-bold leading-5">
          {localizeUi("ui.slurp.profile.paywallTitle", {
            count: lockedPosts.length,
            defaultValue: "{{count}} posts for subscribers",
          })}
        </p>
        <p className="mt-0.5 text-xs leading-4 text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.profile.paywallDetail", {
            count: lockedTeasers.length,
            defaultValue: "{{count}} photos inside · new ones every week",
          })}
        </p>
        <SlpButton
          disabled={subscriptionPending}
          className="mt-3 w-full"
          onClick={(event) => {
            const origin = event.currentTarget.getBoundingClientRect();
            void Promise.resolve(onToggleSubscription(profile.id, false)).then(
              () => playSlpSpendMoment(origin),
              () => undefined,
            );
          }}
        >
          <SlurpCoinBurst active={subscriptionPending} />
          {localizeUi("ui.slurp.profile.subscribe")}
          <span aria-hidden="true">·</span>
          <SlurpCoinAmount
            amount={slurpSubscriptionPriceOf(viewerCreator)}
            suffix={localizeUi("ui.slurp.unlocksheet.perWeek", { defaultValue: "/ week" })}
          />
        </SlpButton>
      </div>
    </section>
  );
}
