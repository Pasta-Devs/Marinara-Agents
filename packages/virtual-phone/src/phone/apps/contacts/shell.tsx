import React from "react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneAvatar, useAvatarMap } from "../../platform/avatars";

interface ContactsPayload {
  contacts: Array<{ phoneId: string; ownerId?: string; ownerName: string; deviceName?: string | null; bio?: string }>;
  threads: Array<{ otherPhoneId: string; unread: number }>;
}

export function ContactsShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const [data, setData] = React.useState<ContactsPayload | null>(null);
  const [error, setError] = React.useState("");
  const avatars = useAvatarMap();

  React.useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    void phoneRequest<ContactsPayload>(`/phones/${encodeURIComponent(phoneId)}/messaging`)
      .then((payload) => { if (active) setData(payload); })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "Contacts could not be loaded"); });
    return () => { active = false; };
  }, [phoneId]);

  const threadStatus = (contactPhoneId: string) => {
    const thread = data?.threads.find((candidate) => candidate.otherPhoneId === contactPhoneId);
    if (!thread) return "No conversation yet";
    return thread.unread > 0 ? `${thread.unread} unread` : "In conversation";
  };

  return (
    <section aria-labelledby="contacts-title" className="vp-appview">
      <PhoneAppHeader title="Contacts" titleId="contacts-title" closeLabel="Close Contacts" onBack={onBack} onClose={onClose} />
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
        <p className="vp-muted-note">No one else has a phone in this chat yet. Enable more phones in Agent Settings.</p>
      ) : null}
      {data?.contacts.length ? (
        <div className="vp-stack" style={{ gap: "0.5rem" }}>
          {data.contacts.map((contact) => (
            <div key={contact.phoneId} className="vp-thread-row">
              <PhoneAvatar name={contact.ownerName} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
              <span className="vp-thread-body">
                <span className="vp-thread-name">{contact.ownerName}</span>
                {contact.bio?.trim() ? <span className="vp-thread-preview">{contact.bio}</span> : null}
                <span className="vp-thread-preview">{contact.deviceName?.trim() ? `${contact.deviceName} · ` : ""}{threadStatus(contact.phoneId)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
