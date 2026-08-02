import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import type {
  LtmExtractionSettingsPatch,
  LtmGlobalSettings,
  LtmIdentityRepairPreviewResponse,
  LtmIntegrityResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { LTM_RECALL_STYLE_WEIGHTS } from "../../../../shared/src/features/agents/long-term-memory/constants.js";
import { invalidateLtmQueries, queryKeys, request, requestHost, requestRaw } from "./api";
import {
  Button,
  InfoPopover,
  NumberField,
  StatusSurface,
  inputClass,
} from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";
import ActivityView from "./ActivityView";
import { ExtractionPromptTemplates } from "./ExtractionPromptTemplates";
import { useLtmTranslation } from "./localization";

type GlobalForm = {
  version: 1;
  longTermMemoryBudgetTokens: number;
  longTermMemoryMaxChunks: number;
  longTermMemoryScoreThreshold: number;
  longTermMemoryRecallContextMessages: number;
  longTermMemoryRecallStyle:
    | "balanced"
    | "exact"
    | "broad"
    | "story"
    | "custom";
  longTermMemorySemanticWeight: number;
  longTermMemoryLexicalWeight: number;
  longTermMemoryGraphWeight: number;
  longTermMemoryKeywordWeight: number;
  longTermMemoryIncludeResolved: boolean;
  longTermMemoryRecallPreamble: string;
  longTermMemoryDebug: boolean;
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
type RepairAction =
  | "rebuild_indexes"
  | "quarantine_malformed_notes"
  | "backfill_imported_source_titles";
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

const repairActions: Array<{
  id: RepairAction;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "rebuild_indexes",
    labelKey: "ui.longTermMemory.memorysettings.reindexRecallData",
    descriptionKey:
      "ui.longTermMemory.memorysettings.rebuildRecallIndexFromSavedNotes",
  },
  {
    id: "quarantine_malformed_notes",
    labelKey: "ui.longTermMemory.memorysettings.quarantineMalformedNotes",
    descriptionKey:
      "ui.longTermMemory.memorysettings.moveInvalidStoredNotesOutOfActiveVault",
  },
  {
    id: "backfill_imported_source_titles",
    labelKey: "ui.longTermMemory.memorysettings.backfillSourceTitles",
    descriptionKey:
      "ui.longTermMemory.memorysettings.restoreMissingTitlesOnImportedSourceNotes",
  },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function confirm(
  props: LongTermMemoryDestinationProps["props"],
  title: string,
  message: string,
  confirmLabel: string,
  destructive = false,
) {
  if (props.confirmAction)
    return props.confirmAction({
      title,
      message,
      confirmLabel,
      tone: destructive ? "destructive" : "default",
    });
  return window.confirm(`${title}\n\n${message}`);
}

function settingsForm(settings: LtmGlobalSettings): GlobalForm {
  const recallStyle = settings.longTermMemoryRecallStyle ?? "balanced";
  const presetWeights =
    recallStyle === "custom"
      ? LTM_RECALL_STYLE_WEIGHTS.balanced
      : LTM_RECALL_STYLE_WEIGHTS[recallStyle];
  return {
    version: 1,
    longTermMemoryBudgetTokens: settings.longTermMemoryBudgetTokens ?? 4096,
    longTermMemoryMaxChunks: settings.longTermMemoryMaxChunks ?? 20,
    longTermMemoryScoreThreshold: settings.longTermMemoryScoreThreshold ?? 0,
    longTermMemoryRecallContextMessages:
      settings.longTermMemoryRecallContextMessages ?? 4,
    longTermMemoryRecallStyle: recallStyle,
    longTermMemorySemanticWeight:
      settings.longTermMemorySemanticWeight ?? presetWeights.semanticWeight,
    longTermMemoryLexicalWeight:
      settings.longTermMemoryLexicalWeight ?? presetWeights.lexicalWeight,
    longTermMemoryGraphWeight:
      settings.longTermMemoryGraphWeight ?? presetWeights.graphWeight,
    longTermMemoryKeywordWeight:
      settings.longTermMemoryKeywordWeight ?? presetWeights.keywordWeight,
    longTermMemoryIncludeResolved:
      settings.longTermMemoryIncludeResolved ?? false,
    longTermMemoryRecallPreamble: settings.longTermMemoryRecallPreamble ?? "",
    longTermMemoryDebug: settings.longTermMemoryDebug ?? false,
  };
}

function applyRecallStyle(
  form: GlobalForm,
  recallStyle: GlobalForm["longTermMemoryRecallStyle"],
): GlobalForm {
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
    reasoningEffort: resolved.reasoningEffort ?? "medium",
    verbosity: resolved.verbosity ?? "medium",
    maxOutputTokens: resolved.maxOutputTokens ?? 4096,
    temperature: resolved.temperature ?? 0.2,
    maxSourceTokens: resolved.maxSourceTokens ?? 16000,
    maxExistingNoteTokens: resolved.maxExistingNoteTokens ?? 8000,
    existingNoteMaxChunks: resolved.existingNoteMaxChunks ?? 20,
    existingNoteMaxTokens: resolved.existingNoteMaxTokens ?? 4000,
    promptTemplates: resolved.promptTemplates ?? [],
    activePromptTemplateIdsByMode: resolved.activePromptTemplateIdsByMode ?? {},
    aiKeywordExtraction: resolved.aiKeywordExtraction ?? false,
    useExtractionAgentOnGameMode:
      resolved.useExtractionAgentOnGameMode ?? false,
    ...(resolved.systemPrompt === undefined
      ? {}
      : { systemPrompt: resolved.systemPrompt }),
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

function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: ReactNode;
}) {
  const inputId = useId();
  return (
    <div className="flex min-h-11 items-end gap-2">
      <label
        htmlFor={inputId}
        className="mari-editor-panel mari-editor-panel--soft flex min-h-11 flex-1 cursor-pointer items-center gap-2 px-3 text-xs font-semibold text-[var(--foreground)]"
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {help ? <InfoPopover label={label} content={help} /> : null}
    </div>
  );
}

export default function MemorySettings({
  props,
  onDirtyChange,
  onOpenMemory,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const memorySettingsTitleId = useId();
  const recallStyleLabelId = useId();
  const recallPreambleLabelId = useId();
  const reasoningEffortLabelId = useId();
  const verbosityLabelId = useId();
  const extractionConnectionLabelId = useId();
  const queryClient = useQueryClient();
  const global = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => request<LtmGlobalSettings>("/settings"),
  });
  const extraction = useQuery({
    queryKey: queryKeys.extractionSettings,
    queryFn: () => request<LtmExtractionSettingsPatch>("/extraction-settings"),
  });
  const connections = useQuery({
    queryKey: ["long-term-memory", "language-connections"],
    queryFn: () => requestHost<LanguageConnection[]>("/api/connections"),
  });
  const availableConnections = (connections.data ?? []).filter(
    (connection) =>
      connection.provider !== "image_generation" &&
      connection.provider !== "video_generation",
  );
  const integrity = useQuery({
    queryKey: queryKeys.integrity,
    queryFn: () => request<LtmIntegrityResponse>("/integrity"),
  });
  const [globalForm, setGlobalForm] = useState<GlobalForm | null>(null);
  const [savedGlobal, setSavedGlobal] = useState<GlobalForm | null>(null);
  const [extractionFormState, setExtractionFormState] =
    useState<ExtractionForm | null>(null);
  const [savedExtraction, setSavedExtraction] = useState<ExtractionForm | null>(
    null,
  );
  const [pending, setPending] = useState("");
  const [messageState, setMessageState] = useState<{
    text: string;
    tone: "success" | "danger";
  }>({ text: "", tone: "success" });
  const message = messageState.text;
  const setMessage = (text: string, tone: "success" | "danger" = "success") =>
    setMessageState({ text, tone });
  const [activeTab, setActiveTab] = useState<SettingsTab>("recall");
  const [selectedActions, setSelectedActions] = useState<RepairAction[]>([]);
  const [identityPreview, setIdentityPreview] =
    useState<LtmIdentityRepairPreviewResponse | null>(null);
  const [selectedIdentityCandidates, setSelectedIdentityCandidates] = useState<
    string[]
  >([]);
  const [identitySectionChoices, setIdentitySectionChoices] = useState<
    Record<string, Record<string, string>>
  >({});
  const [includedIdentityNoteIds, setIncludedIdentityNoteIds] = useState<
    Record<string, string[]>
  >({});
  const [identityCanonicalNoteIds, setIdentityCanonicalNoteIds] = useState<
    Record<string, string>
  >({});
  const [backupPreview, setBackupPreview] = useState<{
    backup: unknown;
    incoming: { notes: number; drafts: number; rejectedSuggestions: number };
    current: { notes: number; drafts: number; rejectedSuggestions: number };
  } | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!global.data || globalForm) return;
    const next = settingsForm(global.data);
    setGlobalForm(next);
    setSavedGlobal(next);
  }, [global.data, globalForm]);
  useEffect(() => {
    if (!extraction.data || extractionFormState) return;
    const next = extractionForm(extraction.data);
    setExtractionFormState(next);
    setSavedExtraction(next);
  }, [extraction.data, extractionFormState]);

  const globalDirty = Boolean(
    globalForm && savedGlobal && !same(globalForm, savedGlobal),
  );
  const extractionDirty = Boolean(
    extractionFormState &&
    savedExtraction &&
    !same(extractionFormState, savedExtraction),
  );
  const dirty = globalDirty || extractionDirty;
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const saveSettings = async () => {
    if (!globalDirty && !extractionDirty) return;
    setPending("global");
    setMessage("");
    try {
      if (globalDirty && globalForm) {
        const saved = settingsForm(
          await request<LtmGlobalSettings>("/settings", "PUT", globalForm),
        );
        setGlobalForm(saved);
        setSavedGlobal(saved);
        await invalidateLtmQueries(queryClient, [
          queryKeys.settings,
          queryKeys.chatDefaults,
        ]);
      }
      if (extractionDirty && extractionFormState) {
        const saved = extractionForm(
          await request<LtmExtractionSettingsPatch>(
            "/extraction-settings",
            "PUT",
            extractionPayload(extractionFormState),
          ),
        );
        setExtractionFormState(saved);
        setSavedExtraction(saved);
        await invalidateLtmQueries(queryClient, [queryKeys.extractionSettings]);
      }
      setMessage(
        localizeUi("ui.longTermMemory.memorysettings.memorySettingsSaved"),
      );
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotSaveMemorySettings",
          ),
        ),
        "danger",
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
        localizeUi(
          "ui.longTermMemory.memorysettings.recallAndExtractionEditsWillBeLost",
        ),
        localizeUi("ui.longTermMemory.memorysettings.discard"),
        true,
      ))
    ) {
      if (savedGlobal) setGlobalForm(savedGlobal);
      if (savedExtraction) setExtractionFormState(savedExtraction);
    }
  };

  const runRepair = async () => {
    if (!selectedActions.length) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.runMaintenance"),
        localizeUi(
          "ui.longTermMemory.memorysettings.selectedMaintenanceMayRewriteData",
        ),
        localizeUi("ui.longTermMemory.memorysettings.runMaintenanceAction"),
        true,
      ))
    )
      return;
    setPending("repair");
    setMessage("");
    try {
      const result = await request<{
        actions: Array<{ action: string; result: string; count?: number }>;
      }>("/repair", "POST", { actions: selectedActions });
      setMessage(
        result.actions
          .map(
            (item) =>
              `${item.action}: ${item.result}${item.count != null ? ` (${item.count})` : ""}`,
          )
          .join(". "),
      );
      setSelectedActions([]);
      await invalidateLtmQueries(queryClient, [
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.notes,
        queryKeys.activity,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi("ui.longTermMemory.memorysettings.maintenanceFailed"),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const previewIdentities = async () => {
    setPending("identity-preview");
    setMessage("");
    try {
      const preview = await request<LtmIdentityRepairPreviewResponse>(
        "/identity-repair/preview",
        "POST",
        {},
      );
      setIdentityPreview(preview);
      setSelectedIdentityCandidates(
        preview.candidates
          .filter((candidate) => !candidate.blockingReasons.length)
          .map((candidate) => candidate.id),
      );
      setIdentitySectionChoices({});
      setIncludedIdentityNoteIds(
        Object.fromEntries(
          preview.candidates.map((candidate) => [
            candidate.id,
            candidate.duplicateNoteIds,
          ]),
        ),
      );
      setIdentityCanonicalNoteIds({});
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotPreviewIdentityRepairs",
          ),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const selectIdentityCanonical = async (
    candidateId: string,
    canonicalNoteId: string,
  ) => {
    if (!identityPreview) return;
    const canonicalNoteIds = {
      ...identityCanonicalNoteIds,
      [candidateId]: canonicalNoteId,
    };
    setPending(`identity-canonical-${candidateId}`);
    setMessage("");
    try {
      const preview = await request<LtmIdentityRepairPreviewResponse>(
        "/identity-repair/preview",
        "POST",
        { scope: identityPreview.scope, canonicalNoteIds },
      );
      setIdentityPreview(preview);
      setIdentityCanonicalNoteIds(canonicalNoteIds);
      setIdentitySectionChoices((current) => ({
        ...current,
        [candidateId]: {},
      }));
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotRefreshCanonicalPreview",
          ),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const applyIdentities = async () => {
    if (!identityPreview || !selectedIdentityCandidates.length) return;
    const preview = identityPreview;
    const selectedCandidateIds = [...selectedIdentityCandidates];
    const sectionChoices = structuredClone(identitySectionChoices);
    const includedNoteIds = structuredClone(includedIdentityNoteIds);
    const selected = preview.candidates.filter((candidate) =>
      selectedCandidateIds.includes(candidate.id),
    );
    const repairs = selected.flatMap((candidate) => {
      if (candidate.blockingReasons.length) return [];
      const included = new Set([
        candidate.canonicalNoteId,
        ...(includedNoteIds[candidate.id] ?? []),
      ]);
      const choices = sectionChoices[candidate.id] ?? {};
      const conflicts = candidate.supersedingConflicts.filter(
        (conflict) =>
          conflict.options.filter((option) =>
            option.noteIds.some((noteId) => included.has(noteId)),
          ).length > 1,
      );
      if (
        conflicts.some(
          (conflict) =>
            !conflict.options.some(
              (option) =>
                option.noteIds.includes(choices[conflict.sectionKey] ?? "") &&
                option.noteIds.some((noteId) => included.has(noteId)),
            ),
        )
      )
        return [];
      return [
        {
          candidateId: candidate.id,
          canonicalNoteId: candidate.canonicalNoteId,
          excludedNoteIds: candidate.duplicateNoteIds.filter(
            (noteId) => !included.has(noteId),
          ),
          sectionChoices: conflicts.map((conflict) => ({
            sectionKey: conflict.sectionKey,
            noteId: choices[conflict.sectionKey]!,
          })),
        },
      ];
    });
    if (repairs.length !== selected.length) return;
    const includedDuplicateCount = repairs.reduce(
      (count, repair) =>
        count +
        selected.find((candidate) => candidate.id === repair.candidateId)!
          .duplicateNoteIds.length -
        repair.excludedNoteIds.length,
      0,
    );
    if (includedDuplicateCount === 0) {
      setMessage(
        localizeUi(
          "ui.longTermMemory.memorysettings.includeDuplicateBeforeApplyingRepairs",
        ),
        "danger",
      );
      return;
    }
    setPending("identity-confirm");
    setMessage("");
    let confirmed = false;
    try {
      confirmed = await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.applyIdentityRepairs"),
        localizeUi(
          "ui.longTermMemory.memorysettings.applyIdentityRepairsDescription",
          {
            repairCount: repairs.length,
            repairSuffix: repairs.length === 1 ? "" : "s",
            duplicateCount: includedDuplicateCount,
            duplicateSuffix: includedDuplicateCount === 1 ? "" : "s",
          },
        ),
        localizeUi(
          "ui.longTermMemory.memorysettings.applyIdentityRepairsAction",
          {
            count: repairs.length,
            suffix: repairs.length === 1 ? "" : "s",
          },
        ),
        true,
      );
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotConfirmIdentityRepairs",
          ),
        ),
        "danger",
      );
    }
    if (!confirmed) {
      setPending("");
      return;
    }
    setPending("identity-apply");
    try {
      const result = await request<{
        repairs: unknown[];
        backup: { id: string };
      }>("/identity-repair/apply", "POST", {
        scope: preview.scope,
        repairs,
      });
      setMessage(
        localizeUi("ui.longTermMemory.memorysettings.appliedIdentityRepairs", {
          count: result.repairs.length,
        }),
      );
      setIdentityPreview(null);
      setSelectedIdentityCandidates([]);
      setIdentitySectionChoices({});
      setIncludedIdentityNoteIds({});
      setIdentityCanonicalNoteIds({});
      await invalidateLtmQueries(queryClient, [
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.notes,
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.rejectedSuggestions,
        queryKeys.activity,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotApplyIdentityRepairs",
          ),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const exportBackup = async () => {
    setPending("backup-export");
    setMessage("");
    try {
      const response = await requestRaw("/backup/export");
      if (!response.ok)
        throw new Error(
          response.statusText ||
            localizeUi(
              "ui.longTermMemory.memorysettings.couldNotExportMemoryData",
            ),
        );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "long-term-memory-backup.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(
        localizeUi("ui.longTermMemory.memorysettings.memoryBackupExported"),
      );
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotExportMemoryData",
          ),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const previewBackup = async (file: File) => {
    setPending("backup-preview");
    setMessage("");
    try {
      const backup = JSON.parse(await file.text());
      const preview = await request<{
        incoming: { notes: number; drafts: number; rejectedSuggestions: number };
        current: { notes: number; drafts: number; rejectedSuggestions: number };
      }>("/backup/preview", "POST", backup);
      setBackupPreview({ ...preview, backup });
      setMessage(
        localizeUi(
          "ui.longTermMemory.memorysettings.backupValidatedReviewCounts",
        ),
      );
    } catch (error) {
      setBackupPreview(null);
      setMessage(
        errorMessage(
          error,
          localizeUi("ui.longTermMemory.memorysettings.couldNotValidateBackup"),
        ),
        "danger",
      );
    } finally {
      setPending("");
      if (backupInput.current) backupInput.current.value = "";
    }
  };

  const importBackup = async () => {
    if (!backupPreview) return;
    if (
      !(await confirm(
        props,
        localizeUi(
          "ui.longTermMemory.memorysettings.replaceLongTermMemoryData",
        ),
        localizeUi(
          "ui.longTermMemory.memorysettings.replaceLongTermMemoryDataDescription",
          {
            currentNotes: backupPreview.current.notes,
            currentDrafts: backupPreview.current.drafts,
            incomingNotes: backupPreview.incoming.notes,
            incomingDrafts: backupPreview.incoming.drafts,
          },
        ),
        localizeUi("ui.longTermMemory.memorysettings.replaceData"),
        true,
      ))
    )
      return;
    setPending("backup-import");
    setMessage("");
    try {
      await request("/backup/import", "POST", backupPreview.backup);
      setBackupPreview(null);
      await invalidateLtmQueries(queryClient, [
        queryKeys.root,
        queryKeys.settings,
        queryKeys.extractionSettings,
        queryKeys.notes,
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.rejectedSuggestions,
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.activity,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
      setMessage(
        localizeUi("ui.longTermMemory.memorysettings.memoryBackupImported"),
      );
      const [globalResult, extractionResult, integrityResult] =
        await Promise.all([
          global.refetch(),
          extraction.refetch(),
          integrity.refetch(),
        ]);
      if (
        !globalResult.isSuccess ||
        !extractionResult.isSuccess ||
        !integrityResult.isSuccess
      ) {
        setGlobalForm(null);
        setSavedGlobal(null);
        setExtractionFormState(null);
        setSavedExtraction(null);
        setMessage(
          localizeUi(
            "ui.longTermMemory.memorysettings.backupImportedSettingsNotRefreshed",
          ),
        );
      } else {
        const nextGlobal = settingsForm(globalResult.data);
        setGlobalForm(nextGlobal);
        setSavedGlobal(nextGlobal);
        const nextExtraction = extractionForm(extractionResult.data);
        setExtractionFormState(nextExtraction);
        setSavedExtraction(nextExtraction);
      }
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotImportMemoryData",
          ),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const resetSettings = async () => {
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.resetMemorySettings"),
        localizeUi(
          "ui.longTermMemory.memorysettings.resetMemorySettingsDescription",
        ),
        localizeUi("ui.longTermMemory.memorysettings.resetSettings"),
        true,
      ))
    )
      return;
    setPending("settings-reset");
    setMessage("");
    try {
      await request("/settings/reset", "POST");
      setGlobalForm(null);
      setSavedGlobal(null);
      setExtractionFormState(null);
      setSavedExtraction(null);
      await invalidateLtmQueries(queryClient, [
        queryKeys.settings,
        queryKeys.extractionSettings,
        queryKeys.chatDefaults,
      ]);
      await Promise.all([global.refetch(), extraction.refetch()]);
      setMessage(
        localizeUi(
          "ui.longTermMemory.memorysettings.memorySettingsResetToDefaults",
        ),
      );
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotResetMemorySettings",
          ),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const deleteAll = async () => {
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.deleteAllMemoryData"),
        localizeUi(
          "ui.longTermMemory.memorysettings.deleteAllMemoryDataDescription",
        ),
        localizeUi("ui.longTermMemory.memorysettings.deleteEverything"),
        true,
      ))
    )
      return;
    setPending("data-delete");
    setMessage("");
    try {
      await request("/data", "DELETE");
      setBackupPreview(null);
      await invalidateLtmQueries(queryClient, [
        queryKeys.root,
        queryKeys.notes,
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.rejectedSuggestions,
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.activity,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
      await integrity.refetch();
      setMessage(
        localizeUi("ui.longTermMemory.memorysettings.allMemoryDataDeleted"),
      );
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          localizeUi(
            "ui.longTermMemory.memorysettings.couldNotDeleteMemoryData",
          ),
        ),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  if (global.isError || extraction.isError)
    return (
      <StatusSurface tone="danger">
        {localizeUi(
          "ui.longTermMemory.memorysettings.couldNotLoadMemorySettings",
        )}{" "}
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
      </StatusSurface>
    );
  if (
    global.isLoading ||
    extraction.isLoading ||
    !globalForm ||
    !extractionFormState
  )
    return (
      <StatusSurface busy>
        {localizeUi("ui.longTermMemory.memorysettings.loadingMemorySettings")}
      </StatusSurface>
    );

  const selectedIdentityCount = selectedIdentityCandidates.length;
  const identitySelectionUnresolved = Boolean(
    identityPreview?.candidates.some((candidate) => {
      if (!selectedIdentityCandidates.includes(candidate.id)) return false;
      const included = new Set([
        candidate.canonicalNoteId,
        ...(includedIdentityNoteIds[candidate.id] ?? []),
      ]);
      return (
        candidate.blockingReasons.length > 0 ||
        candidate.supersedingConflicts.some((conflict) => {
          const includedOptions = conflict.options.filter((option) =>
            option.noteIds.some((noteId) => included.has(noteId)),
          );
          if (includedOptions.length < 2) return false;
          const choice =
            identitySectionChoices[candidate.id]?.[conflict.sectionKey];
          return !includedOptions.some((option) =>
            option.noteIds.includes(choice ?? ""),
          );
        })
      );
    }),
  );

  return (
    <section
      aria-labelledby={memorySettingsTitleId}
      data-ltm-surface="memory-settings"
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={memorySettingsTitleId} className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.memorySettings")}
          </h2>
        </div>
        {dirty ? (
          <div className="flex flex-wrap gap-2">
            <Button
              primary
              disabled={pending !== ""}
              onClick={() => void saveSettings()}
            >
              {localizeUi("ui.longTermMemory.memorysettings.saveSettings")}
            </Button>
            <Button
              destructive
              disabled={pending !== ""}
              onClick={() => void discard()}
            >
              {localizeUi("ui.longTermMemory.memorysettings.discardChanges")}
            </Button>
          </div>
        ) : null}
      </div>
      <StatusSurface>
        {localizeUi(
          "ui.longTermMemory.memorysettings.mostUsersCanKeepTheRecommendedDefaultsChangeThese",
        )}
      </StatusSurface>
      <div
        role="tablist"
        aria-label={localizeUi(
          "ui.longTermMemory.memorysettings.memorySettingsSections",
        )}
        className="mari-editor-tab-rail grid grid-cols-2 gap-1 rounded-lg border p-1 sm:grid-cols-4"
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
              let next = index;
              if (event.key === "ArrowRight")
                next = (index + 1) % settingsTabs.length;
              else if (event.key === "ArrowLeft")
                next = (index - 1 + settingsTabs.length) % settingsTabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = settingsTabs.length - 1;
              else return;
              event.preventDefault();
              setActiveTab(settingsTabs[next].id);
              document
                .getElementById(`settings-tab-${settingsTabs[next].id}`)
                ?.focus();
            }}
            data-active={activeTab === tab.id}
            className="mari-editor-tab min-h-10 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-editor-focus-ring)]"
          >
            {localizeUi(tab.labelKey)}
          </button>
        ))}
      </div>
      {message ? (
        <StatusSurface tone={messageState.tone}>{message}</StatusSurface>
      ) : null}

      <section
        id="settings-panel-recall"
        role="tabpanel"
        aria-labelledby="settings-tab-recall"
        hidden={activeTab !== "recall"}
        className="mari-editor-panel space-y-3 p-3"
      >
        <div>
          <h3 className="flex items-center gap-1 text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.globalRecall")}
            <InfoPopover
              label={localizeUi(
                "ui.longTermMemory.memorysettings.globalRecall",
              )}
              content={localizeUi(
                "ui.longTermMemory.memorysettings.defaultsUsedByEveryChatUnlessThatChatOverrides",
              )}
            />
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label={localizeUi(
              "ui.longTermMemory.memorysettings.includeResolvedMemories",
            )}
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
                content={localizeUi(
                  "ui.longTermMemory.memorysettings.choosesTheOverallMatchingStrategyUsedToFindRelevant",
                )}
              />
            </span>
            <select
              aria-labelledby={recallStyleLabelId}
              className={inputClass}
              value={globalForm.longTermMemoryRecallStyle}
              onChange={(event) =>
                setGlobalForm(
                  applyRecallStyle(
                    globalForm,
                    event.target
                      .value as GlobalForm["longTermMemoryRecallStyle"],
                  ),
                )
              }
            >
              <option value="balanced">
                {localizeUi("ui.longTermMemory.chatsettings.balanced")}
              </option>
              <option value="exact">
                {localizeUi("ui.longTermMemory.chatsettings.exact")}
              </option>
              <option value="broad">
                {localizeUi("ui.longTermMemory.chatsettings.broad")}
              </option>
              <option value="story">
                {localizeUi("ui.longTermMemory.chatsettings.story")}
              </option>
              <option value="custom">
                {localizeUi("ui.longTermMemory.chatsettings.custom")}
              </option>
            </select>
          </div>
          <NumberField
            label={localizeUi(
              "ui.longTermMemory.memorysettings.recallBudgetTokens",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.maximumTokenBudgetAvailableForMemoriesAddedToA",
            )}
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
            label={localizeUi(
              "ui.longTermMemory.memorysettings.maximumRecalledMemories",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.maximumNumberOfMemoriesThatMayBeIncludedIn",
            )}
            value={globalForm.longTermMemoryMaxChunks}
            min={1}
            max={100}
            onChange={(value) =>
              setGlobalForm({ ...globalForm, longTermMemoryMaxChunks: value })
            }
          />
          <NumberField
            label={localizeUi(
              "ui.longTermMemory.memorysettings.scoreThreshold",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.excludesCandidatesWhoseCombinedRetrievalScoreFallsBelowThis",
            )}
            value={globalForm.longTermMemoryScoreThreshold}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setGlobalForm({
                ...globalForm,
                longTermMemoryScoreThreshold: value,
              })
            }
          />
          <NumberField
            label={localizeUi(
              "ui.longTermMemory.memorysettings.recentMessagesForRecall",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.numberOfRecentChatMessagesUsedToBuildThe",
            )}
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
            help={localizeUi(
              "ui.longTermMemory.memorysettings.weightGivenToSemanticSimilarityBetweenTheCurrentChat",
            )}
            value={globalForm.longTermMemorySemanticWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setGlobalForm(
                applyCustomWeight(
                  globalForm,
                  "longTermMemorySemanticWeight",
                  value,
                ),
              )
            }
          />
          <NumberField
            label={localizeUi(
              "ui.longTermMemory.memorysettings.exactWordsMatch",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.weightGivenToMatchingWordsAndPhrases",
            )}
            value={globalForm.longTermMemoryLexicalWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setGlobalForm(
                applyCustomWeight(
                  globalForm,
                  "longTermMemoryLexicalWeight",
                  value,
                ),
              )
            }
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.graphWeight")}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.weightGivenToRelationshipsBetweenLinkedMemories",
            )}
            value={globalForm.longTermMemoryGraphWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setGlobalForm(
                applyCustomWeight(
                  globalForm,
                  "longTermMemoryGraphWeight",
                  value,
                ),
              )
            }
          />
          <NumberField
            label={localizeUi("ui.longTermMemory.memorysettings.keywordWeight")}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.weightGivenToMatchingStoredKeywords",
            )}
            value={globalForm.longTermMemoryKeywordWeight}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setGlobalForm(
                applyCustomWeight(
                  globalForm,
                  "longTermMemoryKeywordWeight",
                  value,
                ),
              )
            }
          />
        </div>
        <div className="block space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
          <span id={recallPreambleLabelId} className="flex items-center gap-1">
            {localizeUi(
              "ui.longTermMemory.memorysettings.memoryContextInstructions",
            )}
            <InfoPopover
              label={localizeUi(
                "ui.longTermMemory.memorysettings.memoryContextInstructions",
              )}
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
      </section>

      <section
        id="settings-panel-extraction"
        role="tabpanel"
        aria-labelledby="settings-tab-extraction"
        hidden={activeTab !== "extraction"}
        className="mari-editor-panel space-y-3 p-3"
      >
        <div>
          <h3 className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.extraction")}
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span id={extractionConnectionLabelId}>
              {localizeUi(
                "ui.longTermMemory.memorysettings.extractionConnection",
              )}
            </span>
            <select
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
                {localizeUi("ui.longTermMemory.sourcesworkspace.automatic")}
              </option>
              {connections.data &&
              extractionFormState.connectionId &&
              !availableConnections.some(
                (connection) =>
                  connection.id === extractionFormState.connectionId,
              ) ? (
                <option value={extractionFormState.connectionId}>
                  {localizeUi(
                    "ui.longTermMemory.memorysettings.unavailableSavedConnection",
                  )}
                </option>
              ) : null}
              {availableConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name || connection.provider}
                  {connection.model ? ` - ${connection.model}` : ""}
                </option>
              ))}
            </select>
            {connections.isError ? (
              <StatusSurface tone="danger">
                {localizeUi(
                  "ui.longTermMemory.memorysettings.couldNotLoadLanguageConnections",
                )}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void connections.refetch()}
                >
                  {localizeUi("ui.longTermMemory.activityview.retry")}
                </button>
              </StatusSurface>
            ) : null}
          </div>
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span
              id={reasoningEffortLabelId}
              className="flex items-center gap-1"
            >
              {localizeUi("ui.longTermMemory.memorysettings.reasoningEffort")}
              <InfoPopover
                label={localizeUi(
                  "ui.longTermMemory.memorysettings.reasoningEffort",
                )}
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
                  reasoningEffort: event.target
                    .value as ExtractionForm["reasoningEffort"],
                })
              }
            >
              <option value="none">
                {localizeUi("ui.longTermMemory.memorysettings.off")}
              </option>
              <option value="low">
                {localizeUi("ui.longTermMemory.memorysettings.low")}
              </option>
              <option value="medium">
                {localizeUi("ui.longTermMemory.memorysettings.medium")}
              </option>
              <option value="high">
                {localizeUi("ui.longTermMemory.memorysettings.high")}
              </option>
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
              <option value="none">
                {localizeUi("ui.longTermMemory.memorysettings.off")}
              </option>
              <option value="low">
                {localizeUi("ui.longTermMemory.memorysettings.low")}
              </option>
              <option value="medium">
                {localizeUi("ui.longTermMemory.memorysettings.medium")}
              </option>
              <option value="high">
                {localizeUi("ui.longTermMemory.memorysettings.high")}
              </option>
            </select>
          </div>
          <NumberField
            label={localizeUi(
              "ui.longTermMemory.memorysettings.maximumOutputTokens",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.maximumTokensTheModelMayProduceForOneExtraction",
            )}
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
            label={localizeUi(
              "ui.longTermMemory.memorysettings.maximumSourceTokens",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.rejectsASourceWhenItsEstimatedSizeExceedsThis",
            )}
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
            label={localizeUi(
              "ui.longTermMemory.memorysettings.maximumExistingNoteTokens",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.maximumExistingMemoryContextMadeAvailableWhileTheModel",
            )}
            value={extractionFormState.maxExistingNoteTokens}
            min={128}
            max={32768}
            step={128}
            onChange={(value) =>
              setExtractionFormState({
                ...extractionFormState,
                maxExistingNoteTokens: value,
              })
            }
          />
          <NumberField
            label={localizeUi(
              "ui.longTermMemory.memorysettings.existingNoteChunks",
            )}
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
            label={localizeUi(
              "ui.longTermMemory.memorysettings.existingNoteTokenBudget",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.maximumTokensFromThoseExistingChunksIncludedInThe",
            )}
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
            label={localizeUi(
              "ui.longTermMemory.memorysettings.aiKeywordExtraction",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.asksTheModelToGenerateConciseKeywordsForExtracted",
            )}
            checked={extractionFormState.aiKeywordExtraction}
            onChange={(value) =>
              setExtractionFormState({
                ...extractionFormState,
                aiKeywordExtraction: value,
              })
            }
          />
          <Toggle
            label={localizeUi(
              "ui.longTermMemory.memorysettings.useExtractionAgentOnGameMode",
            )}
            help={localizeUi(
              "ui.longTermMemory.memorysettings.routesGameModeImportsThroughTheExtractionAgentInstead",
            )}
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
          confirmAction={(title, text, label) =>
            confirm(props, title, text, label, true)
          }
        />
      </section>

      <section
        id="settings-panel-maintenance"
        role="tabpanel"
        aria-labelledby="settings-tab-maintenance"
        hidden={activeTab !== "maintenance"}
        className="mari-editor-panel space-y-3 p-3"
      >
        <div>
          <h3 className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.vaultMaintenance")}
          </h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.memorysettings.integrityState")}{" "}
            {integrity.data?.health ?? "loading"}.
          </p>
        </div>
        <div className="border-t border-[var(--border)] pt-3">
          <h4 className="flex items-center gap-1 text-xs font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.backupAndReset")}
            <InfoPopover
              label={localizeUi(
                "ui.longTermMemory.memorysettings.backupAndReset",
              )}
              content={localizeUi(
                "ui.longTermMemory.memorysettings.exportOrReplaceThePackageOwnedMemoryVaultAnd",
              )}
            />
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              disabled={pending !== ""}
              onClick={() => void exportBackup()}
            >
              <Download aria-hidden="true" size="0.875rem" />{" "}
              {localizeUi("ui.longTermMemory.memorysettings.exportBackup")}
            </Button>
            <Button
              disabled={pending !== ""}
              onClick={() => backupInput.current?.click()}
            >
              <Upload aria-hidden="true" size="0.875rem" />{" "}
              {localizeUi("ui.longTermMemory.memorysettings.chooseBackup")}
            </Button>
            <input
              ref={backupInput}
              type="file"
              aria-label={localizeUi(
                "ui.longTermMemory.memorysettings.chooseBackup",
              )}
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void previewBackup(file);
              }}
            />
            <Button
              disabled={pending !== ""}
              onClick={() => void resetSettings()}
            >
              <RotateCcw aria-hidden="true" size="0.875rem" />{" "}
              {localizeUi("ui.longTermMemory.memorysettings.resetSettings")}
            </Button>
            <Button
              destructive
              disabled={pending !== ""}
              onClick={() => void deleteAll()}
            >
              <Trash2 aria-hidden="true" size="0.875rem" />{" "}
              {localizeUi("ui.longTermMemory.memorysettings.deleteAllData")}
            </Button>
          </div>
          {backupPreview ? (
            <div className="mari-editor-panel mari-editor-panel--soft mt-2 space-y-2 p-3 text-xs">
              <p className="font-semibold">
                {localizeUi(
                  "ui.longTermMemory.memorysettings.validatedBackupReadyToImport",
                )}
              </p>
              <p className="text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memorysettings.current")}{" "}
                {backupPreview.current.notes}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.memories")}{" "}
                {backupPreview.current.drafts}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.draftsIncoming")}{" "}
                {backupPreview.incoming.notes}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.memories")}{" "}
                {backupPreview.incoming.drafts}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.drafts")} {" | "}
                {backupPreview.current.rejectedSuggestions}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.rejectedSuggestionsCurrent")} {" | "}
                {backupPreview.incoming.rejectedSuggestions}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.rejectedSuggestionsIncoming")}
              </p>
              <Button
                primary
                disabled={pending !== ""}
                onClick={() => void importBackup()}
              >
                {localizeUi(
                  "ui.longTermMemory.memorysettings.replaceWithThisBackup",
                )}
              </Button>
            </div>
          ) : null}
        </div>
        {integrity.isError ? (
          <StatusSurface tone="danger">
            {localizeUi(
              "ui.longTermMemory.memorysettings.integrityCheckCouldNotLoad",
            )}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void integrity.refetch()}
            >
              {localizeUi("ui.longTermMemory.activityview.retry")}
            </button>
          </StatusSurface>
        ) : null}
        {integrity.data ? (
          <StatusSurface tone={integrity.data.ok ? "success" : "danger"}>
            {integrity.data.ok
              ? localizeUi(
                  "ui.longTermMemory.memorysettings.integrityCheckPassedForValue1Notes",
                  { value1: integrity.data.noteCount },
                )
              : localizeUi(
                  "ui.longTermMemory.memorysettings.value1IntegrityIssueSFound",
                  { value1: integrity.data.issues.length },
                )}
          </StatusSurface>
        ) : null}
        {integrity.data?.issues.length ? (
          <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
            {integrity.data.issues.slice(0, 20).map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                {issue.severity}: {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-2">
          {repairActions.map((action) => (
            <Toggle
              key={action.id}
              label={localizeUi(action.labelKey)}
              help={localizeUi(action.descriptionKey)}
              checked={selectedActions.includes(action.id)}
              onChange={(checked) =>
                setSelectedActions(
                  checked
                    ? [...selectedActions, action.id]
                    : selectedActions.filter((id) => id !== action.id),
                )
              }
            />
          ))}
        </div>
        <Button
          destructive
          disabled={pending !== "" || !selectedActions.length}
          onClick={() => void runRepair()}
        >
          {localizeUi(
            "ui.longTermMemory.memorysettings.runSelectedMaintenance",
          )}
        </Button>
        <div className="border-t border-[var(--border)] pt-3">
          <h4 className="flex items-center gap-1 text-xs font-semibold">
            {localizeUi("ui.longTermMemory.memorysettings.identityRepair")}
            <InfoPopover
              label={localizeUi(
                "ui.longTermMemory.memorysettings.identityRepair",
              )}
              content={localizeUi(
                "ui.longTermMemory.memorysettings.previewDuplicateTrustedIdentitiesBeforeMergingAndArchivingDuplicates",
              )}
            />
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              disabled={pending !== ""}
              onClick={() => void previewIdentities()}
            >
              {localizeUi(
                "ui.longTermMemory.memorysettings.previewIdentityRepairs",
              )}
            </Button>
            <Button
              destructive
              disabled={
                pending !== "" ||
                selectedIdentityCount === 0 ||
                identitySelectionUnresolved
              }
              onClick={() => void applyIdentities()}
            >
              {localizeUi(
                "ui.longTermMemory.memorysettings.applySelectedRepairs",
                { count: selectedIdentityCount },
              )}
            </Button>
          </div>
          {identityPreview ? (
            <div className="mt-3 space-y-2 text-xs">
              <p>
                {identityPreview.counts.candidateCount}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.candidateGroupS")}{" "}
                {identityPreview.counts.duplicateNotes}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.duplicateNoteS")}{" "}
                {identityPreview.counts.unresolvedNotes}{" "}
                {localizeUi("ui.longTermMemory.memorysettings.unresolved")}
              </p>
              {identityPreview.candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="space-y-2 rounded border border-[var(--border)] p-3"
                >
                  <label className="flex min-h-11 items-start gap-2">
                    <input
                      className="mt-0.5"
                      type="checkbox"
                      checked={selectedIdentityCandidates.includes(
                        candidate.id,
                      )}
                      disabled={
                        pending !== "" || candidate.blockingReasons.length > 0
                      }
                      onChange={(event) =>
                        setSelectedIdentityCandidates((current) =>
                          event.target.checked
                            ? [...current, candidate.id]
                            : current.filter((id) => id !== candidate.id),
                        )
                      }
                    />
                    <span>
                      <span className="block font-semibold">
                        {candidate.subjectNames.join(" and ")}
                      </span>
                      <span className="block text-[var(--muted-foreground)]">
                        {candidate.noteType === "relationship"
                          ? localizeUi(
                              "ui.longTermMemory.memorysettings.relationship",
                            )
                          : localizeUi(
                              "ui.longTermMemory.memorysettings.character",
                            )}{" "}
                        {localizeUi(
                          "ui.longTermMemory.memorysettings.matchVia",
                        )}{" "}
                        {candidate.matchBasis.join(", ").replaceAll("_", " ")}.
                      </span>
                    </span>
                  </label>
                  {candidate.blockingReasons.length ? (
                    <StatusSurface tone="danger">
                      {candidate.blockingReasons.join(" ")}
                    </StatusSurface>
                  ) : null}
                  <div className="space-y-1 text-[var(--muted-foreground)]">
                    {candidate.notes.map((note) => {
                      const canonical =
                        note.noteId === candidate.canonicalNoteId;
                      return (
                        <div
                          key={note.noteId}
                          className="flex min-h-11 items-start gap-3 rounded border border-[var(--border)] p-2"
                        >
                          <label className="flex items-start gap-2">
                            <input
                              className="mt-0.5"
                              type="radio"
                              name={`canonical-${candidate.id}`}
                              checked={canonical}
                              disabled={
                                pending !== "" ||
                                !selectedIdentityCandidates.includes(
                                  candidate.id,
                                )
                              }
                              onChange={() =>
                                void selectIdentityCanonical(
                                  candidate.id,
                                  note.noteId,
                                )
                              }
                            />
                            <span className="font-medium text-[var(--foreground)]">
                              {localizeUi(
                                "ui.longTermMemory.memorysettings.keepAsCanonical",
                              )}
                            </span>
                          </label>
                          <label className="flex min-w-0 flex-1 items-start gap-2">
                            <input
                              className="mt-0.5"
                              type="checkbox"
                              checked={
                                canonical ||
                                (
                                  includedIdentityNoteIds[candidate.id] ?? []
                                ).includes(note.noteId)
                              }
                              disabled={
                                pending !== "" ||
                                canonical ||
                                !selectedIdentityCandidates.includes(
                                  candidate.id,
                                )
                              }
                              onChange={(event) =>
                                setIncludedIdentityNoteIds((current) => ({
                                  ...current,
                                  [candidate.id]: event.target.checked
                                    ? [
                                        ...(current[candidate.id] ?? []),
                                        note.noteId,
                                      ]
                                    : (current[candidate.id] ?? []).filter(
                                        (id) => id !== note.noteId,
                                      ),
                                }))
                              }
                            />
                            <span>
                              <span className="block font-medium text-[var(--foreground)]">
                                {canonical
                                  ? localizeUi(
                                      "ui.longTermMemory.memorysettings.canonicalMemory",
                                    )
                                  : localizeUi(
                                      "ui.longTermMemory.memorysettings.includeDuplicateInMergeAndArchive",
                                    )}
                                : {note.title}
                              </span>
                              <span className="block">
                                {note.basis.replaceAll("_", " ")}
                                {note.alreadyBound
                                  ? localizeUi(
                                      "ui.longTermMemory.memorysettings.alreadyBound",
                                    )
                                  : ""}
                                {note.exactFullName
                                  ? localizeUi(
                                      "ui.longTermMemory.memorysettings.exactFullName",
                                    )
                                  : ""}
                                {localizeUi(
                                  "ui.longTermMemory.memorysettings.created",
                                )}{" "}
                                {new Date(note.createdAt).toLocaleDateString(
                                  locale,
                                )}
                              </span>
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {candidate.additiveContent.length ? (
                    <div className="space-y-1">
                      <p className="font-medium">
                        {localizeUi(
                          "ui.longTermMemory.memorysettings.contentToAdd",
                        )}
                      </p>
                      {candidate.additiveContent.map((content) => (
                        <p
                          key={content.sectionKey}
                          className="text-[var(--muted-foreground)]"
                        >
                          {content.sectionKey}: {content.addedLines.join(" | ")}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {candidate.supersedingConflicts.map((conflict) => (
                    <fieldset
                      key={conflict.sectionKey}
                      className="space-y-1 border-t border-[var(--border)] pt-2"
                      disabled={
                        pending !== "" ||
                        !selectedIdentityCandidates.includes(candidate.id)
                      }
                    >
                      <legend className="font-medium">
                        {localizeUi(
                          "ui.longTermMemory.memorysettings.chooseSectionContent",
                          { sectionKey: conflict.sectionKey },
                        )}
                      </legend>
                      {conflict.options.map((option) => {
                        const included = new Set([
                          candidate.canonicalNoteId,
                          ...(includedIdentityNoteIds[candidate.id] ?? []),
                        ]);
                        const noteId = option.noteIds.find((id) =>
                          included.has(id),
                        );
                        const titles = option.noteIds.map(
                          (id) =>
                            candidate.notes.find((note) => note.noteId === id)
                              ?.title ?? id,
                        );
                        return (
                          <label
                            key={`${conflict.sectionKey}-${option.noteIds.join(":")}`}
                            className="flex min-h-11 items-start gap-2 rounded border border-[var(--border)] p-2"
                          >
                            <input
                              className="mt-0.5"
                              type="radio"
                              name={`${candidate.id}-${conflict.sectionKey}`}
                              disabled={!noteId}
                              checked={
                                noteId !== undefined &&
                                option.noteIds.includes(
                                  identitySectionChoices[candidate.id]?.[
                                    conflict.sectionKey
                                  ] ?? "",
                                )
                              }
                              onChange={() => {
                                if (!noteId) return;
                                setIdentitySectionChoices((current) => ({
                                  ...current,
                                  [candidate.id]: {
                                    ...current[candidate.id],
                                    [conflict.sectionKey]: noteId,
                                  },
                                }));
                              }}
                            />
                            <span>
                              <span className="block font-medium">
                                {titles.join(", ")}
                              </span>
                              <span className="block whitespace-pre-wrap text-[var(--muted-foreground)]">
                                {option.text}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      <section
        id="settings-panel-debug"
        role="tabpanel"
        aria-labelledby="settings-tab-debug"
        hidden={activeTab !== "debug"}
        className="mari-editor-panel space-y-3 p-3"
      >
        <Toggle
          label={localizeUi(
            "ui.longTermMemory.memorysettings.recordDebugActivity",
          )}
          help={localizeUi(
            "ui.longTermMemory.memorysettings.recordsLongTermMemoryOperationsForTroubleshootingActivityMay",
          )}
          checked={globalForm.longTermMemoryDebug}
          onChange={(value) =>
            setGlobalForm({ ...globalForm, longTermMemoryDebug: value })
          }
        />
        {activeTab === "debug" ? (
          <ActivityView props={props} onOpenMemory={onOpenMemory} />
        ) : null}
      </section>
    </section>
  );
}
