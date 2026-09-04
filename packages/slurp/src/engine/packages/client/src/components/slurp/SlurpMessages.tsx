import { ArrowLeft, Check, Coins, Lock, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { Avatar } from "./SlurpShell";
import { SlurpEmptyArtwork } from "./SlurpEmptyArtwork";
import { formatTime } from "./SlurpDateTime";
import {
  useResolveSlurpMessageRequest,
  useSendSlurpMessage,
  useSlurpCompose,
  useSlurpThread,
  useSlurpThreads,
  useTipInSlurpThread,
  type SlurpMessage,
  type SlurpThread,
} from "../../hooks/use-slurp";

/** Tip amounts offered in a thread. Small enough to be a reflex, large enough to mean something. */
const TIP_PRESETS = [5, 15, 50] as const;

/**
 * The Slurp inbox and one thread.
 *
 * Selection lives here rather than in the navigation state: a thread is a place inside Messages,
 * not a separate destination, and routing it would put a browser-history entry behind every tap.
 */
export function SlurpMessagesView({
  personaId,
  ownedCreatorAccountIds,
  composeWithCreatorAccountId = null,
  onOpenProfile,
}: {
  personaId: string | null;
  /** Creator profiles this persona owns, so their request trays can be answered from here. */
  ownedCreatorAccountIds: string[];
  /** Set when Messages was opened from a Creator profile, to land straight in that chat. */
  composeWithCreatorAccountId?: string | null;
  onOpenProfile: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  // Opening a chat from a profile lands in it directly, and backing out returns to the inbox
  // rather than to the profile, so Messages behaves the same however you arrived.
  const [composeWith, setComposeWith] = useState<string | null>(composeWithCreatorAccountId);
  const threadsQuery = useSlurpThreads(personaId);
  const threads = threadsQuery.data?.threads ?? [];

  if (openThreadId || composeWith) {
    return (
      <SlurpThreadView
        threadId={openThreadId}
        creatorAccountId={composeWith}
        personaId={personaId}
        ownedCreatorAccountIds={ownedCreatorAccountIds}
        onBack={() => {
          setOpenThreadId(null);
          setComposeWith(null);
        }}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  const requests = threads.filter((thread) => thread.state === "request");
  const active = threads.filter((thread) => thread.state === "active");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-5">
      {requests.length > 0 && (
        <section aria-labelledby="slurp-message-requests" className="flex flex-col gap-2">
          <h2
            id="slurp-message-requests"
            className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
          >
            {localizeUi("ui.slurp.messages.requests", { defaultValue: "Message requests" })}
          </h2>
          {requests.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} onOpen={() => setOpenThreadId(thread.id)} pending />
          ))}
        </section>
      )}

      <section aria-labelledby="slurp-message-inbox" className="flex flex-col gap-2">
        <h2
          id="slurp-message-inbox"
          className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]"
        >
          {localizeUi("ui.slurp.messages.inbox", { defaultValue: "Inbox" })}
        </h2>
        {active.length === 0 ? (
          <div className="relative isolate overflow-hidden rounded-xl bg-[var(--slurp-surface)] px-6 py-14 text-center ring-1 ring-inset ring-[var(--noodle-divider)]">
            <SlurpEmptyArtwork className="absolute inset-0 -z-10" />
            <MessageCircle size={28} className="mx-auto text-[var(--noodle-accent)]" />
            <p className="mt-3 text-sm font-bold">
              {localizeUi("ui.slurp.messages.emptyTitle", { defaultValue: "No conversations yet" })}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.emptyDetail", {
                defaultValue: "Open a Creator profile and send a message to start one.",
              })}
            </p>
          </div>
        ) : (
          active.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} onOpen={() => setOpenThreadId(thread.id)} />
          ))
        )}
      </section>
    </div>
  );
}

function ThreadRow({
  thread,
  onOpen,
  pending = false,
}: {
  thread: SlurpThread;
  onOpen: () => void;
  pending?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-16 w-full items-center gap-3 rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-left ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--noodle-accent)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
    >
      <Avatar account={{ displayName: thread.creatorDisplayName, avatarUrl: thread.creatorAvatarUrl }} size="md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold">{thread.creatorDisplayName}</span>
          {thread.subscribed && (
            <span className="shrink-0 rounded-full bg-[var(--noodle-accent)]/12 px-1.5 py-0.5 text-[0.6rem] font-bold text-[var(--noodle-accent)]">
              {localizeUi("ui.slurp.messages.subscribed", { defaultValue: "Subscribed" })}
            </span>
          )}
          {pending && (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-600 dark:text-amber-400">
              {localizeUi("ui.slurp.messages.pending", { defaultValue: "Pending" })}
            </span>
          )}
        </span>
        <span className="truncate text-xs text-[var(--muted-foreground)]">
          {thread.lastMessagePreview || localizeUi("ui.slurp.messages.noMessages", { defaultValue: "No messages yet" })}
        </span>
      </span>
      {thread.viewerUnread > 0 && (
        <span
          className="ml-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1.5 text-[0.65rem] font-black tabular-nums text-zinc-950"
          aria-label={localizeUi("ui.slurp.messages.unreadCount", {
            defaultValue: "{{count}} unread",
            count: thread.viewerUnread,
          })}
        >
          {thread.viewerUnread}
        </span>
      )}
    </button>
  );
}

/**
 * One conversation, addressed either by its thread or by the creator it is with.
 *
 * The second form is what a profile links to: there may be no thread yet, and the whole point is
 * that arriving does not create one.
 */
function SlurpThreadView({
  threadId,
  creatorAccountId,
  personaId,
  ownedCreatorAccountIds,
  onBack,
  onOpenProfile,
}: {
  threadId: string | null;
  creatorAccountId: string | null;
  personaId: string | null;
  ownedCreatorAccountIds: string[];
  onBack: () => void;
  onOpenProfile: (accountId: string) => void;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const byThread = useSlurpThread(threadId, personaId);
  const byCreator = useSlurpCompose(threadId ? null : creatorAccountId, personaId);
  const threadQuery = threadId ? byThread : byCreator;
  const send = useSendSlurpMessage();
  const tip = useTipInSlurpThread();
  const resolveRequest = useResolveSlurpMessageRequest();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const thread = threadQuery.data?.thread ?? null;
  const messages = threadQuery.data?.messages ?? [];
  const creator = threadQuery.data?.creator;
  const messaging = threadQuery.data?.messaging;
  const subscribed = thread?.subscribed ?? threadQuery.data?.subscribed ?? false;
  const targetCreatorAccountId = thread?.creatorAccountId ?? creator?.id ?? creatorAccountId;
  const ownsCreator = Boolean(targetCreatorAccountId && ownedCreatorAccountIds.includes(targetCreatorAccountId));
  const busy = send.isPending || tip.isPending;

  // Follow the conversation down as it grows, the way every chat surface does.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typing]);

  /**
   * Hold the reply behind a typing indicator for as long as the server said the creator would
   * take. The reply is already in hand, so this is presentation only — nothing is being waited on.
   */
  const holdTyping = (ms: number) => {
    if (ms <= 0) return;
    setTyping(true);
    window.setTimeout(() => setTyping(false), ms);
  };

  const submit = async () => {
    const content = draft.trim();
    if (!content || !personaId || !targetCreatorAccountId || busy) return;
    setError(null);
    setDraft("");
    try {
      const result = await send.mutateAsync({
        personaId,
        creatorAccountId: targetCreatorAccountId,
        content,
      });
      if (result.reply) holdTyping(result.typingMs ?? 0);
    } catch (cause) {
      // Put the words back in the box. Losing a typed message to a failed request is the one
      // thing a chat surface must never do.
      setDraft(content);
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.sendFailed", { defaultValue: "Could not send that message." }),
      );
    }
  };

  const sendTip = async (amount: number) => {
    if (!personaId || !targetCreatorAccountId || busy) return;
    setError(null);
    try {
      const result = await tip.mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, amount });
      if (result.reply) holdTyping(result.typingMs ?? 0);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.tipFailed", { defaultValue: "Could not send that tip." }),
      );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
          aria-label={localizeUi("ui.slurp.messages.backToInbox", { defaultValue: "Back to inbox" })}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => targetCreatorAccountId && onOpenProfile(targetCreatorAccountId)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-[var(--noodle-accent)]/[0.06]"
        >
          {creator && <Avatar account={creator} size="sm" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{creator?.displayName ?? ""}</span>
            <span className="block truncate text-[0.7rem] text-[var(--muted-foreground)]">
              @{creator?.handle ?? ""}
            </span>
          </span>
        </button>
      </div>

      {thread?.state === "request" && (
        <div className="shrink-0 border-b border-[var(--noodle-divider)] bg-amber-500/[0.07] px-4 py-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            {ownsCreator
              ? localizeUi("ui.slurp.messages.requestForYou", {
                  defaultValue: "This fan is waiting for you to accept their message request.",
                })
              : localizeUi("ui.slurp.messages.requestPending", {
                  defaultValue: "Your message is waiting to be accepted. Subscribing gets you through the queue.",
                })}
          </p>
          {ownsCreator && personaId && thread && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={resolveRequest.isPending}
                onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "accept" })}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
              >
                <Check size={14} /> {localizeUi("ui.slurp.messages.accept", { defaultValue: "Accept" })}
              </button>
              <button
                type="button"
                disabled={resolveRequest.isPending}
                onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "decline" })}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] disabled:opacity-50"
              >
                <X size={14} /> {localizeUi("ui.slurp.messages.decline", { defaultValue: "Decline" })}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {messages.length === 0 && messaging && (
            <p className="mx-auto max-w-sm rounded-xl bg-[var(--slurp-surface)] px-4 py-3 text-center text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]">
              {messaging.dmPolicy === "closed"
                ? localizeUi("ui.slurp.messages.policyClosed", {
                    defaultValue: "{{name}} has direct messages turned off.",
                    name: creator?.displayName ?? "",
                  })
                : messaging.dmPolicy === "paid" && !subscribed
                  ? localizeUi("ui.slurp.messages.policyPaid", {
                      defaultValue: "Your first message costs {{fee}} coins unless you subscribe.",
                      fee: messaging.requestFee,
                    })
                  : messaging.dmPolicy === "subscribers" && !subscribed
                    ? localizeUi("ui.slurp.messages.policySubscribers", {
                        defaultValue: "You are not subscribed, so your first message goes to their requests.",
                      })
                    : localizeUi("ui.slurp.messages.policyOpen", {
                        defaultValue: "Say hello.",
                      })}
            </p>
          )}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} locale={i18n.language} />
          ))}
          {typing && (
            <p
              aria-live="polite"
              className="self-start rounded-2xl rounded-bl-md bg-[var(--slurp-surface)] px-3 py-2 text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              {localizeUi("ui.slurp.messages.typing", {
                defaultValue: "{{name}} is typing…",
                name: creator?.displayName ?? "",
              })}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <p role="alert" className="shrink-0 px-4 pb-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="shrink-0 border-t border-[var(--noodle-divider)] p-2">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Coins size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            {TIP_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={busy || !personaId || !targetCreatorAccountId}
                onClick={() => sendTip(amount)}
                className="min-h-8 rounded-full px-2.5 text-[0.7rem] font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              >
                {localizeUi("ui.slurp.messages.tipAmount", { defaultValue: "Tip {{amount}}", amount })}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="sr-only" htmlFor="slurp-message-draft">
              {localizeUi("ui.slurp.messages.composerLabel", { defaultValue: "Write a message" })}
            </label>
            <textarea
              id="slurp-message-draft"
              value={draft}
              rows={1}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line: the convention every chat box uses.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={localizeUi("ui.slurp.messages.composerPlaceholder", { defaultValue: "Write a message…" })}
              className="max-h-40 min-h-11 w-full flex-1 resize-y rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !personaId || !targetCreatorAccountId}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--noodle-accent)] text-zinc-950 transition-[opacity,transform] active:scale-[0.96] disabled:opacity-40 motion-reduce:active:scale-100"
              aria-label={localizeUi("ui.slurp.messages.send", { defaultValue: "Send" })}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, locale }: { message: SlurpMessage; locale: string }) {
  const { t: localizeUi } = useUiTranslation();
  const mine = message.role === "viewer";
  if (message.kind === "tip") {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 self-center rounded-full bg-[var(--noodle-accent)]/12 px-3 py-1 text-[0.7rem] font-bold text-[var(--noodle-accent)]",
        )}
      >
        <Coins size={12} aria-hidden="true" />
        {localizeUi("ui.slurp.messages.tipSent", { defaultValue: "Tipped {{amount}} coins", amount: message.price })}
      </p>
    );
  }
  return (
    <div className={cn("flex max-w-[85%] flex-col gap-0.5", mine ? "self-end items-end" : "self-start items-start")}>
      <div
        className={cn(
          "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
          mine
            ? "rounded-br-md bg-[var(--noodle-accent)] text-zinc-950"
            : "rounded-bl-md bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]",
        )}
      >
        {message.kind === "ppv" && !message.unlockedAt ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]">
            <Lock size={13} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.locked", {
              defaultValue: "Locked content — {{price}} coins",
              price: message.price,
            })}
          </span>
        ) : (
          message.content
        )}
      </div>
      <time dateTime={message.createdAt} className="px-1 text-[0.65rem] text-[var(--muted-foreground)]">
        {formatTime(message.createdAt, locale)}
      </time>
    </div>
  );
}
