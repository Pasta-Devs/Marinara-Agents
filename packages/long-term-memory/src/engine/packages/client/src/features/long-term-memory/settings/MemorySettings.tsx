import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DEFAULT_LTM_GLOBAL_SETTINGS,
  LTM_HIDE_TAIL_MESSAGES_MAX,
  LTM_PACKAGE_AGENTS,
  ltmPackageCanAdd,
  type LtmExtractionSettingsPatch,
  type LtmGlobalSettings,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { LTM_RECALL_STYLE_WEIGHTS } from "../../../../../shared/src/features/agents/long-term-memory/constants.js";
import {
  LTM_RECALL_SCORE_THRESHOLD_CEILING,
  ltmChatMemoriesModeOf,
  ltmRecallBudgetMemories,
  type LtmChatMemoriesMode,
} from "../../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import {
  errorMessage,
  invalidateLtmQueries,
  queryKeys,
  request,
  requestHost,
  settingsQueryOptions,
  statusQueryOptions,
} from "../api";
import { autoImportNeedsConnection } from "../auto-import-status";
import { useAutoImportEvents } from "../auto-import-hooks";
import {
  ChatMemoriesSample,
  chatMemoriesDescriptionKey,
  chatMemoriesFlags,
  chatMemoriesLabelKey,
  chatMemoriesModes,
} from "../chat-memories";
import {
  Button,
  IconButton,
  NumberField,
  SliderField,
  StatusSurface,
  confirm,
  inputClass,
  lockedActionProps,
} from "../shared-controls";
import { nextTabIndex } from "../tab-keys";
import type { LongTermMemoryDestinationProps } from "../types";
import { ExtractionPromptTemplates } from "./ExtractionPromptTemplates";
import { TroubleshootingPanel } from "./TroubleshootingPanel";
import { WhatModelButton } from "./WhatModelDialog";
import { DisclosureSummary, Field, Toggle, type SettingsRebuildOutcome } from "./settings-shared";
import { askSlurpMemories, type SlurpMemorySetting } from "./slurp-memory-offer";
import { connectionLabel, languageConnectionsQueryOptions } from "../language-connections";
import { useLtmTranslation } from "../localization";
import { nearestRecallPreset, recallStyleDescriptionKey } from "../recall-style";

type GlobalForm = {
  version: 1;
  longTermMemoryBudgetTokens: number;
  longTermMemoryScoreThreshold: number;
  longTermMemoryRecallContextMessages: number;
  longTermMemoryRecallStyle: "balanced" | "exact" | "broad" | "story" | "custom";
  longTermMemorySemanticWeight: number;
  longTermMemoryLexicalWeight: number;
  longTermMemoryGraphWeight: number;
  longTermMemoryKeywordWeight: number;
  longTermMemoryStopWordsText: string;
  longTermMemoryStopWordsFilterGenerated: boolean;
  longTermMemoryIncludeResolved: boolean;
  longTermMemoryRecallPreamble: string;
  // The client writes only the per-Agent map; the deprecated global switches stay for older Slurp and Noodle.
  longTermMemoryPackageAccess: PackageAccess;
  longTermMemoryHideImportedMessages: boolean;
  longTermMemoryHideTailMessages: number;
  sourcesAvailabilityModes?: ("conversation" | "roleplay" | "game")[];
};
type PackageAccess = Record<string, { read: boolean; add: boolean }>;
type InstalledPackage = {
  id: string;
  manifest?: { name?: string; localizations?: Record<string, { name?: string } | undefined> };
};
// The existing-memory window is fixed in code; a stored value stays in the file untouched.
type ExtractionForm = Required<Omit<LtmExtractionSettingsPatch, "existingNoteMaxChunks" | "existingNoteMaxTokens">> & {
  systemPrompt?: string;
  activePromptTemplateId?: string | null;
};
type SettingsTab = "recall" | "extraction";

// The recall budget range; the field and its visible hint read the same pair.
const RECALL_BUDGET_MIN = 128;
const RECALL_BUDGET_MAX = 16384;

const settingsTabs: Array<{ id: SettingsTab; labelKey: string }> = [
  {
    id: "recall",
    labelKey: "ui.longTermMemory.memorysettings.recall",
  },
  {
    id: "extraction",
    labelKey: "ui.longTermMemory.memorysettings.extraction",
  },
];

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function settingsForm(settings: LtmGlobalSettings): GlobalForm {
  const recallStyle = settings.longTermMemoryRecallStyle ?? "balanced";
  const presetWeights =
    recallStyle === "custom" ? LTM_RECALL_STYLE_WEIGHTS.balanced : LTM_RECALL_STYLE_WEIGHTS[recallStyle];
  return {
    version: 1,
    longTermMemoryBudgetTokens:
      settings.longTermMemoryBudgetTokens ?? DEFAULT_LTM_GLOBAL_SETTINGS.longTermMemoryBudgetTokens,
    longTermMemoryScoreThreshold: settings.longTermMemoryScoreThreshold ?? 0,
    longTermMemoryRecallContextMessages: settings.longTermMemoryRecallContextMessages ?? 4,
    longTermMemoryRecallStyle: recallStyle,
    longTermMemorySemanticWeight: settings.longTermMemorySemanticWeight ?? presetWeights.semanticWeight,
    longTermMemoryLexicalWeight: settings.longTermMemoryLexicalWeight ?? presetWeights.lexicalWeight,
    longTermMemoryGraphWeight: settings.longTermMemoryGraphWeight ?? presetWeights.graphWeight,
    longTermMemoryKeywordWeight: settings.longTermMemoryKeywordWeight ?? presetWeights.keywordWeight,
    longTermMemoryStopWordsText: (settings.longTermMemoryStopWords ?? []).join("\n"),
    longTermMemoryStopWordsFilterGenerated: settings.longTermMemoryStopWordsFilterGenerated ?? true,
    longTermMemoryIncludeResolved: settings.longTermMemoryIncludeResolved ?? false,
    longTermMemoryRecallPreamble: settings.longTermMemoryRecallPreamble ?? "",
    longTermMemoryPackageAccess: sortedAccess(
      Object.fromEntries(
        Object.entries(settings.longTermMemoryPackageAccess ?? {}).flatMap(([id, access]) =>
          access ? [[id, { read: access.read ?? false, add: access.add ?? false }]] : [],
        ),
      ),
    ),
    longTermMemoryHideImportedMessages: settings.longTermMemoryHideImportedMessages ?? false,
    longTermMemoryHideTailMessages: settings.longTermMemoryHideTailMessages ?? 10,
    ...(settings.sourcesAvailabilityModes ? { sourcesAvailabilityModes: settings.sourcesAvailabilityModes } : {}),
  };
}

function stopWordsFromText(text: string) {
  return Array.from(
    new Set(
      text
        .split(/[\n,]+/)
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

// Rows keep one order, so removing and adding back an Agent leaves the form clean.
function sortedAccess(access: PackageAccess): PackageAccess {
  return Object.fromEntries(Object.entries(access).sort(([left], [right]) => left.localeCompare(right)));
}

function globalPayload(form: GlobalForm, saved: GlobalForm | null) {
  const { longTermMemoryStopWordsText, longTermMemoryPackageAccess, ...settings } = form;
  // A write names only the rows this form shows, plus null for each saved row removed, so an Agent another writer
  // added meanwhile keeps its access.
  const removed = Object.keys(saved?.longTermMemoryPackageAccess ?? {}).filter(
    (id) => !(id in longTermMemoryPackageAccess),
  );
  return {
    ...settings,
    longTermMemoryStopWords: stopWordsFromText(longTermMemoryStopWordsText),
    longTermMemoryPackageAccess: {
      ...longTermMemoryPackageAccess,
      ...Object.fromEntries(removed.map((id) => [id, null])),
    },
  };
}

function applyRecallStyle(form: GlobalForm, recallStyle: GlobalForm["longTermMemoryRecallStyle"]): GlobalForm {
  if (recallStyle === "custom") {
    return { ...form, longTermMemoryRecallStyle: recallStyle };
  }
  const weights = LTM_RECALL_STYLE_WEIGHTS[recallStyle];
  return {
    ...form,
    longTermMemoryRecallStyle: recallStyle,
    longTermMemorySemanticWeight: weights.semanticWeight,
    longTermMemoryLexicalWeight: weights.lexicalWeight,
    longTermMemoryGraphWeight: weights.graphWeight,
    longTermMemoryKeywordWeight: weights.keywordWeight,
  };
}

function applyCustomWeight(
  form: GlobalForm,
  key:
    | "longTermMemorySemanticWeight"
    | "longTermMemoryLexicalWeight"
    | "longTermMemoryGraphWeight"
    | "longTermMemoryKeywordWeight",
  value: number,
): GlobalForm {
  return {
    ...form,
    longTermMemoryRecallStyle: "custom",
    [key]: value,
  };
}

function extractionForm(settings: LtmExtractionSettingsPatch): ExtractionForm {
  const resolved = settings as LtmExtractionSettingsPatch & {
    systemPrompt?: string;
    activePromptTemplateId?: string | null;
  };
  return {
    version: 1,
    connectionId: resolved.connectionId ?? null,
    reasoningEffort: resolved.reasoningEffort ?? "low",
    verbosity: resolved.verbosity ?? "medium",
    maxOutputTokens: resolved.maxOutputTokens ?? 4096,
    temperature: resolved.temperature ?? 0.2,
    maxSourceTokens: resolved.maxSourceTokens ?? 16000,
    promptTemplates: resolved.promptTemplates ?? [],
    activePromptTemplateIdsByMode: resolved.activePromptTemplateIdsByMode ?? {},
    aiKeywordExtraction: resolved.aiKeywordExtraction ?? false,
    finishCutOffAnswers: resolved.finishCutOffAnswers ?? false,
    autoAcceptSafeChanges: resolved.autoAcceptSafeChanges ?? false,
    autoImportChatSources: resolved.autoImportChatSources ?? false,
    autoImportLeaveMessages: resolved.autoImportLeaveMessages ?? 0,
    chatImportDetail: resolved.chatImportDetail ?? "standard",
    useExtractionAgentOnGameMode: resolved.useExtractionAgentOnGameMode ?? false,
    ...(resolved.systemPrompt === undefined ? {} : { systemPrompt: resolved.systemPrompt }),
    ...(resolved.activePromptTemplateId === undefined
      ? {}
      : { activePromptTemplateId: resolved.activePromptTemplateId }),
  };
}

function extractionPayload({
  systemPrompt: _systemPrompt,
  activePromptTemplateId: _activePromptTemplateId,
  ...settings
}: ExtractionForm) {
  // Saving writes the two flags the shown choice stands for, so a stored import-off + accept-on becomes "I add them myself".
  return { ...settings, ...chatMemoriesFlags(ltmChatMemoriesModeOf(settings)) };
}

export default function MemorySettings({
  props,
  onDirtyChange,
  onRunSetup,
  onStartTour,
  openForConnection,
  onOpenForConnectionHandled,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const memorySettingsTitleId = useId();
  const recallStyleLabelId = useId();
  const recallStyleDescriptionId = useId();
  const recallGroupId = useId();
  const recallPreambleLabelId = useId();
  const memoryStopWordsLabelId = useId();
  const reasoningEffortLabelId = useId();
  const verbosityLabelId = useId();
  const extractionConnectionLabelId = useId();
  const chatMemoriesLabelId = useId();
  const queryClient = useQueryClient();
  const global = useQuery(settingsQueryOptions);
  const status = useQuery(statusQueryOptions);
  const extraction = useQuery({
    queryKey: queryKeys.extractionSettings,
    queryFn: () => request<LtmExtractionSettingsPatch>("/extraction-settings"),
  });
  const autoImportEvents = useAutoImportEvents(extraction.data?.autoImportChatSources === true);
  const connections = useQuery(languageConnectionsQueryOptions);
  const packageReaders = useQuery({
    queryKey: queryKeys.packageReaders,
    queryFn: () =>
      request<{
        readers: Array<{
          caller: string | null;
          lastReadAt: string | null;
          reads: number;
          memories: number;
          added: number;
        }>;
      }>("/settings/package-readers"),
  });
  const installedPackages = useQuery({
    queryKey: queryKeys.installedPackages,
    queryFn: () => requestHost<InstalledPackage[]>("/api/capability-packages/installed"),
  });
  const agentName = (id: string) => {
    const manifest = installedPackages.data?.find((item) => item.id === id)?.manifest;
    return manifest?.localizations?.[locale]?.name || manifest?.name || id;
  };
  const availableConnections = (connections.data ?? []).filter(
    (connection) => connection.provider !== "image_generation" && connection.provider !== "video_generation",
  );
  // The host's language row flagged "default for all agents", which is what extraction uses when no connection is
  // picked. Each category (audio, decision, ...) has its own default row, and the host skips rows awaiting a profile
  // import review. ponytail: it also skips rows on blocked accounts, which this list does not show, so such a row can
  // be named here while the host falls back to the chat's connection; upgrade = a host API for the resolved default.
  const defaultAgentConnection = availableConnections.find(
    (connection) =>
      String(connection.defaultForAgents) === "true" &&
      String(connection.profileImportReviewRequired) !== "true" &&
      !["audio", "audio_generation", "decision"].includes(connection.provider),
  );
  const [globalForm, setGlobalForm] = useState<GlobalForm | null>(null);
  const [savedGlobal, setSavedGlobal] = useState<GlobalForm | null>(null);
  const [extractionFormState, setExtractionFormState] = useState<ExtractionForm | null>(null);
  const [savedExtraction, setSavedExtraction] = useState<ExtractionForm | null>(null);
  // Reset clears the forms, which then refill only from settings fetched since
  // the action started, so a failed reload shows the error surface instead of the cached settings.
  // `refillSince` resets when Settings remounts, so the fill effects also wait while a query is in
  // error: react-query keeps the data cached before the failed read, and filling from it would let
  // the next Save write the replaced settings back.
  const [refillSince, setRefillSince] = useState(0);
  const [pending, setPending] = useState("");
  // True once a save has finished and nothing was edited or discarded since; it drives the "Saved" state word. The
  // result itself is a toast, and Troubleshooting results are toasts from TroubleshootingPanel.
  const [saveFinished, setSaveFinished] = useState(false);
  // Chat Settings can open this tab with the connection field focused (once).
  const [activeTab, setActiveTab] = useState<SettingsTab>(openForConnection ? "extraction" : "recall");
  const connectionSelectRef = useRef<HTMLSelectElement>(null);
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const addAgentRef = useRef<HTMLButtonElement>(null);
  // An added row takes focus once it renders.
  const [focusAgent, setFocusAgent] = useState<string | null>(null);
  useEffect(() => {
    if (!focusAgent) return;
    document.querySelector<HTMLInputElement>(`[data-ltm-sharing-agent="${CSS.escape(focusAgent)}"] input`)?.focus();
    setFocusAgent(null);
  }, [focusAgent]);
  // Starting a troubleshooting action clears the "Saved" state, as every action did before.
  useEffect(() => {
    if (maintenanceBusy) setSaveFinished(false);
  }, [maintenanceBusy]);

  // "Reset to preset" returns to the last named style: the one chosen or saved before the weights were
  // edited. Whenever the form equals the saved settings (first load, Save, Discard or reset) the
  // history restarts from them; a form saved as Custom has no named style, so it takes the preset its
  // weights are closest to (Balanced for untouched weights), the same answer after Save and after a reload.
  const [lastRecallPreset, setLastRecallPreset] =
    useState<Exclude<GlobalForm["longTermMemoryRecallStyle"], "custom">>("balanced");
  const restartRecallPreset = (form: GlobalForm) =>
    setLastRecallPreset(
      form.longTermMemoryRecallStyle === "custom" ? nearestRecallPreset(form) : form.longTermMemoryRecallStyle,
    );
  const recallStyle = globalForm?.longTermMemoryRecallStyle;
  useEffect(() => {
    if (recallStyle && recallStyle !== "custom") setLastRecallPreset(recallStyle);
  }, [recallStyle]);
  useEffect(() => {
    if (globalForm && savedGlobal && same(globalForm, savedGlobal)) restartRecallPreset(savedGlobal);
  }, [globalForm, savedGlobal]);
  useEffect(() => {
    if (!global.data || global.isError || globalForm || global.dataUpdatedAt < refillSince) return;
    const next = settingsForm(global.data);
    setGlobalForm(next);
    setSavedGlobal(next);
  }, [global.data, global.dataUpdatedAt, global.isError, globalForm, refillSince]);
  useEffect(() => {
    if (!extraction.data || extraction.isError || extractionFormState || extraction.dataUpdatedAt < refillSince) return;
    const next = extractionForm(extraction.data);
    setExtractionFormState(next);
    setSavedExtraction(next);
  }, [extraction.data, extraction.dataUpdatedAt, extraction.isError, extractionFormState, refillSince]);

  const globalDirty = Boolean(globalForm && savedGlobal && !same(globalForm, savedGlobal));
  const extractionDirty = Boolean(
    extractionFormState && savedExtraction && !same(extractionFormState, savedExtraction),
  );
  const dirty = globalDirty || extractionDirty;
  // Save and Discard sit in a sticky header, but the tab holding the edit still needs its own cue: Extraction owns
  // the extraction form, and Recall owns every other global field.
  // "Hide remembered messages" and its tail are global fields that live on the Extraction tab.
  const hideDirty = Boolean(
    globalForm &&
    savedGlobal &&
    (globalForm.longTermMemoryHideImportedMessages !== savedGlobal.longTermMemoryHideImportedMessages ||
      globalForm.longTermMemoryHideTailMessages !== savedGlobal.longTermMemoryHideTailMessages),
  );
  const recallDirty = Boolean(
    globalForm &&
    savedGlobal &&
    !same(
      { ...globalForm, longTermMemoryHideImportedMessages: false, longTermMemoryHideTailMessages: 0 },
      { ...savedGlobal, longTermMemoryHideImportedMessages: false, longTermMemoryHideTailMessages: 0 },
    ),
  );
  const dirtyTabs: Partial<Record<SettingsTab, boolean>> = {
    recall: recallDirty,
    extraction: extractionDirty || hideDirty,
  };
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  // Discard unmounts once the form is clean (Save stays, aria-disabled), so focus moves to the active tab instead of
  // dropping to the page. A dismissed host confirmation settles first, hence the frame.
  const [focusAfterSaveRequest, setFocusAfterSaveRequest] = useState(0);
  useEffect(() => {
    if (!focusAfterSaveRequest) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected) return;
      document
        .querySelector<HTMLElement>('[data-ltm-surface="memory-settings"] [role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusAfterSaveRequest]);
  // Save keeps its button focusable while it runs (aria-disabled), so this synchronous guard
  // blocks a second save before React re-renders.
  const savingRef = useRef(false);

  // Slurp's switches the user said yes to when flipping the matching Sharing switch; Save applies them, and a
  // Discard, a switch turned back off or a removed row drops them. A failed Save keeps them for the retry.
  const slurpAccepted = useRef(new Set<SlurpMemorySetting>());
  // Bumped whenever a switch changes or the form is replaced, so an answer to an older question is not remembered.
  const slurpEpoch = useRef<Record<SlurpMemorySetting, number>>({ flavourFromAgents: 0, shareWithMemory: 0 });
  const forgetSlurp = (...settings: SlurpMemorySetting[]) => {
    for (const setting of settings.length ? settings : (Object.keys(slurpEpoch.current) as SlurpMemorySetting[])) {
      slurpEpoch.current[setting] += 1;
      slurpAccepted.current.delete(setting);
    }
  };
  const slurpCopy = (setting: SlurpMemorySetting) =>
    setting === "flavourFromAgents"
      ? {
          title: localizeUi("ui.longTermMemory.memorysettings.slurpMemoryOfferTitle"),
          message: localizeUi("ui.longTermMemory.memorysettings.slurpMemoryOfferMessage"),
          failed: localizeUi("ui.longTermMemory.memorysettings.slurpMemoryOfferFailed"),
        }
      : {
          title: localizeUi("ui.longTermMemory.memorysettings.slurpAddOfferTitle"),
          message: localizeUi("ui.longTermMemory.memorysettings.slurpAddOfferMessage"),
          failed: localizeUi("ui.longTermMemory.memorysettings.slurpAddOfferFailed"),
        };
  /** Asks once, as the switch turns on, whether to turn on Slurp's matching switch too. */
  const askSlurp = async (setting: SlurpMemorySetting) => {
    const copy = slurpCopy(setting);
    const epoch = slurpEpoch.current[setting];
    try {
      const outcome = await askSlurpMemories({
        setting,
        read: () => requestHost<Partial<Record<SlurpMemorySetting, boolean>>>("/api/slurp2/settings"),
        confirm: () =>
          confirm(
            props,
            copy.title,
            copy.message,
            localizeUi("ui.longTermMemory.memorysettings.slurpMemoryOfferConfirm"),
            false,
            localizeUi("ui.longTermMemory.memorysettings.slurpMemoryOfferCancel"),
          ),
      });
      if (outcome === "accepted" && slurpEpoch.current[setting] === epoch) slurpAccepted.current.add(setting);
    } catch {
      // A failed dialog asks nothing more; Slurp's own switch stays where it was.
    }
  };

  // Reset reloads the forms, so the button that started it unmounts; focus returns to it once the form is back.
  const resetButton = useRef<HTMLButtonElement>(null);
  const focusResetAfterReload = useRef(false);
  useEffect(() => {
    if (!focusResetAfterReload.current || pending !== "" || !resetButton.current) return;
    focusResetAfterReload.current = false;
    if (document.activeElement === document.body) resetButton.current.focus();
  });

  const saveSettings = async () => {
    if (savingRef.current || (!globalDirty && !extractionDirty)) return;
    savingRef.current = true;
    setPending("global");
    setSaveFinished(false);
    let rebuild: SettingsRebuildOutcome | null = null;
    let slurpAfter = savedGlobal?.longTermMemoryPackageAccess.slurp2;
    try {
      if (globalDirty && globalForm) {
        const submitted = globalForm;
        const response = await request<LtmGlobalSettings & { rebuild?: SettingsRebuildOutcome | null }>(
          "/settings",
          "PUT",
          globalPayload(submitted, savedGlobal),
        );
        const saved = settingsForm(response);
        slurpAfter = saved.longTermMemoryPackageAccess.slurp2;
        setSavedGlobal(saved);
        // Saving now awaits an index rebuild, so only clear the form when no newer edit
        // arrived while it was in flight; otherwise those edits stay dirty.
        setGlobalForm((current) => {
          if (!current || same(current, submitted)) return current && saved;
          // Keep Agents another writer added during the save, or the next Save would remove them.
          const arrived = Object.entries(saved.longTermMemoryPackageAccess).filter(
            ([id]) => !(id in submitted.longTermMemoryPackageAccess) && !(id in current.longTermMemoryPackageAccess),
          );
          return arrived.length
            ? {
                ...current,
                longTermMemoryPackageAccess: sortedAccess({
                  ...current.longTermMemoryPackageAccess,
                  ...Object.fromEntries(arrived),
                }),
              }
            : current;
        });
        await invalidateLtmQueries(queryClient, [queryKeys.settings, queryKeys.chatDefaults, queryKeys.status]);
        rebuild = response.rebuild ?? null;
      }
      if (extractionDirty && extractionFormState) {
        const submitted = extractionFormState;
        const saved = extractionForm(
          await request<LtmExtractionSettingsPatch>("/extraction-settings", "PUT", extractionPayload(submitted)),
        );
        setSavedExtraction(saved);
        // The global save can await a long index rebuild, so keep newer extraction edits
        // that arrived while this request was in flight instead of overwriting them.
        setExtractionFormState((current) => (current && same(current, submitted) ? saved : current));
        await invalidateLtmQueries(queryClient, [queryKeys.extractionSettings]);
      }
      if (rebuild?.status === "deferred") {
        toast.warning(
          localizeUi("ui.longTermMemory.memorysettings.memorySettingsSavedIndexRebuildFailed", {
            error: rebuild.error ?? "",
          }),
          { duration: 12_000 },
        );
      } else if (rebuild?.status === "complete") {
        toast.success(localizeUi("ui.longTermMemory.memorysettings.memorySettingsSavedIndexRebuilt"));
      } else {
        toast.success(localizeUi("ui.longTermMemory.memorysettings.memorySettingsSaved"));
      }
      // Slurp's Creators need their own switches too. The yes was asked when the switch turned on; it applies now
      // that the save has landed, and only for a switch the saved settings still have on.
      // A yes given while this save was in flight (the saved row still has the switch off) waits for the next one.
      for (const setting of [...slurpAccepted.current]) {
        if (!(setting === "flavourFromAgents" ? slurpAfter?.read : slurpAfter?.add)) continue;
        slurpAccepted.current.delete(setting);
        try {
          await requestHost("/api/slurp2/settings", "PATCH", { [setting]: true });
        } catch {
          // The fixed text keeps saying that Long-Term Memory itself saved.
          toast.error(slurpCopy(setting).failed);
        }
      }
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotSaveMemorySettings")));
    } finally {
      savingRef.current = false;
      setPending("");
      setSaveFinished(true);
      setFocusAfterSaveRequest((request) => request + 1);
    }
  };

  const discard = async () => {
    if (
      !dirty ||
      (await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.discardUnsavedChanges"),
        localizeUi("ui.longTermMemory.memorysettings.recallAndExtractionEditsWillBeLost"),
        localizeUi("ui.longTermMemory.memorysettings.discard"),
        true,
      ))
    ) {
      if (savedGlobal) {
        setGlobalForm(savedGlobal);
      }
      if (savedExtraction) setExtractionFormState(savedExtraction);
      forgetSlurp();
      // An earlier save no longer describes the form, so focus goes to the tab.
      setSaveFinished(false);
      setFocusAfterSaveRequest((request) => request + 1);
    }
  };

  /** True when `key` was refetched at or after `since`; a failed or paused refetch leaves the old data in the cache. */
  const refetchedSince = (key: readonly unknown[], since: number) => {
    const state = queryClient.getQueryState(key);
    return state?.status === "success" && state.dataUpdatedAt >= since;
  };

  const resetSettings = async () => {
    if (savingRef.current || pending !== "" || maintenanceBusy) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.resetMemorySettings"),
        localizeUi("ui.longTermMemory.memorysettings.resetMemorySettingsDescription"),
        localizeUi("ui.longTermMemory.memorysettings.resetSettings"),
        true,
      ))
    )
      return;
    setPending("settings-reset");
    setSaveFinished(false);
    focusResetAfterReload.current = true;
    try {
      const response = await request<{ rebuild?: SettingsRebuildOutcome | null }>("/settings/reset", "POST");
      const startedAt = Date.now();
      // The forms drop and refill only from settings fetched at or after now.
      setRefillSince(startedAt);
      setGlobalForm(null);
      setSavedGlobal(null);
      setExtractionFormState(null);
      setSavedExtraction(null);
      forgetSlurp();
      await invalidateLtmQueries(queryClient, [
        queryKeys.settings,
        queryKeys.extractionSettings,
        queryKeys.chatDefaults,
        queryKeys.status,
      ]);
      const refreshedGlobal = queryClient.getQueryData<LtmGlobalSettings>(queryKeys.settings);
      const refreshedExtraction = queryClient.getQueryData<LtmExtractionSettingsPatch>(queryKeys.extractionSettings);
      if (
        refetchedSince(queryKeys.settings, startedAt) &&
        refetchedSince(queryKeys.extractionSettings, startedAt) &&
        refreshedGlobal &&
        refreshedExtraction
      ) {
        const nextGlobal = settingsForm(refreshedGlobal);
        setGlobalForm(nextGlobal);
        setSavedGlobal(nextGlobal);
        const nextExtraction = extractionForm(refreshedExtraction);
        setExtractionFormState(nextExtraction);
        setSavedExtraction(nextExtraction);
      }
      if (response.rebuild?.status === "deferred") {
        toast.warning(
          localizeUi("ui.longTermMemory.memorysettings.memorySettingsResetIndexRebuildFailed", {
            error: response.rebuild.error ?? "",
          }),
          { duration: 12_000 },
        );
      } else {
        toast.success(localizeUi("ui.longTermMemory.memorysettings.memorySettingsResetToDefaults"));
      }
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotResetMemorySettings")));
    } finally {
      setPending("");
    }
  };
  // Delete all data reloads the forms, which shows the loading or error surface.
  // Every return keeps a <section> root and this keyed panel, so React keeps the panel
  // mounted and its running action keeps its busy state.
  const troubleshootingPanel = (hidden: boolean) => (
    <TroubleshootingPanel
      key="troubleshooting"
      props={props}
      hidden={hidden}
      open={troubleshootingOpen}
      onOpenChange={setTroubleshootingOpen}
      disabled={pending !== ""}
      onBusyChange={setMaintenanceBusy}
      onRunSetup={onRunSetup}
      onStartTour={onStartTour}
    />
  );
  const loadScreen = (surface: ReactNode) => (
    <section>
      {surface}
      {troubleshootingPanel(true)}
    </section>
  );

  // The form (and its connection field) mounts only once both settings have loaded.
  const formReady = Boolean(globalForm && extractionFormState);
  useEffect(() => {
    if (!openForConnection || !formReady) return;
    connectionSelectRef.current?.focus({ preventScroll: true });
    onOpenForConnectionHandled?.();
  }, [formReady, onOpenForConnectionHandled, openForConnection]);
  if (global.isError || extraction.isError)
    return loadScreen(
      <StatusSurface tone="danger">
        {localizeUi("ui.longTermMemory.memorysettings.couldNotLoadMemorySettings")}{" "}
        <button
          type="button"
          className="inline-flex min-h-11 items-center underline"
          onClick={() => {
            void global.refetch();
            void extraction.refetch();
          }}
        >
          {localizeUi("ui.longTermMemory.activityview.retry")}
        </button>
      </StatusSurface>,
    );
  if (global.isLoading || extraction.isLoading || !globalForm || !extractionFormState)
    return loadScreen(
      <StatusSurface busy>{localizeUi("ui.longTermMemory.memorysettings.loadingMemorySettings")}</StatusSurface>,
    );

  const busy = pending !== "" || maintenanceBusy;
  const busyActionProps = lockedActionProps(busy);
  // Discard and Reset clear the flag and a failed save leaves the form dirty, so a clean form after a
  // finished save means the save went through, even a deferred-rebuild one.
  const saved = !dirty && saveFinished;
  // The budget alone limits a recall; the hint says about how many of this vault's memories it holds.
  const budgetFit = ltmRecallBudgetMemories(
    globalForm.longTermMemoryBudgetTokens,
    status.data?.indexes.averageMemoryTokens,
  );
  const sharingRows = Object.entries(globalForm.longTermMemoryPackageAccess);
  // ponytail: only the Agents this version knows can be added until the Engine lists every installed Agent that
  // reads memories (scratch/issues/engine-ltm-installed-agents.md); without the installed list, offer all of them.
  const addableAgents = LTM_PACKAGE_AGENTS.filter(
    (id) =>
      !(id in globalForm.longTermMemoryPackageAccess) &&
      (!installedPackages.data || installedPackages.data.some((item) => item.id === id)),
  );

  return (
    <section
      aria-labelledby={memorySettingsTitleId}
      data-ltm-surface="memory-settings"
      className="space-y-5"
      style={{
        containerName: "ltm-memory-settings",
        containerType: "inline-size",
      }}
    >
      <style>{`
        /* The Engine's unlayered .mari-editor-tab sets min-height: 2.25rem, which beats min-h-11. */
        [data-ltm-surface="memory-settings"] [role="tablist"] > .mari-editor-tab {
          min-height: 2.75rem;
        }
        /* The Engine's muted tab text is 4.46:1 in the light theme; inactive tabs read from the editor text. */
        [data-ltm-surface="memory-settings"] [role="tablist"] > .mari-editor-tab[data-active="false"]:not(:hover) {
          color: color-mix(in srgb, var(--marinara-editor-text) 78%, transparent);
        }
        /* Keep a control focused by keyboard clear of the sticky Save bar. */
        .mari-editor-content:has([data-ltm-surface="memory-settings"]) {
          scroll-padding-top: 4rem;
        }
        [data-ltm-extraction-grid],
        [data-ltm-recall-grid] {
          display: grid;
          gap: 1rem 1.5rem;
          align-items: start;
        }
        [data-ltm-extraction-grid] .mari-editor-field {
          min-height: 2.75rem;
          width: 100%;
          padding-inline: 0.75rem;
          font-size: 0.875rem;
        }
        /* A dropdown reads from its first word: past this width the arrow drifts far from the text. */
        [data-ltm-surface="memory-settings"] select {
          max-width: 24rem;
        }
        @container ltm-memory-settings (min-width: 36rem) {
          [data-ltm-extraction-grid],
          [data-ltm-recall-grid] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          [data-ltm-active-template-grid] {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          [data-ltm-settings-tab-rail] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
      <div
        data-ltm-settings-header
        className={`flex flex-wrap items-center justify-between gap-2 py-1 ${dirty ? "sticky top-0 z-10 bg-[var(--marinara-editor-bg)]" : ""}`}
      >
        <div>
          <h2 id={memorySettingsTitleId} className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.memorySettings")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* One save model for every tab: the state word is always shown, Save is always there (aria-disabled
              while nothing changed), and Discard appears with the first edit. */}
          <span
            role="status"
            data-ltm-save-state={dirty ? "dirty" : saved ? "saved" : "clean"}
            className={`text-xs font-semibold ${dirty ? "text-[var(--marinara-editor-accent)]" : "text-[var(--muted-foreground)]"}`}
          >
            {localizeUi(
              dirty
                ? "ui.longTermMemory.memorysettings.saveStateUnsaved"
                : saved
                  ? "ui.longTermMemory.memorysettings.saveStateSaved"
                  : "ui.longTermMemory.memorysettings.saveStateClean",
            )}
          </span>
          <Button
            primary
            {...lockedActionProps(busy || !dirty)}
            onClick={() => {
              if (!busy) void saveSettings();
            }}
          >
            {localizeUi("ui.longTermMemory.memorysettings.saveSettings")}
          </Button>
          {dirty ? (
            <Button
              destructive
              {...busyActionProps}
              onClick={() => {
                if (!busy) void discard();
              }}
            >
              {localizeUi("ui.longTermMemory.memorysettings.discardChanges")}
            </Button>
          ) : null}
        </div>
      </div>
      <div
        role="tablist"
        aria-label={localizeUi("ui.longTermMemory.memorysettings.memorySettingsSections")}
        data-ltm-settings-tab-rail
        className="mari-editor-tab-rail grid grid-cols-2 gap-1 rounded-lg border p-1"
        style={{ display: "grid" }}
      >
        {settingsTabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              const next = nextTabIndex(event.key, index, settingsTabs.length);
              if (next === null) return;
              event.preventDefault();
              setActiveTab(settingsTabs[next].id);
              document.getElementById(`settings-tab-${settingsTabs[next].id}`)?.focus();
            }}
            data-active={activeTab === tab.id}
            data-ltm-tab-focus
            className="mari-editor-tab min-h-11 rounded-md px-2 text-xs font-semibold transition-colors"
          >
            {localizeUi(tab.labelKey)}
            {dirtyTabs[tab.id] ? (
              <>
                <span
                  aria-hidden="true"
                  data-ltm-tab-dirty
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--marinara-editor-accent)] align-middle"
                />
                <span className="sr-only"> {localizeUi("ui.longTermMemory.memorysettings.tabUnsavedChanges")}</span>
              </>
            ) : null}
          </button>
        ))}
      </div>
      <p data-ltm-settings-reassurance className="text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.memorysettings.settingsReassurance")}{" "}
        <button
          ref={resetButton}
          type="button"
          data-ltm-reset-settings
          {...busyActionProps}
          onClick={() => void resetSettings()}
          className="inline-flex min-h-11 items-center underline"
        >
          {localizeUi("ui.longTermMemory.memorysettings.resetToDefaults")}
        </button>
      </p>

      <section
        id="settings-panel-recall"
        role="tabpanel"
        aria-labelledby="settings-tab-recall"
        hidden={activeTab !== "recall"}
        className="mari-editor-panel space-y-4 p-3"
      >
        <div data-ltm-recall-grid>
          <NumberField
            liveCommit
            label={localizeUi("ui.longTermMemory.memorysettings.recallBudgetTokens")}
            unit={localizeUi("ui.longTermMemory.memorysettings.recallBudgetUnit")}
            hint={
              <p aria-live="polite" data-ltm-recall-budget-hint>
                {budgetFit === 1
                  ? localizeUi("ui.longTermMemory.memorysettings.recallBudgetFitOne")
                  : localizeUi("ui.longTermMemory.memorysettings.recallBudgetFit", { count: budgetFit })}
              </p>
            }
            value={globalForm.longTermMemoryBudgetTokens}
            integer
            min={RECALL_BUDGET_MIN}
            max={RECALL_BUDGET_MAX}
            step={128}
            onChange={(value) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryBudgetTokens: value,
              })
            }
          />
          <Field labelId={recallStyleLabelId} label={localizeUi("ui.longTermMemory.chatsettings.recallStyle")}>
            <select
              aria-labelledby={recallStyleLabelId}
              aria-describedby={
                globalForm.longTermMemoryRecallStyle === "custom" ? undefined : recallStyleDescriptionId
              }
              className={inputClass}
              value={globalForm.longTermMemoryRecallStyle}
              onChange={(event) =>
                setGlobalForm(
                  applyRecallStyle(globalForm, event.target.value as GlobalForm["longTermMemoryRecallStyle"]),
                )
              }
            >
              <option value="balanced">{localizeUi("ui.longTermMemory.chatsettings.balanced")}</option>
              <option value="exact">{localizeUi("ui.longTermMemory.chatsettings.exact")}</option>
              <option value="broad">{localizeUi("ui.longTermMemory.chatsettings.broad")}</option>
              <option value="story">{localizeUi("ui.longTermMemory.chatsettings.story")}</option>
              <option value="custom">{localizeUi("ui.longTermMemory.chatsettings.custom")}</option>
            </select>
            {globalForm.longTermMemoryRecallStyle === "custom" ? null : (
              <p
                id={recallStyleDescriptionId}
                data-ltm-recall-style-description
                className="text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
              >
                {localizeUi(recallStyleDescriptionKey(globalForm.longTermMemoryRecallStyle))}
              </p>
            )}
            {/* The status span stays mounted (inline and empty, so it takes no room) so the flip to Custom is
                  announced; the button sits outside it so a screen reader does not read it as part of the message. */}
            <span
              role="status"
              className={
                globalForm.longTermMemoryRecallStyle === "custom"
                  ? "block text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
                  : undefined
              }
              data-ltm-recall-custom
            >
              {globalForm.longTermMemoryRecallStyle === "custom"
                ? localizeUi("ui.longTermMemory.memorysettings.recallCustomNote", {
                    preset: localizeUi(`ui.longTermMemory.chatsettings.${lastRecallPreset}`),
                  })
                : null}
            </span>
            {globalForm.longTermMemoryRecallStyle === "custom" ? (
              <Button
                onClick={() => setGlobalForm(applyRecallStyle(globalForm, lastRecallPreset))}
                data-ltm-recall-reset-preset
              >
                {localizeUi("ui.longTermMemory.memorysettings.resetToPreset")}
              </Button>
            ) : null}
          </Field>
        </div>
        {globalForm.longTermMemoryRecallStyle === "custom" ? (
          <div data-ltm-recall-grid>
            <SliderField
              label={localizeUi("ui.longTermMemory.memorysettings.meaningMatch")}
              hint={localizeUi("ui.longTermMemory.memorysettings.weightGivenToSemanticSimilarityBetweenTheCurrentChat")}
              value={globalForm.longTermMemorySemanticWeight}
              min={0}
              max={1}
              step={0.005}
              onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemorySemanticWeight", value))}
            />
            <SliderField
              label={localizeUi("ui.longTermMemory.memorysettings.exactWordsMatch")}
              hint={localizeUi("ui.longTermMemory.memorysettings.weightGivenToMatchingWordsAndPhrases")}
              value={globalForm.longTermMemoryLexicalWeight}
              min={0}
              max={1}
              step={0.005}
              onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemoryLexicalWeight", value))}
            />
            <SliderField
              label={localizeUi("ui.longTermMemory.memorysettings.linkedMemoriesMatch")}
              hint={localizeUi("ui.longTermMemory.memorysettings.weightGivenToRelationshipsBetweenLinkedMemories")}
              value={globalForm.longTermMemoryGraphWeight}
              min={0}
              max={1}
              step={0.005}
              onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemoryGraphWeight", value))}
            />
            <SliderField
              label={localizeUi("ui.longTermMemory.memorysettings.storedKeywordsMatch")}
              hint={localizeUi("ui.longTermMemory.memorysettings.weightGivenToMatchingStoredKeywords")}
              value={globalForm.longTermMemoryKeywordWeight}
              min={0}
              max={1}
              step={0.005}
              onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemoryKeywordWeight", value))}
            />
          </div>
        ) : null}
        <div data-ltm-recall-grid>
          <Toggle
            label={localizeUi("ui.longTermMemory.memorysettings.linkedMemories")}
            hint={localizeUi("ui.longTermMemory.memorysettings.linkedMemoriesHelp")}
            checked={globalForm.longTermMemoryGraphWeight > 0}
            onChange={(value) => {
              if (!value) return setGlobalForm(applyCustomWeight(globalForm, "longTermMemoryGraphWeight", 0));
              // Turning links back on over an untouched preset returns to that preset instead of leaving Custom behind.
              const preset = LTM_RECALL_STYLE_WEIGHTS[lastRecallPreset];
              const restoresPreset =
                preset.graphWeight > 0 &&
                globalForm.longTermMemorySemanticWeight === preset.semanticWeight &&
                globalForm.longTermMemoryLexicalWeight === preset.lexicalWeight &&
                globalForm.longTermMemoryKeywordWeight === preset.keywordWeight;
              setGlobalForm(
                restoresPreset
                  ? applyRecallStyle(globalForm, lastRecallPreset)
                  : applyCustomWeight(
                      globalForm,
                      "longTermMemoryGraphWeight",
                      preset.graphWeight || LTM_RECALL_STYLE_WEIGHTS.balanced.graphWeight,
                    ),
              );
            }}
          />
          <Toggle
            label={localizeUi("ui.longTermMemory.memorysettings.includeResolvedMemories")}
            hint={localizeUi("ui.longTermMemory.memorysettings.includeResolvedHint")}
            checked={globalForm.longTermMemoryIncludeResolved}
            onChange={(value) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryIncludeResolved: value,
              })
            }
          />
        </div>
        <div
          role="group"
          aria-labelledby={`${recallGroupId}-sharing`}
          data-ltm-recall-group="sharing"
          data-ltm-settings-section
          className="space-y-3"
        >
          <div className="space-y-0.5">
            <h4 id={`${recallGroupId}-sharing`} data-ltm-group-heading className="text-sm font-semibold">
              {localizeUi("ui.longTermMemory.memorysettings.recallSharingGroup")}
            </h4>
            <p id={`${recallGroupId}-sharing-hint`} className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memorysettings.sharingReadHint")}
            </p>
          </div>
          {sharingRows.length ? (
            <table
              aria-label={localizeUi("ui.longTermMemory.memorysettings.sharingTable")}
              className="w-full text-left text-xs text-[var(--muted-foreground)]"
            >
              <thead>
                <tr>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {localizeUi("ui.longTermMemory.memorysettings.otherAgentsAgent")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-center font-medium">
                    {localizeUi("ui.longTermMemory.memorysettings.sharingCanRead")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-center font-medium">
                    {localizeUi("ui.longTermMemory.memorysettings.sharingCanAdd")}
                  </th>
                  <th scope="col" className="py-1">
                    <span className="sr-only">{localizeUi("ui.longTermMemory.memorysettings.sharingRemove")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sharingRows.map(([id, access]) => {
                  const name = agentName(id);
                  const used = packageReaders.data?.readers.find((reader) => reader.caller === id);
                  const setAccess = (change: Partial<typeof access>) =>
                    setGlobalForm({
                      ...globalForm,
                      longTermMemoryPackageAccess: {
                        ...globalForm.longTermMemoryPackageAccess,
                        [id]: { ...access, ...change },
                      },
                    });
                  return (
                    <tr key={id} data-ltm-sharing-agent={id}>
                      <th scope="row" className="py-1 pr-3 font-normal">
                        <span className="block text-[var(--foreground)]">{name}</span>
                        <span className="block">
                          {used && (used.reads || used.added)
                            ? localizeUi("ui.longTermMemory.memorysettings.sharingUsage", {
                                reads: used.reads.toLocaleString(locale),
                                memories: used.memories.toLocaleString(locale),
                                added: used.added.toLocaleString(locale),
                              })
                            : localizeUi("ui.longTermMemory.memorysettings.sharingNotUsed")}
                        </span>
                      </th>
                      <td className="py-1 pr-3 text-center">
                        <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            role="switch"
                            data-ltm-switch
                            aria-label={localizeUi("ui.longTermMemory.memorysettings.sharingCanReadAgent", { name })}
                            checked={access.read}
                            onChange={(event) => {
                              setAccess({ read: event.target.checked });
                              if (id !== "slurp2") return;
                              forgetSlurp("flavourFromAgents");
                              if (event.target.checked) void askSlurp("flavourFromAgents");
                            }}
                          />
                        </label>
                      </td>
                      <td className="py-1 pr-3 text-center">
                        {ltmPackageCanAdd(id) ? (
                          <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              role="switch"
                              data-ltm-switch
                              aria-label={localizeUi("ui.longTermMemory.memorysettings.sharingCanAddAgent", { name })}
                              checked={access.add}
                              aria-describedby={`${recallGroupId}-sharing-hint`}
                              onChange={(event) => {
                                setAccess({ add: event.target.checked });
                                if (id !== "slurp2") return;
                                forgetSlurp("shareWithMemory");
                                if (event.target.checked) void askSlurp("shareWithMemory");
                              }}
                            />
                          </label>
                        ) : (
                          localizeUi("ui.longTermMemory.memorysettings.sharingNotOffered")
                        )}
                      </td>
                      <td className="py-1 text-right">
                        <IconButton
                          icon={X}
                          label={localizeUi("ui.longTermMemory.memorysettings.sharingRemoveAgent", { name })}
                          onClick={() => {
                            const { [id]: _removed, ...rest } = globalForm.longTermMemoryPackageAccess;
                            if (id === "slurp2") forgetSlurp();
                            setGlobalForm({ ...globalForm, longTermMemoryPackageAccess: rest });
                            addAgentRef.current?.focus();
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memorysettings.sharingEmpty")}
            </p>
          )}
          {/* ponytail: a plain disclosure list until bundle 7 item 3's shared picker replaces it. */}
          <div className="space-y-1">
            <Button ref={addAgentRef} aria-expanded={addAgentOpen} onClick={() => setAddAgentOpen((open) => !open)}>
              <Plus aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.memorysettings.sharingAddAgent")}
            </Button>
            {addAgentOpen ? (
              addableAgents.length ? (
                <div className="flex flex-wrap gap-2">
                  {addableAgents.map((id) => (
                    <Button
                      key={id}
                      onClick={() => {
                        setGlobalForm({
                          ...globalForm,
                          longTermMemoryPackageAccess: sortedAccess({
                            ...globalForm.longTermMemoryPackageAccess,
                            [id]: { read: true, add: false },
                          }),
                        });
                        if (id === "slurp2") void askSlurp("flavourFromAgents");
                        setAddAgentOpen(false);
                        setFocusAgent(id);
                      }}
                    >
                      {agentName(id)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.longTermMemory.memorysettings.sharingAllAdded")}
                </p>
              )
            ) : null}
          </div>
        </div>
        <details data-ltm-recall-advanced data-ltm-disclosure className="space-y-3">
          <DisclosureSummary className="text-xs">
            {localizeUi("ui.longTermMemory.memorysettings.recallMatchingGroup")}
            <span data-ltm-disclosure-note>{localizeUi("ui.longTermMemory.memorysettings.recallMatchingNote")}</span>
          </DisclosureSummary>
          <div data-ltm-recall-grid>
            <SliderField
              label={localizeUi("ui.longTermMemory.memorysettings.scoreThreshold")}
              hint={
                globalForm.longTermMemoryScoreThreshold === 0
                  ? localizeUi("ui.longTermMemory.memorysettings.matchStrictnessOff")
                  : localizeUi("ui.longTermMemory.memorysettings.matchStrictnessHint", {
                      pct: Math.round(globalForm.longTermMemoryScoreThreshold * 100),
                    })
              }
              value={globalForm.longTermMemoryScoreThreshold}
              min={0}
              max={LTM_RECALL_SCORE_THRESHOLD_CEILING}
              step={0.01}
              ends={[
                localizeUi("ui.longTermMemory.memorysettings.scoreThresholdLooser"),
                localizeUi("ui.longTermMemory.memorysettings.scoreThresholdStricter"),
              ]}
              onChange={(value) =>
                setGlobalForm({
                  ...globalForm,
                  longTermMemoryScoreThreshold: value,
                })
              }
            />
            <NumberField
              liveCommit
              label={localizeUi("ui.longTermMemory.memorysettings.recentMessagesForRecall")}
              hint={localizeUi("ui.longTermMemory.memorysettings.recentMessagesHint")}
              unit={localizeUi("ui.longTermMemory.memorysettings.hideTailMessagesUnit")}
              value={globalForm.longTermMemoryRecallContextMessages}
              integer
              min={1}
              max={20}
              onChange={(value) =>
                setGlobalForm({
                  ...globalForm,
                  longTermMemoryRecallContextMessages: value,
                })
              }
            />
            <Field
              wide
              labelId={recallPreambleLabelId}
              label={localizeUi("ui.longTermMemory.memorysettings.memoryContextInstructions")}
              hint={localizeUi("ui.longTermMemory.memorysettings.recallPreambleHint")}
            >
              <textarea
                aria-labelledby={recallPreambleLabelId}
                aria-describedby={`${recallPreambleLabelId}-hint`}
                className={`${inputClass} min-h-24 py-2`}
                maxLength={500}
                value={globalForm.longTermMemoryRecallPreamble}
                onChange={(event) =>
                  setGlobalForm({
                    ...globalForm,
                    longTermMemoryRecallPreamble: event.target.value,
                  })
                }
              />
            </Field>
            <div className="space-y-1" style={{ gridColumn: "1 / -1" }}>
              <Field
                labelId={memoryStopWordsLabelId}
                label={localizeUi("ui.longTermMemory.memorysettings.memoryStopWords")}
                hint={localizeUi("ui.longTermMemory.memorysettings.stopWordsHint")}
              >
                <textarea
                  aria-labelledby={memoryStopWordsLabelId}
                  aria-describedby={`${memoryStopWordsLabelId}-hint`}
                  className={`${inputClass} min-h-20 py-2`}
                  spellCheck={false}
                  placeholder={localizeUi("ui.longTermMemory.memorysettings.stopWordsPlaceholder")}
                  value={globalForm.longTermMemoryStopWordsText}
                  onChange={(event) =>
                    setGlobalForm({
                      ...globalForm,
                      longTermMemoryStopWordsText: event.target.value,
                    })
                  }
                />
              </Field>
              <Toggle
                label={localizeUi("ui.longTermMemory.memorysettings.blockStopWordsInGeneratedKeywords")}
                hint={localizeUi("ui.longTermMemory.memorysettings.stopWordsKeywordsHint")}
                checked={globalForm.longTermMemoryStopWordsFilterGenerated}
                onChange={(value) =>
                  setGlobalForm({
                    ...globalForm,
                    longTermMemoryStopWordsFilterGenerated: value,
                  })
                }
              />
            </div>
          </div>
        </details>
      </section>

      <section
        id="settings-panel-extraction"
        role="tabpanel"
        aria-labelledby="settings-tab-extraction"
        hidden={activeTab !== "extraction"}
        className="mari-editor-panel space-y-4 p-3"
      >
        <div data-ltm-extraction-grid>
          <Field
            wide
            data-ltm-chat-memories-field
            labelId={chatMemoriesLabelId}
            label={localizeUi("ui.longTermMemory.memorysettings.memoriesFromChats")}
          >
            <select
              aria-labelledby={chatMemoriesLabelId}
              aria-describedby={`${chatMemoriesLabelId}-hint`}
              data-ltm-chat-memories="global"
              className={inputClass}
              value={ltmChatMemoriesModeOf(extractionFormState)}
              onChange={(event) =>
                setExtractionFormState({
                  ...extractionFormState,
                  ...chatMemoriesFlags(event.target.value as LtmChatMemoriesMode),
                })
              }
            >
              {chatMemoriesModes.map((mode) => (
                <option key={mode} value={mode}>
                  {localizeUi(chatMemoriesLabelKey(mode))}
                </option>
              ))}
            </select>
            <p
              id={`${chatMemoriesLabelId}-hint`}
              data-ltm-field-hint
              className="text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
            >
              {localizeUi(chatMemoriesDescriptionKey(ltmChatMemoriesModeOf(extractionFormState)))}
            </p>
            <div className="pt-1">
              <ChatMemoriesSample mode={ltmChatMemoriesModeOf(extractionFormState)} compact />
            </div>
          </Field>
          {extractionFormState.autoImportChatSources ? (
            <NumberField
              liveCommit
              label={localizeUi("ui.longTermMemory.memorysettings.autoImportLeaveMessages")}
              hint={localizeUi("ui.longTermMemory.memorysettings.autoImportLeaveMessagesHint")}
              value={extractionFormState.autoImportLeaveMessages}
              integer
              min={0}
              max={LTM_HIDE_TAIL_MESSAGES_MAX}
              unit={localizeUi("ui.longTermMemory.memorysettings.hideTailMessagesUnit")}
              onChange={(value) => setExtractionFormState({ ...extractionFormState, autoImportLeaveMessages: value })}
            />
          ) : null}
          <Toggle
            label={localizeUi("ui.longTermMemory.memorysettings.hideImportedMessages")}
            hint={localizeUi(
              global.data?.hideImportedMessagesAvailable === false
                ? "ui.longTermMemory.memorysettings.hideImportedMessagesUnavailable"
                : globalForm.longTermMemoryHideImportedMessages
                  ? "ui.longTermMemory.memorysettings.hideImportedMessagesOnHint"
                  : "ui.longTermMemory.memorysettings.hideImportedMessagesOffHint",
            )}
            checked={globalForm.longTermMemoryHideImportedMessages}
            disabled={global.data?.hideImportedMessagesAvailable === false}
            onChange={(value) => setGlobalForm({ ...globalForm, longTermMemoryHideImportedMessages: value })}
          />
          {globalForm.longTermMemoryHideImportedMessages && global.data?.hideImportedMessagesAvailable !== false ? (
            <NumberField
              liveCommit
              label={localizeUi("ui.longTermMemory.memorysettings.hideTailMessages")}
              hint={localizeUi("ui.longTermMemory.memorysettings.hideTailMessagesHint")}
              value={globalForm.longTermMemoryHideTailMessages}
              integer
              min={0}
              max={LTM_HIDE_TAIL_MESSAGES_MAX}
              unit={localizeUi("ui.longTermMemory.memorysettings.hideTailMessagesUnit")}
              onChange={(value) => setGlobalForm({ ...globalForm, longTermMemoryHideTailMessages: value })}
            />
          ) : null}
        </div>
        <div role="group" aria-labelledby={`${recallGroupId}-model`} data-ltm-settings-section className="space-y-3">
          <h4 id={`${recallGroupId}-model`} data-ltm-group-heading className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.extractionModelGroup")}
          </h4>
          <div data-ltm-extraction-grid>
            <Field
              wide
              data-ltm-connection-field
              labelId={extractionConnectionLabelId}
              label={localizeUi("ui.longTermMemory.memorysettings.extractionConnection")}
            >
              <select
                ref={connectionSelectRef}
                aria-labelledby={extractionConnectionLabelId}
                className={inputClass}
                value={extractionFormState.connectionId ?? ""}
                onChange={(event) =>
                  setExtractionFormState({
                    ...extractionFormState,
                    connectionId: event.target.value || null,
                  })
                }
              >
                <option value="">
                  {defaultAgentConnection
                    ? localizeUi("ui.longTermMemory.memorysettings.automaticNamed", {
                        connection: connectionLabel(defaultAgentConnection),
                      })
                    : localizeUi("ui.longTermMemory.sourcesworkspace.automatic")}
                </option>
                {connections.data &&
                extractionFormState.connectionId &&
                !availableConnections.some((connection) => connection.id === extractionFormState.connectionId) ? (
                  <option value={extractionFormState.connectionId}>
                    {localizeUi("ui.longTermMemory.memorysettings.unavailableSavedConnection")}
                  </option>
                ) : null}
                {availableConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connectionLabel(connection)}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2">
                <WhatModelButton />
              </div>
              {extractionFormState.autoImportChatSources &&
              !extractionFormState.connectionId &&
              autoImportNeedsConnection(autoImportEvents.data?.events ?? []) ? (
                <StatusSurface tone="warning" compact data-ltm-connection-warning>
                  <span className="min-w-0 flex-1">
                    {localizeUi("ui.longTermMemory.memorysettings.autoImportNeedsConnection")}
                  </span>
                  <Button onClick={() => connectionSelectRef.current?.focus()}>
                    {localizeUi("ui.longTermMemory.memorysettings.autoImportChooseConnection")}
                  </Button>
                </StatusSurface>
              ) : null}
              {connections.isError ? (
                <StatusSurface tone="danger">
                  {localizeUi("ui.longTermMemory.memorysettings.couldNotLoadLanguageConnections")}{" "}
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center underline"
                    onClick={() => void connections.refetch()}
                  >
                    {localizeUi("ui.longTermMemory.activityview.retry")}
                  </button>
                </StatusSurface>
              ) : null}
            </Field>
            <Toggle
              label={localizeUi("ui.longTermMemory.memorysettings.aiKeywordExtraction")}
              hint={localizeUi("ui.longTermMemory.memorysettings.aiKeywordExtractionHint")}
              checked={extractionFormState.aiKeywordExtraction}
              onChange={(value) =>
                setExtractionFormState({
                  ...extractionFormState,
                  aiKeywordExtraction: value,
                })
              }
            />
            <Toggle
              label={localizeUi("ui.longTermMemory.memorysettings.useExtractionAgentOnGameMode")}
              hint={localizeUi("ui.longTermMemory.memorysettings.gameModeHint")}
              checked={extractionFormState.useExtractionAgentOnGameMode}
              onChange={(value) =>
                setExtractionFormState({
                  ...extractionFormState,
                  useExtractionAgentOnGameMode: value,
                })
              }
            />
          </div>
        </div>
        <ExtractionPromptTemplates
          value={extractionFormState}
          onChange={setExtractionFormState}
          confirmAction={(title, text, label) => confirm(props, title, text, label, true)}
        />
        <details data-ltm-extraction-advanced data-ltm-disclosure className="space-y-3">
          <DisclosureSummary className="text-xs">
            {localizeUi("ui.longTermMemory.memorysettings.modelTuning")}
          </DisclosureSummary>
          <div data-ltm-extraction-grid>
            <Field
              labelId={reasoningEffortLabelId}
              label={localizeUi("ui.longTermMemory.memorysettings.reasoningEffort")}
              hint={localizeUi("ui.longTermMemory.memorysettings.reasoningEffortHint")}
            >
              <select
                aria-labelledby={reasoningEffortLabelId}
                aria-describedby={`${reasoningEffortLabelId}-hint`}
                className={inputClass}
                value={extractionFormState.reasoningEffort}
                onChange={(event) =>
                  setExtractionFormState({
                    ...extractionFormState,
                    reasoningEffort: event.target.value as ExtractionForm["reasoningEffort"],
                  })
                }
              >
                <option value="none">{localizeUi("ui.longTermMemory.memorysettings.off")}</option>
                <option value="low">{localizeUi("ui.longTermMemory.memorysettings.low")}</option>
                <option value="medium">{localizeUi("ui.longTermMemory.memorysettings.medium")}</option>
                <option value="high">{localizeUi("ui.longTermMemory.memorysettings.high")}</option>
              </select>
            </Field>
            <Field labelId={verbosityLabelId} label={localizeUi("ui.longTermMemory.memorysettings.verbosity")}>
              <select
                aria-labelledby={verbosityLabelId}
                className={inputClass}
                value={extractionFormState.verbosity}
                onChange={(event) =>
                  setExtractionFormState({
                    ...extractionFormState,
                    verbosity: event.target.value as ExtractionForm["verbosity"],
                  })
                }
              >
                <option value="none">{localizeUi("ui.longTermMemory.memorysettings.off")}</option>
                <option value="low">{localizeUi("ui.longTermMemory.memorysettings.low")}</option>
                <option value="medium">{localizeUi("ui.longTermMemory.memorysettings.medium")}</option>
                <option value="high">{localizeUi("ui.longTermMemory.memorysettings.high")}</option>
              </select>
            </Field>
            <NumberField
              liveCommit
              label={localizeUi("ui.longTermMemory.memorysettings.maximumOutputTokens")}
              hint={localizeUi("ui.longTermMemory.memorysettings.maxOutputHint")}
              value={extractionFormState.maxOutputTokens}
              integer
              min={512}
              max={32768}
              step={256}
              onChange={(value) =>
                setExtractionFormState({
                  ...extractionFormState,
                  maxOutputTokens: value,
                })
              }
            />
            <NumberField
              liveCommit
              label={localizeUi("ui.longTermMemory.memorysettings.temperature")}
              hint={localizeUi("ui.longTermMemory.memorysettings.temperatureHint")}
              value={extractionFormState.temperature}
              min={0}
              max={2}
              step={0.1}
              onChange={(value) =>
                setExtractionFormState({
                  ...extractionFormState,
                  temperature: value,
                })
              }
            />
            <NumberField
              liveCommit
              label={localizeUi("ui.longTermMemory.memorysettings.maximumSourceTokens")}
              hint={localizeUi("ui.longTermMemory.memorysettings.maxSourceHint")}
              value={extractionFormState.maxSourceTokens}
              integer
              min={128}
              max={65536}
              step={128}
              onChange={(value) =>
                setExtractionFormState({
                  ...extractionFormState,
                  maxSourceTokens: value,
                })
              }
            />
            <Toggle
              label={localizeUi("ui.longTermMemory.memorysettings.finishCutOffAnswers")}
              hint={localizeUi("ui.longTermMemory.memorysettings.finishCutOffHint")}
              checked={extractionFormState.finishCutOffAnswers}
              onChange={(value) =>
                setExtractionFormState({
                  ...extractionFormState,
                  finishCutOffAnswers: value,
                })
              }
            />
          </div>
        </details>
      </section>

      {troubleshootingPanel(false)}
    </section>
  );
}
