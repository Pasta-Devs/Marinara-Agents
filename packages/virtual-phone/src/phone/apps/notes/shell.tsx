import React from "react";
import { PhoneAppHeader } from "../../platform/app-header";
import { useDebouncedSave, usePhoneStore } from "../../platform/use-phone-store";

interface Note {
  id: string;
  text: string;
  updatedAt: string;
}

function noteTitle(note: Note) {
  return note.text.split("\n")[0]?.trim() || "New note";
}

export function NotesShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "notes");
  const [notes, setNotes] = React.useState<Note[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { save } = useDebouncedSave(store, "notes", setError);

  React.useEffect(() => {
    let active = true;
    void store.get("notes").then((value) => {
      if (!active) return;
      setNotes(Array.isArray(value) ? value.filter((note): note is Note => !!note && typeof (note as Note).id === "string" && typeof (note as Note).text === "string") : []);
    }).catch(() => { if (active) setNotes([]); });
    return () => { active = false; };
  }, [store]);

  const persist = (next: Note[], immediate = false) => {
    setNotes(next);
    save(next, immediate);
  };
  const activeNote = notes?.find((note) => note.id === activeId) ?? null;
  const updateActive = (text: string) => {
    if (!notes || !activeId) return;
    persist(notes.map((note) => note.id === activeId ? { ...note, text, updatedAt: new Date().toISOString() } : note));
  };
  const addNote = () => {
    if (!notes) return;
    const note: Note = { id: crypto.randomUUID(), text: "", updatedAt: new Date().toISOString() };
    persist([note, ...notes], true);
    setActiveId(note.id);
  };
  const deleteActive = () => {
    if (!notes || !activeNote) return;
    if (!window.confirm("Delete this note?")) return;
    persist(notes.filter((note) => note.id !== activeNote.id), true);
    setActiveId(null);
  };

  return (
    <section aria-labelledby="notes-title" className={`vp-appview${activeNote ? " vp-appview--fixed" : ""}`}>
      <PhoneAppHeader
        title={activeNote ? noteTitle(activeNote) : "Notes"}
        titleId="notes-title"
        closeLabel="Close Notes"
        onBack={() => activeNote ? setActiveId(null) : onBack()}
        onClose={onClose}
        actions={activeNote
          ? [{ id: "delete-note", icon: "trash", label: "Delete note", kind: "button" }]
          : [{ id: "add-note", icon: "add", label: "New note", kind: "button", disabled: !notes, reason: "Notes are still loading" }]}
        onAction={(actionId) => {
          if (actionId === "add-note") addNote();
          if (actionId === "delete-note") deleteActive();
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {!notes ? (
        <div role="status" aria-label="Loading notes" className="vp-stack" style={{ gap: "0.5rem" }}>
          {[0, 1, 2].map((index) => (
            <div key={index} className="vp-thread-row" aria-hidden="true">
              <span className="vp-thread-body">
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "50%" }} />
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "85%" }} />
              </span>
            </div>
          ))}
        </div>
      ) : activeNote ? (
        <textarea
          aria-label="Note text"
          value={activeNote.text}
          onChange={(event) => updateActive(event.target.value)}
          placeholder="Write something…"
          autoFocus
          className="vp-textarea vp-textarea--fill"
        />
      ) : notes.length === 0 ? (
        <p className="vp-muted-note">No notes yet. Everything written here stays on this phone.</p>
      ) : (
        <div className="vp-stack" style={{ gap: "0.5rem" }}>
          {notes.map((note) => (
            <button key={note.id} type="button" onClick={() => setActiveId(note.id)} className="vp-thread-row">
              <span className="vp-thread-body">
                <span className="vp-thread-name">{noteTitle(note)}</span>
                <span className="vp-thread-preview">{new Date(note.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })} · {note.text.split("\n").slice(1).join(" ").trim() || "No additional text"}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
