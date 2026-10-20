import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LtmExtractionSettingsPatch,
  LtmGlobalSettings,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { LTM_RECALL_STYLE_WEIGHTS } from "../../../../../shared/src/features/agents/long-term-memory/constants.js";
import { LTM_RECALL_SCORE_THRESHOLD_CEILING } from "../../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request, requestHost, settingsQueryOptions } from "../api";
import { Button, InfoPopover, NumberField, StatusSurface, inputClass } from "../shared-controls";
import { nextTabIndex } from "../tab-keys";
import type { LongTermMemoryDestinationProps } from "../types";
import ActivityView from "./ActivityView";
import { ExtractionPromptTemplates } from "./ExtractionPromptTemplates";
import { MaintenancePanel } from "./MaintenancePanel";
import { confirm, Toggle, type SettingsRebuildOutcome } from "./settings-shared";
import { useLtmTranslation } from "../localization";
import { recallStyleDescriptionKey } from "../recall-style";

type GlobalForm = {
  version: 1;
  longTermMemoryBudgetTokens: number;
  longTermMemoryMaxChunks: number;
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
  longTermMemoryDebug: boolean;
  sourcesAvailabilityModes?: ("conversation" | "roleplay" | "game")[];
};
type ExtractionForm = Required<LtmExtractionSettingsPatch> & {
  systemPrompt?: string;
  activePromptTemplateId?: string | null;
};
type LanguageConnection = {
  id: string;
  name: string;
  provider: string;
  model: string;
};
type SettingsTab = "recall" | "extraction" | "maintenance" | "debug";

const settingsTabs: Array<{ id: SettingsTab; labelKey: string }> = [
  {
    id: "recall",
    labelKey: "ui.longTermMemory.memorysettings.recall",
  },
  {
    id: "extraction",
    labelKey: "ui.longTermMemory.memorysettings.extraction",
  },
  {
    id: "maintenance",
    labelKey: "ui.longTermMemory.memorysettings.maintenance",
  },
  {
    id: "debug",
    labelKey: "ui.longTermMemory.memorysettings.debug",
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
    longTermMemoryBudgetTokens: settings.longTermMemoryBudgetTokens ?? 4096,
    longTermMemoryMaxChunks: settings.longTermMemoryMaxChunks ?? 20,
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
    longTermMemoryDebug: settings.longTermMemoryDebug ?? false,
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

function globalPayload(form: GlobalForm) {
  const { longTermMemoryStopWordsText, ...settings } = form;
  return { ...settings, longTermMemoryStopWords: stopWordsFromText(longTermMemoryStopWordsText) };
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
    existingNoteMaxChunks: resolved.existingNoteMaxChunks ?? 20,
    existingNoteMaxTokens: resolved.existingNoteMaxTokens ?? 4000,
    promptTemplates: resolved.promptTemplates ?? [],
    activePromptTemplateIdsByMode: resolved.activePromptTemplateIdsByMode ?? {},
    aiKeywordExtraction: resolved.aiKeywordExtraction ?? false,
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
  return settings;
}

export default function MemorySettings({
  props,
  onDirtyChange,
  onOpenMemory,
  onOpenReview,
  openActivityRequest,
  openActivityMemoryId,
  onOpenActivityHandled,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi } = useLtmTranslation();
  const memorySettingsTitleId = useId();
  const recallStyleLabelId = useId();
  const recallPreambleLabelId = useId();
  const memoryStopWordsLabelId = useId();
  const reasoningEffortLabelId = useId();
  const verbosityLabelId = useId();
  const extractionConnectionLabelId = useId();
  const queryClient = useQueryClient();
  const global = useQuery(settingsQueryOptions);
  const extraction = useQuery({
    queryKey: queryKeys.extractionSettings,
    queryFn: () => request<LtmExtractionSettingsPatch>("/extraction-settings"),
  });
  const connections = useQuery({
    queryKey: ["long-term-memory", "language-connections"],
    queryFn: () => requestHost<LanguageConnection[]>("/api/connections"),
  });
  const availableConnections = (connections.data ?? []).filter(
    (connection) => connection.provider !== "image_generation" && connection.provider !== "video_generation",
  );
  const [globalForm, setGlobalForm] = useState<GlobalForm | null>(null);
  const [savedGlobal, setSavedGlobal] = useState<GlobalForm | null>(null);
  const [extractionFormState, setExtractionFormState] = useState<ExtractionForm | null>(null);
  const [savedExtraction, setSavedExtraction] = useState<ExtractionForm | null>(null);
  // Reset and backup import clear the forms, which then refill only from settings fetched since
  // the action started, so a failed reload shows the error surface instead of the cached settings.
  const [refillSince, setRefillSince] = useState(0);
  const [pending, setPending] = useState("");
  const [messageState, setMessageState] = useState<{
    text: string;
    tone: "success" | "danger";
    // Which StatusSurface owns the message: the Debug panel shows only its own save
    // feedback, while every other tab uses the shared surface. Maintenance results
    // stay in MaintenancePanel.
    surface: "shared" | "debug";
  }>({ text: "", tone: "success", surface: "shared" });
  const message = messageState.text;
  const setMessage = (text: string, tone: "success" | "danger" = "success", surface: "shared" | "debug" = "shared") =>
    setMessageState({ text, tone, surface });
  const [activeTab, setActiveTab] = useState<SettingsTab>("recall");
  // Capture the Vault memory link's target before the handoff request is reset, so the
  // Debug tab can open filtered to that memory without a stale filter on later entries.
  const [debugMemoryId, setDebugMemoryId] = useState<string | null>(null);
  useEffect(() => {
    if (!openActivityRequest) return;
    setDebugMemoryId(openActivityMemoryId ?? null);
    setActiveTab("debug");
    onOpenActivityHandled?.();
  }, [onOpenActivityHandled, openActivityRequest, openActivityMemoryId]);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  // Starting a maintenance action clears the shared message, as every action did before.
  useEffect(() => {
    if (maintenanceBusy) setMessage("");
  }, [maintenanceBusy]);

  useEffect(() => {
    if (!global.data || globalForm || global.dataUpdatedAt < refillSince) return;
    const next = settingsForm(global.data);
    setGlobalForm(next);
    setSavedGlobal(next);
  }, [global.data, global.dataUpdatedAt, globalForm, refillSince]);
  useEffect(() => {
    if (!extraction.data || extractionFormState || extraction.dataUpdatedAt < refillSince) return;
    const next = extractionForm(extraction.data);
    setExtractionFormState(next);
    setSavedExtraction(next);
  }, [extraction.data, extraction.dataUpdatedAt, extractionFormState, refillSince]);

  const globalDirty = Boolean(globalForm && savedGlobal && !same(globalForm, savedGlobal));
  const extractionDirty = Boolean(
    extractionFormState && savedExtraction && !same(extractionFormState, savedExtraction),
  );
  const dirty = globalDirty || extractionDirty;
  // D05: a toggle-local cue for the one setting the Debug panel owns. It reuses the
  // existing save flow and leave guard rather than adding a second persistence path.
  const debugDirty = Boolean(
    globalForm && savedGlobal && globalForm.longTermMemoryDebug !== savedGlobal.longTermMemoryDebug,
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const saveSettings = async () => {
    if (!globalDirty && !extractionDirty) return;
    // Keep the Debug panel's surface for saves started there; every other save shows in
    // the shared surface (D05).
    const surface: "shared" | "debug" = activeTab === "debug" ? "debug" : "shared";
    setPending("global");
    setMessage("");
    let rebuild: SettingsRebuildOutcome | null = null;
    try {
      if (globalDirty && globalForm) {
        const submitted = globalForm;
        const response = await request<LtmGlobalSettings & { rebuild?: SettingsRebuildOutcome | null }>(
          "/settings",
          "PUT",
          globalPayload(submitted),
        );
        const saved = settingsForm(response);
        setSavedGlobal(saved);
        // Saving now awaits an index rebuild, so only clear the form when no newer edit
        // arrived while it was in flight; otherwise those edits stay dirty.
        setGlobalForm((current) => (current && same(current, submitted) ? saved : current));
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
        setMessage(
          localizeUi("ui.longTermMemory.memorysettings.memorySettingsSavedIndexRebuildFailed", {
            error: rebuild.error ?? "",
          }),
          "danger",
          surface,
        );
      } else if (rebuild?.status === "complete") {
        setMessage(localizeUi("ui.longTermMemory.memorysettings.memorySettingsSavedIndexRebuilt"), "success", surface);
      } else {
        setMessage(localizeUi("ui.longTermMemory.memorysettings.memorySettingsSaved"), "success", surface);
      }
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotSaveMemorySettings")),
        "danger",
        surface,
      );
    } finally {
      setPending("");
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
      if (savedGlobal) setGlobalForm(savedGlobal);
      if (savedExtraction) setExtractionFormState(savedExtraction);
    }
  };

  const settingsChannel = {
    clear: (since: number) => {
      setRefillSince(since);
      setGlobalForm(null);
      setSavedGlobal(null);
      setExtractionFormState(null);
      setSavedExtraction(null);
    },
    apply: (nextGlobalSettings: LtmGlobalSettings, nextExtractionSettings: LtmExtractionSettingsPatch) => {
      const nextGlobal = settingsForm(nextGlobalSettings);
      setGlobalForm(nextGlobal);
      setSavedGlobal(nextGlobal);
      const nextExtraction = extractionForm(nextExtractionSettings);
      setExtractionFormState(nextExtraction);
      setSavedExtraction(nextExtraction);
    },
  };
  // Reset and backup import reload the forms, which shows the loading or error surface.
  // Every return keeps a <section> root and this keyed panel, so React keeps the panel
  // mounted and its running action keeps its busy state and result message.
  const maintenancePanel = (hidden: boolean) => (
    <MaintenancePanel
      key="maintenance"
      props={props}
      hidden={hidden}
      disabled={pending !== ""}
      settings={settingsChannel}
      onBusyChange={setMaintenanceBusy}
    />
  );
  const loadScreen = (surface: ReactNode) => (
    <section>
      {surface}
      {maintenancePanel(true)}
    </section>
  );

  if (global.isError || extraction.isError)
    return loadScreen(
      <StatusSurface tone="danger">
        {localizeUi("ui.longTermMemory.memorysettings.couldNotLoadMemorySettings")}{" "}
        <button
          type="button"
          className="underline"
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
        [data-ltm-extraction-grid] {
          display: grid;
          gap: 0.5rem;
        }
        [data-ltm-extraction-grid] > div > :first-child {
          display: flex;
          min-height: 2.75rem;
          align-items: center;
        }
        [data-ltm-extraction-grid] .mari-editor-field {
          min-height: 2.75rem;
          width: 100%;
          padding-inline: 0.75rem;
          font-size: 0.875rem;
        }
        @container ltm-memory-settings (min-width: 40rem) {
          [data-ltm-extraction-grid] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          [data-ltm-prompt-template-grid] {
            grid-template-columns: 12rem minmax(0, 1fr);
          }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={memorySettingsTitleId} className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.memorySettings")}
          </h2>
        </div>
        {dirty ? (
          <div className="flex flex-wrap gap-2">
            <Button primary disabled={busy} onClick={() => void saveSettings()}>
              {localizeUi("ui.longTermMemory.memorysettings.saveSettings")}
            </Button>
            <Button destructive disabled={busy} onClick={() => void discard()}>
              {localizeUi("ui.longTermMemory.memorysettings.discardChanges")}
            </Button>
          </div>
        ) : null}
      </div>
      <StatusSurface>
        {localizeUi("ui.longTermMemory.memorysettings.mostUsersCanKeepTheRecommendedDefaultsChangeThese")}
      </StatusSurface>
      <div
        role="tablist"
        aria-label={localizeUi("ui.longTermMemory.memorysettings.memorySettingsSections")}
        className="mari-editor-tab-rail grid grid-cols-2 gap-1 rounded-lg border p-1 sm:grid-cols-4"
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
            className="mari-editor-tab min-h-10 rounded-md px-2 text-xs font-semibold transition-colors"
          >
            {localizeUi(tab.labelKey)}
          </button>
        ))}
      </div>
      {/* The Debug panel renders its own message beside the toggle, so the shared
          surface yields there instead of showing the same save feedback twice. */}
      {message && activeTab !== "debug" ? <StatusSurface tone={messageState.tone}>{message}</StatusSurface> : null}

      <section
        id="settings-panel-recall"
        role="tabpanel"
        aria-labelledby="settings-tab-recall"
        hidden={activeTab !== "recall"}
        className="mari-editor-panel space-y-3 p-3"
      >
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold">{localizeUi("ui.longTermMemory.memorysettings.globalRecall")}</h3>
          <InfoPopover
            label={localizeUi("ui.longTermMemory.memorysettings.globalRecall")}
            content={localizeUi("ui.longTermMemory.memorysettings.defaultsUsedByEveryChatUnlessThatChatOverrides")}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label={localizeUi("ui.longTermMemory.memorysettings.includeResolvedMemories")}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.allowsResolvedMemoriesToParticipateInRecallArchivedMemories",
            )}
            checked={globalForm.longTermMemoryIncludeResolved}
            onChange={(value) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryIncludeResolved: value,
              })
            }
          />
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span id={recallStyleLabelId} className="flex items-center gap-1">
              {localizeUi("ui.longTermMemory.chatsettings.recallStyle")}
              <InfoPopover
                label={localizeUi("ui.longTermMemory.chatsettings.recallStyle")}
                content={localizeUi(recallStyleDescriptionKey(globalForm.longTermMemoryRecallStyle))}
              />
            </span>
            <select
              aria-labelledby={recallStyleLabelId}
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
          </div>
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.recallBudgetTokens")}
            help={localizeUi("ui.longTermMemory.memorysettings.maximumTokenBudgetAvailableForMemoriesAddedToA")}
            value={globalForm.longTermMemoryBudgetTokens}
            min={128}
            max={16384}
            step={128}
            onChange={(value) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryBudgetTokens: value,
              })
            }
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.maximumRecalledMemories")}
            help={localizeUi("ui.longTermMemory.memorysettings.maximumNumberOfMemoriesThatMayBeIncludedIn")}
            value={globalForm.longTermMemoryMaxChunks}
            min={1}
            max={100}
            onChange={(value) => setGlobalForm({ ...globalForm, longTermMemoryMaxChunks: value })}
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.scoreThreshold")}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.excludesCandidatesWhoseCombinedRetrievalScoreFallsBelowThis",
            )}
            value={globalForm.longTermMemoryScoreThreshold}
            min={0}
            max={LTM_RECALL_SCORE_THRESHOLD_CEILING}
            step={0.01}
            onChange={(value) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryScoreThreshold: value,
              })
            }
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.recentMessagesForRecall")}
            help={localizeUi("ui.longTermMemory.memorysettings.numberOfRecentChatMessagesUsedToBuildThe")}
            value={globalForm.longTermMemoryRecallContextMessages}
            min={1}
            max={20}
            onChange={(value) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryRecallContextMessages: value,
              })
            }
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.meaningMatch")}
            help={localizeUi("ui.longTermMemory.memorysettings.weightGivenToSemanticSimilarityBetweenTheCurrentChat")}
            value={globalForm.longTermMemorySemanticWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemorySemanticWeight", value))}
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.exactWordsMatch")}
            help={localizeUi("ui.longTermMemory.memorysettings.weightGivenToMatchingWordsAndPhrases")}
            value={globalForm.longTermMemoryLexicalWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemoryLexicalWeight", value))}
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.graphWeight")}
            help={localizeUi("ui.longTermMemory.memorysettings.weightGivenToRelationshipsBetweenLinkedMemories")}
            value={globalForm.longTermMemoryGraphWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemoryGraphWeight", value))}
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.keywordWeight")}
            help={localizeUi("ui.longTermMemory.memorysettings.weightGivenToMatchingStoredKeywords")}
            value={globalForm.longTermMemoryKeywordWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => setGlobalForm(applyCustomWeight(globalForm, "longTermMemoryKeywordWeight", value))}
          />
        </div>
        <div className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span id={recallPreambleLabelId} className="flex items-center gap-1">
            {localizeUi("ui.longTermMemory.memorysettings.memoryContextInstructions")}
            <InfoPopover
              label={localizeUi("ui.longTermMemory.memorysettings.memoryContextInstructions")}
              content={localizeUi(
                "ui.longTermMemory.memorysettings.instructionsPlacedBeforeRecalledMemoryContextWhenItIs",
              )}
            />
          </span>
          <textarea
            aria-labelledby={recallPreambleLabelId}
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
        </div>
        <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span id={memoryStopWordsLabelId} className="flex items-center gap-1">
            {localizeUi("ui.longTermMemory.memorysettings.memoryStopWords")}
            <InfoPopover
              label={localizeUi("ui.longTermMemory.memorysettings.memoryStopWords")}
              content={localizeUi("ui.longTermMemory.memorysettings.wordsIgnoredDuringKeywordMatchingOnePerLine")}
            />
          </span>
          <textarea
            aria-labelledby={memoryStopWordsLabelId}
            className={`${inputClass} min-h-20 py-2`}
            spellCheck={false}
            value={globalForm.longTermMemoryStopWordsText}
            onChange={(event) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryStopWordsText: event.target.value,
              })
            }
          />
        </div>
        <Toggle
          label={localizeUi("ui.longTermMemory.memorysettings.blockStopWordsInGeneratedKeywords")}
          help={localizeUi(
            "ui.longTermMemory.memorysettings.preventsListedWordsFromBecomingGeneratedKeywordsWhileStill",
          )}
          checked={globalForm.longTermMemoryStopWordsFilterGenerated}
          onChange={(value) =>
            setGlobalForm({
              ...globalForm,
              longTermMemoryStopWordsFilterGenerated: value,
            })
          }
        />
      </section>

      <section
        id="settings-panel-extraction"
        role="tabpanel"
        aria-labelledby="settings-tab-extraction"
        hidden={activeTab !== "extraction"}
        className="mari-editor-panel space-y-3 p-3"
      >
        <div>
          <h3 className="text-sm font-semibold">{localizeUi("ui.longTermMemory.memorysettings.extraction")}</h3>
        </div>
        <div data-ltm-extraction-grid>
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span id={extractionConnectionLabelId} className="flex min-h-11 items-center">
              {localizeUi("ui.longTermMemory.memorysettings.extractionConnection")}
            </span>
            <select
              aria-labelledby={extractionConnectionLabelId}
              aria-describedby={`${extractionConnectionLabelId}-hint`}
              className={inputClass}
              value={extractionFormState.connectionId ?? ""}
              onChange={(event) =>
                setExtractionFormState({
                  ...extractionFormState,
                  connectionId: event.target.value || null,
                })
              }
            >
              <option value="">{localizeUi("ui.longTermMemory.sourcesworkspace.automatic")}</option>
              {connections.data &&
              extractionFormState.connectionId &&
              !availableConnections.some((connection) => connection.id === extractionFormState.connectionId) ? (
                <option value={extractionFormState.connectionId}>
                  {localizeUi("ui.longTermMemory.memorysettings.unavailableSavedConnection")}
                </option>
              ) : null}
              {availableConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name || connection.provider}
                  {connection.model ? ` - ${connection.model}` : ""}
                </option>
              ))}
            </select>
            <p id={`${extractionConnectionLabelId}-hint`} className="text-[0.6875rem] font-normal">
              {localizeUi("ui.longTermMemory.memorysettings.extractionConnectionHint")}
            </p>
            {connections.isError ? (
              <StatusSurface tone="danger">
                {localizeUi("ui.longTermMemory.memorysettings.couldNotLoadLanguageConnections")}{" "}
                <button type="button" className="underline" onClick={() => void connections.refetch()}>
                  {localizeUi("ui.longTermMemory.activityview.retry")}
                </button>
              </StatusSurface>
            ) : null}
          </div>
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span id={reasoningEffortLabelId} className="flex items-center gap-1">
              {localizeUi("ui.longTermMemory.memorysettings.reasoningEffort")}
              <InfoPopover
                label={localizeUi("ui.longTermMemory.memorysettings.reasoningEffort")}
                content={localizeUi(
                  "ui.longTermMemory.memorysettings.requestsThisAmountOfModelReasoningDuringExtractionUnsupported",
                )}
              />
            </span>
            <select
              aria-labelledby={reasoningEffortLabelId}
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
          </div>
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span id={verbosityLabelId} className="flex items-center gap-1">
              {localizeUi("ui.longTermMemory.memorysettings.verbosity")}
              <InfoPopover
                label={localizeUi("ui.longTermMemory.memorysettings.verbosity")}
                content={localizeUi(
                  "ui.longTermMemory.memorysettings.requestsTheSelectedResponseDetailLevelFromTheExtraction",
                )}
              />
            </span>
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
          </div>
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.maximumOutputTokens")}
            help={localizeUi("ui.longTermMemory.memorysettings.maximumTokensTheModelMayProduceForOneExtraction")}
            value={extractionFormState.maxOutputTokens}
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
            label={localizeUi("ui.longTermMemory.memorysettings.temperature")}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.controlsExtractionVariabilityLowerValuesAreMoreDeterministicHigher",
            )}
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
            label={localizeUi("ui.longTermMemory.memorysettings.maximumSourceTokens")}
            help={localizeUi("ui.longTermMemory.memorysettings.rejectsASourceWhenItsEstimatedSizeExceedsThis")}
            value={extractionFormState.maxSourceTokens}
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
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.existingNoteChunks")}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.maximumNumberOfExistingMemoryChunksConsideredWhileChecking",
            )}
            value={extractionFormState.existingNoteMaxChunks}
            min={1}
            max={100}
            onChange={(value) =>
              setExtractionFormState({
                ...extractionFormState,
                existingNoteMaxChunks: value,
              })
            }
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.existingNoteTokenBudget")}
            help={localizeUi("ui.longTermMemory.memorysettings.maximumTokensFromThoseExistingChunksIncludedInThe")}
            value={extractionFormState.existingNoteMaxTokens}
            min={128}
            max={32768}
            step={128}
            onChange={(value) =>
              setExtractionFormState({
                ...extractionFormState,
                existingNoteMaxTokens: value,
              })
            }
          />
          <Toggle
            label={localizeUi("ui.longTermMemory.memorysettings.aiKeywordExtraction")}
            help={localizeUi("ui.longTermMemory.memorysettings.asksTheModelToGenerateConciseKeywordsForExtracted")}
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
            help={localizeUi("ui.longTermMemory.memorysettings.routesGameModeImportsThroughTheExtractionAgentInstead")}
            checked={extractionFormState.useExtractionAgentOnGameMode}
            onChange={(value) =>
              setExtractionFormState({
                ...extractionFormState,
                useExtractionAgentOnGameMode: value,
              })
            }
          />
        </div>
        <ExtractionPromptTemplates
          value={extractionFormState}
          onChange={setExtractionFormState}
          confirmAction={(title, text, label) => confirm(props, title, text, label, true)}
        />
      </section>

      {maintenancePanel(activeTab !== "maintenance")}
      <section
        id="settings-panel-debug"
        role="tabpanel"
        aria-labelledby="settings-tab-debug"
        hidden={activeTab !== "debug"}
        className="space-y-3 p-3"
      >
        <Toggle
          label={localizeUi("ui.longTermMemory.memorysettings.recordDebugActivity")}
          help={localizeUi(
            "ui.longTermMemory.memorysettings.recordsLongTermMemoryOperationsForTroubleshootingActivityMay",
          )}
          checked={globalForm.longTermMemoryDebug}
          onChange={(value) => setGlobalForm({ ...globalForm, longTermMemoryDebug: value })}
        />
        {debugDirty ? (
          <div className="flex flex-wrap items-center gap-2" data-ltm-debug-dirty>
            <span className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memorysettings.unsavedDebugChange")}
            </span>
            <Button primary disabled={busy} onClick={() => void saveSettings()}>
              {localizeUi("ui.longTermMemory.memorysettings.saveDebugChange")}
            </Button>
          </div>
        ) : null}
        {message && messageState.surface === "debug" ? (
          <StatusSurface tone={messageState.tone}>{message}</StatusSurface>
        ) : null}
        {activeTab === "debug" ? (
          <ActivityView
            props={props}
            onOpenMemory={onOpenMemory}
            onOpenReview={onOpenReview}
            openActivityMemoryId={debugMemoryId}
            onOpenActivityMemoryIdHandled={() => setDebugMemoryId(null)}
          />
        ) : null}
      </section>
    </section>
  );
}
