import React from "react";
import { Archive, ArchiveRestore, NotebookPen, Pin, Plus, Search, Trash2 } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { useDebouncedSave, usePhoneStore } from "../../platform/use-phone-store";
import { useStoryClock } from "../../platform/story-clock";
import { PhoneEmptyState } from "../../platform/empty-state";

interface Note {
  id: string;
  text: string;
  updatedAt: string;
  pinned?: boolean;
  archivedAt?: string;
  source?: { label: string; url?: string };
}

function noteParts(note: Note) {
  const [first = "", ...rest] = note.text.split("\n");
  return { title: first.trim(), body: rest.join("\n").replace(/^\n/, "") };
}

function noteTitle(note: Note) {
  return noteParts(note).title || "New note";
}

function normalizeNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const note = entry as Partial<Note>;
    if (typeof note.id !== "string" || typeof note.text !== "string") return [];
    return [{
      id: note.id,
      text: note.text,
      updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : new Date(0).toISOString(),
      ...(note.pinned ? { pinned: true } : {}),
      ...(typeof note.archivedAt === "string" ? { archivedAt: note.archivedAt } : {}),
      ...(note.source && typeof note.source.label === "string" ? { source: note.source } : {}),
    }];
  });
}

export function NotesShell({ phoneId, initialNoteId, onBack, onClose }: { phoneId: string; initialNoteId?: string; onBack: () => void; onClose: () => void }) {
  const [query, setQuery] = React.useState("");
  const [library, setLibrary] = React.useState<"notes" | "archive">("notes");
  const store = usePhoneStore(phoneId, "notes");
  const clock = useStoryClock();
  const [notes, setNotes] = React.useState<Note[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(initialNoteId ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const { save } = useDebouncedSave(store, "notes", setError);

  React.useEffect(() => {
    let active = true;
    void store.get("notes").then((value) => {
      if (!active) return;
      const restored = normalizeNotes(value);
      setNotes(restored);
      if (initialNoteId && restored.some((note) => note.id === initialNoteId)) setActiveId(initialNoteId);
    }).catch(() => { if (active) setNotes([]); });
    return () => { active = false; };
  }, [initialNoteId, store]);

  const persist = (next: Note[], immediate = false) => {
    setNotes(next);
    save(next, immediate);
  };
  const activeNote = notes?.find((note) => note.id === activeId) ?? null;
  const updateActive = (patch: Partial<Note>, immediate = false) => {
    if (!notes || !activeId) return;
    persist(notes.map((note) => note.id === activeId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note), immediate);
  };
  const updateText = (part: "title" | "body", value: string) => {
    if (!activeNote) return;
    const current = noteParts(activeNote);
    const title = part === "title" ? value.replace(/\n/g, " ") : current.title;
    const body = part === "body" ? value : current.body;
    updateActive({ text: body ? `${title}\n${body}` : title });
  };
  const addNote = () => {
    if (!notes) return;
    const note: Note = { id: crypto.randomUUID(), text: "", updatedAt: new Date().toISOString() };
    persist([note, ...notes], true);
    setLibrary("notes");
    setActiveId(note.id);
  };
  const archiveActive = () => {
    if (!activeNote) return;
    updateActive({ archivedAt: activeNote.archivedAt ? undefined : new Date().toISOString(), pinned: false }, true);
    setActiveId(null);
  };
  const deleteActive = () => {
    if (!notes || !activeNote || !window.confirm("Delete this note permanently?")) return;
    persist(notes.filter((note) => note.id !== activeNote.id), true);
    setActiveId(null);
  };
  const inLibrary = notes?.filter((note) => library === "archive" ? !!note.archivedAt : !note.archivedAt) ?? [];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleNotes = inLibrary
    .filter((note) => !normalizedQuery || note.text.toLocaleLowerCase().includes(normalizedQuery) || note.source?.label.toLocaleLowerCase().includes(normalizedQuery))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const pinned = visibleNotes.filter((note) => note.pinned);
  const unpinned = visibleNotes.filter((note) => !note.pinned);
  const activeParts = activeNote ? noteParts(activeNote) : null;

  const renderGroup = (label: string, entries: Note[]) => entries.length ? (
    <section className="vp-notes-section" aria-label={label}>
      <h3 className="vp-section-label">{label}</h3>
      <div className="vp-notes-grid">
        {entries.map((note) => {
          const parts = noteParts(note);
          return (
            <button key={note.id} type="button" onClick={() => setActiveId(note.id)} className="vp-note-card">
              {note.pinned ? <Pin className="vp-note-pin" size="0.75rem" fill="currentColor" aria-label="Pinned" /> : null}
              <span className="vp-note-card-copy">
                <strong>{parts.title || "New note"}</strong>
                <span>{parts.body.replace(/\s+/g, " ").trim() || "No additional text"}</span>
                <small>{clock.stamp(note.updatedAt)}{note.source ? ` · ${note.source.label}` : ""}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
    <section aria-labelledby="notes-title" className={`vp-appview${activeNote ? " vp-appview--fixed" : ""}`} data-phone-app="notes">
      <PhoneAppHeader
        title={activeNote ? noteTitle(activeNote) : library === "archive" ? "Archive" : "Notes"}
        titleId="notes-title"
        closeLabel="Close Notes"
        onBack={() => activeNote ? setActiveId(null) : onBack()}
        onClose={onClose}
        actions={activeNote ? [] : [{ id: "add-note", icon: "add", label: "New note", kind: "button", disabled: !notes, reason: "Notes are still loading" }]}
        onAction={(actionId) => { if (actionId === "add-note") addNote(); }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {!notes ? (
        <div role="status" aria-label="Loading notes" className="vp-stack" style={{ gap: "0.5rem" }}>
          {[0, 1, 2].map((index) => <div key={index} className="vp-thread-row" aria-hidden="true"><span className="vp-thread-body"><span className="vp-skeleton vp-skeleton--line" style={{ width: "50%" }} /><span className="vp-skeleton vp-skeleton--line" style={{ width: "85%" }} /></span></div>)}
        </div>
      ) : activeNote && activeParts ? (
        <div className="vp-note-editor">
          <div className="vp-note-sheet">
            <input aria-label="Note title" value={activeParts.title} onChange={(event) => updateText("title", event.target.value)} placeholder="Title" autoFocus className="vp-note-title-input" />
            <textarea aria-label="Note body" value={activeParts.body} onChange={(event) => updateText("body", event.target.value)} placeholder="Start writing…" className="vp-note-paper" />
          </div>
          <div className="vp-note-tools" aria-label="Note actions">
            {!activeNote.archivedAt ? <button type="button" onClick={() => updateActive({ pinned: !activeNote.pinned }, true)} aria-pressed={!!activeNote.pinned}><Pin size="0.85rem" fill={activeNote.pinned ? "currentColor" : "none"} aria-hidden="true" />{activeNote.pinned ? "Unpin" : "Pin"}</button> : null}
            <button type="button" onClick={archiveActive}>{activeNote.archivedAt ? <ArchiveRestore size="0.85rem" aria-hidden="true" /> : <Archive size="0.85rem" aria-hidden="true" />}{activeNote.archivedAt ? "Restore" : "Archive"}</button>
            <button type="button" className="vp-note-delete" onClick={deleteActive}><Trash2 size="0.85rem" aria-hidden="true" />Delete</button>
          </div>
          <p className="vp-note-saved">Edited {clock.stamp(activeNote.updatedAt)}{activeNote.source ? ` · Saved from ${activeNote.source.label}` : ""}</p>
        </div>
      ) : (
        <>
          <div className="vp-notes-controls">
            <label className="vp-inline-search"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Search notes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
            <div className="vp-filter-tabs" aria-label="Notes library">
              <button type="button" className={library === "notes" ? "is-active" : ""} aria-pressed={library === "notes"} onClick={() => setLibrary("notes")}>Notes</button>
              <button type="button" className={library === "archive" ? "is-active" : ""} aria-pressed={library === "archive"} onClick={() => setLibrary("archive")}>Archive</button>
            </div>
          </div>
          {inLibrary.length === 0 && !query.trim() ? (
            <PhoneEmptyState icon={library === "archive" ? Archive : NotebookPen} title={library === "archive" ? "Archive is empty" : "No notes yet"} body={library === "archive" ? "Notes you archive stay here until you restore or delete them." : "Capture details, plans, clues, or anything this character should remember."} action={library === "notes" ? { label: "New note", onClick: addNote } : undefined} />
          ) : visibleNotes.length === 0 ? (
            <PhoneEmptyState icon={Search} title="No matching notes" body="Search checks titles, text, and saved sources on this phone." />
          ) : (
            <div className="vp-notes-library">{renderGroup("Pinned", pinned)}{renderGroup(library === "archive" ? "Archived" : pinned.length ? "Notes" : "All notes", unpinned)}</div>
          )}
          {library === "notes" ? <div className="vp-fab-layer"><button type="button" className="vp-fab" aria-label="New note" onClick={addNote}><Plus size="1.375rem" aria-hidden="true" /></button></div> : null}
        </>
      )}
    </section>
  );
}
