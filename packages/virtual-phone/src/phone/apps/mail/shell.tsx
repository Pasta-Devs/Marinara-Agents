import React from "react";
import { draftMail, mailFromLine, mergeMail, parseEmail, readStoredMail, type MailFolder, type MailMessage } from "./manifest";
import { phoneRequest, recordActivity } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { rememberPerson } from "../../platform/people";

const FOLDERS: Array<{ id: MailFolder; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "archive", label: "Archive" },
];

function when(at: string) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function MailShell({ phoneId, ownerName = "Me", chatId, onBack, onClose }: { phoneId: string; ownerName?: string; chatId: string | null; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "mail");
  const [mail, setMail] = React.useState<MailMessage[] | null>(null);
  const [folder, setFolder] = React.useState<MailFolder>("inbox");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [composing, setComposing] = React.useState<{ to: string; subject: string; body: string; replyTo?: string } | null>(null);
  const [contacts, setContacts] = React.useState<Array<{ name: string; ownerId?: string; phoneId?: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const persist = React.useCallback((next: MailMessage[]) => {
    setMail(next);
    void store.set("inbox", next).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "The mailbox could not be saved.");
    });
  }, [store]);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setError(null);
      void phoneRequest<{ emails: string[] }>(`/phones/${encodeURIComponent(phoneId)}/mail/inbox`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => {
        const at = new Date().toISOString();
        const arrived = response.emails.map((line) => mailFromLine(line, ownerName, at));
        setMail((current) => {
          const merged = mergeMail(current ?? [], arrived);
          void store.set("inbox", merged).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The mailbox could not be saved."));
          return merged;
        });
        void Promise.all(arrived.map((item) => rememberPerson(phoneId, {
          name: item.from,
          bio: `Wrote about “${item.subject}”.`,
          phoneLabel: "Mail",
          source: "Wrote to you by mail",
        }))).catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "A mail correspondent could not be added to Contacts.");
        });
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not reach the mail server.");
        setMail((current) => current ?? []);
      })
      .finally(() => setLoading(false));
  }, [phoneId, ownerName, store, chatId]);

  React.useEffect(() => {
    let active = true;
    void store.get("inbox").then((value) => {
      if (!active) return;
      const stored = readStoredMail(value, ownerName);
      if (stored.length) setMail(stored);
      else refresh();
    }).catch(() => { if (active) refresh(); });
    return () => { active = false; };
  }, [store, refresh, ownerName]);

  // Recipient autocomplete. Free text stays allowed: inventing an address for a company or a
  // stranger and letting the model decide who is behind it is the point.
  React.useEffect(() => {
    let active = true;
      void phoneRequest<{ contacts: Array<{ ownerName: string; ownerId?: string; phoneId?: string }> }>(`/phones/${encodeURIComponent(phoneId)}/messaging`)
        .then((payload) => {
          if (active) setContacts(payload.contacts.map((contact) => ({ name: contact.ownerName, ownerId: contact.ownerId, phoneId: contact.phoneId })));
        })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Contacts could not be loaded.");
      });
    return () => { active = false; };
  }, [phoneId]);

  const openMail = mail?.find((item) => item.id === openId) ?? null;
  const shown = (mail ?? []).filter((item) => item.folder === folder);
  const unreadInbox = (mail ?? []).filter((item) => item.folder === "inbox" && !item.read).length;

  const open = (item: MailMessage) => {
    setOpenId(item.id);
    if (!item.read && mail) persist(mail.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
  };
  const move = (item: MailMessage, next: MailFolder) => {
    if (!mail) return;
    persist(mail.map((entry) => entry.id === item.id ? { ...entry, folder: next } : entry));
    setOpenId(null);
  };
  const remove = (item: MailMessage) => {
    if (!mail) return;
    persist(mail.filter((entry) => entry.id !== item.id));
    setOpenId(null);
  };

  const send = async () => {
    if (!composing || sending) return;
    setSending(true);
    setError(null);
    const sent = draftMail({ from: ownerName, to: composing.to, subject: composing.subject, body: composing.body, ...(composing.replyTo ? { replyTo: composing.replyTo } : {}) });
    const afterSend = [sent, ...(mail ?? [])];
    persist(afterSend);
    void recordActivity(phoneId, `emailed ${composing.to}${composing.subject.trim() ? ` about "${composing.subject.trim()}"` : ""}`)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The email action could not be recorded."));
    setComposing(null);
    setFolder("sent");
    try {
      const response = await phoneRequest<{ reply: { from: string; to: string; subject: string; body: string } | null }>(
        `/phones/${encodeURIComponent(phoneId)}/mail/send`,
        { method: "POST", body: JSON.stringify({ to: composing.to, subject: composing.subject, body: composing.body }) },
      );
      if (response.reply) {
        const answer = mailFromLine(
          `${response.reply.from} | ${response.reply.subject} | ${response.reply.body}`,
          ownerName,
          new Date().toISOString(),
        );
        persist([{ ...answer, replyTo: sent.id }, ...afterSend]);
        try {
          await rememberPerson(phoneId, {
            name: response.reply.from,
            bio: `Corresponded about “${response.reply.subject}”.`,
            phoneLabel: "Mail",
            source: "Corresponded by mail",
          });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "The correspondent could not be added to Contacts.");
        }
        setFolder("inbox");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The mail was saved to Sent but could not be delivered.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="mail-title" className="vp-appview">
      <PhoneAppHeader
        title={composing ? "New message" : openMail ? openMail.subject : "Mail"}
        titleId="mail-title"
        closeLabel="Close Mail"
        onBack={() => {
          if (composing) return setComposing(null);
          if (openMail) return setOpenId(null);
          onBack();
        }}
        onClose={onClose}
        actions={composing ? [] : openMail
          ? [{ id: "delete-mail", icon: "trash", label: "Delete", kind: "button" }]
          : [
            { id: "compose", icon: "add", label: "New message", kind: "button" },
            { id: "refresh-inbox", icon: "refresh", label: "Refresh inbox", kind: "button", disabled: loading, reason: "Refreshing" },
          ]}
        onAction={(actionId) => {
          if (actionId === "compose") setComposing({ to: "", subject: "", body: "" });
          if (actionId === "refresh-inbox") refresh();
          if (actionId === "delete-mail" && openMail) remove(openMail);
        }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}

      {composing ? (
        <form className="vp-card vp-stack" style={{ gap: "0.5rem" }} onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <label><span className="vp-sr-only">To</span>
            <input
              list="vp-mail-contacts"
              value={composing.to}
              onChange={(event) => setComposing({ ...composing, to: event.target.value })}
              placeholder="To — a name, or any address you invent"
              maxLength={200}
              required
              autoFocus
              className="vp-input"
            />
          </label>
          <datalist id="vp-mail-contacts">
             {contacts.map((contact) => <option key={contact.phoneId ?? contact.ownerId ?? contact.name} value={contact.name} />)}
          </datalist>
          <label><span className="vp-sr-only">Subject</span>
            <input value={composing.subject} onChange={(event) => setComposing({ ...composing, subject: event.target.value })} placeholder="Subject" maxLength={200} className="vp-input" />
          </label>
          <label><span className="vp-sr-only">Message</span>
            <textarea value={composing.body} onChange={(event) => setComposing({ ...composing, body: event.target.value })} placeholder="Write your message" maxLength={4000} rows={8} className="vp-textarea" />
          </label>
          <button type="submit" disabled={sending || !composing.to.trim() || !composing.body.trim()} className="vp-accent-btn">
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : openMail ? (
        <div className="vp-mail-read">
          <h3 className="vp-page-heading">{openMail.subject}</h3>
          <p className="vp-mail-meta">
            {openMail.folder === "sent" ? `To ${openMail.to}` : `From ${openMail.from}`}
            {when(openMail.at) ? ` · ${when(openMail.at)}` : ""}
          </p>
          <div className="vp-page-body"><p style={{ whiteSpace: "pre-wrap" }}>{openMail.body}</p></div>
          <div className="vp-store-actions" style={{ marginTop: "0.75rem" }}>
            {openMail.folder !== "sent" ? (
              <button type="button" className="vp-accent-btn" onClick={() => setComposing({
                to: openMail.from,
                subject: openMail.subject.startsWith("Re:") ? openMail.subject : `Re: ${openMail.subject}`,
                body: `\n\n---\n${openMail.body}`,
                replyTo: openMail.id,
              })}>Reply</button>
            ) : null}
            {openMail.folder === "archive"
              ? <button type="button" className="vp-surface-btn" onClick={() => move(openMail, "inbox")}>Move to Inbox</button>
              : openMail.folder === "inbox"
                ? <button type="button" className="vp-surface-btn" onClick={() => move(openMail, "archive")}>Archive</button>
                : null}
          </div>
        </div>
      ) : (
        <>
          <div className="vp-chip-row" role="tablist" aria-label="Mail folders">
            {FOLDERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={folder === entry.id}
                onClick={() => setFolder(entry.id)}
                className={`vp-chip${folder === entry.id ? " vp-chip--active" : ""}`}
              >
                {entry.label}{entry.id === "inbox" && unreadInbox ? ` (${unreadInbox})` : ""}
              </button>
            ))}
          </div>
          {loading && !mail?.length ? (
            <div role="status" aria-label="Loading mail" className="vp-stack" style={{ gap: "0.5rem" }}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="vp-thread-row" aria-hidden="true">
                  <span className="vp-thread-body">
                    <span className="vp-skeleton vp-skeleton--line" style={{ width: "40%" }} />
                    <span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {mail && shown.length === 0 && !loading ? (
            <p className="vp-muted-note">
              {folder === "inbox" ? "The inbox is empty. Refresh to check for new mail." : folder === "sent" ? "Nothing sent yet." : "Nothing archived."}
            </p>
          ) : null}
          {shown.length ? (
            <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
              {shown.map((item) => (
                <button key={item.id} type="button" onClick={() => open(item)} className="vp-thread-row">
                  <span className="vp-thread-body">
                    <span className="vp-thread-name" style={item.read ? { fontWeight: 500 } : undefined}>
                      {!item.read ? <span className="vp-mail-dot" aria-label="Unread" /> : null}
                      {item.folder === "sent" ? `To ${item.to}` : item.from}
                    </span>
                    <span className="vp-thread-name" style={{ fontWeight: item.read ? 500 : 600, fontSize: "0.75rem" }}>{item.subject}</span>
                    <span className="vp-thread-preview">{item.body.slice(0, 140)}</span>
                    {when(item.at) ? <span className="vp-muted-note">{when(item.at)}</span> : null}
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

export { parseEmail };
