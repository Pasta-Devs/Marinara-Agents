import { NoodlerPostComposer } from "./SlpScreenComposer";
import { useStageProfileViewModel, type StageProfileViewProps } from "./slp-profile-view-model";
import { SlpProfileModals } from "./SlpProfileModals";
import { SlpProfilePostCards } from "./SlpProfilePostCards";
import { SlpProfileLeadingActions } from "./SlpProfileLeadingActions";
import { ChevronDown, ChevronLeft, Sparkles } from "lucide-react";
import { Fragment } from "react";
import type { NoodlerPostView, NoodlerStageProfile } from "@marinara-engine/shared";
import type { SlurpPromotion } from "../../features/ads/slp-ads-contract";
import { toast } from "sonner";
import { type NoodlePostCardModel } from "../../modules/post/SlpPostCard";
import { SlurpArcTimelineCard } from "../../features/projects/SlpArcTimelineCard";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { SlurpProfileSurface } from "../../features/creators/SlpProfileSurface";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpInlineAdTile } from "../../features/ads/SlpInlineAd";
import { SlurpDiscoveryProfileEditor } from "../../features/discovery/SlpDiscoveryProfileEditor";
import {
  appendAudienceStance,
  AudienceStancePresets,
  profileAccent,
} from "../../features/creators/SlpStageProfileForm";
import { cn } from "../../../lib/utils";
import {
  errorMessage,
  isSlurpStory,
  toNoodlePostCardModel,
  DisclosureBadge,
  LoadMoreFeedButton,
  SlurpPostDialog,
} from "./SlpHomeHelpers";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export type SlurpProfileImagePost = NoodlePostCardModel & { imageUrl: string };

type NoodlerComposerTool = "image" | "poll" | "media" | "access";

export type NoodlerProfileTab = "posts" | "media" | "stories" | "subscribers" | "followers";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function SlurpProfileFeaturedImage({
  post,
  onOpenImage,
}: {
  post: SlurpProfileImagePost;
  onOpenImage: (url: string, id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { src: source, observe } = useNearViewportSlurpMediaSrc(post.imageUrl, { width: 960 });
  return (
    <button
      ref={observe}
      type="button"
      onClick={() => source && onOpenImage(source, post.id)}
      disabled={!source}
      className="block w-full overflow-hidden rounded-lg text-left ring-1 ring-inset ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
      aria-label={post.title || localizeUi("ui.slurp.post.openFeaturedImage")}
    >
      {source ? (
        <img
          src={source}
          alt={post.title || ""}
          loading="lazy"
          decoding="async"
          className="block aspect-[16/8] w-full object-cover"
        />
      ) : (
        <span className="block aspect-[16/8] w-full animate-pulse bg-[var(--muted)] motion-reduce:animate-none" />
      )}
    </button>
  );
}

export function SlurpProfileMediaTile({
  post,
  onOpenImage,
}: {
  post: SlurpProfileImagePost;
  onOpenImage: (url: string, id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { src: source, observe } = useNearViewportSlurpMediaSrc(post.imageUrl, { width: 480 });
  return (
    <button
      ref={observe}
      type="button"
      onClick={() => source && onOpenImage(source, post.id)}
      disabled={!source}
      className="relative aspect-square overflow-hidden bg-[var(--background)] text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] disabled:cursor-wait"
      aria-label={post.title || localizeUi("ui.slurp.post.openImage")}
    >
      {source ? (
        <img
          src={source}
          alt={post.title || ""}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100"
        />
      ) : (
        <div className="h-full w-full bg-[var(--muted)]" />
      )}
    </button>
  );
}

/**
 * The same feed as images only. Locked and text posts have nothing to show on a wall, so they
 * sit this view out rather than becoming grey squares.
 */
export function SlurpMediaWall({
  items,
  onOpenPost,
  onLoadMore,
  total,
  emptyAd,
  adForIndex,
  onAdAction,
  onAdHide,
  adLabels,
}: {
  items: { post: NoodlerPostView & { locked?: boolean }; creator: { profile: NoodlerStageProfile } }[];
  onOpenPost: (postId: string) => void;
  onLoadMore?: () => void;
  total: number;
  emptyAd?: SlurpPromotion | null;
  /** Null on every row when ads are off, searching, or the pool is empty. */
  adForIndex?: (index: number) => SlurpPromotion | null;
  onAdAction?: (ad: SlurpPromotion) => void;
  onAdHide?: (ad: SlurpPromotion) => void;
  adLabels?: { sponsored: string; hide: string; actionFallback: string };
}) {
  const { t: localizeUi } = useUiTranslation();
  const tiles = items.flatMap<SlurpProfileImagePost>(({ post, creator }) => {
    if (post.locked || typeof post.imageUrl !== "string") return [];
    return [{ ...toNoodlePostCardModel(post, creator.profile), imageUrl: post.imageUrl }];
  });
  const emptyWallAd = emptyAd ?? null;
  if (tiles.length === 0) {
    return (
      <div className="space-y-3 px-4 py-8">
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.home.layout.empty", { defaultValue: "No images in this feed yet." })}
        </p>
        {emptyWallAd && adLabels ? (
          <SlurpInlineAdTile
            promotion={emptyWallAd}
            labels={adLabels}
            onAction={() => onAdAction?.(emptyWallAd)}
            onHide={() => onAdHide?.(emptyWallAd)}
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="bg-[var(--slurp-canvas)] pb-6">
      <div className="grid grid-cols-2 gap-px bg-[var(--noodle-divider)] @min-[620px]:grid-cols-3">
        {tiles.map((post, index) => {
          // The slot maths counts tiles, not source posts: the wall drops locked and text posts, so
          // indexing off the feed would leave the cadence uneven and some slots permanently empty.
          const ad = adForIndex?.(index) ?? null;
          return (
            <Fragment key={post.id}>
              <SlurpProfileMediaTile post={post} onOpenImage={(_url, id) => onOpenPost(id)} />
              {ad && adLabels ? (
                <SlurpInlineAdTile
                  promotion={ad}
                  labels={adLabels}
                  onAction={() => onAdAction?.(ad)}
                  onHide={() => onAdHide?.(ad)}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
      {onLoadMore && <LoadMoreFeedButton visible={items.length} total={total} onLoadMore={onLoadMore} />}
    </div>
  );
}

/**
 * A Creator's tip goal, as the fan sees it.
 *
 * The server sends this on the viewer scope alongside the shared view types, which have no goal
 * field — the same arrangement `subscriptionPrice` already uses. It cannot ride on the profile,
 * because the audience profile projection is a strict allowlist and must stay one.
 */
export function noodlerGoalOfProfile(
  scope: unknown,
): { label: string; raised: number; target: number; progress: number; met: boolean } | null {
  const goal = (scope as { goal?: unknown } | null)?.goal;
  if (!goal || typeof goal !== "object") return null;
  const value = goal as Record<string, unknown>;
  if (typeof value.label !== "string" || typeof value.target !== "number" || typeof value.raised !== "number") {
    return null;
  }
  return {
    label: value.label,
    raised: value.raised,
    target: value.target,
    progress: typeof value.progress === "number" ? value.progress : 0,
    met: value.met === true,
  };
}

// ---------------------------------------------------------------------------
// Profile View
// ---------------------------------------------------------------------------

export function StageProfileView({
  viewerAccount,
  viewerActorAccount,
  slurpSettings,
  postCardCtx,
  ...rest
}: StageProfileViewProps) {
  const model = useStageProfileViewModel({ viewerAccount, viewerActorAccount, slurpSettings, postCardCtx, ...rest });
  const {
    profile,
    onProfileChange,
    onCancelEdit,
    onSaveEdit,
    profileSavePending,
    posts,
    draft,
    onDraftChange,
    onClearDraft,
    onDiscardDraft,
    onEdit,
    onBack,
    onManualPost,
    onGuidedPost,
    manualPending,
    guidePending,
    composerOpenSignal,
    localizeUi,
    bannerSrc,
    setAccessSettingsOpen,
    setAutomationOpen,
    creatorToolsOpen,
    setCreatorToolsOpen,
    locationDraft,
    setLocationDraft,
    uploadProfileAvatar,
    uploadProfileBanner,
    profileAvatarFileRef,
    profileBannerFileRef,
    setArtworkKind,
    setOpenImagePostId,
    setArtworkGuidance,
    autoPosting,
    activeTab,
    setActiveTab,
    subscribersQuery,
    subscriberTotal,
    followerTotal,
    profileLikeTotal,
    viewingOwnCreator,
    creatorStatus,
    profileLocation,
    profileBioBody,
    personaBackedCreator,
    managedCreator,
    goalForViewer,
    arcsQuery,
    editing,
    editDraft,
    featuredPost,
    openImagePost,
  } = model;
  const cards = <SlpProfilePostCards model={model} />;
  return (
    <>
      <SlurpProfileSurface
        mobileHeader={
          <button
            type="button"
            onClick={onBack}
            className="absolute start-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white @min-[1024px]:hidden"
            title={localizeUi("ui.slurp.profile.back")}
            aria-label={localizeUi("ui.slurp.profile.back")}
          >
            <ChevronLeft size={22} className="rtl:-scale-x-100" />
          </button>
        }
        account={profile}
        displayHandle={editing ? editDraft.handle : profile.handle}
        handleMeta={
          <>
            {profile.disclosureMode === "hinted" && profile.publicIdentity ? (
              <HelpTooltip
                label={localizeUi("ui.noodle.disclosure.hinted.shortLabel")}
                side="bottom"
                buttonClassName="border border-[var(--noodle-divider)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--muted-foreground)] opacity-100 [&_svg]:hidden"
                text={
                  <span>
                    <span className="block font-bold text-[var(--popover-foreground)]">
                      {localizeUi("ui.noodle.disclosure.open.label")}
                    </span>
                    <span className="mt-1 block">
                      {profile.publicIdentity.displayName} (@{profile.publicIdentity.handle})
                    </span>
                  </span>
                }
              />
            ) : (
              <DisclosureBadge
                mode={profile.disclosureMode}
                detail={
                  profile.disclosureMode === "open" && profile.publicIdentity
                    ? localizeUi("ui.slurp.disclosure.openLinkedDetail", {
                        name: profile.publicIdentity.displayName,
                        handle: profile.publicIdentity.handle,
                      })
                    : undefined
                }
              />
            )}
          </>
        }
        // A creator inherits a banner from its source at creation (open/hinted only); without
        // one the shell keeps its plain accent band.
        banner={{
          url: bannerSrc,
          canEdit: editing,
          uploadTarget: uploadProfileBanner.isPending ? "banner" : null,
          fileRef: profileBannerFileRef,
          onFileChange: (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            uploadProfileBanner.mutate(
              { accountId: profile.id, file },
              {
                onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.artwork.bannerUploadError"))),
              },
            );
          },
          onGenerate: () => {
            setArtworkGuidance("");
            setArtworkKind("banner");
          },
        }}
        avatarUpload={{
          canEdit: editing,
          uploadTarget: uploadProfileAvatar.isPending ? "avatar" : null,
          fileRef: profileAvatarFileRef,
          onFileChange: (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            uploadProfileAvatar.mutate(
              { accountId: profile.id, file },
              {
                onError: (error) => toast.error(errorMessage(error, localizeUi("ui.slurp.artwork.avatarUploadError"))),
              },
            );
          },
          onGenerate: () => {
            setArtworkGuidance("");
            setArtworkKind("avatar");
          },
        }}
        decorativeBanner={false}
        editor={{
          isEditing: editing,
          onStartEditing: onEdit,
          onCancel: onCancelEdit,
          onSave: () => onSaveEdit(locationDraft),
          canSave: Boolean(editDraft.displayName.trim() && editDraft.handle.trim()),
          isSaving: profileSavePending,
          name: editDraft.displayName,
          onNameChange: (value) => onProfileChange({ displayName: value }),
          handle: editDraft.handle,
          onHandleChange: (value) => onProfileChange({ handle: value }),
          bio: editDraft.bio,
          onBioChange: (value) => onProfileChange({ bio: value }),
          location: locationDraft,
          onLocationChange: setLocationDraft,
          privateFields: (
            <div className="space-y-3">
              <SlurpDiscoveryProfileEditor
                gender={editDraft.gender}
                tags={editDraft.tags}
                disabled={profileSavePending}
                onChange={onProfileChange}
              />
              <div className="space-y-3 rounded-xl border border-[var(--noodle-divider)] bg-[var(--accent)]/35 p-4">
                <div>
                  <p className="text-sm font-bold">{localizeUi("ui.noodle.stageprofileform.stageVoice")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.noodle.stageprofileform.voiceAttitudeBoundariesAndCreatorPersona")}
                  </p>
                  <textarea
                    value={editDraft.stagePersonality}
                    maxLength={1000}
                    onChange={(event) => onProfileChange({ stagePersonality: event.target.value })}
                    className="mt-2 min-h-24 w-full resize-y rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] p-3 text-sm outline-none focus:border-[var(--noodle-accent)]"
                  />
                </div>
                <AudienceStancePresets
                  disabled={profileSavePending}
                  onApply={(sentence) =>
                    onProfileChange({ stagePersonality: appendAudienceStance(editDraft.stagePersonality, sentence) })
                  }
                />
              </div>
            </div>
          ),
        }}
        leadingActions={<SlpProfileLeadingActions model={model} />}
        status={creatorStatus}
        stats={{ followers: followerTotal, subscribers: subscriberTotal, likes: profileLikeTotal }}
        location={profileLocation}
        bioContent={profileBioBody ? <p className="whitespace-pre-wrap text-sm leading-6">{profileBioBody}</p> : null}
        bioCollapsible={profileBioBody.length > 280 || profileBioBody.split("\n").length > 4}
        contentActions={null}
        tabs={[
          {
            id: "posts",
            label: `${localizeUi("ui.noodle.profile.tabs.posts")} (${posts.filter((post) => !isSlurpStory(post)).length})`,
          },
          {
            id: "media",
            label: `${localizeUi("ui.noodle.profile.tabs.media")} (${posts.filter((post) => Boolean(post.imageUrl)).length})`,
          },
          { id: "stories", label: `${localizeUi("ui.slurp.stories.archive")} (${posts.filter(isSlurpStory).length})` },
          {
            id: "subscribers",
            label: localizeUi("ui.noodle.stageProfile.tabs.subscribers", {
              count: subscribersQuery.data ? subscriberTotal : "…",
            }),
            ariaLabel: localizeUi("ui.noodle.stageProfile.tabs.subscribersAria", {
              count: subscribersQuery.data ? subscriberTotal : localizeUi("ui.noodle.stageProfile.tabs.loading"),
            }),
            management: true,
          },
          {
            id: "followers",
            label: localizeUi("ui.slurp.profile.tabs.followers", { count: followerTotal }),
            management: true,
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        editorActionInPreTabs
        preTabsContent={
          <>
            {/* Both, never either: a set tip goal used to take this slot and hide the composer,
              so Create post and Add story opened nothing while still leaving a draft behind. */}
            {goalForViewer && !editing && (
              <section className="border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface)] px-4 py-3 sm:px-6">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-xs font-bold">{goalForViewer.label}</p>
                  <p className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                    {goalForViewer.met
                      ? localizeUi("ui.slurp.profile.goalMet", { defaultValue: "Goal met" })
                      : localizeUi("ui.slurp.profile.goalProgress", {
                          defaultValue: "{{raised}} / {{target}}",
                          raised: goalForViewer.raised.toLocaleString(),
                          target: goalForViewer.target.toLocaleString(),
                        })}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--accent)]">
                  <div
                    className="h-full rounded-full bg-[var(--noodle-accent)] transition-[width] motion-reduce:transition-none"
                    style={{ width: `${Math.round(goalForViewer.progress * 100)}%` }}
                  />
                </div>
              </section>
            )}
            {!editing && arcsQuery.data && (
              <SlurpArcTimelineCard
                arcs={arcsQuery.data.arcs}
                onOpenPost={postCardCtx.openPost}
                onOpenProfile={postCardCtx.openAuthorProfile}
              />
            )}
            {managedCreator && !editing && (
              <section data-slurp-creator-tools className="min-w-0">
                {/* Open by default: this panel only renders on a creator you own, and posting is
                  what you came here to do. The line above it still collapses the whole thing. */}
                <div className="flex h-11 items-stretch">
                  <button
                    type="button"
                    onClick={() => setCreatorToolsOpen((open) => !open)}
                    aria-expanded={creatorToolsOpen}
                    aria-controls="slurp-creator-tools-panel"
                    title={localizeUi("ui.slurp.profile.creatorToolsDetail")}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-s-2xl px-3 text-start text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <Sparkles size={13} className="shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{localizeUi("ui.slurp.profile.creatorTools")}</span>
                    {viewingOwnCreator && (
                      <span className="hidden shrink-0 text-[0.68rem] font-semibold text-[var(--muted-foreground)] lg:inline">
                        {localizeUi("ui.noodle.stageprofileview.yourProfile")}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="group/edit flex min-h-11 items-center px-2 text-xs font-bold text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <span className="rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_18%,transparent)] px-2.5 py-1.5 transition-[background-color,transform] group-hover/edit:bg-[color-mix(in_srgb,var(--noodle-accent)_26%,transparent)] group-active/edit:scale-[0.96] motion-reduce:transition-none motion-reduce:group-active/edit:scale-100">
                      {localizeUi("ui.noodle.stageprofileview.editProfile")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorToolsOpen((open) => !open)}
                    aria-expanded={creatorToolsOpen}
                    aria-controls="slurp-creator-tools-panel"
                    aria-label={localizeUi("ui.slurp.profile.creatorTools")}
                    className="flex w-11 shrink-0 items-center justify-center rounded-e-2xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <ChevronDown
                      size={16}
                      strokeWidth={2.5}
                      className={cn(
                        "transition-transform motion-reduce:transition-none",
                        creatorToolsOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div
                  id="slurp-creator-tools-panel"
                  hidden={!creatorToolsOpen}
                  className="mt-1 rounded-xl bg-[var(--background)] shadow-inner ring-1 ring-inset ring-[var(--noodle-divider)]"
                >
                  {/* Edit lives on the profile header with Follow and Subscribe. It used to be
                    duplicated here too, which gave the same action two homes and made this panel
                    look like the place to go. */}
                  <div className="flex flex-wrap gap-2 px-3 py-2 @min-[760px]:px-4">
                    <button
                      type="button"
                      onClick={() => setAccessSettingsOpen(true)}
                      className="min-h-11 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    >
                      {localizeUi("ui.noodle.stageprofileview.access")}
                    </button>
                    {!personaBackedCreator && (
                      <button
                        type="button"
                        onClick={() => setAutomationOpen(true)}
                        className="min-h-11 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                      >
                        {autoPosting.enabled
                          ? localizeUi("ui.noodle.stageprofileview.automationOn")
                          : localizeUi("ui.noodle.stageprofileview.automation")}
                      </button>
                    )}
                  </div>
                  <NoodlerPostComposer
                    key={profile.id}
                    profile={profile}
                    openSignal={composerOpenSignal}
                    availablePosts={posts}
                    draft={draft}
                    onDraftChange={onDraftChange}
                    onClearDraft={onClearDraft}
                    onDiscardDraft={onDiscardDraft}
                    onManualPost={onManualPost}
                    onGuidedPost={onGuidedPost}
                    manualPending={manualPending}
                    guidePending={guidePending}
                  />
                </div>
              </section>
            )}
          </>
        }
        featuredContent={
          featuredPost && !bannerSrc && activeTab === "posts" ? (
            <div className="border-b border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/[0.04] px-4 py-4 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
                  {localizeUi("ui.slurp.profile.featuredDrop")}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">{profile.displayName}</span>
              </div>
              <SlurpProfileFeaturedImage post={featuredPost} onOpenImage={(_url, id) => setOpenImagePostId(id)} />
            </div>
          ) : null
        }
        postList={cards}
        accent={profileAccent(profile.id)}
        spotlight
      />
      {openImagePost && (
        <SlurpPostDialog
          post={openImagePost}
          ctx={{ ...postCardCtx, openPost: undefined }}
          onClose={() => setOpenImagePostId(null)}
        />
      )}
      <SlpProfileModals model={model} />
    </>
  );

  // ---------------------------------------------------------------------------
  // Composer
  // ---------------------------------------------------------------------------
}

export type { NoodlerComposerTool } from "./SlpScreenComposer";
export { NoodlerPostComposer };
