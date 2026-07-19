import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronRight,
  FilePlus2,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  LtmLink,
  LtmMode,
  LtmNote,
  LtmNoteType,
  LtmScope,
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
  memoryLabel,
  noteTypeLabel,
  scopeTargetLabel,
} from "./display-labels";

const noteTypes: readonly LtmNoteType[] = [
  "source",
  "timeline_event",
  "character",
  "relationship",
  "scene",
  "thread",
  "world",
  "tone",
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
type Target = { id: string; label: string; scope: LtmScope };
type NoteResponse = { note: LtmNote };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function fingerprint(note: LtmNote | null) {
  return note ? JSON.stringify(note) : "";
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

function Pill({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-md bg-[var(--secondary)] px-2 text-xs text-[var(--foreground)]">
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${String(children)}`}
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
  onChange,
}: {
  label: string;
  values: string[];
  placeholder: string;
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
            onRemove={() => onChange(values.filter((value) => value !== item))}
          >
            {item}
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
  openedNoteId,
}: LongTermMemoryDestinationProps) {
  const client = useQueryClient();
  const detailRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [typeFilter, setTypeFilter] = useState<LtmNoteType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LtmStatus | "all">("all");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<LtmNote | null>(null);
  const [saved, setSaved] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bulkStatus, setBulkStatus] = useState<LtmStatus>("active");
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
    if (!target && scopeTargets.data?.currentScope)
      setTarget({
        id: "current",
        label: props.chatName ?? "Current chat",
        scope: scopeTargets.data.currentScope,
      });
  }, [scopeTargets.data, target, props.chatName]);
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
          ...(target?.scope.chatIds?.length
            ? { scopeChatIds: target.scope.chatIds.join(",") }
            : {}),
          ...(target?.scope.groupId
            ? { scopeGroupId: target.scope.groupId }
            : {}),
          ...(target?.scope.characterIds?.length
            ? { scopeCharacterIds: target.scope.characterIds.join(",") }
            : {}),
          includeGlobal: "false",
        })}`,
      ),
  });
  const allNotes = [...(notes.data ?? [])].sort((left, right) =>
    (left.title ?? left.id).localeCompare(right.title ?? right.id),
  );
  const visible = allNotes.filter(
    (note) =>
      (typeFilter === "all" || note.type === typeFilter) &&
      (statusFilter === "all" || note.status === statusFilter) &&
      (!search.trim() ||
        searchable(note).includes(search.trim().toLocaleLowerCase())),
  );
  const dirty = Boolean(draft) && fingerprint(draft) !== saved;
  const targets: Target[] = [
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
      label: `Character: ${character.label}`,
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

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!openedNoteId) return;
    void request<LtmNote>(`/notes/${encodeURIComponent(openedNoteId)}`)
      .then(openNote)
      .catch(() => setError("The requested memory is no longer available."));
  }, [openedNoteId]);
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
  async function openNote(note: LtmNote) {
    if (!(await confirm(`opening ${memoryLabel(note)}`))) return;
    const next = clone(note);
    setDraft(next);
    setSaved(fingerprint(next));
    setIsNew(false);
    setError("");
    setNotice("");
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
              ...note
            }) => note)(draft),
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
  async function batch(action: "status" | "archive" | "delete") {
    const ids = [...checked];
    if (!ids.length) return;
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
    setBusy(action);
    try {
      if (action === "delete")
        await request("/notes/permanent-delete", "POST", { ids });
      else
        await request("/notes/batch", "POST", {
          noteIds: ids,
          ...(action === "archive"
            ? { archive: "notes_only" }
            : { status: bulkStatus }),
        });
      setChecked(new Set());
      setNotice(
        `${ids.length} ${ids.length === 1 ? "memory was" : "memories were"} updated.`,
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Memory Vault</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Memories linked to the selected chat, branch, or character.
          </p>
        </div>
        <div className="relative">
          <Button
            primary
            onClick={() => setAddOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={addOpen}
          >
            <FilePlus2 size="0.875rem" />
            Add memories
          </Button>
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
      <section className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <div className="relative sm:col-span-3">
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
          />
          {targetsOpen ? (
            <div
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-1 shadow-lg"
            >
              {matchingTargets.map((candidate) => (
                <button
                  key={candidate.id}
                  role="option"
                  aria-selected={candidate.id === target?.id}
                  type="button"
                  onClick={() => {
                    setTarget(candidate);
                    setTargetSearch("");
                    setTargetsOpen(false);
                    setDraft(null);
                  }}
                  className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
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
            className={`${inputClass} pl-9`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search memories"
            aria-label="Search memories"
          />
        </label>
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
            <option key={status}>{status}</option>
          ))}
        </select>
      </section>
      {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
      {notice ? <StatusSurface tone="success">{notice}</StatusSurface> : null}
      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-3">
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
                  ? new Set(visible.map((note) => note.id))
                  : new Set(),
              )
            }
          />
          Select visible
        </label>
        <span className="text-xs text-[var(--muted-foreground)]">
          {checked.size} selected
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
                <option key={status}>{status}</option>
              ))}
            </select>
            <Button
              disabled={Boolean(busy)}
              onClick={() => void batch("status")}
            >
              Set status
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
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(17rem,0.75fr)_minmax(0,1.25fr)]">
        <section
          data-ltm-memory-list
          className="max-h-[36rem] overflow-y-auto rounded-lg border border-[var(--border)]"
          aria-label="Memory list"
        >
          <p className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {visible.length} shown
          </p>
          {notes.isLoading ? (
            <StatusSurface busy>Loading memories...</StatusSurface>
          ) : null}
          {visible.map((note) => (
            <div
              key={note.id}
              data-ltm-note-type={note.type}
              data-ltm-note-source={note.type === "source" || undefined}
              className={`flex gap-2 border-b border-[var(--border)]/70 p-2 ${draft?.id === note.id ? "bg-[var(--accent)]/55" : ""}`}
            >
              <label className="flex min-h-11 min-w-8 items-center justify-center">
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
                className="min-h-14 min-w-0 flex-1 rounded-md px-2 text-left hover:bg-[var(--accent)]"
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
                    {note.status}
                  </span>
                </span>
              </button>
            </div>
          ))}
          {!notes.isLoading && !visible.length ? (
            <p className="p-5 text-center text-xs text-[var(--muted-foreground)]">
              No memories match these filters.
            </p>
          ) : null}
        </section>
        <section
          ref={detailRef}
          tabIndex={-1}
          data-ltm-note-workbench
          className="scroll-mt-20 rounded-lg border border-[var(--border)] p-3"
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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-medium">
                  Title
                  <input
                    className={inputClass}
                    value={draft.title ?? ""}
                    onChange={(event) => update("title", event.target.value)}
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
                      <option key={status}>{status}</option>
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
                  <p className="text-xs text-[var(--muted-foreground)]">
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
                                ? draft.modes.filter((item) => item !== mode)
                                : [...draft.modes, mode],
                            )
                          }
                        />
                        {mode}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="grid gap-4 border-t border-[var(--border)] pt-4 lg:grid-cols-2">
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
                    <Pill onRemove={() => mutateScope({ groupId: undefined })}>
                      {scopeTargetLabel("group", draft.scope.groupId, targets)}
                    </Pill>
                  ) : null}
                  {draft.scope.personaId ? (
                    <Pill
                      onRemove={() => mutateScope({ personaId: undefined })}
                    >
                      {scopeTargetLabel("persona", draft.scope.personaId, [])}
                    </Pill>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
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
                              ...new Set([...(draft.scope.chatIds ?? []), id]),
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
                      onRemove={() =>
                        update(
                          "links",
                          draft.links.filter((_, item) => item !== index),
                        )
                      }
                    >
                    {link.relation.replaceAll("_", " ")}
                      {" -> "}
                      {memoryLabel(allNotes.find((note) => note.id === link.target))}
                    </Pill>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                  <input
                    className={inputClass}
                    value={linkTarget}
                    onChange={(event) => setLinkTarget(event.target.value)}
                    placeholder="Search or enter a memory"
                  />
                  <select
                    className={inputClass}
                    value={linkRelation}
                    onChange={(event) =>
                      setLinkRelation(event.target.value as LtmLink["relation"])
                    }
                  >
                    {relations.map((relation) => (
                      <option key={relation}>{relation}</option>
                    ))}
                  </select>
                  <Button onClick={addLink} disabled={!linkTarget.trim()}>
                    <Link2 size="0.75rem" />
                    Link
                  </Button>
                </div>
              </section>
              {draft.type === "character" || draft.type === "relationship" ? (
                <section className="space-y-2 border-t border-[var(--border)] pt-4">
                  <h4 className="text-xs font-medium">Subjects</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(draft.subjects ?? []).map((subject, index) => (
                      <Pill
                        key={subject.key}
                        onRemove={() =>
                          update(
                            "subjects",
                            draft.subjects?.filter(
                              (_, item) => item !== index,
                            ) || [],
                          )
                        }
                      >
                        {subject.key}
                      </Pill>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={subjectKey}
                      onChange={(event) => setSubjectKey(event.target.value)}
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
              <section className="space-y-3 border-t border-[var(--border)] pt-4">
                <div className="flex flex-wrap items-end gap-2">
                  <h4 className="mr-auto text-xs font-medium">
                    Memory sections
                  </h4>
                  <input
                    className={`${inputClass} w-40`}
                    value={sectionKey}
                    onChange={(event) => setSectionKey(event.target.value)}
                    placeholder="new_section"
                  />
                  <Button onClick={addSection} disabled={!sectionKey.trim()}>
                    Add section
                  </Button>
                </div>
                {Object.entries(draft.sections).map(([key, section]) => (
                  <article
                    key={key}
                    className="space-y-2 rounded-md border border-[var(--border)] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs">{title(key)}</strong>
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
                    </div>
                    <textarea
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
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="text-xs">
                        Importance
                        <select
                          className={inputClass}
                          value={section.importance ?? ""}
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
                              <option key={value}>{value}</option>
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
                        onChange={(value) =>
                          update("sections", {
                            ...draft.sections,
                            [key]: { ...section, salience: value },
                          })
                        }
                      />
                    </div>
                    <TokenEditor
                      label="Evidence"
                      values={section.evidence ?? []}
                      placeholder="Add evidence"
                      onChange={(evidence) =>
                        update("sections", {
                          ...draft.sections,
                          [key]: { ...section, evidence },
                        })
                      }
                    />
                  </article>
                ))}
              </section>
              {draft.conflicts?.length ? (
                <section className="space-y-2 border-t border-[var(--border)] pt-4">
                  <h4 className="text-xs font-medium">Conflicts</h4>
                  {draft.conflicts.map((conflict, index) => (
                    <article
                      key={`${conflict.field}-${index}`}
                      className="rounded-md bg-[var(--secondary)]/45 p-2 text-xs"
                    >
                      <strong>
                        {conflict.field}: {conflict.resolution}
                      </strong>
                      <p className="mt-1">{conflict.proposed}</p>
                    </article>
                  ))}
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
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
