import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, TriangleAlert, Upload } from "lucide-react";
import type {
  LtmExtractionSettingsPatch,
  LtmGlobalSettings,
  LtmIdentityRepairPreviewResponse,
  LtmIntegrityResponse,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, failedResponseError, invalidateLtmQueries, queryKeys, request, requestRaw } from "../api";
import { Button, InfoPopover, LiveResult, StatusSurface, lockedActionProps } from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";
import { selectLtmPluralForm, useLtmTranslation } from "../localization";
import { labelKeys, localizedLabel } from "../display-labels";
import { confirm, Toggle, type SettingsRebuildOutcome } from "./settings-shared";

type MaintenanceArea = "backup" | "repair" | "identity" | "reset";

type RepairAction = "rebuild_indexes" | "quarantine_malformed_notes" | "backfill_imported_source_titles";

const repairActions: Array<{
  id: RepairAction;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "rebuild_indexes",
    labelKey: "ui.longTermMemory.memorysettings.reindexRecallData",
    descriptionKey: "ui.longTermMemory.memorysettings.rebuildRecallIndexFromSavedNotes",
  },
  {
    id: "quarantine_malformed_notes",
    labelKey: "ui.longTermMemory.memorysettings.quarantineMalformedNotes",
    descriptionKey: "ui.longTermMemory.memorysettings.moveInvalidStoredNotesOutOfActiveVault",
  },
  {
    id: "backfill_imported_source_titles",
    labelKey: "ui.longTermMemory.memorysettings.backfillSourceTitles",
    descriptionKey: "ui.longTermMemory.memorysettings.restoreMissingTitlesOnImportedSourceNotes",
  },
];

/** What the Maintenance tab needs from the settings forms its backup and reset actions replace. */
type SettingsChannel = {
  /** Drops the loaded forms; they refill only from settings fetched at or after `since`. */
  clear: (since: number) => void;
  /** Loads freshly fetched settings into the forms as the saved baseline. */
  apply: (global: LtmGlobalSettings, extraction: LtmExtractionSettingsPatch) => void;
};

export function MaintenancePanel({
  props,
  hidden,
  disabled,
  settings,
  onBusyChange,
}: {
  props: LongTermMemoryDestinationProps["props"];
  hidden: boolean;
  /** True while the parent is saving settings. */
  disabled: boolean;
  settings: SettingsChannel;
  /** Reports whether a maintenance action is running, so the parent's save stays disabled. */
  onBusyChange: (busy: boolean) => void;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const joinList = (items: string[], type: "conjunction" | "unit" = "conjunction") => {
    try {
      return new Intl.ListFormat(locale, { style: "long", type }).format(items);
    } catch {
      return items.join(type === "unit" ? ", " : " and ");
    }
  };
  const queryClient = useQueryClient();
  const integrity = useQuery({
    queryKey: queryKeys.integrity,
    queryFn: () => request<LtmIntegrityResponse>("/integrity"),
  });
  const [pending, setPending] = useState("");
  // Each result shows under the controls that produced it; an action names its area when it starts.
  const [messageState, setMessageState] = useState<{
    text: string;
    tone: "success" | "danger";
    area: MaintenanceArea;
  }>({ text: "", tone: "success", area: "backup" });
  const setMessage = (text: string, tone: "success" | "danger" = "success", area?: MaintenanceArea) =>
    setMessageState((current) => ({ text, tone, area: area ?? current.area }));
  const resultFor = (area: MaintenanceArea, className = "") => (
    <LiveResult
      text={messageState.area === area ? messageState.text : ""}
      tone={messageState.tone}
      className={className}
      data-ltm-maintenance-result={area}
      tabIndex={-1}
    />
  );
  // Running work and the parent's save lock keep focus (`aria-disabled`), so each handler returns early on `busy`.
  const busy = pending !== "" || disabled;
  const lock = lockedActionProps(busy);
  useEffect(() => {
    onBusyChange(pending !== "");
  }, [onBusyChange, pending]);
  const [selectedActions, setSelectedActions] = useState<RepairAction[]>([]);
  const [identityPreview, setIdentityPreview] = useState<LtmIdentityRepairPreviewResponse | null>(null);
  const [selectedIdentityCandidates, setSelectedIdentityCandidates] = useState<string[]>([]);
  const [identitySectionChoices, setIdentitySectionChoices] = useState<Record<string, Record<string, string>>>({});
  const [includedIdentityNoteIds, setIncludedIdentityNoteIds] = useState<Record<string, string[]>>({});
  const [identityCanonicalNoteIds, setIdentityCanonicalNoteIds] = useState<Record<string, string>>({});
  const [backupPreview, setBackupPreview] = useState<{
    backup: unknown;
    incoming: { notes: number; drafts: number; rejectedSuggestions: number };
    current: { notes: number; drafts: number; rejectedSuggestions: number };
  } | null>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const chooseBackupButton = useRef<HTMLButtonElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const exportFirstButton = useRef<HTMLButtonElement>(null);
  // Delete all data asks first whether to export a backup; the host's confirm dialog cannot hold that button.
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  useEffect(() => {
    if (hidden) setDeletePromptOpen(false);
  }, [hidden]);
  const closeDeletePrompt = () => {
    if (busy) return;
    setDeletePromptOpen(false);
    deleteButton.current?.focus();
  };
  // Reset and backup import hide this panel while the forms reload, which drops focus to the page.
  // Once the panel is back and idle, return focus to the control that started the action, unless
  // the user has already moved it. Import's Replace button is gone by then, so it uses Choose backup.
  const focusAfterReload = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const target = focusAfterReload.current;
    if (hidden || pending || !target) return;
    focusAfterReload.current = null;
    if (target.isConnected && document.activeElement === document.body) target.focus();
  }, [hidden, pending]);
  // A finished run empties the selection, so Run selected maintenance turns natively disabled and drops focus
  // to the page. Once the run settles, move focus to its result, unless the user has already moved it.
  const repairResultBox = useRef<HTMLDivElement>(null);
  const focusRepairResult = useRef(false);
  useEffect(() => {
    if (pending || !focusRepairResult.current) return;
    focusRepairResult.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || active.matches(":disabled")) {
      repairResultBox.current?.querySelector<HTMLElement>("[data-ltm-maintenance-result]")?.focus();
    }
  }, [pending]);

  /** True when `key` was refetched at or after `since`; a failed or paused refetch leaves the old data in the cache. */
  const refetchedSince = (key: readonly unknown[], since: number) => {
    const state = queryClient.getQueryState(key);
    return state?.status === "success" && state.dataUpdatedAt >= since;
  };
  /** The settings the awaited invalidation just refetched, or null when either refetch did not complete. */
  const refreshedSettings = (since: number) => {
    const succeeded = [queryKeys.settings, queryKeys.extractionSettings].every((key) => refetchedSince(key, since));
    const global = queryClient.getQueryData<LtmGlobalSettings>(queryKeys.settings);
    const extraction = queryClient.getQueryData<LtmExtractionSettingsPatch>(queryKeys.extractionSettings);
    return succeeded && global && extraction ? { global, extraction } : null;
  };

  const runRepair = async () => {
    if (busy || !selectedActions.length) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.runMaintenance"),
        localizeUi("ui.longTermMemory.memorysettings.selectedMaintenanceMayRewriteData"),
        localizeUi("ui.longTermMemory.memorysettings.runMaintenanceAction"),
        true,
      ))
    )
      return;
    setPending("repair");
    setMessage("", "success", "repair");
    try {
      const result = await request<{
        actions: Array<{ action: string; result: string; count?: number }>;
      }>("/repair", "POST", { actions: selectedActions });
      setMessage(
        result.actions
          .map((item) =>
            localizeUi("ui.longTermMemory.memorysettings.maintenanceResult", {
              action: localizedLabel(item.action, localizeUi, labelKeys.maintenanceAction),
              result: localizedLabel(item.result, localizeUi, labelKeys.maintenanceResult),
              count: item.count ?? 0,
            }),
          )
          .join(" "),
      );
      setSelectedActions([]);
      focusRepairResult.current = true;
      await invalidateLtmQueries(queryClient, [
        queryKeys.integrity,
        queryKeys.status,
        queryKeys.notes,
        queryKeys.activity,
        queryKeys.localCharactersRoot,
        queryKeys.scopeTargetsRoot,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
    } catch (error) {
      setMessage(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.maintenanceFailed")), "danger");
    } finally {
      setPending("");
    }
  };

  const previewIdentities = async () => {
    if (busy) return;
    setPending("identity-preview");
    setMessage("", "success", "identity");
    // A failed preview must not leave Apply counting candidates from the cleared one.
    setIdentityPreview(null);
    setSelectedIdentityCandidates([]);
    try {
      const preview = await request<LtmIdentityRepairPreviewResponse>("/identity-repair/preview", "POST", {});
      setIdentityPreview(preview);
      setSelectedIdentityCandidates(
        preview.candidates.filter((candidate) => !candidate.blockingReasons.length).map((candidate) => candidate.id),
      );
      setIdentitySectionChoices({});
      setIncludedIdentityNoteIds(
        Object.fromEntries(preview.candidates.map((candidate) => [candidate.id, candidate.duplicateNoteIds])),
      );
      setIdentityCanonicalNoteIds({});
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotPreviewIdentityRepairs")),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const selectIdentityCanonical = async (candidateId: string, canonicalNoteId: string) => {
    if (busy || !identityPreview) return;
    const canonicalNoteIds = {
      ...identityCanonicalNoteIds,
      [candidateId]: canonicalNoteId,
    };
    setPending(`identity-canonical-${candidateId}`);
    setMessage("", "success", "identity");
    try {
      const preview = await request<LtmIdentityRepairPreviewResponse>("/identity-repair/preview", "POST", {
        scope: identityPreview.scope,
        canonicalNoteIds,
      });
      setIdentityPreview(preview);
      setIdentityCanonicalNoteIds(canonicalNoteIds);
      setIdentitySectionChoices((current) => ({
        ...current,
        [candidateId]: {},
      }));
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotRefreshCanonicalPreview")),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const applyIdentities = async () => {
    if (busy || !identityPreview || !selectedIdentityCandidates.length) return;
    const preview = identityPreview;
    const selectedCandidateIds = [...selectedIdentityCandidates];
    const sectionChoices = structuredClone(identitySectionChoices);
    const includedNoteIds = structuredClone(includedIdentityNoteIds);
    const selected = preview.candidates.filter((candidate) => selectedCandidateIds.includes(candidate.id));
    const repairs = selected.flatMap((candidate) => {
      if (candidate.blockingReasons.length) return [];
      const included = new Set([candidate.canonicalNoteId, ...(includedNoteIds[candidate.id] ?? [])]);
      const choices = sectionChoices[candidate.id] ?? {};
      const conflicts = candidate.supersedingConflicts.filter(
        (conflict) =>
          conflict.options.filter((option) => option.noteIds.some((noteId) => included.has(noteId))).length > 1,
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
          excludedNoteIds: candidate.duplicateNoteIds.filter((noteId) => !included.has(noteId)),
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
        selected.find((candidate) => candidate.id === repair.candidateId)!.duplicateNoteIds.length -
        repair.excludedNoteIds.length,
      0,
    );
    if (includedDuplicateCount === 0) {
      setMessage(
        localizeUi("ui.longTermMemory.memorysettings.includeDuplicateBeforeApplyingRepairs"),
        "danger",
        "identity",
      );
      return;
    }
    setPending("identity-confirm");
    setMessage("", "success", "identity");
    let confirmed = false;
    try {
      confirmed = await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.applyIdentityRepairs"),
        localizeUi("ui.longTermMemory.memorysettings.applyIdentityRepairsDescription", {
          repairs: localizeUi(
            selectLtmPluralForm(locale, repairs.length) === "one"
              ? "ui.longTermMemory.memorysettings.selectedIdentityRepairsOne"
              : "ui.longTermMemory.memorysettings.selectedIdentityRepairsOther",
            { count: repairs.length },
          ),
          duplicates: localizeUi(
            selectLtmPluralForm(locale, includedDuplicateCount) === "one"
              ? "ui.longTermMemory.memorysettings.includedDuplicateNotesOne"
              : "ui.longTermMemory.memorysettings.includedDuplicateNotesOther",
            { count: includedDuplicateCount },
          ),
        }),
        localizeUi(
          selectLtmPluralForm(locale, repairs.length) === "one"
            ? "ui.longTermMemory.memorysettings.applyIdentityRepairsActionOne"
            : "ui.longTermMemory.memorysettings.applyIdentityRepairsActionOther",
          { count: repairs.length },
        ),
        true,
      );
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotConfirmIdentityRepairs")),
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
          backup: result.backup.id.slice(0, 8),
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
        queryKeys.localCharactersRoot,
        queryKeys.scopeTargetsRoot,
        ...(props.chatId ? [queryKeys.lastInjection(props.chatId)] : []),
      ]);
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotApplyIdentityRepairs")),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const exportBackup = async (area: MaintenanceArea = "backup") => {
    if (busy) return;
    setPending("backup-export");
    setMessage("", "success", area);
    try {
      const response = await requestRaw("/backup/export");
      if (!response.ok) throw await failedResponseError(response);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "long-term-memory-backup.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(localizeUi("ui.longTermMemory.memorysettings.memoryBackupExported"));
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotExportMemoryData")),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const previewBackup = async (file: File) => {
    setPending("backup-preview");
    setMessage("", "success", "backup");
    try {
      const backup = JSON.parse(await file.text());
      const preview = await request<{
        incoming: {
          notes: number;
          drafts: number;
          rejectedSuggestions: number;
        };
        current: { notes: number; drafts: number; rejectedSuggestions: number };
      }>("/backup/preview", "POST", backup);
      setBackupPreview({ ...preview, backup });
      setMessage(localizeUi("ui.longTermMemory.memorysettings.backupValidatedReviewCounts"));
    } catch (error) {
      setBackupPreview(null);
      setMessage(errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotValidateBackup")), "danger");
    } finally {
      setPending("");
      if (backupInput.current) backupInput.current.value = "";
    }
  };

  const importBackup = async () => {
    if (busy || !backupPreview) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.replaceLongTermMemoryData"),
        localizeUi("ui.longTermMemory.memorysettings.replaceLongTermMemoryDataDescription", {
          currentNotes: backupPreview.current.notes,
          currentDrafts: backupPreview.current.drafts,
          incomingNotes: backupPreview.incoming.notes,
          incomingDrafts: backupPreview.incoming.drafts,
        }),
        localizeUi("ui.longTermMemory.memorysettings.replaceData"),
        true,
      ))
    )
      return;
    setPending("backup-import");
    setMessage("", "success", "backup");
    focusAfterReload.current = chooseBackupButton.current;
    try {
      await request("/backup/import", "POST", backupPreview.backup);
      setBackupPreview(null);
      // The import replaces the whole vault, so everything cached is stale. The call waits for the
      // active queries to refetch; the forms read that result below. A failed integrity read shows
      // its own error with Retry, so only a failed settings read changes the message.
      const startedAt = Date.now();
      await invalidateLtmQueries(queryClient, [queryKeys.root]);
      setMessage(localizeUi("ui.longTermMemory.memorysettings.memoryBackupImported"));
      const refreshed = refreshedSettings(startedAt);
      if (!refreshed) {
        settings.clear(startedAt);
        setMessage(localizeUi("ui.longTermMemory.memorysettings.backupImportedSettingsNotRefreshed"));
      } else {
        settings.apply(refreshed.global, refreshed.extraction);
      }
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotImportMemoryData")),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const resetSettings = async () => {
    if (busy) return;
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
    setMessage("", "success", "reset");
    focusAfterReload.current = resetButton.current;
    try {
      const response = await request<{ rebuild?: SettingsRebuildOutcome | null }>("/settings/reset", "POST");
      const startedAt = Date.now();
      settings.clear(startedAt);
      await invalidateLtmQueries(queryClient, [
        queryKeys.settings,
        queryKeys.extractionSettings,
        queryKeys.chatDefaults,
        queryKeys.status,
      ]);
      const refreshed = refreshedSettings(startedAt);
      if (refreshed) settings.apply(refreshed.global, refreshed.extraction);
      if (response.rebuild?.status === "deferred") {
        setMessage(
          localizeUi("ui.longTermMemory.memorysettings.memorySettingsResetIndexRebuildFailed", {
            error: response.rebuild.error ?? "",
          }),
          "danger",
        );
      } else {
        setMessage(localizeUi("ui.longTermMemory.memorysettings.memorySettingsResetToDefaults"));
      }
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotResetMemorySettings")),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const deleteAll = async () => {
    if (busy) return;
    if (
      !(await confirm(
        props,
        localizeUi("ui.longTermMemory.memorysettings.deleteAllMemoryData"),
        localizeUi("ui.longTermMemory.memorysettings.deleteAllMemoryDataDescription"),
        localizeUi("ui.longTermMemory.memorysettings.deleteEverything"),
        true,
      ))
    )
      return;
    setDeletePromptOpen(false);
    focusAfterReload.current = deleteButton.current;
    setPending("data-delete");
    setMessage("", "success", "reset");
    try {
      await request("/data", "DELETE");
      setBackupPreview(null);
      await invalidateLtmQueries(queryClient, [queryKeys.root]);
      setMessage(localizeUi("ui.longTermMemory.memorysettings.allMemoryDataDeleted"));
    } catch (error) {
      setMessage(
        errorMessage(error, localizeUi("ui.longTermMemory.memorysettings.couldNotDeleteMemoryData")),
        "danger",
      );
    } finally {
      setPending("");
    }
  };

  const selectedIdentityCount = selectedIdentityCandidates.length;
  const identitySelectionUnresolved = Boolean(
    identityPreview?.candidates.some((candidate) => {
      if (!selectedIdentityCandidates.includes(candidate.id)) return false;
      const included = new Set([candidate.canonicalNoteId, ...(includedIdentityNoteIds[candidate.id] ?? [])]);
      return (
        candidate.blockingReasons.length > 0 ||
        candidate.supersedingConflicts.some((conflict) => {
          const includedOptions = conflict.options.filter((option) =>
            option.noteIds.some((noteId) => included.has(noteId)),
          );
          if (includedOptions.length < 2) return false;
          const choice = identitySectionChoices[candidate.id]?.[conflict.sectionKey];
          return !includedOptions.some((option) => option.noteIds.includes(choice ?? ""));
        })
      );
    }),
  );

  return (
    <section
      id="settings-panel-maintenance"
      role="tabpanel"
      aria-labelledby="settings-tab-maintenance"
      hidden={hidden}
      className="mari-editor-panel space-y-3 p-3"
    >
      <div>
        <h3 className="text-sm font-semibold">{localizeUi("ui.longTermMemory.memorysettings.vaultMaintenance")}</h3>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.memorysettings.integrityState")}{" "}
          {/* A retained "healthy" reading from before a failed reload would contradict the error below it. */}
          {localizedLabel(
            integrity.isError ? "loading" : (integrity.data?.health ?? "loading"),
            localizeUi,
            labelKeys.integrity,
          )}
          .
        </p>
      </div>
      <div data-ltm-maintenance-group="backup" className="border-t border-[var(--border)] pt-3">
        <div className="flex items-center gap-1">
          <h4 className="text-xs font-semibold">{localizeUi("ui.longTermMemory.memorysettings.backupGroup")}</h4>
          <InfoPopover
            label={localizeUi("ui.longTermMemory.memorysettings.backupGroup")}
            content={localizeUi("ui.longTermMemory.memorysettings.exportOrReplaceThePackageOwnedMemoryVaultAnd")}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button {...lock} onClick={() => void exportBackup()}>
            <Download aria-hidden="true" size="0.875rem" />{" "}
            {localizeUi("ui.longTermMemory.memorysettings.exportBackup")}
          </Button>
          <Button
            ref={chooseBackupButton}
            {...lock}
            onClick={() => {
              if (!busy) backupInput.current?.click();
            }}
          >
            <Upload aria-hidden="true" size="0.875rem" /> {localizeUi("ui.longTermMemory.memorysettings.chooseBackup")}
          </Button>
          <input
            ref={backupInput}
            type="file"
            aria-label={localizeUi("ui.longTermMemory.memorysettings.chooseBackup")}
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void previewBackup(file);
            }}
          />
        </div>
        {backupPreview ? (
          <div className="mari-editor-panel mari-editor-panel--soft mt-2 space-y-2 p-3 text-xs">
            <p className="font-semibold">
              {localizeUi("ui.longTermMemory.memorysettings.validatedBackupReadyToImport")}
            </p>
            <p className="text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memorysettings.current")} {backupPreview.current.notes}{" "}
              {localizeUi("ui.longTermMemory.memorysettings.memories")} {backupPreview.current.drafts}{" "}
              {localizeUi("ui.longTermMemory.memorysettings.draftsIncoming")} {backupPreview.incoming.notes}{" "}
              {localizeUi("ui.longTermMemory.memorysettings.memories")} {backupPreview.incoming.drafts}{" "}
              {localizeUi("ui.longTermMemory.memorysettings.drafts")} {" | "}
              {backupPreview.current.rejectedSuggestions}{" "}
              {localizeUi("ui.longTermMemory.memorysettings.rejectedSuggestionsCurrent")} {" | "}
              {backupPreview.incoming.rejectedSuggestions}{" "}
              {localizeUi("ui.longTermMemory.memorysettings.rejectedSuggestionsIncoming")}
            </p>
            <Button primary {...lock} onClick={() => void importBackup()}>
              {localizeUi("ui.longTermMemory.memorysettings.replaceWithThisBackup")}
            </Button>
          </div>
        ) : null}
        {resultFor("backup", "mt-2")}
      </div>
      <div data-ltm-maintenance-group="repair" className="space-y-2 border-t border-[var(--border)] pt-3">
        <h4 className="text-xs font-semibold">{localizeUi("ui.longTermMemory.memorysettings.repairGroup")}</h4>
        {integrity.isError ? (
          <StatusSurface tone="danger">
            {localizeUi("ui.longTermMemory.memorysettings.integrityCheckCouldNotLoad")}{" "}
            <button
              type="button"
              className="inline-flex min-h-11 items-center underline"
              onClick={() => void integrity.refetch()}
            >
              {localizeUi("ui.longTermMemory.activityview.retry")}
            </button>
          </StatusSurface>
        ) : null}
        {integrity.data && !integrity.isError ? (
          <StatusSurface tone={integrity.data.ok ? "success" : "danger"}>
            {integrity.data.ok
              ? localizeUi("ui.longTermMemory.memorysettings.integrityCheckPassedForValue1Notes", {
                  value1: integrity.data.noteCount,
                })
              : localizeUi("ui.longTermMemory.memorysettings.value1IntegrityIssueSFound", {
                  value1: integrity.data.issues.length,
                })}
          </StatusSurface>
        ) : null}
        {integrity.data?.issues.length && !integrity.isError ? (
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
                  checked ? [...selectedActions, action.id] : selectedActions.filter((id) => id !== action.id),
                )
              }
            />
          ))}
        </div>
        <Button primary disabled={!selectedActions.length} {...lock} onClick={() => void runRepair()}>
          {localizeUi("ui.longTermMemory.memorysettings.runSelectedMaintenance")}
        </Button>
        <div ref={repairResultBox}>{resultFor("repair")}</div>
      </div>
      <div className="border-t border-[var(--border)] pt-3">
        <div className="flex items-center gap-1">
          <h4 className="text-xs font-semibold">{localizeUi("ui.longTermMemory.memorysettings.identityRepair")}</h4>
          <InfoPopover
            label={localizeUi("ui.longTermMemory.memorysettings.identityRepair")}
            content={localizeUi(
              "ui.longTermMemory.memorysettings.previewDuplicateTrustedIdentitiesBeforeMergingAndArchivingDuplicates",
            )}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button {...lock} onClick={() => void previewIdentities()}>
            {localizeUi("ui.longTermMemory.memorysettings.previewIdentityRepairs")}
          </Button>
          <Button
            destructive
            disabled={selectedIdentityCount === 0 || identitySelectionUnresolved}
            {...lock}
            onClick={() => void applyIdentities()}
          >
            {localizeUi("ui.longTermMemory.memorysettings.applySelectedRepairs", { count: selectedIdentityCount })}
          </Button>
        </div>
        {resultFor("identity", "mt-2")}
        {/* Always mounted, so a finished preview is read out; a new preview clears it first. */}
        <p role="status" data-ltm-identity-preview-summary className={identityPreview ? "mt-3 text-xs" : "sr-only"}>
          {identityPreview ? (
            <>
              {identityPreview.counts.candidateCount} {localizeUi("ui.longTermMemory.memorysettings.candidateGroupS")}{" "}
              {identityPreview.counts.duplicateNotes} {localizeUi("ui.longTermMemory.memorysettings.duplicateNoteS")}{" "}
              {identityPreview.counts.unresolvedNotes} {localizeUi("ui.longTermMemory.memorysettings.unresolved")}
            </>
          ) : null}
        </p>
        {identityPreview ? (
          <div className="mt-2 space-y-2 text-xs">
            {identityPreview.candidates.map((candidate) => (
              <div key={candidate.id} className="space-y-2 rounded border border-[var(--border)] p-3">
                <label className="flex min-h-11 items-start gap-2">
                  <input
                    className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                    type="checkbox"
                    checked={selectedIdentityCandidates.includes(candidate.id)}
                    disabled={candidate.blockingReasons.length > 0}
                    {...lock}
                    onChange={(event) => {
                      if (busy) return;
                      setSelectedIdentityCandidates((current) =>
                        event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id),
                      );
                    }}
                  />
                  <span>
                    <span className="block font-semibold">{joinList(candidate.subjectNames)}</span>
                    <span className="block text-[var(--muted-foreground)]">
                      {candidate.noteType === "relationship"
                        ? localizeUi("ui.longTermMemory.memorysettings.relationship")
                        : localizeUi("ui.longTermMemory.memorysettings.character")}{" "}
                      {localizeUi("ui.longTermMemory.memorysettings.matchVia")}{" "}
                      {joinList(
                        candidate.matchBasis.map((basis) =>
                          localizedLabel(basis, localizeUi, labelKeys.identityMatchBasis),
                        ),
                        "unit",
                      )}
                      .
                    </span>
                  </span>
                </label>
                {candidate.blockingReasons.length ? (
                  <StatusSurface tone="danger">{candidate.blockingReasons.join(" ")}</StatusSurface>
                ) : null}
                <div className="space-y-1 text-[var(--muted-foreground)]">
                  {candidate.notes.map((note) => {
                    const canonical = note.noteId === candidate.canonicalNoteId;
                    return (
                      <div
                        key={note.noteId}
                        className="flex min-h-11 items-start gap-3 rounded border border-[var(--border)] p-2"
                      >
                        <label className="flex items-start gap-2">
                          <input
                            className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                            type="radio"
                            name={`canonical-${candidate.id}`}
                            checked={canonical}
                            disabled={!selectedIdentityCandidates.includes(candidate.id)}
                            {...lock}
                            onChange={() => void selectIdentityCanonical(candidate.id, note.noteId)}
                          />
                          <span className="font-medium text-[var(--foreground)]">
                            {localizeUi("ui.longTermMemory.memorysettings.keepAsCanonical")}
                          </span>
                        </label>
                        <label className="flex min-w-0 flex-1 items-start gap-2">
                          <input
                            className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                            type="checkbox"
                            checked={canonical || (includedIdentityNoteIds[candidate.id] ?? []).includes(note.noteId)}
                            disabled={canonical || !selectedIdentityCandidates.includes(candidate.id)}
                            {...lock}
                            onChange={(event) => {
                              if (busy) return;
                              setIncludedIdentityNoteIds((current) => ({
                                ...current,
                                [candidate.id]: event.target.checked
                                  ? [...(current[candidate.id] ?? []), note.noteId]
                                  : (current[candidate.id] ?? []).filter((id) => id !== note.noteId),
                              }));
                            }}
                          />
                          <span>
                            <span className="block font-medium text-[var(--foreground)]">
                              {canonical
                                ? localizeUi("ui.longTermMemory.memorysettings.canonicalMemory")
                                : localizeUi("ui.longTermMemory.memorysettings.includeDuplicateInMergeAndArchive")}
                              : {note.title}
                            </span>
                            <span className="block">
                              {localizedLabel(note.basis, localizeUi, labelKeys.identityMatchBasis)}
                              {note.alreadyBound ? localizeUi("ui.longTermMemory.memorysettings.alreadyBound") : ""}
                              {note.exactFullName ? localizeUi("ui.longTermMemory.memorysettings.exactFullName") : ""}
                              {localizeUi("ui.longTermMemory.memorysettings.created")}{" "}
                              {new Date(note.createdAt).toLocaleDateString(locale)}
                            </span>
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
                {candidate.additiveContent.length ? (
                  <div className="space-y-1">
                    <p className="font-medium">{localizeUi("ui.longTermMemory.memorysettings.contentToAdd")}</p>
                    {candidate.additiveContent.map((content) => (
                      <p key={content.sectionKey} className="text-[var(--muted-foreground)]">
                        {content.sectionKey}: {content.addedLines.join(" | ")}
                      </p>
                    ))}
                  </div>
                ) : null}
                {candidate.supersedingConflicts.map((conflict) => (
                  <fieldset
                    key={conflict.sectionKey}
                    className="space-y-1 border-t border-[var(--border)] pt-2"
                    disabled={!selectedIdentityCandidates.includes(candidate.id)}
                  >
                    <legend className="font-medium">
                      {localizeUi("ui.longTermMemory.memorysettings.chooseSectionContent", {
                        sectionKey: conflict.sectionKey,
                      })}
                    </legend>
                    {conflict.options.map((option) => {
                      const included = new Set([
                        candidate.canonicalNoteId,
                        ...(includedIdentityNoteIds[candidate.id] ?? []),
                      ]);
                      const noteId = option.noteIds.find((id) => included.has(id));
                      const titles = option.noteIds.map(
                        (id) => candidate.notes.find((note) => note.noteId === id)?.title ?? id,
                      );
                      return (
                        <label
                          key={`${conflict.sectionKey}-${option.noteIds.join(":")}`}
                          className="flex min-h-11 items-start gap-2 rounded border border-[var(--border)] p-2"
                        >
                          <input
                            className={`mt-0.5 ${busy ? "opacity-50" : ""}`}
                            type="radio"
                            name={`${candidate.id}-${conflict.sectionKey}`}
                            disabled={!noteId}
                            {...lock}
                            checked={
                              noteId !== undefined &&
                              option.noteIds.includes(identitySectionChoices[candidate.id]?.[conflict.sectionKey] ?? "")
                            }
                            onChange={() => {
                              if (busy || !noteId) return;
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
                            <span className="block font-medium">{titles.join(", ")}</span>
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
      <div data-ltm-maintenance-group="reset" className="border-t border-[var(--border)] pt-3">
        <h4 className="text-xs font-semibold">{localizeUi("ui.longTermMemory.memorysettings.deleteOrResetGroup")}</h4>
        <div className="mt-2 space-y-3">
          <div>
            {/* No Engine defines a warning color: the strong editor border and an icon carry the tone. */}
            <Button
              ref={resetButton}
              {...lock}
              data-ltm-tone="warning"
              style={{ borderColor: "var(--marinara-editor-border-strong)" }}
              onClick={() => void resetSettings()}
            >
              <TriangleAlert aria-hidden="true" size="0.875rem" />{" "}
              {localizeUi("ui.longTermMemory.memorysettings.resetSettings")}
            </Button>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memorysettings.resetSettingsHint")}
            </p>
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <Button
              ref={deleteButton}
              destructive
              {...lock}
              aria-expanded={deletePromptOpen}
              onClick={() => {
                if (busy) return;
                setDeletePromptOpen(true);
                requestAnimationFrame(() => exportFirstButton.current?.focus());
              }}
            >
              <Trash2 aria-hidden="true" size="0.875rem" />{" "}
              {localizeUi("ui.longTermMemory.memorysettings.deleteAllData")}
            </Button>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memorysettings.deleteAllMemoryDataDescription")}
            </p>
            {deletePromptOpen ? (
              <div
                role="group"
                aria-label={localizeUi("ui.longTermMemory.memorysettings.deleteAllData")}
                aria-describedby="ltm-delete-prompt-text"
                data-ltm-delete-prompt
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !busy) {
                    event.stopPropagation();
                    closeDeletePrompt();
                  }
                }}
                className="mari-editor-panel mari-editor-panel--soft mt-2 space-y-2 p-3 text-xs"
              >
                <p id="ltm-delete-prompt-text">
                  {localizeUi("ui.longTermMemory.memorysettings.exportBackupFirstPrompt")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button ref={exportFirstButton} primary {...lock} onClick={() => void exportBackup("reset")}>
                    <Download aria-hidden="true" size="0.875rem" />{" "}
                    {localizeUi("ui.longTermMemory.memorysettings.exportBackupFirst")}
                  </Button>
                  <Button destructive {...lock} onClick={() => void deleteAll()}>
                    {localizeUi("ui.longTermMemory.memorysettings.continueToDelete")}
                  </Button>
                  <Button {...lock} onClick={closeDeletePrompt}>
                    {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {resultFor("reset", "mt-2")}
      </div>
    </section>
  );
}
