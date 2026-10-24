import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronRight, FileText, Link2, Plus, Search, Trash2, X } from "lucide-react";
import type {
  LtmBulkNoteResult,
  LtmLink,
  LtmMode,
  LtmNote,
  LtmNoteType,
  LtmScope,
  LtmStatus,
  LtmSubject,
  LtmRenameNoteSectionPreviewResponse,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmKeywordIntent,
  ltmKeywordKey,
  removeLtmKeyword,
  setLtmManualKeywords,
} from "../../../../../shared/src/features/agents/long-term-memory/keywords.js";
import {
  chatOnlyLtmScope,
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
} from "../../../../../shared/src/features/agents/long-term-memory/scope.js";
import {
  errorMessage,
  invalidateLtmQueries,
  derivedNotesQueryOptions,
  queryKeys,
  request,
  requestAllNotes,
  requestNotesByIds,
  scopeTargetsQueryOptions,
  settingsQueryOptions,
} from "../api";
import { Button, IconButton, InfoPopover, inputClass, StatusSurface } from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";
import {
  humanizeLabel,
  labelKeys,
  localizedLabel,
  memoryLabel as formatMemoryLabel,
  noteTypeLabel as formatNoteTypeLabel,
  scopeTargetLabel as formatScopeTargetLabel,
} from "../display-labels";
import { selectLtmPluralForm, useLtmTranslation, type LtmTranslationFunction } from "../localization";
import { LtmWorkspace, type LtmWorkspacePane } from "../LtmWorkspace";
import {
  buildScopeIndexes,
  buildScopeMemoryPresence,
  deriveScopeBranchChats,
  deriveScopeConversations,
  uniqueById,
} from "../scope-targets";
import type { AvailabilityChatTarget } from "../AvailabilityTabRail";
import { SourceScopeCombobox } from "../SourceScopeCombobox";
import type { ScopeTarget } from "../sources/source-shared";
import { TargetPicker, type PickerTarget } from "./TargetPicker";
import type { ScopeTargetLocalCharacter } from "../scope-targets";
import { normalizeDetailName } from "./detail-name";
import {
  availabilityEntries,
  hasExplicitScope,
  modes,
  sameScope,
  splitBulkAvailabilityTarget,
  withWholeChatBranches,
} from "./vault-shared";
import type { AvailabilityTargets, Target } from "./vault-shared";
import { MemoryAvailabilityWorkbench } from "./MemoryAvailabilityWorkbench";
import { BulkAvailabilityWorkbench } from "./BulkAvailabilityWorkbench";
import { Pill } from "./Pill";
import { VaultRow, type VaultRowActions } from "./VaultRow";

const noteTypes: readonly LtmNoteType[] = [
  "timeline_event",
  "character",
  "relationship",
  "scene",
  "thread",
  "world",
  "tone",
];
const groupedNoteTypes: ReadonlyArray<{
  type: LtmNoteType;
  labelKey: string;
}> = [
  {
    type: "source",
    labelKey: "ui.longTermMemory.memoryvault.source",
  },
  {
    type: "timeline_event",
    labelKey: "ui.longTermMemory.memoryvault.timelineEvents",
  },
  {
    type: "character",
    labelKey: "ui.longTermMemory.memoryvault.characters",
  },
  {
    type: "relationship",
    labelKey: "ui.longTermMemory.memoryvault.relationships",
  },
  {
    type: "thread",
    labelKey: "ui.longTermMemory.memoryvault.threads",
  },
  {
    type: "scene",
    labelKey: "ui.longTermMemory.memoryvault.scenes",
  },
  {
    type: "world",
    labelKey: "ui.longTermMemory.memoryvault.world",
  },
  {
    type: "tone",
    labelKey: "ui.longTermMemory.memoryvault.tone",
  },
];

function detailScrollBehavior(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
const statuses: readonly LtmStatus[] = ["active", "resolved", "archived"];

const relations: LtmLink["relation"][] = [
  "occurred_in",
  "triggered_by",
  "resolved_in",
  "evidenced_by",
  "affects_relationship",
  "affects_character",
  "caused_by",
  "involves",
  "blocks",
  "planted_in",
  "paid_off_in",
  "extracted_from",
];
const recommendedRelations: Record<LtmNoteType, LtmLink["relation"][]> = {
  source: [],
  timeline_event: ["involves", "occurred_in", "triggered_by", "caused_by", "evidenced_by"],
  character: ["involves", "affects_character", "affects_relationship"],
  relationship: ["involves", "affects_character", "affects_relationship", "caused_by"],
  scene: ["involves", "occurred_in", "triggered_by"],
  thread: ["involves", "blocks", "resolved_in", "planted_in", "paid_off_in"],
  world: ["involves", "caused_by", "evidenced_by"],
  tone: ["involves", "evidenced_by"],
};
const prefixes: Record<LtmNoteType, string> = {
  source: "source",
  timeline_event: "timeline",
  character: "char",
  relationship: "rel",
  scene: "scene",
  thread: "thread",
  world: "world",
  tone: "tone",
};

/** A branch reads "Chat - Branch" wherever an existing branch assignment is named. */
function branchChatLabel(chat: { label: string; chatName?: string | null; groupId?: string | null }) {
  return chat.groupId && chat.chatName?.trim() ? `${chat.chatName.trim()} - ${chat.label}` : chat.label;
}

function targetDisplayLabel(target: Target | null | undefined) {
  if (!target) return "";
  const comment = target.comment?.trim();
  if (comment) return `${target.label} - ${comment}`;
  return target.chatName?.trim() ? `${target.chatName.trim()} - ${target.label}` : target.label;
}

type ArchiveUndoState = {
  notes: Array<{ id: string; status: LtmStatus }>;
  // What Undo reverses; the banner shows it beside Undo, apart from the notice slot other actions write to.
  caption: string;
};

function bulkAvailabilityScope(targets: readonly string[]): Partial<LtmScope> | undefined {
  const chatIds: string[] = [];
  const groupIds: string[] = [];
  const characterIds: string[] = [];
  const personaIds: string[] = [];
  for (const target of targets) {
    const [kind, id] = splitBulkAvailabilityTarget(target);
    if (kind === "chat") chatIds.push(id);
    if (kind === "group") groupIds.push(id);
    if (kind === "character") characterIds.push(id);
    if (kind === "persona") personaIds.push(id);
  }
  if (!chatIds.length && !groupIds.length && !characterIds.length && !personaIds.length) return undefined;
  return {
    ...(chatIds.length ? { chatIds } : {}),
    ...(groupIds.length ? { groupIds } : {}),
    ...(characterIds.length ? { characterIds } : {}),
    ...(personaIds.length ? { personaIds } : {}),
  };
}

type NoteResponse = { note: LtmNote };
type EditorMutationResponse = NoteResponse & {
  rebuild?: { status: "complete" | "deferred"; error?: string };
};
type ValidationIssue = {
  message: string;
  focus: "title" | "details" | "subjects" | "links" | "availability";
};
type NoteEvent = {
  id: string;
  ts: string;
  type: string;
  summary?: string;
};

const sessionTargets = new Map<string, Target>();
const sessionSecondaryTargets = new Map<string, Target>();
type NavigatorState = {
  search: string;
  statusFilter: LtmStatus | "all";
  sourceFilter: boolean;
  sort: "updated" | "title" | "created";
  scrollTop: number;
  filterModes?: LtmMode[];
};
const navigatorStates = new Map<string, NavigatorState>();
// Each type group in the navigator renders at most this many rows until "Show more". Search,
// the filters, the group counts and "Select visible" still cover every memory in the place.
const vaultGroupRowLimit = 100;
const noShownRowCounts: Partial<Record<LtmNoteType, number>> = {};

function fingerprint(note: LtmNote | null) {
  return note ? JSON.stringify(note) : "";
}

function notesRequestPath(scope: LtmScope | null | undefined) {
  return `/notes?${new URLSearchParams({
    ...(scope?.chatIds?.length ? { scopeChatIds: scope.chatIds.join(",") } : {}),
    ...(scope?.groupId ? { scopeGroupId: scope.groupId } : {}),
    ...(scope?.characterIds?.length ? { scopeCharacterIds: scope.characterIds.join(",") } : {}),
    ...(scope?.personaId ? { scopePersonaId: scope.personaId } : {}),
    ...(scope ? { includeGlobal: "false" } : {}),
  })}`;
}

function subjectSearchValues(note: LtmNote, subjectLabels: (subject: LtmSubject) => string) {
  return (note.subjects ?? []).flatMap((subject) => [subject.key, subject.ref?.id, subjectLabels(subject)]);
}
function searchable(
  note: LtmNote,
  notesById: ReadonlyMap<string, LtmNote>,
  subjectLabels: (subject: LtmSubject) => string,
) {
  return [
    note.id,
    note.title,
    note.type,
    note.status,
    ...note.tags,
    ...note.keywords,
    ...subjectSearchValues(note, subjectLabels),
    ...note.links.flatMap((link) => [link.target, notesById.get(link.target)?.title]),
    ...Object.values(note.sections).map((section) => section.text),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}
function activeKeywordValues(note: LtmNote) {
  const intent = getLtmKeywordIntent(note);
  const suppressed = new Set(intent.suppressed.map(ltmKeywordKey));
  return [...intent.generated, ...intent.manual].filter(
    (keyword, index, values) =>
      !suppressed.has(ltmKeywordKey(keyword)) &&
      values.findIndex((value) => ltmKeywordKey(value) === ltmKeywordKey(keyword)) === index,
  );
}
function preview(
  note: LtmNote,
  search: string,
  localizeUi: LtmTranslationFunction,
  notesById: ReadonlyMap<string, LtmNote>,
  subjectLabels: (subject: LtmSubject) => string,
) {
  const sections = Object.entries(note.sections).filter(([, section]) => section.text.trim());
  const query = search.trim().toLocaleLowerCase();
  const selected = sections.find(([, candidate]) => candidate.text.toLocaleLowerCase().includes(query));
  if (!selected) {
    const keyword = activeKeywordValues(note).find((value) => value.toLocaleLowerCase().includes(query));
    if (keyword) return { label: localizeUi("ui.longTermMemory.memoryvault.keywordMatch"), text: keyword };
    const subject = note.subjects?.find((value) =>
      [value.key, value.ref?.id, subjectLabels(value)].some((item) => item?.toLocaleLowerCase().includes(query)),
    );
    if (subject)
      return { label: localizeUi("ui.longTermMemory.memoryvault.subjectMatch"), text: subjectLabels(subject) };
    const link = note.links.find((value) => notesById.get(value.target)?.title?.toLocaleLowerCase().includes(query));
    if (link)
      return {
        label: localizeUi("ui.longTermMemory.memoryvault.linkedToMatch"),
        text: notesById.get(link.target)?.title ?? link.target,
      };
  }
  if (!selected)
    return sections[0]
      ? { label: formatNoteTypeLabel(sections[0][0], localizeUi), text: sections[0][1].text.trim().slice(0, 180) }
      : null;
  const [key, section] = selected;
  const text = section.text.trim();
  const match = query ? text.toLocaleLowerCase().indexOf(query) : -1;
  const start = match > 60 ? match - 60 : 0;
  return {
    label: formatNoteTypeLabel(key, localizeUi),
    text: `${start ? "..." : ""}${text.slice(start, start + 180)}${start + 180 < text.length ? "..." : ""}`,
  };
}

function deleteConfirmationExcerpt(note: LtmNote, emptyLabel: string) {
  const text = Object.values(note.sections)
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/gu, " ");
  if (!text) return emptyLabel;
  return text.length > 180 ? `${text.slice(0, 180).trimEnd()}...` : text;
}

function suggestedDetailKey(type: LtmNoteType) {
  return {
    timeline_event: "event",
    character: "facts",
    relationship: "state",
    scene: "summary",
    thread: "summary",
    world: "facts",
    tone: "observations",
    source: "content",
  }[type];
}
function newNote(scope: LtmScope, localizeUi: LtmTranslationFunction): LtmNote {
  const now = new Date().toISOString();
  return {
    id: `world_${randomId()}`,
    title: localizeUi("ui.longTermMemory.memoryvault.untitledMemory"),
    type: "world",
    status: "active",
    modes: ["roleplay"],
    scope,
    tags: [],
    keywords: [],
    createdAt: now,
    updatedAt: now,
    links: [],
    sections: {
      facts: {
        text: localizeUi("ui.longTermMemory.memoryvault.addDurableContextHere"),
        updatedAt: now,
      },
    },
    conflicts: [],
    version: 1,
  };
}

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function recoveredNote(
  handoff: NonNullable<LongTermMemoryDestinationProps["recoveryHandoff"]>,
  localizeUi: LtmTranslationFunction,
): LtmNote {
  const note = newNote(handoff.scope, localizeUi);
  const recovery = handoff.candidate.recovery;
  const type = recovery?.noteType && recovery.noteType !== "source" ? recovery.noteType : note.type;
  const id = `${prefixes[type]}_${randomId()}`;
  const sectionKey = recovery?.sectionKey ?? "facts";
  const suggestedTitle = (recovery?.noteId ?? id)
    .replace(new RegExp(`^${prefixes[type]}_?`), "")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
  const now = new Date().toISOString();
  return {
    ...note,
    id,
    title: suggestedTitle || localizeUi("ui.longTermMemory.memoryvault.recoveredMemory"),
    type,
    status: recovery?.status ?? note.status,
    modes: handoff.modes,
    scope: handoff.scope,
    sections: {
      [sectionKey]: {
        text: handoff.candidate.recoveryCandidate?.text ?? handoff.candidate.snippet ?? handoff.candidate.message,
        updatedAt: now,
        ...(handoff.candidate.recoveryCandidate?.evidence
          ? { evidence: handoff.candidate.recoveryCandidate.evidence }
          : {}),
      },
    },
  };
}

export default function MemoryVault({
  props,
  onDirtyChange,
  onSaveRequest,
  onOpenReview,
  openedNoteId,
  createMemoryRequest,
  onCreateMemoryRequestHandled,
  recoveryHandoff,
  onOpenSources,
  onOpenActivity,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const untitledMemoryLabel = localizeUi("ui.longTermMemory.memoryvault.untitledMemory");
  const memoryLabel = useCallback(
    (note: Pick<LtmNote, "title"> | null | undefined) => formatMemoryLabel(note, untitledMemoryLabel),
    [untitledMemoryLabel],
  );
  const noteTypeLabel = (type: string) => formatNoteTypeLabel(type, localizeUi);
  const statusLabel = (status: string) => localizedLabel(status, localizeUi, labelKeys.status);
  const modeLabel = (mode: string) => localizedLabel(mode, localizeUi, labelKeys.mode);
  const relationLabel = (relation: string) => localizedLabel(relation, localizeUi, labelKeys.relation);
  const scopeTargetLabel = (
    kind: "chat" | "character" | "group" | "persona" | "local_character",
    id: string,
    targets: ReadonlyArray<{ id: string; label: string }>,
    fallbackLabels: Partial<Record<"chat" | "character" | "group" | "persona" | "local_character", string>> = {},
  ) =>
    formatScopeTargetLabel(kind, id, targets, {
      chat: localizeUi("ui.longTermMemory.memoryvault.chat"),
      character: localizeUi("ui.longTermMemory.memoryvault.character"),
      group: localizeUi("ui.longTermMemory.memoryvault.branchGroup"),
      persona: localizeUi("ui.longTermMemory.memoryvault.persona"),
      ...fallbackLabels,
    });
  const client = useQueryClient();
  const statusInputId = useId();
  const vaultRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const contextKey = props.chatId ?? "__global__";
  const initialNavigatorState = navigatorStates.get(contextKey);
  const [search, setSearch] = useState(initialNavigatorState?.search ?? "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<Target | null>(() => sessionTargets.get(contextKey) ?? null);
  const [secondaryTarget, setSecondaryTarget] = useState<Target | null>(
    () => sessionSecondaryTargets.get(contextKey) ?? null,
  );
  const targetContextKey = useRef(contextKey);
  const [statusFilter, setStatusFilter] = useState<LtmStatus | "all">(initialNavigatorState?.statusFilter ?? "all");
  const [filterModes, setFilterModes] = useState<LtmMode[]>(() => initialNavigatorState?.filterModes ?? [...modes]);
  const [sourceFilter, setSourceFilter] = useState(initialNavigatorState?.sourceFilter ?? false);
  const [sort, setSort] = useState<"updated" | "title" | "created">(initialNavigatorState?.sort ?? "updated");
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [mobilePane, setMobilePane] = useState<LtmWorkspacePane>("navigator");
  const [inspectorMount, setInspectorMount] = useState<HTMLDivElement | null>(null);
  const navigatorScrollRef = useRef<HTMLElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState<LtmNote | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState<"single" | "bulk" | null>(null);
  // Refine holds the rarer filters. A second place or a mode filter opens it, and closing it stays the user's choice.
  const refineActive = Boolean(secondaryTarget) || filterModes.length < modes.length;
  const [refineOpen, setRefineOpen] = useState(refineActive);
  useEffect(() => {
    if (refineActive) setRefineOpen(true);
  }, [refineActive]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  function setMobilePaneAndFocus(pane: LtmWorkspacePane) {
    setMobilePane(pane);
    requestAnimationFrame(() => {
      const workspace = vaultRef.current?.querySelector<HTMLElement>("[data-ltm-workspace]");
      const target = workspace?.querySelector<HTMLElement>(
        `[data-ltm-workspace-pane-tab="${pane}"], [data-ltm-workspace-pane="${pane}"] button, [data-ltm-workspace-pane="${pane}"] [tabindex]:not([tabindex="-1"]), [data-ltm-workspace-pane="${pane}"][tabindex]`,
      );
      target?.focus({ preventScroll: true });
    });
  }
  const [saved, setSaved] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // One feedback slot: a success notice, or a warning when a change was kept but something behind it is still pending.
  // `setNotice` always resets the tone, so a later message never inherits a warning.
  const [noticeState, setNoticeState] = useState({ message: "", warning: false });
  const notice = noticeState.message;
  const setNotice = useCallback((message: string) => setNoticeState({ message, warning: false }), []);
  const setWarning = useCallback((message: string) => setNoticeState({ message, warning: true }), []);
  const [archiveUndo, setArchiveUndo] = useState<ArchiveUndoState | null>(null);
  // Batch, row and Undo actions use `aria-disabled` so the control keeps focus while it runs, and
  // `batchPendingRef` blocks a second run before React re-renders. When one finishes, focus moves to
  // the result banner, which holds Undo, unless the user moved it elsewhere meanwhile.
  const batchPendingRef = useRef(false);
  // Save keeps focus while it runs (`aria-disabled`). A second save, from the button, the shortcut or the unsaved-changes
  // dialog, gets this run's result instead of starting another or reading "still running" as "failed".
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const feedbackTriggerRef = useRef<Element | null>(null);
  const [feedbackFocusRequest, setFeedbackFocusRequest] = useState(0);
  const focusFeedback = () => setFeedbackFocusRequest((count) => count + 1);
  useEffect(() => {
    if (!feedbackFocusRequest) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== feedbackTriggerRef.current) return;
    vaultRef.current?.querySelector<HTMLElement>("[data-ltm-vault-feedback] [data-ltm-status]")?.focus();
  }, [feedbackFocusRequest]);
  const [recoverySuggestionId, setRecoverySuggestionId] = useState<string | null>(null);
  const [bulkEditStatus, setBulkEditStatus] = useState<LtmStatus | "">("");
  const [bulkAvailabilityModes, setBulkAvailabilityModes] = useState<LtmMode[]>([]);
  const [bulkAvailabilityTargets, setBulkAvailabilityTargets] = useState<string[]>([]);
  const [bulkAvailabilityAction, setBulkAvailabilityAction] = useState<"add" | "remove">("add");
  const [unsavedNavigation, setUnsavedNavigation] = useState<string | null>(null);
  const unsavedDialogRef = useRef<HTMLDialogElement>(null);
  const renameDialogRef = useRef<HTMLDialogElement>(null);
  const unsavedTriggerRef = useRef<HTMLElement | null>(null);
  const unsavedResolveRef = useRef<((decision: "save" | "discard" | "stay") => void) | null>(null);
  const [openActionNoteId, setOpenActionNoteId] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkRelation, setLinkRelation] = useState<LtmLink["relation"]>("involves");
  const [keywordInput, setKeywordInput] = useState("");
  // A keyword error belongs to the text that caused it, so it hides once that text changes.
  const [keywordError, setKeywordError] = useState<{ input: string; message: string } | null>(null);
  const visibleKeywordError = keywordError?.input === keywordInput ? keywordError.message : "";
  const [sectionKey, setSectionKey] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const addSectionButtonRef = useRef<HTMLButtonElement>(null);
  const [renamingSectionKey, setRenamingSectionKey] = useState<string | null>(null);
  const [renamedSectionKey, setRenamedSectionKey] = useState("");
  const [renamePreview, setRenamePreview] = useState<LtmRenameNoteSectionPreviewResponse | null>(null);
  const [renameError, setRenameError] = useState("");
  // The rename dialog unmounts on close, so focus returns to its trigger (or the button now in its
  // place, after the key changed) once the rename is no longer busy.
  const renameTriggerRef = useRef<{ element: Element | null; index: number } | null>(null);
  const [validation, setValidation] = useState<ValidationIssue[]>([]);
  const validationRef = useRef<HTMLDivElement>(null);
  const navigatorContextRef = useRef<string | null>(null);
  const editorSession = useRef(0);
  const noteLoadSession = useRef(0);
  // A permanent-delete confirmation must not act on targets the user has since
  // deselected or re-scoped while its target lookup was still resolving. The
  // revision changes on every selection or secondary-scope change; the delete
  // path captures it before awaiting and re-checks it before confirming and
  // before submitting.
  const deleteTargetRevision = useRef(0);

  useEffect(() => {
    deleteTargetRevision.current += 1;
  }, [checked, secondaryTarget]);
  useEffect(() => {
    if (navigatorContextRef.current !== contextKey) return;
    navigatorStates.set(contextKey, {
      search,
      statusFilter,
      sourceFilter,
      sort,
      filterModes,
      scrollTop: navigatorScrollRef.current?.scrollTop ?? initialNavigatorState?.scrollTop ?? 0,
    });
  }, [contextKey, filterModes, initialNavigatorState?.scrollTop, search, sort, sourceFilter, statusFilter]);
  useEffect(() => {
    navigatorContextRef.current = contextKey;
    const state = navigatorStates.get(contextKey) ?? {
      search: "",
      statusFilter: "all" as const,
      sourceFilter: false,
      sort: "updated" as const,
      filterModes: [...modes],
      scrollTop: 0,
    };
    navigatorStates.set(contextKey, state);
    setSearch(state.search);
    setStatusFilter(state.statusFilter);
    setSourceFilter(state.sourceFilter);
    setSort(state.sort);
    setFilterModes(state.filterModes ?? [...modes]);
    requestAnimationFrame(() => {
      if (navigatorScrollRef.current) navigatorScrollRef.current.scrollTop = state.scrollTop;
    });
  }, [contextKey]);
  // Below 48rem the list scrolls with the page, so going back to it brings the open memory into view.
  useEffect(() => {
    const noteId = draftRef.current?.id;
    if (mobilePane !== "navigator" || !noteId) return;
    requestAnimationFrame(() =>
      navigatorScrollRef.current
        ?.querySelector(`[data-ltm-note-id="${CSS.escape(noteId)}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    );
  }, [mobilePane]);
  useEffect(() => {
    if (!validation.length) return;
    requestAnimationFrame(() => validationRef.current?.focus({ preventScroll: true }));
  }, [validation.length]);
  const focusValidation = (focus: ValidationIssue["focus"]) => {
    if (focus === "availability") {
      openAvailability();
      return;
    }
    if (focus === "links") setDetailsOpen(true);
    requestAnimationFrame(() => {
      const selector =
        focus === "title"
          ? "[data-ltm-field='title']"
          : focus === "subjects"
            ? "[data-ltm-field='subjects']"
            : focus === "links"
              ? "[data-ltm-linked-memories] input"
              : "[data-ltm-field='section'][aria-invalid='true'], [data-ltm-details]";
      vaultRef.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    onSaveRequest?.(save);
    return () => onSaveRequest?.(null);
  });

  const scopeTargets = useQuery(scopeTargetsQueryOptions(props.chatId));
  useEffect(() => {
    if (!target && scopeTargets.isSuccess) {
      const currentChat = scopeTargets.data?.chats.find((chat) => chat.id === props.chatId);
      setTarget({
        id: currentChat ? `chat:${currentChat.id}` : "all",
        label: currentChat
          ? (props.chatName ?? localizeUi("ui.longTermMemory.memoryvault.currentChat"))
          : localizeUi("ui.longTermMemory.memoryvault.allMemories"),
        ...(currentChat && scopeTargets.data?.currentScope ? { scope: scopeTargets.data.currentScope } : {}),
      });
    }
  }, [localizeUi, props.chatId, props.chatName, scopeTargets.data, scopeTargets.isSuccess, target]);
  useEffect(() => {
    if (
      target?.id === `chat:${props.chatId}` &&
      scopeTargets.isSuccess &&
      !scopeTargets.data?.chats.some((chat) => chat.id === props.chatId)
    )
      setTarget({
        id: "all",
        label: localizeUi("ui.longTermMemory.memoryvault.allMemories"),
      });
  }, [localizeUi, props.chatId, scopeTargets.data, scopeTargets.isSuccess, target?.id]);
  useEffect(() => {
    if (target && targetContextKey.current === contextKey) sessionTargets.set(contextKey, target);
  }, [contextKey, target]);
  useEffect(() => {
    if (targetContextKey.current !== contextKey) return;
    if (secondaryTarget) sessionSecondaryTargets.set(contextKey, secondaryTarget);
    else sessionSecondaryTargets.delete(contextKey);
  }, [contextKey, secondaryTarget]);
  useEffect(() => {
    setTarget((current) =>
      current?.id === `chat:${props.chatId}`
        ? {
            ...current,
            label: props.chatName ?? localizeUi("ui.longTermMemory.memoryvault.currentChat"),
          }
        : current,
    );
  }, [localizeUi, props.chatId, props.chatName]);
  useEffect(() => {
    editorSession.current += 1;
    noteLoadSession.current += 1;
    targetContextKey.current = contextKey;
    setTarget(sessionTargets.get(contextKey) ?? null);
    setSecondaryTarget(sessionSecondaryTargets.get(contextKey) ?? null);
    setDraft(null);
    setAvailabilityOpen(null);
    setSaved("");
    setSaveState("idle");
    setIsNew(false);
    setBusy("");
    setError("");
    setNotice("");
    setArchiveUndo(null);
    setOpenActionNoteId(null);
    setDetailsOpen(false);
    setLinkTarget("");
    setLinkRelation("involves");
    setSectionKey("");
    setAddingSection(false);
    setChecked(new Set());
    setMobilePaneAndFocus("navigator");
    // Context switches are the only reset boundary. Dedicated effects above
    // update chat labels without discarding an open draft.
  }, [contextKey]);
  useEffect(() => {
    if (
      target?.id === `chat:${props.chatId}` &&
      scopeTargets.data?.chats.some((chat) => chat.id === props.chatId) &&
      scopeTargets.data?.currentScope
    ) {
      setTarget((current) => (current ? { ...current, scope: scopeTargets.data!.currentScope! } : current));
    }
  }, [props.chatId, scopeTargets.data, target?.id]);
  const currentScope = scopeTargets.data?.currentScope;
  const targetScopeResolved =
    target?.id !== `chat:${props.chatId}` ||
    Boolean(target.scope && currentScope && sameScope(target.scope, currentScope));
  const scopeTargetResolved = Boolean(
    target && targetContextKey.current === contextKey && scopeTargets.isSuccess && targetScopeResolved,
  );
  const localCharacters = useQuery({
    queryKey: queryKeys.localCharacters(props.chatId),
    staleTime: 30_000,
    enabled: scopeTargetResolved && Boolean(draft && (draft.type === "character" || draft.type === "relationship")),
    queryFn: () =>
      request<ScopeTargetLocalCharacter[]>(
        `/local-characters?includeAllChats=true${props.chatId ? `&chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  const notesScope = target?.id === `chat:${props.chatId}` ? currentScope : target?.scope;
  const secondaryNotesScope = secondaryTarget?.scope;
  const notes = useQuery({
    queryKey: [...queryKeys.notes, contextKey, target?.id, notesScope, secondaryTarget?.id, secondaryNotesScope],
    enabled: scopeTargetResolved,
    queryFn: async () => {
      const primary = await requestAllNotes<LtmNote>(notesRequestPath(notesScope));
      if (!secondaryTarget) return { displayed: primary, linkContext: primary };
      // ponytail: AND is an exact client-side intersection of the two single-place
      // result sets, so the server keeps its OR-within-one-place scope contract.
      const secondary = await requestAllNotes<LtmNote>(notesRequestPath(secondaryNotesScope));
      const secondaryIds = new Set(secondary.map((note) => note.id));
      // `displayed` drives the navigator and bulk selection; `linkContext` keeps the
      // primary place's notes so link titles, incoming links and linked-title search
      // still resolve for memories the second place excludes.
      return { displayed: primary.filter((note) => secondaryIds.has(note.id)), linkContext: primary };
    },
  });
  const settings = useQuery(settingsQueryOptions);
  const noteEvents = useQuery({
    queryKey: [...queryKeys.activity, "note", draft?.id],
    enabled: Boolean(draft && !isNew),
    queryFn: () => request<{ events: NoteEvent[] }>(`/events?noteId=${encodeURIComponent(draft!.id)}&limit=5`),
  });
  const allNotes = notes.data?.displayed ?? [];
  const linkContextNotes = notes.data?.linkContext ?? [];
  const notesById = useMemo(
    () => new Map((notes.data?.linkContext ?? []).map((note) => [note.id, note])),
    [notes.data],
  );
  const subjectSearchLabel = useCallback(
    (subject: LtmSubject) => {
      if (!subject.ref) return localizeUi("ui.longTermMemory.memoryvault.unresolvedSubject");
      const targets =
        subject.ref.kind === "character"
          ? scopeTargets.data?.characters
          : subject.ref.kind === "persona"
            ? scopeTargets.data?.personas
            : subject.ref.kind === "local_character"
              ? localCharacters.data
              : [];
      return targets?.find((target) => target.id === subject.ref!.id)?.label ?? subject.ref.id;
    },
    [localCharacters.data, localizeUi, scopeTargets.data],
  );
  // The list filters with a deferred copy of the search, so the field updates at once and React
  // renders the filtered rows in the background, dropping that render when another key arrives.
  const deferredSearch = useDeferredValue(search);
  const visible = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase();
    return (notes.data?.displayed ?? [])
      .filter(
        (note) =>
          (statusFilter === "all" || note.status === statusFilter) &&
          (sourceFilter ? note.type === "source" : note.type !== "source") &&
          (!filterModes.length || filterModes.some((mode) => note.modes.includes(mode))) &&
          (!query || searchable(note, notesById, subjectSearchLabel).includes(query)),
      )
      .sort((left, right) =>
        sort === "title"
          ? memoryLabel(left).localeCompare(memoryLabel(right))
          : sort === "created"
            ? right.createdAt.localeCompare(left.createdAt)
            : right.updatedAt.localeCompare(left.updatedAt),
      );
  }, [
    deferredSearch,
    filterModes,
    memoryLabel,
    notes.data?.displayed,
    notesById,
    sort,
    sourceFilter,
    statusFilter,
    subjectSearchLabel,
  ]);
  // "Show more" counts apply to one list: a new search, filter, sort or place starts again at the limit.
  const shownRowsKey = JSON.stringify([
    contextKey,
    target?.id,
    secondaryTarget?.id,
    deferredSearch,
    statusFilter,
    sourceFilter,
    filterModes,
    sort,
  ]);
  const [shownRows, setShownRows] = useState({ key: shownRowsKey, counts: noShownRowCounts });
  if (shownRows.key !== shownRowsKey && shownRows.counts !== noShownRowCounts)
    setShownRows({ key: shownRowsKey, counts: noShownRowCounts });
  const shownRowCounts = shownRows.key === shownRowsKey ? shownRows.counts : noShownRowCounts;
  const navigatorGroups = useMemo(
    () =>
      groupedNoteTypes.flatMap(({ type, labelKey }) => {
        const group = visible.filter((note) => note.type === type);
        if (!group.length) return [];
        const shown = group.slice(0, shownRowCounts[type] ?? vaultGroupRowLimit).map((note) => ({
          note,
          preview: preview(note, deferredSearch, localizeUi, notesById, subjectSearchLabel),
        }));
        return [{ type, labelKey, count: group.length, shown, nextNoteId: group[shown.length]?.id }];
      }),
    [deferredSearch, localizeUi, notesById, shownRowCounts, subjectSearchLabel, visible],
  );
  // Show more moves focus to the first row it adds, so keyboard users continue where the list grew.
  const focusRowAfterShowMore = useRef<string | null>(null);
  const showMoreRows = (type: LtmNoteType, shownCount: number, nextNoteId: string | undefined) => {
    focusRowAfterShowMore.current = nextNoteId ?? null;
    setShownRows({ key: shownRowsKey, counts: { ...shownRowCounts, [type]: shownCount + vaultGroupRowLimit } });
  };
  useEffect(() => {
    const noteId = focusRowAfterShowMore.current;
    if (!noteId) return;
    focusRowAfterShowMore.current = null;
    navigatorScrollRef.current
      ?.querySelector<HTMLElement>(`[data-ltm-note-id="${CSS.escape(noteId)}"] button`)
      ?.focus();
  }, [shownRows]);
  const hasFilterableNotes = allNotes.length > 0 && (sourceFilter || allNotes.some((note) => note.type !== "source"));
  const clearNavigatorFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSourceFilter(false);
    setSort("updated");
    setFilterModes([...modes]);
  };
  const hiddenChecked = [...checked].filter((id) => !visible.some((note) => note.id === id)).length;
  const confirmationScopeTargets = {
    chats: scopeTargets.data?.chats ?? [],
    groups: scopeTargets.data?.groups ?? [],
    characters: scopeTargets.data?.characters ?? [],
    personas: scopeTargets.data?.personas ?? [],
  };
  const confirmationScopeLabel = (note: LtmNote) => {
    const targetLabel = (targets: ReadonlyArray<{ id: string; label: string }>, id: string) =>
      targets.find((target) => target.id === id)?.label ?? id;
    const labels = [
      ...getLtmScopeChatIds(note.scope).map((id) => {
        const target = confirmationScopeTargets.chats.find((candidate) => candidate.id === id);
        return target?.chatName?.trim() || targetLabel(confirmationScopeTargets.chats, id);
      }),
      ...getLtmScopeGroupIds(note.scope).map((id) => targetLabel(confirmationScopeTargets.groups, id)),
      ...(note.scope.characterIds ?? []).map((id) => targetLabel(confirmationScopeTargets.characters, id)),
      ...getLtmScopePersonaIds(note.scope).map((id) => targetLabel(confirmationScopeTargets.personas, id)),
    ];
    return labels.length ? labels.join(", ") : localizeUi("ui.longTermMemory.memoryvault.allMemories");
  };
  const toggleVisibleSelection = (selected: boolean) =>
    setChecked((current) => {
      const visibleIds = visible.filter((note) => note.type !== "source").map((note) => note.id);
      return selected
        ? new Set([...current, ...visibleIds])
        : new Set([...current].filter((id) => !visibleIds.includes(id)));
    });
  const dirty = Boolean(draft) && fingerprint(draft) !== saved;
  // "Saved" only while nothing changed since; an edit hides it even where `saveState` was not reset.
  const saveStatus =
    saveState === "saving"
      ? localizeUi("ui.longTermMemory.memoryvault.saving")
      : saveState === "saved" && !dirty
        ? localizeUi("ui.longTermMemory.memoryvault.saved")
        : "";
  const sourceDerivedQuery = useQuery({
    ...derivedNotesQueryOptions(draft?.id ?? ""),
    enabled: draft?.type === "source" && !isNew,
  });
  const sourceDerived = sourceDerivedQuery.data?.memories ?? [];
  const incomingLinks = draft
    ? linkContextNotes.filter((note) => note.links.some((link) => link.target === draft.id))
    : [];
  const outgoingLinks = draft?.links.filter((link) => link.relation !== "extracted_from") ?? [];
  const targets: Target[] = uniqueById([
    {
      id: "all",
      label: localizeUi("ui.longTermMemory.memoryvault.allMemories"),
    },
    ...(props.chatId
      ? [
          {
            id: `chat:${props.chatId}`,
            label: props.chatName ?? localizeUi("ui.longTermMemory.memoryvault.currentChat"),
            scope: { chatId: props.chatId, chatIds: [props.chatId] },
          },
        ]
      : []),
    ...(scopeTargets.data?.chats ?? []).map((chat) => ({
      id: `chat:${chat.id}`,
      label: chat.label,
      chatName: chat.chatName,
      scope: { chatId: chat.id, chatIds: [chat.id] },
    })),
    ...(scopeTargets.data?.groups ?? []).map((group) => ({
      id: `group:${group.id}`,
      label: localizeUi("ui.longTermMemory.memoryvault.groupBranches", {
        group: group.label,
      }),
      scope: { groupId: group.id },
    })),
    ...(scopeTargets.data?.characters ?? []).map((character) => ({
      id: `character:${character.id}`,
      label: character.label,
      scope: { characterIds: [character.id] },
    })),
    ...(scopeTargets.data?.personas ?? []).map((persona) => ({
      id: `persona:${persona.id}`,
      label: persona.label,
      comment: persona.comment,
      scope: { personaId: persona.id },
    })),
  ]);
  const scopeIndexes = useMemo(() => buildScopeIndexes(scopeTargets.data?.chats ?? []), [scopeTargets.data?.chats]);
  const currentChat = props.chatId ? scopeIndexes.chatsById.get(props.chatId) : undefined;
  const selectedChat =
    target?.id.startsWith("chat:") && target.scope?.chatIds?.length === 1
      ? scopeIndexes.chatsById.get(target.scope.chatIds[0])
      : undefined;
  const selectedCharacterId =
    target?.scope?.characterIds?.length === 1 ? target.scope.characterIds[0] : (selectedChat?.characterIds[0] ?? "");
  const scopeChats = useMemo(() => scopeTargets.data?.chats ?? [], [scopeTargets.data?.chats]);
  const scopeGroups = useMemo(() => {
    const chatIds = new Set(scopeChats.map((chat) => chat.id));
    return (scopeTargets.data?.groups ?? [])
      .map((group) => ({
        ...group,
        chatIds: group.chatIds.filter((id) => chatIds.has(id)),
      }))
      .filter((group) => group.chatIds.length);
  }, [scopeChats, scopeTargets.data?.groups]);
  const conversations = useMemo(
    () =>
      deriveScopeConversations(scopeChats, scopeGroups, "", scopeIndexes, (group) =>
        localizeUi("ui.longTermMemory.memoryvault.groupBranches", {
          group: group.label,
        }),
      ),
    [localizeUi, scopeIndexes, scopeChats, scopeGroups],
  );
  const characterScopeTargets = (scopeTargets.data?.characters ?? []).map((character) =>
    targets.find((candidate) => candidate.id === `character:${character.id}`)!,
  );
  const currentCharacterTarget: Target | null = currentChat?.characterIds.length
    ? {
        id: `character:${currentChat.characterIds[0]}`,
        label:
          characterScopeTargets.find((candidate) => candidate.id === `character:${currentChat.characterIds[0]}`)
            ?.label ?? localizeUi("ui.longTermMemory.memoryvault.current"),
        scope: { characterIds: [currentChat.characterIds[0]] },
      }
    : null;
  const pickerCharacterScopeTargets = uniqueById([
    ...(currentCharacterTarget ? [currentCharacterTarget] : []),
    ...characterScopeTargets,
  ]);
  // The primary picker folds the selected character into a place so the place also
  // shows that character's memories. The secondary place stays literal: otherwise
  // its scope becomes "the place OR the primary character" and the AND view
  // collapses back to the primary character alone.
  const conversationScopeTargetsFor = (characterId: string) =>
    conversations.map((conversation) => {
      const [kind, id] = conversation.id.split(/:(.+)/, 2);
      return {
        id: conversation.id,
        label: conversation.label,
        scope:
          kind === "group"
            ? {
                groupId: id,
                chatIds: conversation.chatIds,
                ...(characterId ? { characterIds: [characterId] } : {}),
              }
            : {
                chatId: id,
                chatIds: [id],
                ...(characterId ? { characterIds: [characterId] } : {}),
              },
      };
    });
  const conversationScopeTargets = conversationScopeTargetsFor(selectedCharacterId);
  const secondaryConversationScopeTargets = conversationScopeTargetsFor("");
  const currentConversationScopeTarget: Target | null = currentChat
    ? {
        id: `chat:${currentChat.id}`,
        label:
          conversationScopeTargets.find((candidate) => candidate.id === `chat:${currentChat.id}`)?.label ??
          props.chatName ??
          localizeUi("ui.longTermMemory.memoryvault.currentChat"),
        scope: scopeTargets.data?.currentScope ?? { chatId: currentChat.id, chatIds: [currentChat.id] },
      }
    : null;
  // The secondary place stays literal for the current chat too. Reusing currentScope
  // here would fold the primary character (and persona) into the second place, so
  // "A AND (B OR A)" collapses back to A.
  const secondaryCurrentConversationScopeTarget: Target | null = currentChat
    ? {
        id: `chat:${currentChat.id}`,
        label:
          currentConversationScopeTarget?.label ??
          props.chatName ??
          localizeUi("ui.longTermMemory.memoryvault.currentChat"),
        scope: chatOnlyLtmScope(currentChat.id),
      }
    : null;
  const personaScopeTargets = targets.filter((candidate) => candidate.id.startsWith("persona:"));
  const characterComments = new Map(
    (scopeTargets.data?.characters ?? []).map((character) => [`character:${character.id}`, character.comment]),
  );
  // One place list for both Vault filters. A chat with branches is one entry whose scope already covers every
  // branch, so memories assigned to a single branch still show under it.
  const vaultPlaceOptions = (secondary: boolean) => {
    type VaultPlaceOption = ScopeTarget & { target: Target | null };
    const place = (kind: ScopeTarget["kind"], candidate: Target, extra: Partial<VaultPlaceOption> = {}) =>
      ({
        id: candidate.id,
        label: candidate.label,
        comment: candidate.comment,
        kind,
        sourceScope: candidate.scope,
        target: candidate,
        ...extra,
      }) satisfies VaultPlaceOption;
    const current = secondary ? secondaryCurrentConversationScopeTarget : currentConversationScopeTarget;
    const selected = secondary ? secondaryTarget : target;
    const kindOf = (id: string) =>
      id.startsWith("character:") ? "character" : id.startsWith("persona:") ? "persona" : "chat";
    return uniqueById<VaultPlaceOption>([
      secondary
        ? {
            id: "all",
            label: localizeUi("ui.longTermMemory.memoryvault.noSecondPlace"),
            kind: "all",
            pinned: "all",
            target: null,
          }
        : { ...place("all", targets[0]!), label: localizeUi("ui.longTermMemory.sourcesworkspace.all"), pinned: "all" },
      ...(current
        ? [
            place("chat", current, {
              label: localizeUi("ui.longTermMemory.memoryvault.current"),
              comment: current.label,
              pinned: "current",
            }),
          ]
        : []),
      ...(secondary ? secondaryConversationScopeTargets : conversationScopeTargets).map((candidate) =>
        candidate.id.startsWith("group:")
          ? place("chat", candidate, {
              comment: localizeUi("ui.longTermMemory.sourcesworkspace.allBranches"),
              searchText: candidate.scope.chatIds.map((id) => scopeIndexes.chatsById.get(id)?.label ?? id).join(" "),
            })
          : place("chat", candidate),
      ),
      ...pickerCharacterScopeTargets.map((candidate) =>
        place("character", candidate, { comment: characterComments.get(candidate.id) }),
      ),
      ...personaScopeTargets.map((candidate) => place("persona", candidate)),
      // A place that has since been deleted stays selectable under its last label.
      ...(selected && selected.id !== "all" ? [place(kindOf(selected.id), selected)] : []),
    ]);
  };
  const primaryPlaceOptions = vaultPlaceOptions(false);
  const secondaryPlaceOptions = vaultPlaceOptions(true);
  const memoryPresence = scopeTargets.data?.memoryPresence;
  const hasMemories = useMemo(
    () => (memoryPresence ? buildScopeMemoryPresence(memoryPresence) : null),
    [memoryPresence],
  );
  const placeMemoryGroups = hasMemories
    ? {
        has: (option: ScopeTarget) => hasMemories(option.sourceScope),
        withLabel: localizeUi("ui.longTermMemory.memoryvault.withMemories"),
        withoutLabel: localizeUi("ui.longTermMemory.memoryvault.noMemories"),
      }
    : undefined;
  const statusScopeTargets: Target[] = statuses.map((status) => ({
    id: status,
    label: statusLabel(status),
  }));
  const sortScopeTargets: Target[] = [
    {
      id: "title",
      label: localizeUi("ui.longTermMemory.memoryvault.sortTitle"),
    },
    {
      id: "created",
      label: localizeUi("ui.longTermMemory.memoryvault.sortCreated"),
    },
  ];
  const activeFilterLabels = [
    search.trim() ? localizeUi("ui.longTermMemory.memoryvault.filteredEmptySearch", { value1: search.trim() }) : "",
    statusFilter !== "all"
      ? localizeUi("ui.longTermMemory.memoryvault.filteredEmptyStatus", { value1: statusLabel(statusFilter) })
      : "",
    filterModes.length < modes.length
      ? `${localizeUi("ui.longTermMemory.memoryvault.availableModes")}: ${filterModes.map(modeLabel).join(", ")}`
      : "",
    sourceFilter ? localizeUi("ui.longTermMemory.memoryvault.filteredEmptySourcesOnly") : "",
    sort !== "updated"
      ? localizeUi("ui.longTermMemory.memoryvault.filteredEmptySort", {
          value1: sortScopeTargets.find((candidate) => candidate.id === sort)?.label ?? sort,
        })
      : "",
  ].filter(Boolean);
  const refineSummary = [
    secondaryTarget
      ? localizeUi("ui.longTermMemory.memoryvault.refineActivePlace", { value1: targetDisplayLabel(secondaryTarget) })
      : "",
    filterModes.length < modes.length
      ? `${localizeUi("ui.longTermMemory.memoryvault.availableModes")}: ${filterModes.map(modeLabel).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const scopeEntryLabel = secondaryTarget
    ? localizeUi("ui.longTermMemory.memoryvault.combinedScope", {
        first: targetDisplayLabel(target) || localizeUi("ui.longTermMemory.memoryvault.allMemories"),
        second: targetDisplayLabel(secondaryTarget),
      })
    : targetDisplayLabel(target) || localizeUi("ui.longTermMemory.memoryvault.allMemories");
  const pickerTargets = useMemo<PickerTarget[]>(() => {
    const localSubjectFamily = draft?.subjects
      ?.find((subject) => subject.ref?.kind === "local_character")
      ?.ref?.id?.split(":")[0];
    return [
      ...(scopeTargets.data?.chats ?? []).map((chat) => ({
        kind: "chat" as const,
        id: chat.id,
        label: branchChatLabel(chat),
      })),
      ...(scopeTargets.data?.groups ?? []).map((group) => ({
        kind: "group" as const,
        id: group.id,
        label: group.label,
      })),
      ...(scopeTargets.data?.characters ?? []).map((character) => ({
        kind: "character" as const,
        id: character.id,
        label: character.label,
        comment: character.comment,
      })),
      ...(scopeTargets.data?.personas ?? []).map((persona) => ({
        kind: "persona" as const,
        id: persona.id,
        label: persona.label,
        comment: persona.comment,
      })),
      ...(localCharacters.data ?? [])
        .filter((character) => !localSubjectFamily || character.familyId === localSubjectFamily)
        .map((character) => ({
          kind: "local_character" as const,
          id: character.id,
          label: character.label,
          comment: character.comment,
        })),
    ];
  }, [
    scopeTargets.data?.characters,
    scopeTargets.data?.chats,
    scopeTargets.data?.groups,
    localCharacters.data,
    scopeTargets.data?.personas,
    draft?.subjects,
  ]);
  const availabilityTargets = useMemo<AvailabilityTargets>(() => {
    const chats = scopeTargets.data?.chats ?? [];
    const groups = scopeTargets.data?.groups ?? [];
    const byGroup = new Map<string, AvailabilityChatTarget[]>();
    for (const chat of chats) {
      if (!chat.groupId) continue;
      const members = byGroup.get(chat.groupId) ?? [];
      members.push({
        id: chat.id,
        label: chat.label,
        mode: chat.mode,
        groupId: chat.groupId,
        characterIds: chat.characterIds,
        personaId: chat.personaId,
      });
      byGroup.set(chat.groupId, members);
    }
    const familyTargets = groups.map((group) => {
      const members = byGroup.get(group.id) ?? [];
      return {
        id: group.id,
        label: group.label,
        comment: localizeUi("ui.longTermMemory.sourcesworkspace.allBranches"),
        searchText: members.map((member) => member.label).join(" "),
        groupId: group.id,
        chatIds: group.chatIds,
        members,
      } satisfies AvailabilityChatTarget;
    });
    const ungroupedTargets = chats
      .filter((chat) => !chat.groupId)
      .map(
        (chat) =>
          ({
            id: chat.id,
            label: chat.label,
            mode: chat.mode,
            characterIds: chat.characterIds,
            personaId: chat.personaId,
          }) satisfies AvailabilityChatTarget,
      );
    return {
      characters: (scopeTargets.data?.characters ?? []).map((character) => ({
        id: character.id,
        label: character.label,
        comment: character.comment,
      })),
      personas: (scopeTargets.data?.personas ?? []).map((persona) => ({
        id: persona.id,
        label: persona.label,
        comment: persona.comment,
      })),
      chats: [...familyTargets, ...ungroupedTargets],
      branches: deriveScopeBranchChats(chats).map(
        (chat) =>
          ({
            id: chat.id,
            label: branchChatLabel(chat),
            mode: chat.mode,
            groupId: chat.groupId ?? undefined,
            characterIds: chat.characterIds,
            personaId: chat.personaId,
          }) satisfies AvailabilityChatTarget,
      ),
    };
  }, [
    localizeUi,
    scopeTargets.data?.chats,
    scopeTargets.data?.characters,
    scopeTargets.data?.groups,
    scopeTargets.data?.personas,
  ]);
  const subjectLabel = (subject: LtmSubject) => {
    if (subject.ref)
      return scopeTargetLabel(subject.ref.kind, subject.ref.id, pickerTargets, {
        character: localizeUi("ui.longTermMemory.memoryvault.deletedCharacter"),
        persona: localizeUi("ui.longTermMemory.memoryvault.missingPersona"),
        local_character:
          localCharacters.isError && !localCharacters.data
            ? localizeUi("ui.longTermMemory.memoryvault.unresolvedSubject")
            : localCharacters.isLoading && !localCharacters.data
              ? localizeUi("ui.longTermMemory.memoryvault.loadingLocalCharacter")
              : localizeUi("ui.longTermMemory.memoryvault.missingLocalCharacter"),
      });
    return localizeUi("ui.longTermMemory.memoryvault.unresolvedSubject");
  };
  const provenanceSourceLabel = () => {
    if (!draft?.provenance) return "";
    if (draft.provenance.kind === "character")
      return localizeUi("ui.longTermMemory.memoryvault.characterRecord", {
        name: scopeTargetLabel("character", draft.provenance.sourceId, targets),
      });
    if (draft.provenance.kind === "chat_summary")
      return localizeUi("ui.longTermMemory.memoryvault.chatSummary", {
        title: scopeTargetLabel("chat", draft.provenance.sourceId, targets),
      });
    return localizeUi("ui.longTermMemory.memoryvault.lorebook");
  };

  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!openedNoteId) return;
    const loadSession = ++noteLoadSession.current;
    const requestContext = contextKey;
    void request<LtmNote>(`/notes/${encodeURIComponent(openedNoteId)}`)
      .then((note) => {
        if (loadSession !== noteLoadSession.current || requestContext !== targetContextKey.current) return;
        return openNote(note, requestContext);
      })
      .catch(() => {
        if (loadSession === noteLoadSession.current && requestContext === targetContextKey.current)
          setError(localizeUi("ui.longTermMemory.memoryvault.requestedMemoryUnavailable"));
      });
  }, [openedNoteId, contextKey]);
  useEffect(() => {
    if (!recoveryHandoff) return;
    const next = recoveredNote(recoveryHandoff, localizeUi);
    setDraft(next);
    setSaved("");
    setIsNew(true);
    setRecoverySuggestionId(recoveryHandoff.rejectedSuggestionId ?? null);
    setKeywordInput("");
    setError("");
    setNotice(localizeUi("ui.longTermMemory.memoryvault.reviewRecoveredSuggestion"));
    setDetailsOpen(false);
    setMobilePaneAndFocus("workbench");
  }, [recoveryHandoff?.key]);
  useEffect(() => {
    if (!unsavedNavigation) return;
    const dialog = unsavedDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    dialog.querySelector<HTMLElement>("[data-ltm-unsaved-stay]")?.focus();
  }, [unsavedNavigation]);
  useEffect(() => {
    if (!renamingSectionKey) return;
    const dialog = renameDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    dialog.querySelector<HTMLInputElement>("input")?.focus();
  }, [renamingSectionKey]);
  useEffect(() => {
    const pending = renameTriggerRef.current;
    if (renamingSectionKey || busy || !pending) return;
    renameTriggerRef.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const buttons = [...(vaultRef.current?.querySelectorAll<HTMLElement>("[data-ltm-rename-detail]") ?? [])];
    const target =
      pending.element instanceof HTMLElement && pending.element.isConnected
        ? pending.element
        : buttons[Math.min(pending.index, buttons.length - 1)];
    target?.focus();
  }, [renamingSectionKey, busy]);
  useEffect(() => {
    if (unsavedNavigation) return;
    const trigger = unsavedTriggerRef.current;
    if (trigger?.isConnected) trigger.focus();
    unsavedTriggerRef.current = null;
  }, [unsavedNavigation]);
  function finishUnsavedDecision(decision: "save" | "discard" | "stay") {
    const resolve = unsavedResolveRef.current;
    unsavedResolveRef.current = null;
    setUnsavedNavigation(null);
    resolve?.(decision);
  }
  async function confirm(next: string) {
    if (!dirtyRef.current) return true;
    const decision = await new Promise<"save" | "discard" | "stay">((resolve) => {
      unsavedResolveRef.current = resolve;
      unsavedTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setUnsavedNavigation(next);
    });
    if (decision === "save") return save();
    return decision === "discard";
  }
  async function selectTarget(next: Target) {
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.openingTarget", {
          target: next.label,
        }),
      ))
    )
      return false;
    editorSession.current += 1;
    noteLoadSession.current += 1;
    setTarget(next);
    setDraft(null);
    setAvailabilityOpen(null);
    setChecked(new Set());
    setArchiveUndo(null);
    setSaved("");
    setIsNew(false);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setKeywordInput("");
    setSectionKey("");
    setAddingSection(false);
    setMobilePane("navigator");
    return true;
  }
  function selectSecondaryTarget(next: Target | null) {
    setSecondaryTarget(next);
    setChecked(new Set());
  }
  function toggleFilterMode(mode: LtmMode) {
    const nextModes = filterModes.includes(mode)
      ? filterModes.filter((current) => current !== mode)
      : [...filterModes, mode];
    if (!nextModes.length) return;
    setFilterModes(nextModes);
  }
  async function openNote(note: LtmNote, expectedContextKey = targetContextKey.current) {
    if (expectedContextKey !== targetContextKey.current) return;
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.openingTarget", {
          target: memoryLabel(note),
        }),
      ))
    )
      return;
    if (expectedContextKey !== targetContextKey.current) return;
    const next = structuredClone(note);
    editorSession.current += 1;
    setDraft(next);
    setAvailabilityOpen(null);
    setSaved(fingerprint(next));
    setSaveState("idle");
    setIsNew(false);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setKeywordInput("");
    setSectionKey("");
    setAddingSection(false);
    setError("");
    setNotice("");
    setDetailsOpen(false);
    setMobilePaneAndFocus("workbench");
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: detailScrollBehavior(),
        block: "nearest",
      }),
    );
  }
  async function startNew() {
    if (!(await confirm(localizeUi("ui.longTermMemory.memoryvault.creatingNewMemory")))) return;
    const next = newNote(target?.scope ?? {}, localizeUi);
    next.modes = props.chatMode ? [props.chatMode] : [];
    editorSession.current += 1;
    setDraft(next);
    setAvailabilityOpen(null);
    setSaved("");
    setIsNew(true);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setKeywordInput("");
    setSectionKey("");
    setAddingSection(false);
    setDetailsOpen(false);
    setMobilePaneAndFocus("workbench");
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: detailScrollBehavior(),
        block: "nearest",
      }),
    );
  }
  useEffect(() => {
    if (!createMemoryRequest) return;
    onCreateMemoryRequestHandled?.();
    void startNew();
  }, [createMemoryRequest]);
  async function closeDraft() {
    if (!(await confirm(localizeUi("ui.longTermMemory.memoryvault.closingThisMemory")))) return;
    editorSession.current += 1;
    setDraft(null);
    setAvailabilityOpen(null);
    setSaved("");
    setIsNew(false);
    setRecoverySuggestionId(null);
    setLinkTarget("");
    setLinkRelation("involves");
    setSectionKey("");
    setAddingSection(false);
    setMobilePaneAndFocus("navigator");
  }
  async function invalidate() {
    await invalidateLtmQueries(client, [
      queryKeys.notes,
      queryKeys.status,
      queryKeys.activity,
      queryKeys.review,
      queryKeys.pendingDrafts,
      queryKeys.rejectedSuggestions,
      queryKeys.integrity,
      queryKeys.lastInjectionRoot,
      queryKeys.localCharactersRoot,
      queryKeys.scopeTargetsRoot,
    ]);
  }
  // A bulk change edits notes on the server whatever the editor has opened since. Reload the lists, and the open
  // memory if the change edited it, so the editor neither shows nor saves back the availability from before the
  // change. Unsaved edits keep everything but the availability, as in saveAvailability. The reloaded copy is dropped
  // when the editor changed memory meanwhile or already holds a newer save.
  async function refreshAfterBatch(changedNoteIds: string[]) {
    await invalidate();
    const session = editorSession.current;
    const openNoteId = draftRef.current?.id;
    if (!openNoteId || !changedNoteIds.includes(openNoteId)) return;
    const next = await request<LtmNote>(`/notes/${encodeURIComponent(openNoteId)}`).catch(() => null);
    if (
      !next ||
      session !== editorSession.current ||
      draftRef.current?.id !== next.id ||
      draftRef.current.version > next.version
    )
      return;
    const editorWasDirty = dirtyRef.current;
    setDraft((current) =>
      current?.id === next.id
        ? editorWasDirty
          ? { ...current, scope: next.scope, modes: next.modes, updatedAt: next.updatedAt, version: next.version }
          : next
        : current,
    );
    setSaved(fingerprint(next));
  }
  async function undoArchive(recovery: ArchiveUndoState) {
    if (archiveUndo !== recovery || batchPendingRef.current) return;
    batchPendingRef.current = true;
    feedbackTriggerRef.current = document.activeElement;
    const session = editorSession.current;
    setBusy("undo-archive");
    setError("");
    try {
      const notesByStatus = new Map<LtmStatus, string[]>();
      for (const note of recovery.notes) {
        const ids = notesByStatus.get(note.status) ?? [];
        ids.push(note.id);
        notesByStatus.set(note.status, ids);
      }
      const restoreGroups = [...notesByStatus].map(([status, noteIds]) => ({ status, noteIds }));
      const results = await Promise.allSettled(
        restoreGroups.map(({ status, noteIds }) =>
          request<LtmBulkNoteResult>("/notes/batch", "POST", { noteIds, status }),
        ),
      );
      // The restores changed stored notes, so the rollback and the reload run even if another memory was opened
      // meanwhile; only the notice and the error belong to the editor session that started the undo.
      const successfulRestores = results.flatMap((result, index) => {
        const group = restoreGroups[index];
        if (!group || result.status !== "fulfilled") return [];
        const expectedIds = new Set(group.noteIds);
        const restoredIds = result.value.updatedNoteIds.filter((id) => expectedIds.has(id));
        return restoredIds.length ? [{ noteIds: restoredIds }] : [];
      });
      const allRestored = results.every((result, index) => {
        const group = restoreGroups[index];
        if (!group || result.status !== "fulfilled") return false;
        const expectedIds = new Set(group.noteIds);
        const actualIds = result.value.updatedNoteIds;
        return (
          result.value.status === "complete" &&
          result.value.skippedNoteIds.length === 0 &&
          result.value.failedNoteIds.length === 0 &&
          actualIds.length === expectedIds.size &&
          new Set(actualIds).size === expectedIds.size &&
          actualIds.every((id) => expectedIds.has(id))
        );
      });
      if (!allRestored) {
        await Promise.allSettled(
          successfulRestores.map(({ noteIds }) =>
            request<LtmBulkNoteResult>("/notes/batch", "POST", { noteIds, status: "archived" }),
          ),
        );
        await invalidate();
        throw new Error();
      }
      // Reload the open memory too if the undo restored it, so it neither shows nor saves back the archived status.
      // The banner stays up through the reload (its caption holds it open) so the restored notice lands in the same region.
      await refreshAfterBatch(
        results.flatMap((result) => (result.status === "fulfilled" ? result.value.affectedNoteIds : [])),
      );
      setArchiveUndo((current) => (current === recovery ? null : current));
      if (session !== editorSession.current) return;
      setNotice(
        localizeUi(
          selectLtmPluralForm(locale, recovery.notes.length) === "one"
            ? "ui.longTermMemory.memoryvault.archiveUndoSuccessOne"
            : "ui.longTermMemory.memoryvault.archiveUndoSuccessOther",
          { count: recovery.notes.length },
        ),
      );
      focusFeedback();
    } catch {
      if (session === editorSession.current) {
        setError(localizeUi("ui.longTermMemory.memoryvault.archiveUndoFailed"));
        focusFeedback();
      }
    } finally {
      batchPendingRef.current = false;
      setBusy((current) => (current === "undo-archive" ? "" : current));
    }
  }
  function openAvailability() {
    if (!draft) return;
    setAvailabilityOpen("single");
    setMobilePaneAndFocus("workbench");
  }
  async function saveAvailability(scope: LtmScope, modes: LtmMode[]) {
    if (!draft) return;
    if (isNew) {
      setDraft((current) => (current ? { ...current, scope, modes } : current));
      setAvailabilityOpen(null);
      setNotice(localizeUi("ui.longTermMemory.memoryvault.availabilityStaged"));
      return;
    }
    const response = await request<NoteResponse, Pick<LtmNote, "scope" | "modes">>(
      `/notes/${encodeURIComponent(draft.id)}`,
      "PATCH",
      { scope, modes },
    );
    const next = structuredClone(response.note);
    const editorWasDirty = fingerprint(draft) !== saved;
    setDraft((current) =>
      current
        ? editorWasDirty
          ? { ...current, scope: next.scope, modes: next.modes, updatedAt: next.updatedAt, version: next.version }
          : next
        : current,
    );
    setSaved(fingerprint(next));
    setAvailabilityOpen(null);
    setNotice(localizeUi("ui.longTermMemory.memoryvault.availabilitySaved"));
    await invalidate();
  }
  function save(): Promise<boolean> {
    if (savePromiseRef.current) return savePromiseRef.current;
    const running = runSave().finally(() => {
      savePromiseRef.current = null;
    });
    savePromiseRef.current = running;
    return running;
  }
  async function runSave(): Promise<boolean> {
    if (!draft) return false;
    const errors: Array<{ message: string; focus: "title" | "details" | "subjects" | "links" | "availability" }> = [];
    if (!draft.title?.trim())
      errors.push({ message: localizeUi("ui.longTermMemory.memoryvault.memoryTitleRequired"), focus: "title" });
    if (!Object.keys(draft.sections).length)
      errors.push({ message: localizeUi("ui.longTermMemory.memoryvault.detailRequired"), focus: "details" });
    if (Object.values(draft.sections).some((section) => !section.text.trim()))
      errors.push({ message: localizeUi("ui.longTermMemory.memoryvault.detailTextRequired"), focus: "details" });
    if (draft.type === "character" && draft.subjects?.length !== 1)
      errors.push({ message: localizeUi("ui.longTermMemory.memoryvault.characterSubjectRequired"), focus: "subjects" });
    if (draft.type === "relationship" && draft.subjects?.length !== 2)
      errors.push({
        message: localizeUi("ui.longTermMemory.memoryvault.relationshipSubjectsRequired"),
        focus: "subjects",
      });
    if (draft.links.some((link) => !link.target || !link.relation))
      errors.push({
        message: localizeUi("ui.longTermMemory.memoryvault.linkTargetAndRelationRequired"),
        focus: "links",
      });
    if (draft.conflicts?.some((conflict) => conflict.resolution === "pending"))
      errors.push({ message: localizeUi("ui.longTermMemory.memoryvault.conflictNeedsResolution"), focus: "details" });
    if (isNew && !hasExplicitScope(draft.scope))
      errors.push({
        message: localizeUi("ui.longTermMemory.memoryvault.availabilityPlaceRequired"),
        focus: "availability",
      });
    if (isNew && !draft.modes.length)
      errors.push({
        message: localizeUi("ui.longTermMemory.memoryvault.availabilityModeRequired"),
        focus: "availability",
      });
    if (errors.length) {
      setValidation(errors);
      setError(errors[0]!.message);
      return false;
    }
    setValidation([]);
    const savedNote = saved ? (JSON.parse(saved) as LtmNote) : null;
    if (!isNew && savedNote && hasExplicitScope(savedNote.scope) && !hasExplicitScope(draft.scope)) {
      setError(localizeUi("ui.longTermMemory.memoryvault.clearingEveryScopeWouldMakeGlobal"));
      return false;
    }
    const session = editorSession.current;
    const submittedFingerprint = fingerprint(draft);
    setBusy("save");
    setSaveState("saving");
    setError("");
    // Clear the standing notice so this save's "Memory saved" is a change the banner announces; the same text twice is not.
    // An archive Undo keeps its own caption, so clearing the notice leaves it standing.
    setNotice("");
    let succeeded = false;
    try {
      const response = isNew
        ? await request<EditorMutationResponse, Omit<LtmNote, "createdAt" | "updatedAt" | "version">>(
            "/notes",
            "POST",
            (({ createdAt, updatedAt, version, ...note }) => note)(draft),
          )
        : await request<EditorMutationResponse, Partial<LtmNote>>(
            `/notes/${encodeURIComponent(draft.id)}`,
            "PATCH",
            (({
              id,
              type,
              createdAt,
              updatedAt,
              version,
              provenance,
              extractionFingerprint,
              extracted,
              sections,
              ...note
            }) =>
              draft.type === "source"
                ? note
                : {
                    ...note,
                    sections,
                    removedSectionKeys: Object.keys(savedNote?.sections ?? {}).filter(
                      (key) => !Object.hasOwn(draft.sections, key),
                    ),
                  })(draft),
          );
      const next = structuredClone(response.note);
      // Another memory was opened meanwhile, or this one again: free Save and reload the lists, and the open memory if
      // it is the one just saved, so the editor does not keep the copy from before the save.
      if (session !== editorSession.current) {
        setSaveState("idle");
        await refreshAfterBatch([next.id]);
        return false;
      }
      if (response.rebuild?.status === "deferred") {
        setSaved(fingerprint(next));
        setIsNew(false);
        setDraft((current) => (fingerprint(current) === submittedFingerprint ? next : current));
        setSaveState("idle");
        setWarning(
          localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStale", { error: response.rebuild.error ?? "" }),
        );
        await invalidateLtmQueries(client, [
          queryKeys.notes,
          queryKeys.status,
          queryKeys.activity,
          queryKeys.localCharactersRoot,
          queryKeys.scopeTargetsRoot,
        ]).catch(() => {});
        return false;
      }
      const recoveryComplete = fingerprint(draftRef.current) === submittedFingerprint;
      const savedCurrentDraft = fingerprint(draftRef.current) === submittedFingerprint;
      setDraft((current) => {
        if (session !== editorSession.current) return current;
        if (fingerprint(current) === submittedFingerprint) {
          setSaved(fingerprint(next));
          setIsNew(false);
          setNotice(localizeUi("ui.longTermMemory.memoryvault.memorySaved"));
          setSaveState("saved");
          return next;
        }
        setSaved(fingerprint(next));
        setIsNew(false);
        setNotice(localizeUi("ui.longTermMemory.memoryvault.memorySavedNewerEditsUnsaved"));
        setSaveState("saved");
        return current
          ? {
              ...current,
              id: next.id,
              type: next.type,
              createdAt: next.createdAt,
              updatedAt: next.updatedAt,
              version: next.version,
              ...(next.provenance ? { provenance: next.provenance } : {}),
              ...(next.extractionFingerprint ? { extractionFingerprint: next.extractionFingerprint } : {}),
            }
          : current;
      });
      const rejectedId = recoverySuggestionId;
      if (rejectedId && recoveryComplete) {
        try {
          const cleanup = await request<{ deleted: boolean; id: string }>(
            `/rejected-suggestions/${encodeURIComponent(rejectedId)}`,
            "DELETE",
          );
          if (typeof cleanup?.deleted !== "boolean" || cleanup.id !== rejectedId) throw new Error();
          setRecoverySuggestionId(null);
        } catch {
          setNotice(localizeUi("ui.longTermMemory.memoryvault.savedButRejectedSuggestionCouldNotBeRemoved"));
        }
      }
      await invalidateLtmQueries(client, [
        queryKeys.notes,
        queryKeys.status,
        queryKeys.activity,
        queryKeys.localCharactersRoot,
        queryKeys.scopeTargetsRoot,
        ...(rejectedId && recoveryComplete ? [queryKeys.rejectedSuggestions] : []),
      ]).catch(() => {});
      succeeded = savedCurrentDraft;
    } catch (cause) {
      setSaveState("idle");
      if (session === editorSession.current)
        setError(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotSaveMemory")));
    } finally {
      setBusy((current) => (current === "save" ? "" : current));
    }
    return succeeded;
  }
  async function deleteSelected(ids: string[]) {
    const session = editorSession.current;
    setBusy("delete");
    try {
      const result = await request<{ deletedIds: string[] }>("/notes/permanent-delete", "POST", { ids });
      setChecked((current) => {
        const next = new Set(current);
        result.deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      setOpenActionNoteId(null);
      // Close the open memory if it was deleted, even one opened while the deletion ran.
      const closedOpenMemory = Boolean(draftRef.current && result.deletedIds.includes(draftRef.current.id));
      if (closedOpenMemory) {
        setDraft(null);
        setSaved("");
        setMobilePaneAndFocus("navigator");
      }
      await invalidate();
      // The notice belongs to the editor session that started the deletion, and also explains a memory it closed.
      if (session !== editorSession.current && !closedOpenMemory) return;
      setNotice(
        localizeUi(
          selectLtmPluralForm(locale, result.deletedIds.length) === "one"
            ? "ui.longTermMemory.memoryvault.memoryDeletedOne"
            : "ui.longTermMemory.memoryvault.memoryDeletedOther",
          { count: result.deletedIds.length },
        ),
      );
      focusFeedback();
    } catch (cause) {
      if (session === editorSession.current) {
        setError(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories")));
        focusFeedback();
      }
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function deleteSection(key: string) {
    if (!draft || draft.type === "source") return;
    const section = draft.sections[key];
    if (!section) return;
    if (!isNew && Object.keys(draft.sections).length === 1) {
      setError(localizeUi("ui.longTermMemory.memoryvault.finalDetailRequired"));
      return;
    }
    const remove = () => {
      const { [key]: _removed, ...sections } = draft.sections;
      update("sections", sections);
      setNotice(localizeUi("ui.longTermMemory.memoryvault.detailDeleted"));
    };
    if (!section.text.trim()) {
      remove();
      return;
    }
    const session = editorSession.current;
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: localizeUi("ui.longTermMemory.memoryvault.deleteDetailTitle"),
          message: localizeUi("ui.longTermMemory.memoryvault.deleteDetailDescription", {
            unsavedWarning: ` ${noteTypeLabel(key)}`,
          }),
          confirmLabel: localizeUi("ui.longTermMemory.memoryvault.deleteDetail"),
          tone: "destructive",
        })
      : window.confirm(
          localizeUi("ui.longTermMemory.memoryvault.deleteDetailDescription", {
            unsavedWarning: ` ${noteTypeLabel(key)}`,
          }),
        );
    if (!confirmed) return;
    if (session !== editorSession.current) return;
    remove();
  }
  async function renameSection() {
    if (!draft || !renamingSectionKey || draft.type === "source") return;
    const fromSectionKey = renamingSectionKey;
    const toSectionKey = normalizeDetailName(renamedSectionKey);
    if (!toSectionKey) {
      setRenameError(localizeUi("ui.longTermMemory.memoryvault.detailNameRequired"));
      return;
    }
    if (toSectionKey === fromSectionKey) return;
    if (Object.hasOwn(draft.sections, toSectionKey)) {
      setRenameError(localizeUi("ui.longTermMemory.memoryvault.detailNameAlreadyExists"));
      return;
    }
    const session = editorSession.current;
    const noteId = draft.id;
    const submittedFingerprint = fingerprint(draft);
    setBusy("rename-section");
    setError("");
    setRenameError("");
    try {
      const result = await request<EditorMutationResponse>(
        `/notes/${encodeURIComponent(noteId)}/sections/rename`,
        "POST",
        { fromSectionKey, toSectionKey },
      );
      if (session !== editorSession.current) return;
      if (result.rebuild?.status === "deferred") {
        setSaved(fingerprint(result.note));
        setDraft((current) => (fingerprint(current) === submittedFingerprint ? result.note : current));
        setRenamingSectionKey(null);
        setRenamedSectionKey("");
        setWarning(
          localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStale", { error: result.rebuild.error ?? "" }),
        );
        await invalidate();
        return;
      }
      setDraft((current) => {
        if (!current || current.id !== noteId || !Object.hasOwn(current.sections, fromSectionKey)) return result.note;
        if (fingerprint(current) === submittedFingerprint) return result.note;
        const sections = Object.fromEntries(
          Object.entries(current.sections).map(([key, section]) => [
            key === fromSectionKey ? toSectionKey : key,
            section,
          ]),
        );
        return { ...current, sections };
      });
      setSaved(fingerprint(result.note));
      setRenamingSectionKey(null);
      setRenamedSectionKey("");
      setRenamePreview(null);
      setNotice(localizeUi("ui.longTermMemory.memoryvault.detailRenamed"));
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setRenameError(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories")));
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function runBatchForIds(
    ids: string[],
    action: "edit" | "archive" | "delete",
    options?: { preserveSelection?: boolean },
  ) {
    if (!ids.length || batchPendingRef.current) return;
    batchPendingRef.current = true;
    feedbackTriggerRef.current = document.activeElement;
    try {
      await applyBatchForIds(ids, action, options);
    } finally {
      batchPendingRef.current = false;
    }
  }
  async function applyBatchForIds(
    ids: string[],
    action: "edit" | "archive" | "delete",
    options?: { preserveSelection?: boolean },
  ) {
    const session = editorSession.current;
    if (action === "delete") {
      const deleteRevision = deleteTargetRevision.current;
      setBusy("delete");
      try {
        let deleteTargets: LtmNote[];
        try {
          deleteTargets = await requestNotesByIds<LtmNote>(ids);
        } catch {
          if (session === editorSession.current) {
            setError(localizeUi("ui.longTermMemory.memoryvault.deleteTargetsCouldNotLoad"));
            focusFeedback();
          }
          return;
        }
        if (session !== editorSession.current || deleteRevision !== deleteTargetRevision.current) return;
        const targetsById = new Map(deleteTargets.map((note) => [note.id, note]));
        if (targetsById.size !== ids.length || ids.some((id) => !targetsById.has(id))) {
          setError(localizeUi("ui.longTermMemory.memoryvault.deleteTargetsCouldNotLoad"));
          focusFeedback();
          return;
        }
        const confirmedTargets = ids.map((id) => targetsById.get(id)!);
        if (confirmedTargets.some((note) => note.type === "source")) {
          setError(localizeUi("ui.longTermMemory.memoryvault.manageSourceDeletionInSources"));
          onOpenSources?.();
          return;
        }
        const countForm = selectLtmPluralForm(locale, confirmedTargets.length);
        const confirmationTitle = localizeUi(
          countForm === "one"
            ? "ui.longTermMemory.memoryvault.permanentlyDeleteOne"
            : "ui.longTermMemory.memoryvault.permanentlyDeleteOther",
          { count: confirmedTargets.length },
        );
        const confirmationLabel = localizeUi(
          countForm === "one"
            ? "ui.longTermMemory.memoryvault.deletePermanentlyOne"
            : "ui.longTermMemory.memoryvault.deletePermanentlyOther",
          { count: confirmedTargets.length },
        );
        const hiddenTargetCount = ids.filter((id) => !visible.some((note) => note.id === id)).length;
        const confirmationMessage = [
          localizeUi("ui.longTermMemory.memoryvault.thisCannotBeUndone"),
          hiddenTargetCount
            ? localizeUi(
                hiddenTargetCount === 1
                  ? "ui.longTermMemory.memoryvault.deleteConfirmationHiddenOne"
                  : "ui.longTermMemory.memoryvault.deleteConfirmationHiddenOther",
                { count: hiddenTargetCount },
              )
            : "",
          "",
          ...confirmedTargets.flatMap((note, index) => [
            `${localizeUi("ui.longTermMemory.memoryvault.deleteConfirmationTarget", { value1: index + 1 })}: ${memoryLabel(note)}`,
            `  ${localizeUi("ui.longTermMemory.memoryvault.deleteConfirmationExcerpt")}: ${deleteConfirmationExcerpt(
              note,
              localizeUi("ui.longTermMemory.memoryvault.deleteConfirmationNoExcerpt"),
            )}`,
            `  ${localizeUi("ui.longTermMemory.memoryvault.deleteConfirmationScope")}: ${confirmationScopeLabel(note)}`,
            `  ${localizeUi("ui.longTermMemory.memoryvault.created")}: ${new Date(note.createdAt).toLocaleString(locale)}`,
            `  ${localizeUi("ui.longTermMemory.memoryvault.deleteConfirmationMemoryId")}: ${note.id}`,
            "",
          ]),
        ].join("\n");
        const confirmed = props.confirmAction
          ? await props.confirmAction({
              title: confirmationTitle,
              message: confirmationMessage,
              confirmLabel: confirmationLabel,
              tone: "destructive",
            })
          : window.confirm(`${confirmationTitle}\n\n${confirmationMessage}`);
        if (!confirmed) return;
        if (session !== editorSession.current || deleteRevision !== deleteTargetRevision.current) return;
        setArchiveUndo(null);
        await deleteSelected(ids);
        return;
      } finally {
        setBusy((current) => (current === "delete" ? "" : current));
      }
    }
    setArchiveUndo(null);
    const previousArchiveStatuses = new Map(
      ids.flatMap((id) => {
        const status = allNotes.find((note) => note.id === id)?.status;
        return status ? [[id, status] as const] : [];
      }),
    );
    setBusy(action);
    try {
      const adding = bulkAvailabilityAction === "add";
      const availabilityScope = bulkAvailabilityScope(
        adding ? bulkAvailabilityTargets : withWholeChatBranches(bulkAvailabilityTargets, availabilityTargets.chats),
      );
      const result = await request<LtmBulkNoteResult>("/notes/batch", "POST", {
        noteIds: ids,
        ...(action === "archive" ? { archive: "notes_only" } : {}),
        ...(action === "edit"
          ? {
              ...(bulkEditStatus ? { status: bulkEditStatus } : {}),
              ...(availabilityScope
                ? adding
                  ? { addScope: availabilityScope }
                  : { removeScope: availabilityScope }
                : {}),
              ...(bulkAvailabilityModes.length
                ? adding
                  ? { enableModes: bulkAvailabilityModes }
                  : { disableModes: bulkAvailabilityModes }
                : {}),
            }
          : {}),
      });
      if (session !== editorSession.current) {
        await refreshAfterBatch(result.affectedNoteIds);
        return;
      }
      const unresolved = new Set([...result.skippedNoteIds, ...result.failedNoteIds]);
      if (options?.preserveSelection) {
        setChecked((current) => {
          const next = new Set(current);
          ids.forEach((id) => next.delete(id));
          unresolved.forEach((id) => next.add(id));
          return next;
        });
      } else {
        setChecked(unresolved);
      }
      const updatedForm = selectLtmPluralForm(locale, result.updatedNoteIds.length);
      const updatedNoteIds = new Set(result.updatedNoteIds);
      const archiveCompleted =
        action === "archive" &&
        result.status === "complete" &&
        updatedNoteIds.size === ids.length &&
        updatedNoteIds.size === result.updatedNoteIds.length &&
        ids.every((id) => updatedNoteIds.has(id));
      const archiveUndoNotes = archiveCompleted
        ? result.updatedNoteIds.flatMap((id) => {
            const status = previousArchiveStatuses.get(id);
            return status ? [{ id, status }] : [];
          })
        : [];
      const message = localizeUi(
        archiveCompleted
          ? updatedForm === "one"
            ? "ui.longTermMemory.memoryvault.archiveSuccessOne"
            : "ui.longTermMemory.memoryvault.archiveSuccessOther"
          : unresolved.size
            ? updatedForm === "one"
              ? "ui.longTermMemory.memoryvault.batchUpdatedWithIssuesOne"
              : "ui.longTermMemory.memoryvault.batchUpdatedWithIssuesOther"
            : updatedForm === "one"
              ? "ui.longTermMemory.memoryvault.batchUpdatedOne"
              : "ui.longTermMemory.memoryvault.batchUpdatedOther",
        {
          updated: result.updatedNoteIds.length,
          skipped: result.skippedNoteIds.length,
          failed: result.failedNoteIds.length,
          count: result.updatedNoteIds.length,
        },
      );
      const undoOffered = archiveCompleted && archiveUndoNotes.length === ids.length;
      if (undoOffered) setArchiveUndo({ notes: archiveUndoNotes, caption: message });
      setOpenActionNoteId(null);
      if (unresolved.size) {
        setNotice("");
        setError(message);
      } else {
        setNotice(undoOffered ? "" : message);
        setError("");
      }
      focusFeedback();
      await refreshAfterBatch(result.affectedNoteIds);
    } catch (cause) {
      if (session === editorSession.current) {
        setError(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories")));
        focusFeedback();
      }
    } finally {
      setBusy((current) => (current === action ? "" : current));
    }
  }
  async function batch(action: "edit" | "archive" | "delete") {
    await runBatchForIds([...checked], action);
  }
  const busyActionProps = busy ? ({ "aria-disabled": true, className: "opacity-50" } as const) : {};
  const runNoteAction = async (
    event: { preventDefault: () => void; stopPropagation: () => void },
    note: LtmNote,
    action: "archive" | "delete",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setOpenActionNoteId(null);
    await runBatchForIds([note.id], action, { preserveSelection: true });
  };

  const toggleNoteActions = (event: { preventDefault: () => void; stopPropagation: () => void }, noteId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenActionNoteId((current) => (current === noteId ? null : noteId));
  };
  const rowActions = useRef<VaultRowActions | null>(null);
  rowActions.current = {
    openNote: (note) => void openNote(note),
    toggleChecked: (noteId) =>
      setChecked((current) => {
        const next = new Set(current);
        if (next.has(noteId)) next.delete(noteId);
        else next.add(noteId);
        return next;
      }),
    runNoteAction: (event, note, action) => void runNoteAction(event, note, action),
    toggleNoteActions,
  };
  const update = <K extends keyof LtmNote>(key: K, value: LtmNote[K]) => {
    setSaveState("idle");
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };
  const addKeywords = () => {
    if (!draft) return;
    const values = keywordInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!values.length) return;
    if (values.some((value) => value.length > 80)) {
      setKeywordError({
        input: keywordInput,
        message: localizeUi("ui.longTermMemory.memoryvault.manualKeywordTooLong"),
      });
      return;
    }
    const manualKeywords = [...getLtmKeywordIntent(draft).manual, ...values];
    const next = setLtmManualKeywords(draft, manualKeywords);
    if (next.manualKeywords.length > 30) {
      setKeywordError({ input: keywordInput, message: localizeUi("ui.longTermMemory.memoryvault.manualKeywordLimit") });
      return;
    }
    setKeywordError(null);
    setSaveState("idle");
    setDraft((current) => {
      if (!current) return current;
      return { ...current, ...setLtmManualKeywords(current, manualKeywords) };
    });
    setKeywordInput("");
  };
  const updateConflict = (index: number, text: string) => {
    if (!draft?.conflicts) return;
    update(
      "conflicts",
      draft.conflicts.map((conflict, item) =>
        item === index ? { ...conflict, existing: text, resolution: "user_decided" } : conflict,
      ),
    );
  };
  const beginRename = async (key: string) => {
    if (!draft || isNew) return;
    if (dirty) {
      const saveFirst = props.confirmAction
        ? await props.confirmAction({
            title: localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameTitle"),
            message: localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameDescription"),
            confirmLabel: localizeUi("ui.longTermMemory.memoryvault.save"),
          })
        : window.confirm(localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameDescription"));
      if (saveFirst) await save();
      return;
    }
    const buttons = [...(vaultRef.current?.querySelectorAll("[data-ltm-rename-detail]") ?? [])];
    renameTriggerRef.current = {
      element: document.activeElement,
      index: Math.max(0, buttons.indexOf(document.activeElement as Element)),
    };
    setRenamingSectionKey(key);
    setRenamedSectionKey(key);
    setRenamePreview(null);
    setRenameError("");
  };
  const previewRename = async () => {
    if (!draft || !renamingSectionKey) return;
    const toSectionKey = normalizeDetailName(renamedSectionKey);
    if (!toSectionKey) {
      setRenameError(localizeUi("ui.longTermMemory.memoryvault.detailNameRequired"));
      return;
    }
    if (Object.hasOwn(draft.sections, toSectionKey) && toSectionKey !== renamingSectionKey) {
      setRenameError(localizeUi("ui.longTermMemory.memoryvault.detailNameAlreadyExists"));
      return;
    }
    try {
      setRenamePreview(
        await request<LtmRenameNoteSectionPreviewResponse>(
          `/notes/${encodeURIComponent(draft.id)}/sections/rename-preview`,
          "POST",
          { fromSectionKey: renamingSectionKey, toSectionKey },
        ),
      );
      setRenameError("");
    } catch (cause) {
      setRenameError(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories")));
    }
  };
  const copyDiagnostics = async () => {
    if (!draft) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      setNotice(localizeUi("ui.longTermMemory.memoryvault.diagnosticsCopied"));
    } catch {
      setError(localizeUi("ui.longTermMemory.memoryvault.diagnosticsCopyFailed"));
    }
  };
  const subjectSelectionIds = new Set(
    (draft?.subjects ?? []).map((subject) => (subject.ref ? `${subject.ref.kind}:${subject.ref.id}` : subject.key)),
  );
  const subjectLimit = draft?.type === "character" ? 1 : 2;
  const subjectLimitReached = Boolean(draft) && (draft?.subjects?.length ?? 0) >= subjectLimit;
  const selectSubjectTarget = (target: PickerTarget) => {
    if (!draft || (draft.type !== "character" && draft.type !== "relationship")) return;
    if (target.kind !== "character" && target.kind !== "persona" && target.kind !== "local_character") return;
    if ((draft.subjects?.length ?? 0) >= subjectLimit) return;
    const ref = { kind: target.kind, id: target.id };
    const key = `${ref.kind}:${ref.id}`;
    if (subjectSelectionIds.has(key)) return;
    const subjects = [...(draft.subjects ?? []), { key, ref }].sort((left, right) => left.key.localeCompare(right.key));
    update("subjects", subjects);
  };
  const addSection = () => {
    const key = normalizeDetailName(sectionKey);
    if (!draft || !key || draft.sections[key]) return;
    update("sections", {
      ...draft.sections,
      [key]: {
        text: "",
        updatedAt: new Date().toISOString(),
      },
    });
    setSectionKey("");
    setAddingSection(false);
    requestAnimationFrame(() => document.getElementById(`ltm-section-${key}`)?.focus());
  };
  const changeNewMemoryType = (type: LtmNoteType) => {
    if (!draft) return;
    const key = suggestedDetailKey(type);
    const now = new Date().toISOString();
    setDraft({
      ...draft,
      type,
      id: `${prefixes[type]}_${randomId()}`,
      subjects: type === "character" || type === "relationship" ? draft.subjects : undefined,
      sections:
        Object.keys(draft.sections).length === 1
          ? { [key]: { text: Object.values(draft.sections)[0]!.text, updatedAt: now } }
          : draft.sections,
    });
  };
  const addLink = () => {
    if (
      !draft ||
      !linkTarget.trim() ||
      linkTarget.trim() === draft.id ||
      draft.links.some((link) => link.target === linkTarget.trim() && link.relation === linkRelation)
    )
      return;
    update("links", [...draft.links, { target: linkTarget.trim(), relation: linkRelation }]);
    setLinkTarget("");
  };
  const openLinkedNote = async (noteId: string) => {
    try {
      const note = notesById.get(noteId) ?? (await request<LtmNote>(`/notes/${encodeURIComponent(noteId)}`));
      await openNote(note);
    } catch (cause) {
      setError(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.linkedMemoryCouldNotLoad")));
    }
  };
  return (
    <section
      ref={vaultRef}
      data-ltm-surface="vault"
      className="space-y-4"
      aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryVault")}
    >
      <style>{`
        [data-ltm-surface="vault"] details[open] > summary [data-ltm-availability-chevron] {
          transform: rotate(90deg);
        }
        @container ltm-note-workbench (min-width: 28rem) {
          [data-ltm-surface="vault"] [data-ltm-note-title-status] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @container ltm-workspace (min-width: 48rem) {
          [data-ltm-surface="vault"] [data-ltm-memory-list] {
            max-height: max(20rem, calc(100vh - 12rem));
            overflow-y: auto;
          }
        }
      `}</style>
      {error || notice || archiveUndo ? (
        <div data-ltm-vault-feedback className="contents">
          {error ? (
            <StatusSurface tone="danger" tabIndex={-1}>
              {error}
            </StatusSurface>
          ) : null}
          {notice || archiveUndo ? (
            <StatusSurface tone={noticeState.warning ? "warning" : "success"} tabIndex={-1}>
              {archiveUndo ? (
                <span data-ltm-archive-undo-caption className="min-w-0 flex-1">
                  {archiveUndo.caption}
                </span>
              ) : null}
              {notice ? <span className="min-w-0 flex-1">{notice}</span> : null}
              {archiveUndo ? (
                <Button
                  className={busy ? "opacity-50" : ""}
                  aria-disabled={Boolean(busy) || undefined}
                  onClick={() => {
                    if (!busy) void undoArchive(archiveUndo);
                  }}
                >
                  {localizeUi("ui.longTermMemory.memoryvault.undo")}
                </Button>
              ) : null}
            </StatusSurface>
          ) : null}
        </div>
      ) : null}
      <LtmWorkspace
        activeMobilePane={mobilePane}
        onMobilePaneChange={setMobilePane}
        switcherLabel={localizeUi("ui.longTermMemory.longtermmemorynavigation.workspacePanes")}
        navigator={{
          label: localizeUi("ui.longTermMemory.longtermmemorynavigation.memories"),
          content: (
            <>
              <section
                data-ltm-browser-controls
                className="mari-editor-panel mari-editor-panel--soft grid grid-cols-2 gap-2 p-3"
              >
                <div className="col-span-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold">{localizeUi("ui.longTermMemory.memoryvault.memoryVault")}</h2>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {visible.length} {localizeUi("ui.longTermMemory.memoryvault.shown")}
                  </span>
                </div>
                <div data-ltm-memory-scope className="col-span-2 grid min-w-0 max-w-full gap-1">
                  <span className="text-[0.625rem] font-medium text-[var(--marinara-editor-muted)]">
                    {localizeUi("ui.longTermMemory.memoryvault.currentlyViewingMemoriesIn")}
                  </span>
                  <SourceScopeCombobox
                    targets={primaryPlaceOptions}
                    value={target?.id ?? "all"}
                    ariaLabel={localizeUi("ui.longTermMemory.memoryvault.currentlyViewingMemoriesIn")}
                    testId="vault"
                    memoryGroups={placeMemoryGroups}
                    onChange={(id) => {
                      const next = primaryPlaceOptions.find((option) => option.id === id)?.target;
                      if (next) void selectTarget(next);
                    }}
                  />
                </div>
                <label className="relative col-span-2 block">
                  <Search
                    aria-hidden="true"
                    size="0.875rem"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  />
                  <input
                    ref={searchInputRef}
                    className={`${inputClass} pl-9 pr-10`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={localizeUi("ui.longTermMemory.memoryvault.searchMemories")}
                    aria-label={localizeUi("ui.longTermMemory.memoryvault.searchMemories")}
                  />
                  {search ? (
                    <button
                      type="button"
                      aria-label={localizeUi("ui.longTermMemory.memoryvault.clearMemorySearch")}
                      title={localizeUi("ui.longTermMemory.memoryvault.clearMemorySearch")}
                      onClick={() => {
                        setSearch("");
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    >
                      <X aria-hidden="true" size="0.875rem" />
                    </button>
                  ) : null}
                </label>
                <label className="min-w-0 space-y-1 text-xs font-medium">
                  <span className="block text-[var(--marinara-editor-muted)]">
                    {localizeUi("ui.longTermMemory.memoryvault.showMemories")}
                  </span>
                  <select
                    className={`${inputClass} min-w-0 max-w-full`}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as LtmStatus | "all")}
                  >
                    <option value="all">{localizeUi("ui.longTermMemory.memoryvault.all")}</option>
                    {statusScopeTargets.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 space-y-1 text-xs font-medium">
                  <span className="block text-[var(--marinara-editor-muted)]">
                    {localizeUi("ui.longTermMemory.memoryvault.sortBy")}
                  </span>
                  <select
                    className={`${inputClass} min-w-0 max-w-full`}
                    value={sort}
                    onChange={(event) => setSort(event.target.value as "updated" | "title" | "created")}
                  >
                    <option value="updated">{localizeUi("ui.longTermMemory.memoryvault.recentlyUpdated")}</option>
                    {sortScopeTargets
                      .filter((option) => option.id !== "updated")
                      .map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </label>
                <details
                  data-ltm-refine
                  open={refineOpen}
                  onToggle={(event) => setRefineOpen(event.currentTarget.open)}
                  className="group col-span-2"
                >
                  <summary
                    data-ltm-tab-focus
                    className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-semibold [&::-webkit-details-marker]:hidden"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      size="0.875rem"
                      className="shrink-0 transition-transform group-open:rotate-90"
                    />
                    <span>{localizeUi("ui.longTermMemory.memoryvault.refine")}</span>
                    {refineSummary ? (
                      <span
                        data-ltm-refine-active
                        title={refineSummary}
                        className="min-w-0 truncate font-normal text-[var(--muted-foreground)] group-open:hidden"
                      >
                        {refineSummary}
                      </span>
                    ) : null}
                  </summary>
                  <div className="grid gap-2 pb-1">
                    <div data-ltm-memory-scope-secondary className="grid min-w-0 max-w-full gap-1">
                      <span className="text-[0.625rem] font-medium text-[var(--marinara-editor-muted)]">
                        {localizeUi("ui.longTermMemory.memoryvault.combineWithPlace")}
                      </span>
                      <SourceScopeCombobox
                        targets={secondaryPlaceOptions}
                        value={secondaryTarget?.id ?? "all"}
                        ariaLabel={localizeUi("ui.longTermMemory.memoryvault.combineWithPlace")}
                        testId="vault-secondary"
                        memoryGroups={placeMemoryGroups}
                        onChange={(id) =>
                          selectSecondaryTarget(
                            secondaryPlaceOptions.find((option) => option.id === id)?.target ?? null,
                          )
                        }
                      />
                    </div>
                    <fieldset className="space-y-1" data-ltm-mode-filter>
                      <legend className="text-[0.625rem] font-medium text-[var(--marinara-editor-muted)]">
                        {localizeUi("ui.longTermMemory.memoryvault.availableModes")}
                      </legend>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {modes.map((mode) => (
                          <label key={mode} className="flex min-h-11 items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={filterModes.includes(mode)}
                              onChange={() => toggleFilterMode(mode)}
                            />
                            {modeLabel(mode)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </details>
                <div className="col-span-2 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-2">
                  <Button
                    onClick={() => {
                      setSelectMode((value) => !value);
                      setChecked(new Set());
                    }}
                    data-ltm-select-mode
                  >
                    {selectMode
                      ? localizeUi("ui.longTermMemory.memoryvault.done")
                      : localizeUi("ui.longTermMemory.memoryvault.select")}
                  </Button>
                  <Button
                    onClick={() => setSourceFilter((value) => !value)}
                    aria-pressed={sourceFilter}
                    data-ltm-source-filter
                  >
                    <FileText aria-hidden="true" size="1rem" className="shrink-0" />
                    {localizeUi("ui.longTermMemory.memoryvault.sources")}
                  </Button>
                  {selectMode ? (
                    <label className="flex min-h-11 items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={
                          visible.filter((note) => note.type !== "source").length > 0 &&
                          visible.filter((note) => note.type !== "source").every((note) => checked.has(note.id))
                        }
                        onChange={(event) => toggleVisibleSelection(event.target.checked)}
                      />
                      {localizeUi("ui.longTermMemory.memoryvault.selectVisible")}
                    </label>
                  ) : null}
                  <span
                    data-ltm-selection-count
                    id="ltm-selection-count"
                    className="text-xs text-[var(--muted-foreground)]"
                  >
                    {checked.size} {localizeUi("ui.longTermMemory.memoryvault.selected")}
                    {hiddenChecked
                      ? localizeUi("ui.longTermMemory.memoryvault.value1HiddenByFilters", { value1: hiddenChecked })
                      : ""}
                  </span>
                </div>
              </section>
              {checked.size ? (
                <section
                  data-ltm-bulk-actions
                  aria-labelledby="ltm-selection-count"
                  className="mari-editor-panel flex flex-wrap items-center gap-2 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      {...busyActionProps}
                      onClick={() => {
                        if (busy) return;
                        setBulkAvailabilityAction("add");
                        setBulkAvailabilityTargets([]);
                        setBulkAvailabilityModes([]);
                        setBulkEditStatus("");
                        setAvailabilityOpen("bulk");
                        setMobilePaneAndFocus("workbench");
                      }}
                      data-ltm-bulk-edit
                    >
                      {localizeUi("ui.longTermMemory.memoryvault.editSelected")}
                    </Button>
                  </div>
                  <div
                    role="group"
                    aria-label={localizeUi("ui.longTermMemory.memoryvault.bulkRemoveGroup")}
                    className="ml-auto flex flex-wrap items-center gap-2 border-l border-[var(--border)] pl-2"
                  >
                    <Button
                      {...busyActionProps}
                      onClick={() => {
                        if (!busy) void batch("archive");
                      }}
                    >
                      <Archive aria-hidden="true" size="1rem" className="shrink-0" />
                      {localizeUi("ui.longTermMemory.memoryvault.archive")}
                    </Button>
                    <Button
                      destructive
                      {...busyActionProps}
                      onClick={() => {
                        if (!busy) void batch("delete");
                      }}
                    >
                      <Trash2 aria-hidden="true" size="1rem" className="shrink-0" />
                      {localizeUi("ui.longTermMemory.extractionprompttemplates.delete")}
                    </Button>
                  </div>
                </section>
              ) : null}
              <section
                ref={navigatorScrollRef}
                data-ltm-memory-list
                className="mari-editor-panel min-w-0"
                aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryList")}
                onScroll={(event) => {
                  const state = navigatorStates.get(contextKey);
                  if (state) state.scrollTop = event.currentTarget.scrollTop;
                }}
              >
                {scopeTargets.isError ? (
                  <StatusSurface tone="danger">
                    {localizeUi("ui.longTermMemory.memoryvault.memoryScopeCouldNotLoad")}{" "}
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center underline"
                      onClick={() => void scopeTargets.refetch()}
                    >
                      {localizeUi("ui.longTermMemory.memoryvault.retryMemoryScope")}
                    </button>
                  </StatusSurface>
                ) : null}
                {!scopeTargetResolved && scopeTargets.isLoading ? (
                  <StatusSurface busy>{localizeUi("ui.longTermMemory.memoryvault.loadingMemoryScope")}</StatusSurface>
                ) : null}
                {scopeTargetResolved && notes.isLoading ? (
                  <StatusSurface busy>{localizeUi("ui.longTermMemory.memoryvault.loadingMemories")}</StatusSurface>
                ) : null}
                {scopeTargetResolved && notes.isError ? (
                  <StatusSurface tone="danger">
                    {localizeUi("ui.longTermMemory.memoryvault.memoriesCouldNotLoad")}{" "}
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center underline"
                      onClick={() => void notes.refetch()}
                    >
                      {localizeUi("ui.longTermMemory.activityview.retry")}
                    </button>
                  </StatusSurface>
                ) : null}
                {navigatorGroups.map(({ type, labelKey, count, shown, nextNoteId }) => {
                  return (
                    <details
                      key={type}
                      open={deferredSearch.trim() ? true : undefined}
                      className="group"
                      data-ltm-memory-group={type}
                    >
                      <summary
                        style={{ minHeight: "2.75rem" }}
                        data-ltm-tab-focus
                        className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-[var(--border)] bg-[var(--secondary)]/35 px-3 text-xs font-semibold"
                      >
                        <ChevronRight
                          aria-hidden="true"
                          size="0.875rem"
                          className="transition-transform group-open:rotate-90"
                        />
                        <span>{localizeUi(labelKey)}</span>
                        <span className="ml-auto text-[var(--muted-foreground)]">{count}</span>
                      </summary>
                      {shown.map(({ note, preview: notePreview }) => (
                        <VaultRow
                          key={note.id}
                          note={note}
                          label={memoryLabel(note)}
                          previewLabel={notePreview?.label}
                          previewText={notePreview?.text}
                          selected={draft?.id === note.id}
                          actionsOpen={openActionNoteId === note.id}
                          selectMode={selectMode}
                          checked={checked.has(note.id)}
                          busy={Boolean(busy)}
                          actions={rowActions}
                        />
                      ))}
                      {count > shown.length ? (
                        <div className="border-b border-[var(--border)]/70 p-2">
                          <Button className="w-full" onClick={() => showMoreRows(type, shown.length, nextNoteId)}>
                            {localizeUi("ui.longTermMemory.memoryvault.showMoreMemories", {
                              value1: Math.min(vaultGroupRowLimit, count - shown.length),
                            })}
                            {/* Two groups past the cap would otherwise give two buttons the same accessible name. */}
                            <span className="sr-only"> {localizeUi(labelKey)}</span>
                          </Button>
                        </div>
                      ) : null}
                    </details>
                  );
                })}
                {scopeTargetResolved &&
                !scopeTargets.isError &&
                !notes.isLoading &&
                !notes.isError &&
                notes.isSuccess &&
                !visible.length ? (
                  <div className="p-5 text-center text-xs text-[var(--muted-foreground)]">
                    {hasFilterableNotes ? (
                      <>
                        <p>
                          {localizeUi("ui.longTermMemory.memoryvault.filteredEmptyDescription", {
                            value1: scopeEntryLabel,
                          })}
                        </p>
                        <p className="mt-2">
                          {localizeUi("ui.longTermMemory.memoryvault.filteredEmptyFilters", {
                            value1: activeFilterLabels.join(", "),
                          })}
                        </p>
                        <Button className="mt-3" onClick={clearNavigatorFilters}>
                          {localizeUi("ui.longTermMemory.memoryvault.clearFilters")}
                        </Button>
                      </>
                    ) : secondaryTarget && !allNotes.length ? (
                      <p>
                        {localizeUi("ui.longTermMemory.memoryvault.noMemoriesInCombinedScope", {
                          value1: scopeEntryLabel,
                        })}
                      </p>
                    ) : (
                      <p>{localizeUi("ui.longTermMemory.memoryvault.noMemoriesFound")}</p>
                    )}
                  </div>
                ) : null}
              </section>
            </>
          ),
        }}
        workbench={{
          label: localizeUi("ui.longTermMemory.memoryvault.memoryEditor"),
          disabled: !draft && availabilityOpen !== "bulk",
          content:
            availabilityOpen === "single" && draft ? (
              <MemoryAvailabilityWorkbench
                note={draft}
                originalNote={saved ? (JSON.parse(saved) as LtmNote) : null}
                isNew={isNew}
                targets={pickerTargets}
                availabilityTargets={availabilityTargets}
                localizeUi={localizeUi}
                modeLabel={modeLabel}
                onSave={saveAvailability}
                onCancel={() => setAvailabilityOpen(null)}
              />
            ) : availabilityOpen === "bulk" ? (
              <BulkAvailabilityWorkbench
                notes={allNotes.filter((note) => checked.has(note.id))}
                action={bulkAvailabilityAction}
                selectedTargets={bulkAvailabilityTargets}
                modes={bulkAvailabilityModes}
                availabilityTargets={availabilityTargets}
                locale={locale}
                pending={Boolean(busy)}
                localizeUi={localizeUi}
                modeLabel={modeLabel}
                onActionChange={setBulkAvailabilityAction}
                onModesChange={setBulkAvailabilityModes}
                onTargetsChange={setBulkAvailabilityTargets}
                status={bulkEditStatus}
                statuses={statuses}
                statusLabel={statusLabel}
                onStatusChange={setBulkEditStatus}
                onApply={() => {
                  if (busy || batchPendingRef.current) return;
                  setAvailabilityOpen(null);
                  void batch("edit");
                }}
                onCancel={() => setAvailabilityOpen(null)}
              />
            ) : (
              <section
                ref={detailRef}
                tabIndex={-1}
                data-ltm-note-workbench
                className="mari-editor-panel min-w-0 p-3"
                style={{
                  scrollMarginTop: "5rem",
                  containerName: "ltm-note-workbench",
                  containerType: "inline-size",
                }}
                aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryEditor")}
              >
                {!draft ? (
                  <div className="flex min-h-52 items-center justify-center text-center text-sm text-[var(--muted-foreground)]">
                    {localizeUi("ui.longTermMemory.memoryvault.openAMemoryForDetailsOrAddOne")}
                  </div>
                ) : draft.type === "source" ? (
                  <div className="space-y-4" data-ltm-source-readonly>
                    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">{memoryLabel(draft)}</h3>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{provenanceSourceLabel()}</p>
                      </div>
                      <Button
                        onClick={() =>
                          void onOpenSources?.(
                            draft.provenance?.kind === "character" || draft.tags.includes("imported_character")
                              ? "characters"
                              : draft.provenance?.kind === "lorebook" || draft.tags.includes("imported_lorebook")
                                ? "lorebooks"
                                : "chats",
                            draft.id,
                          )
                        }
                      >
                        <FileText aria-hidden="true" size="1rem" className="shrink-0" />
                        {localizeUi("ui.longTermMemory.memoryvault.openInSources")}
                      </Button>
                    </header>
                    <section className="space-y-2">
                      <h4 className="text-xs font-semibold">
                        {localizeUi("ui.longTermMemory.memoryvault.importedContent")}
                      </h4>
                      {Object.entries(draft.sections).map(([key, section]) => (
                        <article key={key} className="border-b border-[var(--border)] pb-3">
                          <h5 className="text-xs font-medium">{noteTypeLabel(key)}</h5>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{section.text}</p>
                        </article>
                      ))}
                    </section>
                    <section className="space-y-2 border-t border-[var(--border)] pt-4">
                      <h4 className="text-xs font-semibold">
                        {localizeUi("ui.longTermMemory.memoryvault.memoriesCreatedFromThisSource")}
                      </h4>
                      {sourceDerived.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => void openLinkedNote(note.id)}
                          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 text-left hover:bg-[var(--accent)]"
                        >
                          <span className="truncate text-sm">{memoryLabel(note)}</span>
                          <ChevronRight aria-hidden="true" size="0.875rem" />
                        </button>
                      ))}
                      {sourceDerivedQuery.isSuccess && !sourceDerived.length ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {localizeUi("ui.longTermMemory.memoryvault.noSavedMemoriesLinkToThisSourceYet")}
                        </p>
                      ) : null}
                    </section>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">
                          {isNew ? localizeUi("ui.longTermMemory.memoryvault.newMemory") : memoryLabel(draft)}
                        </h3>
                        {isNew ? (
                          <label className="mt-1 block text-xs font-medium text-[var(--muted-foreground)]">
                            <span>{localizeUi("ui.longTermMemory.memoryvault.memoryType")}</span>
                            <select
                              className={`${inputClass} mt-1`}
                              value={draft.type}
                              onChange={(event) => changeNewMemoryType(event.target.value as LtmNoteType)}
                            >
                              {noteTypes.map((type) => (
                                <option key={type} value={type}>
                                  {noteTypeLabel(type)}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.longTermMemory.memoryvault.memoryTypeValue", {
                              type: noteTypeLabel(draft.type),
                            })}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {!hasExplicitScope(draft.scope) ? (
                            <span className="rounded-full border px-2 py-1">
                              {localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")}
                            </span>
                          ) : null}
                          {draft.conflicts?.some((conflict) => conflict.resolution === "pending") ? (
                            <span className="rounded-full border border-[var(--destructive)]/40 px-2 py-1">
                              {localizeUi("ui.longTermMemory.memoryvault.conflicts")}
                            </span>
                          ) : null}
                          {draft.status === "archived" ? (
                            <span className="rounded-full border px-2 py-1">
                              {localizeUi("ui.longTermMemory.memoryvault.archived")}
                            </span>
                          ) : null}
                          {Object.values(draft.sections).some((section) =>
                            section.contributions?.some((contribution) => contribution.owner === "manual"),
                          ) ? (
                            <span data-ltm-accent-border className="rounded-full border px-2 py-1">
                              {localizeUi("ui.longTermMemory.memoryvault.editedManually")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => {
                            const next = !detailsOpen;
                            setDetailsOpen(next);
                            setMobilePaneAndFocus(next ? "inspector" : "workbench");
                          }}
                          aria-pressed={detailsOpen}
                          data-ltm-details-toggle
                          className={`inline-flex min-h-11 items-center gap-2 ${detailsOpen ? "bg-[var(--accent)]" : ""}`}
                        >
                          {localizeUi("ui.longTermMemory.memoryvault.memoryDetails")}
                        </Button>
                        {/* Save keeps its label and primary tone and stays focusable while off (UI.md: `aria-disabled`,
                            guarded handler); the polite status beside it carries Saving, and shows Saved for the eye while
                            the vault banner's "Memory saved" notice announces it, so one save speaks once. The region is
                            always mounted so the change is announced, and only takes room (`ml-2`) while it has text. */}
                        <span className="inline-flex items-center">
                          <Button
                            primary
                            data-ltm-save
                            aria-disabled={!dirty || busy === "save" ? true : undefined}
                            className={!dirty || busy === "save" ? "opacity-50" : ""}
                            onClick={() => {
                              if (dirty) void save();
                            }}
                          >
                            {localizeUi("ui.longTermMemory.memoryvault.save")}
                          </Button>
                          <span
                            role="status"
                            data-ltm-save-status
                            className={`text-xs text-[var(--muted-foreground)] ${saveStatus ? "ml-2" : ""}`}
                          >
                            {saveState === "saved" ? <span aria-hidden="true">{saveStatus}</span> : saveStatus}
                          </span>
                        </span>
                        <Button onClick={() => void closeDraft()}>
                          {localizeUi("ui.longTermMemory.memoryvault.close")}
                        </Button>
                      </div>
                    </header>
                    <section
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3"
                      data-ltm-availability-summary
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold">
                          {localizeUi("ui.longTermMemory.memoryvault.memoryAvailability")}
                        </h4>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {hasExplicitScope(draft.scope)
                            ? localizeUi("ui.longTermMemory.memoryvault.availabilitySummary", {
                                places: availabilityEntries(
                                  draft.scope,
                                  pickerTargets,
                                  {
                                    chat: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
                                    group: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
                                    character: localizeUi("ui.longTermMemory.memoryvault.unavailableCharacter"),
                                    persona: localizeUi("ui.longTermMemory.memoryvault.unavailablePersona"),
                                  },
                                  availabilityTargets.chats,
                                ).length,
                                modes: draft.modes.length,
                              })
                            : localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")}
                        </p>
                        {isNew && !hasExplicitScope(draft.scope) ? (
                          <p className="text-xs text-[var(--destructive)]">
                            {localizeUi("ui.longTermMemory.memoryvault.availabilityPlaceRequired")}
                          </p>
                        ) : null}
                      </div>
                      <Button className="shrink-0" onClick={openAvailability}>
                        {hasExplicitScope(draft.scope)
                          ? localizeUi("ui.longTermMemory.memoryvault.editAvailability")
                          : localizeUi("ui.longTermMemory.memoryvault.chooseWhereUsed")}
                      </Button>
                    </section>
                    {validation.length ? (
                      <div ref={validationRef} tabIndex={-1} data-ltm-validation-summary>
                        <StatusSurface tone="danger">
                          <ul className="space-y-1">
                            {validation.map((issue) => (
                              <li key={`${issue.focus}-${issue.message}`}>
                                <button
                                  type="button"
                                  className="inline-flex min-h-11 items-center text-left underline underline-offset-2"
                                  onClick={() => focusValidation(issue.focus)}
                                >
                                  {issue.message}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </StatusSurface>
                      </div>
                    ) : null}
                    <div data-ltm-note-layout data-details-open={detailsOpen} className="min-w-0">
                      <div data-ltm-note-editor className="space-y-4">
                        <div data-ltm-note-title-status className="grid gap-3">
                          <div className="space-y-1 text-xs font-medium">
                            <label htmlFor={`${statusInputId}-title`} className="flex min-h-7 items-center">
                              {localizeUi("ui.longTermMemory.memoryvault.title")}
                            </label>
                            <input
                              id={`${statusInputId}-title`}
                              className={inputClass}
                              data-ltm-field="title"
                              value={draft.title ?? ""}
                              aria-invalid={!draft.title?.trim()}
                              aria-describedby={!draft.title?.trim() ? `${statusInputId}-title-error` : undefined}
                              onChange={(event) => update("title", event.target.value)}
                            />
                            {!draft.title?.trim() ? (
                              <p id={`${statusInputId}-title-error`} className="text-xs text-[var(--destructive)]">
                                {localizeUi("ui.longTermMemory.memoryvault.memoryTitleRequired")}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-1 text-xs font-medium">
                            <div className="flex min-h-7 items-center gap-1">
                              <label htmlFor={statusInputId}>
                                {localizeUi("ui.longTermMemory.memoryvault.status")}
                              </label>
                              <InfoPopover
                                label={localizeUi("ui.longTermMemory.memoryvault.status")}
                                content={
                                  draft.status === "resolved"
                                    ? localizeUi(
                                        settings.data?.longTermMemoryIncludeResolved
                                          ? "ui.longTermMemory.memoryvault.resolvedIncludedInRecall"
                                          : "ui.longTermMemory.memoryvault.resolvedExcludedFromRecall",
                                      )
                                    : localizeUi("ui.longTermMemory.memoryvault.statusHelp")
                                }
                                compact
                              />
                            </div>
                            <select
                              id={statusInputId}
                              className={`${inputClass} relative`}
                              value={draft.status}
                              onChange={(event) => update("status", event.target.value as LtmStatus)}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabel(status)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {draft.type === "character" || draft.type === "relationship" ? (
                          <section className="space-y-2 text-xs font-medium" data-ltm-field="subjects">
                            <span>
                              {draft.type === "character"
                                ? localizeUi("ui.longTermMemory.memoryvault.personThisMemoryDescribes")
                                : localizeUi("ui.longTermMemory.memoryvault.peopleInThisRelationship")}
                            </span>
                            {localCharacters.isLoading && !localCharacters.data ? (
                              <StatusSurface compact busy>
                                {localizeUi("ui.longTermMemory.memoryvault.loadingLocalCharacters")}
                              </StatusSurface>
                            ) : localCharacters.isError && !localCharacters.data ? (
                              <StatusSurface compact tone="danger">
                                <span className="mr-auto">
                                  {localizeUi("ui.longTermMemory.memoryvault.localCharactersUnavailable")}
                                </span>
                                <Button onClick={() => void localCharacters.refetch()}>
                                  {localizeUi("ui.longTermMemory.memoryvault.retryLocalCharacters")}
                                </Button>
                              </StatusSurface>
                            ) : null}
                            <div className="flex flex-wrap gap-1.5">
                              {(draft.subjects ?? []).map((subject, index) => (
                                <Pill
                                  key={subject.key}
                                  label={subjectLabel(subject)}
                                  onRemove={() =>
                                    update("subjects", draft.subjects?.filter((_, item) => item !== index) ?? [])
                                  }
                                >
                                  {subjectLabel(subject)}
                                </Pill>
                              ))}
                            </div>
                            {!subjectLimitReached ? (
                              <TargetPicker
                                targets={pickerTargets}
                                selectedIds={subjectSelectionIds}
                                allowedKinds={new Set(["character", "persona", "local_character"])}
                                placeholder={localizeUi("ui.longTermMemory.memoryvault.chooseSubject")}
                                emptyLabel={localizeUi("ui.longTermMemory.memoryvault.noSubjectTargets")}
                                clearLabel={localizeUi("ui.longTermMemory.memoryvault.clearTargetSearch")}
                                onSelect={selectSubjectTarget}
                              />
                            ) : null}
                          </section>
                        ) : null}
                        <section className="space-y-3" data-ltm-details tabIndex={-1}>
                          <div className="flex flex-wrap items-end gap-2">
                            <h4 className="mr-auto text-xs font-medium">
                              {localizeUi("ui.longTermMemory.memoryvault.memorySections")}
                            </h4>
                            {!addingSection ? (
                              <Button ref={addSectionButtonRef} onClick={() => setAddingSection(true)}>
                                <Plus aria-hidden="true" size="1rem" className="shrink-0" />
                                {localizeUi("ui.longTermMemory.memoryvault.createNewMemoryDetail")}
                              </Button>
                            ) : null}
                          </div>
                          {addingSection ? (
                            <div className="flex flex-wrap items-end gap-2 rounded-md border border-[var(--border)] p-3">
                              <label className="min-w-0 flex-1 space-y-1 text-xs font-medium">
                                <span>{localizeUi("ui.longTermMemory.memoryvault.nameThisDetail")}</span>
                                <input
                                  autoFocus
                                  className={inputClass}
                                  value={sectionKey}
                                  onChange={(event) => setSectionKey(event.target.value)}
                                  placeholder={localizeUi("ui.longTermMemory.memoryvault.detailNameExample")}
                                  aria-label={localizeUi("ui.longTermMemory.memoryvault.newSectionName")}
                                />
                                <span className="block text-[var(--muted-foreground)]">
                                  {localizeUi("ui.longTermMemory.memoryvault.storedKey")}:{" "}
                                  {normalizeDetailName(sectionKey) ||
                                    localizeUi("ui.longTermMemory.memoryvault.notSet")}
                                </span>
                              </label>
                              <Button onClick={addSection} disabled={!sectionKey.trim()}>
                                <Plus aria-hidden="true" size="1rem" className="shrink-0" />
                                {localizeUi("ui.longTermMemory.memoryvault.addSection")}
                              </Button>
                              <Button
                                onClick={() => {
                                  setAddingSection(false);
                                  setSectionKey("");
                                  requestAnimationFrame(() => addSectionButtonRef.current?.focus());
                                }}
                              >
                                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
                              </Button>
                            </div>
                          ) : null}
                          {Object.entries(draft.sections).map(([key, section]) => (
                            <article key={key} className="space-y-2 rounded-md border border-[var(--border)] p-3">
                              <div className="flex items-center justify-between">
                                <label htmlFor={`ltm-section-${key}`} className="text-xs font-semibold">
                                  {noteTypeLabel(key)}
                                </label>
                                {draft.type !== "source" ? (
                                  <div className="flex items-center gap-1">
                                    <IconButton
                                      icon={Trash2}
                                      label={localizeUi("ui.longTermMemory.memoryvault.removeValue1Section", {
                                        value1: key,
                                      })}
                                      destructive
                                      disabled={Boolean(busy)}
                                      onClick={() => void deleteSection(key)}
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <fieldset disabled={draft.type === "source"} className="space-y-2">
                                <textarea
                                  id={`ltm-section-${key}`}
                                  data-ltm-field="section"
                                  className={`${inputClass} min-h-28 py-2`}
                                  style={{ maxHeight: "16rem", overflowY: "auto" }}
                                  value={section.text}
                                  aria-invalid={!section.text.trim()}
                                  aria-describedby={!section.text.trim() ? `ltm-section-${key}-error` : undefined}
                                  onInput={(event) => {
                                    const textarea = event.currentTarget;
                                    textarea.style.height = "auto";
                                    textarea.style.height = `${Math.min(textarea.scrollHeight, 256)}px`;
                                  }}
                                  onChange={(event) =>
                                    update("sections", {
                                      ...draft.sections,
                                      [key]: {
                                        ...section,
                                        text: event.target.value,
                                        updatedAt: new Date().toISOString(),
                                      },
                                    })
                                  }
                                />
                                {!section.text.trim() ? (
                                  <p id={`ltm-section-${key}-error`} className="text-xs text-[var(--destructive)]">
                                    {localizeUi("ui.longTermMemory.memoryvault.detailTextRequired")}
                                  </p>
                                ) : null}
                              </fieldset>
                              {draft.conflicts?.map((conflict, index) =>
                                conflict.resolution === "pending" && conflict.field.includes(key) ? (
                                  <section
                                    key={`${conflict.field}-${index}`}
                                    className="space-y-2 border-t border-[var(--destructive)]/35 pt-2"
                                    data-ltm-detail-conflict
                                  >
                                    <p className="text-xs font-semibold text-[var(--destructive)]">
                                      {localizeUi("ui.longTermMemory.memoryvault.conflictNeedsResolution")}
                                    </p>
                                    <p className="text-xs text-[var(--muted-foreground)]">{conflict.proposed}</p>
                                    <Button onClick={() => updateConflict(index, section.text)}>
                                      {localizeUi("ui.longTermMemory.memoryvault.resolve")}
                                    </Button>
                                  </section>
                                ) : null,
                              )}
                            </article>
                          ))}
                        </section>
                      </div>
                      {inspectorMount
                        ? createPortal(
                            <aside
                              data-ltm-note-inspector
                              aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryInspector")}
                              className="mari-editor-panel min-w-0 space-y-4 p-3"
                            >
                              <details
                                open
                                data-ltm-memory-options
                                className="group rounded-md border border-[var(--border)]"
                              >
                                <summary
                                  data-ltm-tab-focus
                                  className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"
                                >
                                  <ChevronRight
                                    aria-hidden="true"
                                    size="0.875rem"
                                    className="shrink-0 transition-transform group-open:rotate-90"
                                  />
                                  {localizeUi("ui.longTermMemory.memoryvault.keywordsAndLinks")}
                                </summary>
                                <section
                                  data-ltm-keyword-editor
                                  className="space-y-2 border-t border-[var(--border)] px-3 py-3"
                                >
                                  <h4 className="text-xs font-medium">
                                    {localizeUi("ui.longTermMemory.memoryvault.keywords")}
                                  </h4>
                                  <div className="flex flex-wrap gap-1.5">
                                    {activeKeywordValues(draft).map((keyword) => {
                                      const generated = getLtmKeywordIntent(draft).generated.some(
                                        (value) => ltmKeywordKey(value) === ltmKeywordKey(keyword),
                                      );
                                      return (
                                        <Pill
                                          key={keyword}
                                          label={`${generated ? localizeUi("ui.longTermMemory.memoryvault.generated") : localizeUi("ui.longTermMemory.memoryvault.addedManually")}: ${keyword}`}
                                          onRemove={() =>
                                            setDraft((current) =>
                                              current ? { ...current, ...removeLtmKeyword(current, keyword) } : current,
                                            )
                                          }
                                        >
                                          <span className="font-medium">
                                            {generated
                                              ? localizeUi("ui.longTermMemory.memoryvault.generated")
                                              : localizeUi("ui.longTermMemory.memoryvault.addedManually")}
                                          </span>
                                          : {keyword}
                                        </Pill>
                                      );
                                    })}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <input
                                      className={`${inputClass} min-w-0 flex-1 basis-[min(100%,10rem)]`}
                                      value={keywordInput}
                                      onChange={(event) => setKeywordInput(event.target.value)}
                                      onKeyDown={(event) => {
                                        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                                        event.preventDefault();
                                        addKeywords();
                                      }}
                                      placeholder={localizeUi("ui.longTermMemory.memoryvault.addKeyword")}
                                      aria-label={localizeUi("ui.longTermMemory.memoryvault.addKeyword")}
                                      aria-invalid={visibleKeywordError ? true : undefined}
                                      aria-describedby={visibleKeywordError ? "ltm-keyword-error" : undefined}
                                      data-ltm-keyword-input
                                    />
                                    <Button disabled={!keywordInput.trim()} onClick={addKeywords} data-ltm-keyword-add>
                                      <Plus aria-hidden="true" size="0.75rem" />
                                      {localizeUi("ui.longTermMemory.tokeneditor.add")}
                                    </Button>
                                  </div>
                                  {visibleKeywordError ? (
                                    <p
                                      id="ltm-keyword-error"
                                      role="alert"
                                      data-ltm-keyword-error
                                      className="text-xs text-[var(--destructive)]"
                                    >
                                      {visibleKeywordError}
                                    </p>
                                  ) : null}
                                </section>
                                {draft.type === "thread" || draft.type === "world" || draft.type === "tone" ? (
                                  <section className="space-y-2 border-t border-[var(--border)] px-3 pt-3">
                                    {draft.type === "thread" ? (
                                      <label className="flex min-h-11 items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4"
                                          checked={draft.tags.includes("quest")}
                                          onChange={(event) =>
                                            update(
                                              "tags",
                                              event.target.checked
                                                ? [...draft.tags, "quest"]
                                                : draft.tags.filter((tag) => tag !== "quest"),
                                            )
                                          }
                                        />
                                        {localizeUi("ui.longTermMemory.memoryvault.questMemory")}
                                      </label>
                                    ) : null}
                                    {draft.type !== "thread" ? (
                                      <label className="flex min-h-11 items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4"
                                          checked={draft.tags.includes("anchor")}
                                          onChange={(event) =>
                                            update(
                                              "tags",
                                              event.target.checked
                                                ? [...draft.tags, "anchor"]
                                                : draft.tags.filter((tag) => tag !== "anchor"),
                                            )
                                          }
                                        />
                                        {localizeUi("ui.longTermMemory.memoryvault.recurringMemory")}
                                      </label>
                                    ) : null}
                                  </section>
                                ) : null}
                                <details className="group space-y-2 border-t border-[var(--border)] px-3 py-3">
                                  <summary
                                    data-ltm-tab-focus
                                    className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-medium [&::-webkit-details-marker]:hidden"
                                  >
                                    <ChevronRight
                                      aria-hidden="true"
                                      size="0.875rem"
                                      className="shrink-0 transition-transform group-open:rotate-90"
                                    />
                                    {localizeUi("ui.longTermMemory.memoryvault.renameDetails")}
                                  </summary>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.keys(draft.sections).map((key) => (
                                      <Button
                                        key={key}
                                        data-ltm-rename-detail={key}
                                        disabled={Boolean(busy) || isNew}
                                        onClick={() => void beginRename(key)}
                                      >
                                        {localizeUi("ui.longTermMemory.memoryvault.renameDetail")}: {noteTypeLabel(key)}
                                      </Button>
                                    ))}
                                  </div>
                                </details>
                                <details
                                  className="group space-y-2 border-t border-[var(--border)] px-3 py-3"
                                  data-ltm-linked-memories
                                >
                                  <summary
                                    data-ltm-tab-focus
                                    className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs font-medium [&::-webkit-details-marker]:hidden"
                                  >
                                    <ChevronRight
                                      aria-hidden="true"
                                      size="0.875rem"
                                      className="shrink-0 transition-transform group-open:rotate-90"
                                    />
                                    {localizeUi("ui.longTermMemory.memoryvault.linkedMemories")}
                                    <span className="text-[var(--muted-foreground)]">
                                      ({outgoingLinks.length}{" "}
                                      {localizeUi("ui.longTermMemory.memoryvault.linksFromThisMemory")},{" "}
                                      {incomingLinks.length}{" "}
                                      {localizeUi("ui.longTermMemory.memoryvault.memoriesLinkingHere")})
                                    </span>
                                  </summary>
                                  <div className="flex min-h-11 items-center">
                                    <InfoPopover
                                      label={localizeUi("ui.longTermMemory.memoryvault.linkedMemories")}
                                      content={localizeUi(
                                        "ui.longTermMemory.memoryvault.explicitRelationshipsUsedToConnectThisMemoryToRelated",
                                      )}
                                      compact
                                    />
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {outgoingLinks.map((link, index) => (
                                      <Pill
                                        key={`${link.target}-${link.relation}-${index}`}
                                        label={localizeUi("ui.longTermMemory.longtermmemorydetail.value1Value2", {
                                          value1: relationLabel(link.relation),
                                          value2: memoryLabel(notesById.get(link.target)),
                                        })}
                                        onRemove={() =>
                                          update(
                                            "links",
                                            draft.links.filter((candidate) => candidate !== link),
                                          )
                                        }
                                      >
                                        {localizeUi("ui.longTermMemory.memoryvault.thisMemory")}{" "}
                                        {relationLabel(link.relation).toLocaleLowerCase()}{" "}
                                        <button
                                          type="button"
                                          className="inline-flex min-h-11 items-center underline underline-offset-2"
                                          onClick={() => void openLinkedNote(link.target)}
                                        >
                                          {memoryLabel(notesById.get(link.target))}
                                        </button>
                                      </Pill>
                                    ))}
                                  </div>
                                  {draft.links
                                    .filter((link) => link.relation === "extracted_from")
                                    .map((link) => (
                                      <p
                                        key={`${link.target}-${link.relation}`}
                                        className="text-xs text-[var(--muted-foreground)]"
                                      >
                                        {localizeUi("ui.longTermMemory.memoryvault.relationExtractedFrom")}:{" "}
                                        {memoryLabel(notesById.get(link.target))}
                                      </p>
                                    ))}
                                  <p className="text-xs text-[var(--muted-foreground)]">
                                    {localizeUi("ui.longTermMemory.memoryvault.memoriesLinkingHere")}:{" "}
                                    {incomingLinks.length}
                                  </p>
                                  {incomingLinks.map((note) => (
                                    <button
                                      key={note.id}
                                      type="button"
                                      className="flex min-h-11 items-center text-left text-xs underline"
                                      onClick={() => void openLinkedNote(note.id)}
                                    >
                                      {memoryLabel(note)}
                                    </button>
                                  ))}
                                  <div data-ltm-inspector-fields className="grid gap-2">
                                    <input
                                      className={inputClass}
                                      value={linkTarget}
                                      aria-label={localizeUi("ui.longTermMemory.memoryvault.searchOrEnterAMemory")}
                                      onChange={(event) => setLinkTarget(event.target.value)}
                                      placeholder={localizeUi("ui.longTermMemory.memoryvault.searchOrEnterAMemory")}
                                      list="ltm-linked-memories"
                                    />
                                    <datalist id="ltm-linked-memories">
                                      {linkContextNotes
                                        .filter(
                                          (note) =>
                                            note.id !== draft.id &&
                                            !draft.links.some((link) => link.target === note.id),
                                        )
                                        .map((note) => (
                                          <option key={note.id} value={note.id}>
                                            {memoryLabel(note)}
                                          </option>
                                        ))}
                                    </datalist>
                                    <select
                                      className={inputClass}
                                      value={linkRelation}
                                      aria-label={localizeUi("ui.longTermMemory.memorysettings.relationship")}
                                      onChange={(event) => setLinkRelation(event.target.value as LtmLink["relation"])}
                                    >
                                      {recommendedRelations[draft.type].map((relation) => (
                                        <option key={relation} value={relation}>
                                          {relationLabel(relation)}
                                        </option>
                                      ))}
                                    </select>
                                    <details className="group">
                                      <summary
                                        data-ltm-tab-focus
                                        className="flex min-h-11 w-full cursor-pointer list-none items-center gap-1 text-xs underline underline-offset-2 [&::-webkit-details-marker]:hidden"
                                      >
                                        <ChevronRight
                                          aria-hidden="true"
                                          size="0.875rem"
                                          className="shrink-0 transition-transform group-open:rotate-90"
                                        />
                                        {localizeUi("ui.longTermMemory.memoryvault.moreLinkTypes")}
                                      </summary>
                                      <select
                                        className={`${inputClass} mt-2`}
                                        value={linkRelation}
                                        onChange={(event) => setLinkRelation(event.target.value as LtmLink["relation"])}
                                        aria-label={localizeUi("ui.longTermMemory.memoryvault.moreLinkTypes")}
                                      >
                                        {relations
                                          .filter(
                                            (relation) =>
                                              relation !== "extracted_from" &&
                                              !recommendedRelations[draft.type].includes(relation),
                                          )
                                          .map((relation) => (
                                            <option key={relation} value={relation}>
                                              {relationLabel(relation)}
                                            </option>
                                          ))}
                                      </select>
                                    </details>
                                    <Button
                                      onClick={addLink}
                                      disabled={!linkTarget.trim() || linkTarget.trim() === draft.id}
                                    >
                                      <Link2 aria-hidden="true" size="1rem" className="shrink-0" />
                                      {localizeUi("ui.longTermMemory.memoryvault.link")}
                                    </Button>
                                  </div>
                                </details>
                              </details>
                              <details className="group rounded-md border border-[var(--border)]" data-ltm-record-info>
                                <summary
                                  data-ltm-tab-focus
                                  className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"
                                >
                                  <ChevronRight
                                    aria-hidden="true"
                                    size="0.875rem"
                                    className="shrink-0 transition-transform group-open:rotate-90"
                                  />
                                  {localizeUi("ui.longTermMemory.memoryvault.recordInfo")}
                                </summary>
                                <dl className="space-y-3 border-t border-[var(--border)] px-3 py-3 text-xs text-[var(--muted-foreground)]">
                                  {Object.entries(draft.sections).map(([key, section]) => (
                                    <div key={key}>
                                      <dt className="font-medium text-[var(--foreground)]">{noteTypeLabel(key)}</dt>
                                      <dd>
                                        {section.contributions?.some((contribution) => contribution.owner === "manual")
                                          ? localizeUi("ui.longTermMemory.memoryvault.editedManually")
                                          : ""}
                                      </dd>
                                      {section.evidence?.length ? (
                                        <dd>
                                          {localizeUi("ui.longTermMemory.memoryvault.evidence")}:{" "}
                                          {section.evidence.join("; ")}
                                        </dd>
                                      ) : null}
                                      {section.importance ? (
                                        <dd>
                                          {localizeUi("ui.longTermMemory.memoryvault.extractionImportance")}:{" "}
                                          {localizedLabel(section.importance, localizeUi, labelKeys.importance)}
                                        </dd>
                                      ) : null}
                                      {section.confidence !== undefined ? (
                                        <dd>
                                          {localizeUi("ui.longTermMemory.memoryvault.extractionConfidence")}:{" "}
                                          {Math.round(section.confidence * 100)}%
                                        </dd>
                                      ) : null}
                                    </div>
                                  ))}
                                  <div>
                                    <dt className="font-medium text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.memoryvault.memoryType")}
                                    </dt>
                                    <dd className="mt-0.5 break-words">{noteTypeLabel(draft.type)}</dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.memoryvault.recentChanges")}
                                    </dt>
                                    <dd className="mt-0.5 break-words">
                                      {noteEvents.data?.events.length ? (
                                        <ul className="space-y-1">
                                          {noteEvents.data.events.map((event) => (
                                            <li key={event.id}>
                                              {event.summary ?? humanizeLabel(event.type)}{" "}
                                              <span className="text-[var(--muted-foreground)]">
                                                {new Date(event.ts).toLocaleString(locale)}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        localizeUi("ui.longTermMemory.memoryvault.noRecentChanges")
                                      )}
                                      <button
                                        type="button"
                                        className="mt-2 inline-flex min-h-11 items-center underline underline-offset-2"
                                        onClick={() => onOpenActivity?.(draft.id)}
                                      >
                                        {localizeUi("ui.longTermMemory.memoryvault.openDebugLog")}
                                      </button>
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.memoryvault.created")}
                                    </dt>
                                    <dd className="mt-0.5 break-words">
                                      {new Date(draft.createdAt).toLocaleString(locale)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="font-medium text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.memoryvault.updated")}
                                    </dt>
                                    <dd className="mt-0.5 break-words">
                                      {new Date(draft.updatedAt).toLocaleString(locale)}
                                    </dd>
                                  </div>
                                  {draft.provenance ? (
                                    <div>
                                      <dt className="flex items-center gap-1 font-medium text-[var(--foreground)]">
                                        {localizeUi("ui.longTermMemory.memoryvault.provenance")}
                                        <InfoPopover
                                          label={localizeUi("ui.longTermMemory.memoryvault.provenance")}
                                          content={localizeUi("ui.longTermMemory.memoryvault.provenanceHelp")}
                                        />
                                      </dt>
                                      <dd className="break-words">
                                        {localizeUi("ui.longTermMemory.memoryvault.importedFrom", {
                                          source: provenanceSourceLabel(),
                                        })}
                                      </dd>
                                    </div>
                                  ) : null}
                                  <div>
                                    <dt className="font-medium text-[var(--foreground)]">
                                      {localizeUi("ui.longTermMemory.memoryvault.diagnostics")}
                                    </dt>
                                    <dd className="mt-0.5 break-words">
                                      <button
                                        type="button"
                                        className="inline-flex min-h-11 items-center underline underline-offset-2"
                                        onClick={() => void copyDiagnostics()}
                                      >
                                        {localizeUi("ui.longTermMemory.memoryvault.copyDiagnostics")}
                                      </button>
                                    </dd>
                                  </div>
                                </dl>
                              </details>
                            </aside>,
                            inspectorMount,
                          )
                        : null}
                    </div>
                  </div>
                )}
              </section>
            ),
        }}
        inspector={
          draft && detailsOpen && !availabilityOpen
            ? {
                label: localizeUi("ui.longTermMemory.memoryvault.memoryDetails"),
                content: <div ref={setInspectorMount} data-ltm-inspector-mount />,
              }
            : undefined
        }
      />
      {unsavedNavigation ? (
        <dialog
          ref={unsavedDialogRef}
          aria-modal="true"
          aria-labelledby="ltm-unsaved-title"
          aria-describedby="ltm-unsaved-description"
          onCancel={(event) => {
            event.preventDefault();
            finishUnsavedDecision("stay");
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
              ),
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
          className="fixed inset-0 z-50 grid h-full w-full place-items-center bg-black/50 p-4"
        >
          <section className="mari-editor-panel w-full max-w-md space-y-3 p-3 shadow-xl">
            <h3 id="ltm-unsaved-title" className="text-base font-semibold">
              {localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationTitle")}
            </h3>
            <p id="ltm-unsaved-description" className="text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationDescription")}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button data-ltm-unsaved-stay onClick={() => finishUnsavedDecision("stay")}>
                {localizeUi("ui.longTermMemory.memoryvault.keepEditing")}
              </Button>
              <Button destructive onClick={() => finishUnsavedDecision("discard")}>
                {localizeUi("ui.longTermMemory.memoryvault.discardAndContinue")}
              </Button>
              <Button primary onClick={() => finishUnsavedDecision("save")}>
                {localizeUi("ui.longTermMemory.memoryvault.saveAndContinue")}
              </Button>
            </div>
          </section>
        </dialog>
      ) : null}
      {renamingSectionKey ? (
        <dialog
          ref={renameDialogRef}
          aria-modal="true"
          aria-labelledby="ltm-rename-detail-title"
          onCancel={(event) => {
            event.preventDefault();
            // Like the disabled Cancel button, Escape keeps the dialog open while the rename runs.
            if (busy) return;
            setRenamingSectionKey(null);
            setRenamedSectionKey("");
            setRenamePreview(null);
          }}
          className="fixed inset-0 z-50 grid h-full w-full place-items-center bg-black/50 p-4"
        >
          <section className="mari-editor-panel w-full max-w-md space-y-3 p-3 shadow-xl">
            <h3 id="ltm-rename-detail-title" className="text-base font-semibold">
              {localizeUi("ui.longTermMemory.memoryvault.renameDetails")}
            </h3>
            <label className="block space-y-1 text-xs font-medium">
              <span>{localizeUi("ui.longTermMemory.memoryvault.nameThisDetail")}</span>
              <input
                className={inputClass}
                value={renamedSectionKey}
                aria-label={localizeUi("ui.longTermMemory.memoryvault.newSectionName")}
                aria-invalid={renameError ? true : undefined}
                aria-describedby={renameError ? "ltm-rename-detail-error" : undefined}
                onChange={(event) => {
                  setRenamedSectionKey(event.target.value);
                  setRenameError("");
                }}
              />
              <span className="block text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memoryvault.storedKey")}:{" "}
                {normalizeDetailName(renamedSectionKey) || localizeUi("ui.longTermMemory.memoryvault.notSet")}
              </span>
            </label>
            {renameError ? (
              <p id="ltm-rename-detail-error" role="alert" className="text-xs text-[var(--destructive)]">
                {renameError}
              </p>
            ) : null}
            {renamePreview ? (
              <p role="status" className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memoryvault.renamePreview", {
                  name: renamedSectionKey,
                  key: renamePreview.toSectionKey,
                  count: renamePreview.rewrittenDraftCount,
                })}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                onClick={() => {
                  setRenamingSectionKey(null);
                  setRenamedSectionKey("");
                  setRenamePreview(null);
                }}
                disabled={Boolean(busy)}
              >
                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
              </Button>
              <Button onClick={() => void previewRename()} disabled={Boolean(busy) || !renamedSectionKey.trim()}>
                {localizeUi("ui.longTermMemory.memoryvault.previewRename")}
              </Button>
              <Button
                primary
                onClick={() => void renameSection()}
                disabled={Boolean(busy) || !renamedSectionKey.trim()}
              >
                {localizeUi("ui.longTermMemory.memoryvault.saveDetailName")}
              </Button>
            </div>
          </section>
        </dialog>
      ) : null}
    </section>
  );
}
