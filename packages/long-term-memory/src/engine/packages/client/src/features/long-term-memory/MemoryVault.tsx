import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronRight,
  FilePlus2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import type {
  LtmConflict,
  LtmLink,
  LtmMode,
  LtmNote,
  LtmNoteType,
  LtmScope,
  LtmStatus,
  LtmSubject,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { invalidateLtmQueries, queryKeys, request } from "./api";
import { Button, inputClass, StatusSurface } from "./shared-controls";
import type { LongTermMemoryDestinationProps } from "./types";

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
const modes: readonly LtmMode[] = ["roleplay", "conversation", "game"];
const idPrefixes: Record<LtmNoteType, string> = {
  source: "source",
  timeline_event: "timeline",
  character: "char",
  relationship: "rel",
  scene: "scene",
  thread: "thread",
  world: "world",
  tone: "tone",
};

type NoteResponse = { note: LtmNote; rebuild: unknown };
type BatchResponse = {
  status: string;
  updatedNoteIds: string[];
  affectedNoteIds: string[];
  failedNoteIds: string[];
  rebuild: unknown;
};
type DraftReviewResponse = {
  counts?: { drafts?: number; mutations?: number };
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function draftFingerprint(note: LtmNote | null) {
  return note ? JSON.stringify(note) : "";
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2) ?? "";
}

function scopeSummary(scope: LtmScope) {
  const parts = [
    ...(scope.chatIds ?? (scope.chatId ? [scope.chatId] : [])).map(
      (id) => `chat:${id}`,
    ),
    ...(scope.characterIds ?? []).map((id) => `character:${id}`),
    ...(scope.groupId ? [`group:${scope.groupId}`] : []),
    ...(scope.personaId ? [`persona:${scope.personaId}`] : []),
  ];
  return parts.length ? parts.join(", ") : "Global";
}

function sourceLabel(note: LtmNote) {
  if (note.type !== "source") return null;
  if (!note.provenance) return "Source note";
  return `${note.provenance.kind.replaceAll("_", " ")} · ${note.provenance.sourceId}`;
}

function newNote(type: LtmNoteType = "world"): LtmNote {
  const now = new Date().toISOString();
  return {
    id: `${idPrefixes[type]}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    title: "Untitled memory",
    type,
    status: "active",
    modes: ["roleplay"],
    scope: {},
    tags: [],
    keywords: [],
    createdAt: now,
    updatedAt: now,
    links: [],
    sections: {
      facts: { text: "Add the durable memory here.", updatedAt: now },
    },
    conflicts: [],
    version: 1,
  };
}

function JsonField<T>({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  hint?: string;
}) {
  const [text, setText] = useState(() => pretty(value));
  const [error, setError] = useState("");
  const previous = useRef(pretty(value));

  useEffect(() => {
    const next = pretty(value);
    if (previous.current !== next) {
      previous.current = next;
      setText(next);
      setError("");
    }
  }, [value]);

  const commit = () => {
    if (text === previous.current) return;
    try {
      const parsed = JSON.parse(text) as T;
      previous.current = pretty(parsed);
      setError("");
      onChange(parsed);
    } catch {
      setError(`${label} must contain valid JSON.`);
    }
  };

  return (
    <label
      className="block space-y-1"
      data-ltm-field={label.toLowerCase().replaceAll(" ", "-")}
    >
      <span className="text-xs font-medium text-[var(--foreground)]">
        {label}
      </span>
      {hint ? (
        <span className="block text-xs text-[var(--muted-foreground)]">
          {hint}
        </span>
      ) : null}
      <textarea
        className={`${inputClass} min-h-28 py-2 font-mono text-xs`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <span role="alert" className="text-xs text-[var(--destructive)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label
      className="block space-y-1"
      data-ltm-field={label.toLowerCase().replaceAll(" ", "-")}
    >
      <span className="text-xs font-medium text-[var(--foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function MemoryVault({
  props,
  onDirtyChange,
  openedNoteId,
}: LongTermMemoryDestinationProps) {
  const queryClient = useQueryClient();
  const notesQuery = useQuery({
    queryKey: queryKeys.notes,
    queryFn: () => request<LtmNote[]>("/notes"),
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<LtmNoteType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LtmStatus | "all">("all");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<LtmNote | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [bulkStatus, setBulkStatus] = useState<LtmStatus>("active");
  const [bulkModes, setBulkModes] = useState<LtmMode[]>(["roleplay"]);
  const [bulkTags, setBulkTags] = useState("");

  const allNotes = [...(notesQuery.data ?? [])].sort((a, b) => {
    const left = (a.title ?? a.id).toLocaleLowerCase();
    const right = (b.title ?? b.id).toLocaleLowerCase();
    if (left < right) return -1;
    if (left > right) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const term = search.trim().toLocaleLowerCase();
  const visibleNotes = allNotes.filter((note) => {
    const searchable = [
      note.id,
      note.title,
      note.type,
      note.status,
      note.tags.join(" "),
      note.keywords.join(" "),
      Object.values(note.sections)
        .map((section) => section.text)
        .join(" "),
      sourceLabel(note),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return (
      (typeFilter === "all" || note.type === typeFilter) &&
      (statusFilter === "all" || note.status === statusFilter) &&
      (!term || searchable.includes(term))
    );
  });
  const visibleIds = new Set(visibleNotes.map((note) => note.id));
  const selectedVisible = visibleNotes.filter((note) =>
    checkedIds.has(note.id),
  ).length;
  const hiddenSelected = [...checkedIds].filter(
    (id) => !visibleIds.has(id),
  ).length;
  const allVisibleSelected =
    visibleNotes.length > 0 && selectedVisible === visibleNotes.length;
  const partiallyVisibleSelected = selectedVisible > 0 && !allVisibleSelected;
  const dirty = Boolean(draft) && draftFingerprint(draft) !== savedFingerprint;
  const selectedNotes = allNotes.filter((note) => checkedIds.has(note.id));
  const selectedSourceCount = selectedNotes.filter(
    (note) => note.type === "source",
  ).length;
  const derivedArchiveCount = allNotes.filter(
    (note) =>
      !checkedIds.has(note.id) &&
      note.links.some(
        (link) =>
          link.relation === "extracted_from" && checkedIds.has(link.target),
      ),
  ).length;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const confirmDiscard = async (next: string) => {
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
  };

  const openNote = async (note: LtmNote) => {
    if (!(await confirmDiscard(`opening ${note.title ?? note.id}`))) return;
    const next = clone(note);
    setDraft(next);
    setSavedFingerprint(draftFingerprint(next));
    setIsNew(false);
    setError("");
    setNotice("");
  };

  useEffect(() => {
    if (!openedNoteId || !notesQuery.data) return;
    const note = notesQuery.data.find(
      (candidate) => candidate.id === openedNoteId,
    );
    if (note) void openNote(note);
  }, [notesQuery.data, openedNoteId]);

  const startNew = async () => {
    if (!(await confirmDiscard("creating a new memory"))) return;
    const next = newNote();
    setDraft(next);
    setSavedFingerprint("");
    setIsNew(true);
    setError("");
    setNotice("");
  };

  const closeDraft = async () => {
    if (!(await confirmDiscard("closing this memory"))) return;
    setDraft(null);
    setSavedFingerprint("");
  };

  const invalidateNotes = async () =>
    invalidateLtmQueries(queryClient, [
      queryKeys.notes,
      queryKeys.status,
      queryKeys.activity,
    ]);

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title?.trim()) {
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
            (() => {
              const {
                createdAt: _createdAt,
                updatedAt: _updatedAt,
                version: _version,
                ...note
              } = draft;
              return note;
            })(),
          )
        : await request<
            NoteResponse,
            Omit<
              LtmNote,
              | "id"
              | "type"
              | "createdAt"
              | "updatedAt"
              | "version"
              | "provenance"
              | "extractionFingerprint"
              | "extracted"
            >
          >(
            `/notes/${encodeURIComponent(draft.id)}`,
            "PATCH",
            (() => {
              const {
                id: _id,
                type: _type,
                createdAt: _createdAt,
                updatedAt: _updatedAt,
                version: _version,
                provenance: _provenance,
                extractionFingerprint: _extractionFingerprint,
                extracted: _extracted,
                ...note
              } = draft;
              return note;
            })(),
          );
      const next = clone(response.note);
      setDraft(next);
      setSavedFingerprint(draftFingerprint(next));
      setIsNew(false);
      setNotice("Memory saved and its recall indexes were queued for rebuild.");
      await invalidateNotes();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save memory.",
      );
    } finally {
      setBusy("");
    }
  };

  const mutateBatch = async (
    payload: Omit<Record<string, unknown>, "noteIds">,
    label: string,
  ) => {
    const ids = [...checkedIds];
    if (!ids.length) return;
    setBusy("batch");
    setError("");
    try {
      const results: BatchResponse[] = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        results.push(
          await request<BatchResponse, Record<string, unknown>>(
            "/notes/batch",
            "POST",
            { noteIds: ids.slice(offset, offset + 100), ...payload },
          ),
        );
      }
      const failed = results.flatMap((result) => result.failedNoteIds);
      const updated = new Set(
        results.flatMap((result) => result.updatedNoteIds),
      );
      setCheckedIds((current) => {
        const next = new Set(current);
        updated.forEach((id) => next.delete(id));
        return next;
      });
      setNotice(
        failed.length
          ? `${label} completed with ${failed.length} unavailable note(s).`
          : `${label} applied to ${ids.length} selected ${ids.length === 1 ? "memory" : "memories"}.`,
      );
      await invalidateNotes();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Could not ${label.toLowerCase()}.`,
      );
    } finally {
      setBusy("");
    }
  };

  const archiveSelected = async () => {
    if (!checkedIds.size) return;
    const warning = derivedArchiveCount
      ? ` This also archives ${derivedArchiveCount} derived ${derivedArchiveCount === 1 ? "memory" : "memories"} linked to selected source notes.`
      : "";
    const accepted = props.confirmAction
      ? await props.confirmAction({
          title: "Archive selected memories?",
          message: `Archive ${checkedIds.size} selected memor${checkedIds.size === 1 ? "y" : "ies"}?${warning}`,
          confirmLabel: "Archive",
        })
      : window.confirm(`Archive selected memories?${warning}`);
    if (accepted)
      await mutateBatch(
        { archive: derivedArchiveCount ? "with_derived" : "notes_only" },
        "Archive",
      );
  };

  const permanentlyDelete = async () => {
    if (!checkedIds.size) return;
    const accepted = props.confirmAction
      ? await props.confirmAction({
          title: "Permanently delete selected memories?",
          message: `This permanently deletes ${checkedIds.size} selected memor${checkedIds.size === 1 ? "y" : "ies"} and cannot be undone.`,
          confirmLabel: "Delete permanently",
          tone: "destructive",
        })
      : window.confirm(
          "Permanently delete selected memories? This cannot be undone.",
        );
    if (!accepted) return;
    setBusy("delete");
    setError("");
    try {
      const ids = [...checkedIds];
      const failed = new Set<string>();
      for (let offset = 0; offset < ids.length; offset += 100) {
        const result = await request<
          { deletedIds: string[]; failedIds: string[] },
          { ids: string[] }
        >("/notes/permanent-delete", "POST", {
          ids: ids.slice(offset, offset + 100),
        });
        result.failedIds.forEach((id) => failed.add(id));
      }
      setCheckedIds(failed);
      if (draft && ids.includes(draft.id) && !failed.has(draft.id)) {
        setDraft(null);
        setSavedFingerprint("");
      }
      setNotice(
        failed.size
          ? `Deleted available memories. ${failed.size} unavailable selection${failed.size === 1 ? " remains" : "s remain"}.`
          : "Selected memories were permanently deleted.",
      );
      await invalidateNotes();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not permanently delete memories.",
      );
    } finally {
      setBusy("");
    }
  };

  const extractSource = async () => {
    if (!draft || draft.type !== "source") return;
    setBusy("extract");
    setError("");
    try {
      await request<unknown, Record<string, never>>(
        `/notes/${encodeURIComponent(draft.id)}/extract`,
        "POST",
        {},
      );
      setNotice(
        "Extraction finished. Open Review Queue to inspect the generated draft.",
      );
      await invalidateLtmQueries(queryClient, [
        queryKeys.notes,
        queryKeys.status,
        queryKeys.review,
        queryKeys.pendingDrafts,
        queryKeys.activity,
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not extract this source note.",
      );
    } finally {
      setBusy("");
    }
  };

  const applySourceScope = async () => {
    if (!draft || draft.type !== "source") return;
    const chatIds = [
      ...new Set([
        ...(draft.scope.chatIds ?? []),
        ...(draft.scope.chatId ? [draft.scope.chatId] : []),
      ]),
    ];
    const characterIds = draft.scope.characterIds ?? [];
    if (!chatIds.length && !characterIds.length) {
      setError(
        "Add a chat or character scope link before applying scope to derived memories.",
      );
      return;
    }
    setBusy("scope");
    setError("");
    try {
      await request<unknown, { chatIds?: string[]; characterIds?: string[] }>(
        `/notes/${encodeURIComponent(draft.id)}/scope/apply-to-derived`,
        "POST",
        {
          ...(chatIds.length ? { chatIds } : {}),
          ...(characterIds.length ? { characterIds } : {}),
        },
      );
      setNotice("Source scope links were applied to its derived memories.");
      await invalidateNotes();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not apply source scope.",
      );
    } finally {
      setBusy("");
    }
  };

  const checkSourceReview = async () => {
    if (!draft || draft.type !== "source") return;
    setBusy("review");
    setError("");
    try {
      const review = await request<DraftReviewResponse>(
        `/drafts/review?sourceNoteId=${encodeURIComponent(draft.id)}`,
      );
      const drafts = review.counts?.drafts ?? 0;
      const mutations = review.counts?.mutations ?? 0;
      setNotice(
        drafts
          ? `${drafts} review draft${drafts === 1 ? "" : "s"} with ${mutations} mutation${mutations === 1 ? "" : "s"} are available in Review Queue.`
          : "No review draft is available for this source note yet.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not check this source note's review status.",
      );
    } finally {
      setBusy("");
    }
  };

  const toggleChecked = (id: string) =>
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllVisible = () =>
    setCheckedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected)
        visibleNotes.forEach((note) => next.delete(note.id));
      else visibleNotes.forEach((note) => next.add(note.id));
      return next;
    });
  const updateDraft = <K extends keyof LtmNote>(key: K, value: LtmNote[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const toggleDraftMode = (mode: LtmMode) => {
    if (!draft) return;
    const next = draft.modes.includes(mode)
      ? draft.modes.filter((item) => item !== mode)
      : [...draft.modes, mode];
    if (next.length) updateDraft("modes", next);
  };
  const parsedTags = bulkTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

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
            Search, edit, and organize durable memories.
          </p>
        </div>
        <Button primary onClick={() => void startNew()}>
          <FilePlus2 aria-hidden="true" size="0.875rem" />
          New memory
        </Button>
      </header>

      <section
        data-ltm-vault-controls
        className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/25 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]"
      >
        <label className="relative block">
          <Search
            aria-hidden="true"
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-3.5 text-[var(--muted-foreground)]"
          />
          <input
            className={`${inputClass} pl-9`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search memories, tags, and content"
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
              {type.replaceAll("_", " ")}
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
              {status}
            </option>
          ))}
        </select>
      </section>

      {notesQuery.isLoading ? (
        <StatusSurface busy>Loading memories...</StatusSurface>
      ) : null}
      {notesQuery.isError ? (
        <StatusSurface tone="danger">
          The memory vault could not load.{" "}
          <button
            type="button"
            onClick={() => void notesQuery.refetch()}
            className="underline"
          >
            Retry
          </button>
        </StatusSurface>
      ) : null}
      {error ? <StatusSurface tone="danger">{error}</StatusSurface> : null}
      {notice ? <StatusSurface tone="success">{notice}</StatusSurface> : null}

      <section
        data-ltm-bulk-actions
        className="space-y-3 rounded-lg border border-[var(--border)] p-3"
        aria-label="Bulk memory actions"
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(element) => {
                if (element) element.indeterminate = partiallyVisibleSelected;
              }}
              onChange={toggleAllVisible}
              aria-label="Select all visible memories"
            />
            Select visible
          </label>
          <span
            data-ltm-selection-count
            className="text-xs text-[var(--muted-foreground)]"
          >
            {checkedIds.size} selected
            {hiddenSelected ? `, ${hiddenSelected} hidden by filters` : ""}
          </span>
          {checkedIds.size ? (
            <Button onClick={() => setCheckedIds(new Set())}>Clear all</Button>
          ) : null}
        </div>
        {checkedIds.size ? (
          <div className="grid gap-2 border-t border-[var(--border)] pt-3 lg:grid-cols-2">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Set status">
                <select
                  className={inputClass}
                  value={bulkStatus}
                  onChange={(event) =>
                    setBulkStatus(event.target.value as LtmStatus)
                  }
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Button
                disabled={busy === "batch"}
                onClick={() =>
                  void mutateBatch({ status: bulkStatus }, "Status update")
                }
              >
                Set status
              </Button>
              <Button
                disabled={busy === "batch"}
                onClick={() => void archiveSelected()}
              >
                <Archive aria-hidden="true" size="0.875rem" />
                Archive{selectedSourceCount ? " + derived" : ""}
              </Button>
              <Button
                destructive
                disabled={busy === "delete"}
                onClick={() => void permanentlyDelete()}
              >
                <Trash2 aria-hidden="true" size="0.875rem" />
                Delete
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Modes">
                <span className="flex min-h-11 items-center gap-2">
                  {modes.map((mode) => (
                    <label
                      key={mode}
                      className="flex min-h-11 items-center gap-1 text-xs"
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
                      {mode}
                    </label>
                  ))}
                </span>
              </Field>
              <Button
                disabled={!bulkModes.length || busy === "batch"}
                onClick={() =>
                  void mutateBatch({ modes: bulkModes }, "Mode update")
                }
              >
                Set modes
              </Button>
              <Field label="Tags">
                <input
                  className={inputClass}
                  value={bulkTags}
                  onChange={(event) => setBulkTags(event.target.value)}
                  placeholder="comma-separated"
                />
              </Field>
              <Button
                disabled={!parsedTags.length || busy === "batch"}
                onClick={() =>
                  void mutateBatch({ addTags: parsedTags }, "Tag addition")
                }
              >
                Add tags
              </Button>
              <Button
                disabled={!parsedTags.length || busy === "batch"}
                onClick={() =>
                  void mutateBatch({ removeTags: parsedTags }, "Tag removal")
                }
              >
                Remove tags
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.4fr)]">
        <section
          data-ltm-memory-list
          className="overflow-hidden rounded-lg border border-[var(--border)]"
          aria-label="Memory list"
        >
          <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {visibleNotes.length} shown, sorted by title
          </div>
          <div className="max-h-[34rem] overflow-y-auto">
            {visibleNotes.map((note) => {
              const source = sourceLabel(note);
              return (
                <div
                  key={note.id}
                  data-ltm-note-type={note.type}
                  data-ltm-note-source={note.type === "source" || undefined}
                  className={`flex gap-2 border-b border-[var(--border)]/70 p-2 last:border-0 ${draft?.id === note.id && !isNew ? "bg-[var(--accent)]/55" : ""}`}
                >
                  <label className="mt-1 flex min-h-11 min-w-11 items-center justify-center">
                    <input
                      className="h-4 w-4"
                      type="checkbox"
                      checked={checkedIds.has(note.id)}
                      onChange={() => toggleChecked(note.id)}
                      aria-label={`Select ${note.title ?? note.id}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void openNote(note)}
                    className="min-h-11 min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {note.title ?? note.id}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        size="0.875rem"
                        className="shrink-0 text-[var(--muted-foreground)]"
                      />
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1 text-[0.6875rem]">
                      <span
                        data-ltm-note-kind
                        className={`rounded px-1.5 py-0.5 ${note.type === "source" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}
                      >
                        {note.type.replaceAll("_", " ")}
                      </span>
                      <span className="rounded bg-[var(--secondary)] px-1.5 py-0.5 text-[var(--muted-foreground)]">
                        {note.status}
                      </span>
                      {source ? (
                        <span
                          data-ltm-provenance
                          className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-300"
                        >
                          {source}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">
                      {scopeSummary(note.scope)}
                    </span>
                  </button>
                </div>
              );
            })}
            {!notesQuery.isLoading && !visibleNotes.length ? (
              <p className="p-5 text-center text-xs text-[var(--muted-foreground)]">
                No memories match these filters.
              </p>
            ) : null}
          </div>
        </section>

        <section
          data-ltm-note-workbench
          className="rounded-lg border border-[var(--border)] p-3"
          aria-label="Memory editor and details"
        >
          {!draft ? (
            <div className="flex min-h-52 items-center justify-center text-center text-sm text-[var(--muted-foreground)]">
              Open a memory for details, or create a new one.
            </div>
          ) : (
            <div className="space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {isNew ? "New memory" : "Memory details"}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Changes are shared by this editor and detail view.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={!dirty || busy === "save"}
                    onClick={() => void saveDraft()}
                    primary
                  >
                    <Check aria-hidden="true" size="0.875rem" />
                    {busy === "save" ? "Saving" : "Save"}
                  </Button>
                  <Button
                    disabled={busy === "save"}
                    onClick={() => void closeDraft()}
                  >
                    Close
                  </Button>
                </div>
              </header>

              <section
                data-ltm-note-details
                className="grid gap-3 sm:grid-cols-2"
              >
                {isNew ? (
                  <Field label="ID">
                    <input
                      className={inputClass}
                      value={draft.id}
                      onChange={(event) =>
                        updateDraft("id", event.target.value)
                      }
                    />
                  </Field>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-[var(--foreground)]">
                      Immutable metadata
                    </p>
                    <p className="mt-1 break-all text-xs text-[var(--muted-foreground)]">
                      ID: {draft.id}
                      <br />
                      Type: {draft.type}
                      <br />
                      Created: {new Date(draft.createdAt).toLocaleString()}
                      <br />
                      Updated: {new Date(draft.updatedAt).toLocaleString()}
                      <br />
                      Version: {draft.version}
                      {draft.provenance ? (
                        <>
                          <br />
                          Provenance: {draft.provenance.kind} /{" "}
                          {draft.provenance.sourceId}
                          {draft.provenance.entryId
                            ? ` / ${draft.provenance.entryId}`
                            : ""}
                        </>
                      ) : null}
                      {draft.extractionFingerprint ? (
                        <>
                          <br />
                          Extraction fingerprint:{" "}
                          {draft.extractionFingerprint.sourceHash.slice(0, 12)}
                          ...
                        </>
                      ) : null}
                    </p>
                  </div>
                )}
                {isNew ? (
                  <Field label="Type">
                    <select
                      className={inputClass}
                      value={draft.type}
                      onChange={(event) => {
                        const type = event.target.value as LtmNoteType;
                        setDraft((current) => {
                          if (!current) return current;
                          return {
                            ...current,
                            type,
                            ...(current.id ===
                            `${idPrefixes[current.type]}_new_note`
                              ? { id: `${idPrefixes[type]}_new_note` }
                              : {}),
                            ...(type === "character" || type === "relationship"
                              ? {}
                              : { subjects: undefined }),
                          };
                        });
                      }}
                    >
                      {noteTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                <Field label="Title">
                  <input
                    className={inputClass}
                    value={draft.title ?? ""}
                    onChange={(event) =>
                      updateDraft("title", event.target.value)
                    }
                  />
                </Field>
                <Field label="Status">
                  <select
                    className={inputClass}
                    value={draft.status}
                    onChange={(event) =>
                      updateDraft("status", event.target.value as LtmStatus)
                    }
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Modes">
                  <span className="flex min-h-11 items-center gap-3">
                    {modes.map((mode) => (
                      <label
                        key={mode}
                        className="flex min-h-11 items-center gap-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={draft.modes.includes(mode)}
                          onChange={() => toggleDraftMode(mode)}
                        />
                        {mode}
                      </label>
                    ))}
                  </span>
                </Field>
                <Field label="Tags">
                  <input
                    className={inputClass}
                    value={draft.tags.join(", ")}
                    onChange={(event) =>
                      updateDraft(
                        "tags",
                        event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="lowercase_snake_case, tags"
                  />
                </Field>
                <Field label="Keywords">
                  <input
                    className={inputClass}
                    value={draft.keywords.join(", ")}
                    onChange={(event) =>
                      updateDraft(
                        "keywords",
                        event.target.value
                          .split(",")
                          .map((keyword) => keyword.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="comma-separated keywords"
                  />
                </Field>
              </section>

              <section
                data-ltm-note-editor
                className="space-y-3 border-t border-[var(--border)] pt-4"
              >
                <JsonField<LtmScope>
                  label="Scope"
                  value={draft.scope}
                  onChange={(value) => updateDraft("scope", value)}
                  hint="chatId/chatIds, groupId, characterIds, and personaId"
                />
                <JsonField<LtmLink[]>
                  label="Structured links"
                  value={draft.links}
                  onChange={(value) => updateDraft("links", value)}
                />
                {draft.type === "character" || draft.type === "relationship" ? (
                  <JsonField<LtmSubject[]>
                    label="Subjects"
                    value={draft.subjects ?? []}
                    onChange={(value) =>
                      updateDraft("subjects", value.length ? value : undefined)
                    }
                    hint="Only character and relationship memories can have subjects."
                  />
                ) : null}
                <JsonField<LtmConflict[] | undefined>
                  label="Conflicts"
                  value={draft.conflicts}
                  onChange={(value) => updateDraft("conflicts", value)}
                />
                <JsonField<LtmNote["sections"]>
                  label="Sections and metadata"
                  value={draft.sections}
                  onChange={(value) => updateDraft("sections", value)}
                  hint="Edit section text plus updatedAt, salience, confidence, importance, dimensions, and evidence."
                />
              </section>

              {draft.type === "source" && !isNew ? (
                <section
                  data-ltm-source-actions
                  className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4"
                >
                  <Button
                    primary
                    disabled={Boolean(busy)}
                    onClick={() => void extractSource()}
                  >
                    <RefreshCw aria-hidden="true" size="0.875rem" />
                    {busy === "extract" ? "Extracting" : "Extract to review"}
                  </Button>
                  <Button
                    disabled={Boolean(busy)}
                    onClick={() => void checkSourceReview()}
                  >
                    Check review
                  </Button>
                  <Button
                    disabled={Boolean(busy)}
                    onClick={() => void applySourceScope()}
                  >
                    Apply scope to derived
                  </Button>
                  <span
                    data-ltm-source-provenance
                    className="self-center text-xs text-[var(--muted-foreground)]"
                  >
                    {sourceLabel(draft) ?? "Source note"}
                  </span>
                </section>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
