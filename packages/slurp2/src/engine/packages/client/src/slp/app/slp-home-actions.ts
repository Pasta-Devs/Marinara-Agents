import type { SlpIdentityDisclosure } from "../../../../shared/src/slp/slp-social.types.js";
import type { SlurpManagedStageProfile, SlurpStageProfileInput } from "../base/state/slp-state-types";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { type SlpCreatorPostSubmission, errorMessage } from "./screens/SlpHomeHelpers";
import type { ImagePromptOverride } from "../../components/ui/ImagePromptReviewModal";
import { confirmSlurpAvatarReview } from "../features/creators/SlpStageProfileForm";
import { ApiError } from "../../lib/api-client";
import { toast } from "sonner";
import { startSlpTask } from "../base/state/slp-task-store";
import { useCancelCreatorImagePrompts } from "../features/feed/slp-feed-post-hooks";
import { useSlurpHomeBaseState, type SlurpHomeBaseState } from "./slp-home-state";
import type { SlurpHomeProps } from "./slp-home.types";

/**
 * What the Creator Hub does: open and close the profile editor, generate and save a stage
 * profile, post, and follow or subscribe to somebody.
 *
 * They all write the state the host renders, so they take it whole; the model below is the two
 * halves joined and is what the host still calls.
 */
function useSlurpHomeActions(state: SlurpHomeBaseState) {
  const cancelImagePrompts = useCancelCreatorImagePrompts();
  const {
    navigation,
    onNavigate,
    acceptSourceChangesForProfileId,
    accountsQuery,
    clearProfileEditorState,
    confirmDiscardProfileDraft,
    confirmImagePrompts,
    confirmProviderDisclosure,
    connections,
    createPost,
    createProfile,
    creationDisclosure,
    creationImageNameKnown,
    draftConnectionId,
    draftGuidance,
    draftNoodleAccountId,
    draftSourceRevisionToken,
    draftSourceSnapshot,
    editingProfileId,
    generatePostImage,
    generateProfileDraft,
    imagePromptReview,
    invalidateProfileDraftGeneration,
    localizeUi,
    prepareNavigationAwayFromProfileEditor,
    profileDraft,
    profileDraftGenerationIdRef,
    profileReturnToSettingsRef,
    runAutoPostNow,
    setAcceptSourceChangesForProfileId,
    setAutoPostSetupId,
    setCreationDisclosure,
    setCreationImageNameKnown,
    setCreationStep,
    setDraftConnectionId,
    setDraftGuidance,
    setDraftNoodleAccountId,
    setDraftSourceRevisionToken,
    setDraftSourceSnapshot,
    setEditingProfileId,
    setImagePromptReview,
    setMobileDrawerOpen,
    setPreviousDraft,
    setProfileDraft,
    setProfileDraftDirty,
    setSourceKind,
    setSourceSearch,
    shellPersonaAccount,
    toggleFollow,
    toggleSubscription,
    updateNoodlerPostDraft,
    setComposerOpenSignal,
    updateProfile,
    updateProfileLocation,
    viewerPersonaId,
  } = state;

  const beginCreate = () => {
    invalidateProfileDraftGeneration();
    setEditingProfileId(null);
    setDraftNoodleAccountId(null);
    setProfileDraft(null);
    setProfileDraftDirty(false);
    setCreationStep("source");
    setCreationDisclosure("hinted");
    setCreationImageNameKnown(true);
    setDraftGuidance("");
    setDraftConnectionId("");
    setPreviousDraft(null);
    setSourceSearch("");
    setSourceKind("all");
  };

  const cancelCreateProfile = async () => {
    if (!(await confirmDiscardProfileDraft())) return;
    invalidateProfileDraftGeneration();
    const sourceAccountId =
      navigation.mode === "creator" && navigation.view === "create-profile"
        ? navigation.sourceAccountId
        : draftNoodleAccountId;
    setCreationStep(null);
    setProfileDraft(null);
    setProfileDraftDirty(false);
    setDraftNoodleAccountId(null);
    setPreviousDraft(null);
    if (sourceAccountId && navigation.mode === "creator" && navigation.view === "create-profile") {
      onNavigate({ mode: "creator", view: "hub" });
    }
  };

  const beginEdit = (profile: SlurpManagedStageProfile) => {
    invalidateProfileDraftGeneration();
    setAcceptSourceChangesForProfileId(null);
    setDraftSourceSnapshot(null);
    setDraftSourceRevisionToken(null);
    setEditingProfileId(profile.id);
    profileReturnToSettingsRef.current =
      navigation.mode === "creator" && navigation.view === "profile" ? (navigation.returnToSettings ?? null) : null;
    setDraftNoodleAccountId(profile.sourceAccountId);
    setCreationDisclosure(profile.disclosureMode ?? "hinted");
    setCreationStep("draft");
    setDraftGuidance("");
    setDraftConnectionId("");
    setPreviousDraft(null);
    setProfileDraft({
      displayName: profile.displayName,
      handle: profile.handle,
      bio: profile.bio,
      stagePersonality: profile.stagePersonality,
      appearance: profile.appearance,
      wardrobe: profile.wardrobe,
      locations: profile.locations,
      clothingStyle: profile.clothingStyle ?? "auto",
      disclosureMode: profile.disclosureMode ?? "hinted",
      gender: profile.gender,
      tags: profile.tags,
    });
    setProfileDraftDirty(false);
  };

  const closeProfileEditor = async () => {
    await prepareNavigationAwayFromProfileEditor();
  };

  const changeDisclosure = (value: SlpIdentityDisclosure) => {
    setCreationDisclosure(value);
    setProfileDraftDirty(true);
    setProfileDraft((current) => (current ? { ...current, disclosureMode: value } : current));
  };

  const generateDraft = async (options?: {
    noodlerAccountId?: string;
    disclosureMode?: SlpIdentityDisclosure;
    guidance?: string;
    currentDraft?: SlurpStageProfileInput;
  }) => {
    const noodlerAccountId = options?.noodlerAccountId ?? editingProfileId;
    if (!draftNoodleAccountId && !noodlerAccountId) {
      toast.error(localizeUi("ui.noodle.noodlerhome.noSourceSelectedForThisDraft"));
      return;
    }
    if (connections.length === 0) {
      toast.error(localizeUi("ui.noodle.stageprofileform.noConnectionsConfiguredAddOneInSettingsConnections"));
      return;
    }
    if (!(await confirmProviderDisclosure())) return;
    const generationId = ++profileDraftGenerationIdRef.current;
    const draftForGeneration = options?.currentDraft ?? profileDraft;
    generateProfileDraft.mutate(
      {
        ...(noodlerAccountId ? { noodlerAccountId } : { noodleAccountId: draftNoodleAccountId! }),
        disclosureMode: options?.disclosureMode ?? creationDisclosure,
        guidance: options?.guidance ?? draftGuidance,
        currentDraft: draftForGeneration ?? undefined,
        connectionId: draftConnectionId || undefined,
      },
      {
        onSuccess: (draft) => {
          if (generationId !== profileDraftGenerationIdRef.current) return;
          if (draftForGeneration) setPreviousDraft(draftForGeneration);
          if (noodlerAccountId) setAcceptSourceChangesForProfileId(noodlerAccountId);
          const { sourceSnapshot, sourceRevisionToken, notes, ...stageProfile } = draft;
          if (notes?.length) toast.info(notes.join(" "));
          setDraftSourceSnapshot(sourceSnapshot ?? null);
          setDraftSourceRevisionToken(sourceRevisionToken ?? null);
          // The model does not choose the clothing style; a redraft keeps the one the player set.
          setProfileDraft({
            ...stageProfile,
            clothingStyle: draftForGeneration?.clothingStyle ?? stageProfile.clothingStyle ?? "auto",
          });
          setProfileDraftDirty(true);
          setCreationStep("draft");
        },
        onError: (error) => {
          if (generationId !== profileDraftGenerationIdRef.current) return;
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotGenerateAStageProfileDraft")));
        },
      },
    );
  };

  const redraftFromSource = (profile: SlurpManagedStageProfile) => {
    beginEdit(profile);
    void generateDraft({
      noodlerAccountId: profile.id,
      disclosureMode: profile.disclosureMode ?? "hinted",
      guidance: localizeUi("ui.noodle.noodlerhome.redraftGuidance"),
      currentDraft: {
        displayName: profile.displayName,
        handle: profile.handle,
        bio: profile.bio,
        stagePersonality: profile.stagePersonality,
        appearance: profile.appearance,
        wardrobe: profile.wardrobe,
        locations: profile.locations,
        clothingStyle: profile.clothingStyle ?? "auto",
        disclosureMode: profile.disclosureMode ?? "hinted",
        gender: profile.gender,
        tags: profile.tags,
      },
    });
  };

  const saveProfile = async (location?: string) => {
    if (!profileDraft) return;
    const input = {
      ...profileDraft,
      handle: profileDraft.handle.replace(/^@+/u, ""),
      ...(editingProfileId && location !== undefined ? { location } : {}),
    };
    const onSuccess = (profile: SlurpManagedStageProfile & { discardedPreparedPostCount?: number }) => {
      invalidateProfileDraftGeneration();
      setProfileDraft(null);
      setProfileDraftDirty(false);
      setEditingProfileId(null);
      setDraftNoodleAccountId(null);
      setPreviousDraft(null);
      setAcceptSourceChangesForProfileId(null);
      setCreationStep(null);
      setAutoPostSetupId(null);
      onNavigate({
        mode: "creator",
        view: "profile",
        accountId: profile.id,
        ...((profileReturnToSettingsRef.current ??
        (navigation.mode === "creator" && (navigation.view === "profiles" || navigation.view === "profile")
          ? navigation.returnToSettings
          : null))
          ? {
              returnToSettings: profileReturnToSettingsRef.current ?? navigation.returnToSettings,
            }
          : {}),
      });
      profileReturnToSettingsRef.current = null;
      toast.success(
        editingProfileId
          ? localizeUi("ui.noodle.noodlerhome.stageProfileUpdated")
          : localizeUi("ui.noodle.noodlerhome.stageProfileCreated"),
      );
      if (profile.discardedPreparedPostCount) {
        toast.info(
          localizeUi("ui.noodle.noodlerhome.discardedPreparedPosts", {
            count: profile.discardedPreparedPostCount,
          }),
        );
      }
      // A new character Creator is asked whether it should post on its own; the step was never
      // reached (R1-075). Persona Creators post by hand, so they skip it.
      const personaSource = (state.personas ?? []).some(
        (persona: { id: string }) => persona.id === profile.sourceAccountId,
      );
      if (!editingProfileId && profile.sourceAccountId && !personaSource) {
        setAutoPostSetupId(profile.id);
        setCreationStep("automatic");
      }
    };
    const onError = async (error: unknown) => {
      if (!editingProfileId && draftNoodleAccountId && error instanceof ApiError && error.status === 409) {
        const refreshed = await accountsQuery.refetch();
        const existing = refreshed.data?.find((profile) => profile.sourceAccountId === draftNoodleAccountId);
        if (existing) {
          clearProfileEditorState();
          onNavigate({ mode: "creator", view: "profile", accountId: existing.id });
          toast.info(localizeUi("ui.noodle.noodlerhome.thatStageProfileAlreadyExistedSoItWasOpened"));
          return;
        }
      }
      toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotSaveTheStageProfile")));
    };
    if (editingProfileId) {
      const editing = accountsQuery.data?.find((profile) => profile.id === editingProfileId);
      const review = await confirmSlurpAvatarReview({
        existing: editing ?? null,
        nextDisclosure: input.disclosureMode,
        localize: localizeUi,
        confirm: showConfirmDialog,
      });
      if (!review.proceed) return;
      const confirmAvatarReview = review.confirmAvatarReview;
      updateProfile.mutate(
        {
          accountId: editingProfileId,
          ...input,
          ...(confirmAvatarReview && { confirmAvatarReview: true }),
          acceptSourceChanges: acceptSourceChangesForProfileId === editingProfileId,
          ...(acceptSourceChangesForProfileId === editingProfileId && draftSourceSnapshot
            ? { sourceSnapshot: draftSourceSnapshot }
            : {}),
          ...(acceptSourceChangesForProfileId === editingProfileId && draftSourceRevisionToken
            ? { sourceRevisionToken: draftSourceRevisionToken }
            : {}),
        },
        {
          onSuccess: (profile) => {
            if (input.location !== undefined && viewerPersonaId) {
              updateProfileLocation.mutate(
                { accountId: editingProfileId, personaId: viewerPersonaId, location: input.location },
                { onSuccess: () => onSuccess(profile), onError },
              );
              return;
            }
            onSuccess(profile);
          },
          onError,
        },
      );
    } else if (draftNoodleAccountId) {
      createProfile.mutate(
        { sourceAccountId: draftNoodleAccountId, stageProfile: input, imageNameKnown: creationImageNameKnown },
        { onSuccess, onError },
      );
    }
  };

  const submitManualPost = async ({
    profileId,
    title,
    body,
    access,
    image,
    poll,
    format,
    postType,
    linkedPostId,
    unlockPrice,
    generateImage,
  }: SlpCreatorPostSubmission) => {
    const wantsImage = generateImage && !image;
    const created = await createPost.mutateAsync({
      unlockPrice: access === "locked" ? unlockPrice : null,
      ...(wantsImage ? { imagePrompt: body.trim() || title.trim() } : {}),
      targetAccountId: profileId,
      title,
      content: body,
      access,
      image,
      poll,
      format,
      postType,
      linkedPostId: linkedPostId ?? null,
    });
    const postId = created?.id;
    toast.success(localizeUi("ui.noodle.noodlerhome.noodlerPostPublished"), {
      description: wantsImage && postId ? localizeUi("ui.slurp.pulse.task.drawingLater") : undefined,
    });
    // B: the picture is drawn as a Pulse task, so the composer closes as soon as the post is out.
    if (wantsImage && postId)
      void startSlpTask({
        t: localizeUi,
        kind: "generate-post-image",
        label: localizeUi("ui.slurp.pulse.task.drawPost"),
        accountIds: [profileId],
        startedToast: false,
        run: () => generatePostImage.mutateAsync({ id: created.id, accountId: profileId }),
        done: () => ({
          result: localizeUi("ui.slurp.pulse.result.drawn"),
          target: { accountId: profileId, postId },
        }),
      });
  };

  // B: a Pulse task; the player keeps going while the Creator writes (and draws) the post.
  const submitRunNow = async (accountId: string) => {
    if (!(await confirmProviderDisclosure())) return;
    const name = accountsQuery.data?.find((profile) => profile.id === accountId)?.displayName;
    void startSlpTask({
      t: localizeUi,
      kind: "auto-post",
      label: localizeUi("ui.slurp.pulse.task.postNow", { name: name ?? "" }),
      accountIds: [accountId],
      run: () =>
        runAutoPostNow.mutateAsync(accountId).catch((error: unknown) => {
          throw new Error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotRunAnAutomaticPostNow")));
        }),
      done: (post) => ({
        result: localizeUi("ui.noodle.noodlerhome.automaticPostGenerated"),
        target: { accountId, postId: post?.id ?? null },
      }),
    });
  };

  const confirmReviewedImagePrompts = (overrides: ImagePromptOverride[]) => {
    if (!imagePromptReview) return;
    confirmImagePrompts.mutate(
      { targetAccountId: imagePromptReview.accountId, prompts: overrides },
      {
        onSuccess: ({ finalized }) => {
          setImagePromptReview(null);
          if (finalized === 0) {
            toast.error(localizeUi("ui.noodle.noodlerhome.noImageWasGeneratedForThatPrompt"));
            return;
          }
          toast.success(localizeUi("ui.noodle.noodlerhome.noodlerImageGenerated"));
        },
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotGenerateTheReviewedImage"))),
      },
    );
  };

  const cancelReviewedImagePrompts = () => {
    if (!imagePromptReview) return;
    setImagePromptReview(null);
    cancelImagePrompts.mutate({
      targetAccountId: imagePromptReview.accountId,
      ids: imagePromptReview.items.map((item) => item.id),
    });
  };

  const toggleCreatorSubscription = (creatorAccountId: string, subscribed: boolean) => {
    if (!viewerPersonaId) return Promise.resolve();
    return toggleSubscription
      .mutateAsync({ creatorAccountId, personaId: viewerPersonaId, subscribed })
      .then(() => undefined)
      .catch((error) => {
        toast.error(errorMessage(error, localizeUi("ui.noodle.noodlerhome.couldNotUpdateYourSubscription")));
        throw error;
      });
  };

  const toggleCreatorFollow = (creatorAccountId: string, followed: boolean) => {
    if (!viewerPersonaId) return;
    toggleFollow.mutate(
      { creatorAccountId, personaId: viewerPersonaId, followed: !followed },
      {
        onError: (error) =>
          toast.error(errorMessage(error, localizeUi("ui.noodle.noodlehome.couldNotUpdateFollowedAccounts"))),
      },
    );
  };

  const mainAuthorProfile = shellPersonaAccount
    ? (accountsQuery.data?.find((profile) => profile.sourceAccountId === shellPersonaAccount.id) ?? null)
    : null;
  const openPostComposer = () => {
    if (mainAuthorProfile) {
      onNavigate({ mode: "creator", view: "profile", accountId: mainAuthorProfile.id });
    } else if (shellPersonaAccount && accountsQuery.isSuccess) {
      // Only a loaded, empty list proves there is no Creator yet. While accounts load or failed, the
      // profiles view shows the wait or Try again instead of inviting a second Creator.
      onNavigate({ mode: "creator", view: "create-profile", sourceAccountId: shellPersonaAccount.id });
    } else {
      onNavigate({ mode: "creator", view: "profiles" });
    }
    setMobileDrawerOpen(false);
  };
  // The hub's "Add Story": the own profile, with the composer sheet open in Story mode.
  const openStoryComposer = () => {
    if (mainAuthorProfile) {
      updateNoodlerPostDraft(mainAuthorProfile.id, { postType: "story", poll: null, title: "" });
      setComposerOpenSignal((tick) => tick + 1);
    }
    openPostComposer();
  };

  return {
    beginCreate,
    cancelCreateProfile,
    closeProfileEditor,
    changeDisclosure,
    generateDraft,
    redraftFromSource,
    saveProfile,
    submitManualPost,
    submitRunNow,
    confirmReviewedImagePrompts,
    cancelReviewedImagePrompts,
    toggleCreatorSubscription,
    toggleCreatorFollow,
    mainAuthorProfile,
    openPostComposer,
    openStoryComposer,
  };
}

export function useSlurpHomeState(props: SlurpHomeProps) {
  const state = useSlurpHomeBaseState(props);
  return { ...state, ...useSlurpHomeActions(state) };
}
