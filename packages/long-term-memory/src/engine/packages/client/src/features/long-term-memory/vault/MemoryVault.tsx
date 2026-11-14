import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ChevronRight,
  Ellipsis,
  FileText,
  Link2,
  List,
  ListFilter,
  Network,
  Plus,
  Search,
  Trash2,
  X,
  Sparkles,
  Users,
} from "lucide-react";
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
  branchMemoriesPath,
  type LtmBranchMemories,
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
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  InfoPopover,
  ModeCheckboxes,
  UnsavedChangesDialog,
  confirm,
  inputClass,
  lockedActionProps,
  RemovableChip,
  ShowMore,
  StatusSurface,
} from "../shared-controls";
import type { LongTermMemoryDestinationProps } from "../types";
import { readSetupProgress } from "../onboarding/progress";
import { SetupSprite } from "../onboarding/Sprite";
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
import { LinkedMemories } from "./LinkedMemories";
import { MemoryGraph } from "./MemoryGraph";
import {
  buildScopeIndexes,
  buildScopeMemoryPresence,
  deriveScopeBranchChats,
  deriveScopeConversations,
  uniqueById,
} from "../scope-targets";
import type { AvailabilityChatTarget } from "../AvailabilityTabRail";
import { SearchPicker, type PickerItem } from "../picker";
import { SourceScopeCombobox } from "../SourceScopeCombobox";
import type { ScopeTarget } from "../sources/source-shared";
import type { ScopeTargetLocalCharacter } from "../scope-targets";
import { normalizeDetailName } from "./detail-name";
import {
  availabilityEntries,
  hasExplicitScope,
  modes,
  sameScope,
  sessionSecondaryTargets,
  sessionTargets,
  splitBulkAvailabilityTarget,
  withWholeChatBranches,
} from "./vault-shared";
import type { AvailabilityTargets, PickerTarget, Target } from "./vault-shared";
import { MemoryAvailabilityWorkbench } from "./MemoryAvailabilityWorkbench";
import { BulkAvailabilityWorkbench } from "./BulkAvailabilityWorkbench";
import { useVaultBackup } from "./useVaultBackup";
import { useVaultFix } from "./useVaultFix";
import { TidyDialog, type LtmAiCheckKind } from "../onboarding/TidyWithAi";
import { formatAge } from "../settings/debug-activity";
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

/** The notes an archive changed, with the status each had, so Undo can put them back. */
type ArchivedNotes = Array<{ id: string; status: LtmStatus }>;

/** A saved change whose recall index could not be rebuilt: kept, but long enough on screen to read the reason. */
function warnRecallStale(localizeUi: LtmTranslationFunction, error: string | undefined) {
  toast.warning(
    error
      ? localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStale", { error })
      : localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStaleNoError"),
    { duration: 12_000 },
  );
}

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

const originLabelKeys = {
  package_record: "ui.longTermMemory.memoryvault.originSlurp",
  advanced_memory: "ui.longTermMemory.memoryvault.originAdvancedMemory",
} as const;
/** Where a memory came from, when another package or Advanced Memory added it: a source record's own provenance, else its `extracted_from` source's. */
function originLabelKey(note: LtmNote, notesById: ReadonlyMap<string, LtmNote>) {
  const source =
    note.type === "source"
      ? note
      : notesById.get(note.links.find((link) => link.relation === "extracted_from")?.target ?? "");
  const kind = source?.type === "source" ? source.provenance?.kind : undefined;
  return kind === "package_record" || kind === "advanced_memory" ? originLabelKeys[kind] : undefined;
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
/** Preview text on one line: list markers ("- ", "* ", "• ", "+ ") at the start of the text or of a line are dropped. */
function plainPreviewText(text: string) {
  return text
    .replace(/^[ \t]*[-*•+][ \t]+/gmu, "")
    .replace(/\s+/gu, " ")
    .trim();
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
  // The label says what matched the search, so without a search the preview is just the text.
  if (!selected && query) {
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
      ? { label: undefined, text: plainPreviewText(sections[0][1].text.slice(0, 400)).slice(0, 180) }
      : null;
  const [key, section] = selected;
  const text = plainPreviewText(section.text);
  const match = query ? text.toLocaleLowerCase().indexOf(query) : -1;
  const start = match > 60 ? match - 60 : 0;
  return {
    label: query ? formatNoteTypeLabel(key, localizeUi) : undefined,
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
      // Empty on purpose: the textarea shows a placeholder, so typing never replaces text the writer did not write.
      facts: { text: "", updatedAt: now },
    },
    conflicts: [],
    version: 1,
  };
}

// soup/tour: the made-up memories Mari's Graph stop draws when the Vault has none. Never saved or sent anywhere.
function exampleGraphNotes(localizeUi: LtmTranslationFunction): LtmNote[] {
  const example = (
    key: string,
    type: LtmNote["type"],
    importance: "critical" | "major" | "moderate",
    links: LtmNote["links"] = [],
  ): LtmNote => {
    const blank = newNote({}, localizeUi);
    const title = localizeUi(`ui.longTermMemory.tour.example.${key}`);
    return {
      ...blank,
      id: `example_${key}`,
      title,
      type,
      links,
      sections: { facts: { text: title, updatedAt: blank.updatedAt, importance } },
    };
  };
  return [
    example("mira", "character", "major"),
    example("tomas", "character", "major"),
    example("harbour", "world", "moderate"),
    example("friends", "relationship", "major", [
      { target: "example_mira", relation: "involves" },
      { target: "example_tomas", relation: "involves" },
    ]),
    example("fire", "timeline_event", "critical", [
      { target: "example_friends", relation: "affects_relationship" },
      { target: "example_mira", relation: "affects_character" },
      { target: "example_harbour", relation: "occurred_in" },
    ]),
    example("mystery", "thread", "moderate", [{ target: "example_fire", relation: "planted_in" }]),
  ];
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

/**
 * The empty Vault before setup is done: Mari offers setup instead of "New memory" ("Create manually" stays in the
 * Add menu). A started setup resumes, with its answered beats ticked.
 */
function VaultSetupInvite({
  packageVersion,
  onOpenSetup,
  sourceNotes,
}: {
  packageVersion?: string | null;
  onOpenSetup: () => void;
  sourceNotes: ReactNode;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const progress = readSetupProgress();
  const answered = typeof progress === "number" ? progress - 1 : 0;
  return (
    <div className="flex flex-col items-center gap-2" data-ltm-vault-setup>
      <SetupSprite sprite="vault-idle" packageVersion={packageVersion} />
      <p className="text-sm font-semibold text-[var(--foreground)]">
        {localizeUi("ui.longTermMemory.memoryvault.setupEmptyTitle")}
      </p>
      <p>{localizeUi("ui.longTermMemory.memoryvault.setupEmptyHint")}</p>
      {typeof progress === "number" ? (
        <span
          role="img"
          aria-label={localizeUi("ui.longTermMemory.memoryvault.setupAnswered", { value1: answered })}
          className="flex gap-1"
          data-ltm-vault-setup-ticks
        >
          {[1, 2, 3, 4].map((tick) => (
            <span
              key={tick}
              className="h-1 w-4 rounded-full"
              style={{ background: tick <= answered ? "var(--primary)" : "var(--border)" }}
            />
          ))}
        </span>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button primary data-ltm-vault-setup-open onClick={onOpenSetup}>
          {localizeUi(
            typeof progress === "number"
              ? "ui.longTermMemory.memoryvault.resumeSetup"
              : "ui.longTermMemory.memoryvault.setUpMemory",
          )}
        </Button>
        {sourceNotes}
      </div>
    </div>
  );
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
  onOpenSetup,
  exampleGraph,
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
  const focusAfterRender = (selector: string) =>
    requestAnimationFrame(() => vaultRef.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }));
  const detailRef = useRef<HTMLElement>(null);
  const contextKey = props.chatId ?? "__global__";
  const initialNavigatorState = navigatorStates.get(contextKey);
  const [search, setSearch] = useState(initialNavigatorState?.search ?? "");
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Tapping a row's "From branch …" button narrows this chat's own place to that branch; the bar above the list says so.
  const [branchFilter, setBranchFilter] = useState<{ contextKey: string; chatId: string } | null>(null);
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
  const [view, setView] = useState<"list" | "graph">("list");
  const [draft, setDraft] = useState<LtmNote | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState<"single" | "bulk" | null>(null);
  // Refine holds the rarer filters. A second place or a mode filter opens it, and closing it stays the user's choice.
  const refineActive = Boolean(secondaryTarget) || filterModes.length < modes.length;
  const [refineOpen, setRefineOpen] = useState(refineActive);
  // Back up and Restore sit behind the header's "⋯"; the menu stays open until the writer closes it.
  const [vaultMoreOpen, setVaultMoreOpen] = useState(false);
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
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [error, setError] = useState("");
  // Guidance the writer acts on in place (a recovered suggestion to review). Finished actions are toasts.
  const [notice, setNotice] = useState("");
  // The archive toast carries Undo; a new batch, another place or a context switch makes its Undo stale.
  const archiveToastRef = useRef<string | number | null>(null);
  // Counts the stale points, so an Undo still running when one passes raises no toast.
  const archiveToastScope = useRef(0);
  const dismissArchiveToast = () => {
    archiveToastScope.current += 1;
    if (archiveToastRef.current !== null) toast.dismiss(archiveToastRef.current);
    archiveToastRef.current = null;
  };
  // Batch, row and Undo actions use `aria-disabled` so the control keeps focus while it runs, and
  // `batchPendingRef` blocks a second run before React re-renders. When one finishes, the result is a toast;
  // focus only moves, to the inline error or the search field, if the control that had it is gone.
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
    // A toast's own button (Undo) leaves with the toast, so focus on it counts as lost.
    const lost = !active || active === document.body || Boolean(active.closest("[data-sonner-toast]"));
    if (!lost && active !== feedbackTriggerRef.current) return;
    const inlineError = vaultRef.current?.querySelector<HTMLElement>("[data-ltm-vault-feedback] [data-ltm-status]");
    if (inlineError) inlineError.focus();
    else if (lost) searchInputRef.current?.focus();
  }, [feedbackFocusRequest]);
  const [recoverySuggestionId, setRecoverySuggestionId] = useState<string | null>(null);
  const [bulkEditStatus, setBulkEditStatus] = useState<LtmStatus | "">("");
  const [bulkAvailabilityModes, setBulkAvailabilityModes] = useState<LtmMode[]>([]);
  const [bulkAvailabilityTargets, setBulkAvailabilityTargets] = useState<string[]>([]);
  const [bulkAvailabilityAction, setBulkAvailabilityAction] = useState<"add" | "remove">("add");
  const [unsavedNavigation, setUnsavedNavigation] = useState<string | null>(null);
  const renameDialogRef = useRef<HTMLDialogElement>(null);
  const unsavedResolveRef = useRef<((decision: "save" | "discard" | "stay") => void) | null>(null);
  const [openActionNoteId, setOpenActionNoteId] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkRelation, setLinkRelation] = useState<LtmLink["relation"]>("involves");
  const [keywordInput, setKeywordInput] = useState("");
  // A keyword error belongs to the text that caused it, so it hides once that text changes.
  const [keywordError, setKeywordError] = useState<{ input: string; message: string } | null>(null);
  const visibleKeywordError = keywordError?.input === keywordInput ? keywordError.message : "";
  const [sectionKey, setSectionKey] = useState("");
  const [sectionError, setSectionError] = useState("");
  const sectionInputRef = useRef<HTMLInputElement>(null);
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
    dismissArchiveToast();
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
      let primary = await requestAllNotes<LtmNote>(notesRequestPath(notesScope));
      // A branch's own place also lists what recall uses from the conversation's other branches, each marked with
      // the branch it is saved to. The server works this out the way recall does.
      const inheritedFrom = new Map<string, { chatId: string; name: string }>();
      if (props.chatId && target?.id === `chat:${props.chatId}`) {
        const { branches } = await request<LtmBranchMemories>(branchMemoriesPath(props.chatId)).catch(() => ({
          branches: [] as LtmBranchMemories["branches"],
        }));
        for (const branch of branches)
          for (const id of branch.noteIds) inheritedFrom.set(id, { chatId: branch.chatId, name: branch.name });
        const ownIds = new Set(primary.map((note) => note.id));
        const missing = [...inheritedFrom.keys()].filter((id) => !ownIds.has(id));
        if (missing.length) primary = [...primary, ...(await requestNotesByIds<LtmNote>(missing, undefined, true))];
      }
      if (!secondaryTarget) return { displayed: primary, linkContext: primary, inheritedFrom };
      // ponytail: AND is an exact client-side intersection of the two single-place
      // result sets, so the server keeps its OR-within-one-place scope contract.
      const secondary = await requestAllNotes<LtmNote>(notesRequestPath(secondaryNotesScope));
      const secondaryIds = new Set(secondary.map((note) => note.id));
      // `displayed` drives the navigator and bulk selection; `linkContext` keeps the
      // primary place's notes so link titles, incoming links and linked-title search
      // still resolve for memories the second place excludes.
      return { displayed: primary.filter((note) => secondaryIds.has(note.id)), linkContext: primary, inheritedFrom };
    },
  });
  const inheritedFrom = notes.data?.inheritedFrom;
  // The branch filter belongs to this chat's own place: choosing another place drops it.
  useEffect(() => {
    if (target && target.id !== `chat:${props.chatId}`) setBranchFilter(null);
  }, [props.chatId, target]);
  const activeBranchFilter =
    branchFilter?.contextKey === contextKey && target?.id === `chat:${props.chatId}` ? branchFilter.chatId : null;
  const activeBranchName = activeBranchFilter
    ? [...(inheritedFrom?.values() ?? [])].find((branch) => branch.chatId === activeBranchFilter)?.name
    : undefined;
  const settings = useQuery(settingsQueryOptions);
  const noteEvents = useQuery({
    queryKey: [...queryKeys.activity, "note", draft?.id],
    enabled: Boolean(draft && !isNew),
    // The events route returns at most 20 per memory, which is the History list's ceiling.
    queryFn: () => request<{ events: NoteEvent[] }>(`/events?noteId=${encodeURIComponent(draft!.id)}&limit=20`),
  });
  const allNotes = notes.data?.displayed ?? [];
  const linkContextNotes = notes.data?.linkContext ?? [];
  const notesById = useMemo(
    () => new Map((notes.data?.linkContext ?? []).map((note) => [note.id, note])),
    [notes.data],
  );
  // The link picker lists every memory the host knows except this one and the ones already linked.
  const linkPickerItems = useMemo<PickerItem[]>(
    () =>
      draft
        ? linkContextNotes
            .filter((note) => note.id !== draft.id && !draft.links.some((link) => link.target === note.id))
            .map((note) => ({
              id: note.id,
              kind: "memory" as const,
              label: memoryLabel(note),
              comment: noteTypeLabel(note.type),
            }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- linkContextNotes derives from notes.data
    [draft?.id, draft?.links, notes.data?.linkContext, memoryLabel, locale],
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
      return (
        targets?.find((target) => target.id === subject.ref!.id)?.label ??
        localizeUi("ui.longTermMemory.memoryvault.unresolvedSubject")
      );
    },
    [localCharacters.data, localizeUi, scopeTargets.data],
  );
  // The list filters with a deferred copy of the search, so the field updates at once and React
  // renders the filtered rows in the background, dropping that render when another key arrives.
  const deferredSearch = useDeferredValue(search);
  // The haystack of every note is built once per notes list, not once per keystroke.
  const searchIndex = useMemo(
    () =>
      new Map((notes.data?.displayed ?? []).map((note) => [note.id, searchable(note, notesById, subjectSearchLabel)])),
    [notes.data?.displayed, notesById, subjectSearchLabel],
  );
  const visible = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase();
    return (notes.data?.displayed ?? [])
      .filter(
        (note) =>
          (statusFilter === "all" || note.status === statusFilter) &&
          (sourceFilter ? note.type === "source" : note.type !== "source") &&
          (!filterModes.length || filterModes.some((mode) => note.modes.includes(mode))) &&
          (!activeBranchFilter || inheritedFrom?.get(note.id)?.chatId === activeBranchFilter) &&
          (!query || searchIndex.get(note.id)?.includes(query)),
      )
      .sort((left, right) =>
        sort === "title"
          ? memoryLabel(left).localeCompare(memoryLabel(right))
          : sort === "created"
            ? right.createdAt.localeCompare(left.createdAt)
            : right.updatedAt.localeCompare(left.updatedAt),
      );
  }, [
    activeBranchFilter,
    deferredSearch,
    filterModes,
    inheritedFrom,
    memoryLabel,
    notes.data?.displayed,
    searchIndex,
    sort,
    sourceFilter,
    statusFilter,
  ]);
  // The Graph shows what the List would for this place, search and branch, whatever its status, kind and mode filters.
  const graphNotes = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase();
    return (notes.data?.displayed ?? []).filter(
      (note) =>
        (!activeBranchFilter || inheritedFrom?.get(note.id)?.chatId === activeBranchFilter) &&
        (!query || searchIndex.get(note.id)?.includes(query)),
    );
  }, [activeBranchFilter, deferredSearch, inheritedFrom, notes.data?.displayed, searchIndex]);
  // soup/tour: with nothing of the user's to draw, Mari's Graph stop draws an example instead of an empty box.
  // Sources do not count: the Graph hides them by default, so a place holding only sources draws nothing.
  const exampleNotes = useMemo(
    () =>
      exampleGraph && notes.data && !notes.data.displayed.some((note) => note.type !== "source")
        ? exampleGraphNotes(localizeUi)
        : null,
    [exampleGraph, notes.data, localizeUi],
  );
  // "Show more" counts apply to one list: a new search, filter, sort or place starts again at the limit.
  const shownRowsKey = JSON.stringify([
    contextKey,
    target?.id,
    secondaryTarget?.id,
    activeBranchFilter,
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
          originKey: originLabelKey(note, notesById),
        }));
        return [{ type, labelKey, count: group.length, shown, nextNoteId: group[shown.length]?.id }];
      }),
    [deferredSearch, localizeUi, notesById, shownRowCounts, subjectSearchLabel, visible],
  );
  // The first group opens by itself, once per place: remembering its type keeps it open if a group sorted above
  // it appears later (a saved Character memory), and leaves the user's own toggles alone.
  const autoOpenGroup = useRef({ placeKey: "", type: "" });
  if (navigatorGroups.length && autoOpenGroup.current.placeKey !== (target?.id ?? "")) {
    autoOpenGroup.current = { placeKey: target?.id ?? "", type: navigatorGroups[0]!.type };
  }
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
    setBranchFilter(null);
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
    activeBranchName ? localizeUi("ui.longTermMemory.memoryvault.fromBranch", { value1: activeBranchName }) : "",
    sort !== "updated"
      ? localizeUi("ui.longTermMemory.memoryvault.filteredEmptySort", {
          value1: sortScopeTargets.find((candidate) => candidate.id === sort)?.label ?? sort,
        })
      : "",
  ].filter(Boolean);
  // The closed Filters line names every filter that is not at its default, but only a place or mode filter opens it.
  const refineSummary = [
    statusFilter !== "all" ? statusLabel(statusFilter) : "",
    sort !== "updated"
      ? localizeUi("ui.longTermMemory.memoryvault.refineActiveSort", {
          value1: sortScopeTargets.find((candidate) => candidate.id === sort)?.label ?? sort,
        })
      : "",
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
  const unavailablePlaceLabels = {
    chat: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
    group: localizeUi("ui.longTermMemory.memoryvault.unavailableChat"),
    character: localizeUi("ui.longTermMemory.memoryvault.unavailableCharacter"),
    persona: localizeUi("ui.longTermMemory.memoryvault.unavailablePersona"),
  };
  // Row line: where the memory is available and who it is about, as plain values for the memoized row.
  const rowPlaces = (note: LtmNote) => {
    if (note.type === "source") return undefined;
    if (!hasExplicitScope(note.scope)) return [localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")];
    const entries = availabilityEntries(note.scope, pickerTargets, unavailablePlaceLabels, availabilityTargets.chats);
    // The memory is exactly where the writer is looking, so a chip for that place says nothing.
    const viewed = new Set([target?.id, secondaryTarget?.id].filter((id) => id && id !== "all"));
    return entries.filter((entry) => !viewed.has(`${entry.kind}:${entry.id}`)).map((entry) => entry.label);
  };
  // The age sits on the title line; its tooltip is "Updated" and the full date and time.
  const rowUpdated = (note: LtmNote) => formatAge(note.updatedAt, locale, Date.now()) || undefined;
  const rowUpdatedTitle = (note: LtmNote) =>
    Number.isFinite(Date.parse(note.updatedAt))
      ? localizeUi("ui.longTermMemory.memoryvault.rowUpdated", {
          value1: new Date(note.updatedAt).toLocaleString(locale),
        })
      : undefined;
  // "About Rika" repeats a title that already names every subject, so it is dropped then.
  const rowSubjects = (note: LtmNote) => {
    if (!note.subjects?.length) return undefined;
    const title = memoryLabel(note);
    const labels = note.subjects.map(subjectLabel);
    // Whole words only, so a subject "Al" is not named by the title "Always late".
    const names = (label: string) =>
      Boolean(label) &&
      new RegExp(`(^|[^\\p{L}\\p{N}])${label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu").test(
        title,
      );
    if (labels.every(names)) return undefined;
    return localizeUi("ui.longTermMemory.memoryvault.rowAbout", { value1: labels.join(" · ") });
  };
  // The place filter (not the filters) is what hides every memory: say so and offer Show all.
  const placeHidesMemories = (target?.id !== "all" || Boolean(secondaryTarget)) && (memoryPresence?.length ?? 0) > 0;
  const sourceNoteCount = allNotes.filter((note) => note.type === "source").length;
  // A blank new memory starts empty by design, so its empty text is flagged only once a save has refused it.
  const emptyDetailInvalid = (text: string) => !text.trim() && (!isNew || validation.length > 0);
  async function showAllMemories() {
    if (target?.id !== "all" && !(await selectTarget(targets[0]!))) return;
    selectSecondaryTarget(null);
  }
  const draftOriginKey = draft ? originLabelKey(draft, notesById) : undefined;
  const provenanceSourceLabel = () => {
    if (!draft?.provenance) return "";
    if (draft.provenance.kind === "character")
      return localizeUi("ui.longTermMemory.memoryvault.characterRecord", {
        name: scopeTargetLabel("character", draft.provenance.sourceId, targets),
      });
    // An Advanced Memory scene recap is the host's summary of that chat.
    if (draft.provenance.kind === "chat_summary" || draft.provenance.kind === "advanced_memory")
      return localizeUi("ui.longTermMemory.memoryvault.chatSummary", {
        title: scopeTargetLabel("chat", draft.provenance.sourceId, targets),
      });
    if (draft.provenance.kind === "chat_transcript")
      return localizeUi("ui.longTermMemory.memoryvault.chatMessages", {
        title: scopeTargetLabel("chat", draft.provenance.sourceId, targets),
      });
    if (draft.provenance.kind === "package_record") return localizeUi("ui.longTermMemory.memoryvault.fromSlurp");
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
  function finishUnsavedDecision(decision: "save" | "discard" | "stay") {
    const resolve = unsavedResolveRef.current;
    unsavedResolveRef.current = null;
    setUnsavedNavigation(null);
    resolve?.(decision);
  }
  async function confirmLeave(next: string) {
    if (!dirtyRef.current) return true;
    const decision = await new Promise<"save" | "discard" | "stay">((resolve) => {
      unsavedResolveRef.current = resolve;
      setUnsavedNavigation(next);
    });
    if (decision === "save") return save();
    return decision === "discard";
  }
  async function selectTarget(next: Target) {
    if (
      !(await confirmLeave(
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
    dismissArchiveToast();
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
  async function openNote(note: LtmNote, expectedContextKey = targetContextKey.current) {
    if (expectedContextKey !== targetContextKey.current) return;
    if (
      !(await confirmLeave(
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
    if (!(await confirmLeave(localizeUi("ui.longTermMemory.memoryvault.creatingNewMemory")))) return;
    const next = newNote(target?.scope ?? {}, localizeUi);
    next.modes = props.chatMode ? [props.chatMode] : [];
    // With a character in scope (the picked place's, else the chat's when no place is picked or it is All), the
    // memory starts on that character and as a Character memory about them, not as a World memory in another
    // character's place. A picked persona or group place keeps its own scope.
    const placeIsPicked = target && target.id !== "all" && target.scope;
    const characterId = selectedCharacterId || (placeIsPicked ? "" : (currentChat?.characterIds[0] ?? ""));
    if (characterId) {
      const type: LtmNoteType = "character";
      next.scope = { characterIds: [characterId] };
      next.type = type;
      next.id = `${prefixes[type]}_${randomId()}`;
      next.subjects = [{ key: `character:${characterId}`, ref: { kind: "character", id: characterId } }];
      next.sections = { [suggestedDetailKey(type)]: Object.values(next.sections)[0]! };
    }
    editorSession.current += 1;
    setDraft(next);
    setValidation([]);
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
    if (!(await confirmLeave(localizeUi("ui.longTermMemory.memoryvault.closingThisMemory")))) return;
    clearDraft();
  }
  function clearDraft() {
    editorSession.current += 1;
    setDraft(null);
    setValidation([]);
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
      queryKeys.identityRepair,
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
  // The toast outlives the render that made it, so read the lock from refs, not from the closure.
  const undoLocked = () => busyRef.current || batchPendingRef.current;
  async function undoArchive(archived: ArchivedNotes) {
    if (undoLocked()) return;
    batchPendingRef.current = true;
    feedbackTriggerRef.current = document.activeElement;
    const session = editorSession.current;
    // The toast is the vault's, not the open memory's: opening another memory keeps it, a stale point drops it.
    const scope = archiveToastScope.current;
    setBusy("undo-archive");
    setError("");
    try {
      const notesByStatus = new Map<LtmStatus, string[]>();
      for (const note of archived) {
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
      await refreshAfterBatch(
        results.flatMap((result) => (result.status === "fulfilled" ? result.value.affectedNoteIds : [])),
      );
      if (scope !== archiveToastScope.current) return;
      toast.success(
        localizeUi(
          selectLtmPluralForm(locale, archived.length) === "one"
            ? "ui.longTermMemory.memoryvault.archiveUndoSuccessOne"
            : "ui.longTermMemory.memoryvault.archiveUndoSuccessOther",
          { count: archived.length },
        ),
      );
      if (session === editorSession.current) focusFeedback();
    } catch {
      if (scope === archiveToastScope.current) {
        // The rollback put the notes back in the archive, so the failure offers Undo again.
        archiveToastRef.current = toast.error(localizeUi("ui.longTermMemory.memoryvault.archiveUndoFailed"), {
          action: {
            label: localizeUi("ui.longTermMemory.memoryvault.undo"),
            onClick: (event) => {
              if (undoLocked()) event.preventDefault();
              else void undoArchive(archived);
            },
          },
          duration: 10_000,
        });
        if (session === editorSession.current) focusFeedback();
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
      toast.success(localizeUi("ui.longTermMemory.memoryvault.availabilityStaged"));
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
    // The save succeeded, so a failed reload must not turn it into an error.
    await invalidate().catch(() => undefined);
    toast.success(localizeUi("ui.longTermMemory.memoryvault.availabilitySaved"));
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
        warnRecallStale(localizeUi, response.rebuild.error);
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
      // Outside the updater: a toast raised inside it would run during render, and twice in Strict Mode.
      toast.success(
        localizeUi(
          savedCurrentDraft
            ? "ui.longTermMemory.memoryvault.memorySaved"
            : "ui.longTermMemory.memoryvault.memorySavedNewerEditsUnsaved",
        ),
      );
      setDraft((current) => {
        if (session !== editorSession.current) return current;
        if (fingerprint(current) === submittedFingerprint) {
          setSaved(fingerprint(next));
          setIsNew(false);
          setSaveState("saved");
          return next;
        }
        setSaved(fingerprint(next));
        setIsNew(false);
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
          toast.warning(localizeUi("ui.longTermMemory.memoryvault.savedButRejectedSuggestionCouldNotBeRemoved"), {
            duration: 12_000,
          });
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
        toast.error(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotSaveMemory")));
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
      // The toast belongs to the editor session that started the deletion, and also explains a memory it closed.
      if (session !== editorSession.current && !closedOpenMemory) return;
      toast.success(
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
        toast.error(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories")));
        focusFeedback();
      }
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function deleteSection(key: string) {
    if (!draft || draft.type === "source" || busy) return;
    const section = draft.sections[key];
    if (!section) return;
    if (!isNew && Object.keys(draft.sections).length === 1) {
      setError(localizeUi("ui.longTermMemory.memoryvault.finalDetailRequired"));
      return;
    }
    const remove = () => {
      const { [key]: _removed, ...sections } = draft.sections;
      update("sections", sections);
      toast.success(localizeUi("ui.longTermMemory.memoryvault.detailDeleted"));
    };
    if (!section.text.trim()) {
      remove();
      return;
    }
    const session = editorSession.current;
    const confirmed = await confirm(
      props,
      localizeUi("ui.longTermMemory.memoryvault.deleteDetailTitle"),
      localizeUi("ui.longTermMemory.memoryvault.deleteDetailDescription", {
        unsavedWarning: ` ${noteTypeLabel(key)}`,
      }),
      localizeUi("ui.longTermMemory.memoryvault.deleteDetail"),
      true,
    );
    if (!confirmed) return;
    if (session !== editorSession.current) return;
    remove();
  }
  async function renameSection() {
    if (!draft || !renamingSectionKey || draft.type === "source" || busy) return;
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
        warnRecallStale(localizeUi, result.rebuild.error);
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
      toast.success(localizeUi("ui.longTermMemory.memoryvault.detailRenamed"));
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
        const confirmed = await confirm(props, confirmationTitle, confirmationMessage, confirmationLabel, true);
        if (!confirmed) return;
        if (session !== editorSession.current || deleteRevision !== deleteTargetRevision.current) return;
        dismissArchiveToast();
        await deleteSelected(ids);
        return;
      } finally {
        setBusy((current) => (current === "delete" ? "" : current));
      }
    }
    dismissArchiveToast();
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
      setOpenActionNoteId(null);
      setError("");
      // The toast comes after the reload, so the Undo it offers is never pressed while this batch still holds the lock.
      // A failed reload does not undo the batch, so it must not replace the result with an error.
      await refreshAfterBatch(result.affectedNoteIds).catch(() => undefined);
      if (session !== editorSession.current) return;
      if (unresolved.size) toast.warning(message, { duration: 12_000 });
      else if (archiveCompleted && archiveUndoNotes.length === ids.length)
        archiveToastRef.current = toast.success(message, {
          action: {
            label: localizeUi("ui.longTermMemory.memoryvault.undo"),
            onClick: (event) => {
              // Sonner dismisses the toast after onClick unless the event is prevented; a locked Undo keeps it.
              if (undoLocked()) event.preventDefault();
              else void undoArchive(archiveUndoNotes);
            },
          },
          duration: 10_000,
        });
      else toast.success(message);
      focusFeedback();
    } catch (cause) {
      if (session === editorSession.current) {
        toast.error(errorMessage(cause, localizeUi("ui.longTermMemory.memoryvault.couldNotUpdateMemories")));
        focusFeedback();
      }
    } finally {
      setBusy((current) => (current === action ? "" : current));
    }
  }
  async function batch(action: "edit" | "archive" | "delete") {
    await runBatchForIds([...checked], action);
  }
  const busyActionProps = lockedActionProps(Boolean(busy));
  const backup = useVaultBackup({
    props,
    busy: Boolean(busy),
    setBusy,
    // A restore replaces every memory, so the open one and any selection no longer point at stored notes.
    onReplaced: () => {
      clearDraft();
      setChecked(new Set());
      setSelectMode(false);
    },
  });
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
    filterByBranch: (chatId) => {
      setBranchFilter({ contextKey, chatId });
      // The tapped chip leaves with the rest; keep focus in the list's header, on the bar's Show all.
      focusAfterRender("[data-ltm-branch-filter] button");
    },
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
    if (!draft || isNew || busy) return;
    if (dirty) {
      const saveFirst = await confirm(
        props,
        localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameTitle"),
        localizeUi("ui.longTermMemory.memoryvault.saveBeforeRenameDescription"),
        localizeUi("ui.longTermMemory.memoryvault.save"),
      );
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
    if (!draft || !renamingSectionKey || busy) return;
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
      toast.success(localizeUi("ui.longTermMemory.memoryvault.diagnosticsCopied"));
    } catch {
      toast.error(localizeUi("ui.longTermMemory.memoryvault.diagnosticsCopyFailed"));
    }
  };
  const subjectSelectionIds = new Set(
    (draft?.subjects ?? []).map((subject) => (subject.ref ? `${subject.ref.kind}:${subject.ref.id}` : subject.key)),
  );
  const subjectLimit = draft?.type === "character" ? 1 : 2;
  const subjectLimitReached = Boolean(draft) && (draft?.subjects?.length ?? 0) >= subjectLimit;
  const subjectPickerItems: PickerItem[] = pickerTargets.flatMap((target) => {
    if (target.kind !== "character" && target.kind !== "persona" && target.kind !== "local_character") return [];
    const id = `${target.kind}:${target.id}`;
    if (subjectSelectionIds.has(id) || subjectSelectionIds.has(target.id)) return [];
    const kindLabel =
      target.kind === "character"
        ? localizeUi("ui.longTermMemory.memoryvault.character")
        : target.kind === "persona"
          ? localizeUi("ui.longTermMemory.memoryvault.persona")
          : "";
    return [
      {
        id,
        kind: target.kind,
        label: target.label,
        comment: [kindLabel, target.comment].filter(Boolean).join(" · ") || undefined,
      },
    ];
  });
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
    if (!draft || !sectionKey.trim()) return;
    // Focus returns to the name field after the reason renders, so it is read together with the field.
    const refuse = (messageKey: string) => {
      setSectionError(localizeUi(messageKey));
      requestAnimationFrame(() => sectionInputRef.current?.focus());
    };
    if (!key) return refuse("ui.longTermMemory.memoryvault.detailNameNoLetters");
    if (Object.hasOwn(draft.sections, key)) return refuse("ui.longTermMemory.memoryvault.detailNameAlreadyExists");
    setSectionError("");
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
  /** Opens a memory in the List's editor; the Graph is hidden, not unmounted, so the editor keeps its state. */
  const openInEditor = async (noteId: string) => {
    setView("list");
    await openLinkedNote(noteId);
  };
  const openInEditorLinks = async (noteId: string) => {
    await openInEditor(noteId);
    // The editor adopts the memory a moment later (and not at all if the user keeps their unsaved edits).
    let frames = 0;
    let opened = false;
    const reveal = () => {
      if (draftRef.current?.id !== noteId) {
        if (frames++ < 60) requestAnimationFrame(reveal);
        return;
      }
      if (!opened) {
        opened = true;
        setDetailsOpen(true);
        requestAnimationFrame(reveal);
        return;
      }
      const section = vaultRef.current?.querySelector<HTMLDetailsElement>("[data-ltm-linked-memories]");
      if (!section) {
        if (frames++ < 30) requestAnimationFrame(reveal);
        return;
      }
      for (let node: HTMLElement | null = section; node; node = node.parentElement?.closest("details") ?? null) {
        (node as HTMLDetailsElement).open = true;
      }
      section.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    };
    requestAnimationFrame(reveal);
  };
  const [aiCheck, setAiCheck] = useState<LtmAiCheckKind | null>(null);
  const fix = useVaultFix({
    props,
    busy: Boolean(busy),
    setBusy,
    notesById,
    onOpenMemory: (noteId) => void openInEditor(noteId),
    onAiCheck: setAiCheck,
  });
  const listIsEmpty =
    scopeTargetResolved &&
    !scopeTargets.isError &&
    !notes.isLoading &&
    !notes.isError &&
    notes.isSuccess &&
    !visible.length;
  // The empty Vault offers setup in place of New memory until setup is done, so the header button waits too.
  const setupInviteShown = listIsEmpty && !hasFilterableNotes && Boolean(onOpenSetup) && !placeHidesMemories;
  // While that is still unknown, the button waits too, so it does not appear and then vanish.
  const setupInvitePending =
    Boolean(onOpenSetup) && (notes.isLoading || (!scopeTargetResolved && scopeTargets.isLoading));
  return (
    <section
      ref={vaultRef}
      data-ltm-surface="vault"
      data-ltm-vault-view={view}
      className="space-y-4"
      aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryVault")}
    >
      <style>{`
        [data-ltm-surface="vault"][data-ltm-vault-view="graph"] [data-ltm-workspace-container] {
          display: none;
        }
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
            max-height: calc(100vh - 12rem);
            max-height: max(10rem, calc(100dvh - 12rem));
            overflow-y: auto;
          }
        }
      `}</style>
      {error || notice ? (
        <div data-ltm-vault-feedback className="contents">
          {error ? (
            <StatusSurface tone="danger" tabIndex={-1}>
              {error}
            </StatusSurface>
          ) : null}
          {notice ? (
            <StatusSurface tone="success" tabIndex={-1}>
              <span className="min-w-0 flex-1">{notice}</span>
            </StatusSurface>
          ) : null}
        </div>
      ) : null}
      <div data-ltm-vault-header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{localizeUi("ui.longTermMemory.memoryvault.memoryVault")}</h2>
          <p data-ltm-tab-subtitle className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.longtermmemorynavigation.memoriesHint")}
          </p>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {visible.length} {localizeUi("ui.longTermMemory.memoryvault.shown")}
        </span>
        <span className="flex-auto" aria-hidden="true" />
        <div
          role="group"
          aria-label={localizeUi("ui.longTermMemory.memorygraph.view")}
          className="flex items-center gap-1.5"
          data-ltm-vault-view-switch
        >
          <Button chip aria-pressed={view === "list"} onClick={() => setView("list")} data-ltm-vault-view-list>
            <List aria-hidden="true" size="0.875rem" />
            {localizeUi("ui.longTermMemory.memorygraph.list")}
          </Button>
          <Button chip aria-pressed={view === "graph"} onClick={() => setView("graph")} data-ltm-vault-view-graph>
            <Network aria-hidden="true" size="0.875rem" />
            {localizeUi("ui.longTermMemory.memorygraph.graph")}
          </Button>
        </div>
        {setupInviteShown || setupInvitePending ? null : (
          <Button
            onClick={() => {
              // The editor is hidden in Graph view, so a new memory opens in the list view.
              setView("list");
              void startNew();
            }}
            data-ltm-new-memory
          >
            <Plus aria-hidden="true" size="1rem" className="shrink-0" />
            {localizeUi("ui.longTermMemory.memoryvault.newMemory")}
          </Button>
        )}
        <IconButton
          icon={Ellipsis}
          label={localizeUi("ui.longTermMemory.memoryvault.moreVaultActions")}
          aria-expanded={vaultMoreOpen}
          aria-controls={vaultMoreOpen ? "ltm-vault-more-menu" : undefined}
          onClick={() => setVaultMoreOpen((open) => !open)}
          data-ltm-vault-more
        />
        <label className="relative flex min-w-0" style={{ flex: "1 1 14rem", maxWidth: "22rem" }}>
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
      </div>
      {/* One wrapper, so the empty live-region lines of Restore and Fix do not add a gap of their own. */}
      <div className="space-y-2">
        {vaultMoreOpen ? (
          <div id="ltm-vault-more-menu" data-ltm-vault-more-menu className="flex flex-wrap gap-2">
            {backup.buttons}
            <Button data-ltm-vault-tidy onClick={() => setAiCheck("tidy")}>
              <Sparkles aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.whatsnew.tidyTitle")}
            </Button>
            <Button data-ltm-vault-links onClick={() => setAiCheck("links")}>
              <Link2 aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.whatsnew.linkTitle")}
            </Button>
            <Button data-ltm-vault-people onClick={() => setAiCheck("people")}>
              <Users aria-hidden="true" size="0.875rem" />
              {localizeUi("ui.longTermMemory.whatsnew.peopleTitle")}
            </Button>
          </div>
        ) : null}
        {aiCheck ? <TidyDialog kind={aiCheck} onClose={() => setAiCheck(null)} /> : null}
        {backup.panel}
        {fix}
      </div>
      {view === "graph" ? (
        <MemoryGraph
          chatId={props.chatId}
          notes={exampleNotes ?? graphNotes}
          lookupNotes={exampleNotes ?? linkContextNotes}
          example={Boolean(exampleNotes)}
          selectedId={draft && !isNew ? draft.id : null}
          titleOf={(note) => (note ? memoryLabel(note) : "")}
          typeLabel={noteTypeLabel}
          relationLabel={relationLabel}
          memoryLabel={memoryLabel}
          onOpenInEditor={(noteId) => void (exampleNotes || openInEditor(noteId))}
          onOpenLinks={(noteId) => void (exampleNotes || openInEditorLinks(noteId))}
        />
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
                <div data-ltm-memory-scope className="col-span-2 grid min-w-0 max-w-full gap-1">
                  <span className="text-[0.625rem] font-medium text-[var(--marinara-editor-muted)]">
                    {localizeUi("ui.longTermMemory.memoryvault.currentlyViewingMemoriesIn")}
                  </span>
                  {primaryPlaceOptions.length > 1 || scopeTargets.isLoading ? (
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
                  ) : (
                    // One place to look in is not a choice, so it reads as text.
                    <span data-ltm-memory-scope-static className="min-w-0 truncate text-sm">
                      {primaryPlaceOptions[0]!.label}
                    </span>
                  )}
                </div>
                {/* One line: the Filters toggle takes the free width, then the Select and Sources chips. */}
                <div className="col-span-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-ltm-refine
                    data-ltm-tab-focus
                    aria-expanded={refineOpen}
                    aria-controls={refineOpen ? "ltm-vault-filters" : undefined}
                    onClick={() => setRefineOpen(!refineOpen)}
                    className="flex min-h-11 min-w-0 items-center gap-2 text-left text-xs font-semibold"
                    // A real basis, so on a narrow screen the chips wrap below and the summary keeps its width.
                    style={{ flex: "1 1 12rem" }}
                  >
                    <ChevronRight
                      aria-hidden="true"
                      size="0.875rem"
                      className={`shrink-0 transition-transform ${refineOpen ? "rotate-90" : ""}`}
                    />
                    <ListFilter aria-hidden="true" size="0.875rem" className="shrink-0" />
                    <span>{localizeUi("ui.longTermMemory.memoryvault.refine")}</span>
                    {!refineOpen && refineSummary ? (
                      <span
                        data-ltm-refine-active
                        title={refineSummary}
                        className="min-w-0 truncate font-normal text-[var(--muted-foreground)]"
                      >
                        {refineSummary}
                      </span>
                    ) : null}
                  </button>
                  <Button
                    chip
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
                  {sourceNoteCount > 0 || sourceFilter ? (
                    <Button
                      chip
                      onClick={() => setSourceFilter((value) => !value)}
                      aria-pressed={sourceFilter}
                      data-ltm-source-filter
                    >
                      <FileText aria-hidden="true" size="1rem" className="shrink-0" />
                      {localizeUi("ui.longTermMemory.memoryvault.sources", { value1: sourceNoteCount })}
                    </Button>
                  ) : null}
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
                  {selectMode || checked.size ? (
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
                  ) : null}
                </div>
                {refineOpen ? (
                  <div id="ltm-vault-filters" data-ltm-refine-panel className="col-span-2 grid gap-2 pb-1">
                    {/* The two selects share a row only while each has room for its longest option. */}
                    <div
                      className="grid min-w-0 gap-2"
                      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 11rem), 1fr))" }}
                    >
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
                    </div>
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
                    <ModeCheckboxes
                      modes={modes}
                      selected={filterModes}
                      onChange={setFilterModes}
                      labelFor={modeLabel}
                      legend={localizeUi("ui.longTermMemory.memoryvault.availableModes")}
                      className="space-y-1"
                      legendClassName="text-[0.625rem] font-medium text-[var(--marinara-editor-muted)]"
                      textClassName="text-xs"
                      fieldsetProps={{ "data-ltm-mode-filter": true }}
                    />
                  </div>
                ) : null}
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
                {activeBranchFilter && notes.data ? (
                  <StatusSurface data-ltm-branch-filter={activeBranchFilter}>
                    <span className="min-w-0 flex-1">
                      {localizeUi("ui.longTermMemory.memoryvault.branchFilterActive", {
                        value1: activeBranchName ?? localizeUi("ui.longTermMemory.memoryvault.chat"),
                      })}
                    </span>
                    <Button
                      onClick={() => {
                        setBranchFilter(null);
                        // The bar leaves; land on the branch's first chip so keyboard and screen-reader users keep their place.
                        focusAfterRender(`[data-ltm-row-from-branch="${CSS.escape(activeBranchFilter)}"]`);
                      }}
                    >
                      {localizeUi("ui.longTermMemory.memoryvault.branchFilterShowAll")}
                    </Button>
                  </StatusSurface>
                ) : null}
                {navigatorGroups.map(({ type, labelKey, count, shown, nextNoteId }) => {
                  return (
                    <details
                      key={type}
                      // The first group opens by itself so the list is never a column of closed headings.
                      open={deferredSearch.trim() || type === autoOpenGroup.current.type ? true : undefined}
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
                        <Chip className="ml-auto text-[0.625rem]" data-ltm-group-count>
                          {count}
                        </Chip>
                      </summary>
                      {shown.map(({ note, preview: notePreview, originKey }) => (
                        <VaultRow
                          key={note.id}
                          note={note}
                          label={memoryLabel(note)}
                          previewLabel={notePreview?.label}
                          previewText={notePreview?.text}
                          originLabel={originKey ? localizeUi(originKey) : undefined}
                          // While one branch is shown, the bar above names it, so its rows need no button.
                          fromBranchChatId={activeBranchFilter ? undefined : inheritedFrom?.get(note.id)?.chatId}
                          fromBranchText={
                            inheritedFrom?.has(note.id) && !activeBranchFilter
                              ? localizeUi("ui.longTermMemory.memoryvault.fromBranch", {
                                  value1: inheritedFrom.get(note.id)!.name,
                                })
                              : undefined
                          }
                          fromBranchLabel={
                            inheritedFrom?.has(note.id) && !activeBranchFilter
                              ? localizeUi("ui.longTermMemory.memoryvault.fromBranchShowOnly", {
                                  value1: inheritedFrom.get(note.id)!.name,
                                })
                              : undefined
                          }
                          places={rowPlaces(note)}
                          updatedText={rowUpdated(note)}
                          updatedTitle={rowUpdatedTitle(note)}
                          subjectText={rowSubjects(note)}
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
                          <ShowMore className="w-full" onClick={() => showMoreRows(type, shown.length, nextNoteId)}>
                            {localizeUi("ui.longTermMemory.memoryvault.showMoreMemories", {
                              value1: Math.min(vaultGroupRowLimit, count - shown.length),
                            })}
                            {/* Two groups past the cap would otherwise give two buttons the same accessible name. */}
                            <span className="sr-only"> {localizeUi(labelKey)}</span>
                          </ShowMore>
                        </div>
                      ) : null}
                    </details>
                  );
                })}
                {listIsEmpty ? (
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
                    ) : onOpenSetup && !placeHidesMemories ? (
                      <VaultSetupInvite
                        packageVersion={props.packageVersion}
                        onOpenSetup={onOpenSetup}
                        sourceNotes={
                          sourceNoteCount > 0 && !sourceFilter ? (
                            <Button onClick={() => setSourceFilter(true)}>
                              {localizeUi("ui.longTermMemory.memoryvault.showSourceNotes", { value1: sourceNoteCount })}
                            </Button>
                          ) : null
                        }
                      />
                    ) : (
                      <>
                        {/* Never "no memories" while some exist: the place filter says it hides them and Show all lifts it. */}
                        <p>
                          {placeHidesMemories
                            ? localizeUi("ui.longTermMemory.memoryvault.placeHidesMemories", {
                                value1: scopeEntryLabel,
                                value2: memoryPresence?.length ?? 0,
                              })
                            : localizeUi("ui.longTermMemory.memoryvault.noMemoriesYet")}
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {placeHidesMemories ? (
                            <Button onClick={() => void showAllMemories()}>
                              {localizeUi("ui.longTermMemory.memoryvault.showAll")}
                            </Button>
                          ) : null}
                          {sourceNoteCount > 0 && !sourceFilter ? (
                            <Button onClick={() => setSourceFilter(true)}>
                              {localizeUi("ui.longTermMemory.memoryvault.showSourceNotes", { value1: sourceNoteCount })}
                            </Button>
                          ) : null}
                        </div>
                      </>
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
                        {draftOriginKey ? (
                          <Chip className="mt-2 inline-block text-xs" data-ltm-origin-chip>
                            {localizeUi(draftOriginKey)}
                          </Chip>
                        ) : null}
                      </div>
                      {draft.provenance?.kind !== "package_record" && (
                        <Button
                          onClick={() =>
                            void onOpenSources?.(
                              draft.provenance?.kind === "character" || draft.tags.includes("imported_character")
                                ? "characters"
                                : draft.provenance?.kind === "lorebook" || draft.tags.includes("imported_lorebook")
                                  ? "lorebooks"
                                  : draft.provenance?.kind === "chat_transcript"
                                    ? "messages"
                                    : "chats",
                              draft.id,
                            )
                          }
                        >
                          <FileText aria-hidden="true" size="1rem" className="shrink-0" />
                          {localizeUi("ui.longTermMemory.memoryvault.openInSources")}
                        </Button>
                      )}
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
                        <EmptyState>
                          {localizeUi("ui.longTermMemory.memoryvault.noSavedMemoriesLinkToThisSourceYet")}
                        </EmptyState>
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
                          {draftOriginKey ? <Chip data-ltm-origin-chip>{localizeUi(draftOriginKey)}</Chip> : null}
                          {!hasExplicitScope(draft.scope) ? (
                            <Chip>{localizeUi("ui.longTermMemory.memoryvault.availableEverywhere")}</Chip>
                          ) : null}
                          {draft.conflicts?.some((conflict) => conflict.resolution === "pending") ? (
                            <Chip tone="critical">{localizeUi("ui.longTermMemory.memoryvault.conflicts")}</Chip>
                          ) : null}
                          {draft.status === "archived" ? (
                            <Chip>{localizeUi("ui.longTermMemory.memoryvault.archived")}</Chip>
                          ) : null}
                          {Object.values(draft.sections).some((section) =>
                            section.contributions?.some((contribution) => contribution.owner === "manual"),
                          ) ? (
                            <Chip data-ltm-accent-border>
                              {localizeUi("ui.longTermMemory.memoryvault.editedManually")}
                            </Chip>
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
                                  unavailablePlaceLabels,
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
                                <RemovableChip
                                  key={subject.key}
                                  label={subjectLabel(subject)}
                                  onRemove={() =>
                                    update("subjects", draft.subjects?.filter((_, item) => item !== index) ?? [])
                                  }
                                >
                                  {subjectLabel(subject)}
                                </RemovableChip>
                              ))}
                            </div>
                            {!subjectLimitReached ? (
                              <SearchPicker
                                testId="subject"
                                items={subjectPickerItems}
                                placeholder={localizeUi("ui.longTermMemory.memoryvault.chooseSubject")}
                                emptyLabel={localizeUi("ui.longTermMemory.memoryvault.noSubjectTargets")}
                                clearLabel={localizeUi("ui.longTermMemory.memoryvault.clearTargetSearch")}
                                onSelect={(item) => {
                                  const target = pickerTargets.find(
                                    (candidate) => `${candidate.kind}:${candidate.id}` === item.id,
                                  );
                                  if (target) selectSubjectTarget(target);
                                }}
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
                              <Button
                                ref={addSectionButtonRef}
                                onClick={() => {
                                  setSectionError("");
                                  setAddingSection(true);
                                }}
                              >
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
                                  ref={sectionInputRef}
                                  autoFocus
                                  className={inputClass}
                                  value={sectionKey}
                                  onChange={(event) => {
                                    setSectionKey(event.target.value);
                                    setSectionError("");
                                  }}
                                  placeholder={localizeUi("ui.longTermMemory.memoryvault.detailNameExample")}
                                  aria-label={localizeUi("ui.longTermMemory.memoryvault.newSectionName")}
                                  aria-invalid={sectionError ? true : undefined}
                                  aria-describedby={
                                    sectionError ? "ltm-new-section-error ltm-new-section-key" : "ltm-new-section-key"
                                  }
                                />
                                <span id="ltm-new-section-key" className="block text-[var(--muted-foreground)]">
                                  {localizeUi("ui.longTermMemory.memoryvault.storedKey")}:{" "}
                                  {normalizeDetailName(sectionKey) ||
                                    localizeUi("ui.longTermMemory.memoryvault.notSet")}
                                </span>
                                {sectionError ? (
                                  <span id="ltm-new-section-error" className="block text-[var(--destructive)]">
                                    {sectionError}
                                  </span>
                                ) : null}
                              </label>
                              <Button onClick={addSection} disabled={!sectionKey.trim()}>
                                <Plus aria-hidden="true" size="1rem" className="shrink-0" />
                                {localizeUi("ui.longTermMemory.memoryvault.addSection")}
                              </Button>
                              <Button
                                onClick={() => {
                                  setAddingSection(false);
                                  setSectionKey("");
                                  setSectionError("");
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
                                      {...busyActionProps}
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
                                  placeholder={localizeUi("ui.longTermMemory.memoryvault.addDurableContextHere")}
                                  aria-invalid={emptyDetailInvalid(section.text)}
                                  aria-describedby={
                                    emptyDetailInvalid(section.text) ? `ltm-section-${key}-error` : undefined
                                  }
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
                                {emptyDetailInvalid(section.text) ? (
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
                                        <RemovableChip
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
                                        </RemovableChip>
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
                                        disabled={isNew}
                                        {...busyActionProps}
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
                                  <LinkedMemories
                                    outgoing={outgoingLinks}
                                    extractedFrom={draft.links.filter((link) => link.relation === "extracted_from")}
                                    incoming={incomingLinks}
                                    notesById={notesById}
                                    memoryLabel={memoryLabel}
                                    relationLabel={relationLabel}
                                    onOpen={(noteId) => void openLinkedNote(noteId)}
                                    onRemove={(link) =>
                                      update(
                                        "links",
                                        draft.links.filter((candidate) => candidate !== link),
                                      )
                                    }
                                  />
                                  <div data-ltm-inspector-fields className="grid gap-2">
                                    {linkTarget ? (
                                      <RemovableChip
                                        removeLabel={localizeUi("ui.longTermMemory.memoryvault.clearLinkTarget")}
                                        onRemove={() => {
                                          flushSync(() => setLinkTarget(""));
                                          document
                                            .querySelector<HTMLInputElement>('[data-ltm-picker-search="link"]')
                                            ?.focus();
                                        }}
                                        data-ltm-link-target={linkTarget}
                                      >
                                        {memoryLabel(notesById.get(linkTarget))}
                                      </RemovableChip>
                                    ) : (
                                      <SearchPicker
                                        testId="link"
                                        items={linkPickerItems}
                                        placeholder={localizeUi("ui.longTermMemory.memoryvault.searchMemoryToLink")}
                                        emptyLabel={localizeUi("ui.longTermMemory.memoryvault.noMatchingMemories")}
                                        clearLabel={localizeUi("ui.longTermMemory.memoryvault.clearTargetSearch")}
                                        onSelect={(item) => {
                                          flushSync(() => setLinkTarget(item.id));
                                          document
                                            .querySelector<HTMLSelectElement>("[data-ltm-link-relation]")
                                            ?.focus();
                                        }}
                                      />
                                    )}
                                    <select
                                      className={inputClass}
                                      value={linkRelation}
                                      aria-label={localizeUi("ui.longTermMemory.memorysettings.relationship")}
                                      data-ltm-link-relation
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
                                    <Button onClick={addLink} disabled={!linkTarget}>
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
                                      {localizeUi("ui.longTermMemory.memoryvault.history")}
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
                                        localizeUi("ui.longTermMemory.memoryvault.noHistory")
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
        <UnsavedChangesDialog
          description={localizeUi("ui.longTermMemory.memoryvault.unsavedNavigationDescription")}
          onDecision={finishUnsavedDecision}
        />
      ) : null}
      {renamingSectionKey ? (
        <dialog
          ref={renameDialogRef}
          aria-modal="true"
          aria-labelledby="ltm-rename-detail-title"
          onCancel={(event) => {
            event.preventDefault();
            // Like the locked Cancel button, Escape keeps the dialog open while the rename runs.
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
                  if (busy) return;
                  setRenamingSectionKey(null);
                  setRenamedSectionKey("");
                  setRenamePreview(null);
                }}
                {...busyActionProps}
              >
                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
              </Button>
              <Button onClick={() => void previewRename()} disabled={!renamedSectionKey.trim()} {...busyActionProps}>
                {localizeUi("ui.longTermMemory.memoryvault.previewRename")}
              </Button>
              <Button
                primary
                onClick={() => void renameSection()}
                disabled={!renamedSectionKey.trim()}
                {...busyActionProps}
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
