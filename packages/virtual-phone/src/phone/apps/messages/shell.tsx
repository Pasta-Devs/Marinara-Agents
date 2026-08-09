import React from "react";
import { ChevronRight, MessageSquare, Send } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneAvatar, useAvatarMap } from "../../platform/avatars";
import { useStoryClock } from "../../platform/story-clock";
import { PhoneEmptyState } from "../../platform/empty-state";

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
  reply: { status: "pending" | "failed"; at: string; error?: string } | null;
  /** "chat" threads are Engine conversations: real story history, and sending posts into the chat. */
  kind: "chat" | "phone";
  mode?: "conversation" | "roleplay" | "game";
}
interface MessagingPayload {
  contacts: Array<{ phoneId: string; ownerId?: string; ownerName: string }>;
  threads: Thread[];
}

/** "Today" / "Yesterday" / the weekday, on the phone's own clock. */
function dayLabel(clock: ReturnType<typeof useStoryClock>, at: string) {
  const when = clock.at(at).toDateString();
  const today = clock.at().toDateString();
  const yesterday = new Date(clock.at().getTime() - 86_400_000).toDateString();
  if (when === today) return "Today";
  if (when === yesterday) return "Yesterday";
  return clock.at(at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function MessagesShell({ phoneId, openWith = "", onBack, onClose }: {
  phoneId: string;
  /** A phone id handed over by another app — Contacts opening the conversation with someone. */
  openWith?: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const [data, setData] = React.useState<MessagingPayload | null>(null);
  const [error, setError] = React.useState("");
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);
  /**
   * A conversation that does not exist yet. Starting one used to mean typing into one of a stack of
   * little forms on the list screen, one per person — so the first message to someone happened in a
   * different place from every message after it.
   */
  const [newTo, setNewTo] = React.useState<{ phoneId: string; name: string } | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bubblesRef = React.useRef<HTMLDivElement>(null);
  const avatars = useAvatarMap();
  const clock = useStoryClock();
  const avatarFor = (contactPhoneId: string) => {
    const ownerId = data?.contacts.find((contact) => contact.phoneId === contactPhoneId)?.ownerId;
    return ownerId ? avatars?.get(ownerId) : null;
  };

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
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const activeThread = data?.threads.find((thread) => thread.id === activeThreadId) ?? null;

  // A reply being generated arrives within seconds, so the 30s idle poll is too slow to feel live.
  const awaitingReply = data?.threads.some((thread) => thread.reply?.status === "pending") ?? false;
  React.useEffect(() => {
    if (!awaitingReply) return;
    const timer = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(timer);
  }, [awaitingReply, load]);

  const updateThread = (thread: Thread) => setData((current) => current ? {
    contacts: current.contacts,
    threads: current.threads.some((existing) => existing.id === thread.id)
      ? current.threads.map((existing) => existing.id === thread.id ? thread : existing)
      : [thread, ...current.threads],
  } : current);

  React.useEffect(() => {
    if (!activeThread || activeThread.kind === "chat" || activeThread.unread === 0) return;
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

  /**
   * Opening straight into a conversation, when Contacts sent us here. Runs once the threads land,
   * and only for a thread that exists — a contact with no history drops you on the list with their
   * composer visible, which is where you would start one anyway.
   */
  React.useEffect(() => {
    if (!openWith || !data) return;
    const existing = data.threads.find((thread) => thread.otherPhoneId === openWith);
    if (existing) setActiveThreadId(existing.id);
  }, [openWith, data]);

  /** The open conversation: an existing thread, or a new one aimed at someone with no history. */
  const conversation = activeThread
    ? {
      name: activeThread.otherName,
      otherPhoneId: activeThread.otherPhoneId,
      messages: activeThread.messages,
      reply: activeThread.reply,
      kind: activeThread.kind,
    }
    : newTo
      ? { name: newTo.name, otherPhoneId: newTo.phoneId, messages: [] as ThreadMessage[], reply: null, kind: "phone" as const }
      : null;

  const startedContactIds = new Set(data?.threads.map((thread) => thread.otherPhoneId));
  const newContacts = data?.contacts.filter((contact) => !startedContactIds.has(contact.phoneId)) ?? [];

  return (
    <section aria-labelledby="messages-title" className={`vp-appview${activeThread ? " vp-appview--fixed" : ""}`}>
      <PhoneAppHeader
        title={conversation ? conversation.name : "Messages"}
        titleId="messages-title"
        closeLabel="Close Messages"
        onBack={() => conversation ? (setActiveThreadId(null), setNewTo(null)) : onBack()}
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
      ) : conversation ? (
        <div className="vp-thread-view">
          <div ref={bubblesRef} className="vp-bubbles" aria-label={`Conversation with ${conversation.name}`}>
            {conversation.messages.length === 0 ? (
              <p className="vp-thread-intro">This is the start of your conversation with {conversation.name}.</p>
            ) : null}
            {conversation.messages.map((message, index) => {
              const previous = conversation.messages[index - 1];
              // A day separator, so a conversation that spans a night reads like one.
              const day = clock.at(message.at).toDateString();
              const newDay = !previous || clock.at(previous.at).toDateString() !== day;
              const mine = message.from === phoneId;
              const last = index === conversation.messages.length - 1;
              return (
                <React.Fragment key={message.id}>
                  {newDay && message.at ? <span className="vp-day-break">{dayLabel(clock, message.at)}</span> : null}
                  <div className={`vp-bubble ${mine ? "vp-bubble--self" : "vp-bubble--other"}`}>
                    {message.text}
                    {message.at ? <span className="vp-bubble-time">{clock.time(message.at)}</span> : null}
                  </div>
                  {mine && last && conversation.reply?.status !== "pending" ? (
                    <span className="vp-receipt">Delivered</span>
                  ) : null}
                </React.Fragment>
              );
            })}
            {conversation.reply?.status === "pending" ? (
              <div className="vp-bubble vp-bubble--other vp-bubble--typing" role="status" aria-label={`${conversation.name} is typing`}>
                <span /><span /><span />
              </div>
            ) : null}
            {conversation.reply?.status === "failed" ? (
              <p role="alert" className="vp-muted-note">{conversation.reply.error ?? "The reply could not be generated."}</p>
            ) : null}
          </div>
          <form className="vp-composer" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void send(conversation.otherPhoneId, draft); }}>
            <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">Message {conversation.name}</span>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={conversation.kind === "chat" ? "Text into the story" : "Message"} maxLength={2000} disabled={sending} className="vp-input" autoFocus={conversation.messages.length === 0} />
            </label>
            <button type="submit" aria-label="Send message" disabled={sending || !draft.trim()} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
          </form>
        </div>
      ) : (
        <div className="vp-list-group">
          {data.threads.length === 0 && newContacts.length === 0 ? (
            <PhoneEmptyState
              icon={MessageSquare}
              title="No conversations"
              body="Nobody else in this scene has a phone yet. Turn on more character phones in Agent Settings."
            />
          ) : null}
          {data.threads.length ? (
            <div className="vp-list vp-list--inset-rules">
              {data.threads.map((thread) => {
                const last = thread.messages.at(-1);
                return (
                  <button key={thread.id} type="button" onClick={() => setActiveThreadId(thread.id)} className="vp-thread-row">
                    <PhoneAvatar name={thread.otherName} url={avatarFor(thread.otherPhoneId)} />
                    <span className="vp-thread-body">
                     <span className="vp-thread-name">{thread.otherName}{thread.kind === "chat" ? <span className="vp-muted-note"> · {thread.mode ?? "roleplay"}</span> : null}</span>
                      <span className="vp-thread-preview">{last ? `${last.from === phoneId ? "You: " : ""}${last.text}` : "No messages yet"}</span>
                    </span>
                    {last?.at ? <span className="vp-row-stamp">{clock.stamp(last.at)}</span> : null}
                    {thread.unread > 0 ? <span className="vp-badge" aria-label={`${thread.unread} unread`}>{thread.unread}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {newContacts.length ? (
            <div className="vp-stack">
              <h3 className="vp-section-label">Start a chat</h3>
              <div className="vp-list vp-list--inset-rules">
                {newContacts.map((contact) => (
                  <button
                    key={contact.phoneId}
                    type="button"
                    className="vp-thread-row"
                    onClick={() => { setDraft(""); setNewTo({ phoneId: contact.phoneId, name: contact.ownerName }); }}
                  >
                    <PhoneAvatar name={contact.ownerName} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
                    <span className="vp-thread-body">
                      <span className="vp-thread-name">{contact.ownerName}</span>
                      <span className="vp-thread-preview">No messages yet</span>
                    </span>
                    <ChevronRight size="1rem" aria-hidden="true" className="vp-row-chevron" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
