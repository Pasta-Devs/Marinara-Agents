import { NoodleShell } from "../../modules/chrome/SlpShell";
import { SlurpWalletView } from "./SlpScreenWallet";
import {
  type NoodlerPostDraft,
  type NoodlerPostSubmission,
  type PendingNoodlerImage,
  type NoodlerContentFormat,
  type NoodlerPostDraftImage,
  type SlurpViewerCreator,
  NOODLER_FEED_WINDOW_SIZE,
  SLURP_PLACEHOLDER_BALANCE,
  STAGE_PERSONALITY_MAX_LENGTH,
  EMPTY_NOODLER_POST_DRAFT,
  isEmptyNoodlerPostDraft,
  isSlurpStory,
  slurpSubscriptionPriceOf,
  linkedPostIdForStory,
  parsePrice,
  errorMessage,
  toNoodlePostCardModel,
  toManagedPostCardModel,
  serializeNoodlerPostGuide,
  noodlerGoalOf,
  SlurpAccessTransition,
  NoodlerDraftImageFrame,
  EmptyState,
  NoodlerFrame,
  DisclosureBadge,
  SlurpFeedSkeleton,
} from "./SlpHomeHelpers";
import { SlurpInboxView } from "./SlpScreenMessages";
import { SlurpStudioView } from "./SlpScreenStudio";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  Bell,
  BookmarkCheck,
  BookmarkPlus,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Crown,
  Eye,
  Gift,
  Heart,
  LayoutGrid,
  Link,
  List,
  Loader2,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  Avatar,
  getNoodleAccentStyle,
  SLURP_TOGGLE_ACTIVE_CLASS,
  NewSinceLastVisitDivider,
  HIDE_ON_SCROLL_CLASS,
  NoodleLogo,
  ProfileInitial,
  useHideOnScroll,
  NOODLE_PERSONA_SWITCHER_PAGE_SIZE,
  NOODLE_PINK,
} from "../../base/chrome/SlpChrome";
import {
  filterAndSortSlurpCreators,
  isSlurpDiscoveryProfileIncomplete,
  SLURP_DISCOVERY_TAGS,
  type SlurpDiscoverLayout,
  type SlurpDiscoverSort,
} from "../../features/discovery/slp-discovery";
import type { SlurpHomeHostView } from "./SlpHomeCreatorFlow";

/** The navigation destinations that are pages of their own: wallet, notifications, studio, messages, profiles. */
export function renderSlurpHomeDestinations({
  model,
  shellProps,
  reviewModal,
  feedRightRail,
  showDiscovery,
}: SlurpHomeHostView) {
  void [shellProps, reviewModal, feedRightRail, showDiscovery];
  const {
    accountsQuery,
    beginCreate,
    eligibleAccountsQuery,
    eligibleNoodleAccounts,
    exitToCreatorHub,
    localizeUi,
    myCreatorProfile,
    onNavigate,
    retryAccountsOrReload,
    shellPersonaAccount,
    sourcePickerLoading,
    viewerPersonaId,
    viewerWalletsQuery,
  } = model;
  if (navigation.mode === "creator" && navigation.view === "wallet") {
    return (
      <NoodleShell {...shellProps}>
        <SlurpWalletView
          personaId={viewerPersonaId}
          fallbackCoins={viewerWalletsQuery.data?.[viewerPersonaId ?? ""]?.coins ?? SLURP_PLACEHOLDER_BALANCE}
          personaName={shellPersonaAccount?.displayName ?? ""}
          personaAvatarUrl={shellPersonaAccount?.avatarUrl ?? null}
          personaAvatarCrop={shellPersonaAccount?.avatarCrop ?? null}
          creatorAvatarCrop={myCreatorProfile?.avatarCrop ?? null}
          onBack={exitToCreatorHub}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "notifications") {
    return (
      <NoodleShell {...shellProps} contextualRail="spanning">
        <SlurpInboxView
          personaId={viewerPersonaId}
          ownedCreatorAccountIds={myCreatorProfile ? [myCreatorProfile.id] : []}
          composeWithCreatorAccountId={null}
          initialActivity
          onBack={exitToCreatorHub}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "studio") {
    return (
      <NoodleShell {...shellProps}>
        <SlurpStudioView
          personaId={viewerPersonaId}
          onBack={exitToCreatorHub}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "messages") {
    return (
      <NoodleShell {...shellProps} contextualRail="spanning">
        <SlurpInboxView
          personaId={viewerPersonaId}
          ownedCreatorAccountIds={myCreatorProfile ? [myCreatorProfile.id] : []}
          composeWithCreatorAccountId={navigation.creatorAccountId ?? null}
          initialActivity={false}
          onBack={navigation.returnTo ? () => onNavigate(navigation.returnTo!) : exitToCreatorHub}
          leaveOnExit={Boolean(navigation.returnTo)}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
        />
      </NoodleShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "profiles") {
    return (
      <NoodleShell {...shellProps}>
        <div className="flex h-full min-h-0 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3">
              {navigation.returnToSettings && (
                <button
                  type="button"
                  onClick={() => onNavigate(navigation.returnToSettings!)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--accent)]"
                  aria-label={localizeUi("ui.noodle.socialsettings.backToSettings")}
                  title={localizeUi("ui.noodle.socialsettings.backToSettings")}
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{localizeUi("ui.noodle.noodlerhome.stageProfiles")}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.noodle.noodlerhome.noodlerIdentitiesAndGuidedPosts")}
                </p>
              </div>
              {shellPersonaAccount && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigate(
                      myCreatorProfile
                        ? { mode: "creator", view: "profile", accountId: myCreatorProfile.id }
                        : {
                            mode: "creator",
                            view: "create-profile",
                            sourceAccountId: shellPersonaAccount.id,
                          },
                    )
                  }
                  title={localizeUi("ui.noodle.noodlerhome.myCreatorProfileDetail", {
                    persona: shellPersonaAccount.displayName,
                  })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
                >
                  <UserRound size={15} />
                  {localizeUi(
                    myCreatorProfile
                      ? "ui.noodle.noodlerhome.myCreatorProfile"
                      : "ui.noodle.noodlerhome.createMyCreatorProfile",
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={beginCreate}
                disabled={sourcePickerLoading || eligibleAccountsQuery.isError || eligibleNoodleAccounts.length === 0}
                title={
                  sourcePickerLoading
                    ? localizeUi("ui.noodle.noodlerhome.loadingEligibleSources")
                    : eligibleAccountsQuery.isError
                      ? localizeUi("ui.noodle.noodlerhome.sourcesUnavailable")
                      : eligibleNoodleAccounts.length === 0
                        ? localizeUi("ui.noodle.noodlerhome.everyEligibleAccountAlreadyHasAStageProfile")
                        : undefined
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} />
                {localizeUi("ui.noodle.noodlerhome.newProfile")}
              </button>
            </div>
            {accountsQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-[var(--noodle-accent)]" />
              </div>
            ) : accountsQuery.isError ? (
              <EmptyState
                title={localizeUi("ui.noodle.noodlerhome.stageProfilesCouldNotBeLoaded")}
                action={localizeUi("capabilities.actions.tryAgain")}
                onAction={retryAccountsOrReload}
                icon={TriangleAlert}
              />
            ) : accountsQuery.data && accountsQuery.data.length > 0 ? (
              <div className="divide-y divide-[var(--noodle-divider)]">
                {accountsQuery.data.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() =>
                      onNavigate({
                        mode: "creator",
                        view: "profile",
                        accountId: profile.id,
                        ...(navigation.returnToSettings && { returnToSettings: navigation.returnToSettings }),
                      })
                    }
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-4 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
                  >
                    <ProfileInitial profile={profile} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold">{profile.displayName}</h3>
                        <DisclosureBadge mode={profile.disclosureMode} />
                        {isSlurpDiscoveryProfileIncomplete(profile) && (
                          <span
                            title={localizeUi("ui.slurp.profile.incompleteDetail")}
                            className="rounded-full border border-amber-500/50 px-2 py-0.5 text-[0.68rem] font-bold text-amber-600 dark:text-amber-400"
                          >
                            {localizeUi("ui.slurp.profile.incomplete")}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {profile.disclosureMode
                          ? localizeUi("ui.noodle.noodlehome.value1_0a5edda", { value1: profile.handle })
                          : localizeUi("ui.noodle.noodlerhome.completeThisLegacyStageProfile")}
                      </p>
                    </div>
                    <ChevronRight size={17} className="shrink-0 text-[var(--muted-foreground)]" />
                  </button>
                ))}
              </div>
            ) : (
              // With no profiles and no eligible sources loaded, the create button is disabled, so a
              // failed sources query would leave the page with nothing to act on but a page reload.
              <EmptyState
                title={
                  eligibleAccountsQuery.isError
                    ? localizeUi("ui.noodle.noodlerhome.sourcesUnavailable")
                    : localizeUi("ui.noodle.noodlerhome.noStageProfilesYet")
                }
                detail={localizeUi("ui.noodle.noodlerhome.createStageIdentityDetail")}
                action={
                  eligibleAccountsQuery.isError
                    ? localizeUi("capabilities.actions.tryAgain")
                    : eligibleNoodleAccounts.length > 0
                      ? localizeUi("ui.noodle.noodlehome.createStageProfile")
                      : undefined
                }
                onAction={
                  eligibleAccountsQuery.isError
                    ? () => void eligibleAccountsQuery.refetch()
                    : eligibleNoodleAccounts.length > 0
                      ? beginCreate
                      : undefined
                }
                icon={eligibleAccountsQuery.isError ? TriangleAlert : undefined}
              />
            )}
          </main>
        </div>
      </NoodleShell>
    );
  }
  return null;
}
