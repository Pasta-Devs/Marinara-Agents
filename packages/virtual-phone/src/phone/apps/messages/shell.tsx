import React from "react";
import { Send } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";

interface ThreadMessage {
  id: string;
  from: string;
  text: string;
  at: string;
}
interface Thread {
  id: string;
  otherPhoneId: string;
  otherName: string;
  unread: number;
  messages: ThreadMessage[];
}
interface MessagingPayload {
  contacts: Array<{ phoneId: string; ownerName: string }>;
  threads: Thread[];
}

function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function MessagesShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const [data, setData] = React.useState<MessagingPayload | null>(null);
  const [error, setError] = React.useState("");
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bubblesRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setError("");
    try {
      setData(await phoneRequest<MessagingPayload>(`/phones/${encodeURIComponent(phoneId)}/messaging`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Messages could not be loaded");
    }
  }, [phoneId]);

  React.useEffect(() => {
    setData(null);
    setActiveThreadId(null);
    void load();
  }, [load]);

  const activeThread = data?.threads.find((thread) => thread.id === activeThreadId) ?? null;

  const updateThread = (thread: Thread) => setData((current) => current ? {
    contacts: current.contacts,
    threads: current.threads.some((existing) => existing.id === thread.id)
      ? current.threads.map((existing) => existing.id === thread.id ? thread : existing)
      : [thread, ...current.threads],
  } : current);

  React.useEffect(() => {
    if (!activeThread || activeThread.unread === 0) return;
    void phoneRequest<{ thread: Thread }>(`/phones/${encodeURIComponent(phoneId)}/messaging/read`, {
      method: "POST", body: JSON.stringify({ threadId: activeThread.id }),
    }).then((response) => updateThread(response.thread)).catch(() => undefined);
  }, [phoneId, activeThread?.id, activeThread?.unread]);

  React.useEffect(() => {
    bubblesRef.current?.scrollTo({ top: bubblesRef.current.scrollHeight });
  }, [activeThread?.messages.length]);

  const send = async (toPhoneId: string, text: string) => {
    setSending(true);
    setError("");
    try {
      const response = await phoneRequest<{ thread: Thread }>(`/phones/${encodeURIComponent(phoneId)}/messaging/send`, {
        method: "POST", body: JSON.stringify({ toPhoneId, text }),
      });
      updateThread(response.thread);
      setActiveThreadId(response.thread.id);
      setDraft("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Message could not be sent");
    } finally {
      setSending(false);
    }
  };

  const startedContactIds = new Set(data?.threads.map((thread) => thread.otherPhoneId));
  const newContacts = data?.contacts.filter((contact) => !startedContactIds.has(contact.phoneId)) ?? [];

  return (
    <section aria-labelledby="messages-title" className="vp-appview">
      <PhoneAppHeader
        title={activeThread ? activeThread.otherName : "Messages"}
        titleId="messages-title"
        closeLabel="Close Messages"
        onBack={() => activeThread ? setActiveThreadId(null) : onBack()}
        onClose={onClose}
        actions={[{ id: "refresh", icon: "refresh", label: "Refresh messages", kind: "button" }]}
        onAction={(actionId) => { if (actionId === "refresh") void load(); }}
      />
      {error ? <p role="alert" className="vp-muted-note" style={{ marginBottom: "0.75rem" }}>{error}</p> : null}
      {!data ? (
        <div role="status" aria-label="Loading messages" className="vp-stack" style={{ gap: "0.5rem" }}>
          {[0, 1, 2].map((index) => (
            <div key={index} className="vp-thread-row" aria-hidden="true">
              <span className="vp-skeleton vp-skeleton--avatar" />
              <span className="vp-thread-body">
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "40%" }} />
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "75%" }} />
              </span>
            </div>
          ))}
        </div>
      ) : activeThread ? (
        <div className="vp-thread-view">
          <div ref={bubblesRef} className="vp-bubbles" aria-label={`Conversation with ${activeThread.otherName}`}>
            {activeThread.messages.map((message) => (
              <div key={message.id} className={`vp-bubble ${message.from === phoneId ? "vp-bubble--self" : "vp-bubble--other"}`}>
                {message.text}
                <span className="vp-bubble-time">{new Date(message.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
          <form className="vp-composer" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void send(activeThread.otherPhoneId, draft); }}>
            <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">Message {activeThread.otherName}</span>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message" maxLength={2000} disabled={sending} className="vp-input" />
            </label>
            <button type="submit" aria-label="Send message" disabled={sending || !draft.trim()} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
          </form>
        </div>
      ) : (
        <div className="vp-stack" style={{ gap: "0.5rem" }}>
          {data.threads.length === 0 && newContacts.length === 0 ? (
            <p className="vp-muted-note">No one else has a phone yet. Enable more phones in Agent Settings.</p>
          ) : null}
          {data.threads.map((thread) => {
            const last = thread.messages.at(-1);
            return (
              <button key={thread.id} type="button" onClick={() => setActiveThreadId(thread.id)} className="vp-thread-row">
                <span className="vp-thread-avatar" aria-hidden="true">{initials(thread.otherName)}</span>
                <span className="vp-thread-body">
                  <span className="vp-thread-name">{thread.otherName}</span>
                  <span className="vp-thread-preview">{last ? `${last.from === phoneId ? "You: " : ""}${last.text}` : "No messages yet"}</span>
                </span>
                {thread.unread > 0 ? <span className="vp-badge" aria-label={`${thread.unread} unread`}>{thread.unread}</span> : null}
              </button>
            );
          })}
          {newContacts.length ? (
            <>
              <h3 className="vp-section-label vp-section-label--spaced">Start a chat</h3>
              {newContacts.map((contact) => (
                <form key={contact.phoneId} className="vp-composer" onSubmit={(event) => {
                  event.preventDefault();
                  const input = event.currentTarget.elements.namedItem("draft") as HTMLInputElement;
                  if (input.value.trim()) void send(contact.phoneId, input.value);
                }}>
                  <span className="vp-thread-avatar" aria-hidden="true">{initials(contact.ownerName)}</span>
                  <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">Message {contact.ownerName}</span>
                    <input name="draft" placeholder={`Message ${contact.ownerName}`} maxLength={2000} className="vp-input" />
                  </label>
                  <button type="submit" aria-label={`Send message to ${contact.ownerName}`} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
                </form>
              ))}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
