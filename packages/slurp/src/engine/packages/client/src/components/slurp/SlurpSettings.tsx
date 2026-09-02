import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Image,
  Loader2,
  Megaphone,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useDeleteNoodlerStageProfile,
  useDeleteAllSlurpData,
  useDeleteUnusedSlurpData,
  useAdoptNoodlerSourceIdentity,
  useDismissNoodlerSourceChanges,
  useNoodlerAccounts,
  useNoodlerFanActivityStatus,
  useSlurpImageConnections,
  useNoodlerReserveStatus,
  useRefreshNoodlerFanActivityNow,
  useRefreshTargetedNoodlerCreatorsNow,
  useSlurpConnections,
  useSlurpSettings,
  useUpdateNoodlerAutoPosting,
  useUpdateNoodlerScheduleSlot,
  useUpdateSlurpImageConnections,
  useUpdateSlurpSettings,
  type SlurpSettings,
  type SlurpReserveStatus,
  type SlurpScheduleSlot,
} from "../../hooks/use-slurp";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { Modal } from "../ui/Modal";
import type { SlurpNavigationState } from "./slurp-navigation.types";
import type { NoodlerManagedStageProfile } from "@marinara-engine/shared";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "./SlurpShell";
import {
  SLURP_ACTIVITY_PRESETS,
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
  slurpPostsPerDayForPreset,
} from "./slurp-activity-presets";

type SlurpSettingsProps = {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
  onAddCreators: () => void;
  personaSourceIds: ReadonlySet<string>;
  onEditCreator: (creator: NoodlerManagedStageProfile) => void;
  onRedraftCreator: (creator: NoodlerManagedStageProfile) => void;
  onRestartOnboarding: () => void;
};

const archetypes = ["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"] as const;
const settingsSections = ["overview", "general", "creators", "images", "audience", "advanced"] as const;
const DEFAULT_SLURP_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page. Posts are normallly sexually suggestive to outright NSFW. Creators will use Slurp to often excite its readers with their posts. The level of NSFW of a post is dependent on the creator's personality, a shy, innocent person will be suggestive, but still overall tame. On the other end of the spectrum, an outgoing personality who has no problems with sex, will often post very explicit material.";
const DEFAULT_SLURP_IMAGE_GENERATION_PROMPT =
  "Create a polished social-media image for an adult Creator post. Match the creator's identity, personality, body, clothing, and established visual details. Follow the post's mood and subject. Describe the pose, expression, setting, lighting, camera angle, composition, and visible details clearly. Flirty, suggestive, sensual, or explicit imagery is allowed when it fits the post and creator, but do not force sexual content into ordinary updates. Keep the image coherent, intentional, and suitable for a public or locked Creator feed.";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not update settings.";
}

function NumberSetting({
  value,
  min,
  max,
  onSave,
}: {
  value: number;
  min: number;
  max: number;
  onSave: (value: number) => Promise<boolean> | boolean | void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const saveQueueRef = useRef(Promise.resolve());
  const saveGenerationRef = useRef(0);
  const commit = async (raw = draft, resetInvalid = true) => {
    const next = Number(raw);
    if (!raw.trim() || !Number.isInteger(next) || next < min || next > max) {
      if (resetInvalid) setDraft(String(value));
      return;
    }
    // Serialize saves so a slow older request can't land after a newer one and persist a
    // stale value; skip a queued save (and its failure recovery) once a later edit has
    // already superseded it. Compare a generation token, not the value itself — a sequence
    // like 1 -> 2 -> 1 would otherwise let the first save's failure recovery match the last.
    // Swallow rejections so one failed save doesn't wedge the queue for every save after it.
    const saveGeneration = ++saveGenerationRef.current;
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      if (saveGenerationRef.current !== saveGeneration) return;
      try {
        if ((await onSave(next)) === false && saveGenerationRef.current === saveGeneration) setDraft(String(value));
      } catch {
        if (saveGenerationRef.current === saveGeneration) setDraft(String(value));
      }
    });
    await saveQueueRef.current;
  };
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        void commit(nextDraft, false);
      }}
      onBlur={() => void commit()}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base outline-none transition-colors focus:border-[var(--noodle-accent)] focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/30 sm:text-sm"
    />
  );
}

export function SlurpSettings({
  navigation,
  onNavigate,
  onAddCreators,
  personaSourceIds,
  onEditCreator,
  onRedraftCreator,
  onRestartOnboarding,
}: SlurpSettingsProps) {
  const { t, i18n } = useTranslation();
  const settingsQuery = useSlurpSettings();
  const updateSettings = useUpdateSlurpSettings();
  const settings = settingsQuery.data;
  const [generationGuidanceDraft, setGenerationGuidanceDraft] = useState("");
  const [generationGuidanceEditorOpen, setGenerationGuidanceEditorOpen] = useState(false);
  const [imagePromptDraft, setImagePromptDraft] = useState("");
  const [imagePromptEditorOpen, setImagePromptEditorOpen] = useState(false);
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [refreshAccountIds, setRefreshAccountIds] = useState<Set<string>>(new Set());
  const [refreshAccess, setRefreshAccess] = useState<"public" | "locked">("locked");
  const [scheduleCreatorId, setScheduleCreatorId] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [customPaceOpen, setCustomPaceOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    if (settings) {
      if (!generationGuidanceEditorOpen) setGenerationGuidanceDraft(settings.generationGuidance);
      if (!imagePromptEditorOpen) setImagePromptDraft(settings.imageGenerationPrompt);
    }
  }, [generationGuidanceEditorOpen, imagePromptEditorOpen, settings]);
  const section = navigation.section ?? "overview";
  const save = async (patch: Partial<SlurpSettings>) => {
    setSaveState("saving");
    try {
      await updateSettings.mutateAsync(patch);
      setSaveState("saved");
      return true;
    } catch (error) {
      setSaveState("error");
      toast.error(errorMessage(error));
      return false;
    }
  };
  const update = (key: keyof SlurpSettings, value: unknown) => save({ [key]: value } as Partial<SlurpSettings>);
  const accountsQuery = useNoodlerAccounts(section === "overview" || section === "creators" || section === "general");
  const imageSettingsQuery = useSlurpImageConnections(
    section === "overview" || section === "images" || section === "creators",
  );
  const fanStatusQuery = useNoodlerFanActivityStatus(section === "overview" || section === "audience");
  const reserveStatusQuery = useNoodlerReserveStatus(section === "overview" || section === "creators");
  const updateAuto = useUpdateNoodlerAutoPosting();
  const updateScheduleSlot = useUpdateNoodlerScheduleSlot();
  const refreshFans = useRefreshNoodlerFanActivityNow();
  const refreshCreators = useRefreshTargetedNoodlerCreatorsNow();
  const updateImages = useUpdateSlurpImageConnections();
  const deleteCreator = useDeleteNoodlerStageProfile();
  const deleteAllData = useDeleteAllSlurpData();
  const deleteUnusedData = useDeleteUnusedSlurpData();
  const adoptSourceIdentity = useAdoptNoodlerSourceIdentity();
  const dismissSourceChanges = useDismissNoodlerSourceChanges();
  const connectionsQuery = useSlurpConnections(
    section === "overview" || section === "general" || section === "images" || section === "creators",
  );
  const imageConnections = (connectionsQuery.data ?? []).filter(
    (connection) => connection.provider === "image_generation",
  );
  const imageSettings = imageSettingsQuery.data;
  const personaCreator = (creator: NoodlerManagedStageProfile) =>
    Boolean(creator.sourceAccountId && personaSourceIds.has(creator.sourceAccountId));
  const automationCreators = (accountsQuery.data ?? []).filter((creator) => !personaCreator(creator));
  const scheduleCreator = accountsQuery.data?.find((creator) => creator.id === scheduleCreatorId) ?? null;
  const selectedCreator =
    accountsQuery.data?.find((creator) => creator.id === selectedCreatorId) ?? accountsQuery.data?.[0] ?? null;
  const scheduleSlots =
    reserveStatusQuery.data?.creators.find((creator) => creator.accountId === scheduleCreatorId)?.slots ?? [];
  const generationGuidanceIsDefault = settings?.generationGuidance === DEFAULT_SLURP_GENERATION_GUIDANCE;
  const imagePromptIsDefault = settings?.imageGenerationPrompt === DEFAULT_SLURP_IMAGE_GENERATION_PROMPT;
  const activityPreset = settings && slurpActivityPresetForSettings(settings);
  const creators = accountsQuery.data ?? [];
  const autoPostingCreators = automationCreators.filter((creator) => creator.autoPosting.enabled);
  const automaticPublishingActive = settings?.autoPostingScheduleEnabled && autoPostingCreators.length > 0;
  const imageEnabledCreators = creators.filter((creator) => creator.autoPosting.imagesEnabled);
  const imagesReady = imageConnections.length > 0 && imageEnabledCreators.length > 0;
  const selectedImageConnection = imageConnections.find(
    (connection) => connection.id === imageSettings?.defaultConnectionId,
  );
  const imageConnectionLabel = selectedImageConnection
    ? (selectedImageConnection.name ?? selectedImageConnection.model ?? selectedImageConnection.id)
    : t("ui.slurp.settings.images.engineDefault");
  const paceLabel = activityPreset
    ? t(`ui.slurp.settings.presets.${activityPreset}`)
    : t("ui.slurp.settings.presets.custom");
  const openRefresh = () => {
    setRefreshAccountIds(
      new Set((autoPostingCreators.length > 0 ? autoPostingCreators : automationCreators).map((creator) => creator.id)),
    );
    setRefreshAccess("locked");
    setRefreshModalOpen(true);
  };
  const restore = async (patch: Partial<SlurpSettings>, message = "Settings saved.") => {
    setSaveState("saving");
    try {
      await updateSettings.mutateAsync(patch);
      setSaveState("saved");
      toast.success(message);
      return true;
    } catch (error) {
      setSaveState("error");
      toast.error(errorMessage(error));
      return false;
    }
  };
  const restoreDefaultImagePrompt = () =>
    restore(
      { imageGenerationPrompt: DEFAULT_SLURP_IMAGE_GENERATION_PROMPT },
      t("ui.slurp.settings.prompts.imageRestored"),
    );
  const saveImagePrompt = () =>
    restore({ imageGenerationPrompt: imagePromptDraft }, t("ui.slurp.settings.prompts.imageSaved"));
  const saveGenerationGuidance = () =>
    restore({ generationGuidance: generationGuidanceDraft }, t("ui.slurp.settings.prompts.guidanceSaved"));

  useEffect(() => {
    if (!accountsQuery.data?.length) {
      setSelectedCreatorId(null);
      return;
    }
    if (!accountsQuery.data.some((creator) => creator.id === selectedCreatorId)) {
      setSelectedCreatorId(accountsQuery.data[0]?.id ?? null);
    }
  }, [accountsQuery.data, selectedCreatorId]);

  const confirmDeleteCreator = async (creator: NoodlerManagedStageProfile) => {
    try {
      const confirmed = await showConfirmDialog({
        title: t("ui.slurp.settings.creators.deleteTitle"),
        message: t("ui.slurp.settings.creators.deleteDetail", { name: creator.displayName }),
      });
      if (!confirmed) return;
      deleteCreator.mutate(creator.id, {
        onSuccess: () => toast.success(t("ui.slurp.settings.creators.deleted", { name: creator.displayName })),
        onError: (error) => toast.error(errorMessage(error)),
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (settingsQuery.isError)
    return (
      <main className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-[var(--muted-foreground)]">
        <p>{t("ui.slurp.settings.loadError")}</p>
        <button
          type="button"
          onClick={() => void settingsQuery.refetch()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--noodle-accent)]/40 px-3 font-semibold text-[var(--noodle-accent)]"
        >
          <RefreshCw size={14} />
          {t("capabilities.actions.tryAgain")}
        </button>
      </main>
    );
  if (settingsQuery.isLoading || !settings)
    return (
      <main className="flex h-full items-center justify-center gap-2 p-6 text-sm text-[var(--muted-foreground)]">
        <Loader2 size={18} className="animate-spin" />
        {t("capabilities.actions.loading")}
      </main>
    );

  return (
    <>
      <main className="h-full overflow-y-auto bg-[var(--slurp-canvas)] pb-[calc(5rem+env(safe-area-inset-bottom))] text-[var(--slurp-text)] sm:pb-8">
        <div className="mx-auto flex w-full flex-col gap-4 p-3 sm:p-5 lg:gap-6 lg:p-6" data-slurp-settings-layout>
          <header className="relative isolate flex flex-wrap items-start justify-between gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,color-mix(in_srgb,var(--slurp-surface-raised)_94%,transparent),color-mix(in_srgb,var(--noodle-accent)_17%,var(--slurp-surface-raised))_58%,color-mix(in_srgb,var(--slurp-violet)_13%,var(--slurp-surface-raised)))] p-4 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)] sm:gap-4 sm:p-5">
            <span
              className="pointer-events-none absolute -end-12 -top-20 -z-10 h-52 w-52 rounded-full bg-[var(--noodle-accent)]/10 blur-3xl"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute -bottom-24 start-1/3 -z-10 h-48 w-72 rounded-full bg-[var(--slurp-coral)]/[0.08] blur-3xl"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="hidden text-xs font-bold uppercase tracking-[0.18em] text-[var(--noodle-accent)] sm:block">
                {t("ui.slurp.settings.backstage")}
              </p>
              <h1 className="text-xl font-black tracking-tight text-balance sm:mt-1 sm:text-2xl">
                {t("ui.slurp.settings.title")}
              </h1>
              <p className="mt-1 hidden max-w-2xl text-xs leading-5 text-[var(--slurp-muted)] text-pretty sm:block">
                {t("ui.slurp.settings.detail")}
              </p>
            </div>
            <p
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--slurp-surface,var(--background))] px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-inset ${saveState === "error" ? "text-red-300 ring-red-400/30" : saveState === "saved" ? "text-[var(--slurp-success)] ring-[var(--slurp-success)]/25" : "text-[var(--muted-foreground)] ring-[var(--border)]"}`}
              role="status"
              aria-live="polite"
            >
              {saveState === "saving" ? (
                <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : saveState === "error" ? (
                <AlertTriangle size={13} aria-hidden="true" />
              ) : saveState === "saved" ? (
                <CheckCircle2 size={13} aria-hidden="true" />
              ) : null}
              {saveState === "saving"
                ? t("ui.slurp.settings.saveState.saving")
                : saveState === "error"
                  ? t("ui.slurp.settings.saveState.error")
                  : saveState === "saved"
                    ? t("ui.slurp.settings.saveState.saved")
                    : t("ui.slurp.settings.autoSave")}
            </p>
          </header>
          <nav
            className="sticky top-0 z-20 -mx-4 flex snap-x gap-2 overflow-x-auto border-b border-[var(--slurp-outline)] bg-[var(--slurp-glass)] px-4 py-3 pe-10 [scrollbar-width:none] backdrop-blur-xl sm:-mx-6 sm:px-6 md:hidden [&::-webkit-scrollbar]:hidden"
            aria-label={t("ui.slurp.settings.sectionsLabel")}
          >
            {settingsSections.map((item) => (
              <button
                key={item}
                type="button"
                aria-current={section === item ? "page" : undefined}
                onClick={() => onNavigate({ ...navigation, section: item })}
                className={`min-h-11 flex-none snap-start rounded-xl px-4 text-sm font-semibold transition-[background-color,color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 ${section === item ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] shadow-sm ring-1 ring-inset ring-[var(--noodle-accent)]/30" : "text-[var(--slurp-muted)] hover:bg-[var(--slurp-surface-raised)]"}`}
              >
                {t(`ui.slurp.settings.tabs.${item === "general" ? "publishing" : item}`)}
              </button>
            ))}
          </nav>

          <div className="md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
            <nav
              className="sticky top-4 hidden rounded-2xl bg-[linear-gradient(180deg,color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface)),var(--slurp-surface))] p-2 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)] md:flex md:flex-col"
              aria-label={t("ui.slurp.settings.sectionsLabel")}
            >
              {settingsSections.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-current={section === item ? "page" : undefined}
                  onClick={() => onNavigate({ ...navigation, section: item })}
                  className={`relative min-h-11 overflow-hidden rounded-lg px-3 text-start text-sm font-semibold transition-[background-color,color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 ${section === item ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] shadow-sm before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-[var(--noodle-accent)]" : "text-[var(--slurp-muted)] hover:bg-[var(--slurp-surface-raised)] hover:text-[var(--slurp-text)]"}`}
                >
                  {t(`ui.slurp.settings.tabs.${item === "general" ? "publishing" : item}`)}
                </button>
              ))}
            </nav>

            <div className="mt-4 min-w-0 rounded-2xl bg-[linear-gradient(145deg,var(--slurp-surface),color-mix(in_srgb,var(--slurp-violet)_4%,var(--slurp-surface)))] p-3 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)] md:mt-0 md:p-5 lg:p-6">
              {section === "overview" && (
                <div className="space-y-4">
                  <section className="relative isolate overflow-hidden rounded-2xl bg-[var(--slurp-hero)] p-4 text-white shadow-[0_30px_70px_-38px_rgba(184,28,102,0.9)] sm:p-5">
                    <span
                      className="pointer-events-none absolute -end-12 -top-20 -z-10 h-64 w-64 rounded-full border-[2rem] border-white/10"
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
                          {t("ui.slurp.settings.overview.eyebrow")}
                        </p>
                        <h2 className="mt-1 text-xl font-black tracking-tight text-balance sm:text-2xl">
                          {automaticPublishingActive
                            ? t("ui.slurp.settings.overview.live")
                            : t("ui.slurp.settings.overview.paused")}
                        </h2>
                        <p className="mt-1 max-w-xl text-xs leading-5 text-white/85 text-pretty">
                          {automaticPublishingActive
                            ? t("ui.slurp.settings.overview.liveDetail", {
                                posts: settings.postsPerDay,
                                count: autoPostingCreators.length,
                              })
                            : t("ui.slurp.settings.overview.pausedDetail")}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={accountsQuery.isLoading || accountsQuery.isError || automationCreators.length === 0}
                        onClick={openRefresh}
                        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#791444] shadow-lg transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#9f1f5c] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
                      >
                        <Play size={15} fill="currentColor" aria-hidden="true" />
                        {t("ui.slurp.settings.overview.runNow")}
                      </button>
                    </div>
                  </section>

                  <OverviewActivity
                    reserveStatus={reserveStatusQuery.data}
                    reserveLoading={reserveStatusQuery.isLoading}
                    reserveError={reserveStatusQuery.isError}
                    fanStatus={fanStatusQuery.data}
                    refreshPending={refreshCreators.isPending || refreshFans.isPending}
                    onRetry={() => {
                      void reserveStatusQuery.refetch();
                      void fanStatusQuery.refetch();
                    }}
                  />

                  <div className="grid gap-3 lg:grid-cols-2">
                    <OverviewCard
                      icon={<Activity size={21} aria-hidden="true" />}
                      title={t("ui.slurp.settings.tabs.publishing")}
                      status={paceLabel}
                      details={[
                        settings.autoPostingScheduleEnabled
                          ? t("ui.slurp.settings.overview.postsPerDay", { count: settings.postsPerDay })
                          : t("ui.slurp.settings.overview.manualOnly"),
                        settings.nightQuiet
                          ? t("ui.slurp.settings.overview.quietHoursOn")
                          : t("ui.slurp.settings.overview.quietHoursOff"),
                      ]}
                      onClick={() => onNavigate({ ...navigation, section: "general" })}
                      tone="pink"
                    />
                    <OverviewCard
                      icon={<UsersRound size={21} aria-hidden="true" />}
                      title={t("ui.slurp.settings.tabs.creators")}
                      status={t("ui.slurp.settings.overview.autoPostingCreators", {
                        count: autoPostingCreators.length,
                      })}
                      details={[t("ui.slurp.settings.overview.totalCreators", { count: creators.length })]}
                      avatars={creators.slice(0, 4)}
                      onClick={() => onNavigate({ ...navigation, section: "creators" })}
                      tone="violet"
                    />
                    <OverviewCard
                      icon={<Image size={21} aria-hidden="true" />}
                      title={t("ui.slurp.settings.tabs.images")}
                      status={
                        imagesReady ? t("ui.slurp.settings.overview.ready") : t("ui.slurp.settings.overview.needsSetup")
                      }
                      details={[
                        t("ui.slurp.settings.overview.imageCreators", { count: imageEnabledCreators.length }),
                        imageConnections.length > 0
                          ? imageConnectionLabel
                          : t("ui.slurp.settings.overview.noImageConnection"),
                      ]}
                      onClick={() => onNavigate({ ...navigation, section: "images" })}
                      tone="blue"
                      healthy={imagesReady}
                    />
                    <OverviewCard
                      icon={<Megaphone size={21} aria-hidden="true" />}
                      title={t("ui.slurp.settings.tabs.audience")}
                      status={
                        settings.fanActivityEnabled
                          ? t("ui.slurp.settings.overview.on")
                          : t("ui.slurp.settings.overview.off")
                      }
                      details={[
                        t("ui.slurp.settings.overview.audienceRuns", { count: settings.fanActivityRunsPerDay }),
                        t("ui.slurp.settings.overview.audienceActions"),
                      ]}
                      onClick={() => onNavigate({ ...navigation, section: "audience" })}
                      tone="coral"
                      healthy={settings.fanActivityEnabled}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate({ ...navigation, section: "general" })}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised)] px-4 text-start ring-1 ring-inset ring-[var(--slurp-outline)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-surface-raised))] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <FileText size={18} className="shrink-0 text-[var(--slurp-violet)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{t("ui.slurp.settings.overview.generation")}</span>
                      <span className="block text-xs text-[var(--slurp-muted)]">
                        {t("ui.slurp.settings.overview.generationDetail")}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 rtl:rotate-180" aria-hidden="true" />
                  </button>
                </div>
              )}

              {section === "general" && (
                <div className="space-y-4">
                  <SectionTitle
                    title={t("ui.slurp.settings.publishing.title")}
                    detail={t("ui.slurp.settings.publishing.detail")}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--slurp-surface-raised,var(--background))] p-4 shadow-sm ring-1 ring-inset ring-[var(--border)] sm:p-5">
                    <div>
                      <h2 className="text-sm font-semibold">{t("ui.slurp.settings.refresh.title")}</h2>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {t("ui.slurp.settings.refresh.detail")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={accountsQuery.isLoading || accountsQuery.isError}
                      onClick={openRefresh}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      {t("ui.slurp.settings.refresh.title")}
                    </button>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">{t("ui.slurp.settings.publishing.pace")}</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                      {t("ui.slurp.settings.publishing.howDetail")}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {SLURP_ACTIVITY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        aria-pressed={activityPreset === preset}
                        disabled={updateSettings.isPending}
                        onClick={() => {
                          setCustomPaceOpen(false);
                          void save(slurpActivityPresetPatch(preset));
                        }}
                        className={`min-h-20 rounded-xl p-4 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${!customPaceOpen && activityPreset === preset ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
                      >
                        <span className="block text-sm font-semibold">{t(`ui.slurp.settings.presets.${preset}`)}</span>
                        <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                          {preset === "manual"
                            ? t("ui.slurp.settings.presets.manualDetail")
                            : t("ui.slurp.settings.presets.postsDetail", {
                                count: slurpPostsPerDayForPreset(preset),
                              })}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={customPaceOpen || activityPreset === null}
                      disabled={updateSettings.isPending}
                      onClick={() => setCustomPaceOpen(true)}
                      className={`min-h-20 rounded-xl p-4 text-start ring-1 ring-inset transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 ${customPaceOpen || activityPreset === null ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))]"}`}
                    >
                      <span className="block text-sm font-semibold">{t("ui.slurp.settings.presets.custom")}</span>
                      <span className="mt-1 block text-xs text-[var(--slurp-muted)]">
                        {t("ui.slurp.settings.presets.customDetail")}
                      </span>
                    </button>
                  </div>
                  {(customPaceOpen || activityPreset === null) && (
                    <Field label={t("ui.slurp.settings.postsPerDay")} detail={t("ui.slurp.settings.postsPerDayDetail")}>
                      <NumberSetting
                        value={settings.postsPerDay}
                        min={1}
                        max={24}
                        onSave={(value) => save({ autoPostingScheduleEnabled: true, postsPerDay: value })}
                      />
                    </Field>
                  )}
                  {settings.autoPostingScheduleEnabled ? (
                    <Toggle
                      label={t("ui.slurp.settings.quietHours")}
                      detail={t("ui.slurp.settings.quietHoursDetail")}
                      value={settings.nightQuiet}
                      onChange={(value) => update("nightQuiet", value)}
                    />
                  ) : (
                    <GuidanceBox
                      title={t("ui.slurp.settings.publishing.manualTitle")}
                      detail={t("ui.slurp.settings.publishing.manualDetail")}
                    />
                  )}
                  <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
                      <FileText size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />
                      <span className="flex-1">{t("ui.slurp.settings.publishing.generationDetails")}</span>
                      <ChevronRight
                        size={17}
                        className="transition-transform group-open:rotate-90 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
                      {settings.autoPostingScheduleEnabled && (
                        <Field
                          label={t("ui.slurp.settings.generationMode")}
                          detail={t("ui.slurp.settings.generationModeDetail")}
                        >
                          <select
                            value={settings.autoPostGenerationMode}
                            disabled={updateSettings.isPending}
                            onChange={(event) =>
                              void update(
                                "autoPostGenerationMode",
                                event.target.value as SlurpSettings["autoPostGenerationMode"],
                              )
                            }
                            className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                          >
                            <option value="pre_generate">{t("ui.slurp.settings.generationModePreGenerate")}</option>
                            <option value="on_demand">{t("ui.slurp.settings.generationModeOnDemand")}</option>
                          </select>
                        </Field>
                      )}
                      <Field
                        label={t("ui.slurp.settings.connections.creatorText")}
                        detail={t("ui.slurp.settings.connections.creatorTextDetail")}
                      >
                        <select
                          value={settings.generationConnectionId ?? ""}
                          disabled={connectionsQuery.isLoading || connectionsQuery.isError || updateSettings.isPending}
                          onChange={(event) => void update("generationConnectionId", event.target.value || null)}
                          className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                        >
                          <option value="">{t("ui.slurp.settings.connections.engineDefault")}</option>
                          {(connectionsQuery.data ?? [])
                            .filter((connection) => connection.provider !== "image_generation")
                            .map((connection) => (
                              <option key={connection.id} value={connection.id}>
                                {connection.name ?? connection.model ?? connection.id}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <PromptCard
                        title={t("ui.slurp.settings.prompts.generationGuidance")}
                        value={settings.generationGuidance}
                        isDefault={generationGuidanceIsDefault}
                        onEdit={() => {
                          setGenerationGuidanceDraft(settings.generationGuidance);
                          setGenerationGuidanceEditorOpen(true);
                        }}
                        onRestore={() =>
                          void restore(
                            { generationGuidance: DEFAULT_SLURP_GENERATION_GUIDANCE },
                            t("ui.slurp.settings.prompts.guidanceRestored"),
                          )
                        }
                      />
                    </div>
                  </details>
                </div>
              )}

              {section === "images" && (
                <div className="space-y-4">
                  <SectionTitle
                    title={t("ui.slurp.settings.images.title")}
                    detail={t("ui.slurp.settings.images.detail")}
                  />
                  <div
                    className={`flex items-start gap-3 rounded-xl p-4 ring-1 ring-inset ${imagesReady ? "bg-[color-mix(in_srgb,var(--slurp-success)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-success)]/25" : "bg-[color-mix(in_srgb,var(--slurp-warning)_8%,var(--slurp-surface-raised))] ring-[var(--slurp-warning)]/25"}`}
                  >
                    {imagesReady ? (
                      <CheckCircle2
                        size={19}
                        className="mt-0.5 shrink-0 text-[var(--slurp-success)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertTriangle
                        size={19}
                        className="mt-0.5 shrink-0 text-[var(--slurp-warning)]"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <h2 className="text-sm font-bold">
                        {imagesReady
                          ? t("ui.slurp.settings.images.readyTitle")
                          : t("ui.slurp.settings.images.needsSetupTitle")}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                        {t("ui.slurp.settings.images.howDetail")}
                      </p>
                    </div>
                  </div>
                  <Field
                    label={t("ui.slurp.settings.images.globalConnection")}
                    detail={t("ui.slurp.settings.images.globalConnectionDetail")}
                  >
                    <select
                      value={imageSettings?.defaultConnectionId ?? ""}
                      disabled={
                        imageSettingsQuery.isLoading ||
                        imageSettingsQuery.isError ||
                        connectionsQuery.isLoading ||
                        connectionsQuery.isError ||
                        updateImages.isPending
                      }
                      onChange={(event) =>
                        updateImages.mutate(
                          { defaultConnectionId: event.target.value || null },
                          { onError: (error) => toast.error(errorMessage(error)) },
                        )
                      }
                      className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
                    >
                      <option value="">{t("ui.slurp.settings.images.engineDefault")}</option>
                      {imageConnections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                          {connection.name ?? connection.model ?? connection.id}
                        </option>
                      ))}
                    </select>
                    {(imageSettingsQuery.isLoading || connectionsQuery.isLoading) && (
                      <p className="text-xs font-normal text-[var(--muted-foreground)]">
                        {t("ui.slurp.settings.images.loading")}
                      </p>
                    )}
                    {(imageSettingsQuery.isError || connectionsQuery.isError) && (
                      <p className="text-xs font-normal text-red-400">{t("ui.slurp.settings.images.loadError")}</p>
                    )}
                  </Field>
                  <Toggle
                    label={t("ui.slurp.settings.images.enableForNew")}
                    detail={t("ui.slurp.settings.images.enableForNewDetail")}
                    value={settings.autoPostingImagesEnabled}
                    onChange={(value) => update("autoPostingImagesEnabled", value)}
                  />
                  <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
                      <Image size={17} className="text-[var(--slurp-violet)]" aria-hidden="true" />
                      <span className="flex-1">{t("ui.slurp.settings.images.detailsTitle")}</span>
                      <ChevronRight
                        size={17}
                        className="transition-transform group-open:rotate-90 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Toggle
                          label={t("ui.slurp.settings.images.interpretPrompts")}
                          detail={t("ui.slurp.settings.images.interpretPromptsDetail")}
                          value={settings.enableImageInterpretation}
                          onChange={(value) => update("enableImageInterpretation", value)}
                        />
                        <Toggle
                          label={t("ui.slurp.settings.images.useAvatarReferences")}
                          detail={t("ui.slurp.settings.images.useAvatarReferencesDetail")}
                          value={settings.imageGenerationUseAvatarReferences}
                          onChange={(value) => update("imageGenerationUseAvatarReferences", value)}
                        />
                        <Toggle
                          label={t("ui.slurp.settings.images.includeDescriptions")}
                          detail={t("ui.slurp.settings.images.includeDescriptionsDetail")}
                          value={settings.imageGenerationIncludeDescriptions}
                          onChange={(value) => update("imageGenerationIncludeDescriptions", value)}
                        />
                      </div>
                      <PromptCard
                        title={t("ui.slurp.settings.images.instructions")}
                        value={settings.imageGenerationPrompt}
                        isDefault={imagePromptIsDefault}
                        onEdit={() => {
                          setImagePromptDraft(settings.imageGenerationPrompt);
                          setImagePromptEditorOpen(true);
                        }}
                        onRestore={() => void restoreDefaultImagePrompt()}
                      />
                    </div>
                  </details>
                </div>
              )}

              {section === "creators" && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <SectionTitle
                      title={t("ui.slurp.settings.creators.title")}
                      detail={t("ui.slurp.settings.creators.detail")}
                    />
                    <button
                      type="button"
                      onClick={onAddCreators}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--noodle-accent)]/40 px-3 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
                    >
                      <UsersRound size={14} />
                      {t("ui.slurp.settings.creators.add")}
                    </button>
                  </div>
                  {accountsQuery.isLoading ? (
                    <div className="flex justify-center py-10 text-[var(--muted-foreground)]" role="status">
                      <Loader2 size={20} className="animate-spin" />
                    </div>
                  ) : accountsQuery.isError ? (
                    <div className="rounded-lg border border-red-400/30 p-5 text-sm">
                      <p>{t("ui.slurp.settings.creators.loadError")}</p>
                      <button
                        type="button"
                        onClick={() => void accountsQuery.refetch()}
                        className="mt-3 min-h-11 rounded-lg border border-[var(--border)] px-3 font-semibold"
                      >
                        {t("capabilities.actions.tryAgain")}
                      </button>
                    </div>
                  ) : accountsQuery.data?.length && selectedCreator ? (
                    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(13rem,0.78fr)_minmax(0,1.7fr)]">
                      <div
                        className="grid snap-x grid-flow-col auto-cols-[minmax(13rem,1fr)] gap-2 overflow-x-auto rounded-xl pb-2 pe-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:rounded-xl xl:bg-[var(--slurp-surface-raised,var(--background))] xl:pb-0 xl:pe-0 xl:ring-1 xl:ring-inset xl:ring-[var(--border)]"
                        aria-label={t("ui.slurp.settings.creators.listLabel")}
                      >
                        {accountsQuery.data.map((creator) => {
                          const status = reserveStatusQuery.data?.creators.find(
                            (entry) => entry.accountId === creator.id,
                          );
                          const selected = creator.id === selectedCreator.id;
                          return (
                            <button
                              key={creator.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setSelectedCreatorId(creator.id)}
                              className={`flex min-h-20 w-full snap-start items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised,var(--background))] px-3 py-3 text-left shadow-sm ring-1 ring-inset transition-[background-color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 xl:rounded-none xl:border-b xl:border-[var(--border)] xl:shadow-none xl:last:border-b-0 ${selected ? "ring-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 xl:ring-0" : "ring-[var(--border)] hover:bg-[var(--accent)] xl:ring-0"}`}
                            >
                              <Avatar account={creator} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">{creator.displayName}</span>
                                <span className="block truncate text-xs text-[var(--muted-foreground)]">
                                  @{creator.handle}
                                </span>
                                <span className="mt-1 block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                                  {status?.nextPreparedAt
                                    ? t("ui.slurp.settings.creators.nextPost", {
                                        date: new Date(status.nextPreparedAt).toLocaleString(i18n.language),
                                      })
                                    : t(`ui.slurp.settings.creators.sourceStatus.${creator.sourceStatus.state}`)}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <section
                        className="min-w-0 overflow-hidden rounded-2xl bg-[var(--slurp-canvas,var(--background))] shadow-[0_18px_42px_-34px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-[var(--border)]"
                        aria-labelledby="slurp-selected-creator-title"
                      >
                        <div className="relative isolate flex flex-col gap-4 overflow-hidden border-b border-[var(--border)] bg-[linear-gradient(135deg,var(--slurp-surface-raised,var(--background)),color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised)))] p-4 sm:flex-row sm:items-center sm:p-5">
                          <span
                            className="pointer-events-none absolute -end-8 -top-14 -z-10 h-36 w-36 rounded-full bg-[var(--noodle-accent)]/10 blur-2xl"
                            aria-hidden="true"
                          />
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar account={selectedCreator} />
                            <div className="min-w-0 flex-1">
                              <h2 id="slurp-selected-creator-title" className="truncate text-base font-bold">
                                {selectedCreator.displayName}
                              </h2>
                              <p className="truncate text-xs text-[var(--muted-foreground)]">
                                @{selectedCreator.handle}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
                            <button
                              type="button"
                              onClick={() =>
                                onNavigate({
                                  mode: "creator",
                                  view: "profile",
                                  accountId: selectedCreator.id,
                                  returnToSettings: navigation,
                                })
                              }
                              className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                            >
                              {t("ui.slurp.settings.creators.viewProfile")}
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditCreator(selectedCreator)}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                            >
                              <Pencil size={14} />
                              {t("ui.slurp.settings.creators.edit")}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-5 p-4 sm:p-5">
                          <CreatorDetailGroup title={t("ui.slurp.settings.creators.postingGroup")}>
                            {!personaCreator(selectedCreator) ? (
                              <Toggle
                                label={t("ui.slurp.settings.creators.autoPost")}
                                value={selectedCreator.autoPosting.enabled}
                                onChange={(value) =>
                                  updateAuto.mutate(
                                    { accountId: selectedCreator.id, enabled: value },
                                    { onError: (error) => toast.error(errorMessage(error)) },
                                  )
                                }
                              />
                            ) : (
                              <p className="rounded-lg border border-[var(--border)] p-3 text-xs leading-5 text-[var(--muted-foreground)]">
                                {t("ui.slurp.settings.creators.personaAutomationDetail")}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => setScheduleCreatorId(selectedCreator.id)}
                              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
                            >
                              <CalendarClock size={15} />
                              {t("ui.slurp.settings.creators.schedule")}
                            </button>
                          </CreatorDetailGroup>

                          <CreatorDetailGroup title={t("ui.slurp.settings.creators.imagesGroup")}>
                            <Toggle
                              label={t("ui.slurp.settings.creators.images")}
                              value={selectedCreator.autoPosting.imagesEnabled}
                              onChange={(value) =>
                                updateAuto.mutate(
                                  { accountId: selectedCreator.id, imagesEnabled: value },
                                  { onError: (error) => toast.error(errorMessage(error)) },
                                )
                              }
                            />
                            <Field
                              label={t("ui.slurp.settings.creators.imageConnection")}
                              detail={t("ui.slurp.settings.creators.imageConnectionDetail")}
                            >
                              <select
                                disabled={
                                  imageSettingsQuery.isLoading ||
                                  imageSettingsQuery.isError ||
                                  connectionsQuery.isLoading ||
                                  connectionsQuery.isError ||
                                  updateImages.isPending
                                }
                                value={imageSettings?.creatorConnectionIds[selectedCreator.id] ?? ""}
                                onChange={(event) =>
                                  updateImages.mutate(
                                    { creatorId: selectedCreator.id, connectionId: event.target.value || null },
                                    { onError: (error) => toast.error(errorMessage(error)) },
                                  )
                                }
                                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
                              >
                                <option value="">{t("ui.slurp.settings.creators.inheritImageConnection")}</option>
                                {imageConnections.map((connection) => (
                                  <option key={connection.id} value={connection.id}>
                                    {connection.name ?? connection.model ?? connection.id}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </CreatorDetailGroup>

                          {selectedCreator.sourceStatus.state === "missing" && (
                            <p className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-xs text-red-300">
                              {t("ui.slurp.settings.creators.sourceMissing")}
                            </p>
                          )}
                          {selectedCreator.sourceStatus.state === "changed" && (
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/30 p-3">
                              <p className="text-xs font-semibold">{t("ui.slurp.settings.creators.sourceChanged")}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {selectedCreator.disclosureMode === "open" && (
                                  <button
                                    type="button"
                                    disabled={adoptSourceIdentity.isPending}
                                    onClick={() =>
                                      adoptSourceIdentity.mutate(selectedCreator.id, {
                                        onError: (error) => toast.error(errorMessage(error)),
                                      })
                                    }
                                    className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
                                  >
                                    {t("ui.slurp.settings.creators.acceptIdentity")}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onRedraftCreator(selectedCreator)}
                                  className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold"
                                >
                                  {t("ui.slurp.settings.creators.reviewRedraft")}
                                </button>
                                <button
                                  type="button"
                                  disabled={dismissSourceChanges.isPending}
                                  onClick={() =>
                                    dismissSourceChanges.mutate(selectedCreator.id, {
                                      onSuccess: () => toast.success(t("ui.slurp.settings.creators.acceptedChanges")),
                                      onError: (error) => toast.error(errorMessage(error)),
                                    })
                                  }
                                  className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
                                >
                                  {t("ui.slurp.settings.creators.acceptChanges")}
                                </button>
                              </div>
                            </div>
                          )}

                          <details className="rounded-lg border border-red-400/25">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-xs font-semibold text-red-300 [&::-webkit-details-marker]:hidden">
                              {t("ui.slurp.settings.creators.moreActions")}
                            </summary>
                            <div className="border-t border-red-400/20 p-3">
                              <button
                                type="button"
                                disabled={deleteCreator.isPending}
                                onClick={() => void confirmDeleteCreator(selectedCreator)}
                                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-400/50 px-3 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                {t("ui.slurp.settings.creators.delete")}
                              </button>
                            </div>
                          </details>
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                      {t("ui.slurp.settings.creators.none")}
                    </div>
                  )}
                </div>
              )}

              {section === "advanced" && (
                <div className="space-y-5">
                  <SectionTitle
                    title={t("ui.slurp.settings.advanced.title")}
                    detail={t("ui.slurp.settings.advanced.detail")}
                  />
                  <div className="rounded-md border border-[var(--border)] p-4">
                    <h2 className="text-sm font-semibold">{t("ui.slurp.settings.advanced.setupAgain")}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                      {t("ui.slurp.settings.advanced.setupAgainDetail")}
                    </p>
                    <button
                      type="button"
                      onClick={onRestartOnboarding}
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
                    >
                      <RefreshCw size={14} />
                      {t("ui.slurp.settings.advanced.restartSetup")}
                    </button>
                  </div>
                  <div className="rounded-md border border-red-400/30 p-4">
                    <h2 className="text-sm font-semibold">{t("ui.slurp.settings.advanced.deleteAllTitle")}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                      {t("ui.slurp.settings.advanced.deleteAllDetail")}
                    </p>
                    <button
                      type="button"
                      disabled={deleteAllData.isPending}
                      onClick={() =>
                        void showConfirmDialog({
                          title: t("ui.slurp.settings.advanced.deleteAllConfirmTitle"),
                          message: t("ui.slurp.settings.advanced.deleteAllConfirmDetail"),
                          confirmLabel: t("ui.slurp.settings.advanced.deleteAllButton"),
                        })
                          .then((confirmed) => {
                            if (!confirmed) return;
                            deleteAllData.mutate(undefined, {
                              onSuccess: () => toast.success(t("ui.slurp.settings.advanced.deleteAllSuccess")),
                              onError: (error) => toast.error(errorMessage(error)),
                            });
                          })
                          .catch((error) => toast.error(errorMessage(error)))
                      }
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-red-400/50 px-3 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {t("ui.slurp.settings.advanced.deleteAllButton")}
                    </button>
                  </div>
                  <div className="rounded-md border border-[var(--border)] p-4">
                    <h2 className="text-sm font-semibold">{t("ui.slurp.settings.advanced.deleteUnusedTitle")}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                      {t("ui.slurp.settings.advanced.deleteUnusedDetail")}
                    </p>
                    <button
                      type="button"
                      disabled={deleteUnusedData.isPending || deleteAllData.isPending}
                      onClick={() =>
                        void showConfirmDialog({
                          title: t("ui.slurp.settings.advanced.deleteUnusedConfirmTitle"),
                          message: t("ui.slurp.settings.advanced.deleteUnusedConfirmDetail"),
                          confirmLabel: t("ui.slurp.settings.advanced.deleteUnusedButton"),
                        })
                          .then((confirmed) => {
                            if (!confirmed) return;
                            deleteUnusedData.mutate(undefined, {
                              onSuccess: () => toast.success(t("ui.slurp.settings.advanced.deleteUnusedSuccess")),
                              onError: (error) => toast.error(errorMessage(error)),
                            });
                          })
                          .catch((error) => toast.error(errorMessage(error)))
                      }
                      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {t("ui.slurp.settings.advanced.deleteUnusedButton")}
                    </button>
                  </div>
                </div>
              )}

              {section === "audience" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <SectionTitle
                      title={t("ui.slurp.settings.audience.title")}
                      detail={t("ui.slurp.settings.audience.detail")}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        refreshFans.mutate(undefined, {
                          onSuccess: (result) =>
                            toast.success(
                              result.created > 0
                                ? t("ui.slurp.settings.audience.created", { count: result.created })
                                : t("ui.slurp.settings.audience.createdNone"),
                            ),
                          onError: (error) => toast.error(errorMessage(error)),
                        })
                      }
                      disabled={refreshFans.isPending || !settings.fanActivityEnabled}
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={refreshFans.isPending ? "animate-spin" : ""} />
                      {t("ui.slurp.settings.audience.refresh")}
                    </button>
                  </div>
                  <Toggle
                    label={t("ui.slurp.settings.audience.enabled")}
                    detail={t("ui.slurp.settings.audience.enabledDetail")}
                    value={settings.fanActivityEnabled}
                    onChange={(value) => update("fanActivityEnabled", value)}
                  />
                  {settings.fanActivityEnabled ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label={t("ui.slurp.settings.audience.runsPerDay")}
                          detail={t("ui.slurp.settings.audience.runsPerDayDetail")}
                        >
                          <NumberSetting
                            value={settings.fanActivityRunsPerDay}
                            min={1}
                            max={24}
                            onSave={(value) => update("fanActivityRunsPerDay", value)}
                          />
                        </Field>
                        <div className="rounded-md border border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)]">
                          {fanStatusQuery.isError
                            ? t("ui.slurp.settings.audience.statusError")
                            : fanStatusQuery.data
                              ? t("ui.slurp.settings.audience.statusUsed", {
                                  used: fanStatusQuery.data.usedRuns,
                                  limit: fanStatusQuery.data.runLimit,
                                })
                              : t("ui.slurp.settings.audience.statusLoading")}
                        </div>
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold">{t("ui.slurp.settings.audience.perRun")}</h2>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {t("ui.slurp.settings.audience.perRunDetail")}
                        </p>
                        <div className="mt-3 grid gap-4 sm:grid-cols-3">
                          <Field label={t("ui.slurp.settings.audience.likes")}>
                            <NumberSetting
                              value={settings.fanLikesPerRefresh}
                              min={0}
                              max={24}
                              onSave={(value) => update("fanLikesPerRefresh", value)}
                            />
                          </Field>
                          <Field label={t("ui.slurp.settings.audience.replies")}>
                            <NumberSetting
                              value={settings.fanRepliesPerRefresh}
                              min={0}
                              max={12}
                              onSave={(value) => update("fanRepliesPerRefresh", value)}
                            />
                          </Field>
                          <Field label={t("ui.slurp.settings.audience.reposts")}>
                            <NumberSetting
                              value={settings.fanRepostsPerRefresh}
                              min={0}
                              max={12}
                              onSave={(value) => update("fanRepostsPerRefresh", value)}
                            />
                          </Field>
                        </div>
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold">{t("ui.slurp.settings.audience.mix")}</h2>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {t("ui.slurp.settings.audience.mixDetail")}
                        </p>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          {archetypes.map((key) => (
                            <Field key={key} label={t(`ui.slurp.settings.audience.archetypes.${key}`)}>
                              <NumberSetting
                                value={settings.fanArchetypeWeights[key] ?? 0}
                                min={0}
                                max={100}
                                onSave={(value) => {
                                  const next = {
                                    ...settings.fanArchetypeWeights,
                                    [key]: value,
                                  };
                                  if (!Object.values(next).some((weight) => weight > 0)) {
                                    toast.error(t("ui.slurp.settings.audience.keepOne"));
                                    return false;
                                  }
                                  return update("fanArchetypeWeights", next);
                                }}
                              />
                            </Field>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <GuidanceBox
                      title={t("ui.slurp.settings.audience.pausedTitle")}
                      detail={t("ui.slurp.settings.audience.pausedDetail")}
                    />
                  )}
                  <div className="space-y-3 pt-2">
                    <div>
                      <h2 className="text-sm font-bold">{t("ui.slurp.settings.audience.feedExperience")}</h2>
                      <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                        {t("ui.slurp.settings.audience.feedExperienceDetail")}
                      </p>
                    </div>
                    <Toggle
                      label={t("ui.slurp.settings.inlinePromotions")}
                      detail={t("ui.slurp.settings.inlinePromotionsDetail")}
                      value={settings.inlineAdsEnabled}
                      onChange={(value) => update("inlineAdsEnabled", value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Modal
        open={refreshModalOpen}
        onClose={() => setRefreshModalOpen(false)}
        title={t("ui.slurp.settings.refresh.title")}
        width="max-w-xl"
        closeDisabled={refreshCreators.isPending}
        panelClassName="noodle-icon-scope"
        panelStyle={getNoodleAccentStyle(NOODLE_PINK, {
          "--background": "#17121b",
          "--foreground": "#fff7fc",
          "--muted-foreground": "#d8c9d4",
          "--border": "rgba(255, 126, 193, 0.24)",
          "--accent": "rgba(255, 126, 193, 0.12)",
        })}
      >
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{t("ui.slurp.settings.refresh.creators")}</h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRefreshAccountIds(new Set(automationCreators.map((creator) => creator.id)))}
                  className="text-[var(--noodle-accent)] hover:underline"
                >
                  {t("ui.slurp.settings.refresh.selectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setRefreshAccountIds(new Set())}
                  className="text-[var(--muted-foreground)] hover:underline"
                >
                  {t("ui.slurp.settings.refresh.clear")}
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-md border border-[var(--border)]">
              {automationCreators.map((creator) => (
                <label
                  key={creator.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--accent)]/40"
                >
                  <input
                    type="checkbox"
                    checked={refreshAccountIds.has(creator.id)}
                    onChange={(event) =>
                      setRefreshAccountIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(creator.id);
                        else next.delete(creator.id);
                        return next;
                      })
                    }
                    className="h-4 w-4 accent-[var(--noodle-accent)]"
                  />
                  <Avatar account={creator} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{creator.displayName}</span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">@{creator.handle}</span>
                  </span>
                  {creator.autoPosting.enabled && (
                    <span className="text-[0.625rem] font-semibold text-[var(--noodle-accent)]">
                      {t("ui.slurp.settings.creators.autoPostShort")}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">{t("ui.slurp.settings.refresh.postAccess")}</legend>
            <div className="mt-2 grid grid-cols-2 rounded-md border border-[var(--border)] p-1">
              {(["public", "locked"] as const).map((access) => (
                <button
                  key={access}
                  type="button"
                  aria-pressed={refreshAccess === access}
                  onClick={() => setRefreshAccess(access)}
                  className={`min-h-10 rounded-md text-sm font-semibold capitalize ${refreshAccess === access ? "bg-[var(--noodle-accent)] text-zinc-950" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
                >
                  {access}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {t("ui.slurp.settings.refresh.modalDetail")}
          </p>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              disabled={refreshCreators.isPending}
              onClick={() => setRefreshModalOpen(false)}
              className="min-h-10 rounded-md border border-[var(--border)] px-4 text-xs font-semibold"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={refreshCreators.isPending || refreshAccountIds.size === 0}
              onClick={() =>
                refreshCreators.mutate(
                  { accountIds: [...refreshAccountIds], access: refreshAccess },
                  {
                    onSuccess: ({ outcomes }) => {
                      const generated = outcomes.filter((outcome) => outcome.status === "generated").length;
                      const skipped = outcomes.filter((outcome) => outcome.status === "skipped").length;
                      const failed = outcomes.length - generated - skipped;
                      setRefreshModalOpen(false);
                      toast.success(t("ui.slurp.settings.refresh.result", { count: generated }));
                      if (skipped) toast(t("ui.slurp.settings.refresh.skipped", { count: skipped }));
                      if (failed) toast.error(t("ui.slurp.settings.refresh.failed", { count: failed }));
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
            >
              {refreshCreators.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {t("ui.slurp.settings.refresh.generate", { count: refreshAccountIds.size || "" })}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(scheduleCreatorId)}
        onClose={() => setScheduleCreatorId(null)}
        title={t("ui.slurp.settings.creators.scheduleTitle", { name: scheduleCreator?.displayName ?? "" })}
        width="max-w-xl"
        closeDisabled={updateScheduleSlot.isPending}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">{t("ui.slurp.settings.creators.scheduleDetail")}</p>
          {reserveStatusQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted-foreground)]">
              <Loader2 size={18} className="animate-spin" />
              {t("ui.noodle.noodlerschedulemanagermodal.loadingStatus")}
            </div>
          ) : reserveStatusQuery.isError ? (
            <div className="rounded-md border border-red-400/30 p-5 text-sm">
              <p>{t("ui.noodle.noodlerschedulemanagermodal.couldNotLoadStatus")}</p>
              <button
                type="button"
                onClick={() => void reserveStatusQuery.refetch()}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 font-semibold"
              >
                <RefreshCw size={14} />
                {t("capabilities.actions.tryAgain")}
              </button>
            </div>
          ) : scheduleSlots.length > 0 ? (
            <div className="space-y-3">
              {scheduleSlots.map((slot) => (
                <ScheduleSlotEditor
                  key={`${slot.id}:${slot.publishAt}`}
                  slot={slot}
                  pending={updateScheduleSlot.isPending}
                  onSave={async (publishAt) => {
                    try {
                      await updateScheduleSlot.mutateAsync({ slotId: slot.id, publishAt });
                      toast.success(t("ui.slurp.settings.creators.scheduleSaved"));
                    } catch (error) {
                      toast.error(errorMessage(error));
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.creators.scheduleEmpty")}
            </p>
          )}
        </div>
      </Modal>
      <PromptEditor
        open={generationGuidanceEditorOpen}
        title={t("ui.slurp.settings.prompts.editGenerationGuidance")}
        value={generationGuidanceDraft}
        onChange={setGenerationGuidanceDraft}
        onClose={() => {
          setGenerationGuidanceDraft(settings.generationGuidance);
          setGenerationGuidanceEditorOpen(false);
        }}
        onSave={async () => {
          if (await saveGenerationGuidance()) setGenerationGuidanceEditorOpen(false);
        }}
        onRestore={() => setGenerationGuidanceDraft(DEFAULT_SLURP_GENERATION_GUIDANCE)}
        pending={updateSettings.isPending}
      />
      <PromptEditor
        open={imagePromptEditorOpen}
        title={t("ui.slurp.settings.prompts.editImagePrompt")}
        value={imagePromptDraft}
        onChange={setImagePromptDraft}
        onClose={() => {
          setImagePromptDraft(settings.imageGenerationPrompt);
          setImagePromptEditorOpen(false);
        }}
        onSave={async () => {
          if (await saveImagePrompt()) setImagePromptEditorOpen(false);
        }}
        onRestore={() => setImagePromptDraft(DEFAULT_SLURP_IMAGE_GENERATION_PROMPT)}
        pending={updateSettings.isPending}
      />
    </>
  );
}

function localDateTimeValue(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function ScheduleSlotEditor({
  slot,
  pending,
  onSave,
}: {
  slot: SlurpScheduleSlot;
  pending: boolean;
  onSave: (publishAt: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(() => localDateTimeValue(slot.publishAt));
  const parsed = Date.parse(draft);
  const unchanged = !Number.isNaN(parsed) && new Date(parsed).toISOString() === slot.publishAt;
  const valid = !Number.isNaN(parsed) && parsed > Date.now();
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <span>
          {slot.state === "prepared"
            ? t("ui.slurp.settings.creators.prepared")
            : t("ui.slurp.settings.creators.scheduled")}
        </span>
        <span>{new Date(slot.publishAt).toLocaleString(i18n.language)}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="datetime-local"
          aria-label={t("ui.slurp.settings.creators.publicationTime")}
          value={draft}
          min={localDateTimeValue(new Date(Date.now() + 60_000).toISOString())}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
        />
        <button
          type="button"
          disabled={pending || unchanged || !valid}
          onClick={() => void onSave(new Date(parsed).toISOString())}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-[var(--noodle-accent-foreground)] disabled:opacity-45"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {t("ui.slurp.settings.creators.saveTime")}
        </button>
      </div>
    </div>
  );
}

function OverviewCard({
  icon,
  title,
  status,
  details,
  avatars,
  onClick,
  tone,
  healthy,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  details: string[];
  avatars?: NoodlerManagedStageProfile[];
  onClick: () => void;
  tone: "pink" | "violet" | "blue" | "coral";
  healthy?: boolean;
}) {
  const toneClass =
    tone === "pink"
      ? "from-[var(--noodle-accent)] to-[#a51d61]"
      : tone === "violet"
        ? "from-[var(--slurp-violet)] to-[#7441a0]"
        : tone === "blue"
          ? "from-[#7777ef] to-[#5145bb]"
          : "from-[var(--slurp-coral)] to-[#b83f45]";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-36 rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-start shadow-[0_20px_48px_-38px_rgba(71,16,52,0.9)] ring-1 ring-inset ring-[var(--slurp-outline)] transition-[background-color,transform] hover:bg-[color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-surface-raised))] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span className="flex items-start gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${toneClass} text-white shadow-lg`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-black">{title}</span>
            {healthy !== undefined &&
              (healthy ? (
                <CheckCircle2 size={15} className="shrink-0 text-[var(--slurp-success)]" aria-hidden="true" />
              ) : (
                <AlertTriangle size={15} className="shrink-0 text-[var(--slurp-warning)]" aria-hidden="true" />
              ))}
          </span>
          <span className="mt-2 block text-sm font-bold text-[var(--noodle-accent-foreground)]">{status}</span>
          {avatars && avatars.length > 0 && (
            <span className="mt-3 flex -space-x-2 rtl:space-x-reverse">
              {avatars.map((creator) => (
                <span key={creator.id} className="rounded-full bg-[var(--slurp-surface-raised)] p-0.5">
                  <Avatar account={creator} size="sm" />
                </span>
              ))}
            </span>
          )}
          <span className="mt-2 block space-y-0.5">
            {details.map((detail) => (
              <span key={detail} className="block text-xs leading-4 text-[var(--slurp-muted)]">
                {detail}
              </span>
            ))}
          </span>
        </span>
        <ChevronRight
          size={18}
          className="mt-1 shrink-0 text-[var(--slurp-muted)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

function OverviewActivity({
  reserveStatus,
  reserveLoading,
  reserveError,
  fanStatus,
  refreshPending,
  onRetry,
}: {
  reserveStatus?: SlurpReserveStatus;
  reserveLoading: boolean;
  reserveError: boolean;
  fanStatus?: { usedRuns: number; runLimit: number; lastRun: { status: string; finishedAt: string | null } | null };
  refreshPending: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const formatTime = (value: string | null | undefined) =>
    value
      ? new Date(value).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })
      : t("ui.slurp.settings.overview.activity.notAvailable");
  const usage = reserveStatus ? `${reserveStatus.textAttemptsUsed} / ${reserveStatus.postsPerDay}` : "--";
  const fanUsage = fanStatus ? `${fanStatus.usedRuns} / ${fanStatus.runLimit}` : "--";

  return (
    <section
      className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
      aria-labelledby="slurp-activity-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={17} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
          <h2 id="slurp-activity-title" className="text-sm font-black">
            {t("ui.slurp.settings.overview.activity.title")}
          </h2>
        </div>
        {(reserveError || fanStatus === undefined) && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <RefreshCw size={13} aria-hidden="true" />
            {t("capabilities.actions.tryAgain")}
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ActivityRow
          icon={
            refreshPending ? (
              <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <CheckCircle2 size={15} />
            )
          }
          label={t("ui.slurp.settings.overview.activity.current")}
          value={
            refreshPending
              ? t("ui.slurp.settings.overview.activity.generating")
              : t("ui.slurp.settings.overview.activity.idle")
          }
          tone={refreshPending ? "active" : "ready"}
        />
        <ActivityRow
          icon={<CalendarClock size={15} />}
          label={t("ui.slurp.settings.overview.activity.prepared")}
          value={reserveLoading ? "..." : reserveStatus ? `${reserveStatus.preparedCount}` : "--"}
          detail={
            reserveStatus?.preparedThrough
              ? t("ui.slurp.settings.overview.activity.through", { time: formatTime(reserveStatus.preparedThrough) })
              : undefined
          }
          tone="waiting"
        />
        <ActivityRow
          icon={<Sparkles size={15} />}
          label={t("ui.slurp.settings.overview.activity.textUsage")}
          value={usage}
          detail={t("ui.slurp.settings.overview.activity.today")}
          tone="active"
        />
        <ActivityRow
          icon={<Megaphone size={15} />}
          label={t("ui.slurp.settings.overview.activity.audience")}
          value={fanUsage}
          detail={
            fanStatus?.lastRun
              ? t("ui.slurp.settings.overview.activity.lastRun", { time: formatTime(fanStatus.lastRun.finishedAt) })
              : undefined
          }
          tone="ready"
        />
      </div>
    </section>
  );
}

function ActivityRow({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: "active" | "ready" | "waiting";
}) {
  const toneClass =
    tone === "active"
      ? "text-[var(--noodle-accent)]"
      : tone === "waiting"
        ? "text-[var(--slurp-warning)]"
        : "text-[var(--slurp-success)]";
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-lg bg-[var(--slurp-canvas)] px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline)]">
      <span className={`shrink-0 ${toneClass}`} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--slurp-muted)]">{label}</span>
        {detail && <span className="block truncate text-[0.68rem] text-[var(--slurp-muted)]">{detail}</span>}
      </span>
      <span className={`shrink-0 text-sm font-black ${toneClass}`}>{value}</span>
    </div>
  );
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-lg font-black tracking-tight text-balance">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] text-pretty">{detail}</p>
    </div>
  );
}
function CreatorDetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="space-y-4 rounded-xl bg-[var(--slurp-surface-raised,var(--background))] p-4 shadow-[0_12px_28px_-26px_rgba(0,0,0,0.9)] sm:p-5"
      aria-label={title}
    >
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent-foreground)]">{title}</h3>
      {children}
    </section>
  );
}
function GuidanceBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[var(--noodle-accent)]/[0.065] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/20 sm:p-5">
      <span className="absolute inset-y-3 start-0 w-0.5 rounded-full bg-[var(--noodle-accent)]" aria-hidden="true" />
      <p className="text-sm font-bold text-[var(--noodle-accent)]">{title}</p>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] text-pretty">{detail}</p>
    </div>
  );
}
function Field({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-semibold">
      <span className="block">{label}</span>
      {detail && <span className="block text-xs font-normal leading-5 text-[var(--muted-foreground)]">{detail}</span>}
      {children}
    </label>
  );
}
function Toggle({
  label,
  detail,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label
      data-slurp-setting-toggle
      className={`group flex ${compact ? "min-h-11" : "min-h-16"} cursor-pointer items-center justify-between gap-4 rounded-lg bg-[var(--slurp-surface-raised,var(--background))] px-3 py-2 text-sm shadow-[0_10px_24px_-24px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-transparent transition-[background-color,box-shadow] hover:bg-[var(--accent)]/40 hover:ring-[var(--border)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)] motion-reduce:transition-none`}
    >
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {detail && (
          <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted-foreground)]">{detail}</span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-[var(--muted-foreground)]/25 shadow-inner transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[var(--noodle-accent)] peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:after:transition-none"
      />
    </label>
  );
}
function PromptCard({
  title,
  value,
  isDefault,
  onEdit,
  onRestore,
}: {
  title: string;
  value: string;
  isDefault: boolean;
  onEdit: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 rounded-md border border-[var(--border)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]">
          <FileText size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{title}</p>
            <span className="rounded-full border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/10 px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--noodle-accent)]">
              {isDefault ? t("ui.slurp.settings.prompts.default") : t("ui.slurp.settings.prompts.custom")}
            </span>
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-[var(--muted-foreground)]">
            {value}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onRestore}
          disabled={isDefault}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-[var(--noodle-accent)]/35 px-3 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-45"
        >
          <RotateCcw size={13} />
          {t("ui.slurp.settings.prompts.restoreDefault")}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
        >
          <Pencil size={14} className="text-[var(--noodle-accent)]" />
          {t("ui.slurp.settings.prompts.edit")}
        </button>
      </div>
    </div>
  );
}
function PromptEditor({
  open,
  title,
  value,
  onChange,
  onClose,
  onSave,
  onRestore,
  pending,
}: {
  open: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onRestore: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-3xl" closeDisabled={pending}>
      <div className="space-y-4">
        <label className="block text-sm font-semibold">
          <span className="sr-only">{title}</span>
          <textarea
            aria-label={title}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-[22rem] w-full resize-y rounded-md border border-[var(--border)] bg-transparent p-3 text-sm leading-6"
          />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onRestore}
            disabled={pending}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-[var(--noodle-accent)]/35 px-3 text-xs font-semibold text-[var(--noodle-accent)] disabled:opacity-45"
          >
            <RotateCcw size={13} />
            {t("ui.slurp.settings.prompts.restoreDefault")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-10 flex-1 rounded-md border border-[var(--border)] px-4 text-xs font-semibold sm:flex-none"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!value.trim() || pending}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-45"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {t("ui.slurp.settings.prompts.save")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
