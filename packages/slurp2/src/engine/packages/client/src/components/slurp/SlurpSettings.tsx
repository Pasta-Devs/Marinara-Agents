import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { nextSlurpAutopurgeRunAt } from "../../../../shared/src/slurp-autopurge-time.js";
import { type ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useDeleteNoodlerStageProfile,
  useSetSlurpCreatorMessaging,
  useSetSlurpCreatorPrice,
  useDeleteAllSlurpData,
  useDeleteUnusedSlurpData,
  getSlurpBackupJob,
  type SlurpBackupJob,
  type SlurpRestoreInspection,
  useAdoptNoodlerSourceIdentity,
  useDismissNoodlerSourceChanges,
  useNoodlerAccounts,
  useNoodlerFanActivityStatus,
  useSlurpImageConnections,
  useNoodlerReserveStatus,
  useRefreshNoodlerFanActivityNow,
  useRefreshTargetedNoodlerCreatorsNow,
  useResetSlurpAds,
  useSlurpAdPool,
  useCreateSlurpAd,
  useDeleteSlurpAd,
  useUpdateSlurpAd,
  useGenerateSlurpAdImage,
  useSlurpAdLorebooks,
  useSyncSlurpAdLorebook,
  useSlurpAdState,
  useUnhideSlurpAdBrand,
  useGenerateSlurpAds,
  useImportSlurpAds,
  useSlurpConnections,
  useSlurpSettings,
  useSlurpSettingsDefaults,
  useSlurpMaintenanceSummary,
  useSlurpAutopurgePreview,
  useRunSlurpAutopurge,
  useUpdateNoodlerAutoPosting,
  useUpdateNoodlerScheduleSlot,
  useRefreshNoodlerConversationSchedule,
  useUpdateSlurpImageConnections,
  useUpdateSlurpSettings,
  useBulkUpdateSlurpCreators,
  type SlurpSettings,
  type SlurpContentRating,
} from "../../hooks/use-slurp";
import { showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { Modal } from "../ui/Modal";
import { type SlurpNavigationState } from "./slurp-navigation.types";
import {
  exportSlurpPromptPresets,
  importSlurpPromptPresets,
  mergeSlurpPromptPreset,
  SLURP_PROMPT_PRESET_NAME_LIMIT,
} from "./slurp-prompt-presets";
import { changedSlurpSettingKeys, isSlurpResettableSection, slurpSettingsResetPatch } from "./slurp-settings-defaults";
import { type NoodlerManagedStageProfile } from "@marinara-engine/shared";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "./SlurpShell";
import { slurpActivityPresetForSettings } from "./slurp-activity-presets";
import { slurpAudiencePresetFor } from "../../../../server/src/services/slurp/slurp-tuning.js";
import {
  SLURP_BACKSTAGE_DEFAULT_TARGET,
  SLURP_BACKSTAGE_SECTION_LABELS,
  SLURP_BACKSTAGE_TARGET_LABELS,
  SLURP_BACKSTAGE_TARGETS_BY_SECTION,
  type SlurpBackstageTarget,
} from "./slurp-backstage";
import {
  confirmLeaveSlurpBackstage,
  SlurpBackstageApplyBar,
  useSlurpBackstageDraftGuard,
  SlurpBackstageSearch,
  SlurpBackstageSubnav,
} from "./SlurpBackstageChrome";
import {
  settingsSections,
  SLURP_GUIDANCE_PRESETS,
  SLURP_IMAGE_INTERPRETATION_PRESETS,
  SLURP_IMAGE_INTERPRETATION_STYLES,
  SLURP_GUIDANCE_LEVELS,
  DEFAULT_SLURP_GENERATION_GUIDANCE,
  DEFAULT_SLURP_IMAGE_GENERATION_PROMPT,
  errorMessage,
  sectionTabClass,
  localDateTimeValue,
  ScheduleSlotEditor,
  PromptEditor,
} from "./SlurpBackstageWorkflow";
import { focusSettingAnchor } from "./SlurpBackstageKit";
import { SlurpBackstageOverview } from "./SlurpBackstageOverview";
import { SlurpBackstageCreators } from "./SlurpBackstageCreators";
import { SlurpBackstageWorld } from "./SlurpBackstageWorld";
import { SlurpBackstageAutomation } from "./SlurpBackstageAutomation";
import { SlurpBackstagePrompts } from "./SlurpBackstagePrompts";
import { SlurpBackstageMaintenance } from "./SlurpBackstageMaintenance";

type SlurpSettingsProps = {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
  onAddCreators: () => void;
  personaSourceIds: ReadonlySet<string>;
  onEditCreator: (creator: NoodlerManagedStageProfile) => void;
  onRedraftCreator: (creator: NoodlerManagedStageProfile) => void;
  onRestartOnboarding: () => void;
  viewerPersonaId: string | null;
};

/**
 * Settings takes the whole desktop nav column over: the app menu would only compete with the
 * section list, so the shell swaps it for this and this owns the way back out.
 */
export function SlurpSettingsSidebar({
  navigation,
  onNavigate,
  onExit,
}: {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const section = navigation.section ?? "overview";
  return (
    <>
      {/* The way out is the one control that must never be hunted for, so it is the loudest
          thing in the column. */}
      <button
        type="button"
        onClick={onExit}
        className="mb-4 flex min-h-11 w-full items-center gap-2 rounded-lg bg-[var(--noodle-accent)]/15 px-3 text-start text-sm font-bold text-[var(--noodle-accent-foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-colors hover:bg-[var(--noodle-accent)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
      >
        <ArrowLeft size={18} />
        {t("ui.slurp.settings.exit", { defaultValue: "Exit settings" })}
      </button>
      <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.title")}
      </p>
      <nav className="flex flex-col" aria-label={t("ui.slurp.settings.sectionsLabel")}>
        {settingsSections.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={section === item ? "page" : undefined}
            onClick={() => onNavigate({ ...navigation, section: item, target: SLURP_BACKSTAGE_DEFAULT_TARGET[item] })}
            className={sectionTabClass(section === item)}
          >
            {t(`ui.slurp.settings.backstage.sections.${item}`, {
              defaultValue: SLURP_BACKSTAGE_SECTION_LABELS[item],
            })}
          </button>
        ))}
      </nav>
    </>
  );
}

/**
 * Mobile section row. It keeps the active section in view and fades whichever edge still has
 * sections behind it, so a row that scrolls does not look like a row that ends.
 */
function SlurpSettingsSectionRow({
  navigation,
  onNavigate,
}: {
  navigation: Extract<SlurpNavigationState, { mode: "creator-settings" }>;
  onNavigate: (navigation: SlurpNavigationState) => void;
}) {
  const { t } = useTranslation();
  const section = navigation.section ?? "overview";
  return (
    <label className="sticky top-0 z-20 -mb-4 flex min-h-14 items-center gap-3 rounded-t-xl bg-[var(--slurp-surface)] px-3 py-2 ring-1 ring-inset ring-[var(--slurp-outline)] md:hidden">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.backstage.destination", { defaultValue: "Destination" })}
      </span>
      {/* Grouped so the picker reaches a page directly, instead of only its section. */}
      <select
        value={`${section}:${navigation.target ?? SLURP_BACKSTAGE_DEFAULT_TARGET[section]}`}
        onChange={(event) => {
          const [next, nextTarget] = event.target.value.split(":") as [
            (typeof settingsSections)[number],
            SlurpBackstageTarget,
          ];
          onNavigate({ ...navigation, section: next, target: nextTarget });
        }}
        className="ms-auto min-h-11 min-w-0 flex-1 rounded-lg bg-[var(--slurp-surface-raised)] px-3 text-base font-semibold text-[var(--slurp-text)] ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
      >
        {settingsSections.map((item) => (
          <optgroup
            key={item}
            label={t(`ui.slurp.settings.backstage.sections.${item}`, {
              defaultValue: SLURP_BACKSTAGE_SECTION_LABELS[item],
            })}
          >
            {SLURP_BACKSTAGE_TARGETS_BY_SECTION[item].map((entry) => (
              <option key={entry} value={`${item}:${entry}`}>
                {SLURP_BACKSTAGE_TARGET_LABELS[entry]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function useSlurpBackstageController({
  navigation,
  onNavigate,
  onAddCreators,
  personaSourceIds,
  onEditCreator,
  onRedraftCreator,
  onRestartOnboarding,
  viewerPersonaId,
}: SlurpSettingsProps) {
  const { t, i18n } = useTranslation();
  const settingsQuery = useSlurpSettings();
  const settingsDefaultsQuery = useSlurpSettingsDefaults();
  const updateSettings = useUpdateSlurpSettings();
  const runAutopurge = useRunSlurpAutopurge();
  const section = navigation.section ?? "overview";
  const target =
    navigation.target && SLURP_BACKSTAGE_TARGETS_BY_SECTION[section].includes(navigation.target)
      ? navigation.target
      : SLURP_BACKSTAGE_DEFAULT_TARGET[section];
  const resetAds = useResetSlurpAds();
  const adPool = useSlurpAdPool();
  const generateAds = useGenerateSlurpAds();
  const importAds = useImportSlurpAds();
  const createAd = useCreateSlurpAd();
  const [customAdOpen, setCustomAdOpen] = useState(false);
  const [customAd, setCustomAd] = useState<{
    brand: string;
    product: string;
    copy: string;
    contentRating: SlurpContentRating;
  }>({ brand: "", product: "", copy: "", contentRating: "tame" });
  const adsImportRef = useRef<HTMLInputElement>(null);
  const adState = useSlurpAdState(target === "ads" ? viewerPersonaId : null);
  const unhideBrand = useUnhideSlurpAdBrand();
  const deleteAd = useDeleteSlurpAd();
  const updateAd = useUpdateSlurpAd();
  const [editingAd, setEditingAd] = useState<{
    id: string;
    brand: string;
    product: string;
    copy: string;
    contentRating: SlurpContentRating;
  } | null>(null);
  const generateAdImage = useGenerateSlurpAdImage();
  const adLorebooks = useSlurpAdLorebooks(target === "ads");
  const syncAdLorebook = useSyncSlurpAdLorebook();
  const savedSettings = settingsQuery.data;
  const [draftPatch, setDraftPatch] = useState<Partial<SlurpSettings>>({});
  const settings = useMemo(
    () => (savedSettings ? ({ ...savedSettings, ...draftPatch } as SlurpSettings) : undefined),
    [draftPatch, savedSettings],
  );
  const maintenanceSummary = useSlurpMaintenanceSummary(section === "maintenance" || section === "overview");
  const autopurgePreview = useSlurpAutopurgePreview(settings, target === "autopurge");
  const [generationGuidanceDraft, setGenerationGuidanceDraft] = useState("");
  const [generationGuidanceEditorOpen, setGenerationGuidanceEditorOpen] = useState(false);
  const [imagePromptDraft, setImagePromptDraft] = useState("");
  const [imagePromptEditorOpen, setImagePromptEditorOpen] = useState(false);
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [refreshAccountIds, setRefreshAccountIds] = useState<Set<string>>(new Set());
  const [refreshRemaining, setRefreshRemaining] = useState(0);
  const [refreshAccess, setRefreshAccess] = useState<"public" | "locked">("locked");
  const [scheduleCreatorId, setScheduleCreatorId] = useState<string | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  // null while select mode is off.
  const [bulkCreatorIds, setBulkCreatorIds] = useState<Set<string> | null>(null);
  const bulkUpdateCreators = useBulkUpdateSlurpCreators();
  const [customPaceOpen, setCustomPaceOpen] = useState(false);
  const [adsWorldDraft, setAdsWorldDraft] = useState<string | null>(null);
  const [reactionBankDraft, setReactionBankDraft] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autopurgeNextDraft, setAutopurgeNextDraft] = useState("");
  useEffect(() => {
    if (settings) {
      if (!generationGuidanceEditorOpen) setGenerationGuidanceDraft(settings.generationGuidance);
      if (!imagePromptEditorOpen) setImagePromptDraft(settings.imageGenerationPrompt);
    }
  }, [generationGuidanceEditorOpen, imagePromptEditorOpen, settings]);
  useEffect(() => {
    setAutopurgeNextDraft(settings?.autopurgeNextRunAt ? localDateTimeValue(settings.autopurgeNextRunAt) : "");
  }, [settings?.autopurgeNextRunAt]);
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
  /** Stages a patch for Review and apply; only Overview quick toggles save at once, with Undo. */
  const updatePatch = async (patch: Partial<SlurpSettings>) => {
    if (section !== "overview") {
      setDraftPatch((current) => ({ ...current, ...patch }));
      return true;
    }
    const keys = Object.keys(patch) as Array<keyof SlurpSettings>;
    const previous = savedSettings
      ? (Object.fromEntries(keys.map((key) => [key, savedSettings[key]])) as Partial<SlurpSettings>)
      : undefined;
    const changed = await save(patch);
    if (changed && previous) {
      toast.success(t("ui.slurp.settings.backstage.quickSaved", { defaultValue: "Quick setting updated." }), {
        action: {
          label: t("ui.slurp.settings.backstage.undo", { defaultValue: "Undo" }),
          onClick: () => void save(previous),
        },
      });
    }
    return changed;
  };
  const update = (key: keyof SlurpSettings, value: unknown) => updatePatch({ [key]: value } as Partial<SlurpSettings>);
  // A new retention period restarts the schedule from now, so a shorter period takes effect right away.
  const saveRetention = (patch: Partial<Pick<SlurpSettings, "autopurgeRetentionValue" | "autopurgeRetentionUnit">>) =>
    save(
      settings?.autopurgeEnabled
        ? { ...patch, autopurgeNextRunAt: nextSlurpAutopurgeRunAt({ ...settings, ...patch }) }
        : patch,
    );
  const accountsQuery = useNoodlerAccounts(
    section === "overview" || section === "creators" || section === "automation",
  );
  const imageSettingsQuery = useSlurpImageConnections(
    section === "overview" || section === "automation" || section === "creators",
  );
  const fanStatusQuery = useNoodlerFanActivityStatus(
    section === "overview" || target === "audience" || target === "automation",
  );
  const reserveStatusQuery = useNoodlerReserveStatus(section === "overview" || section === "creators");
  const updateAuto = useUpdateNoodlerAutoPosting();
  const updateScheduleSlot = useUpdateNoodlerScheduleSlot();
  const refreshConversationSchedule = useRefreshNoodlerConversationSchedule();
  const refreshFans = useRefreshNoodlerFanActivityNow();
  const refreshCreators = useRefreshTargetedNoodlerCreatorsNow(setRefreshRemaining);
  const updateImages = useUpdateSlurpImageConnections();
  const deleteCreator = useDeleteNoodlerStageProfile();
  const setCreatorMessaging = useSetSlurpCreatorMessaging();
  const setCreatorPrice = useSetSlurpCreatorPrice();
  const deleteAllData = useDeleteAllSlurpData();
  const deleteUnusedData = useDeleteUnusedSlurpData();
  const [backupJob, setBackupJob] = useState<SlurpBackupJob | null>(null);
  const [backupPending, setBackupPending] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [restoreImportSettings, setRestoreImportSettings] = useState(false);
  const [restoreInspection, setRestoreInspection] = useState<SlurpRestoreInspection | null>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  /** Poll a job to a terminal state, surfacing each step so a long run does not look stuck. */
  const followBackupJob = async (job: SlurpBackupJob) => {
    let current = job;
    setBackupJob(current);
    while (current.state !== "completed" && current.state !== "error") {
      await new Promise((resolve) => window.setTimeout(resolve, 750));
      current = await getSlurpBackupJob(job.id);
      setBackupJob(current);
    }
    if (current.state === "error") throw new Error(current.error ?? current.detail);
    return current;
  };
  const adoptSourceIdentity = useAdoptNoodlerSourceIdentity();
  const dismissSourceChanges = useDismissNoodlerSourceChanges();
  const connectionsQuery = useSlurpConnections(
    section === "overview" ||
      section === "automation" ||
      target === "images" ||
      target === "ads" ||
      section === "creators" ||
      target === "audience",
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
  const guidanceLevel =
    SLURP_GUIDANCE_LEVELS.find((level) => SLURP_GUIDANCE_PRESETS[level] === settings?.generationGuidance) ?? null;
  const interpretationStyle =
    SLURP_IMAGE_INTERPRETATION_STYLES.find(
      (style) => SLURP_IMAGE_INTERPRETATION_PRESETS[style] === settings?.imagePromptInterpretation,
    ) ?? null;
  const imagePromptIsDefault = settings?.imageGenerationPrompt === DEFAULT_SLURP_IMAGE_GENERATION_PROMPT;
  const activityPreset = settings && slurpActivityPresetForSettings(settings);
  const autopurgeNextTime = Date.parse(autopurgeNextDraft);
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
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const presetImportRef = useRef<HTMLInputElement>(null);
  const selectedPreset = settings?.promptPresets.find((preset) => preset.name === selectedPresetName) ?? null;
  const savePromptPreset = async () => {
    if (!settings) return;
    const name = (
      await showPromptDialog({
        title: t("ui.slurp.settings.presets.nameTitle"),
        message: t("ui.slurp.settings.presets.nameDetail"),
        placeholder: selectedPresetName,
        confirmLabel: t("ui.slurp.settings.presets.save"),
      })
    )
      ?.trim()
      .slice(0, SLURP_PROMPT_PRESET_NAME_LIMIT);
    if (!name) return;
    const saved = await restore(
      {
        promptPresets: mergeSlurpPromptPreset(settings.promptPresets, {
          name,
          generationGuidance: settings.generationGuidance,
          imageGenerationPrompt: settings.imageGenerationPrompt,
        }),
      },
      t("ui.slurp.settings.presets.saved"),
    );
    if (saved) setSelectedPresetName(name);
  };
  const applyPromptPreset = async () => {
    if (!settings || !selectedPreset) return;
    const differs =
      settings.generationGuidance !== selectedPreset.generationGuidance ||
      settings.imageGenerationPrompt !== selectedPreset.imageGenerationPrompt;
    // Applying replaces prompts that may have been edited by hand, so ask first when it would change them.
    if (
      differs &&
      !(await showConfirmDialog({
        title: t("ui.slurp.settings.presets.applyTitle"),
        message: t("ui.slurp.settings.presets.applyDetail", { name: selectedPreset.name }),
        confirmLabel: t("ui.slurp.settings.presets.apply"),
      }))
    )
      return;
    await restore(
      {
        generationGuidance: selectedPreset.generationGuidance,
        imageGenerationPrompt: selectedPreset.imageGenerationPrompt,
      },
      t("ui.slurp.settings.presets.applied"),
    );
  };
  const deletePromptPreset = async () => {
    if (!settings || !selectedPreset) return;
    const confirmed = await showConfirmDialog({
      title: t("ui.slurp.settings.presets.deleteTitle"),
      message: t("ui.slurp.settings.presets.deleteDetail", { name: selectedPreset.name }),
      confirmLabel: t("ui.slurp.settings.presets.delete"),
    });
    if (!confirmed) return;
    if (await save({ promptPresets: settings.promptPresets.filter((preset) => preset.name !== selectedPreset.name) })) {
      setSelectedPresetName("");
    }
  };
  const exportPromptPresets = () => {
    if (!settings) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exportSlurpPromptPresets(settings.promptPresets), null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "marinara-slurp-prompts.json";
    document.body.append(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 0);
  };
  const importPromptPresets = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !settings) return;
    try {
      const result = importSlurpPromptPresets(settings.promptPresets, JSON.parse(await file.text()));
      if (result.imported === 0) {
        toast.error(t("ui.slurp.settings.presets.importInvalid"));
        return;
      }
      await restore(
        { promptPresets: result.presets },
        t("ui.slurp.settings.presets.imported", { count: result.imported }),
      );
    } catch {
      toast.error(t("ui.slurp.settings.presets.importInvalid"));
    }
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

  const runAutopurgeNow = async () => {
    if (!settings) return;
    try {
      const confirmed = await showConfirmDialog({
        title: t("ui.slurp.settings.autopurge.runConfirmTitle"),
        message: settings.autopurgeKeepPosts
          ? t(
              settings.autopurgeIncludeMessageMedia
                ? "ui.slurp.settings.autopurge.runConfirmMediaOnlyWithMessages"
                : "ui.slurp.settings.autopurge.runConfirmMediaOnly",
            )
          : t(
              settings.autopurgeIncludeMessageMedia
                ? "ui.slurp.settings.autopurge.runConfirmPostsWithMessages"
                : "ui.slurp.settings.autopurge.runConfirmPosts",
            ),
        confirmLabel: t("ui.slurp.settings.autopurge.runNow"),
      });
      if (!confirmed) return;
      const result = await runAutopurge.mutateAsync();
      toast.success(
        t("ui.slurp.settings.autopurge.runSuccess", {
          posts: result.deletedPosts,
          postMedia: result.removedPostMedia,
          messageMedia: result.removedMessageMedia,
        }),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return {
    navigation,
    onNavigate,
    onAddCreators,
    personaSourceIds,
    onEditCreator,
    onRedraftCreator,
    onRestartOnboarding,
    viewerPersonaId,
    t,
    i18n,
    settingsQuery,
    settingsDefaultsQuery,
    updateSettings,
    runAutopurge,
    section,
    target,
    resetAds,
    adPool,
    generateAds,
    importAds,
    createAd,
    customAdOpen,
    setCustomAdOpen,
    customAd,
    setCustomAd,
    adsImportRef,
    adState,
    unhideBrand,
    deleteAd,
    updateAd,
    editingAd,
    setEditingAd,
    generateAdImage,
    adLorebooks,
    syncAdLorebook,
    draftPatch,
    setDraftPatch,
    settings,
    maintenanceSummary,
    autopurgePreview,
    generationGuidanceDraft,
    setGenerationGuidanceDraft,
    generationGuidanceEditorOpen,
    setGenerationGuidanceEditorOpen,
    imagePromptDraft,
    setImagePromptDraft,
    imagePromptEditorOpen,
    setImagePromptEditorOpen,
    refreshModalOpen,
    setRefreshModalOpen,
    refreshAccountIds,
    setRefreshAccountIds,
    refreshRemaining,
    setRefreshRemaining,
    refreshAccess,
    setRefreshAccess,
    scheduleCreatorId,
    setScheduleCreatorId,
    selectedCreatorId,
    setSelectedCreatorId,
    bulkCreatorIds,
    setBulkCreatorIds,
    bulkUpdateCreators,
    customPaceOpen,
    setCustomPaceOpen,
    adsWorldDraft,
    setAdsWorldDraft,
    reactionBankDraft,
    setReactionBankDraft,
    saveState,
    setSaveState,
    autopurgeNextDraft,
    setAutopurgeNextDraft,
    save,
    update,
    updatePatch,
    saveRetention,
    accountsQuery,
    imageSettingsQuery,
    fanStatusQuery,
    reserveStatusQuery,
    updateAuto,
    updateScheduleSlot,
    refreshConversationSchedule,
    refreshFans,
    refreshCreators,
    updateImages,
    deleteCreator,
    setCreatorMessaging,
    setCreatorPrice,
    deleteAllData,
    deleteUnusedData,
    backupJob,
    setBackupJob,
    backupPending,
    setBackupPending,
    restorePending,
    setRestorePending,
    restoreImportSettings,
    setRestoreImportSettings,
    restoreInspection,
    setRestoreInspection,
    restoreFileName,
    setRestoreFileName,
    restoreInputRef,
    followBackupJob,
    adoptSourceIdentity,
    dismissSourceChanges,
    connectionsQuery,
    imageConnections,
    imageSettings,
    personaCreator,
    automationCreators,
    scheduleCreator,
    selectedCreator,
    scheduleSlots,
    generationGuidanceIsDefault,
    guidanceLevel,
    interpretationStyle,
    imagePromptIsDefault,
    activityPreset,
    autopurgeNextTime,
    creators,
    autoPostingCreators,
    automaticPublishingActive,
    imageEnabledCreators,
    imagesReady,
    selectedImageConnection,
    imageConnectionLabel,
    paceLabel,
    openRefresh,
    selectedPresetName,
    setSelectedPresetName,
    presetImportRef,
    selectedPreset,
    savePromptPreset,
    applyPromptPreset,
    deletePromptPreset,
    exportPromptPresets,
    importPromptPresets,
    restore,
    restoreDefaultImagePrompt,
    saveImagePrompt,
    saveGenerationGuidance,
    confirmDeleteCreator,
    runAutopurgeNow,
  };
}

export type SlurpBackstagePageProps = ReturnType<typeof useSlurpBackstageController> & {
  settings: SlurpSettings;
  audiencePreset: ReturnType<typeof slurpAudiencePresetFor>;
};

export function SlurpSettings({
  navigation,
  onNavigate,
  onAddCreators,
  personaSourceIds,
  onEditCreator,
  onRedraftCreator,
  onRestartOnboarding,
  viewerPersonaId,
}: SlurpSettingsProps) {
  const { t: translate } = useTranslation();
  // Opening a Creator's profile leaves Backstage, so staged changes ask stay or discard first.
  const controller = useSlurpBackstageController({
    navigation,
    onNavigate,
    onAddCreators,
    personaSourceIds,
    onEditCreator: (creator) =>
      void confirmLeaveSlurpBackstage(translate).then((leave) => leave && onEditCreator(creator)),
    onRedraftCreator: (creator) =>
      void confirmLeaveSlurpBackstage(translate).then((leave) => leave && onRedraftCreator(creator)),
    onRestartOnboarding,
    viewerPersonaId,
  });
  const {
    t,
    i18n,
    settingsQuery,
    settingsDefaultsQuery,
    updateSettings,
    runAutopurge,
    section,
    target,
    resetAds,
    adPool,
    generateAds,
    importAds,
    createAd,
    customAdOpen,
    setCustomAdOpen,
    customAd,
    setCustomAd,
    adsImportRef,
    adState,
    unhideBrand,
    deleteAd,
    updateAd,
    editingAd,
    setEditingAd,
    generateAdImage,
    adLorebooks,
    syncAdLorebook,
    savedSettings,
    draftPatch,
    setDraftPatch,
    settings,
    maintenanceSummary,
    autopurgePreview,
    generationGuidanceDraft,
    setGenerationGuidanceDraft,
    generationGuidanceEditorOpen,
    setGenerationGuidanceEditorOpen,
    imagePromptDraft,
    setImagePromptDraft,
    imagePromptEditorOpen,
    setImagePromptEditorOpen,
    refreshModalOpen,
    setRefreshModalOpen,
    refreshAccountIds,
    setRefreshAccountIds,
    refreshRemaining,
    setRefreshRemaining,
    refreshAccess,
    setRefreshAccess,
    scheduleCreatorId,
    setScheduleCreatorId,
    selectedCreatorId,
    setSelectedCreatorId,
    bulkCreatorIds,
    setBulkCreatorIds,
    bulkUpdateCreators,
    customPaceOpen,
    setCustomPaceOpen,
    adsWorldDraft,
    setAdsWorldDraft,
    reactionBankDraft,
    setReactionBankDraft,
    saveState,
    setSaveState,
    autopurgeNextDraft,
    setAutopurgeNextDraft,
    save,
    update,
    saveRetention,
    accountsQuery,
    imageSettingsQuery,
    fanStatusQuery,
    reserveStatusQuery,
    updateAuto,
    updateScheduleSlot,
    refreshConversationSchedule,
    refreshFans,
    refreshCreators,
    updateImages,
    deleteCreator,
    setCreatorMessaging,
    setCreatorPrice,
    deleteAllData,
    deleteUnusedData,
    backupJob,
    setBackupJob,
    backupPending,
    setBackupPending,
    restorePending,
    setRestorePending,
    restoreImportSettings,
    setRestoreImportSettings,
    restoreInspection,
    setRestoreInspection,
    restoreFileName,
    setRestoreFileName,
    restoreInputRef,
    followBackupJob,
    adoptSourceIdentity,
    dismissSourceChanges,
    connectionsQuery,
    imageConnections,
    imageSettings,
    personaCreator,
    automationCreators,
    scheduleCreator,
    selectedCreator,
    scheduleSlots,
    generationGuidanceIsDefault,
    guidanceLevel,
    interpretationStyle,
    imagePromptIsDefault,
    activityPreset,
    autopurgeNextTime,
    creators,
    autoPostingCreators,
    automaticPublishingActive,
    imageEnabledCreators,
    imagesReady,
    selectedImageConnection,
    imageConnectionLabel,
    paceLabel,
    openRefresh,
    selectedPresetName,
    setSelectedPresetName,
    presetImportRef,
    selectedPreset,
    savePromptPreset,
    applyPromptPreset,
    deletePromptPreset,
    exportPromptPresets,
    importPromptPresets,
    restore,
    restoreDefaultImagePrompt,
    saveImagePrompt,
    saveGenerationGuidance,
    confirmDeleteCreator,
    runAutopurgeNow,
  } = controller;
  useSlurpBackstageDraftGuard(Object.keys(draftPatch).length);
  const settingKey = navigation.settingKey;
  const settingsReady = Boolean(settings);
  // A search result lands on its page first; once that page renders, bring the setting into view.
  useEffect(() => {
    if (!settingKey || !settingsReady) return;
    const frame = requestAnimationFrame(() => {
      focusSettingAnchor(settingKey);
      onNavigate({ ...navigation, settingKey: undefined });
    });
    return () => cancelAnimationFrame(frame);
    // Runs once per search selection; `navigation` changes identity with every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingKey, section, target, settingsReady]);

  if (settingsQuery.isError)
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-[var(--muted-foreground)]">
        <p>{t("ui.slurp.settings.loadError")}</p>
        <button
          type="button"
          onClick={() => void settingsQuery.refetch()}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-accent)]/40 px-3 font-semibold text-[var(--noodle-accent)]"
        >
          <RefreshCw size={14} />
          {t("capabilities.actions.tryAgain")}
        </button>
      </main>
    );
  if (settingsQuery.isLoading || !settings)
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center gap-2 p-6 text-sm text-[var(--muted-foreground)]">
        <Loader2 size={18} className="animate-spin" />
        {t("ui.slurp.studio.loading")}
      </main>
    );
  const audiencePreset = slurpAudiencePresetFor(settings);
  const page: SlurpBackstagePageProps = { ...controller, settings, audiencePreset };

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--slurp-canvas)] pb-[calc(5rem+env(safe-area-inset-bottom))] text-[var(--slurp-text)] sm:pb-8">
        <div className="mx-auto flex w-full flex-col gap-4 p-3 sm:p-5 lg:gap-6 lg:p-6" data-slurp-settings-layout>
          {/* The header answers three questions and nothing else: which page am I on, where do I
              find a setting, and is my change saved. The areas of the section sit under the title
              because they belong to it, not to the content card below. */}
          <header className="relative isolate z-30 flex flex-col gap-3 rounded-xl bg-[linear-gradient(120deg,color-mix(in_srgb,var(--slurp-surface-raised)_94%,transparent),color-mix(in_srgb,var(--noodle-accent)_17%,var(--slurp-surface-raised))_58%,color-mix(in_srgb,var(--slurp-violet)_13%,var(--slurp-surface-raised)))] p-4 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--noodle-accent)]">
                  {t(`ui.slurp.settings.backstage.sections.${section}`, {
                    defaultValue: SLURP_BACKSTAGE_SECTION_LABELS[section],
                  })}
                </p>
                {/* The current area is the title. "Backstage" is already the sidebar heading. */}
                <h1 className="mt-0.5 truncate text-xl font-black tracking-tight sm:text-2xl">
                  {SLURP_BACKSTAGE_TARGET_LABELS[target]}
                </h1>
              </div>
              <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center justify-end gap-3 md:basis-80">
                <SlurpBackstageSearch
                  onSelect={(nextSection, nextTarget, settingKey) =>
                    onNavigate({ ...navigation, section: nextSection, target: nextTarget, settingKey })
                  }
                  className="max-w-none basis-full md:max-w-xl md:basis-auto"
                />
                <p
                  className={`inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full bg-[var(--slurp-surface,var(--background))] px-2 py-0.5 text-[11px] font-semibold md:min-h-9 md:gap-1.5 md:px-3 md:py-1 md:text-xs shadow-sm ring-1 ring-inset ${saveState === "error" ? "text-red-300 ring-red-400/30" : saveState === "saved" ? "text-[var(--slurp-success)] ring-[var(--slurp-success)]/25" : "text-[var(--muted-foreground)] ring-[var(--border)]"}`}
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
              </div>
            </div>
            {/* Mobile hides these: the destination dropdown below already lists every area. */}
            <SlurpBackstageSubnav
              className="hidden md:flex"
              section={section}
              target={target}
              onSelect={(nextTarget) => onNavigate({ ...navigation, target: nextTarget })}
            />
          </header>
          <SlurpSettingsSectionRow navigation={navigation} onNavigate={onNavigate} />

          <div>
            <div className="mt-4 min-w-0 rounded-xl rounded-t-none bg-[linear-gradient(145deg,var(--slurp-surface),color-mix(in_srgb,var(--slurp-violet)_4%,var(--slurp-surface)))] p-3 shadow-[var(--slurp-shadow)] ring-1 ring-inset ring-[var(--slurp-outline)] md:mt-0 md:rounded-t-xl md:p-5 lg:p-6">
              <div className="min-w-0">
                <div className="min-w-0" data-backstage-target={target}>
                  {settings &&
                    settingsDefaultsQuery.data &&
                    isSlurpResettableSection(target) &&
                    (() => {
                      const defaults = settingsDefaultsQuery.data;
                      const changed = changedSlurpSettingKeys(settings, defaults, target);
                      if (changed.length === 0) return null;
                      return (
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {t("ui.slurp.settings.reset.changed", { count: changed.length })}
                          </p>
                          <button
                            type="button"
                            disabled={updateSettings.isPending}
                            onClick={() =>
                              void showConfirmDialog({
                                title: t("ui.slurp.settings.reset.confirmTitle"),
                                message: t("ui.slurp.settings.reset.confirmDetail"),
                                confirmLabel: t("ui.slurp.settings.reset.button"),
                              })
                                .then((confirmed) => {
                                  if (confirmed) void save(slurpSettingsResetPatch(settings, defaults, target));
                                })
                                .catch((error) => toast.error(errorMessage(error)))
                            }
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                          >
                            <RefreshCw size={14} />
                            {t("ui.slurp.settings.reset.button")}
                          </button>
                        </div>
                      );
                    })()}
                  <SlurpBackstageOverview {...page} />
                  <SlurpBackstageCreators {...page} />
                  <SlurpBackstageWorld {...page} />
                  <SlurpBackstageAutomation {...page} />
                  <SlurpBackstagePrompts {...page} />
                  <SlurpBackstageMaintenance {...page} />
                  <SlurpBackstageApplyBar
                    count={Object.keys(draftPatch).length}
                    pending={updateSettings.isPending}
                    onDiscard={() => setDraftPatch({})}
                    onApply={() =>
                      void save(draftPatch).then((saved) => {
                        if (saved) setDraftPatch({});
                      })
                    }
                  />
                </div>
              </div>
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
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
          "--accent": "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
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
                  disabled={refreshCreators.isPending}
                  className="text-[var(--noodle-accent)] hover:underline"
                >
                  {t("ui.slurp.settings.refresh.selectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setRefreshAccountIds(new Set())}
                  disabled={refreshCreators.isPending}
                  className="text-[var(--muted-foreground)] hover:underline"
                >
                  {t("ui.slurp.settings.refresh.clear")}
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
              {automationCreators.map((creator) => (
                <label
                  key={creator.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--accent)]/40"
                >
                  <input
                    type="checkbox"
                    checked={refreshAccountIds.has(creator.id)}
                    disabled={refreshCreators.isPending}
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
            <div className="mt-2 grid grid-cols-2 rounded-lg border border-[var(--border)] p-1">
              {(["public", "locked"] as const).map((access) => (
                <button
                  key={access}
                  type="button"
                  aria-pressed={refreshAccess === access}
                  disabled={refreshCreators.isPending}
                  onClick={() => setRefreshAccess(access)}
                  className={`min-h-10 rounded-lg text-sm font-semibold capitalize ${refreshAccess === access ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950" : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"}`}
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
              className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold"
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
                      // Name the Creators that did not post, so a short batch is never a mystery.
                      const names = (wanted: (status: string) => boolean) =>
                        outcomes
                          .filter((outcome) => wanted(outcome.status))
                          .map(
                            (outcome) =>
                              accountsQuery.data?.find((creator) => creator.id === outcome.accountId)?.displayName ??
                              outcome.accountId,
                          )
                          .join(", ");
                      if (skipped)
                        toast(t("ui.slurp.settings.refresh.skipped", { count: skipped }), {
                          description: names((status) => status === "skipped"),
                          duration: 10_000,
                        });
                      if (failed)
                        toast.error(t("ui.slurp.settings.refresh.failed", { count: failed }), {
                          description: names((status) => status !== "generated" && status !== "skipped"),
                          duration: 10_000,
                        });
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
            >
              {refreshCreators.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span role={refreshCreators.isPending ? "status" : undefined}>
                {refreshCreators.isPending
                  ? t("ui.slurp.settings.refresh.remaining", { count: refreshRemaining })
                  : t("ui.slurp.settings.refresh.generate", { count: refreshAccountIds.size || "" })}
              </span>
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
            <div className="rounded-lg border border-red-400/30 p-5 text-sm">
              <p>{t("ui.noodle.noodlerschedulemanagermodal.couldNotLoadStatus")}</p>
              <button
                type="button"
                onClick={() => void reserveStatusQuery.refetch()}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 font-semibold"
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
            <p className="rounded-lg border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted-foreground)]">
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
