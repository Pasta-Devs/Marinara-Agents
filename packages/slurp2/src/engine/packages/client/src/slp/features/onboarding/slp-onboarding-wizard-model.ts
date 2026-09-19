import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import type {
  NoodleIdentityDisclosure,
  NoodlerOnboardingCompletion,
  NoodlerRefreshNowOutcome,
  NoodlerPostView,
  NoodlerStageProfile,
} from "@marinara-engine/shared";
import {
  NOODLER_BULK_ACCOUNT_MAX,
  NOODLER_POSTS_PER_DAY_MAX,
  resolveNoodlerOnboardingCompletion,
} from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import {
  useBulkCreateNoodlerStageProfiles,
  useNoodlerEligibleAccounts,
  useRefreshTargetedNoodlerCreatorsNow,
} from "../creators/slp-creators-contract";
import {
  useEnqueueNoodlerFirstPosts,
  useNoodlerFirstPostStatus,
} from "./slp-first-post-hooks";
import { useUpdateSlurpConnectionsForCreators } from "../media/slp-media-contract";
import { useSlurpSettings, useUpdateSlurpSettings } from "../settings/slp-settings-contract";
import { cn, generateClientId } from "../../../lib/utils";
import { Modal } from "../../../components/ui/Modal";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "../../base/chrome/SlpChrome";
import {
  SLURP_ACTIVITY_PRESETS,
  SLURP_DEFAULT_ACTIVITY_PRESET,
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
  type SlurpActivityPreset,
} from "../../modules/creator/slp-activity-presets";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import {
  clampPostsPerDay,
  DEMO_PROFILE,
  disclosureLabel,
  DEFAULT_ACTIVITY_PATCH,
  DEFAULT_POSTS_PER_DAY,
  LAST_INTRO,
  type CompletionKind,
  type Intro,
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
  const eligible = useNoodlerEligibleAccounts("", "all", open);
  const bulkCreate = useBulkCreateNoodlerStageProfiles();
  const refreshTargeted = useRefreshTargetedNoodlerCreatorsNow();
  const enqueueFirstPosts = useEnqueueNoodlerFirstPosts();
  const assignImageConnections = useUpdateSlurpConnectionsForCreators();
  const updateSlurpSettings = useUpdateSlurpSettings();
  const connectionsQuery = useSlurpConnections(open);
  const settingsQuery = useSlurpSettings();
  const accounts = useMemo(() => eligible.data?.pages.flatMap((page) => page.items) ?? [], [eligible.data?.pages]);
  const [step, setStep] = useState<Step>(1);
  const [intro, setIntro] = useState<Intro>(selectionOnly ? null : 0);
  const [setupLane, setSetupLane] = useState<SetupLane>(selectionOnly ? "easy" : null);
  const [postExplored, setPostExplored] = useState(false);
  const [activityChoice, setActivityChoice] = useState<SlurpActivityPreset | null>(SLURP_DEFAULT_ACTIVITY_PRESET);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [disclosure, setDisclosure] = useState<NoodleIdentityDisclosure>("open");
  const [exceptions, setExceptions] = useState<Record<string, NoodleIdentityDisclosure>>({});
  const [autoPostingEnabled, setAutoPostingEnabled] = useState(true);
  const [postsPerDay, setPostsPerDay] = useState(DEFAULT_POSTS_PER_DAY);
  // Typed value kept apart from the committed one: clamping per keystroke made the first digit
  // of a two-digit pace snap back to 1, and the field impossible to clear.
  const [postsPerDayDraft, setPostsPerDayDraft] = useState(String(DEFAULT_POSTS_PER_DAY));
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
  const [generationConnectionId, setGenerationConnectionId] = useState("");
  const [settingsSeeded, setSettingsSeeded] = useState(false);
  const [outcomes, setOutcomes] = useState<NoodlerRefreshNowOutcome[]>([]);
  const [completion, setCompletion] = useState<CompletionKind | null>(null);
  const [executionId, setExecutionId] = useState("");
  const [firstPostsQueued, setFirstPostsQueued] = useState(false);
  const [providerConfirmationOpen, setProviderConfirmationOpen] = useState(false);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const demoProfile: NoodlerStageProfile = {
    ...DEMO_PROFILE,
    displayName:
      disclosure === "open"
        ? t("ui.noodle.noodlerwizard.identityPreview.openName")
        : t("ui.noodle.noodlerwizard.identityPreview.hintedName"),
    handle:
      disclosure === "open"
        ? t("ui.noodle.noodlerwizard.identityPreview.openHandle")
        : t("ui.noodle.noodlerwizard.identityPreview.hintedHandle"),
    avatarUrl: "/sprites/mari/chibi-professor-mari.png",
    disclosureMode: disclosure,
  };

  useEffect(() => {
    if (completion) completionHeadingRef.current?.focus();
  }, [completion]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setIntro(selectionOnly ? null : 0);
    setSetupLane(selectionOnly ? "easy" : null);
    setPostExplored(false);
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
    setGenerationConnectionId("");
    setOutcomes([]);
    setCompletion(null);
    setExecutionId(generateClientId());
    setFirstPostsQueued(false);
  }, [open, selectionOnly]);

  const firstPostStatus = useNoodlerFirstPostStatus(executionId, step === 5 && firstPostsQueued);

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
    setPostsPerDayDraft(String(persistedPostsPerDay));
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

  // One bulk request carries at most NOODLER_BULK_ACCOUNT_MAX accounts, so the selection is
  // capped here: rejecting the whole request after the fact loses every choice the user made.
  const selectionFull = selected.size >= NOODLER_BULK_ACCOUNT_MAX;
  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < NOODLER_BULK_ACCOUNT_MAX) next.add(id);
      return next;
    });
  };
  const chooseActivity = (choice: SlurpActivityPreset) => {
    setActivityChoice(choice);
    const patch = slurpActivityPresetPatch(choice);
    setAutoPostingEnabled(patch.autoPostingScheduleEnabled);
    if (patch.postsPerDay !== undefined) {
      setPostsPerDay(patch.postsPerDay);
      setPostsPerDayDraft(String(patch.postsPerDay));
    }
  };
  // A persona Creator is skipped by design (it never auto-posts), so it is not a failure.
  const failedIds = outcomes
    .filter((outcome) => outcome.status !== "generated" && outcome.status !== "skipped")
    .map((outcome) => outcome.accountId);
  const failedCount = creationFailures + failedIds.length;
  const generatedCount = outcomes.filter((outcome) => outcome.status === "generated").length;
  // Nothing was created, so the run failed before first posts: say that instead of blaming
  // generation.
  const resolveCompletion = (input: {
    selectedCount: number;
    createdCount: number;
    createFailures: number;
    outcomes: NoodlerRefreshNowOutcome[] | null;
  }): CompletionKind =>
    input.createdCount === 0 && input.createFailures > 0 ? "creationFailed" : resolveNoodlerOnboardingCompletion(input);
  const finalizeOutcomes = (
    next: NoodlerRefreshNowOutcome[],
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
  }, [createdIds.length, creationFailures, firstPostStatus.data, firstPostsQueued]);
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
  const saveSettings = async (state: "zero" | "completed") => {
    try {
      await updateSlurpSettings.mutateAsync({
        postsPerDay,
        generationConnectionId: generationConnectionId || null,
        autoPostingScheduleEnabled: autoPostingEnabled,
        autoPostingImagesEnabled: imagesEnabled,
        nightQuiet,
        ...(selectionOnly
          ? {}
          : {
              onboarding: state === "completed" ? "completed" : "not_started",
            }),
      });
      return true;
    } catch {
      toast.error("Slurp setup settings could not be saved.");
      return false;
    }
  };
  const skip = async () => {
    if (await saveSettings("zero")) {
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
  const performFinish = async () => {
    let newIds: string[] = [];
    let createFailureCount = 0;
    try {
      {
        const result = await bulkCreate.mutateAsync({
          noodleAccountIds: [...selected],
          executionId,
          disclosureMode: disclosure,
          disclosureExceptions: exceptions,
          autoPosting: { enabled: autoPostingEnabled, imagesEnabled },
          connectionId: generationConnectionId || null,
        });
        newIds = result.created.map((profile) => profile.id);
        setCreatedIds(newIds);
        createFailureCount = result.skipped.length + (result.failed?.length ?? 0);
        setCreationFailures(createFailureCount);
        setCreationReasons(result.reasons ?? []);
      }
    } catch (error) {
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
    // A failed settings write keeps onboarding incomplete, but the profiles already exist:
    // still write their first posts so the run is not stranded halfway.
    // Nothing was created, so onboarding is not complete: writing "completed" here would
    // close the wizard for good on a run that produced no creator at all.
    const settingsSaved = await saveSettings(selected.size === 0 || newIds.length === 0 ? "zero" : "completed");
    setSettingsFailed(!settingsSaved);
    if (newIds.length === 0 || !generateNow) {
      setCompletion(
        settingsSaved
          ? resolveCompletion({
              selectedCount: selected.size,
              createdCount: newIds.length,
              createFailures: createFailureCount,
              outcomes: null,
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
      setFirstPostsQueued(true);
      setOutcomes([]);
      setCompletion(settingsSaved ? "partial" : "settingsFailed");
      setStep(5);
      if (settingsSaved) onComplete?.();
    } catch {
      // The profiles exist; only generation fell over, so every one of them is retryable.
      finalizeOutcomes(
        newIds.map((accountId) => ({ accountId, status: "error" as const })),
        createFailureCount,
        newIds.length,
        settingsSaved,
      );
      if (settingsSaved) onComplete?.();
    }
  };
  const finish = () => {
    if (selected.size > 0) {
      setProviderConfirmationOpen(true);
      return;
    }
    void performFinish();
  };
  const pending =
    bulkCreate.isPending || updateSlurpSettings.isPending || refreshTargeted.isPending || enqueueFirstPosts.isPending;
  const summaries =
    setupLane === "easy"
      ? [
          {
            step: 1 as Step,
            label: t("ui.noodle.noodlerwizard.characters"),
            value: t("ui.noodle.noodlerwizard.selectedCount", {
              count: selected.size,
            }),
          },
          {
            step: 4 as Step,
            label: t("ui.noodle.noodlerwizard.review"),
            value: t("ui.noodle.noodlerwizard.readyToCreate"),
          },
        ]
      : [
          {
            step: 1 as Step,
            label: t("ui.noodle.noodlerwizard.characters"),
            value: t("ui.noodle.noodlerwizard.selectedCount", {
              count: selected.size,
            }),
          },
          {
            step: 2 as Step,
            label: t("ui.noodle.noodlerwizard.disclosure.title"),
            value: disclosureLabel(disclosure, t),
          },
          {
            step: 3 as Step,
            label: t("ui.noodle.noodlerwizard.activity"),
            value: autoPostingEnabled
              ? t("ui.noodle.noodlerwizard.postsSummary", {
                  count: postsPerDay,
                })
              : t("ui.noodle.noodlerwizard.manualOnly"),
          },
          {
            step: 4 as Step,
            label: t("ui.noodle.noodlerwizard.images"),
            value: imagesEnabled ? t("ui.noodle.noodlerwizard.on") : t("ui.noodle.noodlerwizard.off"),
          },
        ];

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
    intro,
    setIntro,
    setupLane,
    setSetupLane,
    postExplored,
    setPostExplored,
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
    postsPerDayDraft,
    setPostsPerDayDraft,
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
    firstPostsQueued,
    setFirstPostsQueued,
    providerConfirmationOpen,
    setProviderConfirmationOpen,
    completionHeadingRef,
    demoProfile,
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
    performFinish,
    finish,
    pending,
    summaries,
  };
}

export type SlurpOnboardingWizardModel = ReturnType<typeof useSlurpOnboardingWizardModel>;
