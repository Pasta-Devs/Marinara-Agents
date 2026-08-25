import { CalendarClock, FileText, Loader2, Pencil, RefreshCw, RotateCcw, Save, Trash2, UsersRound } from "lucide-react";
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
const archetypeLabels: Record<(typeof archetypes)[number], string> = {
  ordinary: "Regular readers",
  eccentric: "Unusual personalities",
  crossFandom: "Shared interests",
  raider: "Deal hunters",
  organicDiscovery: "New discoveries",
  freeResource: "Helpful readers",
};
const DEFAULT_SLURP_GENERATION_GUIDANCE =
  "All Slurp creators and viewers are adults (18+). This is an adult creator page: flirty, suggestive, teasing, and sensual posts are common, and explicit posts appear regularly when they suit the creator — but they are not required and need not be the majority. Tease the locked posts and answer flirty comments in kind. Keep each creator's personality intact: a shy creator flirts shyly, a blunt one bluntly, a funny one filthily. Ordinary posts — updates, humor, behind the scenes, project news — matter just as much and keep both the page and the character human. Keep low mood or conflict uncommon and character-specific, and do not let recent posts set the default mood.";
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
      className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm"
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
  const { t } = useTranslation();
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
  useEffect(() => {
    if (settings) {
      if (!generationGuidanceEditorOpen) setGenerationGuidanceDraft(settings.generationGuidance);
      if (!imagePromptEditorOpen) setImagePromptDraft(settings.imageGenerationPrompt);
    }
  }, [generationGuidanceEditorOpen, imagePromptEditorOpen, settings]);
  const section = navigation.section ?? "general";
  const save = async (patch: Partial<SlurpSettings>) => {
    try {
      await updateSettings.mutateAsync(patch);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };
  const update = (key: keyof SlurpSettings, value: unknown) => save({ [key]: value } as Partial<SlurpSettings>);
  const accountsQuery = useNoodlerAccounts(section === "creators" || section === "general");
  const imageSettingsQuery = useSlurpImageConnections(section === "images" || section === "creators");
  const fanStatusQuery = useNoodlerFanActivityStatus(section === "audience");
  const reserveStatusQuery = useNoodlerReserveStatus(section === "creators");
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
  const connectionsQuery = useSlurpConnections(section === "general" || section === "images" || section === "creators");
  const imageConnections = (connectionsQuery.data ?? []).filter(
    (connection) => connection.provider === "image_generation",
  );
  const imageSettings = imageSettingsQuery.data;
  const personaCreator = (creator: NoodlerManagedStageProfile) =>
    Boolean(creator.sourceAccountId && personaSourceIds.has(creator.sourceAccountId));
  const automationCreators = (accountsQuery.data ?? []).filter((creator) => !personaCreator(creator));
  const scheduleCreator = accountsQuery.data?.find((creator) => creator.id === scheduleCreatorId) ?? null;
  const scheduleSlots =
    reserveStatusQuery.data?.creators.find((creator) => creator.accountId === scheduleCreatorId)?.slots ?? [];
  const generationGuidanceIsDefault = settings?.generationGuidance === DEFAULT_SLURP_GENERATION_GUIDANCE;
  const imagePromptIsDefault = settings?.imageGenerationPrompt === DEFAULT_SLURP_IMAGE_GENERATION_PROMPT;
  const activityPreset = settings && slurpActivityPresetForSettings(settings);
  const restore = async (patch: Partial<SlurpSettings>, message = "Settings saved.") => {
    try {
      await updateSettings.mutateAsync(patch);
      toast.success(message);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };
  const restoreDefaultImagePrompt = () =>
    restore({ imageGenerationPrompt: DEFAULT_SLURP_IMAGE_GENERATION_PROMPT }, "Default image prompt restored.");
  const saveImagePrompt = () => restore({ imageGenerationPrompt: imagePromptDraft }, "Image prompt saved.");
  const saveGenerationGuidance = () =>
    restore({ generationGuidance: generationGuidanceDraft }, "Generation guidance saved.");

  if (settingsQuery.isError)
    return (
      <main className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-[var(--muted-foreground)]">
        <p>Settings could not be loaded.</p>
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
      <main className="h-full overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-5 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--noodle-accent)]">Slurp</p>
              <h1 className="mt-1 text-2xl font-bold">{t("ui.slurp.settings.title")}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                {t("ui.slurp.settings.detail")}
              </p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">{t("ui.slurp.settings.autoSave")}</p>
          </header>
          <nav
            className="flex gap-2 overflow-x-auto border-b border-[var(--border)] pb-4"
            aria-label={t("ui.slurp.settings.sectionsLabel")}
          >
            {(["general", "creators", "images", "audience", "advanced"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-current={section === item ? "page" : undefined}
                onClick={() => onNavigate({ ...navigation, section: item })}
                className={`min-h-10 shrink-0 rounded-md border px-4 text-sm font-semibold ${section === item ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]" : "border-[var(--border)] hover:bg-[var(--accent)]"}`}
              >
                {t(`ui.slurp.settings.tabs.${item === "general" ? "publishing" : item}`)}
              </button>
            ))}
          </nav>

          {section === "general" && (
            <div className="space-y-6">
              <SectionTitle
                title={t("ui.slurp.settings.publishing.title")}
                detail={t("ui.slurp.settings.publishing.detail")}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] p-4">
                <div>
                  <h2 className="text-sm font-semibold">{t("ui.slurp.settings.refresh.title")}</h2>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{t("ui.slurp.settings.refresh.detail")}</p>
                </div>
                <button
                  type="button"
                  disabled={accountsQuery.isLoading || accountsQuery.isError}
                  onClick={() => {
                    const enabled = automationCreators.filter((creator) => creator.autoPosting.enabled);
                    setRefreshAccountIds(
                      new Set((enabled.length > 0 ? enabled : automationCreators).map((creator) => creator.id)),
                    );
                    setRefreshAccess("locked");
                    setRefreshModalOpen(true);
                  }}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  {t("ui.slurp.settings.refresh.title")}
                </button>
              </div>
              <GuidanceBox
                title={t("ui.slurp.settings.publishing.howTitle")}
                detail={t("ui.slurp.settings.publishing.howDetail")}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {SLURP_ACTIVITY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={activityPreset === preset}
                    disabled={updateSettings.isPending}
                    onClick={() => void save(slurpActivityPresetPatch(preset))}
                    className={`rounded-md border p-4 text-left disabled:opacity-50 ${activityPreset === preset ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10" : "border-[var(--border)] hover:bg-[var(--accent)]"}`}
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
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle
                  label={t("ui.slurp.settings.autoPosting")}
                  detail={t("ui.slurp.settings.autoPostingDetail")}
                  value={settings.autoPostingScheduleEnabled}
                  onChange={(value) => update("autoPostingScheduleEnabled", value)}
                />
                <Toggle
                  label={t("ui.slurp.settings.quietHours")}
                  detail={t("ui.slurp.settings.quietHoursDetail")}
                  value={settings.nightQuiet}
                  onChange={(value) => update("nightQuiet", value)}
                />
              </div>
              <Field label={t("ui.slurp.settings.generationMode")} detail={t("ui.slurp.settings.generationModeDetail")}>
                <select
                  value={settings.autoPostGenerationMode}
                  disabled={updateSettings.isPending}
                  onChange={(event) =>
                    void update("autoPostGenerationMode", event.target.value as SlurpSettings["autoPostGenerationMode"])
                  }
                  className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm disabled:opacity-50"
                >
                  <option value="pre_generate">{t("ui.slurp.settings.generationModePreGenerate")}</option>
                  <option value="on_demand">{t("ui.slurp.settings.generationModeOnDemand")}</option>
                </select>
              </Field>
              <PromptCard
                title="Generation guidance"
                value={settings.generationGuidance}
                isDefault={generationGuidanceIsDefault}
                onEdit={() => {
                  setGenerationGuidanceDraft(settings.generationGuidance);
                  setGenerationGuidanceEditorOpen(true);
                }}
                onRestore={() =>
                  void restore({ generationGuidance: DEFAULT_SLURP_GENERATION_GUIDANCE }, "Default guidance restored.")
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t("ui.slurp.settings.connections.creatorText")}
                  detail={t("ui.slurp.settings.connections.creatorTextDetail")}
                >
                  <select
                    value={settings.generationConnectionId ?? ""}
                    disabled={connectionsQuery.isLoading || connectionsQuery.isError || updateSettings.isPending}
                    onChange={(event) => void update("generationConnectionId", event.target.value || null)}
                    className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm disabled:opacity-50"
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
                  {connectionsQuery.isLoading && (
                    <p className="text-xs font-normal text-[var(--muted-foreground)]">Loading connections...</p>
                  )}
                  {connectionsQuery.isError && (
                    <p className="text-xs font-normal text-red-400">Connections could not be loaded.</p>
                  )}
                </Field>
                <Field label={t("ui.slurp.settings.postsPerDay")} detail={t("ui.slurp.settings.postsPerDayDetail")}>
                  <NumberSetting
                    value={settings.postsPerDay}
                    min={1}
                    max={24}
                    onSave={(value) => update("postsPerDay", value)}
                  />
                </Field>
              </div>
            </div>
          )}

          {section === "images" && (
            <div className="space-y-6">
              <SectionTitle title={t("ui.slurp.settings.images.title")} detail={t("ui.slurp.settings.images.detail")} />
              <GuidanceBox
                title={t("ui.slurp.settings.images.howTitle")}
                detail={t("ui.slurp.settings.images.howDetail")}
              />
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
                  className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm disabled:opacity-50"
                >
                  <option value="">{t("ui.slurp.settings.images.engineDefault")}</option>
                  {imageConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name ?? connection.model ?? connection.id}
                    </option>
                  ))}
                </select>
                {(imageSettingsQuery.isLoading || connectionsQuery.isLoading) && (
                  <p className="text-xs font-normal text-[var(--muted-foreground)]">Loading image settings...</p>
                )}
                {(imageSettingsQuery.isError || connectionsQuery.isError) && (
                  <p className="text-xs font-normal text-red-400">Image settings could not be loaded.</p>
                )}
              </Field>
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
                <Toggle
                  label={t("ui.slurp.settings.images.enableForNew")}
                  detail={t("ui.slurp.settings.images.enableForNewDetail")}
                  value={settings.autoPostingImagesEnabled}
                  onChange={(value) => update("autoPostingImagesEnabled", value)}
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
                <div className="flex justify-center py-10 text-[var(--muted-foreground)]">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : accountsQuery.isError ? (
                <div className="rounded-md border border-red-400/30 p-5 text-sm">
                  <p>{t("ui.slurp.settings.creators.loadError")}</p>
                  <button
                    type="button"
                    onClick={() => void accountsQuery.refetch()}
                    className="mt-3 min-h-10 rounded-md border border-[var(--border)] px-3 font-semibold"
                  >
                    Try again
                  </button>
                </div>
              ) : accountsQuery.data?.length ? (
                <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)] px-4">
                  {accountsQuery.data.map((creator) => {
                    const status = reserveStatusQuery.data?.creators.find((entry) => entry.accountId === creator.id);
                    return (
                      <div key={creator.id} className="py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({
                                mode: "creator",
                                view: "profile",
                                accountId: creator.id,
                                returnToSettings: navigation,
                              })
                            }
                            className="flex min-w-52 flex-1 items-center gap-3 text-left"
                          >
                            <Avatar account={creator} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{creator.displayName}</span>
                              <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">
                                @{creator.handle} ·{" "}
                                {status?.nextPreparedAt
                                  ? `Next ${new Date(status.nextPreparedAt).toLocaleString()}`
                                  : t(`ui.slurp.settings.creators.sourceStatus.${creator.sourceStatus.state}`)}
                              </span>
                            </span>
                          </button>
                          {!personaCreator(creator) && (
                            <Toggle
                              label={t("ui.slurp.settings.creators.autoPost")}
                              value={creator.autoPosting.enabled}
                              compact
                              onChange={(value) =>
                                updateAuto.mutate(
                                  { accountId: creator.id, enabled: value },
                                  {
                                    onError: (error) => toast.error(errorMessage(error)),
                                  },
                                )
                              }
                            />
                          )}
                          <Toggle
                            label={t("ui.slurp.settings.creators.images")}
                            value={creator.autoPosting.imagesEnabled}
                            compact
                            onChange={(value) =>
                              updateAuto.mutate(
                                { accountId: creator.id, imagesEnabled: value },
                                {
                                  onError: (error) => toast.error(errorMessage(error)),
                                },
                              )
                            }
                          />
                          <select
                            aria-label={t("ui.slurp.settings.creators.imageConnectionLabel", {
                              name: creator.displayName,
                            })}
                            disabled={
                              imageSettingsQuery.isLoading ||
                              imageSettingsQuery.isError ||
                              connectionsQuery.isLoading ||
                              connectionsQuery.isError ||
                              updateImages.isPending
                            }
                            value={imageSettings?.creatorConnectionIds[creator.id] ?? ""}
                            onChange={(event) =>
                              updateImages.mutate(
                                {
                                  creatorId: creator.id,
                                  connectionId: event.target.value || null,
                                },
                                {
                                  onError: (error) => toast.error(errorMessage(error)),
                                },
                              )
                            }
                            className="h-10 min-w-40 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs disabled:opacity-50"
                          >
                            <option value="">{t("ui.slurp.settings.creators.inheritImageConnection")}</option>
                            {imageConnections.map((connection) => (
                              <option key={connection.id} value={connection.id}>
                                {connection.name ?? connection.model ?? connection.id}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            aria-label={t("ui.slurp.settings.creators.scheduleLabel", { name: creator.displayName })}
                            onClick={() => setScheduleCreatorId(creator.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--accent)]"
                          >
                            <CalendarClock size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={t("ui.slurp.settings.creators.editLabel", { name: creator.displayName })}
                            onClick={() => onEditCreator(creator)}
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] hover:bg-[var(--accent)]"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={t("ui.slurp.settings.creators.deleteLabel", { name: creator.displayName })}
                            disabled={deleteCreator.isPending}
                            onClick={() => {
                              void showConfirmDialog({
                                title: t("ui.slurp.settings.creators.deleteTitle"),
                                message: t("ui.slurp.settings.creators.deleteDetail", { name: creator.displayName }),
                              })
                                .then((confirmed) => {
                                  if (!confirmed) return;
                                  deleteCreator.mutate(creator.id, {
                                    onSuccess: () =>
                                      toast.success(
                                        t("ui.slurp.settings.creators.deleted", { name: creator.displayName }),
                                      ),
                                    onError: (error) => toast.error(errorMessage(error)),
                                  });
                                })
                                .catch((error) => toast.error(errorMessage(error)));
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-md text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {creator.sourceStatus.state === "missing" && (
                          <p className="mt-3 rounded-md border border-red-400/30 bg-red-400/5 p-3 text-xs text-red-300">
                            {t("ui.slurp.settings.creators.sourceMissing")}
                          </p>
                        )}
                        {creator.sourceStatus.state === "changed" && (
                          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--accent)]/30 p-3">
                            <p className="text-xs font-semibold">{t("ui.slurp.settings.creators.sourceChanged")}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {creator.disclosureMode === "open" && (
                                <button
                                  type="button"
                                  disabled={adoptSourceIdentity.isPending}
                                  onClick={() =>
                                    adoptSourceIdentity.mutate(creator.id, {
                                      onError: (error) => toast.error(errorMessage(error)),
                                    })
                                  }
                                  className="min-h-9 rounded-md bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
                                >
                                  {t("ui.slurp.settings.creators.acceptIdentity")}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onRedraftCreator(creator)}
                                className="min-h-9 rounded-md border border-[var(--border)] px-3 text-xs font-semibold"
                              >
                                {t("ui.slurp.settings.creators.reviewRedraft")}
                              </button>
                              <button
                                type="button"
                                disabled={dismissSourceChanges.isPending}
                                onClick={() =>
                                  dismissSourceChanges.mutate(creator.id, {
                                    onSuccess: () => toast.success(t("ui.slurp.settings.creators.acceptedChanges")),
                                    onError: (error) => toast.error(errorMessage(error)),
                                  })
                                }
                                className="min-h-9 rounded-md border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
                              >
                                {t("ui.slurp.settings.creators.acceptChanges")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
            <div className="space-y-6">
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
                    <Field key={key} label={archetypeLabels[key]}>
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
          )}
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
                    <span className="text-[0.625rem] font-semibold text-[var(--noodle-accent)]">Auto-post</span>
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
              {refreshCreators.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
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
        title="Edit generation guidance"
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
        title="Edit image generation prompt"
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
  const { t } = useTranslation();
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
        <span>{new Date(slot.publishAt).toLocaleString()}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="datetime-local"
          aria-label={t("ui.slurp.settings.creators.publicationTime")}
          value={draft}
          min={localDateTimeValue(new Date(Date.now() + 60_000).toISOString())}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 text-sm disabled:opacity-50"
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

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}
function GuidanceBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/[0.06] p-4">
      <p className="text-sm font-semibold text-[var(--noodle-accent)]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}
function Field({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold">
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
      className={`flex ${compact ? "min-h-10" : "min-h-16"} items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2 text-sm`}
    >
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        {detail && (
          <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted-foreground)]">{detail}</span>
        )}
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 accent-[var(--noodle-accent)]"
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
              {isDefault ? "Default" : "Custom"}
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
          Restore default
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
        >
          <Pencil size={14} className="text-[var(--noodle-accent)]" />
          Edit prompt
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
            Restore default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-10 flex-1 rounded-md border border-[var(--border)] px-4 text-xs font-semibold sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!value.trim() || pending}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-45"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save prompt
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
