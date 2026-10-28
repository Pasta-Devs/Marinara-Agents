import React from "react";
import { Archive, Inbox, Search, Send, Trash2 } from "lucide-react";
import { draftMail, mailFromLine, mailThread, mergeMail, parseEmail, readStoredMail, type MailFolder, type MailMessage } from "./manifest";
import { phoneRequest, recordActivity } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { useStoryClock } from "../../platform/story-clock";
import { PhoneAvatar } from "../../platform/avatars";
import { PhoneEmptyState } from "../../platform/empty-state";
import { usePhoneStore } from "../../platform/use-phone-store";
import { rememberPerson } from "../../platform/people";

const FOLDERS: Array<{ id: MailFolder; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "sent", label: "Sent" },
  { id: "archive", label: "Archive" },
  { id: "trash", label: "Trash" },
];



export function MailShell({ phoneId, ownerName = "Me", chatId, onBack, onClose }: { phoneId: string; ownerName?: string; chatId: string | null; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "mail");
  const clock = useStoryClock();
  const when = (at: string) => (Number.isNaN(new Date(at).getTime()) ? "" : clock.stamp(at));
  const [mail, setMail] = React.useState<MailMessage[] | null>(null);
  const [folder, setFolder] = React.useState<MailFolder>("inbox");
  const [query, setQuery] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
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
  const openThread = openMail ? mailThread(mail ?? [], openMail.id) : [];
  const shown = (mail ?? []).filter((item) => item.folder === folder);
  const unreadInbox = (mail ?? []).filter((item) => item.folder === "inbox" && !item.read).length;

  const open = (item: MailMessage) => {
    setOpenId(item.id);
    if (!item.read && mail) {
      persist(mail.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
      void phoneRequest(`/phones/${encodeURIComponent(phoneId)}/mail/open`, {
        method: "POST",
        body: JSON.stringify({ id: item.id, from: item.from, subject: item.subject, body: item.body, at: item.at }),
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The message was opened, but its story state could not be recorded."));
    }
  };
  const move = (item: MailMessage, next: MailFolder) => {
    if (!mail) return;
    persist(mail.map((entry) => entry.id === item.id ? { ...entry, folder: next } : entry));
    setOpenId(null);
  };
  const removeForever = (item: MailMessage) => {
    if (!mail) return;
    persist(mail.filter((entry) => entry.id !== item.id));
    setOpenId(null);
  };

  const send = async () => {
    if (!composing || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await phoneRequest<{ sentAt: string; reply: { id: string; at: string; from: string; to: string; subject: string; body: string } | null }>(
        `/phones/${encodeURIComponent(phoneId)}/mail/send`,
        { method: "POST", body: JSON.stringify({ to: composing.to, subject: composing.subject, body: composing.body }) },
      );
      const sent = {
        ...draftMail({ from: ownerName, to: composing.to, subject: composing.subject, body: composing.body, ...(composing.replyTo ? { replyTo: composing.replyTo } : {}) }),
        at: response.sentAt,
      };
      const afterSend = [sent, ...(mail ?? [])];
      persist(afterSend);
      void recordActivity(phoneId, "sent a private email from the Phone")
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The email action could not be recorded."));
      setComposing(null);
      setFolder("sent");
      if (response.reply) {
        const answer = { ...mailFromLine(
          `${response.reply.from} | ${response.reply.subject} | ${response.reply.body}`,
          ownerName,
          response.reply.at,
        ), id: response.reply.id };
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
      setError(cause instanceof Error ? cause.message : "The email could not be sent. Your draft is still open.");
    } finally {
      setSending(false);
    }
  };

  const visibleMail = shown.filter((item) => (!unreadOnly || !item.read) && (!query.trim() || `${item.from} ${item.to} ${item.subject} ${item.body}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  return (
    <section aria-labelledby="mail-title" className="vp-appview" data-phone-app="mail">
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
          ? [{ id: "delete-mail", icon: "trash", label: openMail.folder === "trash" ? "Delete forever" : "Move to Trash", kind: "button" }]
          : [
            { id: "compose", icon: "add", label: "New message", kind: "button" },
            { id: "refresh-inbox", icon: "refresh", label: "Refresh inbox", kind: "button", disabled: loading, reason: "Refreshing" },
          ]}
        onAction={(actionId) => {
          if (actionId === "compose") setComposing({ to: "", subject: "", body: "" });
          if (actionId === "refresh-inbox") refresh();
          if (actionId === "delete-mail" && openMail) openMail.folder === "trash" ? removeForever(openMail) : move(openMail, "trash");
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
              placeholder="To — name or email address"
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
          <div className="vp-mail-thread" aria-label="Conversation">
            {openThread.map((message) => (
              <article key={message.id} className={`vp-mail-message${message.id === openMail.id ? " vp-mail-message--selected" : ""}`}>
                <div className="vp-mail-message-head">
                  <PhoneAvatar name={message.folder === "sent" ? ownerName : message.from} url={null} />
                  <span><strong>{message.folder === "sent" ? ownerName : message.from}</strong><small>{message.folder === "sent" ? `to ${message.to}` : `to ${ownerName}`}</small></span>
                  {when(message.at) ? <time>{when(message.at)}</time> : null}
                </div>
                <p>{message.body}</p>
              </article>
            ))}
          </div>
          <div className="vp-store-actions" style={{ marginTop: "0.75rem" }}>
            {openMail.folder === "inbox" || openMail.folder === "archive" ? (
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
                : openMail.folder === "trash"
                  ? <button type="button" className="vp-surface-btn" onClick={() => move(openMail, "inbox")}>Restore</button>
                : null}
            {openMail.folder === "inbox" && openMail.read ? <button type="button" className="vp-surface-btn" onClick={() => { if (mail) persist(mail.map((item) => item.id === openMail.id ? { ...item, read: false } : item)); setOpenId(null); }}>Mark unread</button> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="vp-mail-folders" role="tablist" aria-label="Mail folders">
            {FOLDERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={folder === entry.id}
                onClick={() => { setFolder(entry.id); setUnreadOnly(false); }}
                className={`vp-mail-folder${folder === entry.id ? " vp-mail-folder--active" : ""}`}
              >
                {entry.id === "inbox" ? <Inbox size="0.85rem" aria-hidden="true" /> : entry.id === "sent" ? <Send size="0.85rem" aria-hidden="true" /> : entry.id === "archive" ? <Archive size="0.85rem" aria-hidden="true" /> : <Trash2 size="0.85rem" aria-hidden="true" />}
                <span>{entry.label}</span>{entry.id === "inbox" && unreadInbox ? <strong>{unreadInbox}</strong> : null}
              </button>
            ))}
          </div>
          <label className="vp-inline-search"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Search mail</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail" /></label>
          {folder === "inbox" && shown.length ? <div className="vp-filter-tabs" aria-label="Inbox filter"><button type="button" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</button><button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread {unreadInbox || ""}</button></div> : null}
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
          {mail && shown.length === 0 && !loading && !query.trim() ? (
            <PhoneEmptyState
              icon={Inbox}
              title={folder === "inbox" ? "Inbox is empty" : folder === "sent" ? "Nothing sent" : folder === "archive" ? "Nothing archived" : "Trash is empty"}
              body={folder === "inbox" ? "Refresh to check for new messages." : undefined}
            />
          ) : null}
          {visibleMail.length ? (
            <div className="vp-list vp-list--inset-rules" aria-busy={loading}>
              {visibleMail.map((item) => (
                <button key={item.id} type="button" onClick={() => open(item)} className="vp-thread-row">
                  <PhoneAvatar name={item.folder === "sent" ? item.to : item.from} url={null} />
                  <span className="vp-thread-body">
                    <span className="vp-thread-name" style={item.read ? { fontWeight: 500 } : undefined}>
                      {!item.read ? <span className="vp-mail-dot" aria-label="Unread" /> : null}
                      {item.folder === "sent" ? `To ${item.to}` : item.from}
                    </span>
                    <span className="vp-thread-name" style={{ fontWeight: item.read ? 500 : 600, fontSize: "0.75rem" }}>{item.subject}</span>
                    <span className="vp-thread-preview">{item.body.slice(0, 140)}</span>
                  </span>
                  {when(item.at) ? <span className="vp-row-stamp">{when(item.at)}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          {query.trim() && visibleMail.length === 0 ? <PhoneEmptyState icon={Search} title="No mail found" body="Try a sender, subject, or phrase from the message." /> : null}
          {!query.trim() && unreadOnly && visibleMail.length === 0 ? <PhoneEmptyState icon={Inbox} title="You're all caught up" body="There is no unread mail." /> : null}
        </>
      )}
    </section>
  );
}

export { parseEmail };
