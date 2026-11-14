import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Ellipsis,
  FileInput,
  FolderCog,
  ListChecks,
  RefreshCw,
  ScrollText,
  Sparkles,
} from "lucide-react";
import type {
  LtmImportSourceNotesResponse,
  LtmInteropPreviewResponse,
  LtmInteropPreviewSample,
  LtmLorebookPreviewEntry,
  LtmLorebookPreviewResponse,
  LtmMode,
  LtmSourceDetailsResponse,
  LtmScope,
  LtmExtractSourceNoteResponse,
  LtmExtractionSettingsPatch,
  LtmGlobalSettings,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  errorMessage,
  invalidateLtmQueries,
  fetchSourceDetails,
  mergeSourcePreviewPages,
  mergeLorebookPreviewPages,
  queryKeys,
  request,
  scopeTargetsQueryOptions,
  settingsQueryOptions,
} from "../api";
import {
  Button,
  Chip,
  type ChipTone,
  ClickSurface,
  EmptyState,
  IconButton,
  InfoPopover,
  StatusSurface,
  confirm,
  inputClass,
  lockedActionProps,
  revealFocusUnderStickyBar,
} from "../shared-controls";
import { humanizeLabel, labelKeys, localizedLabel } from "../display-labels";
import { kindIcons } from "../picker";
import type { LongTermMemoryDestinationProps } from "../types";
import { selectLtmPluralForm, useLtmTranslation, type LtmTranslationFunction } from "../localization";
import {
  cancelLtmSourceTask,
  getLtmSourceTaskSnapshot,
  markLtmSourceTaskViewed,
  retryableSourceIds,
  startLtmSourceTask,
  subscribeLtmSourceTask,
  type LtmSourceTaskContract,
} from "../source-task";
import { buildScopeIndexes, type ScopeTargetChat } from "../scope-targets";
import {
  chatOnlyLtmScope,
  getLtmScopeGroupIds,
  ltmModeForChatMode,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import { DEFAULT_LTM_IMPORTED_SOURCE_MODE } from "../../../../../shared/src/features/agents/long-term-memory/constants.js";
import {
  hasDestinationScopeCapacity,
  mergedDestinationScope,
  sourceCheckboxClass,
  sourceCheckboxHitClass,
  sourceModeLabel,
  targetDisplayLabel,
} from "./source-shared";
import type { ScopeTarget, Source, SourceOperation } from "./source-shared";
import { SourceOperationWorkbench } from "./SourceOperationWorkbench";
import { SourceScopeCombobox } from "../SourceScopeCombobox";
import { EntrySelect } from "./EntrySelect";
import { DestinationScopePanel } from "./DestinationScopePanel";
import { ImportedSourceInspector } from "./ImportedSourceInspector";
import {
  SourceCancelButton,
  SourceLoadMore,
  SourceNavigatorBar,
  handleTabKey,
  type SourceStatusFilter,
} from "./SourceNavigatorBar";

type PreviewRow = LtmInteropPreviewResponse["samples"][number];
type LorebookCandidate = LtmInteropPreviewSample;

type ImportContract = {
  source: Source;
  sourceIds: string[];
  action: "import" | "refresh";
  sourceScope?: LtmScope;
  destinationScope?: LtmScope;
  sourceTargetLabel: string;
  destinationTargetLabel: string;
  mode?: LtmMode;
  modes?: LtmMode[];
  chatId?: string;
  selectionKey: string;
};

// Chat Messages comes first and is the tab Sources opens on; messages, characters and lorebooks reuse kindIcons; summaries use ScrollText.
const sourceTabs: Array<{ id: Source; labelKey: string; Icon: LucideIcon }> = [
  {
    id: "messages",
    labelKey: "ui.longTermMemory.sourcesworkspace.chatMessages",
    Icon: kindIcons.group,
  },
  {
    id: "chats",
    labelKey: "ui.longTermMemory.sourcesworkspace.chatSummaries",
    Icon: ScrollText,
  },
  {
    id: "characters",
    labelKey: "ui.longTermMemory.sourcesworkspace.characters",
    Icon: kindIcons.character,
  },
  {
    id: "lorebooks",
    labelKey: "ui.longTermMemory.sourcesworkspace.lorebooks",
    Icon: kindIcons.lorebook,
  },
];

const importStatusLabelKeys: Record<string, string> = {
  created: "ui.longTermMemory.sourcesworkspace.statusCreated",
  refreshed: "ui.longTermMemory.sourcesworkspace.statusRefreshed",
  failed: "ui.longTermMemory.sourcesworkspace.statusFailed",
  incomplete: "ui.longTermMemory.sourcesworkspace.statusIncomplete",
  succeeded: "ui.longTermMemory.sourcesworkspace.statusSucceeded",
  cancelled: "ui.longTermMemory.sourcesworkspace.statusCancelled",
  not_started: "ui.longTermMemory.sourcesworkspace.statusNotStarted",
  success: "ui.longTermMemory.sourcesworkspace.statusSuccess",
  partial_success: "ui.longTermMemory.sourcesworkspace.statusPartialSuccess",
  no_suggestions_created: "ui.longTermMemory.sourcesworkspace.statusNoSuggestionsCreated",
  running: "ui.longTermMemory.sourcesworkspace.statusRunning",
  completed: "ui.longTermMemory.sourcesworkspace.statusCompleted",
};

// The result heading names the batch outcome, so a failed or cancelled batch never reads "complete".
const importResultHeadingKeys: Record<"import" | "refresh", Record<string, string>> = {
  import: {
    success: "ui.longTermMemory.sourcesworkspace.sourceImportComplete",
    partial_success: "ui.longTermMemory.sourcesworkspace.sourceImportFinishedWithIssues",
    failed: "ui.longTermMemory.sourcesworkspace.sourceImportFailed",
    cancelled: "ui.longTermMemory.sourcesworkspace.sourceImportCancelled",
  },
  refresh: {
    success: "ui.longTermMemory.sourcesworkspace.sourceRefreshComplete",
    partial_success: "ui.longTermMemory.sourcesworkspace.sourceRefreshFinishedWithIssues",
    failed: "ui.longTermMemory.sourcesworkspace.sourceRefreshFailed",
    cancelled: "ui.longTermMemory.sourcesworkspace.sourceRefreshCancelled",
  },
};

// The Sources column is its own container: row actions switch between inline and menu on its width.
const sourceColumnStyle = { containerName: "ltm-sources", containerType: "inline-size" } as const;
const regionActionsClass = "flex flex-wrap items-center gap-2 border-y border-[var(--border)] p-3";
// A lorebook's bar sits above its entries, so it pins to the top while they scroll (#1588).
const lorebookRegionActionsClass = `${regionActionsClass} sticky top-0 z-10 bg-[var(--card)]`;

/** Focuses the row that owns a preview, then closes it, so keyboard focus never lands on a removed node. */
function closePreview(from: HTMLElement, close: () => void) {
  const trigger = from
    .closest<HTMLElement>('[role="listitem"]')
    ?.querySelector<HTMLElement>("[data-ltm-source-open], [data-ltm-lorebook-id]");
  close();
  trigger?.focus();
}

function closePreviewOnEscape(event: KeyboardEvent<HTMLElement>, open: boolean, close: () => void) {
  if (event.key !== "Escape" || !open || event.defaultPrevented) return;
  event.preventDefault();
  event.stopPropagation();
  closePreview(event.currentTarget, close);
}

function resultTone(status: string): "neutral" | "success" | "warning" | "danger" {
  return status === "success" || status === "succeeded" || status === "created" || status === "refreshed"
    ? "success"
    : status === "failed" || status === "cancelled"
      ? "danger"
      : status === "partial_success" ||
          status === "incomplete" ||
          status === "no_suggestions_created" ||
          status === "not_started"
        ? "warning"
        : "neutral";
}

function resultChipTone(status: string): ChipTone {
  const tone = resultTone(status);
  return tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "danger" ? "danger" : "neutral";
}

function importStatusLabel(status: string, localizeUi: LtmTranslationFunction) {
  const key = importStatusLabelKeys[status];
  return key ? localizeUi(key) : humanizeLabel(status);
}

function freshnessLabel(freshness: LorebookCandidate["freshness"], localizeUi: LtmTranslationFunction) {
  if (freshness === "source_updated") return localizeUi("ui.longTermMemory.sourcesworkspace.updateAvailable");
  if (freshness === "context_updated") return localizeUi("ui.longTermMemory.sourcesworkspace.contextChanged");
  if (freshness === "extraction_incomplete")
    return localizeUi("ui.longTermMemory.sourcesworkspace.extractionIncomplete");
  if (freshness === "current") return localizeUi("ui.longTermMemory.sourcesworkspace.current");
  return localizeUi("ui.longTermMemory.sourcesworkspace.new");
}

function sourceStatusLabel(row: PreviewRow, localizeUi: LtmTranslationFunction) {
  return freshnessLabel(row.freshness, localizeUi);
}

function modeList(modes: readonly LtmMode[], localizeUi: LtmTranslationFunction) {
  return modes.map((mode) => localizedLabel(mode, localizeUi, labelKeys.mode)).join(", ");
}

function entryStatusLabel(entry: LtmLorebookPreviewEntry, localizeUi: LtmTranslationFunction) {
  const labels = new Set(entry.candidates.map((candidate) => freshnessLabel(candidate.freshness, localizeUi)));
  return labels.size === 1 ? [...labels][0] : localizeUi("ui.longTermMemory.sourcesworkspace.mixed");
}

function entryStatusTone(entry: LtmLorebookPreviewEntry): ChipTone {
  const statusByFreshness: Record<LorebookCandidate["freshness"], string> = {
    new: "unknown",
    current: "success",
    source_updated: "partial_success",
    context_updated: "partial_success",
    extraction_incomplete: "partial_success",
  };
  const statuses = entry.candidates.map((candidate) => statusByFreshness[candidate.freshness]);
  return resultChipTone(
    statuses.includes("partial_success") ? "partial_success" : statuses.includes("unknown") ? "unknown" : "success",
  );
}

function extractionResultLabel(
  item: LtmImportSourceNotesResponse["imported"][number],
  localizeUi: LtmTranslationFunction,
) {
  if (item.extractionStatus === "not_started")
    return localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshedExtractionNotRun");
  if (item.extractionStatus === "incomplete")
    return localizeUi("ui.longTermMemory.sourcesworkspace.extractionIncomplete");
  if (item.extractionStatus !== "succeeded")
    return localizeUi("ui.longTermMemory.sourcesworkspace.extractionDidNotFinish");
  if (item.outcome.state === "partial_success")
    return localizeUi("ui.longTermMemory.sourcesworkspace.readyForReviewWithRejectedSuggestions");
  if (item.outcome.state === "no_suggestions_created")
    return localizeUi("ui.longTermMemory.sourcesworkspace.noMemoriesSuggested");
  return localizeUi("ui.longTermMemory.sourcesworkspace.readyForReview");
}

/** True when two preview keys differ only in their trailing search text. */
function onlySearchDiffers(previous: readonly unknown[] | undefined, key: readonly unknown[]) {
  return previous !== undefined && JSON.stringify(previous.slice(0, -1)) === JSON.stringify(key.slice(0, -1));
}

export default function SourcesWorkspace({
  props,
  onOpenMemory,
  onOpenReview,
  requestedSource,
  onRequestedSourceHandled,
  selectedSource,
  onSourceChange,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const entryCountLabel = (count: number) =>
    localizeUi(
      selectLtmPluralForm(locale, count) === "one"
        ? "ui.longTermMemory.sourcesworkspace.lorebookEntryCountOne"
        : "ui.longTermMemory.sourcesworkspace.lorebookEntryCountOther",
      { count },
    );
  const sourceCountLabel = (count: number) =>
    localizeUi(
      selectLtmPluralForm(locale, count) === "one"
        ? "ui.longTermMemory.sourcesworkspace.sourceCountOne"
        : "ui.longTermMemory.sourcesworkspace.sourceCountOther",
      { count },
    );
  const confirmAction = props.confirmAction;
  const localization = props.localization;
  const sourceScopeLabelId = useId();
  const sourceScopeHintId = useId();
  const importResultLabelId = useId();
  const importDetailLabelId = useId();
  const importReasonId = useId();
  const importLockId = useId();
  const availabilityWaitId = useId();
  const reimportDescriptionId = `${importReasonId}-reimport`;
  const client = useQueryClient();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const lorebookBarRef = useRef<HTMLDivElement>(null);
  const importResultRef = useRef<HTMLElement>(null);
  const sourceTask = useSyncExternalStore(subscribeLtmSourceTask, getLtmSourceTaskSnapshot, getLtmSourceTaskSnapshot);
  const [source, setSource] = useState<Source>(selectedSource ?? "messages");
  const [selectedLorebookId, setSelectedLorebookId] = useState<string | null>(null);
  const [requestedSourceNoteId, setRequestedSourceNoteId] = useState<string | null>(null);
  const [sourceContextKey, setSourceContextKey] = useState(props.chatId ?? "all");
  const [sourceTargetId, setSourceTargetId] = useState(props.chatId ? `chat:${props.chatId}` : "all");
  const [selectedDestinationTargetIds, setSelectedDestinationTargetIds] = useState<string[]>(
    props.chatId ? [`chat:${props.chatId}`] : [],
  );
  // Until the person picks a destination, it follows the source: this chat, or the character or persona being browsed.
  const [destinationTouched, setDestinationTouched] = useState(false);
  const [modeFilter, setModeFilter] = useState<LtmMode | "all">("all");
  // Chat Messages branch: null follows the current chat, "" lists every branch, else a chat id.
  const [branchPick, setBranchPick] = useState<string | null>(null);
  const [customAvailabilityModes, setCustomAvailabilityModes] = useState<LtmMode[] | null>(null);
  const [modesError, setModesError] = useState("");
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const availabilitySavingRef = useRef(false);
  const [sourceQuery, setSourceQuery] = useState("");
  // The previews search by the settled text, so typing sends one request per pause instead of one per keystroke.
  const [committedSourceQuery, setCommittedSourceQuery] = useState("");
  const [sourceStatusFilter, setSourceStatusFilter] = useState<SourceStatusFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [sourceGroupsOpen, setSourceGroupsOpen] = useState<Record<Source, { ready: boolean; imported: boolean }>>({
    chats: { ready: true, imported: false },
    messages: { ready: true, imported: false },
    characters: { ready: true, imported: false },
    lorebooks: { ready: true, imported: false },
  });
  const sourceGroupsBeforeSearch = useRef<Record<Source, { ready: boolean; imported: boolean }> | null>(null);
  const sourceSearchContext = useRef<Source | null>(null);
  const sourceQueryByType = useRef<Record<Source, string>>({ chats: "", messages: "", characters: "", lorebooks: "" });
  const sourceStatusByType = useRef<Record<Source, SourceStatusFilter>>({
    chats: "all",
    messages: "all",
    characters: "all",
    lorebooks: "all",
  });
  const focusedSourceByType = useRef<Record<Source, string | null>>({
    chats: null,
    messages: null,
    characters: null,
    lorebooks: null,
  });
  const focusedLorebookByType = useRef<Record<Source, string | null>>({
    chats: null,
    messages: null,
    characters: null,
    lorebooks: null,
  });
  const openLorebookEntryByType = useRef<Record<Source, string | null>>({
    chats: null,
    messages: null,
    characters: null,
    lorebooks: null,
  });
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [focusedFlatSourceId, setFocusedFlatSourceId] = useState<string | null>(null);
  const [openLorebookEntryId, setOpenLorebookEntryId] = useState<string | null>(null);
  const [importError, setImportError] = useState("");
  const [latestTaskResultOpen, setLatestTaskResultOpen] = useState(false);
  const [dismissedTaskResultId, setDismissedTaskResultId] = useState<string | null>(null);
  const [resultWorkbenchHost, setResultWorkbenchHost] = useState<HTMLDivElement | null>(null);
  const [sourceOperation, setSourceOperation] = useState<{
    id: string;
    title: string;
    operation?: SourceOperation;
  } | null>(null);
  const [openSourceActionId, setOpenSourceActionId] = useState<string | null>(null);
  const sourceOperationTriggerRef = useRef<HTMLElement | null>(null);
  // The trigger is the pressed button, not the focused element: a click that does not focus its button
  // (Safari) leaves focus wherever it was, such as the search field.
  const openSourceOperation = (
    next: { id: string; title: string; operation?: SourceOperation },
    trigger: HTMLElement,
  ) => {
    sourceOperationTriggerRef.current = trigger;
    setSourceOperation(next);
  };
  // The operation panel hides the workbench, including an inline Manage button, so Close returns
  // to the pane that held the trigger and focuses it once it shows again. A trigger from the
  // closed phone menu is gone; that row's Manage or More actions button stands in, and after a
  // move, archive or delete removed the row, the selected source tab.
  const closeSourceOperation = () => {
    const trigger = sourceOperationTriggerRef.current;
    const noteId = sourceOperation?.id;
    sourceOperationTriggerRef.current = null;
    setSourceOperation(null);
    requestAnimationFrame(() => {
      const visible = (element: HTMLElement | null | undefined): element is HTMLElement =>
        Boolean(element?.isConnected && element.getClientRects().length);
      [
        trigger,
        ...(noteId
          ? document.querySelectorAll<HTMLElement>(
              `[data-ltm-surface="sources"] [data-ltm-source-action="manage"][data-ltm-source-note-id="${CSS.escape(noteId)}"], [data-ltm-surface="sources"] [data-ltm-source-more="${CSS.escape(noteId)}"]`,
            )
          : []),
        document.querySelector<HTMLElement>('[data-ltm-surface="sources"] [data-ltm-source-tab][aria-selected="true"]'),
      ]
        .find(visible)
        ?.focus();
    });
  };
  const importing =
    sourceTask.active?.status === "running" &&
    (sourceTask.active.kind === "import" || sourceTask.active.kind === "refresh");
  const extractingId =
    sourceTask.active?.status === "running" && sourceTask.active.kind === "re-extract"
      ? (sourceTask.active.contract.sourceIds[0] ?? null)
      : null;
  const importTask =
    sourceTask.active?.kind === "import" || sourceTask.active?.kind === "refresh"
      ? sourceTask.active
      : sourceTask.latest?.kind === "import" || sourceTask.latest?.kind === "refresh"
        ? sourceTask.latest
        : null;
  const importResult = importTask?.status === "completed" ? (importTask.result as LtmImportSourceNotesResponse) : null;
  const visibleImportResult = importTask?.id === dismissedTaskResultId ? null : importResult;
  const importResultContract = importTask?.contract as ImportContract | null;
  const cancelledImport = importTask?.status === "cancelled" ? importResultContract : null;
  const reextractTask =
    sourceTask.active?.kind === "re-extract"
      ? sourceTask.active
      : sourceTask.latest?.kind === "re-extract"
        ? sourceTask.latest
        : null;
  const reextractResult =
    reextractTask?.status === "completed" ? (reextractTask.result as LtmExtractSourceNoteResponse | undefined) : null;
  const retryableReextract =
    reextractTask?.status === "failed" || reextractTask?.status === "cancelled" ? reextractTask : null;
  const failedSourceTask =
    importTask && (importTask.status === "failed" || importTask.status === "cancelled")
      ? importTask
      : reextractTask && (reextractTask.status === "failed" || reextractTask.status === "cancelled")
        ? reextractTask
        : null;
  const sourceTaskError = failedSourceTask?.error?.message
    ? failedSourceTask.error.message
    : failedSourceTask?.error?.code === "interrupted"
      ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskInterrupted")
      : failedSourceTask?.error?.code === "cancelled"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskCancelled")
        : failedSourceTask
          ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceTaskFailed")
          : "";

  const scopeTargets = useQuery(scopeTargetsQueryOptions(props.chatId));
  const settingsQuery = useQuery(settingsQueryOptions);
  const extractionSettingsQuery = useQuery({
    queryKey: queryKeys.extractionSettings,
    queryFn: () => request<LtmExtractionSettingsPatch>("/extraction-settings"),
  });
  const importDetailSavingRef = useRef(false);
  const [importDetailSaving, setImportDetailSaving] = useState(false);
  const importDetail = extractionSettingsQuery.data?.chatImportDetail ?? "standard";
  // Saved on its own like Availability: the other extraction settings stay as they are on the server.
  const changeImportDetail = async (next: "standard" | "detailed") => {
    // A locked button still fires on Enter and Space, and a same-turn second press reads stale state, so the
    // handler guards itself: no change while an import runs, one save at a time.
    if (next === importDetail || importDisabled || importDetailSavingRef.current || !extractionSettingsQuery.isSuccess)
      return;
    importDetailSavingRef.current = true;
    setImportDetailSaving(true);
    try {
      await request<LtmExtractionSettingsPatch>("/extraction-settings", "PUT", { chatImportDetail: next });
      await invalidateLtmQueries(client, [queryKeys.extractionSettings]);
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.sourcesworkspace.couldNotSaveImportDetail")));
    } finally {
      importDetailSavingRef.current = false;
      setImportDetailSaving(false);
    }
  };

  const defaultAvailabilityMode: LtmMode =
    modeFilter !== "all"
      ? modeFilter
      : source === "chats" || source === "messages"
        ? ltmModeForChatMode(props.chatMode ?? "conversation")
        : DEFAULT_LTM_IMPORTED_SOURCE_MODE;
  const effectiveAvailabilityModes: LtmMode[] =
    customAvailabilityModes ??
    (settingsQuery.data?.sourcesAvailabilityModes?.length
      ? settingsQuery.data.sourcesAvailabilityModes
      : [defaultAvailabilityMode]);
  const availabilityReady = settingsQuery.isSuccess && effectiveAvailabilityModes.length > 0;
  // The lock note is only filled while a run is active, so only a run points `aria-describedby` at it.
  const importRunning = sourceTask.active?.status === "running";
  const importDisabled = !availabilityReady || availabilitySaving || importRunning;
  const importActionProps = lockedActionProps(importDisabled, importRunning ? importLockId : undefined);
  // Re-extract shares the import lock: a run of either kind holds it, and the reason line says which.
  const reextractLocked = importRunning || !availabilityReady;
  // While settings load there is no run, so the reason is the loading line itself.
  const reextractReasonId = importRunning ? importLockId : !availabilityReady ? availabilityWaitId : undefined;
  const reextractActionProps = lockedActionProps(reextractLocked, reextractReasonId);

  const changeAvailabilityModes = async (nextModes: LtmMode[]) => {
    if (!nextModes.length || !availabilityReady || availabilitySavingRef.current) return;
    availabilitySavingRef.current = true;
    setAvailabilitySaving(true);
    setModesError("");
    setCustomAvailabilityModes(nextModes);
    try {
      await request<LtmGlobalSettings>("/settings", "PUT", {
        sourcesAvailabilityModes: nextModes,
      });
      await invalidateLtmQueries(client, [queryKeys.settings, queryKeys.chatDefaults]);
    } catch (error) {
      setCustomAvailabilityModes(null);
      setModesError(errorMessage(error, localizeUi("ui.longTermMemory.memoryvault.couldNotSaveAvailability")));
      await settingsQuery.refetch();
    } finally {
      availabilitySavingRef.current = false;
      setAvailabilitySaving(false);
    }
  };
  const scopeIndexes = useMemo(() => buildScopeIndexes(scopeTargets.data?.chats ?? []), [scopeTargets.data?.chats]);
  // A row names its chat only by title, so "who" is known when exactly one chat in the scope list has that name.
  const chatsByName = useMemo(() => {
    const byName = new Map<string, ScopeTargetChat[]>();
    for (const chat of scopeTargets.data?.chats ?? []) {
      for (const name of new Set([chat.label, chat.chatName].filter((value): value is string => Boolean(value)))) {
        byName.set(name, [...(byName.get(name) ?? []), chat]);
      }
    }
    return byName;
  }, [scopeTargets.data?.chats]);
  const characterLabelById = useMemo(
    () => new Map((scopeTargets.data?.characters ?? []).map((character) => [character.id, character.label])),
    [scopeTargets.data?.characters],
  );
  const scopeTargetOptions = useMemo((): ScopeTarget[] => {
    const currentChatId = props.chatId ?? scopeTargets.data?.currentScope?.chatId;
    const chatTarget = (chat: ScopeTargetChat, current = false): ScopeTarget => ({
      id: `chat:${chat.id}`,
      label: current ? localizeUi("ui.longTermMemory.sourcesworkspace.current") : chat.label,
      comment: current ? chat.label : undefined,
      kind: "chat",
      sourceScope: current ? (scopeTargets.data?.currentScope ?? chatOnlyLtmScope(chat.id)) : chatOnlyLtmScope(chat.id),
      destinationScope: chatOnlyLtmScope(chat.id),
      searchText: [chat.label, chat.mode, chat.groupId, chat.personaId, ...chat.characterIds].filter(Boolean).join(" "),
      ...(current ? { pinned: "current" as const } : {}),
    });
    return [
      ...(currentChatId
        ? [
            chatTarget(
              scopeIndexes.chatsById.get(currentChatId) ?? {
                id: currentChatId,
                label: props.chatName ?? localizeUi("ui.longTermMemory.sourcesworkspace.currentChat"),
                mode: "roleplay",
                groupId: null,
                personaId: null,
                characterIds: [],
              },
              true,
            ),
          ]
        : []),
      {
        id: "all",
        label: localizeUi("ui.longTermMemory.sourcesworkspace.all"),
        kind: "all" as const,
        pinned: "all" as const,
        sourceScope: undefined,
        destinationScope: undefined,
      },
      ...(scopeTargets.data?.chats ?? [])
        .filter((chat) => chat.id !== currentChatId && !chat.groupId)
        .map((chat) => chatTarget(chat)),
      ...(scopeTargets.data?.groups ?? []).map((group) => {
        const memberDisplayNames = group.chatIds.map((id) => scopeIndexes.chatsById.get(id)?.label).filter(Boolean);
        return {
          id: `group:${group.id}`,
          label: group.label,
          comment: localizeUi("ui.longTermMemory.sourcesworkspace.allBranches"),
          kind: "chat" as const,
          sourceScope: { groupId: group.id, groupIds: [group.id], chatIds: group.chatIds },
          destinationScope: { groupId: group.id, groupIds: [group.id], chatIds: group.chatIds },
          searchText: [group.label, ...memberDisplayNames, ...group.chatIds].join(" "),
        };
      }),
      ...(scopeTargets.data?.characters ?? []).map((character) => ({
        id: `character:${character.id}`,
        label: character.label,
        comment: character.comment,
        destinationLabel: localizeUi("ui.longTermMemory.sourcesworkspace.characterAvailability", {
          value1: character.label,
        }),
        kind: "character" as const,
        sourceScope: { characterIds: [character.id] },
        destinationScope: { characterIds: [character.id] },
      })),
      ...(scopeTargets.data?.personas ?? []).map((persona) => ({
        id: `persona:${persona.id}`,
        label: persona.label,
        comment: persona.comment,
        destinationLabel: localizeUi("ui.longTermMemory.sourcesworkspace.personaAvailability", {
          value1: persona.label,
        }),
        kind: "persona" as const,
        sourceScope: { personaId: persona.id, personaIds: [persona.id] },
        destinationScope: { personaId: persona.id, personaIds: [persona.id] },
      })),
    ].filter((target, index, targets) => targets.findIndex((item) => item.id === target.id) === index);
  }, [localizeUi, props.chatId, props.chatName, scopeIndexes.chatsById, scopeTargets.data]);
  const sourceTarget =
    scopeTargetOptions.find((target) => target.id === sourceTargetId) ??
    scopeTargetOptions.find((target) => target.id === "all") ??
    scopeTargetOptions[0];
  const sourceContextMatchesProps = sourceContextKey === (props.chatId ?? "all");
  const sourceTargetResolved = Boolean(sourceTarget && scopeTargets.isSuccess);
  const destinationTargets = useMemo(
    () =>
      scopeTargetOptions.filter(
        (target) => target.kind !== "all" && hasDestinationScopeCapacity(target.destinationScope),
      ),
    [scopeTargetOptions],
  );
  const selectedDestinationTargets = selectedDestinationTargetIds.flatMap((id) => {
    const target = destinationTargets.find((item) => item.id === id);
    return target ? [target] : [];
  });
  const currentDestinationScope = mergedDestinationScope(selectedDestinationTargets);
  // While Import and Refresh wait for a destination they stay focusable, so the bar's screen-reader-only reason is
  // read as their description; a click does nothing.
  const destinationReasonId = `${importReasonId}-destination`;
  const destinationWait = () =>
    currentDestinationScope
      ? {}
      : ({
          "aria-disabled": true,
          "aria-describedby": importRunning ? `${importLockId} ${destinationReasonId}` : destinationReasonId,
          className: "opacity-50",
        } as const);
  const currentDestinationLabel = selectedDestinationTargets.length
    ? selectedDestinationTargets.map((target) => targetDisplayLabel(target, true)).join(", ")
    : localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestination");
  const sourceScope = sourceTarget?.sourceScope;
  const previewScope = source === "chats" || source === "messages" ? sourceScope : undefined;
  // Branches are the chats of one group; the list is the shared history plus the picked branch's own pieces.
  const branchGroupIds = getLtmScopeGroupIds(previewScope);
  const groupChats = (
    branchGroupIds.length === 1
      ? (scopeTargets.data?.groups.find((group) => group.id === branchGroupIds[0])?.chatIds ?? [])
      : []
  ).flatMap((id) => scopeIndexes.chatsById.get(id) ?? []);
  const branchChats = source === "messages" ? groupChats : [];
  const currentBranchId = branchChats.find((chat) => chat.id === props.chatId)?.id;
  const branchChatId =
    branchChats.length < 2 || branchPick === ""
      ? undefined
      : (branchChats.find((chat) => chat.id === branchPick)?.id ?? currentBranchId);
  const previewQueryKey = [
    ...queryKeys.preview,
    "pages",
    source,
    previewScope,
    modeFilter,
    branchChatId,
    committedSourceQuery,
  ];
  const lorebookPreviewQueryKey = [
    ...queryKeys.lorebookPreview,
    "pages",
    previewScope,
    modeFilter,
    committedSourceQuery,
  ];
  const previewEnabled = sourceContextMatchesProps && sourceTargetResolved && source !== "lorebooks";
  const lorebookPreviewEnabled = sourceContextMatchesProps && sourceTargetResolved && source === "lorebooks";
  const preview = useInfiniteQuery({
    queryKey: previewQueryKey,
    // A new search keeps the rows on screen until its results arrive, instead of emptying the list.
    placeholderData: (previous, previousQuery) =>
      previewEnabled && onlySearchDiffers(previousQuery?.queryKey, previewQueryKey) ? previous : undefined,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: LtmInteropPreviewResponse) => lastPage.nextCursor ?? undefined,
    queryFn: ({ pageParam, signal }) =>
      request<
        LtmInteropPreviewResponse,
        {
          source: Source;
          limit: number;
          sourceScope?: LtmScope;
          mode?: LtmMode;
          branchChatId?: string;
          query?: string;
          cursor?: string;
        }
      >(
        "/import/preview",
        "POST",
        {
          source,
          limit: 100,
          ...(pageParam ? { cursor: pageParam } : {}),
          ...(previewScope ? { sourceScope: previewScope } : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
          ...(branchChatId ? { branchChatId } : {}),
          ...(committedSourceQuery.trim() ? { query: committedSourceQuery } : {}),
        },
        signal,
      ),
    enabled: previewEnabled,
  });
  const lorebookPreview = useInfiniteQuery({
    queryKey: lorebookPreviewQueryKey,
    placeholderData: (previous, previousQuery) =>
      lorebookPreviewEnabled && onlySearchDiffers(previousQuery?.queryKey, lorebookPreviewQueryKey)
        ? previous
        : undefined,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: LtmLorebookPreviewResponse) => lastPage.nextCursor ?? undefined,
    queryFn: ({ pageParam, signal }) =>
      request<
        LtmLorebookPreviewResponse,
        { limit: number; sourceScope?: LtmScope; mode?: LtmMode; query?: string; cursor?: string }
      >(
        "/import/lorebooks/preview",
        "POST",
        {
          limit: 100,
          ...(pageParam ? { cursor: pageParam } : {}),
          ...(previewScope ? { sourceScope: previewScope } : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
          ...(committedSourceQuery.trim() ? { query: committedSourceQuery } : {}),
        },
        signal,
      ),
    enabled: lorebookPreviewEnabled,
  });
  // Messages and summaries of one chat tell the same story, so the messages list says when summaries exist too.
  const summaryCheck = useQuery({
    queryKey: [...queryKeys.preview, "summary-check", previewScope],
    queryFn: ({ signal }) =>
      request<LtmInteropPreviewResponse, { source: Source; limit: number; sourceScope?: LtmScope }>(
        "/import/preview",
        "POST",
        { source: "chats", limit: 1, sourceScope: previewScope },
        signal,
      ),
    enabled: previewEnabled && source === "messages" && previewScope !== undefined,
  });
  const sourceDetails = useQuery({
    queryKey: [...queryKeys.preview, "details", source, previewScope, modeFilter, focusedFlatSourceId],
    queryFn: () =>
      request<
        LtmSourceDetailsResponse,
        { source: Source; sourceIds: string[]; sourceScope?: LtmScope; mode?: LtmMode }
      >("/import/source-details", "POST", {
        source,
        sourceIds: [focusedFlatSourceId!],
        ...(previewScope ? { sourceScope: previewScope } : {}),
        ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      }),
    enabled:
      scopeTargets.isSuccess &&
      Boolean(sourceTarget) &&
      sourceContextMatchesProps &&
      sourceTargetResolved &&
      source !== "lorebooks" &&
      focusedFlatSourceId !== null,
  });
  const mergedPreview = useMemo(() => mergeSourcePreviewPages(preview.data?.pages), [preview.data?.pages]);
  const mergedLorebookPreview = useMemo(
    () => mergeLorebookPreviewPages(lorebookPreview.data?.pages),
    [lorebookPreview.data?.pages],
  );
  const previewData = sourceContextMatchesProps && sourceTargetResolved ? mergedPreview : undefined;
  const lorebookPreviewData = sourceContextMatchesProps && sourceTargetResolved ? mergedLorebookPreview : undefined;
  const sourceDetailsData = sourceContextMatchesProps && sourceTargetResolved ? sourceDetails.data : undefined;
  const rows = [...(previewData?.samples ?? [])].sort((left, right) => {
    if ((source !== "chats" && source !== "messages") || !props.chatId) return 0;
    return (
      Number(!left.sourceId.startsWith(`${props.chatId}:`)) - Number(!right.sourceId.startsWith(`${props.chatId}:`))
    );
  });
  const importedRows = rows.filter((row) => row.status === "imported");
  // The ticks belong to the source being browsed, not to where the memories will go: choosing a destination
  // must not drop them.
  const selectionKey = `${source}:${sourceTargetId}:${modeFilter}`;
  const selectedIds = new Set(selections[selectionKey] ?? []);
  const importedSelectionKey = `${selectionKey}:imported`;
  const selectedImportedIds = new Set(selections[importedSelectionKey] ?? []);
  const retryableIds = importResult ? retryableSourceIds(importResult) : [];
  const retryableIdSet = new Set(retryableIds);
  const selectableRows = rows.filter((row) => row.status === "pending" || retryableIdSet.has(row.sourceId));
  const lorebookImportSelectionKey = `${selectionKey}:lorebook-import`;
  const lorebookRefreshSelectionKey = `${selectionKey}:lorebook-refresh`;
  const selectedLorebookImportIds = new Set(selections[lorebookImportSelectionKey] ?? []);
  const selectedLorebookRefreshIds = new Set(selections[lorebookRefreshSelectionKey] ?? []);
  const selectedLorebook = lorebookPreviewData?.books.find((book) => book.id === selectedLorebookId) ?? null;
  const selectedBookImportIds =
    selectedLorebook?.entries
      .flatMap((entry) => entry.candidates)
      .filter((candidate) => candidate.status === "pending" && selectedLorebookImportIds.has(candidate.sourceId))
      .map((candidate) => candidate.sourceId) ?? [];
  const selectedBookRefreshIds =
    selectedLorebook?.entries
      .flatMap((entry) => entry.candidates)
      .filter((candidate) => candidate.status === "imported" && selectedLorebookRefreshIds.has(candidate.sourceId))
      .map((candidate) => candidate.sourceId) ?? [];
  const selectedLorebookCandidateIds = new Set([...selectedLorebookImportIds, ...selectedLorebookRefreshIds]);
  const activeFlatRows =
    sourceStatusFilter === "ready" ? selectableRows : sourceStatusFilter === "imported" ? importedRows : rows;
  const activeFlatSelection = new Set([...selectedIds, ...selectedImportedIds]);
  const selectedFlatSourceIds = [...new Set([...selectedIds, ...selectedImportedIds])];
  const activeFlatSelectedIds = activeFlatRows
    .filter((row) => activeFlatSelection.has(row.sourceId))
    .map((row) => row.sourceId);
  const activeFlatAllSelected = activeFlatRows.length > 0 && activeFlatSelectedIds.length === activeFlatRows.length;
  const focusedFlatDetail =
    sourceDetailsData?.details.find((detail) => detail.sourceId === focusedFlatSourceId) ?? null;
  const openLorebookEntry = selectedLorebook?.entries.find((entry) => entry.id === openLorebookEntryId);
  const openLorebookSourceIds = openLorebookEntry?.candidates.map((candidate) => candidate.sourceId) ?? [];
  const lorebookDetails = useQuery({
    queryKey: [...queryKeys.lorebookPreview, "details", previewScope, modeFilter, openLorebookSourceIds],
    queryFn: ({ signal }) =>
      fetchSourceDetails(
        {
          source: "lorebooks",
          sourceIds: openLorebookSourceIds,
          ...(previewScope ? { sourceScope: previewScope } : {}),
          ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
        },
        signal,
      ),
    enabled: source === "lorebooks" && openLorebookSourceIds.length > 0,
  });
  const allLorebooks = useMemo(() => lorebookPreviewData?.books ?? [], [lorebookPreviewData]);
  const activeLorebooks = allLorebooks.filter((book) =>
    sourceStatusFilter === "all"
      ? true
      : sourceStatusFilter === "ready"
        ? book.totals.pending > 0
        : book.totals.pending === 0 && book.totals.imported > 0,
  );
  const focusedLorebookCandidate = openLorebookEntry?.candidates.find((candidate) => candidate.status === "imported");
  const bulkSelectionActive = selectedFlatSourceIds.length > 0 || selectedLorebookCandidateIds.size > 0;
  const selectionCount = source === "lorebooks" ? selectedLorebookCandidateIds.size : selectedFlatSourceIds.length;
  const pendingDraftsProduced = Boolean(
    importResult?.imported.some(
      (item) =>
        (item.extractionStatus === "succeeded" || item.extractionStatus === "incomplete") &&
        item.draft?.status === "pending",
    ),
  );
  const proposalCount =
    importResult?.imported.reduce((count, item) => count + (item.draft?.mutations.length ?? 0), 0) ?? 0;
  const appliedCount = importResult?.imported.reduce((count, item) => count + item.appliedMutationIds.length, 0) ?? 0;
  const pendingProposalCount =
    importResult?.imported.reduce(
      (count, item) => count + (item.draft?.status === "pending" ? item.draft.mutations.length : 0),
      0,
    ) ?? 0;
  const importResultMessage = !importResult
    ? ""
    : importResult.counts.sourceNotesWritten === 0
      ? localizeUi("ui.longTermMemory.sourcesworkspace.importFailedBeforeSaving")
      : importResultContract?.action === "refresh" &&
          !importResult.counts.failed &&
          !importResult.counts.cancelled &&
          !importResult.counts.missing &&
          !importResult.counts.sourceWriteFailed
        ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshedExtractionNotRun")
        : importResultContract?.action === "refresh"
          ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshCompletedWithFailures")
          : importResult.counts.failed || importResult.counts.cancelled
            ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceSavedExtractionFailed")
            : appliedCount
              ? localizeUi(
                  pendingProposalCount
                    ? "ui.longTermMemory.sourcesworkspace.sourceSavedProposalsAccepted"
                    : "ui.longTermMemory.sourcesworkspace.sourceSavedAllProposalsAccepted",
                  { applied: appliedCount, count: pendingProposalCount },
                )
              : proposalCount
                ? localizeUi("ui.longTermMemory.sourcesworkspace.sourceSavedProposalsReady", {
                    count: proposalCount,
                  })
                : localizeUi("ui.longTermMemory.sourcesworkspace.sourceSavedNoProposals");
  const importCleanlyWaitingInReview =
    importResult !== null &&
    importResult !== undefined &&
    importResultContract?.action !== "refresh" &&
    importResult.batchStatus === "success" &&
    appliedCount === 0 &&
    pendingProposalCount > 0;
  const importResultOutcome = importCleanlyWaitingInReview
    ? localizeUi(
        selectLtmPluralForm(locale, pendingProposalCount) === "one"
          ? "ui.longTermMemory.sourcesworkspace.importDoneInReviewOne"
          : "ui.longTermMemory.sourcesworkspace.importDoneInReviewOther",
        { count: pendingProposalCount },
      )
    : importResultMessage;
  const importResultHeading = importResult
    ? localizeUi(
        importResultHeadingKeys[importResultContract?.action === "refresh" ? "refresh" : "import"][
          importResult.batchStatus
        ] ?? "ui.longTermMemory.sourcesworkspace.sourceImportComplete",
      )
    : "";
  const importResultSummary = importResult
    ? localizeUi("ui.longTermMemory.sourcesworkspace.importResultSummary", {
        requested: importResult.counts.requested,
        wrote: importResult.counts.sourceNotesWritten,
        succeeded: importResult.counts.succeeded,
        failed: importResult.counts.failed,
        cancelled: importResult.counts.cancelled,
        missing: importResult.counts.missing,
        writeFailures: importResult.counts.sourceWriteFailed,
      })
    : "";
  const importScopeResultMessage = importResultContract
    ? localizeUi("ui.longTermMemory.sourcesworkspace.importScopeResult", {
        source: importResultContract.sourceTargetLabel,
        destination: importResultContract.destinationTargetLabel,
      })
    : "";
  const activeSourceTask = sourceTask.active?.status === "running" ? sourceTask.active : null;
  const sourceTaskProgressMessage = activeSourceTask
    ? activeSourceTask.kind === "import"
      ? localizeUi("ui.longTermMemory.sourcesworkspace.importingSources", { count: activeSourceTask.sourceCount })
      : activeSourceTask.kind === "refresh"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.refreshingSources", { count: activeSourceTask.sourceCount })
        : localizeUi("ui.longTermMemory.sourcesworkspace.reExtractingSources", {
            count: activeSourceTask.sourceCount,
          })
    : "";
  const latestSourceTask = sourceTask.latest;
  const latestSourceTaskId = latestSourceTask?.id;
  const latestSourceTaskLabel = latestSourceTask
    ? latestSourceTask.kind === "import"
      ? localizeUi("ui.longTermMemory.sourcesworkspace.lastImport")
      : latestSourceTask.kind === "refresh"
        ? localizeUi("ui.longTermMemory.sourcesworkspace.lastRefresh")
        : localizeUi("ui.longTermMemory.sourcesworkspace.lastReExtract")
    : "";
  const latestSourceTaskStatus = latestSourceTask
    ? importStatusLabel(
        latestSourceTask.status === "completed" && latestSourceTask.safeResult?.batchStatus
          ? latestSourceTask.safeResult.batchStatus
          : latestSourceTask.status,
        localizeUi,
      )
    : "";
  const closeTaskResult = () => {
    if (latestSourceTask) setDismissedTaskResultId(latestSourceTask.id);
    setLatestTaskResultOpen(false);
  };
  const reextractResultPanel =
    reextractTask?.status === "completed" &&
    reextractTask.id !== dismissedTaskResultId &&
    (reextractResult || latestTaskResultOpen) ? (
      <section
        ref={importResultRef}
        className="space-y-2 border-t border-[var(--border)] p-4"
        data-ltm-reextract-result
        data-ltm-source-task-result-workbench
      >
        <StatusSurface tone="success">
          {reextractResult?.outcome.totalCandidates
            ? localizeUi("ui.longTermMemory.sourcesworkspace.extractionCompletedReviewReady")
            : localizeUi("ui.longTermMemory.sourcesworkspace.extractionCompleted")}
        </StatusSurface>
        <p className="text-xs text-[var(--muted-foreground)]" data-ltm-extraction-accounting>
          {localizeUi("ui.longTermMemory.sourcesworkspace.suggestionsKeptOfTotal", {
            kept: reextractResult?.outcome.keptUnits ?? reextractTask.safeResult?.counts?.keptUnits ?? 0,
            total: reextractResult?.outcome.totalCandidates ?? reextractTask.safeResult?.counts?.totalCandidates ?? 0,
          })}
        </p>
        {reextractTask.contract.sourceIds[0] && onOpenReview ? (
          <Button onClick={() => onOpenReview(reextractTask.contract.sourceIds[0]!)}>
            {localizeUi("ui.longTermMemory.memoryvault.reviewRelatedDrafts")}
          </Button>
        ) : null}
        <Button onClick={closeTaskResult}>{localizeUi("ui.longTermMemory.sourcesworkspace.backToPreview")}</Button>
      </section>
    ) : null;

  const clearImportResult = useCallback(() => {
    setImportError("");
    setSourceOperation(null);
    setDismissedTaskResultId(latestSourceTaskId ?? null);
    setLatestTaskResultOpen(false);
  }, [latestSourceTaskId]);

  const confirmSelectionChange = useCallback(async () => {
    if (selectionCount > 1) {
      const clearLabel = localizeUi("ui.longTermMemory.sourcesworkspace.clearSelection");
      const confirmed = await confirm(
        { confirmAction, localization },
        clearLabel,
        localizeUi("ui.longTermMemory.sourcesworkspace.clearSelectionMessage", { count: selectionCount }),
        clearLabel,
      );
      if (!confirmed) return false;
    }
    if (selectionCount)
      setSelections((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${source}:`))),
      );
    return true;
  }, [confirmAction, localization, localizeUi, selectionCount, source]);

  const changeSource = useCallback(
    async (next: Source) => {
      if (next === source) return true;
      if (!(await confirmSelectionChange())) return false;
      setSource(next);
      onSourceChange?.(next);
      sourceQueryByType.current[source] = sourceQuery;
      sourceStatusByType.current[source] = sourceStatusFilter;
      focusedSourceByType.current[source] = focusedFlatSourceId;
      focusedLorebookByType.current[source] = selectedLorebookId;
      openLorebookEntryByType.current[source] = openLorebookEntryId;
      setSourceQuery(sourceQueryByType.current[next]);
      setCommittedSourceQuery(sourceQueryByType.current[next]);
      setSourceStatusFilter(sourceStatusByType.current[next]);
      setFocusedFlatSourceId(focusedSourceByType.current[next]);
      setSelectedLorebookId(focusedLorebookByType.current[next]);
      setOpenLorebookEntryId(openLorebookEntryByType.current[next]);
      clearImportResult();
      return true;
    },
    [
      clearImportResult,
      confirmSelectionChange,
      focusedFlatSourceId,
      onSourceChange,
      openLorebookEntryId,
      selectedLorebookId,
      source,
      sourceQuery,
      sourceStatusFilter,
    ],
  );

  const openLatestTaskResult = async () => {
    if (!latestSourceTask || !(await changeSource(latestSourceTask.contract.source))) return;
    markLtmSourceTaskViewed(latestSourceTask.id);
    setDismissedTaskResultId(null);
    setLatestTaskResultOpen(true);
    requestAnimationFrame(() => importResultRef.current?.scrollIntoView({ block: "nearest" }));
  };

  useEffect(() => {
    setSelectedDestinationTargetIds((current) =>
      current.filter((id) => destinationTargets.some((target) => target.id === id)),
    );
  }, [destinationTargets]);

  useEffect(() => {
    setSourceContextKey(props.chatId ?? "all");
    setSourceTargetId(props.chatId ? `chat:${props.chatId}` : "all");
    setBranchPick(null);
    setSelectedDestinationTargetIds(props.chatId ? [`chat:${props.chatId}`] : []);
    setDestinationTouched(false);
  }, [props.chatId]);

  // With no chat open, the destination follows the character or persona being browsed until the person picks one.
  useEffect(() => {
    if (destinationTouched || props.chatId) return;
    const owner = destinationTargets.find((target) => target.id === sourceTargetId);
    setSelectedDestinationTargetIds((current) => {
      const next = owner ? [owner.id] : [];
      return current.length === next.length && current.every((id, index) => id === next[index]) ? current : next;
    });
  }, [destinationTargets, destinationTouched, props.chatId, sourceTargetId]);

  useEffect(() => {
    if (!requestedSource) return;
    setRequestedSourceNoteId(requestedSource.sourceNoteId ?? null);
    setSourceGroupsOpen((current) => ({
      ...current,
      [requestedSource.source]: { ...current[requestedSource.source], imported: true },
    }));
    void changeSource(requestedSource.source).then((changed) => {
      if (!changed) return;
      setSourceStatusFilter("imported");
      onRequestedSourceHandled?.();
    });
  }, [changeSource, onRequestedSourceHandled, requestedSource]);

  useEffect(() => {
    if (selectedSource && selectedSource !== source) void changeSource(selectedSource);
  }, [changeSource, selectedSource, source]);

  useEffect(() => {
    if (!requestedSourceNoteId) return;
    if (source === "lorebooks") {
      const match = allLorebooks.find((book) =>
        book.entries.some((entry) =>
          entry.candidates.some(
            (candidate) => candidate.status === "imported" && candidate.existingNoteId === requestedSourceNoteId,
          ),
        ),
      );
      if (!match) return;
      const entry = match.entries.find((candidate) =>
        candidate.candidates.some(
          (candidate) => candidate.status === "imported" && candidate.existingNoteId === requestedSourceNoteId,
        ),
      );
      setSelectedLorebookId(match.id);
      setOpenLorebookEntryId(entry?.id ?? null);
    } else {
      const match = rows.find((row) => row.status === "imported" && row.existingNoteId === requestedSourceNoteId);
      if (!match) return;
      setFocusedFlatSourceId(match.sourceId);
    }
    setRequestedSourceNoteId(null);
  }, [allLorebooks, requestedSourceNoteId, rows, source]);

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = activeFlatSelectedIds.length > 0 && !activeFlatAllSelected;
  }, [activeFlatAllSelected, activeFlatSelectedIds.length]);

  useEffect(() => {
    sourceQueryByType.current[source] = sourceQuery;
    sourceStatusByType.current[source] = sourceStatusFilter;
    focusedSourceByType.current[source] = focusedFlatSourceId;
    focusedLorebookByType.current[source] = selectedLorebookId;
    openLorebookEntryByType.current[source] = openLorebookEntryId;
  }, [focusedFlatSourceId, openLorebookEntryId, selectedLorebookId, source, sourceQuery, sourceStatusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCommittedSourceQuery(sourceQuery), 250);
    return () => window.clearTimeout(timer);
  }, [sourceQuery]);

  useEffect(() => {
    const searching = Boolean(sourceQuery.trim());
    if (!searching) {
      if (sourceSearchContext.current !== null) {
        const previous = sourceGroupsBeforeSearch.current;
        if (previous) setSourceGroupsOpen(previous);
        sourceGroupsBeforeSearch.current = null;
        sourceSearchContext.current = null;
      }
      return;
    }
    if (sourceSearchContext.current === source) return;
    sourceGroupsBeforeSearch.current ??= sourceGroupsOpen;
    sourceSearchContext.current = source;
    setSourceGroupsOpen((current) => ({
      ...current,
      [source]: { ready: selectableRows.length > 0, imported: importedRows.length > 0 },
    }));
  }, [importedRows.length, selectableRows.length, source, sourceGroupsOpen, sourceQuery]);

  const invalidateAfterMutation = async () => {
    await invalidateLtmQueries(client, [
      queryKeys.notes,
      queryKeys.scopeTargetsRoot,
      queryKeys.localCharactersRoot,
      queryKeys.status,
      queryKeys.integrity,
      queryKeys.identityRepair,
      queryKeys.review,
      queryKeys.pendingDrafts,
      queryKeys.rejectedSuggestions,
      queryKeys.preview,
      queryKeys.lorebookPreview,
    ]);
  };

  const changeSourceScope = async (next: string) => {
    if (next === sourceTargetId || !(await confirmSelectionChange())) return;
    setSourceTargetId(next);
    setBranchPick(null);
    clearImportResult();
  };

  const changeBranch = async (next: string) => {
    if (next === (branchChatId ?? "") || !(await confirmSelectionChange())) return;
    setBranchPick(next);
    clearImportResult();
  };

  const changeDestinationIds = (next: string[]) => {
    setDestinationTouched(true);
    setSelectedDestinationTargetIds(next);
    clearImportResult();
  };

  const changeModeFilter = async (next: LtmMode | "all") => {
    if (next === modeFilter || !(await confirmSelectionChange())) return;
    setModeFilter(next);
    clearImportResult();
  };

  const changeSourceStatusFilter = async (next: SourceStatusFilter) => {
    if (next === sourceStatusFilter) return true;
    if (!(await confirmSelectionChange())) return false;
    setSourceStatusFilter(next);
    return true;
  };

  const toggleSelectionMode = async () => {
    if (selectionMode) {
      if (!(await confirmSelectionChange())) return;
    }
    setSelectionMode((current) => !current);
  };

  const toggleSelected = async (sourceId: string, checked: boolean) => {
    if (checked && selectedImportedIds.size && !(await confirmSelectionChange())) return;
    setSelections((current) => {
      const next = new Set(current[selectionKey] ?? []);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return {
        ...current,
        [selectionKey]: [...next],
        [importedSelectionKey]: checked ? [] : current[importedSelectionKey],
      };
    });
  };

  const toggleImportedSelected = async (sourceId: string, checked: boolean) => {
    if (checked && selectedIds.size && !(await confirmSelectionChange())) return;
    setSelections((current) => {
      const next = new Set(current[importedSelectionKey] ?? []);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return { ...current, [importedSelectionKey]: [...next], [selectionKey]: checked ? [] : current[selectionKey] };
    });
  };

  const toggleLorebookCandidates = (candidates: LorebookCandidate[], checked: boolean) => {
    setSelections((current) => {
      const importIds = new Set(current[lorebookImportSelectionKey] ?? []);
      const refreshIds = new Set(current[lorebookRefreshSelectionKey] ?? []);
      for (const candidate of candidates) {
        const target = candidate.status === "pending" ? importIds : refreshIds;
        if (checked) target.add(candidate.sourceId);
        else target.delete(candidate.sourceId);
      }
      return {
        ...current,
        [lorebookImportSelectionKey]: [...importIds],
        [lorebookRefreshSelectionKey]: [...refreshIds],
      };
    });
  };

  const runImport = async (
    sourceIds: string[],
    action: "import" | "refresh" = "import",
    retryContract?: ImportContract,
    selectionKeyOverride?: string,
  ) => {
    const ids = Array.from(new Set(sourceIds));
    if (
      !availabilityReady ||
      availabilitySavingRef.current ||
      ids.length === 0 ||
      sourceTask.active?.status === "running"
    )
      return;
    if (ids.length > 100) {
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.selectUpTo100SourceParts"));
      return;
    }
    const effectiveDestination = retryContract
      ? {
          destinationScope: retryContract.destinationScope,
          destinationLabel: retryContract.destinationTargetLabel,
        }
      : currentDestinationScope
        ? { destinationScope: currentDestinationScope, destinationLabel: currentDestinationLabel }
        : undefined;
    if (!effectiveDestination) {
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.chooseDestinationBeforeImport"));
      return;
    }
    const destinationScope = effectiveDestination.destinationScope;
    if (!hasDestinationScopeCapacity(destinationScope)) {
      setImportError(localizeUi("ui.longTermMemory.sourcesworkspace.destinationScopeLimitReached"));
      return;
    }
    const destinationTargetLabel = effectiveDestination.destinationLabel;
    const effectiveAction = retryContract?.action ?? action;
    const effectiveModes =
      effectiveAction === "refresh" ? undefined : (retryContract?.modes ?? effectiveAvailabilityModes);
    const contract: ImportContract = retryContract
      ? {
          ...retryContract,
          sourceIds: ids,
          action: effectiveAction,
          destinationScope,
          destinationTargetLabel,
          modes: effectiveModes,
          ...(effectiveAction === "refresh" ? { mode: undefined } : {}),
        }
      : {
          source,
          sourceIds: ids,
          action: effectiveAction,
          sourceScope: {
            ...(previewScope ?? {}),
            ...(previewScope?.chatIds ? { chatIds: [...previewScope.chatIds] } : {}),
            ...(previewScope?.characterIds ? { characterIds: [...previewScope.characterIds] } : {}),
            ...(previewScope?.personaIds ? { personaIds: [...previewScope.personaIds] } : {}),
          },
          ...(destinationScope
            ? {
                destinationScope: {
                  ...destinationScope,
                  ...(destinationScope.chatIds ? { chatIds: [...destinationScope.chatIds] } : {}),
                  ...(destinationScope.groupIds ? { groupIds: [...destinationScope.groupIds] } : {}),
                  ...(destinationScope.characterIds ? { characterIds: [...destinationScope.characterIds] } : {}),
                  ...(destinationScope.personaIds ? { personaIds: [...destinationScope.personaIds] } : {}),
                },
              }
            : {}),
          sourceTargetLabel: sourceTarget?.label ?? localizeUi("ui.longTermMemory.sourcesworkspace.allAvailable"),
          destinationTargetLabel,
          ...(effectiveAction !== "refresh" && modeFilter !== "all" ? { mode: modeFilter } : {}),
          ...(effectiveModes?.length ? { modes: effectiveModes } : {}),
          ...(props.chatId ? { chatId: props.chatId } : {}),
          selectionKey: selectionKeyOverride ?? selectionKey,
        };
    setImportError("");
    const sourceTitleById = new Map(
      [...rows, ...(selectedLorebook?.entries.flatMap((entry) => entry.candidates) ?? [])].map((row) => [
        row.sourceId,
        row.title,
      ]),
    );
    try {
      const task = await startLtmSourceTask<LtmImportSourceNotesResponse>({
        kind: contract.action,
        contract,
        sourceTitles: ids.map((id) => sourceTitleById.get(id) ?? id),
        run: (signal) =>
          request(
            "/import/source-notes",
            "POST",
            {
              source: contract.source,
              sourceIds: contract.sourceIds,
              limit: 100,
              extract: contract.action !== "refresh",
              ...(contract.sourceScope ? { sourceScope: contract.sourceScope } : {}),
              ...(contract.destinationScope ? { destinationScope: contract.destinationScope } : {}),
              ...(contract.mode ? { mode: contract.mode } : {}),
              ...(contract.modes?.length ? { modes: contract.modes } : {}),
              ...(contract.chatId ? { chatId: contract.chatId } : {}),
            },
            signal,
          ),
      });
      if (task.status === "completed") {
        const result = task.result as LtmImportSourceNotesResponse;
        setSelections((current) => ({
          ...current,
          [contract.selectionKey]: retryableSourceIds(result),
        }));
        void invalidateAfterMutation().catch(() => undefined);
        void (contract.source === "lorebooks" ? lorebookPreview.refetch() : preview.refetch()).catch(() => undefined);
        if (
          contract.action === "refresh" &&
          !result.counts.failed &&
          !result.counts.cancelled &&
          !result.counts.missing &&
          !result.counts.sourceWriteFailed
        )
          toast.success(localizeUi("ui.longTermMemory.sourcesworkspace.sourceRefreshedRerunExtraction"));
      } else if (task.status === "cancelled" || task.status === "failed") {
        setImportError(
          task.status === "cancelled"
            ? localizeUi("ui.longTermMemory.sourcesworkspace.importCancelledSelectionRetained")
            : task.error?.message || localizeUi("ui.longTermMemory.sourcesworkspace.sourcesCouldNotBeImported"),
        );
      }
    } catch (error) {
      setImportError(errorMessage(error, localizeUi("ui.longTermMemory.sourcesworkspace.sourcesCouldNotBeImported")));
    }
  };

  const reextract = async (noteId: string, retryContract?: LtmSourceTaskContract) => {
    if (sourceTask.active?.status === "running") return;
    if (!retryContract && !availabilityReady) return;
    setImportError("");
    const contract: LtmSourceTaskContract = retryContract ?? {
      source,
      sourceIds: [noteId],
      action: "re-extract",
      ...(previewScope ? { sourceScope: previewScope } : {}),
      ...(currentDestinationScope ? { destinationScope: currentDestinationScope } : {}),
      modes: effectiveAvailabilityModes,
      ...(modeFilter !== "all" ? { mode: modeFilter } : {}),
      ...(props.chatId ? { chatId: props.chatId } : {}),
    };
    const sourceNoteId = contract.sourceIds[0] ?? noteId;
    try {
      const task = await startLtmSourceTask({
        kind: "re-extract",
        contract,
        sourceTitles: [sourceNoteId],
        run: (signal) =>
          request(
            `/notes/${encodeURIComponent(sourceNoteId)}/extract`,
            "POST",
            {
              ...(contract.chatId ? { chatId: contract.chatId } : {}),
              ...(contract.mode ? { mode: contract.mode } : {}),
              ...(contract.modes?.length ? { modes: contract.modes } : {}),
            },
            signal,
          ),
      });
      if (task.status === "completed") {
        toast.success(localizeUi("ui.longTermMemory.sourcesworkspace.extractionCompletedReviewReady"));
        await invalidateAfterMutation();
      } else if (task.status === "failed" || task.status === "cancelled") {
        setImportError(
          task.error?.message || localizeUi("ui.longTermMemory.sourcesworkspace.sourceCouldNotBeReextracted"),
        );
      }
    } catch (error) {
      setImportError(errorMessage(error, localizeUi("ui.longTermMemory.sourcesworkspace.sourceCouldNotBeReextracted")));
    }
  };

  const stopRowAction = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const toggleSourceActions = (event: { preventDefault: () => void; stopPropagation: () => void }, noteId: string) => {
    stopRowAction(event);
    setOpenSourceActionId((current) => (current === noteId ? null : noteId));
  };

  const sourceInlineActions = (noteId: string, title: string) => (
    <>
      <div className="items-start gap-1" data-ltm-row-actions="inline">
        <IconButton
          icon={Sparkles}
          label={localizeUi("ui.longTermMemory.sourcesworkspace.reExtractValue1", { value1: title })}
          {...reextractActionProps}
          onClick={(event) => {
            stopRowAction(event);
            if (reextractLocked) return;
            setOpenSourceActionId(null);
            void reextract(noteId);
          }}
          data-ltm-source-action="re-extract"
          data-ltm-source-note-id={noteId}
        />
        <IconButton
          icon={ListChecks}
          label={localizeUi("ui.longTermMemory.sourcesworkspace.reviewDraftsForValue1", { value1: title })}
          onClick={(event) => {
            stopRowAction(event);
            setOpenSourceActionId(null);
            onOpenReview?.(noteId);
          }}
          data-ltm-review-query={noteId}
        />
        <IconButton
          icon={FolderCog}
          label={localizeUi("ui.longTermMemory.sourceoperation.manageValue1", {
            value1: title,
          })}
          onClick={(event) => {
            stopRowAction(event);
            openSourceOperation({ id: noteId, title, operation: "copy" }, event.currentTarget);
          }}
          data-ltm-source-action="manage"
          data-ltm-source-note-id={noteId}
        />
      </div>
      <div className="flex items-start gap-1" data-ltm-row-actions="menu">
        {openSourceActionId === noteId ? (
          <>
            <IconButton
              icon={Sparkles}
              label={localizeUi("ui.longTermMemory.sourcesworkspace.reExtractValue1", { value1: title })}
              {...reextractActionProps}
              onClick={(event) => {
                stopRowAction(event);
                if (reextractLocked) return;
                setOpenSourceActionId(null);
                void reextract(noteId);
              }}
            />
            <IconButton
              icon={ListChecks}
              label={localizeUi("ui.longTermMemory.sourcesworkspace.reviewDraftsForValue1", { value1: title })}
              onClick={(event) => {
                stopRowAction(event);
                setOpenSourceActionId(null);
                onOpenReview?.(noteId);
              }}
            />
            <IconButton
              icon={FolderCog}
              label={localizeUi("ui.longTermMemory.sourceoperation.manageValue1", { value1: title })}
              onClick={(event) => {
                stopRowAction(event);
                setOpenSourceActionId(null);
                openSourceOperation({ id: noteId, title, operation: "copy" }, event.currentTarget);
              }}
              data-ltm-source-action="manage"
            />
          </>
        ) : null}
        <IconButton
          icon={Ellipsis}
          label={localizeUi("ui.longTermMemory.sourcesworkspace.moreActionsForValue1", { value1: title })}
          aria-expanded={openSourceActionId === noteId}
          onClick={(event) => toggleSourceActions(event, noteId)}
          data-ltm-source-more={noteId}
        />
      </div>
    </>
  );

  // `group` is set when the all-sources view lists a row under both groups: only its own group opens the region, so ids stay unique.
  const renderFlatSourceRow = (row: PreviewRow, group?: "ready" | "imported") => {
    const ready = row.status === "pending" || retryableIdSet.has(row.sourceId);
    const selected = ready ? selectedIds.has(row.sourceId) : selectedImportedIds.has(row.sourceId);
    const messageRange = row.messageRange;
    const range = messageRange ?? row.summaryRange;
    const open = focusedFlatSourceId === row.sourceId && (!group || (group === "ready") === ready);
    const regionId = `ltm-source-region-${row.sourceId}`;
    const closeRow = () => setFocusedFlatSourceId(null);
    const focusedDetail = open ? focusedFlatDetail : null;
    // soup/sources-review: the meta line says who the chat is with, how many messages and how it imports, from what the
    // preview already carries; a part the client does not have is left out, and a row with none keeps its summary.
    // ponytail: the server names an unnamed chat "Chat" in previews but "Untitled chat" in scope targets, so that
    // name never matches; upgrade path is a chat id on the preview row.
    const rowChat = range && range.chatName !== "Chat" ? (chatsByName.get(range.chatName) ?? []) : [];
    const whoNames =
      rowChat.length === 1 ? rowChat[0]!.characterIds.flatMap((id) => characterLabelById.get(id) ?? []) : [];
    const who =
      whoNames.length > 3 ? `${whoNames.slice(0, 3).join(", ")} +${whoNames.length - 3}` : whoNames.join(", ");
    const messageCount = messageRange ? messageRange.last - messageRange.first + 1 : 0;
    const metaParts = [
      who,
      messageCount
        ? localizeUi(
            selectLtmPluralForm(locale, messageCount) === "one"
              ? "ui.longTermMemory.sourcesworkspace.rowMessageCountOne"
              : "ui.longTermMemory.sourcesworkspace.rowMessageCount",
            { count: messageCount },
          )
        : "",
      source === "chats" || source === "messages" ? sourceModeLabel(row.importMode, localizeUi) : "",
    ].filter(Boolean);
    const avatarName = whoNames[0] ?? range?.chatName ?? row.title;
    const initials = avatarName
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => [...word][0]!.toUpperCase())
      .join("");
    return (
      <div key={row.sourceId} role="listitem" onKeyDown={(event) => closePreviewOnEscape(event, open, closeRow)}>
        <ClickSurface
          data-ltm-source-row-status={row.status}
          data-ltm-source-id={row.sourceId}
          data-ltm-source-focused={open || undefined}
          className={`group flex items-start gap-2 p-3 ${open ? "bg-[var(--primary)]/10" : ""}`}
          onClick={() => setFocusedFlatSourceId(open ? null : row.sourceId)}
        >
          {ready || selectionMode ? (
            <label className={sourceCheckboxHitClass} onClick={(event) => event.stopPropagation()}>
              <input
                type="checkbox"
                className={sourceCheckboxClass}
                aria-label={localizeUi("ui.longTermMemory.memoryvault.selectValue1", { value1: row.title })}
                checked={selected}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  if (!ready) return void toggleImportedSelected(row.sourceId, event.target.checked);
                  // Ticking a ready row is how selection starts; Select and Done keep working.
                  if (event.target.checked) setSelectionMode(true);
                  void toggleSelected(row.sourceId, event.target.checked);
                }}
                data-ltm-source-select={row.sourceId}
              />
            </label>
          ) : null}
          <span
            aria-hidden="true"
            data-ltm-source-avatar
            className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]"
          >
            {initials}
          </span>
          {/* The row's onClick opens and closes the preview, so Enter and Space on this button do too. */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? regionId : undefined}
            data-ltm-source-open={row.sourceId}
            className="min-w-0 flex-1 text-left focus-visible:outline-none"
          >
            <span className="flex flex-wrap items-center gap-2">
              {range ? (
                <>
                  {/* A long chat name is what gets cut; the range and badge stay whole and wrap before the name drops below 8rem. */}
                  <strong className="min-w-32 flex-1 truncate text-sm" data-ltm-source-chat-name>
                    {range.chatName}
                  </strong>
                  <span
                    className="shrink-0 whitespace-nowrap text-xs text-[var(--muted-foreground)]"
                    data-ltm-source-message-range
                  >
                    {"label" in range
                      ? range.label
                      : range.first === range.last
                        ? localizeUi("ui.longTermMemory.sourcesworkspace.messageValue1", { value1: range.first })
                        : localizeUi("ui.longTermMemory.sourcesworkspace.messagesValue1ToValue2", {
                            value1: range.first,
                            value2: range.last,
                          })}
                  </span>
                </>
              ) : (
                <strong className="truncate text-sm">{row.title}</strong>
              )}
              <Chip
                data-ltm-source-status={row.status}
                className={`text-[0.625rem] font-semibold uppercase ${range ? "shrink-0 whitespace-nowrap" : ""}`}
              >
                {sourceStatusLabel(row, localizeUi)}
              </Chip>
            </span>
            <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]" data-ltm-source-meta>
              {metaParts.length ? metaParts.join(" · ") : row.summary}
            </span>
          </button>
          {ready ? (
            <IconButton
              icon={FileInput}
              label={localizeUi("ui.longTermMemory.sourcesworkspace.importValue1", { value1: row.title })}
              {...importActionProps}
              onClick={(event) => {
                stopRowAction(event);
                void runImport([row.sourceId]);
              }}
              data-ltm-source-action="import"
              data-ltm-source-id={row.sourceId}
            />
          ) : null}
        </ClickSurface>
        {open ? (
          <section
            id={regionId}
            role="region"
            aria-labelledby={`${regionId}-title`}
            data-ltm-source-workbench
            className="space-y-3 border-t border-[var(--border)] bg-[var(--secondary)]/15 p-3"
          >
            <header className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id={`${regionId}-title`} className="min-w-0 break-words text-sm font-semibold">
                  {localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreview")} · {row.title}
                </h3>
                <Chip className="text-[0.625rem] font-semibold uppercase">{sourceStatusLabel(row, localizeUi)}</Chip>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {sourceModeLabel(row.importMode, localizeUi)}
                </span>
                <Button
                  className="mari-editor-action--compact ml-auto"
                  data-ltm-source-preview-close
                  onClick={(event) => closePreview(event.currentTarget, closeRow)}
                >
                  {localizeUi("ui.longTermMemory.memoryvault.close")}
                </Button>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">{row.summary}</p>
              {sourceDetails.isLoading ? (
                <div
                  className="h-32 animate-pulse rounded bg-[var(--secondary)] motion-reduce:animate-none"
                  aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.loadingSourceContent")}
                />
              ) : sourceDetails.isError ? (
                <StatusSurface tone="danger">
                  {errorMessage(
                    sourceDetails.error,
                    localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreviewCouldNotLoad"),
                  )}
                  <Button onClick={() => void sourceDetails.refetch()}>
                    {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
                  </Button>
                </StatusSurface>
              ) : focusedDetail ? (
                <pre
                  style={{ maxHeight: "min(60vh, 48rem)" }}
                  className="overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--border)] bg-[var(--secondary)]/25 p-3 text-sm"
                >
                  {focusedDetail.content}
                </pre>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">{row.snippet}</p>
              )}
            </header>
            <div className="flex flex-wrap items-center gap-2" data-ltm-source-primary-actions>
              {selectedIds.size ? (
                <Button
                  primary
                  {...importActionProps}
                  {...destinationWait()}
                  onClick={() => {
                    if (currentDestinationScope) void runImport([...selectedIds]);
                  }}
                  data-ltm-source-action="import-selected"
                >
                  <FileInput aria-hidden="true" size="0.75rem" />
                  {localizeUi("ui.longTermMemory.sourcesworkspace.importSelectedCount", {
                    count: selectedIds.size,
                  })}
                </Button>
              ) : selectedImportedIds.size ? (
                <Button
                  {...importActionProps}
                  {...destinationWait()}
                  onClick={() => {
                    if (currentDestinationScope) void runImport([...selectedImportedIds], "refresh");
                  }}
                  data-ltm-source-action="refresh-selected"
                >
                  <RefreshCw aria-hidden="true" size="0.75rem" />
                  {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSourcesCount", {
                    count: selectedImportedIds.size,
                  })}
                </Button>
              ) : ready ? (
                <Button
                  primary
                  {...importActionProps}
                  {...destinationWait()}
                  onClick={() => {
                    if (currentDestinationScope) void runImport([row.sourceId]);
                  }}
                  data-ltm-source-action="import"
                >
                  <FileInput aria-hidden="true" size="0.75rem" />
                  {localizeUi("ui.longTermMemory.sourcesworkspace.importValue1", { value1: row.title })}
                </Button>
              ) : row.status === "imported" ? (
                <>
                  <Button
                    {...lockedActionProps(importRunning)}
                    {...destinationWait()}
                    aria-describedby={`${
                      currentDestinationScope
                        ? reimportDescriptionId
                        : `${reimportDescriptionId} ${destinationReasonId}`
                    }${importRunning ? ` ${importLockId}` : ""}`}
                    onClick={() => {
                      if (currentDestinationScope) void runImport([row.sourceId], "refresh");
                    }}
                    data-ltm-source-action="refresh"
                  >
                    <RefreshCw aria-hidden="true" size="0.75rem" />
                    {localizeUi("ui.longTermMemory.sourcesworkspace.reimportFromSource")}
                  </Button>
                  {bulkSelectionActive ? null : sourceInlineActions(row.existingNoteId, row.existingNoteTitle)}
                  <p id={reimportDescriptionId} className="basis-full text-xs text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.sourcesworkspace.reimportFromSourceDescription")}
                  </p>
                </>
              ) : null}
            </div>
            {row.status === "imported" ? (
              <>
                <button
                  type="button"
                  data-ltm-source-memory-id={row.existingNoteId}
                  className="inline-flex min-h-11 items-center text-left text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                  onClick={() => onOpenMemory?.(row.existingNoteId)}
                >
                  {localizeUi("ui.longTermMemory.sourcesworkspace.sourceMemory")} {row.existingNoteTitle}
                </button>
                <ImportedSourceInspector
                  source={{ id: row.existingNoteId, title: row.existingNoteTitle }}
                  disabled={reextractLocked}
                  lockReasonId={reextractReasonId}
                  bulkActive={bulkSelectionActive}
                  onOpenMemory={onOpenMemory}
                  onOpenReview={onOpenReview}
                  onReextract={(id) => void reextract(id)}
                  onManage={(id, title, operation, trigger) => openSourceOperation({ id, title, operation }, trigger)}
                />
              </>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  };

  // One bar closes the list card: Import all new, where the memories will be available, one hint. The bar pins to
  // the card's bottom edge while the list scrolls; it sits after the last row, so it never covers one.
  const destinationBar = (action?: ReactNode, hint?: ReactNode) => (
    <DestinationScopePanel
      targets={destinationTargets}
      selectedIds={selectedDestinationTargetIds}
      onChange={changeDestinationIds}
      mode={modeFilter}
      source={source}
      availabilityModes={effectiveAvailabilityModes}
      onAvailabilityModesChange={(modes) => void changeAvailabilityModes(modes)}
      modesError={modesError}
      availabilityDisabled={availabilitySaving || !availabilityReady}
      disabled={sourceTask.active?.status === "running"}
      currentChatId={props.chatId ?? undefined}
      reasonId={destinationReasonId}
      action={action}
      hint={hint}
    />
  );
  const importAllNewIds = selectableRows.slice(0, 100).map((row) => row.sourceId);

  // Notes whose source is gone. Keeping one needs no action; Remove goes through the delete workbench.
  const outdatedNotes = (source === "lorebooks" ? lorebookPreviewData?.outdated : previewData?.outdated) ?? [];
  const outdatedSourcesGroup = outdatedNotes.length ? (
    <section className="space-y-2 rounded-md border border-[var(--border)] p-2" data-ltm-source-outdated>
      <h3 className="text-xs font-semibold">
        {localizeUi("ui.longTermMemory.sourcesworkspace.sourceGone", { value1: outdatedNotes.length })}
      </h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.sourcesworkspace.sourceGoneHelp")}
      </p>
      <ul className="max-h-52 space-y-1 overflow-y-auto">
        {outdatedNotes.map((note) => (
          <li
            key={note.noteId}
            className="flex flex-wrap items-center gap-1"
            data-ltm-source-outdated-note={note.noteId}
          >
            <span className="min-w-0 flex-1 break-words text-xs">{note.title}</span>
            <Button
              className="mari-editor-action--compact"
              aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemoryValue1", {
                value1: note.title,
              })}
              onClick={() => onOpenMemory?.(note.noteId)}
            >
              {localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemory")}
            </Button>
            <Button
              className="mari-editor-action--compact"
              aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.removeGoneSourceValue1", {
                value1: note.title,
              })}
              onClick={(event) => {
                openSourceOperation({ id: note.noteId, title: note.title, operation: "delete" }, event.currentTarget);
              }}
              data-ltm-source-action="remove-outdated"
              data-ltm-source-note-id={note.noteId}
            >
              {localizeUi("ui.longTermMemory.sourcesworkspace.removeGoneSource")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
  const sourceOperationWorkbench = sourceOperation ? (
    <SourceOperationWorkbench
      key={`${sourceOperation.id}:${sourceOperation.operation ?? "copy"}`}
      sourceNoteId={sourceOperation.id}
      sourceTitle={sourceOperation.title}
      initialOperation={sourceOperation.operation}
      destinations={scopeTargets.data?.chats ?? []}
      sharedWithBranches={groupChats.length > 1}
      disabled={importRunning}
      lockReasonId={importLockId}
      confirmAction={props.confirmAction}
      localization={props.localization}
      onComplete={async () => {
        await invalidateAfterMutation();
        await (source === "lorebooks" ? lorebookPreview.refetch() : preview.refetch());
      }}
      onClose={closeSourceOperation}
    />
  ) : null;
  const restoredImportResult =
    latestTaskResultOpen &&
    latestSourceTask?.id !== dismissedTaskResultId &&
    !importResult &&
    latestSourceTask?.status === "completed" &&
    latestSourceTask.kind !== "re-extract" &&
    latestSourceTask.safeResult
      ? latestSourceTask.safeResult
      : null;
  const restoredRetryIds = restoredImportResult ? retryableSourceIds(restoredImportResult) : [];
  const restoredImportResultPanel = restoredImportResult ? (
    <section
      ref={importResultRef}
      role="region"
      aria-labelledby={importResultLabelId}
      data-ltm-safe-source-task-result={latestSourceTask?.status}
      data-ltm-source-task-result-workbench
      className="space-y-3 p-4"
    >
      <h2 id={importResultLabelId} className="text-sm font-semibold">
        {latestSourceTaskLabel}
      </h2>
      <p role="status" data-ltm-import-result-summary className="text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.sourcesworkspace.importResultSummary", {
          requested: restoredImportResult.counts?.requested ?? latestSourceTask?.sourceCount ?? 0,
          wrote: restoredImportResult.counts?.sourceNotesWritten ?? 0,
          succeeded: restoredImportResult.counts?.succeeded ?? 0,
          failed: restoredImportResult.counts?.failed ?? 0,
          cancelled: restoredImportResult.counts?.cancelled ?? 0,
          missing: restoredImportResult.counts?.missing ?? restoredImportResult.missingSourceIds?.length ?? 0,
          writeFailures: restoredImportResult.counts?.sourceWriteFailed ?? 0,
        })}
      </p>
      {restoredRetryIds.length ? (
        <Button
          primary
          {...importActionProps}
          onClick={() =>
            void runImport(
              restoredRetryIds,
              latestSourceTask?.kind === "refresh" ? "refresh" : "import",
              latestSourceTask?.contract as ImportContract,
            )
          }
          data-ltm-source-action="retry-restored"
        >
          <RefreshCw aria-hidden="true" size="0.75rem" />
          {localizeUi("ui.longTermMemory.sourcesworkspace.retryFailedCount", { count: restoredRetryIds.length })}
        </Button>
      ) : null}
      {restoredImportResult.items?.map((item) => (
        <article key={item.sourceId} className="space-y-1 border-t border-[var(--border)] pt-3 text-xs">
          <strong>{item.title}</strong>
          {item.status ? (
            <p className="text-[var(--muted-foreground)]">{importStatusLabel(item.status, localizeUi)}</p>
          ) : null}
          {item.error?.message ? (
            <p data-ltm-import-item-error className="flex items-start gap-2 text-xs text-[var(--destructive)]">
              <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
              {item.error.message}
            </p>
          ) : null}
          {item.diagnostics?.length ? (
            <ul className="space-y-1 text-[var(--muted-foreground)]">
              {item.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code ?? "diagnostic"}-${index}`}>{diagnostic.message ?? diagnostic.code}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
      {restoredImportResult.writeFailures?.length || restoredImportResult.missingSourceIds?.length ? (
        <ul data-ltm-source-import-failures className="space-y-2 text-xs text-[var(--destructive)]">
          {restoredImportResult.writeFailures?.map((failure) => (
            <li
              key={failure.sourceId}
              data-ltm-source-write-failure={failure.sourceId}
              className="flex items-start gap-2"
            >
              <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
              <span>
                {failure.title}: {failure.error.message} ({importStatusLabel(failure.sourceWriteStatus, localizeUi)},{" "}
                {importStatusLabel(failure.extractionStatus, localizeUi)})
              </span>
            </li>
          ))}
          {restoredImportResult.missingSourceIds?.map((id) => (
            <li key={id} data-ltm-source-missing={id} className="flex items-start gap-2">
              <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
              {id}
            </li>
          ))}
        </ul>
      ) : null}
      <Button onClick={closeTaskResult}>{localizeUi("ui.longTermMemory.sourcesworkspace.backToPreview")}</Button>
    </section>
  ) : null;
  const taskResultWorkbenchOpen = Boolean(visibleImportResult || restoredImportResult || reextractResultPanel);
  const workbenchMode = sourceOperation ? "operation" : taskResultWorkbenchOpen ? "task-result" : undefined;

  const columnTop = (
    <>
      {sourceOperationWorkbench}
      <div ref={setResultWorkbenchHost} className="contents" data-ltm-source-task-result-workbench />
      {restoredImportResultPanel}
      {reextractResultPanel}
    </>
  );
  const taskProgressPanel = activeSourceTask ? (
    <div className="space-y-3 border-b border-[var(--border)] p-3" data-ltm-source-task-progress>
      <StatusSurface busy data-ltm-source-task-count>
        {sourceTaskProgressMessage}
      </StatusSurface>
      <SourceCancelButton localizeUi={localizeUi} onCancel={cancelLtmSourceTask} />
    </div>
  ) : null;
  const latestTaskButton = latestSourceTask ? (
    <button
      type="button"
      className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-[var(--border)] p-3 text-left text-xs"
      data-ltm-latest-source-task
      onClick={() => void openLatestTaskResult()}
    >
      <span className="font-semibold">{latestSourceTaskLabel}</span>
      <span className="text-[var(--muted-foreground)]" data-ltm-latest-source-task-status>
        {sourceCountLabel(latestSourceTask.sourceCount)} · {latestSourceTaskStatus}
      </span>
    </button>
  ) : null;
  const bulkQueue =
    selectedFlatSourceIds.length > 1 ? (
      <section className="space-y-2 border-b border-[var(--border)] p-3" data-ltm-source-bulk-queue>
        <h3 className="text-sm font-semibold">
          {localizeUi("ui.longTermMemory.sourcesworkspace.selectedSourceParts")} ({selectedFlatSourceIds.length})
        </h3>
        {selectedFlatSourceIds.map((id) => {
          const row = rows.find((item) => item.sourceId === id);
          return (
            <details key={id} className="rounded border border-[var(--border)]">
              <summary
                className="min-h-11 cursor-pointer list-none px-3 py-3 text-xs font-semibold"
                onClick={() => {
                  if (row) setFocusedFlatSourceId(row.sourceId);
                }}
              >
                {row?.title ?? id} ·{" "}
                {row ? sourceStatusLabel(row, localizeUi) : localizeUi("ui.longTermMemory.sourcesworkspace.selected")}
              </summary>
              {row ? (
                <p className="whitespace-pre-wrap px-3 pb-3 text-xs text-[var(--muted-foreground)]">
                  {sourceDetailsData?.details.find((detail) => detail.sourceId === row.sourceId)?.content ??
                    row.snippet}
                </p>
              ) : null}
            </details>
          );
        })}
      </section>
    ) : null;
  // Import detail closes the card: it applies to the next import, not to one row.
  const importDetailPanel =
    source === "chats" || source === "messages" ? (
      <div
        data-ltm-import-detail
        className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border)] p-3"
      >
        <p id={importDetailLabelId} className="flex items-center gap-1 text-xs font-medium">
          {localizeUi("ui.longTermMemory.sourcesworkspace.importDetail")}
          <InfoPopover
            label={localizeUi("ui.longTermMemory.sourcesworkspace.importDetail")}
            content={localizeUi("ui.longTermMemory.sourcesworkspace.importDetailHelp")}
          />
        </p>
        <div role="group" aria-labelledby={importDetailLabelId} className="flex flex-wrap gap-2">
          {(["standard", "detailed"] as const).map((choice) => (
            <Button
              key={choice}
              primary={importDetail === choice}
              aria-pressed={importDetail === choice}
              {...lockedActionProps(importDisabled || importDetailSaving || !extractionSettingsQuery.isSuccess)}
              data-ltm-import-detail-choice={choice}
              onClick={() => void changeImportDetail(choice)}
            >
              {localizeUi(
                choice === "standard"
                  ? "ui.longTermMemory.sourcesworkspace.importDetailStandard"
                  : "ui.longTermMemory.sourcesworkspace.importDetailDetailed",
              )}
            </Button>
          ))}
        </div>
        {importDetail === "detailed" ? (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.sourcesworkspace.importDetailDetailedHint")}
          </p>
        ) : null}
      </div>
    ) : null;

  const sourcesHeader = (
    <header data-ltm-sources-header>
      <h2 className="text-base font-semibold">{localizeUi("ui.longTermMemory.longtermmemorynavigation.sources")}</h2>
      <p data-ltm-tab-subtitle className="text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.longTermMemory.longtermmemorynavigation.sourcesHint")}
      </p>
    </header>
  );

  if (scopeTargets.isError) {
    return (
      <section data-ltm-surface="sources" className="space-y-4">
        {sourcesHeader}
        <StatusSurface tone="danger">
          {errorMessage(scopeTargets.error, localizeUi("ui.longTermMemory.sourcesworkspace.scopeTargetsCouldNotLoad"))}
          <Button onClick={() => void scopeTargets.refetch()}>
            <RefreshCw aria-hidden="true" size="0.75rem" />
            {localizeUi("ui.longTermMemory.activityview.retry")}
          </Button>
        </StatusSurface>
      </section>
    );
  }

  return (
    <section
      data-ltm-surface="sources"
      data-ltm-import-status={importing ? "pending" : "idle"}
      data-ltm-extraction-status={extractingId ? "pending" : "idle"}
      data-ltm-extraction-note-id={extractingId ?? undefined}
      className="space-y-4"
    >
      <style>{`
        /* The Engine's unlayered .mari-editor-tab (2.25rem) and --compact (auto) beat the min-h-11 utilities. */
        [data-ltm-surface="sources"] :is(.mari-editor-tab, .mari-editor-action--compact) {
          min-height: 2.75rem;
        }
        /* The Engine sheds .mari-editor-tab > svg in 56-96rem containers; the kind icons stay. */
        [data-ltm-surface="sources"] [data-ltm-source-tab] > svg {
          display: inline-block;
        }
        [data-ltm-surface="sources"] [data-ltm-control="icon-button"].mari-editor-action--primary {
          height: 2.75rem;
          min-height: 2.75rem;
          width: 2.75rem;
          min-width: 2.75rem;
        }
        /* A row's actions sit inline once the column is wide enough, else behind its More actions button. */
        [data-ltm-surface="sources"] [data-ltm-row-actions="inline"] {
          display: none;
        }
        @container ltm-sources (min-width: 48rem) {
          [data-ltm-surface="sources"] [data-ltm-row-actions="inline"] {
            display: flex;
          }
          [data-ltm-surface="sources"] [data-ltm-row-actions="menu"] {
            display: none;
          }
        }
        [data-ltm-workbench-mode="operation"] > :not([data-ltm-source-operation-workbench]),
        [data-ltm-workbench-mode="task-result"] > :not([data-ltm-source-task-result-workbench]) {
          display: none;
        }
        @container ltm-destination (min-width: 40rem) {
          [data-ltm-scope-picker] {
            max-width: 36rem;
          }
          [data-ltm-source-scope-row] {
            flex-direction: row;
            align-items: center;
          }
        }
      `}</style>
      {sourcesHeader}
      <div className="mari-editor-panel mari-editor-panel--soft flex flex-wrap items-center gap-3 p-3">
        <div
          className="flex w-full flex-wrap gap-1"
          role="tablist"
          aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.sourceTypes")}
          style={{ display: "flex" }}
        >
          {sourceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`ltm-source-tab-${tab.id}`}
              tabIndex={source === tab.id ? 0 : -1}
              aria-selected={source === tab.id}
              aria-controls={source === tab.id ? `ltm-source-preview-${tab.id}` : undefined}
              data-ltm-source-tab={tab.id}
              onClick={() => void changeSource(tab.id)}
              onKeyDown={(event) =>
                handleTabKey(
                  event,
                  sourceTabs.map((item) => item.id),
                  source,
                  changeSource,
                  "data-ltm-source-tab",
                )
              }
              data-active={source === tab.id}
              className="mari-editor-tab min-h-11 rounded-lg border px-3 text-xs font-semibold"
            >
              <tab.Icon
                aria-hidden="true"
                size="0.875rem"
                className="mr-1.5 inline-block"
                style={{ verticalAlign: "-0.125em" }}
              />
              {localizeUi(tab.labelKey)}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-labelledby={sourceScopeLabelId}
          data-ltm-source-scope-row
          className="flex min-h-11 w-full flex-col gap-2 text-xs font-medium"
        >
          <span id={sourceScopeLabelId} className="shrink-0">
            {localizeUi("ui.longTermMemory.sourcesworkspace.findSourcesIn")}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <SourceScopeCombobox
              targets={scopeTargetOptions}
              value={sourceTarget?.id ?? "all"}
              onChange={changeSourceScope}
              ariaLabel={localizeUi("ui.longTermMemory.sourcesworkspace.findSourcesIn")}
              testId="source"
              disabled={activeSourceTask !== null}
              describedBy={importLockId}
              hintId={sourceScopeHintId}
            />
            <p
              id={sourceScopeHintId}
              data-ltm-source-scope-hint
              className="text-[0.6875rem] font-normal text-[var(--muted-foreground)]"
            >
              {(sourceTarget?.id ?? "all") === "all"
                ? localizeUi("ui.longTermMemory.sourcesworkspace.searchEveryAvailableCharacterLorebookAndChat")
                : localizeUi("ui.longTermMemory.sourcesworkspace.limitImportsToThisChatAndItsRelatedScope")}
            </p>
          </div>
        </div>
      </div>
      {/* Always mounted, so the lock is announced when a run starts. Dimmed controls stay focusable and say why. */}
      <p
        id={importLockId}
        role="status"
        className={activeSourceTask ? "text-xs text-[var(--muted-foreground)]" : "sr-only"}
        data-ltm-import-lock="sources"
      >
        {activeSourceTask
          ? localizeUi(
              activeSourceTask.kind === "re-extract"
                ? "ui.longTermMemory.sourcesworkspace.lockedWhileReextractRuns"
                : "ui.longTermMemory.sourcesworkspace.lockedWhileImportRuns",
            )
          : null}
      </p>
      {!availabilityReady ? (
        <StatusSurface
          id={availabilityWaitId}
          tone={settingsQuery.isError ? "danger" : "neutral"}
          busy={!settingsQuery.isError}
        >
          {settingsQuery.isError
            ? errorMessage(
                settingsQuery.error,
                localizeUi("ui.longTermMemory.sourcesworkspace.availabilitySettingsCouldNotLoad"),
              )
            : localizeUi("ui.longTermMemory.sourcesworkspace.loadingAvailabilitySettings")}
          {settingsQuery.isError ? (
            <Button disabled={settingsQuery.isFetching} onClick={() => void settingsQuery.refetch()}>
              <RefreshCw aria-hidden="true" size="0.75rem" />
              {localizeUi("ui.longTermMemory.activityview.retry")}
            </Button>
          ) : null}
        </StatusSurface>
      ) : null}

      <p
        className="text-xs text-[var(--muted-foreground)]"
        data-ltm-source-preview-status={source === "lorebooks" ? lorebookPreview.status : preview.status}
        role="status"
        aria-live="polite"
      >
        {source === "lorebooks"
          ? lorebookPreviewData
            ? localizeUi("ui.longTermMemory.sourcesworkspace.value1LorebooksValue2EntriesValue3Imported", {
                value1: lorebookPreviewData.counts.books,
                value2: lorebookPreviewData.counts.entries,
                value3: lorebookPreviewData.counts.imported,
              })
            : localizeUi("ui.longTermMemory.sourcesworkspace.loadingLorebooks")
          : previewData
            ? localizeUi("ui.longTermMemory.sourcesworkspace.value1ScannedValue2PendingValue3Imported", {
                value1: previewData.scanned,
                value2: previewData.draftable,
                value3: previewData.importedCount,
              })
            : localizeUi("ui.longTermMemory.sourcesworkspace.loadingSourcePreview")}
      </p>

      {(source === "lorebooks" ? lorebookPreview.isError : preview.isError) ? (
        <StatusSurface tone="danger">
          {errorMessage(
            source === "lorebooks" ? lorebookPreview.error : preview.error,
            source === "lorebooks"
              ? localizeUi("ui.longTermMemory.sourcesworkspace.lorebooksCouldNotLoad")
              : localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreviewCouldNotLoad"),
          )}
        </StatusSurface>
      ) : null}
      {importError || sourceTaskError ? (
        <StatusSurface tone="danger">
          {importError || sourceTaskError}
          {cancelledImport ? (
            <Button
              onClick={() => void runImport(cancelledImport.sourceIds, "import", cancelledImport)}
              {...importActionProps}
              data-ltm-source-action="retry-cancelled"
            >
              <RefreshCw aria-hidden="true" size="0.75rem" />
              {localizeUi("ui.longTermMemory.sourcesworkspace.retryOriginalSelection", {
                count: cancelledImport.sourceIds.length,
              })}
            </Button>
          ) : null}
          {retryableReextract?.contract.sourceIds[0] ? (
            <Button
              onClick={() => {
                if (!importRunning)
                  void reextract(retryableReextract.contract.sourceIds[0]!, retryableReextract.contract);
              }}
              {...lockedActionProps(importRunning, importLockId)}
              data-ltm-source-action="retry-re-extract"
            >
              <RefreshCw aria-hidden="true" size="0.75rem" />
              {localizeUi("ui.longTermMemory.sourcesworkspace.retryOriginalSelection", { count: 1 })}
            </Button>
          ) : null}
        </StatusSurface>
      ) : null}
      {source === "lorebooks" ? (
        <div
          id="ltm-source-preview-lorebooks"
          role="tabpanel"
          aria-labelledby="ltm-source-tab-lorebooks"
          data-ltm-source-preview="lorebooks"
          data-ltm-lorebook-browser
          className="space-y-3"
          style={sourceColumnStyle}
        >
          <section
            data-ltm-lorebook-list
            data-ltm-source-column
            data-ltm-workbench-mode={workbenchMode}
            className="mari-editor-panel overflow-hidden"
            // clip, not hidden: a hidden overflow becomes the pinned bar's scroll container and stops it pinning.
            style={{ overflow: "clip" }}
          >
            {columnTop}
            {taskProgressPanel}
            <SourceNavigatorBar
              localizeUi={localizeUi}
              title={localizeUi("ui.longTermMemory.sourcesworkspace.lorebooks")}
              count={activeLorebooks.length}
              selectionMode={selectionMode}
              onToggleSelection={() => void toggleSelectionMode()}
              query={sourceQuery}
              onQueryChange={setSourceQuery}
              modeFilter={modeFilter}
              modeLocked={Boolean(activeSourceTask)}
              onModeChange={(mode) => void changeModeFilter(mode)}
              reloading={lorebookPreview.isFetching}
              onReload={() => void lorebookPreview.refetch()}
              afterFilters={outdatedSourcesGroup}
              source={source}
              statusFilter={sourceStatusFilter}
              statusCounts={{
                all: lorebookPreviewData?.books.length ?? 0,
                ready: allLorebooks.filter((book) => book.totals.pending > 0).length,
                imported: allLorebooks.filter((book) => book.totals.pending === 0 && book.totals.imported > 0).length,
              }}
              onStatusChange={changeSourceStatusFilter}
            />
            {latestTaskButton}
            <div
              id={`ltm-source-results-${source}`}
              role="list"
              aria-busy={lorebookPreview.isPlaceholderData}
              className="divide-y divide-[var(--border)]"
            >
              {activeLorebooks.map((book) => {
                const open = selectedLorebook?.id === book.id;
                const regionId = `ltm-source-region-${book.id}`;
                return (
                  <div
                    key={book.id}
                    role="listitem"
                    onKeyDown={(event) => closePreviewOnEscape(event, open, () => setSelectedLorebookId(null))}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={open ? regionId : undefined}
                      data-ltm-lorebook-id={book.id}
                      onClick={() => {
                        setSelectedLorebookId(open ? null : book.id);
                        setOpenLorebookEntryId(null);
                      }}
                      className={`flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--secondary)]/30 ${open ? "bg-[var(--primary)]/10" : ""}`}
                    >
                      <kindIcons.lorebook
                        aria-hidden="true"
                        size="1rem"
                        className="shrink-0 text-[var(--muted-foreground)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{book.name}</span>
                        <span className="block text-xs text-[var(--muted-foreground)]">
                          {book.category} · {entryCountLabel(book.totals.entries)} {book.totals.imported}{" "}
                          {localizeUi("ui.longTermMemory.sourcesworkspace.imported")}
                        </span>
                      </span>
                      {open ? (
                        <ChevronDown
                          aria-hidden="true"
                          size="0.875rem"
                          className="shrink-0 text-[var(--muted-foreground)]"
                        />
                      ) : (
                        <ChevronRight
                          aria-hidden="true"
                          size="0.875rem"
                          className="shrink-0 text-[var(--muted-foreground)]"
                        />
                      )}
                    </button>
                    {open && selectedLorebook ? (
                      <section
                        id={regionId}
                        role="region"
                        aria-label={selectedLorebook.name}
                        data-ltm-lorebook-workbench={selectedLorebook.id}
                        className="border-t border-[var(--border)]"
                        onFocus={(event) => revealFocusUnderStickyBar(event, lorebookBarRef.current)}
                      >
                        <header className="space-y-2 bg-[var(--secondary)]/25 p-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-semibold">{selectedLorebook.name}</h3>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {selectedLorebook.category} · {entryCountLabel(selectedLorebook.totals.entries)}{" "}
                              {selectedLorebook.totals.candidates}{" "}
                              {localizeUi("ui.longTermMemory.sourcesworkspace.sourceParts")}
                            </p>
                          </div>
                          {selectedLorebook.description ? (
                            <p className="text-xs text-[var(--muted-foreground)]" style={{ maxWidth: "75ch" }}>
                              {selectedLorebook.description}
                            </p>
                          ) : null}
                          {selectedLorebook.tags.length ? (
                            <p className="text-xs text-[var(--muted-foreground)]">{selectedLorebook.tags.join(", ")}</p>
                          ) : null}
                        </header>
                        <div
                          ref={lorebookBarRef}
                          className={lorebookRegionActionsClass}
                          data-ltm-source-primary-actions
                        >
                          <Button
                            primary
                            disabled={selectedBookImportIds.length === 0}
                            {...importActionProps}
                            {...destinationWait()}
                            onClick={() => {
                              if (currentDestinationScope)
                                void runImport(selectedBookImportIds, "import", undefined, lorebookImportSelectionKey);
                            }}
                            data-ltm-lorebook-action="import-selected"
                          >
                            <Check aria-hidden="true" size="0.75rem" />{" "}
                            {localizeUi("ui.longTermMemory.sourcesworkspace.importSelectedCount", {
                              count: selectedBookImportIds.length,
                            })}
                          </Button>
                          <Button
                            disabled={selectedBookRefreshIds.length === 0}
                            {...importActionProps}
                            {...destinationWait()}
                            onClick={() => {
                              if (currentDestinationScope)
                                void runImport(
                                  selectedBookRefreshIds,
                                  "refresh",
                                  undefined,
                                  lorebookRefreshSelectionKey,
                                );
                            }}
                            data-ltm-lorebook-action="refresh-selected"
                          >
                            <RefreshCw aria-hidden="true" size="0.75rem" />{" "}
                            {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSourcesCount", {
                              count: selectedBookRefreshIds.length,
                            })}
                          </Button>
                          {importing ? (
                            <SourceCancelButton
                              localizeUi={localizeUi}
                              onCancel={cancelLtmSourceTask}
                              attribute="data-ltm-lorebook-action"
                            />
                          ) : null}
                        </div>

                        <div role="list" className="divide-y divide-[var(--border)]">
                          {selectedLorebook.entries.map((entry) => {
                            const candidateIds = entry.candidates.map((candidate) => candidate.sourceId),
                              selectedCount = candidateIds.filter((id) => selectedLorebookCandidateIds.has(id)).length;
                            return (
                              <article
                                key={entry.id}
                                role="listitem"
                                data-ltm-lorebook-entry={entry.id}
                                className="space-y-3 p-3"
                              >
                                <div className="flex items-start gap-3">
                                  {selectionMode ? (
                                    <EntrySelect
                                      entry={entry}
                                      checked={candidateIds.length > 0 && selectedCount === candidateIds.length}
                                      indeterminate={selectedCount > 0 && selectedCount < candidateIds.length}
                                      onChange={(checked) => toggleLorebookCandidates(entry.candidates, checked)}
                                    />
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        aria-expanded={openLorebookEntryId === entry.id}
                                        data-ltm-lorebook-entry-toggle={entry.id}
                                        className="inline-flex min-h-11 items-center gap-1 text-left text-sm font-semibold"
                                        onClick={() =>
                                          setOpenLorebookEntryId((current) => (current === entry.id ? null : entry.id))
                                        }
                                      >
                                        {openLorebookEntryId === entry.id ? (
                                          <ChevronDown aria-hidden="true" size="0.875rem" />
                                        ) : (
                                          <ChevronRight aria-hidden="true" size="0.875rem" />
                                        )}
                                        {entry.name}
                                      </button>
                                      <Chip
                                        tone={entryStatusTone(entry)}
                                        className="text-[0.625rem] font-semibold uppercase"
                                      >
                                        {entryStatusLabel(entry, localizeUi)}
                                      </Chip>
                                      {entry.candidateCount > 1 ? (
                                        <span className="text-xs text-[var(--muted-foreground)]">
                                          {entry.candidateCount}{" "}
                                          {localizeUi("ui.longTermMemory.sourcesworkspace.parts")}
                                        </span>
                                      ) : null}
                                      <span className="text-xs text-[var(--muted-foreground)]">
                                        {sourceModeLabel(entry.candidates[0]?.importMode ?? "roleplay", localizeUi)}
                                      </span>
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[var(--muted-foreground)]">
                                      {entry.candidates[0]?.snippet}
                                    </p>
                                  </div>
                                </div>
                                {openLorebookEntryId === entry.id ? (
                                  <div role="list" className="space-y-2">
                                    {lorebookDetails.isLoading ? (
                                      <div
                                        className="h-20 animate-pulse rounded bg-[var(--secondary)] motion-reduce:animate-none"
                                        aria-label={localizeUi(
                                          "ui.longTermMemory.sourcesworkspace.loadingSourceContent",
                                        )}
                                      />
                                    ) : lorebookDetails.isError ? (
                                      <StatusSurface tone="danger">
                                        {errorMessage(
                                          lorebookDetails.error,
                                          localizeUi("ui.longTermMemory.sourcesworkspace.sourcePreviewCouldNotLoad"),
                                        )}
                                        <Button onClick={() => void lorebookDetails.refetch()}>
                                          {localizeUi("ui.longTermMemory.sourcesworkspace.refreshPreview")}
                                        </Button>
                                      </StatusSurface>
                                    ) : null}
                                    {entry.candidates.map((candidate) => (
                                      <ClickSurface
                                        key={candidate.sourceId}
                                        role="listitem"
                                        className="group space-y-2"
                                        style={{ marginLeft: "1.75rem" }}
                                        data-ltm-source-existing-note={
                                          candidate.status === "imported" ? candidate.existingNoteId : undefined
                                        }
                                        data-ltm-source-actions-open={
                                          (candidate.status === "imported" &&
                                            openSourceActionId === candidate.existingNoteId) ||
                                          undefined
                                        }
                                      >
                                        <p className="whitespace-pre-wrap break-words text-xs text-[var(--muted-foreground)]">
                                          {lorebookDetails.data?.details.find(
                                            (detail) => detail.sourceId === candidate.sourceId,
                                          )?.content ?? candidate.snippet}
                                        </p>
                                        <div className="flex items-start gap-2">
                                          {candidate.status === "pending" ? (
                                            <IconButton
                                              icon={FileInput}
                                              label={localizeUi("ui.longTermMemory.sourcesworkspace.importValue1", {
                                                value1: candidate.title,
                                              })}
                                              {...importActionProps}
                                              onClick={(event) => {
                                                stopRowAction(event);
                                                void runImport([candidate.sourceId]);
                                              }}
                                              data-ltm-source-action="import"
                                              data-ltm-source-id={candidate.sourceId}
                                            />
                                          ) : null}
                                          {candidate.status !== "imported" ? null : (
                                            <>
                                              <button
                                                type="button"
                                                data-ltm-source-memory-id={candidate.existingNoteId}
                                                aria-label={localizeUi(
                                                  "ui.longTermMemory.sourcesworkspace.openSourceMemoryValue1",
                                                  {
                                                    value1: candidate.existingNoteTitle,
                                                  },
                                                )}
                                                className="inline-flex min-h-11 flex-1 items-center text-left text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                                                onClick={() => onOpenMemory?.(candidate.existingNoteId)}
                                              >
                                                {localizeUi("ui.longTermMemory.sourcesworkspace.sourceMemory")}{" "}
                                                {candidate.existingNoteTitle}
                                              </button>
                                              {sourceInlineActions(
                                                candidate.existingNoteId,
                                                candidate.existingNoteTitle,
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </ClickSurface>
                                    ))}
                                  </div>
                                ) : null}
                              </article>
                            );
                          })}
                          {selectedLorebook.entries.length === 0 ? (
                            <p className="p-4 text-xs text-[var(--muted-foreground)]">
                              {localizeUi("ui.longTermMemory.sourcesworkspace.thisLorebookHasNoImportableEntries")}
                            </p>
                          ) : null}
                        </div>
                        {focusedLorebookCandidate?.status === "imported" ? (
                          <div className="border-t border-[var(--border)] p-3">
                            <ImportedSourceInspector
                              source={{
                                id: focusedLorebookCandidate.existingNoteId,
                                title: focusedLorebookCandidate.existingNoteTitle,
                              }}
                              disabled={reextractLocked}
                              lockReasonId={reextractReasonId}
                              bulkActive={bulkSelectionActive}
                              onOpenMemory={onOpenMemory}
                              onOpenReview={onOpenReview}
                              onReextract={(id) => void reextract(id)}
                              onManage={(id, title, operation, trigger) =>
                                openSourceOperation({ id, title, operation }, trigger)
                              }
                            />
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                  </div>
                );
              })}
              {!lorebookPreview.isLoading && activeLorebooks.length === 0 ? (
                <EmptyState>
                  {localizeUi("ui.longTermMemory.sourcesworkspace.noLorebooksAreAvailableInThisScope")}
                </EmptyState>
              ) : null}
            </div>
            <SourceLoadMore
              localizeUi={localizeUi}
              hasNextPage={lorebookPreview.hasNextPage}
              fetching={lorebookPreview.isFetching}
              fetchingNextPage={lorebookPreview.isFetchingNextPage}
              onLoadMore={() => void lorebookPreview.fetchNextPage()}
            />
            {destinationBar()}
          </section>
        </div>
      ) : (
        <section
          id={`ltm-source-preview-${source}`}
          role="tabpanel"
          aria-labelledby={`ltm-source-tab-${source}`}
          data-ltm-source-preview={source}
          className="min-w-0"
          style={sourceColumnStyle}
        >
          <section
            className="mari-editor-panel overflow-hidden"
            // clip, not hidden: a hidden overflow becomes the pinned bar's scroll container and stops it pinning.
            style={{ overflow: "clip" }}
            data-ltm-source-navigator
            data-ltm-source-column
            data-ltm-workbench-mode={workbenchMode}
          >
            {columnTop}
            {taskProgressPanel}
            <SourceNavigatorBar
              localizeUi={localizeUi}
              title={localizeUi(sourceTabs.find((tab) => tab.id === source)?.labelKey ?? "")}
              count={previewData?.totals.matches ?? activeFlatRows.length}
              selectionMode={selectionMode}
              onToggleSelection={() => void toggleSelectionMode()}
              top={
                source === "messages" && summaryCheck.data?.totals.matches ? (
                  <p className="text-xs text-[var(--muted-foreground)]" data-ltm-messages-summary-hint>
                    {localizeUi("ui.longTermMemory.sourcesworkspace.chatAlsoHasSummaries")}
                  </p>
                ) : undefined
              }
              query={sourceQuery}
              onQueryChange={setSourceQuery}
              filterStart={
                source === "messages" && branchChats.length > 1 ? (
                  <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
                    {localizeUi("ui.longTermMemory.sourcesworkspace.branch")}
                    <select
                      className={`${inputClass} w-44${activeSourceTask ? " opacity-50" : ""}`}
                      value={branchChatId ?? ""}
                      aria-disabled={activeSourceTask ? true : undefined}
                      onChange={(event) => {
                        if (!activeSourceTask) void changeBranch(event.target.value);
                      }}
                      aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.filterSourcesByBranch")}
                      data-ltm-source-branch
                    >
                      {currentBranchId ? (
                        <option value={currentBranchId}>
                          {localizeUi("ui.longTermMemory.sourcesworkspace.thisBranch")}
                        </option>
                      ) : null}
                      {branchChats
                        .filter((chat) => chat.id !== currentBranchId)
                        .map((chat) => (
                          <option key={chat.id} value={chat.id}>
                            {chat.label}
                          </option>
                        ))}
                      <option value="">{localizeUi("ui.longTermMemory.sourcesworkspace.allBranches")}</option>
                    </select>
                  </label>
                ) : null
              }
              modeFilter={modeFilter}
              modeLocked={Boolean(activeSourceTask)}
              onModeChange={(mode) => void changeModeFilter(mode)}
              reloading={preview.isFetching}
              onReload={() => void preview.refetch()}
              afterFilters={outdatedSourcesGroup}
              source={source}
              statusFilter={sourceStatusFilter}
              statusCounts={{
                all: previewData?.totals.matches ?? rows.length,
                ready: previewData?.totals.ready ?? selectableRows.length,
                imported: previewData?.totals.imported ?? importedRows.length,
              }}
              onStatusChange={changeSourceStatusFilter}
            >
              {selectionMode ? (
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <label className={sourceCheckboxHitClass}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className={sourceCheckboxClass}
                      aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.selectAllValue1", {
                        value1: localizeUi("ui.longTermMemory.sourcesworkspace.sourceParts"),
                      })}
                      checked={activeFlatAllSelected}
                      disabled={sourceStatusFilter === "all" || activeFlatRows.length === 0}
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [selectionKey]: event.target.checked
                            ? activeFlatRows
                                .filter((row) => row.status === "pending" || retryableIdSet.has(row.sourceId))
                                .map((row) => row.sourceId)
                            : [],
                          [importedSelectionKey]: event.target.checked
                            ? activeFlatRows.filter((row) => row.status === "imported").map((row) => row.sourceId)
                            : [],
                        }))
                      }
                      data-ltm-source-select-all={sourceStatusFilter}
                    />
                  </label>
                  <span>
                    {selectedFlatSourceIds.length} {localizeUi("ui.longTermMemory.memoryvault.selected")}
                  </span>
                  {selectedIds.size ? (
                    <Button
                      primary
                      {...importActionProps}
                      {...destinationWait()}
                      onClick={() => {
                        if (currentDestinationScope) void runImport([...selectedIds]);
                      }}
                      data-ltm-source-action="import-selected"
                    >
                      <Check aria-hidden="true" size="0.75rem" />
                      {localizeUi("ui.longTermMemory.sourcesworkspace.importSelected")}
                    </Button>
                  ) : null}
                  {selectedImportedIds.size ? (
                    <Button
                      {...importActionProps}
                      {...destinationWait()}
                      onClick={() => {
                        if (currentDestinationScope) void runImport([...selectedImportedIds], "refresh");
                      }}
                      data-ltm-source-action="refresh-selected"
                    >
                      <RefreshCw aria-hidden="true" size="0.75rem" />
                      {localizeUi("ui.longTermMemory.sourcesworkspace.refreshSelectedSources")}
                    </Button>
                  ) : null}
                  {importing ? <SourceCancelButton localizeUi={localizeUi} onCancel={cancelLtmSourceTask} /> : null}
                </div>
              ) : null}
            </SourceNavigatorBar>
            {bulkQueue}
            {latestTaskButton}
            <div
              id={`ltm-source-results-${source}`}
              role="list"
              aria-busy={preview.isPlaceholderData}
              className="divide-y divide-[var(--border)]"
            >
              {sourceStatusFilter === "all" ? (
                <>
                  <details
                    open={sourceGroupsOpen[source].ready}
                    data-ltm-source-group="ready"
                    onToggle={(event) => {
                      const open = event.currentTarget.open;
                      setSourceGroupsOpen((current) => ({
                        ...current,
                        [source]: { ...current[source], ready: open },
                      }));
                    }}
                  >
                    <summary className="min-h-11 cursor-pointer list-none border-b border-[var(--border)] bg-[var(--secondary)]/25 px-3 py-3 text-xs font-semibold">
                      {localizeUi("ui.longTermMemory.sourcesworkspace.readyToImport")} (
                      {previewData?.totals.ready ?? selectableRows.length})
                    </summary>
                    <div className="divide-y divide-[var(--border)]">
                      {selectableRows.map((row) => renderFlatSourceRow(row, "ready"))}
                    </div>
                  </details>
                  <details
                    open={sourceGroupsOpen[source].imported}
                    data-ltm-source-group="imported"
                    onToggle={(event) => {
                      const open = event.currentTarget.open;
                      setSourceGroupsOpen((current) => ({
                        ...current,
                        [source]: { ...current[source], imported: open },
                      }));
                    }}
                  >
                    <summary className="min-h-11 cursor-pointer list-none bg-[var(--secondary)]/25 px-3 py-3 text-xs font-semibold">
                      {localizeUi("ui.longTermMemory.sourcesworkspace.alreadyImported")} (
                      {previewData?.totals.imported ?? importedRows.length})
                    </summary>
                    <div className="divide-y divide-[var(--border)]">
                      {importedRows.map((row) => renderFlatSourceRow(row, "imported"))}
                    </div>
                  </details>
                </>
              ) : (
                activeFlatRows.map((row) => renderFlatSourceRow(row))
              )}
              {!preview.isLoading && activeFlatRows.length === 0 ? (
                <EmptyState>
                  {sourceStatusFilter === "imported"
                    ? localizeUi("ui.longTermMemory.sourcesworkspace.noSourcesHaveBeenImportedInThisScope")
                    : localizeUi("ui.longTermMemory.sourcesworkspace.noNewOrRetryableSourcesAreReadyToImport")}
                </EmptyState>
              ) : null}
            </div>
            <SourceLoadMore
              localizeUi={localizeUi}
              hasNextPage={preview.hasNextPage}
              fetching={preview.isFetching}
              fetchingNextPage={preview.isFetchingNextPage}
              onLoadMore={() => void preview.fetchNextPage()}
            />
            {importDetailPanel}
            {destinationBar(
              importAllNewIds.length ? (
                <Button
                  primary
                  {...importActionProps}
                  {...destinationWait()}
                  onClick={() => {
                    if (currentDestinationScope) void runImport(importAllNewIds);
                  }}
                  data-ltm-source-action="import-all-new"
                >
                  <FileInput aria-hidden="true" size="0.75rem" />
                  {localizeUi("ui.longTermMemory.sourcesworkspace.importAllNew", {
                    count: importAllNewIds.length,
                  })}
                </Button>
              ) : null,
              importAllNewIds.length ? (
                <p className="text-xs text-[var(--muted-foreground)]" data-ltm-import-limit-hint>
                  {localizeUi("ui.longTermMemory.sourcesworkspace.selectUpTo100SourceParts")}
                </p>
              ) : null,
            )}
          </section>
        </section>
      )}
      {/* Always mounted, so a finished import or refresh is read out instead of mounting with its text. */}
      <p role="status" data-ltm-import-result-status className="sr-only">
        {visibleImportResult ? `${importResultMessage} ${importResultSummary}` : null}
      </p>

      {importResult && visibleImportResult && resultWorkbenchHost
        ? createPortal(
            <section
              ref={importResultRef}
              role="region"
              aria-labelledby={importResultLabelId}
              data-ltm-source-import-result={importResult.batchStatus}
              data-ltm-source-task-result-workbench
              className="mari-editor-panel space-y-3 p-3"
            >
              <h2 id={importResultLabelId} className="text-sm font-semibold" data-ltm-import-result-heading>
                {importResultHeading}
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]" data-ltm-import-result-outcome>
                {importResultOutcome}
              </p>
              <div className="flex flex-wrap gap-2">
                {retryableIds.length ? (
                  <Button
                    primary
                    {...importActionProps}
                    onClick={() => void runImport(retryableIds, "import", importResultContract ?? undefined)}
                    data-ltm-source-action="retry-failed"
                  >
                    <RefreshCw aria-hidden="true" size="0.75rem" />
                    {localizeUi("ui.longTermMemory.sourcesworkspace.retryFailedCount", { count: retryableIds.length })}
                  </Button>
                ) : null}
                {retryableIds.length && importResultContract?.modes?.length ? (
                  <span className="text-xs text-[var(--muted-foreground)]" data-ltm-retry-modes>
                    {localizeUi("ui.longTermMemory.sourcesworkspace.retryUsesModes", {
                      modes: modeList(importResultContract.modes, localizeUi),
                    })}
                  </span>
                ) : null}
                {pendingDraftsProduced ? (
                  <Button
                    primary={!retryableIds.length}
                    onClick={() => onOpenReview?.()}
                    data-ltm-source-action="review-imported-drafts"
                  >
                    {localizeUi("ui.longTermMemory.longtermmemorydetail.openReviewQueue")}
                  </Button>
                ) : null}
              </div>
              <details
                data-ltm-import-result-details
                open={!importCleanlyWaitingInReview || undefined}
                className="space-y-2"
              >
                <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold">
                  {localizeUi("ui.longTermMemory.lastinjectionsummary.details")}
                </summary>
                {importScopeResultMessage ? (
                  <p className="text-xs font-medium" data-ltm-import-scope-result>
                    {importScopeResultMessage}
                  </p>
                ) : null}
                {/* The always-mounted task status line reads this summary; the panel itself holds no live region. */}
                <p data-ltm-import-result-summary className="text-xs text-[var(--muted-foreground)]">
                  {importResultSummary}
                </p>
                {importResult.imported.map((item) => (
                  <article
                    key={item.sourceId}
                    data-ltm-import-outcome={item.extractionStatus}
                    className="space-y-2 border-t border-[var(--border)] py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <strong>{item.title}</strong>
                      <span
                        data-ltm-import-result-mode={item.extractionMode}
                        className="text-[var(--muted-foreground)]"
                      >
                        {sourceModeLabel(item.extractionMode, localizeUi)}
                      </span>
                      <span
                        data-ltm-import-result-modes={item.note.modes.join(",")}
                        className="text-[var(--muted-foreground)]"
                      >
                        {localizeUi("ui.longTermMemory.sourcesworkspace.availableInModes", {
                          modes: modeList(item.note.modes, localizeUi),
                        })}
                      </span>
                      <Chip
                        data-ltm-source-write-status={item.sourceWriteStatus}
                        tone={resultChipTone(item.sourceWriteStatus)}
                      >
                        {importStatusLabel(item.sourceWriteStatus, localizeUi)}
                      </Chip>
                      <Chip
                        data-ltm-extraction-status={item.extractionStatus}
                        data-ltm-extraction-outcome={item.outcome.state}
                        tone={resultChipTone(
                          item.extractionStatus === "succeeded" ? item.outcome.state : item.extractionStatus,
                        )}
                      >
                        {extractionResultLabel(item, localizeUi)}
                      </Chip>
                      <span data-ltm-extraction-accounting className="text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.longTermMemory.sourcesworkspace.suggestionsKeptOfTotal", {
                          kept: item.outcome.keptUnits,
                          total: item.outcome.totalCandidates,
                        })}
                      </span>
                    </div>
                    {item.extractionStatus === "failed" || item.extractionStatus === "cancelled" ? (
                      <p
                        data-ltm-import-item-error
                        className="flex items-start gap-2 text-xs text-[var(--destructive)]"
                      >
                        <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
                        {item.error.message}
                      </p>
                    ) : null}
                    {(item.extractionStatus === "succeeded" || item.extractionStatus === "incomplete") &&
                    item.outcome.droppedUnits > 0 ? (
                      <div className="space-y-2">
                        <p
                          className="text-xs text-[var(--muted-foreground)]"
                          data-ltm-rejected-count={item.outcome.droppedUnits}
                        >
                          {localizeUi("ui.longTermMemory.sourcesworkspace.rejectedSuggestionCount", {
                            count: item.outcome.droppedUnits,
                          })}
                        </p>
                        <Button
                          onClick={() => onOpenReview?.(item.note.id)}
                          data-ltm-source-action="review-rejected-suggestions"
                        >
                          {localizeUi("ui.longTermMemory.sourcesworkspace.reviewRejectedSuggestions")}
                        </Button>
                      </div>
                    ) : null}
                    {item.diagnostics.length ? (
                      <ul className="space-y-1 text-xs text-[var(--muted-foreground)]" data-ltm-extraction-diagnostics>
                        {item.diagnostics.map((diagnostic, index) => (
                          <li key={`${diagnostic.code}-${index}`}>{diagnostic.message}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-ltm-source-memory-id={item.note.id}
                        aria-label={localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemoryValue1", {
                          value1: item.title,
                        })}
                        className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                        onClick={() => onOpenMemory?.(item.note.id)}
                      >
                        {localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemory")}
                      </button>
                      <Button
                        {...reextractActionProps}
                        onClick={() => {
                          if (!reextractLocked) void reextract(item.note.id);
                        }}
                        data-ltm-source-action="re-extract"
                        data-ltm-source-note-id={item.note.id}
                      >
                        <Sparkles aria-hidden="true" size="0.75rem" />
                        {localizeUi("ui.longTermMemory.sourcesworkspace.reExtract")}
                      </Button>
                      <Button onClick={() => onOpenReview?.(item.note.id)} data-ltm-review-query={item.note.id}>
                        {localizeUi("ui.longTermMemory.memoryvault.reviewRelatedDrafts")}
                      </Button>
                    </div>
                  </article>
                ))}
                {importResult.writeFailures.length || importResult.missingSourceIds.length ? (
                  <ul data-ltm-source-import-failures className="space-y-2 text-xs text-[var(--destructive)]">
                    {importResult.writeFailures.map((failure) => (
                      <li
                        key={failure.sourceId}
                        data-ltm-source-write-failure={failure.sourceId}
                        className="flex items-start gap-2"
                      >
                        <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
                        <span>
                          {failure.title}: {failure.error.message} (
                          {importStatusLabel(failure.sourceWriteStatus, localizeUi)},{" "}
                          {importStatusLabel(failure.extractionStatus, localizeUi)})
                        </span>
                      </li>
                    ))}
                    {importResult.missingSourceIds.map((id) => (
                      <li key={id} data-ltm-source-missing={id} className="flex items-start gap-2">
                        <CircleAlert aria-hidden="true" size="0.875rem" className="mt-0.5 shrink-0" />
                        {localizeUi("ui.longTermMemory.sourcesworkspace.missingSourceMemory")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
              <Button onClick={closeTaskResult}>
                {localizeUi("ui.longTermMemory.sourcesworkspace.backToPreview")}
              </Button>
            </section>,
            resultWorkbenchHost,
          )
        : null}
    </section>
  );
}
