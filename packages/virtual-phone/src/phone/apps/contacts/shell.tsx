import React from "react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneAvatar, useAvatarMap } from "../../platform/avatars";

type Contact = {
  id: string;
  kind: "phone" | "contact";
  phoneId: string | null;
  ownerId?: string;
  name: string;
  phoneLabel?: string;
  bio?: string;
};

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

  const addContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    setAdding(true);
    setError("");
    try {
      const response = await phoneRequest<{ contact: Contact }>(`/phones/${encodeURIComponent(phoneId)}/contacts?chatId=${encodeURIComponent(chatId)}`, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setData((current) => current ? { ...current, contacts: [...current.contacts, response.contact] } : current);
      setDraft({ name: "", bio: "", phoneLabel: "" });
      setView("list");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Contact could not be added");
    } finally {
      setAdding(false);
    }
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
            <span className="vp-muted-note">
              {openContact.phoneId ? threadStatus(openContact.phoneId) : "No phone in this chat"}
            </span>
          </div>
        </div>
      ) : view === "add" ? (
        <form className="vp-card vp-stack" onSubmit={addContact} style={{ gap: "0.5rem" }}>
          <label><span className="vp-sr-only">Name</span><input className="vp-input" required maxLength={120} autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Name" /></label>
          <label><span className="vp-sr-only">Phone or contact detail</span><input className="vp-input" maxLength={80} value={draft.phoneLabel} onChange={(event) => setDraft({ ...draft, phoneLabel: event.target.value })} placeholder="Phone or contact detail (optional)" /></label>
          <label><span className="vp-sr-only">Bio</span><input className="vp-input" maxLength={500} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder="Bio (optional)" /></label>
          <button type="submit" disabled={adding || !draft.name.trim()} className="vp-accent-btn">{adding ? "Adding..." : "Add contact"}</button>
        </form>
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
            <p className="vp-muted-note">No contacts yet. Add a person with the + button, or enable more character phones in Chat Settings.</p>
          ) : null}
          {data?.contacts.length ? (
            <div className="vp-stack" style={{ gap: "0.5rem" }}>
              {data.contacts.map((contact) => (
                <button key={contact.id} type="button" onClick={() => setOpenId(contact.id)} className="vp-thread-row">
                  <PhoneAvatar name={contact.name} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
                  <span className="vp-thread-body">
                    <span className="vp-thread-name">{contact.name}</span>
                    {contact.bio?.trim() ? <span className="vp-thread-preview">{contact.bio}</span> : null}
                    <span className="vp-thread-preview">{contact.phoneLabel?.trim() ? `${contact.phoneLabel} · ` : ""}{contact.phoneId ? threadStatus(contact.phoneId) : "No phone in this chat"}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
