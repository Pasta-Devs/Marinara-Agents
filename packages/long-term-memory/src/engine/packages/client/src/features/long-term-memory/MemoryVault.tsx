import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronRight,
  Ellipsis,
  Link2,
  PanelRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  LtmBulkNoteResult,
  LtmLink,
  LtmMode,
  LtmNote,
  LtmNoteType,
  LtmScope,
  LtmSourceDerivedMemoriesResponse,
  LtmStatus,
  LtmSubject,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  invalidateLtmQueries,
  queryKeys,
  request,
  requestAllNotes,
} from "./api";
import {
  Button,
  ClickSurface,
  IconButton,
  InfoPopover,
  inputClass,
  NumberField,
  StatusSurface,
} from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";
import {
  humanizeLabel,
  memoryLabel,
  noteTypeLabel,
  scopeTargetLabel,
} from "./display-labels";
import {
  selectLtmPluralForm,
  useLtmTranslation,
  type LtmTranslationFunction,
} from "./localization";

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
const statuses: readonly LtmStatus[] = ["active", "resolved", "archived"];
const modes: readonly LtmMode[] = ["conversation", "roleplay", "game"];
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

type ScopeTargets = {
  currentScope: LtmScope | null;
  chats: Array<{
    id: string;
    label: string;
    mode: LtmMode;
    groupId: string | null;
  }>;
  groups: Array<{ id: string; label: string; chatIds: string[] }>;
  characters: Array<{ id: string; label: string }>;
};
type Target = { id: string; label: string; scope?: LtmScope };
type NoteResponse = { note: LtmNote };
type RemoveCurrentChatResponse = {
  deleted: boolean;
  unscoped: boolean;
  note?: LtmNote;
};

const sessionTargets = new Map<string, Target>();

function fingerprint(note: LtmNote | null) {
  return note ? JSON.stringify(note) : "";
}
function hasExplicitScope(scope: LtmScope) {
  return Boolean(
    scope.chatId ||
    scope.chatIds?.length ||
    scope.groupId ||
    scope.characterIds?.length ||
    scope.personaId,
  );
}
function list(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function searchable(note: LtmNote) {
  return [
    note.id,
    note.title,
    note.type,
    note.status,
    ...note.tags,
    ...note.keywords,
    ...Object.values(note.sections).map((section) => section.text),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}
function preview(note: LtmNote, search: string) {
  const sections = Object.entries(note.sections).filter(([, section]) =>
    section.text.trim(),
  );
  const query = search.trim().toLocaleLowerCase();
  const selected =
    sections.find(([, candidate]) =>
      candidate.text.toLocaleLowerCase().includes(query),
    ) ?? sections[0];
  if (!selected) return null;
  const [key, section] = selected;
  const text = section.text.trim();
  const match = query ? text.toLocaleLowerCase().indexOf(query) : -1;
  const start = match > 60 ? match - 60 : 0;
  return {
    label: noteTypeLabel(key),
    text: `${start ? "..." : ""}${text.slice(start, start + 180)}${start + 180 < text.length ? "..." : ""}`,
  };
}
function newNote(scope: LtmScope, localizeUi: LtmTranslationFunction): LtmNote {
  const now = new Date().toISOString();
  return {
    id: `world_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
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

function recoveredNote(
  handoff: NonNullable<LongTermMemoryDestinationProps["recoveryHandoff"]>,
  localizeUi: LtmTranslationFunction,
): LtmNote {
  const note = newNote(handoff.scope, localizeUi);
  const recovery = handoff.candidate.recovery;
  const type =
    recovery?.noteType && recovery.noteType !== "source"
      ? recovery.noteType
      : note.type;
  const id = `${prefixes[type]}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const sectionKey = recovery?.sectionKey ?? "facts";
  const suggestedTitle = (recovery?.noteId ?? id)
    .replace(new RegExp(`^${prefixes[type]}_?`), "")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
  const now = new Date().toISOString();
  return {
    ...note,
    id,
    title:
      suggestedTitle ||
      localizeUi("ui.longTermMemory.memoryvault.recoveredMemory"),
    type,
    status: recovery?.status ?? note.status,
    modes: handoff.modes,
    scope: handoff.scope,
    sections: {
      [sectionKey]: {
        text: handoff.candidate.snippet ?? "",
        updatedAt: now,
      },
    },
  };
}

function Pill({
  children,
  label,
  onRemove,
}: {
  children: ReactNode;
  label?: string;
  onRemove: () => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md bg-[var(--secondary)] px-2 text-xs text-[var(--foreground)]">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={localizeUi("ui.longTermMemory.pill.removeValue1", {
          value1: label ?? String(children),
        })}
        className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-[var(--accent)]"
      >
        <X size="0.75rem" />
      </button>
    </span>
  );
}

function TokenEditor({
  label,
  values,
  placeholder,
  displayValue = (value) => value,
  help,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  displayValue?: (value: string) => string;
  help?: ReactNode;
  onChange: (next: string[]) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const [value, setValue] = useState("");
  const add = () => {
    const next = list(value).filter((item) => !values.includes(item));
    if (next.length) onChange([...values, ...next]);
    setValue("");
  };
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1 text-xs font-medium">
        {label}
        {help ? <InfoPopover label={label} content={help} /> : null}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {values.map((item) => (
          <Pill
            key={item}
            label={displayValue(item)}
            onRemove={() => onChange(values.filter((value) => value !== item))}
          >
            {displayValue(item)}
          </Pill>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button onClick={add} disabled={!value.trim()}>
          <Plus size="0.75rem" />
          {localizeUi("ui.longTermMemory.tokeneditor.add")}
        </Button>
      </div>
    </section>
  );
}

export default function MemoryVault({
  props,
  onDirtyChange,
  onOpenReview,
  openedNoteId,
  createMemoryRequest,
  onCreateMemoryRequestHandled,
  recoveryHandoff,
}: LongTermMemoryDestinationProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const client = useQueryClient();
  const detailRef = useRef<HTMLElement>(null);
  const scopePickerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [activeTargetIndex, setActiveTargetIndex] = useState(0);
  const contextKey = props.chatId ?? "__global__";
  const [target, setTarget] = useState<Target | null>(
    () => sessionTargets.get(contextKey) ?? null,
  );
  const targetContextKey = useRef(contextKey);
  const [statusFilter, setStatusFilter] = useState<LtmStatus | "all">("all");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [mobilePane, setMobilePane] = useState<
    "memories" | "editor" | "details"
  >("memories");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState<LtmNote | null>(null);
  const [saved, setSaved] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bulkStatus, setBulkStatus] = useState<LtmStatus>("active");
  const [bulkModes, setBulkModes] = useState<LtmMode[]>(["roleplay"]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const [openActionNoteId, setOpenActionNoteId] = useState<string | null>(null);
  const [retractExtracted, setRetractExtracted] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkRelation, setLinkRelation] =
    useState<LtmLink["relation"]>("involves");
  const [subjectKey, setSubjectKey] = useState("");
  const [sectionKey, setSectionKey] = useState("");
  const editorSession = useRef(0);
  const noteLoadSession = useRef(0);

  const scopeTargets = useQuery({
    queryKey: queryKeys.scopeTargets(props.chatId),
    queryFn: () =>
      request<ScopeTargets>(
        `/scope-targets${props.chatId ? `?chatId=${encodeURIComponent(props.chatId)}` : ""}`,
      ),
  });
  useEffect(() => {
    if (!target && props.chatId)
      setTarget({
        id: `chat:${props.chatId}`,
        label:
          props.chatName ??
          localizeUi("ui.longTermMemory.memoryvault.currentChat"),
        scope: { chatId: props.chatId, chatIds: [props.chatId] },
      });
  }, [localizeUi, props.chatId, props.chatName, target]);
  useEffect(() => {
    if (props.chatId && !target && scopeTargets.data?.currentScope)
      setTarget({
        id: "current",
        label:
          props.chatName ??
          localizeUi("ui.longTermMemory.memoryvault.currentChat"),
        scope: scopeTargets.data.currentScope,
      });
  }, [localizeUi, props.chatId, scopeTargets.data, target, props.chatName]);
  useEffect(() => {
    if (!target && !props.chatId && scopeTargets.isSuccess)
      setTarget({
        id: "all",
        label: localizeUi("ui.longTermMemory.memoryvault.allMemories"),
      });
  }, [localizeUi, props.chatId, scopeTargets.isSuccess, target]);
  useEffect(() => {
    if (target && targetContextKey.current === contextKey)
      sessionTargets.set(contextKey, target);
  }, [contextKey, target]);
  useEffect(() => {
    setTarget((current) =>
      current?.id === `chat:${props.chatId}`
        ? {
            ...current,
            label:
              props.chatName ??
              localizeUi("ui.longTermMemory.memoryvault.currentChat"),
          }
        : current,
    );
  }, [localizeUi, props.chatId, props.chatName]);
  useEffect(() => {
    editorSession.current += 1;
    noteLoadSession.current += 1;
    targetContextKey.current = contextKey;
    setTarget(
      sessionTargets.get(contextKey) ??
        (props.chatId
          ? {
              id: `chat:${props.chatId}`,
              label:
                props.chatName ??
                localizeUi("ui.longTermMemory.memoryvault.currentChat"),
              scope: { chatId: props.chatId, chatIds: [props.chatId] },
            }
          : null),
    );
    setDraft(null);
    setSaved("");
    setIsNew(false);
    setBusy("");
    setError("");
    setNotice("");
    setDeleteIds(null);
    setOpenActionNoteId(null);
    setRetractExtracted(false);
    setDetailsOpen(false);
    setTargetSearch("");
    setTargetsOpen(false);
    setLinkTarget("");
    setLinkRelation("involves");
    setSubjectKey("");
    setSectionKey("");
    setChecked(new Set());
    setMobilePane("memories");
    // Context switches are the only reset boundary. Dedicated effects above
    // update chat labels without discarding an open draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);
  useEffect(() => {
    if (
      target?.id === `chat:${props.chatId}` &&
      scopeTargets.data?.currentScope
    ) {
      setTarget((current) =>
        current
          ? { ...current, scope: scopeTargets.data!.currentScope! }
          : current,
      );
    }
  }, [props.chatId, scopeTargets.data, target?.id]);
  const notes = useQuery({
    queryKey: [...queryKeys.notes, contextKey, target?.id, target?.scope],
    enabled: Boolean(target) && targetContextKey.current === contextKey,
    queryFn: () =>
      requestAllNotes<LtmNote>(
        `/notes?${new URLSearchParams({
          ...(target?.scope?.chatIds?.length
            ? { scopeChatIds: target.scope.chatIds.join(",") }
            : {}),
          ...(target?.scope?.groupId
            ? { scopeGroupId: target.scope.groupId }
            : {}),
          ...(target?.scope?.characterIds?.length
            ? { scopeCharacterIds: target.scope.characterIds.join(",") }
            : {}),
          ...(target?.scope?.personaId
            ? { scopePersonaId: target.scope.personaId }
            : {}),
          ...(target?.scope ? { includeGlobal: "false" } : {}),
        })}`,
      ),
  });
  const allNotes = [...(notes.data ?? [])].sort((left, right) =>
    (left.title ?? left.id).localeCompare(right.title ?? right.id),
  );
  const visible = allNotes.filter(
    (note) =>
      (statusFilter === "all" || note.status === statusFilter) &&
      (!search.trim() ||
        searchable(note).includes(search.trim().toLocaleLowerCase())),
  );
  const hiddenChecked = [...checked].filter(
    (id) => !visible.some((note) => note.id === id),
  ).length;
  const dirty = Boolean(draft) && fingerprint(draft) !== saved;
  const sourceDerivedQuery = useQuery({
    queryKey: [...queryKeys.notes, "source-derived", draft?.id],
    enabled: draft?.type === "source" && !isNew,
    queryFn: () =>
      request<LtmSourceDerivedMemoriesResponse>(
        `/notes/${encodeURIComponent(draft!.id)}/derived`,
      ),
  });
  const sourceDerived = sourceDerivedQuery.data?.memories ?? [];
  const targets: Target[] = [
    {
      id: "all",
      label: localizeUi("ui.longTermMemory.memoryvault.allMemories"),
    },
    ...(props.chatId
      ? [
          {
            id: `chat:${props.chatId}`,
            label:
              props.chatName ??
              localizeUi("ui.longTermMemory.memoryvault.currentChat"),
            scope: { chatId: props.chatId, chatIds: [props.chatId] },
          },
        ]
      : []),
    ...(scopeTargets.data?.chats ?? []).map((chat) => ({
      id: `chat:${chat.id}`,
      label: chat.label,
      scope: { chatId: chat.id, chatIds: [chat.id] },
    })),
    ...(scopeTargets.data?.groups ?? []).map((group) => ({
      id: `group:${group.id}`,
      label: localizeUi("ui.longTermMemory.memoryvault.groupBranches", {
        group: group.label,
      }),
      scope: { groupId: group.id, chatIds: group.chatIds },
    })),
    ...(scopeTargets.data?.characters ?? []).map((character) => ({
      id: `character:${character.id}`,
      label:
        character.label === character.id
          ? localizeUi("ui.longTermMemory.memoryvault.character")
          : localizeUi("ui.longTermMemory.memoryvault.characterWithName", {
              character: character.label,
            }),
      scope: { characterIds: [character.id] },
    })),
  ].filter(
    (candidate, index, items) =>
      items.findIndex((item) => item.id === candidate.id) === index,
  );
  const matchingTargets = targets.filter((candidate) =>
    candidate.label
      .toLocaleLowerCase()
      .includes(targetSearch.toLocaleLowerCase()),
  );
  const referenceLabel = (value: string) => {
    const [kind, id] = value.split(/:(.+)/, 2);
    if (!id) return humanizeLabel(value);
    if (kind === "source_note")
      return (
        allNotes.find((note) => note.id === id)?.title?.trim() ||
        "Source memory"
      );
    if (kind === "character") return scopeTargetLabel("character", id, targets);
    if (kind === "persona") return scopeTargetLabel("persona", id, targets);
    if (kind === "chat") return scopeTargetLabel("chat", id, targets);
    return humanizeLabel(kind);
  };
  const subjectLabel = (subject: LtmSubject) => {
    if (subject.ref)
      return scopeTargetLabel(subject.ref.kind, subject.ref.id, targets);
    return referenceLabel(subject.key);
  };
  const provenanceSourceLabel = () => {
    if (!draft?.provenance) return "";
    if (draft.provenance.kind === "character")
      return scopeTargetLabel("character", draft.provenance.sourceId, targets);
    if (draft.provenance.kind === "chat_summary")
      return scopeTargetLabel("chat", draft.provenance.sourceId, targets);
    return "Lorebook";
  };

  useEffect(() => setActiveTargetIndex(0), [targetSearch]);
  useEffect(() => {
    if (!targetsOpen) return;
    const closeScopePicker = (event: PointerEvent) => {
      if (!scopePickerRef.current?.contains(event.target as Node))
        setTargetsOpen(false);
    };
    document.addEventListener("pointerdown", closeScopePicker);
    return () => document.removeEventListener("pointerdown", closeScopePicker);
  }, [targetsOpen]);

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
        if (
          loadSession !== noteLoadSession.current ||
          requestContext !== targetContextKey.current
        )
          return;
        return openNote(note, requestContext);
      })
      .catch(() => {
        if (
          loadSession === noteLoadSession.current &&
          requestContext === targetContextKey.current
        )
          setError(
            localizeUi(
              "ui.longTermMemory.memoryvault.requestedMemoryUnavailable",
            ),
          );
      });
  }, [openedNoteId, contextKey]);
  useEffect(() => {
    if (!recoveryHandoff) return;
    const next = recoveredNote(recoveryHandoff, localizeUi);
    setDraft(next);
    setSaved("");
    setIsNew(true);
    setError("");
    setNotice(
      localizeUi("ui.longTermMemory.memoryvault.reviewRecoveredSuggestion"),
    );
    setMobilePane("editor");
  }, [recoveryHandoff?.key]);
  useEffect(() => {
    if (deleteIds) {
      const dialog = deleteDialogRef.current;
      if (!dialog) return;
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      dialog.querySelector<HTMLElement>("[data-ltm-delete-cancel]")?.focus();
      return;
    }
    if (busy) return;
    const trigger = deleteTriggerRef.current;
    if (!trigger) return;
    if (trigger.isConnected) trigger.focus();
    else detailRef.current?.focus();
    deleteTriggerRef.current = null;
  }, [busy, deleteIds]);
  async function confirm(next: string) {
    if (!dirtyRef.current) return true;
    const options = {
      title: localizeUi(
        "ui.longTermMemory.memoryvault.discardUnsavedMemoryChanges",
      ),
      message: localizeUi(
        "ui.longTermMemory.memoryvault.changesLostBeforeAction",
        { action: next },
      ),
      confirmLabel: localizeUi(
        "ui.longTermMemory.longtermmemorydetail.discardChanges",
      ),
      tone: "destructive" as const,
    };
    return props.confirmAction
      ? await props.confirmAction(options)
      : window.confirm(
          localizeUi(
            "ui.longTermMemory.longtermmemorydetail.confirmationWithMessage",
            { title: options.title, message: options.message },
          ),
        );
  }
  async function selectTarget(next: Target) {
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.openingTarget", {
          target: next.label,
        }),
      ))
    )
      return;
    editorSession.current += 1;
    noteLoadSession.current += 1;
    setTarget(next);
    setTargetSearch("");
    setTargetsOpen(false);
    setDraft(null);
    setChecked(new Set());
    setSaved("");
    setIsNew(false);
    setLinkTarget("");
    setLinkRelation("involves");
    setSubjectKey("");
    setSectionKey("");
    setMobilePane("memories");
  }
  async function openNote(
    note: LtmNote,
    expectedContextKey = targetContextKey.current,
  ) {
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
    setSaved(fingerprint(next));
    setIsNew(false);
    setLinkTarget("");
    setLinkRelation("involves");
    setSubjectKey("");
    setSectionKey("");
    setError("");
    setNotice("");
    setDetailsOpen(false);
    setMobilePane("editor");
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      }),
    );
  }
  async function startNew() {
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.creatingNewMemory"),
      ))
    )
      return;
    const next = newNote(target?.scope ?? {}, localizeUi);
    editorSession.current += 1;
    setDraft(next);
    setSaved("");
    setIsNew(true);
    setLinkTarget("");
    setLinkRelation("involves");
    setSubjectKey("");
    setSectionKey("");
    setDetailsOpen(false);
    setMobilePane("editor");
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
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
    if (
      !(await confirm(
        localizeUi("ui.longTermMemory.memoryvault.closingThisMemory"),
      ))
    )
      return;
    editorSession.current += 1;
    setDraft(null);
    setSaved("");
    setIsNew(false);
    setLinkTarget("");
    setLinkRelation("involves");
    setSubjectKey("");
    setSectionKey("");
    setMobilePane("memories");
  }
  async function invalidate() {
    await invalidateLtmQueries(client, [
      queryKeys.notes,
      queryKeys.status,
      queryKeys.activity,
    ]);
  }
  async function save() {
    if (!draft || !draft.title?.trim()) {
      setError(localizeUi("ui.longTermMemory.memoryvault.memoryTitleRequired"));
      return;
    }
    const savedNote = saved ? (JSON.parse(saved) as LtmNote) : null;
    if (
      !isNew &&
      savedNote &&
      hasExplicitScope(savedNote.scope) &&
      !hasExplicitScope(draft.scope)
    ) {
      setError(
        localizeUi(
          "ui.longTermMemory.memoryvault.clearingEveryScopeWouldMakeGlobal",
        ),
      );
      return;
    }
    const session = editorSession.current;
    const submittedFingerprint = fingerprint(draft);
    setBusy("save");
    setError("");
    try {
      const response = isNew
        ? await request<
            NoteResponse,
            Omit<LtmNote, "createdAt" | "updatedAt" | "version">
          >(
            "/notes",
            "POST",
            (({ createdAt, updatedAt, version, ...note }) => note)(draft),
          )
        : await request<NoteResponse, Partial<LtmNote>>(
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
            }) => (draft.type === "source" ? note : { ...note, sections }))(
              draft,
            ),
          );
      const next = structuredClone(response.note);
      if (session !== editorSession.current) return;
      setDraft((current) => {
        if (session !== editorSession.current) return current;
        if (fingerprint(current) === submittedFingerprint) {
          setSaved(fingerprint(next));
          setIsNew(false);
          setNotice(localizeUi("ui.longTermMemory.memoryvault.memorySaved"));
          return next;
        }
        setSaved(fingerprint(next));
        setIsNew(false);
        setNotice(
          localizeUi(
            "ui.longTermMemory.memoryvault.memorySavedNewerEditsUnsaved",
          ),
        );
        return current
          ? {
              ...current,
              id: next.id,
              type: next.type,
              createdAt: next.createdAt,
              updatedAt: next.updatedAt,
              version: next.version,
              ...(next.provenance ? { provenance: next.provenance } : {}),
              ...(next.extractionFingerprint
                ? { extractionFingerprint: next.extractionFingerprint }
                : {}),
            }
          : current;
      });
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi("ui.longTermMemory.memoryvault.couldNotSaveMemory"),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function deleteSelected(ids: string[], retract = false) {
    const session = editorSession.current;
    setBusy("delete");
    try {
      const result = await request<{ deletedIds: string[] }>(
        "/notes/permanent-delete",
        "POST",
        { ids, retractExtracted: retract },
      );
      if (session !== editorSession.current) return;
      setChecked((current) => {
        const next = new Set(current);
        result.deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteIds(null);
      setOpenActionNoteId(null);
      if (draft && result.deletedIds.includes(draft.id)) {
        setDraft(null);
        setSaved("");
        setMobilePane("memories");
      }
      setNotice(
        localizeUi(
          selectLtmPluralForm(locale, result.deletedIds.length) === "one"
            ? "ui.longTermMemory.memoryvault.memoryDeletedOne"
            : "ui.longTermMemory.memoryvault.memoryDeletedOther",
          { count: result.deletedIds.length },
        ),
      );
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi(
                "ui.longTermMemory.memoryvault.couldNotUpdateMemories",
              ),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function runBatchForIds(
    ids: string[],
    action: "status" | "modes" | "archive" | "delete",
    options?: { preserveSelection?: boolean },
  ) {
    if (!ids.length) return;
    const session = editorSession.current;
    const includesSource = ids.some(
      (id) => allNotes.find((note) => note.id === id)?.type === "source",
    );
    if (action === "delete" && includesSource) {
      deleteTriggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setRetractExtracted(false);
      setDeleteIds(ids);
      return;
    }
    if (
      action === "delete" &&
      !(props.confirmAction
        ? await props.confirmAction({
            title: localizeUi(
              "ui.longTermMemory.memoryvault.permanentlyDeleteSelectedMemories",
            ),
            message: localizeUi(
              "ui.longTermMemory.memoryvault.thisCannotBeUndone",
            ),
            confirmLabel: localizeUi(
              "ui.longTermMemory.memoryvault.deletePermanently",
            ),
            tone: "destructive",
          })
        : window.confirm(
            localizeUi(
              "ui.longTermMemory.memoryvault.permanentlyDeleteSelectedMemories",
            ),
          ))
    )
      return;
    if (action === "delete") {
      await deleteSelected(ids);
      return;
    }
    setBusy(action);
    try {
      const result = await request<LtmBulkNoteResult>("/notes/batch", "POST", {
        noteIds: ids,
        ...(action === "archive" ? { archive: "notes_only" } : {}),
        ...(action === "status" ? { status: bulkStatus } : {}),
        ...(action === "modes" ? { modes: bulkModes } : {}),
      });
      if (session !== editorSession.current) return;
      const unresolved = new Set([
        ...result.skippedNoteIds,
        ...result.failedNoteIds,
      ]);
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
      const updatedForm = selectLtmPluralForm(
        locale,
        result.updatedNoteIds.length,
      );
      const message = localizeUi(
        unresolved.size
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
        },
      );
      setOpenActionNoteId(null);
      if (unresolved.size) {
        setNotice("");
        setError(message);
      } else {
        setNotice(message);
        setError("");
      }
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi(
                "ui.longTermMemory.memoryvault.couldNotUpdateMemories",
              ),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  async function batch(action: "status" | "modes" | "archive" | "delete") {
    await runBatchForIds([...checked], action);
  }
  const runNoteAction = async (
    event: { preventDefault: () => void; stopPropagation: () => void },
    note: LtmNote,
    action: "archive" | "delete",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenActionNoteId(null);
    await runBatchForIds([note.id], action, { preserveSelection: true });
  };

  const toggleNoteActions = (
    event: { preventDefault: () => void; stopPropagation: () => void },
    noteId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setOpenActionNoteId((current) => (current === noteId ? null : noteId));
  };
  async function removeFromCurrentChat() {
    if (!draft || !props.chatId) return;
    const session = editorSession.current;
    const unsavedWarning = dirty
      ? localizeUi("ui.longTermMemory.memoryvault.unsavedEditsWillAlsoBeLost")
      : "";
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: dirty
            ? localizeUi(
                "ui.longTermMemory.memoryvault.removeMemoryAndDiscardEdits",
              )
            : localizeUi(
                "ui.longTermMemory.memoryvault.removeMemoryFromThisChat",
              ),
          message: localizeUi(
            "ui.longTermMemory.memoryvault.removeFromChatDescription",
            { unsavedWarning },
          ),
          confirmLabel: localizeUi(
            "ui.longTermMemory.memoryvault.removeFromChat",
          ),
          tone: "destructive",
        })
      : window.confirm(
          localizeUi(
            "ui.longTermMemory.memoryvault.removeThisMemoryFromTheCurrentChatItWill",
            { value1: unsavedWarning },
          ),
        );
    if (!confirmed) return;
    setBusy("remove-current-chat");
    setError("");
    try {
      const result = await request<
        RemoveCurrentChatResponse,
        { chatId: string }
      >(`/notes/${encodeURIComponent(draft.id)}/scope/current-chat`, "DELETE", {
        chatId: props.chatId,
      });
      if (session !== editorSession.current) return;
      if (result.deleted) {
        setDraft(null);
        setSaved("");
        setMobilePane("memories");
        setNotice(
          localizeUi("ui.longTermMemory.memoryvault.memoryRemovedAndDeleted"),
        );
      } else if (result.note) {
        const next = structuredClone(result.note);
        setDraft(next);
        setSaved(fingerprint(next));
        setNotice(
          result.unscoped
            ? localizeUi(
                "ui.longTermMemory.memoryvault.memoryRemovedFromThisChat",
              )
            : localizeUi(
                "ui.longTermMemory.memoryvault.memoryNotLinkedToThisChat",
              ),
        );
      }
      await invalidate();
    } catch (cause) {
      if (session === editorSession.current)
        setError(
          cause instanceof Error
            ? cause.message
            : localizeUi(
                "ui.longTermMemory.memoryvault.couldNotRemoveMemoryFromChat",
              ),
        );
    } finally {
      if (session === editorSession.current) setBusy("");
    }
  }
  const update = <K extends keyof LtmNote>(key: K, value: LtmNote[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const mutateScope = (patch: Partial<LtmScope>) =>
    update("scope", { ...(draft?.scope ?? {}), ...patch });
  const removeScope = (key: "chatIds" | "characterIds", id: string) => {
    if (!draft) return;
    const values = (draft.scope[key] ?? []).filter((value) => value !== id);
    const next = { ...draft.scope, [key]: values.length ? values : undefined };
    if (key === "chatIds") next.chatId = values[0];
    update("scope", next);
  };
  const addSection = () => {
    const key = sectionKey
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!draft || !key || draft.sections[key]) return;
    update("sections", {
      ...draft.sections,
      [key]: {
        text: localizeUi("ui.longTermMemory.memoryvault.newMemorySection"),
        updatedAt: new Date().toISOString(),
      },
    });
    setSectionKey("");
  };
  const addLink = () => {
    if (
      !draft ||
      !linkTarget.trim() ||
      linkTarget.trim() === draft.id ||
      draft.links.some(
        (link) =>
          link.target === linkTarget.trim() && link.relation === linkRelation,
      )
    )
      return;
    update("links", [
      ...draft.links,
      { target: linkTarget.trim(), relation: linkRelation },
    ]);
    setLinkTarget("");
  };
  const openLinkedNote = async (noteId: string) => {
    try {
      const note =
        allNotes.find((candidate) => candidate.id === noteId) ??
        (await request<LtmNote>(`/notes/${encodeURIComponent(noteId)}`));
      await openNote(note);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi(
              "ui.longTermMemory.memoryvault.linkedMemoryCouldNotLoad",
            ),
      );
    }
  };
  const addSubject = () => {
    if (
      !draft ||
      !subjectKey.trim() ||
      !(draft.type === "character" || draft.type === "relationship")
    )
      return;
    const subjects = [
      ...(draft.subjects ?? []),
      { key: subjectKey.trim() },
    ].sort((left, right) => left.key.localeCompare(right.key));
    if (subjects.length <= (draft.type === "character" ? 1 : 2))
      update("subjects", subjects);
    setSubjectKey("");
  };

  return (
    <section
      data-ltm-surface="vault"
      className="space-y-4"
      aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryVault")}
    >
      <style>{`
        [data-ltm-note-inspector] [data-ltm-inspector-tokens],
        [data-ltm-note-inspector] [data-ltm-inspector-fields] {
          grid-template-columns: minmax(0, 1fr);
        }
        @container ltm-destination (min-width: 64rem) {
          [data-ltm-surface="vault"] {
            display: grid;
            grid-template-columns: minmax(17rem, 20rem) minmax(0, 1fr);
            grid-template-areas:
              "controls workbench"
              "bulk workbench"
              "list workbench"
              "feedback feedback";
            align-items: start;
            gap: 1rem;
          }
          [data-ltm-vault-feedback] {
            grid-area: feedback;
            display: block;
          }
          [data-ltm-browser-controls] {
            grid-area: controls;
          }
          [data-ltm-bulk-actions] {
            grid-area: bulk;
          }
          [data-ltm-vault-workspace] {
            display: contents;
          }
          [data-ltm-memory-list] {
            grid-area: list;
            max-height: calc(100vh - 20rem);
            overflow-y: auto;
          }
          [data-ltm-note-workbench] {
            grid-area: workbench;
            max-height: calc(100vh - 10rem);
            overflow-y: auto;
          }
          [data-ltm-note-editor] {
            display: block !important;
          }
        }
        @container ltm-note-workbench (min-width: 48rem) {
          [data-ltm-note-layout][data-details-open="true"] {
            display: flex;
            column-gap: 1rem;
          }
          [data-ltm-note-layout][data-details-open="true"]
            > [data-ltm-note-editor] {
            min-width: 0;
            flex: 1 1 0%;
          }
          [data-ltm-note-layout][data-details-open="true"]
            > [data-ltm-note-inspector] {
            min-width: 16rem;
            flex: 0 0 18rem;
            border-left: 1px solid var(--border);
            padding-left: 1rem;
          }
          [data-ltm-inspector-tokens] {
            border-top: 0;
            padding-top: 0;
          }
        }
      `}</style>
      <div
        role="tablist"
        aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryWorkspace")}
        className="grid grid-cols-3 rounded-lg border border-[var(--border)] p-1 md:hidden"
      >
        {(["memories", "editor", "details"] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            role="tab"
            aria-selected={mobilePane === pane}
            disabled={pane !== "memories" && !draft}
            onClick={() => {
              setMobilePane(pane);
              if (pane !== "details") setDetailsOpen(false);
            }}
            className={`min-h-11 rounded-md px-2 text-xs font-semibold disabled:opacity-40 ${mobilePane === pane ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
          >
            {localizeUi(
              {
                memories: "ui.longTermMemory.longtermmemorynavigation.memories",
                editor: "ui.longTermMemory.memoryvault.memoryEditor",
                details: "ui.longTermMemory.memoryvault.memoryDetails",
              }[pane],
            )}
          </button>
        ))}
      </div>
      <section
        data-ltm-browser-controls
        className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-3"
      >
        <div className="col-span-2 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">
            {localizeUi("ui.longTermMemory.memoryvault.memoryVault")}
          </h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            {visible.length} {localizeUi("ui.longTermMemory.memoryvault.shown")}
          </span>
        </div>
        <label className="relative col-span-2 block">
          <Search
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            className={`${inputClass} pl-9 pr-10`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizeUi(
              "ui.longTermMemory.memoryvault.searchMemories",
            )}
            aria-label={localizeUi(
              "ui.longTermMemory.memoryvault.searchMemories",
            )}
          />
          {search ? (
            <button
              type="button"
              aria-label={localizeUi(
                "ui.longTermMemory.memoryvault.clearMemorySearch",
              )}
              onClick={() => setSearch("")}
              className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            >
              <X size="0.875rem" />
            </button>
          ) : null}
        </label>
        <div ref={scopePickerRef} className="relative min-w-0">
          <input
            className={inputClass}
            value={targetSearch || target?.label || ""}
            onFocus={() => setTargetsOpen(true)}
            onChange={(event) => {
              setTargetSearch(event.target.value);
              setTargetsOpen(true);
            }}
            placeholder={localizeUi(
              "ui.longTermMemory.memoryvault.chooseScope",
            )}
            aria-label={localizeUi(
              "ui.longTermMemory.memoryvault.chooseMemoryScope",
            )}
            role="combobox"
            aria-expanded={targetsOpen}
            aria-controls="ltm-scope-targets"
            aria-activedescendant={
              targetsOpen && matchingTargets[activeTargetIndex]
                ? `ltm-scope-target-${activeTargetIndex}`
                : undefined
            }
            aria-autocomplete="list"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setTargetsOpen(true);
                setActiveTargetIndex((current) => {
                  if (!matchingTargets.length) return 0;
                  if (!targetsOpen)
                    return event.key === "ArrowDown"
                      ? 0
                      : matchingTargets.length - 1;
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  return (
                    (current + step + matchingTargets.length) %
                    matchingTargets.length
                  );
                });
              } else if (event.key === "Enter" && targetsOpen) {
                const active = matchingTargets[activeTargetIndex];
                if (active) {
                  event.preventDefault();
                  void selectTarget(active);
                }
              } else if (event.key === "Escape") setTargetsOpen(false);
            }}
          />
          {targetsOpen ? (
            <div
              id="ltm-scope-targets"
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-1 shadow-lg"
            >
              {matchingTargets.map((candidate, index) => (
                <button
                  key={candidate.id}
                  id={`ltm-scope-target-${index}`}
                  role="option"
                  aria-selected={candidate.id === target?.id}
                  type="button"
                  onMouseEnter={() => setActiveTargetIndex(index)}
                  onClick={() => void selectTarget(candidate)}
                  className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--accent)] ${index === activeTargetIndex ? "bg-[var(--accent)]" : ""}`}
                >
                  {candidate.label}
                </button>
              ))}
              {!matchingTargets.length ? (
                <p className="p-3 text-xs text-[var(--muted-foreground)]">
                  {localizeUi(
                    "ui.longTermMemory.memoryvault.noLinkedMemoryScopesFound",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <select
          className={inputClass}
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as LtmStatus | "all")
          }
          aria-label={localizeUi(
            "ui.longTermMemory.memoryvault.filterByStatus",
          )}
        >
          <option value="all">
            {localizeUi("ui.longTermMemory.memoryvault.allStatuses")}
          </option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {humanizeLabel(status)}
            </option>
          ))}
        </select>
        <div
          className={`${selectionMode ? "flex" : "hidden"} col-span-2 flex-wrap items-center gap-3 border-t border-[var(--border)] pt-2 md:flex`}
        >
          <label className="flex min-h-9 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={
                visible.length > 0 &&
                visible.every((note) => checked.has(note.id))
              }
              onChange={(event) =>
                setChecked(
                  event.target.checked
                    ? new Set([...checked, ...visible.map((note) => note.id)])
                    : new Set(
                        [...checked].filter(
                          (id) => !visible.some((note) => note.id === id),
                        ),
                      ),
                )
              }
            />
            {localizeUi("ui.longTermMemory.memoryvault.selectVisible")}
          </label>
          <span
            data-ltm-selection-count
            className="text-xs text-[var(--muted-foreground)]"
          >
            {checked.size}{" "}
            {localizeUi("ui.longTermMemory.memoryvault.selected")}
            {hiddenChecked
              ? localizeUi(
                  "ui.longTermMemory.memoryvault.value1HiddenByFilters",
                  { value1: hiddenChecked },
                )
              : ""}
          </span>
          <span className="ml-auto md:hidden">
            <Button
              className="min-h-9"
              onClick={() => {
                setSelectionMode((value) => !value);
                if (selectionMode) setChecked(new Set());
              }}
            >
              {selectionMode
                ? localizeUi("ui.longTermMemory.memoryvault.done")
                : localizeUi("ui.longTermMemory.memoryvault.select")}
            </Button>
          </span>
        </div>
        {!selectionMode ? (
          <Button
            className="col-span-2 min-h-9 justify-self-start md:hidden"
            onClick={() => setSelectionMode(true)}
          >
            {localizeUi("ui.longTermMemory.memoryvault.select")}
          </Button>
        ) : null}
      </section>
      {error || notice ? (
        <div data-ltm-vault-feedback className="contents">
          {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
          {notice ? (
            <StatusSurface tone="success">{notice}</StatusSurface>
          ) : null}
        </div>
      ) : null}
      {checked.size ? (
        <section
          data-ltm-bulk-actions
          className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-3"
        >
          <>
            <select
              className={inputClass}
              value={bulkStatus}
              onChange={(event) =>
                setBulkStatus(event.target.value as LtmStatus)
              }
              aria-label={localizeUi("ui.longTermMemory.memoryvault.setStatus")}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {humanizeLabel(status)}
                </option>
              ))}
            </select>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void batch("status")}
            >
              {localizeUi("ui.longTermMemory.memoryvault.setStatus")}
            </Button>
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">
                {localizeUi("ui.longTermMemory.memoryvault.setRetrievalModes")}
              </legend>
              {modes.map((mode) => (
                <label
                  key={mode}
                  className="flex min-h-8 items-center gap-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={bulkModes.includes(mode)}
                    onChange={() =>
                      setBulkModes((current) =>
                        current.includes(mode)
                          ? current.filter((item) => item !== mode)
                          : [...current, mode],
                      )
                    }
                  />
                  {humanizeLabel(mode)}
                </label>
              ))}
            </fieldset>
            <Button
              disabled={Boolean(busy) || !bulkModes.length}
              onClick={() => void batch("modes")}
            >
              {localizeUi("ui.longTermMemory.memoryvault.setModes")}
            </Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void batch("archive")}
            >
              <Archive size="0.875rem" />
              {localizeUi("ui.longTermMemory.memoryvault.archive")}
            </Button>
            <Button
              destructive
              disabled={Boolean(busy)}
              onClick={() => void batch("delete")}
            >
              <Trash2 size="0.875rem" />
              {localizeUi("ui.longTermMemory.extractionprompttemplates.delete")}
            </Button>
          </>
        </section>
      ) : null}
      {deleteIds ? (
        <dialog
          ref={deleteDialogRef}
          aria-modal="true"
          aria-labelledby="ltm-delete-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) setDeleteIds(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDeleteIds(null);
              return;
            }
            if (event.key !== "Tab") return;
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
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
          className="fixed inset-0 z-50 m-0 grid h-full w-full place-items-center bg-black/50 p-4"
        >
          <section className="w-full max-w-md space-y-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl">
            <div className="space-y-1">
              <h3 id="ltm-delete-title" className="text-base font-semibold">
                {localizeUi(
                  "ui.longTermMemory.memoryvault.permanentlyDeleteSelectedMemories",
                )}
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {localizeUi("ui.longTermMemory.memoryvault.thisCannotBeUndone")}
              </p>
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input
                type="checkbox"
                data-ltm-delete-extracted
                className="mt-1"
                checked={retractExtracted}
                onChange={(event) => setRetractExtracted(event.target.checked)}
              />
              <span>
                {localizeUi(
                  "ui.longTermMemory.memoryvault.alsoDeleteMemoriesExtractedFromTheSelectedSource",
                )}
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button
                data-ltm-delete-cancel
                disabled={Boolean(busy)}
                onClick={() => setDeleteIds(null)}
              >
                {localizeUi("ui.longTermMemory.memoryvault.cancel")}
              </Button>
              <Button
                destructive
                disabled={Boolean(busy)}
                onClick={() => void deleteSelected(deleteIds, retractExtracted)}
              >
                <Trash2 size="0.875rem" />
                {localizeUi("ui.longTermMemory.memoryvault.deletePermanently")}
              </Button>
            </div>
          </section>
        </dialog>
      ) : null}
      <div
        data-ltm-vault-workspace
        className="grid min-h-0 min-w-0 gap-4 md:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.25fr)]"
      >
        <section
          data-ltm-memory-list
          className={`${mobilePane === "memories" ? "block" : "hidden"} min-w-0 rounded-lg border border-[var(--border)] md:block`}
          aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryList")}
        >
          {notes.isLoading ? (
            <StatusSurface busy>
              {localizeUi("ui.longTermMemory.memoryvault.loadingMemories")}
            </StatusSurface>
          ) : null}
          {notes.isError ? (
            <StatusSurface tone="danger">
              {localizeUi("ui.longTermMemory.memoryvault.memoriesCouldNotLoad")}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void notes.refetch()}
              >
                {localizeUi("ui.longTermMemory.activityview.retry")}
              </button>
            </StatusSurface>
          ) : null}
          {groupedNoteTypes.map(({ type, labelKey }) => {
            const group = visible.filter((note) => note.type === type);
            if (!group.length) return null;
            return (
              <details
                key={type}
                open={search.trim() ? true : undefined}
                className="group"
                data-ltm-memory-group={type}
              >
                <summary className="flex min-h-10 cursor-pointer items-center gap-2 border-b border-[var(--border)] bg-[var(--secondary)]/35 px-3 text-xs font-semibold">
                  <ChevronRight
                    aria-hidden="true"
                    size="0.875rem"
                    className="transition-transform group-open:rotate-90"
                  />
                  <span>{localizeUi(labelKey)}</span>
                  <span className="ml-auto text-[var(--muted-foreground)]">
                    {group.length}
                  </span>
                </summary>
                {group.map((note) => {
                  const notePreview = preview(note, search);
                  return (
                    <ClickSurface
                      key={note.id}
                      data-ltm-note-type={note.type}
                      data-ltm-note-source={note.type === "source" || undefined}
                      data-ltm-note-actions-open={
                        openActionNoteId === note.id || undefined
                      }
                      className={`group border-b border-[var(--border)]/70 p-2 ${draft?.id === note.id ? "bg-[var(--accent)]/55" : ""}`}
                    >
                      <div className="flex min-w-0 gap-2">
                        <label
                          className={`${selectionMode ? "flex" : "hidden"} min-h-11 min-w-8 items-center justify-center md:flex`}
                        >
                          <input
                            type="checkbox"
                            checked={checked.has(note.id)}
                            onChange={() =>
                              setChecked((current) => {
                                const next = new Set(current);
                                next.has(note.id)
                                  ? next.delete(note.id)
                                  : next.add(note.id);
                                return next;
                              })
                            }
                            aria-label={localizeUi(
                              "ui.longTermMemory.memoryvault.selectValue1",
                              { value1: memoryLabel(note) },
                            )}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void openNote(note)}
                          className="min-h-14 min-w-0 flex-1 overflow-hidden rounded-md px-2 text-left hover:bg-[var(--accent)]"
                        >
                          <span className="flex items-center gap-2">
                            <strong className="truncate text-sm">
                              {memoryLabel(note)}
                            </strong>
                            <ChevronRight
                              size="0.875rem"
                              className="shrink-0"
                            />
                          </span>
                          <span className="mt-1 flex gap-1 text-[0.6875rem]">
                            <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5">
                              {noteTypeLabel(note.type)}
                            </span>
                            <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5">
                              {humanizeLabel(note.status)}
                            </span>
                          </span>
                          {notePreview ? (
                            <span className="mt-1 line-clamp-2 block break-words text-xs leading-5 text-[var(--muted-foreground)]">
                              <span className="font-medium text-[var(--foreground)]">
                                {notePreview.label}:
                              </span>{" "}
                              {notePreview.text}
                            </span>
                          ) : null}
                        </button>
                        {!selectionMode ? (
                          <>
                            <div className="hidden flex-col items-start gap-1 pt-1 opacity-0 transition-opacity pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto group-hover:opacity-100 group-focus-within:opacity-100 md:flex">
                              <IconButton
                                icon={Archive}
                                label={localizeUi(
                                  "ui.longTermMemory.memoryvault.archiveValue1",
                                  { value1: memoryLabel(note) },
                                )}
                                disabled={Boolean(busy)}
                                onClick={(event) =>
                                  void runNoteAction(event, note, "archive")
                                }
                              />
                              <IconButton
                                icon={Trash2}
                                label={localizeUi(
                                  "ui.longTermMemory.memoryvault.deleteValue1",
                                  { value1: memoryLabel(note) },
                                )}
                                destructive
                                disabled={Boolean(busy)}
                                onClick={(event) =>
                                  void runNoteAction(event, note, "delete")
                                }
                              />
                            </div>
                            <div className="md:hidden">
                              <IconButton
                                icon={Ellipsis}
                                label={localizeUi(
                                  "ui.longTermMemory.memoryvault.moreActionsForValue1",
                                  { value1: memoryLabel(note) },
                                )}
                                aria-expanded={openActionNoteId === note.id}
                                aria-controls={`ltm-note-actions-${note.id}`}
                                onClick={(event) =>
                                  toggleNoteActions(event, note.id)
                                }
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                      {!selectionMode && openActionNoteId === note.id ? (
                        <div
                          id={`ltm-note-actions-${note.id}`}
                          className="flex gap-2 pl-10 pt-2 md:hidden"
                        >
                          <Button
                            className="flex-1"
                            disabled={Boolean(busy)}
                            onClick={(event) =>
                              void runNoteAction(event, note, "archive")
                            }
                          >
                            <Archive size="0.875rem" />
                            {localizeUi(
                              "ui.longTermMemory.memoryvault.archive",
                            )}
                          </Button>
                          <Button
                            className="flex-1"
                            destructive
                            disabled={Boolean(busy)}
                            onClick={(event) =>
                              void runNoteAction(event, note, "delete")
                            }
                          >
                            <Trash2 size="0.875rem" />
                            {localizeUi(
                              "ui.longTermMemory.extractionprompttemplates.delete",
                            )}
                          </Button>
                        </div>
                      ) : null}
                    </ClickSurface>
                  );
                })}
              </details>
            );
          })}
          {!notes.isLoading && !notes.isError && !visible.length ? (
            <div className="space-y-2 p-5 text-center text-xs text-[var(--muted-foreground)]">
              <p>
                {allNotes.length
                  ? localizeUi(
                      "ui.longTermMemory.memoryvault.noMemoriesMatchTheseFilters",
                    )
                  : localizeUi(
                      "ui.longTermMemory.memoryvault.noSavedMemoriesYetImportASourceOrCreate",
                    )}
              </p>
              {!allNotes.length ? (
                <p>
                  {localizeUi(
                    "ui.longTermMemory.memoryvault.importASourceReviewProposedMemoriesThenSaveThe",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
        <section
          ref={detailRef}
          tabIndex={-1}
          data-ltm-note-workbench
          className={`${mobilePane === "memories" ? "hidden" : "block"} min-w-0 scroll-mt-20 rounded-lg border border-[var(--border)] p-3 md:block`}
          style={{
            containerName: "ltm-note-workbench",
            containerType: "inline-size",
          }}
          aria-label={localizeUi("ui.longTermMemory.memoryvault.memoryEditor")}
        >
          {!draft ? (
            <div className="flex min-h-52 items-center justify-center text-center text-sm text-[var(--muted-foreground)]">
              {localizeUi(
                "ui.longTermMemory.memoryvault.openAMemoryForDetailsOrAddOne",
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {isNew
                      ? localizeUi("ui.longTermMemory.memoryvault.newMemory")
                      : localizeUi(
                          "ui.longTermMemory.memoryvault.memoryDetails",
                        )}
                  </h3>
                </div>
                <div className="flex gap-2">
                  <IconButton
                    icon={PanelRight}
                    label={
                      detailsOpen
                        ? localizeUi(
                            "ui.longTermMemory.memoryvault.hideMetadata",
                          )
                        : localizeUi(
                            "ui.longTermMemory.memoryvault.showMetadata",
                          )
                    }
                    onClick={() => {
                      setDetailsOpen((value) => {
                        const next = !value;
                        setMobilePane(next ? "details" : "editor");
                        return next;
                      });
                    }}
                    aria-pressed={detailsOpen}
                    data-ltm-details-toggle
                    className="hidden aria-pressed:bg-[var(--accent)] md:inline-grid"
                  />
                  <Button
                    primary
                    disabled={!dirty || busy === "save"}
                    onClick={() => void save()}
                  >
                    <Check size="0.875rem" />
                    {busy === "save"
                      ? localizeUi("ui.longTermMemory.memoryvault.saving")
                      : localizeUi("ui.longTermMemory.memoryvault.save")}
                  </Button>
                  <Button onClick={() => void closeDraft()}>
                    {localizeUi("ui.longTermMemory.memoryvault.close")}
                  </Button>
                </div>
              </header>
              <div
                data-ltm-note-layout
                data-details-open={detailsOpen}
                className="min-w-0"
              >
                <div
                  data-ltm-note-editor
                  className={
                    mobilePane === "details"
                      ? "hidden space-y-4 md:block"
                      : "space-y-4"
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium">
                      {localizeUi("ui.longTermMemory.memoryvault.title")}
                      <input
                        className={inputClass}
                        value={draft.title ?? ""}
                        onChange={(event) =>
                          update("title", event.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      {localizeUi("ui.longTermMemory.memoryvault.status")}
                      <select
                        className={inputClass}
                        value={draft.status}
                        onChange={(event) =>
                          update("status", event.target.value as LtmStatus)
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {humanizeLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {isNew ? (
                      <label className="space-y-1 text-xs font-medium">
                        {localizeUi("ui.longTermMemory.memoryvault.type")}
                        <select
                          className={inputClass}
                          value={draft.type}
                          onChange={(event) => {
                            const type = event.target.value as LtmNoteType;
                            setDraft({
                              ...draft,
                              type,
                              id: `${prefixes[type]}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
                              subjects:
                                type === "character" || type === "relationship"
                                  ? draft.subjects
                                  : undefined,
                            });
                          }}
                        >
                          {noteTypes.map((type) => (
                            <option key={type} value={type}>
                              {noteTypeLabel(type)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="self-end text-xs text-[var(--muted-foreground)]">
                        {noteTypeLabel(draft.type)}{" "}
                        {localizeUi(
                          "ui.longTermMemory.lastinjectionsummary.memory",
                        )}
                      </p>
                    )}
                    <fieldset className="sm:col-span-2">
                      <legend className="text-xs font-medium">
                        {localizeUi(
                          "ui.longTermMemory.memoryvault.availableModes",
                        )}
                      </legend>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {modes.map((mode) => (
                          <label
                            key={mode}
                            className="flex min-h-8 items-center gap-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={draft.modes.includes(mode)}
                              onChange={() =>
                                update(
                                  "modes",
                                  draft.modes.includes(mode)
                                    ? draft.modes.filter(
                                        (item) => item !== mode,
                                      )
                                    : [...draft.modes, mode],
                                )
                              }
                            />
                            {humanizeLabel(mode)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <h4 className="mr-auto text-xs font-medium">
                        {localizeUi(
                          "ui.longTermMemory.memoryvault.memorySections",
                        )}
                      </h4>
                      {draft.type !== "source" ? (
                        <>
                          <input
                            className={`${inputClass} w-40`}
                            value={sectionKey}
                            onChange={(event) =>
                              setSectionKey(event.target.value)
                            }
                            placeholder={localizeUi(
                              "ui.longTermMemory.memoryvault.newSection",
                            )}
                            aria-label={localizeUi(
                              "ui.longTermMemory.memoryvault.newSectionName",
                            )}
                          />
                          <Button
                            onClick={addSection}
                            disabled={!sectionKey.trim()}
                          >
                            {localizeUi(
                              "ui.longTermMemory.memoryvault.addSection",
                            )}
                          </Button>
                        </>
                      ) : null}
                    </div>
                    {Object.entries(draft.sections).map(([key, section]) => (
                      <article
                        key={key}
                        className="space-y-2 rounded-md border border-[var(--border)] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`ltm-section-${key}`}
                            className="text-xs font-semibold"
                          >
                            {noteTypeLabel(key)}
                          </label>
                          {draft.type !== "source" ? (
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...draft.sections };
                                delete next[key];
                                update("sections", next);
                              }}
                              aria-label={localizeUi(
                                "ui.longTermMemory.memoryvault.removeValue1Section",
                                { value1: key },
                              )}
                              className="grid h-8 w-8 place-items-center rounded text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                            >
                              <Trash2 size="0.75rem" />
                            </button>
                          ) : null}
                        </div>
                        <fieldset
                          disabled={draft.type === "source"}
                          className="space-y-2"
                        >
                          <textarea
                            id={`ltm-section-${key}`}
                            data-ltm-field="section"
                            className={`${inputClass} min-h-28 py-2`}
                            value={section.text}
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
                          <TokenEditor
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.evidence",
                            )}
                            help={localizeUi(
                              "ui.longTermMemory.memoryvault.referencesThatSupportThisSectionIncludingSourceMemories",
                            )}
                            values={section.evidence ?? []}
                            placeholder={localizeUi(
                              "ui.longTermMemory.memoryvault.addEvidence",
                            )}
                            displayValue={referenceLabel}
                            onChange={(evidence) =>
                              update("sections", {
                                ...draft.sections,
                                [key]: { ...section, evidence },
                              })
                            }
                          />
                        </fieldset>
                      </article>
                    ))}
                  </section>
                </div>
                <aside
                  data-ltm-note-inspector
                  aria-label={localizeUi(
                    "ui.longTermMemory.memoryvault.memoryInspector",
                  )}
                  className={
                    detailsOpen || mobilePane === "details"
                      ? mobilePane === "editor"
                        ? "hidden md:block"
                        : "contents md:block"
                      : "hidden"
                  }
                >
                  <section className="space-y-3 border-t border-[var(--border)] pt-4">
                    <h4 className="flex items-center gap-1 text-xs font-medium">
                      {localizeUi(
                        "ui.longTermMemory.memoryvault.sectionMetadata",
                      )}
                      <InfoPopover
                        label={localizeUi(
                          "ui.longTermMemory.memoryvault.sectionMetadata",
                        )}
                        content={localizeUi(
                          "ui.longTermMemory.memoryvault.retrievalMetadataForEachMemorySectionTheseValuesInfluence",
                        )}
                      />
                    </h4>
                    {Object.entries(draft.sections).map(([key, section]) => (
                      <fieldset key={key} className="space-y-2">
                        <legend className="text-xs font-semibold">
                          {noteTypeLabel(key)}
                        </legend>
                        <div className="grid gap-2">
                          <div className="text-xs">
                            <span className="flex items-center gap-1">
                              {localizeUi(
                                "ui.longTermMemory.memoryvault.importance",
                              )}
                              <InfoPopover
                                label={localizeUi(
                                  "ui.longTermMemory.memoryvault.importance",
                                )}
                                content={localizeUi(
                                  "ui.longTermMemory.memoryvault.durabilityAndConsequenceCategoryCriticalMajorModerateOrMinor",
                                )}
                              />
                            </span>
                            <select
                              aria-label={localizeUi(
                                "ui.longTermMemory.memoryvault.importance",
                              )}
                              className={inputClass}
                              value={section.importance ?? ""}
                              disabled={draft.type === "source"}
                              onChange={(event) =>
                                update("sections", {
                                  ...draft.sections,
                                  [key]: {
                                    ...section,
                                    importance: event.target.value || undefined,
                                  },
                                })
                              }
                            >
                              <option value="">
                                {localizeUi(
                                  "ui.longTermMemory.memoryvault.notSet",
                                )}
                              </option>
                              {["critical", "major", "moderate", "minor"].map(
                                (value) => (
                                  <option key={value} value={value}>
                                    {humanizeLabel(value)}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                          <NumberField
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.confidence",
                            )}
                            help={localizeUi(
                              "ui.longTermMemory.memoryvault.howStronglyTheStoredEvidenceSupportsThisSectionFrom",
                            )}
                            value={section.confidence ?? 0}
                            min={0}
                            max={1}
                            step={0.05}
                            disabled={draft.type === "source"}
                            onChange={(value) =>
                              update("sections", {
                                ...draft.sections,
                                [key]: { ...section, confidence: value },
                              })
                            }
                          />
                          <NumberField
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.salience",
                            )}
                            help={localizeUi(
                              "ui.longTermMemory.memoryvault.howLikelyThisSectionIsToMatterInFuture",
                            )}
                            value={section.salience ?? 0}
                            min={0}
                            max={1}
                            step={0.05}
                            disabled={draft.type === "source"}
                            onChange={(value) =>
                              update("sections", {
                                ...draft.sections,
                                [key]: { ...section, salience: value },
                              })
                            }
                          />
                        </div>
                      </fieldset>
                    ))}
                  </section>
                  <div
                    data-ltm-inspector-tokens
                    className="grid gap-4 border-t border-[var(--border)] pt-4 lg:grid-cols-2"
                  >
                    <TokenEditor
                      label={localizeUi("ui.longTermMemory.memoryvault.tags")}
                      values={draft.tags}
                      placeholder={localizeUi(
                        "ui.longTermMemory.memoryvault.lowercaseTag",
                      )}
                      onChange={(values) => update("tags", values)}
                    />
                    <TokenEditor
                      label={localizeUi(
                        "ui.longTermMemory.memoryvault.keywords",
                      )}
                      values={draft.keywords}
                      placeholder={localizeUi(
                        "ui.longTermMemory.memoryvault.addKeyword",
                      )}
                      onChange={(values) => update("keywords", values)}
                    />
                  </div>
                  <section className="space-y-2 border-t border-[var(--border)] pt-4">
                    <h4 className="flex items-center gap-1 text-xs font-medium">
                      {localizeUi("ui.longTermMemory.memoryvault.scope")}
                      <InfoPopover
                        label={localizeUi(
                          "ui.longTermMemory.memoryvault.scope",
                        )}
                        content={localizeUi(
                          "ui.longTermMemory.memoryvault.chatsBranchesCharactersOrPersonasInWhichThisMemory",
                        )}
                      />
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        draft.scope.chatIds ??
                        (draft.scope.chatId ? [draft.scope.chatId] : [])
                      ).map((id) => (
                        <Pill
                          key={`chat-${id}`}
                          onRemove={() => removeScope("chatIds", id)}
                        >
                          {scopeTargetLabel("chat", id, targets)}
                        </Pill>
                      ))}
                      {(draft.scope.characterIds ?? []).map((id) => (
                        <Pill
                          key={`character-${id}`}
                          onRemove={() => removeScope("characterIds", id)}
                        >
                          {scopeTargetLabel("character", id, targets)}
                        </Pill>
                      ))}
                      {draft.scope.groupId ? (
                        <Pill
                          onRemove={() => mutateScope({ groupId: undefined })}
                        >
                          {scopeTargetLabel(
                            "group",
                            draft.scope.groupId,
                            targets,
                          )}
                        </Pill>
                      ) : null}
                      {draft.scope.personaId ? (
                        <Pill
                          onRemove={() => mutateScope({ personaId: undefined })}
                        >
                          {scopeTargetLabel(
                            "persona",
                            draft.scope.personaId,
                            [],
                          )}
                        </Pill>
                      ) : null}
                    </div>
                    <div
                      data-ltm-inspector-fields
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      <input
                        className={inputClass}
                        placeholder={localizeUi(
                          "ui.longTermMemory.memoryvault.addAnotherChat",
                        )}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const id = event.currentTarget.value.trim();
                            if (id) {
                              mutateScope({
                                chatIds: [
                                  ...new Set([
                                    ...(draft.scope.chatIds ?? []),
                                    id,
                                  ]),
                                ],
                                chatId: draft.scope.chatId ?? id,
                              });
                              event.currentTarget.value = "";
                            }
                          }
                        }}
                      />
                      <input
                        className={inputClass}
                        placeholder={localizeUi(
                          "ui.longTermMemory.memoryvault.addAnotherCharacter",
                        )}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const id = event.currentTarget.value.trim();
                            if (id) {
                              mutateScope({
                                characterIds: [
                                  ...new Set([
                                    ...(draft.scope.characterIds ?? []),
                                    id,
                                  ]),
                                ],
                              });
                              event.currentTarget.value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  </section>
                  <section className="space-y-2 border-t border-[var(--border)] pt-4">
                    <h4 className="flex items-center gap-1 text-xs font-medium">
                      {localizeUi(
                        "ui.longTermMemory.memoryvault.linkedMemories",
                      )}
                      <InfoPopover
                        label={localizeUi(
                          "ui.longTermMemory.memoryvault.linkedMemories",
                        )}
                        content={localizeUi(
                          "ui.longTermMemory.memoryvault.explicitRelationshipsUsedToConnectThisMemoryToRelated",
                        )}
                      />
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {draft.links.map((link, index) => (
                        <Pill
                          key={`${link.target}-${link.relation}-${index}`}
                          label={localizeUi(
                            "ui.longTermMemory.longtermmemorydetail.value1Value2",
                            {
                              value1: humanizeLabel(link.relation),
                              value2: memoryLabel(
                                allNotes.find(
                                  (note) => note.id === link.target,
                                ),
                              ),
                            },
                          )}
                          onRemove={() =>
                            update(
                              "links",
                              draft.links.filter((_, item) => item !== index),
                            )
                          }
                        >
                          {humanizeLabel(link.relation)}
                          {" -> "}
                          <button
                            type="button"
                            className="underline underline-offset-2"
                            onClick={() => void openLinkedNote(link.target)}
                          >
                            {memoryLabel(
                              allNotes.find((note) => note.id === link.target),
                            )}
                          </button>
                        </Pill>
                      ))}
                    </div>
                    <div
                      data-ltm-inspector-fields
                      className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
                    >
                      <input
                        className={inputClass}
                        value={linkTarget}
                        onChange={(event) => setLinkTarget(event.target.value)}
                        placeholder={localizeUi(
                          "ui.longTermMemory.memoryvault.searchOrEnterAMemory",
                        )}
                        list="ltm-linked-memories"
                      />
                      <datalist id="ltm-linked-memories">
                        {allNotes
                          .filter(
                            (note) =>
                              note.id !== draft.id &&
                              !draft.links.some(
                                (link) => link.target === note.id,
                              ),
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
                        onChange={(event) =>
                          setLinkRelation(
                            event.target.value as LtmLink["relation"],
                          )
                        }
                      >
                        {relations.map((relation) => (
                          <option key={relation} value={relation}>
                            {humanizeLabel(relation)}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={addLink}
                        disabled={
                          !linkTarget.trim() || linkTarget.trim() === draft.id
                        }
                      >
                        <Link2 size="0.75rem" />
                        {localizeUi("ui.longTermMemory.memoryvault.link")}
                      </Button>
                    </div>
                  </section>
                  {draft.type === "character" ||
                  draft.type === "relationship" ? (
                    <section className="space-y-2 border-t border-[var(--border)] pt-4">
                      <h4 className="flex items-center gap-1 text-xs font-medium">
                        {localizeUi("ui.longTermMemory.memoryvault.subjects")}
                        <InfoPopover
                          label={localizeUi(
                            "ui.longTermMemory.memoryvault.subjects",
                          )}
                          content={localizeUi(
                            "ui.longTermMemory.memoryvault.theCharacterOrRelationshipIdentitiesDescribedByThisMemory",
                          )}
                        />
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(draft.subjects ?? []).map((subject, index) => (
                          <Pill
                            key={subject.key}
                            label={subjectLabel(subject)}
                            onRemove={() =>
                              update(
                                "subjects",
                                draft.subjects?.filter(
                                  (_, item) => item !== index,
                                ) || [],
                              )
                            }
                          >
                            {subjectLabel(subject)}
                          </Pill>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className={inputClass}
                          value={subjectKey}
                          onChange={(event) =>
                            setSubjectKey(event.target.value)
                          }
                          placeholder={localizeUi(
                            "ui.longTermMemory.memoryvault.characterIdOrPersonaId",
                          )}
                        />
                        <Button
                          onClick={addSubject}
                          disabled={
                            !subjectKey.trim() ||
                            (draft.subjects?.length ?? 0) >=
                              (draft.type === "character" ? 1 : 2)
                          }
                        >
                          {localizeUi("ui.longTermMemory.tokeneditor.add")}
                        </Button>
                      </div>
                    </section>
                  ) : null}
                  {draft.conflicts?.length ? (
                    <section className="space-y-2 border-t border-[var(--border)] pt-4">
                      <h4 className="text-xs font-medium">
                        {localizeUi("ui.longTermMemory.memoryvault.conflicts")}
                      </h4>
                      {draft.conflicts.map((conflict, index) => (
                        <article
                          key={`${conflict.field}-${index}`}
                          className="rounded-md bg-[var(--secondary)]/45 p-2 text-xs"
                        >
                          <strong>
                            {humanizeLabel(conflict.field)}:{" "}
                            {humanizeLabel(conflict.resolution)}
                          </strong>
                          <p className="mt-1">{conflict.proposed}</p>
                        </article>
                      ))}
                    </section>
                  ) : null}
                  <dl className="grid gap-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)]">
                    <div>
                      <dt className="font-medium text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.memoryvault.created")}
                      </dt>
                      <dd>
                        {new Date(draft.createdAt).toLocaleString(locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.memoryvault.updated")}
                      </dt>
                      <dd>
                        {new Date(draft.updatedAt).toLocaleString(locale)}
                      </dd>
                    </div>
                    {draft.provenance ? (
                      <div>
                        <dt className="flex items-center gap-1 font-medium text-[var(--foreground)]">
                          {localizeUi(
                            "ui.longTermMemory.memoryvault.provenance",
                          )}
                          <InfoPopover
                            label={localizeUi(
                              "ui.longTermMemory.memoryvault.provenance",
                            )}
                            content={localizeUi(
                              "ui.longTermMemory.memoryvault.theCharacterChatSummaryOrLorebookFromWhichThis",
                            )}
                          />
                        </dt>
                        <dd className="break-words">
                          {humanizeLabel(draft.provenance.kind)}:{" "}
                          {provenanceSourceLabel()}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {!isNew && props.chatId ? (
                    <div className="border-t border-[var(--border)] pt-4">
                      <Button
                        destructive
                        disabled={Boolean(busy)}
                        onClick={() => void removeFromCurrentChat()}
                      >
                        <Trash2 size="0.875rem" />
                        {busy === "remove-current-chat"
                          ? localizeUi("ui.longTermMemory.memoryvault.removing")
                          : localizeUi(
                              "ui.longTermMemory.memoryvault.removeFromCurrentChat",
                            )}
                      </Button>
                    </div>
                  ) : null}
                </aside>
              </div>
              {draft.type === "source" ? (
                <section className="space-y-2 border-t border-[var(--border)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-medium">
                      {localizeUi(
                        "ui.longTermMemory.memoryvault.derivedMemoriesAcrossAllScopes",
                      )}
                    </h4>
                    {sourceDerivedQuery.isSuccess ? (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {sourceDerived.length}{" "}
                        {localizeUi("ui.longTermMemory.memoryvault.linkedHere")}
                      </span>
                    ) : null}
                  </div>
                  {sourceDerivedQuery.isLoading ? (
                    <StatusSurface busy>
                      {localizeUi(
                        "ui.longTermMemory.memoryvault.loadingDerivedMemories",
                      )}
                    </StatusSurface>
                  ) : null}
                  {sourceDerivedQuery.isError ? (
                    <StatusSurface tone="danger">
                      <span>
                        {localizeUi(
                          "ui.longTermMemory.memoryvault.derivedMemoriesCouldNotLoad",
                        )}{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => void sourceDerivedQuery.refetch()}
                        >
                          {localizeUi("ui.longTermMemory.activityview.retry")}
                        </button>
                      </span>
                    </StatusSurface>
                  ) : null}
                  {sourceDerived.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => void openLinkedNote(note.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 text-left hover:bg-[var(--accent)]"
                    >
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">
                          {memoryLabel(note)}
                        </strong>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {noteTypeLabel(note.type)}
                        </span>
                      </span>
                      <ChevronRight size="0.875rem" className="shrink-0" />
                    </button>
                  ))}
                  {sourceDerivedQuery.isSuccess && !sourceDerived.length ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {localizeUi(
                        "ui.longTermMemory.memoryvault.noSavedMemoriesLinkToThisSourceYet",
                      )}
                    </p>
                  ) : null}
                </section>
              ) : null}
              {draft.type === "source" && !isNew ? (
                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  <Button
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      setBusy("extract");
                      try {
                        await request(
                          `/notes/${encodeURIComponent(draft.id)}/extract`,
                          "POST",
                          props.chatId ? { chatId: props.chatId } : {},
                        );
                        await invalidateLtmQueries(client, [
                          queryKeys.review,
                          queryKeys.pendingDrafts,
                        ]);
                        setNotice(
                          localizeUi(
                            "ui.longTermMemory.memoryvault.extractionFinishedReviewReady",
                          ),
                        );
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : localizeUi(
                                "ui.longTermMemory.memoryvault.extractionFailed",
                              ),
                        );
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    <RefreshCw size="0.875rem" />
                    {localizeUi(
                      "ui.longTermMemory.memoryvault.extractToReview",
                    )}
                  </Button>
                  <Button onClick={() => onOpenReview?.(draft.id)}>
                    {localizeUi(
                      "ui.longTermMemory.memoryvault.reviewRelatedDrafts",
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
