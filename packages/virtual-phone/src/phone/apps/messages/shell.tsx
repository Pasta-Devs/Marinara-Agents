import React from "react";
import { ChevronRight, MessageSquare, Search, Send } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneAvatar, useAvatarMap } from "../../platform/avatars";
import { useStoryClock } from "../../platform/story-clock";
import { PhoneEmptyState } from "../../platform/empty-state";
import { decodeLaunchIntent } from "../../platform/launch-intent";

interface ThreadMessage {
  id: string;
  from: string;
  text: string;
  at: string;
  deliveredAt?: string;
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
  contacts: Array<{ phoneId: string; ownerId?: string; ownerName: string; bio?: string }>;
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
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [composing, setComposing] = React.useState(false);
  const launchIntent = React.useMemo(() => decodeLaunchIntent(openWith), [openWith]);
  const [data, setData] = React.useState<MessagingPayload | null>(null);
  const [error, setError] = React.useState("");
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);
  /**
   * A conversation that does not exist yet. Starting one used to mean typing into one of a stack of
   * little forms on the list screen, one per person — so the first message to someone happened in a
   * different place from every message after it.
   */
  const [newTo, setNewTo] = React.useState<{ phoneId: string; name: string } | null>(null);
  // Drafts belong to recipients. A single shared draft can accidentally put words intended for
  // one character into another character's conversation after navigating back.
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);
  const bubblesRef = React.useRef<HTMLDivElement>(null);
  const handledLaunchRef = React.useRef("");
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
    setNewTo(null);
    setComposing(false);
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
      setDrafts((current) => ({ ...current, [toPhoneId]: "" }));
      setNewTo(null);
      setComposing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Message could not be sent");
    } finally {
      setSending(false);
    }
  };

  /**
   * Opening straight into a conversation, when Contacts sent us here. Runs once the threads land,
   * then opens either the existing thread or a fresh composer for that contact.
   */
  React.useEffect(() => {
    if (!data) return;
    const launchKey = `${phoneId}:${openWith}`;
    if (handledLaunchRef.current === launchKey) return;
    handledLaunchRef.current = launchKey;
    if (launchIntent.draft && launchIntent.target) {
      const target = launchIntent.target;
      const incomingDraft = launchIntent.draft;
      setDrafts((current) => current[target] ? current : { ...current, [target]: incomingDraft });
    }
    if (!launchIntent.target) return;
    const existing = data.threads.find((thread) => thread.otherPhoneId === launchIntent.target);
    if (existing) setActiveThreadId(existing.id);
    else {
      const contact = data.contacts.find((candidate) => candidate.phoneId === launchIntent.target);
      if (contact) setNewTo({ phoneId: contact.phoneId, name: contact.ownerName });
    }
  }, [phoneId, openWith, launchIntent, data]);

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
  const draft = conversation ? drafts[conversation.otherPhoneId] ?? "" : "";
  const setDraft = (value: string) => {
    if (!conversation) return;
    setDrafts((current) => ({ ...current, [conversation.otherPhoneId]: value }));
  };

  const needle = query.trim().toLocaleLowerCase();
  const visibleThreads = data?.threads.filter((thread) => {
    const searchableMessages = thread.messages.map((message) => message.text).join(" ");
    return (filter === "all" || thread.unread > 0) && (!needle || `${thread.otherName} ${searchableMessages}`.toLocaleLowerCase().includes(needle));
  }) ?? [];
  const visibleContacts = data?.contacts.filter((contact) => !needle || `${contact.ownerName} ${contact.bio ?? ""}`.toLocaleLowerCase().includes(needle)) ?? [];

  return (
    <section aria-labelledby="messages-title" className={`vp-appview${conversation ? " vp-appview--fixed" : ""}`} data-phone-app="messages">
      <PhoneAppHeader
        title={conversation ? conversation.name : composing ? "New Message" : "Messages"}
        titleId="messages-title"
        closeLabel="Close Messages"
        center={conversation ? (
          <div className="vp-conversation-person">
            <PhoneAvatar name={conversation.name} url={avatarFor(conversation.otherPhoneId)} />
            <span><strong>{conversation.name}</strong><small>{conversation.kind === "chat" ? "Story conversation" : "Contact"}</small></span>
          </div>
        ) : undefined}
        onBack={() => conversation
          ? (setActiveThreadId(null), setNewTo(null))
          : composing
            ? (setComposing(false), setQuery(""))
            : onBack()}
        onClose={onClose}
        actions={conversation
          ? [{ id: "refresh", icon: "refresh", label: "Check for new messages", kind: "button" }]
          : composing
            ? []
            : [{ id: "compose", icon: "add", label: "New message", kind: "button" }]}
        onAction={(actionId) => {
          if (actionId === "refresh") void load();
          if (actionId === "compose") { setComposing(true); setFilter("all"); setQuery(""); }
        }}
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
          {conversation.kind === "chat" ? (
            <p className="vp-story-thread-note">Messages sent here enter the current story and can shape what happens next.</p>
          ) : null}
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
                    <span className="vp-receipt">{message.deliveredAt ? "Delivered" : "Sent"}</span>
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
              <p role="alert" className="vp-reply-failed" title={conversation.reply.error}>No reply arrived. Check again in a moment.</p>
            ) : null}
          </div>
          <form className="vp-composer" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void send(conversation.otherPhoneId, draft); }}>
            <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">Message {conversation.name}</span>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${conversation.name}`} maxLength={2000} disabled={sending} className="vp-input" autoFocus={conversation.messages.length === 0} />
            </label>
            <button type="submit" aria-label="Send message" disabled={sending || !draft.trim()} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
          </form>
        </div>
      ) : composing ? (
        <div className="vp-list-group vp-message-compose">
          <label className="vp-inline-search"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Choose a recipient</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="To: search contacts" autoFocus /></label>
          {visibleContacts.length ? (
            <div className="vp-list vp-list--inset-rules">
              {visibleContacts.map((contact) => {
                const existing = data.threads.find((thread) => thread.otherPhoneId === contact.phoneId);
                return (
                  <button key={contact.phoneId} type="button" className="vp-thread-row" onClick={() => {
                    setQuery("");
                    setComposing(false);
                    if (existing) setActiveThreadId(existing.id);
                    else setNewTo({ phoneId: contact.phoneId, name: contact.ownerName });
                  }}>
                    <PhoneAvatar name={contact.ownerName} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
                    <span className="vp-thread-body"><span className="vp-thread-name">{contact.ownerName}</span><span className="vp-thread-preview">{contact.bio || (existing ? "Open conversation" : "Start a conversation")}</span></span>
                    <ChevronRight size="1rem" aria-hidden="true" className="vp-row-chevron" />
                  </button>
                );
              })}
            </div>
          ) : <PhoneEmptyState icon={Search} title="No contact found" body="Try another name, or add someone in Contacts first." />}
        </div>
      ) : (
        <div className="vp-list-group">
          <label className="vp-inline-search"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Search conversations</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /></label>
          <div className="vp-filter-tabs" role="tablist" aria-label="Conversation filter"><button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>All</button><button type="button" role="tab" aria-selected={filter === "unread"} onClick={() => setFilter("unread")}>Unread{data.threads.some((thread) => thread.unread > 0) ? ` (${data.threads.reduce((sum, thread) => sum + thread.unread, 0)})` : ""}</button></div>
          {data.threads.length === 0 && !needle && filter === "all" ? (
            <PhoneEmptyState
              icon={MessageSquare}
              title="No conversations"
              body={data.contacts.length ? "Start a message with the + button." : "Add a contact or enable another character’s phone to start messaging."}
            />
          ) : null}
          {visibleThreads.length ? (
            <div className="vp-list vp-list--inset-rules">
              {visibleThreads.map((thread) => {
                const last = thread.messages.at(-1);
                return (
                  <button key={thread.id} type="button" onClick={() => setActiveThreadId(thread.id)} className="vp-thread-row">
                    <PhoneAvatar name={thread.otherName} url={avatarFor(thread.otherPhoneId)} />
                    <span className="vp-thread-body">
                     <span className="vp-thread-name">{thread.otherName}{thread.kind === "chat" ? <span className="vp-thread-kind">Story</span> : null}</span>
                      <span className="vp-thread-preview">{last ? `${last.from === phoneId ? "You: " : ""}${last.text}` : "No messages yet"}</span>
                    </span>
                    {last?.at ? <span className="vp-row-stamp">{clock.stamp(last.at)}</span> : null}
                    {thread.unread > 0 ? <span className="vp-badge" aria-label={`${thread.unread} unread`}>{thread.unread}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {(needle || filter === "unread") && visibleThreads.length === 0 ? <PhoneEmptyState icon={filter === "unread" ? MessageSquare : Search} title={filter === "unread" ? "No unread messages" : "No conversation found"} body={filter === "unread" ? "You’re caught up." : "Try a person’s name or words from the latest message."} /> : null}
        </div>
      )}
    </section>
  );
}
