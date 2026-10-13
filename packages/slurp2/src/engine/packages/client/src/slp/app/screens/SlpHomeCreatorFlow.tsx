import { EMPTY_STAGE_PROFILE } from "./SlpHomeHelpers";
import { SlpShell } from "../../modules/chrome/SlpShell";
import { EMPTY_SLP_CREATOR_POST_DRAFT, errorMessage, SlpCreatorFrame } from "./SlpHomeHelpers";
import { StageProfileSourcePicker, DisclosureStep } from "./SlpScreenCreateProfile";
import { toast } from "sonner";
import { StageProfileForm } from "../../features/creators/SlpStageProfileForm";
import { openSlpCreatorSettings } from "../../features/creators/settings/slp-creator-settings-store";
import { ChevronRight, LayoutGrid, Pencil, Plus } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { cn } from "../../../lib/utils";
import { SLP_EYEBROW_CLASS, SLP_PAGE_SCROLL_CLASS, SLP_RAIL_GROUP_CLASS } from "../../base/chrome/SlpChrome";
import { SlurpCreatorProfileCard } from "../../modules/creator/SlpCreatorProfileCard";
import { StageProfileView } from "./SlpScreenProfile";
import type { ReactNode } from "react";
import type { SlpShellProps } from "../../modules/chrome/slp-shell.types";
import type { useSlurpHomeState } from "../slp-home-actions";

export type SlurpHomeHostView = {
  model: ReturnType<typeof useSlurpHomeState>;
  shellProps: Omit<SlpShellProps, "children">;
  reviewModal: ReactNode;
  feedRightRail?: ReactNode;
  showDiscovery?: boolean;
};

/** Creator setup and the selected stage profile: every branch that edits a Creator. */
export function renderSlurpHomeCreatorFlow({
  model,
  shellProps,
  reviewModal,
  feedRightRail,
  showDiscovery,
}: SlurpHomeHostView) {
  void [shellProps, reviewModal, feedRightRail, showDiscovery];
  const {
    accountsQuery,
    autoPostSetupId,
    cancelCreateProfile,
    changeDisclosure,
    clearNoodlerPostDraft,
    closeProfileEditor,
    composerOpenSignal,
    connectionCountsQuery,
    connections,
    createPost,
    createProfile,
    creationDisclosure,
    creationImageNameKnown,
    setCreationImageNameKnown,
    creationStep,
    draftConnectionId,
    draftGuidance,
    draftNoodleAccountId,
    editingProfileId,
    eligibleAccountsQuery,
    eligibleNoodleAccounts,
    generateDraft,
    generateProfileDraft,
    handleSourceKind,
    handleSourceSearch,
    invalidateProfileDraftGeneration,
    localizeUi,
    navigation,
    noodlerPostDrafts,
    onNavigate,
    postCardCtx,
    postsQuery,
    previousDraft,
    profileDraft,
    profileReturnView,
    removeAvatar,
    runAutoPostNow,
    saveProfile,
    selectedProfile,
    selectedSource,
    selectedViewerCreator,
    setAcceptSourceChangesForProfileId,
    setAutoPostSetupId,
    setComposerOpenSignal,
    setCreationDisclosure,
    setCreationStep,
    setDraftConnectionId,
    setDraftGuidance,
    setDraftNoodleAccountId,
    setPreviousDraft,
    setProfileDraft,
    setProfileDraftDirty,
    setupAutoPosting,
    shellPersonaAccount,
    slurpSettingsQuery,
    sourceKind,
    sourceSearch,
    submitManualPost,
    submitRunNow,
    toggleCreatorFollow,
    toggleCreatorSubscription,
    toggleFollow,
    toggleSubscription,
    unlockPost,
    updateNoodlerPostDraft,
    updateProfile,
    uploadAvatar,
    useSourceAvatar,
    viewerAccounts,
    viewerActorAccount,
    viewerPersonaId,
    viewerQuery,
  } = model;
  if (creationStep === "source") {
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame
          onBack={() => setCreationStep(null)}
          title={localizeUi("ui.noodle.noodlehome.createStageProfile")}
          hideBack
        >
          <StageProfileSourcePicker
            accounts={eligibleNoodleAccounts}
            search={sourceSearch}
            kind={sourceKind}
            selectedId={draftNoodleAccountId}
            onSearch={handleSourceSearch}
            onKindChange={handleSourceKind}
            onSelect={(accountId) => {
              invalidateProfileDraftGeneration();
              setDraftNoodleAccountId(accountId);
            }}
            hasMore={Boolean(eligibleAccountsQuery.hasNextPage)}
            isLoadingMore={eligibleAccountsQuery.isFetchingNextPage}
            isLoading={eligibleAccountsQuery.isLoading}
            isError={eligibleAccountsQuery.isError}
            onRetry={() => void eligibleAccountsQuery.refetch()}
            onLoadMore={() => void eligibleAccountsQuery.fetchNextPage()}
            onBack={cancelCreateProfile}
            onContinue={() => setCreationStep("disclosure")}
          />
        </SlpCreatorFrame>
      </SlpShell>
    );
  }

  if (creationStep === "disclosure") {
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame
          onBack={cancelCreateProfile}
          title={localizeUi("ui.noodle.noodlerhome.setIdentityDisclosure")}
          hideBack
        >
          <DisclosureStep
            source={selectedSource}
            value={creationDisclosure}
            onChange={setCreationDisclosure}
            imageNameKnown={creationImageNameKnown}
            onImageNameChange={setCreationImageNameKnown}
            onBack={
              navigation.mode === "creator" && navigation.view === "create-profile"
                ? cancelCreateProfile
                : () => setCreationStep("source")
            }
            onContinue={() => setCreationStep("draft")}
          />
        </SlpCreatorFrame>
      </SlpShell>
    );
  }

  if (creationStep === "automatic" && autoPostSetupId) {
    const accountId = autoPostSetupId;
    const finishSetup = () => {
      setAutoPostSetupId(null);
      setCreationStep(null);
      onNavigate({ mode: "creator", view: "profile", accountId });
    };
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame
          onBack={finishSetup}
          title={localizeUi("ui.noodle.stageprofileview.automaticPosting")}
          hideBack
        >
          <div className="mx-auto max-w-md space-y-5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-bold">
                {localizeUi("ui.noodle.noodlerhome.shouldThisCreatorPostAutomatically")}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.noodlerhome.automaticPostsPublishAsSubscriberAccessOnASchedule")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={finishSetup}
                className="h-10 flex-1 rounded-full border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
              >
                {localizeUi("ui.chat.dependencyworkspaceapprovalcard.notNow")}
              </button>
              <button
                type="button"
                disabled={setupAutoPosting.isPending}
                onClick={() =>
                  setupAutoPosting.mutate(
                    { accountId, enabled: true },
                    {
                      onSuccess: finishSetup,
                      onError: (error) =>
                        toast.error(
                          errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotEnableAutomaticPosting")),
                        ),
                    },
                  )
                }
                className="h-10 flex-1 rounded-full border border-transparent bg-[var(--noodle-accent)] px-3 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] disabled:opacity-50"
              >
                {setupAutoPosting.isPending
                  ? localizeUi("ui.noodle.noodlerhome.enabling_5c258f0")
                  : localizeUi("ui.noodle.noodlerhome.turnOn")}
              </button>
            </div>
          </div>
        </SlpCreatorFrame>
      </SlpShell>
    );
  }

  if ((profileDraft || creationStep === "draft") && !editingProfileId) {
    return (
      <SlpShell {...shellProps}>
        <SlpCreatorFrame
          onBack={editingProfileId ? closeProfileEditor : () => setCreationStep("disclosure")}
          title={
            editingProfileId
              ? localizeUi("ui.noodle.noodlerhome.editStageProfile")
              : localizeUi("ui.noodle.noodlehome.createStageProfile")
          }
          hideBack={!editingProfileId}
        >
          <StageProfileForm
            draft={profileDraft ?? { ...EMPTY_STAGE_PROFILE, disclosureMode: creationDisclosure }}
            source={selectedSource}
            disclosureMode={creationDisclosure}
            onDisclosureChange={changeDisclosure}
            guidance={draftGuidance}
            onGuidanceChange={setDraftGuidance}
            connections={connections}
            connectionId={draftConnectionId}
            onConnectionChange={setDraftConnectionId}
            onGenerate={generateDraft}
            isGenerating={generateProfileDraft.isPending}
            previousDraft={previousDraft}
            onUndoDraft={() => {
              if (!previousDraft) return;
              invalidateProfileDraftGeneration();
              setProfileDraft(previousDraft);
              setPreviousDraft(null);
              setAcceptSourceChangesForProfileId(null);
            }}
            onChange={(patch) => {
              setProfileDraftDirty(true);
              setProfileDraft((current) => ({
                ...(current ?? { ...EMPTY_STAGE_PROFILE, disclosureMode: creationDisclosure }),
                ...patch,
              }));
            }}
            sourceAccountId={draftNoodleAccountId}
            accentId={editingProfileId ?? draftNoodleAccountId ?? "new-profile"}
            isEditing={Boolean(editingProfileId)}
            isPending={createProfile.isPending || updateProfile.isPending}
            avatar={
              editingProfileId ? (accountsQuery.data?.find((profile) => profile.id === editingProfileId) ?? null) : null
            }
            sourceAvatarUrl={selectedSource?.avatarUrl ?? null}
            avatarPending={uploadAvatar.isPending || useSourceAvatar.isPending || removeAvatar.isPending}
            onUploadAvatar={(file) => {
              if (!editingProfileId) return;
              uploadAvatar.mutate(
                { accountId: editingProfileId, file },
                {
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.stageprofileform.couldNotUpdateAvatar"))),
                },
              );
            }}
            onUseSourceAvatar={() => {
              if (!editingProfileId) return;
              useSourceAvatar.mutate(
                { accountId: editingProfileId },
                {
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.stageprofileform.couldNotUpdateAvatar"))),
                },
              );
            }}
            onRemoveAvatar={() => {
              if (!editingProfileId) return;
              removeAvatar.mutate(
                { accountId: editingProfileId },
                {
                  onError: (error) =>
                    toast.error(errorMessage(error, localizeUi("ui.noodle.stageprofileform.couldNotUpdateAvatar"))),
                },
              );
            }}
            onCancel={editingProfileId ? closeProfileEditor : cancelCreateProfile}
            onSave={saveProfile}
          />
        </SlpCreatorFrame>
      </SlpShell>
    );
  }

  if (selectedProfile) {
    const ownsSelectedProfile = selectedProfile.sourceAccountId === viewerPersonaId;
    const similarCreators = (viewerQuery.data?.creators ?? [])
      .filter(
        (creator) => creator.profile.id !== selectedProfile.id && creator.profile.sourceAccountId !== viewerPersonaId,
      )
      .slice(0, 5);
    const profileRail = ownsSelectedProfile ? (
      <aside
        className="relative hidden w-[20rem] shrink-0 overflow-hidden px-4 py-5 @min-[1280px]:block"
        aria-labelledby="slurp-creator-tools-heading"
      >
        <div className="sticky top-4 space-y-3">
          <h2 id="slurp-creator-tools-heading" className={cn(SLP_EYEBROW_CLASS, "px-1")}>
            {localizeUi("ui.slurp.profile.creatorTools", { defaultValue: "Creator tools" })}
          </h2>
          <section className="overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]">
            {[
              {
                label: localizeUi("ui.slurp.profile.editProfile", { defaultValue: "Edit profile" }),
                icon: Pencil,
                action: () => openSlpCreatorSettings(selectedProfile.id, { tab: "identity" }),
              },
              {
                label: localizeUi("ui.slurp.profile.createPost", { defaultValue: "Create post" }),
                icon: Plus,
                action: () => {
                  updateNoodlerPostDraft(selectedProfile.id, { postType: "post", poll: null });
                  setComposerOpenSignal((tick) => tick + 1);
                },
              },
              {
                label: localizeUi("ui.slurp.profile.addStory", { defaultValue: "Add story" }),
                icon: SlpSparkleGlyph,
                action: () => {
                  updateNoodlerPostDraft(selectedProfile.id, { postType: "story", poll: null, title: "" });
                  setComposerOpenSignal((tick) => tick + 1);
                },
              },
              {
                // W: Studio's own-page half is the Dashboard sheet on the profile now.
                label: localizeUi("ui.slurp.profile.openDashboard"),
                icon: LayoutGrid,
                action: () =>
                  onNavigate({ mode: "creator", view: "profile", accountId: selectedProfile.id, dashboard: true }),
              },
            ].map(({ label, icon: Icon, action }, index) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]",
                  index > 0 && "border-t border-[var(--noodle-divider)]",
                )}
              >
                <Icon size={17} className="text-[var(--noodle-accent-foreground)]" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronRight size={15} className="text-[var(--muted-foreground)]" aria-hidden="true" />
              </button>
            ))}
          </section>
        </div>
      </aside>
    ) : similarCreators.length > 0 ? (
      <aside
        className="relative hidden w-[20rem] shrink-0 overflow-hidden px-4 py-5 @min-[1280px]:block"
        aria-labelledby="slurp-similar-creators-heading"
      >
        <div className="sticky top-4 space-y-3">
          <h2 id="slurp-similar-creators-heading" className={cn(SLP_EYEBROW_CLASS, "px-1")}>
            {localizeUi("ui.slurp.profile.similarCreators", { defaultValue: "More creators" })}
          </h2>
          {/* Compact rows in one raised group (design step 3): five Creators fit where two tall cards did. */}
          <div className={SLP_RAIL_GROUP_CLASS}>
            {similarCreators.map((creator) => (
              <SlurpCreatorProfileCard
                key={creator.profile.id}
                creator={creator}
                layout="row"
                onOpenProfile={(accountId) => onNavigate({ mode: "creator", view: "profile", accountId })}
              />
            ))}
          </div>
        </div>
      </aside>
    ) : undefined;
    return (
      <SlpShell {...shellProps} contextualRail={profileRail ? "populated" : "spanning"} rightRail={profileRail}>
        <div className={cn("h-full min-h-0 overflow-y-auto", SLP_PAGE_SCROLL_CLASS)}>
          <StageProfileView
            key={`${selectedProfile.id}:${shellPersonaAccount?.id ?? "no-viewer"}`}
            profile={selectedProfile}
            openDashboard={
              navigation.mode === "creator" && navigation.view === "profile" && navigation.dashboard === true
            }
            profileDraft={editingProfileId === selectedProfile.id ? profileDraft : null}
            composerOpenSignal={composerOpenSignal}
            onComposerOpened={() => setComposerOpenSignal(0)}
            onProfileChange={(patch) => setProfileDraft((current) => (current ? { ...current, ...patch } : current))}
            onCancelEdit={closeProfileEditor}
            onSaveEdit={(location) => void saveProfile(location)}
            profileSavePending={updateProfile.isPending}
            onOpenMessages={(creatorAccountId) =>
              onNavigate({ mode: "creator", view: "messages", creatorAccountId, returnTo: navigation })
            }
            posts={postsQuery.data ?? []}
            viewerCreator={selectedViewerCreator}
            viewerAccount={shellPersonaAccount}
            viewerActorAccount={viewerActorAccount}
            slurpSettings={slurpSettingsQuery.data ?? null}
            postCardCtx={postCardCtx}
            viewerAccounts={viewerAccounts}
            connectionCounts={connectionCountsQuery.data ?? null}
            viewerIsLoading={Boolean(viewerPersonaId) && !viewerQuery.data && viewerQuery.isLoading}
            viewerIsError={Boolean(viewerPersonaId) && !viewerQuery.data && viewerQuery.isError}
            onRetryViewer={() => void viewerQuery.refetch()}
            draft={noodlerPostDrafts[selectedProfile.id] ?? EMPTY_SLP_CREATOR_POST_DRAFT}
            onDraftChange={(patch) => updateNoodlerPostDraft(selectedProfile.id, patch)}
            onClearDraft={() => clearNoodlerPostDraft(selectedProfile.id)}
            onDiscardDraft={() => clearNoodlerPostDraft(selectedProfile.id)}
            isLoading={postsQuery.isLoading}
            isError={postsQuery.isError}
            onRetry={() => void postsQuery.refetch()}
            onEdit={() => openSlpCreatorSettings(selectedProfile.id, { tab: "identity" })}
            onBack={() =>
              navigation.mode === "creator" && navigation.view === "profile" && navigation.returnToSettings
                ? onNavigate(navigation.returnToSettings)
                : onNavigate({ mode: "creator", view: profileReturnView.current })
            }
            onManualPost={submitManualPost}
            manualPending={createPost.isPending}
            onRunNow={submitRunNow}
            runNowPending={runAutoPostNow.isPending}
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
            unlockPending={unlockPost.isPending}
            onToggleFollow={toggleCreatorFollow}
            followPending={toggleFollow.isPending}
            onToggleSubscription={toggleCreatorSubscription}
            subscriptionPending={toggleSubscription.isPending}
          />
        </div>
        {reviewModal}
      </SlpShell>
    );
  }
  return null;
}
