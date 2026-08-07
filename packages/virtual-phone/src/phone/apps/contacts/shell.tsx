import React from "react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneAvatar, useAvatarMap } from "../../platform/avatars";

interface ContactsPayload {
  contacts: Array<{ id: string; kind: "phone" | "contact"; phoneId: string | null; ownerId?: string; name: string; phoneLabel?: string; bio?: string }>;
  threads: Array<{ otherPhoneId: string; unread: number }>;
}

export function ContactsShell({ phoneId, chatId, onBack, onClose }: { phoneId: string; chatId: string; onBack: () => void; onClose: () => void }) {
  const [data, setData] = React.useState<ContactsPayload | null>(null);
  const [error, setError] = React.useState("");
  const avatars = useAvatarMap();
  const [draft, setDraft] = React.useState({ name: "", bio: "", phoneLabel: "" });
  const [adding, setAdding] = React.useState(false);

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
      const response = await phoneRequest<{ contact: ContactsPayload["contacts"][number] }>(`/phones/${encodeURIComponent(phoneId)}/contacts?chatId=${encodeURIComponent(chatId)}`, {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setData((current) => current ? { ...current, contacts: [...current.contacts, response.contact] } : current);
      setDraft({ name: "", bio: "", phoneLabel: "" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Contact could not be added");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section aria-labelledby="contacts-title" className="vp-appview">
      <PhoneAppHeader title="Contacts" titleId="contacts-title" closeLabel="Close Contacts" onBack={onBack} onClose={onClose} />
      <form className="vp-card vp-stack" onSubmit={addContact} style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span className="vp-section-label">Add someone</span>
        <label><span className="vp-sr-only">Name</span><input className="vp-input" required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Name" /></label>
        <label><span className="vp-sr-only">Phone or contact detail</span><input className="vp-input" maxLength={80} value={draft.phoneLabel} onChange={(event) => setDraft({ ...draft, phoneLabel: event.target.value })} placeholder="Phone or contact detail (optional)" /></label>
        <label><span className="vp-sr-only">Bio</span><input className="vp-input" maxLength={500} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder="Bio (optional)" /></label>
        <button type="submit" disabled={adding || !draft.name.trim()} className="vp-accent-btn">{adding ? "Adding..." : "Add contact"}</button>
      </form>
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
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
        <p className="vp-muted-note">No contacts yet. Add a person above, or enable more character phones in Chat Settings.</p>
      ) : null}
      {data?.contacts.length ? (
        <div className="vp-stack" style={{ gap: "0.5rem" }}>
          {data.contacts.map((contact) => (
            <div key={contact.id} className="vp-thread-row">
              <PhoneAvatar name={contact.name} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
              <span className="vp-thread-body">
                <span className="vp-thread-name">{contact.name}</span>
                {contact.bio?.trim() ? <span className="vp-thread-preview">{contact.bio}</span> : null}
                <span className="vp-thread-preview">{contact.phoneLabel?.trim() ? `${contact.phoneLabel} · ` : ""}{contact.phoneId ? threadStatus(contact.phoneId) : "No phone in this chat"}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
