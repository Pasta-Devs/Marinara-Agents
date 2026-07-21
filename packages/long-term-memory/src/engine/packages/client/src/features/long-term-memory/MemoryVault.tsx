import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronRight,
  FilePlus2,
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
import { invalidateLtmQueries, queryKeys, request } from "./api";
import {
  Button,
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
  label: string;
}> = [
  { type: "source", label: "Source" },
  { type: "timeline_event", label: "Timeline Events" },
  { type: "character", label: "Characters" },
  { type: "relationship", label: "Relationships" },
  { type: "thread", label: "Threads" },
  { type: "scene", label: "Scenes" },
  { type: "world", label: "World" },
  { type: "tone", label: "Tone" },
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

let sessionTarget: Target | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
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
function title(type: string) {
  return noteTypeLabel(type);
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
    label: title(key),
    text: `${start ? "..." : ""}${text.slice(start, start + 180)}${start + 180 < text.length ? "..." : ""}`,
  };
}
function newNote(scope: LtmScope): LtmNote {
  const now = new Date().toISOString();
  return {
    id: `world_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    title: "Untitled memory",
    type: "world",
    status: "active",
    modes: ["roleplay"],
    scope,
    tags: [],
    keywords: [],
    createdAt: now,
    updatedAt: now,
    links: [],
    sections: { facts: { text: "Add durable context here.", updatedAt: now } },
    conflicts: [],
    version: 1,
  };
}

function recoveredNote(
  handoff: NonNullable<LongTermMemoryDestinationProps["recoveryHandoff"]>,
): LtmNote {
  const note = newNote(handoff.scope);
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
    title: suggestedTitle || "Recovered memory",
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
  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md bg-[var(--secondary)] px-2 text-xs text-[var(--foreground)]">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label ?? String(children)}`}
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
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
  displayValue?: (value: string) => string;
  onChange: (next: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const next = list(value).filter((item) => !values.includes(item));
    if (next.length) onChange([...values, ...next]);
    setValue("");
  };
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-medium">{label}</h4>
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
          Add
        </Button>
      </div>
    </section>
  );
}

export default function MemoryVault({
  props,
  onDirtyChange,
  onOpenSources,
  onOpenReview,
  openedNoteId,
  recoveryHandoff,
}: LongTermMemoryDestinationProps) {
  const client = useQueryClient();
  const detailRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [activeTargetIndex, setActiveTargetIndex] = useState(0);
  const [target, setTarget] = useState<Target | null>(() => sessionTarget);
  const [typeFilter, setTypeFilter] = useState<LtmNoteType | "all">("all");
  const [kindFilter, setKindFilter] = useState<"all" | "durable" | "sources">(
    "all",
  );
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
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bulkStatus, setBulkStatus] = useState<LtmStatus>("active");
  const [bulkModes, setBulkModes] = useState<LtmMode[]>(["roleplay"]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [retractExtracted, setRetractExtracted] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkRelation, setLinkRelation] =
    useState<LtmLink["relation"]>("involves");
  const [subjectKey, setSubjectKey] = useState("");
  const [sectionKey, setSectionKey] = useState("");

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
        label: props.chatName ?? "Current chat",
        scope: { chatId: props.chatId, chatIds: [props.chatId] },
      });
  }, [props.chatId, props.chatName, target]);
  useEffect(() => {
    if (props.chatId && !target && scopeTargets.data?.currentScope)
      setTarget({
        id: "current",
        label: props.chatName ?? "Current chat",
        scope: scopeTargets.data.currentScope,
      });
  }, [props.chatId, scopeTargets.data, target, props.chatName]);
  useEffect(() => {
    if (!target && !props.chatId && scopeTargets.isSuccess)
      setTarget({ id: "all", label: "All memories" });
  }, [props.chatId, scopeTargets.isSuccess, target]);
  useEffect(() => {
    if (target) sessionTarget = target;
  }, [target]);
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
    queryKey: [...queryKeys.notes, target?.id, target?.scope],
    enabled: Boolean(target),
    queryFn: () =>
      request<LtmNote[]>(
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
      (kindFilter === "all" ||
        (kindFilter === "sources"
          ? note.type === "source"
          : note.type !== "source")) &&
      (typeFilter === "all" || note.type === typeFilter) &&
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
    { id: "all", label: "All memories" },
    ...(props.chatId
      ? [
          {
            id: `chat:${props.chatId}`,
            label: props.chatName ?? "Current chat",
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
      label: `${group.label} branches`,
      scope: { groupId: group.id, chatIds: group.chatIds },
    })),
    ...(scopeTargets.data?.characters ?? []).map((character) => ({
      id: `character:${character.id}`,
      label:
        character.label === character.id
          ? "Character"
          : `Character: ${character.label}`,
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
        allNotes.find((note) => note.id === id)?.title?.trim() || "Source memory"
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

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!openedNoteId) return;
    void request<LtmNote>(`/notes/${encodeURIComponent(openedNoteId)}`)
      .then(openNote)
      .catch(() => setError("The requested memory is no longer available."));
  }, [openedNoteId]);
  useEffect(() => {
    if (!recoveryHandoff) return;
    const next = recoveredNote(recoveryHandoff);
    setDraft(next);
    setSaved("");
    setIsNew(true);
    setError("");
    setNotice("Review the recovered suggestion before saving.");
    setMobilePane("editor");
  }, [recoveryHandoff?.key]);
  async function confirm(next: string) {
    if (!dirty) return true;
    const options = {
      title: "Discard unsaved memory changes?",
      message: `Your changes will be lost before ${next}.`,
      confirmLabel: "Discard changes",
      tone: "destructive" as const,
    };
    return props.confirmAction
      ? await props.confirmAction(options)
      : window.confirm(`${options.title}\n\n${options.message}`);
  }
  async function selectTarget(next: Target) {
    if (!(await confirm(`opening ${next.label}`))) return;
    setTarget(next);
    setTargetSearch("");
    setTargetsOpen(false);
    setDraft(null);
    setChecked(new Set());
    setMobilePane("memories");
  }
  async function openNote(note: LtmNote) {
    if (!(await confirm(`opening ${memoryLabel(note)}`))) return;
    const next = clone(note);
    setDraft(next);
    setSaved(fingerprint(next));
    setIsNew(false);
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
    if (!(await confirm("creating a new memory"))) return;
    const next = newNote(target?.scope ?? {});
    setDraft(next);
    setSaved("");
    setIsNew(true);
    setAddOpen(false);
    setDetailsOpen(false);
    setMobilePane("editor");
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      }),
    );
  }
  async function closeDraft() {
    if (!(await confirm("closing this memory"))) return;
    setDraft(null);
    setSaved("");
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
      setError("A memory title is required.");
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
        "Clearing every scope would make this memory global. Use Remove from this chat or another scope-removal action so the memory is safely deleted when its final scope is removed.",
      );
      return;
    }
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
      const next = clone(response.note);
      setDraft(next);
      setSaved(fingerprint(next));
      setIsNew(false);
      setNotice("Memory saved.");
      await invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save memory.",
      );
    } finally {
      setBusy("");
    }
  }
  async function deleteSelected(ids: string[], retract = false) {
    setBusy("delete");
    try {
      const result = await request<{ deletedIds: string[] }>(
        "/notes/permanent-delete",
        "POST",
        { ids, retractExtracted: retract },
      );
      setChecked(new Set());
      setDeleteIds(null);
      setNotice(
        `${result.deletedIds.length} ${result.deletedIds.length === 1 ? "memory" : "memories"} deleted.`,
      );
      await invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update memories.",
      );
    } finally {
      setBusy("");
    }
  }
  async function batch(action: "status" | "modes" | "archive" | "delete") {
    const ids = [...checked];
    if (!ids.length) return;
    const includesSource = ids.some(
      (id) => allNotes.find((note) => note.id === id)?.type === "source",
    );
    if (action === "delete" && includesSource) {
      setRetractExtracted(false);
      setDeleteIds(ids);
      return;
    }
    if (
      action === "delete" &&
      !(props.confirmAction
        ? await props.confirmAction({
            title: "Permanently delete selected memories?",
            message: "This cannot be undone.",
            confirmLabel: "Delete permanently",
            tone: "destructive",
          })
        : window.confirm("Permanently delete selected memories?"))
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
      const unresolved = new Set([
        ...result.skippedNoteIds,
        ...result.failedNoteIds,
      ]);
      setChecked(unresolved);
      const unresolvedLabel = unresolved.size
        ? `; ${result.skippedNoteIds.length} skipped, ${result.failedNoteIds.length} failed`
        : "";
      const message = `${result.updatedNoteIds.length} ${result.updatedNoteIds.length === 1 ? "memory" : "memories"} updated${unresolvedLabel}.`;
      if (unresolved.size) {
        setNotice("");
        setError(message);
      } else {
        setNotice(message);
        setError("");
      }
      await invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update memories.",
      );
    } finally {
      setBusy("");
    }
  }
  async function removeFromCurrentChat() {
    if (!draft || !props.chatId) return;
    const unsavedWarning = dirty
      ? " Your unsaved edits will also be lost."
      : "";
    const confirmed = props.confirmAction
      ? await props.confirmAction({
          title: dirty
            ? "Remove memory and discard unsaved edits?"
            : "Remove memory from this chat?",
          message: `This removes only the current chat scope. The memory will be deleted if no other explicit scope remains.${unsavedWarning}`,
          confirmLabel: "Remove from chat",
          tone: "destructive",
        })
      : window.confirm(
          `Remove this memory from the current chat? It will be deleted if no other explicit scope remains.${unsavedWarning}`,
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
      if (result.deleted) {
        setDraft(null);
        setSaved("");
        setMobilePane("memories");
        setNotice("Memory removed from this chat and deleted.");
      } else if (result.note) {
        const next = clone(result.note);
        setDraft(next);
        setSaved(fingerprint(next));
        setNotice(
          result.unscoped
            ? "Memory removed from this chat."
            : "Memory was not linked to this chat.",
        );
      }
      await invalidate();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not remove memory from this chat.",
      );
    } finally {
      setBusy("");
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
        text: "New memory section.",
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
          : "Linked memory could not load.",
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
      aria-label="Memory vault"
    >
      <style>{`
        @media (min-width: 1280px) {
          [data-ltm-surface="vault"] {
            display: grid;
            grid-template-columns: minmax(17rem, 20rem) minmax(0, 1fr);
            grid-template-areas:
              "header header"
              "feedback feedback"
              "controls workbench"
              "bulk workbench"
              "list workbench";
            align-items: start;
            gap: 1rem;
          }
          [data-ltm-vault-header] {
            grid-area: header;
          }
          [data-ltm-vault-feedback] {
            grid-area: feedback;
            display: block;
          }
          [data-ltm-browser-controls] {
            grid-area: controls;
            grid-template-columns: minmax(0, 1fr);
          }
          [data-ltm-browser-controls] > * {
            grid-column: 1;
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
          [data-ltm-note-inspector] {
            border-left: 1px solid var(--border);
            padding-left: 1rem;
          }
          [data-ltm-inspector-tokens],
          [data-ltm-inspector-fields] {
            grid-template-columns: minmax(0, 1fr);
          }
          [data-ltm-inspector-tokens] {
            border-top: 0;
            padding-top: 0;
          }
        }
      `}</style>
      <header
        data-ltm-vault-header
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="text-base font-semibold">Memory Vault</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Memories linked to the selected chat, branch, or character.
          </p>
        </div>
        <div className="relative">
          <div className="flex gap-2">
            <span className="md:hidden">
              <Button
                onClick={() => {
                  setSelectionMode((value) => !value);
                  if (selectionMode) setChecked(new Set());
                }}
              >
                {selectionMode ? "Done" : "Select"}
              </Button>
            </span>
            <Button
              primary
              onClick={() => setAddOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={addOpen}
            >
              <FilePlus2 size="0.875rem" />
              Add memories
            </Button>
          </div>
          {addOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-72 space-y-1 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 shadow-lg"
            >
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  onOpenSources?.();
                }}
                className="w-full rounded-md p-3 text-left hover:bg-[var(--accent)]"
              >
                <strong className="block text-sm">Import sources</strong>
                <span className="text-xs text-[var(--muted-foreground)]">
                  Characters, lorebooks, and chat summaries
                </span>
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => void startNew()}
                className="w-full rounded-md p-3 text-left hover:bg-[var(--accent)]"
              >
                <strong className="block text-sm">Create manually</strong>
                <span className="text-xs text-[var(--muted-foreground)]">
                  One-off durable context
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div
        role="tablist"
        aria-label="Memory workspace"
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
            className={`min-h-11 rounded-md px-2 text-xs font-semibold capitalize disabled:opacity-40 ${mobilePane === pane ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
          >
            {pane}
          </button>
        ))}
      </div>
      <section
        data-ltm-browser-controls
        className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_10rem]"
      >
        <div className="relative sm:col-span-4">
          <input
            className={inputClass}
            value={targetSearch || target?.label || ""}
            onFocus={() => setTargetsOpen(true)}
            onChange={(event) => {
              setTargetSearch(event.target.value);
              setTargetsOpen(true);
            }}
            placeholder="Search linked chats, branches, and characters"
            aria-label="Choose memory scope"
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
                  No linked memory scopes found.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <label className="relative block">
          <Search
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-3.5 text-[var(--muted-foreground)]"
          />
          <input
            className={`${inputClass} px-9`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search memories"
            aria-label="Search memories"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear memory search"
              onClick={() => setSearch("")}
              className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
            >
              <X size="0.875rem" />
            </button>
          ) : null}
        </label>
        <select
          className={inputClass}
          value={kindFilter}
          onChange={(event) => {
            setKindFilter(event.target.value as "all" | "durable" | "sources");
            setTypeFilter("all");
          }}
          aria-label="Filter by memory kind"
        >
          <option value="all">All</option>
          <option value="durable">Durable memories</option>
          <option value="sources">Sources</option>
        </select>
        <select
          className={inputClass}
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as LtmNoteType | "all")
          }
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          {noteTypes.map((type) => (
            <option key={type} value={type}>
              {title(type)}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as LtmStatus | "all")
          }
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {humanizeLabel(status)}
            </option>
          ))}
        </select>
      </section>
      {error || notice ? (
        <div data-ltm-vault-feedback className="contents">
          {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
          {notice ? (
            <StatusSurface tone="success">{notice}</StatusSurface>
          ) : null}
        </div>
      ) : null}
      <section
        data-ltm-bulk-actions
        className={`${selectionMode ? "flex" : "hidden"} flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-3 md:flex`}
      >
        <label className="flex min-h-11 items-center gap-2 text-xs">
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
          Select visible
        </label>
        <span
          data-ltm-selection-count
          className="text-xs text-[var(--muted-foreground)]"
        >
          {checked.size} selected
          {hiddenChecked ? `, ${hiddenChecked} hidden by filters` : ""}
        </span>
        {checked.size ? (
          <>
            <select
              className={inputClass}
              value={bulkStatus}
              onChange={(event) =>
                setBulkStatus(event.target.value as LtmStatus)
              }
              aria-label="Set status"
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
              Set status
            </Button>
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">Set retrieval modes</legend>
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
              Set modes
            </Button>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void batch("archive")}
            >
              <Archive size="0.875rem" />
              Archive
            </Button>
            <Button
              destructive
              disabled={Boolean(busy)}
              onClick={() => void batch("delete")}
            >
              <Trash2 size="0.875rem" />
              Delete
            </Button>
          </>
        ) : null}
      </section>
      {deleteIds ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ltm-delete-title"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <section className="w-full max-w-md space-y-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl">
            <div className="space-y-1">
              <h3 id="ltm-delete-title" className="text-base font-semibold">
                Permanently delete selected memories?
              </h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                This cannot be undone.
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
                Also delete memories extracted from the selected source
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button
                disabled={Boolean(busy)}
                onClick={() => setDeleteIds(null)}
              >
                Cancel
              </Button>
              <Button
                destructive
                disabled={Boolean(busy)}
                onClick={() => void deleteSelected(deleteIds, retractExtracted)}
              >
                <Trash2 size="0.875rem" />
                Delete permanently
              </Button>
            </div>
          </section>
        </div>
      ) : null}
      <div
        data-ltm-vault-workspace
        className="grid min-h-0 min-w-0 gap-4 md:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.25fr)]"
      >
        <section
          data-ltm-memory-list
          className={`${mobilePane === "memories" ? "block" : "hidden"} min-w-0 rounded-lg border border-[var(--border)] md:block`}
          aria-label="Memory list"
        >
          <p className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {visible.length} shown
          </p>
          {notes.isLoading ? (
            <StatusSurface busy>Loading memories...</StatusSurface>
          ) : null}
          {notes.isError ? (
            <StatusSurface tone="danger">
              Memories could not load.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void notes.refetch()}
              >
                Retry
              </button>
            </StatusSurface>
          ) : null}
          {groupedNoteTypes.map(({ type, label }) => {
            const group = visible.filter((note) => note.type === type);
            if (!group.length) return null;
            return (
              <details
                key={type}
                open
                className="group"
                data-ltm-memory-group={type}
              >
                <summary className="flex min-h-10 cursor-pointer items-center gap-2 border-b border-[var(--border)] bg-[var(--secondary)]/35 px-3 text-xs font-semibold">
                  <ChevronRight
                    aria-hidden="true"
                    size="0.875rem"
                    className="transition-transform group-open:rotate-90"
                  />
                  <span>{label}</span>
                  <span className="ml-auto text-[var(--muted-foreground)]">
                    {group.length}
                  </span>
                </summary>
                {group.map((note) => {
                  const notePreview = preview(note, search);
                  return (
                    <div
                      key={note.id}
                      data-ltm-note-type={note.type}
                      data-ltm-note-source={note.type === "source" || undefined}
                      className={`flex min-w-0 gap-2 border-b border-[var(--border)]/70 p-2 ${draft?.id === note.id ? "bg-[var(--accent)]/55" : ""}`}
                    >
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
                          aria-label={`Select ${memoryLabel(note)}`}
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
                          <ChevronRight size="0.875rem" className="shrink-0" />
                        </span>
                        <span className="mt-1 flex gap-1 text-[0.6875rem]">
                          <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5">
                            {title(note.type)}
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
                    </div>
                  );
                })}
              </details>
            );
          })}
          {!notes.isLoading && !notes.isError && !visible.length ? (
            <p className="p-5 text-center text-xs text-[var(--muted-foreground)]">
              No memories match these filters.
            </p>
          ) : null}
        </section>
        <section
          ref={detailRef}
          tabIndex={-1}
          data-ltm-note-workbench
          className={`${mobilePane === "memories" ? "hidden" : "block"} min-w-0 scroll-mt-20 rounded-lg border border-[var(--border)] p-3 md:block`}
          aria-label="Memory editor"
        >
          {!draft ? (
            <div className="flex min-h-52 items-center justify-center text-center text-sm text-[var(--muted-foreground)]">
              Open a memory for details, or add one.
            </div>
          ) : (
            <div className="space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {isNew ? "New memory" : "Memory details"}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Changes are saved from this editor.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setDetailsOpen((value) => {
                        const next = !value;
                        setMobilePane(next ? "details" : "editor");
                        return next;
                      });
                    }}
                    aria-pressed={detailsOpen}
                    data-ltm-details-toggle
                    aria-label={detailsOpen ? "Hide metadata" : "Show metadata"}
                    title={detailsOpen ? "Hide metadata" : "Show metadata"}
                    className="hidden min-w-11 px-0 aria-pressed:bg-[var(--accent)] md:inline-flex"
                  >
                    <PanelRight aria-hidden="true" size="0.875rem" />
                  </Button>
                  <Button
                    primary
                    disabled={!dirty || busy === "save"}
                    onClick={() => void save()}
                  >
                    <Check size="0.875rem" />
                    {busy === "save" ? "Saving" : "Save"}
                  </Button>
                  <Button onClick={() => void closeDraft()}>Close</Button>
                </div>
              </header>
              <div
                data-ltm-note-layout
                className={`min-w-0 ${detailsOpen ? "md:flex" : ""}`}
                style={detailsOpen ? { columnGap: "1rem" } : undefined}
              >
                <div
                  data-ltm-note-editor
                  className={
                    mobilePane === "details"
                      ? "hidden space-y-4 md:block"
                      : "space-y-4"
                  }
                  style={detailsOpen ? { flex: "1 1 0%", minWidth: 0 } : undefined}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium">
                      Title
                      <input
                        className={inputClass}
                        value={draft.title ?? ""}
                        onChange={(event) =>
                          update("title", event.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Status
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
                        Type
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
                              {title(type)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="self-end text-xs text-[var(--muted-foreground)]">
                        {title(draft.type)} memory
                      </p>
                    )}
                    <fieldset className="sm:col-span-2">
                      <legend className="text-xs font-medium">
                        Available modes
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
                        Memory sections
                      </h4>
                      {draft.type !== "source" ? (
                        <>
                          <input
                            className={`${inputClass} w-40`}
                            value={sectionKey}
                            onChange={(event) =>
                              setSectionKey(event.target.value)
                            }
                            placeholder="new_section"
                            aria-label="New section name"
                          />
                          <Button
                            onClick={addSection}
                            disabled={!sectionKey.trim()}
                          >
                            Add section
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
                            {title(key)}
                          </label>
                          {draft.type !== "source" ? (
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...draft.sections };
                                delete next[key];
                                update("sections", next);
                              }}
                              aria-label={`Remove ${key} section`}
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
                            label="Evidence"
                            values={section.evidence ?? []}
                            placeholder="Add evidence"
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
                  aria-label="Memory inspector"
                  style={detailsOpen ? { flex: "0 0 18rem" } : undefined}
                  className={
                    detailsOpen || mobilePane === "details"
                      ? mobilePane === "editor"
                        ? "hidden md:block"
                        : "contents md:block"
                      : "hidden"
                  }
                >
                  <section className="space-y-3 border-t border-[var(--border)] pt-4">
                    <h4 className="text-xs font-medium">Section metadata</h4>
                    {Object.entries(draft.sections).map(([key, section]) => (
                      <fieldset key={key} className="space-y-2">
                        <legend className="text-xs font-semibold">
                          {title(key)}
                        </legend>
                        <div className="grid gap-2">
                          <label className="text-xs">
                            Importance
                            <select
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
                              <option value="">Not set</option>
                              {["critical", "major", "moderate", "minor"].map(
                                (value) => (
                                  <option key={value} value={value}>
                                    {humanizeLabel(value)}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <NumberField
                            label="Confidence"
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
                            label="Salience"
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
                      label="Tags"
                      values={draft.tags}
                      placeholder="lowercase_tag"
                      onChange={(values) => update("tags", values)}
                    />
                    <TokenEditor
                      label="Keywords"
                      values={draft.keywords}
                      placeholder="Add keyword"
                      onChange={(values) => update("keywords", values)}
                    />
                  </div>
                  <section className="space-y-2 border-t border-[var(--border)] pt-4">
                    <h4 className="text-xs font-medium">Scope</h4>
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
                        placeholder="Add another chat"
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
                        placeholder="Add another character"
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
                    <h4 className="text-xs font-medium">Linked memories</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {draft.links.map((link, index) => (
                        <Pill
                          key={`${link.target}-${link.relation}-${index}`}
                          label={`${humanizeLabel(link.relation)} ${memoryLabel(allNotes.find((note) => note.id === link.target))}`}
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
                        placeholder="Search or enter a memory"
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
                        Link
                      </Button>
                    </div>
                  </section>
                  {draft.type === "character" ||
                  draft.type === "relationship" ? (
                    <section className="space-y-2 border-t border-[var(--border)] pt-4">
                      <h4 className="text-xs font-medium">Subjects</h4>
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
                          placeholder="character:id or persona:id"
                        />
                        <Button
                          onClick={addSubject}
                          disabled={
                            !subjectKey.trim() ||
                            (draft.subjects?.length ?? 0) >=
                              (draft.type === "character" ? 1 : 2)
                          }
                        >
                          Add
                        </Button>
                      </div>
                    </section>
                  ) : null}
                  {draft.conflicts?.length ? (
                    <section className="space-y-2 border-t border-[var(--border)] pt-4">
                      <h4 className="text-xs font-medium">Conflicts</h4>
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
                        Created
                      </dt>
                      <dd>{new Date(draft.createdAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[var(--foreground)]">
                        Updated
                      </dt>
                      <dd>{new Date(draft.updatedAt).toLocaleString()}</dd>
                    </div>
                    {draft.provenance ? (
                      <div>
                        <dt className="font-medium text-[var(--foreground)]">
                          Provenance
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
                          ? "Removing"
                          : "Remove from current chat"}
                      </Button>
                    </div>
                  ) : null}
                </aside>
              </div>
              {draft.type === "source" ? (
                <section className="space-y-2 border-t border-[var(--border)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-medium">
                      Derived memories across all scopes
                    </h4>
                    {sourceDerivedQuery.isSuccess ? (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {sourceDerived.length} linked here
                      </span>
                    ) : null}
                  </div>
                  {sourceDerivedQuery.isLoading ? (
                    <StatusSurface busy>
                      Loading derived memories.
                    </StatusSurface>
                  ) : null}
                  {sourceDerivedQuery.isError ? (
                    <StatusSurface tone="danger">
                      <span>
                        Derived memories could not load.{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => void sourceDerivedQuery.refetch()}
                        >
                          Retry
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
                          {title(note.type)}
                        </span>
                      </span>
                      <ChevronRight size="0.875rem" className="shrink-0" />
                    </button>
                  ))}
                  {sourceDerivedQuery.isSuccess && !sourceDerived.length ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No saved memories link to this source yet.
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
                        setNotice(
                          "Extraction finished. Review Queue has the results.",
                        );
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Extraction failed.",
                        );
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    <RefreshCw size="0.875rem" />
                    Extract to review
                  </Button>
                  <Button onClick={() => onOpenReview?.(draft.id)}>
                    Review related drafts
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
