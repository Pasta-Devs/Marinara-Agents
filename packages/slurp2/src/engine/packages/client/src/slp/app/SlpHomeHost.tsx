import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ViewerHub } from "./screens/SlpScreenHub";
import { SLURP_PLACEHOLDER_BALANCE, errorMessage, EmptyState, SlpCreatorFrame } from "./screens/SlpHomeHelpers";
import { ImagePromptReviewModal } from "../../components/ui/ImagePromptReviewModal";
import { ChatImageLightbox } from "../../components/chat/ChatImageLightbox";
import { SlurpOnboardingWizard } from "../features/onboarding/SlpOnboardingPanel";
import { SlurpAgeGate, SlurpConfetti } from "../features/onboarding/SlpAgeGate";
import { SlurpSplash } from "../features/onboarding/SlpSplash";
import { getSlpAccentStyle, SLP_PERSONA_SWITCHER_PAGE_SIZE, SLP_PINK } from "../base/chrome/SlpChrome";
import { SlpShell } from "../modules/chrome/SlpShell";
import { SlpSharePostModal } from "../features/messages/SlpSharePostModal";
import { SlpBackstageShell } from "../app/backstage/SlpBackstageShell";
import { SlpBackstageSidebar } from "../features/backstage/SlpBackstageSidebar";
import { Modal } from "../../components/ui/Modal";
import { useSlurpHomeState } from "./slp-home-actions";
import type { SlurpHomeProps } from "./slp-home.types";
import { renderSlurpHomeCreatorFlow } from "./screens/SlpHomeCreatorFlow";
import { renderSlurpHomeDestinations } from "./screens/SlpHomeDestinations";
import { SlpHomeFeedRail } from "./screens/SlpHomeFeedRail";
import { useRefreshCreatorFanActivityNow } from "../features/audience/slp-fan-activity-hooks";
import { useRefreshTargetedCreatorsNow } from "../features/creators/slp-creator-refresh-hooks";

export function SlurpHome({ navigation, onNavigate, onLeave }: SlurpHomeProps) {
  const model = useSlurpHomeState({ navigation, onNavigate, onLeave });
  const refreshAudienceNow = useRefreshCreatorFanActivityNow();
  const refreshPostsNow = useRefreshTargetedCreatorsNow();
  const {
    localizeUi,
    accountsQuery,
    retryAccountsOrReload,
    connectionCountsQuery,
    viewerWalletsQuery,
    slurpSettingsQuery,
    personasQuery,
    setOnboardingState,
    personas,
    viewerPersonaId,
    activeWalletCoins,
    viewerAccounts,
    shellPersonaAccount,
    myCreatorProfile,
    viewerActorAccount,
    accountSwitcherOpen,
    setAccountSwitcherOpen,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    mobileDrawerTriggerRef,
    mobileAccountSwitcherOpen,
    setMobileAccountSwitcherOpen,
    setPersonaAccountLimit,
    accountSwitcherRef,
    visiblePersonaAccounts,
    switchViewerPersona,
    exitToCreatorHub,
    openSettings,
    feedSearch,
    setFeedSearch,
    discoveryInputRef,
    feedTab,
    setFeedTab,
    onboardingMode,
    setOnboardingMode,
    gateOpen,
    splashOpen,
    setSplashOpen,
    gateCelebrating,
    setGateCelebrating,
    onboardingPresentedRef,
    viewerQuery,
    noodlerUnseenCount,
    notificationUnseenCountQuery,
    unreadCountQuery,
    frozenFeedSeenAt,
    markFeedShown,
    toggleFollow,
    toggleSubscription,
    unlockPost,
    confirmImagePrompts,
    imagePromptReview,
    setImagePromptReview,
    prepareNavigationAwayFromProfileEditor,
    goToHub,
    goToNoodlerSearch,
    goToMessages,
    goToWallet,
    goToStudio,
    closeNoodlerSearch,
    postCardController,
    postCardCtx,
    enterFromGate,
    closeOnboarding,
    beginEdit,
    redraftFromSource,
    confirmReviewedImagePrompts,
    toggleCreatorSubscription,
    mainAuthorProfile,
    openPostComposer,
    openStoryComposer,
  } = model;
  const personaSourceIds = new Set(personas.map((persona) => persona.id));
  const automationCreatorIds = (accountsQuery.data ?? [])
    .filter((creator) => !creator.sourceAccountId || !personaSourceIds.has(creator.sourceAccountId))
    .map((creator) => creator.id);

  const shellProps = {
    appMode: "slurp" as const,
    activeView:
      navigation.mode === "creator-settings"
        ? ("settings" as const)
        : navigation.mode === "creator" && navigation.view === "profile"
          ? ("profile" as const)
          : navigation.mode === "creator" && navigation.view === "search"
            ? ("search" as const)
            : navigation.mode === "creator" && navigation.view === "messages"
              ? ("messages" as const)
              : navigation.mode === "creator" && navigation.view === "wallet"
                ? ("wallet" as const)
                : navigation.mode === "creator" && navigation.view === "studio"
                  ? ("studio" as const)
                  : navigation.mode === "creator" && navigation.view === "notifications"
                    ? ("messages" as const)
                    : ("noodler" as const),
    contextualRail:
      navigation.mode === "creator" && (navigation.view === "hub" || navigation.view === "search")
        ? ("populated" as const)
        : ("spanning" as const),
    homeActive: navigation.mode === "creator" && navigation.view === "hub",
    noodlerUnseenCount,
    accent: SLP_PINK,
    personaAccount: shellPersonaAccount,
    // The Slurp identity to show for the active persona, when it runs a Creator profile. Kept
    // separate from `personaAccount` on purpose: that one carries the persona's own account id,
    // which the switcher list filter and the isCreator check both key on, while this one carries
    // the Creator's. Swapping them would make the active persona reappear in its own switcher.
    creatorIdentity: viewerActorAccount,
    sortedPersonaAccounts: viewerAccounts,
    visiblePersonaAccounts,
    linkedNoodleAccountIds: new Set(
      (accountsQuery.data ?? []).flatMap((profile) => (profile.sourceAccountId ? [profile.sourceAccountId] : [])),
    ),
    // Only a persona that runs a Creator profile has fans and followers, so the switcher
    // shows the line for those personas and leaves the rest without one.
    personaConnectionCounts: Object.fromEntries(
      (accountsQuery.data ?? []).flatMap((profile) => {
        const counts = profile.sourceAccountId ? connectionCountsQuery.data?.[profile.sourceAccountId] : undefined;
        return counts ? [[profile.sourceAccountId!, counts] as const] : [];
      }),
    ),
    personaWallets: viewerWalletsQuery.data,
    onLoadMorePersonaAccounts: () => setPersonaAccountLimit((current) => current + SLP_PERSONA_SWITCHER_PAGE_SIZE),
    onSwitchPersona: switchViewerPersona,
    accountSwitcherOpen,
    onAccountSwitcherOpenChange: setAccountSwitcherOpen,
    accountSwitcherRef,
    mobileDrawerOpen,
    onMobileDrawerOpenChange: setMobileDrawerOpen,
    mobileDrawerTriggerRef,
    mobileAccountSwitcherOpen,
    onMobileAccountSwitcherOpenChange: setMobileAccountSwitcherOpen,
    onOpenHome: exitToCreatorHub,
    onOpenMobileHome: exitToCreatorHub,
    onOpenNoodler: goToHub,
    onOpenSearch: goToNoodlerSearch,
    onOpenMessages: goToMessages,
    onOpenWallet: goToWallet,
    onOpenStudio: goToStudio,
    onGeneratePosts: () => {
      if (automationCreatorIds.length > 0) {
        refreshPostsNow.mutate({ accountIds: automationCreatorIds, access: "locked" });
      }
    },
    onRunAudience: () => {
      refreshAudienceNow.mutate();
    },
    notificationCount:
      (notificationUnseenCountQuery.data?.unseenCount ?? 0) +
      (unreadCountQuery.data?.unread ?? 0) +
      (unreadCountQuery.data?.inboundUnread ?? 0),
    // The studio is only meaningful for a persona that operates a Creator.
    hasOperatedCreator: Boolean(myCreatorProfile),
    walletBalanceLabel: `${viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins ?? SLURP_PLACEHOLDER_BALANCE}`,
    walletBalance: viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins,
    personaBannerUrl: myCreatorProfile?.bannerUrl ?? null,
    onBecomeCreator: shellPersonaAccount
      ? () => {
          onNavigate({ mode: "creator", view: "create-profile", sourceAccountId: shellPersonaAccount.id });
          setMobileDrawerOpen(false);
        }
      : undefined,
    onOpenProfile: async () => {
      if (!(await prepareNavigationAwayFromProfileEditor())) return;
      setMobileDrawerOpen(false);
      onNavigate(
        mainAuthorProfile
          ? { mode: "creator", view: "profile", accountId: mainAuthorProfile.id }
          : shellPersonaAccount
            ? { mode: "creator", view: "create-profile", sourceAccountId: shellPersonaAccount.id }
            : { mode: "creator", view: "profiles" },
      );
    },
    onOpenSettings: openSettings,
    onCompose: openPostComposer,
    // Every NoodleR branch spreads shellProps, so the lightbox mounts once wherever the user is.
    overlays: postCardController.imageLightbox ? (
      <ChatImageLightbox
        image={postCardController.imageLightbox}
        alt={postCardController.imageLightbox.prompt || "Slurp image"}
        pinEnabled={false}
        onClose={() => postCardController.setImageLightbox(null)}
      />
    ) : null,
  } as const;

  if (navigation.mode === "creator-settings") {
    return (
      <SlpShell
        {...shellProps}
        desktopSidebar={
          <SlpBackstageSidebar navigation={navigation} onNavigate={onNavigate} onExit={exitToCreatorHub} />
        }
      >
        <SlpBackstageShell
          navigation={navigation}
          onNavigate={onNavigate}
          onAddCreators={() => setOnboardingMode("add-creators")}
          personaSourceIds={new Set(personas.map((persona) => persona.id))}
          onEditCreator={(creator) => {
            beginEdit(creator);
            onNavigate({ mode: "creator", view: "profile", accountId: creator.id, returnToSettings: navigation });
          }}
          onRedraftCreator={(creator) => {
            redraftFromSource(creator);
            onNavigate({ mode: "creator", view: "profile", accountId: creator.id, returnToSettings: navigation });
          }}
          onRestartOnboarding={() => {
            onboardingPresentedRef.current = true;
            setOnboardingState("entered");
            setOnboardingMode("first-run");
          }}
          viewerPersonaId={viewerPersonaId}
        />
        <SlurpOnboardingWizard
          open={onboardingMode !== null}
          selectionOnly={onboardingMode === "add-creators"}
          onClose={closeOnboarding}
          onComplete={() => {
            if (onboardingMode === "first-run") {
              setOnboardingState("completed");
            }
          }}
          onSeeFeed={
            onboardingMode === "add-creators"
              ? () => {
                  setOnboardingMode(null);
                  setFeedTab("all");
                  onNavigate({ mode: "creator", view: "hub" });
                }
              : undefined
          }
          onSkipped={() => setOnboardingMode(null)}
        />
      </SlpShell>
    );
  }

  // Shared review layer: Guide generation can be triggered from both the selected stage-profile
  // view and the hub, so the confirmation modal must render on every branch that owns that action.
  const reviewModal = (
    <ImagePromptReviewModal
      open={Boolean(imagePromptReview)}
      items={imagePromptReview?.items ?? []}
      isSubmitting={confirmImagePrompts.isPending}
      onCancel={() => setImagePromptReview(null)}
      onConfirm={confirmReviewedImagePrompts}
    />
  );

  if (accountsQuery.isLoading) {
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame onBack={exitToCreatorHub} title={localizeUi("ui.noodle.noodlemodetoggle.noodler")}>
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--noodle-accent)]" />
          </div>
        </SlpCreatorFrame>
      </SlpShell>
    );
  }

  if (accountsQuery.isError) {
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame onBack={exitToCreatorHub} title={localizeUi("ui.noodle.noodlemodetoggle.noodler")}>
          <EmptyState
            title={localizeUi("ui.noodle.noodlerhome.noodlerCouldNotBeLoaded")}
            action={localizeUi("capabilities.actions.tryAgain")}
            onAction={retryAccountsOrReload}
          />
        </SlpCreatorFrame>
      </SlpShell>
    );
  }

  const creatorFlow = renderSlurpHomeCreatorFlow({ model, shellProps, reviewModal });
  if (creatorFlow) return creatorFlow;

  if (navigation.mode === "creator" && navigation.view === "profile") {
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame onBack={goToHub} title={localizeUi("ui.noodle.noodlehome.profile")}>
          <EmptyState title={localizeUi("ui.noodle.viewerhub.thisPersonaHasNoLinkedNoodlerProfile")} />
        </SlpCreatorFrame>
      </SlpShell>
    );
  }

  const showDiscovery = navigation.mode === "creator" && navigation.view === "search";
  // Creator discovery stays in the wide-screen rail. Narrow layouts omit it so the
  // timeline remains the primary surface instead of stacking sidebar content above it.
  const feedRightRail = <SlpHomeFeedRail model={model} showDiscovery={showDiscovery} />;

  // Messages and Wallet are navigation destinations before they are features, so the
  // shell can show them as real pages instead of a dead button.
  const destination = renderSlurpHomeDestinations({ model, shellProps, reviewModal, feedRightRail, showDiscovery });
  if (destination) return destination;

  return (
    <SlpShell {...shellProps} contextualRail="populated" rightRail={feedRightRail}>
      <ViewerHub
        personas={personas}
        personasLoading={personasQuery.isLoading}
        personasError={personasQuery.isError}
        onRetryPersonas={() => void personasQuery.refetch()}
        scope={viewerQuery.data}
        newSinceAt={viewerQuery.data ? (frozenFeedSeenAt[viewerQuery.data.viewer.id] ?? null) : null}
        onFeedShown={markFeedShown}
        onOpenWallet={goToWallet}
        walletCoins={activeWalletCoins}
        onLoadMore={model.viewerQuery.loadMore}
        hasMore={Boolean(model.viewerQuery.data?.nextCursor)}
        deletingPostIds={model.deletingPostIds}
        deletedPostIds={model.deletedPostIds}
        restoringPostIds={model.restoringPostIds}
        onRestorePost={model.restoreNoodlePost}
        isLoading={viewerQuery.isLoading}
        isError={viewerQuery.isError}
        onRetry={() => void viewerQuery.refetch()}
        onRefresh={() =>
          void viewerQuery.refetch().then(({ error }) => {
            if (error) {
              toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotRefreshNoodlerCreators")));
              return;
            }
            toast.success(localizeUi("ui.slurp.feed.refreshed"));
          })
        }
        isRefreshing={viewerQuery.isRefetching}
        unlockPending={unlockPost.isPending}
        postCardCtx={postCardCtx}
        onUnlock={(postId) => {
          if (!viewerPersonaId) return Promise.resolve();
          return unlockPost
            .mutateAsync({ postId, personaId: viewerPersonaId })
            .then(() => undefined)
            .catch((error) => {
              toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUnlockThisPost")));
              throw error;
            });
        }}
        search={feedSearch}
        onSearchChange={setFeedSearch}
        discoveryOpen={showDiscovery}
        onCloseDiscovery={closeNoodlerSearch}
        discoveryInputRef={discoveryInputRef}
        tab={feedTab}
        onTabChange={setFeedTab}
        authorProfile={accountsQuery.isSuccess ? mainAuthorProfile : null}
        onAddStory={openStoryComposer}
        onOpenAuthorProfile={
          mainAuthorProfile
            ? () => onNavigate({ mode: "creator", view: "profile", accountId: mainAuthorProfile.id })
            : undefined
        }
        onToggleSubscription={toggleCreatorSubscription}
        togglePending={toggleSubscription.isPending || toggleFollow.isPending}
        connectionCounts={connectionCountsQuery.data ?? {}}
        inlineAdsEnabled={slurpSettingsQuery.data?.inlineAdsEnabled !== false}
        inlineAdsFrequency={slurpSettingsQuery.data?.inlineAdsFrequency ?? "standard"}
        storyLifetimeHours={slurpSettingsQuery.data?.storyLifetimeHours ?? 72}
      />
      <SlurpOnboardingWizard
        open={onboardingMode !== null}
        onClose={closeOnboarding}
        onComplete={() => {
          setOnboardingState("completed");
          setFeedTab("all");
        }}
        onSkipped={() => setOnboardingState("completed")}
      />
      <Modal
        open={gateOpen && !splashOpen}
        onClose={() => undefined}
        title={localizeUi("ui.noodle.noodlemodetoggle.noodler")}
        width="max-w-md"
        panelClassName="noodle-icon-scope"
        panelStyle={getSlpAccentStyle(SLP_PINK)}
        closeDisabled
      >
        <SlurpAgeGate
          personaName={shellPersonaAccount?.displayName ?? ""}
          onComplete={enterFromGate}
          onCelebrate={() => setGateCelebrating(true)}
          onLeave={onLeave}
          isPending={false}
        />
      </Modal>
      <SlpSharePostModal
        post={model.sharingPost}
        personaId={viewerPersonaId}
        open={Boolean(model.sharingPost)}
        onClose={() => model.setSharingPost(null)}
      />
      <SlurpSplash open={splashOpen} onDismiss={() => setSplashOpen(false)} />
      {gateCelebrating && <SlurpConfetti fixed />}
      {reviewModal}
    </SlpShell>
  );
}
