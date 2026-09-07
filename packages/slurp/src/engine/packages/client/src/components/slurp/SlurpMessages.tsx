import {
  ArrowLeft,
  Check,
  Coins,
  Lock,
  MessageCircle,
  Megaphone,
  Palette,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { cn } from "../../lib/utils";
import { Avatar } from "./SlurpShell";
import { SlurpEmptyArtwork } from "./SlurpEmptyArtwork";
import { formatTime } from "./SlurpDateTime";
import {
  useAcceptSlurpCommission,
  useDeclineSlurpCommission,
  useBroadcastSlurpMessage,
  useCreateSlurpCommission,
  useDeliverSlurpCommission,
  useQuoteSlurpCommission,
  useResolveSlurpMessageRequest,
  useDraftSlurpCreatorReply,
  useSendSlurpCreatorPpv,
  useSendSlurpCreatorReply,
  useSendSlurpMessage,
  useSlurpCompose,
  useSlurpThread,
  useSlurpThreads,
  useTipInSlurpThread,
  useUnlockSlurpMessage,
  type SlurpCommission,
  type SlurpMessage,
  type SlurpRapport,
  type SlurpThread,
} from "../../hooks/use-slurp";

/** Tip amounts offered in a thread. Small enough to be a reflex, large enough to mean something. */
const TIP_PRESETS = [5, 15, 50] as const;

export type SlurpMessageThreadContext = Pick<
  SlurpThread,
  | "id"
  | "creatorAccountId"
  | "creatorDisplayName"
  | "creatorHandle"
  | "creatorAvatarUrl"
  | "viewerAccountId"
  | "counterpartName"
  | "counterpartHandle"
  | "subscribed"
  | "rapport"
>;

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
  initialThreadId = null,
  onOpenProfile,
  onThreadContextChange,
}: {
  personaId: string | null;
  /** Creator profiles this persona owns, so their request trays can be answered from here. */
  ownedCreatorAccountIds: string[];
  /** Set when Messages was opened from a Creator profile, to land straight in that chat. */
  composeWithCreatorAccountId?: string | null;
  /** Set by an Activity event that points at an existing conversation. */
  initialThreadId?: string | null;
  onOpenProfile: (accountId: string) => void;
  onThreadContextChange?: (thread: SlurpMessageThreadContext | null) => void;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const [openThreadId, setOpenThreadId] = useState<string | null>(initialThreadId);
  // Opening a chat from a profile lands in it directly, and backing out returns to the inbox
  // rather than to the profile, so Messages behaves the same however you arrived.
  const [composeWith, setComposeWith] = useState<string | null>(composeWithCreatorAccountId);
  const [search, setSearch] = useState("");
  const threadsQuery = useSlurpThreads(personaId);
  const threads = threadsQuery.data?.threads ?? [];
  const openThread = [...threads, ...(threadsQuery.data?.inbound ?? [])].find((thread) => thread.id === openThreadId);

  useEffect(() => {
    onThreadContextChange?.(openThread ?? null);
    return () => onThreadContextChange?.(null);
  }, [onThreadContextChange, openThread]);

  useEffect(() => {
    if (initialThreadId) {
      setComposeWith(null);
      setOpenThreadId(initialThreadId);
    }
  }, [initialThreadId]);

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

  const needle = search.trim().toLocaleLowerCase();
  // Match the name, the handle, and the preview: the three things actually visible on a row.
  const matches = (thread: SlurpThread) =>
    !needle ||
    `${thread.creatorDisplayName} ${thread.creatorHandle} ${thread.lastMessagePreview}`
      .toLocaleLowerCase()
      .includes(needle);
  const inbound = (threadsQuery.data?.inbound ?? []).filter(
    (thread) =>
      !needle ||
      `${thread.counterpartName ?? ""} ${thread.counterpartHandle ?? ""} ${thread.lastMessagePreview}`
        .toLocaleLowerCase()
        .includes(needle),
  );
  const requests = threads.filter((thread) => thread.state === "request" && matches(thread));
  const active = threads.filter((thread) => thread.state === "active" && matches(thread));
  const unread =
    threads.reduce((total, thread) => total + thread.viewerUnread, 0) + (threadsQuery.data?.inboundUnread ?? 0);
  // Broadcasting is per creator, so it only makes sense once this persona owns one.
  const broadcastCreatorId = ownedCreatorAccountIds[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-3 py-4 sm:px-5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <label className="sr-only" htmlFor="slurp-message-search">
            {localizeUi("ui.slurp.messages.searchLabel", { defaultValue: "Search conversations" })}
          </label>
          <input
            id="slurp-message-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.searchPlaceholder", { defaultValue: "Search conversations…" })}
            className="h-11 w-full rounded-xl bg-[linear-gradient(135deg,var(--slurp-surface-raised),var(--slurp-surface))] pl-9 pr-3 text-base shadow-[var(--slurp-shadow-raised)] outline-none ring-1 ring-inset ring-white/[0.06] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm"
          />
        </div>
        {unread > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--noodle-accent)]/12 px-2.5 py-1 text-[0.7rem] font-bold tabular-nums text-[var(--noodle-accent)]">
            {localizeUi("ui.slurp.messages.unreadTotal", { defaultValue: "{{count}} unread", count: unread })}
          </span>
        )}
      </div>

      {broadcastCreatorId && personaId && (
        <BroadcastPanel creatorAccountId={broadcastCreatorId} personaId={personaId} />
      )}

      {inbound.length > 0 && (
        <section aria-labelledby="slurp-message-inbound" className="flex flex-col">
          <h2 id="slurp-message-inbound" className="px-2 pb-1 text-xs font-semibold text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.inbound", { defaultValue: "Written to your Creators" })}
          </h2>
          {inbound.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={{
                ...thread,
                // The counterpart on this side is the fan, not the Creator, so the row names them.
                creatorDisplayName:
                  thread.counterpartName ?? localizeUi("ui.slurp.messages.unknownFan", { defaultValue: "Someone" }),
                creatorHandle: thread.counterpartHandle ?? "",
                creatorAvatarUrl: null,
                viewerUnread: thread.creatorUnread,
              }}
              locale={i18n.language}
              onOpen={() => setOpenThreadId(thread.id)}
            />
          ))}
        </section>
      )}

      {requests.length > 0 && (
        <section aria-labelledby="slurp-message-requests" className="flex flex-col">
          <h2 id="slurp-message-requests" className="px-2 pb-1 text-xs font-semibold text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.requests", { defaultValue: "Message requests" })}
          </h2>
          {requests.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              locale={i18n.language}
              onOpen={() => setOpenThreadId(thread.id)}
              pending
            />
          ))}
        </section>
      )}

      <section aria-labelledby="slurp-message-inbox" className="flex flex-col">
        <h2 id="slurp-message-inbox" className="sr-only">
          {localizeUi("ui.slurp.messages.conversations", { defaultValue: "Conversations" })}
        </h2>
        {active.length === 0 ? (
          <div className="relative isolate overflow-hidden rounded-xl bg-[linear-gradient(145deg,var(--slurp-surface-raised),var(--slurp-surface))] px-6 py-9 text-center shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.06]">
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
            <ThreadRow
              key={thread.id}
              thread={thread}
              locale={i18n.language}
              onOpen={() => setOpenThreadId(thread.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function ThreadRow({
  thread,
  locale,
  onOpen,
  pending = false,
}: {
  thread: SlurpThread;
  locale: string;
  onOpen: () => void;
  pending?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[4.5rem] w-full items-center gap-3 border-b border-white/[0.055] px-2 py-2.5 text-start transition-[background-color,transform] last:border-b-0 hover:bg-[var(--noodle-accent)]/[0.055] active:scale-[0.96] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <Avatar account={{ displayName: thread.creatorDisplayName, avatarUrl: thread.creatorAvatarUrl }} size="md" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
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
        {thread.creatorHandle && (
          <span className="truncate text-[0.7rem] text-[var(--muted-foreground)]">@{thread.creatorHandle}</span>
        )}
        <span className="truncate text-xs text-[var(--muted-foreground)]">
          {thread.lastMessagePreview || localizeUi("ui.slurp.messages.noMessages", { defaultValue: "No messages yet" })}
        </span>
      </span>
      <time
        dateTime={thread.lastMessageAt}
        className="shrink-0 self-start pt-0.5 text-[0.65rem] tabular-nums text-[var(--muted-foreground)]"
      >
        {formatTime(thread.lastMessageAt, locale)}
      </time>
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
  const createCommission = useCreateSlurpCommission();
  const creatorReply = useSendSlurpCreatorReply();
  const draftReply = useDraftSlurpCreatorReply();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const thread = threadQuery.data?.thread ?? null;
  const messages = threadQuery.data?.messages ?? [];
  const creator = threadQuery.data?.creator;
  const counterpart = threadQuery.data?.counterpart ?? creator;
  const messaging = threadQuery.data?.messaging;
  const commissions = threadQuery.data?.commissions ?? [];
  const subscribed = thread?.subscribed ?? threadQuery.data?.subscribed ?? false;
  const targetCreatorAccountId = thread?.creatorAccountId ?? creator?.id ?? creatorAccountId;
  const ownsCreator = Boolean(targetCreatorAccountId && ownedCreatorAccountIds.includes(targetCreatorAccountId));
  const headerAccount = ownsCreator ? counterpart : creator;
  const headerProfileId = ownsCreator ? thread?.viewerAccountId : targetCreatorAccountId;
  const busy = send.isPending || tip.isPending || creatorReply.isPending || draftReply.isPending;

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
      // On a Creator-side thread the player is the Creator, so the message goes the other way.
      // Sending through the viewer route here opened a second conversation from the persona to
      // their own Creator instead of answering the fan.
      if (ownsCreator && thread) {
        await creatorReply.mutateAsync({
          creatorAccountId: thread.creatorAccountId,
          personaId,
          viewerAccountId: thread.viewerAccountId,
          content,
        });
        return;
      }
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
          onClick={() => headerProfileId && onOpenProfile(headerProfileId)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-[var(--noodle-accent)]/[0.06]"
        >
          {headerAccount && <Avatar account={headerAccount} size="sm" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{headerAccount?.displayName ?? ""}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[0.7rem] text-[var(--muted-foreground)]">
                @{headerAccount?.handle ?? ""}
              </span>
              {/* Rapport decides how fast and how warmly a Creator answers. The player felt it and
                  could never see it, so the one number the whole thread turns on was invisible. */}
              {thread && <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />}
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
            <MessageBubble
              key={message.id}
              message={message}
              locale={i18n.language}
              personaId={personaId}
              ownsCreator={ownsCreator}
            />
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

      {commissions.length > 0 && personaId && (
        <div className="shrink-0 border-t border-[var(--noodle-divider)] px-3 py-2">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
            {commissions.map((commission) => (
              <CommissionRow
                key={commission.id}
                commission={commission}
                personaId={personaId}
                ownsCreator={ownsCreator}
              />
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-[var(--noodle-divider)] p-2">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {ownsCreator && personaId && thread ? (
            <CreatorMessageTools
              creatorAccountId={thread.creatorAccountId}
              viewerAccountId={thread.viewerAccountId}
              personaId={personaId}
              defaultPpvPrice={messaging?.ppvPrice ?? 0}
            />
          ) : (
            <CommissionRequest
              disabled={busy || !personaId || !targetCreatorAccountId}
              pending={createCommission.isPending}
              onSubmit={(brief) => {
                if (!personaId || !targetCreatorAccountId) return;
                setError(null);
                createCommission
                  .mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, brief })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : localizeUi("ui.slurp.messages.commissionFailed", {
                            defaultValue: "Could not send that request.",
                          }),
                    ),
                  );
              }}
            />
          )}
          {ownsCreator && thread && personaId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                draftReply
                  .mutateAsync({ creatorAccountId: thread.creatorAccountId, personaId, threadId: thread.id })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : localizeUi("ui.slurp.messages.draftFailed", { defaultValue: "Could not draft a reply." }),
                    ),
                  );
              }}
              className="self-start rounded-lg px-2 py-1 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
            >
              {draftReply.isPending
                ? localizeUi("ui.slurp.messages.drafting", { defaultValue: "Writing…" })
                : localizeUi("ui.slurp.messages.draftReply", { defaultValue: "Let them answer" })}
            </button>
          )}
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

function MessageBubble({
  message,
  locale,
  personaId,
  ownsCreator,
}: {
  message: SlurpMessage;
  locale: string;
  personaId?: string | null;
  ownsCreator: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const unlock = useUnlockSlurpMessage();
  const messageImage = useSlurpMediaSrc(message.imageUrl);
  const mine = ownsCreator ? message.role === "creator" : message.role === "viewer";
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
          <button
            type="button"
            disabled={!personaId || unlock.isPending}
            onClick={() => personaId && unlock.mutate({ personaId, messageId: message.id })}
            className="inline-flex items-center gap-1.5 text-left text-[var(--muted-foreground)] underline-offset-2 hover:underline disabled:opacity-60"
          >
            <Lock size={13} aria-hidden="true" />
            {localizeUi("ui.slurp.messages.unlock", {
              defaultValue: "Unlock for {{price}} coins",
              price: message.price,
            })}
          </button>
        ) : (
          message.content
        )}
      </div>
      {/* Paid messages are usually a picture. The column existed; nothing ever rendered it. */}
      {messageImage && (
        <img
          src={messageImage}
          alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Attached image" })}
          className="mt-1 max-h-72 w-auto max-w-full rounded-2xl object-contain ring-1 ring-inset ring-[var(--noodle-divider)]"
        />
      )}
      {unlock.isError && (
        <p role="alert" className="px-1 text-[0.65rem] text-red-600 dark:text-red-400">
          {unlock.error instanceof Error
            ? unlock.error.message
            : localizeUi("ui.slurp.messages.unlockFailed", { defaultValue: "Unlock failed." })}
        </p>
      )}
      <time dateTime={message.createdAt} className="px-1 text-[0.65rem] text-[var(--muted-foreground)]">
        {formatTime(message.createdAt, locale)}
      </time>
    </div>
  );
}

/**
 * Send one paid broadcast to every active subscriber.
 *
 * Collapsed until asked for: it is a creator-side tool sitting on top of a fan-side inbox, and an
 * always-open textarea there reads like the place you write to whoever you last spoke to.
 */
function BroadcastPanel({ creatorAccountId, personaId }: { creatorAccountId: string; personaId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const broadcast = useBroadcastSlurpMessage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    const content = draft.trim();
    if (!content || broadcast.isPending) return;
    try {
      const sent = await broadcast.mutateAsync({ creatorAccountId, personaId, content });
      setDraft("");
      setResult(
        localizeUi("ui.slurp.messages.broadcastSent", {
          defaultValue: "Sent to {{count}} subscribers.",
          count: sent.sent,
        }),
      );
    } catch (cause) {
      setResult(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.broadcastFailed", { defaultValue: "Could not send that broadcast." }),
      );
    }
  };

  return (
    <section className="overflow-hidden rounded-xl bg-[var(--slurp-surface)]/55 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.055]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-start text-xs font-semibold text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.05] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Megaphone size={15} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.broadcast", { defaultValue: "Broadcast to subscribers" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="sr-only" htmlFor="slurp-broadcast-draft">
            {localizeUi("ui.slurp.messages.broadcastLabel", { defaultValue: "Broadcast message" })}
          </label>
          <textarea
            id="slurp-broadcast-draft"
            value={draft}
            rows={2}
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.broadcastPlaceholder", {
              defaultValue: "Something for everyone who subscribes…",
            })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <div className="flex items-center justify-between gap-2">
            <p aria-live="polite" className="min-w-0 truncate text-xs text-[var(--muted-foreground)]">
              {result}
            </p>
            <button
              type="button"
              disabled={!draft.trim() || broadcast.isPending}
              onClick={() => void submit()}
              className="min-h-9 shrink-0 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
            >
              {localizeUi("ui.slurp.messages.broadcastSend", { defaultValue: "Send broadcast" })}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Creator-side composer for one locked message, priced per send. */
function CreatorMessageTools({
  creatorAccountId,
  viewerAccountId,
  personaId,
  defaultPpvPrice,
}: {
  creatorAccountId: string;
  viewerAccountId: string;
  personaId: string;
  /** The creator's configured PPV price, used as the opening offer rather than a fixed one. */
  defaultPpvPrice: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  const sendPpv = useSendSlurpCreatorPpv();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [price, setPrice] = useState(defaultPpvPrice > 0 ? defaultPpvPrice : 10);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const body = content.trim();
    if (!body || price <= 0 || sendPpv.isPending) return;
    setError(null);
    try {
      await sendPpv.mutateAsync({
        creatorAccountId,
        personaId,
        viewerAccountId,
        content: body,
        price,
      });
      setContent("");
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.ppvFailed", { defaultValue: "Could not send that locked message." }),
      );
    }
  };

  return (
    <div className="rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-xs font-bold"
      >
        <Lock size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.sendPpv", { defaultValue: "Send locked content" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="sr-only" htmlFor="slurp-ppv-draft">
            {localizeUi("ui.slurp.messages.ppvLabel", { defaultValue: "Locked message" })}
          </label>
          <textarea
            id="slurp-ppv-draft"
            value={content}
            rows={2}
            maxLength={2000}
            onChange={(event) => setContent(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.ppvPlaceholder", { defaultValue: "What they pay to see…" })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="slurp-ppv-price" className="text-xs font-bold text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.ppvPrice", { defaultValue: "Price" })}
            </label>
            <input
              id="slurp-ppv-price"
              type="number"
              min={1}
              max={9999}
              value={price}
              onChange={(event) => setPrice(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
              className="h-9 w-24 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-2 text-sm tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
            />
            <button
              type="button"
              disabled={!content.trim() || price <= 0 || sendPpv.isPending}
              onClick={() => void submit()}
              className="ml-auto min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
            >
              {localizeUi("ui.slurp.messages.ppvSend", { defaultValue: "Send locked" })}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Fan-side brief. A commission starts as a description and a price the creator names later. */
function CommissionRequest({
  disabled,
  pending,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: (brief: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");

  return (
    <div className="rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-xs font-bold"
      >
        <Palette size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.commissionAsk", { defaultValue: "Request a commission" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="sr-only" htmlFor="slurp-commission-brief">
            {localizeUi("ui.slurp.messages.commissionLabel", { defaultValue: "Commission brief" })}
          </label>
          <textarea
            id="slurp-commission-brief"
            value={brief}
            rows={2}
            maxLength={2000}
            onChange={(event) => setBrief(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.commissionPlaceholder", {
              defaultValue: "Describe what you want made…",
            })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <button
            type="button"
            disabled={disabled || pending || !brief.trim()}
            onClick={() => {
              onSubmit(brief.trim());
              setBrief("");
              setOpen(false);
            }}
            className="ml-auto min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
          >
            {localizeUi("ui.slurp.messages.commissionSend", { defaultValue: "Send brief" })}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One commission, showing only the action its current state allows.
 *
 * The two sides never see the same button: the creator quotes and delivers, the fan accepts. A
 * state with nothing to do for this side renders as a status line, so the row still explains
 * what is being waited on.
 */
function CommissionRow({
  commission,
  personaId,
  ownsCreator,
}: {
  commission: SlurpCommission;
  personaId: string;
  ownsCreator: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const quote = useQuoteSlurpCommission();
  const accept = useAcceptSlurpCommission();
  const deliver = useDeliverSlurpCommission();
  const decline = useDeclineSlurpCommission();
  const [price, setPrice] = useState(commission.price > 0 ? commission.price : 25);
  // Only an unpaid commission can be called off; after accept the coins have moved.
  const canEnd = commission.state === "brief" || commission.state === "quoted";
  const [generateImage, setGenerateImage] = useState(false);
  const [delivery, setDelivery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = quote.isPending || accept.isPending || deliver.isPending;

  const run = (action: Promise<unknown>, fallback: string) => {
    setError(null);
    action.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : fallback));
  };

  return (
    <div className="rounded-xl bg-[var(--slurp-surface)] p-3 text-xs ring-1 ring-inset ring-[var(--noodle-divider)]">
      <p className="flex items-center gap-1.5 font-bold">
        <Sparkles size={13} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi(`ui.slurp.messages.commissionState.${commission.state}`, { defaultValue: commission.state })}
        {commission.price > 0 && (
          <span className="tabular-nums text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.commissionPrice", {
              defaultValue: "{{price}} coins",
              price: commission.price,
            })}
          </span>
        )}
      </p>
      <p className="mt-1 line-clamp-3 text-[var(--muted-foreground)]">{commission.brief}</p>

      {ownsCreator && commission.state === "brief" && (
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={`slurp-quote-${commission.id}`} className="sr-only">
            {localizeUi("ui.slurp.messages.commissionQuoteLabel", { defaultValue: "Quote price" })}
          </label>
          <input
            id={`slurp-quote-${commission.id}`}
            type="number"
            min={1}
            max={9999}
            value={price}
            onChange={(event) => setPrice(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
            className="h-9 w-24 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-2 tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <button
            type="button"
            disabled={busy || price <= 0}
            onClick={() =>
              run(
                quote.mutateAsync({ commissionId: commission.id, personaId, price }),
                localizeUi("ui.slurp.messages.commissionQuoteFailed", { defaultValue: "Could not send that quote." }),
              )
            }
            className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 font-bold text-zinc-950 disabled:opacity-50"
          >
            {localizeUi("ui.slurp.messages.commissionQuote", { defaultValue: "Quote" })}
          </button>
        </div>
      )}

      {/* A brief with no exit sat in the thread forever. Either side may end it until it is paid. */}
      {canEnd && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              decline.mutateAsync({ commissionId: commission.id, personaId }),
              localizeUi("ui.slurp.messages.commissionDeclineFailed", {
                defaultValue: "Could not end that commission.",
              }),
            )
          }
          className="mt-2 min-h-9 rounded-lg px-3 font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          {ownsCreator
            ? localizeUi("ui.slurp.messages.commissionDecline", { defaultValue: "Decline" })
            : localizeUi("ui.slurp.messages.commissionWithdraw", { defaultValue: "Withdraw request" })}
        </button>
      )}

      {!ownsCreator && commission.state === "quoted" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              accept.mutateAsync({ commissionId: commission.id, personaId }),
              localizeUi("ui.slurp.messages.commissionAcceptFailed", { defaultValue: "Not enough coins." }),
            )
          }
          className="mt-2 min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 font-bold text-zinc-950 disabled:opacity-50"
        >
          {localizeUi("ui.slurp.messages.commissionAccept", {
            defaultValue: "Accept for {{price}} coins",
            price: commission.price,
          })}
        </button>
      )}

      {ownsCreator && commission.state === "accepted" && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="sr-only" htmlFor={`slurp-deliver-${commission.id}`}>
            {localizeUi("ui.slurp.messages.commissionDeliverLabel", { defaultValue: "Delivery" })}
          </label>
          <textarea
            id={`slurp-deliver-${commission.id}`}
            value={delivery}
            rows={2}
            maxLength={2000}
            onChange={(event) => setDelivery(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.commissionDeliverPlaceholder", {
              defaultValue: "Deliver the finished piece…",
            })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <label className="flex min-h-9 items-center gap-2 text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={generateImage}
              onChange={(event) => setGenerateImage(event.target.checked)}
              className="size-4 accent-[var(--noodle-accent)]"
            />
            {localizeUi("ui.slurp.messages.generateCommissionImage", {
              defaultValue: "Generate the commissioned image from the brief",
            })}
          </label>
          <button
            type="button"
            disabled={busy || !delivery.trim()}
            onClick={() =>
              run(
                deliver
                  .mutateAsync({
                    commissionId: commission.id,
                    personaId,
                    content: delivery.trim(),
                    generateImage,
                  })
                  .then(() => {
                    setDelivery("");
                    setGenerateImage(false);
                  }),
                localizeUi("ui.slurp.messages.commissionDeliverFailed", { defaultValue: "Could not deliver that." }),
              )
            }
            className="ml-auto min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 font-bold text-zinc-950 disabled:opacity-50"
          >
            {localizeUi("ui.slurp.messages.commissionDeliver", { defaultValue: "Deliver" })}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * How well this pair knows each other, as one word.
 *
 * The score itself stays hidden: a number invites the player to farm it, and the tiers gate
 * nothing. The word is what the Creator is reacting to, so the word is what to show.
 */
function SlurpRapportBadge({ rapport, ownsCreator }: { rapport: SlurpRapport; ownsCreator: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  // A stranger badge on an empty thread is noise: everybody starts there.
  if (!rapport || rapport.tier === "stranger") return null;
  return (
    <span
      title={localizeUi(
        ownsCreator ? `ui.slurp.rapport.creatorHint.${rapport.tier}` : `ui.slurp.rapport.viewerHint.${rapport.tier}`,
      )}
      className="inline-flex shrink-0 items-center rounded-full bg-[var(--noodle-accent)]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[var(--noodle-accent)]"
    >
      {localizeUi(`ui.slurp.rapport.tier.${rapport.tier}`)}
    </span>
  );
}
