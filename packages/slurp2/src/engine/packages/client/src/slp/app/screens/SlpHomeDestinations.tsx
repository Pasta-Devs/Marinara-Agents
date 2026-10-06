import type { ComponentProps } from "react";
import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpShell } from "../../modules/chrome/SlpShell";
import { openSlpPulse } from "../../base/state/slp-task-store";
import { SlurpWalletView } from "./SlpScreenWallet";
import { DisclosureBadge } from "./SlpHomeHelpers";
import { SlurpInboxView } from "./SlpScreenMessages";
import { SlpStirScreen } from "../../features/stir/slp-stir-contract";
import { ChevronLeft, ChevronRight, Plus, TriangleAlert, UserRound } from "lucide-react";
import { ProfileInitial, SLP_PAGE_SCROLL_CLASS } from "../../base/chrome/SlpChrome";
import { cn } from "../../../lib/utils";
import { isSlurpDiscoveryProfileIncomplete } from "../../features/discovery/slp-discovery";
import type { SlurpHomeHostView } from "./SlpHomeCreatorFlow";

/** The navigation destinations that are pages of their own: wallet, notifications, Stir, messages, profiles. */
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
    navigation,
    myCreatorProfile,
    onNavigate,
    retryAccountsOrReload,
    shellPersonaAccount,
    sourcePickerLoading,
    viewerPersonaId,
  } = model;
  // These pages all read one persona's data; with none there is nothing to load, so they said
  // "Still connecting…" forever or offered a Try again that could not work (R1-139).
  if (
    navigation.mode === "creator" &&
    !viewerPersonaId &&
    (navigation.view === "wallet" || navigation.view === "messages" || navigation.view === "notifications")
  ) {
    return (
      <SlpShell {...shellProps}>
        <SlpEmptyState title={localizeUi("ui.noodle.viewerhub.createAPersonaToBrowseNoodler")} />
      </SlpShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "wallet") {
    return (
      <SlpShell {...shellProps}>
        <SlurpWalletView
          personaId={viewerPersonaId}
          personaName={shellPersonaAccount?.displayName ?? ""}
          personaAvatarUrl={shellPersonaAccount?.avatarUrl ?? null}
          personaAvatarCrop={shellPersonaAccount?.avatarCrop ?? null}
          creatorAvatarCrop={myCreatorProfile?.avatarCrop ?? null}
          onBack={exitToCreatorHub}
        />
      </SlpShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "notifications") {
    return (
      <SlpShell {...shellProps} contextualRail="spanning">
        <SlurpInboxView
          personaId={viewerPersonaId}
          ownedCreatorAccountIds={myCreatorProfile ? [myCreatorProfile.id] : []}
          composeWithCreatorAccountId={null}
          initialActivity
          onBack={exitToCreatorHub}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
        />
      </SlpShell>
    );
  }

  // W: the Stir tab. An old Studio link lands here too (its own-page half is the profile's Dashboard).
  if (navigation.mode === "creator" && (navigation.view === "stir" || navigation.view === "studio")) {
    return (
      <SlpShell {...shellProps}>
        <SlpStirTab
          personaId={viewerPersonaId}
          onOpenSettings={() =>
            onNavigate({ mode: "creator-settings", section: "stir", target: "stir", settingKey: "drama" })
          }
          onOpenTarget={shellProps.onOpenPulseTarget}
          onOpenSupport={(creatorAccountId) =>
            onNavigate({
              mode: "creator",
              view: "messages",
              creatorAccountId,
              asSupport: true,
              returnTo: { mode: "creator", view: "stir" },
            })
          }
          onOpenDashboard={
            myCreatorProfile
              ? () => onNavigate({ mode: "creator", view: "profile", accountId: myCreatorProfile.id, dashboard: true })
              : undefined
          }
        />
      </SlpShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "messages") {
    return (
      <SlpShell {...shellProps} contextualRail="spanning">
        <SlurpInboxView
          personaId={viewerPersonaId}
          ownedCreatorAccountIds={myCreatorProfile ? [myCreatorProfile.id] : []}
          composeWithCreatorAccountId={navigation.creatorAccountId ?? null}
          composeAsSupport={navigation.asSupport === true}
          initialActivity={false}
          onBack={navigation.returnTo ? () => onNavigate(navigation.returnTo!) : exitToCreatorHub}
          leaveOnExit={Boolean(navigation.returnTo)}
          onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
          onOpenDesk={() => onNavigate({ mode: "creator", view: "stir" })}
        />
      </SlpShell>
    );
  }

  if (navigation.mode === "creator" && navigation.view === "profiles") {
    return (
      <SlpShell {...shellProps}>
        <div className="flex h-full min-h-0 flex-col">
          <main className={cn("min-h-0 flex-1 overflow-y-auto", SLP_PAGE_SCROLL_CLASS)}>
            <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-3">
              {navigation.returnToSettings && (
                <button
                  type="button"
                  onClick={() => onNavigate(navigation.returnToSettings!)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent-foreground)] hover:bg-[var(--accent)]"
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
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} />
                {localizeUi("ui.noodle.noodlerhome.newProfile")}
              </button>
            </div>
            {accountsQuery.isLoading ? (
              <SlpSkeleton count={3} />
            ) : accountsQuery.isError ? (
              <SlpErrorState
                title={localizeUi("ui.noodle.noodlerhome.stageProfilesCouldNotBeLoaded")}
                onRetry={retryAccountsOrReload}
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
              <SlpEmptyState
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
      </SlpShell>
    );
  }
  return null;
}

/** The Stir tab inside the shell: "See all" opens the shell's Pulse sheet; a recent play opens what it touched. */
function SlpStirTab({
  personaId,
  onOpenDashboard,
  onOpenTarget,
  onOpenSupport,
  onOpenSettings,
}: {
  personaId: string | null;
  onOpenSettings?: () => void;
  onOpenDashboard?: () => void;
  onOpenTarget?: ComponentProps<typeof SlpStirScreen>["onOpenTarget"];
  onOpenSupport?: (creatorId: string) => void;
}) {
  return (
    <SlpStirScreen
      personaId={personaId}
      onOpenSupport={onOpenSupport}
      onOpenSettings={onOpenSettings}
      onOpenPulse={openSlpPulse}
      onOpenDashboard={onOpenDashboard}
      onOpenTarget={onOpenTarget}
    />
  );
}
