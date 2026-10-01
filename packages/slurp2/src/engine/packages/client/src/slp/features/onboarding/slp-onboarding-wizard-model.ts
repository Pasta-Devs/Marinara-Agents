import { useEffect, useMemo, useRef, useState } from "react";
import type {
  SlpCreatorRefreshNowOutcome,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { resolveCreatorOnboardingCompletion } from "../../../../../shared/src/slp/slp-creator-onboarding.js";
import { SLP_CREATOR_BULK_ACCOUNT_MAX } from "../../../../../shared/src/slp/slp-social.schema.js";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { startSlpTask } from "../../base/state/slp-task-store";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import {
  useBulkCreateCreatorStageProfiles,
  useCreatorEligibleAccounts,
  useRefreshTargetedCreatorsNow,
} from "../creators/slp-creators-contract";
import { useEnqueueCreatorFirstPosts, useCreatorFirstPostStatus } from "./slp-first-post-hooks";
import { useUpdateSlurpConnectionsForCreators } from "../media/slp-media-contract";
import { useSlurpSettings, useUpdateSlurpSettings } from "../settings/slp-settings-contract";
import { generateClientId } from "../../../lib/utils";
import {
  SLURP_DEFAULT_ACTIVITY_PRESET,
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
  type SlurpActivityPreset,
} from "../../modules/creator/slp-activity-presets";
import {
  DEFAULT_POSTS_PER_DAY,
  type CompletionKind,
  type SetupLane,
  type Step,
  type WizardProps,
} from "./SlpOnboardingPanel";

/**
 * The onboarding wizard's whole working state: who is selected, how the world is tuned, what the
 * run produced and every action the five steps fire.
 *
 * The steps draw from one object so each one can be its own component without threading forty
 * props through the modal that holds them.
 */
export function useSlurpOnboardingWizardModel(props: WizardProps) {
  const { open, selectionOnly = false, onClose, onComplete, onSeeFeed, onSkipped } = props;
  const { t } = useUiTranslation();
  const eligible = useCreatorEligibleAccounts("", "all", open);
  const bulkCreate = useBulkCreateCreatorStageProfiles();
  const refreshTargeted = useRefreshTargetedCreatorsNow();
  const enqueueFirstPosts = useEnqueueCreatorFirstPosts();
  const assignImageConnections = useUpdateSlurpConnectionsForCreators();
  const updateSlurpSettings = useUpdateSlurpSettings();
  const connectionsQuery = useSlurpConnections(open);
  const settingsQuery = useSlurpSettings();
  const accounts = useMemo(() => eligible.data?.pages.flatMap((page) => page.items) ?? [], [eligible.data?.pages]);
  const [step, setStep] = useState<Step>(1);
  // The Support ticket runs first; adding Creators later opens straight on the role-play sign-up.
  const [rail, setRail] = useState(!selectionOnly);
  const [setupLane, setSetupLane] = useState<SetupLane>(selectionOnly ? "scene" : null);
  const [activityChoice, setActivityChoice] = useState<SlurpActivityPreset | null>(SLURP_DEFAULT_ACTIVITY_PRESET);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [disclosure, setDisclosure] = useState<SlpIdentityDisclosure>("open");
  const [exceptions, setExceptions] = useState<Record<string, SlpIdentityDisclosure>>({});
  const [autoPostingEnabled, setAutoPostingEnabled] = useState(true);
  const [postsPerDay, setPostsPerDay] = useState(DEFAULT_POSTS_PER_DAY);
  const [nightQuiet, setNightQuiet] = useState(true);
  const [imagesEnabled, setImagesEnabled] = useState(false);
  // Empty means the Slurp-wide default image connection. Chosen here because the first post is
  // written during this run: setting it afterwards in Backstage would already be too late.
  const [imageConnectionId, setImageConnectionId] = useState("");
  const [generateNow, setGenerateNow] = useState(true);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [creationFailures, setCreationFailures] = useState(0);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const [creationFailed, setCreationFailed] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationReasons, setCreationReasons] = useState<{ accountId: string; reason: string }[]>([]);
  // Creators whose sign-up failed on the way (provider busy, lost answer): sent again on their own.
  const [creationRetryIds, setCreationRetryIds] = useState<string[]>([]);
  const [generationConnectionId, setGenerationConnectionId] = useState("");
  const [settingsSeeded, setSettingsSeeded] = useState(false);
  const [outcomes, setOutcomes] = useState<SlpCreatorRefreshNowOutcome[]>([]);
  const [completion, setCompletion] = useState<CompletionKind | null>(null);
  const [executionId, setExecutionId] = useState("");
  // A background sign-up's progress (0.3.11): how many of the batch are done.
  const [signUpProgress, setSignUpProgress] = useState<{ done: number; total: number } | null>(null);
  const [firstPostsQueued, setFirstPostsQueued] = useState(false);
  const [providerConfirmationOpen, setProviderConfirmationOpen] = useState(false);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  // A retry polls the same run again; status data older than its enqueue must not end the wait.
  const firstPostsQueuedAtRef = useRef(0);
  useEffect(() => {
    if (completion) completionHeadingRef.current?.focus();
  }, [completion]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setRail(!selectionOnly);
    setSetupLane(selectionOnly ? "scene" : null);
    setActivityChoice(SLURP_DEFAULT_ACTIVITY_PRESET);
    setSelected(new Set());
    setSelectionInitialized(false);
    setSettingsSeeded(false);
    setDisclosure("open");
    setExceptions({});
    setGenerateNow(true);
    setCreatedIds([]);
    setCreationFailures(0);
    setSettingsFailed(false);
    setCreationFailed(false);
    setCreationError(null);
    setCreationReasons([]);
    setCreationRetryIds([]);
    setGenerationConnectionId("");
    setOutcomes([]);
    setCompletion(null);
    setExecutionId(generateClientId());
    setFirstPostsQueued(false);
  }, [open, selectionOnly]);

  const firstPostStatus = useCreatorFirstPostStatus(executionId, step === 5 && firstPostsQueued);

  useEffect(() => {
    if (!open || settingsSeeded || !settingsQuery.data || !connectionsQuery.data) return;
    const settings = settingsQuery.data;
    const defaultLanguageConnection = connectionsQuery.data.find(
      (connection) =>
        connection.provider !== "image_generation" &&
        (connection.defaultForAgents === true || connection.defaultForAgents === "true"),
    );
    const persistedPostsPerDay = settings.postsPerDay ?? DEFAULT_POSTS_PER_DAY;
    setPostsPerDay(persistedPostsPerDay);
    setAutoPostingEnabled(settings.autoPostingScheduleEnabled);
    setActivityChoice(slurpActivityPresetForSettings(settings));
    setNightQuiet(settings.nightQuiet);
    setImagesEnabled(settings.autoPostingImagesEnabled);
    setGenerationConnectionId(settings.generationConnectionId ?? defaultLanguageConnection?.id ?? "");
    setSettingsSeeded(true);
  }, [connectionsQuery.data, open, settingsQuery.data, settingsSeeded]);

  const { fetchNextPage, hasNextPage, isFetching } = eligible;
  useEffect(() => {
    if (!open || isFetching || !hasNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetching, open]);

  useEffect(() => {
    if (!open || selectionInitialized || eligible.isLoading || eligible.hasNextPage) return;
    setSelected(new Set());
    setSelectionInitialized(true);
  }, [accounts, eligible.hasNextPage, eligible.isLoading, open, selectionInitialized]);

  // One bulk request carries at most SLP_CREATOR_BULK_ACCOUNT_MAX accounts, so the selection is
  // capped here: rejecting the whole request after the fact loses every choice the user made.
  const selectionFull = selected.size >= SLP_CREATOR_BULK_ACCOUNT_MAX;
  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < SLP_CREATOR_BULK_ACCOUNT_MAX) next.add(id);
      return next;
    });
  };
  const chooseActivity = (choice: SlurpActivityPreset) => {
    setActivityChoice(choice);
    const patch = slurpActivityPresetPatch(choice);
    setAutoPostingEnabled(patch.autoPostingScheduleEnabled);
    if (patch.postsPerDay !== undefined) {
      setPostsPerDay(patch.postsPerDay);
    }
  };
  // A persona Creator is skipped by design (it never auto-posts), so it is not a failure.
  const failedIds = outcomes
    .filter((outcome) => outcome.status !== "generated" && outcome.status !== "skipped")
    .map((outcome) => outcome.accountId);
  const failedCount = creationFailures + failedIds.length;
  // While the first posts are written the count comes from the live jobs, so it climbs as they land.
  const generatedCount = firstPostsQueued
    ? (firstPostStatus.data?.jobs.filter((job) => job.status === "generated").length ?? 0)
    : outcomes.filter((outcome) => outcome.status === "generated").length;
  // Nothing was created, so the run failed before first posts: say that instead of blaming
  // generation.
  const resolveCompletion = (input: {
    selectedCount: number;
    createdCount: number;
    createFailures: number;
    outcomes: SlpCreatorRefreshNowOutcome[] | null;
  }): CompletionKind =>
    input.createdCount === 0 && input.createFailures > 0 ? "creationFailed" : resolveCreatorOnboardingCompletion(input);
  const finalizeOutcomes = (
    next: SlpCreatorRefreshNowOutcome[],
    createFailures = creationFailures,
    createdCount = createdIds.length,
    settingsSaved = !settingsFailed,
  ) => {
    setOutcomes(next);
    setCompletion(
      settingsSaved
        ? resolveCompletion({
            selectedCount: selected.size,
            createdCount,
            createFailures,
            outcomes: next,
          })
        : "settingsFailed",
    );
    setStep(5);
  };
  useEffect(() => {
    if (!firstPostsQueued || !firstPostStatus.data?.complete) return;
    if (firstPostStatus.dataUpdatedAt < firstPostsQueuedAtRef.current) return;
    const next = firstPostStatus.data.jobs.map((job) => ({
      accountId: job.accountId,
      status:
        job.status === "generated"
          ? ("generated" as const)
          : job.status === "skipped"
            ? ("skipped" as const)
            : ("error" as const),
    }));
    setFirstPostsQueued(false);
    finalizeOutcomes(next, creationFailures, createdIds.length);
  }, [createdIds.length, creationFailures, firstPostStatus.data, firstPostStatus.dataUpdatedAt, firstPostsQueued]);
  const runGeneration = async (ids: string[], createFailures = creationFailures) => {
    const retriedIds = new Set(ids);
    const kept = outcomes.filter((outcome) => !retriedIds.has(outcome.accountId));
    try {
      const result = await refreshTargeted.mutateAsync({
        accountIds: ids,
        executionId,
      });
      finalizeOutcomes([...kept, ...result.outcomes], createFailures);
    } catch (error) {
      // The profiles still exist; only generation fell over, so they stay retryable.
      finalizeOutcomes([...kept, ...ids.map((accountId) => ({ accountId, status: "error" as const }))], createFailures);
    }
  };
  const saveSettings = async () => {
    try {
      await updateSlurpSettings.mutateAsync({
        postsPerDay,
        // F: the number shown is the sized one; only a change the player made fixes it.
        postsPerDayCustom:
          settingsQuery.data?.postsPerDayCustom === true || postsPerDay !== settingsQuery.data?.postsPerDay,
        generationConnectionId: generationConnectionId || null,
        autoPostingScheduleEnabled: autoPostingEnabled,
        autoPostingImagesEnabled: imagesEnabled,
        nightQuiet,
        // The Support ticket completed onboarding at its stamp; skipping the sign-up after it must
        // not send the player through the ticket again.
        ...(selectionOnly ? {} : { onboarding: "completed" as const }),
      });
      return true;
    } catch {
      toast.error("Slurp setup settings could not be saved.");
      return false;
    }
  };
  const skip = async () => {
    if (await saveSettings()) {
      onSkipped?.();
      onClose();
    }
  };
  const returnToSetup = () => {
    setCreationFailed(false);
    setCreationError(null);
    setCreationReasons([]);
    setCompletion(null);
    setStep(4);
  };
  const returnToPreviousStep = () => setStep(setupLane === "easy" ? 1 : ((step - 1) as Step));
  /**
   * Create the selected Creators, or with `retryIds` only the ones whose sign-up failed on the way.
   * A retry keeps what the first pass created and replaces only the retried Creators' reasons.
   */
  const performFinish = async (retryIds?: string[]) => {
    let newIds: string[] = [];
    let allCreatedIds: string[] = [];
    let createFailureCount = 0;
    try {
      {
        const result = await bulkCreate.mutateAsync({
          noodleAccountIds: retryIds ?? [...selected],
          executionId,
          disclosureMode: disclosure,
          disclosureExceptions: exceptions,
          autoPosting: { enabled: autoPostingEnabled, imagesEnabled },
          connectionId: generationConnectionId || null,
          // Done on the server when the batch ends, so closing Slurp in between misses nothing.
          then: {
            firstPosts: generateNow,
            imageConnectionId: imageConnectionId || null,
            personaId: useSlurpUIStore.getState().viewerPersonaId ?? undefined,
            completeOnboarding: !selectionOnly,
          },
          onProgress: (done, total) => setSignUpProgress({ done, total }),
        });
        setSignUpProgress(null);
        newIds = result.created.map((profile) => profile.id);
        allCreatedIds = retryIds ? [...new Set([...createdIds, ...newIds])] : newIds;
        setCreatedIds(allCreatedIds);
        createFailureCount =
          (retryIds ? creationFailures - retryIds.length : 0) + result.skipped.length + (result.failed?.length ?? 0);
        setCreationFailures(createFailureCount);
        if (retryIds) {
          setCreationReasons([
            ...creationReasons.filter((entry) => !retryIds.includes(entry.accountId)),
            ...(result.reasons ?? []),
          ]);
        } else {
          setCreationReasons(result.reasons ?? []);
        }
        // An older server sends no `retryable`; every operational failure is then worth one more try.
        setCreationRetryIds(result.retryable ?? result.failed ?? []);
      }
    } catch (error) {
      setSignUpProgress(null);
      // The request may still have created profiles before the response was lost. The server
      // replays the same executionId idempotently, so keep the run retryable in place rather
      // than making the user reselect everything.
      setCreationFailed(true);
      setCompletion("creationFailed");
      if (error instanceof Error) setCreationError(error.message);
      setStep(5);
      return;
    }
    setCreationFailed(false);
    setCreationError(null);
    // A failed settings write still lets the profiles that exist write their first posts, so the
    // run is not stranded halfway. A retry keeps the settings the first pass saved.
    const settingsSaved = retryIds && !settingsFailed ? true : await saveSettings();
    setSettingsFailed(!settingsSaved);
    // A retry that created nobody new while the first posts are still being written keeps that wait.
    if (retryIds && newIds.length === 0 && firstPostsQueued) return;
    if (newIds.length === 0 || !generateNow) {
      setCompletion(
        settingsSaved
          ? resolveCompletion({
              selectedCount: selected.size,
              createdCount: allCreatedIds.length,
              createFailures: createFailureCount,
              // A retry that created nobody new keeps the first posts the first pass already wrote.
              outcomes: retryIds && generateNow && outcomes.length > 0 ? outcomes : null,
            })
          : "settingsFailed",
      );
      setStep(5);
      if (settingsSaved && newIds.length > 0) onComplete?.();
      return;
    }
    // Before the first posts, never after: these are the connections those posts must use.
    // A failure here costs the chosen workflow, not the run, so the creators still get their posts.
    if (imageConnectionId) {
      try {
        await assignImageConnections.mutateAsync({ creatorIds: newIds, connectionId: imageConnectionId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("ui.slurp.onboarding.imageConnectionFailed"));
      }
    }
    try {
      await enqueueFirstPosts.mutateAsync({ accountIds: newIds, executionId });
      firstPostsQueuedAtRef.current = Date.now();
      setFirstPostsQueued(true);
      setOutcomes([]);
      // The posts are written one by one after this; "partial" said "0 first posts, N need help"
      // for that whole wait, so every multi-add looked like it had failed.
      setCompletion(settingsSaved ? "writing" : "settingsFailed");
      setStep(5);
      if (settingsSaved) onComplete?.();
    } catch {
      // The profiles exist; only generation fell over, so every one of them is retryable.
      finalizeOutcomes(
        newIds.map((accountId) => ({ accountId, status: "error" as const })),
        createFailureCount,
        allCreatedIds.length,
        settingsSaved,
      );
      if (settingsSaved) onComplete?.();
    }
  };
  // B: signing up is a Pulse task. The wizard may close while it runs; the Creators and their
  // first posts keep coming, Pulse shows the run and the first-post jobs, a toast says when it ends.
  const openRef = useRef(open);
  openRef.current = open;
  const finishAsTask = (retryIds?: string[]) => {
    const count = retryIds?.length ?? selected.size;
    return startSlpTask({
      t,
      kind: "sign-up",
      label: t("ui.slurp.pulse.task.signUp", { count }),
      startedToast: false,
      doneToast: false,
      run: () => performFinish(retryIds),
      done: () => {
        if (!openRef.current) toast.success(t("ui.slurp.pulse.task.signUpDone", { count }));
        return { result: t("ui.slurp.pulse.task.signUpDone", { count }) };
      },
    });
  };
  const retryFailedCreations = () => void finishAsTask(creationRetryIds);
  const finish = () => {
    if (selected.size > 0) {
      setProviderConfirmationOpen(true);
      return;
    }
    void finishAsTask();
  };
  const pending =
    bulkCreate.isPending || updateSlurpSettings.isPending || refreshTargeted.isPending || enqueueFirstPosts.isPending;

  return {
    open,
    selectionOnly,
    onClose,
    onComplete,
    onSeeFeed,
    onSkipped,
    t,
    eligible,
    bulkCreate,
    refreshTargeted,
    enqueueFirstPosts,
    assignImageConnections,
    updateSlurpSettings,
    connectionsQuery,
    settingsQuery,
    accounts,
    step,
    setStep,
    rail,
    setRail,
    setupLane,
    setSetupLane,
    activityChoice,
    setActivityChoice,
    selected,
    setSelected,
    selectionInitialized,
    setSelectionInitialized,
    disclosure,
    setDisclosure,
    exceptions,
    setExceptions,
    autoPostingEnabled,
    setAutoPostingEnabled,
    postsPerDay,
    setPostsPerDay,
    nightQuiet,
    setNightQuiet,
    imagesEnabled,
    setImagesEnabled,
    imageConnectionId,
    setImageConnectionId,
    generateNow,
    setGenerateNow,
    createdIds,
    setCreatedIds,
    creationFailures,
    setCreationFailures,
    settingsFailed,
    setSettingsFailed,
    creationFailed,
    setCreationFailed,
    creationError,
    setCreationError,
    creationReasons,
    setCreationReasons,
    creationRetryIds,
    retryFailedCreations,
    generationConnectionId,
    setGenerationConnectionId,
    settingsSeeded,
    setSettingsSeeded,
    outcomes,
    setOutcomes,
    completion,
    setCompletion,
    executionId,
    setExecutionId,
    signUpProgress,
    firstPostsQueued,
    setFirstPostsQueued,
    providerConfirmationOpen,
    setProviderConfirmationOpen,
    completionHeadingRef,
    firstPostStatus,
    fetchNextPage,
    hasNextPage,
    isFetching,
    selectionFull,
    toggleSelected,
    chooseActivity,
    failedIds,
    failedCount,
    generatedCount,
    resolveCompletion,
    finalizeOutcomes,
    runGeneration,
    saveSettings,
    skip,
    returnToSetup,
    returnToPreviousStep,
    performFinish: finishAsTask,
    finish,
    pending,
  };
}

export type SlurpOnboardingWizardModel = ReturnType<typeof useSlurpOnboardingWizardModel>;
