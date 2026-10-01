import { useEffect, useMemo, useState } from "react";
import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../modules/chrome/SlpStateKit";
import { toast } from "sonner";
import { ViewerHub } from "./screens/SlpScreenHub";
import { errorMessage, SlpCreatorFrame } from "./screens/SlpHomeHelpers";
import { ImagePromptReviewModal } from "../../components/ui/ImagePromptReviewModal";
import { ChatImageLightbox } from "../../components/chat/ChatImageLightbox";
import { SlurpOnboardingWizard } from "../features/onboarding/SlpOnboardingPanel";
import { SlurpSplash } from "../features/onboarding/SlpSplash";
import { SLP_PAGE_SCROLL_CLASS, SLP_PERSONA_SWITCHER_PAGE_SIZE, SLP_PINK } from "../base/chrome/SlpChrome";
import { cn } from "../../lib/utils";
import { SlpShell, SlpWordmark } from "../modules/chrome/SlpShell";
import { SlpSharePostModal } from "../features/messages/SlpSharePostModal";
import { SlpCreatorSettingsModal } from "../features/creators/settings/SlpCreatorSettingsModal";
import { SlpBackstageShell } from "../app/backstage/SlpBackstageShell";
import { SlpBackstageSidebar } from "../features/backstage/SlpBackstageSidebar";
import { useSlurpHomeState } from "./slp-home-actions";
import type { SlurpHomeProps } from "./slp-home.types";
import { renderSlurpHomeCreatorFlow } from "./screens/SlpHomeCreatorFlow";
import { renderSlurpHomeDestinations } from "./screens/SlpHomeDestinations";
import { SlpHomeFeedRail } from "./screens/SlpHomeFeedRail";
import { SlpStirCreatorSheet, SlpStirReadyPlanHost } from "../features/stir/slp-stir-contract";
import { useSlpMinuteClock } from "../base/ui/slp-minute-clock";
import type { SlpStoryRings } from "../modules/story/SlpStoryRing";
import { slpStoryRings, slpStoryStartId } from "../modules/story/slp-story-rings";
import { slurpLiveStories } from "./screens/slp-hub-view";
import { slpShowPostWhenRendered } from "../modules/post/SlpPostPurposeNote";
import type { SlpPulseTarget } from "../base/state/slp-task-store";

/** Slurp's own tree and its portalled sheets. */
const SLP_SCOPE_SELECTOR = 'marinara-capability-slurp2, [data-marinara-capability-scope="slurp2"]';

export function SlurpHome({ navigation, onNavigate, onLeave }: SlurpHomeProps) {
  const model = useSlurpHomeState({ navigation, onNavigate, onLeave });
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
    splashOpen,
    setSplashOpen,
    onboardingPresentedRef,
    viewerQuery,
    noodlerUnseenCount,
    unreadCountQuery,
    frozenFeedSeenAt,
    markFeedShown,
    toggleFollow,
    toggleSubscription,
    unlockPost,
    confirmImagePrompts,
    imagePromptReview,
    prepareNavigationAwayFromProfileEditor,
    goToHub,
    goToNoodlerSearch,
    goToMessages,
    goToWallet,
    goToStir,
    closeNoodlerSearch,
    postCardController,
    postCardCtx,
    closeOnboarding,
    redraftFromSource,
    confirmReviewedImagePrompts,
    cancelReviewedImagePrompts,
    toggleCreatorSubscription,
    mainAuthorProfile,
    openStoryComposer,
    updateSlurpSettings,
  } = model;
  // "Show whole pictures": on <html>, so previews in sheets and dialogs portalled out of Slurp follow it.
  const wholePictures = slurpSettingsQuery.data?.previewWholePictures === true;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-slp-whole", wholePictures);
    return () => document.documentElement.removeAttribute("data-slp-whole");
  }, [wholePictures]);
  // "Blur pictures until tapped": the CSS in slp-client-entry blurs every Slurp picture and video; the
  // first tap on one shows it instead of opening it. On <html> for the same reason as above.
  // ponytail: a tap on an overlay that is not the picture's own button (a veil, a carousel arrow)
  // does its usual action; a picture that is not focusable has no keyboard reveal of its own.
  const blurPictures = slurpSettingsQuery.data?.blurPictures === true;
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-slp-blur", blurPictures);
    if (!blurPictures) return () => root.removeAttribute("data-slp-blur");
    const reveal = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      // The picture itself, or a blurred one inside the button or link that was activated: Enter or
      // Space on a picture button sends its click to the button, not the picture.
      const media =
        target?.closest("img, video") ??
        target
          ?.closest("button, a, [role='button']")
          ?.querySelector("img:not([data-slp-revealed]), video:not([data-slp-revealed])");
      if (!media || media.hasAttribute("data-slp-revealed") || !media.closest(SLP_SCOPE_SELECTOR)) return;
      event.preventDefault();
      event.stopPropagation();
      media.setAttribute("data-slp-revealed", "");
    };
    document.addEventListener("click", reveal, true);
    return () => {
      document.removeEventListener("click", reveal, true);
      root.removeAttribute("data-slp-blur");
    };
  }, [blurPictures]);
  const personaSourceIds = new Set(personas.map((persona) => persona.id));
  const storyRings = useSlurpStoryRings(model);
  // Task F: an older budget moved to the sized defaults; Pulse says so once, then this clears it.
  const budgetNoteBudget = slurpSettingsQuery.data?.modelBudget.raisedNotice
    ? slurpSettingsQuery.data.modelBudget
    : null;
  const dismissBudgetNote = () => {
    if (budgetNoteBudget) updateSlurpSettings.mutate({ modelBudget: { ...budgetNoteBudget, raisedNotice: false } });
  };

  const shellProps = {
    appMode: "slurp" as const,
    activeView:
      navigation.mode === "creator-settings"
        ? ("settings" as const)
        : navigation.mode === "creator" && navigation.view === "profile"
          ? // Only the viewer's own Creator is "Profile"; another Creator's page highlights no tab (B14).
            navigation.accountId === mainAuthorProfile?.id
            ? ("profile" as const)
            : null
          : navigation.mode === "creator" && navigation.view === "search"
            ? ("search" as const)
            : navigation.mode === "creator" && navigation.view === "messages"
              ? ("messages" as const)
              : navigation.mode === "creator" && navigation.view === "wallet"
                ? ("wallet" as const)
                : navigation.mode === "creator" && (navigation.view === "stir" || navigation.view === "studio")
                  ? ("stir" as const)
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
    storyRings,
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
    onOpenStir: goToStir,
    // Pulse's tap-through (task C): the post a task made, your chat it wrote in, or the Creator.
    onOpenPulseTarget: (target: SlpPulseTarget) => {
      if ("chatCreatorId" in target) {
        onNavigate({ mode: "creator", view: "messages", creatorAccountId: target.chatCreatorId });
        return;
      }
      onNavigate({ mode: "creator", view: "profile", accountId: target.accountId });
      const postId = target.postId;
      if (postId) window.setTimeout(() => slpShowPostWhenRendered(postId), 250);
    },
    onOpenBudget: () =>
      onNavigate({ mode: "creator-settings", section: "world", target: "audience", settingKey: "modelBudget" }),
    pulseStarts: {
      // The Creator picker in Backstage; its Generate is a Pulse task (task B).
      onGeneratePosts: () =>
        onNavigate({ mode: "creator-settings", section: "overview", target: "overview", openRefresh: true }),
      // A failed task restored after a reload: the screen it started from (no dead end).
      onStartAgain: (screen, task) => {
        if (screen === "stir") void goToStir();
        else if (screen === "generate")
          onNavigate({ mode: "creator-settings", section: "overview", target: "overview", openRefresh: true });
        else if (screen === "add") setOnboardingMode("add-creators");
        else if (task.accountIds[0]) onNavigate({ mode: "creator", view: "profile", accountId: task.accountIds[0] });
      },
    },
    budgetNote: budgetNoteBudget
      ? {
          onOpenBudget: () => {
            dismissBudgetNote();
            onNavigate({ mode: "creator-settings", section: "world", target: "audience", settingKey: "modelBudget" });
          },
          onDismiss: dismissBudgetNote,
        }
      : undefined,
    // Unread messages only, the same number the Inbox's Messages section shows. Adding the Activity
    // stream's unseen count made the badge disagree with every count on the page it opens.
    notificationCount: (unreadCountQuery.data?.unread ?? 0) + (unreadCountQuery.data?.inboundUnread ?? 0),
    walletBalanceLabel: activeWalletCoins === null ? undefined : `${activeWalletCoins}`,
    walletBalance: viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins,
    personaBannerUrl: myCreatorProfile?.bannerUrl ?? null,
    onBecomeCreator:
      shellPersonaAccount && accountsQuery.isSuccess
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
          : shellPersonaAccount && accountsQuery.isSuccess
            ? { mode: "creator", view: "create-profile", sourceAccountId: shellPersonaAccount.id }
            : { mode: "creator", view: "profiles" },
      );
    },
    onOpenDashboard: mainAuthorProfile
      ? () => {
          setMobileDrawerOpen(false);
          onNavigate({ mode: "creator", view: "profile", accountId: mainAuthorProfile.id, dashboard: true });
        }
      : undefined,
    onOpenSettings: openSettings,
    // Every NoodleR branch spreads shellProps, so these mount once wherever the user is. The
    // Creator settings modal is opened from Backstage, from a Creator's profile and from a
    // settings search result, so it cannot belong to any one of those screens.
    overlays: (
      <>
        {/* The image prompt review, the share picker and G's thread belong to no one screen: mounted
            here, "Send in a chat" works on a profile and the thread shows wherever Slurp opens
            (R1-028, R1-135). */}
        <ImagePromptReviewModal
          open={Boolean(imagePromptReview)}
          items={imagePromptReview?.items ?? []}
          isSubmitting={confirmImagePrompts.isPending}
          onCancel={cancelReviewedImagePrompts}
          onConfirm={confirmReviewedImagePrompts}
        />
        <SlpSharePostModal
          post={model.sharingPost}
          personaId={viewerPersonaId}
          open={Boolean(model.sharingPost)}
          onClose={() => model.setSharingPost(null)}
        />
        <SlurpSplash open={splashOpen} onDismiss={() => setSplashOpen(false)} onLeave={onLeave} />
        {postCardController.imageLightbox && (
          <ChatImageLightbox
            image={postCardController.imageLightbox}
            alt={postCardController.imageLightbox.prompt || "Slurp image"}
            pinEnabled={false}
            onClose={() => postCardController.setImageLightbox(null)}
          />
        )}
        {/* B: a Stir plan that came back after the player left its box. */}
        <SlpStirReadyPlanHost />
        {/* W: the ✦ sheet, opened from a profile, a post's ⋯ or Creator tools. */}
        <SlpStirCreatorSheet
          personaId={viewerPersonaId}
          onOpenSupport={(creatorAccountId) =>
            onNavigate({ mode: "creator", view: "messages", creatorAccountId, asSupport: true })
          }
        />
        <SlpCreatorSettingsModal
          onRedraft={(creator) => {
            redraftFromSource(creator);
            onNavigate({
              mode: "creator",
              view: "profile",
              accountId: creator.id,
              ...(navigation.mode === "creator-settings" ? { returnToSettings: navigation } : {}),
            });
          }}
          onViewProfile={
            navigation.mode === "creator-settings"
              ? (creator) =>
                  onNavigate({ mode: "creator", view: "profile", accountId: creator.id, returnToSettings: navigation })
              : undefined
          }
        />
      </>
    ),
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
          onRestartOnboarding={() => {
            onboardingPresentedRef.current = true;
            setOnboardingMode("again");
          }}
          viewerPersonaId={viewerPersonaId}
        />
        <SlurpOnboardingWizard
          open={onboardingMode !== null}
          selectionOnly={onboardingMode === "add-creators"}
          opening={onboardingMode === "again" ? "again" : "first"}
          personaName={shellPersonaAccount?.displayName ?? ""}
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
  // Mounted once in the shell overlays; the screen branches get nothing to render twice.
  const reviewModal = null;

  // While Slurp itself loads or failed, the nav counts would come from other queries and lie over an
  // empty screen, so they stay hidden until the app is really there.
  if (accountsQuery.isLoading || accountsQuery.isError) {
    return (
      <SlpShell {...shellProps} noodlerUnseenCount={0} notificationCount={0}>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex h-14 shrink-0 items-center border-b border-[var(--noodle-divider)] px-3 @min-[1024px]:hidden">
            <SlpWordmark />
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto", SLP_PAGE_SCROLL_CLASS)}>
            {accountsQuery.isError ? (
              <SlpErrorState
                title={localizeUi("ui.noodle.noodlerhome.noodlerCouldNotBeLoaded")}
                detail={
                  // From another device, every Slurp route fails until the Admin Secret is set (#1136).
                  accountsQuery.error instanceof Error && /admin.secret/i.test(accountsQuery.error.message)
                    ? localizeUi("ui.slurp.state.adminSecretMissing")
                    : undefined
                }
                onRetry={retryAccountsOrReload}
              />
            ) : (
              <SlpSkeleton shape="hub" count={5} label={localizeUi("ui.slurp.state.loading")} />
            )}
          </div>
        </div>
      </SlpShell>
    );
  }

  const creatorFlow = renderSlurpHomeCreatorFlow({ model, shellProps, reviewModal });
  if (creatorFlow) return creatorFlow;

  if (navigation.mode === "creator" && navigation.view === "profile") {
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame onBack={goToHub} title={localizeUi("ui.noodle.noodlehome.profile")}>
          <SlpEmptyState title={localizeUi("ui.noodle.viewerhub.thisPersonaHasNoLinkedNoodlerProfile")} />
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
        onLoadMore={model.viewerQuery.loadMore}
        hasMore={Boolean(model.viewerQuery.data?.nextCursor)}
        isLoading={viewerQuery.isLoading}
        isError={viewerQuery.isError}
        onRetry={() => void viewerQuery.refetch()}
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
        onAddCreators={() => setOnboardingMode("add-creators")}
        onToggleSubscription={toggleCreatorSubscription}
        togglePending={toggleSubscription.isPending || toggleFollow.isPending}
        connectionCounts={connectionCountsQuery.data ?? {}}
        inlineAdsEnabled={slurpSettingsQuery.data?.inlineAdsEnabled !== false}
        inlineAdsFrequency={slurpSettingsQuery.data?.inlineAdsFrequency ?? "standard"}
        storyLifetimeHours={slurpSettingsQuery.data?.storyLifetimeHours ?? 72}
      />
      <SlurpOnboardingWizard
        // G's thread comes first; the Support ticket waits for it.
        open={onboardingMode !== null && !splashOpen}
        selectionOnly={onboardingMode === "add-creators"}
        opening={onboardingMode === "again" ? "again" : "first"}
        personaName={shellPersonaAccount?.displayName ?? ""}
        onLeave={onLeave}
        onClose={closeOnboarding}
        onComplete={() => {
          setOnboardingState("completed");
          setFeedTab("all");
        }}
        onSkipped={() => setOnboardingState("completed")}
      />
    </SlpShell>
  );
}

/**
 * The Story ring for every avatar under the shell (T): who has a live Story, seen or not, and a tap
 * that opens them. The hub opens its own Story viewer; anywhere else the Creator's profile opens and
 * plays them there, so a closed Story leaves the player on that page.
 */
function useSlurpStoryRings({
  viewerQuery,
  slurpSettingsQuery,
  navigation,
  onNavigate,
}: Pick<ReturnType<typeof useSlurpHomeState>, "viewerQuery" | "slurpSettingsQuery"> &
  Pick<SlurpHomeProps, "navigation" | "onNavigate">): SlpStoryRings {
  const [pending, setPending] = useState<string | null>(null);
  const now = useSlpMinuteClock();
  const cutoff = now - (slurpSettingsQuery.data?.storyLifetimeHours ?? 72) * 60 * 60 * 1000;
  const creators = viewerQuery.data?.creators;
  const live = useMemo(() => slurpLiveStories(creators ?? [], cutoff), [creators, cutoff]);
  const rings = useMemo(() => slpStoryRings(live), [live]);
  const onHub = navigation.mode === "creator" && (navigation.view === "hub" || navigation.view === "search");
  const onProfileOf = navigation.mode === "creator" && navigation.view === "profile" ? navigation.accountId : null;
  return useMemo(
    () => ({
      ringOf: (creatorId: string) => rings.get(creatorId) ?? null,
      open: (creatorId: string) => {
        setPending(creatorId);
        if (!onHub && onProfileOf !== creatorId) onNavigate({ mode: "creator", view: "profile", accountId: creatorId });
      },
      pending,
      taken: () => setPending(null),
      startOf: (creatorId: string) => slpStoryStartId(live, creatorId),
    }),
    [live, rings, pending, onHub, onProfileOf, onNavigate],
  );
}
