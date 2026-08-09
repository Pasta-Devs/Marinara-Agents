import React from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneAvatar, useAvatarMap } from "../../platform/avatars";
import { PhoneEmptyState } from "../../platform/empty-state";

type Contact = {
  id: string;
  kind: "phone" | "contact";
  phoneId: string | null;
  ownerId?: string;
  name: string;
  phoneLabel?: string;
  bio?: string;
  source?: string;
};

/**
 * A-Z sections, as every contacts app on both platforms does it. A flat list of everyone the story
 * has introduced stops being scannable at about a dozen names, which one scene can produce.
 */
function groupContacts(contacts: Contact[]) {
  const groups = new Map<string, Contact[]>();
  for (const contact of [...contacts].sort((a, b) => a.name.localeCompare(b.name))) {
    const first = contact.name.trim()[0]?.toLocaleUpperCase() ?? "#";
    const letter = /\p{Letter}/u.test(first) ? first : "#";
    groups.set(letter, [...(groups.get(letter) ?? []), contact]);
  }
  return [...groups.entries()];
}

interface ContactsPayload {
  contacts: Contact[];
  threads: Array<{ otherPhoneId: string; unread: number }>;
}

export function ContactsShell({ phoneId, chatId, onBack, onClose }: { phoneId: string; chatId: string; onBack: () => void; onClose: () => void }) {
  const [data, setData] = React.useState<ContactsPayload | null>(null);
  const [error, setError] = React.useState("");
  const avatars = useAvatarMap();
  const [draft, setDraft] = React.useState({ name: "", bio: "", phoneLabel: "" });
  const [adding, setAdding] = React.useState(false);
  // The list is the app; adding is a sheet behind the + action, and a contact opens a detail page.
  const [view, setView] = React.useState<"list" | "add">("list");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [library, setLibrary] = React.useState<Array<{ id: string; type: string; name: string; bio: string }> | null>(null);
  const [libraryQuery, setLibraryQuery] = React.useState("");

  React.useEffect(() => {
    if (view !== "add" || library !== null) return;
    void phoneRequest<{ people: Array<{ id: string; type: string; name: string; bio: string }> }>(`/phones/${encodeURIComponent(phoneId)}/library`)
      .then((payload) => setLibrary(payload.people))
      .catch(() => setLibrary([]));
  }, [view, library, phoneId]);

  React.useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    void phoneRequest<ContactsPayload>(`/phones/${encodeURIComponent(phoneId)}/contacts?chatId=${encodeURIComponent(chatId)}`)
      .then((payload) => { if (active) setData(payload); })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "Contacts could not be loaded"); });
    return () => { active = false; };
  }, [phoneId, chatId]);

  const threadStatus = (contactPhoneId: string) => {
    const thread = data?.threads.find((candidate) => candidate.otherPhoneId === contactPhoneId);
    if (!thread) return "No conversation yet";
    return thread.unread > 0 ? `${thread.unread} unread` : "In conversation";
  };

  const createContact = async (body: Record<string, unknown>) => {
    setAdding(true);
    setError("");
    try {
      const response = await phoneRequest<{ contact: Contact }>(`/phones/${encodeURIComponent(phoneId)}/contacts?chatId=${encodeURIComponent(chatId)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setData((current) => current ? {
        ...current,
        contacts: current.contacts.some((contact) => contact.id === response.contact.id)
          ? current.contacts.map((contact) => contact.id === response.contact.id ? response.contact : contact)
          : [...current.contacts, response.contact],
      } : current);
      setDraft({ name: "", bio: "", phoneLabel: "" });
      setView("list");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Contact could not be added");
    } finally {
      setAdding(false);
    }
  };
  const addContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    await createContact(draft);
  };

  /**
   * The DELETE route has existed server-side the whole time with nothing calling it, because rows
   * were inert divs. Only user-added contacts can go — a character's phone in this chat is not the
   * contact list's to remove.
   */
  const deleteContact = async (contact: Contact) => {
    if (!window.confirm(`Delete ${contact.name} from Contacts?`)) return;
    setError("");
    try {
      await phoneRequest(`/phones/${encodeURIComponent(phoneId)}/contacts/${encodeURIComponent(contact.id)}?chatId=${encodeURIComponent(chatId)}`, {
        method: "DELETE",
      });
      setData((current) => current ? { ...current, contacts: current.contacts.filter((entry) => entry.id !== contact.id) } : current);
      setOpenId(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Contact could not be deleted");
    }
  };

  const openContact = data?.contacts.find((contact) => contact.id === openId) ?? null;

  return (
    <section aria-labelledby="contacts-title" className="vp-appview">
      <PhoneAppHeader
        title={openContact ? openContact.name : view === "add" ? "Add someone" : "Contacts"}
        titleId="contacts-title"
        closeLabel="Close Contacts"
        onBack={() => {
          if (openContact) return setOpenId(null);
          if (view === "add") return setView("list");
          onBack();
        }}
        onClose={onClose}
        actions={openContact
          ? (openContact.kind === "contact" ? [{ id: "delete-contact", icon: "trash", label: "Delete contact", kind: "button" as const }] : [])
          : view === "add" ? [] : [{ id: "add-contact", icon: "add", label: "Add someone", kind: "button" as const }]}
        onAction={(actionId) => {
          if (actionId === "add-contact") setView("add");
          if (actionId === "delete-contact" && openContact) void deleteContact(openContact);
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}

      {openContact ? (
        <div className="vp-stack" style={{ gap: "0.75rem" }}>
          <div className="vp-card vp-stack" style={{ gap: "0.5rem", alignItems: "center", textAlign: "center" }}>
            <PhoneAvatar name={openContact.name} url={openContact.ownerId ? avatars?.get(openContact.ownerId) : null} />
            <span className="vp-thread-name">{openContact.name}</span>
            {openContact.phoneLabel?.trim() ? <span className="vp-thread-preview">{openContact.phoneLabel}</span> : null}
            {openContact.bio?.trim() ? <p className="vp-thread-preview">{openContact.bio}</p> : null}
            {openContact.source?.trim() ? <span className="vp-muted-note">{openContact.source}</span> : null}
            {openContact.kind === "phone" ? <span className="vp-muted-note">Engine character or persona</span> : null}
            <span className="vp-muted-note">
              {openContact.phoneId ? threadStatus(openContact.phoneId) : "No phone in this chat"}
            </span>
          </div>
        </div>
      ) : view === "add" ? (
        <>
        <div className="vp-card vp-stack" style={{ gap: "0.5rem", marginBottom: "0.6rem" }}>
          <span className="vp-section-label">Import a saved character or persona</span>
          {library === null ? <p className="vp-muted-note">Loading your library…</p> : library.length === 0 ? <p className="vp-muted-note">No saved characters or personas found.</p> : <>
            <label><span className="vp-sr-only">Search library</span><input className="vp-input" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search saved characters…" /></label>
            <div className="vp-stack" style={{ gap: "0.25rem", maxHeight: "12rem", overflowY: "auto" }}>
              {library.filter((person) => person.name.toLowerCase().includes(libraryQuery.trim().toLowerCase())).slice(0, 40).map((person) => (
                <button key={`${person.type}:${person.id}`} type="button" disabled={adding} className="vp-thread-row" onClick={() => void createContact({ name: person.name, bio: person.bio, linkedOwnerId: person.id, linkedOwnerType: person.type })}>
                  <PhoneAvatar name={person.name} url={avatars?.get(person.id) ?? null} />
                  <span className="vp-thread-body"><span className="vp-thread-name">{person.name}</span><span className="vp-thread-preview">{person.type === "persona" ? "Persona" : "Character"}{person.bio ? ` · ${person.bio}` : ""}</span></span>
                </button>
              ))}
            </div>
          </>}
        </div>
        <form className="vp-card vp-stack" onSubmit={addContact} style={{ gap: "0.5rem" }}>
          <label><span className="vp-sr-only">Name</span><input className="vp-input" required maxLength={120} autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Name" /></label>
          <label><span className="vp-sr-only">Phone or contact detail</span><input className="vp-input" maxLength={80} value={draft.phoneLabel} onChange={(event) => setDraft({ ...draft, phoneLabel: event.target.value })} placeholder="Phone or contact detail (optional)" /></label>
          <label><span className="vp-sr-only">Bio</span><input className="vp-input" maxLength={500} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder="Bio (optional)" /></label>
          <button type="submit" disabled={adding || !draft.name.trim()} className="vp-accent-btn">{adding ? "Adding..." : "Add contact"}</button>
        </form>
        </>
      ) : (
        <>
          {!data && !error ? (
            <div role="status" aria-label="Loading contacts" className="vp-stack" style={{ gap: "0.5rem" }}>
              {[0, 1].map((index) => (
                <div key={index} className="vp-thread-row" aria-hidden="true">
                  <span className="vp-skeleton vp-skeleton--avatar" />
                  <span className="vp-thread-body">
                    <span className="vp-skeleton vp-skeleton--line" style={{ width: "45%" }} />
                    <span className="vp-skeleton vp-skeleton--line" style={{ width: "65%" }} />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {data && data.contacts.length === 0 ? (
            <PhoneEmptyState
              icon={Users}
              title="No contacts"
              body="Add someone by hand, import a saved character, or turn on more character phones in Chat Settings."
              action={{ label: "Add someone", onClick: () => setView("add") }}
            />
          ) : null}
          {data?.contacts.length ? (
            <>
              <div className="vp-list-group">
                {groupContacts(data.contacts).map(([letter, group]) => (
                  <section key={letter}>
                    <h3 className="vp-index-head">{letter}</h3>
                    <div className="vp-list vp-list--inset-rules">
                      {group.map((contact) => (
                        <button key={contact.id} type="button" onClick={() => setOpenId(contact.id)} className="vp-thread-row">
                          <PhoneAvatar name={contact.name} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
                          <span className="vp-thread-body">
                            <span className="vp-thread-name">{contact.name}</span>
                            {contact.bio?.trim() ? <span className="vp-thread-preview">{contact.bio}</span> : null}
                            {contact.source?.trim() ? <span className="vp-thread-preview">{contact.source}</span> : null}
                            <span className="vp-thread-preview">{contact.phoneLabel?.trim() ? `${contact.phoneLabel} · ` : ""}{contact.phoneId ? threadStatus(contact.phoneId) : "No phone in this chat"}</span>
                          </span>
                          <ChevronRight size="1rem" aria-hidden="true" className="vp-row-chevron" />
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="vp-fab-layer">
                <button type="button" className="vp-fab" aria-label="Add someone" onClick={() => setView("add")}><Plus size="1.375rem" aria-hidden="true" /></button>
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
