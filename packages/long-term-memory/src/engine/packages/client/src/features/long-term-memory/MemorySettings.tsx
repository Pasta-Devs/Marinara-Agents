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
import { invalidateLtmQueries, queryKeys, request } from "./api";
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
type RepairAction =
  | "rebuild_indexes"
  | "quarantine_malformed_notes"
  | "backfill_imported_source_titles";
type SettingsTab = "recall" | "extraction" | "maintenance" | "debug";

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "recall", label: "Recall" },
  { id: "extraction", label: "Extraction" },
  { id: "maintenance", label: "Maintenance" },
  { id: "debug", label: "Debug" },
];

const repairActions: Array<{
  id: RepairAction;
  label: string;
  description: string;
}> = [
  {
    id: "rebuild_indexes",
    label: "Reindex recall data",
    description: "Rebuild the recall index from saved notes.",
  },
  {
    id: "quarantine_malformed_notes",
    label: "Quarantine malformed notes",
    description: "Move invalid stored notes out of the active vault.",
  },
  {
    id: "backfill_imported_source_titles",
    label: "Backfill source titles",
    description: "Restore missing titles on imported source notes.",
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
    <div className="flex min-h-11 items-stretch rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 text-xs">
      <label
        htmlFor={inputId}
        className="flex min-h-11 flex-1 cursor-pointer items-start gap-2 px-3 py-2"
      >
        <input
          id={inputId}
          className="mt-0.5"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="font-semibold">{label}</span>
      </label>
      {help ? (
        <span className="p-1.5">
          <InfoPopover label={label} content={help} />
        </span>
      ) : null}
    </div>
  );
}

export default function MemorySettings({
  props,
  onDirtyChange,
  onOpenMemory,
}: LongTermMemoryDestinationProps) {
  const recallStyleLabelId = useId();
  const recallPreambleLabelId = useId();
  const reasoningEffortLabelId = useId();
  const verbosityLabelId = useId();
  const queryClient = useQueryClient();
  const global = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => request<LtmGlobalSettings>("/settings"),
  });
  const extraction = useQuery({
    queryKey: queryKeys.extractionSettings,
    queryFn: () => request<LtmExtractionSettingsPatch>("/extraction-settings"),
  });
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
  const [message, setMessage] = useState("");
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
    incoming: { notes: number; drafts: number };
    current: { notes: number; drafts: number };
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
      setMessage("Memory settings saved.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not save memory settings."));
    } finally {
      setPending("");
    }
  };

  const discard = async () => {
    if (
      !dirty ||
      (await confirm(
        props,
        "Discard unsaved changes?",
        "Your recall and extraction edits will be lost.",
        "Discard",
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
        "Run maintenance?",
        "Selected maintenance actions may rewrite indexes or quarantine invalid notes.",
        "Run maintenance",
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
      setMessage(errorMessage(error, "Maintenance failed."));
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
      setMessage(errorMessage(error, "Could not preview identity repairs."));
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
        errorMessage(error, "Could not refresh the canonical memory preview."),
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
        "Include at least one duplicate note before applying identity repairs.",
      );
      return;
    }
    setPending("identity-confirm");
    setMessage("");
    let confirmed = false;
    try {
      confirmed = await confirm(
        props,
        "Apply identity repairs?",
        `${repairs.length} selected identity repair${repairs.length === 1 ? "" : "s"} will be applied. ${includedDuplicateCount} explicitly included duplicate note${includedDuplicateCount === 1 ? "" : "s"} will be archived; excluded duplicates will be preserved. A backup is created first.`,
        `Apply ${repairs.length} repair${repairs.length === 1 ? "" : "s"}`,
        true,
      );
    } catch (error) {
      setMessage(errorMessage(error, "Could not confirm identity repairs."));
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
        `Applied ${result.repairs.length} identity repair(s). A backup was created.`,
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
        queryKeys.activity,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
    } catch (error) {
      setMessage(errorMessage(error, "Could not apply identity repairs."));
    } finally {
      setPending("");
    }
  };

  const exportBackup = async () => {
    setPending("backup-export");
    setMessage("");
    try {
      const response = await fetch("/api/long-term-memory/backup/export", {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(response.statusText || "Could not export memory data.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "long-term-memory-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Memory backup exported.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not export memory data."));
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
        incoming: { notes: number; drafts: number };
        current: { notes: number; drafts: number };
      }>("/backup/preview", "POST", backup);
      setBackupPreview({ ...preview, backup });
      setMessage(
        "Backup validated. Review the replacement counts before importing.",
      );
    } catch (error) {
      setBackupPreview(null);
      setMessage(errorMessage(error, "Could not validate this backup."));
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
        "Replace Long-Term Memory data?",
        `This replaces ${backupPreview.current.notes} current memories and ${backupPreview.current.drafts} drafts with ${backupPreview.incoming.notes} memories and ${backupPreview.incoming.drafts} drafts.`,
        "Replace data",
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
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.activity,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
      setMessage("Memory backup imported.");
      await Promise.all([
        global.refetch(),
        extraction.refetch(),
        integrity.refetch(),
      ]);
    } catch (error) {
      setMessage(errorMessage(error, "Could not import memory data."));
    } finally {
      setPending("");
    }
  };

  const resetSettings = async () => {
    if (
      !(await confirm(
        props,
        "Reset memory settings?",
        "All Long-Term Memory settings will return to their built-in defaults. Memories will be kept.",
        "Reset settings",
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
      setMessage("Memory settings reset to defaults.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not reset memory settings."));
    } finally {
      setPending("");
    }
  };

  const deleteAll = async () => {
    if (
      !(await confirm(
        props,
        "Delete all memory data?",
        "This permanently deletes every saved memory, pending draft, activity record, and derived index. Settings will be kept.",
        "Delete everything",
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
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.activity,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
      await integrity.refetch();
      setMessage("All memory data deleted. Settings were kept.");
    } catch (error) {
      setMessage(errorMessage(error, "Could not delete memory data."));
    } finally {
      setPending("");
    }
  };

  if (global.isError || extraction.isError)
    return (
      <StatusSurface tone="danger">
        Could not load memory settings.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => {
            void global.refetch();
            void extraction.refetch();
          }}
        >
          Retry
        </button>
      </StatusSurface>
    );
  if (
    global.isLoading ||
    extraction.isLoading ||
    !globalForm ||
    !extractionFormState
  )
    return <StatusSurface busy>Loading memory settings.</StatusSurface>;

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
    <section data-ltm-surface="memory-settings" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Memory Settings</h2>
        </div>
        {dirty ? (
          <div className="flex flex-wrap gap-2">
            <Button
              primary
              disabled={pending !== ""}
              onClick={() => void saveSettings()}
            >
              Save settings
            </Button>
            <Button
              destructive
              disabled={pending !== ""}
              onClick={() => void discard()}
            >
              Discard changes
            </Button>
          </div>
        ) : null}
      </div>
      <StatusSurface>
        Most users can keep the recommended defaults. Change these settings only
        when recall or extraction needs tuning.
      </StatusSurface>
      <div
        role="tablist"
        aria-label="Memory settings sections"
        className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-1 sm:grid-cols-4"
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
            className={`min-h-10 rounded-md border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${activeTab === tab.id ? "border-[var(--primary)]/35 bg-[var(--primary)]/10 text-[var(--foreground)]" : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {message ? (
        <StatusSurface
          tone={/could not|failed/i.test(message) ? "danger" : "success"}
        >
          {message}
        </StatusSurface>
      ) : null}

      <section
        id="settings-panel-recall"
        role="tabpanel"
        aria-labelledby="settings-tab-recall"
        hidden={activeTab !== "recall"}
        className="space-y-3 rounded-lg border border-[var(--border)] p-3"
      >
        <div>
          <h3 className="flex items-center gap-1 text-sm font-semibold">
            Global Recall
            <InfoPopover
              label="Global Recall"
              content="Defaults used by every chat unless that chat overrides them."
            />
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="Include resolved memories"
            help="Allows resolved memories to participate in recall. Archived memories remain excluded."
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
              Recall style
              <InfoPopover
                label="Recall style"
                content="Chooses the overall matching strategy used to find relevant memories."
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
              <option value="balanced">Balanced</option>
              <option value="exact">Exact</option>
              <option value="broad">Broad</option>
              <option value="story">Story</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <NumberField
            label="Recall budget tokens"
            help="Maximum token budget available for memories added to a model request."
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
            label="Maximum recalled memories"
            help="Maximum number of memories that may be included in one recall."
            value={globalForm.longTermMemoryMaxChunks}
            min={1}
            max={100}
            onChange={(value) =>
              setGlobalForm({ ...globalForm, longTermMemoryMaxChunks: value })
            }
          />
          <NumberField
            label="Score threshold"
            help="Excludes candidates whose combined retrieval score falls below this value. Higher values return fewer, stronger matches."
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
            label="Recent messages for recall"
            help="Number of recent chat messages used to build the query that searches memory."
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
            label="Meaning match"
            help="Weight given to semantic similarity between the current chat and a saved memory."
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
            label="Exact words match"
            help="Weight given to matching words and phrases."
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
            label="Graph weight"
            help="Weight given to relationships between linked memories."
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
            label="Keyword weight"
            help="Weight given to matching stored keywords."
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
            Memory context instructions
            <InfoPopover
              label="Memory context instructions"
              content="Instructions placed before recalled memory context when it is sent to the model."
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
        className="space-y-3 rounded-lg border border-[var(--border)] p-3"
      >
        <div>
          <h3 className="text-sm font-semibold">Extraction</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span
              id={reasoningEffortLabelId}
              className="flex items-center gap-1"
            >
              Reasoning effort
              <InfoPopover
                label="Reasoning effort"
                content="Requests this amount of model reasoning during extraction. Unsupported settings may be reduced by the selected model."
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
              <option value="none">Off</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="space-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span id={verbosityLabelId} className="flex items-center gap-1">
              Verbosity
              <InfoPopover
                label="Verbosity"
                content="Requests the selected response detail level from the extraction model. The response must still follow the structured extraction format."
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
              <option value="none">Off</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <NumberField
            label="Maximum output tokens"
            help="Maximum tokens the model may produce for one extraction response, capped by the selected model's own limit."
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
            label="Temperature"
            help="Controls extraction variability. Lower values are more deterministic; higher values may produce more varied results."
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
            label="Maximum source tokens"
            help="Rejects a source when its estimated size exceeds this limit."
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
            label="Maximum existing-note tokens"
            help="Maximum existing-memory context made available while the model prepares an extraction."
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
            label="Existing-note chunks"
            help="Maximum number of existing memory chunks considered while checking context and possible overlap."
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
            label="Existing-note token budget"
            help="Maximum tokens from those existing chunks included in the extraction request."
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
            label="AI keyword extraction"
            help="Asks the model to generate concise keywords for extracted memories instead of relying only on deterministic keywords."
            checked={extractionFormState.aiKeywordExtraction}
            onChange={(value) =>
              setExtractionFormState({
                ...extractionFormState,
                aiKeywordExtraction: value,
              })
            }
          />
          <Toggle
            label="Use Extraction Agent on Game Mode"
            help="Routes Game-mode imports through the extraction agent instead of the direct Game-mode extraction path."
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
        className="space-y-3 rounded-lg border border-[var(--border)] p-3"
      >
        <div>
          <h3 className="text-sm font-semibold">Vault Maintenance</h3>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Integrity state: {integrity.data?.health ?? "loading"}.
          </p>
        </div>
        <div className="border-t border-[var(--border)] pt-3">
          <h4 className="flex items-center gap-1 text-xs font-semibold">
            Backup and Reset
            <InfoPopover
              label="Backup and Reset"
              content="Export or replace the package-owned memory vault and settings."
            />
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              disabled={pending !== ""}
              onClick={() => void exportBackup()}
            >
              <Download aria-hidden="true" size="0.875rem" /> Export backup
            </Button>
            <Button
              disabled={pending !== ""}
              onClick={() => backupInput.current?.click()}
            >
              <Upload aria-hidden="true" size="0.875rem" /> Choose backup
            </Button>
            <input
              ref={backupInput}
              type="file"
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
              <RotateCcw aria-hidden="true" size="0.875rem" /> Reset settings
            </Button>
            <Button
              destructive
              disabled={pending !== ""}
              onClick={() => void deleteAll()}
            >
              <Trash2 aria-hidden="true" size="0.875rem" /> Delete all data
            </Button>
          </div>
          {backupPreview ? (
            <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3 text-xs">
              <p className="font-semibold">Validated backup ready to import</p>
              <p className="text-[var(--muted-foreground)]">
                Current: {backupPreview.current.notes} memories,{" "}
                {backupPreview.current.drafts} drafts. Incoming:{" "}
                {backupPreview.incoming.notes} memories,{" "}
                {backupPreview.incoming.drafts} drafts.
              </p>
              <Button
                primary
                disabled={pending !== ""}
                onClick={() => void importBackup()}
              >
                Replace with this backup
              </Button>
            </div>
          ) : null}
        </div>
        {integrity.isError ? (
          <StatusSurface tone="danger">
            Integrity check could not load.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void integrity.refetch()}
            >
              Retry
            </button>
          </StatusSurface>
        ) : null}
        {integrity.data ? (
          <StatusSurface tone={integrity.data.ok ? "success" : "danger"}>
            {integrity.data.ok
              ? `Integrity check passed for ${integrity.data.noteCount} notes.`
              : `${integrity.data.issues.length} integrity issue(s) found.`}
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
              label={action.label}
              help={action.description}
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
          Run selected maintenance
        </Button>
        <div className="border-t border-[var(--border)] pt-3">
          <h4 className="flex items-center gap-1 text-xs font-semibold">
            Identity repair
            <InfoPopover
              label="Identity repair"
              content="Preview duplicate trusted identities before merging and archiving duplicates."
            />
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              disabled={pending !== ""}
              onClick={() => void previewIdentities()}
            >
              Preview identity repairs
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
              Apply selected repairs ({selectedIdentityCount})
            </Button>
          </div>
          {identityPreview ? (
            <div className="mt-3 space-y-2 text-xs">
              <p>
                {identityPreview.counts.candidateCount} candidate group(s),{" "}
                {identityPreview.counts.duplicateNotes} duplicate note(s),{" "}
                {identityPreview.counts.unresolvedNotes} unresolved.
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
                          ? "Relationship"
                          : "Character"}{" "}
                        match via{" "}
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
                              Keep as canonical
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
                                  ? "Canonical memory"
                                  : "Include duplicate in merge and archive"}
                                : {note.title}
                              </span>
                              <span className="block">
                                {note.basis.replaceAll("_", " ")}
                                {note.alreadyBound ? ", already bound" : ""}
                                {note.exactFullName ? ", exact full name" : ""};
                                created{" "}
                                {new Date(note.createdAt).toLocaleDateString()}
                              </span>
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {candidate.additiveContent.length ? (
                    <div className="space-y-1">
                      <p className="font-medium">Content to add</p>
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
                        Choose {conflict.sectionKey} content
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
                            key={`${conflict.sectionKey}-${noteId}`}
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
        className="space-y-3 rounded-lg border border-[var(--border)] p-3"
      >
        <Toggle
          label="Record debug activity"
          help="Records Long-Term Memory operations for troubleshooting. Activity may include technical metadata and can be exported or cleared here."
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
