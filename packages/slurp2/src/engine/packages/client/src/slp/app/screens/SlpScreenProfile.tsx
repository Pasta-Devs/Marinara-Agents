import { NoodlerPostComposer } from "./SlpScreenComposer";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { useStageProfileViewModel, type StageProfileViewProps } from "./slp-profile-view-model";
import { SlpProfileModals } from "./SlpProfileModals";
import { SlpProfilePostCards } from "./SlpProfilePostCards";
import { SlpProfileLeadingActions } from "./SlpProfileLeadingActions";
import { ChevronDown, ChevronLeft, MoreHorizontal, Pencil, Plus, Wrench } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import type { SlpCreatorPostView, SlpCreatorStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpPromotion } from "../../features/ads/slp-ads-contract";
import { toast } from "sonner";
import { type SlpPostCardModel } from "../../modules/post/SlpPostTypes";
import { SlurpArcEffectsList, SlurpArcTimelineCard } from "../../features/projects/SlpArcTimelineCard";
import { SlpCouplePageWriteSheet, SlpProfileCoupleLine } from "../../features/projects/SlpCouples";
import { useSlurpCouplePageClosed } from "../../features/projects/slp-ties-hooks";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { SlurpProfileSurface } from "../../features/creators/SlpProfileSurface";
import { SlpBalanceChip, useSlpShellActions } from "../../modules/chrome/SlpShell";
import { SlpStirGlyph } from "../../base/chrome/SlpGlyphs";
import { openSlpStir } from "../../features/stir/slp-stir-contract";
import { SlpDashboardSheet } from "./SlpDashboard";
import { SlpButton, slpTagClass } from "../../modules/chrome/SlpButton";
import { SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { formatSlpDollars, formatSlpPercent } from "../../base/ui/slp-number-format";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpInlineAdTile } from "../../features/ads/SlpInlineAd";
import { openSlpCreatorSettings } from "../../features/creators/settings/slp-creator-settings-store";
import { SlurpDiscoveryProfileEditor } from "../../features/discovery/SlpDiscoveryProfileEditor";
import {
  appendAudienceStance,
  AudienceStancePresets,
  profileAccent,
} from "../../features/creators/SlpStageProfileForm";
import { cn } from "../../../lib/utils";
import { SLP_CARD_STACK_CLASS } from "../../modules/post/SlpPostHelpers";
import { SLP_IMG_FRAME_CLASS, slpImgFade } from "../../base/chrome/SlpChrome";
import { api } from "../../../lib/api-client";
import { SlpPostSurfaceMenu } from "../../modules/post/SlpPostMenu";
import { downloadSlpShareCard, toSlpShareCardInput } from "../../modules/post/slp-share-card";
import { errorMessage, toSlpPostCardModel, LoadMoreFeedButton, SlurpPostDialog } from "./SlpHomeHelpers";
import { SlpProfilePage } from "./SlpProfilePage";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export type SlurpProfileImagePost = SlpPostCardModel & { imageUrl: string };

export type SlpCreatorProfileTab = "posts" | "media" | "stories" | "subscribers" | "followers";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function SlurpProfileMediaTile({
  post,
  onOpenImage,
  onOpenCreator,
  withMenu = true,
}: {
  post: SlurpProfileImagePost;
  onOpenImage: (url: string, id: string) => void;
  onOpenCreator?: () => void;
  /** The profile grid has no ⋯ on its tiles (03 §12); the post dialog carries the menu. */
  withMenu?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { src: source, observe } = useNearViewportSlurpMediaSrc(post.imageUrl, { width: 480 });
  return (
    <div ref={observe} className="relative aspect-square overflow-hidden bg-[var(--slurp-surface-raised)]">
      <button
        type="button"
        onClick={() => source && onOpenImage(source, post.id)}
        disabled={!source}
        className={cn(
          "relative block h-full w-full text-left focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] disabled:cursor-wait",
          SLP_IMG_FRAME_CLASS,
        )}
        aria-label={post.title || localizeUi("ui.slurp.post.openImage")}
      >
        {source && (
          <img
            key={source}
            src={source}
            alt={post.title || ""}
            loading="lazy"
            decoding="async"
            {...slpImgFade}
            className="slp-crop h-full w-full object-cover transition-[transform,opacity,filter] duration-[360ms] hover:scale-[1.03] motion-reduce:transition-opacity motion-reduce:hover:scale-100"
          />
        )}
      </button>
      {withMenu && (
        <div className="absolute end-2 top-2 z-10" onClick={(event) => event.stopPropagation()}>
          <SlpPostSurfaceMenu
            onDownload={
              source
                ? () =>
                    void api.download(
                      `/slurp2/noodler/posts/${encodeURIComponent(post.id)}/media`,
                      `slurp-${post.id}-image`,
                    )
                : undefined
            }
            onShare={
              source ? () => void downloadSlpShareCard(toSlpShareCardInput(post), `slurp-${post.id}.png`) : undefined
            }
            onOpenCreator={onOpenCreator}
            deepDetailsPostId={post.id}
          />
        </div>
      )}
    </div>
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
  items: { post: SlpCreatorPostView & { locked?: boolean }; creator: { profile: SlpCreatorStageProfile } }[];
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
    return [{ ...toSlpPostCardModel(post, creator.profile), imageUrl: post.imageUrl }];
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
    <div className="pb-6">
      {/* Same inset and radius as the feed cards; every tile (picture or ad) gets the same frame. */}
      <div className="grid grid-cols-2 gap-1.5 px-3 @min-[620px]:grid-cols-3 sm:px-4 [&>*]:overflow-hidden [&>*]:rounded-xl [&>*]:shadow-[var(--slurp-shadow-raised)]">
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
export function slpCreatorGoalOfProfile(
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
  openDashboard = false,
  ...rest
}: StageProfileViewProps) {
  const model = useStageProfileViewModel({ viewerAccount, viewerActorAccount, slurpSettings, postCardCtx, ...rest });
  const shellActions = useSlpShellActions();
  const {
    profile,
    onProfileChange,
    onCancelEdit,
    onSaveEdit,
    profileSavePending,
    onBack,
    isLoading,
    localizeUi,
    i18n,
    bannerSrc,
    locationDraft,
    setLocationDraft,
    uploadProfileAvatar,
    uploadProfileBanner,
    profileAvatarFileRef,
    profileBannerFileRef,
    setArtworkKind,
    setOpenImagePostId,
    activeTab,
    setActiveTab,
    subscribersQuery,
    subscriberTotal,
    followerTotal,
    profileLikeTotal,
    postTabCounts,
    viewingOwnCreator,
    creatorStatus,
    profileLocation,
    profileBioBody,
    managedCreator,
    goalForViewer,
    arcsQuery,
    editing,
    editDraft,
    openImagePost,
    showProfilePost,
    setTipOpen,
    viewerCreator,
  } = model;
  const cards = <SlpProfilePostCards model={model} />;
  // A closed couple page (7b-couples): no Subscribe, Follow or Tip; its note says why.
  const closedCouplePage = useSlurpCouplePageClosed(viewerAccount?.entityId ?? null, profile.id);
  // An open shared page: Message asks which of the two to write to (7c M-002).
  const couplePage = Boolean(profile.sourceAccountId?.startsWith("slurp-couple:"));
  const [coupleWriteOpen, setCoupleWriteOpen] = useState(false);
  // W: the own page's Dashboard (the old Studio's top half), from the action row or an owed #ad in Stir.
  const [dashboardOpen, setDashboardOpen] = useState(false);
  useEffect(() => {
    if (openDashboard && viewingOwnCreator) setDashboardOpen(true);
  }, [openDashboard, viewingOwnCreator]);
  // The guided post (0.3.14): an idea Stir handed to this page opens its composer, which drafts it.
  const guideHandedOver = useSlurpUIStore((state) => state.composeGuide?.accountId === profile.id);
  useEffect(() => {
    if (guideHandedOver) model.setComposerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opens once per handed-over idea
  }, [guideHandedOver]);
  // Another Creator Slurp posts for can be stirred from here; a couple's page and your own cannot.
  const stirrable = !viewingOwnCreator && !model.personaBackedCreator && !couplePage;
  // No "(0)" while the posts load: a loading page does not claim to be empty.
  const tabCount = (count: number) => (isLoading ? null : count);
  return (
    <>
      <SlurpProfileSurface
        storyCreatorId={profile.id}
        mobileHeader={
          <>
            <button
              type="button"
              onClick={onBack}
              className="absolute start-2 top-2 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/15 backdrop-blur-md hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white @min-[1024px]:hidden [&_svg]:!text-white"
              title={localizeUi("ui.slurp.profile.back")}
              aria-label={localizeUi("ui.slurp.profile.back")}
            >
              <ChevronLeft size={22} className="rtl:-scale-x-100" />
            </button>
            {/* Phones: the balance sits top right over the banner (the coin-fly target), except while
              the banner's own edit buttons are there. W: beside it ✦ (Stir this Creator), or on your
              own page ⋯ (Settings, Wallet, switch account: "More" became "Me"). */}
            {!editing && (
              <div className="absolute end-2 top-2 z-30 flex items-center gap-2">
                {stirrable && (
                  <button
                    type="button"
                    data-slp-stir-open=""
                    onClick={() => openSlpStir({ creatorId: profile.id })}
                    className="flex h-11 items-center gap-1.5 rounded-full bg-black/40 px-3.5 text-sm font-bold text-white shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/15 backdrop-blur-md hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white [&_svg]:!text-white"
                    aria-label={localizeUi("ui.slurp.stir.stirName", { name: profile.displayName })}
                  >
                    <SlpStirGlyph size={16} filled aria-hidden="true" />
                    {localizeUi("ui.slurp.stir.stirShort")}
                  </button>
                )}
                {viewingOwnCreator && shellActions.openMore && (
                  <button
                    type="button"
                    onClick={shellActions.openMore}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/15 backdrop-blur-md hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white @min-[1024px]:hidden [&_svg]:!text-white"
                    aria-label={localizeUi("ui.slurp.navigation.more", { defaultValue: "More" })}
                    title={localizeUi("ui.slurp.navigation.more", { defaultValue: "More" })}
                  >
                    <MoreHorizontal size={20} aria-hidden="true" />
                  </button>
                )}
                <SlpBalanceChip />
              </div>
            )}
          </>
        }
        account={profile}
        displayHandle={editing ? editDraft.handle : profile.handle}
        // A creator inherits a banner from its source at creation (open/hinted only); without
        // one the banner is a pink wash made from the avatar.
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
          onGenerate: () => setArtworkKind("banner"),
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
          onGenerate: () => setArtworkKind("avatar"),
        }}
        editor={{
          isEditing: editing,
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
        leadingActions={
          closedCouplePage ? null : (
            <SlpProfileLeadingActions
              model={couplePage ? { ...model, onOpenMessages: () => setCoupleWriteOpen(true) } : model}
              onOpenDashboard={viewingOwnCreator ? () => setDashboardOpen(true) : undefined}
              onOpenSettings={viewingOwnCreator ? shellActions.openSettings : undefined}
            />
          )
        }
        status={creatorStatus}
        stats={{
          followers: followerTotal,
          subscribers: subscribersQuery.data ? subscriberTotal : null,
          likes: profileLikeTotal,
        }}
        location={profileLocation}
        coupleLine={
          <SlpProfileCoupleLine
            personaId={viewerAccount?.entityId ?? null}
            accountId={profile.id}
            onOpenProfile={postCardCtx.openAuthorProfile}
          />
        }
        bioContent={profileBioBody ? <p className="whitespace-pre-wrap">{profileBioBody}</p> : null}
        bioCollapsible={profileBioBody.length > 280 || profileBioBody.split("\n").length > 4}
        tabs={[
          { id: "posts", label: localizeUi("ui.noodle.profile.tabs.posts"), count: tabCount(postTabCounts.posts) },
          { id: "media", label: localizeUi("ui.noodle.profile.tabs.media"), count: tabCount(postTabCounts.media) },
          { id: "stories", label: localizeUi("ui.slurp.stories.archive"), count: tabCount(postTabCounts.stories) },
          {
            id: "subscribers",
            label: localizeUi("ui.slurp.profile.subscribers", { defaultValue: "Subscribers" }),
            count: subscribersQuery.data ? subscriberTotal : null,
            ariaLabel: localizeUi("ui.noodle.stageProfile.tabs.subscribersAria", {
              count: subscribersQuery.data ? subscriberTotal : localizeUi("ui.noodle.stageProfile.tabs.loading"),
            }),
            management: true,
          },
          {
            id: "followers",
            label: localizeUi("ui.slurp.profile.followers", { defaultValue: "Followers" }),
            count: followerTotal,
            management: true,
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pageContent={<SlpProfilePage model={model} />}
        afterTabsContent={
          editing ? null : (
            <>
              {/* Fan cards open the Posts tab (step 3.2), so the header ends on its actions. */}
              {activeTab === "posts" && (goalForViewer || arcsQuery.data?.arcs.length) ? (
                <div className={cn(SLP_CARD_STACK_CLASS, "mx-3 mt-4 @min-[680px]:mx-0")}>
                  {goalForViewer && (
                    <section className="rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-3.5 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--slurp-muted)]">
                            {localizeUi("ui.slurp.profile.tipGoal", { defaultValue: "Tip goal" })}
                          </p>
                          <p className="truncate text-[15px] font-bold leading-5">{goalForViewer.label}</p>
                        </div>
                        {/* The natural action next to a goal: open the tip sheet. */}
                        {!viewingOwnCreator && viewerCreator && !goalForViewer.met && (
                          <SlpButton onClick={() => setTipOpen(true)} className="min-h-9 shrink-0 px-3.5 text-xs">
                            {localizeUi("ui.slurp.profile.chipIn", { defaultValue: "Chip in" })}
                          </SlpButton>
                        )}
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--slurp-text)_10%,transparent)]">
                        <div
                          className="h-full rounded-full bg-[var(--noodle-accent)] shadow-[0_0_10px_var(--noodle-accent)] transition-[width] motion-reduce:transition-none"
                          style={{ width: `${Math.round(Math.min(1, goalForViewer.progress) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs tabular-nums text-[var(--slurp-muted)]">
                        {goalForViewer.met
                          ? localizeUi("ui.slurp.profile.goalMet", { defaultValue: "Goal met" })
                          : localizeUi("ui.slurp.profile.goalProgressDollars", {
                              defaultValue: "{{raised}} of {{target}} · {{percent}}",
                              raised: formatSlpDollars(goalForViewer.raised, i18n.language),
                              target: formatSlpDollars(goalForViewer.target, i18n.language),
                              percent: formatSlpPercent(Math.min(1, goalForViewer.progress), i18n.language),
                            })}
                      </p>
                    </section>
                  )}
                  {arcsQuery.data && (
                    <SlurpArcTimelineCard
                      arcs={arcsQuery.data.arcs}
                      onOpenPost={showProfilePost}
                      onOpenProfile={postCardCtx.openAuthorProfile}
                    />
                  )}
                </div>
              ) : null}
              {managedCreator && <SlpCreatorToolsCard model={model} />}
            </>
          )
        }
        postList={cards}
        accent={profileAccent(profile.id)}
      />
      {openImagePost && (
        <SlurpPostDialog
          post={openImagePost}
          ctx={{ ...postCardCtx, openPost: undefined }}
          onClose={() => setOpenImagePostId(null)}
        />
      )}
      <SlpProfileModals model={model} />
      {viewingOwnCreator && (
        <SlpDashboardSheet
          open={dashboardOpen}
          onClose={() => setDashboardOpen(false)}
          personaId={viewerAccount?.entityId ?? null}
          creatorId={profile.id}
          onOpenProfile={() => setDashboardOpen(false)}
        />
      )}
      {couplePage && (
        <SlpCouplePageWriteSheet
          personaId={viewerAccount?.entityId ?? null}
          accountId={profile.id}
          open={coupleWriteOpen}
          onClose={() => setCoupleWriteOpen(false)}
          onWrite={(creatorId) => model.onOpenMessages(creatorId)}
        />
      )}
      {managedCreator && (
        <NoodlerPostComposer
          key={profile.id}
          open={model.composerOpen}
          onClose={() => model.setComposerOpen(false)}
          profile={profile}
          availablePosts={model.posts}
          draft={model.draft}
          onDraftChange={model.onDraftChange}
          onClearDraft={model.onClearDraft}
          onDiscardDraft={model.onDiscardDraft}
          onManualPost={model.onManualPost}
          manualPending={model.manualPending}
        />
      )}
    </>
  );
}

/**
 * Everything an operator does on a profile, in one collapsible muted card under the tabs (design
 * language §8: after the fan content, never the primary). Closed by default except on the viewer's
 * own persona-backed Creator, where posting is the reason for the visit.
 */
function SlpCreatorToolsCard({ model }: { model: ReturnType<typeof useStageProfileViewModel> }) {
  const {
    arcsQuery,
    autoPosting,
    creatorToolsOpen,
    localizeUi,
    onEdit,
    onRunNow,
    openComposer,
    personaBackedCreator,
    profile,
    runNowPending,
    setCreatorToolsOpen,
    viewingOwnCreator,
  } = model;
  const mode = profile.disclosureMode;
  const identity = profile.publicIdentity;
  const identityDetail =
    mode === "open" && identity
      ? localizeUi("ui.slurp.disclosure.openLinkedDetail", { name: identity.displayName, handle: identity.handle })
      : mode === "hinted"
        ? `${localizeUi("ui.slurp.disclosure.hintedDetail")}${identity ? ` (${identity.displayName}, @${identity.handle})` : ""}`
        : mode === "secret"
          ? localizeUi("ui.slurp.disclosure.secretDetail")
          : localizeUi("ui.slurp.disclosure.setupDetail");
  const hasEffects = Boolean(arcsQuery.data?.arcs.length);
  return (
    <section
      data-slurp-creator-tools
      className="mx-3 mt-3 rounded-2xl bg-[color-mix(in_srgb,var(--slurp-surface)_72%,transparent)] ring-1 ring-inset ring-[var(--noodle-divider)] @min-[680px]:mx-0"
    >
      <button
        type="button"
        onClick={() => setCreatorToolsOpen((open) => !open)}
        aria-expanded={creatorToolsOpen}
        aria-controls="slurp-creator-tools-panel"
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-2 text-start text-[var(--slurp-muted)] transition-colors hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
      >
        <Wrench size={16} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[var(--slurp-text)]">
            {localizeUi("ui.slurp.profile.creatorTools")}
          </span>
          <span className="block truncate text-xs">
            {viewingOwnCreator
              ? localizeUi("ui.slurp.profile.creatorToolsOwn", { defaultValue: "Post, edit and automate your page" })
              : localizeUi("ui.slurp.profile.creatorToolsOthers", {
                  defaultValue: "Edit, automate and post as {{name}}",
                  name: profile.displayName,
                })}
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={cn(
            "shrink-0 transition-transform motion-reduce:transition-none",
            creatorToolsOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id="slurp-creator-tools-panel"
        hidden={!creatorToolsOpen}
        className="space-y-4 border-t border-[var(--noodle-divider)] px-4 pb-4 pt-3"
      >
        {/* The own page edits from its action row, and a persona-backed Creator has no automation,
            so the own page has no buttons here. */}
        {!viewingOwnCreator && (
          <div className="flex flex-wrap gap-2">
            <SlpButton variant="quiet" onClick={() => openComposer()} className="min-h-10 px-3.5 text-xs">
              <Plus size={14} aria-hidden="true" />
              {localizeUi("ui.slurp.profile.newPost", { defaultValue: "New post" })}
            </SlpButton>
            <SlpButton variant="quiet" onClick={onEdit} className="min-h-10 px-3.5 text-xs">
              <Pencil size={14} aria-hidden="true" />
              {localizeUi("ui.slurp.profile.editProfile", { defaultValue: "Edit profile" })}
            </SlpButton>
            {/* Automation used to open a dialog of its own here. It is a Creator setting like the
                rest, so it opens the one place they all live now. */}
            {!personaBackedCreator && (
              <>
                <SlpButton
                  variant="quiet"
                  onClick={() => openSlpCreatorSettings(profile.id, { tab: "automation" })}
                  className="min-h-10 px-3.5 text-xs"
                >
                  {autoPosting.enabled
                    ? localizeUi("ui.noodle.stageprofileview.automationOn")
                    : localizeUi("ui.noodle.stageprofileview.automation")}
                </SlpButton>
                {/* Generating a post talks to the provider, so it keeps its own disclosure gate and
                    stays an action here rather than moving in with the settings. */}
                <SlpButton
                  variant="quiet"
                  disabled={runNowPending}
                  onClick={() => onRunNow(profile.id)}
                  className="min-h-10 px-3.5 text-xs"
                >
                  {runNowPending
                    ? localizeUi("ui.noodle.stageprofileview.running")
                    : localizeUi("ui.noodle.stageprofileview.runNow")}
                  <SlpUsesAiMark />
                </SlpButton>
              </>
            )}
          </div>
        )}
        {/* W: steering (mood, life, pace, ideas, spice) moved into the Stir ✦ sheet with the rest of the
          levers. Only for Creators Slurp writes for: not a couple's shared page (7b-couples). */}
        {!viewingOwnCreator && !personaBackedCreator && !profile.sourceAccountId?.startsWith("slurp-couple:") && (
          <button
            type="button"
            onClick={() => openSlpStir({ creatorId: profile.id })}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-[var(--slurp-tint)] px-3 text-start transition-colors hover:bg-[color-mix(in_srgb,var(--noodle-accent)_22%,var(--slurp-surface-raised))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-[var(--slurp-ink)]"
          >
            <SlpStirGlyph size={18} filled aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-[var(--slurp-text)]">
                {localizeUi("ui.slurp.stir.stirName", { name: profile.displayName })}
              </span>
              <span className="block truncate text-xs text-[var(--slurp-muted)]">
                {localizeUi("ui.slurp.stir.toolsRow")}
              </span>
            </span>
          </button>
        )}
        <div>
          <p className="text-xs font-semibold text-[var(--slurp-muted)]">
            {localizeUi("ui.slurp.profile.identity", { defaultValue: "Identity" })}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs leading-4">
            <span className={slpTagClass(true)}>
              {mode ? localizeUi(`ui.noodle.disclosure.${mode}.label`) : localizeUi("ui.noodle.disclosure.setupNeeded")}
            </span>
            <span className="min-w-0 text-[var(--slurp-muted)]">{identityDetail}</span>
          </p>
        </div>
        {hasEffects && (
          <SlurpArcEffectsList
            arcs={arcsQuery.data!.arcs}
            heading={localizeUi("ui.slurp.arcs.effectsHeading", { defaultValue: "Storyline effects" })}
          />
        )}
      </div>
    </section>
  );
}

export type { SlpCreatorComposerTool } from "./SlpScreenComposer";
export { NoodlerPostComposer };
