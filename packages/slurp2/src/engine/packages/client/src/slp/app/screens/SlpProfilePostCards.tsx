import { SlurpProfileMediaTile } from "./SlpScreenProfile";
import {
  BookmarkCheck,
  BookmarkPlus,
  ChevronDown,
  ChevronLeft,
  Clock3,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  errorMessage,
  isEmptyNoodlerPostDraft,
  isSlurpStory,
  linkedPostIdForStory,
  noodlerGoalOf,
  parsePrice,
  serializeNoodlerPostGuide,
  slurpSubscriptionPriceOf,
  toManagedPostCardModel,
  toNoodlePostCardModel,
  type NoodlerPostDraft,
  type NoodlerPostSubmission,
  type PendingNoodlerImage,
  NoodlerDraftImageFrame,
  SlurpAccessTransition,
  SlurpFeedSkeleton,
  EmptyState,
  NoodlerFrame,
  DisclosureBadge,
  NOODLER_FEED_WINDOW_SIZE,
  SourceAccountAvatar,
  LoadMoreFeedButton,
  SlurpMediaDialog,
  SlurpPostDialog,
} from "./SlpHomeHelpers";
import {
  Avatar,
  getNoodleAccentStyle,
  SLURP_TOGGLE_ACTIVE_CLASS,
  NoodleLogo,
  ProfileInitial,
  NOODLE_PINK,
} from "../../base/chrome/SlpChrome";
import { SlurpFanCard } from "../../modules/audience/SlpFanCard";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { SlurpCreatorPostCard } from "../../modules/post/SlpCreatorPostCard";
import type { StageProfileViewModel } from "./slp-profile-view-model";

/** The profile's post list: the tab the viewer picked, rendered from the screen's model. */
export function SlpProfilePostCards({ model }: { model: StageProfileViewModel }) {
  const {
    activeTab,
    emptyTabTitle,
    followersQuery,
    i18n,
    imagePosts,
    isError,
    isLoading,
    localizeUi,
    managedCreator,
    onRetry,
    onRetryViewer,
    onToggleSubscription,
    onUnlock,
    postCardCtx,
    profile,
    setOpenImagePostId,
    setRevealedManagedPostIds,
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
    visiblePosts,
  } = model;

  return (
    <>
      {activeTab === "subscribers" ? (
        <div>
          <div className="border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised,var(--background))] px-4 py-4 sm:px-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
              {localizeUi("ui.slurp.profile.managementData")}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.profile.managementDataDetail")}
            </p>
          </div>
          {subscribersQuery.isLoading ? (
            <div
              className="flex justify-center py-12"
              role="status"
              aria-label={localizeUi("ui.noodle.stageprofileview.loadingSubscribers")}
            >
              <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)]" />
            </div>
          ) : subscribersQuery.isError ? (
            <EmptyState
              title={localizeUi("ui.noodle.stageprofileview.subscribersCouldNotBeLoaded")}
              action={localizeUi("capabilities.actions.tryAgain")}
              onAction={() => void subscribersQuery.refetch()}
              icon={TriangleAlert}
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
            <EmptyState
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
            <div className="flex justify-center py-12" role="status">
              <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)]" />
            </div>
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
            <EmptyState title={localizeUi("ui.slurp.profile.followersEmpty")} />
          )}
        </div>
      ) : viewerIsLoading || isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-[var(--noodle-accent)]" />
        </div>
      ) : viewerIsError ? (
        <EmptyState
          title={localizeUi("ui.noodle.stageprofileview.viewerAccessCouldNotBeLoaded")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetryViewer}
          icon={TriangleAlert}
        />
      ) : isError ? (
        <EmptyState
          title={localizeUi("ui.noodle.stageprofileview.noodlerPostsCouldNotBeLoaded")}
          action={localizeUi("capabilities.actions.tryAgain")}
          onAction={onRetry}
          icon={TriangleAlert}
        />
      ) : activeTab === "media" ? (
        imagePosts.length > 0 ? (
          <div className="grid grid-cols-2 gap-px bg-[var(--noodle-divider)] @min-[620px]:grid-cols-3">
            {imagePosts.map((post) => (
              <SlurpProfileMediaTile key={post.id} post={post} onOpenImage={(_url, id) => setOpenImagePostId(id)} />
            ))}
          </div>
        ) : (
          <EmptyState title={emptyTabTitle} />
        )
      ) : visiblePosts.length > 0 ? (
        visiblePosts.map((item) => {
          const itemId = item.kind === "locked" || item.kind === "controller-locked" ? item.post.id : item.model.id;
          const locked = item.kind === "locked" || item.kind === "controller-locked";
          return (
            <SlurpAccessTransition key={itemId} postId={itemId} locked={locked}>
              {item.kind === "locked" || item.kind === "controller-locked" ? (
                <div className="p-3 @min-[680px]:px-0">
                  <LockedSlurpPostCard
                    post={item.post}
                    profile={profile}
                    subscriptionPrice={viewerCreator?.subscriptionPrice}
                    controllerOnly={item.kind === "controller-locked"}
                    subscribed={viewerCreator?.subscribed ?? false}
                    unlockPending={unlockPending}
                    subscriptionPending={subscriptionPending}
                    onUnlock={onUnlock}
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
                    imageGenerationPending={postCardCtx.generatingPostImageId === item.post.id}
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
                      className="min-h-11 shrink-0 px-2 text-xs font-bold text-[var(--noodle-accent)]"
                    >
                      {localizeUi("ui.noodle.stageprofileview.hide")}
                    </button>
                  </div>
                  <SlurpCreatorPostCard
                    surface="profile"
                    post={item.model}
                    ctx={{ ...postCardCtx, personaAccount: null, postManagement: managedCreator }}
                  />
                </div>
              ) : (
                <SlurpCreatorPostCard
                  surface="profile"
                  post={item.model}
                  ctx={{
                    ...postCardCtx,
                    personaAccount: viewerActorAccount,
                    postManagement: managedCreator,
                  }}
                />
              )}
            </SlurpAccessTransition>
          );
        })
      ) : (
        <EmptyState title={emptyTabTitle} />
      )}
    </>
  );
}
